const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema(
{
  grade: {
    type: String,
    required: true,
    trim: true
  },

  name: {
    type: String,
    required: true,
    trim: true
  }

},
{ timestamps: true }
);

module.exports = mongoose.model("Subject", subjectSchema);