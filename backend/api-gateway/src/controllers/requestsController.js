const createError = require("http-errors");
const Request = require("../models/Request");
const Allocation = require("../models/Allocation");
const Resource = require("../models/Resource");
const SystemEvent = require("../models/SystemEvent");
const User = require("../models/User");
const { requestAllocationDecision } = require("../services/goClient");
const { publishEvent, TOPICS } = require("../config/kafka");
const { kafkaEventsPublished } = require("../metrics/metrics");

function buildGreedyImmediateAllocation(doc, available) {
  if (!Array.isArray(available) || available.length === 0) return null;
  const candidates = available
    .filter((r) => r && r.isAvailable && Number(r.capacity || 0) >= Number(doc.quantity || 0))
    .sort((a, b) => Number(b.capacity || 0) - Number(a.capacity || 0));
  if (candidates.length === 0) return null;
  const selected = candidates[0];
  return {
    resourceId: String(selected._id),
    score: 0.62,
    confidence: 0.7,
    strategy: "approve-greedy-immediate",
    reason: "direct allocation during approval",
    alternatives: candidates.slice(1, 3).map((r) => ({
      resourceId: String(r._id),
      score: 0.5,
      strategy: "approve-greedy-immediate",
    })),
    details: {
      fallbackReason: "direct_approval_allocation",
      selectedBy: "highest_capacity_available",
    },
  };
}

async function listRequests(req, res, next) {
  try {
    let filter = {};
    if (req.user.role === 'admin') {
      // Admin sees only requests assigned to them.
      filter.reviewerAdminId = req.user.sub;
      if (req.query.status && req.query.status !== 'all') {
        filter.status = req.query.status;
        // In decision queue, "pending" should mean "awaiting admin decision",
        // not "already approved and waiting for allocator completion".
        if (req.query.status === "pending") {
          filter.adminApproved = false;
        }
      }
      if (req.query.userId) {
        filter.userId = req.query.userId;
      }
    } else {
      // Client sees only their own requests
      filter.userId = req.user.sub;
      if (req.query.status && req.query.status !== 'all') {
        filter.status = req.query.status;
      }
    }

    const query = Request.find(filter).sort({ createdAt: -1 });
    if (req.user.role === "admin") {
      query.populate("userId", "name email role");
      query.populate("reviewerAdminId", "name");
    }
    const items = await query.lean();
    res.json({ items });
  } catch (err) {
    next(err);
  }
}


async function createRequest(req, res, next) {
  try {
    const { reviewerAdminId, resourceType, preferredResourceId, quantity, priority } = req.body;
    const idempotencyKey = String(req.headers["idempotency-key"] || "").trim();

    const reviewerAdmin = await User.findOne({ _id: reviewerAdminId, role: "admin", isActive: true }).lean();
    if (!reviewerAdmin) throw createError(400, "Selected admin reviewer is not available");

    if (preferredResourceId) {
      const preferred = await Resource.findById(preferredResourceId).lean();
      if (!preferred) throw createError(400, "Preferred resource not found");
      if (!preferred.isAvailable || preferred.capacity < quantity) {
        throw createError(400, "Preferred resource is not currently available");
      }
      if (preferred.type !== resourceType) {
        throw createError(400, "Preferred resource type does not match request type");
      }
    }

    let request;
    if (idempotencyKey) {
      request = await Request.findOneAndUpdate(
        { userId: req.user.sub, idempotencyKey },
        {
          $setOnInsert: {
            userId: req.user.sub,
            resourceType,
            quantity,
            priority,
            reviewerAdminId,
            preferredResourceId: preferredResourceId || null,
            status: "pending",
            adminApproved: false,
            kafkaApprovedPublished: false,
            idempotencyKey,
          },
        },
        { upsert: true, new: true }
      );
    } else {
      request = await Request.create({
        userId: req.user.sub,
        resourceType,
        quantity,
        priority,
        reviewerAdminId,
        preferredResourceId: preferredResourceId || null,
        status: "pending",
        adminApproved: false,
        kafkaApprovedPublished: false,
      });
    }

    // Approval gate defaults: admin has not approved yet.
    // Note: request remains in "pending" status until admin approval.

    // Record system event only.
    // Allocation Kafka publish occurs strictly on admin approval.
    await SystemEvent.create({
      type: "allocation",
      severity: "info",
      title: "New Allocation Request",
      message: "Request for " + quantity + "x " + resourceType + " awaiting admin approval",
      requestId: request._id,
      userId: req.user.sub,
      metadata: { resourceType, quantity, priority, reviewerAdminId, kafkaPublished: false },
    });

    request.reason = "awaiting admin approval";
    res.status(202).json(request);
  } catch (err) {
    next(err);
  }
}

