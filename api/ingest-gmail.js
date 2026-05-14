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
// Optional: INGEST_SOURCES, INGEST_MAX, INGEST_SHARED_SECRET.

const SHARED_SECRET = process.env.INGEST_SHARED_SECRET || "";
const ALLOWED_ORIGINS = new Set([
  "https://ai-map-cyan.vercel.app",
  "https://tishir31.github.io",
  "http://localhost:5173"
]);

const DEFAULT_QUERIES = [
  { name: "Physical AI catch-all", query: "from:(newsletter OR news OR alerts) (robotics OR humanoid OR autonomous OR drone OR \"physical AI\") newer_than:2d" }
];

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

function parseMoneyToUsd(text) {
  const m = String(text || "").match(/\$([0-9]+(?:\.[0-9]+)?)\s?(m|million|b|billion)?/i);
  if (!m) return null;
  const value = Number(m[1]);
  const unit = (m[2] || "").toLowerCase();
  if (unit === "b" || unit === "billion") return value * 1_000_000_000;
  if (unit === "m" || unit === "million") return value * 1_000_000;
  return value;
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
  const bodyMatch = String(body || "").match(/(?:^|[.!?]\s+)([A-Z][A-Za-z0-9&.\- ]{2,45})\s+(?:raises?|raised|acquires?|partners?|selected|launches?|released|wins?)/);
  if (bodyMatch && bodyMatch[1]) return bodyMatch[1].trim();
  const subjMatch = String(subject || "").match(/(?:alert:|news:|financing:)?\s*([A-Z][A-Za-z0-9&.\- ]{2,45})\s+(?:raises?|raised|acquires?|partners?|selected|launches?|released|wins?)/);
  return (subjMatch && subjMatch[1] && subjMatch[1].trim()) || "N/A";
}

function inferCounterparty(body) {
  const text = String(body || "");
  const from = text.match(/\bfrom\s+([A-Z][A-Za-z0-9&.\- ]{2,55})/);
  const wth = text.match(/\bwith\s+([A-Z][A-Za-z0-9&.\- ]{2,55})/);
  const by = text.match(/\bby\s+([A-Z][A-Za-z0-9&.\- ]{2,55})/);
  return ((from && from[1]) || (wth && wth[1]) || (by && by[1]) || "N/A").replace(/\s+to\s.*$/, "").trim();
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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Ingest-Secret");
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

async function gmailList(accessToken, userEmail, query, maxResults) {
  const url = new URL(`https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(userEmail)}/messages`);
  url.searchParams.set("q", query);
  url.searchParams.set("maxResults", String(maxResults));
  const r = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) throw new Error(`Gmail list failed (${r.status})`);
  const j = await r.json();
  return j.messages || [];
}

async function gmailGet(accessToken, userEmail, messageId) {
  const url = `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(userEmail)}/messages/${messageId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) throw new Error(`Gmail get failed (${r.status})`);
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
  const text = `${subject}. ${snippet}`;
  const activityType = inferActivityType(text);
  const subsector = inferSubsector(text);
  const candidateCompany = inferCompany(subject, snippet);
  const candidateCounterparty = inferCounterparty(snippet);
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
    description: `Sanitized Gmail candidate from ${sourceName}: ${candidateCompany} ${activityType}. Review private email before approving.`,
    source_type: "Gmail",
    source_url: null,
    gmail_message_id: message.id,
    sender,
    subject,
    received_date: receivedDate,
    snippet,
    extracted_text: "Private email body intentionally not committed. Review the Gmail message by ID before approving or merging.",
    confidence: "reported",
    status: "pending",
    created_at: new Date().toISOString()
  };
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
  if (!r.ok) {
    const detail = await r.text();
    throw new Error(`Supabase upsert failed (${r.status}): ${detail.slice(0, 200)}`);
  }
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

  if (SHARED_SECRET && req.headers["x-ingest-secret"] !== SHARED_SECRET) {
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
  const maxResults = Number(body.maxResults || process.env.INGEST_MAX || 5);

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
  const perSource = [];
  let runStatus = "completed";
  let errorMessage = null;

  try {
    const accessToken = await getGmailAccessToken();
    for (const src of sources) {
      const messages = await gmailList(accessToken, GMAIL_USER_EMAIL, src.query, maxResults);
      const candidates = [];
      for (const m of messages) {
        const detail = await gmailGet(accessToken, GMAIL_USER_EMAIL, m.id);
        candidates.push(buildCandidate(detail, src.name));
      }
      const written = await supabaseUpsertReviewQueue(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, candidates);
      totalCandidates += written;
      perSource.push({ source: src.name, query: src.query, found: messages.length, written });
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
    deduped_count: 0,
    status: runStatus
  }).catch(() => undefined);

  res.statusCode = errorMessage ? res.statusCode : 200;
  res.setHeader("Content-Type", "application/json");
  return res.end(
    JSON.stringify({
      ok: !errorMessage,
      candidates: totalCandidates,
      perSource,
      error: errorMessage || undefined
    })
  );
};
