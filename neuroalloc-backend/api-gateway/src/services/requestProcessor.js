const Request = require("../models/Request");
const Resource = require("../models/Resource");
const Allocation = require("../models/Allocation");
const { requestAllocationDecision } = require("./goClient");
const { logger } = require("../utils/logger");
const { getIO } = require("../sockets");
const { randomUUID } = require("crypto");

const POLL_MS = Number(process.env.REQUEST_PROCESSOR_POLL_MS || 500);
const BATCH_SIZE = Number(process.env.REQUEST_PROCESSOR_BATCH_SIZE || 5);
const LEASE_MS = Number(process.env.REQUEST_PROCESSOR_LEASE_MS || 30_000);

const PROCESSOR_ID = process.env.REQUEST_PROCESSOR_ID || randomUUID();

function startRequestProcessor() {
  setInterval(() => {
    tick().catch((err) => logger.error({ err }, "request processor tick failed"));
  }, POLL_MS).unref();
}

async function tick() {
  // Claim up to BATCH_SIZE requests using a lease. Safe for multiple gateway replicas.
  const claimed = [];
  for (let i = 0; i < BATCH_SIZE; i++) {
    const now = new Date();

    // Exponential-ish backoff using attempts (capped).
    // Next eligible time = lastAttemptAt + min(60s, 2^attempts * 500ms)
    const doc = await Request.findOneAndUpdate(
      {
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
          processingBy: PROCESSOR_ID,
          processingLeaseUntil: new Date(Date.now() + LEASE_MS),
          lastAttemptAt: now,
        },
        $inc: { attempts: 1 },
      },
      { sort: { createdAt: 1 }, new: true }
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

  const available = await Resource.find({ type: latest.resourceType, isAvailable: true }).lean();

  let decision;
  try {
    decision = await requestAllocationDecision({
      request: {
        id: String(latest._id),
        resourceType: latest.resourceType,
        quantity: latest.quantity,
        priority: latest.priority,
      },
      resources: available.map((r) => ({
        id: String(r._id),
        type: r.type,
        capacity: r.capacity,
        isAvailable: r.isAvailable,
      })),
    });
  } catch (err) {
    // Go engine down/busy: release lease and return to pending for retry.
    await Request.updateOne(
      { _id: latest._id, status: "processing", processingBy: PROCESSOR_ID },
      { $set: { status: "pending", reason: "engine unavailable", processingBy: "" }, $unset: { processingLeaseUntil: 1 } }
    );
    emitStatus(latest.userId, { requestId: String(latest._id), status: "pending", reason: "engine unavailable" });
    return;
  }

  const allocation = decision?.allocation;
  if (allocation?.resourceId) {
    // Atomically reserve capacity first (avoid negative capacity / double-alloc).
    const reserved = await Resource.findOneAndUpdate(
      { _id: allocation.resourceId, isAvailable: true, capacity: { $gte: latest.quantity } },
      { $inc: { capacity: -latest.quantity } },
      { new: true }
    );

    if (!reserved) {
      await Request.updateOne(
        { _id: latest._id, status: "processing", processingBy: PROCESSOR_ID },
        { $set: { status: "pending", reason: "resource capacity changed, retrying" }, $set: { processingBy: "" }, $unset: { processingLeaseUntil: 1 } }
      );
      emitStatus(latest.userId, { requestId: String(latest._id), status: "pending", reason: "resource capacity changed, retrying" });
      return;
    }

    if (reserved.capacity <= 0 && reserved.isAvailable) {
      reserved.isAvailable = false;
      await reserved.save();
    }

    // Persist allocation idempotently (unique index on requestId).
    await Allocation.updateOne(
      { requestId: latest._id },
      {
        $setOnInsert: {
          requestId: latest._id,
          resourceId: allocation.resourceId,
          decidedBy: "go-engine",
          score: allocation.score || 0,
          details: allocation.details || {},
        },
      },
      { upsert: true }
    );

    await Request.updateOne(
      { _id: latest._id, status: "processing", processingBy: PROCESSOR_ID },
      { $set: { status: "allocated", reason: "", processingBy: "" }, $unset: { processingLeaseUntil: 1 } }
    );
    emitStatus(latest.userId, { requestId: String(latest._id), status: "allocated", allocation });
  } else {
    await Request.updateOne(
      { _id: latest._id, status: "processing", processingBy: PROCESSOR_ID },
      { $set: { status: "rejected", reason: allocation?.reason || "no allocation found", processingBy: "" }, $unset: { processingLeaseUntil: 1 } }
    );
    emitStatus(latest.userId, { requestId: String(latest._id), status: "rejected", reason: allocation?.reason || "no allocation found" });
  }
}

function emitStatus(userId, payload) {
  try {
    const io = getIO();
    io.to(`user:${String(userId)}`).emit("request.status", payload);
    io.to("admins").emit("request.status", payload);
  } catch (_e) {
    // sockets not ready; ignore
  }
}

module.exports = { startRequestProcessor };

