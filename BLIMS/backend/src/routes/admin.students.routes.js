const router = require("express").Router();
const ctrl = require("../controllers/admin.students.controller");
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

router.use((req, res, next) => {
  const role = req.session?.user?.role;
  if (role !== undefined && typeof role !== "string") {
    return res.status(401).json({ ok: false, message: "Unauthorized" });
  }
  next();
});

router.use(requireRole("Admin"));

router.get("/students", ctrl.listStudents);

router.post("/students", requireJsonBody, ctrl.createStudent);

router.put(
  "/students/:studentId",
  validateObjectIdParam("studentId"),
  requireJsonBody,
  ctrl.updateStudent
);

router.post(
  "/students/:studentId/reset-password",
  validateObjectIdParam("studentId"),
  requireJsonBody,
  ctrl.resetStudentPassword
);

router.patch(
  "/students/:studentId/disable",
  validateObjectIdParam("studentId"),
  ctrl.disableStudent
);

router.delete(
  "/students/:studentId",
  validateObjectIdParam("studentId"),
  ctrl.deleteStudent
);

module.exports = router;