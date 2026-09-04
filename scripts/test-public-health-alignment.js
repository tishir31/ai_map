"use strict";

const assert = require("node:assert/strict");
const pipelineHealth = require("../api/pipeline-health");
const shipReadiness = require("../api/ship-readiness");

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  };
}

function isoDateDaysAgo(days) {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

function createResponse() {
  let body = "";
  return {
    res: {
      statusCode: 200,
      headers: {},
      setHeader(name, value) { this.headers[name] = value; },
      end(value = "") { body = value; return value; },
    },
    payload() { return JSON.parse(body); },
  };
}

async function run() {
  const safeDate = isoDateDaysAgo(7);
  const today = isoDateDaysAgo(0);
  const base = {
    id: "a-safe",
    date_announced: safeDate,
    company_id: "c-safe",
    counterparty: "Public Ventures",
    activity_type: "financing",
    subsector: "robotics",
    deal_value_usd: 10_000_000,
    geography: "United States",
    description: "Publicly announced financing.",
    source_id: "s-safe",
    source_url: "https://company.example/news/round",
    source_reference: "Company financing announcement",
    source_type: "company blog",
    additional_sources: [],
    confidence: "confirmed",
    review_status: "approved",
    last_updated: today,
    is_sample: false,
    entered_by: null,
    approved_at: `${today}T00:00:00Z`,
  };
  const activities = [
    base,
    { ...base, id: "a-google-redirect", date_announced: today, source_id: "s-google", source_url: "https://news.google.com/rss/articles/redirect" },
    { ...base, id: "a-estimated", date_announced: today, source_id: "s-estimated", confidence: "estimated" },
    { ...base, id: "a-gmail", date_announced: today, source_id: "s-gmail", source_type: "Gmail", source_url: null, additional_sources: [{ url: "https://company.example/corroboration", type: "press release" }] },
    { ...base, id: "a-excluded", date_announced: today, company_id: "c-excluded", source_id: "s-excluded" },
    { ...base, id: "a-orphan", date_announced: today, company_id: "c-missing", source_id: "s-orphan" },
  ];
  const companies = [
    { id: "c-safe", name: "Safe Robotics", overview: "Robotics company.", subsector: "robotics", geography: "United States", website: "https://company.example", is_sample: false },
    { id: "c-excluded", name: "Excluded Robotics", overview: "Excluded company.", subsector: "robotics", geography: "United States", website: "https://excluded.example", is_sample: false },
  ];
  const exclusions = [{
    id: "ex-a-excluded",
    target_type: "activity",
    target_id: "a-excluded",
    company_id: "c-excluded",
    reason: "duplicate",
    cascade: false,
    excluded_at: `${today}T00:00:00Z`,
    restored_at: null,
  }];
  const runs = [
    { id: "run-web", source_name: "Public web news", source_type: "web", started_at: `${today}T00:00:00Z`, completed_at: `${today}T00:01:00Z`, status: "completed", candidates_found: 1, deduped_count: 0 },
    { id: "run-gmail", source_name: "Gmail", source_type: "gmail", started_at: `${today}T00:00:00Z`, completed_at: `${today}T00:01:00Z`, status: "completed", candidates_found: 0, deduped_count: 0 },
  ];

  const savedUrl = process.env.SUPABASE_URL;
  const savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const savedFetch = global.fetch;
  process.env.SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-secret";
  global.fetch = async (input) => {
    const url = new URL(String(input));
    const table = url.pathname.split("/").at(-1);
    const select = url.searchParams.get("select");
    if (table === "activities" && select === "additional_sources") return jsonResponse([{ additional_sources: [] }]);
    if (table === "activities") return jsonResponse(activities);
    if (table === "companies") return jsonResponse(companies);
    if (table === "data_exclusions") return jsonResponse(exclusions);
    if (table === "ingestion_runs") return jsonResponse(runs);
    if (table === "review_queue_items") return jsonResponse([]);
    if (table === "investors" || table === "activity_investors" || table === "audit_log" || table === "analyst_profiles") return jsonResponse([]);
    throw new Error(`Unexpected table: ${table}`);
  };

  try {
    const pipeline = createResponse();
    await pipelineHealth({ method: "GET", url: "/api/pipeline-health", query: {}, headers: {} }, pipeline.res);
    assert.equal(pipeline.res.statusCode, 200);
    const pipelinePayload = pipeline.payload();
    assert.equal(pipelinePayload.approvedDataset.approvedRowsRead, 1);
    assert.equal(pipelinePayload.approvedDataset.publicSafeRows, 1);
    assert.equal(pipelinePayload.approvedDataset.companies, 1);
    assert.equal(pipelinePayload.approvedDataset.approvedLast30d, 1);
    assert.equal(pipelinePayload.approvedDataset.latestActivityDate, safeDate);

    const readiness = createResponse();
    await shipReadiness({ method: "GET", url: "/api/ship-readiness", headers: {} }, readiness.res);
    assert.equal(readiness.res.statusCode, 200);
    const readinessPayload = readiness.payload();
    assert.equal(readinessPayload.approvedData.approvedRows, 1);
    assert.equal(readinessPayload.approvedData.publicSafeRows, 1);
    assert.equal(readinessPayload.approvedData.companies, 1);
    assert.equal(readinessPayload.approvedData.latestActivityDate, safeDate);
    assert.equal(readinessPayload.approvedData.publicSourceBackedPct, 100);
  } finally {
    global.fetch = savedFetch;
    if (savedUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = savedUrl;
    if (savedKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;
  }

  console.log("public health/readiness alignment tests passed");
}

run().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
