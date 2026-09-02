const express = require("express");
const router = express.Router();

const teacherStudentsController = require("../controllers/teacherStudents.controller");

// Get logged-in teacher assigned class/section
router.get("/scope", teacherStudentsController.getTeacherScope);

// Get students enrolled in teacher's class/section
router.get("/class", teacherStudentsController.getStudentsByClass);

// Get only unassigned students
router.get("/unassigned", teacherStudentsController.getUnassignedStudents);

// Enroll selected students
router.post("/enroll", teacherStudentsController.enrollStudents);

// Unenroll one student
router.patch("/unenroll/:id", teacherStudentsController.unenrollStudent);

module.exports = router;