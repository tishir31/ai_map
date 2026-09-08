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

// ../physical-ai-public-site/src/lib/researchAgents.ts
var researchAgents_exports = {};
__export(researchAgents_exports, {
  runResearchAgent: () => runResearchAgent
});
module.exports = __toCommonJS(researchAgents_exports);

// ../physical-ai-public-site/src/lib/researchPublisher.ts
function decideResearchPublish(input) {
  if (!input.value.trim()) {
    return { decision: "left_blank", reason: "No sourced value was found." };
  }
  if (input.hasConflict) {
    return { decision: "blocked_conflict", reason: "At least one credible source conflicts with the proposed value." };
  }
  const tier1Count = input.sourceTiers.filter((tier) => tier === "tier_1").length;
  const tier2Count = input.sourceTiers.filter((tier) => tier === "tier_2").length;
  const independentSourceCount = input.independentSourceCount ?? input.sourceTiers.length;
  const strongEvidence = tier1Count >= 1 || tier2Count >= 2 && independentSourceCount >= 2;
  if (!strongEvidence) {
    return { decision: "staged_review", reason: "The value lacks a tier-1 source or two independent tier-2 sources." };
  }
  if (input.materialField && input.confidence === "estimated") {
    return { decision: "staged_review", reason: "Material financial/customer fields cannot auto-publish from an estimate." };
  }
  if (input.confidence === "unverified") {
    return { decision: "staged_review", reason: "The verifier did not confirm the source supports this value." };
  }
  return { decision: "auto_published", reason: "Source policy passed with no conflicts." };
}

