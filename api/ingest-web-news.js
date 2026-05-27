// Reference implementation for the Physical AI public web-news ingestion
// Vercel function.
//
// COPY-TO: ai_map_repo/api/ingest-web-news.js
//
// GET /api/ingest-web-news
//   Used by Vercel Cron. If CRON_SECRET is set, Vercel sends
//   Authorization: Bearer $CRON_SECRET.
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

const SHARED_SECRET = process.env.INGEST_SHARED_SECRET || process.env.CRON_SECRET || "";

function boundedInt(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

const MAX_LOOKBACK_DAYS = boundedInt(process.env.INGEST_LOOKBACK_DAYS, 2, 1, 30);
const DEFAULT_TIME_BUDGET_MS = boundedInt(process.env.INGEST_TIME_BUDGET_MS, 45000, 10000, 240000);
const DEFAULT_MAX_ITEMS = boundedInt(process.env.INGEST_WEB_MAX_ITEMS, 18, 1, 80);
const MAX_DEFAULT_RESULTS = 4;
const GEMINI_MODEL = process.env.INGEST_LLM_MODEL || "gemini-2.5-flash";
const OPENAI_MODEL = process.env.OPENAI_TRIAGE_MODEL || "gpt-4.1-mini";
const ALLOWED_SUBSECTORS = ["robotics", "humanoids", "autonomous vehicles", "drones", "defense autonomy", "industrial automation", "embodied AI", "edge AI hardware", "other"];
const DEFAULT_QUERIES = [
  {
    name: "Physical AI funding",
    query: `"physical AI" (raises OR raised OR funding OR financing OR investment OR "seed round" OR "Series A" OR "Series B") when:${MAX_LOOKBACK_DAYS}d`
  },
  {
    name: "Robotics startup financing",
    query: `(robotics OR robot OR "robotics startup") (raises OR raised OR funding OR financing OR "seed round" OR "Series A" OR "Series B" OR "Series C") when:${MAX_LOOKBACK_DAYS}d`
  },
  {
    name: "Humanoid robotics funding",
    query: `(humanoid OR humanoids OR "humanoid robot" OR "humanoid robotics") (raises OR raised OR funding OR financing OR "Series A" OR "Series B" OR "Series C") when:${MAX_LOOKBACK_DAYS}d`
  },
  {
    name: "Autonomy drones defense funding",
    query: `(autonomous OR autonomy OR drone OR UAV OR "defense autonomy" OR "unmanned systems") (raises OR raised OR funding OR financing OR investment OR "Series A" OR "Series B") when:${MAX_LOOKBACK_DAYS}d`
  },
  {
    name: "Industrial automation funding",
    query: `("industrial automation" OR "warehouse robotics" OR "manufacturing automation" OR "factory automation" OR "construction robotics" OR "jobsite automation") (raises OR raised OR funding OR financing OR investment OR "Series A" OR "Series B") when:${MAX_LOOKBACK_DAYS}d`
  },
  {
    name: "Embodied AI funding",
    query: `("embodied AI" OR "robot foundation model" OR "robot foundation models" OR "robot learning") (raises OR raised OR funding OR financing OR investment OR "seed round" OR "Series A") when:${MAX_LOOKBACK_DAYS}d`
  },
  {
    name: "Physical-world sensing funding",
    query: `(sensor OR sensors OR RFID OR lidar OR perception OR "computer vision" OR "edge AI" OR "retail intelligence" OR inventory) (raises OR raised OR funding OR financing OR investment OR "Series A" OR "Series B" OR seed) when:${MAX_LOOKBACK_DAYS}d`
  },
  {
    name: "Maritime autonomy sensing funding",
    query: `(maritime OR vessel OR ship OR ocean OR "maritime autonomy" OR "ocean intelligence") (raises OR raised OR funding OR financing OR investment OR "Series A" OR "Series B" OR seed) when:${MAX_LOOKBACK_DAYS}d`
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
  /\blidar|sensor fusion|perception\b/i,
  /\brfid|inventory sensing|retail intelligence\b/i,
  /\bmaritime|vessel|ship|ocean|smartmast\b/i,
  /\bconstruction robotics|jobsite automation\b/i
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
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Ingest-Secret, Authorization");
  res.setHeader("Vary", "Origin");
}

function hasSharedSecret(req) {
  if (!SHARED_SECRET) return true;
  const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  return req.headers["x-ingest-secret"] === SHARED_SECRET || bearer === SHARED_SECRET;
}

function unauthorized(res, reason) {
  res.statusCode = 401;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify({ ok: false, error: reason }));
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

function stripHtml(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function htmlMeta(html, pattern) {
  const match = String(html || "").match(pattern);
  return decodeXml(match && match[1] ? match[1] : "");
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

function isoDateDaysAgo(now, daysAgo) {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function refreshWindow(now = new Date()) {
  const end = now.toISOString().slice(0, 10);
  return {
    maxLookbackDays: MAX_LOOKBACK_DAYS,
    startDate: isoDateDaysAgo(now, MAX_LOOKBACK_DAYS),
    endDate: end
  };
}

function isRecent(date, now = new Date()) {
  if (!validDate(date)) return false;
  const window = refreshWindow(now);
  return date >= window.startDate && date <= window.endDate;
}

function isFundingSignal(text, dealValueUsd) {
  const physicalScore = scoreRules(text, PHYSICAL_AI_RULES);
  const fundingScore = scoreRules(text, FUNDING_RULES);
  const negativeScore = scoreRules(text, NEGATIVE_RULES);
  return physicalScore >= 1 && fundingScore >= 1 && negativeScore === 0 && (dealValueUsd || /\bseries\s+[a-z]\b|\bseed round|pre-seed\b/i.test(text));
}

function llmEnabled(body) {
  return body.llm !== false && process.env.INGEST_LLM_ENABLED !== "false" && Boolean(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY);
}

function configuredModelLabel() {
  const labels = [];
  if (process.env.GEMINI_API_KEY) labels.push(`gemini:${GEMINI_MODEL}`);
  if (process.env.OPENAI_API_KEY) labels.push(`openai:${OPENAI_MODEL}`);
  return labels.join(",") || "disabled";
}

function normalizeAllowed(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function validDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

function boundedText(value, max) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function intelligenceScore(candidate, action, evidence, cautions) {
  let score = 52;
  if (action === "update_existing") score += 16;
  if (action === "new_activity") score += 10;
  if (action === "new_company") score += 4;
  if (candidate.source_url) score += 10;
  if (candidate.deal_value_usd !== null && candidate.deal_value_usd !== undefined) score += 10;
  if (candidate.candidate_counterparty && candidate.candidate_counterparty !== "N/A") score += 8;
  if (candidate.confidence === "reported") score += 6;
  score += Math.min(evidence.length, 4) * 3;
  score -= Math.min(cautions.length, 4) * 3;
  return Math.max(5, Math.min(98, Math.round(score)));
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = String(text || "").match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : null;
  }
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
  if (/\b(autonomous vehicle|self-driving|robotaxi|trucking|maritime autonomy|vessel autonomy)\b/i.test(text)) return "autonomous vehicles";
  if (/\b(drone|uav|aerial)\b/i.test(text)) return "drones";
  if (/\b(industrial|warehouse|factory|manufacturing|automation|construction|jobsite)\b/i.test(text)) return "industrial automation";
  if (/\b(embodied|manipulation|foundation model|physical ai)\b/i.test(text)) return "embodied AI";
  if (/\b(edge|chip|silicon|lidar|sensor|sensors|perception|rfid|inventory|retail intelligence|maritime|vessel|ship|ocean|smartmast)\b/i.test(text)) return "edge AI hardware";
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

async function fetchArticleSnapshot(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": "physical-ai-market-tracker/1.0" }
    });
    const contentType = response.headers.get("content-type") || "";
    const raw = await response.text();
    const canonical =
      htmlMeta(raw, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) ||
      htmlMeta(raw, /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i) ||
      response.url ||
      url;
    const title =
      htmlMeta(raw, /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
      htmlMeta(raw, /<title[^>]*>([\s\S]*?)<\/title>/i);
    const text = contentType.includes("text/html") ? stripHtml(raw) : raw.replace(/\s+/g, " ").trim();
    return {
      ok: response.ok,
      status: response.status,
      url: canonical,
      title,
      text: text.slice(0, 8000)
    };
  } catch (error) {
    return { ok: false, status: null, url, title: "", text: "", error: String(error) };
  } finally {
    clearTimeout(timer);
  }
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
      "activities?select=id,company_id,date_announced,counterparty,activity_type,deal_value_usd,description,source_url,review_status&is_sample=eq.false&order=date_announced.desc&limit=600"
    ),
    supabaseGet(
      supabaseUrl,
      serviceRoleKey,
      "review_queue_items?select=id,candidate_company,candidate_date,activity_type,deal_value_usd,source_url,status,description,duplicate_of_activity_id&limit=1000"
    )
  ]);
  const companyById = new Map((companies || []).map((company) => [company.id, company.name]));
  return { companies, activities, pending, companyById };
}

function sameDealValue(a, b) {
  if (a === null || a === undefined || b === null || b === undefined) return false;
  const left = Number(a);
  const right = Number(b);
  if (!Number.isFinite(left) || !Number.isFinite(right)) return false;
  return Math.abs(left - right) <= Math.max(1_000_000, Math.max(Math.abs(left), Math.abs(right)) * 0.01);
}

function activityUrls(activity) {
  const urls = [];
  if (activity.source_url) urls.push(normalizeUrl(activity.source_url));
  return urls;
}

function extractRoundLabel(text) {
  const value = String(text || "").toLowerCase();
  const series = value.match(/\bseries\s+([a-h])\b/i);
  if (series) return `series-${series[1].toLowerCase()}`;
  if (/\bpre[-\s]?seed\b/i.test(value)) return "pre-seed";
  if (/\bseed\b/i.test(value)) return "seed";
  if (/\bextension\b|\bextended\b/i.test(value)) return "extension";
  if (/\bipo\b|\blisted\b|\bpublic offering\b/i.test(value)) return "ipo";
  return "";
}

function tokenSet(text) {
  return new Set(normalize(text).split(" ").filter((token) => token.length > 2));
}

function tokenOverlap(a, b) {
  const left = tokenSet(a);
  const right = tokenSet(b);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / Math.min(left.size, right.size);
}

function hasNewFundingDetail(existing, candidate) {
  if ((candidate.deal_value_usd !== null && candidate.deal_value_usd !== undefined) && (existing.deal_value_usd === null || existing.deal_value_usd === undefined)) return true;
  if ((candidate.deal_value_usd !== null && candidate.deal_value_usd !== undefined) && !sameDealValue(existing.deal_value_usd, candidate.deal_value_usd)) return true;
  const incomingCounterparty = normalize(candidate.candidate_counterparty);
  const existingCounterparty = normalize(existing.counterparty);
  if (incomingCounterparty && incomingCounterparty !== "n a" && incomingCounterparty !== "undisclosed investors" && !existingCounterparty.includes(incomingCounterparty)) return true;
  return false;
}

function isSameFinancingRound(existing, candidate) {
  if (existing.activity_type !== candidate.activity_type) return false;
  if (daysBetween(existing.date_announced, candidate.candidate_date) > 180) return false;
  const candidateText = `${candidate.candidate_company} ${candidate.candidate_counterparty} ${candidate.description} ${candidate.snippet} ${candidate.extracted_text}`;
  const existingText = `${existing.counterparty || ""} ${existing.description || ""}`;
  const candidateRound = extractRoundLabel(candidateText);
  const existingRound = extractRoundLabel(existingText);
  if (candidateRound && existingRound && candidateRound !== existingRound) return false;
  if (sameDealValue(existing.deal_value_usd, candidate.deal_value_usd)) return true;
  if (candidateRound && existingRound && daysBetween(existing.date_announced, candidate.candidate_date) <= 90) return true;
  if (daysBetween(existing.date_announced, candidate.candidate_date) <= 21) return true;
  return tokenOverlap(candidateText, existingText) >= 0.35;
}

function findExistingActivity(candidate, context) {
  const candidateCompany = normalizeCompany(candidate.candidate_company);
  const candidateUrl = normalizeUrl(candidate.source_url);
  for (const activity of context.activities || []) {
    if (candidateUrl && activityUrls(activity).includes(candidateUrl)) return { activity, exact: true };
    const name = normalizeCompany(context.companyById.get(activity.company_id));
    if (!name || !(name === candidateCompany || name.includes(candidateCompany) || candidateCompany.includes(name))) continue;
    if (!isSameFinancingRound(activity, candidate)) continue;
    return { activity, exact: !hasNewFundingDetail(activity, candidate) };
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
    if (sameDealValue(item.deal_value_usd, candidate.deal_value_usd)) return true;
    const pendingText = `${item.description || ""} ${item.duplicate_of_activity_id || ""}`;
    const candidateText = `${candidate.description || ""} ${candidate.snippet || ""} ${candidate.extracted_text || ""}`;
    return extractRoundLabel(pendingText) && extractRoundLabel(pendingText) === extractRoundLabel(candidateText)
      ? true
      : tokenOverlap(pendingText, candidateText) >= 0.45;
  });
}

