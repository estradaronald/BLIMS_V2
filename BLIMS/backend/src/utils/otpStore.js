// backend/src/utils/otpStore.js

// In-memory OTP store (OK for local dev; later move to Mongo/Redis)
const store = new Map(); // userId -> { code, expiresAt }

function genOtp() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
}

function setOtp(userId, code, ttlMs = 5 * 60 * 1000) {
  store.set(String(userId), {
    code: String(code),
    expiresAt: Date.now() + ttlMs,
  });
}

function verifyOtp(userId, code) {
  const rec = store.get(String(userId));
  if (!rec) return { ok: false, reason: "missing" };

  if (Date.now() > rec.expiresAt) {
    store.delete(String(userId));
    return { ok: false, reason: "expired" };
  }

  if (String(code) !== rec.code) return { ok: false, reason: "invalid" };

  store.delete(String(userId));
  return { ok: true };
}

module.exports = { genOtp, setOtp, verifyOtp };