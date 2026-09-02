// backend/src/controllers/teacher.schedule.controller.js

const ClassSchedule = require("../models/ClassSchedule");
const User = require("../models/User.model");
const Teacher = require("../models/Teacher.model");
const Section = require("../models/Section");

// ==========================================
// HELPERS
// ==========================================

function norm(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function buildTeacherName(teacher) {
  if (!teacher) return "";

  // Match the format used by your admin schedule:
  // "Estrada Ronald Bantayan"

  return [
    teacher.lastName,
    teacher.firstName,
    teacher.middleName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
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

    console.log("👤 User:", {
      id: String(user._id),
      username: user.username,
      email: user.email,
      role: user.role,
    });

    // ==========================================
    // 3. VERIFY TEACHER ROLE
    // ==========================================

    if (norm(user.role) !== "teacher") {
      return res.status(403).json({
        ok: false,
        message: "Teacher access required.",
      });
    }

    // ==========================================
    // 4. FIND TEACHER PROFILE
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

    const teacherObjectId = teacher._id;

    const teacherName = buildTeacherName(teacher);

    console.log("👨‍🏫 Teacher profile:", {
      teacherId: String(teacher._id),
      userId: String(teacher.userId),
      firstName: teacher.firstName,
      middleName: teacher.middleName,
      lastName: teacher.lastName,
      fullName: teacherName,
    });

    // ==========================================
    // 5. FIND SECTIONS ASSIGNED TO THIS TEACHER
    // ==========================================

    const assignedSections = await Section.find({
      adviserId: teacherObjectId,
      isActive: true,
    }).lean();

    console.log(
      "🏫 Assigned sections:",
      assignedSections.map((section) => ({
        grade: section.grade,
        section: section.section,
        adviser: section.adviser,
        adviserId: section.adviserId
          ? String(section.adviserId)
          : null,
      }))
    );

    // ==========================================
    // 6. BUILD GRADE + SECTION PAIRS
    // ==========================================

    const assignedPairs = assignedSections.map((section) => ({
      grade: norm(section.grade),
      section: norm(section.section),
    }));

    // ==========================================
    // 7. BUILD POSSIBLE TEACHER NAMES
    // ==========================================

    const teacherIdentities = [
      teacherName,

      // Possible alternative formats
      [
        teacher.firstName,
        teacher.middleName,
        teacher.lastName,
      ]
        .filter(Boolean)
        .join(" "),

      [
        teacher.firstName,
        teacher.lastName,
      ]
        .filter(Boolean)
        .join(" "),

      [
        teacher.lastName,
        teacher.firstName,
      ]
        .filter(Boolean)
        .join(" "),

      user.username,
      user.email,
      sessionUser.username,
      sessionUser.email,
      sessionUser.name,
    ]
      .filter(Boolean)
      .map(norm);

    const uniqueIdentities = [
      ...new Set(teacherIdentities),
    ];

    console.log(
      "🔎 Teacher identities:",
      uniqueIdentities
    );

    // ==========================================
    // 8. GET ALL ACTIVE SCHEDULES
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
    // 9. MATCH SCHEDULES
    // ==========================================

    const teacherRows = rows.filter((row) => {
      const rowGrade = norm(row.grade);
      const rowSection = norm(row.section);
      const scheduleTeacher = norm(row.teacher);

      // ------------------------------------------
      // METHOD A
      // Match section adviserId
      // ------------------------------------------

      const sectionMatch = assignedPairs.some((pair) => {
        return (
          pair.grade === rowGrade &&
          pair.section === rowSection
        );
      });

      if (sectionMatch) {
        console.log(
          `✅ Section match: ${row.grade} - ${row.section} | ${row.subject} | ${row.day}`
        );

        return true;
      }

      // ------------------------------------------
      // METHOD B
      // Match teacher name
      // ------------------------------------------

      if (scheduleTeacher) {
        const nameMatch = uniqueIdentities.some((identity) => {
          return (
            scheduleTeacher === identity ||
            scheduleTeacher.includes(identity) ||
            identity.includes(scheduleTeacher)
          );
        });

        if (nameMatch) {
          console.log(
            `✅ Teacher name match: ${row.subject} | ${row.day} | ${row.teacher}`
          );

          return true;
        }
      }

      return false;
    });

    console.log(
      "📅 Teacher schedules found:",
      teacherRows.length
    );

    // ==========================================
    // 10. FORMAT RESPONSE
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

      teacher: row.teacher || teacherName,

      notes: row.notes || "",

      createdAt: row.createdAt || null,
      updatedAt: row.updatedAt || null,
    }));

    // ==========================================
    // 11. RESPONSE
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