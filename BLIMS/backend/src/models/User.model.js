// backend/src/models/User.model.js
const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    // =========================
    // 🔑 ACCOUNT
    // =========================

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

    status: {
      type: String,
      default: "active",
      enum: ["active", "disabled"]
    },

    // =========================
    // 👤 PERSONAL INFORMATION
    // =========================

    first_name: {
      type: String,
      trim: true,
      default: null
    },

    middle_name: {
      type: String,
      trim: true,
      default: null
    },

    last_name: {
      type: String,
      trim: true,
      default: null
    },

    suffix: {
      type: String,
      trim: true,
      default: null
    },

    // =========================
    // 📞 CONTACT INFORMATION
    // =========================

    email: {
      type: String,
      trim: true,
      lowercase: true,
      sparse: true
    },

    phone_number: {
      type: String,
      trim: true,
      default: null
    },

    // =========================
    // 🔐 PRIMARY AUTHENTICATION
    // =========================

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

    // =========================
    // 🔐 SECONDARY ADMIN PASSWORD
    // =========================
    // Used by admin accounts for
    // additional security verification.
    //
    // The actual password/PIN is NEVER
    // stored here. Only its Argon2 hash
    // is stored.

    secondary_password_hash: {
      type: String,
      default: null
    },

    // =========================
    // 🔐 MFA
    // =========================
    // Kept for compatibility with
    // the current authentication system.
    // We can remove/disable the admin
    // OTP flow later.

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