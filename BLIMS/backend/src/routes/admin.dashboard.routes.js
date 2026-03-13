// backend/src/routes/admin.dashboard.routes.js
const router = require("express").Router();
const ctrl = require("../controllers/admin.dashboard.controller");
const { requireRole } = require("../middlewares/rbac");

// ------------------------------
// ✅ Session hardening (role must be string if present)
// ------------------------------
router.use((req, res, next) => {
  const role = req.session?.user?.role;
  if (role !== undefined && typeof role !== "string") {
    return res.status(401).json({ ok: false, message: "Unauthorized" });
  }
  next();
});

// ✅ Admin-only
router.use(requireRole("Admin"));

// GET /api/admin/dashboard
router.get("/dashboard", ctrl.getAdminDashboardStats);

module.exports = router;