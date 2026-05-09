const Request = require("../models/Request");
const Resource = require("../models/Resource");
const Allocation = require("../models/Allocation");
const SystemEvent = require("../models/SystemEvent");
const { logger } = require("../utils/logger");
const { getIO } = require("../sockets");
const { kafka, TOPICS } = require("../config/kafka");
const { allocationsTotal } = require("../metrics/metrics");

let consumer = null;

/**
 * Kafka consumer that reads allocation results from the Go engine.
 * Matches the README event flow:
 *   Kafka (schedulord.allocation.results) -> Node -> DB update + WebSocket emit
 */
async function startKafkaResultConsumer() {
  try {
    consumer = kafka.consumer({
      groupId: "schedulord-result-processor",
      sessionTimeout: 30000,
      heartbeatInterval: 3000,
    });

    await consumer.connect();
    await consumer.subscribe({ topic: TOPICS.ALLOCATION_RESULTS, fromBeginning: false });

    logger.info("Kafka result consumer connected on " + TOPICS.ALLOCATION_RESULTS);

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const result = JSON.parse(message.value.toString());
          await handleAllocationResult(result);
        } catch (err) {
          logger.error({ err, topic, partition }, "Failed to process Kafka result message");
        }
      },
    });
  } catch (err) {
    logger.warn({ err: err.message }, "Kafka result consumer failed — falling back to HTTP polling");
    consumer = null;
  }
}

async function handleAllocationResult(result) {
  const { requestId, userId, allocation } = result;
  if (!requestId) return;

  const requestDoc = await Request.findOne({
    _id: requestId,
    status: { $in: ["pending", "processing"] },
  }).lean();

  if (!requestDoc) return;

  if (allocation && allocation.resourceId) {
    const reserved = await Resource.findOneAndUpdate(
      { _id: allocation.resourceId, isAvailable: true, capacity: { $gte: requestDoc.quantity } },
      { $inc: { capacity: -requestDoc.quantity } },
      { new: true }
    );

    if (!reserved) {
      await Request.updateOne(
        { _id: requestId, status: { $in: ["pending", "processing"] } },
        { $set: { status: "pending", reason: "resource capacity changed, retrying" } }
      );
      return;
    }

    if (reserved.capacity <= 0 && reserved.isAvailable) {
      reserved.isAvailable = false;
      await reserved.save();
    }

    await Allocation.updateOne(
      { requestId },
      {
        $setOnInsert: {
          requestId,
          resourceId: allocation.resourceId,
          decidedBy: "go-engine-kafka",
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
      { _id: requestId, status: { $in: ["pending", "processing"] } },
      { $set: { status: "allocated", reason: "", processingBy: "" } }
    );

    allocationsTotal.inc({ status: "allocated", strategy: allocation.strategy || "immediate" });

    await SystemEvent.create({
      type: "allocation",
      severity: "info",
      title: "Kafka Auto-Allocated",
      message: "Resource " + allocation.resourceId + " assigned via Kafka pipeline (score: " + (allocation.score || 0).toFixed(2) + ")",
      requestId,
      resourceId: allocation.resourceId,
      userId: userId || requestDoc.userId,
      metadata: Object.assign({}, allocation, { pipeline: "kafka" }),
    });

    emitStatus(userId || requestDoc.userId, { requestId: String(requestId), status: "allocated", allocation });
  } else {
    await Request.updateOne(
      { _id: requestId, status: { $in: ["pending", "processing"] } },
      { $set: { status: "pending", reason: "waiting for available resources", processingBy: "" } }
    );

    await SystemEvent.create({
      type: "allocation",
      severity: "warning",
      title: "Allocation Delayed",
      message: "Insufficient capacity. Request queued and waiting for resources.",
      requestId,
      userId: userId || requestDoc.userId,
      metadata: { pipeline: "kafka", reason: (allocation && allocation.reason) || "No matching resources" },
    });

    emitStatus(userId || requestDoc.userId, { requestId: String(requestId), status: "pending", reason: "waiting for available resources" });
  }

  logger.info({ requestId, status: (allocation && allocation.resourceId) ? "allocated" : "rejected", pipeline: "kafka" }, "Kafka result processed");
}

function emitStatus(userId, payload) {
  try {
    const io = getIO();
    io.to("user:" + String(userId)).emit("request.status", payload);
    io.to("admins").emit("request.status", payload);
  } catch {
    // sockets not ready
  }
}

module.exports = { startKafkaResultConsumer };