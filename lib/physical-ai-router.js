"use strict";

const graph = require("./graph-api");
const { createScheduledRefreshHandler } = require("./graph-cron-handler");
const { loadSnapshot } = require("./market-snapshot");

const scheduledHandlers = {
  "graph-refresh-weekly": createScheduledRefreshHandler("weekly"),
  "graph-refresh-monthly": createScheduledRefreshHandler("monthly"),
  "graph-refresh-quarterly": createScheduledRefreshHandler("quarterly"),
};

function marketCors(req, res) {
  const origin = String(req.headers?.origin || "");
  let allowed = origin === "https://ai-map-cyan.vercel.app"
    || origin === "https://ai-map-tishirs-projects.vercel.app"
    || origin === "https://tishir31.github.io"
    || origin === "http://localhost:5173";
  try {
    allowed ||= new URL(origin).hostname.endsWith(".vercel.app");
  } catch {
    // Invalid/missing Origin is normal for same-origin and server requests.
  }
  res.setHeader("Access-Control-Allow-Origin", allowed ? origin : "https://ai-map-cyan.vercel.app");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
}

function marketSend(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", status === 200
    ? "public, max-age=0, s-maxage=300, stale-while-revalidate=3600"
    : "no-store");
  return res.end(payload === null ? "" : JSON.stringify(payload));
}

async function marketSnapshot(req, res) {
  marketCors(req, res);
  if (req.method === "OPTIONS") return marketSend(res, 204, null);
  if (req.method !== "GET") return marketSend(res, 405, { ok: false, error: "Use GET." });
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return marketSend(res, 503, { ok: false, error: "Live market snapshot is not configured." });
  }
  try {
    const snapshot = await loadSnapshot({ supabaseUrl, serviceRoleKey });
    return marketSend(res, 200, { ok: true, source: "supabase-public-projection", snapshot });
  } catch (error) {
    console.error("[market-snapshot] failed", { error: error instanceof Error ? error.message : String(error) });
    return marketSend(res, 502, { ok: false, error: "Live market snapshot is temporarily unavailable." });
  }
}

async function graphSearch(req, res) {
  graph.setCors(req, res, "GET, OPTIONS");
  if (req.method === "OPTIONS") return graph.sendJson(res, 204, null);
  if (req.method !== "GET") return graph.sendJson(res, 405, { ok: false, error: "Use GET." });
  try {
    const results = await graph.searchEntities(graph.getConfig(), graph.param(req, "q"), graph.param(req, "limit"));
    return graph.sendJson(res, 200, {
      ok: true,
      query: graph.param(req, "q").trim(),
      count: results.length,
      results,
      source: "supabase",
    }, "public, max-age=0, s-maxage=60, stale-while-revalidate=300");
  } catch (error) {
    return graph.sendError(res, error);
  }
}

async function graphInvestigate(req, res) {
  graph.setCors(req, res, "GET, OPTIONS");
  if (req.method === "OPTIONS") return graph.sendJson(res, 204, null);
  if (req.method !== "GET") return graph.sendJson(res, 405, { ok: false, error: "Use GET." });
  try {
    const config = graph.getConfig();
    const user = await graph.verifyUser(req, config);
    const dossier = await graph.investigate(config, {
      id: graph.requiredEntityId(graph.param(req, "id")),
      hops: graph.parseHops(graph.param(req, "hops")),
      asOf: graph.parseAsOf(graph.param(req, "asOf")),
      user,
    });
    return graph.sendJson(res, 200, { ok: true, dossier }, user
      ? "private, no-store"
      : "public, max-age=0, s-maxage=60, stale-while-revalidate=300");
  } catch (error) {
    return graph.sendError(res, error);
  }
}

