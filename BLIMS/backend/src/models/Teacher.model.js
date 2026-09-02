// backend/src/models/Teacher.model.js
const mongoose = require("mongoose");

const TeacherSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    teacherId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    firstName: {
      type: String,
      required: true,
      trim: true,
    },

    middleName: {
      type: String,
      default: "",
      trim: true,
    },

    lastName: {
      type: String,
      required: true,
      trim: true,
    },

    gender: {
      type: String,
      enum: ["male", "female"],
      default: "male",
      required: true,
    },

    dob: {
      type: String,
      required: true,
      trim: true,
    },

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

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    position: {
      type: String,
      default: "Teacher",
      trim: true,
    },

    address: {
      regionCode: {
        type: String,
        default: "",
        trim: true,
      },
      street: {
        type: String,
        default: "",
        trim: true,
      },
      provinceCode: {
        type: String,
        default: "",
        trim: true,
      },
      cityCode: {
        type: String,
        default: "",
        trim: true,
      },
      brgyCode: {
        type: String,
        default: "",
        trim: true,
      },
      postal: {
        type: String,
        default: "",
        trim: true,
      },
    },

    credentials: {
      hasPrc: {
        type: Boolean,
        default: false,
      },
      prcLicense: {
        type: String,
        default: "N/A",
        trim: true,
      },
      majorSpec: {
        type: String,
        default: "",
        trim: true,
      },
      highestEduc: {
        type: String,
        default: "",
        trim: true,
      },
      dateHired: {
        type: String,
        default: "",
        trim: true,
      },
    },

    photoDataUrl: {
      type: String,
      default: "",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Teacher", TeacherSchema);