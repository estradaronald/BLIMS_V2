// backend/src/routes/teacher.routes.js
const router = require("express").Router();
const { requireRole } = require("../middlewares/rbac");

// ------------------------------
// Category 2 helpers
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
    if (!isLikelyObjectId(val)) return badRequest(res);
    next();
  };
}
function requireJsonBody(req, res, next) {
  if (!isPlainObject(req.body)) return badRequest(res);
  next();
}

// ------------------------------
// RBAC — Teacher only
// ------------------------------
router.use(requireRole("Teacher"));

// TODO: Replace these placeholders with your real controller functions.
// Create
router.post("/items", requireJsonBody, (req, res) => {
  res.json({ ok: true, message: "Created (placeholder)" });
});

// Delete
router.delete("/items/:id", validateObjectIdParam("id"), (req, res) => {
  res.json({ ok: true, message: "Deleted (placeholder)" });
});

module.exports = router;