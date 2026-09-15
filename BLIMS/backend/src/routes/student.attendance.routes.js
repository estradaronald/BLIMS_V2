const express = require("express");

const router = express.Router();

const ctrl = require("../controllers/student.attendance.controller");

// ==========================================
// STUDENT ATTENDANCE
// ==========================================

// GET /api/student/attendance

router.get(
  "/attendance",
  ctrl.getMyAttendance
);

module.exports = router;