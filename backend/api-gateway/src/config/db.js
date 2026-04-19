const mongoose = require("mongoose");

async function connectMongo(uri) {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 30_000, // Increased to 30s
    connectTimeoutMS: 30_000,
  });
}

module.exports = { connectMongo };
