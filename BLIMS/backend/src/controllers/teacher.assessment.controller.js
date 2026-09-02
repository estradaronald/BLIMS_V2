const Student = require("../models/Student.model");
const Teacher = require("../models/Teacher.model");
const GradeLevel = require("../models/GradeLevel.model");
const SchoolYear = require("../models/SchoolYear.model");
const Assignment = require("../models/Assignment.model");

function normalize(value) {
  return String(value || "").trim();
}

async function getTeacherBySession(req) {
  const userId =
    req.session?.user?.id ||
    req.session?.user?._id ||
    req.session?.userId;

  if (!userId) return null;

  const teacher = await Teacher.findOne({
    userId,
    isActive: true,
  }).lean();

  return teacher || null;
}

function getTeacherScopeFromDoc(teacher) {
  return {
    className: normalize(
      teacher?.handledClass ||
        teacher?.className ||
        teacher?.gradeLevel ||
        teacher?.grade ||
        teacher?.advisoryClass
    ),

    sectionName: normalize(
      teacher?.handledSection ||
        teacher?.sectionName ||
        teacher?.section ||
        teacher?.advisorySection
    ),
  };
}

/* ---------------------------------------
   GET ASSESSMENT META
--------------------------------------- */

exports.getAssessmentMeta = async (req, res) => {
  try {
    const teacher = await getTeacherBySession(req);

    if (!teacher) {
      return res.status(404).json({
        ok: false,
        message: "Teacher record not found.",
      });
    }

    const scope = getTeacherScopeFromDoc(teacher);

    if (!scope.className || !scope.sectionName) {
      return res.status(400).json({
        ok: false,
        message: "Teacher class/section assignment not found.",
      });
    }

    const gradeLevel = await GradeLevel.findOne({
      grade: scope.className,
      isActive: true,
    }).lean();

    const subjects = gradeLevel?.subjects || [];

    const activeSY = await SchoolYear.findOne({
      isActive: true,
    }).lean();

    return res.json({
      ok: true,

      data: {
        teacher: {
          id: String(teacher._id),
          userId: String(teacher.userId || ""),

          name: normalize(
            teacher.name ||
              teacher.fullName ||
              `${teacher.firstName || ""} ${teacher.lastName || ""}`
          ),
        },

        scope,

        schoolYear: activeSY
          ? {
              id: String(activeSY._id),
              name: normalize(activeSY.name),
            }
          : null,

        subjects: subjects.map((subject) => ({
          value: subject,
          label: subject,
        })),
      },
    });
  } catch (err) {
    console.error("getAssessmentMeta error:", err);

    return res.status(500).json({
      ok: false,
      message: "Failed to load assessment metadata.",
    });
  }
};


/* ---------------------------------------
   GET STUDENTS FOR ASSESSMENT
--------------------------------------- */

exports.getAssessmentStudents = async (req, res) => {
  try {
    const teacher = await getTeacherBySession(req);

    if (!teacher) {
      return res.status(404).json({
        ok: false,
        message: "Teacher record not found.",
      });
    }

    const scope = getTeacherScopeFromDoc(teacher);

    if (!scope.className || !scope.sectionName) {
      return res.status(400).json({
        ok: false,
        message: "Teacher class/section assignment not found.",
      });
    }

    const students = await Student.find({
      isActive: true,
      className: scope.className,
      sectionName: scope.sectionName,
    })
      .sort({
        lastName: 1,
        firstName: 1,
      })
      .lean();

    return res.json({
      ok: true,
      data: students,
    });
  } catch (err) {
    console.error("getAssessmentStudents error:", err);

    return res.status(500).json({
      ok: false,
      message: "Failed to load students for assessment.",
    });
  }
};


/* ---------------------------------------
   GET ASSIGNMENTS
--------------------------------------- */

exports.getAssignments = async (req, res) => {
  try {
    const teacher = await getTeacherBySession(req);

    if (!teacher) {
      return res.status(404).json({
        ok: false,
        message: "Teacher record not found.",
      });
    }

    const scope = getTeacherScopeFromDoc(teacher);

    if (!scope.className || !scope.sectionName) {
      return res.status(400).json({
        ok: false,
        message: "Teacher class/section assignment not found.",
      });
    }

    const activeSY = await SchoolYear.findOne({
      isActive: true,
    }).lean();

    if (!activeSY) {
      return res.status(400).json({
        ok: false,
        message: "No active school year found.",
      });
    }

    const filter = {
      teacherId: teacher._id,
      className: scope.className,
      sectionName: scope.sectionName,
      schoolYearId: activeSY._id,
    };

    // Optional subject filter
    if (req.query.subject) {
      filter.subject = normalize(req.query.subject);
    }

    // Optional status filter
    if (
      req.query.status &&
      ["draft", "published", "archived"].includes(
        req.query.status
      )
    ) {
      filter.status = req.query.status;
    }

    // Optional quarter filter
    if (
      req.query.quarter &&
      ["Q1", "Q2", "Q3", "Q4"].includes(
        req.query.quarter
      )
    ) {
      filter.quarter = req.query.quarter;
    }

    const assignments = await Assignment.find(filter)
      .sort({
        dueDate: 1,
        dueTime: 1,
        createdAt: -1,
      })
      .lean();

    return res.json({
      ok: true,
      data: assignments,
    });
  } catch (err) {
    console.error("getAssignments error:", err);

    return res.status(500).json({
      ok: false,
      message: "Failed to load assignments.",
    });
  }
};


/* ---------------------------------------
   CREATE ASSIGNMENT
--------------------------------------- */

