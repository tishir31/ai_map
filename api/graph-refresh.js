"use strict";

const {
  getConfig,
  parseBody,
  runRefresh,
  sendError,
  sendJson,
  setCors,
  verifyCron,
} = require("../lib/graph-api");

module.exports = async function handler(req, res) {
  setCors(req, res, "POST, OPTIONS");
  if (req.method === "OPTIONS") return sendJson(res, 204, null);
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "Use POST." });
  try {
    verifyCron(req);
    const result = await runRefresh(getConfig(), { cadence: parseBody(req).cadence || "manual" });
    return sendJson(res, result.stagingOnly ? 202 : 200, { ok: true, result });
  } catch (error) {
    return sendError(res, error);
  }
};
