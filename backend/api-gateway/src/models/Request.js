const mongoose = require("mongoose");

const RequestSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    reviewerAdminId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    resourceType: { type: String, required: true, index: true },
    preferredResourceId: { type: mongoose.Schema.Types.ObjectId, ref: "Resource", default: null, index: true },
    quantity: { type: Number, required: true, min: 1 },
    priority: { type: Number, default: 0, min: 0, max: 100, index: true },
    status: {
      type: String,
      enum: ["pending", "processing", "allocated", "rejected", "cancelled"],
      default: "pending",
      index: true
    },
    reason: { type: String, default: "" },

    // Approval gate:
    // - adminApproved: set true only after admin approves
    // - kafkaApprovedPublished: set true only if the gateway successfully published the approved event to Kafka
    //   (requestProcessor will only auto-allocate when this is false).
    adminApproved: { type: Boolean, default: false, index: true },
    kafkaApprovedPublished: { type: Boolean, default: false, index: true },

    // Distributed-safe processing fields (lease-based claiming)
    processingBy: { type: String, default: "", index: true },
    processingLeaseUntil: { type: Date, default: null, index: true },
    attempts: { type: Number, default: 0, min: 0 },
    lastAttemptAt: { type: Date, default: null },

    // Kafka event tracking
    kafkaOffset: { type: String, default: "" },
    kafkaPartition: { type: Number, default: -1 },

    // Client-provided or server-generated key to prevent duplicate submits
    idempotencyKey: { type: String, default: "", index: true }
  },
  { timestamps: true }
);

// One idempotency key per user (only if provided).
RequestSchema.index(
  { userId: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string", $ne: "" } } }
);

module.exports = mongoose.model("Request", RequestSchema);
