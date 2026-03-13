// backend/src/models/User.model.js
const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    username: { 
      type: String, 
      required: true, 
      unique: true, 
      trim: true 
    },

    role: { 
      type: String, 
      required: true, 
      enum: ["admin", "teacher", "student"] 
    },

    // 🔐 Authentication
    password_hash: { 
      type: String, 
      required: true 
    },

    must_change_password: { 
      type: Boolean, 
      default: false 
    },

    password_changed_at: { 
      type: Date, 
      default: null 
    },

    status: { 
      type: String, 
      default: "active", 
      enum: ["active", "disabled"] 
    },

    // =========================
    // ✅ NEW — Email (for MFA)
    // =========================
    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true // allows existing users without email
    },

    // =========================
    // ✅ NEW — MFA Fields
    // =========================
    mfa_enabled: {
      type: Boolean,
      default: false
    },

    mfa_otp_hash: {
      type: String,
      default: null
    },

    mfa_otp_expires_at: {
      type: Date,
      default: null
    }
  },
  { 
    timestamps: { 
      createdAt: "created_at", 
      updatedAt: "updated_at" 
    } 
  }
);

module.exports = mongoose.model("User", UserSchema);