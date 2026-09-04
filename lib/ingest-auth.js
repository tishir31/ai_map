"use strict";

const {
  authorizeScopedSchedulerRequest,
  bearerToken,
  configurationError,
  constantTimeEqual,
  productionSchedulerRequired,
  resolveSchedulerSecret,
  schedulerResolverConfigured,
  secretConfigurationError,
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

async function authorizeIngestRequest(req, env = process.env, { schedulerJob, fetchImpl } = {}) {
  const routeSecrets = configuredSecrets(env);
  const acceptedManualSecrets = productionSchedulerRequired(env)
    ? [String(env.INGEST_SHARED_SECRET || "").trim()].filter(Boolean)
    : routeSecrets;
  const configError = configurationError(env, routeSecrets);
  if (configError) return { ok: false, status: 503, error: configError };
  if (!acceptedManualSecrets.length && !schedulerResolverConfigured(env)) {
    return { ok: false, status: 503, error: "Ingestion authorization is not configured." };
  }
  const bearer = bearerToken(req);
  const shared = String(req?.headers?.["x-ingest-secret"] || "").trim();
  if (acceptedManualSecrets.some((expected) => constantTimeEqual(shared, expected) || constantTimeEqual(bearer, expected))) {
    if (productionSchedulerRequired(env) && schedulerJob) {
      const resolved = await resolveSchedulerSecret(env, { fetchImpl });
      if (!resolved.ok) return resolved;
      const resolvedError = secretConfigurationError(resolved.secret, routeSecrets);
      if (resolvedError) return { ok: false, status: 503, error: resolvedError };
    }
    return { ok: true, status: 200, error: null, provider: "ingest-shared-secret" };
  }
  if (schedulerJob) return authorizeScopedSchedulerRequest(req, schedulerJob, env, routeSecrets, { fetchImpl });
  return { ok: false, status: 401, error: "Missing or invalid ingestion credential." };
}

module.exports = { authorizeIngestRequest, configuredSecret, configuredSecrets, constantTimeEqual };
