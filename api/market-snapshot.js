"use strict";

const { loadSnapshot } = require("../lib/market-snapshot");

const ALLOWED_ORIGINS = new Set([
  "https://ai-map-cyan.vercel.app",
  "https://tishir31.github.io",
  "http://localhost:5173",
]);

function setCors(req, res) {
  const origin = req.headers.origin || "";
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGINS.has(origin) ? origin : "https://ai-map-cyan.vercel.app");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Vary", "Origin");
}

function send(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (status === 200) res.setHeader("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=3600");
  return res.end(payload === null ? "" : JSON.stringify(payload));
}

module.exports = async function handler(req, res) {
  setCors(req, res);
  if (req.method === "OPTIONS") return send(res, 204, null);
  if (req.method !== "GET") return send(res, 405, { ok: false, error: "Use GET." });
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return send(res, 503, { ok: false, error: "Live market snapshot is not configured." });
  }
  try {
    const snapshot = await loadSnapshot({ supabaseUrl, serviceRoleKey });
    return send(res, 200, { ok: true, source: "supabase-public-projection", snapshot });
  } catch (error) {
    console.error("[market-snapshot] failed", { error: error instanceof Error ? error.message : String(error) });
    return send(res, 502, { ok: false, error: "Live market snapshot is temporarily unavailable." });
  }
};
