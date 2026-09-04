"use strict";

const assert = require("node:assert/strict");
const ingestGmail = require("../api/ingest-gmail");
const ingestWebNews = require("../api/ingest-web-news");
const {
  evidenceSupportsUsdValue,
  sourceSupportsFinancingProceeds,
  sourceBackedDealValueUsd
} = require("../lib/ingest-adjudication");

const context = {
  refreshWindow: { startDate: "2026-08-01", endDate: "2026-09-04" },
  companies: [
    { id: "c-alpha", name: "Alpha Robotics" },
    { id: "c-beta", name: "Beta Robotics" }
  ],
  companyById: new Map([
    ["c-alpha", "Alpha Robotics"],
    ["c-beta", "Beta Robotics"]
  ]),
  activities: [
    {
      id: "a-alpha-series-a",
      company_id: "c-alpha",
      date_announced: "2026-09-01",
      counterparty: "True Ventures",
      activity_type: "financing",
      deal_value_usd: 20_000_000,
      description: "Alpha Robotics raised a $20 million Series A.",
      source_url: "https://alpha.example/series-a"
    },
    {
      id: "a-beta-series-a",
      company_id: "c-beta",
      date_announced: "2026-09-01",
      counterparty: "Other Ventures",
      activity_type: "financing",
      deal_value_usd: 20_000_000,
      description: "Beta Robotics raised a $20 million Series A.",
      source_url: "https://beta.example/series-a"
    }
  ],
  pending: []
};

const baseCandidate = {
  id: "rq-corruption-regression",
  candidate_company: "Alpha Robotics",
  candidate_counterparty: "True Ventures",
  candidate_date: "2026-09-01",
  activity_type: "financing",
  subsector: "robotics",
  deal_value_usd: 3_000_000_000,
  geography: "United States",
  description: "Parser guessed a $3 billion transaction value.",
  source_type: "article",
  source_url: "https://alpha.example/series-a",
  subject: "Alpha Robotics Series A",
  snippet: "Alpha Robotics funding",
  extracted_text: "Alpha Robotics announced a $20 million Series A round at a $3 billion valuation.",
  confidence: "reported",
  status: "pending"
};

function webParsed(overrides = {}) {
  return {
    keep: true,
    physicalAi: true,
    fundingEvent: true,
    action: "new_activity",
    duplicateOfActivityId: null,
    candidateCompany: "Alpha Robotics",
    candidateCounterparty: "True Ventures",
    candidateDate: "2026-09-01",
    activityType: "financing",
    subsector: "robotics",
    dealValueUsd: null,
    geography: "United States",
    confidence: "reported",
    description: "Alpha Robotics announced a Series A with an undisclosed amount.",
    evidence: ["The official announcement does not disclose the round size."],
    cautions: [],
    ...overrides
  };
}

function gmailParsed(eventOverrides = {}) {
  return {
    keep: true,
    events: [{
      physicalAi: true,
      action: "new_activity",
      duplicateOfActivityId: null,
      candidateCompany: "Alpha Robotics",
      candidateCounterparty: "True Ventures",
      candidateDate: "2026-09-01",
      activityType: "financing",
      subsector: "robotics",
      dealValueUsd: null,
      geography: "United States",
      confidence: "reported",
      description: "Alpha Robotics announced a Series A with an undisclosed amount.",
      evidence: ["The announcement does not disclose the round size."],
      cautions: [],
      ...eventOverrides
    }]
  };
}

assert.equal(evidenceSupportsUsdValue(20_000_000, ["The company raised $20 million."]), true);
assert.equal(evidenceSupportsUsdValue(20_000_000, ["The amount was undisclosed."]), false);
assert.equal(sourceBackedDealValueUsd(20_000_000, "reported", ["Raised $20M."]), 20_000_000);
assert.equal(sourceBackedDealValueUsd(20_000_000, "estimated", ["Estimated at $20M."]), null);
assert.equal(sourceBackedDealValueUsd(0, "reported", ["Raised $0."]), null);
const proceedsAndValuation = "Alpha Robotics raised $20M in its Series A at a $3B post-money valuation.";
assert.equal(sourceSupportsFinancingProceeds(20_000_000, [proceedsAndValuation]), true);
assert.equal(sourceSupportsFinancingProceeds(3_000_000_000, [proceedsAndValuation]), false);
for (const nonProceedsContext of [
  "The company is seeking a $20M funding target.",
  "The project secured a government guarantee of $20M.",
  "The company secured a customer contract worth $20M."
]) {
  assert.equal(sourceSupportsFinancingProceeds(20_000_000, [nonProceedsContext]), false);
}
assert.equal(
  sourceBackedDealValueUsd(3_000_000_000, "reported", ["The company has a $3B valuation."], [proceedsAndValuation]),
  null
);
assert.equal(
  sourceBackedDealValueUsd(20_000_000, "reported", ["The company raised $20M."], [proceedsAndValuation]),
  20_000_000
);
assert.equal(
  sourceBackedDealValueUsd(20_000_000, "reported", ["Raised $20M."], ["The source only states a $3B valuation."]),
  null
);

