"use strict";

const assert = require("node:assert/strict");
const { authorizeIngestRequest, configuredSecret, configuredSecrets, constantTimeEqual } = require("../lib/ingest-auth");
const ingestGmail = require("../api/ingest-gmail");
const ingestWebNews = require("../api/ingest-web-news");

async function invoke(handler, headers = {}) {
  let body = "";
  const res = {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(value = "") { body = value; return value; },
  };
  await handler({ method: "GET", headers }, res);
  return { status: res.statusCode, body: JSON.parse(body) };
}

async function run() {
  assert.equal(configuredSecret({}), "");
  assert.equal(configuredSecret({ CRON_SECRET: " cron-secret " }), "cron-secret");
  assert.equal(configuredSecret({ INGEST_SHARED_SECRET: "ingest-secret", CRON_SECRET: "cron-secret" }), "ingest-secret");
  assert.deepEqual(configuredSecrets({ INGEST_SHARED_SECRET: "ingest-secret", CRON_SECRET: "cron-secret" }), ["ingest-secret", "cron-secret"]);
  assert.equal(constantTimeEqual("secret", "secret"), true);
  assert.equal(constantTimeEqual("secret", "wrong"), false);
  assert.equal(constantTimeEqual("short", "much-longer"), false);

  assert.deepEqual(await authorizeIngestRequest({ headers: {} }, {}), {
    ok: false,
    status: 503,
    error: "Ingestion authorization is not configured.",
  });
  assert.equal((await authorizeIngestRequest({ headers: {} }, { CRON_SECRET: "secret" })).status, 401);
  assert.equal((await authorizeIngestRequest({ headers: { authorization: "Bearer wrong" } }, { CRON_SECRET: "secret" })).status, 401);
  assert.equal((await authorizeIngestRequest({ headers: { authorization: "Bearer secret" } }, { CRON_SECRET: "secret" })).ok, true);
  assert.equal((await authorizeIngestRequest({ headers: { "x-ingest-secret": "secret" } }, { INGEST_SHARED_SECRET: "secret" })).ok, true);
  assert.equal((await authorizeIngestRequest(
    { headers: { authorization: "Bearer cron-secret" } },
    { INGEST_SHARED_SECRET: "manual-secret", CRON_SECRET: "cron-secret" },
  )).ok, true);
  const schedulerSecret = "0123456789abcdef0123456789abcdef";
  const scoped = await authorizeIngestRequest(
    { headers: {
      authorization: `Bearer ${schedulerSecret}`,
      "x-physical-ai-scheduler": "v1",
      "x-physical-ai-job": "ingest-gmail",
      "x-physical-ai-run-key": "ingest-gmail:2026-09-04",
    } },
    { PHYSICAL_AI_SCHEDULER_SECRET: schedulerSecret },
    { schedulerJob: "ingest-gmail" },
  );
  assert.equal(scoped.ok, true);
  assert.equal(scoped.schedulerRunDate, "2026-09-04");
  const productionScoped = await authorizeIngestRequest(
    { headers: {
      authorization: `Bearer ${schedulerSecret}`,
      "x-physical-ai-scheduler": "v1",
      "x-physical-ai-job": "ingest-gmail",
      "x-physical-ai-run-key": "ingest-gmail:2026-09-04",
    } },
    { VERCEL_ENV: "production", SUPABASE_URL: "https://project.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service-key" },
    { schedulerJob: "ingest-gmail", fetchImpl: async () => ({ ok: true, text: async () => JSON.stringify(schedulerSecret) }) },
  );
  assert.equal(productionScoped.ok, true);
  const productionCronRejected = await authorizeIngestRequest(
    { headers: { authorization: "Bearer native-cron" } },
    { VERCEL_ENV: "production", CRON_SECRET: "native-cron", SUPABASE_URL: "https://project.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service-key" },
    { schedulerJob: "ingest-gmail", fetchImpl: async () => ({ ok: true, text: async () => JSON.stringify(schedulerSecret) }) },
  );
  assert.equal(productionCronRejected.status, 401);
  const productionManualFailsWithVault = await authorizeIngestRequest(
    { headers: { "x-ingest-secret": "manual-secret" } },
    {
      VERCEL_ENV: "production",
      INGEST_SHARED_SECRET: "manual-secret",
      PHYSICAL_AI_SCHEDULER_SECRET: "abcdef0123456789abcdef0123456789",
      SUPABASE_URL: "https://project.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
    },
    {
      schedulerJob: "ingest-gmail",
      fetchImpl: async () => ({ ok: true, text: async () => JSON.stringify(schedulerSecret) }),
    },
  );
  assert.equal(productionManualFailsWithVault.status, 503);
  assert.match(productionManualFailsWithVault.error, /does not match/i);
  assert.equal((await authorizeIngestRequest(
    { headers: { authorization: `Bearer ${schedulerSecret}` } },
    { PHYSICAL_AI_SCHEDULER_SECRET: schedulerSecret },
    { schedulerJob: "ingest-gmail" },
  )).status, 401);
  assert.equal((await authorizeIngestRequest(
    { headers: { "x-ingest-secret": schedulerSecret } },
    { PHYSICAL_AI_SCHEDULER_SECRET: schedulerSecret },
    { schedulerJob: "ingest-gmail" },
  )).status, 401);

  const savedCronSecret = process.env.CRON_SECRET;
  const savedIngestSecret = process.env.INGEST_SHARED_SECRET;
  const savedSchedulerSecret = process.env.PHYSICAL_AI_SCHEDULER_SECRET;
  delete process.env.CRON_SECRET;
  delete process.env.INGEST_SHARED_SECRET;
  delete process.env.PHYSICAL_AI_SCHEDULER_SECRET;
  try {
    for (const handler of [ingestGmail, ingestWebNews]) {
      const result = await invoke(handler);
      assert.equal(result.status, 503);
      assert.match(result.body.error, /authorization is not configured/i);
    }
    process.env.PHYSICAL_AI_SCHEDULER_SECRET = schedulerSecret;
    for (const [handler, job] of [[ingestGmail, "ingest-gmail"], [ingestWebNews, "ingest-web-news"]]) {
      const result = await invoke(handler, {
        authorization: `Bearer ${schedulerSecret}`,
        "x-physical-ai-scheduler": "v1",
        "x-physical-ai-job": job,
        "x-physical-ai-run-key": `${job}:2026-09-04`,
      });
      assert.equal(result.status, 503);
      assert.match(result.body.error, /not configured/i);
      assert.ok(Array.isArray(result.body.missingEnv));
    }
    const crossRoute = await invoke(ingestGmail, {
      authorization: `Bearer ${schedulerSecret}`,
      "x-physical-ai-scheduler": "v1",
      "x-physical-ai-job": "ingest-web-news",
      "x-physical-ai-run-key": "ingest-web-news:2026-09-04",
    });
    assert.equal(crossRoute.status, 401);
  } finally {
    if (savedCronSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = savedCronSecret;
    if (savedIngestSecret === undefined) delete process.env.INGEST_SHARED_SECRET;
    else process.env.INGEST_SHARED_SECRET = savedIngestSecret;
    if (savedSchedulerSecret === undefined) delete process.env.PHYSICAL_AI_SCHEDULER_SECRET;
    else process.env.PHYSICAL_AI_SCHEDULER_SECRET = savedSchedulerSecret;
  }

  console.log("ingest auth tests passed");
}

run().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
