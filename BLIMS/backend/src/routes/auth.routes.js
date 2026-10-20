// backend/src/routes/auth.routes.js

const express = require("express");
const crypto = require("crypto");
const argon2 = require("argon2");

const User = require("../models/User.model");
const Teacher = require("../models/Teacher.model");
const Student = require("../models/Student.model");

const { writeAudit } = require("../utils/audit");
const { loginLimiter } = require("../middlewares/rateLimiters");
const { sendPasswordResetOtp } = require("../services/email.service");

const router = express.Router();

// =======================================================
// CAPTCHA SETTINGS
// =======================================================

const CAPTCHA_MAX_ATTEMPTS = 3;
const CAPTCHA_LOCKOUT_MS = 60 * 1000;

// =======================================================
// Helpers
// =======================================================

function requireAuth(req, res, next) {
  if (!req.session?.user?.id) {
    return res.status(401).json({
      ok: false,
      message: "Unauthorized",
    });
  }

  next();
}

function checkStrongPassword(pw) {
  if (typeof pw !== "string") {
    return {
      ok: false,
      message: "Password is required.",
    };
  }

  if (pw.length < 12) {
    return {
      ok: false,
      message: "Password must be at least 12 characters.",
    };
  }

  if (!/[A-Z]/.test(pw)) {
    return {
      ok: false,
      message: "Password must include at least 1 uppercase letter.",
    };
  }

  if (!/[a-z]/.test(pw)) {
    return {
      ok: false,
      message: "Password must include at least 1 lowercase letter.",
    };
  }

  if (!/[0-9]/.test(pw)) {
    return {
      ok: false,
      message: "Password must include at least 1 number.",
    };
  }

  if (!/[^A-Za-z0-9]/.test(pw)) {
    return {
      ok: false,
      message: "Password must include at least 1 symbol.",
    };
  }

  return {
    ok: true,
  };
}

// =======================================================
// PASSWORD RESET SETTINGS
// =======================================================

const PASSWORD_RESET_OTP_EXPIRES_MS = 10 * 60 * 1000; // 10 minutes
const PASSWORD_RESET_MAX_ATTEMPTS = 5;
const PASSWORD_RESET_RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds

