"use strict";

const {
  compare,
  getConfig,
  param,
  parseAsOf,
  parseHops,
  requiredEntityId,
  sendError,
  sendJson,
  setCors,
  verifyUser,
} = require("../lib/graph-api");

module.exports = async function handler(req, res) {
  setCors(req, res, "GET, OPTIONS");
  if (req.method === "OPTIONS") return sendJson(res, 204, null);
  if (req.method !== "GET") return sendJson(res, 405, { ok: false, error: "Use GET." });
  try {
    const config = getConfig();
    const user = await verifyUser(req, config);
    const payload = await compare(config, {
      left: requiredEntityId(param(req, "left"), "left"),
      right: requiredEntityId(param(req, "right"), "right"),
      hops: parseHops(param(req, "hops")),
      asOf: parseAsOf(param(req, "asOf")),
      user,
    });
    return sendJson(res, 200, { ok: true, comparison: payload }, user
      ? "private, no-store"
      : "public, max-age=0, s-maxage=60, stale-while-revalidate=300");
  } catch (error) {
    return sendError(res, error);
  }
};
