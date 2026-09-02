const express = require("express");
const router = express.Router();

const teacherGradeController = require("../controllers/teacherGrade.controller");

// Get teacher's class, school year, students, and subjects
router.get(
  "/encoding",
  teacherGradeController.getGradeEncodingData
);

// Get grades already saved in MongoDB
router.get(
  "/grades",
  teacherGradeController.getSavedGrades
);

// Save / update a student's grade
router.post(
  "/save",
  teacherGradeController.saveGrade
);

module.exports = router;