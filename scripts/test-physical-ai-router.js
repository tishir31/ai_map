"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const pipelineHealth = require("../api/pipeline-health");
const { physicalAiRoute, routeHandlers } = require("../lib/physical-ai-router");

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  };
}

async function run() {
  const apiFiles = fs.readdirSync(path.resolve(__dirname, "../api"))
    .filter((name) => name.endsWith(".js"));
  assert.ok(apiFiles.length <= 12, `Vercel Hobby limit exceeded: ${apiFiles.length} API functions`);

  assert.equal(physicalAiRoute({ query: { physicalAiRoute: "graph-search" }, headers: {} }), "graph-search");
  assert.equal(physicalAiRoute({ url: "/api/pipeline-health?physicalAiRoute=market-snapshot", headers: {} }), "market-snapshot");
  for (const route of [
    "market-snapshot", "graph-search", "graph-investigate", "graph-compare", "graph-review",
    "graph-refresh", "graph-refresh-weekly", "graph-refresh-monthly", "graph-refresh-quarterly",
  ]) assert.equal(typeof routeHandlers[route], "function", `${route} is not routed`);

  const savedUrl = process.env.SUPABASE_URL;
  const savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const savedFetch = global.fetch;
  process.env.SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-secret";
  global.fetch = async (input) => {
    const url = new URL(String(input));
    const table = url.pathname.split("/").at(-1);
    if (table === "activities") return response([{
      id: "a-public",
      date_announced: "2026-09-04",
      company_id: "c-public",
      counterparty: "Investor",
      activity_type: "financing",
      subsector: "robotics",
      deal_value_usd: 100,
      geography: "United States",
      description: "Public announcement.",
      source_id: "s-public",
      source_url: "https://public.example/announcement",
      source_reference: "Company announcement",
      source_type: "company blog",
      additional_sources: [],
      confidence: "confirmed",
      review_status: "approved",
      is_sample: false,
    }]);
    if (table === "companies") return response([{
      id: "c-public",
      name: "Public Robotics",
      overview: "Robotics company.",
      subsector: "robotics",
      geography: "United States",
      website: "https://public.example",
      is_sample: false,
    }]);
    if (table === "data_exclusions" || table === "ingestion_runs") return response([]);
    throw new Error(`Unexpected table: ${table}`);
  };

  let body = "";
  const res = {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[name] = value; },
    end(value = "") { body = value; return value; },
  };
  try {
    await pipelineHealth({
      method: "GET",
      query: { physicalAiRoute: "market-snapshot" },
      url: "/api/pipeline-health?physicalAiRoute=market-snapshot",
      headers: {},
    }, res);
    assert.equal(res.statusCode, 200);
    const payload = JSON.parse(body);
    assert.equal(payload.source, "supabase-public-projection");
    assert.equal(payload.snapshot.counts.activities, 1);
  } finally {
    global.fetch = savedFetch;
    if (savedUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = savedUrl;
    if (savedKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;
  }

  console.log(`physical AI router tests passed (${apiFiles.length}/12 functions)`);
}

run().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
