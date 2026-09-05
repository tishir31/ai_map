"use strict";

const crypto = require("node:crypto");

const SCHEDULER_HEADER = "x-physical-ai-scheduler";
const JOB_HEADER = "x-physical-ai-job";
const RUN_KEY_HEADER = "x-physical-ai-run-key";
const SCHEDULER_VERSION = "v1";
const SCHEDULER_TOKEN_PREFIX = "physical-ai-scheduler";
const SCHEDULER_SECRET_RPC = "get_physical_ai_scheduler_secret";
const SCHEDULER_ROOT_PATTERN = /^[0-9a-f]{64}$/;
const SCHEDULER_TOKEN_PATTERN = /^[0-9a-f]{64}$/;
const SCHEDULER_JOBS = new Set([
  "ingest-gmail",
  "ingest-web-news",
  "graph-refresh-weekly",
  "graph-refresh-monthly",
  "graph-refresh-quarterly",
]);

function constantTimeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function headerValue(req, name) {
  const headers = req?.headers || {};
  const direct = headers[name] ?? headers[name.toLowerCase()];
  if (Array.isArray(direct)) return String(direct[0] || "").trim();
  if (direct !== undefined && direct !== null) return String(direct).trim();
  const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
  const value = key ? headers[key] : "";
  return Array.isArray(value) ? String(value[0] || "").trim() : String(value || "").trim();
}

function bearerToken(req) {
  const match = /^Bearer\s+(.+)$/i.exec(headerValue(req, "authorization"));
  return match ? match[1].trim() : "";
}

