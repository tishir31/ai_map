"use strict";

const assert = require("node:assert/strict");
const { buildSnapshot, isPublicSafeActivity } = require("../lib/market-snapshot");

const base = {
  id: "a-safe",
  date_announced: "2026-07-12",
  company_id: "c-safe",
  counterparty: "Acme Ventures",
  activity_type: "financing",
  subsector: "robotics",
  deal_value_usd: 10_000_000,
  geography: "United States",
  description: "Safe public announcement.",
  source_id: "s-safe",
  source_url: "https://company.example/news/round",
  source_reference: "Company financing announcement",
  source_type: "press release",
  additional_sources: [],
  confidence: "confirmed",
  review_status: "approved",
  last_updated: "2026-07-12",
  is_sample: false,
};

assert.equal(isPublicSafeActivity(base), true);
assert.equal(isPublicSafeActivity({ ...base, id: "a-pending", review_status: "pending" }), false);
assert.equal(isPublicSafeActivity({ ...base, id: "a-gmail", source_type: "Gmail", source_url: null }), false);
assert.equal(isPublicSafeActivity({ ...base, id: "a-rq-gmail-private-origin", source_type: "press release" }), false);
assert.equal(isPublicSafeActivity({ ...base, id: "a-web", entered_by: "gmail-ingestion", source_type: "press release" }), false);
assert.equal(isPublicSafeActivity({ ...base, id: "a-google-news", source_url: "https://news.google.com/rss/articles/redirect" }), false);
assert.equal(isPublicSafeActivity({
  ...base,
  id: "a-gmail-corroborated",
  source_type: "Gmail",
  source_url: null,
  additional_sources: [{ url: "https://company.example/public-corroboration", type: "press release" }],
}), false);
assert.equal(isPublicSafeActivity({ ...base, id: "a-email", description: "Contact private@example.com" }), false);
assert.equal(isPublicSafeActivity({ ...base, id: "a-url-email", source_url: "https://company.example/news?contact=private@example.com" }), false);

const snapshot = buildSnapshot({
  activities: [
    base,
    { ...base, id: "a-july", date_announced: "2026-07-28", source_id: "s-july" },
    { ...base, id: "a-private", source_type: "Gmail", source_url: null, source_id: "s-private" },
    { ...base, id: "a-private-corroborated", company_id: "c-private", source_type: "Gmail", source_url: null, source_id: "s-private-corroborated", additional_sources: [{ url: "https://company.example/public-corroboration", type: "press release" }] },
    { ...base, id: "a-excluded", company_id: "c-excluded", source_id: "s-excluded" },
    { ...base, id: "a-orphan", company_id: "c-missing", source_id: "s-orphan" },
    { ...base, id: "a-title-scrub", source_id: "s-title-scrub", additional_sources: [{ url: "https://press.example/story", type: "press", title: "Forwarded by private@example.com" }] },
  ],
  companies: [
    { id: "c-safe", name: "Safe Robotics", overview: "Robots", subsector: "robotics", geography: "United States", website: "https://safe.example", is_sample: false },
    { id: "c-excluded", name: "Excluded Co", overview: "", subsector: "robotics", geography: "United States", website: null, is_sample: false },
    { id: "c-private", name: "Private Mail Co", overview: "Private-only profile", subsector: "robotics", geography: "United States", website: null, is_sample: false },
    { id: "c-no-activity", name: "Unsupported Co", overview: "No public activity", subsector: "robotics", geography: "United States", website: "https://unsupported.example", is_sample: false },
  ],
  exclusions: [{ id: "ex-1", target_type: "company", target_id: "c-excluded", reason: "out_of_scope", note: "private note", excluded_at: "2026-07-30", restored_at: null }],
  ingestionRuns: [{ id: "run-1", source_name: "Public web news", source_type: "rss", query: "private query", started_at: "2026-07-29", status: "completed" }],
}, new Date("2026-09-04T00:00:00Z"));

assert.equal(snapshot.activities.length, 3);
assert.equal(snapshot.latestActivityDate, "2026-07-28");
assert.equal(snapshot.activities.some((row) => row.id === "a-private"), false);
assert.equal(snapshot.activities.some((row) => row.id === "a-excluded"), false);
assert.equal(snapshot.activities.some((row) => row.id === "a-private-corroborated"), false);
assert.equal(snapshot.activities.some((row) => row.id === "a-orphan"), false);
assert.deepEqual(snapshot.companies.map((row) => row.id), ["c-safe"]);
assert.equal(snapshot.counts.companies, 1);
assert.equal(snapshot.counts.activeCompanies, 1);
assert.equal(snapshot.exclusions[0].note, null);
assert.equal(snapshot.ingestionRuns[0].query, null);
assert.equal(JSON.stringify(snapshot).includes("private query"), false);
assert.equal(JSON.stringify(snapshot).includes("private note"), false);
assert.equal(JSON.stringify(snapshot).includes("private@example.com"), false);

console.log("market snapshot tests passed");
