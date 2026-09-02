const mongoose = require("mongoose");

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

    gradingPeriod: {
      type: String,
      enum: ["1st", "2nd", "3rd", "4th"],
      required: true,
    },

    writtenWorks: {
      type: [
        {
          activity: {
            type: String,
            required: true,
            trim: true,
          },
          score: {
            type: Number,
            required: true,
            min: 0,
          },
          total: {
            type: Number,
            required: true,
            min: 1,
          },
        },
      ],
      default: [],
    },

    performanceTasks: {
      type: [
        {
          activity: {
            type: String,
            required: true,
            trim: true,
          },
          score: {
            type: Number,
            required: true,
            min: 0,
          },
          total: {
            type: Number,
            required: true,
            min: 1,
          },
        },
      ],
      default: [],
    },

    quarterlyAssessment: {
      score: {
        type: Number,
        min: 0,
        default: null,
      },
      total: {
        type: Number,
        min: 1,
        default: null,
      },
    },

    initialGrade: {
      type: Number,
      min: 0,
      max: 100,
      default: null,
    },

    quarterlyGrade: {
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

gradeSchema.index(
  {
    studentId: 1,
    subject: 1,
    gradingPeriod: 1,
    schoolYearId: 1,
  },
  {
    unique: true,
  }
);

module.exports = mongoose.model("Grade", gradeSchema);