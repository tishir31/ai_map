"use strict";

const { sendJson, setCors } = require("../lib/graph-api");

module.exports = async function handler(req, res) {
  setCors(req, res, "GET, OPTIONS");
  if (req.method === "OPTIONS") return sendJson(res, 204, null);
  if (req.method !== "GET") return sendJson(res, 405, { ok: false, error: "Use GET." });
  return sendJson(res, 410, {
    ok: false,
    error: "This legacy route is retired. Use the fixed weekly, monthly, or quarterly refresh route.",
  });
};
