// backend/models/Event.js
const mongoose = require("mongoose");

const EventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["school", "holiday", "exam", "meeting", "other"],
      default: "school",
    },
    audience: {
      type: String,
      enum: ["all", "teachers", "students"],
      default: "all",
    },
    start: { type: Date, required: true },
    end: { type: Date },
    location: { type: String, trim: true, default: "" },
    description: { type: String, trim: true, default: "" },
    image: {
      name: { type: String, default: "" },
      dataUrl: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Event", EventSchema);