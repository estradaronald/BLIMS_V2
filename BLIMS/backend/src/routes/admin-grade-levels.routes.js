const router = require("express").Router();
const ctrl = require("../controllers/admin.grade-levels.controller");
const { requireRole } = require("../middlewares/rbac");

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
  if (!isPlainObject(req.body)) return badRequest(res, "Invalid request.");
  next();
}

function allowOnly(keys = []) {
  const allowed = new Set(keys);
  return (req, res, next) => {
    if (!isPlainObject(req.body)) return badRequest(res, "Invalid request.");
    for (const k of Object.keys(req.body)) {
      if (k.startsWith("$")) return badRequest(res, "Invalid request.");
      if (!allowed.has(k)) return badRequest(res, "Invalid request.");
    }
    next();
  };
}

// ==============================
// Session role sanity check
// ==============================
router.use((req, res, next) => {
  const role = req.session?.user?.role;
  if (role !== undefined && typeof role !== "string") {
    return res.status(401).json({ ok: false, message: "Unauthorized" });
  }
  next();
});

// ==============================
// RBAC
// ==============================
router.use(requireRole("Admin"));

// ==============================
// Grade Levels
// ==============================

// Get all grades
router.get("/grade-levels", ctrl.getGrades);

// Create grade
router.post(
  "/grade-levels",
  requireJsonBody,
  allowOnly(["grade"]),
  ctrl.createGrade
);

// Delete grade
router.delete(
  "/grade-levels/:gradeLevelId",
  validateObjectIdParam("gradeLevelId"),
  (req, res, next) => {
    req.params.id = req.params.gradeLevelId;
    next();
  },
  ctrl.deleteGrade
);

// ==============================
// Sections
// ==============================

// Summary (grade → section count)
router.get("/sections/summary", ctrl.getSummary);

// List sections
router.get("/sections", ctrl.listSections);

// Create section
router.post(
  "/sections",
  requireJsonBody,
  allowOnly(["grade", "section", "adviserId", "adviser", "capacity"]),
  ctrl.createSection
);

// Update section
router.put(
  "/sections/:sectionId",
  validateObjectIdParam("sectionId"),
  requireJsonBody,
  allowOnly(["grade", "section", "adviserId", "adviser", "capacity"]),
  ctrl.updateSection
);

// Delete section
router.delete(
  "/sections/:sectionId",
  validateObjectIdParam("sectionId"),
  ctrl.deleteSection
);

module.exports = router;