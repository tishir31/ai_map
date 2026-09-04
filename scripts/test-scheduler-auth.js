"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  SCHEDULER_SECRET_RPC,
  authorizeScheduledRequest,
  authorizeScopedSchedulerRequest,
  configurationError,
  resolveSchedulerSecret,
  validIsoDate,
} = require("../lib/scheduler-auth");

const secret = "0123456789abcdef0123456789abcdef";
const otherSecret = "abcdef0123456789abcdef0123456789";
const requestHeaders = (job = "ingest-gmail", date = "2026-09-04", token = secret) => ({
  authorization: `Bearer ${token}`,
  "x-physical-ai-scheduler": "v1",
  "x-physical-ai-job": job,
  "x-physical-ai-run-key": `${job}:${date}`,
});
const rpcFetch = (value, { ok = true, calls = [] } = {}) => async (input, init) => {
  calls.push({ input: String(input), init });
  return { ok, status: ok ? 200 : 500, text: async () => JSON.stringify(value) };
};

async function run() {
  assert.equal(validIsoDate("2026-09-04"), true);
  assert.equal(validIsoDate("2026-02-29"), false);
  assert.equal(validIsoDate("09/04/2026"), false);
  assert.match(configurationError({ PHYSICAL_AI_SCHEDULER_SECRET: "short" }), /at least 32 bytes/);
  assert.match(configurationError({ PHYSICAL_AI_SCHEDULER_SECRET: secret }, [secret]), /distinct/);

  const local = { PHYSICAL_AI_SCHEDULER_SECRET: secret };
  assert.equal((await authorizeScopedSchedulerRequest(
    { headers: requestHeaders() }, "ingest-gmail", local,
  )).ok, true);
  const authorized = await authorizeScheduledRequest(
    { headers: requestHeaders("graph-refresh-weekly") }, "graph-refresh-weekly", local,
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
  assert.equal((await authorizeScopedSchedulerRequest(
    { headers: requestHeaders("ingest-web-news") }, "ingest-gmail", local,
  )).status, 401);
  assert.equal((await authorizeScopedSchedulerRequest(
    { headers: { ...requestHeaders(), "x-physical-ai-scheduler": "v2" } }, "ingest-gmail", local,
  )).status, 401);
  assert.equal((await authorizeScopedSchedulerRequest(
    { headers: requestHeaders("ingest-gmail", "2026-02-29") }, "ingest-gmail", local,
  )).status, 401);
  assert.equal((await authorizeScopedSchedulerRequest(
    { headers: requestHeaders("ingest-gmail", "2026-09-04", otherSecret) }, "ingest-gmail", local,
  )).status, 401);
  assert.equal((await authorizeScopedSchedulerRequest(
    { headers: requestHeaders() }, "not-a-job", local,
  )).status, 503);
  assert.equal((await authorizeScheduledRequest(
    { headers: { authorization: "Bearer native-cron" } }, "ingest-gmail", { CRON_SECRET: "native-cron" },
  )).provider, "vercel-cron");
  assert.equal((await authorizeScheduledRequest(
    { headers: requestHeaders() }, "ingest-gmail",
    { CRON_SECRET: secret, PHYSICAL_AI_SCHEDULER_SECRET: secret },
  )).status, 503);
  assert.equal((await authorizeScheduledRequest({ headers: {} }, "ingest-gmail", {})).status, 401);

  const calls = [];
  const production = {
    VERCEL_ENV: "production",
    SUPABASE_URL: "https://project.supabase.co/",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
  };
  const vaultOnly = await authorizeScopedSchedulerRequest(
    { headers: requestHeaders() }, "ingest-gmail", production, [],
    { fetchImpl: rpcFetch(secret, { calls }) },
  );
  assert.equal(vaultOnly.ok, true);
  assert.equal(calls[0].input, `https://project.supabase.co/rest/v1/rpc/${SCHEDULER_SECRET_RPC}`);
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers.apikey, "service-role-test-key");
  assert.equal(calls[0].init.headers.Authorization, "Bearer service-role-test-key");
  assert.equal(calls[0].init.body, "{}");
  const rejectedCalls = [];
  const missingEnvelope = await authorizeScopedSchedulerRequest(
    { headers: {} }, "ingest-gmail", production, [],
    { fetchImpl: rpcFetch(secret, { calls: rejectedCalls }) },
  );
  assert.equal(missingEnvelope.status, 401);
  assert.equal(rejectedCalls.length, 0,
    "Malformed public requests must be rejected before a Vault RPC.");

  const matching = await resolveSchedulerSecret(
    { ...production, PHYSICAL_AI_SCHEDULER_SECRET: secret }, { fetchImpl: rpcFetch(secret) },
  );
  assert.equal(matching.ok, true);
  assert.equal(matching.source, "supabase-vault-rpc");
  const mismatch = await resolveSchedulerSecret(
    { ...production, PHYSICAL_AI_SCHEDULER_SECRET: otherSecret }, { fetchImpl: rpcFetch(secret) },
  );
  assert.equal(mismatch.status, 503);
  assert.match(mismatch.error, /does not match/i);
  assert.equal((await resolveSchedulerSecret(
    { ...production, PHYSICAL_AI_SCHEDULER_SECRET: secret }, { fetchImpl: rpcFetch(secret, { ok: false }) },
  )).status, 503);
  assert.match((await resolveSchedulerSecret(
    production, { fetchImpl: rpcFetch("too-short") },
  )).error, /at least 32 bytes/i);
  assert.equal((await resolveSchedulerSecret({
    PHYSICAL_AI_SCHEDULER_SECRET: secret,
    SUPABASE_URL: "https://project.supabase.co",
  })).status, 503);
  const productionCron = await authorizeScheduledRequest(
    { headers: { authorization: "Bearer native-cron" } }, "ingest-gmail",
    { ...production, CRON_SECRET: "native-cron" }, { fetchImpl: rpcFetch(secret) },
  );
  assert.equal(productionCron.status, 401);
  assert.notEqual(productionCron.provider, "vercel-cron");

  const vercel = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../vercel.json"), "utf8"));
  assert.equal(Array.isArray(vercel.crons) && vercel.crons.length > 0, false,
    "Native Vercel crons must stay disabled while Supabase Cron owns dispatch.");
  const fallback = vercel.rewrites.find((rewrite) => rewrite.destination === "/physical-ai/index.html"
    && rewrite.source.includes(":path"));
  assert.ok(fallback?.source.includes("knowledge-graph\\.v1\\.json$"),
    "The v1 graph rollback snapshot must bypass the SPA fallback.");
  console.log("scheduler auth tests passed");
}

run().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
