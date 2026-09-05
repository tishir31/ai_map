"use strict";

const crypto = require("node:crypto");
const { authorizeScheduledRequest } = require("./scheduler-auth");

const ALLOWED_ORIGINS = new Set([
  "https://ai-map-cyan.vercel.app",
  "https://ai-map-tishirs-projects.vercel.app",
  "https://tishir31.github.io",
  "http://localhost:5173",
]);

const ENTITY_ID_RE = /^ENT-[0-9]{4,}$/;
const MAX_HOPS = 3;
const MAX_SEARCH_RESULTS = 30;
const RESEARCH_KINDS = new Set([
  "paper", "thesis", "idea", "project", "software", "dataset", "model", "benchmark", "product",
]);
const ORIGIN_PREDICATES = new Set([
  "founded", "spun_out_of", "successor_to", "member_of", "studied_at", "employed_by",
  "directs", "advised_by", "part_of", "authored", "introduced", "released_by",
]);
const EMERGING_STAGES = new Set([
  "student", "phd student", "doctoral student", "postdoc", "postdoctoral researcher",
  "research staff", "research scientist", "recent graduate",
]);
const COMPANY_METRIC_FACT_TYPES = [
  "headquarters", "valuation", "revenue", "arr", "total_funding", "tracked_disclosed_financing",
];

class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function setCors(req, res, methods = "GET, OPTIONS") {
  const origin = String(req.headers?.origin || "");
  const allowed = ALLOWED_ORIGINS.has(origin) || /\.vercel\.app$/i.test(safeHost(origin));
  res.setHeader("Access-Control-Allow-Origin", allowed ? origin : "https://ai-map-cyan.vercel.app");
  res.setHeader("Access-Control-Allow-Methods", methods);
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  res.setHeader("Vary", "Origin, Authorization");
}

function safeHost(value) {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

function sendJson(res, status, payload, cache = "no-store") {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", cache);
  return res.end(JSON.stringify(payload));
}

function sendError(res, error) {
  const status = Number(error?.status) || 500;
  return sendJson(res, status, {
    ok: false,
    error: status >= 500 ? "Graph service request failed." : String(error.message || error),
    ...(status < 500 && error?.details ? { details: error.details } : {}),
  });
}

function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      throw new ApiError(400, "Request body must be valid JSON.");
    }
  }
  return {};
}

function param(req, name) {
  if (typeof req.query?.[name] === "string") return req.query[name];
  try {
    const url = new URL(req.url || "/", `https://${req.headers?.host || "localhost"}`);
    return url.searchParams.get(name) || "";
  } catch {
    return "";
  }
}

function requiredEntityId(value, label = "id") {
  const id = String(value || "").trim();
  if (!ENTITY_ID_RE.test(id)) {
    throw new ApiError(400, `${label} must be a stable ENT key.`);
  }
  return id;
}

function parseHops(value) {
  const parsed = Number(value || 2);
  if (!Number.isInteger(parsed)) throw new ApiError(400, "hops must be an integer.");
  return Math.max(1, Math.min(MAX_HOPS, parsed));
}

function parseAsOf(value) {
  if (!value) return new Date().toISOString().slice(0, 10);
  const text = String(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T00:00:00Z`))) {
    throw new ApiError(400, "asOf must be an ISO date (YYYY-MM-DD).");
  }
  return text;
}

function getConfig() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    throw new ApiError(503, "Graph persistence is not configured.", {
      missingEnv: [!supabaseUrl && "SUPABASE_URL", !serviceRoleKey && "SUPABASE_SERVICE_ROLE_KEY"].filter(Boolean),
    });
  }
  return { supabaseUrl: supabaseUrl.replace(/\/$/, ""), serviceRoleKey };
}

async function restRequest(config, tableOrRpc, { method = "GET", params = {}, body, prefer, rpc = false } = {}) {
  const url = new URL(`${config.supabaseUrl}/rest/v1/${rpc ? `rpc/${tableOrRpc}` : tableOrRpc}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") url.searchParams.set(key, String(value));
  }
  const headers = {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (prefer) headers.Prefer = prefer;
  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!response.ok) {
    throw new ApiError(502, `Supabase ${tableOrRpc} request failed.`, {
      upstreamStatus: response.status,
      upstreamMessage: typeof data === "string" ? data.slice(0, 220) : data?.message,
    });
  }
  return data;
}

function bearerToken(req) {
  const header = String(req.headers?.authorization || "");
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : "";
}

