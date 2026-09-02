const express = require("express");
const router = express.Router();

const teacherAssessmentController = require(
  "../controllers/teacher.assessment.controller"
);

// ==============================
// Test
// ==============================

router.get(
  "/test",
  teacherAssessmentController.test
);

// ==============================
// Assessment metadata
// ==============================

router.get(
  "/meta",
  teacherAssessmentController.getAssessmentMeta
);

// ==============================
// Students
// ==============================

router.get(
  "/students",
  teacherAssessmentController.getAssessmentStudents
);

// ==============================
// Assignments
// ==============================

// Get assignments
router.get(
  "/assignments",
  teacherAssessmentController.getAssignments
);

// Create assignment
router.post(
  "/assignments",
  teacherAssessmentController.createAssignment
);

// Update assignment
router.put(
  "/assignments/:id",
  teacherAssessmentController.updateAssignment
);

// Delete assignment
router.delete(
  "/assignments/:id",
  teacherAssessmentController.deleteAssignment
);

module.exports = router;