// backend/src/controllers/teacher.controller.js

const ClassSchedule = require("../models/ClassSchedule");
const User = require("../models/User.model");
const Teacher = require("../models/Teacher.model");

// ==========================================
// HELPERS
// ==========================================

function norm(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// ==========================================
// GET MY SCHEDULE
// GET /api/teacher/my-schedule
// ==========================================

exports.getMySchedule = async (req, res) => {
  try {
    console.log("======================================");
    console.log("📅 GET TEACHER MY SCHEDULE");
    console.log("Session user:", req.session?.user);
    console.log("Session ID:", req.sessionID);
    console.log("======================================");

    // ==========================================
    // 1. CHECK SESSION
    // ==========================================

    const sessionUser = req.session?.user;

    if (!sessionUser?.id) {
      console.log("❌ No logged-in session user.");

      return res.status(401).json({
        ok: false,
        message: "Unauthorized",
      });
    }

    // ==========================================
    // 2. GET USER
    // ==========================================

    const user = await User.findById(sessionUser.id).lean();

    if (!user) {
      console.log("❌ User not found:", sessionUser.id);

      return res.status(401).json({
        ok: false,
        message: "User account not found.",
      });
    }

    console.log("👤 User found:", {
      id: String(user._id),
      username: user.username,
      role: user.role,
      email: user.email,
    });

    // ==========================================
    // 3. VERIFY ROLE
    // ==========================================

    if (norm(user.role) !== "teacher") {
      console.log("❌ User is not a teacher:", user.role);

      return res.status(403).json({
        ok: false,
        message: "Teacher access required.",
      });
    }

    // ==========================================
    // 4. GET TEACHER PROFILE
    // ==========================================

    const teacher = await Teacher.findOne({
      userId: user._id,
      isActive: true,
    }).lean();

    if (!teacher) {
      console.log(
        "❌ Teacher profile not found for User:",
        String(user._id)
      );

      return res.status(404).json({
        ok: false,
        message: "Teacher profile not found.",
      });
    }

    console.log("👨‍🏫 Teacher profile:", {
      id: String(teacher._id),
      teacherId: teacher.teacherId,
      firstName: teacher.firstName,
      middleName: teacher.middleName,
      lastName: teacher.lastName,
      email: teacher.email,
      className: teacher.className,
      sectionName: teacher.sectionName,
    });

    // ==========================================
    // 5. BUILD TEACHER FULL NAME
    // ==========================================

    const fullName = [
      teacher.firstName,
      teacher.middleName,
      teacher.lastName,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();

    console.log("👨‍🏫 Teacher full name:", fullName);

    // ==========================================
    // 6. BUILD ALL POSSIBLE IDENTITIES
    // ==========================================

    const identities = [
      fullName,

      // First + Last
      [teacher.firstName, teacher.lastName]
        .filter(Boolean)
        .join(" "),

      // Last + First
      [teacher.lastName, teacher.firstName]
        .filter(Boolean)
        .join(" "),

      // Teacher ID
      teacher.teacherId,

      // User information
      user.username,
      user.email,

      // Session information
      sessionUser.username,
      sessionUser.email,
      sessionUser.name,
      sessionUser.fullName,
    ]
      .filter(Boolean)
      .map(norm);

    const teacherIdentities = [
      ...new Set(identities),
    ];

    console.log(
      "🔎 Teacher identities:",
      teacherIdentities
    );

    // ==========================================
    // 7. GET ACTIVE SCHEDULES
    // ==========================================

    const rows = await ClassSchedule.find({
      isActive: true,
    })
      .sort({
        day: 1,
        start: 1,
        subject: 1,
      })
      .lean();

    console.log(
      "📚 Total active schedules:",
      rows.length
    );

    // ==========================================
    // 8. MATCH SCHEDULE TO TEACHER
    // ==========================================

    const teacherRows = rows.filter((row) => {
      const scheduleTeacher = norm(row.teacher);

      if (!scheduleTeacher) {
        return false;
      }

      const matched = teacherIdentities.some(
        (identity) => {
          return (
            scheduleTeacher === identity ||
            scheduleTeacher.includes(identity) ||
            identity.includes(scheduleTeacher)
          );
        }
      );

      console.log("🔍 Schedule check:", {
        subject: row.subject,
        day: row.day,
        teacherStored: row.teacher,
        normalizedTeacher: scheduleTeacher,
        matched,
      });

      return matched;
    });

    console.log(
      "======================================"
    );

    console.log(
      "📅 Teacher schedules found:",
      teacherRows.length
    );

    console.log(
      "======================================"
    );

    // ==========================================
    // 9. FORMAT RESPONSE
    // ==========================================

    const items = teacherRows.map((row) => ({
      id: String(row._id),

      grade: row.grade || "",

      section: row.section || "",

      gradeSection: [
        row.grade,
        row.section,
      ]
        .filter(Boolean)
        .join(" - "),

      classLabel: [
        row.grade,
        row.section,
      ]
        .filter(Boolean)
        .join(" - "),

      subject: row.subject || "",

      day: row.day || "",

      start: row.start || "",

      end: row.end || "",

      room: row.room || "",

      teacher: row.teacher || "",

      notes: row.notes || "",

      createdAt: row.createdAt || null,

      updatedAt: row.updatedAt || null,
    }));

    // ==========================================
    // 10. RESPONSE
    // ==========================================

    return res.json({
      ok: true,
      count: items.length,
      data: items,
    });

  } catch (err) {
    console.error(
      "❌ Teacher schedule controller error:",
      err
    );

    return res.status(500).json({
      ok: false,
      message: "Failed to load teacher schedule.",
    });
  }
};