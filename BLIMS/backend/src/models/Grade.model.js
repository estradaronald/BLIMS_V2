const mongoose = require("mongoose");


/* =========================================================
   ASSESSMENT SUBDOCUMENT
========================================================= */

const AssessmentSchema = new mongoose.Schema(
  {
    assessmentId: {
      type: String,
      required: true,
      trim: true,
    },

    activity: {
      type: String,
      required: true,
      trim: true,
    },

    score: {
      type: Number,
      min: 0,
      default: null,
    },

    total: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  {
    _id: true,
  }
);


/* =========================================================
   TERM ASSESSMENT
   Only one exam is allowed per term/subject.
========================================================= */

const TermAssessmentSchema = new mongoose.Schema(
  {
    assessmentId: {
      type: String,
      required: true,
      trim: true,
    },

    activity: {
      type: String,
      required: true,
      trim: true,
    },

    score: {
      type: Number,
      min: 0,
      default: null,
    },

    total: {
      type: Number,
      required: true,
      min: 1,
    },
  },
  {
    _id: true,
  }
);


/* =========================================================
   GRADE SCHEMA
========================================================= */

const gradeSchema = new mongoose.Schema(
  {
    studentId: {
      type: String,
      required: true,
      trim: true,
    },

    gradeLevel: {
      type: String,
      required: true,
      trim: true,
    },

    sectionName: {
      type: String,
      required: true,
      trim: true,
    },

    subject: {
      type: String,
      required: true,
      trim: true,
    },

    schoolYearId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SchoolYear",
      required: true,
    },

    schoolYearName: {
      type: String,
      required: true,
      trim: true,
    },

    termId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    writtenWorks: {
      type: [AssessmentSchema],
      default: [],
    },

    performanceTasks: {
      type: [AssessmentSchema],
      default: [],
    },

    termAssessment: {
      type: TermAssessmentSchema,
      default: null,
    },

    initialGrade: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    termGrade: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      default: null,
    },
  },

  {
    timestamps: true,
  }
);


/* =========================================================
   UNIQUE GRADE RECORD
========================================================= */

gradeSchema.index(
  {
    studentId: 1,
    subject: 1,
    termId: 1,
    schoolYearId: 1,
  },
  {
    unique: true,
  }
);


module.exports = mongoose.model(
  "Grade",
  gradeSchema
);