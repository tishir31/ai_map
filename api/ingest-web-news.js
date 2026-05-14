// Reference implementation for the Physical AI public web-news ingestion
// Vercel function.
//
// COPY-TO: ai_map_repo/api/ingest-web-news.js
//
// POST /api/ingest-web-news
//   Optional body: { query?: string, maxResults?: number, queryLabel?: string }
//
// Searches public news/RSS for recent Physical AI financing signals and writes
// only deduped candidates to Supabase `review_queue_items`. It never publishes
// directly to approved activities.

const ALLOWED_ORIGINS = new Set([
  "https://ai-map-cyan.vercel.app",
  "https://tishir31.github.io",
  "http://localhost:5173"
]);

const MAX_LOOKBACK_DAYS = 2;
const MAX_DEFAULT_RESULTS = 20;
const DEFAULT_QUERIES = [
  {
    name: "Physical AI public funding news",
    query: "(robotics OR humanoid OR autonomous OR drone OR \"physical AI\" OR \"embodied AI\" OR robot OR autonomy) (raises OR raised OR funding OR financing OR \"Series A\" OR \"Series B\" OR \"Series C\" OR \"seed round\") when:2d"
  }
];

const PHYSICAL_AI_RULES = [
  /\bphysical ai\b/i,
  /\bembodied ai\b/i,
  /\bhumanoid/i,
  /\brobot(ic|ics|s)?\b/i,
  /\bautonom(y|ous)\b/i,
  /\bself-driving\b/i,
  /\bdrone|uav|uas|unmanned\b/i,
  /\bindustrial automation\b/i,
  /\bwarehouse automation\b/i,
  /\bdefense autonomy\b/i,
  /\blidar|sensor fusion|perception\b/i
];

const FUNDING_RULES = [
  /\braises?|raised|raising\b/i,
  /\bfunding|financing|fundraise|investment\b/i,
  /\bseries\s+[a-z]\b/i,
  /\bseed round|pre-seed\b/i,
  /\bled by|backed by|participat(?:e|ed|ion)\b/i,
  /\bvaluation\b/i,
  /\bclosed? (?:a|an|its)?\s*(?:\$|series|seed|financing|funding)/i,
  /\bsecured? (?:\$|funding|financing|investment)/i
];

const NEGATIVE_RULES = [
  /\bstock\b|\bshare price\b|\bearnings\b|\banalyst rating\b/i,
  /\betf\b|\bmutual fund\b/i,
  /\bwebinar\b|\bpodcast\b|\bconference agenda\b/i,
  /\bjob opening\b|\bhiring\b/i
];

function setCors(req, res) {
  const origin = req.headers.origin || "";
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGINS.has(origin) ? origin : "https://ai-map-cyan.vercel.app");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
}

