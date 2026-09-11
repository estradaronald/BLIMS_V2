// backend/src/routes/auth.routes.js

const express = require("express");
const argon2 = require("argon2");
const User = require("../models/User.model");
const { writeAudit } = require("../utils/audit");
const { loginLimiter } = require("../middlewares/rateLimiters");

const router = express.Router();


// =======================================================
// Helpers
// =======================================================

function requireAuth(req, res, next) {

  if (!req.session?.user?.id) {

    return res.status(401).json({
      ok: false,
      message: "Unauthorized"
    });

  }

  next();

}


function checkStrongPassword(pw) {

  if (typeof pw !== "string") {

    return {
      ok: false,
      message: "Password is required."
    };

  }

  if (pw.length < 12) {

    return {
      ok: false,
      message: "Password must be at least 12 characters."
    };

  }

  if (!/[A-Z]/.test(pw)) {

    return {
      ok: false,
      message:
        "Password must include at least 1 uppercase letter."
    };

  }

  if (!/[a-z]/.test(pw)) {

    return {
      ok: false,
      message:
        "Password must include at least 1 lowercase letter."
    };

  }

  if (!/[0-9]/.test(pw)) {

    return {
      ok: false,
      message:
        "Password must include at least 1 number."
    };

  }

  if (!/[^A-Za-z0-9]/.test(pw)) {

    return {
      ok: false,
      message:
        "Password must include at least 1 symbol."
    };

  }

  return {
    ok: true
  };

}


// =======================================================
// NoSQL injection-safe guards
// =======================================================

function isPlainObject(v) {

  return (
    v !== null &&
    typeof v === "object" &&
    !Array.isArray(v)
  );

}


function requireSafeString(
  value,
  fieldName,
  opts = {}
) {

  const {
    trim = true,
    min = 1,
    max = 255,
    allowEmpty = false,
    pattern = null
  } = opts;


  if (
    value === undefined ||
    value === null
  ) {

    return {
      ok: false,
      message: "Invalid request."
    };

  }


  if (typeof value !== "string") {

    return {
      ok: false,
      message: "Invalid request."
    };

  }


  let s = value;

  if (trim) {
    s = s.trim();
  }


  if (
    !allowEmpty &&
    s.length < min
  ) {

    return {
      ok: false,
      message: "Invalid request."
    };

  }


  if (s.length > max) {

    return {
      ok: false,
      message: "Invalid request."
    };

  }


  if (
    pattern &&
    !pattern.test(s)
  ) {

    return {
      ok: false,
      message: "Invalid request."
    };

  }


  return {
    ok: true,
    value: s
  };

}


function requireSafeStringFromBody(
  req,
  fieldName,
  opts
) {

  const value =
    req.body?.[fieldName];


  if (
    isPlainObject(value) ||
    Array.isArray(value)
  ) {

    return {
      ok: false,
      message: "Invalid request."
    };

  }


  return requireSafeString(
    value,
    fieldName,
    opts
  );

}


function badRequest(
  res,
  message = "Invalid request."
) {

  return res.status(400).json({
    ok: false,
    message
  });

}


// =======================================================
// POST /api/auth/login
// =======================================================
//
// ADMIN:
// Username + Password
//        ↓
// Secondary 6-digit PIN
//        ↓
// Admin Dashboard
//
// TEACHER/STUDENT:
// Username + Password
//        ↓
// Normal login
//
// =======================================================

