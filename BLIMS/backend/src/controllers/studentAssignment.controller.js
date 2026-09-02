const Assignment = require("../models/Assignment.model");
const Student = require("../models/Student.model");
const GradeLevel = require("../models/GradeLevel.model");
const StudentAssignmentProgress = require(
  "../models/StudentAssignmentProgress.model"
);

function normalize(value) {
  return String(value ?? "").trim();
}

/* ---------------------------------------
   VALID PROGRESS STATUSES
--------------------------------------- */

const VALID_PROGRESS_STATUSES = [
  "not_started",
  "in_progress",
  "done",
];

/* ---------------------------------------
   GET STUDENT FROM SESSION
--------------------------------------- */

async function getStudentBySession(req) {
  const userId =
    req.session?.user?.id ||
    req.session?.user?._id ||
    req.session?.userId ||
    req.user?.id ||
    req.user?._id;

  if (!userId) return null;

  const student = await Student.findOne({
    userId,
    isActive: true,
  }).lean();

  return student || null;
}

/* ---------------------------------------
   GET STUDENT ASSIGNMENTS
   GET /api/student/assignments
--------------------------------------- */

exports.getAssignments = async (req, res) => {
  try {
    /* ---------------------------------------
       GET STUDENT
    --------------------------------------- */

    const student =
      await getStudentBySession(req);

    if (!student) {
      return res.status(404).json({
        ok: false,
        message: "Student record not found.",
      });
    }

    /* ---------------------------------------
       STUDENT CLASS / SECTION
    --------------------------------------- */

    const className =
      normalize(student.className);

    const sectionName =
      normalize(student.sectionName);

    if (!className || !sectionName) {
      return res.status(400).json({
        ok: false,
        message:
          "Student class/section assignment not found.",
      });
    }

    /* ---------------------------------------
       GET GRADE LEVEL
       
       Example:
       
       Student:
       className = "Kindergarten"

       GradeLevel:
       grade = "Kindergarten"
       subjects = [...]
    --------------------------------------- */

    const gradeLevel =
      await GradeLevel.findOne({
        grade: className,
        isActive: true,
      }).lean();

    /* ---------------------------------------
       GET SUBJECTS FOR STUDENT GRADE
    --------------------------------------- */

    const subjects =
      Array.isArray(
        gradeLevel?.subjects
      )
        ? gradeLevel.subjects
            .map((subject) =>
              normalize(subject)
            )
            .filter(Boolean)
        : [];

    /* ---------------------------------------
       ASSIGNMENT FILTER
    --------------------------------------- */

    const filter = {
      className,
      sectionName,
      status: "published",
    };

    /* ---------------------------------------
       OPTIONAL SUBJECT FILTER
    --------------------------------------- */

    if (req.query.subject) {
      filter.subject =
        normalize(
          req.query.subject
        );
    }

    /* ---------------------------------------
       OPTIONAL QUARTER FILTER
    --------------------------------------- */

    if (
      req.query.quarter &&
      ["Q1", "Q2", "Q3", "Q4"].includes(
        req.query.quarter
      )
    ) {
      filter.quarter =
        req.query.quarter;
    }

    /* ---------------------------------------
       GET ASSIGNMENTS
    --------------------------------------- */

    const assignments =
      await Assignment.find(filter)
        .sort({
          dueDate: 1,
          createdAt: -1,
        })
        .lean();

    /* ---------------------------------------
       GET STUDENT PROGRESS
    --------------------------------------- */

    const assignmentIds =
      assignments.map(
        (assignment) =>
          assignment._id
      );

    const progress =
      assignmentIds.length
        ? await StudentAssignmentProgress.find(
            {
              studentId:
                student._id,

              assignmentId: {
                $in: assignmentIds,
              },
            }
          ).lean()
        : [];

    /* ---------------------------------------
       CREATE QUICK LOOKUP
    --------------------------------------- */

    const progressMap =
      new Map();

    progress.forEach((item) => {
      progressMap.set(
        String(
          item.assignmentId
        ),
        item
      );
    });

    /* ---------------------------------------
       ATTACH PROGRESS
    --------------------------------------- */

    const assignmentsWithProgress =
      assignments.map(
        (assignment) => {
          const item =
            progressMap.get(
              String(
                assignment._id
              )
            );

          return {
            ...assignment,

            progressStatus:
              item?.status ||
              "not_started",

            startedAt:
              item?.startedAt ||
              null,

            completedAt:
              item?.completedAt ||
              null,
          };
        }
      );

    /* ---------------------------------------
       RESPONSE
    --------------------------------------- */

    return res.json({
      ok: true,

      data:
        assignmentsWithProgress,

      /* -------------------------------------
         STUDENT SCOPE
      ------------------------------------- */

      studentScope: {
        className,
        sectionName,
      },

      /* -------------------------------------
         SUBJECTS FOR THIS GRADE
      ------------------------------------- */

      subjects,
    });
  } catch (err) {
    console.error(
      "getStudentAssignments error:",
      err
    );

    return res.status(500).json({
      ok: false,
      message:
        "Failed to load assignments.",
    });
  }
};

/* ---------------------------------------
   GET ONE STUDENT ASSIGNMENT
   GET /api/student/assignments/:id
--------------------------------------- */

