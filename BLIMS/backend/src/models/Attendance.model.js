const mongoose = require("mongoose");


/* =========================================================
   ATTENDANCE RECORD
========================================================= */

const attendanceRecordSchema =
  new mongoose.Schema(
    {
      studentId: {
        type: String,
        required: true,
        trim: true,
      },

      status: {
        type: String,

        enum: [
          "present",
          "absent",
          "late",
          "excused",
        ],

        default: "excused",
      },
    },

    {
      _id: false,
    }
  );


/* =========================================================
   ATTENDANCE SCHEMA
========================================================= */

const attendanceSchema =
  new mongoose.Schema(
    {

      /* -----------------------------------------------------
         ATTENDANCE DATE

         Stored as YYYY-MM-DD.

         Example:
         2026-08-28
      ----------------------------------------------------- */

      date: {
        type: String,

        required: true,

        trim: true,

        match: [
          /^\d{4}-\d{2}-\d{2}$/,

          "Date must use YYYY-MM-DD format.",
        ],
      },


      /* -----------------------------------------------------
         CLASS
      ----------------------------------------------------- */

      className: {
        type: String,

        required: true,

        trim: true,
      },


      /* -----------------------------------------------------
         SECTION
      ----------------------------------------------------- */

      sectionName: {
        type: String,

        required: true,

        trim: true,
      },


      /* -----------------------------------------------------
         TEACHER

         Attendance must belong to the teacher
         who recorded it.
      ----------------------------------------------------- */

      teacherId: {
        type: mongoose.Schema.Types.ObjectId,

        ref: "Teacher",

        required: true,
      },


      /* -----------------------------------------------------
         SCHOOL YEAR

         This is the actual SchoolYear document
         that this attendance belongs to.
      ----------------------------------------------------- */

      schoolYearId: {
        type: mongoose.Schema.Types.ObjectId,

        ref: "SchoolYear",

        required: true,
      },


      /* -----------------------------------------------------
         SCHOOL YEAR NAME SNAPSHOT

         Keep the name so historical attendance can
         still display the school year easily.

         Example:
         "2026-2027"
      ----------------------------------------------------- */

      schoolYearName: {
        type: String,

        required: true,

        trim: true,
      },


      /* -----------------------------------------------------
         STUDENT ATTENDANCE RECORDS
      ----------------------------------------------------- */

      records: {
        type: [
          attendanceRecordSchema,
        ],

        default: [],
      },

    },

    {
      timestamps: true,
    }
  );


/* =========================================================
   INDEX
========================================================= */

/*
 * One attendance sheet per:
 *
 * School Year
 * + Date
 * + Class
 * + Section
 *
 * This prevents duplicate attendance sheets
 * for the same class on the same day.
 */

attendanceSchema.index(
  {
    schoolYearId: 1,
    date: 1,
    className: 1,
    sectionName: 1,
  },

  {
    unique: true,
  }
);


/* =========================================================
   MODEL
========================================================= */

module.exports =
  mongoose.model(
    "Attendance",
    attendanceSchema
  );