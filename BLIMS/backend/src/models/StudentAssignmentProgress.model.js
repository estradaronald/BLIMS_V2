const mongoose = require("mongoose");

const StudentAssignmentProgressSchema =
  new mongoose.Schema(
    {
      studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Student",
        required: true,
        index: true,
      },

      assignmentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Assignment",
        required: true,
        index: true,
      },

      /* ---------------------------------------
         STUDENT PROGRESS STATUS
      --------------------------------------- */

      status: {
        type: String,
        enum: [
          "not_started",
          "in_progress",
          "done",
        ],
        default: "not_started",
      },

      /* ---------------------------------------
         PROGRESS TIMESTAMPS
      --------------------------------------- */

      startedAt: {
        type: Date,
        default: null,
      },

      completedAt: {
        type: Date,
        default: null,
      },
    },
    {
      timestamps: true,

      // Use existing MongoDB collection
      collection: "StudentAssignmentProgress",
    }
  );

/* ---------------------------------------
   ONE PROGRESS RECORD PER STUDENT
   PER ASSIGNMENT
--------------------------------------- */

StudentAssignmentProgressSchema.index(
  {
    studentId: 1,
    assignmentId: 1,
  },
  {
    unique: true,
  }
);

module.exports =
  mongoose.model(
    "StudentAssignmentProgress",
    StudentAssignmentProgressSchema
  );