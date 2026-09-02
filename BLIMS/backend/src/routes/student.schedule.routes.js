const express = require("express");

const router = express.Router();

const ctrl = require("../controllers/student.schedule.controller");

// ==========================================
// STUDENT MY SCHEDULE
// ==========================================

// GET /api/student/my-schedule
router.get(
  "/my-schedule",
  ctrl.getMySchedule
);

module.exports = router;