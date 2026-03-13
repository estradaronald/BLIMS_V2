// backend/src/middlewares/csrf.js
const crypto = require("crypto");

function newToken() {
  return crypto.randomBytes(32).toString("hex");
}

// Ensure every session has a CSRF token
function ensureCsrfToken(req, res, next) {
  if (req.session && !req.session.csrfToken) {
    req.session.csrfToken = newToken();
  }
  next();
}

// Protect unsafe methods (POST/PUT/PATCH/DELETE)
function csrfProtect(req, res, next) {
  const m = (req.method || "").toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return next();

  const sessionToken = req.session?.csrfToken;
  const token = req.get("X-CSRF-Token");

  if (!sessionToken || !token || token !== sessionToken) {
    return res.status(403).json({ ok: false, message: "Forbidden" });
  }

  next();
}

// Optional helper if you want to rotate token after login/MFA
function rotateCsrfToken(req) {
  if (req.session) req.session.csrfToken = newToken();
}

module.exports = { ensureCsrfToken, csrfProtect, rotateCsrfToken };