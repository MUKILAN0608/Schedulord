const Redis = require("ioredis");
const { env } = require("./env");
const { logger } = require("../utils/logger");

let redis = null;

async function connectRedis() {
  try {
    redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 5) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    redis.on("error", (err) => {
      logger.warn({ err: err.message }, "Redis connection error — caching disabled");
    });

    redis.on("connect", () => {
      logger.info("Redis connected");
    });

    await redis.connect();
  } catch (err) {
    logger.warn({ err: err.message }, "Redis connection failed — caching disabled");
    redis = null;
  }
}

function getRedis() {
  return redis;
}

// Cache helpers
async function cacheGet(key) {
  if (!redis) return null;
  try {
    const val = await redis.get(key);
    return val ? JSON.parse(val) : null;
  } catch (_e) {
    return null;
  }
}

async function cacheSet(key, value, ttlSeconds = 60) {
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (_e) {
    // ignore
  }
}

async function cacheDel(key) {
  if (!redis) return;
  try {
    await redis.del(key);
  } catch (_e) {
    // ignore
  }
}

module.exports = { connectRedis, getRedis, cacheGet, cacheSet, cacheDel };
