const mongoose = require("mongoose");

function norm(s) {
  return String(s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

const classScheduleSchema = new mongoose.Schema(
  {
    grade: {
      type: String,
      required: true,
      trim: true,
    },
    gradeNorm: {
      type: String,
      index: true,
    },

    section: {
      type: String,
      required: true,
      trim: true,
    },
    sectionNorm: {
      type: String,
      index: true,
    },

    subject: {
      type: String,
      required: true,
      trim: true,
    },
    subjectNorm: {
      type: String,
      index: true,
    },

    day: {
      type: String,
      required: true,
      enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    },

    start: {
      type: String,
      required: true,
      trim: true,
    },

    end: {
      type: String,
      required: true,
      trim: true,
    },

    room: {
      type: String,
      default: "",
      trim: true,
    },

    teacher: {
      type: String,
      default: "",
      trim: true,
    },

    notes: {
      type: String,
      default: "",
      trim: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

classScheduleSchema.pre("save", function (next) {
  this.gradeNorm = norm(this.grade);
  this.sectionNorm = norm(this.section);
  this.subjectNorm = norm(this.subject);
  next();
});

module.exports = mongoose.model("ClassSchedule", classScheduleSchema);