function candidateRunKey(candidate) {
  const candidateUrl = normalizeUrl(candidate.source_url);
  const company = normalizeCompany(candidate.candidate_company);
  const value = candidate.deal_value_usd === null || candidate.deal_value_usd === undefined ? "undisclosed" : String(Math.round(Number(candidate.deal_value_usd)));
  if (company && company !== "n a") return [
    company,
    candidate.candidate_date,
    candidate.activity_type,
    value
  ].join("|");
  if (candidateUrl) return `url:${candidateUrl}`;
  return ["unresolved", candidate.candidate_date, candidate.activity_type, value].join("|");
}

function gateCandidate(candidate, context) {
  const evidence = Array.isArray(candidate.intelligence_evidence) ? candidate.intelligence_evidence.join(" ") : "";
  const sourceText = candidate.llm_status === "enriched" ? "" : candidate.extracted_text || "";
  const text = `${candidate.candidate_company}. ${candidate.description}. ${candidate.snippet}. ${sourceText}. ${evidence}`;
  if (!isRecent(candidate.candidate_date)) return { keep: false, reason: "outside-lookback" };
  if (!candidate.candidate_company || candidate.candidate_company === "N/A") return { keep: false, reason: "company-unresolved" };
  if (!isFundingSignal(text, candidate.deal_value_usd)) return { keep: false, reason: "low-relevance" };
  if (pendingDuplicate(candidate, context)) return { keep: false, reason: "pending-duplicate" };
  const existing = findExistingActivity(candidate, context);
  if (existing?.exact) return { keep: false, reason: "approved-duplicate" };
  if (existing?.activity) return { keep: true, reason: "existing-activity-update", duplicateOfActivityId: existing.activity.id };
  return { keep: true, reason: "new-financing" };
}

