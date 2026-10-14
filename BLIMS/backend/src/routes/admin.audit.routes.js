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
// ?startDate=2026-10-01
// ?endDate=2026-10-02
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

    const startDate = String(req.query.startDate || "").trim();

    const endDate = String(req.query.endDate || "").trim();

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
    // startDate:
    // beginning of selected day
    //
    // endDate:
    // end of selected day
    //
    // =================================================

    if (startDate || endDate) {
      filter.createdAt = {};

      // -----------------------------------------------
      // START DATE
      // -----------------------------------------------

      if (startDate) {
        const start = new Date(`${startDate}T00:00:00.000Z`);

        if (!Number.isNaN(start.getTime())) {
          filter.createdAt.$gte = start;
        }
      }

      // -----------------------------------------------
      // END DATE
      // -----------------------------------------------

      if (endDate) {
        const end = new Date(`${endDate}T23:59:59.999Z`);

        if (!Number.isNaN(end.getTime())) {
          filter.createdAt.$lte = end;
        }
      }

      // -----------------------------------------------
      // REMOVE EMPTY DATE FILTER
      // -----------------------------------------------

      if (Object.keys(filter.createdAt).length === 0) {
        delete filter.createdAt;
      }
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
