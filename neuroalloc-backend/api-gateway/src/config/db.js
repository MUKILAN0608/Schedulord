const mongoose = require("mongoose");

async function connectMongo(uri) {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 10_000,
  });
}

module.exports = { connectMongo };

