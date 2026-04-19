const createError = require("http-errors");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { env } = require("../config/env");

function signToken(user) {
  return jwt.sign(
    { sub: String(user._id), role: user.role, email: user.email, name: user.name },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN }
  );
}

async function register(req, res, next) {
  try {
    const { name, email, password, role } = req.body;
    const existing = await User.findOne({ email });
    if (existing) throw createError(409, "Email already registered");

    const passwordHash = await User.hashPassword(password);
    const assignedRole = role || "user";
    const user = await User.create({ name, email, passwordHash, role: assignedRole });

    res.status(201).json({ token: signToken(user), user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user || !user.isActive) throw createError(401, "Invalid credentials");

    const ok = await user.verifyPassword(password);
    if (!ok) throw createError(401, "Invalid credentials");

    res.json({ token: signToken(user), user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login };