function normalizeEmail(value) {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function generateResetOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

function hashResetOtp(otp) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

function safeEqualHex(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;

  const aBuf = Buffer.from(a, "hex");
  const bBuf = Buffer.from(b, "hex");

  if (aBuf.length !== bBuf.length) return false;

  return crypto.timingSafeEqual(aBuf, bBuf);
}

function clearPasswordResetSession(req) {
  delete req.session.passwordReset;
}

// =======================================================
// NoSQL injection-safe guards
// =======================================================

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function requireSafeString(value, fieldName, opts = {}) {
  const {
    trim = true,
    min = 1,
    max = 255,
    allowEmpty = false,
    pattern = null,
  } = opts;

  if (value === undefined || value === null) {
    return {
      ok: false,
      message: "Invalid request.",
    };
  }

  if (typeof value !== "string") {
    return {
      ok: false,
      message: "Invalid request.",
    };
  }

  let s = value;

  if (trim) {
    s = s.trim();
  }

  if (!allowEmpty && s.length < min) {
    return {
      ok: false,
      message: "Invalid request.",
    };
  }

  if (s.length > max) {
    return {
      ok: false,
      message: "Invalid request.",
    };
  }

  if (pattern && !pattern.test(s)) {
    return {
      ok: false,
      message: "Invalid request.",
    };
  }

  return {
    ok: true,
    value: s,
  };
}

function requireSafeStringFromBody(req, fieldName, opts) {
  const value = req.body?.[fieldName];

  if (isPlainObject(value) || Array.isArray(value)) {
    return {
      ok: false,
      message: "Invalid request.",
    };
  }

  return requireSafeString(value, fieldName, opts);
}

function badRequest(res, message = "Invalid request.") {
  return res.status(400).json({
    ok: false,
    message,
  });
}

// =======================================================
// CAPTCHA LOCKOUT HELPERS
// =======================================================

function getCaptchaState(req) {
  if (!req.session.captchaGuard) {
    req.session.captchaGuard = {
      failedAttempts: 0,
      lockedUntil: 0,
    };
  }

  return req.session.captchaGuard;
}

function getCaptchaLockResponse(req) {
  const state = getCaptchaState(req);

  const now = Date.now();

  // Lockout expired
  if (state.lockedUntil && now >= state.lockedUntil) {
    state.failedAttempts = 0;
    state.lockedUntil = 0;
  }

  if (state.lockedUntil && now < state.lockedUntil) {
    const retryAfterSeconds = Math.ceil((state.lockedUntil - now) / 1000);

    return {
      locked: true,
      retryAfterSeconds,
    };
  }

  return {
    locked: false,
    retryAfterSeconds: 0,
  };
}

function registerCaptchaFailure(req) {
  const state = getCaptchaState(req);

  const now = Date.now();

  // If previous lock expired,
  // start a fresh counter.
  if (state.lockedUntil && now >= state.lockedUntil) {
    state.failedAttempts = 0;
    state.lockedUntil = 0;
  }

  state.failedAttempts += 1;

  // 3 wrong CAPTCHA attempts
  if (state.failedAttempts >= CAPTCHA_MAX_ATTEMPTS) {
    state.lockedUntil = Date.now() + CAPTCHA_LOCKOUT_MS;

    return {
      locked: true,
      failedAttempts: state.failedAttempts,
      retryAfterSeconds: 60,
    };
  }

  return {
    locked: false,
    failedAttempts: state.failedAttempts,
    remainingAttempts: CAPTCHA_MAX_ATTEMPTS - state.failedAttempts,
  };
}

function resetCaptchaGuard(req) {
  req.session.captchaGuard = {
    failedAttempts: 0,
    lockedUntil: 0,
  };
}

// =======================================================
// POST /api/auth/login
// =======================================================
//
// ADMIN:
//
// Username + Password
//        ↓
// Secondary 6-digit PIN
//        ↓
// Admin Dashboard
//
// TEACHER/STUDENT:
//
// Username + Password
//        ↓
// Normal login
//
// =======================================================

router.post("/login", loginLimiter, async (req, res) => {
  try {
    // ===================================================
    // CAPTCHA LOCKOUT CHECK
    // ===================================================

    const captchaLock = getCaptchaLockResponse(req);

    if (captchaLock.locked) {
      return res.status(429).json({
        ok: false,
        captchaLocked: true,
        retryAfterSeconds: captchaLock.retryAfterSeconds,
        message:
          `Too many incorrect CAPTCHA attempts. ` +
          `Please wait ${captchaLock.retryAfterSeconds} seconds.`,
      });
    }

    // ===================================================
    // Validate username
    // ===================================================

    const u = requireSafeStringFromBody(req, "username", {
      min: 1,
      max: 64,
      trim: true,
    });

    // ===================================================
    // Validate password
    // ===================================================

    const p = requireSafeStringFromBody(req, "password", {
      min: 1,
      max: 256,
      trim: false,
    });

    // ===================================================
    // Generic invalid response
    // ===================================================

    const invalid = async (usernameForAudit = "") => {
      await writeAudit(req, {
        action: "AUTH_LOGIN_FAIL",

        outcome: "FAIL",

        message: "Invalid credentials",

        meta: {
          username: usernameForAudit,
        },
      });

      return res.status(401).json({
        ok: false,

        message: "Invalid username or password",
      });
    };

    // ===================================================
    // Validate request
    // ===================================================

    if (!u.ok || !p.ok) {
      const auditName = u.ok ? u.value : "";

      return invalid(auditName);
    }

    const username = u.value;

    const password = p.value;

    // ===================================================
    // Find user
    // ===================================================

    const user = await User.findOne({
      username,
    });

    if (!user) {
      return invalid(username);
    }

    // ===================================================
    // Account status
    // ===================================================

    if (user.status !== "active") {
      return invalid(username);
    }

    // ===================================================
    // Verify main password
    // ===================================================

    const valid = await argon2.verify(user.password_hash, password);

    if (!valid) {
      return invalid(username);
    }

    // ===================================================
    // CAPTCHA LOGIN SUCCESS
    // ===================================================
    //
    // The frontend calls /captcha/success after
    // successfully solving the CAPTCHA.
    //
    // We also reset here as a safety cleanup after
    // successful password verification.
    //
    // ===================================================

    resetCaptchaGuard(req);

    // ===================================================
    // ADMIN -> SECONDARY PIN REQUIRED
    // ===================================================

    if (user.role === "admin") {
      // Make sure the admin has
      // a secondary PIN.
      if (!user.secondary_password_hash) {
        await writeAudit(req, {
          action: "AUTH_SECONDARY_PIN_BLOCKED",

          outcome: "FAIL",

          message: "Admin secondary PIN missing",

          meta: {
            username,
            role: "admin",
          },
        });

        return res.status(400).json({
          ok: false,

          message: "Admin secondary PIN is not configured.",
        });
      }

      // =================================================
      // Store pending admin authentication
      // =================================================

      req.session.secondaryAuth = {
        pending: true,

        userId: String(user._id),

        role: "admin",

        username: user.username,

        must_change_password: !!user.must_change_password,

        createdAt: new Date().toISOString(),
      };

      // =================================================
      // Audit
      // =================================================

      await writeAudit(req, {
        action: "AUTH_PASSWORD_SUCCESS_SECONDARY_REQUIRED",
        outcome: "SUCCESS",
        message: "Admin password verified; secondary PIN required",

        actor: {
          userId: user._id,
          username: user.username,
          role: "admin",
        },

        meta: {
          username,
          role: "admin",
        },
      });

      // =================================================
      // DO NOT create req.session.user yet
      // =================================================

      return res.json({
        ok: true,

        secondaryRequired: true,

        userId: String(user._id),

        role: "admin",

        mustChangePassword: !!user.must_change_password,
      });
    }

    // ===================================================
    // NON-ADMIN -> NORMAL LOGIN
    // ===================================================

    req.session.user = {
      id: String(user._id),

      role: user.role,

      username: user.username,

      must_change_password: !!user.must_change_password,
    };

    await writeAudit(req, {
      action: "AUTH_LOGIN_SUCCESS",

      outcome: "SUCCESS",

      message: "User logged in",

      meta: {
        role: user.role,
      },
    });

    return res.json({
      ok: true,

      secondaryRequired: false,

      role: user.role,

      mustChangePassword: !!user.must_change_password,
    });
  } catch (err) {
    console.error("Login error:", err);

    try {
      const username =
        typeof req.body?.username === "string" ? req.body.username.trim() : "";

      await writeAudit(req, {
        action: "AUTH_LOGIN_ERROR",

        outcome: "FAIL",

        message: "Login server error",

        meta: {
          username,
        },
      });
    } catch {}

    return res.status(500).json({
      ok: false,

      message: "Something went wrong",
    });
  }
});

// =======================================================
// POST /api/auth/captcha/fail
// =======================================================
//
// Called by login.js when the user enters
// an incorrect CAPTCHA answer.
//
// 3 failed attempts = 60-second lockout.
//
// =======================================================

router.post("/captcha/fail", async (req, res) => {
  try {
    const lock = registerCaptchaFailure(req);

    if (lock.locked) {
      await writeAudit(req, {
        action: "AUTH_CAPTCHA_LOCKOUT",

        outcome: "FAIL",

        message: "CAPTCHA failed 3 times; 60-second lockout",

        meta: {
          failedAttempts: lock.failedAttempts,

          lockoutSeconds: 60,
        },
      });

      return res.status(429).json({
        ok: false,

        captchaLocked: true,

        failedAttempts: lock.failedAttempts,

        retryAfterSeconds: lock.retryAfterSeconds,

        message: "Too many incorrect CAPTCHA attempts. Please wait 60 seconds.",
      });
    }

    await writeAudit(req, {
      action: "AUTH_CAPTCHA_FAIL",

      outcome: "FAIL",

      message: "Incorrect CAPTCHA answer",

      meta: {
        failedAttempts: lock.failedAttempts,

        remainingAttempts: lock.remainingAttempts,
      },
    });

    return res.status(400).json({
      ok: false,

      captchaLocked: false,

      failedAttempts: lock.failedAttempts,

      remainingAttempts: lock.remainingAttempts,

      message: "Incorrect CAPTCHA answer.",
    });
  } catch (err) {
    console.error("CAPTCHA failure route error:", err);

    return res.status(500).json({
      ok: false,

      message: "Something went wrong",
    });
  }
});

// =======================================================
// POST /api/auth/captcha/success
// =======================================================
//
// Called by login.js after the CAPTCHA answer is
// successfully solved.
//
// Resets the CAPTCHA failure counter.
//
// =======================================================

router.post("/captcha/success", async (req, res) => {
  try {
    const lock = getCaptchaLockResponse(req);

    // Do not allow a locked session
    // to reset itself.
    if (lock.locked) {
      return res.status(429).json({
        ok: false,

        captchaLocked: true,

        retryAfterSeconds: lock.retryAfterSeconds,

        message: `CAPTCHA is locked. Please wait ${lock.retryAfterSeconds} seconds.`,
      });
    }

    resetCaptchaGuard(req);

    return res.json({
      ok: true,

      captchaLocked: false,

      failedAttempts: 0,

      remainingAttempts: CAPTCHA_MAX_ATTEMPTS,
    });
  } catch (err) {
    console.error("CAPTCHA success route error:", err);

    return res.status(500).json({
      ok: false,

      message: "Something went wrong",
    });
  }
});

// =======================================================
// GET /api/auth/captcha/status
// =======================================================
//
// Used when login.js loads or the page is refreshed.
//
// Allows the frontend to restore an active lockout.
//
// =======================================================

router.get("/captcha/status", (req, res) => {
  const lock = getCaptchaLockResponse(req);

  const state = getCaptchaState(req);

  if (lock.locked) {
    return res.json({
      ok: true,

      captchaLocked: true,

      retryAfterSeconds: lock.retryAfterSeconds,

      failedAttempts: state.failedAttempts,
    });
  }

  return res.json({
    ok: true,

    captchaLocked: false,

    failedAttempts: state.failedAttempts,

    remainingAttempts: Math.max(0, CAPTCHA_MAX_ATTEMPTS - state.failedAttempts),
  });
});

// =======================================================
// POST /api/auth/secondary/verify
// =======================================================
//
// Used only for admin login.
//
// Main password must already be verified.
//
// Then the 6-digit secondary PIN is verified.
//
// =======================================================

router.post("/secondary/verify", async (req, res) => {
  try {
    const pending = req.session?.secondaryAuth;

    // =================================================
    // Verify pending authentication
    // =================================================

    if (!pending?.pending || pending.role !== "admin") {
      return badRequest(res, "No pending secondary authentication.");
    }

    // =================================================
    // Read PIN
    // =================================================

    const rawPin = req.body?.pin ?? req.body?.secondaryPin;

    // =================================================
    // Reject objects / arrays
    // =================================================

    if (isPlainObject(rawPin) || Array.isArray(rawPin)) {
      await writeAudit(req, {
        action: "AUTH_SECONDARY_VERIFY_FAIL",

        outcome: "FAIL",

        message: "Secondary PIN invalid type",

        meta: {
          role: "admin",
        },
      });

      return badRequest(res, "Invalid secondary PIN.");
    }

    // =================================================
    // Validate PIN format
    // =================================================

    const pin = requireSafeString(String(rawPin ?? ""), "secondaryPin", {
      min: 6,
      max: 6,
      trim: true,
      pattern: /^[0-9]{6}$/,
    });

    if (!pin.ok) {
      await writeAudit(req, {
        action: "AUTH_SECONDARY_VERIFY_FAIL",

        outcome: "FAIL",

        message: "Secondary PIN missing/invalid format",

        meta: {
          role: "admin",
        },
      });

      return badRequest(res, "Invalid secondary PIN.");
    }

    // =================================================
    // Get user from database
    // =================================================

    const user = await User.findById(pending.userId);

    if (!user) {
      delete req.session.secondaryAuth;

      return res.status(401).json({
        ok: false,

        message: "Unauthorized",
      });
    }

    // =================================================
    // Check account status
    // =================================================

    if (user.status !== "active") {
      delete req.session.secondaryAuth;

      return res.status(403).json({
        ok: false,

        message: "Account disabled",
      });
    }

    // =================================================
    // Make sure this is still an admin
    // =================================================

    if (user.role !== "admin") {
      delete req.session.secondaryAuth;

      return res.status(403).json({
        ok: false,

        message: "Admin access required.",
      });
    }

    // =================================================
    // Make sure secondary PIN exists
    // =================================================

    if (!user.secondary_password_hash) {
      delete req.session.secondaryAuth;

      await writeAudit(req, {
        action: "AUTH_SECONDARY_VERIFY_FAIL",

        outcome: "FAIL",

        message: "Secondary PIN not configured",

        meta: {
          role: "admin",
        },
      });

      return res.status(400).json({
        ok: false,

        message: "Secondary PIN is not configured.",
      });
    }

    // =================================================
    // Verify secondary PIN with Argon2
    // =================================================

    const validPin = await argon2.verify(
      user.secondary_password_hash,
      pin.value,
    );

    if (!validPin) {
      await writeAudit(req, {
        action: "AUTH_SECONDARY_VERIFY_FAIL",
        outcome: "FAIL",
        message: "Invalid secondary PIN",

        actor: {
          userId: user._id,
          username: user.username,
          role: "admin",
        },

        meta: {
          role: "admin",
          username: user.username,
        },
      });

      return res.status(401).json({
        ok: false,

        message: "Invalid secondary PIN.",
      });
    }

    // =================================================
    // SECONDARY PIN VALID
    // Finalize login
    // =================================================

    req.session.user = {
      id: String(user._id),

      role: "admin",

      username: user.username,

      must_change_password: !!user.must_change_password,
    };

    // Remove pending authentication

    delete req.session.secondaryAuth;

    // =================================================
    // Audit success
    // =================================================

    await writeAudit(req, {
      action: "AUTH_SECONDARY_VERIFY_SUCCESS",
      outcome: "SUCCESS",
      message: "Admin secondary PIN verified",

      actor: {
        userId: user._id,
        username: user.username,
        role: "admin",
      },

      meta: {
        role: "admin",
        username: user.username,
      },
    });

    // =================================================
    // Response
    // =================================================

    return res.json({
      ok: true,

      role: "admin",

      mustChangePassword: !!user.must_change_password,
    });
  } catch (err) {
    console.error("Secondary PIN verification error:", err);

    return res.status(500).json({
      ok: false,

      message: "Something went wrong",
    });
  }
});

// =======================================================
// POST /api/auth/logout
// =======================================================

router.post("/logout", async (req, res) => {
  try {
    await writeAudit(req, {
      action: "AUTH_LOGOUT",

      outcome: "SUCCESS",

      message: "User logged out",
    });
  } catch {}

  if (!req.session) {
    res.clearCookie("blims.sid", {
      path: "/",
    });

    return res.json({
      ok: true,
    });
  }

  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);

      return res.status(500).json({
        ok: false,

        message: "Logout failed",
      });
    }

    res.clearCookie("blims.sid", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: false,
    });

    return res.json({
      ok: true,
    });
  });
});

