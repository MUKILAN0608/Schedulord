const Request = require("../models/Request");
const Resource = require("../models/Resource");
const Allocation = require("../models/Allocation");
const SystemEvent = require("../models/SystemEvent");
const { requestAllocationDecision } = require("./goClient");
const { logger } = require("../utils/logger");
const { getIO } = require("../sockets");
const { publishEvent, TOPICS } = require("../config/kafka");
const { allocationsTotal } = require("../metrics/metrics");
const { randomUUID } = require("crypto");

const POLL_MS = Number(process.env.REQUEST_PROCESSOR_POLL_MS || 500);
const BATCH_SIZE = Number(process.env.REQUEST_PROCESSOR_BATCH_SIZE || 5);
const LEASE_MS = Number(process.env.REQUEST_PROCESSOR_LEASE_MS || 30_000);
const KAFKA_GRACE_MS = Number(process.env.REQUEST_PROCESSOR_KAFKA_GRACE_MS || 10_000);

const PROCESSOR_ID = process.env.REQUEST_PROCESSOR_ID || randomUUID();

// Use fallback allocation strategy when AI engine is unavailable
const USE_FALLBACK_ON_AI_FAILURE = process.env.USE_FALLBACK_ON_AI_FAILURE !== "false";

function startRequestProcessor() {
  setInterval(() => {
    tick().catch((err) => logger.error({ err }, "request processor tick failed"));
  }, POLL_MS).unref();
}

/**
 * Greedy fallback allocation: picks the first available resource
 * with sufficient capacity, sorted by priority order
 */
function getGreedyAllocation(requestDoc, availableResources) {
  if (availableResources.length === 0) {
    return null;
  }

  // Sort by capacity (descending) to use least-constrained resources first
  const sorted = availableResources.sort((a, b) => b.capacity - a.capacity);

  // Pick the first resource that has enough capacity
  const selected = sorted.find((r) => r.capacity >= requestDoc.quantity);
  if (!selected) {
    return null;
  }

  return {
    resourceId: String(selected._id),
    score: 0.5, // Low confidence score for fallback
    confidence: 0.3,
    strategy: "fallback-greedy",
    reason: "AI engine unavailable, using greedy fallback",
    alternatives: sorted.slice(1, 3).map((r) => ({
      id: String(r._id),
      capacity: r.capacity,
    })),
    details: {
      fallbackReason: "ai_engine_unavailable",
      selectedByCriteria: "first_available_with_capacity",
    },
  };
}

async function tick() {
  // Claim up to BATCH_SIZE requests using a lease. Safe for multiple gateway replicas.
  const claimed = [];
  for (let i = 0; i < BATCH_SIZE; i++) {
    const now = new Date();
    const kafkaGraceCutoff = new Date(Date.now() - KAFKA_GRACE_MS);

    const doc = await Request.findOneAndUpdate(
      {
        adminApproved: true,
        $or: [
          { kafkaApprovedPublished: false },
          // If Kafka path doesn't finish in grace window, fallback to processor.
          { kafkaApprovedPublished: true, updatedAt: { $lte: kafkaGraceCutoff } },
        ],
        status: { $in: ["pending", "processing"] },
        $or: [
          { status: "pending" },
          { processingLeaseUntil: { $lte: now } },
          { processingLeaseUntil: null },
        ],
        $and: [
          { status: { $ne: "cancelled" } },
          { status: { $ne: "allocated" } },
          { status: { $ne: "rejected" } },
        ],
        $expr: {
          $or: [
            { $eq: ["$lastAttemptAt", null] },
            {
              $lte: [
                { $add: ["$lastAttemptAt", { $multiply: [500, { $pow: [2, "$attempts"] }] }] },
                now,
              ],
            },
          ],
        },
      },
      {
        $set: {
          status: "processing",
          reason: "",
          // Processor is taking ownership from here.
          kafkaApprovedPublished: false,
          processingBy: PROCESSOR_ID,
          processingLeaseUntil: new Date(Date.now() + LEASE_MS),
          lastAttemptAt: now,
        },
        $inc: { attempts: 1 },
      },
      { sort: { priority: -1, createdAt: 1 }, new: true }
    ).lean();
    if (!doc) break;
    claimed.push(doc);
  }

  await Promise.all(claimed.map((r) => processOne(r)));
}

