const createError = require("http-errors");
const Request = require("../models/Request");
const Allocation = require("../models/Allocation");
const Resource = require("../models/Resource");
const { requestAllocationDecision } = require("../services/goClient");

async function listRequests(req, res, next) {
  try {
    const filter = req.user.role === "admin" ? {} : { userId: req.user.sub };
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

    // Idempotent create: if the same user submits the same idempotency key again, return the existing request.
    // If no key is provided, we create a new request as normal.
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

    // Event-driven behavior: request processor claims pending requests and allocates asynchronously.
    res.status(202).json(request);
  } catch (err) {
    next(err);
  }
}

async function getRequest(req, res, next) {
  try {
    const doc = await Request.findById(req.params.id).lean();
    if (!doc) throw createError(404, "Request not found");
    if (req.user.role !== "admin" && String(doc.userId) !== String(req.user.sub)) {
      throw createError(403, "Forbidden");
    }
    res.json(doc);
  } catch (err) {
    next(err);
  }
}

async function cancelRequest(req, res, next) {
  try {
    const doc = await Request.findById(req.params.id);
    if (!doc) throw createError(404, "Request not found");
    if (req.user.role !== "admin" && String(doc.userId) !== String(req.user.sub)) {
      throw createError(403, "Forbidden");
    }
    doc.status = "cancelled";
    await doc.save();
    res.json(doc);
  } catch (err) {
    next(err);
  }
}

async function runAllocationNow(req, res, next) {
  try {
    // Admin-only endpoint that calls Go synchronously.
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

    // Minimal persistence: if Go selects a resource, create Allocation and mark Request as allocated.
    if (decision?.allocation?.resourceId) {
      await Allocation.create({
        requestId: doc._id,
        resourceId: decision.allocation.resourceId,
        decidedBy: "go-engine",
        score: decision.allocation.score || 0,
        details: decision.allocation.details || {},
      });
      await Request.updateOne({ _id: doc._id }, { $set: { status: "allocated", reason: "" } });
    } else {
      await Request.updateOne({
        _id: doc._id,
      }, {
        $set: { status: "rejected", reason: decision?.allocation?.reason || "No allocation found" },
      });
    }

    res.json({ decision });
  } catch (err) {
    next(err);
  }
}

module.exports = { listRequests, createRequest, getRequest, cancelRequest, runAllocationNow };

