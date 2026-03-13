const AuditLog = require("../models/AuditLog.model");

function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length) return xff.split(",")[0].trim();
  return req.ip || req.connection?.remoteAddress || "";
}

/**
 * @param {import("express").Request} req
 * @param {{
 *  action: string,
 *  outcome?: "SUCCESS"|"FAIL"|"INFO",
 *  message?: string,
 *  meta?: any
 * }} payload
 */
async function writeAudit(req, payload) {
  try {
    const u = req.session?.user || null;

    await AuditLog.create({
      actor_user_id: u?.id || u?._id || null,
      actor_username: u?.username || "",
      actor_role: u?.role || "",

      action: payload.action,
      outcome: payload.outcome || "INFO",
      message: payload.message || "",

      ip: getClientIp(req),
      user_agent: req.headers["user-agent"] || "",
      path: req.originalUrl || req.path || "",

      meta: payload.meta || {},
    });
  } catch {
    // Never break the request if audit fails
  }
}

module.exports = { writeAudit };