"use strict";

const {
  ApiError,
  authorizeManualReview,
  createResearchTasks,
  getConfig,
  parseBody,
  recordManualDecision,
  requiredEntityId,
  sendError,
  sendJson,
  setCors,
  verifyUser,
} = require("../lib/graph-api");

module.exports = async function handler(req, res) {
  setCors(req, res, "POST, OPTIONS");
  if (req.method === "OPTIONS") return sendJson(res, 204, null);
  if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "Use POST." });
  try {
    const config = getConfig();
    const user = await verifyUser(req, config, { required: true });
    const body = parseBody(req);
    if (body.action === "research_entity") {
      const staged = await createResearchTasks(config, {
        entityId: requiredEntityId(body.entityId, "entityId"),
        actorUserId: user.id,
      });
      return sendJson(res, 202, { ok: true, staged });
    }
    if (body.action !== "approve" && body.action !== "reject") {
      throw new ApiError(400, "action must be approve, reject, or research_entity.");
    }
    const candidateId = String(body.candidateId || "").trim();
    if (!/^[A-Za-z0-9_-]{3,120}$/.test(candidateId)) throw new ApiError(400, "candidateId is invalid.");
    await authorizeManualReview(config, user, candidateId);
    const decision = await recordManualDecision(config, {
      candidateId,
      approve: body.action === "approve",
      actorUserId: user.id,
      reasonCodes: body.reasonCodes,
    });
    return sendJson(res, 200, { ok: true, decision });
  } catch (error) {
    return sendError(res, error);
  }
};
