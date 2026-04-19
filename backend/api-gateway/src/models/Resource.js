const mongoose = require("mongoose");

const ResourceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    type: { type: String, required: true, trim: true, index: true },
    capacity: { type: Number, required: true, min: 0 },
    metadata: { type: Object, default: {} },
    isAvailable: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Resource", ResourceSchema);
