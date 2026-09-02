// backend/src/routes/teacher.schedule.routes.js

const express = require("express");
const router = express.Router();

const ctrl = require("../controllers/teacher.schedule.controller");
const { requireRole } = require("../middlewares/rbac");

// ==========================================
// TEACHER - MY SCHEDULE
// GET /api/teacher/my-schedule
// ==========================================

router.get(
  "/my-schedule",
  requireRole("teacher"),
  ctrl.getMySchedule
);

module.exports = router;