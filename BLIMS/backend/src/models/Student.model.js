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
      trim: true,
    }, // STD-0001

    firstName: { type: String, required: true, trim: true },
    middleName: { type: String, default: "", trim: true },
    lastName: { type: String, required: true, trim: true },

    gender: {
      type: String,
      enum: ["male", "female"],
      default: "male",
    },

    dob: { type: String, default: "", trim: true },

    lrn: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },

    // optional during account creation, assign later
    className: {
      type: String,
      required: true,
      default: "Unassigned",
      trim: true,
    },

    sectionName: {
      type: String,
      required: true,
      default: "Unassigned",
      trim: true,
    },

    phone: { type: String, default: "", trim: true },
    email: { type: String, default: "", lowercase: true, trim: true },

    address: {
      street: { type: String, default: "", trim: true },
      provinceCode: { type: String, default: "", trim: true },
      cityCode: { type: String, default: "", trim: true },
      brgyCode: { type: String, default: "", trim: true },
      postal: { type: String, default: "", trim: true },
    },

    parents: {
      fatherName: { type: String, default: "", trim: true },
      fatherOccupation: { type: String, default: "", trim: true },
      fatherContact: { type: String, default: "", trim: true },

      motherName: { type: String, default: "", trim: true },
      motherOccupation: { type: String, default: "", trim: true },
      motherContact: { type: String, default: "", trim: true },
    },

    photoDataUrl: { type: String, default: "" },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Student", StudentSchema);