// =======================================================
// POST /api/auth/forgot-password
// =======================================================

router.post("/forgot-password", async (req, res) => {
  const genericResponse = () =>
    res.json({
      ok: true,
      message:
        "If an account is registered with that email, a password reset code has been sent.",
    });

  try {
    const rawEmail = req.body?.email;

    if (
      rawEmail === undefined ||
      rawEmail === null ||
      typeof rawEmail !== "string"
    ) {
      return badRequest(res, "Invalid email address.");
    }

    const email = normalizeEmail(rawEmail);

    if (!isValidEmail(email) || email.length > 254) {
      return badRequest(res, "Invalid email address.");
    }

    const existingReset = req.session?.passwordReset;
    const now = Date.now();

    // Prevent rapid OTP re-sends.
    if (
      existingReset?.lastSentAt &&
      now - existingReset.lastSentAt < PASSWORD_RESET_RESEND_COOLDOWN_MS
    ) {
      return genericResponse();
    }

    const candidates = [];

    // ===================================================
    // ADMIN
    // Email is stored directly in User
    // ===================================================

    const adminUser = await User.findOne({
      email,
      role: "admin",
      status: "active",
    }).select("_id role email status");

    if (adminUser) {
      candidates.push({
        user: adminUser,
        role: "admin",
      });
    }

    // ===================================================
    // TEACHER
    // Email is stored in Teacher
    // ===================================================

    const teacher = await Teacher.findOne({
      email,
      isActive: true,
    }).select("userId email isActive");

    if (teacher?.userId) {
      const teacherUser = await User.findOne({
        _id: teacher.userId,
        role: "teacher",
        status: "active",
      }).select("_id role email status");

      if (teacherUser) {
        candidates.push({
          user: teacherUser,
          role: "teacher",
        });
      }
    }

    // ===================================================
    // STUDENT
    // Email is stored in Student
    // ===================================================

    const student = await Student.findOne({
      email,
      isActive: true,
    }).select("userId email isActive");

    if (student?.userId) {
      const studentUser = await User.findOne({
        _id: student.userId,
        role: "student",
        status: "active",
      }).select("_id role email status");

      if (studentUser) {
        candidates.push({
          user: studentUser,
          role: "student",
        });
      }
    }

    // ===================================================
    // REMOVE DUPLICATES
    // ===================================================

    const uniqueCandidates = [];
    const seenUserIds = new Set();

    for (const candidate of candidates) {
      const id = String(candidate.user._id);

      if (!seenUserIds.has(id)) {
        seenUserIds.add(id);
        uniqueCandidates.push(candidate);
      }
    }

    // Do not reset an ambiguous account.
  console.log("🔎 PASSWORD RESET DEBUG:", {
  email,
  candidates: candidates.map((c) => ({
    userId: String(c.user._id),
    role: c.role,
  })),
  uniqueCandidates: uniqueCandidates.map((c) => ({
    userId: String(c.user._id),
    role: c.role,
  })),
});

if (uniqueCandidates.length !== 1) {
  console.log(
    "❌ PASSWORD RESET NOT SENT: expected 1 candidate, found",
    uniqueCandidates.length
  );
  return genericResponse();
}

    const candidate = uniqueCandidates[0];

    // ===================================================
    // GENERATE OTP
    // ===================================================

    const otp = generateResetOtp();
    const otpHash = hashResetOtp(otp);
    const expiresAt = Date.now() + PASSWORD_RESET_OTP_EXPIRES_MS;

    req.session.passwordReset = {
      userId: String(candidate.user._id),
      role: candidate.role,
      email,
      otpHash,
      expiresAt,
      attempts: 0,
      verified: false,
      lastSentAt: now,
    };

    // ===================================================
    // SEND EMAIL
    // ===================================================
console.log("📧 PASSWORD RESET EMAIL:", {
  email,
  role: candidate.role,
  userId: String(candidate.user._id),
});

    try {
      await sendPasswordResetOtp(email, otp);
    } catch (emailError) {
      console.error(
        "Password reset email error:",
        emailError
      );

      // Do not leave a valid reset session if
      // the OTP was not delivered.
      clearPasswordResetSession(req);

      try {
        await writeAudit(req, {
          action: "AUTH_PASSWORD_RESET_EMAIL_ERROR",
          outcome: "FAIL",
          message:
            "Password reset OTP email could not be sent",
          meta: {
            role: candidate.role,
          },
        });
      } catch {}

      return genericResponse();
    }

    // ===================================================
    // AUDIT
    // ===================================================

    try {
      await writeAudit(req, {
        action: "AUTH_PASSWORD_RESET_OTP_SENT",
        outcome: "SUCCESS",
        message: "Password reset OTP sent",
        meta: {
          role: candidate.role,
        },
      });
    } catch {}

    return genericResponse();
  } catch (err) {
    console.error("Forgot password error:", err);

    try {
      await writeAudit(req, {
        action: "AUTH_PASSWORD_RESET_ERROR",
        outcome: "FAIL",
        message: "Password reset request server error",
      });
    } catch {}

    return genericResponse();
  }
});


