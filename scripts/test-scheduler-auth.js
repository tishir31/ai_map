"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  authorizeScheduledRequest,
  authorizeScopedSchedulerRequest,
  configurationError,
  validIsoDate,
} = require("../lib/scheduler-auth");

const scopedSecret = "0123456789abcdef0123456789abcdef";
const headers = (job = "ingest-gmail", runDate = "2026-09-04", secret = scopedSecret) => ({
  authorization: `Bearer ${secret}`,
  "x-physical-ai-scheduler": "v1",
  "x-physical-ai-job": job,
  "x-physical-ai-run-key": `${job}:${runDate}`,
});

assert.equal(validIsoDate("2026-09-04"), true);
assert.equal(validIsoDate("2026-02-29"), false);
assert.equal(validIsoDate("09/04/2026"), false);

assert.match(configurationError({ PHYSICAL_AI_SCHEDULER_SECRET: "short" }), /at least 32 bytes/);
assert.match(configurationError(
  { PHYSICAL_AI_SCHEDULER_SECRET: scopedSecret },
  [scopedSecret],
), /distinct/);

assert.equal(authorizeScopedSchedulerRequest(
  { headers: headers() },
  "ingest-gmail",
  { PHYSICAL_AI_SCHEDULER_SECRET: scopedSecret },
).ok, true);

const authorized = authorizeScheduledRequest(
  { headers: headers("graph-refresh-weekly") },
  "graph-refresh-weekly",
  { PHYSICAL_AI_SCHEDULER_SECRET: scopedSecret },
);
assert.deepEqual(authorized, {
  ok: true,
  status: 200,
  error: null,
  provider: "supabase-pg-cron",
  schedulerJob: "graph-refresh-weekly",
  schedulerRunKey: "graph-refresh-weekly:2026-09-04",
  schedulerRunDate: "2026-09-04",
});

assert.equal(authorizeScopedSchedulerRequest(
  { headers: headers("ingest-web-news") },
  "ingest-gmail",
  { PHYSICAL_AI_SCHEDULER_SECRET: scopedSecret },
).status, 401);
assert.equal(authorizeScopedSchedulerRequest(
  { headers: { ...headers(), "x-physical-ai-scheduler": "v2" } },
  "ingest-gmail",
  { PHYSICAL_AI_SCHEDULER_SECRET: scopedSecret },
).status, 401);
assert.equal(authorizeScopedSchedulerRequest(
  { headers: headers("ingest-gmail", "2026-02-29") },
  "ingest-gmail",
  { PHYSICAL_AI_SCHEDULER_SECRET: scopedSecret },
).status, 401);
assert.equal(authorizeScopedSchedulerRequest(
  { headers: headers("ingest-gmail", "2026-09-04", "wrong-secret-that-is-long-enough-000") },
  "ingest-gmail",
  { PHYSICAL_AI_SCHEDULER_SECRET: scopedSecret },
).status, 401);
assert.equal(authorizeScopedSchedulerRequest(
  { headers: headers() },
  "not-a-job",
  { PHYSICAL_AI_SCHEDULER_SECRET: scopedSecret },
).status, 503);

assert.equal(authorizeScheduledRequest(
  { headers: { authorization: "Bearer native-cron" } },
  "ingest-gmail",
  { CRON_SECRET: "native-cron", VERCEL_ENV: "production" },
).provider, "vercel-cron");
assert.equal(authorizeScheduledRequest(
  { headers: headers() },
  "ingest-gmail",
  { CRON_SECRET: scopedSecret, PHYSICAL_AI_SCHEDULER_SECRET: scopedSecret },
).status, 503);
assert.equal(authorizeScheduledRequest(
  { headers: {} },
  "ingest-gmail",
  {},
).status, 503);

const vercel = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../vercel.json"), "utf8"));
assert.deepEqual(vercel.crons, [
  { path: "/api/ingest-gmail", schedule: "0 13 * * *" },
  { path: "/api/ingest-web-news", schedule: "15 13 * * *" },
  { path: "/api/graph-refresh-weekly", schedule: "0 15 * * 1" },
  { path: "/api/graph-refresh-monthly", schedule: "0 16 1 * *" },
  { path: "/api/graph-refresh-quarterly", schedule: "0 17 1 1,4,7,10 *" },
], "Native Vercel Cron remains the production dispatcher.");
const physicalAiFallback = vercel.rewrites.find((rewrite) => rewrite.destination === "/physical-ai/index.html"
  && rewrite.source.includes(":path"));
assert.ok(physicalAiFallback?.source.includes("knowledge-graph\\.v1\\.json$"),
  "The v1 graph rollback snapshot must bypass the SPA fallback.");

console.log("scheduler auth tests passed");
