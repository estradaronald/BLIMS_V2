// backend/src/routes/admin.audit.routes.js

const express = require("express");
const AuditLog = require("../models/AuditLog.model");
const { requireRole } = require("../middlewares/rbac");

const router = express.Router();

// =====================================================
// ALLOWED AUDIT ACTIONS
// =====================================================

const ALLOWED_AUDIT_ACTIONS = [
  "AUTH_LOGIN_SUCCESS",
  "AUTH_LOGIN_FAIL",
  "GRADE_CREATE",
  "GRADE_UPDATE_UP",
  "GRADE_UPDATE_DOWN",
];

// =====================================================
// SESSION HARDENING
// =====================================================

router.use((req, res, next) => {
  const role = req.session?.user?.role;

  if (role !== undefined && typeof role !== "string") {
    return res.status(401).json({
      ok: false,
      message: "Unauthorized",
    });
  }

  next();
});

// =====================================================
// ADMIN ONLY
// =====================================================

router.use(requireRole("Admin"));

// =====================================================
// GET AUDIT LOGS
//
// Supports:
//
// GET /api/admin/audit-logs
//
// Query parameters:
//
// ?page=1
// ?limit=25
// ?q=login
// ?action=AUTH_LOGIN_SUCCESS
// ?outcome=SUCCESS
// ?date=2026-10-21
// =====================================================

router.get("/audit-logs", async (req, res, next) => {
  try {
    // =================================================
    // PAGINATION
    // =================================================

    const page = Math.max(1, parseInt(req.query.page || "1", 10));

    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit || "25", 10)),
    );

    // =================================================
    // FILTER VALUES
    // =================================================

    const q = String(req.query.q || "").trim();

    const action = String(req.query.action || "").trim();

    const outcome = String(req.query.outcome || "").trim();

    const date = String(req.query.date || "").trim();

    // =================================================
    // MONGODB FILTER
    // =================================================

    const filter = {};

    // =================================================
    // ACTION FILTER
    // =================================================

    if (action) {
      if (!ALLOWED_AUDIT_ACTIONS.includes(action)) {
        return res.status(400).json({
          ok: false,
          message: "Invalid audit action.",
        });
      }

      filter.action = action;
    }

    // =================================================
    // OUTCOME FILTER
    // =================================================

    if (outcome) {
      filter.outcome = outcome;
    }

    // =================================================
    // SEARCH FILTER
    // =================================================

    if (q) {
      filter.$or = [
        // Username

        {
          actor_username: {
            $regex: q,
            $options: "i",
          },
        },

        // Role

        {
          actor_role: {
            $regex: q,
            $options: "i",
          },
        },

        // Action

        {
          action: {
            $regex: q,
            $options: "i",
          },
        },

        // Message

        {
          message: {
            $regex: q,
            $options: "i",
          },
        },

        // IP address

        {
          ip: {
            $regex: q,
            $options: "i",
          },
        },

        // Request path

        {
          path: {
            $regex: q,
            $options: "i",
          },
        },
      ];
    }

    // =================================================
    // DATE FILTER
    // =================================================
    //
    // date:
    // entire selected calendar day in Philippine time
    //
    // Example:
    //
    // ?date=2026-10-21
    //
    // =================================================

    if (date) {
      // -----------------------------------------------
      // VALIDATE DATE FORMAT
      // -----------------------------------------------

      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({
          ok: false,
          message: "Invalid date format. Use YYYY-MM-DD.",
        });
      }

      // -----------------------------------------------
      // START OF SELECTED DAY
      //
      // Philippine time (UTC+8)
      // -----------------------------------------------

      const start = new Date(
        `${date}T00:00:00+08:00`
      );

      // -----------------------------------------------
      // START OF NEXT DAY
      //
      // Use an exclusive upper boundary so timestamps
      // with milliseconds are handled correctly.
      // -----------------------------------------------

      const nextDay = new Date(
        start.getTime() + 24 * 60 * 60 * 1000
      );

      // -----------------------------------------------
      // VALIDATE DATE
      // -----------------------------------------------

      if (
        Number.isNaN(start.getTime()) ||
        Number.isNaN(nextDay.getTime())
      ) {
        return res.status(400).json({
          ok: false,
          message: "Invalid date.",
        });
      }

      // -----------------------------------------------
      // APPLY DATE FILTER
      // -----------------------------------------------

      filter.createdAt = {
        $gte: start,
        $lt: nextDay,
      };
    }

    // =================================================
    // DATABASE QUERY
    // =================================================

    const [total, rows] = await Promise.all([
      // ---------------------------------------------
      // TOTAL MATCHING LOGS
      // ---------------------------------------------

      AuditLog.countDocuments(filter),

      // ---------------------------------------------
      // LOG RESULTS
      // ---------------------------------------------

      AuditLog.find(filter)

        .sort({
          createdAt: -1,
        })

        .skip((page - 1) * limit)

        .limit(limit)

        .lean(),
    ]);

    // =================================================
    // RESPONSE
    // =================================================

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

// =====================================================
// EXPORT
// =====================================================

module.exports = router;