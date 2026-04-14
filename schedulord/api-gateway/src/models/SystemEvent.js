const mongoose = require("mongoose");

const SystemEventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ["allocation", "conflict", "prediction", "system", "error", "simulation"],
      index: true
    },
    severity: {
      type: String,
      enum: ["info", "warning", "error", "critical"],
      default: "info",
      index: true
    },
    title: { type: String, required: true },
    message: { type: String, default: "" },
    metadata: { type: Object, default: {} },
    requestId: { type: mongoose.Schema.Types.ObjectId, ref: "Request", index: true },
    resourceId: { type: mongoose.Schema.Types.ObjectId, ref: "Resource", index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  },
  { timestamps: true }
);

// TTL index: auto-delete events older than 30 days
SystemEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 3600 });

module.exports = mongoose.model("SystemEvent", SystemEventSchema);
