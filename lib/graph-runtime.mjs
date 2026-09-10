import { Buffer } from "node:buffer";
import { readFile, rename, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const SCRIPT_DIR = resolve(SCRIPT_PATH, "..");
const REPO_ROOT = resolve(SCRIPT_DIR, "..");
const DEFAULT_INPUT = resolve(REPO_ROOT, "src/data/knowledgeGraphData.json");
const DEFAULT_CORE_OUTPUT = resolve(REPO_ROOT, "src/data/knowledgeGraphRuntimeData.json");
const DEFAULT_RESEARCH_OUTPUT = resolve(REPO_ROOT, "src/data/knowledgeGraphResearchRuntimeData.json");

export const RUNTIME_FORMAT = "knowledge-graph-runtime-v2";
export const RUNTIME_FORMAT_VERSION = "2.2.0";
export const MAX_SHARD_BYTES = 2_500_000;

const CORE_EXCLUDED_PREDICATES = new Set(["authored", "coauthored_with"]);
const RESEARCH_PREDICATE = "authored";
const VALID_ENTITY_KINDS = new Set([
  "person", "company", "vc_firm", "university", "lab", "organization",
  "paper", "thesis", "idea", "project", "software", "dataset", "model",
  "benchmark", "product",
]);
const ARTIFACT_KINDS = new Set(["project", "software", "dataset", "model", "benchmark", "product"]);
const PUBLIC_CONCLUSION_LABELS = new Set(["Verified fact", "Derived signal"]);
const PRIVATE_OUTPUT_PATTERNS = [
  ["private source identifier or Citi email", /(\b19[a-f0-9]{14}\b|\bgmail:[a-z0-9_-]{8,}\b|\blocal-rq-(?:anduril|theinformation)[a-z0-9_-]*\b|\brq-gmail-ti-[a-z0-9_-]+\b|\b[a-z0-9._%+-]+@citi\.com\b|hello@theinformation\.com|19de0bccce4437b1|19d3e7330194db8b|19cf65942ba98643|Founders Fund Takes a Bigger Bite of Anduril|Ex-Uber CEO Kalanick Plots Self-Driving Car Firm with Uber Funding|Google Reportedly in Talks to Finance Multibillion-dollar Data Center for Anthropic)/i],
  ["sample fixture", /(Sample data:|Sample candidate|example\.com\/sample|Include sample data|Aegis Motion Systems|Apex Humanoids)/i],
  ["private research fallback", /(?:\brun-physical-ai\b|\brr-figure\b|2026-05-24T18:20:00\.000Z|Recent round and strategic investor mix make this a high-priority lead\.|Consumer humanoid positioning; verify commercial deployments before outreach\.|Strategic industrial pilots make this a core humanoid banking target\.|Build a market map of the physical AI landscape for an investment banking MD\.|Agents are building a banker-grade company universe)/i],
  ["private relationship operating field", /(?:Warm Path \/ Connector|Coverage Owner|Relationship Stage|Not Contacted|\bCiti\b|analyst-created profile|approved review queue|during diligence|institutional route|banker-grade|65-company founder enrichment|prior academic lineage to map|next role not located)/i],
  ["Google News aggregator evidence URL", /\bnews\.google\.com\b/i],
];

const TRANSPORT_COLUMNS = {
  entities: [
    "id", "typedId", "kind", "subtype", "canonicalName", "displayName",
    "aliases", "externalIds", "lifecycleStatus",
  ],
  relationships: [
    "id", "subject", "predicate", "object", "layer", "startYear", "endYear",
    "precision", "evidence", "derived", "conclusionLabel", "revision", "collections",
    "semanticKey", "note", "authorResolutionTier", "authorResolutionMethod", "paperCount",
    "firstYear", "lastYear", "sharedPaperIds", "authorPosition", "authorshipNote", "originalLabel", "isFirstAuthor",
    "startDate", "endDate", "startMonth", "endMonth",
  ],
  evidence: ["id", "url", "publisher", "tier", "locator", "retrievedAt", "stance"],
  facts: [
    "id", "entity", "metric", "factType", "displayValue", "numericValue", "currency",
    "periodLabel", "disclosureStatus", "coverageOutcome", "asOf", "evidence", "conclusionLabel", "revision",
  ],
  authorMentions: [
    "id", "collection", "paper", "displayName", "authorOrder", "resolution",
    "resolutionTier", "resolutionMethod", "resolvedEntity", "relationship", "evidence", "locator", "isFirstAuthor",
  ],
  collections: [
    "id", "title", "summary", "entities", "relationships", "sourceDescription",
    "sourceStatus", "entityCount", "relationshipCount", "authorMentionCount", "entityKindCounts",
  ],
  redirects: ["fromId", "toEntity"],
};

function compareText(left, right) {
  return String(left).localeCompare(String(right), "en");
}

function sortedById(records) {
  return [...records].sort((left, right) => compareText(left.id, right.id));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertArray(value, label) {
  assert(Array.isArray(value), `${label} must be an array.`);
}

function assertUniqueIds(records, label) {
  const seen = new Set();
  for (const record of records) {
    assert(record && typeof record === "object", `${label} contains a non-object record.`);
    assert(typeof record.id === "string" && record.id.length > 0, `${label} contains a record without an ID.`);
    assert(!seen.has(record.id), `${label} contains duplicate ID ${record.id}.`);
    seen.add(record.id);
  }
}

function validatePublicSource(source) {
  assert(source && typeof source === "object", "Canonical graph must be a JSON object.");
  assert(source.metadata?.publicSafe === true, "Refusing runtime projection: metadata.publicSafe must be exactly true.");
  assert(source.metadata?.access === "public", "Refusing runtime projection: metadata.access must be exactly public.");
  assertArray(source.entities, "entities");
  assertArray(source.relationships, "relationships");
  assertArray(source.evidence, "evidence");
  assertArray(source.facts ?? [], "facts");
  assertArray(source.collections ?? [], "collections");
  assertArray(source.authorMentions ?? [], "authorMentions");
  assertUniqueIds(source.entities, "entities");
  assertUniqueIds(source.relationships, "relationships");
  assertUniqueIds(source.evidence, "evidence");
  assertUniqueIds(source.facts ?? [], "facts");
  assertUniqueIds(source.collections ?? [], "collections");
  assertUniqueIds(source.authorMentions ?? [], "authorMentions");

  for (const entity of source.entities) {
    assert(VALID_ENTITY_KINDS.has(entity.kind), `Entity ${entity.id} has unsupported kind ${entity.kind}.`);
    assert(entity.visibility !== "private", `Entity ${entity.id} is explicitly private.`);
  }
  for (const relationship of source.relationships) {
    const conclusion = relationship.conclusionLabel ?? relationship.assertionLabel;
    assert(conclusion !== "Analyst thesis", `Relationship ${relationship.id} contains a private analyst thesis.`);
    if (conclusion != null) {
      assert(PUBLIC_CONCLUSION_LABELS.has(conclusion), `Relationship ${relationship.id} has unsupported conclusion label ${conclusion}.`);
    }
  }
  for (const fact of source.facts ?? []) {
    assert(fact.publicationState === "published" || fact.status === "published", `Fact ${fact.id} is not published.`);
    assert(fact.conclusionLabel === "Verified fact", `Fact ${fact.id} is not a public verified fact.`);
    assert(Array.isArray(fact.evidenceIds) && fact.evidenceIds.length > 0, `Fact ${fact.id} has no evidence.`);
  }
  assert(!(source.metadata.labels ?? []).includes("analyst_thesis"), "Canonical graph advertises analyst_thesis content.");
}

function stableExternalIds(externalIds) {
  if (!externalIds || typeof externalIds !== "object" || Array.isArray(externalIds)) return {};
  return Object.fromEntries(
    Object.entries(externalIds)
      .sort(([left], [right]) => compareText(left, right))
      .map(([key, value]) => [
        key,
        Array.isArray(value)
          ? [...new Set(value.map(String))].sort(compareText)
          : String(value),
      ]),
  );
}

function projectEntity(entity) {
  return {
    id: entity.id,
    typedId: entity.typedId ?? null,
    kind: entity.kind,
    subtype: entity.subtype ?? null,
    canonicalName: entity.canonicalName,
    displayName: entity.displayName || entity.canonicalName,
    aliases: Array.isArray(entity.aliases) ? [...new Set(entity.aliases.map(String))].sort(compareText) : [],
    externalIds: stableExternalIds(entity.externalIds),
    lifecycleStatus: entity.lifecycleStatus ?? null,
    visibility: "public",
  };
}

function projectRelationship(relationship) {
  return {
    id: relationship.id,
    subjectId: relationship.subjectId,
    predicate: relationship.predicate,
    objectId: relationship.objectId,
    layer: relationship.layer,
    temporal: {
      startYear: relationship.temporal?.startYear ?? null,
      endYear: relationship.temporal?.endYear ?? null,
      startDate: relationship.temporal?.startDate ?? null,
      endDate: relationship.temporal?.endDate ?? null,
      startMonth: relationship.temporal?.startMonth ?? null,
      endMonth: relationship.temporal?.endMonth ?? null,
      precision: relationship.temporal?.precision ?? "undated",
    },
    evidenceIds: [...new Set(relationship.evidenceIds ?? [])].sort(compareText),
    status: "published",
    derived: Boolean(relationship.derived),
    conclusionLabel: relationship.conclusionLabel ?? relationship.assertionLabel ?? (relationship.derived ? "Derived signal" : "Verified fact"),
    revision: Number.isInteger(relationship.revision) ? relationship.revision : 1,
    collectionIds: [...new Set(relationship.collectionIds ?? [])].sort(compareText),
    semanticKey: relationship.semanticKey ?? null,
    note: relationship.note ?? null,
    authorResolutionTier: relationship.authorResolutionTier ?? null,
    authorResolutionMethod: relationship.authorResolutionMethod ?? null,
    paperCount: relationship.paperCount ?? null,
    firstYear: relationship.firstYear ?? null,
    lastYear: relationship.lastYear ?? null,
    sharedPaperIds: [...new Set(relationship.sharedPaperIds ?? [])].sort(compareText),
    authorPosition: relationship.authorPosition ?? null,
    isFirstAuthor: typeof relationship.isFirstAuthor === "boolean" ? relationship.isFirstAuthor : null,
    authorshipNote: relationship.authorshipNote ?? null,
    originalLabel: relationship.originalLabel ?? null,
  };
}

function projectEvidence(evidence) {
  return {
    id: evidence.id,
    url: evidence.url,
    publisher: evidence.publisher,
    tier: evidence.tier,
    locator: evidence.locator ?? null,
    retrievedAt: evidence.retrievedAt,
    stance: evidence.stance,
  };
}

function projectFact(fact) {
  return {
    id: fact.id,
    entityId: fact.entityId,
    metric: fact.metric,
    factType: fact.factType,
    displayValue: fact.displayValue ?? null,
    numericValue: Number.isFinite(fact.numericValue) ? fact.numericValue : null,
    currency: fact.currency ?? null,
    periodLabel: fact.periodLabel ?? null,
    disclosureStatus: fact.disclosureStatus,
    coverageOutcome: fact.coverageOutcome,
    asOf: fact.asOf ?? fact.asOfDate ?? null,
    evidenceIds: [...new Set(fact.evidenceIds ?? [])].sort(compareText),
    conclusionLabel: "Verified fact",
    revision: Number.isInteger(fact.revision) ? fact.revision : 1,
    status: "published",
    publicationState: "published",
  };
}

function projectAuthorMention(mention) {
  return {
    id: mention.id,
    collectionId: mention.collectionId,
    paperId: mention.paperId,
    displayName: mention.displayName,
    authorOrder: mention.authorOrder,
    isFirstAuthor: mention.isFirstAuthor === true,
    resolution: mention.resolution ?? (mention.resolvedEntityId ? "resolved" : "unresolved"),
    resolutionTier: mention.resolutionTier ?? null,
    resolutionMethod: mention.resolutionMethod ?? null,
    resolvedEntityId: mention.resolvedEntityId ?? null,
    relationshipId: mention.relationshipId ?? null,
    evidenceIds: [...new Set(mention.evidenceIds ?? [])].sort(compareText),
    locator: mention.locator ?? null,
  };
}

function projectionCounts(entities, relationships, evidence, facts, collections, authorMentions, redirects) {
  const years = relationships.flatMap((relationship) => [
    relationship.temporal.startYear,
    relationship.temporal.endYear,
  ]).filter(Number.isInteger);
  return {
    entities: entities.length,
    relationships: relationships.length,
    evidence: evidence.length,
    facts: facts.length,
    authorMentions: authorMentions.length,
    collections: collections.length,
    redirects: redirects.length,
    people: entities.filter((entity) => entity.kind === "person").length,
    companies: entities.filter((entity) => entity.kind === "company").length,
    papers: entities.filter((entity) => entity.kind === "paper").length,
    ideas: entities.filter((entity) => entity.kind === "idea").length,
    artifacts: entities.filter((entity) => ARTIFACT_KINDS.has(entity.kind)).length,
    minYear: years.length > 0 ? Math.min(...years) : null,
    maxYear: years.length > 0 ? Math.max(...years) : null,
  };
}

function projectCollections(source, role, entityIds, relationshipIds, authorMentions) {
  const mentionCounts = new Map();
  for (const mention of authorMentions) {
    mentionCounts.set(mention.collectionId, (mentionCounts.get(mention.collectionId) ?? 0) + 1);
  }
  const projectedEntityById = new Map(source.entities
    .filter((entity) => entityIds.has(entity.id))
    .map((entity) => [entity.id, entity]));
  return sortedById(source.collections ?? []).map((collection) => {
    const memberEntityIds = [...new Set((collection.entityIds ?? []).filter((id) => entityIds.has(id)))].sort(compareText);
    const memberRelationshipIds = [...new Set((collection.relationshipIds ?? []).filter((id) => relationshipIds.has(id)))].sort(compareText);
    const entityKinds = {};
    for (const id of memberEntityIds) {
      const kind = projectedEntityById.get(id)?.kind;
      if (kind) entityKinds[kind] = (entityKinds[kind] ?? 0) + 1;
    }
    return {
      id: collection.id,
      title: collection.title,
      summary: collection.summary,
      entityIds: memberEntityIds,
      relationshipIds: memberRelationshipIds,
      sourceUniverse: {
        description: collection.sourceUniverse?.description ?? "Public evidence represented in this bounded collection.",
        status: collection.sourceUniverse?.status ?? "unresolved",
      },
      counts: {
        entities: memberEntityIds.length,
        relationships: memberRelationshipIds.length,
        authorMentions: role === "research" ? (mentionCounts.get(collection.id) ?? 0) : 0,
        entityKinds,
      },
    };
  }).filter((collection) => (
    collection.entityIds.length > 0
    || collection.relationshipIds.length > 0
    || collection.counts.authorMentions > 0
  ));
}

function buildProjection(source, role) {
  validatePublicSource(source);
  const entityById = new Map(source.entities.map((entity) => [entity.id, entity]));
  const evidenceById = new Map(source.evidence.map((record) => [record.id, record]));
  const sourceRelationships = source.relationships.filter((relationship) => relationship.status === "published");
  const selectedRelationships = sourceRelationships.filter((relationship) => (
    role === "core"
      ? !CORE_EXCLUDED_PREDICATES.has(relationship.predicate)
      : relationship.predicate === RESEARCH_PREDICATE
  ));
  const selectedMentions = role === "research" ? (source.authorMentions ?? []) : [];
  const selectedFacts = role === "core" ? (source.facts ?? []) : [];
  const entityIds = new Set();
  const evidenceIds = new Set();

  for (const relationship of selectedRelationships) {
    assert(entityById.has(relationship.subjectId), `${role} relationship ${relationship.id} has missing subject ${relationship.subjectId}.`);
    assert(entityById.has(relationship.objectId), `${role} relationship ${relationship.id} has missing object ${relationship.objectId}.`);
    assert(Array.isArray(relationship.evidenceIds) && relationship.evidenceIds.length > 0, `${role} relationship ${relationship.id} has no evidence.`);
    entityIds.add(relationship.subjectId);
    entityIds.add(relationship.objectId);
    for (const evidenceId of relationship.evidenceIds) {
      assert(evidenceById.has(evidenceId), `${role} relationship ${relationship.id} has missing evidence ${evidenceId}.`);
      evidenceIds.add(evidenceId);
    }
    if (role === "research") {
      assert(entityById.get(relationship.subjectId).kind === "person", `Authored relationship ${relationship.id} subject is not a person.`);
      assert(["paper", "thesis"].includes(entityById.get(relationship.objectId).kind), `Authored relationship ${relationship.id} object is not a paper or thesis.`);
    }
  }

  const authoredRelationshipIds = new Set(selectedRelationships.map((relationship) => relationship.id));
  for (const mention of selectedMentions) {
    assert(entityById.has(mention.paperId), `Author mention ${mention.id} has missing paper ${mention.paperId}.`);
    assert(["paper", "thesis"].includes(entityById.get(mention.paperId).kind), `Author mention ${mention.id} target is not a paper or thesis.`);
    assert(Array.isArray(mention.evidenceIds) && mention.evidenceIds.length > 0, `Author mention ${mention.id} has no evidence.`);
    entityIds.add(mention.paperId);
    if (mention.resolvedEntityId) {
      assert(entityById.has(mention.resolvedEntityId), `Author mention ${mention.id} has missing person ${mention.resolvedEntityId}.`);
      assert(entityById.get(mention.resolvedEntityId).kind === "person", `Author mention ${mention.id} resolves to a non-person.`);
      assert(mention.relationshipId && authoredRelationshipIds.has(mention.relationshipId), `Resolved author mention ${mention.id} lacks its authored relationship.`);
      entityIds.add(mention.resolvedEntityId);
    } else {
      assert(!mention.relationshipId, `Unresolved author mention ${mention.id} unexpectedly links relationship ${mention.relationshipId}.`);
    }
    for (const evidenceId of mention.evidenceIds) {
      assert(evidenceById.has(evidenceId), `Author mention ${mention.id} has missing evidence ${evidenceId}.`);
      evidenceIds.add(evidenceId);
    }
  }

  for (const fact of selectedFacts) {
    assert(entityById.has(fact.entityId), `Fact ${fact.id} has missing entity ${fact.entityId}.`);
    assert(Array.isArray(fact.evidenceIds) && fact.evidenceIds.length > 0, `Fact ${fact.id} has no evidence.`);
    entityIds.add(fact.entityId);
    for (const evidenceId of fact.evidenceIds) {
      assert(evidenceById.has(evidenceId), `Fact ${fact.id} has missing evidence ${evidenceId}.`);
      evidenceIds.add(evidenceId);
    }
  }

  const relationships = sortedById(selectedRelationships).map(projectRelationship);
  const relationshipIds = new Set(relationships.map((relationship) => relationship.id));
  const entities = sortedById(source.entities.filter((entity) => entityIds.has(entity.id))).map(projectEntity);
  const evidence = sortedById(source.evidence.filter((record) => evidenceIds.has(record.id))).map(projectEvidence);
  const facts = sortedById(selectedFacts).map(projectFact);
  const authorMentions = sortedById(selectedMentions).map(projectAuthorMention);
  const collections = projectCollections(source, role, entityIds, relationshipIds, authorMentions);
  const redirects = [...(source.redirects ?? [])]
    .filter((redirect) => entityIds.has(redirect.toId))
    .map((redirect) => ({ fromId: redirect.fromId, toId: redirect.toId }))
    .sort((left, right) => compareText(left.fromId, right.fromId));
  const counts = projectionCounts(entities, relationships, evidence, facts, collections, authorMentions, redirects);

  return {
    role,
    metadata: {
      schemaVersion: source.metadata.schemaVersion,
      asOf: source.metadata.asOf,
      publicSafe: true,
      access: "public",
      counts,
      runtimeProjection: {
        role,
        sourceCounts: source.metadata.counts ?? {},
        sourceEntityCount: source.entities.length,
        sourceRelationshipCount: source.relationships.length,
        sourceEvidenceCount: source.evidence.length,
        sourceFactCount: (source.facts ?? []).length,
        sourceAuthorMentionCount: (source.authorMentions ?? []).length,
        omittedEntityCount: source.entities.length - entities.length,
        omittedRelationshipCount: source.relationships.length - relationships.length,
        omittedEvidenceCount: source.evidence.length - evidence.length,
        omittedFactCount: (source.facts ?? []).length - facts.length,
        omittedAuthorMentionCount: (source.authorMentions ?? []).length - authorMentions.length,
        excludedPredicates: role === "core" ? [...CORE_EXCLUDED_PREDICATES].sort(compareText) : ["coauthored_with"],
        encoding: "indexed_tuple_json",
      },
    },
    entities,
    relationships,
    evidence,
    facts,
    authorMentions,
    collections,
    redirects,
    signalDefinitions: role === "core" ? (source.signalDefinitions ?? []) : [],
    coverage: role === "core" ? (source.coverage ?? []) : [],
  };
}

function makeDictionary(values) {
  const items = [...new Set(values.filter((value) => value != null).map(String))].sort(compareText);
  return { items, index: new Map(items.map((item, position) => [item, position])) };
}

function dictionaryIndex(dictionary, value) {
  return value == null ? -1 : dictionary.index.get(String(value));
}

function canonicalSemanticKey(relationship) {
  return `${relationship.subjectId}|${relationship.predicate}|${relationship.objectId}|${relationship.temporal.startYear ?? ""}|${relationship.temporal.endYear ?? ""}`;
}

// PAM IDs are content-addressed 64-bit hex values. Encoding the suffix in
// base36 both saves bytes and prevents a legitimate public ID from resembling
// the private Gmail-style identifiers rejected by the public bundle scanner.
function encodeMentionId(id) {
  const match = /^PAM-([0-9A-F]{16})$/i.exec(id);
  return match ? `~${BigInt(`0x${match[1]}`).toString(36)}` : id;
}

function parseBase36BigInt(value) {
  let result = 0n;
  for (const character of value.toLowerCase()) {
    const digit = "0123456789abcdefghijklmnopqrstuvwxyz".indexOf(character);
    assert(digit >= 0, `Invalid base36 digit ${character}.`);
    result = (result * 36n) + BigInt(digit);
  }
  return result;
}

function decodeMentionId(id) {
  if (!id.startsWith("~")) return id;
  return `PAM-${parseBase36BigInt(id.slice(1)).toString(16).toUpperCase().padStart(16, "0")}`;
}

function encodeProjection(projection) {
  const kinds = makeDictionary(projection.entities.map((entity) => entity.kind));
  const subtypes = makeDictionary(projection.entities.map((entity) => entity.subtype));
  const lifecycleStatuses = makeDictionary(projection.entities.map((entity) => entity.lifecycleStatus));
  const externalIdKeys = makeDictionary(projection.entities.flatMap((entity) => Object.keys(entity.externalIds)));
  const predicates = makeDictionary(projection.relationships.map((relationship) => relationship.predicate));
  const layers = makeDictionary(projection.relationships.map((relationship) => relationship.layer));
  const precisions = makeDictionary(projection.relationships.map((relationship) => relationship.temporal.precision));
  const publishers = makeDictionary(projection.evidence.map((record) => record.publisher));
  const tiers = makeDictionary(projection.evidence.map((record) => record.tier));
  const stances = makeDictionary(projection.evidence.map((record) => record.stance));
  const conclusionLabels = makeDictionary(projection.relationships.map((relationship) => relationship.conclusionLabel));
  const relationshipNotes = makeDictionary(projection.relationships.map((relationship) => relationship.note));
  const authorshipNotes = makeDictionary(projection.relationships.map((relationship) => relationship.authorshipNote));
  const originalLabels = makeDictionary(projection.relationships.map((relationship) => relationship.originalLabel));
  const resolutionMethods = makeDictionary([
    ...projection.relationships.map((relationship) => relationship.authorResolutionMethod),
    ...projection.authorMentions.map((mention) => mention.resolutionMethod),
  ]);
  const resolutionStatuses = makeDictionary(projection.authorMentions.map((mention) => mention.resolution));
  const collectionStatuses = makeDictionary(projection.collections.map((collection) => collection.sourceUniverse.status));
  const entityIndex = new Map(projection.entities.map((entity, index) => [entity.id, index]));
  const evidenceIndex = new Map(projection.evidence.map((record, index) => [record.id, index]));
  const relationshipIndex = new Map(projection.relationships.map((relationship, index) => [relationship.id, index]));
  const collectionIndex = new Map(projection.collections.map((collection, index) => [collection.id, index]));

  const transport = {
    format: RUNTIME_FORMAT,
    shard: projection.role,
    metadata: {
      ...projection.metadata,
      runtimeSchemaVersion: RUNTIME_FORMAT_VERSION,
      idEncoding: { authorMention: "tilde_base36_uint64" },
    },
    columns: TRANSPORT_COLUMNS,
    dictionaries: {
      entityKinds: kinds.items,
      entitySubtypes: subtypes.items,
      lifecycleStatuses: lifecycleStatuses.items,
      externalIdKeys: externalIdKeys.items,
      predicates: predicates.items,
      layers: layers.items,
      precisions: precisions.items,
      publishers: publishers.items,
      tiers: tiers.items,
      stances: stances.items,
      conclusionLabels: conclusionLabels.items,
      relationshipNotes: relationshipNotes.items,
      authorshipNotes: authorshipNotes.items,
      originalLabels: originalLabels.items,
      resolutionMethods: resolutionMethods.items,
      resolutionStatuses: resolutionStatuses.items,
      collectionStatuses: collectionStatuses.items,
    },
    entities: projection.entities.map((entity) => [
      entity.id,
      entity.typedId,
      dictionaryIndex(kinds, entity.kind),
      dictionaryIndex(subtypes, entity.subtype),
      entity.canonicalName,
      entity.displayName === entity.canonicalName ? null : entity.displayName,
      entity.aliases,
      Object.entries(entity.externalIds).map(([key, value]) => [dictionaryIndex(externalIdKeys, key), value]),
      dictionaryIndex(lifecycleStatuses, entity.lifecycleStatus),
    ]),
    relationships: projection.relationships.map((relationship) => [
      relationship.id,
      entityIndex.get(relationship.subjectId),
      dictionaryIndex(predicates, relationship.predicate),
      entityIndex.get(relationship.objectId),
      dictionaryIndex(layers, relationship.layer),
      relationship.temporal.startYear,
      relationship.temporal.endYear,
      dictionaryIndex(precisions, relationship.temporal.precision),
      relationship.evidenceIds.map((id) => evidenceIndex.get(id)),
      relationship.derived ? 1 : 0,
      dictionaryIndex(conclusionLabels, relationship.conclusionLabel),
      relationship.revision,
      relationship.collectionIds.map((id) => collectionIndex.get(id)).filter(Number.isInteger),
      relationship.semanticKey === canonicalSemanticKey(relationship) ? 1 : relationship.semanticKey,
      dictionaryIndex(relationshipNotes, relationship.note),
      relationship.authorResolutionTier,
      dictionaryIndex(resolutionMethods, relationship.authorResolutionMethod),
      relationship.paperCount,
      relationship.firstYear,
      relationship.lastYear,
      relationship.sharedPaperIds,
      relationship.authorPosition,
      dictionaryIndex(authorshipNotes, relationship.authorshipNote),
      dictionaryIndex(originalLabels, relationship.originalLabel),
      relationship.isFirstAuthor === null ? null : relationship.isFirstAuthor ? 1 : 0,
      relationship.temporal.startDate,
      relationship.temporal.endDate,
      relationship.temporal.startMonth,
      relationship.temporal.endMonth,
    ]),
    evidence: projection.evidence.map((record) => [
      record.id,
      record.url,
      dictionaryIndex(publishers, record.publisher),
      dictionaryIndex(tiers, record.tier),
      record.locator,
      record.retrievedAt,
      dictionaryIndex(stances, record.stance),
    ]),
    facts: projection.facts.map((fact) => [
      fact.id,
      entityIndex.get(fact.entityId),
      fact.metric,
      fact.factType,
      fact.displayValue,
      fact.numericValue,
      fact.currency,
      fact.periodLabel,
      fact.disclosureStatus,
      fact.coverageOutcome,
      fact.asOf,
      fact.evidenceIds.map((id) => evidenceIndex.get(id)),
      fact.conclusionLabel,
      fact.revision,
    ]),
    authorMentions: projection.authorMentions.map((mention) => [
      encodeMentionId(mention.id),
      collectionIndex.get(mention.collectionId) ?? -1,
      entityIndex.get(mention.paperId),
      mention.displayName,
      mention.authorOrder,
      dictionaryIndex(resolutionStatuses, mention.resolution),
      mention.resolutionTier,
      dictionaryIndex(resolutionMethods, mention.resolutionMethod),
      mention.resolvedEntityId ? entityIndex.get(mention.resolvedEntityId) : -1,
      mention.relationshipId ? relationshipIndex.get(mention.relationshipId) : -1,
      mention.evidenceIds.map((id) => evidenceIndex.get(id)),
      mention.locator,
      mention.isFirstAuthor ? 1 : 0,
    ]),
    collections: projection.collections.map((collection) => [
      collection.id,
      collection.title,
      collection.summary,
      collection.entityIds.map((id) => entityIndex.get(id)),
      collection.relationshipIds.map((id) => relationshipIndex.get(id)),
      collection.sourceUniverse.description,
      dictionaryIndex(collectionStatuses, collection.sourceUniverse.status),
      collection.counts.entities,
      collection.counts.relationships,
      collection.counts.authorMentions,
      Object.entries(collection.counts.entityKinds)
        .sort(([left], [right]) => compareText(left, right))
        .map(([kind, count]) => [dictionaryIndex(kinds, kind), count]),
    ]),
    redirects: projection.redirects.map((redirect) => [redirect.fromId, entityIndex.get(redirect.toId)]),
    signalDefinitions: projection.signalDefinitions,
    coverage: projection.coverage,
  };
  validateRuntimeTransport(transport);
  return transport;
}

function at(dictionary, index, label) {
  if (index === -1) return null;
  assert(Number.isInteger(index) && dictionary[index] !== undefined, `Invalid ${label} dictionary index ${index}.`);
  return dictionary[index];
}

export function hydrateRuntimeShard(transport) {
  validateRuntimeTransport(transport);
  const d = transport.dictionaries;
  const entities = transport.entities.map((row) => {
    const externalIds = Object.fromEntries(row[7].map(([keyIndex, value]) => [at(d.externalIdKeys, keyIndex, "external ID key"), value]));
    return {
      id: row[0],
      typedId: row[1],
      kind: at(d.entityKinds, row[2], "entity kind"),
      subtype: at(d.entitySubtypes, row[3], "entity subtype"),
      canonicalName: row[4],
      displayName: row[5] ?? row[4],
      aliases: row[6],
      externalIds,
      lifecycleStatus: at(d.lifecycleStatuses, row[8], "lifecycle status"),
      visibility: "public",
    };
  });
  const evidence = transport.evidence.map((row) => ({
    id: row[0],
    url: row[1],
    publisher: at(d.publishers, row[2], "publisher"),
    tier: at(d.tiers, row[3], "evidence tier"),
    locator: row[4],
    retrievedAt: row[5],
    stance: at(d.stances, row[6], "evidence stance"),
  }));
  const facts = transport.facts.map((row) => ({
    id: row[0],
    entityId: entities[row[1]].id,
    metric: row[2],
    factType: row[3],
    displayValue: row[4],
    numericValue: row[5],
    currency: row[6],
    periodLabel: row[7],
    disclosureStatus: row[8],
    coverageOutcome: row[9],
    asOf: row[10],
    evidenceIds: row[11].map((index) => evidence[index].id),
    conclusionLabel: row[12],
    revision: row[13],
    status: "published",
    publicationState: "published",
  }));
  const collections = transport.collections.map((row) => ({
    id: row[0],
    title: row[1],
    summary: row[2],
    entityIds: row[3].map((index) => entities[index].id),
    relationshipIds: row[4].map((index) => transport.relationships[index][0]),
    sourceUniverse: {
      description: row[5],
      status: at(d.collectionStatuses, row[6], "collection status"),
    },
    counts: {
      entities: row[7],
      relationships: row[8],
      authorMentions: row[9],
      entityKinds: Object.fromEntries(row[10].map(([kindIndex, count]) => [at(d.entityKinds, kindIndex, "entity kind"), count])),
    },
  }));
  const relationships = transport.relationships.map((row) => {
    const relationship = {
      id: row[0],
      subjectId: entities[row[1]].id,
      predicate: at(d.predicates, row[2], "predicate"),
      objectId: entities[row[3]].id,
      layer: at(d.layers, row[4], "layer"),
      temporal: {
        startYear: row[5],
        endYear: row[6],
        startDate: row[25],
        endDate: row[26],
        startMonth: row[27],
        endMonth: row[28],
        precision: at(d.precisions, row[7], "precision"),
      },
      evidenceIds: row[8].map((index) => evidence[index].id),
      status: "published",
      derived: row[9] === 1,
      conclusionLabel: at(d.conclusionLabels, row[10], "conclusion label"),
      revision: row[11],
      collectionIds: row[12].map((index) => collections[index].id),
      note: at(d.relationshipNotes, row[14], "relationship note") ?? undefined,
      authorResolutionTier: row[15] ?? undefined,
      authorResolutionMethod: at(d.resolutionMethods, row[16], "resolution method") ?? undefined,
      paperCount: row[17] ?? undefined,
      firstYear: row[18] ?? undefined,
      lastYear: row[19] ?? undefined,
      sharedPaperIds: row[20]?.length ? row[20] : undefined,
      authorPosition: row[21] ?? undefined,
      authorshipNote: at(d.authorshipNotes, row[22], "authorship note") ?? undefined,
      originalLabel: at(d.originalLabels, row[23], "original label") ?? undefined,
      isFirstAuthor: row[24] === null ? undefined : row[24] === 1,
    };
    relationship.semanticKey = row[13] === 1 ? canonicalSemanticKey(relationship) : (row[13] ?? undefined);
    return relationship;
  });
  const authorMentions = transport.authorMentions.map((row) => ({
    id: decodeMentionId(row[0]),
    collectionId: collections[row[1]].id,
    paperId: entities[row[2]].id,
    displayName: row[3],
    authorOrder: row[4],
    resolution: at(d.resolutionStatuses, row[5], "resolution status"),
    resolutionTier: row[6],
    resolutionMethod: at(d.resolutionMethods, row[7], "resolution method"),
    resolvedEntityId: row[8] === -1 ? null : entities[row[8]].id,
    relationshipId: row[9] === -1 ? null : relationships[row[9]].id,
    evidenceIds: row[10].map((index) => evidence[index].id),
    locator: row[11],
    isFirstAuthor: row[12] === 1,
  }));
  return {
    metadata: transport.metadata,
    entities,
    relationships,
    evidence,
    facts,
    authorMentions,
    collections,
    redirects: transport.redirects.map((row) => ({ fromId: row[0], toId: entities[row[1]].id })),
    signalDefinitions: transport.signalDefinitions,
    coverage: transport.coverage,
  };
}

function validateIndex(index, length, label) {
  assert(Number.isInteger(index) && index >= 0 && index < length, `${label} index ${index} is out of bounds.`);
}

function validateNullableIsoDate(value, label) {
  const valid = value === null || (
    typeof value === "string"
    && /^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/.test(value)
    && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value
  );
  assert(valid, `${label} must be an ISO date or null.`);
}

function validateNullableIsoMonth(value, label) {
  assert(
    value === null || (typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)),
    `${label} must be an ISO month or null.`,
  );
}

export function validateRuntimeTransport(transport) {
  assert(transport?.format === RUNTIME_FORMAT, `Runtime format must be ${RUNTIME_FORMAT}.`);
  assert(transport.shard === "core" || transport.shard === "research", `Unknown runtime shard ${transport.shard}.`);
  assert(transport.metadata?.publicSafe === true && transport.metadata?.access === "public", "Runtime shard is not explicitly public-safe.");
  assert(
    transport.metadata.runtimeSchemaVersion === RUNTIME_FORMAT_VERSION,
    `Runtime schema version must be ${RUNTIME_FORMAT_VERSION}.`,
  );
  assertArray(transport.entities, "runtime entities");
  assertArray(transport.relationships, "runtime relationships");
  assertArray(transport.evidence, "runtime evidence");
  assertArray(transport.facts, "runtime facts");
  assertArray(transport.authorMentions, "runtime author mentions");
  assertArray(transport.collections, "runtime collections");
  assertArray(transport.redirects, "runtime redirects");

  const entityIds = new Set();
  for (const row of transport.entities) {
    assert(Array.isArray(row) && row.length === TRANSPORT_COLUMNS.entities.length, "Malformed runtime entity tuple.");
    assert(!entityIds.has(row[0]), `Duplicate runtime entity ${row[0]}.`);
    entityIds.add(row[0]);
  }
  const evidenceIds = new Set();
  for (const row of transport.evidence) {
    assert(Array.isArray(row) && row.length === TRANSPORT_COLUMNS.evidence.length, "Malformed runtime evidence tuple.");
    assert(!evidenceIds.has(row[0]), `Duplicate runtime evidence ${row[0]}.`);
    evidenceIds.add(row[0]);
  }
  const factIds = new Set();
  for (const row of transport.facts) {
    assert(Array.isArray(row) && row.length === TRANSPORT_COLUMNS.facts.length, "Malformed runtime fact tuple.");
    assert(!factIds.has(row[0]), `Duplicate runtime fact ${row[0]}.`);
    factIds.add(row[0]);
    validateIndex(row[1], transport.entities.length, `Fact ${row[0]} entity`);
    for (const index of row[11]) validateIndex(index, transport.evidence.length, `Fact ${row[0]} evidence`);
    assert(row[11].length > 0, `Fact ${row[0]} has no evidence.`);
    assert(row[12] === "Verified fact", `Fact ${row[0]} has a non-public conclusion label.`);
  }
  const relationshipIds = new Set();
  for (const row of transport.relationships) {
    assert(Array.isArray(row) && row.length === TRANSPORT_COLUMNS.relationships.length, "Malformed runtime relationship tuple.");
    assert(row[24] === null || row[24] === 0 || row[24] === 1, `Relationship ${row[0]} has an invalid first-author flag.`);
    validateNullableIsoDate(row[25], `Relationship ${row[0]} start date`);
    validateNullableIsoDate(row[26], `Relationship ${row[0]} end date`);
    validateNullableIsoMonth(row[27], `Relationship ${row[0]} start month`);
    validateNullableIsoMonth(row[28], `Relationship ${row[0]} end month`);
    assert(!relationshipIds.has(row[0]), `Duplicate runtime relationship ${row[0]}.`);
    relationshipIds.add(row[0]);
    validateIndex(row[1], transport.entities.length, `Relationship ${row[0]} subject`);
    validateIndex(row[3], transport.entities.length, `Relationship ${row[0]} object`);
    for (const index of row[8]) validateIndex(index, transport.evidence.length, `Relationship ${row[0]} evidence`);
    assert(row[8].length > 0, `Relationship ${row[0]} has no evidence.`);
    const predicate = transport.dictionaries.predicates[row[2]];
    if (transport.shard === "core") assert(!CORE_EXCLUDED_PREDICATES.has(predicate), `Core shard leaked predicate ${predicate}.`);
    if (transport.shard === "research") assert(predicate === RESEARCH_PREDICATE, `Research shard leaked predicate ${predicate}.`);
  }
  for (const row of transport.authorMentions) {
    assert(Array.isArray(row) && row.length === TRANSPORT_COLUMNS.authorMentions.length, "Malformed runtime author mention tuple.");
    assert(row[12] === 0 || row[12] === 1, `Author mention ${row[0]} has an invalid first-author flag.`);
    validateIndex(row[1], transport.collections.length, `Author mention ${row[0]} collection`);
    validateIndex(row[2], transport.entities.length, `Author mention ${row[0]} paper`);
    if (row[8] !== -1) validateIndex(row[8], transport.entities.length, `Author mention ${row[0]} person`);
    if (row[9] !== -1) validateIndex(row[9], transport.relationships.length, `Author mention ${row[0]} relationship`);
    for (const index of row[10]) validateIndex(index, transport.evidence.length, `Author mention ${row[0]} evidence`);
    assert(row[10].length > 0, `Author mention ${row[0]} has no evidence.`);
  }
  if (transport.shard === "core") assert(transport.authorMentions.length === 0, "Core shard must not contain author mentions.");
  if (transport.shard === "research") {
    assert(transport.facts.length === 0, "Research shard must not contain company facts.");
    const predicates = transport.relationships.map((row) => transport.dictionaries.predicates[row[2]]);
    assert(!predicates.includes("coauthored_with"), "Research shard must not materialize coauthorship.");
  }
  for (const row of transport.collections) {
    assert(Array.isArray(row) && row.length === TRANSPORT_COLUMNS.collections.length, "Malformed runtime collection tuple.");
    for (const index of row[3]) validateIndex(index, transport.entities.length, `Collection ${row[0]} entity`);
    for (const index of row[4]) validateIndex(index, transport.relationships.length, `Collection ${row[0]} relationship`);
    assert(row[7] === row[3].length, `Collection ${row[0]} entity count is inconsistent.`);
    assert(row[8] === row[4].length, `Collection ${row[0]} relationship count is inconsistent.`);
  }
  for (const row of transport.redirects) validateIndex(row[1], transport.entities.length, `Redirect ${row[0]} target`);
  const counts = transport.metadata.counts;
  assert(counts.entities === transport.entities.length, "Runtime entity count is inconsistent.");
  assert(counts.relationships === transport.relationships.length, "Runtime relationship count is inconsistent.");
  assert(counts.evidence === transport.evidence.length, "Runtime evidence count is inconsistent.");
  assert(counts.facts === transport.facts.length, "Runtime fact count is inconsistent.");
  assert(counts.authorMentions === transport.authorMentions.length, "Runtime author mention count is inconsistent.");
  assert(counts.collections === transport.collections.length, "Runtime collection count is inconsistent.");
  assert(counts.redirects === transport.redirects.length, "Runtime redirect count is inconsistent.");
  return true;
}

export function buildRuntimeKnowledgeGraphShards(source) {
  const coreProjection = buildProjection(source, "core");
  const researchProjection = buildProjection(source, "research");
  const core = encodeProjection(coreProjection);
  const research = encodeProjection(researchProjection);

  assert(core.relationships.length === source.relationships.filter((relationship) => (
    relationship.status === "published" && !CORE_EXCLUDED_PREDICATES.has(relationship.predicate)
  )).length, "Core projection dropped an eligible published relationship.");
  assert(research.relationships.length === source.relationships.filter((relationship) => (
    relationship.status === "published" && relationship.predicate === RESEARCH_PREDICATE
  )).length, "Research projection did not preserve every canonical authored relationship.");
  assert(research.authorMentions.length === (source.authorMentions ?? []).length, "Research projection did not preserve every author mention.");
  assert(core.facts.length === (source.facts ?? []).length, "Core projection did not preserve every public fact.");

  const serializedCore = serializeRuntimeShard(core);
  const serializedResearch = serializeRuntimeShard(research);
  const coreBytes = Buffer.byteLength(serializedCore);
  const researchBytes = Buffer.byteLength(serializedResearch);
  assertPublicSafeOutput(serializedCore, "core runtime shard");
  assertPublicSafeOutput(serializedResearch, "research runtime shard");
  assert(coreBytes < MAX_SHARD_BYTES, `Core runtime shard is ${coreBytes} bytes and exceeds ${MAX_SHARD_BYTES} bytes.`);
  assert(researchBytes < MAX_SHARD_BYTES, `Research runtime shard is ${researchBytes} bytes and exceeds ${MAX_SHARD_BYTES} bytes.`);
  return { core, research };
}

export function serializeRuntimeShard(transport) {
  return `${JSON.stringify(transport)}\n`;
}

export function assertPublicSafeOutput(serialized, label = "runtime shard") {
  for (const [rule, pattern] of PRIVATE_OUTPUT_PATTERNS) {
    const match = serialized.match(pattern);
    assert(!match, `${label} failed public-safety rule ${rule}: ${match?.[0]}.`);
  }
  return true;
}

async function writeAtomic(path, serialized) {
  const temporary = `${path}.tmp-${process.pid}`;
  await writeFile(temporary, serialized, "utf8");
  await rename(temporary, path);
}

async function checkExact(path, expected, label) {
  let actual;
  try {
    actual = await readFile(path, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT") throw new Error(`${label} is missing at ${path}; run npm run data:knowledge-graph:runtime.`);
    throw error;
  }
  assert(actual === expected, `${label} is stale at ${path}; run npm run data:knowledge-graph:runtime.`);
}

function parseArguments(argv) {
  const positional = [];
  let check = false;
  for (const argument of argv) {
    if (argument === "--check") check = true;
    else positional.push(argument);
  }
  assert(positional.length <= 3, "Usage: build-runtime-knowledge-graph.mjs [input] [core-output] [research-output] [--check]");
  return {
    check,
    input: resolve(positional[0] ?? DEFAULT_INPUT),
    coreOutput: resolve(positional[1] ?? DEFAULT_CORE_OUTPUT),
    researchOutput: resolve(positional[2] ?? DEFAULT_RESEARCH_OUTPUT),
  };
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const source = JSON.parse(await readFile(options.input, "utf8"));
  const { core, research } = buildRuntimeKnowledgeGraphShards(source);
  const serializedCore = serializeRuntimeShard(core);
  const serializedResearch = serializeRuntimeShard(research);

  if (options.check) {
    await checkExact(options.coreOutput, serializedCore, "Core runtime shard");
    await checkExact(options.researchOutput, serializedResearch, "Research runtime shard");
  } else {
    await Promise.all([
      writeAtomic(options.coreOutput, serializedCore),
      writeAtomic(options.researchOutput, serializedResearch),
    ]);
  }

  process.stdout.write(
    `${options.check ? "Checked" : "Built"} runtime shards: core ${core.entities.length} entities / `
    + `${core.relationships.length} relationships / ${Buffer.byteLength(serializedCore)} bytes; research `
    + `${research.entities.length} entities / ${research.relationships.length} authored relationships / `
    + `${research.authorMentions.length} author mentions / ${Buffer.byteLength(serializedResearch)} bytes.\n`,
  );
}

const invokedAsScript = process.argv[1] && resolve(process.argv[1]) === SCRIPT_PATH;
if (invokedAsScript) await main();
