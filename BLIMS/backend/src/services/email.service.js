const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD,
  },
});

async function sendPasswordResetOtp(to, otp) {
  await transporter.sendMail({
    from: `"BLIMS - Bolosan Learning Information Management System" <${process.env.EMAIL_USER}>`,
    to,
    subject: "BLIMS Password Reset OTP",

    text: `Your BLIMS password reset OTP is ${otp}. This OTP will expire in 10 minutes.`,

    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6;">
        <h2>BLIMS Password Reset</h2>

        <p>You requested to reset your BLIMS account password.</p>

        <p>Your OTP is:</p>

        <div style="
          font-size: 30px;
          font-weight: bold;
          letter-spacing: 8px;
          margin: 20px 0;
        ">
          ${otp}
        </div>

        <p>
          This OTP will expire in <strong>10 minutes</strong>.
        </p>

        <p>
          If you did not request a password reset, you can safely ignore
          this email.
        </p>

        <hr>

        <p style="font-size: 12px; color: #777;">
          BLIMS - Bolosan Learning Information Management System
        </p>
      </div>
    `,
  });
}

module.exports = {
  sendPasswordResetOtp,
};