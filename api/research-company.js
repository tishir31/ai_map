// Vercel Serverless Function — Physical AI company researcher.
// POST /api/research-company  { name: string }
// Returns: { ok: true, candidate: { ...Company-like, suggestedActivity, sources } }
//
// Uses Gemini (already configured for the parent ai_map_repo). Keeps the API
// key server-side. Returns structured JSON the frontend modal can preview.

const ALLOWED_SUBSECTORS = [
    "robotics",
    "humanoids",
    "autonomous vehicles",
    "drones",
    "defense autonomy",
    "industrial automation",
    "embodied AI",
    "edge AI hardware",
    "other"
];
const MODEL_CANDIDATES = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"];
const COMPANY_ALIASES = new Map([
    [
        "world labs",
        "World Labs AI (worldlabs.ai), the spatial intelligence and world-model company founded by Fei-Fei Li, Justin Johnson, Christoph Lassner, and Ben Mildenhall"
    ]
]);
const RESEARCH_SHEET_TABLES = [
    ["tasks", "research_tasks", "created_at", true],
    ["rows", "research_rows", "rank", true],
    ["cells", "research_cells", "column_key", true],
    ["citations", "research_citations", "retrieved_at", true],
    ["events", "research_events", "created_at", false],
];
const RESEARCH_TAXONOMY = [
    "humanoid robotics",
    "robotics foundation models",
    "defense autonomy",
    "warehouse and logistics robotics",
    "autonomous vehicles and trucking",
    "drones and aerial autonomy",
    "industrial inspection robotics",
    "agriculture and construction robotics",
];
const RESEARCH_EXCLUSION_RULES = [
    "Exclude pure software AI companies unless the product controls physical-world autonomy.",
    "Exclude academic labs without an operating company or commercial activity.",
    "Stage weak funding, valuation, customer, and employee-count claims until independently sourced.",
];

const PROMPT = (companyName) => `You are a Physical AI investment research assistant. Research the company named "${companyName}".

Coverage includes companies building physical-world AI and the adjacent infrastructure used by robotics, autonomy, industrial automation, defense autonomy, and embodied AI teams. In-scope infrastructure includes spatial intelligence, world models, simulation, synthetic data, autonomy data platforms, robotics foundation models, and edge AI hardware, even when the company does not manufacture robots itself.

Return a strict JSON object (no markdown, no preamble, no trailing text) with this exact shape:

{
  "name": "Official company name",
  "overview": "1-2 sentence factual summary of what the company does. No hype.",
  "subsector": "ONE of: ${ALLOWED_SUBSECTORS.join(" | ")}",
  "geography": "Country of headquarters (e.g. 'United States', 'Germany', 'China')",
  "website": "https://...",
  "suggestedActivity": {
    "dateAnnounced": "YYYY-MM-DD of the most recent funding round, M&A, or significant commercial milestone you are confident about",
    "activityType": "ONE of: financing | m&a | partnership | customer contract | product launch | infrastructure | other",
    "dealValueUsd": null OR a number in USD,
    "counterparty": "Investors / acquirer / partner (comma-separated names). 'N/A' if none.",
    "description": "1-2 sentence factual description of the activity",
    "sourceUrl": "Best primary source URL (press release > SEC filing > major outlet article)",
    "sourceType": "ONE of: press release | SEC filing | article | company blog | other",
    "confidence": "confirmed if company-disclosed, reported if press-cited, estimated if you are inferring"
  },
  "additionalSources": ["url1", "url2"],
  "notes": "Optional: caveats about uncertainty, what you'd want a human to verify"
}

CRITICAL rules:
- Treat spatial/world-model/simulation companies as in scope when their technology models, simulates, controls, or reasons about the physical world for robotics, autonomy, industrial, defense, or embodied AI use cases.
- If a real company is adjacent Physical AI infrastructure, classify it as "embodied AI" or "other" and explain the caveat in notes.
- Only return {"error": "not found", "notes": "..."} when the company cannot be identified or is clearly unrelated to Physical AI and adjacent physical-world AI infrastructure.
- Never fabricate URLs. If you can't recall a specific source URL, use the company's domain root.
- Use "estimated" confidence whenever you are inferring details rather than citing them.
- Output ONLY the JSON. No code fences, no explanation.`;

function parseModelJson(text) {
    const raw = String(text || "").trim();
    if (!raw) throw new Error("empty model response");

    const unfenced = raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

    try {
        return JSON.parse(unfenced);
    } catch {
        const start = unfenced.indexOf("{");
        const end = unfenced.lastIndexOf("}");
        if (start >= 0 && end > start) {
            return JSON.parse(unfenced.slice(start, end + 1));
        }
        throw new Error("model response was not parseable JSON");
    }
}

