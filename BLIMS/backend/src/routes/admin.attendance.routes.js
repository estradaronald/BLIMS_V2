const express = require("express");

const router = express.Router();

const ctrl = require("../controllers/admin.attendance.controller");

/* =========================================================
   ADMIN ATTENDANCE
========================================================= */

// Get attendance records
router.get("/attendance", ctrl.getAttendance);

// Get one attendance sheet
router.get("/attendance/:id", ctrl.getAttendanceById);

module.exports = router;