async function verifyUser(req, config, { required = false } = {}) {
  const token = bearerToken(req);
  if (!token) {
    if (required) throw new ApiError(401, "Sign in is required.");
    return null;
  }
  if (constantTimeEqual(token, config.serviceRoleKey)) {
    throw new ApiError(401, "A user access token is required.");
  }
  const response = await fetch(`${config.supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) throw new ApiError(401, "The access token is invalid or expired.");
  const user = await response.json();
  if (!user?.id) throw new ApiError(401, "The access token did not resolve to a user.");
  if (user.is_anonymous === true) {
    if (required) throw new ApiError(403, "Anonymous accounts cannot access analyst features.");
    return null;
  }
  // The API reads graph tables with the service-role key, so database RLS does
  // not protect this boundary for us. Only explicitly provisioned analysts may
  // receive private dossiers or create review/research work.
  const profiles = await restRequest(config, "analyst_profiles", {
    params: { select: "user_id,is_lead", user_id: `eq.${user.id}`, limit: 1 },
  });
  if (!profiles[0]) {
    if (required) throw new ApiError(403, "This account is not in the approved analyst directory.");
    return null;
  }
  return {
    id: user.id,
    email: user.email || null,
    appMetadata: user.app_metadata && typeof user.app_metadata === "object" ? user.app_metadata : {},
    isLead: profiles[0].is_lead === true,
  };
}

function constantTimeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function unique(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function isPrivilegedGraphReviewer(user) {
  return user?.isLead === true
    || user?.appMetadata?.graph_role === "reviewer"
    || user?.appMetadata?.graph_role === "admin";
}

function userCanReviewCandidate(user, candidate) {
  if (!user?.id || !candidate) return false;
  return candidate.owner_id === user.id || isPrivilegedGraphReviewer(user);
}

function chunks(values, size = 75) {
  const output = [];
  for (let index = 0; index < values.length; index += size) output.push(values.slice(index, index + size));
  return output;
}

function inFilter(values) {
  return `in.(${unique(values).join(",")})`;
}

async function fetchInChunks(config, table, field, values, params = {}) {
  const ids = unique(values);
  if (!ids.length) return [];
  const rows = await Promise.all(chunks(ids).map((group) => restRequest(config, table, {
    params: { ...params, [field]: inFilter(group) },
  })));
  return rows.flat();
}

async function fetchEntity(config, id) {
  const rows = await restRequest(config, "graph_entities", {
    params: {
      select: "id,typed_key,kind,subtype,canonical_name,summary,lifecycle_status,redirect_to_entity_id,publication_status,updated_at",
      id: `eq.${id}`,
      publication_status: "in.(published,superseded)",
      limit: 1,
    },
  });
  return rows[0] || null;
}

async function enrichEntities(config, entities) {
  const entityIds = unique((entities || []).map((entity) => entity.id));
  if (!entityIds.length) return [];
  const [aliases, externalIds] = await Promise.all([
    fetchInChunks(config, "graph_entity_aliases", "entity_id", entityIds, {
      select: "entity_id,alias,alias_type",
      is_public: "eq.true",
    }),
    fetchInChunks(config, "graph_external_ids", "entity_id", entityIds, {
      select: "entity_id,provider,external_id,canonical_url,is_verified",
      is_public: "eq.true",
    }),
  ]);
  const aliasesByEntity = new Map();
  for (const alias of aliases) {
    if (!aliasesByEntity.has(alias.entity_id)) aliasesByEntity.set(alias.entity_id, []);
    aliasesByEntity.get(alias.entity_id).push(alias.alias);
  }
  const externalIdsByEntity = new Map();
  for (const item of externalIds) {
    if (!externalIdsByEntity.has(item.entity_id)) externalIdsByEntity.set(item.entity_id, {});
    const current = externalIdsByEntity.get(item.entity_id);
    const value = item.canonical_url || item.external_id;
    if (current[item.provider] === undefined) current[item.provider] = value;
    else if (Array.isArray(current[item.provider])) current[item.provider].push(value);
    else current[item.provider] = [current[item.provider], value];
  }
  return entities.map((entity) => ({
    ...entity,
    aliases: unique(aliasesByEntity.get(entity.id) || []),
    external_ids: externalIdsByEntity.get(entity.id) || {},
  }));
}

async function searchEntities(config, query, limit = 20) {
  const q = String(query || "").trim().slice(0, 120);
  if (q.length < 2) throw new ApiError(400, "q must contain at least two characters.");
  const safe = q.replace(/[(),.*]/g, " ").replace(/\s+/g, " ").trim();
  if (safe.length < 2) throw new ApiError(400, "q must contain at least two searchable characters.");
  const capped = Math.max(1, Math.min(MAX_SEARCH_RESULTS, Number(limit) || 20));
  const stableKey = /^(?:ENT|PER|ORG|PAP|IDE|ART)-[0-9]{4,}$/i.test(q) ? q.toUpperCase() : null;
  const [keyEntities, entities, aliases] = await Promise.all([
    stableKey ? restRequest(config, "graph_entities", {
      params: {
        select: "id,typed_key,kind,subtype,canonical_name,summary,lifecycle_status,redirect_to_entity_id",
        publication_status: "in.(published,superseded)",
        or: `(id.eq.${stableKey},typed_key.eq.${stableKey})`,
        limit: capped,
      },
    }) : Promise.resolve([]),
    restRequest(config, "graph_entities", {
      params: {
        select: "id,typed_key,kind,subtype,canonical_name,summary,lifecycle_status,redirect_to_entity_id",
        publication_status: "in.(published,superseded)",
        canonical_name: `ilike.*${safe}*`,
        order: "canonical_name.asc",
        limit: capped,
      },
    }),
    restRequest(config, "graph_entity_aliases", {
      params: {
        select: "entity_id,alias,alias_type",
        is_public: "eq.true",
        alias: `ilike.*${safe}*`,
        limit: capped,
      },
    }),
  ]);
  const aliasEntityIds = unique(aliases.map((row) => row.entity_id));
  const aliasEntities = await fetchInChunks(config, "graph_entities", "id", aliasEntityIds, {
    select: "id,typed_key,kind,subtype,canonical_name,summary,lifecycle_status,redirect_to_entity_id",
    publication_status: "in.(published,superseded)",
  });
  const aliasByEntity = new Map();
  for (const alias of aliases) {
    if (!aliasByEntity.has(alias.entity_id)) aliasByEntity.set(alias.entity_id, []);
    aliasByEntity.get(alias.entity_id).push(alias.alias);
  }
  const merged = new Map();
  for (const entity of [...keyEntities, ...entities, ...aliasEntities]) {
    merged.set(entity.id, { ...entity, matchedAliases: aliasByEntity.get(entity.id) || [] });
  }
  const enriched = await enrichEntities(config, [...merged.values()]);
  return enriched.slice(0, capped);
}

function relationshipActiveAt(relationship, asOf) {
  // `asOf` is an upper bound on the history shown in an investigation, not an
  // "currently active on this day" filter. A past role or collaboration must
  // remain visible because it can explain the entity's origin. The end date is
  // therefore descriptive and must not erase a relationship from the dossier.
  if (relationship.started_on && relationship.started_on > asOf) return false;
  return true;
}

async function fetchNeighborhood(config, rootId, hops, asOf) {
  const seenEntities = new Set([rootId]);
  const seenRelationships = new Map();
  let frontier = [rootId];
  for (let depth = 0; depth < hops && frontier.length; depth += 1) {
    const groups = chunks(frontier, 40);
    const batches = await Promise.all(groups.map((ids) => restRequest(config, "graph_current_relationships", {
      params: {
        select: "id,subject_entity_id,predicate,object_entity_id,layer,identity_qualifiers,semantic_key,current_revision,started_on,started_precision,ended_on,ended_precision,observed_at,temporal_note,qualifiers,conclusion_label,review_status",
        or: `(subject_entity_id.${inFilter(ids)},object_entity_id.${inFilter(ids)})`,
        conclusion_label: "eq.Verified fact",
        review_status: "eq.approved",
        limit: 2000,
      },
    })));
    const next = new Set();
    for (const relationship of batches.flat()) {
      if (!relationshipActiveAt(relationship, asOf)) continue;
      seenRelationships.set(relationship.id, relationship);
      for (const id of [relationship.subject_entity_id, relationship.object_entity_id]) {
        if (!seenEntities.has(id)) next.add(id);
        seenEntities.add(id);
      }
    }
    frontier = [...next];
  }
  const rawEntities = await fetchInChunks(config, "graph_entities", "id", [...seenEntities], {
    select: "id,typed_key,kind,subtype,canonical_name,summary,lifecycle_status,redirect_to_entity_id,updated_at",
    publication_status: "in.(published,superseded)",
  });
  const entities = await enrichEntities(config, rawEntities);
  const publishedIds = new Set(entities.map((entity) => entity.id));
  const relationships = [...seenRelationships.values()].filter((relationship) =>
    publishedIds.has(relationship.subject_entity_id) && publishedIds.has(relationship.object_entity_id));
  return { entities, relationships };
}

function buildAdjacency(relationships) {
  const adjacency = new Map();
  for (const relationship of relationships) {
    for (const [from, to, direction] of [
      [relationship.subject_entity_id, relationship.object_entity_id, "forward"],
      [relationship.object_entity_id, relationship.subject_entity_id, "reverse"],
    ]) {
      if (!adjacency.has(from)) adjacency.set(from, []);
      adjacency.get(from).push({ to, relationship, direction });
    }
  }
  return adjacency;
}

function shortestPath(rootId, targetId, relationships) {
  if (rootId === targetId) return { entityIds: [rootId], relationshipIds: [], steps: [] };
  const adjacency = buildAdjacency(relationships);
  const queue = [{ id: rootId, entityIds: [rootId], relationshipIds: [], steps: [] }];
  const visited = new Set([rootId]);
  while (queue.length) {
    const current = queue.shift();
    for (const edge of adjacency.get(current.id) || []) {
      if (visited.has(edge.to)) continue;
      const candidate = {
        id: edge.to,
        entityIds: [...current.entityIds, edge.to],
        relationshipIds: [...current.relationshipIds, edge.relationship.id],
        steps: [...current.steps, {
          relationshipId: edge.relationship.id,
          predicate: edge.relationship.predicate,
          from: current.id,
          to: edge.to,
          direction: edge.direction,
          conclusionLabel: edge.relationship.conclusion_label,
        }],
      };
      if (edge.to === targetId) {
        return { entityIds: candidate.entityIds, relationshipIds: candidate.relationshipIds, steps: candidate.steps };
      }
      visited.add(edge.to);
      queue.push(candidate);
    }
  }
  return null;
}

async function fetchEvidenceBundle(config, relationships) {
  const relationIds = relationships.map((relationship) => relationship.id);
  const candidateLinks = await fetchInChunks(config, "graph_relationship_evidence", "relationship_id", relationIds, {
    select: "relationship_id,revision,evidence_id",
  });
  const currentRevisionByRelationship = new Map(relationships.map((relationship) => [relationship.id, relationship.current_revision]));
  const links = candidateLinks.filter((link) => currentRevisionByRelationship.get(link.relationship_id) === link.revision);
  const evidence = await fetchInChunks(config, "graph_evidence", "id", links.map((link) => link.evidence_id), {
    select: "id,source_id,snapshot_id,stance,locator,excerpt,directness,retrieved_at",
    is_public: "eq.true",
  });
  const sources = await fetchInChunks(config, "graph_sources", "id", evidence.map((item) => item.source_id), {
    select: "id,canonical_url,title,publisher,source_type,tier,accessibility_status,last_retrieved_at",
    is_public: "eq.true",
  });
  const publicSourceIds = new Set(sources.map((source) => source.id));
  const sourceSafeEvidence = evidence.filter((item) => publicSourceIds.has(item.source_id));
  const snapshots = await fetchInChunks(config, "graph_source_snapshots", "id", sourceSafeEvidence.map((item) => item.snapshot_id), {
    select: "id,source_id,retrieved_at,content_hash,http_status,snapshot_status,parser_name,parser_version,observed_item_count",
    snapshot_status: "in.(captured,metadata_only)",
  });
  const snapshotById = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
  const publicEvidence = sourceSafeEvidence.filter((item) => !item.snapshot_id
    || snapshotById.get(item.snapshot_id)?.source_id === item.source_id);
  const evidenceIds = new Set(publicEvidence.map((item) => item.id));
  const publicLinks = links.filter((link) => evidenceIds.has(link.evidence_id));
  const publicSnapshotIds = new Set(publicEvidence.map((item) => item.snapshot_id).filter(Boolean));
  const publicSnapshots = snapshots.filter((snapshot) => publicSnapshotIds.has(snapshot.id));
  return { relationshipEvidence: publicLinks, evidence: publicEvidence, sources, sourceSnapshots: publicSnapshots };
}

async function fetchFacts(config, entityIds) {
  const facts = await fetchInChunks(config, "graph_entity_facts", "entity_id", entityIds, {
    select: "id,entity_id,fact_type,display_value,numeric_value,currency,period_label,as_of_date,date_precision,disclosure_status,metric_scope,conclusion_label,revision",
    publication_status: "eq.published",
    conclusion_label: "eq.Verified fact",
    order: "as_of_date.desc.nullslast",
  });
  const factEvidenceCandidates = await fetchInChunks(config, "graph_entity_fact_evidence", "fact_id", facts.map((fact) => fact.id), {
    select: "fact_id,evidence_id",
  });
  const evidence = await fetchInChunks(config, "graph_evidence", "id", factEvidenceCandidates.map((link) => link.evidence_id), {
    select: "id,source_id,snapshot_id",
    is_public: "eq.true",
  });
  const [sources, snapshots] = await Promise.all([
    fetchInChunks(config, "graph_sources", "id", evidence.map((item) => item.source_id), {
      select: "id",
      is_public: "eq.true",
      accessibility_status: "eq.accessible",
    }),
    fetchInChunks(config, "graph_source_snapshots", "id", evidence.map((item) => item.snapshot_id), {
      select: "id,source_id",
      snapshot_status: "in.(captured,metadata_only)",
    }),
  ]);
  const sourceIds = new Set(sources.map((source) => source.id));
  const snapshotById = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
  const evidenceIds = new Set(evidence.filter((item) => sourceIds.has(item.source_id)
    && (!item.snapshot_id || snapshotById.get(item.snapshot_id)?.source_id === item.source_id)).map((item) => item.id));
  const factEvidence = factEvidenceCandidates.filter((link) => evidenceIds.has(link.evidence_id));
  return { facts, factEvidence };
}

async function fetchPrivateMetricCoverage(config, companyEntityIds) {
  const facts = await fetchInChunks(config, "graph_entity_facts", "entity_id", companyEntityIds, {
    select: "id,entity_id,fact_type,display_value,numeric_value,currency,period_label,as_of_date,date_precision,disclosure_status,metric_scope,conclusion_label,publication_status,revision",
    fact_type: inFilter(COMPANY_METRIC_FACT_TYPES),
    conclusion_label: "eq.Derived signal",
    publication_status: "in.(candidate,published)",
    order: "entity_id.asc,fact_type.asc,as_of_date.desc.nullslast,revision.desc",
  });
  const links = await fetchInChunks(config, "graph_entity_fact_evidence", "fact_id", facts.map((fact) => fact.id), {
    select: "fact_id,evidence_id",
  });
  const evidence = await fetchInChunks(config, "graph_evidence", "id", links.map((link) => link.evidence_id), {
    select: "id,source_id",
  });
  const sourceByEvidence = new Map(evidence.map((item) => [item.id, item.source_id]));
  const linksByFact = new Map();
  for (const link of links) {
    if (!linksByFact.has(link.fact_id)) linksByFact.set(link.fact_id, []);
    linksByFact.get(link.fact_id).push(link.evidence_id);
  }
  return facts.map((fact) => {
    const evidenceIds = unique(linksByFact.get(fact.id) || []);
    return {
      ...fact,
      evidence_ids: evidenceIds,
      source_ids: unique(evidenceIds.map((evidenceId) => sourceByEvidence.get(evidenceId))),
    };
  });
}

async function fetchPrivateCoverageGaps(config, entityIds, user) {
  return fetchInChunks(config, "graph_coverage_gaps", "entity_id", entityIds, {
    select: "id,gap_type,display_label,coverage_outcome,reason,status,as_of_date,entity_id,owner_id,is_shared",
    or: `(is_shared.eq.true,owner_id.eq.${user.id})`,
    status: "in.(open,in_progress)",
    order: "as_of_date.desc,id.asc",
  });
}

async function fetchCollections(config, entityIds, includeCoverage) {
  const memberships = await fetchInChunks(config, "graph_collection_entities", "entity_id", entityIds, {
    select: "collection_id,entity_id,collection_role",
  });
  const collections = await fetchInChunks(config, "graph_collections", "id", memberships.map((item) => item.collection_id), {
    select: includeCoverage
      ? "id,name,scope_statement,declared_source_universe,as_of_date,coverage_outcome"
      : "id,name,scope_statement,as_of_date",
    publication_status: "eq.published",
  });
  return { memberships, collections };
}

function indexById(rows) {
  return new Map((rows || []).map((row) => [row.id, row]));
}

function classifyPublicDossier(rootId, entities, relationships) {
  const entityById = indexById(entities);
  const pathFor = (id) => shortestPath(rootId, id, relationships);
  const origin = entities
    .filter((entity) => entity.id !== rootId)
    .map((entity) => ({ entity, path: pathFor(entity.id) }))
    .filter((item) => item.path && item.path.steps.some((step) => ORIGIN_PREDICATES.has(step.predicate)))
    .sort((a, b) => a.path.steps.length - b.path.steps.length || a.entity.canonical_name.localeCompare(b.entity.canonical_name));
  const researchDna = entities
    .filter((entity) => entity.id !== rootId && RESEARCH_KINDS.has(entity.kind))
    .map((entity) => ({ entity, path: pathFor(entity.id) }))
    .filter((item) => item.path)
    .sort((a, b) => a.path.steps.length - b.path.steps.length || a.entity.canonical_name.localeCompare(b.entity.canonical_name));
  return { origin, researchDna, entityById };
}

function evidenceSummary(relationships, relationshipEvidence, evidence, sources) {
  const linkedEvidenceIds = new Set(relationshipEvidence.map((link) => link.evidence_id));
  const linkedEvidence = evidence.filter((item) => linkedEvidenceIds.has(item.id));
  const retrieved = linkedEvidence.map((item) => item.retrieved_at).filter(Boolean).sort();
  return {
    relationshipCount: relationships.length,
    evidenceCount: linkedEvidence.length,
    primarySourceCount: sources.filter((source) => source.tier === "primary").length,
    supportCount: linkedEvidence.filter((item) => item.stance === "support").length,
    qualifyCount: linkedEvidence.filter((item) => item.stance === "qualify").length,
    contradictCount: linkedEvidence.filter((item) => item.stance === "contradict").length,
    freshestRetrieval: retrieved.at(-1) || null,
    conclusionLabel: "Derived signal",
  };
}

function monthsAgo(asOf, months) {
  const date = new Date(`${asOf}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() - months);
  return date.toISOString().slice(0, 10);
}