function normalizeActivity(activity) {
    if (!activity || typeof activity !== "object") return null;
    const allowedActivityTypes = ["financing", "m&a", "partnership", "customer contract", "product launch", "infrastructure", "other"];
    const allowedSourceTypes = ["press release", "SEC filing", "article", "company blog", "other"];
    const allowedConfidence = ["confirmed", "reported", "estimated"];
    return {
        dateAnnounced: typeof activity.dateAnnounced === "string" ? activity.dateAnnounced : "",
        activityType: allowedActivityTypes.includes(activity.activityType) ? activity.activityType : "other",
        dealValueUsd: typeof activity.dealValueUsd === "number" && Number.isFinite(activity.dealValueUsd) ? activity.dealValueUsd : null,
        counterparty: String(activity.counterparty || "N/A"),
        description: String(activity.description || ""),
        sourceUrl: typeof activity.sourceUrl === "string" && /^https?:\/\//.test(activity.sourceUrl) ? activity.sourceUrl : "",
        sourceType: allowedSourceTypes.includes(activity.sourceType) ? activity.sourceType : "other",
        confidence: allowedConfidence.includes(activity.confidence) ? activity.confidence : "estimated"
    };
}

async function generateWithFallback(apiKey, prompt) {
    let lastError = null;
    for (const model of MODEL_CANDIDATES) {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.2,
                        maxOutputTokens: 4096,
                        responseMimeType: "application/json"
                    }
                })
            }
        );
        const data = await response.json();
        if (response.ok) return { model, data };
        lastError = { status: response.status, data, model };
        if (![429, 500, 502, 503, 504].includes(response.status)) break;
    }
    return { error: lastError };
}

function getResearchAction(req) {
    if (typeof req.query?.action === "string") return req.query.action;
    try {
        const url = new URL(req.url || "/api/research-company", `https://${req.headers.host || "localhost"}`);
        return url.searchParams.get("action") || "";
    } catch {
        return "";
    }
}

function getRequestBody(req) {
    if (typeof req.body === "string") {
        try {
            return JSON.parse(req.body);
        } catch {
            return {};
        }
    }
    return req.body && typeof req.body === "object" ? req.body : {};
}

async function handleResearchSnapshot(req, res) {
    if (req.method !== "GET") return sendApi(res, 405, { ok: false, error: "Use GET." });
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) return sendApi(res, 503, { ok: false, error: "Research snapshot API is not configured." });

    const actionUrl = new URL(req.url || "/api/research-company", `https://${req.headers.host || "localhost"}`);
    const runId = req.query?.runId || actionUrl.searchParams.get("runId") || undefined;
    const runRows = await researchRestSelect(supabaseUrl, serviceKey, "research_runs", runId
        ? { id: `eq.${runId}`, limit: "1" }
        : { order: "started_at.desc", limit: "1" });
    const runRow = runRows[0];
    if (!runRow) return sendApi(res, 200, { ok: true, snapshot: null });

    const parts = await Promise.all(RESEARCH_SHEET_TABLES.map(([key, table, order, ascending]) =>
        researchRestSelect(supabaseUrl, serviceKey, table, {
            run_id: `eq.${runRow.id}`,
            order: `${order}.${ascending ? "asc" : "desc"}`,
        }).then((rows) => [key, rows])
    ));
    const data = Object.fromEntries(parts);
    return sendApi(res, 200, {
        ok: true,
        snapshot: {
            run: toResearchRun(runRow),
            tasks: data.tasks.map(toResearchTask),
            rows: data.rows.map(toResearchRow),
            cells: data.cells.map(toResearchCell),
            citations: data.citations.map(toResearchCitation),
            events: data.events.map(toResearchEvent),
        },
    });
}

async function handleResearchRun(req, res) {
    if (req.method !== "POST") return sendApi(res, 405, { ok: false, error: "Use POST." });
    const body = getRequestBody(req);
    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    if (!prompt) return sendApi(res, 400, { ok: false, error: "Missing prompt." });

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) return sendApi(res, 503, { ok: false, error: "Research persistence is not configured." });

    const snapshot = createDraftResearchSnapshot(prompt);
    await researchRestUpsert(supabaseUrl, serviceKey, "research_runs", [toResearchRunRow(snapshot.run)]);
    await researchRestUpsert(supabaseUrl, serviceKey, "research_tasks", snapshot.tasks.map(toResearchTaskRow));
    await researchRestUpsert(supabaseUrl, serviceKey, "research_events", snapshot.events.map(toResearchEventRow));
    return sendApi(res, 200, { ok: true, runId: snapshot.run.id, taskCount: snapshot.tasks.length });
}

