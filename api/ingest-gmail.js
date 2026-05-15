// Reference implementation for the R15 Gmail-ingestion Vercel function.
//
// COPY-TO: ai_map_repo/api/ingest-gmail.js
//
// This file lives in the source repo as a reference because the deploy
// repo (`ai_map`) is owned by a separate deploy flow. To activate:
//
//   1. cp docs/ingest-gmail.example.js /path/to/ai_map_repo/api/ingest-gmail.js
//   2. Provision the Vercel env vars listed in docs/R15-gmail-ingestion.md.
//   3. cd /path/to/ai_map_repo && git add api/ingest-gmail.js && git commit
//      && git push origin main (Vercel redeploys automatically).
//   4. Validate manually via the curl example in R15 docs before scheduling
//      the daily cron in vercel.json.
//
// POST /api/ingest-gmail
//   Optional body: { query?: string, maxResults?: number, queryLabel?: string }
//
// Sweeps a configured Gmail mailbox for Physical AI signals (financings,
// M&A, partnerships) and writes a structured Review Queue candidate to
// Supabase `review_queue_items` for analyst approval. NEVER publishes
// directly to `activities` — the Review Queue is the only path into the
// shared dataset (PROJECT_SPEC §5).
//
// Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GMAIL_CLIENT_ID,
// GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, GMAIL_USER_EMAIL.
// Optional: INGEST_SOURCES, INGEST_MAX, INGEST_SHARED_SECRET,
// INGEST_LLM_ENABLED=false, INGEST_LLM_MODEL, GEMINI_API_KEY.

const SHARED_SECRET = process.env.INGEST_SHARED_SECRET || process.env.CRON_SECRET || "";
const ALLOWED_ORIGINS = new Set([
  "https://ai-map-cyan.vercel.app",
  "https://tishir31.github.io",
  "http://localhost:5173"
]);

const DEFAULT_QUERIES = [
  {
    name: "Physical AI recent fundraises",
    query: "newer_than:2d (robotics OR humanoid OR autonomous OR drone OR \"physical AI\" OR \"embodied AI\" OR robot OR autonomy) (raises OR raised OR funding OR financing OR \"Series A\" OR \"Series B\" OR \"Series C\" OR \"seed round\")"
  }
];
const MAX_LOOKBACK_DAYS = 2;
const MAX_DEFAULT_RESULTS = 20;
const INTELLIGENCE_MODEL = process.env.INGEST_LLM_MODEL || "gemini-2.5-flash";
const ALLOWED_SUBSECTORS = ["robotics", "humanoids", "autonomous vehicles", "drones", "defense autonomy", "industrial automation", "embodied AI", "edge AI hardware", "other"];

const ACTIVITY_RULES = [
  ["financing", /\b(raises?|series\s+[a-z]|seed|funding|financing|investment)\b/i],
  ["m&a", /\b(acquires?|acquisition|merger|bought)\b/i],
  ["partnership", /\b(partners?|partnership|alliance|collaboration)\b/i],
  ["customer contract", /\b(contract|selected|customer|award|deployment)\b/i],
  ["product launch", /\b(launch|released|introduced|unveiled)\b/i],
  ["infrastructure", /\b(infrastructure|platform|facility|manufacturing expansion)\b/i]
];

