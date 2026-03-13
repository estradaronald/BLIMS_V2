const mongoose = require("mongoose");

const QuarterSchema = new mongoose.Schema(
  {
    order: {
      type: Number,
      required: true,
      min: 1,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    start: {
      type: Date,
      default: null,
    },
    end: {
      type: Date,
      default: null,
    },
    locked: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true }
);

const SchoolYearSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    start: {
      type: Date,
      default: null,
    },
    end: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    quarters: {
      type: [QuarterSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("SchoolYear", SchoolYearSchema);