const TABLES = [
  ["tasks", "research_tasks", "created_at", true],
  ["rows", "research_rows", "rank", true],
  ["cells", "research_cells", "column_key", true],
  ["citations", "research_citations", "retrieved_at", true],
  ["events", "research_events", "created_at", false],
];

export default async function handler(req, res) {
  if (req.method !== "GET") return send(res, 405, { ok: false, error: "Use GET." });
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) return send(res, 503, { ok: false, error: "Research snapshot API is not configured." });
    const runId = req.query?.runId || undefined;
    const runRows = await restSelect(supabaseUrl, serviceKey, "research_runs", runId
      ? { id: `eq.${runId}`, limit: "1" }
      : { order: "started_at.desc", limit: "1" });
    const runRow = runRows[0];
    if (!runRow) return send(res, 200, { ok: true, snapshot: null });
    const parts = await Promise.all(TABLES.map(([key, table, order, ascending]) =>
      restSelect(supabaseUrl, serviceKey, table, {
        run_id: `eq.${runRow.id}`,
        order: `${order}.${ascending ? "asc" : "desc"}`,
      }).then((rows) => [key, rows])
    ));
    const data = Object.fromEntries(parts);
    return send(res, 200, {
      ok: true,
      snapshot: {
        run: toRun(runRow),
        tasks: data.tasks.map(toTask),
        rows: data.rows.map(toResearchRow),
        cells: data.cells.map(toCell),
        citations: data.citations.map(toCitation),
        events: data.events.map(toEvent),
      },
    });
  } catch (error) {
    return send(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
  }
}

async function restSelect(supabaseUrl, serviceKey, table, params) {
  const url = new URL(`/rest/v1/${table}`, supabaseUrl);
  url.searchParams.set("select", "*");
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  });
  if (!response.ok) throw new Error(`${table}: HTTP ${response.status}`);
  return response.json();
}

function toRun(row) {
  return {
    id: row.id,
    prompt: row.prompt,
    subject: row.subject,
    status: row.status,
    coverageScore: row.coverage_score,
    acceptedRows: row.accepted_rows,
    candidateRows: row.candidate_rows,
    completedCells: row.completed_cells,
    totalCells: row.total_cells,
    startedAt: row.started_at,
    completedAt: row.completed_at || undefined,
    lastRefreshAt: row.last_refresh_at || undefined,
    summary: row.summary,
  };
}

function toTask(row) {
  return {
    id: row.id,
    runId: row.run_id,
    type: row.type,
    status: row.status,
    agentName: row.agent_name,
    input: row.input || {},
    output: row.output || undefined,
    error: row.error || undefined,
    createdAt: row.created_at,
    startedAt: row.started_at || undefined,
    completedAt: row.completed_at || undefined,
  };
}

function toResearchRow(row) {
  return {
    id: row.id,
    runId: row.run_id,
    companyName: row.company_name,
    normalizedName: row.normalized_name,
    rank: row.rank,
    relevanceScore: row.relevance_score,
    status: row.status,
    website: row.website || undefined,
  };
}

function toCell(row) {
  return {
    id: row.id,
    runId: row.run_id,
    rowId: row.row_id,
    columnKey: row.column_key,
    value: row.value,
    status: row.status,
    confidence: row.confidence,
    sourceTier: row.source_tier || undefined,
    publisherDecision: row.publisher_decision,
    agentName: row.agent_name,
    lastCheckedAt: row.last_checked_at,
    citationIds: row.citation_ids || [],
    conflictNote: row.conflict_note || undefined,
  };
}

function toCitation(row) {
  return {
    id: row.id,
    runId: row.run_id,
    rowId: row.row_id,
    cellId: row.cell_id || undefined,
    url: row.url,
    title: row.title,
    sourceTier: row.source_tier,
    retrievedAt: row.retrieved_at,
    evidence: row.evidence,
  };
}

function toEvent(row) {
  return {
    id: row.id,
    runId: row.run_id,
    rowId: row.row_id || undefined,
    cellId: row.cell_id || undefined,
    taskId: row.task_id || undefined,
    eventType: row.event_type,
    agentName: row.agent_name,
    message: row.message,
    metadata: row.metadata || undefined,
    createdAt: row.created_at,
  };
}

function send(res, statusCode, body) {
  res.status(statusCode).json(body);
}