// ../physical-ai-public-site/src/lib/researchAgents.ts
var materialColumns = /* @__PURE__ */ new Set([
  "total_funding",
  "last_round",
  "last_round_date",
  "last_round_valuation",
  "key_investors",
  "customers"
]);
async function runResearchAgent(task, config = {}) {
  const liveProvider = config.liveProvider ?? "mock";
  if (liveProvider === "mock") {
    return runMockAgent(task);
  }
  try {
    return await runLiveProvider(task, config);
  } catch (error) {
    if (!config.allowMockFallback) throw error;
    const result = runMockAgent(task);
    return {
      ...result,
      status: "needs_verification",
      output: {
        ...result.output,
        fallback: "mock",
        fallbackReason: error instanceof Error ? error.message : String(error)
      },
      events: [
        {
          eventType: "error",
          message: `Live ${liveProvider} agent failed; mock fallback was used for staging only.`,
          metadata: { liveProvider }
        },
        ...result.events
      ]
    };
  }
}
async function runLiveProvider(task, config) {
  if (config.liveProvider === "openai") {
    if (!config.openaiApiKey) throw new Error("RESEARCH_LIVE_PROVIDER=openai requires OPENAI_API_KEY.");
    const finding = await callOpenAIResearch(task, config);
    return agentResultForType(task.type, finding.summary, true, finding.sources, finding.structured);
  }
  if (config.liveProvider === "gemini") {
    if (!config.geminiApiKey) throw new Error("RESEARCH_LIVE_PROVIDER=gemini requires GEMINI_API_KEY.");
    const finding = await callGeminiResearch(task, config);
    return agentResultForType(task.type, finding.summary, true, finding.sources, finding.structured);
  }
  throw new Error(`Unsupported research live provider: ${String(config.liveProvider)}`);
}
function runMockAgent(task) {
  const summary = mockSummaryForTask(task.type);
  return agentResultForType(task.type, summary, false);
}
function agentResultForType(type, summary, live, sources = [], structured = {}) {
  if (live) {
    const eventType = type === "coverage_auditor" ? "coverage_gap" : type === "discovery" || type === "newsflow" ? "search" : "decision";
    return { status: "completed", output: { ...structured, summary, sources, requiresVerification: true }, events: [{ eventType, message: summary, metadata: { live: true, sourceCount: sources.length } }] };
  }
  if (type === "planner") {
    return {
      status: "completed",
      output: {
        summary,
        sources,
        ...structured,
        inclusionRules: ["Physical systems with AI autonomy", "Private or public companies relevant to IB coverage"],
        exclusionRules: ["Pure software with no physical-world autonomy", "Academic labs without company activity"],
        columnAgents: ["Company Profile", "Funding", "Product / Customer", "IB Relevance"]
      },
      events: [{ eventType: "decision", message: summary, metadata: { live, sourceCount: sources.length } }]
    };
  }
  if (type === "discovery") {
    return {
      status: "completed",
      output: {
        summary,
        sources,
        ...structured,
        acceptedCandidates: 12,
        rejectedCandidates: 18,
        queryPacks: ["humanoid robotics", "defense autonomy", "warehouse robotics", "drone delivery", "autonomous trucking"]
      },
      events: [{ eventType: "search", message: summary, metadata: { live, queryPacks: 5, sourceCount: sources.length } }]
    };
  }
  if (type === "column_agent") {
    return {
      status: "needs_verification",
      output: { summary, sources, ...structured, proposedCells: 32, requiresVerification: true },
      events: [{ eventType: "read", message: summary, metadata: { live, sourceCount: sources.length } }]
    };
  }
  if (type === "verifier") {
    return {
      status: "publishable",
      output: { summary, sources, ...structured, verifiedCells: 24, conflicts: 2, unverified: 6 },
      events: [
        { eventType: "decision", message: summary, metadata: { live, verifiedCells: 24, sourceCount: sources.length } },
        { eventType: "conflict", message: "Blocked conflicting valuation cells until a primary source is found.", metadata: { conflicts: 2 } }
      ]
    };
  }
  if (type === "coverage_auditor") {
    return {
      status: "completed",
      output: { summary, sources, ...structured, coverageScore: 82, missingThemes: ["surgical robotics", "construction robotics"] },
      events: [{ eventType: "coverage_gap", message: summary, metadata: { missingThemes: 2, sourceCount: sources.length } }]
    };
  }
  if (type === "publisher") {
    const decision = evaluateMockPublisherDecision();
    return {
      status: decision === "auto_published" ? "completed" : "blocked",
      output: { summary, sources, ...structured, decision },
      events: [{ eventType: "publish", message: `${summary} Decision: ${decision}.`, metadata: { decision, sourceCount: sources.length } }]
    };
  }
  if (type === "newsflow") {
    return {
      status: "needs_verification",
      output: { summary, sources, ...structured, newSignals: 4, autoPublishCandidates: 1 },
      events: [{ eventType: "search", message: summary, metadata: { newSignals: 4, sourceCount: sources.length } }]
    };
  }
  return {
    status: "completed",
    output: { summary, sources, ...structured },
    events: [{ eventType: "decision", message: summary, metadata: { live, sourceCount: sources.length } }]
  };
}
function evaluateMockPublisherDecision() {
  return decideResearchPublish({
    value: "Series C",
    confidence: "reported",
    sourceTiers: ["tier_1"],
    hasConflict: false,
    materialField: materialColumns.has("last_round")
  }).decision;
}
function mockSummaryForTask(type) {
  switch (type) {
    case "planner":
      return "Planner created a scoped Physical AI research graph with subcategory query packs and evidence rules.";
    case "discovery":
      return "Discovery searched broad market-map queries and identified high-relevance companies for the sheet.";
    case "entity_resolution":
      return "Entity resolution normalized aliases and rejected duplicate or tangential candidates.";
    case "column_agent":
      return "Column agent proposed sourced cells and left unsupported financial values blank.";
    case "verifier":
      return "Verifier checked source support, source tier, and conflicts for proposed cells.";
    case "coverage_auditor":
      return "Coverage auditor found remaining search gaps and queued follow-up themes.";
    case "publisher":
      return "Publisher applied auto-publish rules to high-confidence cells.";
    case "newsflow":
      return "Newsflow agent searched recent company-specific and market-level signals.";
    default:
      return "Research task completed.";
  }
}
async function callOpenAIResearch(task, config) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    signal: AbortSignal.timeout(4e4),
    headers: {
      "Authorization": `Bearer ${config.openaiApiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: config.openaiModel ?? "gpt-5.2",
      input: [
        {
          role: "system",
          content: [
            "You are an investment-banking research agent.",
            "Return JSON only. Never invent missing facts.",
            "Every company, material funding value, valuation, customer, and investor claim must include source URLs.",
            "If evidence is weak, return the value with confidence unverified or leave it blank.",
            'Use this JSON shape: {"summary":"...","sources":[{"url":"...","title":"..."}],"candidates":[{"companyName":"...","website":"...","relevanceScore":0,"status":"accepted","reason":"...","sourceUrls":["..."]}],"cellProposals":[{"companyName":"...","columnKey":"website","value":"...","confidence":"reported","sourceTier":"tier_1","citations":[{"url":"...","title":"...","evidence":"...","sourceTier":"tier_1"}]}],"coverageGaps":["..."],"conflicts":["..."]}.'
          ].join(" ")
        },
        {
          role: "user",
          content: [
            `Run task ${task.type} for agent ${task.agentName}.`,
            `Input JSON: ${JSON.stringify(task.input)}.`,
            "For discovery/entity_resolution return candidates.",
            "For column_agent return cellProposals only for sourced values.",
            "For verifier, coverage_auditor, publisher, and newsflow return decisions, conflicts, coverageGaps, and sourced cellProposals when applicable."
          ].join(" ")
        }
      ],
      tools: [{ type: "web_search" }],
      tool_choice: "auto",
      include: ["web_search_call.action.sources"]
    })
  });
  if (!response.ok) throw new Error(`OpenAI research call failed with HTTP ${response.status}`);
  const json = await response.json();
  const text = extractOpenAIText(json) || `OpenAI completed ${task.type}.`;
  const structured = extractJsonObject(text);
  return {
    summary: typeof structured.summary === "string" ? structured.summary : text,
    structured,
    sources: extractOpenAISources(json)
  };
}
async function callGeminiResearch(task, config) {
  const model = config.geminiModel ?? "gemini-2.5-flash";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.geminiApiKey}`, {
    method: "POST",
    signal: AbortSignal.timeout(4e4),
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 6144, thinkingConfig: { thinkingBudget: 0 } },
      contents: [{
        parts: [{
          text: [
            "Research the requested public companies using Google Search. Return one JSON object and no markdown.",
            'Use {"summary":"...","candidates":[{"companyName":"...","website":"https://...","relevanceScore":80}],"cellProposals":[{"companyName":"...","columnKey":"website","value":"...","confidence":"unverified","citations":[{"url":"https://...","title":"...","evidence":"..."}]}],"coverageGaps":["..."]}.',
            "Return at most 8 companies and 24 cells. For column tasks use only targetColumns; otherwise report findings and gaps. Keep exact company names from rowContext. Cite actual public pages; leave unknown values blank. A claim is unverified until a person checks its citation.",
            "Never invent missing facts; stage weak evidence.",
            `Task: ${task.type}. Agent: ${task.agentName}. Input JSON: ${JSON.stringify(task.input)}`
          ].join(" ")
        }]
      }]
    })
  });
  if (!response.ok) throw new Error(`Gemini research call failed with HTTP ${response.status}`);
  const json = await response.json();
  const text = json.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n").trim() || `Gemini completed ${task.type}.`;
  const structured = extractJsonObject(text);
  return {
    summary: typeof structured.summary === "string" ? structured.summary : text,
    structured
  };
}
function extractOpenAIText(payload) {
  if (payload.output_text?.trim()) return payload.output_text.trim();
  return payload.output?.flatMap((item) => item.content ?? []).map((content) => content.text ?? "").join("\n").trim();
}
function extractOpenAISources(payload) {
  const seen = /* @__PURE__ */ new Set();
  return (payload.output ?? []).flatMap((item) => item.action?.sources ?? []).flatMap((source) => source.url ? [{ url: source.url, title: source.title }] : []).filter((source) => {
    if (seen.has(source.url)) return false;
    seen.add(source.url);
    return true;
  });
}
function extractJsonObject(text) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidate = fenced ?? trimmed.slice(trimmed.indexOf("{"), trimmed.lastIndexOf("}") + 1);
  if (!candidate.startsWith("{") || !candidate.endsWith("}")) return {};
  try {
    const parsed = JSON.parse(candidate);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  runResearchAgent
});