async function fetchResolvedRecentAuthorMentions(config, personIds, asOf) {
  const mentions = await fetchInChunks(config, "graph_author_mentions", "resolved_person_entity_id", personIds, {
    select: "id,paper_entity_id,resolved_person_entity_id,resolution_status,resolution_method,source_id,evidence_id,publication_status",
    resolution_status: "eq.resolved",
    publication_status: "eq.published",
  });
  const stronglyResolved = mentions.filter((mention) => new Set([
    "exact_external_identifier", "resolved_by_source_identifier", "source_explicit", "manual_review",
  ]).has(mention.resolution_method) && mention.evidence_id);
  if (!stronglyResolved.length) return new Map();

  const evidence = await fetchInChunks(config, "graph_evidence", "id", stronglyResolved.map((mention) => mention.evidence_id), {
    select: "id,source_id,snapshot_id,stance",
  });
  const [sources, snapshots] = await Promise.all([
    fetchInChunks(config, "graph_sources", "id", evidence.map((item) => item.source_id), {
      select: "id,accessibility_status",
      accessibility_status: "eq.accessible",
    }),
    fetchInChunks(config, "graph_source_snapshots", "id", evidence.map((item) => item.snapshot_id), {
      select: "id,source_id,snapshot_status",
      snapshot_status: "in.(captured,metadata_only)",
    }),
  ]);
  const accessibleSources = new Set(sources.map((source) => source.id));
  const snapshotById = new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
  const evidenceById = new Map(evidence.filter((item) => item.stance === "support"
    && accessibleSources.has(item.source_id)
    && item.snapshot_id
    && snapshotById.get(item.snapshot_id)?.source_id === item.source_id).map((item) => [item.id, item]));
  const safeMentions = stronglyResolved.filter((mention) => {
    const item = evidenceById.get(mention.evidence_id);
    return item?.source_id === mention.source_id;
  });
  if (!safeMentions.length) return new Map();

  const paperIds = unique(safeMentions.map((mention) => mention.paper_entity_id));
  const [publicationFacts, authorshipRelationships] = await Promise.all([
    fetchInChunks(config, "graph_entity_facts", "entity_id", paperIds, {
      select: "entity_id,as_of_date,display_value",
      fact_type: "eq.published_on",
      conclusion_label: "eq.Verified fact",
      publication_status: "eq.published",
    }),
    fetchInChunks(config, "graph_relationships", "subject_entity_id", personIds, {
      select: "id,subject_entity_id,object_entity_id,current_revision,predicate",
      predicate: "eq.authored",
    }),
  ]);
  const mentionedPairs = new Set(safeMentions.map((mention) => `${mention.resolved_person_entity_id}|${mention.paper_entity_id}`));
  const matchingAuthorships = authorshipRelationships.filter((relationship) =>
    mentionedPairs.has(`${relationship.subject_entity_id}|${relationship.object_entity_id}`));
  const authorshipRevisions = await fetchInChunks(config, "graph_relationship_revisions", "relationship_id", matchingAuthorships.map((relationship) => relationship.id), {
    select: "relationship_id,revision,started_on,conclusion_label",
    conclusion_label: "eq.Verified fact",
  });
  const currentRevisionByRelationship = new Map(matchingAuthorships.map((relationship) => [relationship.id, relationship.current_revision]));
  const revisionDateByPair = new Map();
  for (const revision of authorshipRevisions) {
    if (currentRevisionByRelationship.get(revision.relationship_id) !== revision.revision || !revision.started_on) continue;
    const relationship = matchingAuthorships.find((item) => item.id === revision.relationship_id);
    if (relationship) revisionDateByPair.set(`${relationship.subject_entity_id}|${relationship.object_entity_id}`, revision.started_on);
  }
  const factDateByPaper = new Map(publicationFacts.filter((fact) => fact.as_of_date)
    .map((fact) => [fact.entity_id, fact.as_of_date]));
  const cutoff = monthsAgo(asOf, 24);
  const papersByPerson = new Map();
  for (const mention of safeMentions) {
    const date = factDateByPaper.get(mention.paper_entity_id)
      || revisionDateByPair.get(`${mention.resolved_person_entity_id}|${mention.paper_entity_id}`);
    if (!date || date < cutoff || date > asOf) continue;
    if (!papersByPerson.has(mention.resolved_person_entity_id)) papersByPerson.set(mention.resolved_person_entity_id, []);
    papersByPerson.get(mention.resolved_person_entity_id).push(mention.paper_entity_id);
  }
  for (const [personId, ids] of papersByPerson) papersByPerson.set(personId, unique(ids));
  return papersByPerson;
}

