"use strict";

const {
  authorizeScopedSchedulerRequest,
  bearerToken,
  configurationError,
  constantTimeEqual,
  schedulerSecret,
} = require("./scheduler-auth");

function configuredSecrets(env = process.env) {
  return [...new Set([
    String(env.INGEST_SHARED_SECRET || "").trim(),
    String(env.CRON_SECRET || "").trim(),
  ].filter(Boolean))];
}

function configuredSecret(env = process.env) {
  return configuredSecrets(env)[0] || "";
}

function authorizeIngestRequest(req, env = process.env, { schedulerJob } = {}) {
  const expectedSecrets = configuredSecrets(env);
  const scopedSecret = schedulerSecret(env);
  const configError = configurationError(env, expectedSecrets);
  if (configError) {
    return {
      ok: false,
      status: 503,
      error: configError,
    };
  }
  if (!expectedSecrets.length && !scopedSecret) {
    return {
      ok: false,
      status: 503,
      error: "Ingestion authorization is not configured.",
    };
  }

  const bearer = bearerToken(req);
  const shared = String(req?.headers?.["x-ingest-secret"] || "").trim();
  if (expectedSecrets.some((expected) => constantTimeEqual(shared, expected) || constantTimeEqual(bearer, expected))) {
    return { ok: true, status: 200, error: null, provider: "ingest-shared-secret" };
  }
  if (scopedSecret && schedulerJob) {
    return authorizeScopedSchedulerRequest(req, schedulerJob, env, expectedSecrets);
  }
  return {
    ok: false,
    status: 401,
    error: "Missing or invalid ingestion credential.",
  };
}

module.exports = { authorizeIngestRequest, configuredSecret, configuredSecrets, constantTimeEqual };
