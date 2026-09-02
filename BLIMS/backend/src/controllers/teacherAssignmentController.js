const Assignment = require("../models/Assignment.model");
const Teacher = require("../models/Teacher.model");
const GradeLevel = require("../models/GradeLevel.model");

function normalize(value) {
  return String(value || "").trim();
}

/* ---------------------------------------
   GET TEACHER FROM SESSION
--------------------------------------- */
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

/* ---------------------------------------
   GET TEACHER SCOPE
--------------------------------------- */
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
   CHECK SUBJECT
--------------------------------------- */
async function teacherHasSubject(className, subject) {
  const gradeLevel = await GradeLevel.findOne({
    grade: className,
    isActive: true,
  }).lean();

  const subjects = Array.isArray(gradeLevel?.subjects)
    ? gradeLevel.subjects
    : [];

  return subjects.some(
    (item) => normalize(item).toLowerCase() === normalize(subject).toLowerCase()
  );
}

/* ---------------------------------------
   GET ASSIGNMENTS
   GET /api/teacher/assignments
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

    const filter = {
      teacherId: teacher._id,
      className: scope.className,
      sectionName: scope.sectionName,
    };

    // Optional filters
    if (req.query.subject) {
      filter.subject = normalize(req.query.subject);
    }

    if (
      req.query.status &&
      ["draft", "published", "archived"].includes(req.query.status)
    ) {
      filter.status = req.query.status;
    }

    if (
      req.query.quarter &&
      ["Q1", "Q2", "Q3", "Q4"].includes(req.query.quarter)
    ) {
      filter.quarter = req.query.quarter;
    }

    const assignments = await Assignment.find(filter)
      .sort({
        dueDate: 1,
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
   POST /api/teacher/assignments
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

    const {
      title,
      subject,
      quarter,
      points,
      dueDate,
      dueTime,
      instructions,
      status,
    } = req.body;

    // -------------------------------
    // Validate required fields
    // -------------------------------

    if (!normalize(title)) {
      return res.status(400).json({
        ok: false,
        message: "Assignment title is required.",
      });
    }

    if (!normalize(subject)) {
      return res.status(400).json({
        ok: false,
        message: "Subject is required.",
      });
    }

    if (!["Q1", "Q2", "Q3", "Q4"].includes(quarter)) {
      return res.status(400).json({
        ok: false,
        message: "Invalid quarter.",
      });
    }

    const numericPoints = Number(points);

    if (
      !Number.isFinite(numericPoints) ||
      numericPoints < 1 ||
      numericPoints > 1000
    ) {
      return res.status(400).json({
        ok: false,
        message: "Points must be between 1 and 1000.",
      });
    }

    if (!normalize(dueDate)) {
      return res.status(400).json({
        ok: false,
        message: "Due date is required.",
      });
    }

    const parsedDueDate = new Date(`${dueDate}T00:00:00`);

    if (Number.isNaN(parsedDueDate.getTime())) {
      return res.status(400).json({
        ok: false,
        message: "Invalid due date.",
      });
    }

    // -------------------------------
    // Verify subject belongs to class
    // -------------------------------

    const validSubject = await teacherHasSubject(
      scope.className,
      subject
    );

    if (!validSubject) {
      return res.status(400).json({
        ok: false,
        message: "This subject is not assigned to your class.",
      });
    }

    // -------------------------------
    // Status
    // -------------------------------

    const assignmentStatus =
      ["draft", "published"].includes(status)
        ? status
        : "draft";

    // -------------------------------
    // Create assignment
    // -------------------------------

    const assignment = await Assignment.create({
      title: normalize(title),

      teacherId: teacher._id,

      subject: normalize(subject),

      className: scope.className,

      sectionName: scope.sectionName,

      quarter,

      points: numericPoints,

      dueDate: parsedDueDate,

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
   PUT /api/teacher/assignments/:id
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

    const {
      title,
      subject,
      quarter,
      points,
      dueDate,
      dueTime,
      instructions,
      status,
    } = req.body;

    if (title !== undefined) {
      if (!normalize(title)) {
        return res.status(400).json({
          ok: false,
          message: "Assignment title is required.",
        });
      }

      assignment.title = normalize(title);
    }

    if (subject !== undefined) {
      const validSubject = await teacherHasSubject(
        assignment.className,
        subject
      );

      if (!validSubject) {
        return res.status(400).json({
          ok: false,
          message: "This subject is not assigned to your class.",
        });
      }

      assignment.subject = normalize(subject);
    }

    if (quarter !== undefined) {
      if (!["Q1", "Q2", "Q3", "Q4"].includes(quarter)) {
        return res.status(400).json({
          ok: false,
          message: "Invalid quarter.",
        });
      }

      assignment.quarter = quarter;
    }

    if (points !== undefined) {
      const numericPoints = Number(points);

      if (
        !Number.isFinite(numericPoints) ||
        numericPoints < 1 ||
        numericPoints > 1000
      ) {
        return res.status(400).json({
          ok: false,
          message: "Points must be between 1 and 1000.",
        });
      }

      assignment.points = numericPoints;
    }

    if (dueDate !== undefined) {
      const parsedDueDate = new Date(`${dueDate}T00:00:00`);

      if (Number.isNaN(parsedDueDate.getTime())) {
        return res.status(400).json({
          ok: false,
          message: "Invalid due date.",
        });
      }

      assignment.dueDate = parsedDueDate;
    }

    if (dueTime !== undefined) {
      assignment.dueTime = normalize(dueTime);
    }

    if (instructions !== undefined) {
      assignment.instructions = normalize(instructions);
    }

    if (status !== undefined) {
      if (!["draft", "published", "archived"].includes(status)) {
        return res.status(400).json({
          ok: false,
          message: "Invalid assignment status.",
        });
      }

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
   ARCHIVE ASSIGNMENT
   DELETE /api/teacher/assignments/:id
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

    assignment.status = "archived";

    await assignment.save();

    return res.json({
      ok: true,
      message: "Assignment archived successfully.",
      data: assignment,
    });
  } catch (err) {
    console.error("deleteAssignment error:", err);

    return res.status(500).json({
      ok: false,
      message: "Failed to archive assignment.",
    });
  }
};

/* ---------------------------------------
   TEST
--------------------------------------- */
exports.test = async (req, res) => {
  return res.json({
    ok: true,
    message: "Teacher assignment controller working.",
  });
};