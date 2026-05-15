// Reference implementation for a Physical AI daily brief API.
//
// COPY-TO: ai_map_repo/api/daily-brief.js
//
// GET /api/daily-brief?days=2
// POST /api/daily-brief
//
// Produces an executive-ready JSON brief from approved public rows plus
// aggregate Review Queue / ingestion status. It never returns Gmail subjects,
// senders, snippets, or private extracted text.

const ALLOWED_ORIGINS = new Set([
  "https://ai-map-cyan.vercel.app",
  "https://tishir31.github.io",
  "http://localhost:5173"
]);

const EXPECTED_SOURCES = [
  { sourceName: "Gmail", maxAgeHours: 30 },
  { sourceName: "Public web news", maxAgeHours: 30 }
];

function setCors(req, res) {
  const origin = req.headers.origin || "";
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGINS.has(origin) ? origin : "https://ai-map-cyan.vercel.app");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
}

async function supabaseGet(supabaseUrl, serviceRoleKey, path) {
  const r = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`
    }
  });
  if (!r.ok) throw new Error(`Supabase read failed (${r.status}): ${(await r.text()).slice(0, 220)}`);
  return r.json();
}

function isoDateDaysAgo(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function hoursSince(value) {
  const t = new Date(value || 0).getTime();
  if (!Number.isFinite(t) || t <= 0) return Infinity;
  return (Date.now() - t) / 3_600_000;
}

function inc(counts, key, by = 1) {
  const k = key || "unknown";
  counts[k] = (counts[k] || 0) + by;
}

function money(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function latestRunsBySource(runs) {
  const latest = {};
  for (const run of runs || []) {
    const source = run.source_name || "unknown";
    if (!latest[source] || String(run.started_at) > String(latest[source].startedAt)) {
      latest[source] = {
        sourceName: source,
        sourceType: run.source_type,
        startedAt: run.started_at,
        completedAt: run.completed_at,
        ageHours: Math.round(hoursSince(run.completed_at || run.started_at) * 10) / 10,
        candidatesFound: Number(run.candidates_found || 0),
        dedupedCount: Number(run.deduped_count || 0),
        llmEnrichedCount: Number(run.llm_enriched_count || 0),
        llmRejectedCount: Number(run.llm_rejected_count || 0),
        llmFailedCount: Number(run.llm_failed_count || 0),
        status: run.status
      };
    }
  }
  return latest;
}

function summarizePending(items) {
  const bySource = {};
  const byAction = {};
  const byLlmStatus = {};
  let pending = 0;
  let pendingUpdates = 0;
  let lowScore = 0;
  let gmailOnly = 0;
  for (const item of items || []) {
    if (item.status !== "pending") continue;
    pending += 1;
    inc(bySource, item.source_type);
    inc(byAction, item.intelligence_action || (item.duplicate_of_activity_id ? "update_existing" : "unclassified"));
    inc(byLlmStatus, item.llm_status || "none");
    if (item.duplicate_of_activity_id || item.intelligence_action === "update_existing") pendingUpdates += 1;
    if (item.source_type === "Gmail" && !item.source_url) gmailOnly += 1;
    if (item.intelligence_score !== null && item.intelligence_score !== undefined && Number(item.intelligence_score) < 60) lowScore += 1;
  }
  return { pending, pendingUpdates, lowScore, gmailOnly, bySource, byAction, byLlmStatus };
}

function approvedBriefRows(activities, companyById) {
  return (activities || []).map((activity) => ({
    id: activity.id,
    date: activity.date_announced,
    company: companyById.get(activity.company_id) || activity.company_id,
    type: activity.activity_type,
    subsector: activity.subsector,
    geography: activity.geography,
    dealValueUsd: activity.deal_value_usd === null || activity.deal_value_usd === undefined ? null : Number(activity.deal_value_usd),
    counterparty: activity.counterparty,
    confidence: activity.confidence,
    sourceUrl: activity.source_url || undefined,
    description: activity.description
  }));
}

function buildActions({ pending, latestRuns, approvedRows }) {
  const actions = [];
  for (const expected of EXPECTED_SOURCES) {
    const run = latestRuns[expected.sourceName];
    if (!run) {
      actions.push({ priority: "high", action: `Investigate ${expected.sourceName}: no ingestion run recorded.` });
    } else if (run.status === "failed") {
      actions.push({ priority: "high", action: `Fix ${expected.sourceName}: latest ingestion run failed.` });
    } else if (run.ageHours > expected.maxAgeHours) {
      actions.push({ priority: "medium", action: `Refresh ${expected.sourceName}: latest run is ${run.ageHours} hours old.` });
    }
  }
  if (pending.pending > 20) actions.push({ priority: "medium", action: `Clear Review Queue backlog: ${pending.pending} pending items.` });
  if (pending.pendingUpdates > 0) actions.push({ priority: "medium", action: `Review ${pending.pendingUpdates} suggested updates to existing rows before adding new rows.` });
  if (pending.gmailOnly > 0) actions.push({ priority: "low", action: `Corroborate ${pending.gmailOnly} Gmail-only candidates with public sources before client use.` });
  if (approvedRows.length === 0) actions.push({ priority: "low", action: "No newly approved rows in this window; confirm ingestion still found and staged candidates." });
  return actions;
}

function executiveSummary({ approvedRows, pending, latestRuns, windowDays }) {
  const financingRows = approvedRows.filter((row) => row.type === "financing");
  const disclosedValue = financingRows.reduce((sum, row) => sum + money(row.dealValueUsd), 0);
  const bullets = [
    `${approvedRows.length} approved activity row${approvedRows.length === 1 ? "" : "s"} in the last ${windowDays} day${windowDays === 1 ? "" : "s"}.`,
    `${financingRows.length} financing row${financingRows.length === 1 ? "" : "s"}; disclosed value totals $${Math.round(disclosedValue / 1_000_000)}M.`,
    `${pending.pending} pending Review Queue item${pending.pending === 1 ? "" : "s"}, including ${pending.pendingUpdates} suggested update${pending.pendingUpdates === 1 ? "" : "s"}.`
  ];
  for (const expected of EXPECTED_SOURCES) {
    const run = latestRuns[expected.sourceName];
    bullets.push(run ? `${expected.sourceName} latest run: ${run.status}, ${run.ageHours}h old, ${run.candidatesFound} staged candidate${run.candidatesFound === 1 ? "" : "s"}.` : `${expected.sourceName} has no recorded run.`);
  }
  return bullets;
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "GET" && req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: "GET or POST only" }));
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const missing = [];
  if (!SUPABASE_URL) missing.push("SUPABASE_URL");
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (missing.length > 0) {
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: "Daily brief API is not configured.", missingEnv: missing }));
  }

  let windowDays = 2;
  try {
    const url = new URL(req.url || "/api/daily-brief", "https://ai-map-cyan.vercel.app");
    const parsedDays = Number(url.searchParams.get("days") || 2);
    windowDays = Number.isFinite(parsedDays) ? Math.max(1, Math.min(parsedDays, 14)) : 2;
  } catch {
    windowDays = 2;
  }
  const cutoff = isoDateDaysAgo(windowDays);

  try {
    const [companies, activities, pendingItems, runs] = await Promise.all([
      supabaseGet(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, "companies?select=id,name&is_sample=eq.false"),
      supabaseGet(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
        `activities?select=id,date_announced,company_id,counterparty,activity_type,subsector,deal_value_usd,geography,description,source_url,confidence,review_status,is_sample&review_status=eq.approved&is_sample=eq.false&date_announced=gte.${cutoff}&order=date_announced.desc&limit=200`
      ),
      supabaseGet(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
        "review_queue_items?select=id,status,source_type,source_url,duplicate_of_activity_id,intelligence_action,intelligence_score,llm_status&status=eq.pending&limit=1000"
      ),
      supabaseGet(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
        "ingestion_runs?select=id,source_name,source_type,started_at,completed_at,candidates_found,deduped_count,llm_enriched_count,llm_rejected_count,llm_failed_count,status&order=started_at.desc&limit=20"
      )
    ]);

    const companyById = new Map((companies || []).map((company) => [company.id, company.name]));
    const approvedRows = approvedBriefRows(activities || [], companyById);
    const pending = summarizePending(pendingItems || []);
    const latestRuns = latestRunsBySource(runs || []);
    const actions = buildActions({ pending, latestRuns, approvedRows });

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({
      ok: true,
      generatedAt: new Date().toISOString(),
      window: { days: windowDays, cutoffDate: cutoff },
      executiveSummary: executiveSummary({ approvedRows, pending, latestRuns, windowDays }),
      recommendedActions: actions,
      approvedRows,
      reviewQueue: pending,
      ingestion: { latestRunsBySource: latestRuns }
    }));
  } catch (error) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: (error && error.message) || String(error) }));
  }
};
