const User = require("../models/User");

async function ensureBootstrapAdmin() {
  const email = process.env.BOOTSTRAP_ADMIN_EMAIL;
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

  if (!email || !password) return;

  const existing = await User.findOne({ email });
  if (existing) return;

  const passwordHash = await User.hashPassword(password);
  await User.create({ email, passwordHash, role: "admin", isActive: true });
}

module.exports = { ensureBootstrapAdmin };