function activityContext(activity, context) {
  if (!activity) return null;
  return {
    id: activity.id,
    company: context.companyById.get(activity.company_id) || activity.company_id,
    dateAnnounced: activity.date_announced,
    activityType: activity.activity_type,
    dealValueUsd: activity.deal_value_usd,
    sourceUrl: activity.source_url,
    description: activity.description
  };
}

function intelligencePrompt(candidate, gate, context) {
  const target = gate.duplicateOfActivityId
    ? activityContext((context.activities || []).find((activity) => activity.id === gate.duplicateOfActivityId), context)
    : null;
  const existingCompanies = (context.companies || []).map((company) => company.name).slice(0, 250);
  const window = refreshWindow();
  return `You are an investment-bank-grade Physical AI public-news triage engine.

Your job is to adjudicate ONE public RSS/news candidate before it enters a private analyst Review Queue.

Hard rules:
- Today's date for this run is ${window.endDate}. The valid ingestion window is ${window.startDate} through ${window.endDate}. Treat event dates inside that window as current, not future.
- Keep only Physical AI funding events from that valid ingestion window.
- Physical AI includes robotics, humanoids, autonomous vehicles, drones, defense autonomy, industrial automation, embodied AI, edge AI hardware, sensing/perception/autonomy infrastructure.
- Sensor, lidar, computer-vision, RFID, inventory-sensing, retail-intelligence, maritime-sensing, construction-automation, and edge-hardware companies should be kept when they enable physical-world automation.
- Reject stock news, earnings, opinion pieces, conference/newsletter promos, hiring, generic AI software, crypto, and non-funding stories.
- Never invent missing company names, investors, dates, or dollar values.
- If this is an update to an existing activity, return action "update_existing" and preserve the matching duplicateOfActivityId when appropriate.

Existing deterministic gate: ${JSON.stringify(gate)}
Existing matched activity, if any: ${JSON.stringify(target)}
Known companies: ${JSON.stringify(existingCompanies)}

Candidate:
${JSON.stringify({
  candidateCompany: candidate.candidate_company,
  candidateCounterparty: candidate.candidate_counterparty,
  candidateDate: candidate.candidate_date,
  activityType: candidate.activity_type,
  subsector: candidate.subsector,
  dealValueUsd: candidate.deal_value_usd,
  sourceUrl: candidate.source_url,
  title: candidate.subject,
  snippet: candidate.snippet,
  extractedText: candidate.extracted_text,
  description: candidate.description
})}

Return strict JSON only:
{
  "keep": true,
  "physicalAi": true,
  "fundingEvent": true,
  "action": "update_existing" | "new_activity" | "new_company",
  "duplicateOfActivityId": null | "existing activity id",
  "candidateCompany": "official company name or N/A",
  "candidateCounterparty": "lead/key investors if present, comma-separated, or N/A",
  "candidateDate": "YYYY-MM-DD",
  "activityType": "financing",
  "subsector": "one of ${ALLOWED_SUBSECTORS.join(" | ")}",
  "dealValueUsd": null,
  "geography": "country/region or N/A",
  "confidence": "reported" | "estimated",
  "description": "one factual source-backed sentence; mention undisclosed amount if relevant",
  "evidence": ["short factual evidence point", "short factual evidence point"],
  "cautions": ["what analyst should verify"],
  "rejectReason": null
}

If the candidate should not be staged, return:
{ "keep": false, "physicalAi": false, "fundingEvent": false, "rejectReason": "short reason", "evidence": [], "cautions": [] }`;
}

