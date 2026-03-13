// backend/src/middlewares/rbac.js

function normalizeRole(role) {
  return String(role || "")
    .trim()
    .toLowerCase();
}

// ==============================
// Require Authentication
// ==============================
function requireAuth(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ ok: false, message: "Unauthorized" });
  }
  next();
}

// ==============================
// Require Specific Role (case-insensitive)
// ==============================
function requireRole(role) {
  const expected = normalizeRole(role);

  return (req, res, next) => {
    if (!req.session?.user) {
      return res.status(401).json({ ok: false, message: "Unauthorized" });
    }

    const actual = normalizeRole(req.session.user.role);

    if (actual !== expected) {
      return res.status(403).json({ ok: false, message: "Forbidden" });
    }

    next();
  };
}

// ==============================
// Require Any of Multiple Roles
// ==============================
function requireAnyRole(roles = []) {
  const allowed = roles.map(normalizeRole);

  return (req, res, next) => {
    if (!req.session?.user) {
      return res.status(401).json({ ok: false, message: "Unauthorized" });
    }

    const actual = normalizeRole(req.session.user.role);

    if (!allowed.includes(actual)) {
      return res.status(403).json({ ok: false, message: "Forbidden" });
    }

    next();
  };
}

module.exports = { requireAuth, requireRole, requireAnyRole };