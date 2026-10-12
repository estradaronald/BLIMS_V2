const mongoose = require("mongoose");

const EnrollmentSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },

    schoolYearId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SchoolYear",
      required: true,
      index: true,
    },

    // Preserve the school year label for historical reporting.
    schoolYearName: {
      type: String,
      required: true,
      trim: true,
    },

    // Preserve the student's grade and section for this year.
    className: {
      type: String,
      required: true,
      trim: true,
      default: "Unassigned",
    },

    sectionName: {
      type: String,
      required: true,
      trim: true,
      default: "Unassigned",
    },

    enrolledAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// One enrollment record per student per school year.
EnrollmentSchema.index(
  {
    studentId: 1,
    schoolYearId: 1,
  },
  {
    unique: true,
  },
);

module.exports = mongoose.model("Enrollment", EnrollmentSchema);