async function buildPrivateDossier(config, user, rootId, asOf, entities, relationships, facts, collections, evidenceBundle) {
  const entityById = indexById(entities);
  const pathFor = (id) => shortestPath(rootId, id, relationships);
  const nearbyStartups = entities
    .filter((entity) => entity.kind === "company" && entity.id !== rootId)
    .map((entity) => ({ entity, path: pathFor(entity.id) }))
    .filter((item) => item.path)
    .sort((a, b) => a.path.steps.length - b.path.steps.length || a.entity.canonical_name.localeCompare(b.entity.canonical_name))
    .map((item) => ({
      ...item,
      whyNearby: item.path.steps.map((step) => step.predicate.replaceAll("_", " ")).join(" → "),
      conclusionLabel: "Derived signal",
    }));

  const factsByEntity = new Map();
  for (const fact of facts) {
    if (!factsByEntity.has(fact.entity_id)) factsByEntity.set(fact.entity_id, []);
    factsByEntity.get(fact.entity_id).push(fact);
  }
  const recentCutoff = monthsAgo(asOf, 24);
  const personIds = entities.filter((entity) => entity.kind === "person").map((entity) => entity.id);
  const companyEntityIds = entities.filter((entity) => entity.kind === "company").map((entity) => entity.id);
  const [resolvedRecentPapers, metricCoverage, persistedCoverageGaps] = await Promise.all([
    fetchResolvedRecentAuthorMentions(config, personIds, asOf),
    fetchPrivateMetricCoverage(config, companyEntityIds),
    fetchPrivateCoverageGaps(config, entities.map((entity) => entity.id), user),
  ]);
  const authoredPaperIdsByPerson = new Map();
  for (const relationship of relationships) {
    if (relationship.predicate !== "authored") continue;
    const subject = entityById.get(relationship.subject_entity_id);
    const object = entityById.get(relationship.object_entity_id);
    if (subject?.kind === "person" && object?.kind === "paper") {
      if (!authoredPaperIdsByPerson.has(subject.id)) authoredPaperIdsByPerson.set(subject.id, []);
      authoredPaperIdsByPerson.get(subject.id).push(object.id);
    }
  }
  const evidenceById = indexById(evidenceBundle.evidence);
  const sourceById = indexById(evidenceBundle.sources);
  const relationshipEvidenceIds = new Map();
  for (const link of evidenceBundle.relationshipEvidence) {
    if (!relationshipEvidenceIds.has(link.relationship_id)) relationshipEvidenceIds.set(link.relationship_id, []);
    relationshipEvidenceIds.get(link.relationship_id).push(link.evidence_id);
  }
  const currentRosterRelationshipFor = (personId) => relationships.find((relationship) => {
    if (![relationship.subject_entity_id, relationship.object_entity_id].includes(personId)) return false;
    if (!new Set(["member_of", "employed_by", "directs"]).has(relationship.predicate)) return false;
    if (relationship.started_on && relationship.started_on > asOf) return false;
    if (relationship.ended_on && relationship.ended_on <= asOf) return false;
    return (relationshipEvidenceIds.get(relationship.id) || []).some((evidenceId) => {
      const source = sourceById.get(evidenceById.get(evidenceId)?.source_id);
      return new Set(["official_roster", "official_profile", "official_company", "official_project"]).has(source?.source_type);
    });
  });
  const emergingResearchers = entities
    .filter((entity) => entity.kind === "person" && entity.id !== rootId)
    .map((entity) => {
      const personFacts = factsByEntity.get(entity.id) || [];
      const rosterRelationship = currentRosterRelationshipFor(entity.id);
      const rosterCounterpartyId = rosterRelationship
        ? (rosterRelationship.subject_entity_id === entity.id ? rosterRelationship.object_entity_id : rosterRelationship.subject_entity_id)
        : null;
      const rosterCounterparty = rosterCounterpartyId ? entityById.get(rosterCounterpartyId) : null;
      const subtypeStage = EMERGING_STAGES.has(String(entity.subtype || "").toLowerCase())
        ? { id: `subtype:${entity.id}`, fact_type: "career_stage", display_value: entity.subtype }
        : null;
      const careerStage = personFacts.find((fact) => fact.fact_type === "career_stage") || subtypeStage;
      const currentRole = personFacts.find((fact) => fact.fact_type === "current_role") || (rosterRelationship ? {
        id: rosterRelationship.id,
        fact_type: "current_role",
        display_value: `${rosterRelationship.predicate.replaceAll("_", " ")} ${rosterCounterparty?.canonical_name || rosterCounterpartyId}`,
      } : null);
      const publicRecentPapers = (authoredPaperIdsByPerson.get(entity.id) || []).filter((paperId) =>
        (factsByEntity.get(paperId) || []).some((fact) => fact.fact_type === "published_on" && fact.as_of_date >= recentCutoff));
      const recentPapers = unique([...publicRecentPapers, ...(resolvedRecentPapers.get(entity.id) || [])]);
      if (!careerStage || !currentRole || !EMERGING_STAGES.has(String(careerStage.display_value || "").toLowerCase()) || !recentPapers.length) return null;
      const path = pathFor(entity.id);
      if (!path) return null;
      return {
        entity,
        careerStage,
        currentRole,
        recentPaperEntityIds: recentPapers,
        path,
        conclusionLabel: "Derived signal",
        label: "Research lead — not a prediction of founder success",
      };
    })
    .filter(Boolean);

  const signalParams = {
    select: "id,entity_id,model_id,as_of_date,coverage_pct,outcome,axes,missing_inputs,conclusion_label,owner_id",
    entity_id: `eq.${rootId}`,
    as_of_date: `lte.${asOf}`,
    order: "as_of_date.desc",
    limit: 1,
  };
  const [ownedSignals, sharedSignals] = await Promise.all([
    restRequest(config, "graph_entity_signals", {
      params: { ...signalParams, owner_id: `eq.${user.id}` },
    }),
    restRequest(config, "graph_entity_signals", {
      params: { ...signalParams, owner_id: "is.null" },
    }),
  ]);
  const signal = ownedSignals[0] || sharedSignals[0] || null;
  let signalModel = null;
  let signalInputs = [];
  if (signal) {
    const [inputs, models] = await Promise.all([
      restRequest(config, "graph_signal_inputs", {
        params: {
          select: "signal_id,axis_key,relationship_id,evidence_id,source_id,contribution",
          signal_id: `eq.${signal.id}`,
        },
      }),
      restRequest(config, "graph_signal_models", {
        params: {
          select: "id,version,name,methodology,minimum_coverage,effective_from",
          id: `eq.${signal.model_id}`,
          is_public: "eq.true",
          limit: 1,
        },
      }),
    ]);
    const evidenceSources = await fetchInChunks(config, "graph_evidence", "id", inputs.map((input) => input.evidence_id), {
      select: "id,source_id",
    });
    const sourceByEvidence = new Map(evidenceSources.map((item) => [item.id, item.source_id]));
    signalInputs = inputs.map((input) => ({
      ...input,
      source_id: input.source_id || sourceByEvidence.get(input.evidence_id) || null,
    }));
    signalModel = models[0] || null;
  }
  const incompleteCollections = collections.filter((collection) =>
    collection.coverage_outcome && collection.coverage_outcome !== "Complete against declared source");
  const gaps = [
    ...(signal?.missing_inputs || []),
    ...incompleteCollections.map((collection) => ({
      collectionId: collection.id,
      outcome: collection.coverage_outcome,
      asOfDate: collection.as_of_date,
    })),
    ...persistedCoverageGaps.map((gap) => ({
      gapId: gap.id,
      entityId: gap.entity_id,
      gapType: gap.gap_type,
      message: gap.display_label,
      outcome: gap.coverage_outcome,
      reason: gap.reason,
      status: gap.status,
      asOfDate: gap.as_of_date,
    })),
  ];
  return {
    nearbyStartups,
    emergingResearchers,
    metricCoverage,
    signal,
    signalModel,
    signalInputs,
    gaps,
  };
}

