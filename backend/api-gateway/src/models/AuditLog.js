const mongoose = require("mongoose");

const AuditLogSchema = new mongoose.Schema(
  {
    actorUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    action: { type: String, required: true, index: true },
    entityType: { type: String, required: true, index: true },
    entityId: { type: String, required: true, index: true },
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    details: { type: Object, default: {} }
  },
  { timestamps: true }
);

module.exports = mongoose.model("AuditLog", AuditLogSchema);
