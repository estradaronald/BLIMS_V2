// backend/src/routes/auth.routes.js
const express = require("express");
const argon2 = require("argon2");
const User = require("../models/User.model");
const { writeAudit } = require("../utils/audit");
const { loginLimiter } = require("../middlewares/rateLimiters");

// ✅ MFA OTP utilities
const { genOtp, setOtp, verifyOtp } = require("../utils/otpStore");
const { sendOtpEmail, maskEmail } = require("../utils/mailer");

const router = express.Router();

// ------------------------------
// Helpers
// ------------------------------
function requireAuth(req, res, next) {
  if (!req.session?.user?.id) {
    return res.status(401).json({ ok: false, message: "Unauthorized" });
  }
  next();
}

function checkStrongPassword(pw) {
  if (typeof pw !== "string") {
    return { ok: false, message: "Password is required." };
  }
  if (pw.length < 12)
    return { ok: false, message: "Password must be at least 12 characters." };
  if (!/[A-Z]/.test(pw))
    return { ok: false, message: "Password must include at least 1 uppercase letter." };
  if (!/[a-z]/.test(pw))
    return { ok: false, message: "Password must include at least 1 lowercase letter." };
  if (!/[0-9]/.test(pw))
    return { ok: false, message: "Password must include at least 1 number." };
  if (!/[^A-Za-z0-9]/.test(pw))
    return { ok: false, message: "Password must include at least 1 symbol." };
  return { ok: true };
}

// ------------------------------
// ✅ Category 2: Schema validation + NoSQL injection-safe guards
// ------------------------------
function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

// Reject objects/arrays where a string is expected (prevents NoSQL operators)
function requireSafeString(value, fieldName, opts = {}) {
  const {
    trim = true,
    min = 1,
    max = 255,
    allowEmpty = false,
    pattern = null, // RegExp
  } = opts;

  if (value === undefined || value === null) {
    return { ok: false, message: `Invalid request.` };
  }

  // block objects/arrays/functions
  if (typeof value !== "string") {
    // Allow numbers only if explicitly requested (not used here)
    return { ok: false, message: `Invalid request.` };
  }

  let s = value;
  if (trim) s = s.trim();

  if (!allowEmpty && s.length < min) return { ok: false, message: `Invalid request.` };
  if (s.length > max) return { ok: false, message: `Invalid request.` };
  if (pattern && !pattern.test(s)) return { ok: false, message: `Invalid request.` };

  return { ok: true, value: s };
}

function requireSafeStringFromBody(req, fieldName, opts) {
  const v = req.body?.[fieldName];
  // if someone sends {"username": {"$ne": ""}} it becomes object -> rejected
  if (isPlainObject(v) || Array.isArray(v)) return { ok: false, message: "Invalid request." };
  return requireSafeString(v, fieldName, opts);
}

function badRequest(res, message = "Invalid request.") {
  return res.status(400).json({ ok: false, message });
}

function isLikelyObjectId(s) {
  return typeof s === "string" && /^[a-fA-F0-9]{24}$/.test(s);
}

