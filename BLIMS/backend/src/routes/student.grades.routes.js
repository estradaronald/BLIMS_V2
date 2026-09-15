const express = require("express");

const router = express.Router();

const studentGradesController =
  require("../controllers/student.grades.controller");


/* =========================================================
   STUDENT GRADES
========================================================= */

// GET /api/student/grades

router.get(
  "/grades",
  studentGradesController.getMyGrades
);


module.exports = router;