const mongoose = require("mongoose");

const AllocationSchema = new mongoose.Schema(
  {
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: "Request", required: true, index: true },
    resourceId: { type: mongoose.Schema.Types.ObjectId, ref: "Resource", required: true, index: true },
    decidedBy: { type: String, enum: ["go-engine", "manual"], default: "go-engine", index: true },
    score: { type: Number, default: 0 },
    details: { type: Object, default: {} }
  },
  { timestamps: true }
);

// Ensure idempotency: a request can have at most one allocation.
AllocationSchema.index({ requestId: 1 }, { unique: true });

module.exports = mongoose.model("Allocation", AllocationSchema);

