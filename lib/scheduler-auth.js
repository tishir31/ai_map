"use strict";

const crypto = require("node:crypto");

const SCHEDULER_HEADER = "x-physical-ai-scheduler";
const JOB_HEADER = "x-physical-ai-job";
const RUN_KEY_HEADER = "x-physical-ai-run-key";
const SCHEDULER_VERSION = "v1";
const MIN_SECRET_BYTES = 32;
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
  return String(env.PHYSICAL_AI_SCHEDULER_SECRET || "").trim();
}

function configurationError(env = process.env, otherSecrets = []) {
  const secret = schedulerSecret(env);
  if (!secret) return null;
  if (Buffer.byteLength(secret) < MIN_SECRET_BYTES) {
    return `PHYSICAL_AI_SCHEDULER_SECRET must be at least ${MIN_SECRET_BYTES} bytes.`;
  }
  if (otherSecrets.filter(Boolean).some((other) => constantTimeEqual(secret, other))) {
    return "PHYSICAL_AI_SCHEDULER_SECRET must be distinct from other route credentials.";
  }
  return null;
}

function unauthorized(error = "Missing or invalid scheduler credential.") {
  return { ok: false, status: 401, error };
}

function authorizeScopedSchedulerRequest(req, expectedJob, env = process.env, otherSecrets = []) {
  if (!SCHEDULER_JOBS.has(expectedJob)) {
    return { ok: false, status: 503, error: "Scheduler route configuration is invalid." };
  }
  const secret = schedulerSecret(env);
  if (!secret) {
    return { ok: false, status: 503, error: "Scoped scheduler authorization is not configured." };
  }
  const configError = configurationError(env, otherSecrets);
  if (configError) return { ok: false, status: 503, error: configError };

  if (headerValue(req, SCHEDULER_HEADER) !== SCHEDULER_VERSION) return unauthorized();
  if (headerValue(req, JOB_HEADER) !== expectedJob) return unauthorized();
  if (!constantTimeEqual(bearerToken(req), secret)) return unauthorized();

  const runKey = headerValue(req, RUN_KEY_HEADER);
  const prefix = `${expectedJob}:`;
  if (!runKey.startsWith(prefix)) return unauthorized("Scheduler run key is invalid.");
  const runDate = runKey.slice(prefix.length);
  if (!validIsoDate(runDate) || runKey !== `${expectedJob}:${runDate}`) {
    return unauthorized("Scheduler run key is invalid.");
  }
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

function authorizeScheduledRequest(req, expectedJob, env = process.env) {
  const cronSecret = String(env.CRON_SECRET || "").trim();
  const scopedSecret = schedulerSecret(env);
  const configError = configurationError(env, [cronSecret]);
  if (configError) return { ok: false, status: 503, error: configError };

  const token = bearerToken(req);
  if (cronSecret && constantTimeEqual(token, cronSecret)) {
    return { ok: true, status: 200, error: null, provider: "vercel-cron" };
  }
  if (scopedSecret) return authorizeScopedSchedulerRequest(req, expectedJob, env, [cronSecret]);
  if (!cronSecret) {
    return { ok: false, status: 503, error: "Scheduler authorization is not configured." };
  }
  return unauthorized();
}

module.exports = {
  JOB_HEADER,
  RUN_KEY_HEADER,
  SCHEDULER_HEADER,
  SCHEDULER_JOBS,
  SCHEDULER_VERSION,
  authorizeScheduledRequest,
  authorizeScopedSchedulerRequest,
  bearerToken,
  configurationError,
  constantTimeEqual,
  headerValue,
  schedulerSecret,
  validIsoDate,
};
