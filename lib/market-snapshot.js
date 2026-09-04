"use strict";

const RAW_EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PLACEHOLDER_RE = /\b(tbd|todo|placeholder|example\.com|source url tbd)\b/i;

function isPublicUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:"
      && !url.username
      && !url.password
      && url.hostname.toLowerCase() !== "news.google.com"
      && !PLACEHOLDER_RE.test(url.hostname)
      && !RAW_EMAIL_RE.test(url.href);
  } catch {
    return false;
  }
}

function publicTitle(value) {
  const title = String(value || "").trim();
  return !title || PLACEHOLDER_RE.test(title) || RAW_EMAIL_RE.test(title) ? undefined : title;
}

function publicSourceRefs(row) {
  const refs = [];
  if (String(row.source_type || "").toLowerCase() !== "gmail" && isPublicUrl(row.source_url)) {
    refs.push({
      url: row.source_url,
      type: row.source_type || "other",
      title: publicTitle(row.source_reference),
    });
  }
  const additional = Array.isArray(row.additional_sources) ? row.additional_sources : [];
  for (const source of additional) {
    if (!source || typeof source !== "object") continue;
    if (String(source.type || "").toLowerCase() === "gmail" || !isPublicUrl(source.url)) continue;
    refs.push({ url: source.url, type: source.type || "other", title: publicTitle(source.title) });
  }
  const seen = new Set();
  return refs.filter((source) => {
    if (seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });
}

function isPublicSafeActivity(row) {
  if (!row || row.review_status !== "approved" || row.is_sample === true) return false;
  // Publication is decided by the evidence that can be shown, not by the
  // internal route that first discovered the event. A candidate discovered in
  // Gmail may be published after review only when its canonical source itself
  // has been promoted to a non-Gmail public reference. Rows whose canonical
  // source remains Gmail stay private even if an auxiliary URL was attached.
  if (String(row.source_type || "").trim().toLowerCase() === "gmail") return false;
  if (String(row.confidence || "").toLowerCase() === "estimated") return false;
  const text = [row.source_reference, row.description, row.counterparty].filter(Boolean).join(" ");
  if (RAW_EMAIL_RE.test(text) || PLACEHOLDER_RE.test([row.source_reference, row.source_url].filter(Boolean).join(" "))) return false;
  return publicSourceRefs(row).length > 0;
}

function sanitizeActivity(row) {
  const refs = publicSourceRefs(row);
  const primary = refs[0];
  const sourceId = row.source_id || `public-${row.id}`;
  return {
    id: row.id,
    date_announced: row.date_announced,
    company_id: row.company_id,
    counterparty: row.counterparty || "N/A",
    activity_type: row.activity_type,
    subsector: row.subsector,
    deal_value_usd: row.deal_value_usd,
    geography: row.geography,
    description: row.description,
    source_id: sourceId,
    source_url: primary.url,
    source_reference: primary.title || primary.url,
    source_type: primary.type || "other",
    additional_sources: refs.slice(1),
    confidence: row.confidence,
    review_status: "approved",
    last_updated: row.last_updated,
    is_sample: false,
    entered_by: null,
    entered_at: null,
    approved_by: null,
    approved_at: row.approved_at || null,
    merged_from_candidate_ids: null,
  };
}

function activeExclusionSets(rows) {
  const activities = new Set();
  const companies = new Set();
  for (const row of rows || []) {
    if (row.restored_at) continue;
    if (row.target_type === "activity" && row.target_id) activities.add(row.target_id);
    if (row.target_type === "company" && row.target_id) companies.add(row.target_id);
    if (row.company_id && row.target_type === "company") companies.add(row.company_id);
  }
  return { activities, companies };
}

function sanitizeExclusion(row) {
  return {
    id: row.id,
    target_type: row.target_type,
    target_id: row.target_id,
    company_id: row.company_id || null,
    reason: row.reason,
    note: null,
    cascade: row.cascade !== false,
    excluded_at: row.excluded_at,
    excluded_by: null,
    restored_at: null,
    restored_by: null,
  };
}

function buildSnapshot({ activities, companies, exclusions, ingestionRuns }, now = new Date()) {
  const activeExclusions = (exclusions || []).filter((row) => !row.restored_at);
  const excluded = activeExclusionSets(activeExclusions);
  const safeActivities = (activities || [])
    .filter(isPublicSafeActivity)
    .map(sanitizeActivity)
    .filter((row) => !excluded.activities.has(row.id) && !excluded.companies.has(row.company_id))
    .sort((left, right) => String(right.date_announced).localeCompare(String(left.date_announced)));
  const safeCompanyIds = new Set(safeActivities.map((row) => row.company_id));
  const candidateCompanies = (companies || [])
    .filter((row) => row
      && row.is_sample !== true
      && safeCompanyIds.has(row.id)
      && !excluded.companies.has(row.id))
    .map((row) => ({
      id: row.id,
      name: row.name,
      overview: row.overview || "",
      subsector: row.subsector,
      geography: row.geography || "",
      website: isPublicUrl(row.website) ? row.website : null,
      is_sample: false,
    }));
  const knownCompanyIds = new Set(candidateCompanies.map((row) => row.id));
  const activitiesWithCompanies = safeActivities.filter((row) => knownCompanyIds.has(row.company_id));
  const finalCompanyIds = new Set(activitiesWithCompanies.map((row) => row.company_id));
  const safeCompanies = candidateCompanies.filter((row) => finalCompanyIds.has(row.id));
  const sources = activitiesWithCompanies.map((row) => ({
    id: row.source_id,
    activity_id: row.id,
    type: row.source_type,
    url: row.source_url,
    gmail_message_id: null,
    sender: null,
    subject: null,
    received_date: null,
    snippet: null,
    title: row.source_reference || row.source_url,
  }));
  const latestActivityDate = activitiesWithCompanies[0]?.date_announced || null;
  return {
    companies: safeCompanies,
    sources,
    activities: activitiesWithCompanies,
    exclusions: activeExclusions.map(sanitizeExclusion),
    ingestionRuns: (ingestionRuns || []).slice(0, 20).map((row) => ({
      id: row.id,
      source_name: row.source_name,
      source_type: row.source_type,
      query: null,
      started_at: row.started_at,
      completed_at: row.completed_at,
      candidates_found: Number(row.candidates_found || 0),
      deduped_count: Number(row.deduped_count || 0),
      llm_enriched_count: Number(row.llm_enriched_count || 0),
      llm_rejected_count: Number(row.llm_rejected_count || 0),
      llm_failed_count: Number(row.llm_failed_count || 0),
      status: row.status,
    })),
    loadedAt: now.toISOString(),
    latestActivityDate,
    counts: {
      activities: activitiesWithCompanies.length,
      companies: safeCompanies.length,
      activeCompanies: finalCompanyIds.size,
    },
  };
}

async function supabaseGet(config, path) {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
    },
  });
  if (!response.ok) throw new Error(`Supabase snapshot read failed (${response.status}).`);
  return response.json();
}