async function investigate(config, { id, hops = 2, asOf, user = null }) {
  const requestedEntity = await fetchEntity(config, id);
  if (!requestedEntity) throw new ApiError(404, "No published entity exists for that key.");
  const canonicalId = requestedEntity.redirect_to_entity_id || requestedEntity.id;
  const entity = canonicalId === requestedEntity.id ? requestedEntity : await fetchEntity(config, canonicalId);
  if (!entity) throw new ApiError(409, "The entity redirect target is not published.");
  const neighborhood = await fetchNeighborhood(config, entity.id, hops, asOf);
  const enrichedRoot = neighborhood.entities.find((item) => item.id === entity.id) || entity;
  const [evidenceBundle, factBundle, collectionBundle] = await Promise.all([
    fetchEvidenceBundle(config, neighborhood.relationships),
    fetchFacts(config, neighborhood.entities.map((item) => item.id)),
    fetchCollections(config, neighborhood.entities.map((item) => item.id), Boolean(user)),
  ]);
  const classified = classifyPublicDossier(enrichedRoot.id, neighborhood.entities, neighborhood.relationships);
  const privateDossier = user
    ? await buildPrivateDossier(
      config,
      user,
      enrichedRoot.id,
      asOf,
      neighborhood.entities,
      neighborhood.relationships,
      factBundle.facts,
      collectionBundle.collections,
      evidenceBundle,
    )
    : null;
  return {
    requestedEntity: requestedEntity.id === entity.id ? null : requestedEntity,
    entity: enrichedRoot,
    hops,
    asOf,
    nodes: neighborhood.entities,
    relationships: neighborhood.relationships,
    evidence: evidenceBundle.evidence,
    relationshipEvidence: evidenceBundle.relationshipEvidence,
    sources: evidenceBundle.sources,
    sourceSnapshots: evidenceBundle.sourceSnapshots,
    facts: factBundle.facts,
    factEvidence: factBundle.factEvidence,
    collections: collectionBundle.collections,
    collectionMemberships: collectionBundle.memberships,
    originPaths: classified.origin,
    researchDna: classified.researchDna,
    publicEvidenceSummary: evidenceSummary(
      neighborhood.relationships,
      evidenceBundle.relationshipEvidence,
      evidenceBundle.evidence,
      evidenceBundle.sources,
    ),
    privateAvailable: Boolean(user),
    privateDossier,
  };
}

