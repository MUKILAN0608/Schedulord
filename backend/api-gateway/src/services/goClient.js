const { env } = require("../config/env");
const { logger } = require("../utils/logger");

const requestConfig = {
  timeoutMs: Number(process.env.GO_ENGINE_TIMEOUT_MS || 3000),
  retries: Number(process.env.GO_ENGINE_RETRIES || 2),
  retryDelayMs: Number(process.env.GO_ENGINE_RETRY_DELAY_MS || 250),
  healthTtlMs: Number(process.env.GO_ENGINE_HEALTH_TTL_MS || 10000),
  circuitOpenMs: Number(process.env.GO_ENGINE_CIRCUIT_OPEN_MS || 5000),
};

const configuredBaseUrls = (() => {
  const explicit = String(process.env.GO_ENGINE_BASE_URLS || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  if (explicit.length > 0) return explicit;
  // Keep a single authoritative Go engine endpoint unless explicitly configured.
  // Blind fallback to legacy ports can route traffic to stale/non-engine services.
  return [env.GO_ENGINE_BASE_URL].filter(Boolean);
})();

const state = {
  lastHealthAt: 0,
  health: {
    ok: true,
    checkedAt: null,
    reason: null,
  },
  circuitOpenUntil: 0,
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isCircuitOpen() {
  return Date.now() < state.circuitOpenUntil;
}

function classifyNetworkError(err) {
  const code = err?.cause?.code || err?.code;
  if (!code) return null;
  if (["ECONNREFUSED", "ECONNRESET", "EHOSTUNREACH", "ENOTFOUND", "ETIMEDOUT"].includes(code)) {
    return code;
  }
  return null;
}

function withTimeout(ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`Go engine timeout after ${ms}ms`)), ms);
  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timer),
  };
}

function shouldRetry(status, networkCode) {
  if (networkCode) return true;
  if (!status) return true;
  return status >= 500 || status === 429;
}

function toServiceUnavailableError(message, details = {}) {
  const err = new Error(message);
  err.status = 503;
  err.code = "GO_ENGINE_UNAVAILABLE";
  err.details = details;
  return err;
}

async function goFetch(path, options = {}) {
  if (typeof fetch !== "function") {
    const err = new Error("Global fetch is not available. Use Node.js 18+ (recommended: Node 20).");
    err.code = "FETCH_UNAVAILABLE";
    throw err;
  }

  if (isCircuitOpen()) {
    throw toServiceUnavailableError("Go engine circuit is open after repeated failures.", {
      circuitOpenUntil: state.circuitOpenUntil,
      lastHealth: state.health,
    });
  }

  let lastErr = null;
  let activeBaseUrl = null;

  for (const baseUrl of configuredBaseUrls) {
    const url = new URL(path, baseUrl).toString();
    for (let attempt = 0; attempt <= requestConfig.retries; attempt++) {
      let timeout;
      try {
        timeout = withTimeout(requestConfig.timeoutMs);
        const res = await fetch(url, {
          ...options,
          headers: {
            "Content-Type": "application/json",
            ...(options.headers || {}),
          },
          signal: timeout.signal,
        });

        const text = await res.text();
        const body = text ? JSON.parse(text) : null;

        if (!res.ok) {
          const err = new Error(body?.error?.message || `Go engine error (${res.status})`);
          err.status = res.status;
          err.code = body?.error?.code || "GO_ENGINE_HTTP_ERROR";
          err.details = body;
          if (shouldRetry(res.status, null) && attempt < requestConfig.retries) {
            await delay(requestConfig.retryDelayMs * Math.pow(2, attempt));
            continue;
          }
          throw err;
        }

        if (body === null || typeof body !== "object") {
          const err = new Error("Go engine returned empty response body");
          err.code = "GO_ENGINE_EMPTY_RESPONSE";
          if (attempt < requestConfig.retries) {
            await delay(requestConfig.retryDelayMs * Math.pow(2, attempt));
            continue;
          }
          throw err;
        }

        // Success path restores health and closes circuit.
        state.health = { ok: true, checkedAt: new Date().toISOString(), reason: null };
        state.lastHealthAt = Date.now();
        state.circuitOpenUntil = 0;
        return body;
      } catch (err) {
        activeBaseUrl = baseUrl;
        const networkCode = classifyNetworkError(err);
        const timeoutError = err?.name === "AbortError";
        const retriable = shouldRetry(err?.status, networkCode) || timeoutError;
        lastErr = err;
        if (retriable && attempt < requestConfig.retries) {
          await delay(requestConfig.retryDelayMs * Math.pow(2, attempt));
          continue;
        }
        break;
      } finally {
        if (timeout) timeout.cleanup();
      }
    }
  }

  const networkCode = classifyNetworkError(lastErr);
  const reason = networkCode || lastErr?.message || "unknown";
  state.health = { ok: false, checkedAt: new Date().toISOString(), reason };
  state.lastHealthAt = Date.now();
  state.circuitOpenUntil = Date.now() + requestConfig.circuitOpenMs;
  logger.warn({ reason, path, baseUrl: activeBaseUrl || env.GO_ENGINE_BASE_URL, baseUrls: configuredBaseUrls }, "Go engine request failed");

  if (lastErr?.status) {
    throw lastErr;
  }
  throw toServiceUnavailableError("Failed to communicate with Go engine service.", {
    reason,
    baseUrl: activeBaseUrl || env.GO_ENGINE_BASE_URL,
    baseUrls: configuredBaseUrls,
  });
}

async function requestAllocationDecision(payload) {
  return goFetch("/process", { method: "POST", body: JSON.stringify(payload) });
}

async function getPrediction(query = "") {
  return goFetch(`/predict${query}`);
}

async function runSimulation(query = "") {
  return goFetch(`/simulate${query}`);
}

async function getEngineHealth({ force = false } = {}) {
  const fresh = Date.now() - state.lastHealthAt < requestConfig.healthTtlMs;
  if (!force && fresh) {
    return state.health;
  }

  try {
    for (const baseUrl of configuredBaseUrls) {
      const url = new URL("/healthz", baseUrl).toString();
      const timeout = withTimeout(requestConfig.timeoutMs);
      const res = await fetch(url, { method: "GET", signal: timeout.signal });
      timeout.cleanup();
      if (!res.ok) {
        continue;
      }
      state.health = { ok: true, checkedAt: new Date().toISOString(), reason: null };
      state.lastHealthAt = Date.now();
      state.circuitOpenUntil = 0;
      return state.health;
    }
    throw new Error("all configured healthz endpoints failed");
  } catch (err) {
    const reason = classifyNetworkError(err) || err?.message || "health check failed";
    state.health = { ok: false, checkedAt: new Date().toISOString(), reason };
    state.lastHealthAt = Date.now();
    return state.health;
  }
}

module.exports = { requestAllocationDecision, getPrediction, runSimulation, getEngineHealth };
