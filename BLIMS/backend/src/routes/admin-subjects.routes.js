const router = require("express").Router();
const ctrl = require("../controllers/admin.subjects.controller");
const { requireRole } = require("../middlewares/rbac");

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function badRequest(res, message = "Invalid request.") {
  return res.status(400).json({ ok: false, message });
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

router.get("/subjects/summary", ctrl.getSubjectsSummary);
router.get("/subjects", ctrl.getSubjectsByGrade);

router.post("/subjects", requireJsonBody, ctrl.createSubject);
router.put("/subjects/assign", requireJsonBody, ctrl.assignSubjectsToGrade);
router.delete("/subjects/assign", requireJsonBody, ctrl.removeSubjectFromGrade);

module.exports = router;