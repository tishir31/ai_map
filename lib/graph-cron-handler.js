"use strict";

const graphApi = require("./graph-api");

const SCHEDULED_CADENCES = new Set(["weekly", "monthly", "quarterly"]);

function createScheduledRefreshHandler(cadence, dependencies = graphApi) {
  if (!SCHEDULED_CADENCES.has(cadence)) {
    throw new Error(`Unsupported scheduled graph cadence: ${cadence}`);
  }
  const today = typeof dependencies.today === "function"
    ? dependencies.today
    : () => new Date().toISOString().slice(0, 10);

  const handler = async function scheduledGraphRefresh(req, res) {
    dependencies.setCors(req, res, "GET, OPTIONS");
    if (req.method === "OPTIONS") return dependencies.sendJson(res, 204, null);
    if (req.method !== "GET") return dependencies.sendJson(res, 405, { ok: false, error: "Use GET." });
    try {
      const authorization = await dependencies.verifyCron(req, `graph-refresh-${cadence}`);
      const asOf = authorization?.schedulerRunDate || today();
      const result = await dependencies.runRefresh(dependencies.getConfig(), {
        cadence,
        asOf,
        scheduled: true,
      });
      return dependencies.sendJson(res, result.stagingOnly ? 202 : 200, { ok: true, cadence, asOf, result });
    } catch (error) {
      return dependencies.sendError(res, error);
    }
  };
  handler.cadence = cadence;
  return handler;
}

module.exports = { createScheduledRefreshHandler };
