"use strict";
const crypto = require("node:crypto");
const graph = require("./graph-api");
const strict = require("./ecosystem-validator.cjs");
const SHARDS = ["core", "research", "discovery"];
const VERSION_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,100}$/;
const hash = (value) => crypto.createHash("sha256").update(value).digest("hex");
function version(value) { if (!VERSION_RE.test(value)) throw new graph.ApiError(400, "Invalid snapshot version."); return value; }
async function db(config, name, options = {}) { return graph.restRequest(config, name, options); }
async function manifest(config, selectedVersion) {
  const rows = await db(config, "ecosystem_snapshot_releases", { params: { select: "manifest", is_public: "eq.true", ...(selectedVersion ? { version: `eq.${version(selectedVersion)}` } : { active: "eq.true" }), limit: 1 } });
  if (!rows?.[0]?.manifest) throw new graph.ApiError(503, "No complete public ecosystem snapshot is available.");
  return rows[0].manifest;
}
async function shard(config, selectedVersion, name) {
  version(selectedVersion);
  if (!SHARDS.includes(name)) throw new graph.ApiError(400, "Unknown snapshot shard.");
  const release = await manifest(config, selectedVersion);
  const rows = await db(config, "ecosystem_snapshot_shards", { params: { select: "payload,sha256", version: `eq.${selectedVersion}`, name: `eq.${name}`, limit: 1 } });
  const item = rows?.[0];
  if (!item || hash(item.payload) !== item.sha256 || release.shards.find(x => x.name === name)?.sha256 !== item.sha256) throw new graph.ApiError(503, "Public snapshot shard failed its integrity check.");
  return item.payload;
}
async function load(config, selectedVersion) {
  const release = await manifest(config, selectedVersion);
  const payloads = await Promise.all(SHARDS.map(name => shard(config, release.version, name)));
  return { manifest: release, ...Object.fromEntries(SHARDS.map((name, i) => [name, JSON.parse(payloads[i])])) };
}
function mergeById(left, right) { return [...new Map([...left, ...right].map(x => [x.id, x])).values()]; }
async function snapshotGraph(snapshot) {
  const runtime = await import("./graph-runtime.mjs");
  const base = runtime.hydrateRuntimeShard(snapshot.core);
  const research = runtime.hydrateRuntimeShard(snapshot.research);
  const extension = snapshot.discovery.extensions;
  for(const name of ['entities','relationships','evidence']) {
    const existing=new Map([...base[name],...research[name]].map(x=>[x.id,x]));const seen=new Set();
    for(const item of extension[name]) {
      if(seen.has(item.id))throw Error(`Duplicate extension ${name} ID`);seen.add(item.id);const previous=existing.get(item.id);if(!previous)continue;
      const keys=name==='entities'?['kind','canonicalName']:name==='relationships'?['subjectId','objectId','predicate']:['url'];
      if(keys.some(key=>previous[key]!==item[key]))throw Error(`Canonical ${name} identity collision`);
    }
  }
  const merged = { metadata: base.metadata };
  for (const name of ["entities", "relationships", "evidence", "facts", "collections", "authorMentions", "signalDefinitions"]) merged[name] = mergeById(mergeById(base[name] || [], research[name] || []), extension[name] || []);
  const collectionMap=new Map();
  for(const collection of [...base.collections,...research.collections,...(extension.collections||[])]) {const old=collectionMap.get(collection.id);collectionMap.set(collection.id,old ? {...old,...collection,entityIds:[...new Set([...old.entityIds,...collection.entityIds])],relationshipIds:[...new Set([...old.relationshipIds,...collection.relationshipIds])]} : collection);}
  merged.collections=[...collectionMap.values()];
  merged.coverage = [...base.coverage, ...research.coverage];
  return merged;
}
function validateDiscovery(discovery, existingIds = new Set()) {
  strict.validateEcosystemDataset(discovery);
  if (discovery?.schemaVersion !== "1.0.0" || !VERSION_RE.test(discovery.version || "")) throw Error("Unsupported discovery schema/version");
  for (const key of ["areas", "communities", "profiles", "works", "sources", "reportedClaims", "changes", "researchOutcomes"]) if (!Array.isArray(discovery[key])) throw Error(`Discovery ${key} must be an array`);
  for (const key of ["entities", "relationships", "evidence", "collections"]) if (!Array.isArray(discovery.extensions?.[key])) throw Error(`Discovery extension ${key} must be an array`);
  const ids = new Set([...existingIds, ...discovery.extensions.entities.map(x => x.id)]);
  const sourceIds = new Set(discovery.sources.map(x => x.id));
  const evIds = new Set(discovery.extensions.evidence.map(x => x.id));
  const check = (values, universe, label) => { for (const id of values || []) if (!universe.has(id)) throw Error(`${label} references missing ID ${id}`); };
  for (const profile of discovery.profiles) { check([profile.entityId, ...profile.workIds, ...profile.companyIds], ids, "Profile"); for (const value of [profile.currentRole, profile.professionalBase, profile.contribution, ...profile.education, ...profile.advisers]) check(value.sourceIds, sourceIds, "Profile source"); }
  for (const work of discovery.works) { check([work.entityId, ...work.contributorIds], ids, "Work"); check(work.sourceIds, sourceIds, "Work source"); }
  for (const community of discovery.communities) { check([...community.hubIds, ...community.anchorWorkIds, ...community.personIds, ...community.companyIds], ids, "Community"); check(community.sourceIds, sourceIds, "Community source"); }
  for (const claim of discovery.reportedClaims) { check([claim.entityId], ids, "Claim"); check(claim.sourceIds, sourceIds, "Claim source"); if (!claim.attribution || claim.datePrecision === "day" && !/^\d{4}-\d{2}-\d{2}$/.test(claim.eventDate || "")) throw Error("Invalid attributed claim date"); }
  for (const relationship of discovery.extensions.relationships) { check([relationship.subjectId, relationship.objectId], ids, "Relationship"); check(relationship.evidenceIds, evIds, "Relationship evidence"); if (!relationship.evidenceIds.length || relationship.status !== "published") throw Error("Unpublished or unsupported extension relationship"); }
  for (const source of discovery.sources) { const parsed = new URL(source.url); if (!["https:", "http:"].includes(parsed.protocol)) throw Error("Invalid public source URL"); }
  const text = JSON.stringify(discovery);
  if (/gmail:|@citi\.com|SUPABASE_SERVICE_ROLE_KEY|"(?:privateDossier|reviewNotes|owner_id|access_token|localNotes)"/i.test(text)) throw Error("Discovery failed public boundary validation");
  return true;
}
async function prepare(snapshot, { selectedVersion, publishedAt = new Date().toISOString(), coverage = { checked: 0, held: 0, failed: 0, remaining: 0 }, status = "published" } = {}) {
  const runtime = await import("./graph-runtime.mjs");
  version(selectedVersion);
  const output = structuredClone(snapshot);
  output.discovery.version = selectedVersion;
  output.discovery.publishedAt = publishedAt;
  for (const name of ["core", "research"]) { output[name].metadata.snapshotVersion = selectedVersion; runtime.validateRuntimeTransport(output[name]); }
  const ids = new Set([...output.core.entities, ...output.research.entities].map(x => x[0]));
  validateDiscovery(output.discovery, ids);
  strict.validateEcosystemReferences(await snapshotGraph(output), output.discovery);
  const shards = SHARDS.map(name => { const payload = JSON.stringify(output[name]); runtime.assertPublicSafeOutput(payload, name); return { name, payload, sha256: hash(payload) }; });
  const result = { ok: true, version: selectedVersion, publishedAt, researchAsOf: output.discovery.researchAsOf, schemaVersion: "1.0.0", status, coverage, shards: shards.map(({ name, sha256 }) => ({ name, sha256, url: `/api/graph-snapshot?version=${encodeURIComponent(selectedVersion)}&shard=${name}` })) };
  strict.validateGraphSnapshotManifest(result);
  return { manifest: result, shards };
}
async function publish(config, prepared, { runId = null, expectedVersion = null, activate = true, lock = null } = {}) {
  return db(config, "publish_ecosystem_snapshot", { method: "POST", rpc: true, body: { p_manifest: prepared.manifest, p_shards: prepared.shards, p_run_id: runId, p_expected_version: expectedVersion, p_activate: activate, p_lock: lock } });
}
async function handler(req, res) {
  graph.setCors(req, res);
  if (req.method === "OPTIONS") return graph.sendJson(res, 204, null);
  if (req.method !== "GET") return graph.sendJson(res, 405, { ok: false, error: "Use GET." });
  try {
    const selected = graph.param(req, "version"); const name = graph.param(req, "shard"); const config = graph.getConfig();
    if (name) {
      if (!selected) throw new graph.ApiError(400, "A version is required for shard requests.");
      const payload = await shard(config, selected, name);
      res.statusCode = 200; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "public, max-age=31536000, immutable"); res.setHeader("ETag", `"${hash(payload)}"`); return res.end(payload);
    }
    return graph.sendJson(res, 200, await manifest(config, selected || undefined), "public, max-age=0, s-maxage=60, must-revalidate");
  } catch (error) { return graph.sendError(res, error); }
}
module.exports = { SHARDS, hash, version, manifest, shard, load, snapshotGraph, validateDiscovery, prepare, publish, handler };
