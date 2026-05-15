// Reference implementation for a single Physical AI ship-readiness endpoint.
//
// COPY-TO: ai_map_repo/api/ship-readiness.js
//
// GET /api/ship-readiness
// POST /api/ship-readiness
//
// Returns a single backend readiness score and operator checklist. It reads
// public approved rows plus aggregate private operational tables; it does not
// return Gmail subjects, senders, snippets, extracted text, or Review Queue
// evidence.

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
    return { ok: false, data: [], error: (error && error.message) || String(error) };
  }
}

function hoursSince(value) {
  const t = new Date(value || 0).getTime();
  if (!Number.isFinite(t) || t <= 0) return Infinity;
  return (Date.now() - t) / 3_600_000;
}

function daysSince(value) {
  const t = new Date(value || 0).getTime();
  if (!Number.isFinite(t) || t <= 0) return Infinity;
  return Math.floor((Date.now() - t) / 86_400_000);
}

function inc(counts, key, by = 1) {
  const k = key || "unknown";
  counts[k] = (counts[k] || 0) + by;
}

function parseAdditionalSources(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function hasPublicSource(activity) {
  if (activity.source_url && activity.source_type !== "Gmail") return true;
  return parseAdditionalSources(activity.additional_sources).some((source) => source?.url);
}

function latestRunsBySource(runs) {
  const latest = {};
  for (const run of runs || []) {
    const source = run.source_name || "unknown";
    if (!latest[source] || String(run.started_at) > String(latest[source].startedAt)) {
      latest[source] = {
        sourceName: source,
        status: run.status,
        startedAt: run.started_at,
        completedAt: run.completed_at,
        ageHours: Math.round(hoursSince(run.completed_at || run.started_at) * 10) / 10,
        candidatesFound: Number(run.candidates_found || 0),
        dedupedCount: Number(run.deduped_count || 0),
        llmEnrichedCount: Number(run.llm_enriched_count || 0),
        llmRejectedCount: Number(run.llm_rejected_count || 0),
        llmFailedCount: Number(run.llm_failed_count || 0)
      };
    }
  }
  return latest;
}

function summarizeQueue(items) {
  const bySource = {};
  const byAction = {};
  let pending = 0;
  let pendingUpdates = 0;
  let gmailOnly = 0;
  let lowScore = 0;
  for (const item of items || []) {
    if (item.status !== "pending") continue;
    pending += 1;
    inc(bySource, item.source_type);
    inc(byAction, item.intelligence_action || (item.duplicate_of_activity_id ? "update_existing" : "unclassified"));
    if (item.duplicate_of_activity_id || item.intelligence_action === "update_existing") pendingUpdates += 1;
    if (item.source_type === "Gmail" && !item.source_url) gmailOnly += 1;
    if (item.intelligence_score !== null && item.intelligence_score !== undefined && Number(item.intelligence_score) < 60) lowScore += 1;
  }
  return { pending, pendingUpdates, gmailOnly, lowScore, bySource, byAction };
}

function summarizeData(activities, companies) {
  const bySubsector = {};
  let publicSourceBacked = 0;
  let estimatedRows = 0;
  let staleRows = 0;
  let missingDealValue = 0;
  let missingInvestors = 0;
  let financingRows = 0;
  for (const activity of activities || []) {
    inc(bySubsector, activity.subsector);
    if (hasPublicSource(activity)) publicSourceBacked += 1;
    if (activity.confidence === "estimated") estimatedRows += 1;
    if (daysSince(activity.last_updated) > 90) staleRows += 1;
    if (activity.activity_type === "financing") {
      financingRows += 1;
      if (activity.deal_value_usd === null || activity.deal_value_usd === undefined) missingDealValue += 1;
      if (!activity.counterparty || activity.counterparty === "N/A") missingInvestors += 1;
    }
  }
  const missingWebsites = (companies || []).filter((company) => !company.website).length;
  const total = (activities || []).length;
  return {
    companies: (companies || []).length,
    approvedRows: total,
    financingRows,
    publicSourceBacked,
    publicSourceBackedPct: total ? Math.round((publicSourceBacked / total) * 100) : 0,
    estimatedRows,
    staleRows,
    missingDealValue,
    missingInvestors,
    missingWebsites,
    bySubsector
  };
}

function migrationStatus(reads) {
  return {
    multiSourceCitations: {
      applied: reads.multiSource.ok,
      migration: "docs/supabase-multi-source-migration.sql",
      error: reads.multiSource.ok ? undefined : reads.multiSource.error
    },
    ingestionIntelligence: {
      applied: reads.ingestionIntelligenceQueue.ok && reads.ingestionIntelligenceRuns.ok,
      migration: "docs/supabase-ingestion-intelligence-migration.sql",
      error: reads.ingestionIntelligenceQueue.ok && reads.ingestionIntelligenceRuns.ok ? undefined : reads.ingestionIntelligenceQueue.error || reads.ingestionIntelligenceRuns.error
    },
    investorNormalization: {
      applied: reads.investors.ok && reads.activityInvestors.ok,
      migration: "docs/supabase-vc-investor-normalization-migration.sql",
      investors: reads.investors.ok ? reads.investors.data.length : 0,
      activityInvestorLinks: reads.activityInvestors.ok ? reads.activityInvestors.data.length : 0,
      error: reads.investors.ok && reads.activityInvestors.ok ? undefined : reads.investors.error || reads.activityInvestors.error
    },
    auditHardening: {
      applied: reads.auditLog.ok && reads.analystProfiles.ok,
      migration: "docs/supabase-hardening-migration.sql",
      auditRowsSampled: reads.auditLog.ok ? reads.auditLog.data.length : 0,
      error: reads.auditLog.ok && reads.analystProfiles.ok ? undefined : reads.auditLog.error || reads.analystProfiles.error
    }
  };
}

function buildFindings({ migrations, latestRuns, queue, data }) {
  const findings = [];
  for (const [code, status] of Object.entries(migrations)) {
    if (!status.applied) {
      findings.push({ severity: "high", code: `migration-${code}`, detail: `${status.migration} is not confirmed applied.` });
    }
  }
  for (const expected of EXPECTED_SOURCES) {
    const run = latestRuns[expected.sourceName];
    if (!run) {
      findings.push({ severity: "high", code: "missing-ingestion-run", detail: `${expected.sourceName} has no recorded ingestion run.` });
      continue;
    }
    if (run.status === "failed") {
      findings.push({ severity: "high", code: "failed-ingestion-run", detail: `${expected.sourceName} latest run failed.` });
    }
    if (run.ageHours > expected.maxAgeHours) {
      findings.push({ severity: "medium", code: "stale-ingestion-run", detail: `${expected.sourceName} latest run is ${run.ageHours}h old.` });
    }
  }
  if (queue.pending > 30) findings.push({ severity: "medium", code: "review-backlog", detail: `${queue.pending} pending Review Queue items.` });
  if (queue.pendingUpdates > 0) findings.push({ severity: "medium", code: "pending-updates", detail: `${queue.pendingUpdates} candidates should update existing rows.` });
  if (queue.gmailOnly > 0) findings.push({ severity: "low", code: "gmail-only", detail: `${queue.gmailOnly} Gmail-only candidates need public corroboration.` });
  if (data.publicSourceBackedPct < 80) findings.push({ severity: "medium", code: "weak-source-coverage", detail: `Only ${data.publicSourceBackedPct}% of approved rows have public source coverage.` });
  if (data.estimatedRows > 0) findings.push({ severity: "low", code: "estimated-rows", detail: `${data.estimatedRows} approved rows use estimated confidence.` });
  if (data.staleRows > 0) findings.push({ severity: "low", code: "stale-approved-rows", detail: `${data.staleRows} approved rows have not been refreshed in 90+ days.` });
  if (data.missingInvestors > 0) findings.push({ severity: "low", code: "missing-investor-fields", detail: `${data.missingInvestors} financing rows have missing investor/counterparty fields.` });
  return findings;
}

function score(findings) {
  let value = 100;
  for (const finding of findings) {
    if (finding.severity === "high") value -= 16;
    else if (finding.severity === "medium") value -= 7;
    else value -= 3;
  }
  value = Math.max(0, value);
  const status = value >= 88 ? "ship_ready" : value >= 72 ? "pilot_ready" : value >= 55 ? "needs_work" : "blocked";
  return { score: value, status };
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
    return res.end(JSON.stringify({ ok: false, error: "Ship readiness API is not configured.", missingEnv: missing }));
  }

  try {
    const [
      companies,
      activities,
      pending,
      runs,
      multiSource,
      ingestionIntelligenceQueue,
      ingestionIntelligenceRuns,
      investors,
      activityInvestors,
      auditLog,
      analystProfiles
    ] = await Promise.all([
      supabaseGet(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, "companies?select=id,name,website,is_sample&is_sample=eq.false&limit=3000"),
      supabaseGet(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, "activities?select=id,date_announced,company_id,counterparty,activity_type,subsector,deal_value_usd,description,source_url,source_type,additional_sources,confidence,last_updated,review_status,is_sample&review_status=eq.approved&is_sample=eq.false&order=date_announced.desc&limit=3000"),
      supabaseGet(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, "review_queue_items?select=id,status,source_type,source_url,duplicate_of_activity_id,intelligence_action,intelligence_score&status=eq.pending&limit=1000"),
      supabaseGet(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, "ingestion_runs?select=id,source_name,source_type,started_at,completed_at,candidates_found,deduped_count,llm_enriched_count,llm_rejected_count,llm_failed_count,status&order=started_at.desc&limit=50"),
      optionalRead(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, "activities?select=additional_sources&limit=1"),
      optionalRead(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, "review_queue_items?select=intelligence_action,intelligence_score,intelligence_evidence,intelligence_cautions,llm_model,llm_status&limit=1"),
      optionalRead(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, "ingestion_runs?select=llm_enriched_count,llm_rejected_count,llm_failed_count&limit=1"),
      optionalRead(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, "investors?select=id&limit=1000"),
      optionalRead(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, "activity_investors?select=activity_id,investor_id&limit=1000"),
      optionalRead(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, "audit_log?select=id,table_name,action,at&limit=1"),
      optionalRead(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, "analyst_profiles?select=user_id,is_lead&limit=1")
    ]);

    const migrations = migrationStatus({ multiSource, ingestionIntelligenceQueue, ingestionIntelligenceRuns, investors, activityInvestors, auditLog, analystProfiles });
    const latestRuns = latestRunsBySource(runs);
    const queue = summarizeQueue(pending);
    const data = summarizeData(activities, companies);
    const findings = buildFindings({ migrations, latestRuns, queue, data });
    const readiness = score(findings);

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({
      ok: true,
      generatedAt: new Date().toISOString(),
      readiness,
      findings,
      migrations,
      ingestion: { latestRunsBySource: latestRuns, recentRunsRead: runs.length },
      reviewQueue: queue,
      approvedData: data,
      nextActions: findings.slice(0, 8).map((finding) => ({
        priority: finding.severity,
        action: finding.detail
      }))
    }));
  } catch (error) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: (error && error.message) || String(error) }));
  }
};