function buildAdjudicatedCandidate(parsed, candidate, context, modelLabel) {
  if (!parsed || typeof parsed !== "object") throw new Error(`${modelLabel} triage returned invalid JSON`);
  if (parsed.keep === false || parsed.physicalAi === false || parsed.fundingEvent === false) {
    const reason = boundedText(parsed.rejectReason || "rejected", 120);
    if (isRecent(candidate.candidate_date) && /\b(future|outside|date|window|lookback|recent)\b/i.test(reason)) {
      return { keep: true, candidate, status: "date-recheck" };
    }
    return { keep: false, reason: `llm-${boundedText(reason, 60)}` };
  }

  const next = { ...candidate };
  if (boundedText(parsed.candidateCompany, 140) && parsed.candidateCompany !== "N/A") next.candidate_company = boundedText(parsed.candidateCompany, 140);
  if (boundedText(parsed.candidateCounterparty, 240)) next.candidate_counterparty = boundedText(parsed.candidateCounterparty, 240);
  if (validDate(parsed.candidateDate) && isRecent(parsed.candidateDate)) next.candidate_date = parsed.candidateDate;
  next.activity_type = "financing";
  next.subsector = normalizeAllowed(parsed.subsector, ALLOWED_SUBSECTORS, next.subsector);
  if (typeof parsed.dealValueUsd === "number" && Number.isFinite(parsed.dealValueUsd) && parsed.dealValueUsd >= 0) {
    next.deal_value_usd = parsed.dealValueUsd;
  }
  if (boundedText(parsed.geography, 120)) next.geography = boundedText(parsed.geography, 120);
  next.confidence = normalizeAllowed(parsed.confidence, ["reported", "estimated"], next.confidence);
  if (boundedText(parsed.description, 500)) next.description = boundedText(parsed.description, 500);
  if (parsed.action === "update_existing" && parsed.duplicateOfActivityId) {
    const exists = (context.activities || []).some((activity) => activity.id === parsed.duplicateOfActivityId);
    if (exists) next.duplicate_of_activity_id = parsed.duplicateOfActivityId;
  }
  const evidence = Array.isArray(parsed.evidence) ? parsed.evidence.map((x) => boundedText(x, 160)).filter(Boolean).slice(0, 4) : [];
  const cautions = Array.isArray(parsed.cautions) ? parsed.cautions.map((x) => boundedText(x, 160)).filter(Boolean).slice(0, 4) : [];
  const action = ["update_existing", "new_activity", "new_company"].includes(parsed.action) ? parsed.action : (next.duplicate_of_activity_id ? "update_existing" : "new_activity");
  const triage = [`AI triage: ${action}; model=${modelLabel}.`];
  if (evidence.length) triage.push(`Evidence: ${evidence.join(" | ")}.`);
  if (cautions.length) triage.push(`Cautions: ${cautions.join(" | ")}.`);
  next.extracted_text = boundedText(`${triage.join(" ")} Source: ${candidate.extracted_text}`, 900);
  next.intelligence_action = action;
  next.intelligence_score = intelligenceScore(next, action, evidence, cautions);
  next.intelligence_evidence = evidence;
  next.intelligence_cautions = cautions;
  next.llm_model = modelLabel;
  next.llm_status = "enriched";
  return { keep: true, candidate: next, status: "enriched" };
}

