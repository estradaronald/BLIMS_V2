// backend/src/utils/mailer.js
const nodemailer = require("nodemailer");

function maskEmail(email) {
  try {
    const [user, domain] = String(email).split("@");
    if (!user || !domain) return "*****";
    const visible = user.length <= 2 ? user[0] : user.slice(0, 2);
    return `${visible}***@${domain}`;
  } catch {
    return "*****";
  }
}

function makeTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true", // true for 465
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendOtpEmail(to, code) {
  const transporter = makeTransporter();

  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  await transporter.sendMail({
    from,
    to,
    subject: "BLIMS Admin OTP",
    text: `Your BLIMS OTP is: ${code}\nThis code expires in 5 minutes.`,
  });
}

module.exports = { sendOtpEmail, maskEmail };