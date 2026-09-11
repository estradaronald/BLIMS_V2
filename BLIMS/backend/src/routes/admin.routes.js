const express = require("express");
const argon2 = require("argon2");
const User = require("../models/User.model");
const { writeAudit } = require("../utils/audit");

const router = express.Router();


// =======================================================
// Helpers
// =======================================================

function requireAdmin(req, res, next) {
  const user = req.session?.user;

  if (!user?.id) {
    return res.status(401).json({
      ok: false,
      message: "Unauthorized"
    });
  }

  if (user.role !== "admin") {
    return res.status(403).json({
      ok: false,
      message: "Admin access required."
    });
  }

  next();
}


function isValidString(value, min = 1, max = 255) {
  return (
    typeof value === "string" &&
    value.trim().length >= min &&
    value.trim().length <= max
  );
}


// =======================================================
// POST /api/admin/create
// =======================================================

router.post("/create", requireAdmin, async (req, res) => {

  try {

    const {
      first_name,
      middle_name,
      last_name,
      suffix,
      email,
      phone_number,
      username,
      password,
      secondary_password
    } = req.body;


    // ===================================================
    // Required fields
    // ===================================================

    if (!isValidString(first_name)) {
      return res.status(400).json({
        ok: false,
        message: "First name is required."
      });
    }


    if (!isValidString(last_name)) {
      return res.status(400).json({
        ok: false,
        message: "Last name is required."
      });
    }


    if (!isValidString(username, 4, 64)) {
      return res.status(400).json({
        ok: false,
        message: "Username must be between 4 and 64 characters."
      });
    }


    if (typeof password !== "string") {
      return res.status(400).json({
        ok: false,
        message: "Password is required."
      });
    }


    if (typeof secondary_password !== "string") {
      return res.status(400).json({
        ok: false,
        message: "Secondary PIN is required."
      });
    }


    // ===================================================
    // Password validation
    // ===================================================

    if (password.length < 12) {
      return res.status(400).json({
        ok: false,
        message: "Password must be at least 12 characters."
      });
    }


    if (!/[A-Z]/.test(password)) {
      return res.status(400).json({
        ok: false,
        message: "Password must include at least 1 uppercase letter."
      });
    }


    if (!/[a-z]/.test(password)) {
      return res.status(400).json({
        ok: false,
        message: "Password must include at least 1 lowercase letter."
      });
    }


    if (!/[0-9]/.test(password)) {
      return res.status(400).json({
        ok: false,
        message: "Password must include at least 1 number."
      });
    }


    if (!/[^A-Za-z0-9]/.test(password)) {
      return res.status(400).json({
        ok: false,
        message: "Password must include at least 1 symbol."
      });
    }


    // ===================================================
    // Secondary PIN validation
    // ===================================================

    if (!/^\d{6}$/.test(secondary_password)) {
      return res.status(400).json({
        ok: false,
        message: "Secondary PIN must contain exactly 6 numbers."
      });
    }


    // ===================================================
    // Username uniqueness
    // ===================================================

    const existingUser = await User.findOne({
      username: username.trim()
    });

    if (existingUser) {
      return res.status(409).json({
        ok: false,
        message: "Username already exists."
      });
    }


    // ===================================================
    // Hash credentials
    // ===================================================

    const passwordHash = await argon2.hash(password);

    const secondaryPasswordHash =
      await argon2.hash(secondary_password);


    // ===================================================
    // Create admin
    // ===================================================

    const newAdmin = await User.create({

      first_name: first_name.trim(),

      middle_name:
        typeof middle_name === "string" && middle_name.trim()
          ? middle_name.trim()
          : null,

      last_name: last_name.trim(),

      suffix:
        typeof suffix === "string" && suffix.trim()
          ? suffix.trim()
          : null,

      email:
        typeof email === "string" && email.trim()
          ? email.trim().toLowerCase()
          : null,

      phone_number:
        typeof phone_number === "string" && phone_number.trim()
          ? phone_number.trim()
          : null,

      username: username.trim(),

      password_hash: passwordHash,

      secondary_password_hash: secondaryPasswordHash,

      role: "admin",

      status: "active",

      must_change_password: false,

      mfa_enabled: false

    });


    // ===================================================
    // Audit log
    // ===================================================

    await writeAudit(req, {

      action: "ADMIN_CREATED",

      outcome: "SUCCESS",

      message: "New admin account created",

      meta: {
        createdUserId: String(newAdmin._id),
        username: newAdmin.username,
        role: "admin"
      }

    });


    // ===================================================
    // Response
    // ===================================================

    return res.status(201).json({

      ok: true,

      message: "Admin account created successfully.",

      admin: {

        id: String(newAdmin._id),

        first_name: newAdmin.first_name,

        middle_name: newAdmin.middle_name,

        last_name: newAdmin.last_name,

        suffix: newAdmin.suffix,

        email: newAdmin.email,

        phone_number: newAdmin.phone_number,

        username: newAdmin.username,

        role: newAdmin.role,

        status: newAdmin.status

      }

    });


  } catch (err) {

    console.error("Create admin error:", err);


    return res.status(500).json({

      ok: false,

      message: "Something went wrong."

    });

  }

});


module.exports = router;