async function getRequest(req, res, next) {
  try {
    const doc = await Request.findById(req.params.id).lean();
    if (!doc) throw createError(404, "Request not found");
    if (String(doc.userId) !== String(req.user.sub) && req.user.role !== 'admin') {
      throw createError(403, "Forbidden");
    }

    const allocation = await Allocation.findOne({ requestId: doc._id }).lean();
    res.json({ ...doc, allocation: allocation || null });
  } catch (err) {
    next(err);
  }
}

async function cancelRequest(req, res, next) {
  try {
    const doc = await Request.findById(req.params.id);
    if (!doc) throw createError(404, "Request not found");
    if (String(doc.userId) !== String(req.user.sub) && req.user.role !== 'admin') {
      throw createError(403, "Forbidden");
    }
    doc.status = "cancelled";
    doc.adminApproved = false;
    doc.kafkaApprovedPublished = false;
    await doc.save();

    await publishEvent(TOPICS.SYSTEM_EVENTS, String(doc._id), {
      type: "allocation.request.cancelled",
      requestId: String(doc._id),
      timestamp: new Date().toISOString(),
    });

    res.json(doc);
  } catch (err) {
    next(err);
  }
}

async function runAllocationNow(req, res, next) {
  try {
    // Admin-only endpoint that calls Go synchronously via HTTP.
    const doc = await Request.findById(req.params.id).lean();
    if (!doc) throw createError(404, "Request not found");

    const available = await Resource.find({ type: doc.resourceType, isAvailable: true }).lean();
    const decision = await requestAllocationDecision({
      request: {
        id: String(doc._id),
        resourceType: doc.resourceType,
        quantity: doc.quantity,
        priority: doc.priority,
      },
      resources: available.map((r) => ({
        id: String(r._id),
        type: r.type,
        capacity: r.capacity,
        isAvailable: r.isAvailable,
      })),
    });

    if (decision && decision.allocation && decision.allocation.resourceId) {
      await Allocation.create({
        requestId: doc._id,
        resourceId: decision.allocation.resourceId,
        decidedBy: "go-engine",
        score: decision.allocation.score || 0,
        confidence: decision.allocation.confidence || 0,
        strategy: decision.allocation.strategy || "immediate",
        alternatives: decision.allocation.alternatives || [],
        details: decision.allocation.details || {},
      });
      await Request.updateOne({ _id: doc._id }, { $set: { status: "allocated", reason: "" } });

      await SystemEvent.create({
        type: "allocation",
        severity: "info",
        title: "Resource Allocated",
        message: "Request " + doc._id + " allocated to resource " + decision.allocation.resourceId + " (score: " + (decision.allocation.score || 0).toFixed(2) + ")",
        requestId: doc._id,
        resourceId: decision.allocation.resourceId,
        metadata: decision.allocation,
      });
    } else {
      await Request.updateOne({
        _id: doc._id,
      }, {
        $set: { status: "pending", reason: "waiting for available resources" },
      });

      await SystemEvent.create({
        type: "allocation",
        severity: "warning",
        title: "Allocation Delayed",
        message: "Insufficient capacity. Request queued and waiting for resources.",
        requestId: doc._id,
        userId: doc.userId,
      });
    }

    res.json({ decision });
  } catch (err) {
    next(err);
  }
}