async function adjudicateWithGemini(candidate, gate, context) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: intelligencePrompt(candidate, gate, context) }] }],
        generationConfig: {
          temperature: 0.05,
          maxOutputTokens: 1200,
          responseMimeType: "application/json"
        }
      })
    }
  );
  const data = await response.json();
  if (!response.ok) throw new Error(`Gemini triage failed (${response.status}): ${JSON.stringify(data).slice(0, 240)}`);
  const parsed = safeJson(data?.candidates?.[0]?.content?.parts?.[0]?.text || "");
  return buildAdjudicatedCandidate(parsed, candidate, context, `gemini:${GEMINI_MODEL}`);
}

function extractOpenAiText(data) {
  if (typeof data?.output_text === "string") return data.output_text;
  const parts = [];
  for (const item of data?.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") parts.push(content.text);
    }
  }
  return parts.join("\n");
}

async function adjudicateWithOpenAi(candidate, gate, context) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      input: intelligencePrompt(candidate, gate, context),
      temperature: 0.05,
      max_output_tokens: 1200,
      text: { format: { type: "json_object" } },
      store: false
    })
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`OpenAI triage failed (${response.status}): ${JSON.stringify(data).slice(0, 240)}`);
  const parsed = safeJson(extractOpenAiText(data));
  return buildAdjudicatedCandidate(parsed, candidate, context, `openai:${OPENAI_MODEL}`);
}

