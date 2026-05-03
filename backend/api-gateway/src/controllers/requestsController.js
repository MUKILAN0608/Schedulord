const createError = require("http-errors");
const Request = require("../models/Request");
const Allocation = require("../models/Allocation");
const Resource = require("../models/Resource");
const SystemEvent = require("../models/SystemEvent");
const { requestAllocationDecision } = require("../services/goClient");
const { publishEvent, TOPICS } = require("../config/kafka");
const { kafkaEventsPublished } = require("../metrics/metrics");

async function listRequests(req, res, next) {
  try {
    let filter = {};
    if (req.user.role === 'admin') {
      // Admin sees only pending requests that need attention, not all requests.
      filter.status = 'pending';
    } else {
      // Client sees only their own requests.
      filter.userId = req.user.sub;
    }

    // Optional query overrides for admin
    if (req.user.role === 'admin' && req.query.userId) {
      filter.userId = req.query.userId;
    }
    if (req.user.role === 'admin' && req.query.status) {
      filter.status = req.query.status;
    }

    const items = await Request.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

async function createRequest(req, res, next) {
  try {
    const { resourceType, quantity, priority } = req.body;
    const idempotencyKey = String(req.headers["idempotency-key"] || "").trim();

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
            status: "pending",
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
        status: "pending",
      });
    }

    // Query available resources to enrich the Kafka message
    // so the Go engine Kafka consumer has everything it needs
    const available = await Resource.find({ type: resourceType, isAvailable: true }).lean();

    // Publish enriched event to Kafka for event-driven processing
    const published = await publishEvent(
      TOPICS.ALLOCATION_REQUESTS,
      String(request._id),
      {
        type: "allocation.request.created",
        requestId: String(request._id),
        userId: String(req.user.sub),
        resourceType,
        quantity,
        priority,
        resources: available.map((r) => ({
          id: String(r._id),
          type: r.type,
          capacity: r.capacity,
          isAvailable: r.isAvailable,
        })),
        timestamp: new Date().toISOString(),
      }
    );

    if (published) {
      kafkaEventsPublished.inc({ topic: TOPICS.ALLOCATION_REQUESTS, status: "success" });
    } else {
      kafkaEventsPublished.inc({ topic: TOPICS.ALLOCATION_REQUESTS, status: "fallback" });
    }

    // Record system event
    await SystemEvent.create({
      type: "allocation",
      severity: "info",
      title: "New Allocation Request",
      message: "Request for " + quantity + "x " + resourceType + " (priority: " + priority + ")",
      requestId: request._id,
      userId: req.user.sub,
      metadata: { resourceType, quantity, priority, kafkaPublished: published },
    });

    // Event-driven: Go Kafka consumer processes, or requestProcessor polls as fallback.
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

module.exports = { listRequests, createRequest, getRequest, cancelRequest, runAllocationNow };