// =======================================================
// POST /api/auth/verify-reset-otp
// =======================================================

router.post("/verify-reset-otp", async (req, res) => {
  try {
    const reset = req.session?.passwordReset;

   if (!reset?.userId) {
  return res.status(400).json({
    ok: false,
    message: "Invalid or expired password reset request.",
  });
}

// Already verified.
if (reset.verified) {
  return res.json({
    ok: true,
    verified: true,
    message: "OTP verified.",
  });
}

if (!reset.otpHash) {
  return res.status(400).json({
    ok: false,
    message: "Invalid or expired password reset request.",
  });
}

    // ===================================================
    // CHECK OTP EXPIRATION
    // ===================================================

    if (Date.now() >= reset.expiresAt) {
      clearPasswordResetSession(req);

      return res.status(400).json({
        ok: false,
        message:
          "The OTP has expired. Please request a new code.",
      });
    }

    // ===================================================
    // VALIDATE OTP
    // ===================================================

    const otpResult = requireSafeStringFromBody(
      req,
      "otp",
      {
        min: 6,
        max: 6,
        trim: true,
        pattern: /^[0-9]{6}$/,
      }
    );

    if (!otpResult.ok) {
      return badRequest(res, "Invalid OTP.");
    }

    // ===================================================
    // MAX ATTEMPTS
    // ===================================================

    if (reset.attempts >= PASSWORD_RESET_MAX_ATTEMPTS) {
      clearPasswordResetSession(req);

      return res.status(429).json({
        ok: false,
        message:
          "Too many incorrect OTP attempts. Please request a new code.",
      });
    }

    reset.attempts += 1;

    // ===================================================
    // VERIFY OTP
    // ===================================================

    const submittedHash = hashResetOtp(
      otpResult.value
    );

    const valid = safeEqualHex(
      reset.otpHash,
      submittedHash
    );

    if (!valid) {
      if (
        reset.attempts >=
        PASSWORD_RESET_MAX_ATTEMPTS
      ) {
        clearPasswordResetSession(req);

        return res.status(429).json({
          ok: false,
          message:
            "Too many incorrect OTP attempts. Please request a new code.",
        });
      }

      return res.status(401).json({
        ok: false,
        message: "Invalid OTP.",
        attemptsRemaining:
          PASSWORD_RESET_MAX_ATTEMPTS -
          reset.attempts,
      });
    }

    // ===================================================
    // OTP SUCCESS
    // OTP IS NOW SINGLE-USE
    // ===================================================

    reset.otpHash = null;
    reset.verified = true;
    reset.verifiedAt = Date.now();

    try {
      await writeAudit(req, {
        action:
          "AUTH_PASSWORD_RESET_OTP_VERIFIED",
        outcome: "SUCCESS",
        message:
          "Password reset OTP verified",
        meta: {
          role: reset.role,
        },
      });
    } catch {}

    return res.json({
      ok: true,
      verified: true,
      message: "OTP verified.",
    });
  } catch (err) {
    console.error(
      "Verify reset OTP error:",
      err
    );

    return res.status(500).json({
      ok: false,
      message: "Something went wrong",
    });
  }
});