async function processOne(requestDoc) {
  // Verify we still hold the lease.
  const latest = await Request.findOne({
    _id: requestDoc._id,
    processingBy: PROCESSOR_ID,
    status: "processing",
  }).lean();
  if (!latest) return;
  if (latest.status === "cancelled") return;
  if (!latest.adminApproved) return;

  let available = await Resource.find({ type: latest.resourceType, isAvailable: true }).lean();
  if (latest.preferredResourceId) {
    available = available.filter((r) => String(r._id) === String(latest.preferredResourceId));
  }

  let decision;
  try {
    decision = await requestAllocationDecision({
      request: {
        id: String(latest._id),
        resourceType: latest.resourceType,
        quantity: latest.quantity,
        priority: latest.priority,
        userRole: "user",
        timestamp: new Date().toISOString(),
      },
      resources: available.map((r) => ({
        id: String(r._id),
        type: r.type,
        capacity: r.capacity,
        isAvailable: r.isAvailable,
      })),
    });
  } catch (err) {
    // Go engine down/busy: try fallback allocation or release lease for retry
    logger.warn({ err, requestId: String(latest._id) }, "AI engine unavailable");

    if (USE_FALLBACK_ON_AI_FAILURE) {
      // Attempt greedy fallback allocation
      const fallbackAllocation = getGreedyAllocation(latest, available);
      if (fallbackAllocation?.resourceId) {
        decision = { allocation: fallbackAllocation };
        logger.info(
          { requestId: String(latest._id), fallbackAllocation },
          "Using fallback allocation strategy"
        );
      } else {
        // No suitable resources even for fallback
        await Request.updateOne(
          { _id: latest._id, status: "processing", processingBy: PROCESSOR_ID },
          {
            $set: {
              status: "pending",
              reason: "engine unavailable and no fallback available",
              processingBy: "",
            },
            $unset: { processingLeaseUntil: 1 },
          }
        );
        emitStatus(latest.userId, {
          requestId: String(latest._id),
          status: "pending",
          reason: "engine unavailable and no fallback available",
        });
        return;
      }
    } else {
      // Fallback disabled: release lease and return to pending for retry
      await Request.updateOne(
        { _id: latest._id, status: "processing", processingBy: PROCESSOR_ID },
        {
          $set: { status: "pending", reason: "engine unavailable", processingBy: "" },
          $unset: { processingLeaseUntil: 1 },
        }
      );
      emitStatus(latest.userId, {
        requestId: String(latest._id),
        status: "pending",
        reason: "engine unavailable",
      });
      return;
    }
  }

  const allocation = decision?.allocation;
  if (allocation?.resourceId) {
    // Atomically reserve capacity
    const reserved = await Resource.findOneAndUpdate(
      { _id: allocation.resourceId, isAvailable: true, capacity: { $gte: latest.quantity } },
      { $inc: { capacity: -latest.quantity } },
      { new: true }
    );

    if (!reserved) {
      await Request.updateOne(
        { _id: latest._id, status: "processing", processingBy: PROCESSOR_ID },
        { $set: { status: "pending", reason: "resource capacity changed, retrying", processingBy: "" }, $unset: { processingLeaseUntil: 1 } }
      );
      emitStatus(latest.userId, { requestId: String(latest._id), status: "pending", reason: "resource capacity changed, retrying" });
      return;
    }

    if (reserved.capacity <= 0 && reserved.isAvailable) {
      reserved.isAvailable = false;
      await reserved.save();
    }

    // Persist allocation idempotently
    await Allocation.updateOne(
      { requestId: latest._id },
      {
        $setOnInsert: {
          requestId: latest._id,
          resourceId: allocation.resourceId,
          decidedBy: allocation.decidedBy || (allocation.strategy?.startsWith("fallback") ? "fallback-allocator" : "go-engine"),
          score: allocation.score || 0,
          confidence: allocation.confidence || 0,
          strategy: allocation.strategy || "immediate",
          alternatives: allocation.alternatives || [],
          details: allocation.details || {},
        },
      },
      { upsert: true }
    );

    await Request.updateOne(
      { _id: latest._id, status: "processing", processingBy: PROCESSOR_ID },
      { $set: { status: "allocated", reason: "", processingBy: "" }, $unset: { processingLeaseUntil: 1 } }
    );

    allocationsTotal.inc({ status: "allocated", strategy: allocation.strategy || "immediate" });

    await SystemEvent.create({
      type: "allocation",
      severity: allocation.strategy?.startsWith("fallback") ? "warning" : "info",
      title: allocation.strategy?.startsWith("fallback") ? "Fallback Allocation Completed" : "AI Allocation Completed",
      message: allocation.strategy?.startsWith("fallback")
        ? `Fallback allocator assigned resource ${allocation.resourceId} (AI engine was unavailable)`
        : `Post-approval AI allocated resource ${allocation.resourceId} (score: ${(allocation.score || 0).toFixed(2)}, confidence: ${((allocation.confidence || 0) * 100).toFixed(0)}%)`,
      requestId: latest._id,
      resourceId: allocation.resourceId,
      userId: latest.userId,
      metadata: allocation,
    });

    // Publish result to Kafka
    await publishEvent(TOPICS.ALLOCATION_RESULTS, String(latest._id), {
      type: "allocation.completed",
      requestId: String(latest._id),
      resourceId: allocation.resourceId,
      score: allocation.score,
      strategy: allocation.strategy,
      timestamp: new Date().toISOString(),
    });

    emitStatus(latest.userId, { requestId: String(latest._id), status: "allocated", allocation });
  } else {
    await Request.updateOne(
      { _id: latest._id, status: "processing", processingBy: PROCESSOR_ID },
      {
        $set: {
          status: "pending",
          reason: allocation?.reason || "no allocation found; waiting for available resources",
          processingBy: "",
        },
        $unset: { processingLeaseUntil: 1 },
      }
    );

    allocationsTotal.inc({ status: "pending", strategy: "none" });

    await SystemEvent.create({
      type: "allocation",
      severity: "warning",
      title: "Allocation Deferred",
      message: allocation?.reason || "No matching resources currently available. Request remains pending.",
      requestId: latest._id,
      userId: latest.userId,
    });

    emitStatus(latest.userId, {
      requestId: String(latest._id),
      status: "pending",
      reason: allocation?.reason || "no allocation found; waiting for available resources",
    });
  }
}

function emitStatus(userId, payload) {
  try {
    const io = getIO();
    io.to(`user:${String(userId)}`).emit("request.status", payload);
    io.to("admins").emit("request.status", payload);
  } catch {
    // sockets not ready; ignore
  }
}

module.exports = { startRequestProcessor };