exports.getAssignmentById = async (
  req,
  res
) => {
  try {
    const student =
      await getStudentBySession(req);

    if (!student) {
      return res.status(404).json({
        ok: false,
        message:
          "Student record not found.",
      });
    }

    const className =
      normalize(student.className);

    const sectionName =
      normalize(student.sectionName);

    if (!className || !sectionName) {
      return res.status(400).json({
        ok: false,
        message:
          "Student class/section assignment not found.",
      });
    }

    /* ---------------------------------------
       GET ASSIGNMENT
    --------------------------------------- */

    const assignment =
      await Assignment.findOne({
        _id: req.params.id,
        className,
        sectionName,
        status: "published",
      }).lean();

    if (!assignment) {
      return res.status(404).json({
        ok: false,
        message:
          "Assignment not found.",
      });
    }

    /* ---------------------------------------
       GET STUDENT PROGRESS
    --------------------------------------- */

    const progress =
      await StudentAssignmentProgress.findOne(
        {
          studentId:
            student._id,

          assignmentId:
            assignment._id,
        }
      ).lean();

    return res.json({
      ok: true,

      data: {
        ...assignment,

        progressStatus:
          progress?.status ||
          "not_started",

        startedAt:
          progress?.startedAt ||
          null,

        completedAt:
          progress?.completedAt ||
          null,
      },
    });
  } catch (err) {
    console.error(
      "getStudentAssignmentById error:",
      err
    );

    return res.status(500).json({
      ok: false,
      message:
        "Failed to load assignment.",
    });
  }
};

/* ---------------------------------------
   UPDATE ASSIGNMENT PROGRESS

   PATCH
   /api/student/assignments/:id/progress

   Body:

   {
     "status": "not_started"
   }

   OR

   {
     "status": "in_progress"
   }

   OR

   {
     "status": "done"
   }
--------------------------------------- */

exports.updateAssignmentProgress =
  async (req, res) => {
    try {
      const student =
        await getStudentBySession(
          req
        );

      if (!student) {
        return res.status(404).json({
          ok: false,
          message:
            "Student record not found.",
        });
      }

      const className =
        normalize(
          student.className
        );

      const sectionName =
        normalize(
          student.sectionName
        );

      if (
        !className ||
        !sectionName
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "Student class/section assignment not found.",
        });
      }

      /* -------------------------------------
         VALIDATE STATUS
      ------------------------------------- */

      const requestedStatus =
        normalize(
          req.body?.status
        ).toLowerCase();

      if (
        !VALID_PROGRESS_STATUSES.includes(
          requestedStatus
        )
      ) {
        return res.status(400).json({
          ok: false,
          message:
            "Invalid assignment progress status.",
          allowedStatuses:
            VALID_PROGRESS_STATUSES,
        });
      }

      /* -------------------------------------
         VERIFY ASSIGNMENT
      ------------------------------------- */

      const assignment =
        await Assignment.findOne({
          _id: req.params.id,
          className,
          sectionName,
          status: "published",
        }).lean();

      if (!assignment) {
        return res.status(404).json({
          ok: false,
          message:
            "Assignment not found.",
        });
      }

      /* -------------------------------------
         GET EXISTING PROGRESS
      ------------------------------------- */

      const existingProgress =
        await StudentAssignmentProgress.findOne(
          {
            studentId:
              student._id,

            assignmentId:
              assignment._id,
          }
        ).lean();

      /* -------------------------------------
         BUILD UPDATE
      ------------------------------------- */

      const update = {
        $set: {
          status:
            requestedStatus,
        },
      };

      /* -------------------------------------
         NOT STARTED
      ------------------------------------- */

      if (
        requestedStatus ===
        "not_started"
      ) {
        update.$set.startedAt =
          null;

        update.$set.completedAt =
          null;
      }

      /* -------------------------------------
         IN PROGRESS
      ------------------------------------- */

      if (
        requestedStatus ===
        "in_progress"
      ) {
        update.$set.completedAt =
          null;

        if (
          !existingProgress?.startedAt
        ) {
          update.$set.startedAt =
            new Date();
        }
      }

      /* -------------------------------------
         DONE
      ------------------------------------- */

      if (
        requestedStatus ===
        "done"
      ) {
        if (
          !existingProgress?.startedAt
        ) {
          update.$set.startedAt =
            new Date();
        }

        update.$set.completedAt =
          new Date();
      }

      /* -------------------------------------
         CREATE / UPDATE PROGRESS
      ------------------------------------- */

      const progress =
        await StudentAssignmentProgress.findOneAndUpdate(
          {
            studentId:
              student._id,

            assignmentId:
              assignment._id,
          },

          update,

          {
            new: true,
            upsert: true,
            setDefaultsOnInsert:
              true,
          }
        ).lean();

      /* -------------------------------------
         RESPONSE MESSAGE
      ------------------------------------- */

      let message =
        "Assignment progress updated.";

      if (
        requestedStatus ===
        "not_started"
      ) {
        message =
          "Assignment marked as not started.";
      }

      if (
        requestedStatus ===
        "in_progress"
      ) {
        message =
          "Assignment marked as in progress.";
      }

      if (
        requestedStatus ===
        "done"
      ) {
        message =
          "Assignment marked as done.";
      }

      return res.json({
        ok: true,

        message,

        data: {
          assignmentId:
            assignment._id,

          progressStatus:
            progress.status,

          startedAt:
            progress.startedAt,

          completedAt:
            progress.completedAt,
        },
      });
    } catch (err) {
      console.error(
        "updateAssignmentProgress error:",
        err
      );

      return res.status(500).json({
        ok: false,
        message:
          "Failed to update assignment progress.",
      });
    }
  };

/* ---------------------------------------
   TEST
--------------------------------------- */

exports.test = async (
  req,
  res
) => {
  return res.json({
    ok: true,
    message:
      "Student assignment controller working.",
  });
};