// =======================================================
// POST /api/auth/reset-password
// =======================================================

router.post("/reset-password", async (req, res) => {
  try {
    const reset = req.session?.passwordReset;

    // Must have successfully verified OTP.
    if (!reset?.verified || !reset.userId) {
      return res.status(400).json({
        ok: false,
        message:
          "Invalid or expired password reset request.",
      });
    }

    // IMPORTANT:
    // The entire reset process expires after 10 minutes,
    // even if the OTP was already verified.
    if (
      !reset.expiresAt ||
      Date.now() >= reset.expiresAt
    ) {
      clearPasswordResetSession(req);

      return res.status(400).json({
        ok: false,
        message:
          "The password reset request has expired. Please start again.",
      });
    }

    // ===================================================
    // VALIDATE NEW PASSWORD
    // ===================================================

    const np = requireSafeStringFromBody(
      req,
      "newPassword",
      {
        min: 1,
        max: 256,
        trim: false,
      }
    );

    const cp = requireSafeStringFromBody(
      req,
      "confirmPassword",
      {
        min: 1,
        max: 256,
        trim: false,
      }
    );

    if (!np.ok || !cp.ok) {
      return badRequest(res, "Invalid request.");
    }

    const newPassword = np.value;
    const confirmPassword = cp.value;

    // ===================================================
    // CONFIRM PASSWORD
    // ===================================================

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        ok: false,
        message: "Passwords do not match.",
      });
    }

    // ===================================================
    // STRONG PASSWORD
    // ===================================================

    const strong =
      checkStrongPassword(newPassword);

    if (!strong.ok) {
      return res.status(400).json({
        ok: false,
        message: strong.message,
      });
    }

    // ===================================================
    // FIND USER
    // ===================================================

    const user = await User.findById(
      reset.userId
    );

    if (!user) {
      clearPasswordResetSession(req);

      return res.status(400).json({
        ok: false,
        message:
          "Invalid or expired password reset request.",
      });
    }

    // Make sure the account is still active and
    // the role has not changed.
    if (
      user.status !== "active" ||
      user.role !== reset.role
    ) {
      clearPasswordResetSession(req);

      return res.status(403).json({
        ok: false,
        message:
          "Account is not eligible for password reset.",
      });
    }

    // ===================================================
    // UPDATE PASSWORD
    // ===================================================

    user.password_hash =
      await argon2.hash(newPassword);

    user.must_change_password = false;
    user.password_changed_at = new Date();

    await user.save();

    // ===================================================
    // AUDIT
    // ===================================================

    try {
      await writeAudit(req, {
        action:
          "AUTH_PASSWORD_RESET_SUCCESS",
        outcome: "SUCCESS",
        message:
          "Password reset completed",
        actor: {
          userId: user._id,
          username: user.username,
          role: user.role,
        },
      });
    } catch {}

    // Reset flow can never be reused.
    clearPasswordResetSession(req);

    return res.json({
      ok: true,
      message:
        "Password reset successful. You can now log in.",
    });
  } catch (err) {
    console.error(
      "Reset password error:",
      err
    );

    try {
      await writeAudit(req, {
        action:
          "AUTH_PASSWORD_RESET_ERROR",
        outcome: "FAIL",
        message:
          "Password reset server error",
      });
    } catch {}

    return res.status(500).json({
      ok: false,
      message: "Something went wrong",
    });
  }
});