async function researchRestSelect(supabaseUrl, serviceKey, table, params) {
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

async function researchRestUpsert(supabaseUrl, serviceKey, table, rows) {
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

function createDraftResearchSnapshot(prompt) {
    const now = new Date().toISOString();
    const runId = `run-${slugifyResearchPrompt(prompt).slice(0, 42)}-${Date.now().toString(36)}`;
    const subject = subjectFromResearchPrompt(prompt);
    const tasks = createResearchTasks(runId, prompt, subject, now);
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

function createResearchTasks(runId, prompt, subject, now) {
    const definitions = [
        ["planner", "Planner Agent", { objective: "Convert the prompt into inclusion rules, taxonomy, query packs, and source policy." }],
        ["discovery", "Discovery Agent", { objective: "Find candidate companies and reject tangential names.", minAcceptedCompanies: 30, queryPacks: RESEARCH_TAXONOMY.map((theme) => `${theme} companies funding customers`) }],
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
        input: { prompt, subject, taxonomy: RESEARCH_TAXONOMY, exclusionRules: RESEARCH_EXCLUSION_RULES, ...input },
        createdAt: new Date(new Date(now).getTime() + index * 1000).toISOString(),
    }));
}

function toResearchRun(row) {
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

function toResearchTask(row) {
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

function toResearchCell(row) {
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

function toResearchCitation(row) {
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

function toResearchEvent(row) {
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

function toResearchRunRow(run) {
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

function toResearchTaskRow(task) {
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

function toResearchEventRow(event) {
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

function subjectFromResearchPrompt(prompt) {
    const lower = prompt.toLowerCase();
    if (lower.includes("physical ai")) return "Physical AI Landscape";
    if (lower.includes("humanoid")) return "Humanoid Robotics Landscape";
    if (lower.includes("defense")) return "Defense Autonomy Landscape";
    return titleCaseResearchPrompt(prompt.replace(/^(build|create|map|research|generate)\s+/i, "").split(/[.?!]/)[0].slice(0, 80) || "Research Landscape");
}

function titleCaseResearchPrompt(value) {
    return value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function slugifyResearchPrompt(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "research";
}

function sendApi(res, statusCode, body) {
    return res.status(statusCode).json(body);
}

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    if (req.method === "OPTIONS") {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        return res.status(204).end();
    }

    const researchAction = getResearchAction(req);
    if (researchAction === "snapshot") {
        return handleResearchSnapshot(req, res).catch((error) => sendApi(res, 500, { ok: false, error: String(error) }));
    }
    if (researchAction === "run") {
        return handleResearchRun(req, res).catch((error) => sendApi(res, 500, { ok: false, error: String(error) }));
    }

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY not configured in Vercel environment" });
    }

    let body = req.body;
    if (typeof body === "string") {
        try {
            body = JSON.parse(body);
        } catch {
            body = {};
        }
    }
    const name = (body && body.name) ? String(body.name).trim() : "";
    if (!name) {
        return res.status(400).json({ error: "Missing 'name' in request body" });
    }
    if (name.length > 120) {
        return res.status(400).json({ error: "Name too long" });
    }
    const researchName = COMPANY_ALIASES.get(name.toLowerCase()) || name;

    try {
        const generated = await generateWithFallback(apiKey, PROMPT(researchName));
        if (generated.error) {
            return res.status(generated.error.status || 502).json({
                error: "Gemini error",
                model: generated.error.model,
                detail: generated.error.data
            });
        }
        const { data, model } = generated;

        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        let parsed;
        try {
            parsed = parseModelJson(text);
        } catch (err) {
            return res.status(502).json({ error: "Model did not return valid JSON", raw: text });
        }

        if (parsed.error) {
            return res.status(404).json({ error: parsed.error, notes: parsed.notes });
        }

        // Normalise / validate the shape so the frontend can rely on it.
        const subsector = ALLOWED_SUBSECTORS.includes(parsed.subsector) ? parsed.subsector : "other";
        const candidate = {
            name: String(parsed.name || name),
            overview: String(parsed.overview || ""),
            subsector,
            geography: String(parsed.geography || ""),
            website: typeof parsed.website === "string" && /^https?:\/\//.test(parsed.website) ? parsed.website : undefined,
            suggestedActivity: normalizeActivity(parsed.suggestedActivity),
            additionalSources: Array.isArray(parsed.additionalSources)
                ? parsed.additionalSources.filter((url) => typeof url === "string" && /^https?:\/\//.test(url)).slice(0, 6)
                : [],
            notes: parsed.notes ? String(parsed.notes) : null,
            generatedAt: new Date().toISOString(),
            model
        };

        return res.status(200).json({ ok: true, candidate });
    } catch (error) {
        return res.status(500).json({ error: "Unexpected server error", detail: String(error) });
    }
}
