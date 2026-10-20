// backend/src/controllers/admin.dashboard.controller.js

const User = require("../models/User.model");
const Teacher = require("../models/Teacher.model"); // Keep existing import
const Enrollment = require("../models/Enrollment.model");
const SchoolYear = require("../models/SchoolYear.model");

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

    // Real enrollment counts grouped by school year.
    const schoolYears = await SchoolYear.find({})
      .select("_id name start end isActive")
      .sort({ start: 1, createdAt: 1 })
      .lean();

    const enrollmentCounts = await Enrollment.aggregate([
      {
        $group: {
          _id: "$schoolYearId",
          schoolYearName: { $first: "$schoolYearName" },
          totalStudents: { $sum: 1 },
        },
      },
    ]);

    const enrollmentCountByYear = new Map(
      enrollmentCounts.map((item) => [String(item._id), item.totalStudents]),
    );

    const enrollmentTrend = schoolYears
      .filter((year) => enrollmentCountByYear.has(String(year._id)))
      .map((year) => ({
        schoolYearId: String(year._id),
        schoolYearName: year.name,
        totalStudents: enrollmentCountByYear.get(String(year._id)) || 0,
      }));

    // Real learner distribution grouped by school year and grade.
    const gradeDistribution = await Enrollment.aggregate([
      {
        $group: {
          _id: {
            schoolYearId: "$schoolYearId",
            className: "$className",
          },
          count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          schoolYearId: {
            $toString: "$_id.schoolYearId",
          },
          grade: "$_id.className",
          count: 1,
        },
      },
      {
        $sort: {
          schoolYearId: 1,
          grade: 1,
        },
      },
    ]);

    // Optional: if you prefer teachers count from Teacher collection instead:
    // const totalTeachers = await Teacher.countDocuments({});

    // Recently added accounts — use the actual User model fields.
    const recentUsers = await User.find({})
      .sort({ created_at: -1 })
      .limit(10)
      .lean();

    const recentAccounts = recentUsers.map((u) => ({
      role: u.role || "",
      username: u.username || "",
      name:
        [u.first_name, u.middle_name, u.last_name, u.suffix]
          .filter(Boolean)
          .join(" ") || null,
      email: u.email || null,
      contactNo: u.phone_number || null,
      dateCreated: safeDate(u.created_at),
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
      enrollmentTrend,
      gradeDistribution,
    });
  } catch (err) {
    console.error("getAdminDashboardStats error:", err);
    return res
      .status(500)
      .json({ ok: false, message: "Failed to load dashboard stats." });
  }
};
