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

  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 300,
      standardHeaders: "draft-7",
      legacyHeaders: false,
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
