// backend/src/middleware/rateLimiters.js
const rateLimit = require("express-rate-limit");

// 5 attempts per 10 minutes
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 5, // limit each IP to 5 requests per window

  standardHeaders: true,
  legacyHeaders: false,

  message: {
    ok: false,
    message:
      "Too many login attempts. Please try again in 10 minutes.",
  },

  handler: (req, res, next, options) => {
    return res.status(429).json(options.message);
  },
});

module.exports = {
  loginLimiter,
};