// =======================================================
// POST /api/auth/login
// =======================================================
router.post("/login", loginLimiter, async (req, res) => {
  try {
    // ✅ schema validation (server-side)
    const u = requireSafeStringFromBody(req, "username", { min: 1, max: 64, trim: true });
    const p = requireSafeStringFromBody(req, "password", { min: 1, max: 256, trim: false });

    // Keep response generic for security
    const invalid = async (usernameForAudit = "") => {
      await writeAudit(req, {
        action: "AUTH_LOGIN_FAIL",
        outcome: "FAIL",
        message: "Invalid credentials",
        meta: { username: usernameForAudit },
      });

      return res
        .status(401)
        .json({ ok: false, message: "Invalid username or password" });
    };

    if (!u.ok || !p.ok) {
      // If username exists as a safe string, include it in audit meta
      const auditName = u.ok ? u.value : "";
      return invalid(auditName);
    }

    const username = u.value;
    const password = p.value;

    const user = await User.findOne({ username });
    if (!user) return invalid(username);
    if (user.status !== "active") return invalid(username);

    const valid = await argon2.verify(user.password_hash, password);
    if (!valid) return invalid(username);

    // ✅ ADMIN -> MFA REQUIRED (STOP normal login here)
    if (user.role === "admin") {
      // validate email shape (basic)
      const emailRaw = String(user.email || "").trim().toLowerCase();
      if (!emailRaw) {
        await writeAudit(req, {
          action: "AUTH_MFA_BLOCKED",
          outcome: "FAIL",
          message: "Admin email missing",
          meta: { username, role: user.role },
        });

        return res.status(400).json({
          ok: false,
          message: "Admin email not configured. Please add email to users collection.",
        });
      }

      const userId = String(user._id);

      // Generate + store OTP (in-memory for local dev)
      const code = genOtp();
      setOtp(userId, code);

      // Store pending MFA in session (NOT logged in yet)
      req.session.mfa = {
        pending: true,
        userId,
        role: user.role,
        username: user.username,
        must_change_password: !!user.must_change_password,
        createdAt: new Date().toISOString(),
      };

      // ✅ Send OTP email safely (never crash login)
      const smtpHost = String(process.env.SMTP_HOST || "");
      const smtpUser = String(process.env.SMTP_USER || "");
      const smtpPass = String(process.env.SMTP_PASS || "");
      const smtpReady = smtpHost && smtpUser && smtpPass;

      if (!smtpReady) {
        console.log("[DEV] SMTP not configured. OTP:", code, "->", emailRaw);
      } else {
        try {
          await sendOtpEmail(emailRaw, code);
        } catch (e) {
          console.error("OTP email send failed:", e?.message || e);
          console.log("[DEV OTP]", code, "->", emailRaw);
        }
      }

      await writeAudit(req, {
        action: "AUTH_MFA_OTP_SENT",
        outcome: "SUCCESS",
        message: "Admin OTP generated/sent",
        meta: { role: user.role, emailMasked: maskEmail(emailRaw) },
      });

      return res.json({
        ok: true,
        mfaRequired: true,
        userId,
        role: user.role,
        mustChangePassword: !!user.must_change_password,
        emailMasked: maskEmail(emailRaw),
      });
    }

    // ✅ NON-ADMIN -> Normal login
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
      meta: { role: user.role },
    });

    return res.json({
      ok: true,
      mfaRequired: false,
      role: user.role,
      mustChangePassword: !!user.must_change_password,
    });
  } catch (err) {
    console.error("Login error:", err);

    try {
      const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
      await writeAudit(req, {
        action: "AUTH_LOGIN_ERROR",
        outcome: "FAIL",
        message: "Login server error",
        meta: { username },
      });
    } catch {}

    return res.status(500).json({ ok: false, message: "Something went wrong" });
  }
});

