"use strict";

const crypto = require("node:crypto");

function constantTimeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function configuredSecrets(env = process.env) {
  return [...new Set([
    String(env.INGEST_SHARED_SECRET || "").trim(),
    String(env.CRON_SECRET || "").trim(),
  ].filter(Boolean))];
}

function configuredSecret(env = process.env) {
  return configuredSecrets(env)[0] || "";
}

function authorizeIngestRequest(req, env = process.env) {
  const expectedSecrets = configuredSecrets(env);
  if (!expectedSecrets.length) {
    return {
      ok: false,
      status: 503,
      error: "Ingestion authorization is not configured.",
    };
  }

  const header = String(req?.headers?.authorization || "");
  const bearerMatch = /^Bearer\s+(.+)$/i.exec(header);
  const bearer = bearerMatch ? bearerMatch[1].trim() : "";
  const shared = String(req?.headers?.["x-ingest-secret"] || "").trim();
  if (expectedSecrets.some((expected) => constantTimeEqual(shared, expected) || constantTimeEqual(bearer, expected))) {
    return { ok: true, status: 200, error: null };
  }
  return {
    ok: false,
    status: 401,
    error: "Missing or invalid ingestion credential.",
  };
}

module.exports = { authorizeIngestRequest, configuredSecret, configuredSecrets, constantTimeEqual };
