// backend/src/routes/admin.audit.routes.js
const express = require("express");
const AuditLog = require("../models/AuditLog.model");
const { requireRole } = require("../middlewares/rbac");

const router = express.Router();

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

// GET /api/admin/audit-logs?page=1&limit=25&q=login&action=AUTH_LOGIN_SUCCESS&outcome=SUCCESS
router.get("/audit-logs", async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit || "25", 10)));

    const q = String(req.query.q || "").trim();
    const action = String(req.query.action || "").trim();
    const outcome = String(req.query.outcome || "").trim();

    const filter = {};
    if (action) filter.action = action;
    if (outcome) filter.outcome = outcome;

    if (q) {
      filter.$or = [
        { actor_username: { $regex: q, $options: "i" } },
        { message: { $regex: q, $options: "i" } },
        { action: { $regex: q, $options: "i" } },
        { ip: { $regex: q, $options: "i" } },
      ];
    }

    const [total, rows] = await Promise.all([
      AuditLog.countDocuments(filter),
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    res.json({
      ok: true,
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
      rows,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;