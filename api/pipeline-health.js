// Reference implementation for backend pipeline health.
//
// COPY-TO: ai_map_repo/api/pipeline-health.js
//
// GET /api/pipeline-health
// POST /api/pipeline-health
//
// Returns aggregate operational health only. It deliberately does not return
// private Review Queue snippets, Gmail subjects, senders, or extracted text.

const { canHandlePhysicalAiRoute, handlePhysicalAiRoute } = require("../lib/physical-ai-router");

const ALLOWED_ORIGINS = new Set([
  "https://ai-map-cyan.vercel.app",
  "https://tishir31.github.io",
  "http://localhost:5173"
]);

const EXPECTED_SOURCES = [
  { sourceName: "Gmail", maxAgeHours: 30 },
  { sourceName: "Public web news", maxAgeHours: 30 }
];
const RETIRED_SOURCES = new Set([
  "Gmail attachment: physical_ai_mna_deals.xlsx",
  "Mock Gmail sweep",
  "Autonomy RSS sources"
]);
const ANY_SOURCE_MAX_AGE_HOURS = 48;

function setCors(req, res) {
  const origin = req.headers.origin || "";
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGINS.has(origin) ? origin : "https://ai-map-cyan.vercel.app");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
}

function hoursSince(value) {
  const t = new Date(value || 0).getTime();
  if (!Number.isFinite(t) || t <= 0) return Infinity;
  return (Date.now() - t) / 3_600_000;
}

function emptyCounts() {
  return Object.create(null);
}

function increment(counts, key) {
  const k = key || "unknown";
  counts[k] = (counts[k] || 0) + 1;
}

