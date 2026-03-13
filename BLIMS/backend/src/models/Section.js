const mongoose = require("mongoose");

const SectionSchema = new mongoose.Schema(
  {
    grade: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    section: {
      type: String,
      required: true,
      trim: true,
    },

    adviser: {
      type: String,
      default: "",
      trim: true,
    },

    capacity: {
      type: Number,
      required: true,
      min: 1,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Section", SectionSchema);