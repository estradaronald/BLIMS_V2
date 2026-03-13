const mongoose = require("mongoose");

const StudentSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    studentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    }, // STD-0001

    firstName: { type: String, required: true, trim: true },
    middleName: { type: String, default: "", trim: true },
    lastName: { type: String, required: true, trim: true },

    gender: {
      type: String,
      enum: ["male", "female"],
      default: "male",
    },

    dob: { type: String, default: "" }, // YYYY-MM-DD
    lrn: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    className: { type: String, required: true, trim: true },
    sectionName: { type: String, required: true, trim: true },

    phone: { type: String, default: "" }, // +63XXXXXXXXXX
    email: { type: String, default: "", lowercase: true, trim: true },

    address: {
      street: { type: String, default: "" },
      provinceCode: { type: String, default: "" },
      cityCode: { type: String, default: "" },
      brgyCode: { type: String, default: "" },
      postal: { type: String, default: "" },
    },

    parents: {
      fatherName: { type: String, default: "" },
      fatherOccupation: { type: String, default: "" },
      fatherContact: { type: String, default: "" },

      motherName: { type: String, default: "" },
      motherOccupation: { type: String, default: "" },
      motherContact: { type: String, default: "" },
    },

    photoDataUrl: { type: String, default: "" },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Student", StudentSchema);