async function loadSnapshot(config, now = new Date()) {
  const [activities, companies, exclusions, ingestionRuns] = await Promise.all([
    supabaseGet(config, "activities?select=id,date_announced,company_id,counterparty,activity_type,subsector,deal_value_usd,geography,description,source_id,source_url,source_reference,source_type,additional_sources,confidence,review_status,last_updated,is_sample,entered_by,approved_at&review_status=eq.approved&is_sample=eq.false&order=date_announced.desc&limit=1000"),
    supabaseGet(config, "companies?select=id,name,overview,subsector,geography,website,is_sample&is_sample=eq.false&order=name.asc&limit=2000"),
    supabaseGet(config, "data_exclusions?select=id,target_type,target_id,company_id,reason,cascade,excluded_at,restored_at&restored_at=is.null&limit=2000"),
    supabaseGet(config, "ingestion_runs?select=id,source_name,source_type,started_at,completed_at,candidates_found,deduped_count,llm_enriched_count,llm_rejected_count,llm_failed_count,status&order=started_at.desc&limit=20"),
  ]);
  return buildSnapshot({ activities, companies, exclusions, ingestionRuns }, now);
}

module.exports = {
  buildSnapshot,
  isPublicSafeActivity,
  loadSnapshot,
  publicSourceRefs,
};
