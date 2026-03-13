// backend/src/controllers/admin.dashboard.controller.js
const User = require("../models/User.model");
const Teacher = require("../models/Teacher.model"); // optional use

// If you have announcements later, you can import it here.
// const Announcement = require("../models/Announcement.model");

function safeDate(v) {
  try {
    return v ? new Date(v).toISOString() : null;
  } catch {
    return null;
  }
}

exports.getAdminDashboardStats = async (req, res) => {
  try {
    // ✅ Most compatible counts (no Student model needed)
    const [totalTeachers, totalStudents] = await Promise.all([
      User.countDocuments({ role: "teacher" }),
      User.countDocuments({ role: "student" }),
    ]);

    // Optional: if you prefer teachers count from Teacher collection instead:
    // const totalTeachers = await Teacher.countDocuments({});

    // ✅ Recently added accounts (latest users)
    // We show role, username, and createdAt by default.
    // Name/email/contact are not guaranteed in User model, so we fill nulls unless present.
    const recentUsers = await User.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const recentAccounts = recentUsers.map((u) => ({
      role: u.role || "",
      username: u.username || "",
      name: u.name || null, // only if your User schema has it
      email: u.email || null, // only if your User schema has it
      contactNo: u.phone || u.contactNo || null, // only if your User schema has it
      dateCreated: safeDate(u.createdAt) || safeDate(u.created_at) || null,
    }));

    // ✅ Announcements count (only if you have a model; otherwise keep 0)
    const totalAnnouncements = 0;
    // const totalAnnouncements = await Announcement.countDocuments({});

    return res.json({
      ok: true,
      stats: {
        totalTeachers,
        totalStudents,
        totalAnnouncements,
      },
      recentAccounts,
    });
  } catch (err) {
    console.error("getAdminDashboardStats error:", err);
    return res.status(500).json({ ok: false, message: "Failed to load dashboard stats." });
  }
};