async function adjudicateWithLlm(candidate, gate, context) {
  const attempts = [];
  for (const provider of [adjudicateWithGemini, adjudicateWithOpenAi]) {
    try {
      const result = await provider(candidate, gate, context);
      if (result) return result;
    } catch (err) {
      attempts.push((err && err.message) || String(err));
    }
  }
  if (attempts.length > 0) throw new Error(attempts.join(" | "));
  return { keep: true, candidate, status: "disabled" };
}

function stripIntelligenceColumns(row) {
  const {
    intelligence_action,
    intelligence_score,
    intelligence_evidence,
    intelligence_cautions,
    llm_model,
    llm_status,
    ...rest
  } = row;
  return rest;
}

function buildCandidate(item, sourceName, article) {
  const text = `${item.title}. ${item.source}. ${article?.title || ""}. ${article?.text || ""}`;
  const dealValueUsd = parseMoneyToUsd(text);
  const company = inferCompany(text);
  const row = {
    id: `rq-web-${hash(normalizeUrl(article?.url || item.link) || item.title)}`,
    candidate_company: company,
    candidate_counterparty: inferCounterparty(text),
    candidate_date: item.pubDate,
    activity_type: "financing",
    subsector: inferSubsector(text),
    deal_value_usd: dealValueUsd,
    geography: "N/A",
    description: `Public web funding signal from ${sourceName}: ${item.title}`,
    source_type: "article",
    source_url: article?.url || item.link,
    gmail_message_id: null,
    sender: null,
    subject: item.title,
    received_date: item.pubDate,
    snippet: item.title,
    extracted_text: boundedText(`${item.title}${item.source ? ` — ${item.source}` : ""}${article?.text ? `. Article text: ${article.text}` : ""}`, 900),
    confidence: "reported",
    status: "pending",
    created_at: new Date().toISOString()
  };
  return row;
}