// =======================================================
// GET /api/auth/me
// =======================================================

router.get("/me", async (req, res) => {
  try {
    const sessionUser = req.session?.user;

    if (!sessionUser?.id) {
      return res.status(401).json({
        ok: false,
        message: "Unauthorized",
      });
    }

    const user = await User.findById(sessionUser.id).select(
      "first_name last_name role"
    );

    if (!user) {
      return res.status(401).json({
        ok: false,
        message: "Unauthorized",
      });
    }

    return res.json({
      ok: true,
      user: {
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("GET /api/auth/me error:", err);

    return res.status(500).json({
      ok: false,
      message: "Server error",
    });
  }
});

// =======================================================
// GET /api/auth/csrf
// =======================================================

router.get("/csrf", (req, res) => {
  return res.json({
    ok: true,

    csrfToken: req.session?.csrfToken || "",
  });
});

// =======================================================
// POST /api/auth/change-password
// =======================================================

router.post("/change-password", requireAuth, async (req, res) => {
  try {
    const sessionUser = req.session.user;

    // =================================================
    // Validate passwords
    // =================================================

    const np = requireSafeStringFromBody(req, "newPassword", {
      min: 1,
      max: 256,
      trim: false,
    });

    const cp = requireSafeStringFromBody(req, "confirmPassword", {
      min: 1,
      max: 256,
      trim: false,
    });

    if (!np.ok || !cp.ok) {
      return badRequest(res, "Invalid request.");
    }

    const newPassword = np.value;

    const confirmPassword = cp.value;

    // =================================================
    // Confirm password
    // =================================================

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        ok: false,

        message: "Passwords do not match.",
      });
    }

    // =================================================
    // Strong password
    // =================================================

    const strong = checkStrongPassword(newPassword);

    if (!strong.ok) {
      return res.status(400).json({
        ok: false,

        message: strong.message,
      });
    }

    // =================================================
    // Find user
    // =================================================

    const user = await User.findById(sessionUser.id);

    if (!user) {
      return res.status(401).json({
        ok: false,

        message: "Unauthorized",
      });
    }

    if (user.status !== "active") {
      return res.status(403).json({
        ok: false,

        message: "Account disabled",
      });
    }

    // =================================================
    // Update password
    // =================================================

    user.password_hash = await argon2.hash(newPassword);

    user.must_change_password = false;

    user.password_changed_at = new Date();

    await user.save();

    req.session.user.must_change_password = false;

    // =================================================
    // Audit
    // =================================================

    await writeAudit(req, {
      action: "AUTH_PASSWORD_CHANGED",

      outcome: "SUCCESS",

      message: "Password changed",
    });

    return res.json({
      ok: true,

      role: user.role,
    });
  } catch (err) {
    console.error("Change password error:", err);

    try {
      await writeAudit(req, {
        action: "AUTH_PASSWORD_CHANGE_ERROR",

        outcome: "FAIL",

        message: "Change password server error",
      });
    } catch {}

    return res.status(500).json({
      ok: false,

      message: "Something went wrong",
    });
  }
});

// =======================================================
// EXPORT
// =======================================================

module.exports = router;