router.post(
  "/login",
  loginLimiter,
  async (req, res) => {

    try {

      // ===================================================
      // Validate username
      // ===================================================

      const u =
        requireSafeStringFromBody(
          req,
          "username",
          {
            min: 1,
            max: 64,
            trim: true
          }
        );


      // ===================================================
      // Validate password
      // ===================================================

      const p =
        requireSafeStringFromBody(
          req,
          "password",
          {
            min: 1,
            max: 256,
            trim: false
          }
        );


      // ===================================================
      // Generic invalid response
      // ===================================================

      const invalid =
        async (usernameForAudit = "") => {

          await writeAudit(req, {

            action:
              "AUTH_LOGIN_FAIL",

            outcome:
              "FAIL",

            message:
              "Invalid credentials",

            meta: {
              username:
                usernameForAudit
            }

          });


          return res.status(401).json({

            ok: false,

            message:
              "Invalid username or password"

          });

        };


      // ===================================================
      // Validate request
      // ===================================================

      if (!u.ok || !p.ok) {

        const auditName =
          u.ok
            ? u.value
            : "";

        return invalid(auditName);

      }


      const username =
        u.value;

      const password =
        p.value;


      // ===================================================
      // Find user
      // ===================================================

      const user =
        await User.findOne({
          username
        });


      if (!user) {

        return invalid(username);

      }


      if (
        user.status !== "active"
      ) {

        return invalid(username);

      }


      // ===================================================
      // Verify main password
      // ===================================================

      const valid =
        await argon2.verify(
          user.password_hash,
          password
        );


      if (!valid) {

        return invalid(username);

      }


      // ===================================================
      // ADMIN -> SECONDARY PIN REQUIRED
      // ===================================================

      if (user.role === "admin") {

        // Make sure the admin has a secondary PIN.
        if (!user.secondary_password_hash) {

          await writeAudit(req, {

            action:
              "AUTH_SECONDARY_PIN_BLOCKED",

            outcome:
              "FAIL",

            message:
              "Admin secondary PIN missing",

            meta: {
              username,
              role: "admin"
            }

          });


          return res.status(400).json({

            ok: false,

            message:
              "Admin secondary PIN is not configured."

          });

        }


        // =================================================
        // Store pending admin authentication
        // =================================================

        req.session.secondaryAuth = {

          pending: true,

          userId:
            String(user._id),

          role:
            "admin",

          username:
            user.username,

          must_change_password:
            !!user.must_change_password,

          createdAt:
            new Date().toISOString()

        };


        // =================================================
        // Audit
        // =================================================

        await writeAudit(req, {

          action:
            "AUTH_PASSWORD_SUCCESS_SECONDARY_REQUIRED",

          outcome:
            "SUCCESS",

          message:
            "Admin password verified; secondary PIN required",

          meta: {
            username,
            role: "admin"
          }

        });


        // =================================================
        // DO NOT create req.session.user yet
        // =================================================

        return res.json({

          ok: true,

          secondaryRequired: true,

          userId:
            String(user._id),

          role: "admin",

          mustChangePassword:
            !!user.must_change_password

        });

      }


      // ===================================================
      // NON-ADMIN -> NORMAL LOGIN
      // ===================================================

      req.session.user = {

        id:
          String(user._id),

        role:
          user.role,

        username:
          user.username,

        must_change_password:
          !!user.must_change_password

      };


      await writeAudit(req, {

        action:
          "AUTH_LOGIN_SUCCESS",

        outcome:
          "SUCCESS",

        message:
          "User logged in",

        meta: {
          role:
            user.role
        }

      });


      return res.json({

        ok: true,

        secondaryRequired: false,

        role:
          user.role,

        mustChangePassword:
          !!user.must_change_password

      });

    } catch (err) {

      console.error(
        "Login error:",
        err
      );


      try {

        const username =
          typeof req.body?.username === "string"
            ? req.body.username.trim()
            : "";


        await writeAudit(req, {

          action:
            "AUTH_LOGIN_ERROR",

          outcome:
            "FAIL",

          message:
            "Login server error",

          meta: {
            username
          }

        });

      } catch {}


      return res.status(500).json({

        ok: false,

        message:
          "Something went wrong"

      });

    }

  }
);


// =======================================================
// POST /api/auth/secondary/verify
// =======================================================
//
// Used only for admin login.
//
// Main password must already be verified.
// Then the 6-digit secondary PIN is verified.
//
// =======================================================

