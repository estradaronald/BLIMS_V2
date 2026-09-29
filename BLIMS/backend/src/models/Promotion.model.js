const mongoose = require("mongoose");

/* =========================================================
   PROMOTION SCHEMA
========================================================= */

const PromotionSchema = new mongoose.Schema(
  {
    /* -------------------------------------------------------
       SCHOOL YEAR
    ------------------------------------------------------- */

    schoolYearId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SchoolYear",
      required: true,
      index: true,
    },

    schoolYearName: {
      type: String,
      required: true,
      trim: true,
    },

    /* -------------------------------------------------------
       FINAL TERM
    ------------------------------------------------------- */

    finalTermId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    finalTermName: {
      type: String,
      required: true,
      trim: true,
    },

    /* -------------------------------------------------------
       TEACHER
    ------------------------------------------------------- */

    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
      index: true,
    },

    /* -------------------------------------------------------
       CLASS / SECTION
    ------------------------------------------------------- */

    className: {
      type: String,
      required: true,
      trim: true,
    },

    sectionName: {
      type: String,
      required: true,
      trim: true,
    },

    /* -------------------------------------------------------
       STUDENT
    ------------------------------------------------------- */

    studentId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    /* -------------------------------------------------------
       FINAL GRADE
       Stored as a snapshot of the final-term result.
    ------------------------------------------------------- */

    finalGrade: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    /* -------------------------------------------------------
       TEACHER RECOMMENDATION
    ------------------------------------------------------- */

    recommendation: {
      type: String,
      enum: [
        "promote",
        "retain",
        "transfer",
      ],
      required: true,
    },

    /* -------------------------------------------------------
       REVIEW STATUS
    ------------------------------------------------------- */

    status: {
      type: String,
      enum: [
        "submitted",
        "approved",
        "rejected",
      ],
      default: "submitted",
      index: true,
    },

    /* -------------------------------------------------------
       SUBMISSION
    ------------------------------------------------------- */

    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
    },

    submittedAt: {
      type: Date,
      default: Date.now,
    },

    /* -------------------------------------------------------
       ADMIN REVIEW
    ------------------------------------------------------- */

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    reviewRemarks: {
      type: String,
      default: "",
      trim: true,
    },
  },

  {
    timestamps: true,
    versionKey: false,
  }
);


/* =========================================================
   UNIQUE PROMOTION RECORD
=========================================================

One recommendation per student for a particular:

School Year
+ Final Term
+ Teacher
+ Student
*/

PromotionSchema.index(
  {
    schoolYearId: 1,
    finalTermId: 1,
    teacherId: 1,
    studentId: 1,
  },
  {
    unique: true,
  }
);


module.exports = mongoose.model(
  "Promotion",
  PromotionSchema
);