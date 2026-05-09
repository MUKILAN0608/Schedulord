const createError = require("http-errors");
const jwt = require("jsonwebtoken");
const { env } = require("../config/env");

function authenticateJWT(req, _res, next) {
  const auth = req.headers.authorization || "";
  const [scheme, token] = auth.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(createError(401, "Missing or invalid Authorization header"));
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.user = decoded;
    return next();
  } catch {
    return next(createError(401, "Invalid token"));
  }
}

function requireRole(...roles) {
  return (req, _res, next) => {
    const role = req.user?.role;
    if (!role || !roles.includes(role)) {
      return next(createError(403, "Forbidden"));
    }
    return next();
  };
}

module.exports = { authenticateJWT, requireRole };
