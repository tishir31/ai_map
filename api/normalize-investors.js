// Reference implementation for persistent VC / investor normalization.
//
// COPY-TO: ai_map_repo/api/normalize-investors.js
//
// POST /api/normalize-investors
//   Optional body: { dryRun?: boolean, limit?: number }
//
// Reads approved, non-sample financing activities from Supabase, parses the
// investor syndicate, and materializes `investors` + `activity_investors`.
// Apply docs/supabase-vc-investor-normalization-migration.sql before enabling
// scheduled writes. Dry runs work before the migration because they only read
// the existing public market tables.

const ALLOWED_ORIGINS = new Set([
  "https://ai-map-cyan.vercel.app",
  "https://tishir31.github.io",
  "http://localhost:5173"
]);

const NOISE_TOKENS = [
  /^n\/a$/i,
  /^undisclosed/i,
  /^other investors$/i,
  /^others$/i,
  /^series [a-z] investors$/i,
  /\binvestors\b/i
];
const FULL_COUNTERPARTY_NOISE = NOISE_TOKENS.filter((rx) => rx.source !== "\\binvestors\\b");

const ALIASES = new Map([
  ["a16z", "Andreessen Horowitz"],
  ["andreessen horowitz", "Andreessen Horowitz"],
  ["andreessen horowitz and others", "Andreessen Horowitz"],
  ["google ventures", "GV"],
  ["google", "Google"],
  ["nvidia", "NVIDIA"],
  ["softbank group", "SoftBank"],
  ["openai startup fund", "OpenAI Startup Fund"]
]);

const FINANCIAL_INVESTOR_HINTS = [
  "capital",
  "ventures",
  "venture",
  "fund",
  "partners",
  "growth",
  "equity",
  "management",
  "holdings",
  "asset",
  "investment",
  "invest",
  "vc"
];

const FINANCIAL_INVESTOR_NAMES = new Set([
  "8vc",
  "accel",
  "advent",
  "andreessen horowitz",
  "atreides management",
  "b capital",
  "blackrock",
  "blackstone",
  "coatue",
  "fidelity",
  "founders fund",
  "general catalyst",
  "gv",
  "khosla ventures",
  "kleiner perkins",
  "lightspeed",
  "openai startup fund",
  "qia",
  "sequoia capital",
  "softbank",
  "thrive capital",
  "tiger global"
]);

const INDIVIDUAL_INVESTOR_NAMES = new Set(["eric schmidt", "jeff bezos"]);
const STRATEGIC_INVESTOR_NAMES = new Set([
  "amazon",
  "bmw",
  "google",
  "john deere",
  "lockheed martin",
  "mercedes-benz",
  "microsoft",
  "nvidia",
  "samsung next",
  "stellantis",
  "uber"
]);

function setCors(req, res) {
  const origin = req.headers.origin || "";
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGINS.has(origin) ? origin : "https://ai-map-cyan.vercel.app");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
}

function slug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}

function canonicalInvestorName(value) {
  const trimmed = String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\s+(and\s+)?others?$/i, "")
    .replace(/\s+and\s+other investors$/i, "")
    .trim();
  return ALIASES.get(trimmed.toLowerCase()) || trimmed;
}

function normalizeForCompare(value) {
  return canonicalInvestorName(value).toLowerCase();
}

function parseInvestorNames(counterparty) {
  if (!counterparty || FULL_COUNTERPARTY_NOISE.some((rx) => rx.test(counterparty.trim()))) return [];
  const normalized = String(counterparty)
    .replace(/\b(?:co-?led|led)\s+by\s+/gi, "")
    .replace(/\bwith\s+participation\s+from\s+/gi, ", ")
    .replace(/\bparticipation\s+from\s+/gi, ", ")
    .replace(/\bincluding\s+/gi, ", ")
    .replace(/\s*\/\s*/g, ", ")
    .replace(/\s*,?\s+and\s+others?\b/gi, "")
    .replace(/\s+and\s+other investors\b/gi, "")
    .replace(/\s+and\s+Series [A-Z] investors\b/g, "");

  const names = normalized
    .split(/,\s*|\s+and\s+/i)
    .map(canonicalInvestorName)
    .filter((name) => name && !NOISE_TOKENS.some((rx) => rx.test(name)));

  return Array.from(new Set(names));
}

function classifyInvestorKind(name, companyNames) {
  const normalized = normalizeForCompare(name);
  if (INDIVIDUAL_INVESTOR_NAMES.has(normalized)) return "individual";
  if (FINANCIAL_INVESTOR_NAMES.has(normalized) || FINANCIAL_INVESTOR_HINTS.some((hint) => normalized.includes(hint))) return "financial";
  if (STRATEGIC_INVESTOR_NAMES.has(normalized) || companyNames.has(normalized)) return "strategic";
  return "other";
}

