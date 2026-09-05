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
  schedulerCanonicalPayload,
  schedulerDispatchToken,
  validIsoDate,
} = require("../lib/scheduler-auth");

const rootSecret = "0123456789abcdef".repeat(4);
const otherRootSecret = "fedcba9876543210".repeat(4);
const testDate = "2026-09-04";
const testNow = new Date("2026-09-04T17:00:00.000Z");
const authOptions = { now: testNow };
const requestHeaders = (
  job = "ingest-gmail",
  date = testDate,
  token = schedulerDispatchToken(rootSecret, job, date),
) => ({
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
  assert.equal(validIsoDate(testDate), true);
  assert.equal(validIsoDate("2026-02-29"), false);
  assert.equal(validIsoDate("09/04/2026"), false);
  assert.equal(
    schedulerCanonicalPayload("ingest-gmail", testDate),
    "physical-ai-scheduler|v1|ingest-gmail|2026-09-04",
  );
  assert.equal(
    schedulerDispatchToken(rootSecret, "ingest-gmail", testDate),
    "bc3b65a27b48da17bfa5a2a180f76361e7fc969df69ebb4af45ed5a3c1fb0003",
    "Node HMAC must match the pgcrypto parity vector.",
  );
  assert.match(configurationError({ PHYSICAL_AI_SCHEDULER_SECRET: "short" }), /64 lowercase hexadecimal/);
  assert.match(configurationError({ PHYSICAL_AI_SCHEDULER_SECRET: rootSecret.toUpperCase() }), /64 lowercase hexadecimal/);
  assert.match(configurationError({ PHYSICAL_AI_SCHEDULER_SECRET: ` ${rootSecret}` }), /64 lowercase hexadecimal/);
  assert.match(configurationError({ PHYSICAL_AI_SCHEDULER_SECRET: rootSecret }, [rootSecret]), /distinct/);

  const local = { PHYSICAL_AI_SCHEDULER_SECRET: rootSecret };
  assert.equal((await authorizeScopedSchedulerRequest(
    { headers: requestHeaders() }, "ingest-gmail", local, [], authOptions,
  )).ok, true);
  const authorized = await authorizeScheduledRequest(
    { headers: requestHeaders("graph-refresh-weekly") }, "graph-refresh-weekly", local, authOptions,
  );
  assert.deepEqual(authorized, {
    ok: true,
    status: 200,
    error: null,
    provider: "supabase-pg-cron",
    schedulerJob: "graph-refresh-weekly",
    schedulerRunKey: "graph-refresh-weekly:2026-09-04",
    schedulerRunDate: testDate,
  });
  const retry = await authorizeScheduledRequest(
    { headers: requestHeaders("graph-refresh-weekly") }, "graph-refresh-weekly", local, authOptions,
  );
  assert.equal(retry.ok, true, "A same-day idempotent retry uses the same scoped token and run key.");
  assert.equal((await authorizeScopedSchedulerRequest(
    { headers: requestHeaders("ingest-web-news") }, "ingest-gmail", local, [], authOptions,
  )).status, 401);
  assert.equal((await authorizeScopedSchedulerRequest(
    { headers: requestHeaders("ingest-gmail", testDate, schedulerDispatchToken(rootSecret, "ingest-web-news", testDate)) },
    "ingest-gmail", local, [], authOptions,
  )).status, 401, "A token must not cross job identities.");
  assert.equal((await authorizeScopedSchedulerRequest(
    { headers: { ...requestHeaders(), "x-physical-ai-scheduler": "v2" } }, "ingest-gmail", local, [], authOptions,
  )).status, 401);
  assert.equal((await authorizeScopedSchedulerRequest(
    { headers: requestHeaders("ingest-gmail", "2026-02-29") }, "ingest-gmail", local, [], authOptions,
  )).status, 401);
  assert.equal((await authorizeScopedSchedulerRequest(
    { headers: requestHeaders("ingest-gmail", "2026-09-03") }, "ingest-gmail", local, [], authOptions,
  )).status, 401, "Stale run dates must fail closed.");
  assert.equal((await authorizeScopedSchedulerRequest(
    { headers: requestHeaders("ingest-gmail", "2026-09-05") }, "ingest-gmail", local, [], authOptions,
  )).status, 401, "Future run dates must fail closed.");
  assert.equal((await authorizeScopedSchedulerRequest(
    { headers: requestHeaders("ingest-gmail", testDate, schedulerDispatchToken(otherRootSecret, "ingest-gmail", testDate)) },
    "ingest-gmail", local, [], authOptions,
  )).status, 401);
  assert.equal((await authorizeScopedSchedulerRequest(
    { headers: requestHeaders("ingest-gmail", testDate, rootSecret) }, "ingest-gmail", local, [], authOptions,
  )).status, 401, "The Vault root itself must never authenticate a request.");
  assert.equal((await authorizeScopedSchedulerRequest(
    { headers: requestHeaders() }, "not-a-job", local, [], authOptions,
  )).status, 503);
  assert.equal((await authorizeScheduledRequest(
    { headers: { authorization: "Bearer native-cron" } }, "ingest-gmail", { CRON_SECRET: "native-cron" }, authOptions,
  )).provider, "vercel-cron");
  assert.equal((await authorizeScheduledRequest(
    { headers: requestHeaders() }, "ingest-gmail",
    { CRON_SECRET: rootSecret, PHYSICAL_AI_SCHEDULER_SECRET: rootSecret }, authOptions,
  )).status, 503);
  assert.equal((await authorizeScheduledRequest({ headers: {} }, "ingest-gmail", {}, authOptions)).status, 401);

  const calls = [];
  const production = {
    VERCEL_ENV: "production",
    SUPABASE_URL: "https://project.supabase.co/",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-test-key",
  };
  const vaultOnly = await authorizeScopedSchedulerRequest(
    { headers: requestHeaders() }, "ingest-gmail", production, [],
    { ...authOptions, fetchImpl: rpcFetch(rootSecret, { calls }) },
  );
  assert.equal(vaultOnly.ok, true);
  assert.equal(calls[0].input, `https://project.supabase.co/rest/v1/rpc/${SCHEDULER_SECRET_RPC}`);
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.headers.apikey, "service-role-test-key");
  assert.equal(calls[0].init.headers.Authorization, "Bearer service-role-test-key");
  assert.equal(calls[0].init.body, "{}");

  const rejectedCalls = [];
  const rejectBeforeVault = async (headers) => authorizeScopedSchedulerRequest(
    { headers }, "ingest-gmail", production, [],
    { ...authOptions, fetchImpl: rpcFetch(rootSecret, { calls: rejectedCalls }) },
  );
  assert.equal((await rejectBeforeVault({})).status, 401);
  assert.equal((await rejectBeforeVault({ ...requestHeaders(), "x-physical-ai-scheduler": "v2" })).status, 401);
  assert.equal((await rejectBeforeVault(requestHeaders("ingest-web-news"))).status, 401);
  assert.equal((await rejectBeforeVault(requestHeaders("ingest-gmail", "2026-09-03"))).status, 401);
  assert.equal((await rejectBeforeVault(requestHeaders("ingest-gmail", "2026-09-05"))).status, 401);
  assert.equal(rejectedCalls.length, 0,
    "Malformed, cross-route, stale, and future requests must be rejected before a Vault RPC.");

  const rootBearerCalls = [];
  const rootBearer = await authorizeScopedSchedulerRequest(
    { headers: requestHeaders("ingest-gmail", testDate, rootSecret) }, "ingest-gmail", production, [],
    { ...authOptions, fetchImpl: rpcFetch(rootSecret, { calls: rootBearerCalls }) },
  );
  assert.equal(rootBearer.status, 401);
  assert.equal(rootBearerCalls.length, 1);
  const crossBindingCalls = [];
  for (const token of [
    schedulerDispatchToken(rootSecret, "ingest-web-news", testDate),
    schedulerDispatchToken(rootSecret, "ingest-gmail", "2026-09-03"),
  ]) {
    const result = await authorizeScopedSchedulerRequest(
      { headers: requestHeaders("ingest-gmail", testDate, token) }, "ingest-gmail", production, [],
      { ...authOptions, fetchImpl: rpcFetch(rootSecret, { calls: crossBindingCalls }) },
    );
    assert.equal(result.status, 401);
  }
  assert.equal(crossBindingCalls.length, 2, "Job/date-bound HMACs must fail after Vault resolution.");

  const matching = await resolveSchedulerSecret(
    { ...production, PHYSICAL_AI_SCHEDULER_SECRET: rootSecret }, { fetchImpl: rpcFetch(rootSecret) },
  );
  assert.equal(matching.ok, true);
  assert.equal(matching.source, "supabase-vault-rpc");
  const mismatch = await resolveSchedulerSecret(
    { ...production, PHYSICAL_AI_SCHEDULER_SECRET: otherRootSecret }, { fetchImpl: rpcFetch(rootSecret) },
  );
  assert.equal(mismatch.status, 503);
  assert.match(mismatch.error, /does not match/i);
  assert.equal((await resolveSchedulerSecret(
    { ...production, PHYSICAL_AI_SCHEDULER_SECRET: rootSecret }, { fetchImpl: rpcFetch(rootSecret, { ok: false }) },
  )).status, 503);
  assert.match((await resolveSchedulerSecret(
    production, { fetchImpl: rpcFetch("too-short") },
  )).error, /64 lowercase hexadecimal/i);
  assert.match((await resolveSchedulerSecret(
    production, { fetchImpl: rpcFetch(`${rootSecret}\n`) },
  )).error, /64 lowercase hexadecimal/i, "Vault roots are not trimmed before validation.");
  assert.equal((await resolveSchedulerSecret({
    PHYSICAL_AI_SCHEDULER_SECRET: rootSecret,
    SUPABASE_URL: "https://project.supabase.co",
  })).status, 503);

  for (const job of ["graph-refresh-weekly", "graph-refresh-monthly", "graph-refresh-quarterly"]) {
    const productionCronCalls = [];
    const productionCron = await authorizeScheduledRequest(
      { headers: requestHeaders(job, testDate, otherRootSecret) }, job,
      { ...production, CRON_SECRET: otherRootSecret },
      { ...authOptions, fetchImpl: rpcFetch(rootSecret, { calls: productionCronCalls }) },
    );
    assert.equal(productionCron.status, 401, `Production ${job} must reject CRON_SECRET.`);
    assert.notEqual(productionCron.provider, "vercel-cron");
    assert.equal(productionCronCalls.length, 1);
  }

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
