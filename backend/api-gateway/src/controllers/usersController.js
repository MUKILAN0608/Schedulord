const createError = require("http-errors");
const User = require("../models/User");

async function listUsers(_req, res, next) {
  try {
    const users = await User.find().sort({ createdAt: -1 }).lean();
    res.json({ items: users.map((u) => ({ id: u._id, email: u.email, role: u.role, isActive: u.isActive, createdAt: u.createdAt })) });
  } catch (err) {
    next(err);
  }
}

async function listAdmins(_req, res, next) {
  try {
    const admins = await User.find({ role: "admin", isActive: true })
      .sort({ createdAt: -1 })
      .lean();
    res.json({
      items: admins.map((u) => ({
        id: u._id,
        name: u.name || u.email,
        email: u.email,
      })),
    });
  } catch (err) {
    next(err);
  }
}

async function getMe(req, res, next) {
  try {
    const user = await User.findById(req.user.sub).lean();
    if (!user) throw createError(404, "User not found");
    res.json({ id: user._id, email: user.email, role: user.role, isActive: user.isActive, createdAt: user.createdAt });
  } catch (err) {
    next(err);
  }
}

async function createUser(req, res, next) {
  try {
    const { email, password, role = "user", name } = req.body;
    const existing = await User.findOne({ email });
    if (existing) throw createError(409, "Email already registered");

    const passwordHash = await User.hashPassword(password);
    const user = await User.create({ name: name || email.split('@')[0], email, passwordHash, role });
    res.status(201).json({ id: user._id, name: user.name, email: user.email, role: user.role, isActive: user.isActive });
  } catch (err) {
    next(err);
  }
}

async function updateUser(req, res, next) {
  try {
    const { id } = req.params;
    const { role, isActive } = req.body;

    const user = await User.findById(id);
    if (!user) throw createError(404, "User not found");

    if (role) user.role = role;
    if (typeof isActive === "boolean") user.isActive = isActive;

    await user.save();
    res.json({ id: user._id, email: user.email, role: user.role, isActive: user.isActive });
  } catch (err) {
    next(err);
  }
}

module.exports = { listUsers, listAdmins, getMe, createUser, updateUser };
