const AuditLog = require("../models/AuditLog.model");

function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];

  if (typeof xff === "string" && xff.length) {
    return xff.split(",")[0].trim();
  }

  return req.ip || req.connection?.remoteAddress || "";
}

/**
 * Write an audit log.
 *
 * Normally, the actor is taken from req.session.user.
 * An optional payload.actor can be supplied for events that happen
 * before the normal authenticated session is established, such as
 * secondary authentication.
 *
 * @param {import("express").Request} req
 * @param {{
 *  action: string,
 *  outcome?: "SUCCESS"|"FAIL"|"INFO",
 *  message?: string,
 *  meta?: any,
 *  actor?: {
 *    userId?: string,
 *    id?: string,
 *    _id?: string,
 *    username?: string,
 *    userName?: string,
 *    email?: string,
 *    role?: string
 *  }
 * }} payload
 */
async function writeAudit(req, payload) {
  try {
    const sessionUser = req.session?.user || null;

    // Use the explicitly supplied actor when available.
    // Otherwise, fall back to the normal authenticated session user.
    const actor = payload.actor || sessionUser || null;

    await AuditLog.create({
      actor_user_id: actor?.userId || actor?.id || actor?._id || null,

      actor_username: actor?.username || actor?.userName || actor?.email || "",

      actor_role: actor?.role || "",

      action: payload.action,
      outcome: payload.outcome || "INFO",
      message: payload.message || "",

      ip: getClientIp(req),

      user_agent: req.headers["user-agent"] || "",

      path: req.originalUrl || req.path || "",

      meta: payload.meta || {},
    });
  } catch (auditError) {
    console.error("writeAudit error:", auditError);

    // Never break the request if audit logging fails.
  }
}

module.exports = { writeAudit };
