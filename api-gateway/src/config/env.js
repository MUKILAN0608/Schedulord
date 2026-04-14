function required(name, value) {
  if (!value) {
    const err = new Error(`Missing required env var: ${name}`);
    err.code = "ENV_MISSING";
    throw err;
  }
  return value;
}

const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: Number(process.env.PORT || 8080),
  MONGODB_URI: required("MONGODB_URI", process.env.MONGODB_URI),
  JWT_SECRET: required("JWT_SECRET", process.env.JWT_SECRET),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "1d",
  GO_ENGINE_BASE_URL: required("GO_ENGINE_BASE_URL", process.env.GO_ENGINE_BASE_URL),
  CORS_ORIGIN: process.env.CORS_ORIGIN || "*",

  // Kafka
  KAFKA_BROKERS: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
  KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID || "schedulord-api-gateway",

  // Redis
  REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
};

module.exports = { env };