async function compare(config, { left, right, hops = 2, asOf, user = null }) {
  const [leftDossier, rightDossier] = await Promise.all([
    investigate(config, { id: left, hops, asOf, user }),
    investigate(config, { id: right, hops, asOf, user }),
  ]);
  const leftIds = new Set(leftDossier.nodes.map((entity) => entity.id));
  const sharedEntities = rightDossier.nodes.filter((entity) => leftIds.has(entity.id));
  const combinedRelationships = new Map();
  for (const relationship of [...leftDossier.relationships, ...rightDossier.relationships]) {
    combinedRelationships.set(relationship.id, relationship);
  }
  const connectingPath = shortestPath(leftDossier.entity.id, rightDossier.entity.id, [...combinedRelationships.values()]);
  return {
    asOf,
    hops,
    left: leftDossier,
    right: rightDossier,
    sharedEntities,
    connectingPath,
    conclusionLabel: "Derived signal",
  };
}

async function recordManualDecision(config, { candidateId, approve, actorUserId, reasonCodes }) {
  return restRequest(config, "graph_record_manual_decision", {
    method: "POST",
    rpc: true,
    body: {
      p_candidate_id: candidateId,
      p_approve: Boolean(approve),
      p_actor_user_id: actorUserId,
      p_reason_codes: Array.isArray(reasonCodes) ? reasonCodes.map(String).slice(0, 20) : [],
    },
  });
}

