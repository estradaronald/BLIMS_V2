const mongoose = require("mongoose");

const assignmentSchema = new mongoose.Schema(
  {
    teacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
      index: true,
    },

    subject: {
      type: String,
      required: true,
      trim: true,
    },

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

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    quarter: {
      type: String,
      enum: ["Q1", "Q2", "Q3", "Q4"],
      required: true,
    },

    totalPoints: {
      type: Number,
      required: true,
      min: 1,
      max: 1000,
    },

    dueDate: {
      type: String,
      required: true,
      trim: true,
    },

    dueTime: {
      type: String,
      default: "",
      trim: true,
    },

    instructions: {
      type: String,
      default: "",
      trim: true,
      maxlength: 5000,
    },

    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

assignmentSchema.index({
  teacherId: 1,
  subject: 1,
  schoolYearId: 1,
  quarter: 1,
});

module.exports = mongoose.model("Assignment", assignmentSchema);