function validIsoDate(value) {
  const text = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const parsed = new Date(`${text}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === text;
}

function schedulerSecret(env = process.env) {
  return String(env.PHYSICAL_AI_SCHEDULER_SECRET || "");
}

function schedulerCanonicalPayload(job, runDate) {
  return `${SCHEDULER_TOKEN_PREFIX}|${SCHEDULER_VERSION}|${job}|${runDate}`;
}

function schedulerDispatchToken(secret, job, runDate) {
  return crypto.createHmac("sha256", secret)
    .update(schedulerCanonicalPayload(job, runDate), "utf8")
    .digest("hex");
}

function currentUtcDate({ now } = {}) {
  const value = typeof now === "function" ? now() : (now ?? new Date());
  const instant = value instanceof Date ? value : new Date(value);
  return Number.isNaN(instant.valueOf()) ? "" : instant.toISOString().slice(0, 10);
}

function secretConfigurationError(secret, otherSecrets = [], label = "Scheduler credential") {
  if (!secret) return `${label} is unavailable.`;
  if (!SCHEDULER_ROOT_PATTERN.test(secret)) {
    return `${label} must be exactly 64 lowercase hexadecimal characters.`;
  }
  if (otherSecrets.filter(Boolean).some((other) => constantTimeEqual(secret, other))) {
    return `${label} must be distinct from other route credentials.`;
  }
  return null;
}

function configurationError(env = process.env, otherSecrets = []) {
  const secret = schedulerSecret(env);
  return secret ? secretConfigurationError(secret, otherSecrets, "PHYSICAL_AI_SCHEDULER_SECRET") : null;
}

function schedulerRpcConfiguration(env = process.env) {
  return {
    supabaseUrl: String(env.SUPABASE_URL || "").trim().replace(/\/$/, ""),
    serviceRoleKey: String(env.SUPABASE_SERVICE_ROLE_KEY || "").trim(),
  };
}

function productionSchedulerRequired(env = process.env) {
  return String(env.VERCEL_ENV || "").trim().toLowerCase() === "production";
}

function schedulerResolverConfigured(env = process.env) {
  const { supabaseUrl, serviceRoleKey } = schedulerRpcConfiguration(env);
  return Boolean(schedulerSecret(env) || (supabaseUrl && serviceRoleKey));
}

function unavailable(error = "Scheduler credential resolution is unavailable.") {
  return { ok: false, status: 503, error };
}

async function readSchedulerSecretFromVault(env = process.env, { fetchImpl = globalThis.fetch } = {}) {
  const { supabaseUrl, serviceRoleKey } = schedulerRpcConfiguration(env);
  if (!supabaseUrl || !serviceRoleKey || typeof fetchImpl !== "function") return unavailable();
  let rpcUrl;
  try {
    rpcUrl = new URL(`${supabaseUrl}/rest/v1/rpc/${SCHEDULER_SECRET_RPC}`);
  } catch {
    return unavailable();
  }
  if (productionSchedulerRequired(env) && rpcUrl.protocol !== "https:") return unavailable();
  let response;
  try {
    const signal = typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
      ? AbortSignal.timeout(5000)
      : undefined;
    response = await fetchImpl(rpcUrl.toString(), {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
        "Cache-Control": "no-store",
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
      },
      body: "{}",
      signal,
    });
  } catch {
    return unavailable();
  }
  if (!response?.ok || typeof response.text !== "function") return unavailable();
  let secret;
  try {
    const payload = JSON.parse(await response.text());
    secret = typeof payload === "string" ? payload : "";
  } catch {
    return unavailable();
  }
  const error = secretConfigurationError(secret, [], "Vault scheduler credential");
  return error ? unavailable(error) : { ok: true, status: 200, error: null, secret, source: "supabase-vault-rpc" };
}

async function resolveSchedulerSecret(env = process.env, options = {}) {
  const explicit = schedulerSecret(env);
  const explicitError = configurationError(env);
  if (explicitError) return unavailable(explicitError);
  const { supabaseUrl, serviceRoleKey } = schedulerRpcConfiguration(env);
  if (Boolean(supabaseUrl) !== Boolean(serviceRoleKey)) return unavailable();
  const mustUseVault = productionSchedulerRequired(env) || !explicit || Boolean(supabaseUrl && serviceRoleKey);
  if (!mustUseVault) return { ok: true, status: 200, error: null, secret: explicit, source: "explicit-local-override" };
  const resolved = await readSchedulerSecretFromVault(env, options);
  if (!resolved.ok) return resolved;
  if (explicit && !constantTimeEqual(explicit, resolved.secret)) {
    return unavailable("PHYSICAL_AI_SCHEDULER_SECRET does not match the Vault scheduler credential.");
  }
  return resolved;
}

function unauthorized(error = "Missing or invalid scheduler credential.") {
  return { ok: false, status: 401, error };
}

async function authorizeScopedSchedulerRequest(req, expectedJob, env = process.env, otherSecrets = [], options = {}) {
  if (!SCHEDULER_JOBS.has(expectedJob)) return unavailable("Scheduler route configuration is invalid.");
  if (headerValue(req, SCHEDULER_HEADER) !== SCHEDULER_VERSION) return unauthorized();
  if (headerValue(req, JOB_HEADER) !== expectedJob) return unauthorized();
  const token = bearerToken(req);
  if (!SCHEDULER_TOKEN_PATTERN.test(token)) return unauthorized();
  const runKey = headerValue(req, RUN_KEY_HEADER);
  const prefix = `${expectedJob}:`;
  if (!runKey.startsWith(prefix)) return unauthorized("Scheduler run key is invalid.");
  const runDate = runKey.slice(prefix.length);
  if (!validIsoDate(runDate) || runKey !== `${expectedJob}:${runDate}`) {
    return unauthorized("Scheduler run key is invalid.");
  }
  if (runDate !== currentUtcDate(options)) {
    return unauthorized("Scheduler run date must be the current UTC date.");
  }

  const explicitError = configurationError(env, otherSecrets);
  if (explicitError) return unavailable(explicitError);
  const resolved = await resolveSchedulerSecret(env, options);
  if (!resolved.ok) return resolved;
  const resolvedError = secretConfigurationError(resolved.secret, otherSecrets);
  if (resolvedError) return unavailable(resolvedError);
  const expectedToken = schedulerDispatchToken(resolved.secret, expectedJob, runDate);
  if (!constantTimeEqual(token, expectedToken)) return unauthorized();
  return {
    ok: true,
    status: 200,
    error: null,
    provider: "supabase-pg-cron",
    schedulerJob: expectedJob,
    schedulerRunKey: runKey,
    schedulerRunDate: runDate,
  };
}

async function authorizeScheduledRequest(req, expectedJob, env = process.env, options = {}) {
  const cronSecret = String(env.CRON_SECRET || "").trim();
  const explicitError = configurationError(env, [cronSecret]);
  if (explicitError) return unavailable(explicitError);
  if (!productionSchedulerRequired(env) && cronSecret && constantTimeEqual(bearerToken(req), cronSecret)) {
    return { ok: true, status: 200, error: null, provider: "vercel-cron" };
  }
  return authorizeScopedSchedulerRequest(req, expectedJob, env, [cronSecret], options);
}

module.exports = {
  JOB_HEADER,
  RUN_KEY_HEADER,
  SCHEDULER_HEADER,
  SCHEDULER_JOBS,
  SCHEDULER_SECRET_RPC,
  SCHEDULER_TOKEN_PREFIX,
  SCHEDULER_VERSION,
  authorizeScheduledRequest,
  authorizeScopedSchedulerRequest,
  bearerToken,
  configurationError,
  constantTimeEqual,
  currentUtcDate,
  headerValue,
  productionSchedulerRequired,
  readSchedulerSecretFromVault,
  resolveSchedulerSecret,
  schedulerResolverConfigured,
  schedulerRpcConfiguration,
  schedulerCanonicalPayload,
  schedulerDispatchToken,
  schedulerSecret,
  secretConfigurationError,
  validIsoDate,
};
