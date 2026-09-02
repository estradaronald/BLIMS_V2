const express = require("express");

const router = express.Router();

const studentAssignmentController = require(
  "../controllers/studentAssignment.controller"
);

/* ---------------------------------------
   STUDENT ASSIGNMENTS
--------------------------------------- */

// GET /api/student/assignments
router.get(
  "/",
  studentAssignmentController.getAssignments
);

// GET /api/student/assignments/:id
router.get(
  "/:id",
  studentAssignmentController.getAssignmentById
);

// PATCH /api/student/assignments/:id/progress
router.patch(
  "/:id/progress",
  studentAssignmentController.updateAssignmentProgress
);

module.exports = router;