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

    sectionNorm: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    adviserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      default: null,
      index: true,
    },

    adviser: {
      type: String,
      default: "",
      trim: true,
    },

    adviserNorm: {
      type: String,
      default: "",
      trim: true,
      index: true,
    },

    capacity: {
      type: Number,
      required: true,
      min: 1,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

SectionSchema.index({ grade: 1, sectionNorm: 1 }, { unique: true });

module.exports = mongoose.model("Section", SectionSchema);