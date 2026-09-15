const Student = require("../models/Student.model");
const User = require("../models/User.model");
const GradeLevel = require("../models/GradeLevel.model");

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
// GET STUDENT SUBJECTS
// GET /api/student/subjects
// ==========================================

exports.getSubjects = async (req, res) => {
  try {
    console.log("======================================");
    console.log("📚 GET STUDENT SUBJECTS");
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
    // 5. GET STUDENT GRADE LEVEL
    // ==========================================

    const grade = String(
      student.className || ""
    ).trim();

    if (
      !grade ||
      norm(grade) === "unassigned"
    ) {
      console.log("⚠️ Student has no assigned grade level.");

      return res.json({
        ok: true,
        data: {
          grade: "",
          subjects: [],
        },
      });
    }

    console.log("🏫 Student grade level:", grade);

    // ==========================================
    // 6. FIND ACTIVE GRADE LEVEL
    // ==========================================

    const gradeLevel = await GradeLevel.findOne({
      grade: {
        $regex: `^${grade.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        )}$`,
        $options: "i",
      },
      isActive: true,
    }).lean();

    if (!gradeLevel) {
      console.log(
        "⚠️ Grade level not found:",
        grade
      );

      return res.json({
        ok: true,
        data: {
          grade,
          subjects: [],
        },
      });
    }

    console.log("📖 GradeLevel found:", {
      id: String(gradeLevel._id),
      grade: gradeLevel.grade,
      subjectCount: Array.isArray(gradeLevel.subjects)
        ? gradeLevel.subjects.length
        : 0,
    });

    // ==========================================
    // 7. GET SUBJECTS
    // ==========================================

    const subjects = Array.isArray(
      gradeLevel.subjects
    )
      ? gradeLevel.subjects
          .map((subject) =>
            String(subject || "").trim()
          )
          .filter(Boolean)
      : [];

    console.log(
      "📚 Subjects found:",
      subjects
    );

    // ==========================================
    // 8. RESPONSE
    // ==========================================

    return res.json({
      ok: true,

      data: {
        grade:
          gradeLevel.grade || grade,

        subjects,
      },
    });

  } catch (err) {
    console.error(
      "❌ Student subjects controller error:",
      err
    );

    return res.status(500).json({
      ok: false,
      message: "Failed to load student subjects.",
    });
  }
};