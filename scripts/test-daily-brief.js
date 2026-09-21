"use strict";

const assert = require("node:assert/strict");
const dailyBrief = require("../api/daily-brief");

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  };
}

async function run() {
  const savedUrl = process.env.SUPABASE_URL;
  const savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const savedFetch = global.fetch;
  process.env.SUPABASE_URL = "https://project.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-secret";
  global.fetch = async (input) => {
    const url = new URL(String(input));
    const table = url.pathname.split("/").at(-1);
    if (table === "companies") return jsonResponse([
      { id: "c-public", name: "Public Robotics" },
      { id: "c-gmail", name: "Private Signal Robotics" },
    ]);
    if (table === "activities") return jsonResponse([
      {
        id: "a-public",
        date_announced: "2026-09-04",
        company_id: "c-public",
        counterparty: "Investor",
        activity_type: "financing",
        subsector: "robotics",
        deal_value_usd: 100,
        geography: "United States",
        description: "Publicly announced financing.",
        source_url: "https://public.example/announcement",
        source_reference: "Company announcement",
        source_type: "company blog",
        additional_sources: [],
        confidence: "confirmed",
        review_status: "approved",
        is_sample: false,
      },
      {
        id: "a-gmail",
        date_announced: "2026-09-04",
        company_id: "c-gmail",
        counterparty: "Undisclosed",
        activity_type: "financing",
        subsector: "robotics",
        deal_value_usd: 200,
        geography: "United States",
        description: "Approved private signal.",
        source_url: null,
        source_reference: null,
        source_type: "Gmail",
        additional_sources: [{ url: "https://public.example/corroboration", type: "article" }],
        confidence: "reported",
        review_status: "approved",
        is_sample: false,
      },
    ]);
    if (table === "review_queue_items") return jsonResponse([]);
    if (table === "ingestion_runs") return jsonResponse([{ source_name: "Public web news", source_type: "rss", started_at: new Date().toISOString(), completed_at: new Date().toISOString(), candidates_found: 0, deduped_count: 0, llm_enriched_count: 0, llm_rejected_count: 0, llm_failed_count: 2, status: "partial" }]);
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
    await dailyBrief({ method: "GET", url: "/api/daily-brief?days=14", headers: {} }, res);
    assert.equal(res.statusCode, 200);
    const payload = JSON.parse(body);
    assert.equal(payload.approvedRows.length, 1);
    assert.equal(payload.approvedRows[0].id, "a-public");
    assert.equal(JSON.stringify(payload).includes("Private Signal Robotics"), false);
    assert.equal(JSON.stringify(payload).includes("Approved private signal"), false);
    assert(payload.recommendedActions.some((row) => row.priority === "high" && row.action.includes("latest ingestion covered only part")));
  } finally {
    global.fetch = savedFetch;
    if (savedUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = savedUrl;
    if (savedKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;
  }

  console.log("daily brief privacy tests passed");
}

run().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exitCode = 1;
});
