const Student = require("../models/Student.model");
const Teacher = require("../models/Teacher.model"); // adjust path/name if your file is different

function normalize(value) {
  return String(value || "").trim();
}

function isUnassigned(value) {
  const v = normalize(value).toLowerCase();
  return v === "" || v === "unassigned";
}

/* ---------------------------------------
   GET LOGGED-IN TEACHER SCOPE
--------------------------------------- */
exports.getTeacherScope = async (req, res) => {
  try {
    const userId =
      req.session?.user?.id ||
      req.session?.user?._id ||
      req.session?.userId;

    if (!userId) {
      return res.status(401).json({
        ok: false,
        message: "Unauthorized",
      });
    }

    const teacher = await Teacher.findOne({
      userId,
      isActive: true,
    }).lean();

    if (!teacher) {
      return res.status(404).json({
        ok: false,
        message: "Teacher record not found.",
      });
    }

    const className = normalize(
      teacher.handledClass ||
      teacher.className ||
      teacher.gradeLevel ||
      teacher.grade ||
      teacher.advisoryClass
    );

    const sectionName = normalize(
      teacher.handledSection ||
      teacher.sectionName ||
      teacher.section ||
      teacher.advisorySection
    );

    return res.json({
      ok: true,
      data: {
        className,
        sectionName,
        teacherId: String(teacher._id || ""),
      },
    });
  } catch (err) {
    console.error("getTeacherScope error:", err);
    return res.status(500).json({
      ok: false,
      message: "Server error",
    });
  }
};

/* ---------------------------------------
   GET STUDENTS IN TEACHER'S CLASS
--------------------------------------- */
exports.getStudentsByClass = async (req, res) => {
  try {
    const className = normalize(req.query.className);
    const sectionName = normalize(req.query.sectionName);

    if (!className || !sectionName) {
      return res.status(400).json({
        ok: false,
        message: "className and sectionName are required.",
      });
    }

    const students = await Student.find({
      isActive: true,
      className,
      sectionName,
    })
      .sort({ lastName: 1, firstName: 1 })
      .lean();

    return res.json({
      ok: true,
      data: students,
    });
  } catch (err) {
    console.error("getStudentsByClass error:", err);
    return res.status(500).json({
      ok: false,
      message: "Server error",
    });
  }
};

/* ---------------------------------------
   GET ONLY UNASSIGNED STUDENTS
--------------------------------------- */
exports.getUnassignedStudents = async (_req, res) => {
  try {
    const students = await Student.find({
      isActive: true,
      $and: [
        {
          $or: [
            { className: { $exists: false } },
            { className: "" },
            { className: "Unassigned" },
          ],
        },
        {
          $or: [
            { sectionName: { $exists: false } },
            { sectionName: "" },
            { sectionName: "Unassigned" },
          ],
        },
      ],
    })
      .sort({ lastName: 1, firstName: 1 })
      .lean();

    return res.json({
      ok: true,
      data: students,
    });
  } catch (err) {
    console.error("getUnassignedStudents error:", err);
    return res.status(500).json({
      ok: false,
      message: "Server error",
    });
  }
};

/* ---------------------------------------
   POST ENROLL STUDENTS
--------------------------------------- */
exports.enrollStudents = async (req, res) => {
  try {
    const { studentIds, className, sectionName } = req.body;

    if (!Array.isArray(studentIds) || !studentIds.length) {
      return res.status(400).json({
        ok: false,
        message: "Please select at least one student.",
      });
    }

    const normalizedClass = normalize(className);
    const normalizedSection = normalize(sectionName);

    if (!normalizedClass || !normalizedSection) {
      return res.status(400).json({
        ok: false,
        message: "className and sectionName are required.",
      });
    }

    const selected = await Student.find({
      _id: { $in: studentIds },
      isActive: true,
    });

    const blocked = selected.filter(
      (s) => !isUnassigned(s.className) || !isUnassigned(s.sectionName)
    );

    if (blocked.length) {
      return res.status(400).json({
        ok: false,
        message: "Some students are already assigned to a class.",
        blocked: blocked.map((s) => ({
          _id: s._id,
          studentId: s.studentId,
          fullName: [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" "),
          className: s.className,
          sectionName: s.sectionName,
        })),
      });
    }

    await Student.updateMany(
      {
        _id: { $in: studentIds },
        isActive: true,
      },
      {
        $set: {
          className: normalizedClass,
          sectionName: normalizedSection,
        },
      }
    );

    return res.json({
      ok: true,
      message: "Students enrolled successfully.",
    });
  } catch (err) {
    console.error("enrollStudents error:", err);
    return res.status(500).json({
      ok: false,
      message: "Server error",
    });
  }
};

/* ---------------------------------------
   PATCH UNENROLL STUDENT
--------------------------------------- */
exports.unenrollStudent = async (req, res) => {
  try {
    const { id } = req.params;

    const student = await Student.findOne({
      _id: id,
      isActive: true,
    });

    if (!student) {
      return res.status(404).json({
        ok: false,
        message: "Student not found.",
      });
    }

    student.className = "Unassigned";
    student.sectionName = "Unassigned";
    await student.save();

    return res.json({
      ok: true,
      message: "Student unenrolled successfully.",
    });
  } catch (err) {
    console.error("unenrollStudent error:", err);
    return res.status(500).json({
      ok: false,
      message: "Server error",
    });
  }
};