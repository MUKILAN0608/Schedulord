const client = require("prom-client");

const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

const httpRequestDurationSeconds = new client.Histogram({
  name: "node_http_request_duration_seconds",
  help: "HTTP request duration in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

const httpRequestsTotal = new client.Counter({
  name: "node_http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route", "status_code"],
});

const kafkaEventsPublished = new client.Counter({
  name: "schedulord_kafka_events_published_total",
  help: "Total Kafka events published",
  labelNames: ["topic", "status"],
});

const allocationsTotal = new client.Counter({
  name: "schedulord_allocations_total",
  help: "Total allocation decisions",
  labelNames: ["status", "strategy"],
});

const activeWebsocketConnections = new client.Gauge({
  name: "schedulord_websocket_connections",
  help: "Active WebSocket connections",
});

registry.registerMetric(httpRequestDurationSeconds);
registry.registerMetric(httpRequestsTotal);
registry.registerMetric(kafkaEventsPublished);
registry.registerMetric(allocationsTotal);
registry.registerMetric(activeWebsocketConnections);

function metricsMiddleware() {
  return (req, res, next) => {
    const start = process.hrtime.bigint();
    res.on("finish", () => {
      const diffNs = process.hrtime.bigint() - start;
      const diffSeconds = Number(diffNs) / 1e9;
      const route = req.route?.path || req.path || "unknown";
      const labels = {
        method: req.method,
        route,
        status_code: String(res.statusCode),
      };
      httpRequestsTotal.inc(labels, 1);
      httpRequestDurationSeconds.observe(labels, diffSeconds);
    });
    next();
  };
}

function metricsRouter() {
  const express = require("express");
  const router = express.Router();

  router.get("/", async (_req, res) => {
    res.set("Content-Type", registry.contentType);
    res.end(await registry.metrics());
  });

  return router;
}

module.exports = {
  metricsMiddleware,
  metricsRouter,
  kafkaEventsPublished,
  allocationsTotal,
  activeWebsocketConnections,
};