async function supabaseGet(supabaseUrl, serviceRoleKey, path) {
  const r = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`
    }
  });
  if (!r.ok) {
    const error = new Error(`Supabase read failed (${r.status}): ${(await r.text()).slice(0, 220)}`);
    error.status = r.status;
    throw error;
  }
  return r.json();
}

async function optionalRead(supabaseUrl, serviceRoleKey, path) {
  try {
    return { ok: true, data: await supabaseGet(supabaseUrl, serviceRoleKey, path) };
  } catch (error) {
    return { ok: false, error: (error && error.message) || String(error) };
  }
}

async function readWithFallback(supabaseUrl, serviceRoleKey, primaryPath, fallbackPath) {
  const primary = await optionalRead(supabaseUrl, serviceRoleKey, primaryPath);
  if (primary.ok || !fallbackPath) return primary;
  const fallback = await optionalRead(supabaseUrl, serviceRoleKey, fallbackPath);
  if (!fallback.ok) return primary;
  return {
    ok: true,
    data: fallback.data,
    warning: `Using compatibility read because primary query failed: ${primary.error}`
  };
}

function summarizeRuns(runs) {
  const latestBySource = {};
  for (const run of runs) {
    const source = run.source_name || "unknown";
    if (!latestBySource[source] || String(run.started_at) > String(latestBySource[source].startedAt)) {
      latestBySource[source] = {
        id: run.id,
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
  return latestBySource;
}

function summarizeQueue(items) {
  const bySource = emptyCounts();
  const byAction = emptyCounts();
  const byLlmStatus = emptyCounts();
  let pending = 0;
  let pendingUpdates = 0;
  let gmailOnly = 0;
  let lowScore = 0;
  for (const item of items) {
    if (item.status !== "pending") continue;
    pending += 1;
    increment(bySource, item.source_type);
    increment(byAction, item.intelligence_action || (item.duplicate_of_activity_id ? "update_existing" : "unclassified"));
    increment(byLlmStatus, item.llm_status || "none");
    if (item.duplicate_of_activity_id || item.intelligence_action === "update_existing") pendingUpdates += 1;
    if (item.source_type === "Gmail" && !item.source_url) gmailOnly += 1;
    if (item.intelligence_score !== null && item.intelligence_score !== undefined && Number(item.intelligence_score) < 60) lowScore += 1;
  }
  return {
    pending,
    pendingUpdates,
    gmailOnly,
    lowScore,
    bySource,
    byAction,
    byLlmStatus
  };
}

function buildFindings({ latestBySource, queue, investorStatus, runWindow, schemaWarnings, llmConfigured }) {
  const findings = [];
  const expectedNames = new Set(EXPECTED_SOURCES.map((source) => source.sourceName));
  for (const expected of EXPECTED_SOURCES) {
    const latest = latestBySource[expected.sourceName];
    if (!latest) {
      findings.push({ severity: "high", code: "missing-run", detail: `${expected.sourceName} has no recorded ingestion run.` });
      continue;
    }
    if (latest.status === "failed") {
      findings.push({ severity: "high", code: "latest-run-failed", detail: `${expected.sourceName} latest run failed.` });
    }
    if (latest.ageHours > expected.maxAgeHours) {
      findings.push({ severity: "medium", code: "stale-run", detail: `${expected.sourceName} latest run is ${latest.ageHours}h old.` });
    }
  }
  for (const run of Object.values(latestBySource)) {
    if (expectedNames.has(run.sourceName)) continue;
    if (RETIRED_SOURCES.has(run.sourceName)) continue;
    if (run.ageHours > ANY_SOURCE_MAX_AGE_HOURS) {
      findings.push({ severity: "medium", code: "stale-ingestion-source", detail: `${run.sourceName} latest run is ${run.ageHours}h old; stale sources should not count as healthy.` });
    }
  }
  const llmFailures = runWindow.reduce((sum, run) => sum + Number(run.llm_failed_count || 0), 0);
  const llmEnriched = runWindow.reduce((sum, run) => sum + Number(run.llm_enriched_count || 0), 0);
  if (llmFailures > 0 && llmFailures >= llmEnriched) {
    findings.push({ severity: "medium", code: "llm-failure-rate", detail: `LLM failures (${llmFailures}) are high relative to enrichments (${llmEnriched}).` });
  }
  if (queue.pending > 25) {
    findings.push({ severity: "medium", code: "review-backlog", detail: `${queue.pending} pending Review Queue items.` });
  }
  if (queue.gmailOnly > 0) {
    findings.push({ severity: "low", code: "gmail-only", detail: `${queue.gmailOnly} Gmail-only candidates need public corroboration.` });
  }
  if (!llmConfigured) {
    findings.push({ severity: "medium", code: "llm-triage-disabled", detail: "LLM triage is not configured; ingestion is relying on deterministic gates only." });
  }
  if (schemaWarnings.length > 0) {
    findings.push({ severity: "medium", code: "schema-compatibility-mode", detail: "Supabase is missing newer ingestion intelligence columns; API is using compatibility reads." });
  }
  if (!investorStatus.applied) {
    findings.push({ severity: "low", code: "investor-normalization-missing", detail: "Investor normalization migration has not been applied." });
  }
  return findings;
}

function scoreHealth(findings) {
  let score = 100;
  for (const finding of findings) {
    if (finding.severity === "high") score -= 30;
    else if (finding.severity === "medium") score -= 14;
    else score -= 5;
  }
  score = Math.max(0, score);
  const status = score >= 85 ? "healthy" : score >= 65 ? "degraded" : "action_required";
  return { score, status };
}

module.exports = async function handler(req, res) {
  // Hobby deployments are capped at 12 functions. Stable public graph and
  // market-snapshot paths are rewritten here and dispatched before the legacy
  // pipeline-health handler, keeping all URL contracts intact in one function.
  if (canHandlePhysicalAiRoute(req)) return handlePhysicalAiRoute(req, res);
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
    return res.end(JSON.stringify({ ok: false, error: "Pipeline health is not configured.", missingEnv: missing }));
  }

  try {
    const [runsRead, queueRead, recentActivities, investors, activityInvestors] = await Promise.all([
      readWithFallback(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
        "ingestion_runs?select=id,source_name,source_type,started_at,completed_at,candidates_found,deduped_count,llm_enriched_count,llm_rejected_count,llm_failed_count,status&order=started_at.desc&limit=50",
        "ingestion_runs?select=id,source_name,source_type,started_at,completed_at,candidates_found,deduped_count,status&order=started_at.desc&limit=50"
      ),
      readWithFallback(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
        "review_queue_items?select=id,status,source_type,source_url,duplicate_of_activity_id,intelligence_action,intelligence_score,llm_status&status=eq.pending&limit=1000",
        "review_queue_items?select=id,status,source_type,source_url,duplicate_of_activity_id&status=eq.pending&limit=1000"
      ),
      supabaseGet(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
        "activities?select=id,date_announced&review_status=eq.approved&is_sample=eq.false&order=date_announced.desc&limit=1000"
      ),
      optionalRead(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, "investors?select=id,kind&limit=1000"),
      optionalRead(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, "activity_investors?select=activity_id,investor_id,role&limit=1000")
    ]);

    if (!runsRead.ok) throw new Error(runsRead.error);
    if (!queueRead.ok) throw new Error(queueRead.error);
    const runs = runsRead.data || [];
    const queue = queueRead.data || [];
    const latestBySource = summarizeRuns(runs);
    const queueSummary = summarizeQueue(queue);
    const investorStatus = {
      applied: investors.ok && activityInvestors.ok,
      investors: investors.ok ? investors.data.length : 0,
      activityInvestors: activityInvestors.ok ? activityInvestors.data.length : 0,
      error: investors.ok && activityInvestors.ok ? undefined : investors.error || activityInvestors.error
    };
    const approvedLast30d = recentActivities.filter((activity) => hoursSince(activity.date_announced) <= 24 * 30).length;
    const schemaWarnings = [runsRead.warning, queueRead.warning].filter(Boolean);
    const llmConfigured = process.env.INGEST_LLM_ENABLED !== "false" && Boolean(process.env.GEMINI_API_KEY);
    const findings = buildFindings({ latestBySource, queue: queueSummary, investorStatus, runWindow: runs, schemaWarnings, llmConfigured });
    const health = scoreHealth(findings);

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({
      ok: true,
      generatedAt: new Date().toISOString(),
      health,
      findings,
      ingestion: {
        latestBySource,
        recentRuns: runs.length,
        totalCandidatesFound: runs.reduce((sum, run) => sum + Number(run.candidates_found || 0), 0),
        totalDeduped: runs.reduce((sum, run) => sum + Number(run.deduped_count || 0), 0),
        llmEnriched: runs.reduce((sum, run) => sum + Number(run.llm_enriched_count || 0), 0),
        llmRejected: runs.reduce((sum, run) => sum + Number(run.llm_rejected_count || 0), 0),
        llmFailed: runs.reduce((sum, run) => sum + Number(run.llm_failed_count || 0), 0)
      },
      reviewQueue: queueSummary,
      approvedDataset: {
        approvedRowsRead: recentActivities.length,
        approvedLast30d
      },
      investorNormalization: investorStatus,
      intelligence: {
        llmConfigured,
        model: process.env.INGEST_LLM_MODEL || "gemini-2.5-flash",
        schemaCompatibilityMode: schemaWarnings.length > 0
      },
      warnings: schemaWarnings
    }));
  } catch (error) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: (error && error.message) || String(error) }));
  }
};