function normalize(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function normalizeCompany(value) {
  return normalize(value)
    .replace(/\b(inc|incorporated|corp|corporation|co|company|ltd|limited|llc|plc|technologies|technology|robotics|ai)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hash(value) {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = Math.imul(31, h) + value.charCodeAt(i) | 0;
  return Math.abs(h).toString(36);
}

function decodeXml(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseMoneyToUsd(text) {
  const m = String(text || "").match(/\$([0-9]+(?:\.[0-9]+)?)\s?(m|million|b|billion)?/i);
  if (!m) return null;
  const value = Number(m[1]);
  const unit = (m[2] || "").toLowerCase();
  if (unit === "b" || unit === "billion") return value * 1_000_000_000;
  if (unit === "m" || unit === "million") return value * 1_000_000;
  return value;
}

function scoreRules(text, rules) {
  return rules.reduce((sum, rule) => sum + (rule.test(text) ? 1 : 0), 0);
}

function daysBetween(a, b) {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return Infinity;
  return Math.abs(ta - tb) / 86_400_000;
}

function isRecent(date, now = new Date()) {
  return daysBetween(date, now.toISOString().slice(0, 10)) <= MAX_LOOKBACK_DAYS + 0.5;
}

function isFundingSignal(text, dealValueUsd) {
  const physicalScore = scoreRules(text, PHYSICAL_AI_RULES);
  const fundingScore = scoreRules(text, FUNDING_RULES);
  const negativeScore = scoreRules(text, NEGATIVE_RULES);
  return physicalScore >= 1 && fundingScore >= 1 && negativeScore === 0 && (dealValueUsd || /\bseries\s+[a-z]\b|\bseed round|pre-seed\b/i.test(text));
}

function inferCompany(title) {
  const text = String(title || "");
  const patterns = [
    /\b([A-Z][A-Za-z0-9&.'\-]*(?:\s+[A-Z0-9][A-Za-z0-9&.'\-]*){0,5})\s+(?:has\s+)?(?:raises?|raised|secures?|secured|closes?|closed|announces?|announced)\b/,
    /\b([A-Z][A-Za-z0-9&.'\-]*(?:\s+[A-Z0-9][A-Za-z0-9&.'\-]*){0,5}),?\s+(?:an?|the)?\s*(?:robotics|humanoid|autonomous|drone|industrial|embodied AI|physical AI)[^.!?]{0,120}\b(?:raises?|raised|secures?|closed)\b/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const candidate = match && match[1] ? match[1].trim().replace(/^(Today|This|The|A|An)\s+/i, "") : "";
    if (candidate && !/^(series|seed|funding|financing|robotics|humanoid|autonomous|today|this)$/i.test(candidate)) return candidate;
  }
  return "N/A";
}

function inferCounterparty(text) {
  const led = String(text || "").match(/\bled by\s+([A-Z][A-Za-z0-9&.,'\- ]{2,90})/);
  const from = String(text || "").match(/\bfrom\s+([A-Z][A-Za-z0-9&.,'\- ]{2,90})/);
  return ((led && led[1]) || (from && from[1]) || "N/A")
    .replace(/\s+(to|for|as|in order)\s.*$/, "")
    .replace(/[.;:].*$/, "")
    .trim();
}

function inferSubsector(text) {
  if (/\bhumanoid/i.test(text)) return "humanoids";
  if (/\b(defense|military|unmanned)\b/i.test(text)) return "defense autonomy";
  if (/\b(autonomous vehicle|self-driving|robotaxi|trucking)\b/i.test(text)) return "autonomous vehicles";
  if (/\b(drone|uav|aerial)\b/i.test(text)) return "drones";
  if (/\b(industrial|warehouse|factory|manufacturing|automation)\b/i.test(text)) return "industrial automation";
  if (/\b(embodied|manipulation|foundation model|physical ai)\b/i.test(text)) return "embodied AI";
  if (/\b(edge|chip|silicon|lidar|sensor|perception)\b/i.test(text)) return "edge AI hardware";
  return "robotics";
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.host.toLowerCase().replace(/^www\./, "")}${parsed.pathname.replace(/\/+$/, "")}`;
  } catch {
    return String(url || "").toLowerCase();
  }
}

function parseRss(xml, maxResults) {
  const items = [];
  for (const match of String(xml || "").matchAll(/<item\b[\s\S]*?<\/item>/gi)) {
    const raw = match[0];
    const title = decodeXml((raw.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]);
    const link = decodeXml((raw.match(/<link>([\s\S]*?)<\/link>/i) || [])[1]);
    const pubDateRaw = decodeXml((raw.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || [])[1]);
    const source = decodeXml((raw.match(/<source[^>]*>([\s\S]*?)<\/source>/i) || [])[1]);
    const pubDate = pubDateRaw ? new Date(pubDateRaw).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    if (title && link) items.push({ title, link, pubDate, source });
    if (items.length >= maxResults) break;
  }
  return items;
}

async function googleNewsSearch(query, maxResults) {
  const url = new URL("https://news.google.com/rss/search");
  url.searchParams.set("q", query);
  url.searchParams.set("hl", "en-US");
  url.searchParams.set("gl", "US");
  url.searchParams.set("ceid", "US:en");
  const r = await fetch(url.toString(), { headers: { "User-Agent": "physical-ai-tracker/1.0" } });
  if (!r.ok) throw new Error(`News RSS failed (${r.status})`);
  return parseRss(await r.text(), maxResults);
}

async function supabaseGet(supabaseUrl, serviceRoleKey, path) {
  const r = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`
    }
  });
  if (!r.ok) throw new Error(`Supabase read failed (${r.status}): ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

async function loadDedupeContext(supabaseUrl, serviceRoleKey) {
  const [companies, activities, pending] = await Promise.all([
    supabaseGet(supabaseUrl, serviceRoleKey, "companies?select=id,name&is_sample=eq.false"),
    supabaseGet(
      supabaseUrl,
      serviceRoleKey,
      "activities?select=id,company_id,date_announced,activity_type,deal_value_usd,description,source_url,review_status&is_sample=eq.false&order=date_announced.desc&limit=600"
    ),
    supabaseGet(
      supabaseUrl,
      serviceRoleKey,
      "review_queue_items?select=id,candidate_company,candidate_date,activity_type,deal_value_usd,source_url,status,description,duplicate_of_activity_id&status=eq.pending&limit=600"
    )
  ]);
  const companyById = new Map((companies || []).map((company) => [company.id, company.name]));
  return { activities, pending, companyById };
}

function sameDealValue(a, b) {
  if (a === null || a === undefined || b === null || b === undefined) return false;
  return Math.abs(Number(a) - Number(b)) < 1;
}

function activityUrls(activity) {
  const urls = [];
  if (activity.source_url) urls.push(normalizeUrl(activity.source_url));
  return urls;
}

function findExistingActivity(candidate, context) {
  const candidateCompany = normalizeCompany(candidate.candidate_company);
  const candidateUrl = normalizeUrl(candidate.source_url);
  for (const activity of context.activities || []) {
    if (candidateUrl && activityUrls(activity).includes(candidateUrl)) return { activity, exact: true };
    const name = normalizeCompany(context.companyById.get(activity.company_id));
    if (!name || !(name === candidateCompany || name.includes(candidateCompany) || candidateCompany.includes(name))) continue;
    if (activity.activity_type !== candidate.activity_type) continue;
    if (daysBetween(activity.date_announced, candidate.candidate_date) > 120) continue;
    return { activity, exact: sameDealValue(activity.deal_value_usd, candidate.deal_value_usd) };
  }
  return null;
}

function pendingDuplicate(candidate, context) {
  const candidateCompany = normalizeCompany(candidate.candidate_company);
  const candidateUrl = normalizeUrl(candidate.source_url);
  return (context.pending || []).some((item) => {
    if (candidateUrl && item.source_url && normalizeUrl(item.source_url) === candidateUrl) return true;
    if (item.activity_type !== candidate.activity_type) return false;
    if (normalizeCompany(item.candidate_company) !== candidateCompany) return false;
    if (daysBetween(item.candidate_date, candidate.candidate_date) > 14) return false;
    return sameDealValue(item.deal_value_usd, candidate.deal_value_usd);
  });
}

function gateCandidate(candidate, context) {
  const text = `${candidate.candidate_company}. ${candidate.description}. ${candidate.snippet}. ${candidate.extracted_text}`;
  if (!isRecent(candidate.candidate_date)) return { keep: false, reason: "outside-lookback" };
  if (!candidate.candidate_company || candidate.candidate_company === "N/A") return { keep: false, reason: "company-unresolved" };
  if (!isFundingSignal(text, candidate.deal_value_usd)) return { keep: false, reason: "low-relevance" };
  if (pendingDuplicate(candidate, context)) return { keep: false, reason: "pending-duplicate" };
  const existing = findExistingActivity(candidate, context);
  if (existing?.exact) return { keep: false, reason: "approved-duplicate" };
  if (existing?.activity) return { keep: true, reason: "existing-activity-update", duplicateOfActivityId: existing.activity.id };
  return { keep: true, reason: "new-financing" };
}

function buildCandidate(item, sourceName) {
  const text = `${item.title}. ${item.source}`;
  const dealValueUsd = parseMoneyToUsd(text);
  const company = inferCompany(text);
  const row = {
    id: `rq-web-${hash(normalizeUrl(item.link) || item.title)}`,
    candidate_company: company,
    candidate_counterparty: inferCounterparty(text),
    candidate_date: item.pubDate,
    activity_type: "financing",
    subsector: inferSubsector(text),
    deal_value_usd: dealValueUsd,
    geography: "N/A",
    description: `Public web funding signal from ${sourceName}: ${item.title}`,
    source_type: "article",
    source_url: item.link,
    gmail_message_id: null,
    sender: null,
    subject: item.title,
    received_date: item.pubDate,
    snippet: item.title,
    extracted_text: `${item.title}${item.source ? ` — ${item.source}` : ""}`,
    confidence: "reported",
    status: "pending",
    created_at: new Date().toISOString()
  };
  return row;
}

async function supabaseUpsertReviewQueue(supabaseUrl, serviceRoleKey, rows) {
  if (rows.length === 0) return 0;
  const r = await fetch(`${supabaseUrl}/rest/v1/review_queue_items?on_conflict=id`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body: JSON.stringify(rows)
  });
  if (!r.ok) throw new Error(`Supabase upsert failed (${r.status}): ${(await r.text()).slice(0, 200)}`);
  return rows.length;
}

async function supabaseInsertRun(supabaseUrl, serviceRoleKey, run) {
  await fetch(`${supabaseUrl}/rest/v1/ingestion_runs`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify(run)
  });
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
    return res.end(JSON.stringify({ ok: false, error: "Web ingestion is not configured.", missingEnv: missing }));
  }

  let body = {};
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  } catch {
    body = {};
  }
  const maxResults = Math.min(Number(body.maxResults || process.env.INGEST_WEB_MAX || MAX_DEFAULT_RESULTS), 50);
  const sources = body.query
    ? [{ name: body.queryLabel || "ad-hoc web", query: body.query }]
    : (process.env.INGEST_WEB_SOURCES ? JSON.parse(process.env.INGEST_WEB_SOURCES) : DEFAULT_QUERIES);

  const startedAt = new Date().toISOString();
  let totalCandidates = 0;
  let dedupedCount = 0;
  const skippedByReason = {};
  const perSource = [];
  let errorMessage = null;
  let runStatus = "completed";

  try {
    const context = await loadDedupeContext(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    for (const src of sources) {
      const items = await googleNewsSearch(src.query, maxResults);
      const candidates = [];
      for (const item of items) {
        const candidate = buildCandidate(item, src.name);
        const gate = gateCandidate(candidate, context);
        if (!gate.keep) {
          dedupedCount += 1;
          skippedByReason[gate.reason] = (skippedByReason[gate.reason] || 0) + 1;
          continue;
        }
        if (gate.duplicateOfActivityId) {
          candidate.duplicate_of_activity_id = gate.duplicateOfActivityId;
          candidate.description = `Suggested update to existing activity ${gate.duplicateOfActivityId}: ${candidate.description}`;
        }
        candidates.push(candidate);
      }
      const written = await supabaseUpsertReviewQueue(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, candidates);
      totalCandidates += written;
      perSource.push({ source: src.name, query: src.query, found: items.length, written, skipped: items.length - written });
    }
  } catch (err) {
    runStatus = "failed";
    errorMessage = (err && err.message) || String(err);
    res.statusCode = 502;
  }

  await supabaseInsertRun(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    id: `run-web-${Date.now().toString(36)}`,
    source_name: "Public web news",
    source_type: "rss",
    query: sources.map((s) => s.query).join(" | "),
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    candidates_found: totalCandidates,
    deduped_count: dedupedCount,
    status: runStatus
  }).catch(() => undefined);

  res.statusCode = errorMessage ? res.statusCode : 200;
  res.setHeader("Content-Type", "application/json");
  return res.end(JSON.stringify({
    ok: !errorMessage,
    candidates: totalCandidates,
    deduped: dedupedCount,
    skippedByReason,
    perSource,
    error: errorMessage || undefined
  }));
};
