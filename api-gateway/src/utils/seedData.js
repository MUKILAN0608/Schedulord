const User = require("../models/User");
const Resource = require("../models/Resource");
const { logger } = require("./logger");

async function ensureBootstrapData() {
  try {
    // 1. Seed Admin
    const adminEmail = process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@schedulord.local";
    const adminPassword = process.env.BOOTSTRAP_ADMIN_PASSWORD || "ChangeMe123!";

    const existingAdmin = await User.findOne({ email: adminEmail });
    if (!existingAdmin) {
      const passwordHash = await User.hashPassword(adminPassword);
      await User.create({ 
        email: adminEmail, 
        passwordHash, 
        role: "admin", 
        isActive: true 
      });
      logger.info("[seeder] Created bootstrap admin user");
    }

    // 2. Seed Initial Resources
    const resourceCount = await Resource.countDocuments();
    if (resourceCount === 0) {
      const initialResources = [
        { name: "Nvidia H100 Cluster", type: "compute", capacity: 100, isAvailable: true },
        { name: "High-Throughput Storage Pad", type: "storage", capacity: 500, isAvailable: true },
        { name: "Neural Link Node", type: "network", capacity: 200, isAvailable: true },
        { name: "Quantum Simulation Core", type: "compute", capacity: 50, isAvailable: true }
      ];
      await Resource.insertMany(initialResources);
      logger.info("[seeder] Created initial resource data for explorer");
    }
  } catch (err) {
    logger.error({ err }, "Data seeding failed");
  }
}

module.exports = { ensureBootstrapData };
