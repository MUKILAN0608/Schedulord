const { env } = require("../config/env");

async function goFetch(path, options = {}) {
  if (typeof fetch !== "function") {
    const err = new Error("Global fetch is not available. Use Node.js 18+ (recommended: Node 20).");
    err.code = "FETCH_UNAVAILABLE";
    throw err;
  }
  const url = new URL(path, env.GO_ENGINE_BASE_URL).toString();
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const err = new Error(body?.error?.message || `Go engine error (${res.status})`);
    err.status = res.status;
    err.code = body?.error?.code;
    err.details = body;
    throw err;
  }

  return body;
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

module.exports = { requestAllocationDecision, getPrediction, runSimulation };
