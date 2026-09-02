const express = require("express");
const router = express.Router();

const teacherAttendanceController = require("../controllers/teacherAttendance.controller");

// bootstrap data: teacher scope + active SY + students + session by date
router.get("/bootstrap", teacherAttendanceController.getAttendanceBootstrap);

// get saved session for one date
router.get("/session", teacherAttendanceController.getAttendanceSessionByDate);

// year-to-date summary
router.get("/summary", teacherAttendanceController.getYtdSummary);

// save/update attendance for a date
router.post("/save", teacherAttendanceController.saveAttendance);

module.exports = router;