// =======================================================
// POST /api/auth/mfa/verify
// =======================================================
router.post("/mfa/verify", async (req, res) => {
  try {
    const pending = req.session?.mfa;

    // ✅ admin-only MFA enforcement
    const role = String(pending?.role || "admin");
    if (!pending?.pending || role !== "admin") {
      return badRequest(res, "No pending MFA.");
    }

    // ✅ accept BOTH "code" and "otp"
    const rawCode = req.body?.code ?? req.body?.otp;

    if (isPlainObject(rawCode) || Array.isArray(rawCode)) {
      await writeAudit(req, {
        action: "AUTH_MFA_VERIFY_FAIL",
        outcome: "FAIL",
        message: "OTP invalid type",
        meta: { role },
      });
      return badRequest(res, "Invalid or expired OTP.");
    }

    const c = requireSafeString(String(rawCode ?? ""), "otp", {
      min: 6,
      max: 6,
      trim: true,
      pattern: /^[0-9]{6}$/,
    });

    if (!c.ok) {
      await writeAudit(req, {
        action: "AUTH_MFA_VERIFY_FAIL",
        outcome: "FAIL",
        message: "OTP missing/invalid format",
        meta: { role },
      });
      return badRequest(res, "Invalid or expired OTP.");
    }

    // ✅ userId should come from session first
    let userId = String(pending?.userId || "").trim();

    // Optional fallback: allow userId in body, but validate shape
    if (!userId && typeof req.body?.userId === "string") {
      userId = req.body.userId.trim();
    }

    if (!userId || !isLikelyObjectId(userId)) {
      await writeAudit(req, {
        action: "AUTH_MFA_VERIFY_FAIL",
        outcome: "FAIL",
        message: "Missing/invalid userId",
        meta: { role },
      });
      return badRequest(res, "Invalid request.");
    }

    const result = verifyOtp(userId, c.value);
    if (!result.ok) {
      await writeAudit(req, {
        action: "AUTH_MFA_VERIFY_FAIL",
        outcome: "FAIL",
        message: "OTP invalid/expired",
        meta: { role, reason: result.reason },
      });
      return badRequest(res, "Invalid or expired OTP.");
    }

    // ✅ OTP OK -> finalize login session NOW
    req.session.user = {
      id: userId,
      role,
      username: pending?.username || "admin",
      must_change_password: !!pending?.must_change_password,
    };

    // clear mfa state
    delete req.session.mfa;

    await writeAudit(req, {
      action: "AUTH_MFA_VERIFY_SUCCESS",
      outcome: "SUCCESS",
      message: "Admin MFA verified",
      meta: { role: "admin" },
    });

    return res.json({
      ok: true,
      role: "admin",
      mustChangePassword: !!req.session.user.must_change_password,
    });
  } catch (err) {
    console.error("MFA verify error:", err);
    return res.status(500).json({ ok: false, message: "Something went wrong" });
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
    res.clearCookie("blims.sid", { path: "/" });
    return res.json({ ok: true });
  }

  req.session.destroy((err) => {
    if (err) {
      console.error("Logout error:", err);
      return res.status(500).json({ ok: false, message: "Logout failed" });
    }

    res.clearCookie("blims.sid", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: false,
    });

    return res.json({ ok: true });
  });
});

// =======================================================
// GET /api/auth/me
// =======================================================
router.get("/me", (req, res) => {
  const u = req.session?.user;
  if (!u) return res.status(401).json({ ok: false, message: "Unauthorized" });
  return res.json({ ok: true, user: u });
});

// =======================================================
// ✅ GET /api/auth/csrf  (NEW)
// =======================================================
router.get("/csrf", (req, res) => {
  // server.js already runs ensureCsrfToken on /api
  return res.json({ ok: true, csrfToken: req.session?.csrfToken || "" });
});

// =======================================================
// POST /api/auth/change-password
// =======================================================
router.post("/change-password", requireAuth, async (req, res) => {
  try {
    const sessionUser = req.session.user;

    // ✅ schema validation (server-side)
    const np = requireSafeStringFromBody(req, "newPassword", { min: 1, max: 256, trim: false });
    const cp = requireSafeStringFromBody(req, "confirmPassword", { min: 1, max: 256, trim: false });

    if (!np.ok || !cp.ok) return badRequest(res, "Invalid request.");

    const newPassword = np.value;
    const confirmPassword = cp.value;

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ ok: false, message: "Passwords do not match." });
    }

    const strong = checkStrongPassword(newPassword);
    if (!strong.ok) {
      return res.status(400).json({ ok: false, message: strong.message });
    }

    const user = await User.findById(sessionUser.id);
    if (!user) return res.status(401).json({ ok: false, message: "Unauthorized" });
    if (user.status !== "active")
      return res.status(403).json({ ok: false, message: "Account disabled" });

    user.password_hash = await argon2.hash(newPassword);
    user.must_change_password = false;
    user.password_changed_at = new Date();
    await user.save();

    req.session.user.must_change_password = false;

    await writeAudit(req, {
      action: "AUTH_PASSWORD_CHANGED",
      outcome: "SUCCESS",
      message: "Password changed",
    });

    return res.json({ ok: true, role: user.role });
  } catch (err) {
    console.error("Change password error:", err);

    try {
      await writeAudit(req, {
        action: "AUTH_PASSWORD_CHANGE_ERROR",
        outcome: "FAIL",
        message: "Change password server error",
      });
    } catch {}

    return res.status(500).json({ ok: false, message: "Something went wrong" });
  }
});

module.exports = router;