async function graphCompare(req, res) {
  graph.setCors(req, res, "GET, OPTIONS");
  if (req.method === "OPTIONS") return graph.sendJson(res, 204, null);
  if (req.method !== "GET") return graph.sendJson(res, 405, { ok: false, error: "Use GET." });
  try {
    const config = graph.getConfig();
    const user = await graph.verifyUser(req, config);
    const comparison = await graph.compare(config, {
      left: graph.requiredEntityId(graph.param(req, "left"), "left"),
      right: graph.requiredEntityId(graph.param(req, "right"), "right"),
      hops: graph.parseHops(graph.param(req, "hops")),
      asOf: graph.parseAsOf(graph.param(req, "asOf")),
      user,
    });
    return graph.sendJson(res, 200, { ok: true, comparison }, user
      ? "private, no-store"
      : "public, max-age=0, s-maxage=60, stale-while-revalidate=300");
  } catch (error) {
    return graph.sendError(res, error);
  }
}

async function graphReview(req, res) {
  graph.setCors(req, res, "POST, OPTIONS");
  if (req.method === "OPTIONS") return graph.sendJson(res, 204, null);
  if (req.method !== "POST") return graph.sendJson(res, 405, { ok: false, error: "Use POST." });
  try {
    const config = graph.getConfig();
    const user = await graph.verifyUser(req, config, { required: true });
    const body = graph.parseBody(req);
    if (body.action === "research_entity") {
      const staged = await graph.createResearchTasks(config, {
        entityId: graph.requiredEntityId(body.entityId, "entityId"),
        actorUserId: user.id,
      });
      return graph.sendJson(res, 202, { ok: true, staged });
    }
    if (body.action !== "approve" && body.action !== "reject") {
      throw new graph.ApiError(400, "action must be approve, reject, or research_entity.");
    }
    const candidateId = String(body.candidateId || "").trim();
    if (!/^[A-Za-z0-9_-]{3,120}$/.test(candidateId)) throw new graph.ApiError(400, "candidateId is invalid.");
    await graph.authorizeManualReview(config, user, candidateId);
    const decision = await graph.recordManualDecision(config, {
      candidateId,
      approve: body.action === "approve",
      actorUserId: user.id,
      reasonCodes: body.reasonCodes,
    });
    return graph.sendJson(res, 200, { ok: true, decision });
  } catch (error) {
    return graph.sendError(res, error);
  }
}

async function graphRefresh(req, res) {
  graph.setCors(req, res, "POST, OPTIONS");
  if (req.method === "OPTIONS") return graph.sendJson(res, 204, null);
  if (req.method !== "POST") return graph.sendJson(res, 405, { ok: false, error: "Use POST." });
  try {
    await graph.verifyCron(req);
    const result = await graph.runRefresh(graph.getConfig(), { cadence: graph.parseBody(req).cadence || "manual" });
    return graph.sendJson(res, result.stagingOnly ? 202 : 200, { ok: true, result });
  } catch (error) {
    return graph.sendError(res, error);
  }
}

async function retiredGraphRefresh(req, res) {
  graph.setCors(req, res, "GET, OPTIONS");
  if (req.method === "OPTIONS") return graph.sendJson(res, 204, null);
  if (req.method !== "GET") return graph.sendJson(res, 405, { ok: false, error: "Use GET." });
  return graph.sendJson(res, 410, {
    ok: false,
    error: "This legacy route is retired. Use the fixed weekly, monthly, or quarterly refresh route.",
  });
}

const routeHandlers = {
  "market-snapshot": marketSnapshot,
  "graph-search": graphSearch,
  "graph-investigate": graphInvestigate,
  "graph-compare": graphCompare,
  "graph-review": graphReview,
  "graph-refresh": graphRefresh,
  "graph-refresh-cron": retiredGraphRefresh,
  ...scheduledHandlers,
};

function physicalAiRoute(req) {
  if (typeof req.query?.physicalAiRoute === "string") return req.query.physicalAiRoute;
  try {
    const url = new URL(req.url || "/", `https://${req.headers?.host || "localhost"}`);
    return url.searchParams.get("physicalAiRoute") || "";
  } catch {
    return "";
  }
}

function canHandlePhysicalAiRoute(req) {
  return Object.hasOwn(routeHandlers, physicalAiRoute(req));
}

async function handlePhysicalAiRoute(req, res) {
  const route = physicalAiRoute(req);
  const handler = routeHandlers[route];
  if (!handler) return false;
  await handler(req, res);
  return true;
}

module.exports = {
  canHandlePhysicalAiRoute,
  handlePhysicalAiRoute,
  physicalAiRoute,
  routeHandlers,
};
