const http = require("http");
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const createError = require("http-errors");
const dotenv = require("dotenv");

dotenv.config();

const { connectMongo } = require("./config/db");
const { env } = require("./config/env");
const { connectKafkaProducer } = require("./config/kafka");
const { connectRedis } = require("./config/redis");
const { attachRequestLogger } = require("./utils/logger");
const { metricsMiddleware, metricsRouter } = require("./metrics/metrics");
const routes = require("./routes");
const { initSockets } = require("./sockets");
const { errorHandler } = require("./middleware/errorHandler");
const { ensureBootstrapData } = require("./utils/seedData");
const { startRequestProcessor } = require("./services/requestProcessor");
const { startKafkaResultConsumer } = require("./services/kafkaResultConsumer");

function isReadHeavyPath(req) {
  if (req.method !== "GET") return false;
  return (
    req.path.startsWith("/api/analytics") ||
    req.path.startsWith("/api/requests") ||
    req.path.startsWith("/api/resources")
  );
}

async function main() {
  // Connect infrastructure
  await connectMongo(env.MONGODB_URI);
  await connectRedis();
  await connectKafkaProducer();
  await ensureBootstrapData();

  const app = express();
  const server = http.createServer(app);
  initSockets(server);
  startKafkaResultConsumer();
  startRequestProcessor();

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN === "*" ? true : env.CORS_ORIGIN,
      credentials: true,
    })
  );

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true }));
  app.use(morgan("combined"));
  app.use(attachRequestLogger());

  const isDev = env.NODE_ENV !== "production";
  const baseLimitPerMin = Number(process.env.API_RATE_LIMIT_PER_MIN || (isDev ? 1500 : 600));
  const readLimitPerMin = Number(process.env.API_READ_RATE_LIMIT_PER_MIN || (isDev ? 5000 : 1500));
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: (req) => (isReadHeavyPath(req) ? readLimitPerMin : baseLimitPerMin),
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: {
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Please slow down and retry shortly.",
        },
      },
    })
  );

  app.get("/health", (req, res) => res.json({ ok: true, service: "schedulord-api-gateway" }));

  app.use(metricsMiddleware());
  app.use("/metrics", metricsRouter());

  app.use("/api", routes);

  app.use((req, res, next) => next(createError(404, "Route not found")));
  app.use(errorHandler);

  server.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[schedulord-api-gateway] listening on :${env.PORT}`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[schedulord-api-gateway] fatal startup error", err);
  process.exit(1);
});