async function supabaseUpsertReviewQueue(supabaseUrl, serviceRoleKey, rows) {
  if (rows.length === 0) return 0;
  async function post(payload) {
    return fetch(`${supabaseUrl}/rest/v1/review_queue_items?on_conflict=id`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify(payload)
    });
  }
  let r = await post(rows);
  if (!r.ok) {
    const detail = await r.text();
    if (/intelligence_|llm_/i.test(detail)) {
      r = await post(rows.map(stripIntelligenceColumns));
      if (r.ok) return rows.length;
      throw new Error(`Supabase upsert fallback failed (${r.status}): ${(await r.text()).slice(0, 200)}`);
    }
    throw new Error(`Supabase upsert failed (${r.status}): ${detail.slice(0, 200)}`);
  }
  return rows.length;
}

async function supabasePostRun(supabaseUrl, serviceRoleKey, run) {
  return fetch(`${supabaseUrl}/rest/v1/ingestion_runs`, {
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

async function supabaseInsertRun(supabaseUrl, serviceRoleKey, run) {
  let r = await supabasePostRun(supabaseUrl, serviceRoleKey, run);
  if (!r.ok) {
    const detail = await r.text();
    if (/llm_/i.test(detail)) {
      const { llm_enriched_count, llm_rejected_count, llm_failed_count, ...legacyRun } = run;
      r = await supabasePostRun(supabaseUrl, serviceRoleKey, legacyRun);
    }
  }
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
  if (!hasSharedSecret(req)) {
    return unauthorized(res, "Missing or wrong X-Ingest-Secret header.");
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
  const maxResults = Math.min(Number(body.maxResults || process.env.INGEST_WEB_MAX || MAX_DEFAULT_RESULTS), 75);
  const maxItems = boundedInt(body.maxItems || process.env.INGEST_WEB_MAX_ITEMS, DEFAULT_MAX_ITEMS, 1, 100);
  const timeBudgetMs = boundedInt(body.timeBudgetMs || process.env.INGEST_TIME_BUDGET_MS, DEFAULT_TIME_BUDGET_MS, 10000, 300000);
  let sources = DEFAULT_QUERIES;
  if (process.env.INGEST_WEB_SOURCES) {
    try {
      const parsed = JSON.parse(process.env.INGEST_WEB_SOURCES);
      if (Array.isArray(parsed) && parsed.length > 0) sources = parsed;
    } catch {
      sources = DEFAULT_QUERIES;
    }
  }
  if (body.query) sources = [{ name: body.queryLabel || "ad-hoc web", query: body.query }];

  const startedAt = new Date().toISOString();
  const window = refreshWindow(new Date(startedAt));
  let totalCandidates = 0;
  let dedupedCount = 0;
  const skippedByReason = {};
  const perSource = [];
  let errorMessage = null;
  let runStatus = "completed";
  let stopReason = null;
  let processedItems = 0;
  const intelligence = { enabled: llmEnabled(body), model: configuredModelLabel(), enriched: 0, rejected: 0, failed: 0 };
  const actionCounts = {
    stagedNew: 0,
    stagedUpdates: 0,
    exactDuplicates: 0,
    pendingDuplicates: 0,
    runDuplicates: 0,
    deterministicRejected: 0,
    llmRejected: 0,
    llmFailed: 0
  };
  const runSeen = new Set();

  function recordSkip(reason, sourceStats, isLlmReject = false) {
    dedupedCount += 1;
    skippedByReason[reason] = (skippedByReason[reason] || 0) + 1;
    sourceStats.skippedByReason[reason] = (sourceStats.skippedByReason[reason] || 0) + 1;
    if (reason === "approved-duplicate") actionCounts.exactDuplicates += 1;
    else if (reason === "pending-duplicate") actionCounts.pendingDuplicates += 1;
    else if (reason === "run-duplicate") actionCounts.runDuplicates += 1;
    else actionCounts.deterministicRejected += isLlmReject ? 0 : 1;
    if (isLlmReject) actionCounts.llmRejected += 1;
  }

  function recordStage(candidate, sourceStats) {
    const isUpdate = Boolean(candidate.duplicate_of_activity_id || candidate.intelligence_action === "update_existing");
    if (isUpdate) {
      actionCounts.stagedUpdates += 1;
      sourceStats.stagedUpdates += 1;
    } else {
      actionCounts.stagedNew += 1;
      sourceStats.stagedNew += 1;
    }
  }

  try {
    const context = await loadDedupeContext(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const startedMs = Date.now();
    function budgetExceeded() {
      return Date.now() - startedMs > timeBudgetMs || processedItems >= maxItems;
    }
    for (const src of sources) {
      if (budgetExceeded()) {
        stopReason = processedItems >= maxItems ? "max-items" : "time-budget";
        runStatus = "partial";
        break;
      }
      const items = await googleNewsSearch(src.query, maxResults);
      const candidates = [];
      const sourceStats = { source: src.name, query: src.query, found: items.length, processed: 0, written: 0, skipped: 0, stagedNew: 0, stagedUpdates: 0, skippedByReason: {} };
      for (const item of items) {
        if (budgetExceeded()) {
          stopReason = processedItems >= maxItems ? "max-items" : "time-budget";
          runStatus = "partial";
          break;
        }
        processedItems += 1;
        sourceStats.processed += 1;
        const article = await fetchArticleSnapshot(item.link);
        const candidate = buildCandidate(item, src.name, article);
        let staged = candidate;
        if (intelligence.enabled) {
          try {
            const adjudicated = await adjudicateWithLlm(candidate, { keep: true, reason: "llm-first" }, context);
            if (!adjudicated.keep) {
              intelligence.rejected += 1;
              recordSkip(adjudicated.reason, sourceStats, true);
              continue;
            }
            staged = adjudicated.candidate;
            if (adjudicated.status === "enriched") intelligence.enriched += 1;
          } catch (llmError) {
            intelligence.failed += 1;
            actionCounts.llmFailed += 1;
            staged.extracted_text = boundedText(`AI triage failed; deterministic gate used. ${(llmError && llmError.message) || String(llmError)}. Source: ${staged.extracted_text}`, 900);
            staged.llm_model = configuredModelLabel();
            staged.llm_status = "failed";
          }
        }
        const gate = gateCandidate(staged, context);
        if (!gate.keep) {
          recordSkip(gate.reason, sourceStats);
          continue;
        }
        if (gate.duplicateOfActivityId) {
          staged.duplicate_of_activity_id = gate.duplicateOfActivityId;
          staged.description = `Suggested update to existing activity ${gate.duplicateOfActivityId}: ${staged.description}`;
        }
        const runKey = candidateRunKey(staged);
        if (runSeen.has(runKey)) {
          recordSkip("run-duplicate", sourceStats);
          continue;
        }
        runSeen.add(runKey);
        recordStage(staged, sourceStats);
        candidates.push(staged);
      }
      const written = await supabaseUpsertReviewQueue(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, candidates);
      totalCandidates += written;
      sourceStats.written = written;
      sourceStats.skipped = sourceStats.processed - written;
      perSource.push(sourceStats);
      if (stopReason) break;
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
    llm_enriched_count: intelligence.enriched,
    llm_rejected_count: intelligence.rejected,
    llm_failed_count: intelligence.failed,
    status: runStatus
  }).catch(() => undefined);

  res.statusCode = errorMessage ? res.statusCode : 200;
  res.setHeader("Content-Type", "application/json");
  return res.end(JSON.stringify({
    ok: !errorMessage,
    window,
    candidates: totalCandidates,
    deduped: dedupedCount,
    actionCounts,
    skippedByReason,
    intelligence,
    perSource,
    processedItems,
    stopReason: stopReason || undefined,
    error: errorMessage || undefined
  }));
};
