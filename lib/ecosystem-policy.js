"use strict";
const { parsePublicUrl } = require("./public-web");
const { hash } = require("./graph-snapshot");
const PREDICATES = new Map([
  ["authored", /\b(author|authored|by|authors)\b/i], ["cites", /\b(cit(?:es|ed|ation)|references)\b/i],
  ["member_of", /\b(member|researcher|student|professor|team|affiliat)\w*/i],
  ["employed_by", /\b(work(?:s|ed|ing)? (?:at|for)|employ|joined|engineer|scientist|professor)\b/i],
  ["advised_by", /\b(advis(?:er|or|ed)|supervis(?:or|ed))\b/i],
  ["founded", /\b(co[- ]?found(?:er|ed)|founder|founded)\b/i],
  ["research_supervised_by", /\b(supervis(?:or|ed))\b/i],
  ["contributed_to", /\b(contribut(?:or|ed|ing)|maintain(?:er|ed|ing)|develop(?:er|ed)|built)\b/i],
]);
const LAYERS = { authored: "research", cites: "research", contributed_to: "research", founded: "company", member_of: "institutional", employed_by: "institutional", advised_by: "institutional", research_supervised_by: "institutional" };
const normalize = x => String(x || "").replace(/\s+/g, " ").trim();
function canonicalUrl(value) { const url = parsePublicUrl(value); url.hash = ""; return url.href.replace(/\/$/, ""); }
function stableIdentifiers(entity) { return Object.values(entity.externalIds || {}).flat().filter(x => typeof x === "string" && /^https:\/\//.test(x)).map(x => { try { return canonicalUrl(x); } catch { return null; } }).filter(Boolean); }
function resolveIdentity(reference, entities) {
  if (!reference?.url || !reference?.name) return { error: "missing_stable_identifier" };
  let url; try { url = canonicalUrl(reference.url); } catch { return { error: "invalid_identifier" }; }
  const exact = entities.filter(x => stableIdentifiers(x).includes(url));
  if (exact.length !== 1) return { error: exact.length > 1 ? "identity_conflict" : "unresolved_identity", url };
  if (![exact[0].canonicalName, exact[0].displayName, ...(exact[0].aliases || [])].some(name => normalize(name).toLowerCase() === normalize(reference.name).toLowerCase())) return { error: "identifier_name_conflict" };
  return { entity: exact[0], url };
}
function validDate(eventDate, precision) {
  if (precision === "unknown") return eventDate === null || eventDate === undefined;
  const pattern = { day: /^\d{4}-\d{2}-\d{2}$/, month: /^\d{4}-\d{2}$/, year: /^\d{4}$/ }[precision];
  if (!pattern?.test(eventDate || "")) return false;
  if (precision === "day") return !Number.isNaN(Date.parse(eventDate)) && new Date(eventDate).toISOString().slice(0, 10) === eventDate;
  return precision === "year" || Number(eventDate.slice(5)) >= 1 && Number(eventDate.slice(5)) <= 12;
}
function escapeRegex(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
function explicitPair(candidate) {
  const a = escapeRegex(normalize(candidate.subject?.name)); const b = escapeRegex(normalize(candidate.object?.name));
  const verbs = {
    founded: `${a} (?:is |was )?(?:(?:the|a) )?(?:co[- ]?founder of|founder of|co[- ]?founded|founded) ${b}`,
    authored: `${a} (?:authored|co[- ]?authored|is (?:an? |the )?author of) ${b}`,
    cites: `${a} (?:cites|references|cited) ${b}`,
    member_of: `${a} (?:is|was) (?:an? |the )?(?:member|researcher|PhD student|doctoral student|professor) (?:of|at|in) ${b}`,
    employed_by: `${a} (?:(?:works|worked) (?:at|for)|joined|(?:is|was) (?:an? |the )?(?:engineer|research scientist|professor) at|(?:is|was) employed by) ${b}`,
    advised_by: `${a}(?:'s PhD (?:adviser|advisor|supervisor) (?:is|was)| (?:is|was) (?:a )?(?:PhD|doctoral) student (?:advised|supervised) by) ${b}`,
    research_supervised_by: `${a}(?:'s research project (?:adviser|advisor|supervisor) (?:is|was)| (?:was|is) supervised (?:on|for) (?:a|the) research project by) ${b}`,
    contributed_to: `${a} (?:contributed to|maintains|maintained|is (?:a |the )?maintainer of|developed|built) ${b}`,
  };
  if (!verbs[candidate.predicate]) return { supported:false };
  const quote = normalize(candidate.quote);
  const pattern = new RegExp(`(?:^|[.!?;]\\s*|\\b)(${verbs[candidate.predicate]})(?=$|[\\s.,;:!?])`, 'i');
  const match = pattern.exec(quote);
  if (!match) return { supported:false };
  if (candidate.datePrecision === 'unknown') return { supported:true };
  // Only an explicit date attached to this exact relation is eligible. A date
  // elsewhere on the page, or elsewhere in the same quotation, cannot date it.
  const date = escapeRegex(candidate.eventDate || '');
  const dated = new RegExp(`(?:(?:on|in|since) ${date},? ${verbs[candidate.predicate]}|${verbs[candidate.predicate]} (?:on|in|since) ${date})(?=$|[\\s.,;:!?])`, 'i');
  return { supported:dated.test(quote), reason:'date_not_attached_to_relationship' };
}
function gate(candidate, context) {
  const reasons = [];
  const quote = normalize(candidate?.quote);
  const text = normalize(context.text);
  if (quote.length < 16 || quote.length > 1200 || !text.includes(quote)) reasons.push("quote_not_in_capture");
  if (!candidate?.locator || candidate.locator.length > 200) reasons.push("missing_locator");
  if (!validDate(candidate?.eventDate, candidate?.datePrecision)) reasons.push("invalid_date_precision");
  if (candidate?.eventDate && !quote.includes(candidate.eventDate) && !candidate.dateQuote) reasons.push("date_without_evidence");
  if (candidate?.dateQuote && !text.includes(normalize(candidate.dateQuote))) reasons.push("date_not_in_capture");
  if (candidate?.contradiction === true || candidate?.inferred === true) reasons.push("inference_or_conflict");
  if (!context.source || !["institution", "personal", "company", "investor", "publication", "repository", "registry"].includes(context.source.kind)) reasons.push("unclassified_source");
  if (context.source?.verifiedIdentity !== true) reasons.push("source_authority_requires_review");
  const resolved = resolveIdentity(candidate?.subject, context.entities);
  if (resolved.error) reasons.push(resolved.error);
  if (!quote.toLowerCase().includes(normalize(candidate?.subject?.name).toLowerCase())) reasons.push("subject_not_in_quote");
  let object = null;
  if (candidate?.type === "relationship") {
    if (/\b(?:not|never|false|alleged|rumou?r|would|may|might|plans?|intends?|could)\b/i.test(quote)) reasons.push("negated_or_uncertain_relationship");
    if (!PREDICATES.has(candidate.predicate)) reasons.push("predicate_requires_review");
    else { const pair=explicitPair(candidate); if(!pair.supported) reasons.push(pair.reason || "relationship_pair_not_explicit"); }
    object = resolveIdentity(candidate.object, context.entities);
    if (object.error) reasons.push(object.error);
    if (!quote.toLowerCase().includes(normalize(candidate.object?.name).toLowerCase())) reasons.push("object_not_in_quote");
    const sourceUrl=new URL(context.source.url);
    const authorityFor=entity=>(entity ? stableIdentifiers(entity):[]).some(value=>{const endpoint=new URL(value);if(endpoint.hostname!==sourceUrl.hostname)return false;if(["github.com","arxiv.org","doi.org","orcid.org"].includes(endpoint.hostname)){const prefix=endpoint.hostname==="github.com"?endpoint.pathname.split("/").slice(0,3).join("/"):endpoint.pathname;return sourceUrl.pathname===prefix||sourceUrl.pathname.startsWith(prefix+"/");}return true;});
    if(!authorityFor(resolved.entity)&&!authorityFor(object.entity))reasons.push("source_not_authoritative_for_pair");
    if (resolved.entity?.id === object.entity?.id) reasons.push("self_relationship");
    if (resolved.entity && object.entity) {
      if (["founded", "advised_by", "research_supervised_by", "employed_by", "member_of", "authored", "contributed_to"].includes(candidate.predicate) && resolved.entity.kind !== "person") reasons.push("subject_kind_conflict");
      if (["advised_by", "research_supervised_by"].includes(candidate.predicate) && object.entity.kind !== "person") reasons.push("adviser_is_not_person");
      if (candidate.predicate === "founded" && !["company", "organization", "lab"].includes(object.entity.kind)) reasons.push("founding_object_kind_conflict");
      const conflicts = context.relationships.filter(x => x.subjectId === resolved.entity.id && x.predicate === candidate.predicate && x.objectId === object.entity.id);
      if (conflicts.length) reasons.push("existing_relationship_requires_revision_review");
    }
  } else if (candidate?.type === "claim") {
    if (!["funding", "formation", "pilot", "deployment", "product", "performance", "status"].includes(candidate.kind)) reasons.push("unknown_claim_kind");
    if (!["company", "investor", "institution", "personal"].includes(context.source?.kind)) reasons.push("claim_attribution_unresolved");
    if (!candidate.text || candidate.text.length > 1000 || normalize(candidate.text) !== quote) reasons.push("claim_text_not_exact_capture");
  } else reasons.push("unknown_candidate_type");
  return { decision: reasons.length ? "held" : "eligible", reasons: [...new Set(reasons)], subject: resolved.entity, object: object?.entity, quote };
}
function materialize(candidate, decision, source, observedAt) {
  const evidenceId = `ECO-EVD-${hash(`${source.id}|${decision.quote}`).slice(0, 20)}`;
  const evidence = { id: evidenceId, url: source.url, publisher: source.publisher, tier: "primary", locator: candidate.locator, retrievedAt: observedAt.slice(0,10), stance: "supports" };
  const date = candidate.eventDate || null;
  if (candidate.type === "claim") return { claim: { id: `ECO-CLAIM-${hash(`${decision.subject.id}|${candidate.kind}|${decision.quote}`).slice(0, 20)}`, entityId: decision.subject.id, kind: candidate.kind, text: normalize(candidate.text), attribution: source.kind, sourceIds: [source.id], eventDate: date, datePrecision: candidate.datePrecision, observedAt: observedAt.slice(0,10), publishedAt: null, revision: 1 } };
  return { evidence, relationship: { id: `ECO-REL-${hash(`${decision.subject.id}|${candidate.predicate}|${decision.object.id}|${date || "undated"}`).slice(0, 20)}`, subjectId: decision.subject.id, objectId: decision.object.id, predicate: candidate.predicate, layer: LAYERS[candidate.predicate], temporal: { startYear: date ? Number(date.slice(0,4)) : null, endYear: null, startDate: candidate.datePrecision === "day" ? date : null, endDate: null, startMonth: candidate.datePrecision === "month" ? date : null, endMonth: null, precision: candidate.datePrecision === "unknown" ? "undated" : candidate.datePrecision === "day" ? "exact_start" : "approximate" }, evidenceIds: [evidenceId], status: "published", derived: false, conclusionLabel: "Verified fact", revision: 1, note: `Explicit public relationship; checked ${observedAt.slice(0,10)}. ${candidate.locator}` } };
}
module.exports = { PREDICATES, LAYERS, canonicalUrl, normalize, stableIdentifiers, resolveIdentity, validDate, explicitPair, gate, materialize };
