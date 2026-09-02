const Student = require("../models/Student.model");
const User = require("../models/User.model");
const ClassSchedule = require("../models/ClassSchedule");

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
// GET /api/student/my-schedule
// ==========================================

exports.getMySchedule = async (req, res) => {
  try {
    console.log("======================================");
    console.log("📅 GET STUDENT MY SCHEDULE");
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

    const user = await User.findById(
      sessionUser.id
    ).lean();

    if (!user) {
      console.log(
        "❌ User not found:",
        sessionUser.id
      );

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
    // 3. VERIFY STUDENT ROLE
    // ==========================================

    if (norm(user.role) !== "student") {
      return res.status(403).json({
        ok: false,
        message: "Student access required.",
      });
    }

    // ==========================================
    // 4. FIND STUDENT PROFILE
    // ==========================================

    const student = await Student.findOne({
      userId: user._id,
      isActive: true,
    }).lean();

    if (!student) {
      console.log(
        "❌ Student profile not found for User:",
        String(user._id)
      );

      return res.status(404).json({
        ok: false,
        message: "Student profile not found.",
      });
    }

    console.log("👨‍🎓 Student:", {
      studentId: student.studentId,
      firstName: student.firstName,
      lastName: student.lastName,
      className: student.className,
      sectionName: student.sectionName,
    });

    // ==========================================
    // 5. GET STUDENT CLASS
    // ==========================================

    const grade = String(
      student.className || ""
    ).trim();

    const section = String(
      student.sectionName || ""
    ).trim();

    if (
      !grade ||
      !section ||
      norm(grade) === "unassigned" ||
      norm(section) === "unassigned"
    ) {
      console.log("⚠️ Student has no assigned class.");

      return res.json({
        ok: true,
        count: 0,
        data: [],
        student: {
          id: String(student._id),
          studentId: student.studentId,
          name: [
            student.firstName,
            student.middleName,
            student.lastName,
          ]
            .filter(Boolean)
            .join(" "),
          grade,
          section,
        },
      });
    }

    console.log("🏫 Student class:", {
      grade,
      section,
    });

    // ==========================================
    // 6. FIND CLASS SCHEDULE
    // ==========================================

    const rows = await ClassSchedule.find({
      isActive: true,

      grade: {
        $regex: `^${grade.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        )}$`,
        $options: "i",
      },

      section: {
        $regex: `^${section.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        )}$`,
        $options: "i",
      },
    })
      .sort({
        day: 1,
        start: 1,
        subject: 1,
      })
      .lean();

    console.log(
      "📚 Student schedules found:",
      rows.length
    );

    // ==========================================
    // 7. FORMAT RESPONSE
    // ==========================================

    const items = rows.map((row) => ({
      id: String(row._id),

      grade: row.grade || grade,

      section:
        row.section || section,

      gradeSection: [
        row.grade || grade,
        row.section || section,
      ]
        .filter(Boolean)
        .join(" - "),

      classLabel: [
        row.grade || grade,
        row.section || section,
      ]
        .filter(Boolean)
        .join(" - "),

      subject:
        row.subject || "",

      day:
        row.day || "",

      start:
        row.start || "",

      end:
        row.end || "",

      room:
        row.room || "",

      teacher:
        row.teacher || "",

      notes:
        row.notes || "",

      createdAt:
        row.createdAt || null,

      updatedAt:
        row.updatedAt || null,
    }));

    // ==========================================
    // 8. RESPONSE
    // ==========================================

    return res.json({
      ok: true,

      count: items.length,

      data: items,

      student: {
        id: String(student._id),

        studentId:
          student.studentId,

        name: [
          student.firstName,
          student.middleName,
          student.lastName,
        ]
          .filter(Boolean)
          .join(" "),

        grade,

        section,
      },
    });

  } catch (err) {
    console.error(
      "❌ Student schedule controller error:",
      err
    );

    return res.status(500).json({
      ok: false,
      message: "Failed to load student schedule.",
    });
  }
};