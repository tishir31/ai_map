// Generated from src/lib/ecosystemSnapshot.ts validation contracts. Do not edit.
// Source SHA256 ae95bfb6d4d00332335da29d80b5e1b31a20951f4c9694e9f63541edaaebecd1
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var stdin_exports = {};
__export(stdin_exports, {
  validateEcosystemDataset: () => validateEcosystemDataset,
  validateEcosystemReferences: () => validateEcosystemReferences,
  validateGraphSnapshotManifest: () => validateGraphSnapshotManifest
});
module.exports = __toCommonJS(stdin_exports);
const fail = (path, reason) => {
  throw new Error(`${path}: ${reason}`);
};
const object = (value, path) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return fail(path, "expected object");
  return value;
};
const string = (v, p) => {
  if (typeof v !== "string") fail(p, "expected string");
};
const number = (v, p) => {
  if (typeof v !== "number" || !Number.isFinite(v)) fail(p, "expected finite number");
};
const boolean = (v, p) => {
  if (typeof v !== "boolean") fail(p, "expected boolean");
};
const choice = (...values) => (v, p) => {
  if (!values.includes(v)) fail(p, "unsupported value");
};
const nullable = (check) => (v, p) => {
  if (v !== null) check(v, p);
};
const optional = (check) => (v, p) => {
  if (v !== void 0) check(v, p);
};
const list = (check) => (v, p) => {
  if (!Array.isArray(v)) return fail(p, "expected array");
  v.forEach((item, i) => check(item, `${p}[${i}]`));
};
const shape = (fields) => (v, p) => {
  const value = object(v, p);
  for (const key of Object.keys(value)) if (!Object.hasOwn(fields, key)) fail(`${p}.${key}`, "unknown public field");
  for (const [key, check] of Object.entries(fields)) check(value[key], `${p}.${key}`);
};
const strings = list(string);
const date = (v, p) => {
  string(v, p);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0, 10) !== v) fail(p, "invalid ISO date");
};
const timestamp = (v, p) => {
  string(v, p);
  if (!Number.isFinite(Date.parse(v))) fail(p, "invalid timestamp");
};
const eventDate = (v, p) => {
  string(v, p);
  if (/^\d{4}$/.test(v) || /^\d{4}-(0[1-9]|1[0-2])$/.test(v)) return;
  date(v, p);
};
const url = (v, p) => {
  string(v, p);
  let parsed;
  try {
    parsed = new URL(v);
  } catch {
    return fail(p, "invalid public URL");
  }
  if (!["https:", "http:"].includes(parsed.protocol) || parsed.username || parsed.password) fail(p, "invalid public URL");
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[::1\])/i.test(parsed.hostname)) fail(p, "private URL");
  if (/mail\.google\.|gmail\./i.test(parsed.hostname)) fail(p, "private mailbox URL");
};
const precision = choice("day", "month", "year", "unknown");
const progress = list(choice("paper", "code", "prototype", "pilot", "deployment", "unknown"));
const areaId = choice("robot-learning", "robot-platforms", "autonomous-mobility", "perception-edge", "data-simulation", "industrial-deployment", "physics-engineering", "scientific-systems");
const coverageStatus = choice("complete_against_declared_source", "publisher_selection", "inaccessible", "not_found", "unresolved");
const sourceOutcome = choice("checked", "inaccessible", "not_found", "unresolved");
const valueCheck = shape({
  value: nullable(string),
  claimClass: choice("verified_fact", "company_or_firm_claim", "analyst_interpretation", "unknown_diligence_gap"),
  sourceIds: strings,
  note: optional(string),
  observedAt: date,
  eventDate: optional(nullable(eventDate)),
  effectiveDate: optional(nullable(eventDate)),
  datePrecision: optional(precision)
});
const entityCheck = shape({
  id: string,
  typedId: optional(nullable(string)),
  kind: choice("person", "company", "vc_firm", "university", "lab", "organization", "paper", "thesis", "idea", "project", "software", "dataset", "model", "benchmark", "product"),
  subtype: optional(nullable(string)),
  canonicalName: string,
  displayName: string,
  aliases: strings,
  externalIds: (v, p) => {
    for (const [k, val] of Object.entries(object(v, p))) {
      if (/private|email|gmail|token|secret/i.test(k)) fail(p, "private identifier");
      (Array.isArray(val) ? strings : string)(val, `${p}.${k}`);
    }
  },
  lifecycleStatus: optional(nullable(string)),
  visibility: optional(choice("public"))
});
const relationshipCheck = shape({
  id: string,
  subjectId: string,
  predicate: string,
  objectId: string,
  layer: choice("institutional", "research", "company", "capital"),
  temporal: shape({ startYear: nullable(number), endYear: nullable(number), startDate: optional(nullable(date)), endDate: optional(nullable(date)), startMonth: optional(nullable(string)), endMonth: optional(nullable(string)), precision: choice("exact", "exact_start", "exact_end", "exact_range", "approximate", "undated") }),
  evidenceIds: strings,
  status: choice("published"),
  derived: boolean,
  conclusionLabel: optional(choice("Verified fact", "Derived signal")),
  revision: number,
  collectionIds: optional(strings),
  semanticKey: optional(string),
  note: optional(string),
  authorPosition: optional(number),
  isFirstAuthor: optional(boolean),
  authorshipNote: optional(string),
  authorResolutionTier: optional(choice(1, 2)),
  authorResolutionMethod: optional(string),
  paperCount: optional(number),
  firstYear: optional(number),
  lastYear: optional(number),
  sharedPaperIds: optional(strings)
});
const evidenceCheck = shape({ id: string, url, publisher: string, tier: choice("primary", "official", "secondary", "weak"), locator: nullable(string), retrievedAt: date, stance: choice("supports", "contradicts", "qualifies", "context") });
const collectionCheck = shape({ id: string, title: string, summary: string, entityIds: strings, relationshipIds: strings, sourceUniverse: shape({ description: string, status: coverageStatus }) });
const datasetCheck = shape({
  schemaVersion: choice("1.0.0"),
  version: string,
  researchAsOf: date,
  publishedAt: nullable(timestamp),
  areas: list(shape({ id: areaId, title: string, question: string, description: string, color: string, position: shape({ x: number, y: number }), taxonomyLabels: strings })),
  communities: list(shape({ id: string, collectionId: string, areaId, title: string, problem: string, whyItMatters: string, approaches: strings, hubIds: strings, anchorWorkIds: strings, personIds: strings, companyIds: strings, sourceIds: strings, coverage: shape({ status: choice("publisher_selection", "complete_against_declared_source", "unresolved"), description: string, gaps: strings, checkedAt: date }) })),
  profiles: list(shape({ entityId: string, communityIds: strings, roles: list(choice("researcher", "engineer", "maintainer", "founder", "leader")), currentRole: valueCheck, professionalBase: valueCheck, education: list(valueCheck), advisers: list(valueCheck), contribution: valueCheck, workIds: strings, companyIds: strings, progress, fundingStage: nullable(string), whyExplore: string, gaps: strings, checkedAt: date })),
  works: list(shape({ entityId: string, communityIds: strings, problem: string, contribution: string, selectionRationale: string, contributorIds: strings, sourceIds: strings, progress, repositoryUrl: optional(nullable(url)), license: optional(nullable(string)), checkedAt: date, eventDate: optional(nullable(date)), gaps: strings })),
  sources: list(shape({ id: string, url, title: string, publisher: string, kind: choice("institution", "personal", "company", "investor", "publication", "repository", "registry"), checkedAt: date, outcome: sourceOutcome, excerpt: optional(string), contentHash: optional(string), publishedAt: optional(nullable(timestamp)) })),
  reportedClaims: list(shape({ id: string, entityId: string, kind: choice("funding", "formation", "pilot", "deployment", "product", "performance", "status"), text: string, attribution: choice("company", "investor", "institution", "personal"), sourceIds: strings, eventDate: nullable(eventDate), datePrecision: precision, observedAt: date, publishedAt: nullable(timestamp), revision: number })),
  changes: list(shape({ id: string, kind: choice("event", "newly_mapped", "correction"), summary: string, entityIds: strings, communityIds: strings, sourceIds: strings, eventDate: nullable(date), observedAt: date, publishedAt: nullable(timestamp) })),
  researchOutcomes: list(shape({ entityId: optional(string), communityId: optional(string), sourceUrl: url, outcome: sourceOutcome, checkedAt: date, note: string })),
  extensions: shape({ entities: list(entityCheck), relationships: list(relationshipCheck), evidence: list(evidenceCheck), collections: list(collectionCheck) })
});
function validateEcosystemDataset(value) {
  datasetCheck(value, "discovery");
  const dataset = value;
  const preciseDate = (value2, precision2, label) => {
    if (value2 == null) return;
    const length = precision2 === "year" ? 4 : precision2 === "month" ? 7 : precision2 === "day" || precision2 === void 0 ? 10 : 0;
    if (value2.length !== length) fail(label, "event date does not match declared precision");
  };
  for (const claim of dataset.reportedClaims) preciseDate(claim.eventDate, claim.datePrecision, claim.id);
  for (const profile of dataset.profiles) {
    for (const value2 of [profile.currentRole, profile.professionalBase, profile.contribution, ...profile.education, ...profile.advisers]) {
      preciseDate(value2.eventDate, value2.datePrecision, profile.entityId);
      preciseDate(value2.effectiveDate, value2.datePrecision, profile.entityId);
    }
  }
  return dataset;
}
function ids(items, id, label) {
  const result = /* @__PURE__ */ new Set();
  for (const item of items) {
    const key = id(item);
    if (!key || result.has(key)) fail(label, "empty or duplicate ID");
    result.add(key);
  }
  return result;
}
function references(values, known, label) {
  for (const id of values) if (!known.has(id)) fail(label, `unresolved reference ${id}`);
}
function validateEcosystemReferences(graph, dataset) {
  const entities = ids(graph.entities, (x) => x.id, "entities");
  const relationships = ids(graph.relationships, (x) => x.id, "relationships");
  const evidence = ids(graph.evidence, (x) => x.id, "evidence");
  const collections = ids(graph.collections, (x) => x.id, "collections");
  const communities = ids(dataset.communities, (x) => x.id, "communities");
  const areas = ids(dataset.areas, (x) => x.id, "areas");
  const sources = ids(dataset.sources, (x) => x.id, "sources");
  ids(dataset.profiles, (x) => x.entityId, "profiles");
  ids(dataset.works, (x) => x.entityId, "works");
  ids(dataset.changes, (x) => x.id, "changes");
  ids(dataset.reportedClaims, (x) => x.id, "claims");
  for (const relationship of graph.relationships) {
    references([relationship.subjectId, relationship.objectId], entities, relationship.id);
    references(relationship.evidenceIds, evidence, relationship.id);
  }
  for (const collection of graph.collections) {
    references(collection.entityIds, entities, collection.id);
    references(collection.relationshipIds, relationships, collection.id);
  }
  for (const community of dataset.communities) {
    references([community.areaId], areas, community.id);
    references([community.collectionId], collections, community.id);
    references([...community.hubIds, ...community.anchorWorkIds, ...community.personIds, ...community.companyIds], entities, community.id);
    references(community.sourceIds, sources, community.id);
  }
  for (const profile of dataset.profiles) {
    references([profile.entityId, ...profile.workIds, ...profile.companyIds], entities, profile.entityId);
    references(profile.communityIds, communities, profile.entityId);
    for (const val of [profile.currentRole, profile.professionalBase, profile.contribution, ...profile.education, ...profile.advisers]) {
      references(val.sourceIds, sources, profile.entityId);
      if (val.value !== null && val.claimClass !== "unknown_diligence_gap" && val.sourceIds.length === 0) fail(profile.entityId, "unsupported profile value");
    }
  }
  for (const work of dataset.works) {
    references([work.entityId, ...work.contributorIds], entities, work.entityId);
    references(work.communityIds, communities, work.entityId);
    references(work.sourceIds, sources, work.entityId);
  }
  for (const claim of dataset.reportedClaims) {
    references([claim.entityId], entities, claim.id);
    references(claim.sourceIds, sources, claim.id);
    if (!claim.sourceIds.length) fail(claim.id, "claim needs attribution evidence");
  }
  for (const change of dataset.changes) {
    references(change.entityIds, entities, change.id);
    references(change.communityIds, communities, change.id);
    references(change.sourceIds, sources, change.id);
  }
  for (const outcome of dataset.researchOutcomes) {
    if (outcome.entityId) references([outcome.entityId], entities, "research outcome");
    if (outcome.communityId) references([outcome.communityId], communities, "research outcome");
  }
}
const positiveCount = (v, p) => {
  number(v, p);
  if (!Number.isInteger(v) || v < 0) fail(p, "expected nonnegative count");
};
function validateGraphSnapshotManifest(value) {
  shape({
    ok: choice(true),
    version: string,
    publishedAt: timestamp,
    researchAsOf: date,
    schemaVersion: choice("1.0.0"),
    shards: list(shape({ name: choice("core", "research", "discovery"), url: string, sha256: (v, p) => {
      string(v, p);
      if (!/^[a-f0-9]{64}$/i.test(v)) fail(p, "invalid SHA256");
    } })),
    coverage: shape({ checked: positiveCount, held: positiveCount, failed: positiveCount, remaining: positiveCount, delayedAreas: optional(strings) }),
    status: choice("published", "partial")
  })(value, "manifest");
  const manifest = value;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(manifest.version)) fail("manifest", "invalid version");
  if (manifest.shards.length !== 3 || new Set(manifest.shards.map((s) => s.name)).size !== 3) fail("manifest", "incomplete shard set");
  return manifest;
}