const SUBSECTOR_RULES = [
  ["humanoids", /\bhumanoid/i],
  ["defense autonomy", /\b(defense|military|resilient autonomy|autonomy)\b/i],
  ["autonomous vehicles", /\b(autonomous vehicle|yard tractor|self-driving|port autonomy)\b/i],
  ["drones", /\b(drone|uav|aerial)\b/i],
  ["industrial automation", /\b(industrial|factory|welding|inspection|automation)\b/i],
  ["embodied AI", /\b(embodied|manipulation|foundation model)\b/i],
  ["edge AI hardware", /\b(edge|chip|silicon|inference module|hardware)\b/i],
  ["robotics", /\brobot/i]
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
  /\bcomputer vision\b/i,
  /\blidar|sensor fusion|perception\b/i,
  /\bmanipulation\b/i
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

function parseMoneyToUsd(text) {
  const m = String(text || "").match(/\$([0-9]+(?:\.[0-9]+)?)\s?(m|million|b|billion)?/i);
  if (!m) return null;
  const value = Number(m[1]);
  const unit = (m[2] || "").toLowerCase();
  if (unit === "b" || unit === "billion") return value * 1_000_000_000;
  if (unit === "m" || unit === "million") return value * 1_000_000;
  return value;
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

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.host.toLowerCase().replace(/^www\./, "")}${parsed.pathname.replace(/\/+$/, "")}`;
  } catch {
    return String(url || "").toLowerCase();
  }
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

function scoreRules(text, rules) {
  return rules.reduce((sum, rule) => sum + (rule.test(text) ? 1 : 0), 0);
}

function isFundingSignal(text, dealValueUsd) {
  const physicalScore = scoreRules(text, PHYSICAL_AI_RULES);
  const fundingScore = scoreRules(text, FUNDING_RULES);
  const negativeScore = scoreRules(text, NEGATIVE_RULES);
  return physicalScore >= 1 && fundingScore >= 1 && negativeScore === 0 && (dealValueUsd || /\bseries\s+[a-z]\b|\bseed round|pre-seed\b/i.test(text));
}

function llmEnabled(body) {
  return body.llm !== false && process.env.INGEST_LLM_ENABLED !== "false" && Boolean(process.env.GEMINI_API_KEY);
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
  let score = 48;
  if (action === "update_existing") score += 16;
  if (action === "new_activity") score += 10;
  if (action === "new_company") score += 4;
  if (candidate.deal_value_usd !== null && candidate.deal_value_usd !== undefined) score += 10;
  if (candidate.candidate_counterparty && candidate.candidate_counterparty !== "N/A") score += 8;
  if (candidate.confidence === "reported") score += 6;
  if (candidate.source_type === "Gmail" && !candidate.source_url) score -= 10;
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

function decodeBase64Url(data) {
  if (!data) return "";
  try {
    return Buffer.from(String(data).replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  } catch {
    return "";
  }
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function collectPayloadText(payload, out = []) {
  if (!payload) return out;
  const mimeType = String(payload.mimeType || "");
  const bodyText = decodeBase64Url(payload.body && payload.body.data);
  if (bodyText && /text\/(plain|html)/i.test(mimeType)) out.push(stripHtml(bodyText));
  for (const part of payload.parts || []) collectPayloadText(part, out);
  return out;
}

function bestFundingExcerpt(text) {
  const sentences = String(text || "").split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  const ranked = sentences
    .map((sentence) => ({
      sentence,
      score: scoreRules(sentence, PHYSICAL_AI_RULES) * 2 + scoreRules(sentence, FUNDING_RULES) * 3 + (parseMoneyToUsd(sentence) ? 4 : 0)
    }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0]?.sentence || String(text || "");
  return best.slice(0, 700);
}

function inferActivityType(text) {
  for (const [type, rx] of ACTIVITY_RULES) if (rx.test(text)) return type;
  return "other";
}
function inferSubsector(text) {
  for (const [s, rx] of SUBSECTOR_RULES) if (rx.test(text)) return s;
  return "other";
}

function inferCompany(subject, body) {
  const text = `${subject}. ${body}`;
  const patterns = [
    /\b([A-Z][A-Za-z0-9&.'\-]*(?:\s+[A-Z0-9][A-Za-z0-9&.'\-]*){0,5})\s+(?:has\s+)?(?:raises?|raised|secures?|secured|closes?|closed|announces?|announced)\b/,
    /\b([A-Z][A-Za-z0-9&.'\-]*(?:\s+[A-Z0-9][A-Za-z0-9&.'\-]*){0,5}),?\s+(?:an?|the)?\s*(?:robotics|humanoid|autonomous|drone|industrial|embodied AI|physical AI)[^.!?]{0,120}\b(?:raises?|raised|secures?|closed)\b/i,
    /(?:funding|financing|investment)\s+(?:for|in)\s+([A-Z][A-Za-z0-9&.'\-]*(?:\s+[A-Z0-9][A-Za-z0-9&.'\-]*){0,5})\b/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const candidate = match && match[1] ? match[1].trim().replace(/^(Today|This|The|A|An)\s+/i, "") : "";
    if (candidate && !/^(series|seed|funding|financing|robotics|humanoid|autonomous|today|this)$/i.test(candidate)) return candidate;
  }
  return "N/A";
}

function inferCounterparty(body) {
  const text = String(body || "");
  const led = text.match(/\bled by\s+([A-Z][A-Za-z0-9&.,'\- ]{2,90})/);
  const from = text.match(/\bfrom\s+([A-Z][A-Za-z0-9&.,'\- ]{2,90})/);
  const backed = text.match(/\bbacked by\s+([A-Z][A-Za-z0-9&.,'\- ]{2,90})/);
  const withParticipation = text.match(/\bparticipation from\s+([A-Z][A-Za-z0-9&.,'\- ]{2,90})/);
  return ((led && led[1]) || (from && from[1]) || (backed && backed[1]) || (withParticipation && withParticipation[1]) || "N/A")
    .replace(/\s+(to|for|as|in order)\s.*$/, "")
    .replace(/[.;:].*$/, "")
    .trim();
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

function setCors(req, res) {
  const origin = req.headers.origin || "";
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGINS.has(origin) ? origin : "https://ai-map-cyan.vercel.app");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Ingest-Secret, Authorization");
  res.setHeader("Vary", "Origin");
}

function missingConfig(res, missing) {
  res.statusCode = 503;
  res.setHeader("Content-Type", "application/json");
  res.end(
    JSON.stringify({
      ok: false,
      error: "Gmail ingestion is not configured.",
      missingEnv: missing,
      docs: "See docs/R15-gmail-ingestion.md in the source repo."
    })
  );
}

async function getGmailAccessToken() {
  const params = new URLSearchParams({
    client_id: process.env.GMAIL_CLIENT_ID,
    client_secret: process.env.GMAIL_CLIENT_SECRET,
    refresh_token: process.env.GMAIL_REFRESH_TOKEN,
    grant_type: "refresh_token"
  });
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString()
  });
  if (!r.ok) {
    const detail = await r.text();
    throw new Error(`Gmail token exchange failed (${r.status}): ${detail.slice(0, 200)}`);
  }
  const j = await r.json();
  return j.access_token;
}

async function gmailList(accessToken, query, maxResults) {
  const url = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
  url.searchParams.set("q", query);
  url.searchParams.set("maxResults", String(maxResults));
  const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) {
    const detail = await r.text();
    throw new Error(`Gmail list failed (${r.status}): ${detail.slice(0, 300)}`);
  }
  const j = await r.json();
  return j.messages || [];
}

async function gmailGet(accessToken, messageId) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=full`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) {
    const detail = await r.text();
    throw new Error(`Gmail get failed (${r.status}): ${detail.slice(0, 300)}`);
  }
  return r.json();
}