async function approveRequest(req, res, next) {
  try {
    const doc = await Request.findById(req.params.id);
    if (!doc) throw createError(404, "Request not found");
    if (doc.status === "cancelled") throw createError(409, "Request is cancelled");
    if (doc.status === "allocated") throw createError(409, "Request already allocated");
    if (doc.status === "rejected") throw createError(409, "Request already rejected");
    if (String(doc.reviewerAdminId) !== String(req.user.sub)) {
      throw createError(403, "Only the assigned admin can approve this request");
    }

    // Ensure the request is now eligible for processing/fallback.
    doc.adminApproved = true;

    const available = await Resource.find({ type: doc.resourceType, isAvailable: true }).lean();
    const queueLength = await Request.countDocuments({
      resourceType: doc.resourceType,
      status: { $in: ["pending", "processing"] },
    });

    const published = await publishEvent(
      TOPICS.ALLOCATION_REQUESTS,
      String(doc._id),
      {
        type: "allocation.request.approved",
        requestId: String(doc._id),
        userId: String(doc.userId),
        userRole: "user",
        resourceType: doc.resourceType,
        quantity: doc.quantity,
        priority: doc.priority,
        approved: true,
        timestamp: new Date().toISOString(),
        queueLength,
        resources: available.map((r) => ({
          id: String(r._id),
          type: r.type,
          capacity: r.capacity,
          isAvailable: r.isAvailable,
        })),
      }
    );

    // Record whether Kafka publish succeeded. requestProcessor uses this to decide fallback.
    doc.kafkaApprovedPublished = !!published;
    doc.reason = "accepted by admin";
    if (doc.status !== "pending") doc.status = "pending";

    // Try to allocate immediately so approval resolves to "allocated" in one action.
    // If AI decision fails or returns no resource, use direct greedy allocation fallback.
    let immediateAllocated = false;
    let immediateAllocation = null;
    try {
      const decision = await requestAllocationDecision({
        request: {
          id: String(doc._id),
          resourceType: doc.resourceType,
          quantity: doc.quantity,
          priority: doc.priority,
          userRole: "user",
          timestamp: new Date().toISOString(),
          queueLength,
        },
        resources: available.map((r) => ({
          id: String(r._id),
          type: r.type,
          capacity: r.capacity,
          isAvailable: r.isAvailable,
        })),
      });

      const allocation = decision?.allocation;
      if (allocation?.resourceId) immediateAllocation = allocation;
      if (!immediateAllocation) {
        immediateAllocation = buildGreedyImmediateAllocation(doc, available);
      }
    } catch {
      immediateAllocation = buildGreedyImmediateAllocation(doc, available);
    }

    if (immediateAllocation?.resourceId) {
      // Atomically reserve capacity
      const reserved = await Resource.findOneAndUpdate(
        { _id: immediateAllocation.resourceId, isAvailable: true, capacity: { $gte: doc.quantity } },
        { $inc: { capacity: -doc.quantity } },
        { new: true }
      );

      if (reserved) {
        if (reserved.capacity <= 0 && reserved.isAvailable) {
          reserved.isAvailable = false;
          await reserved.save();
        }

        await Allocation.updateOne(
          { requestId: doc._id },
          {
            $setOnInsert: {
              requestId: doc._id,
              resourceId: immediateAllocation.resourceId,
              decidedBy: "approve-immediate",
              score: immediateAllocation.score || 0,
              confidence: immediateAllocation.confidence || 0,
              strategy: immediateAllocation.strategy || "immediate",
              alternatives: immediateAllocation.alternatives || [],
              details: immediateAllocation.details || {},
            },
          },
          { upsert: true }
        );

        doc.status = "allocated";
        doc.reason = "";
        immediateAllocated = true;

        await SystemEvent.create({
          type: "allocation",
          severity: "info",
          title: "Resource Allocated",
          message:
            "Request " +
            doc._id +
            " allocated immediately on approval to resource " +
            immediateAllocation.resourceId,
          requestId: doc._id,
          resourceId: immediateAllocation.resourceId,
          userId: doc.userId,
          metadata: immediateAllocation,
        });
      }
    }

    await doc.save();

    if (published) {
      kafkaEventsPublished.inc({ topic: TOPICS.ALLOCATION_REQUESTS, status: "success" });
    } else {
      kafkaEventsPublished.inc({ topic: TOPICS.ALLOCATION_REQUESTS, status: "fallback" });
    }

    await SystemEvent.create({
      type: "allocation",
      severity: "info",
      title: "Request Approved",
      message: "Admin approved request; published to Kafka for engine processing",
      requestId: doc._id,
      userId: doc.userId,
      metadata: { kafkaPublished: published },
    });

    res.json({ ok: true, kafkaPublished: published, immediateAllocated, status: doc.status });
  } catch (err) {
    next(err);
  }
}

async function rejectRequest(req, res, next) {
  try {
    const doc = await Request.findById(req.params.id);
    if (!doc) throw createError(404, "Request not found");
    if (String(doc.reviewerAdminId) !== String(req.user.sub)) {
      throw createError(403, "Only the assigned admin can reject this request");
    }
    if (doc.status === "allocated") throw createError(409, "Request already allocated");
    if (doc.status === "cancelled") throw createError(409, "Request already cancelled");

    doc.status = "rejected";
    doc.reason = String(req.body?.reason || "rejected by reviewer");
    doc.adminApproved = false;
    doc.kafkaApprovedPublished = false;
    await doc.save();

    await publishEvent(TOPICS.SYSTEM_EVENTS, String(doc._id), {
      type: "allocation.request.rejected",
      requestId: String(doc._id),
      userId: String(doc.userId),
      reason: doc.reason,
      timestamp: new Date().toISOString(),
    });

    await SystemEvent.create({
      type: "allocation",
      severity: "warning",
      title: "Request Rejected",
      message: doc.reason,
      requestId: doc._id,
      userId: doc.userId,
    });

    res.json(doc);
  } catch (err) {
    next(err);
  }
}

async function listMyAdminDecisions(req, res, next) {
  try {
    if (req.user.role !== "admin") throw createError(403, "Forbidden");
    const items = await Request.find({
      reviewerAdminId: req.user.sub,
      status: { $in: ["allocated", "rejected"] },
    })
      .sort({ updatedAt: -1 })
      .limit(100)
      .populate("userId", "name email")
      .lean();

    res.json({ items });
  } catch (err) {
    next(err);
  }
}

async function clearAllRequests(req, res, next) {
  try {
    const result = await Request.deleteMany({});
    res.json({ ok: true, deletedCount: result.deletedCount });
  } catch (err) {
    next(err);
  }
}

module.exports = { listRequests, createRequest, getRequest, cancelRequest, runAllocationNow, approveRequest, rejectRequest, clearAllRequests, listMyAdminDecisions };