exports.createAssignment = async (req, res) => {
  try {
    const teacher = await getTeacherBySession(req);

    if (!teacher) {
      return res.status(404).json({
        ok: false,
        message: "Teacher record not found.",
      });
    }

    const scope = getTeacherScopeFromDoc(teacher);

    if (!scope.className || !scope.sectionName) {
      return res.status(400).json({
        ok: false,
        message: "Teacher class/section assignment not found.",
      });
    }

    const activeSY = await SchoolYear.findOne({
      isActive: true,
    }).lean();

    if (!activeSY) {
      return res.status(400).json({
        ok: false,
        message: "No active school year found.",
      });
    }

    const {
      subject,
      title,
      quarter,
      totalPoints,
      dueDate,
      dueTime,
      instructions,
      status,
    } = req.body;

    const cleanSubject = normalize(subject);
    const cleanTitle = normalize(title);
    const cleanDueDate = normalize(dueDate);

    if (!cleanSubject) {
      return res.status(400).json({
        ok: false,
        message: "Subject is required.",
      });
    }

    if (!cleanTitle) {
      return res.status(400).json({
        ok: false,
        message: "Assignment title is required.",
      });
    }

    if (!["Q1", "Q2", "Q3", "Q4"].includes(quarter)) {
      return res.status(400).json({
        ok: false,
        message: "Invalid quarter.",
      });
    }

    const points = Number(totalPoints);

    if (!Number.isFinite(points) || points < 1) {
      return res.status(400).json({
        ok: false,
        message: "Total points must be at least 1.",
      });
    }

    if (!cleanDueDate) {
      return res.status(400).json({
        ok: false,
        message: "Due date is required.",
      });
    }

    const assignmentStatus =
      status === "published"
        ? "published"
        : "draft";

    const assignment = await Assignment.create({
      teacherId: teacher._id,

      subject: cleanSubject,

      className: scope.className,

      sectionName: scope.sectionName,

      schoolYearId: activeSY._id,

      schoolYearName: normalize(activeSY.name),

      title: cleanTitle,

      quarter,

      totalPoints: points,

      dueDate: cleanDueDate,

      dueTime: normalize(dueTime),

      instructions: normalize(instructions),

      status: assignmentStatus,
    });

    return res.status(201).json({
      ok: true,
      message:
        assignmentStatus === "published"
          ? "Assignment published successfully."
          : "Assignment saved as draft.",

      data: assignment,
    });
  } catch (err) {
    console.error("createAssignment error:", err);

    return res.status(500).json({
      ok: false,
      message: "Failed to create assignment.",
    });
  }
};


/* ---------------------------------------
   UPDATE ASSIGNMENT
--------------------------------------- */

exports.updateAssignment = async (req, res) => {
  try {
    const teacher = await getTeacherBySession(req);

    if (!teacher) {
      return res.status(404).json({
        ok: false,
        message: "Teacher record not found.",
      });
    }

    const scope = getTeacherScopeFromDoc(teacher);

    if (!scope.className || !scope.sectionName) {
      return res.status(400).json({
        ok: false,
        message: "Teacher class/section assignment not found.",
      });
    }

    const assignment = await Assignment.findOne({
      _id: req.params.id,
      teacherId: teacher._id,
      className: scope.className,
      sectionName: scope.sectionName,
    });

    if (!assignment) {
      return res.status(404).json({
        ok: false,
        message: "Assignment not found.",
      });
    }

    const {
      subject,
      title,
      quarter,
      totalPoints,
      dueDate,
      dueTime,
      instructions,
      status,
    } = req.body;

    if (subject !== undefined) {
      assignment.subject = normalize(subject);
    }

    if (title !== undefined) {
      assignment.title = normalize(title);
    }

    if (
      quarter !== undefined &&
      ["Q1", "Q2", "Q3", "Q4"].includes(quarter)
    ) {
      assignment.quarter = quarter;
    }

    if (totalPoints !== undefined) {
      const points = Number(totalPoints);

      if (!Number.isFinite(points) || points < 1) {
        return res.status(400).json({
          ok: false,
          message: "Total points must be at least 1.",
        });
      }

      assignment.totalPoints = points;
    }

    if (dueDate !== undefined) {
      assignment.dueDate = normalize(dueDate);
    }

    if (dueTime !== undefined) {
      assignment.dueTime = normalize(dueTime);
    }

    if (instructions !== undefined) {
      assignment.instructions = normalize(instructions);
    }

    if (
      status !== undefined &&
      ["draft", "published", "archived"].includes(status)
    ) {
      assignment.status = status;
    }

    await assignment.save();

    return res.json({
      ok: true,
      message: "Assignment updated successfully.",
      data: assignment,
    });
  } catch (err) {
    console.error("updateAssignment error:", err);

    return res.status(500).json({
      ok: false,
      message: "Failed to update assignment.",
    });
  }
};


/* ---------------------------------------
   DELETE ASSIGNMENT
--------------------------------------- */

exports.deleteAssignment = async (req, res) => {
  try {
    const teacher = await getTeacherBySession(req);

    if (!teacher) {
      return res.status(404).json({
        ok: false,
        message: "Teacher record not found.",
      });
    }

    const assignment = await Assignment.findOne({
      _id: req.params.id,
      teacherId: teacher._id,
    });

    if (!assignment) {
      return res.status(404).json({
        ok: false,
        message: "Assignment not found.",
      });
    }

    await Assignment.deleteOne({
      _id: assignment._id,
    });

    return res.json({
      ok: true,
      message: "Assignment deleted successfully.",
    });
  } catch (err) {
    console.error("deleteAssignment error:", err);

    return res.status(500).json({
      ok: false,
      message: "Failed to delete assignment.",
    });
  }
};


/* ---------------------------------------
   TEST
--------------------------------------- */

exports.test = async (req, res) => {
  return res.json({
    ok: true,
    message: "Teacher assessment controller working.",
  });
};