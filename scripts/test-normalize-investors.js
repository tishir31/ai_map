const assert = require("node:assert/strict");

async function main() {
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const previousSecret = process.env.INGEST_SHARED_SECRET;
  const previousFetch = global.fetch;
  process.env.SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role";
  process.env.INGEST_SHARED_SECRET = "test-ingest-secret";

  global.fetch = async (url) => {
    const value = String(url);
    if (value.includes("/rest/v1/activities?")) {
      return {
        ok: true,
        json: async () => [{
          id: "a-june-test",
          date_announced: "2026-06-09",
          company_id: "c-standard-bots",
          counterparty: "RoboStrategy; General Catalyst",
          description: "Series C led by RoboStrategy and General Catalyst.",
          activity_type: "financing",
          subsector: "Robotics",
          deal_value_usd: 200000000,
          source_url: "https://example.com/release",
          review_status: "approved",
          is_sample: false
        }]
      };
    }
    if (value.includes("/rest/v1/companies?")) {
      return {
        ok: true,
        json: async () => [{ id: "c-standard-bots", name: "Standard Bots" }]
      };
    }
    throw new Error(`Unexpected fetch: ${value}`);
  };

  const handler = require("../api/normalize-investors.js");
  let statusCode = 200;
  let payload = "";
  const req = { method: "GET", headers: {}, url: "/api/normalize-investors" };
  const res = {
    setHeader() {},
    get statusCode() { return statusCode; },
    set statusCode(value) { statusCode = value; },
    end(value = "") { payload = value; }
  };

  try {
    await handler(req, res);
    assert.equal(statusCode, 200);
    const body = JSON.parse(payload);
    assert.equal(body.parsedActivities, 1);
    assert.equal(body.investors, 2);
    assert.equal(body.activityInvestors, 2);
    assert.deepEqual(
      body.intelligence.investors.map((investor) => investor.name).sort(),
      ["General Catalyst", "RoboStrategy"]
    );

    statusCode = 200;
    payload = "";
    await handler({ method: "POST", headers: {}, body: {} }, res);
    assert.equal(statusCode, 401);
    assert.match(JSON.parse(payload).error, /credential/i);

    statusCode = 200;
    payload = "";
    await handler({
      method: "POST",
      headers: { authorization: "Bearer test-ingest-secret" },
      body: { dryRun: true }
    }, res);
    assert.equal(statusCode, 200);
    assert.equal(JSON.parse(payload).dryRun, true);
    console.log("investor normalization tests passed");
  } finally {
    global.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
    if (previousSecret === undefined) delete process.env.INGEST_SHARED_SECRET;
    else process.env.INGEST_SHARED_SECRET = previousSecret;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
