"use strict";

const {
  getConfig,
  param,
  searchEntities,
  sendError,
  sendJson,
  setCors,
} = require("../lib/graph-api");

module.exports = async function handler(req, res) {
  setCors(req, res, "GET, OPTIONS");
  if (req.method === "OPTIONS") return sendJson(res, 204, null);
  if (req.method !== "GET") return sendJson(res, 405, { ok: false, error: "Use GET." });
  try {
    const results = await searchEntities(getConfig(), param(req, "q"), param(req, "limit"));
    return sendJson(res, 200, {
      ok: true,
      query: param(req, "q").trim(),
      count: results.length,
      results,
      source: "supabase",
    }, "public, max-age=0, s-maxage=60, stale-while-revalidate=300");
  } catch (error) {
    return sendError(res, error);
  }
};
