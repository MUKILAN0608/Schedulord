const pino = require("pino");
const pinoHttp = require("pino-http");

const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  redact: {
    paths: ["req.headers.authorization"],
    remove: true,
  },
});

function attachRequestLogger() {
  return pinoHttp({ logger });
}

module.exports = { logger, attachRequestLogger };