async function authorizeManualReview(config, user, candidateId) {
  const candidates = await restRequest(config, "graph_review_candidates", {
    params: {
      select: "id,owner_id,status",
      id: `eq.${candidateId}`,
      limit: 1,
    },
  });
  const candidate = candidates[0];
  if (!candidate) throw new ApiError(404, "The graph review candidate does not exist.");
  if (!userCanReviewCandidate(user, candidate)) {
    throw new ApiError(403, "You are not authorized to review this candidate.");
  }
  return candidate;
}

async function createResearchTasks(config, { entityId, actorUserId }) {
  const entity = await fetchEntity(config, entityId);
  if (!entity) throw new ApiError(404, "No published entity exists for that key.");
  const now = new Date().toISOString();
  const suffix = crypto.randomUUID().slice(0, 8);
  const runId = `graph-${entity.id.toLowerCase()}-${suffix}`;
  const prompt = `Research graph coverage for ${entity.canonical_name} (${entity.id}): founders, papers, affiliations, funding, and declared-source coverage.`;
  const run = {
    id: runId,
    prompt,
    subject: `${entity.canonical_name} graph coverage`,
    status: "planning",
    coverage_score: 0,
    accepted_rows: 0,
    candidate_rows: 0,
    completed_cells: 0,
    total_cells: 0,
    summary: "Graph investigation requested; no claim is published until evidence review completes.",
    started_at: now,
  };
  const taskSpecs = [
    ["founders", "entity_resolution"],
    ["papers", "discovery"],
    ["affiliations", "discovery"],
    ["funding", "column_agent"],
    ["coverage_audit", "coverage_auditor"],
  ];
  const tasks = taskSpecs.map(([focus, type], index) => ({
    id: `${runId}-${String(index + 1).padStart(2, "0")}`,
    run_id: runId,
    type,
    status: "pending",
    agent_name: `graph_${focus}`,
    input: { entityId: entity.id, canonicalName: entity.canonical_name, focus, requestedBy: actorUserId },
    created_at: now,
  }));
  await restRequest(config, "research_runs", {
    method: "POST",
    body: run,
    prefer: "resolution=merge-duplicates,return=minimal",
  });
  await restRequest(config, "research_tasks", {
    method: "POST",
    body: tasks,
    prefer: "resolution=merge-duplicates,return=minimal",
  });
  return { runId, taskCount: tasks.length, entity };
}

const REFRESH_SCOPES = Object.freeze({
  weekly: [
    ["publication_deltas", "Publication deltas from declared official feeds"],
    ["company_team_deltas", "Official company-team and leadership deltas"],
    ["repository_deltas", "Official repository release and maintainer deltas"],
    ["legal_registry_deltas", "Legal-registry identifier and status deltas"],
  ],
  monthly: [
    ["lab_rosters", "Declared official lab rosters"],
    ["thesis_repositories", "Declared thesis and dissertation repositories"],
  ],
  quarterly: [
    ["historical_site_availability", "Historical-site accessibility and snapshot continuity"],
  ],
  manual: [],
});

