"use strict";

const assert = require("node:assert/strict");
const { authorizeIngestRequest, configuredSecret, configuredSecrets, constantTimeEqual } = require("../lib/ingest-auth");
const ingestGmail = require("../api/ingest-gmail");
const ingestWebNews = require("../api/ingest-web-news");

async function invoke(handler) {
  let body = "";
  const res = {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(value = "") { body = value; return value; },
  };
  await handler({ method: "GET", headers: {} }, res);
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

  assert.deepEqual(authorizeIngestRequest({ headers: {} }, {}), {
    ok: false,
    status: 503,
    error: "Ingestion authorization is not configured.",
  });
  assert.equal(authorizeIngestRequest({ headers: {} }, { CRON_SECRET: "secret" }).status, 401);
  assert.equal(authorizeIngestRequest({ headers: { authorization: "Bearer wrong" } }, { CRON_SECRET: "secret" }).status, 401);
  assert.equal(authorizeIngestRequest({ headers: { authorization: "Bearer secret" } }, { CRON_SECRET: "secret" }).ok, true);
  assert.equal(authorizeIngestRequest({ headers: { "x-ingest-secret": "secret" } }, { INGEST_SHARED_SECRET: "secret" }).ok, true);
  assert.equal(authorizeIngestRequest(
    { headers: { authorization: "Bearer cron-secret" } },
    { INGEST_SHARED_SECRET: "manual-secret", CRON_SECRET: "cron-secret" },
  ).ok, true);

  const savedCronSecret = process.env.CRON_SECRET;
  const savedIngestSecret = process.env.INGEST_SHARED_SECRET;
  delete process.env.CRON_SECRET;
  delete process.env.INGEST_SHARED_SECRET;
  try {
    for (const handler of [ingestGmail, ingestWebNews]) {
      const result = await invoke(handler);
      assert.equal(result.status, 503);
      assert.match(result.body.error, /authorization is not configured/i);
    }
  } finally {
    if (savedCronSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = savedCronSecret;
    if (savedIngestSecret === undefined) delete process.env.INGEST_SHARED_SECRET;
    else process.env.INGEST_SHARED_SECRET = savedIngestSecret;
  }

  console.log("ingest auth tests passed");
}

run().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
