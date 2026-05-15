// Reference implementation for approved-dataset quality scoring.
//
// COPY-TO: ai_map_repo/api/data-quality.js
//
// GET /api/data-quality
// POST /api/data-quality
//
// Reads approved, non-sample public market rows and returns a client-readiness
// score plus row/company findings. It never reads Review Queue or Gmail bodies.

const ALLOWED_ORIGINS = new Set([
  "https://ai-map-cyan.vercel.app",
  "https://tishir31.github.io",
  "http://localhost:5173"
]);

const CORE_SUBSECTORS = [
  "robotics",
  "humanoids",
  "autonomous vehicles",
  "drones",
  "defense autonomy",
  "industrial automation",
  "embodied AI",
  "edge AI hardware"
];

const PLACEHOLDER_HOSTS = new Set(["example.com", "example.org", "example.net"]);
const STALE_AFTER_DAYS = 90;
const HIGH_VALUE_THRESHOLD = 100_000_000;

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

function hostOf(url) {
  if (!url) return "";
  try {
    return new URL(url).host.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isPlaceholderUrl(url) {
  const host = hostOf(url);
  if (!host) return false;
  for (const placeholder of PLACEHOLDER_HOSTS) {
    if (host === placeholder || host.endsWith(`.${placeholder}`)) return true;
  }
  return false;
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

function sourceRefs(activity) {
  const refs = [];
  if (activity.source_url) {
    refs.push({ url: activity.source_url, type: activity.source_type, title: activity.source_reference || "Primary source" });
  }
  for (const src of parseAdditionalSources(activity.additional_sources)) {
    if (src && src.url) refs.push({ url: src.url, type: src.type, title: src.title || "Additional source" });
  }
  return refs;
}

function hasPublicSource(activity) {
  return sourceRefs(activity).some((src) => src.url && src.type !== "Gmail" && !isPlaceholderUrl(src.url));
}

function daysSince(value) {
  const then = new Date(value || 0).getTime();
  if (!Number.isFinite(then) || then <= 0) return Infinity;
  return Math.floor((Date.now() - then) / 86_400_000);
}

function money(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function inc(map, key, by = 1) {
  const k = key || "unknown";
  map[k] = (map[k] || 0) + by;
}

function pct(numerator, denominator) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

function severityPenalty(severity) {
  if (severity === "high") return 7;
  if (severity === "medium") return 3;
  return 1;
}

function addFinding(findings, finding) {
  findings.push(finding);
}

function activityName(activity, companyById) {
  return companyById.get(activity.company_id) || activity.company_id || "Unknown company";
}

function buildRowFindings(activities, companyById, activityInvestorLinks) {
  const findings = [];
  const linksByActivity = new Map();
  for (const link of activityInvestorLinks || []) {
    const id = link.activity_id;
    if (!id) continue;
    linksByActivity.set(id, (linksByActivity.get(id) || 0) + 1);
  }

  for (const activity of activities) {
    const company = activityName(activity, companyById);
    const refs = sourceRefs(activity);
    const hasPublic = hasPublicSource(activity);
    const dealValue = money(activity.deal_value_usd);
    const base = {
      activityId: activity.id,
      company,
      dateAnnounced: activity.date_announced,
      activityType: activity.activity_type,
      subsector: activity.subsector
    };

    if (!hasPublic) {
      addFinding(findings, {
        ...base,
        severity: "high",
        code: "missing-public-source",
        detail: "Approved row lacks a usable public source URL."
      });
    }
    if (refs.some((src) => isPlaceholderUrl(src.url))) {
      addFinding(findings, {
        ...base,
        severity: "high",
        code: "placeholder-source",
        detail: "Approved row uses a placeholder source host."
      });
    }
    if (activity.confidence === "estimated") {
      addFinding(findings, {
        ...base,
        severity: "medium",
        code: "estimated-confidence",
        detail: "Confidence is estimated; verify before client export."
      });
    }
    if (daysSince(activity.last_updated) > STALE_AFTER_DAYS) {
      addFinding(findings, {
        ...base,
        severity: "medium",
        code: "stale-row",
        detail: `Last updated ${daysSince(activity.last_updated)} days ago.`
      });
    }
    if (activity.activity_type === "financing" && dealValue === null && !/undisclosed/i.test(activity.description || "")) {
      addFinding(findings, {
        ...base,
        severity: "medium",
        code: "missing-deal-value",
        detail: "Financing row has no disclosed value and is not marked undisclosed."
      });
    }
    if (activity.activity_type === "financing" && (!activity.counterparty || activity.counterparty === "N/A")) {
      addFinding(findings, {
        ...base,
        severity: "medium",
        code: "missing-investors",
        detail: "Financing row has no lead/key investor field."
      });
    }
    if (activity.activity_type === "financing" && activity.counterparty && activity.counterparty !== "N/A" && activityInvestorLinks && !linksByActivity.has(activity.id)) {
      addFinding(findings, {
        ...base,
        severity: "low",
        code: "not-investor-normalized",
        detail: "Financing row has counterparties but no normalized investor links yet."
      });
    }
    if (activity.activity_type === "financing" && dealValue !== null && dealValue >= HIGH_VALUE_THRESHOLD && refs.length < 2) {
      addFinding(findings, {
        ...base,
        severity: "low",
        code: "high-value-single-source",
        detail: "Large financing round has fewer than two public citations."
      });
    }
  }

  findings.sort((a, b) => severityPenalty(b.severity) - severityPenalty(a.severity) || String(b.dateAnnounced).localeCompare(String(a.dateAnnounced)));
  return findings;
}

function buildCompanyFindings(companies, activities) {
  const findings = [];
  const activityCount = {};
  for (const activity of activities) {
    inc(activityCount, activity.company_id);
  }

  for (const company of companies) {
    const count = activityCount[company.id] || 0;
    if (!company.website) {
      findings.push({
        companyId: company.id,
        company: company.name,
        severity: "low",
        code: "missing-website",
        detail: "Company profile has no website."
      });
    }
    if (count === 0) {
      findings.push({
        companyId: company.id,
        company: company.name,
        severity: "medium",
        code: "no-approved-activity",
        detail: "Company has no approved activity rows."
      });
    }
  }

  findings.sort((a, b) => severityPenalty(b.severity) - severityPenalty(a.severity) || a.company.localeCompare(b.company));
  return findings;
}

function qualityScore(rowFindings, companyFindings, totalRows) {
  const rawPenalty = rowFindings.reduce((sum, finding) => sum + severityPenalty(finding.severity), 0)
    + companyFindings.reduce((sum, finding) => sum + severityPenalty(finding.severity), 0);
  const scale = Math.max(totalRows, 20);
  const score = Math.max(0, Math.round(100 - (rawPenalty / scale) * 18));
  const status = score >= 88 ? "client_ready" : score >= 72 ? "needs_review" : "not_client_ready";
  return { score, status };
}

function summarize(activities, companies, rowFindings, companyFindings, investorsApplied) {
  const bySubsector = {};
  const byActivityType = {};
  const byConfidence = {};
  const issueCounts = {};
  let publicSourceBacked = 0;
  let disclosedFinancingRows = 0;
  let totalFinancingValue = 0;
  let financingRows = 0;

  for (const activity of activities) {
    inc(bySubsector, activity.subsector);
    inc(byActivityType, activity.activity_type);
    inc(byConfidence, activity.confidence);
    if (hasPublicSource(activity)) publicSourceBacked += 1;
    if (activity.activity_type === "financing") {
      financingRows += 1;
      const value = money(activity.deal_value_usd);
      if (value !== null) {
        disclosedFinancingRows += 1;
        totalFinancingValue += value;
      }
    }
  }

  for (const finding of [...rowFindings, ...companyFindings]) {
    inc(issueCounts, finding.code);
  }

  const missingCoreSubsectors = CORE_SUBSECTORS.filter((subsector) => !bySubsector[subsector]);

  return {
    companies: companies.length,
    approvedRows: activities.length,
    financingRows,
    disclosedFinancingRows,
    totalFinancingValueUsd: totalFinancingValue,
    publicSourceBacked,
    publicSourceBackedPct: pct(publicSourceBacked, activities.length),
    confirmedOrReportedPct: pct((byConfidence.confirmed || 0) + (byConfidence.reported || 0), activities.length),
    bySubsector,
    byActivityType,
    byConfidence,
    issueCounts,
    missingCoreSubsectors,
    investorNormalizationApplied: investorsApplied
  };
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
    return res.end(JSON.stringify({ ok: false, error: "Data quality API is not configured.", missingEnv: missing }));
  }

  let limit = 60;
  try {
    const url = new URL(req.url || "/api/data-quality", "https://ai-map-cyan.vercel.app");
    const parsedLimit = Number(url.searchParams.get("limit") || 60);
    limit = Number.isFinite(parsedLimit) ? Math.max(10, Math.min(parsedLimit, 250)) : 60;
  } catch {
    limit = 60;
  }

  try {
    const [companies, activitiesRead, activityInvestors] = await Promise.all([
      supabaseGet(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, "companies?select=id,name,subsector,geography,website,is_sample&is_sample=eq.false&order=name.asc"),
      readWithFallback(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
        "activities?select=id,date_announced,company_id,counterparty,activity_type,subsector,deal_value_usd,geography,description,source_url,source_reference,source_type,additional_sources,confidence,review_status,last_updated,is_sample&review_status=eq.approved&is_sample=eq.false&order=date_announced.desc&limit=2500",
        "activities?select=id,date_announced,company_id,counterparty,activity_type,subsector,deal_value_usd,geography,description,source_url,source_reference,source_type,confidence,review_status,last_updated,is_sample&review_status=eq.approved&is_sample=eq.false&order=date_announced.desc&limit=2500"
      ),
      optionalRead(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, "activity_investors?select=activity_id,investor_id,role&limit=5000")
    ]);

    if (!activitiesRead.ok) throw new Error(activitiesRead.error);
    const activities = activitiesRead.data || [];
    const companyById = new Map((companies || []).map((company) => [company.id, company.name]));
    const investorLinks = activityInvestors.ok ? activityInvestors.data : null;
    const rowFindings = buildRowFindings(activities || [], companyById, investorLinks);
    const companyFindings = buildCompanyFindings(companies || [], activities || []);
    const readiness = qualityScore(rowFindings, companyFindings, (activities || []).length);
    const summary = summarize(activities || [], companies || [], rowFindings, companyFindings, activityInvestors.ok);

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({
      ok: true,
      generatedAt: new Date().toISOString(),
      readiness,
      summary,
      rowFindings: rowFindings.slice(0, limit),
      companyFindings: companyFindings.slice(0, limit),
      warnings: [
        activitiesRead.warning,
        activityInvestors.ok ? null : `Investor normalization not readable: ${activityInvestors.error}`
      ].filter(Boolean)
    }));
  } catch (error) {
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: (error && error.message) || String(error) }));
  }
};
