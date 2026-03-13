// backend/src/routes/admin.teachers.routes.js
const router = require("express").Router();
const ctrl = require("../controllers/admin.teachers.controller");
const { requireRole } = require("../middlewares/rbac");

// ------------------------------
// ✅ Category 2 helpers (router-level validation)
// ------------------------------
function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function badRequest(res, message = "Invalid request.") {
  return res.status(400).json({ ok: false, message });
}

function isLikelyObjectId(s) {
  return typeof s === "string" && /^[a-fA-F0-9]{24}$/.test(s);
}

function validateObjectIdParam(paramName) {
  return (req, res, next) => {
    const val = String(req.params?.[paramName] || "").trim();
    if (!isLikelyObjectId(val)) return badRequest(res, "Invalid request.");
    next();
  };
}

function requireJsonBody(req, res, next) {
  // Must be a plain object (blocks arrays, strings, null, etc.)
  if (!isPlainObject(req.body)) return badRequest(res, "Invalid request.");
  next();
}

// Optional: allowlist body keys (prevents unexpected fields / operator injection surface)
function allowOnly(keys = []) {
  const allowed = new Set(keys);
  return (req, res, next) => {
    if (!isPlainObject(req.body)) return badRequest(res, "Invalid request.");
    for (const k of Object.keys(req.body)) {
      // block Mongo operators-like keys at top-level too
      if (k.startsWith("$")) return badRequest(res, "Invalid request.");
      if (!allowed.has(k)) return badRequest(res, "Invalid request.");
    }
    next();
  };
}

// ------------------------------
// ✅ Category 3 (RBAC): Admin-only for everything in this router
// + Session user hardening (role must be a plain string)
// ------------------------------
router.use((req, res, next) => {
  const role = req.session?.user?.role;
  if (role !== undefined && typeof role !== "string") {
    // If role exists but isn't a string, treat as invalid session state
    return res.status(401).json({ ok: false, message: "Unauthorized" });
  }
  next();
});

router.use(requireRole("Admin"));

// ------------------------------
// Routes
// ------------------------------

// List
router.get("/teachers", ctrl.listTeachers);

// Create
router.post("/teachers", requireJsonBody, ctrl.createTeacher);

// Update
router.put(
  "/teachers/:teacherId",
  validateObjectIdParam("teacherId"),
  requireJsonBody,
  ctrl.updateTeacher
);

// Reset password
router.post(
  "/teachers/:teacherId/reset-password",
  validateObjectIdParam("teacherId"),
  requireJsonBody,
  ctrl.resetTeacherPassword
);

// Disable
router.patch(
  "/teachers/:teacherId/disable",
  validateObjectIdParam("teacherId"),
  ctrl.disableTeacher
);

// Delete
router.delete(
  "/teachers/:teacherId",
  validateObjectIdParam("teacherId"),
  ctrl.deleteTeacher
);

module.exports = router;