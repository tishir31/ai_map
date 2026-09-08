"use strict";
const { createHmac } = require("node:crypto");

async function databaseRpc(name, payload) {
  const origin = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!origin || !key) throw new Error("Public research service is not configured.");
  const response = await fetch(`${origin}/rest/v1/rpc/${name}`, {
    method: "POST", signal: AbortSignal.timeout(10000),
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Public research service is temporarily unavailable.");
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function allowPublicAction(req, res, action, perHour = 20, totalPerDay = 200) {
  res.setHeader("Cache-Control", "no-store");
  const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});
  if (Buffer.byteLength(raw) > 24000) { res.status(413).json({ ok: false, error: "Request exceeds 24 KB." }); return false; }
  // Vercel supplies this header. The hash rotates daily; no raw IP is retained.
  const address = String(req.headers["x-vercel-forwarded-for"] || req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown").split(",")[0].trim();
  const day = new Date().toISOString().slice(0, 10);
  const hash = createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY || "unconfigured").update(`${day}:${address}`).digest("hex");
  try {
    const allowed = await databaseRpc("consume_public_action", { p_action: action, p_actor: hash, p_hour_limit: perHour, p_day_limit: totalPerDay });
    if (!allowed) {
      res.setHeader("Retry-After", "3600");
      res.status(429).json({ ok: false, error: "Public research usage limit reached. Try again later; browsing and your saved workspace remain available." });
      return false;
    }
    return true;
  } catch {
    res.status(503).json({ ok: false, error: "Public research service is temporarily unavailable. Your workspace is unchanged." });
    return false;
  }
}
module.exports = { allowPublicAction, databaseRpc };