router.post(
  "/secondary/verify",
  async (req, res) => {

    try {

      const pending =
        req.session?.secondaryAuth;


      // =================================================
      // Verify pending authentication
      // =================================================

      if (
        !pending?.pending ||
        pending.role !== "admin"
      ) {

        return badRequest(
          res,
          "No pending secondary authentication."
        );

      }


      // =================================================
      // Read PIN
      // =================================================

      const rawPin =
        req.body?.pin ??
        req.body?.secondaryPin;


      // =================================================
      // Reject objects / arrays
      // =================================================

      if (
        isPlainObject(rawPin) ||
        Array.isArray(rawPin)
      ) {

        await writeAudit(req, {

          action:
            "AUTH_SECONDARY_VERIFY_FAIL",

          outcome:
            "FAIL",

          message:
            "Secondary PIN invalid type",

          meta: {
            role: "admin"
          }

        });


        return badRequest(
          res,
          "Invalid secondary PIN."
        );

      }


      // =================================================
      // Validate PIN format
      // =================================================

      const pin =
        requireSafeString(
          String(rawPin ?? ""),
          "secondaryPin",
          {
            min: 6,
            max: 6,
            trim: true,
            pattern: /^[0-9]{6}$/
          }
        );


      if (!pin.ok) {

        await writeAudit(req, {

          action:
            "AUTH_SECONDARY_VERIFY_FAIL",

          outcome:
            "FAIL",

          message:
            "Secondary PIN missing/invalid format",

          meta: {
            role: "admin"
          }

        });


        return badRequest(
          res,
          "Invalid secondary PIN."
        );

      }


      // =================================================
      // Get user from database
      // =================================================

      const user =
        await User.findById(
          pending.userId
        );


      if (!user) {

        delete req.session.secondaryAuth;


        return res.status(401).json({

          ok: false,

          message:
            "Unauthorized"

        });

      }


      // =================================================
      // Check account status
      // =================================================

      if (
        user.status !== "active"
      ) {

        delete req.session.secondaryAuth;


        return res.status(403).json({

          ok: false,

          message:
            "Account disabled"

        });

      }


      // =================================================
      // Make sure this is still an admin
      // =================================================

      if (
        user.role !== "admin"
      ) {

        delete req.session.secondaryAuth;


        return res.status(403).json({

          ok: false,

          message:
            "Admin access required."

        });

      }


      // =================================================
      // Make sure secondary PIN exists
      // =================================================

      if (
        !user.secondary_password_hash
      ) {

        delete req.session.secondaryAuth;


        await writeAudit(req, {

          action:
            "AUTH_SECONDARY_VERIFY_FAIL",

          outcome:
            "FAIL",

          message:
            "Secondary PIN not configured",

          meta: {
            role: "admin"
          }

        });


        return res.status(400).json({

          ok: false,

          message:
            "Secondary PIN is not configured."

        });

      }


      // =================================================
      // Verify secondary PIN with Argon2
      // =================================================

      const validPin =
        await argon2.verify(
          user.secondary_password_hash,
          pin.value
        );


      if (!validPin) {

        await writeAudit(req, {

          action:
            "AUTH_SECONDARY_VERIFY_FAIL",

          outcome:
            "FAIL",

          message:
            "Invalid secondary PIN",

          meta: {
            role: "admin",
            username:
              user.username
          }

        });


        return res.status(401).json({

          ok: false,

          message:
            "Invalid secondary PIN."

        });

      }


      // =================================================
      // SECONDARY PIN VALID
      // Finalize login
      // =================================================

      req.session.user = {

        id:
          String(user._id),

        role:
          "admin",

        username:
          user.username,

        must_change_password:
          !!user.must_change_password

      };


      // Remove pending authentication
      delete req.session.secondaryAuth;


      // =================================================
      // Audit success
      // =================================================

      await writeAudit(req, {

        action:
          "AUTH_SECONDARY_VERIFY_SUCCESS",

        outcome:
          "SUCCESS",

        message:
          "Admin secondary PIN verified",

        meta: {
          role: "admin",
          username:
            user.username
        }

      });


      // =================================================
      // Response
      // =================================================

      return res.json({

        ok: true,

        role: "admin",

        mustChangePassword:
          !!user.must_change_password

      });

    } catch (err) {

      console.error(
        "Secondary PIN verification error:",
        err
      );


      return res.status(500).json({

        ok: false,

        message:
          "Something went wrong"

      });

    }

  }
);