function headersToMap(headers) {
  const out = {};
  for (const h of headers || []) out[String(h.name || "").toLowerCase()] = h.value || "";
  return out;
}

function buildCandidate(message, sourceName) {
  const headers = headersToMap(message.payload && message.payload.headers);
  const subject = headers.subject || "";
  const sender = headers.from || "";
  const receivedDate = headers.date
    ? new Date(headers.date).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const snippet = String(message.snippet || "");
  const bodyText = collectPayloadText(message.payload).join(" ").slice(0, 8000);
  const text = `${subject}. ${snippet}. ${bodyText}`;
  const activityType = inferActivityType(text);
  const subsector = inferSubsector(text);
  const excerpt = bestFundingExcerpt(text);
  const candidateCompany = inferCompany(subject, excerpt);
  const candidateCounterparty = inferCounterparty(excerpt);
  const dealValueUsd = parseMoneyToUsd(text);
  return {
    id: `rq-gmail-${message.id}`,
    candidate_company: candidateCompany,
    candidate_counterparty: candidateCounterparty,
    candidate_date: receivedDate,
    activity_type: activityType,
    subsector,
    deal_value_usd: dealValueUsd,
    geography: "N/A",
    description: `Gmail funding signal from ${sourceName}: ${candidateCompany} ${activityType}${dealValueUsd ? ` (${Math.round(dealValueUsd / 1_000_000)}M disclosed)` : ""}. Review before approving or merging.`,
    source_type: "Gmail",
    source_url: null,
    gmail_message_id: message.id,
    sender,
    subject,
    received_date: receivedDate,
    snippet,
    extracted_text: excerpt,
    confidence: "reported",
    status: "pending",
    created_at: new Date().toISOString()
  };
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

async function supabaseGet(supabaseUrl, serviceRoleKey, path) {
  const r = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`
    }
  });
  if (!r.ok) {
    const detail = await r.text();
    throw new Error(`Supabase read failed (${r.status}): ${detail.slice(0, 200)}`);
  }
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
      "review_queue_items?select=id,candidate_company,candidate_date,activity_type,deal_value_usd,gmail_message_id,status,description,duplicate_of_activity_id&status=eq.pending&limit=600"
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

function activityUrls(activity) {
  const urls = [];
  if (activity.source_url) urls.push(normalizeUrl(activity.source_url));
  return urls;
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
  if (!candidateCompany) return null;
  let companyMatched = null;
  for (const [companyId, name] of context.companyById.entries()) {
    const existing = normalizeCompany(name);
    if (existing && (existing === candidateCompany || existing.includes(candidateCompany) || candidateCompany.includes(existing))) {
      companyMatched = companyId;
      break;
    }
  }
  if (!companyMatched) return null;
  const activity = (context.activities || []).find((activity) => {
    if (candidateUrl && activityUrls(activity).includes(candidateUrl)) return true;
    if (activity.company_id !== companyMatched) return false;
    return isSameFinancingRound(activity, candidate);
  }) || null;
  if (!activity) return null;
  return {
    activity,
    exact: !hasNewFundingDetail(activity, candidate)
  };
}

function pendingDuplicate(candidate, context) {
  const candidateCompany = normalizeCompany(candidate.candidate_company);
  return (context.pending || []).some((item) => {
    if (candidate.gmail_message_id && item.gmail_message_id === candidate.gmail_message_id) return true;
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
  if (candidate.gmail_message_id) return `gmail:${candidate.gmail_message_id}`;
  return [
    normalizeCompany(candidate.candidate_company),
    candidate.candidate_date,
    candidate.activity_type,
    candidate.deal_value_usd === null || candidate.deal_value_usd === undefined ? "undisclosed" : String(Math.round(Number(candidate.deal_value_usd)))
  ].join("|");
}

function gateCandidate(candidate, context) {
  const text = `${candidate.subject || ""}. ${candidate.snippet || ""}. ${candidate.extracted_text || ""}. ${candidate.description || ""}`;
  if (!isRecent(candidate.candidate_date)) return { keep: false, reason: "outside-lookback" };
  if (candidate.activity_type !== "financing") return { keep: false, reason: "not-financing" };
  if (!candidate.candidate_company || candidate.candidate_company === "N/A") return { keep: false, reason: "company-unresolved" };
  if (!isFundingSignal(text, candidate.deal_value_usd)) return { keep: false, reason: "low-relevance" };
  if (pendingDuplicate(candidate, context)) return { keep: false, reason: "pending-duplicate" };

  const existing = findExistingActivity(candidate, context);
  if (existing) {
    if (existing.exact) return { keep: false, reason: "approved-duplicate" };
    return {
      keep: true,
      reason: "existing-activity-update",
      duplicateOfActivityId: existing.activity.id
    };
  }
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
    description: activity.description
  };
}

function intelligencePrompt(candidate, gate, context) {
  const target = gate.duplicateOfActivityId
    ? activityContext((context.activities || []).find((activity) => activity.id === gate.duplicateOfActivityId), context)
    : null;
  const existingCompanies = (context.companies || []).map((company) => company.name).slice(0, 250);
  return `You are an investment-bank-grade Physical AI funding triage engine.

Your job is to adjudicate ONE Gmail-derived candidate before it enters a private analyst Review Queue.

Hard rules:
- Keep only Physical AI funding events from the last ${MAX_LOOKBACK_DAYS} days.
- Physical AI includes robotics, humanoids, autonomous vehicles, drones, defense autonomy, industrial automation, embodied AI, edge AI hardware, sensing/perception/autonomy infrastructure.
- Reject stock news, earnings, conference/newsletter promos, hiring, generic AI software, crypto, and non-funding stories.
- Never invent missing company names, investors, dates, or dollar values.
- Gmail text is private. Do not quote sensitive email body text. Summarize only short factual evidence.
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
  subject: candidate.subject,
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
  "description": "one factual analyst-safe sentence; mention undisclosed amount if relevant",
  "evidence": ["short factual evidence point", "short factual evidence point"],
  "cautions": ["what analyst should verify"],
  "rejectReason": null
}

If the candidate should not be staged, return:
{ "keep": false, "physicalAi": false, "fundingEvent": false, "rejectReason": "short reason", "evidence": [], "cautions": [] }`;
}

async function adjudicateWithLlm(candidate, gate, context) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { keep: true, candidate, status: "disabled" };
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${INTELLIGENCE_MODEL}:generateContent?key=${apiKey}`,
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
  if (!parsed || typeof parsed !== "object") throw new Error("Gemini triage returned invalid JSON");
  if (parsed.keep === false || parsed.physicalAi === false || parsed.fundingEvent === false) {
    return { keep: false, reason: `llm-${boundedText(parsed.rejectReason || "rejected", 60)}` };
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
  const triage = [`AI triage: ${action}; model=${INTELLIGENCE_MODEL}.`];
  if (evidence.length) triage.push(`Evidence: ${evidence.join(" | ")}.`);
  if (cautions.length) triage.push(`Cautions: ${cautions.join(" | ")}.`);
  next.extracted_text = boundedText(`${triage.join(" ")} Source: ${candidate.extracted_text}`, 900);
  next.intelligence_action = action;
  next.intelligence_score = intelligenceScore(next, action, evidence, cautions);
  next.intelligence_evidence = evidence;
  next.intelligence_cautions = cautions;
  next.llm_model = INTELLIGENCE_MODEL;
  next.llm_status = "enriched";
  return { keep: true, candidate: next, status: "enriched" };
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

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: "POST only" }));
  }

  if (!hasSharedSecret(req)) {
    return unauthorized(res, "Missing or wrong X-Ingest-Secret header.");
  }

  const missing = [];
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const GMAIL_CLIENT_ID = process.env.GMAIL_CLIENT_ID;
  const GMAIL_CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
  const GMAIL_REFRESH_TOKEN = process.env.GMAIL_REFRESH_TOKEN;
  const GMAIL_USER_EMAIL = process.env.GMAIL_USER_EMAIL;
  if (!SUPABASE_URL) missing.push("SUPABASE_URL");
  if (!SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!GMAIL_CLIENT_ID) missing.push("GMAIL_CLIENT_ID");
  if (!GMAIL_CLIENT_SECRET) missing.push("GMAIL_CLIENT_SECRET");
  if (!GMAIL_REFRESH_TOKEN) missing.push("GMAIL_REFRESH_TOKEN");
  if (!GMAIL_USER_EMAIL) missing.push("GMAIL_USER_EMAIL");
  if (missing.length > 0) return missingConfig(res, missing);

  let body = {};
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
  } catch {
    body = {};
  }
  const maxResults = Math.min(Number(body.maxResults || process.env.INGEST_MAX || MAX_DEFAULT_RESULTS), 50);

  let sources = DEFAULT_QUERIES;
  if (process.env.INGEST_SOURCES) {
    try {
      const parsed = JSON.parse(process.env.INGEST_SOURCES);
      if (Array.isArray(parsed) && parsed.length > 0) sources = parsed;
    } catch {
      // fall through
    }
  }
  if (body.query) {
    sources = [{ name: body.queryLabel || "ad-hoc", query: body.query }];
  }

  const startedAt = new Date().toISOString();
  let totalCandidates = 0;
  let dedupedCount = 0;
  const skippedByReason = {};
  const perSource = [];
  let runStatus = "completed";
  let errorMessage = null;
  const intelligence = { enabled: llmEnabled(body), model: INTELLIGENCE_MODEL, enriched: 0, rejected: 0, failed: 0 };
  const runSeen = new Set();

  try {
    const context = await loadDedupeContext(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const accessToken = await getGmailAccessToken();
    for (const src of sources) {
      const messages = await gmailList(accessToken, src.query, maxResults);
      const candidates = [];
      for (const m of messages) {
        const detail = await gmailGet(accessToken, m.id);
        const candidate = buildCandidate(detail, src.name);
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
        const runKey = candidateRunKey(candidate);
        if (runSeen.has(runKey)) {
          dedupedCount += 1;
          skippedByReason["run-duplicate"] = (skippedByReason["run-duplicate"] || 0) + 1;
          continue;
        }
        runSeen.add(runKey);
        let staged = candidate;
        if (intelligence.enabled) {
          try {
            const adjudicated = await adjudicateWithLlm(candidate, gate, context);
            if (!adjudicated.keep) {
              dedupedCount += 1;
              intelligence.rejected += 1;
              skippedByReason[adjudicated.reason] = (skippedByReason[adjudicated.reason] || 0) + 1;
              continue;
            }
            staged = adjudicated.candidate;
            if (adjudicated.status === "enriched") intelligence.enriched += 1;
          } catch (llmError) {
            intelligence.failed += 1;
            staged.extracted_text = boundedText(`AI triage failed; deterministic gate used. ${(llmError && llmError.message) || String(llmError)}. Source: ${staged.extracted_text}`, 900);
            staged.llm_model = INTELLIGENCE_MODEL;
            staged.llm_status = "failed";
          }
        }
        candidates.push(staged);
      }
      const written = await supabaseUpsertReviewQueue(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, candidates);
      totalCandidates += written;
      perSource.push({ source: src.name, query: src.query, found: messages.length, written, skipped: messages.length - written });
    }
  } catch (err) {
    runStatus = "failed";
    errorMessage = (err && err.message) || String(err);
    res.statusCode = 502;
  }

  await supabaseInsertRun(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    id: `run-gmail-${Date.now().toString(36)}`,
    source_name: "Gmail",
    source_type: "gmail",
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
  return res.end(
    JSON.stringify({
      ok: !errorMessage,
      candidates: totalCandidates,
      deduped: dedupedCount,
      skippedByReason,
      intelligence,
      perSource,
      error: errorMessage || undefined
    })
  );
};
