const mongoose = require("mongoose");


/* =========================================================
   TERM SCHEMA
========================================================= */

const TermSchema = new mongoose.Schema(
  {
    order: {
      type: Number,
      required: true,
      min: 1,
      max: 4,
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


/* =========================================================
   SCHOOL YEAR SCHEMA
========================================================= */

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

    terms: {
      type: [TermSchema],

      default: [],

      validate: {
        validator: function (terms) {
          return (
            Array.isArray(terms) &&
            terms.length >= 1 &&
            terms.length <= 4
          );
        },

        message:
          "A school year must have between 1 and 4 terms.",
      },
    },
  },

  {
    timestamps: true,
    versionKey: false,
  }
);


module.exports = mongoose.model(
  "SchoolYear",
  SchoolYearSchema
);