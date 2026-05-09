const { Server } = require("socket.io");
const { env } = require("../config/env");
const jwt = require("jsonwebtoken");
const { activeWebsocketConnections } = require("../metrics/metrics");

let io;

function initSockets(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ||
      (socket.handshake.headers.authorization || "").split(" ")[1];

    if (!token) return next(new Error("unauthorized"));
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET);
      socket.user = decoded;
      return next();
    } catch {
      return next(new Error("unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.user?.sub;
    const role = socket.user?.role;
    if (userId) socket.join(`user:${String(userId)}`);
    if (role === "admin") socket.join("admins");

    activeWebsocketConnections.inc();
    socket.emit("connected", { ok: true, userId, role });

    socket.on("disconnect", () => {
      activeWebsocketConnections.dec();
    });
  });

  return io;
}

function getIO() {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
}

module.exports = { initSockets, getIO };
