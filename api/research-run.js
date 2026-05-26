const TAXONOMY = [
  "humanoid robotics",
  "robotics foundation models",
  "defense autonomy",
  "warehouse and logistics robotics",
  "autonomous vehicles and trucking",
  "drones and aerial autonomy",
  "industrial inspection robotics",
  "agriculture and construction robotics",
];

const EXCLUSION_RULES = [
  "Exclude pure software AI companies unless the product controls physical-world autonomy.",
  "Exclude academic labs without an operating company or commercial activity.",
  "Stage weak funding, valuation, customer, and employee-count claims until independently sourced.",
];

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "Use POST." });
  try {
    const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
    if (!prompt) return send(res, 400, { ok: false, error: "Missing prompt." });
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) return send(res, 503, { ok: false, error: "Research persistence is not configured." });
    const snapshot = createDraftResearchSnapshot(prompt);
    await restUpsert(supabaseUrl, serviceKey, "research_runs", [toRunRow(snapshot.run)]);
    await restUpsert(supabaseUrl, serviceKey, "research_tasks", snapshot.tasks.map(toTaskRow));
    await restUpsert(supabaseUrl, serviceKey, "research_events", snapshot.events.map(toEventRow));
    return send(res, 200, { ok: true, runId: snapshot.run.id, taskCount: snapshot.tasks.length });
  } catch (error) {
    return send(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

function createDraftResearchSnapshot(prompt) {
  const now = new Date().toISOString();
  const runId = `run-${slugify(prompt).slice(0, 42)}-${Date.now().toString(36)}`;
  const subject = subjectFromPrompt(prompt);
  const tasks = createTasks(runId, prompt, subject, now);
  return {
    run: {
      id: runId,
      prompt,
      subject,
      status: "planning",
      coverageScore: 0,
      acceptedRows: 0,
      candidateRows: 0,
      completedCells: 0,
      totalCells: 0,
      startedAt: now,
      lastRefreshAt: now,
      summary: "Planner, discovery, verification, coverage, publisher, and newsflow agents are queued.",
    },
    tasks,
    events: [{
      id: `${runId}-evt-created`,
      runId,
      eventType: "decision",
      agentName: "Planner Agent",
      message: "Created research run and queued typed agent tasks from the prompt.",
      metadata: { prompt, taskCount: tasks.length, columnCount: 16 },
      createdAt: now,
    }],
  };
}

function createTasks(runId, prompt, subject, now) {
  const definitions = [
    ["planner", "Planner Agent", { objective: "Convert the prompt into inclusion rules, taxonomy, query packs, and source policy." }],
    ["discovery", "Discovery Agent", { objective: "Find candidate companies and reject tangential names.", minAcceptedCompanies: 30, queryPacks: TAXONOMY.map((theme) => `${theme} companies funding customers`) }],
    ["entity_resolution", "Entity Resolution Agent", { objective: "Normalize aliases, websites, duplicates, and public-company business-unit rows." }],
    ["column_agent", "Company Profile Agent", { objective: "Fill company profile fields from primary sources.", targetColumns: ["website", "hq", "category", "founded", "employee_count"] }],
    ["column_agent", "Funding Agent", { objective: "Fill funding and valuation fields with strict source-first rules.", targetColumns: ["total_funding", "last_round", "last_round_date", "last_round_valuation", "key_investors", "tier_1_investor"] }],
    ["column_agent", "Product / Customer Agent", { objective: "Fill product, customer, and partner fields from primary or credible secondary sources.", targetColumns: ["product", "customers"] }],
    ["column_agent", "IB Relevance Agent", { objective: "Stage banker judgment fields with cited rationale; do not auto-publish estimates.", targetColumns: ["ib_score", "ib_angle", "notes"] }],
    ["verifier", "Verifier Agent", { objective: "Cross-check material cells, flag conflicts, and require primary or independent secondary evidence." }],
    ["coverage_auditor", "Coverage Auditor", { objective: "Search for missing sectors, missing obvious companies, and stale newsflow." }],
    ["publisher", "Publisher Agent", { objective: "Publish only high-confidence cells; stage weak evidence and conflicts for human review." }],
    ["newsflow", "Newsflow Agent", { objective: "Monitor market-level and company-specific news after the initial run." }],
  ];
  return definitions.map(([type, agentName, input], index) => ({
    id: `${runId}-task-${String(index + 1).padStart(2, "0")}-${type}`,
    runId,
    type,
    status: "pending",
    agentName,
    input: { prompt, subject, taxonomy: TAXONOMY, exclusionRules: EXCLUSION_RULES, ...input },
    createdAt: new Date(new Date(now).getTime() + index * 1000).toISOString(),
  }));
}

async function restUpsert(supabaseUrl, serviceKey, table, rows) {
  const response = await fetch(new URL(`/rest/v1/${table}`, supabaseUrl), {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates",
    },
    body: JSON.stringify(rows),
  });
  if (!response.ok) throw new Error(`${table}: HTTP ${response.status}`);
}

function toRunRow(run) {
  return {
    id: run.id,
    prompt: run.prompt,
    subject: run.subject,
    status: run.status,
    coverage_score: run.coverageScore,
    accepted_rows: run.acceptedRows,
    candidate_rows: run.candidateRows,
    completed_cells: run.completedCells,
    total_cells: run.totalCells,
    summary: run.summary,
    started_at: run.startedAt,
    completed_at: run.completedAt || null,
    last_refresh_at: run.lastRefreshAt || null,
  };
}

function toTaskRow(task) {
  return {
    id: task.id,
    run_id: task.runId,
    type: task.type,
    status: task.status,
    agent_name: task.agentName,
    input: task.input,
    output: task.output || null,
    error: task.error || null,
    created_at: task.createdAt,
    started_at: task.startedAt || null,
    completed_at: task.completedAt || null,
  };
}

function toEventRow(event) {
  return {
    id: event.id,
    run_id: event.runId,
    row_id: event.rowId || null,
    cell_id: event.cellId || null,
    task_id: event.taskId || null,
    event_type: event.eventType,
    agent_name: event.agentName,
    message: event.message,
    metadata: event.metadata || null,
    created_at: event.createdAt,
  };
}

function subjectFromPrompt(prompt) {
  const lower = prompt.toLowerCase();
  if (lower.includes("physical ai")) return "Physical AI Landscape";
  if (lower.includes("humanoid")) return "Humanoid Robotics Landscape";
  if (lower.includes("defense")) return "Defense Autonomy Landscape";
  return titleCase(prompt.replace(/^(build|create|map|research|generate)\s+/i, "").split(/[.?!]/)[0].slice(0, 80) || "Research Landscape");
}

function titleCase(value) {
  return value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "research";
}

function send(res, statusCode, body) {
  res.status(statusCode).json(body);
}