function extractLeadInvestors(activity, investors) {
  const text = `${activity.description || ""} ${activity.counterparty || ""}`;
  const matches = [
    ...text.matchAll(/\b(?:co-?led|led)\s+by\s+(.+?)(?=\s+to\b|\s+for\b|\s+with\b|[.;]|$)/gi),
    ...text.matchAll(/\b(?:lead|key)\s+investors?\s+(?:included|include|were)\s+([^.;]+)/gi)
  ];
  const investorSet = new Set(investors.map(normalizeForCompare));
  const leads = new Set();
  for (const match of matches) {
    const raw = match[1] || "";
    for (const name of parseInvestorNames(raw)) {
      if (investorSet.has(normalizeForCompare(name))) leads.add(name);
    }
  }
  return Array.from(leads);
}

function buildRows(activities, companies) {
  const companyNames = new Set(companies.map((company) => normalizeForCompare(company.name)));
  const investorById = new Map();
  const activityInvestorByKey = new Map();
  let parsedActivities = 0;
  for (const activity of activities) {
    const investorNames = parseInvestorNames(activity.counterparty);
    if (investorNames.length === 0) continue;
    parsedActivities += 1;
    const leadNames = extractLeadInvestors(activity, investorNames);
    const leadSet = new Set(leadNames.map(normalizeForCompare));
    for (const investorName of investorNames) {
      const id = `inv-${slug(canonicalInvestorName(investorName))}`;
      const kind = classifyInvestorKind(investorName, companyNames);
      investorById.set(id, {
        id,
        name: canonicalInvestorName(investorName),
        normalized_name: normalizeForCompare(investorName),
        kind,
        updated_at: new Date().toISOString()
      });
      activityInvestorByKey.set(`${activity.id}:${id}`, {
        activity_id: activity.id,
        investor_id: id,
        role: leadSet.has(normalizeForCompare(investorName)) ? "lead" : "participant",
        source_text: activity.counterparty,
        confidence: "parsed",
        updated_at: new Date().toISOString()
      });
    }
  }
  return {
    parsedActivities,
    investors: Array.from(investorById.values()),
    activityInvestors: Array.from(activityInvestorByKey.values())
  };
}

async function supabaseGet(supabaseUrl, serviceRoleKey, path) {
  const r = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`
    }
  });
  if (!r.ok) throw new Error(`Supabase read failed (${r.status}): ${(await r.text()).slice(0, 240)}`);
  return r.json();
}

async function supabaseUpsert(supabaseUrl, serviceRoleKey, table, rows) {
  if (rows.length === 0) return 0;
  const r = await fetch(`${supabaseUrl}/rest/v1/${table}?on_conflict=${table === "investors" ? "id" : "activity_id,investor_id"}`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify(rows)
  });
  if (!r.ok) {
    const detail = await r.text();
    if (/does not exist|schema cache|relation/i.test(detail)) {
      const error = new Error(`Investor normalization migration not applied: ${detail.slice(0, 200)}`);
      error.code = "missing_migration";
      throw error;
    }
    throw new Error(`Supabase upsert ${table} failed (${r.status}): ${detail.slice(0, 240)}`);
  }
  return rows.length;
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: "POST only" }));
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const missing = [];
  if (!SUPABASE_URL) missing.push("SUPABASE_URL");
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (missing.length > 0) {
    res.statusCode = 503;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: "Investor normalization is not configured.", missingEnv: missing }));
  }

  let body = {};
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  } catch {
    body = {};
  }
  const dryRun = body.dryRun === true;
  const limit = Math.min(Number(body.limit || process.env.NORMALIZE_INVESTORS_LIMIT || 1000), 2500);
  try {
    const [activities, companies] = await Promise.all([
      supabaseGet(
        SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY,
        `activities?select=id,counterparty,description,activity_type,review_status,is_sample&activity_type=eq.financing&review_status=eq.approved&is_sample=eq.false&limit=${limit}`
      ),
      supabaseGet(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, "companies?select=id,name&is_sample=eq.false&limit=3000")
    ]);
    const rows = buildRows(activities, companies);
    if (!dryRun) {
      await supabaseUpsert(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, "investors", rows.investors);
      await supabaseUpsert(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, "activity_investors", rows.activityInvestors);
    }
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({
      ok: true,
      dryRun,
      scannedActivities: activities.length,
      parsedActivities: rows.parsedActivities,
      investors: rows.investors.length,
      activityInvestors: rows.activityInvestors.length
    }));
  } catch (error) {
    res.statusCode = error && error.code === "missing_migration" ? 503 : 502;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({
      ok: false,
      error: (error && error.message) || String(error),
      migration: "docs/supabase-vc-investor-normalization-migration.sql"
    }));
  }
};
