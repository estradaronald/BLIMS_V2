const express = require("express");

const router = express.Router();

const ctrl = require("../controllers/student.subjects.controller");

// ==========================================
// STUDENT SUBJECTS
// ==========================================

// GET /api/student/subjects
router.get(
  "/subjects",
  ctrl.getSubjects
);

module.exports = router;