const webNullAmount = ingestWebNews._test.buildAdjudicatedCandidate(
  webParsed(),
  baseCandidate,
  context,
  "test:model"
).candidate;
assert.equal(webNullAmount.deal_value_usd, null, "web adjudication must clear an inherited parser amount");

const gmailNullAmount = ingestGmail._test.buildAdjudicatedCandidates(
  gmailParsed(),
  { ...baseCandidate, source_type: "Gmail", source_url: null, gmail_message_id: "gmail-1" },
  context,
  "test:model"
).candidates[0];
assert.equal(gmailNullAmount.deal_value_usd, null, "Gmail adjudication must clear an inherited parser amount");

const webDateRecheck = ingestWebNews._test.buildAdjudicatedCandidate(
  { keep: false, physicalAi: false, fundingEvent: false, rejectReason: "future date outside lookback window" },
  baseCandidate,
  context,
  "test:model"
).candidate;
assert.equal(webDateRecheck.deal_value_usd, null, "web date recheck must not restore the parser amount");

const gmailDateRecheck = ingestGmail._test.buildAdjudicatedCandidates(
  { keep: false, events: [], rejectReason: "future date outside lookback window" },
  { ...baseCandidate, source_type: "Gmail", source_url: null, gmail_message_id: "gmail-date" },
  context,
  "test:model"
).candidates[0];
assert.equal(gmailDateRecheck.deal_value_usd, null, "Gmail date recheck must not restore the parser amount");

const webSupportedAmount = ingestWebNews._test.buildAdjudicatedCandidate(
  webParsed({
    dealValueUsd: 20_000_000,
    description: "Alpha Robotics raised a $20 million Series A.",
    evidence: ["The company announcement reports a $20M round."]
  }),
  baseCandidate,
  context,
  "test:model"
).candidate;
assert.equal(webSupportedAmount.deal_value_usd, 20_000_000);

const gmailUnsupportedAmount = ingestGmail._test.buildAdjudicatedCandidates(
  gmailParsed({
    dealValueUsd: 20_000_000,
    description: "Alpha Robotics announced a Series A.",
    evidence: ["The source confirms financing but gives no amount."]
  }),
  { ...baseCandidate, source_type: "Gmail", source_url: null, gmail_message_id: "gmail-2" },
  context,
  "test:model"
).candidates[0];
assert.equal(gmailUnsupportedAmount.deal_value_usd, null, "a model number without amount evidence must not survive");

const webWrongMerge = ingestWebNews._test.buildAdjudicatedCandidate(
  webParsed({
    action: "update_existing",
    duplicateOfActivityId: "a-beta-series-a",
    dealValueUsd: 20_000_000,
    description: "Alpha Robotics raised a $20 million Series A.",
    evidence: ["Alpha Robotics reports a $20M Series A."]
  }),
  { ...baseCandidate, source_url: "https://beta.example/series-a" },
  context,
  "test:model"
).candidate;
assert.equal(webWrongMerge.duplicate_of_activity_id, undefined);
assert.equal(webWrongMerge.intelligence_action, "new_activity");

const gmailWrongMerge = ingestGmail._test.buildAdjudicatedCandidates(
  gmailParsed({
    action: "update_existing",
    duplicateOfActivityId: "a-beta-series-a",
    dealValueUsd: 20_000_000,
    description: "Alpha Robotics raised a $20 million Series A.",
    evidence: ["Alpha Robotics reports a $20M Series A."]
  }),
  { ...baseCandidate, source_type: "Gmail", source_url: null, gmail_message_id: "gmail-3" },
  context,
  "test:model"
).candidates[0];
assert.equal(gmailWrongMerge.duplicate_of_activity_id, undefined);
assert.equal(gmailWrongMerge.intelligence_action, "new_activity");

const webAgreedMerge = ingestWebNews._test.buildAdjudicatedCandidate(
  webParsed({
    action: "update_existing",
    duplicateOfActivityId: "a-alpha-series-a",
    dealValueUsd: 20_000_000,
    description: "Alpha Robotics raised a $20 million Series A.",
    evidence: ["Alpha Robotics reports a $20M Series A."]
  }),
  baseCandidate,
  context,
  "test:model"
).candidate;
assert.equal(webAgreedMerge.duplicate_of_activity_id, "a-alpha-series-a");
assert.equal(webAgreedMerge.intelligence_action, "update_existing");

const gmailAgreedMerge = ingestGmail._test.buildAdjudicatedCandidates(
  gmailParsed({
    action: "update_existing",
    duplicateOfActivityId: "a-alpha-series-a",
    dealValueUsd: 20_000_000,
    description: "Alpha Robotics raised a $20 million Series A.",
    evidence: ["Alpha Robotics reports a $20M Series A."]
  }),
  { ...baseCandidate, source_type: "Gmail", source_url: null, gmail_message_id: "gmail-4" },
  context,
  "test:model"
).candidates[0];
assert.equal(gmailAgreedMerge.duplicate_of_activity_id, "a-alpha-series-a");
assert.equal(gmailAgreedMerge.intelligence_action, "update_existing");

console.log("ingest adjudication corruption regression tests passed");
