const router = require("express").Router();

const ctrl = require("../controllers/admin.students.controller");

const { requireRole } = require("../middlewares/rbac");

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function badRequest(res, message = "Invalid request.") {
  return res.status(400).json({
    ok: false,
    message,
  });
}

function isLikelyObjectId(s) {
  return (
    typeof s === "string" &&
    /^[a-fA-F0-9]{24}$/.test(s)
  );
}

function validateObjectIdParam(paramName) {
  return (req, res, next) => {
    const val = String(
      req.params?.[paramName] || ""
    ).trim();

    if (!isLikelyObjectId(val)) {
      return badRequest(
        res,
        "Invalid request."
      );
    }

    next();
  };
}

function requireJsonBody(req, res, next) {
  if (!isPlainObject(req.body)) {
    return badRequest(
      res,
      "Invalid request."
    );
  }

  next();
}

// -----------------------------
// Basic session role validation
// -----------------------------
router.use((req, res, next) => {
  const role = req.session?.user?.role;

  if (
    role !== undefined &&
    typeof role !== "string"
  ) {
    return res.status(401).json({
      ok: false,
      message: "Unauthorized",
    });
  }

  next();
});

// -----------------------------
// Admin only
// -----------------------------
router.use(requireRole("Admin"));

// -----------------------------
// List students
// GET /students
// -----------------------------
router.get(
  "/students",
  ctrl.listStudents
);

// -----------------------------
// Create one student
// POST /students
// -----------------------------
router.post(
  "/students",
  requireJsonBody,
  ctrl.createStudent
);

// -----------------------------
// Bulk create students
// POST /students/bulk
// -----------------------------
router.post(
  "/students/bulk",
  requireJsonBody,
  ctrl.bulkCreateStudents
);

// -----------------------------
// Update student
// PUT /students/:studentId
// -----------------------------
router.put(
  "/students/:studentId",
  validateObjectIdParam("studentId"),
  requireJsonBody,
  ctrl.updateStudent
);

// -----------------------------
// Reset student password
// POST /students/:studentId/reset-password
// -----------------------------
router.post(
  "/students/:studentId/reset-password",
  validateObjectIdParam("studentId"),
  requireJsonBody,
  ctrl.resetStudentPassword
);

// -----------------------------
// Disable student
// PATCH /students/:studentId/disable
// -----------------------------
router.patch(
  "/students/:studentId/disable",
  validateObjectIdParam("studentId"),
  ctrl.disableStudent
);

// -----------------------------
// Delete student
// DELETE /students/:studentId
// -----------------------------
router.delete(
  "/students/:studentId",
  validateObjectIdParam("studentId"),
  ctrl.deleteStudent
);

module.exports = router;