async function stageCadenceTasks(config, cadence, asOf = new Date().toISOString().slice(0, 10)) {
  const scopes = REFRESH_SCOPES[cadence] || [];
  if (!scopes.length) return { runId: null, taskCount: 0, scopes: [] };
  const runId = `graph-refresh-${cadence}-${asOf}`;
  const now = new Date().toISOString();
  const run = {
    id: runId,
    prompt: `Run the ${cadence} graph source-delta checks against each collection's declared official source universe. Preserve inaccessible, not found, and unresolved outcomes; stage claims for graph review rather than publishing them directly.`,
    subject: `${cadence} knowledge-graph refresh`,
    status: "planning",
    coverage_score: 0,
    accepted_rows: 0,
    candidate_rows: 0,
    completed_cells: 0,
    total_cells: 0,
    summary: `Staged ${scopes.length} graph source-delta scopes. No graph-capable source consumer is deployed, so these tasks remain blocked and no publication is attempted.`,
    started_at: now,
    last_refresh_at: now,
  };
  const tasks = [
    ...scopes.map(([focus, description], index) => ({
      id: `${runId}-${String(index + 1).padStart(2, "0")}`,
      run_id: runId,
      type: "discovery",
      status: "blocked",
      agent_name: `graph_${focus}`,
      input: { focus, description, cadence, asOf, graphPolicyVersion: 2, outputMode: "stage_review_candidates" },
      error: "Staging only: a graph-capable source-delta consumer is not deployed.",
      created_at: now,
    })),
    {
      id: `${runId}-${String(scopes.length + 1).padStart(2, "0")}`,
      run_id: runId,
      type: "coverage_auditor",
      status: "blocked",
      agent_name: "graph_coverage_auditor",
      input: { cadence, asOf, declaredSourceUniverseOnly: true, requireExplicitCoverageOutcome: true },
      error: "Staging only: a graph-capable coverage consumer is not deployed.",
      created_at: now,
    },
  ];
  await restRequest(config, "research_runs", {
    method: "POST",
    body: run,
    prefer: "resolution=merge-duplicates,return=minimal",
  });
  await restRequest(config, "research_tasks", {
    method: "POST",
    body: tasks,
    prefer: "resolution=merge-duplicates,return=minimal",
  });
  return { runId, taskCount: tasks.length, scopes: scopes.map(([focus]) => focus) };
}

async function acquireRefreshRun(config, { cadence, asOf, policy, scheduled }) {
  const idempotencyKey = scheduled ? `graph-refresh:${cadence}:${asOf}` : null;
  const rows = await restRequest(config, "graph_refresh_runs", {
    method: "POST",
    params: idempotencyKey ? { on_conflict: "idempotency_key" } : {},
    body: {
      mode: policy.mode,
      policy_id: policy.id,
      cadence,
      status: "running",
      ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
    },
    prefer: idempotencyKey
      ? "resolution=ignore-duplicates,return=representation"
      : "return=representation",
  });
  if (rows[0]) return { acquired: true, run: rows[0], idempotencyKey };
  if (!idempotencyKey) throw new ApiError(502, "Refresh run could not be created.");
  const existing = await restRequest(config, "graph_refresh_runs", {
    params: {
      select: "id,mode,policy_id,cadence,status,started_at,completed_at,candidate_count,published_count,blocked_count,idempotency_key",
      idempotency_key: `eq.${idempotencyKey}`,
      limit: 1,
    },
  });
  if (!existing[0]) throw new ApiError(409, "The scheduled refresh lock exists but could not be read.");
  return { acquired: false, run: existing[0], idempotencyKey };
}

async function runRefresh(config, { cadence = "manual", asOf, scheduled = false } = {}) {
  const allowedCadences = new Set(["weekly", "monthly", "quarterly", "manual"]);
  if (!allowedCadences.has(cadence)) throw new ApiError(400, "Unsupported refresh cadence.");
  const runDate = parseAsOf(asOf || new Date().toISOString().slice(0, 10));
  if (scheduled && cadence === "manual") throw new ApiError(400, "Scheduled refreshes require a fixed cadence.");
  const policyRows = await restRequest(config, "graph_review_policies", {
    params: { select: "id,mode,version", is_active: "eq.true", version: "eq.2", limit: 1 },
  });
  const policy = policyRows[0];
  if (!policy || policy.mode === "disabled") throw new ApiError(503, "Policy v2 is unavailable; refresh failed closed.");
  const acquisition = await acquireRefreshRun(config, {
    cadence,
    asOf: runDate,
    policy,
    scheduled,
  });
  const run = acquisition.run;
  if (!acquisition.acquired) {
    return {
      runId: run.id,
      mode: run.mode,
      cadence,
      asOf: runDate,
      duplicate: true,
      status: run.status,
      stagingOnly: true,
      sourceRefreshCompleted: false,
      publicationAttempted: false,
      candidates: Number(run.candidate_count || 0),
      published: Number(run.published_count || 0),
      blocked: Number(run.blocked_count || 0),
    };
  }

  let staged = { runId: null, taskCount: 0, scopes: [] };
  let failure = null;
  try {
    staged = await stageCadenceTasks(config, cadence, runDate);
  } catch (error) {
    failure = error;
  }
  const candidateCount = 0;
  const publishedCount = 0;
  const blockedCount = 0;
  await restRequest(config, "graph_refresh_runs", {
    method: "PATCH",
    params: { id: `eq.${run.id}` },
    body: {
      status: failure ? "failed" : "completed",
      completed_at: new Date().toISOString(),
      candidate_count: candidateCount,
      published_count: publishedCount,
      blocked_count: blockedCount,
      notes: failure
        ? String(failure.message || failure).slice(0, 500)
        : `Staging only: recorded ${staged.taskCount} blocked source-delta tasks. No sources were fetched, no graph candidates were created, and no claims were reviewed or published.`,
    },
    prefer: "return=minimal",
  });
  if (failure) throw failure;
  return {
    runId: run.id,
    mode: policy.mode,
    cadence,
    asOf: runDate,
    duplicate: false,
    status: "staging_only",
    stagingOnly: true,
    sourceRefreshCompleted: false,
    publicationAttempted: false,
    stagedResearchRunId: staged.runId,
    stagedTaskCount: staged.taskCount,
    scopes: staged.scopes,
    candidates: candidateCount,
    published: publishedCount,
    blocked: blockedCount,
    shadowEligible: 0,
    errors: 0,
    remaining: 0,
  };
}

async function verifyCron(req, expectedJob, options = {}) {
  if (!expectedJob) throw new ApiError(410, "The unscoped graph refresh route is retired.");
  const authorization = await authorizeScheduledRequest(req, expectedJob, process.env, options);
  if (!authorization.ok) throw new ApiError(authorization.status, authorization.error);
  return authorization;
}

module.exports = {
  ApiError,
  authorizeManualReview,
  compare,
  createResearchTasks,
  getConfig,
  investigate,
  param,
  parseAsOf,
  parseBody,
  parseHops,
  recordManualDecision,
  requiredEntityId,
  runRefresh,
  searchEntities,
  sendError,
  sendJson,
  setCors,
  verifyCron,
  verifyUser,
  _test: {
    constantTimeEqual,
    evidenceSummary,
    isPrivilegedGraphReviewer,
    relationshipActiveAt,
    refreshScopes: REFRESH_SCOPES,
    shortestPath,
    userCanReviewCandidate,
  },
};
