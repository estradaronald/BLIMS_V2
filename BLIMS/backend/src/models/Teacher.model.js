// backend/src/models/Teacher.model.js
const mongoose = require("mongoose");

const TeacherSchema = new mongoose.Schema(
  {
    // ✅ link to User collection (login credentials live in users)
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    teacherId: { type: String, required: true, unique: true }, // TCH-0001

    firstName: { type: String, required: true },
    middleName: { type: String, default: "" },
    lastName: { type: String, required: true },

    gender: { type: String, enum: ["male", "female"], default: "male" },
    dob: { type: String, required: true }, // keep string "YYYY-MM-DD"

    className: { type: String, required: true },
    sectionName: { type: String, required: true },

    phone: { type: String, required: true }, // +63XXXXXXXXXX
    email: { type: String, required: true, lowercase: true, trim: true },

    address: {
      street: { type: String, default: "" },
      provinceCode: { type: String, default: "" },
      cityCode: { type: String, default: "" },
      brgyCode: { type: String, default: "" },
      postal: { type: String, default: "" },
    },

    credentials: {
      hasPrc: { type: Boolean, default: false },
      prcLicense: { type: String, default: "N/A" },
      majorSpec: { type: String, default: "" },
      highestEduc: { type: String, default: "" },
      dateHired: { type: String, default: "" }, // YYYY-MM-DD
    },

    photoDataUrl: { type: String, default: "" },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Teacher", TeacherSchema);