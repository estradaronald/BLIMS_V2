const mongoose = require("mongoose");

const GradeLevelSchema = new mongoose.Schema(
  {
    grade: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    subjects: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("GradeLevel", GradeLevelSchema);