// =======================================================
// POST /api/auth/logout
// =======================================================

router.post(
  "/logout",
  async (req, res) => {

    try {

      await writeAudit(req, {

        action:
          "AUTH_LOGOUT",

        outcome:
          "SUCCESS",

        message:
          "User logged out"

      });

    } catch {}


    if (!req.session) {

      res.clearCookie(
        "blims.sid",
        {
          path: "/"
        }
      );

      return res.json({
        ok: true
      });

    }


    req.session.destroy(
      (err) => {

        if (err) {

          console.error(
            "Logout error:",
            err
          );

          return res.status(500).json({

            ok: false,

            message:
              "Logout failed"

          });

        }


        res.clearCookie(
          "blims.sid",
          {
            path: "/",
            httpOnly: true,
            sameSite: "lax",
            secure: false
          }
        );


        return res.json({
          ok: true
        });

      }
    );

  }
);


// =======================================================
// GET /api/auth/me
// =======================================================

router.get(
  "/me",
  (req, res) => {

    const u =
      req.session?.user;


    if (!u) {

      return res.status(401).json({

        ok: false,

        message:
          "Unauthorized"

      });

    }


    return res.json({

      ok: true,

      user: u

    });

  }
);


// =======================================================
// GET /api/auth/csrf
// =======================================================

router.get(
  "/csrf",
  (req, res) => {

    return res.json({

      ok: true,

      csrfToken:
        req.session?.csrfToken || ""

    });

  }
);


// =======================================================
// POST /api/auth/change-password
// =======================================================

router.post(
  "/change-password",
  requireAuth,
  async (req, res) => {

    try {

      const sessionUser =
        req.session.user;


      // =================================================
      // Validate passwords
      // =================================================

      const np =
        requireSafeStringFromBody(
          req,
          "newPassword",
          {
            min: 1,
            max: 256,
            trim: false
          }
        );


      const cp =
        requireSafeStringFromBody(
          req,
          "confirmPassword",
          {
            min: 1,
            max: 256,
            trim: false
          }
        );


      if (!np.ok || !cp.ok) {

        return badRequest(
          res,
          "Invalid request."
        );

      }


      const newPassword =
        np.value;

      const confirmPassword =
        cp.value;


      // =================================================
      // Confirm password
      // =================================================

      if (
        newPassword !== confirmPassword
      ) {

        return res.status(400).json({

          ok: false,

          message:
            "Passwords do not match."

        });

      }


      // =================================================
      // Strong password
      // =================================================

      const strong =
        checkStrongPassword(
          newPassword
        );


      if (!strong.ok) {

        return res.status(400).json({

          ok: false,

          message:
            strong.message

        });

      }


      // =================================================
      // Find user
      // =================================================

      const user =
        await User.findById(
          sessionUser.id
        );


      if (!user) {

        return res.status(401).json({

          ok: false,

          message:
            "Unauthorized"

        });

      }


      if (
        user.status !== "active"
      ) {

        return res.status(403).json({

          ok: false,

          message:
            "Account disabled"

        });

      }


      // =================================================
      // Update password
      // =================================================

      user.password_hash =
        await argon2.hash(
          newPassword
        );

      user.must_change_password =
        false;

      user.password_changed_at =
        new Date();


      await user.save();


      req.session.user.must_change_password =
        false;


      // =================================================
      // Audit
      // =================================================

      await writeAudit(req, {

        action:
          "AUTH_PASSWORD_CHANGED",

        outcome:
          "SUCCESS",

        message:
          "Password changed"

      });


      return res.json({

        ok: true,

        role:
          user.role

      });

    } catch (err) {

      console.error(
        "Change password error:",
        err
      );


      try {

        await writeAudit(req, {

          action:
            "AUTH_PASSWORD_CHANGE_ERROR",

          outcome:
            "FAIL",

          message:
            "Change password server error"

        });

      } catch {}


      return res.status(500).json({

        ok: false,

        message:
          "Something went wrong"

      });

    }

  }
);


module.exports = router;