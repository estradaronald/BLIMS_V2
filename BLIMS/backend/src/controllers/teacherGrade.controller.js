const Grade = require("../models/Grade.model");
const Student = require("../models/Student.model");
const Teacher = require("../models/Teacher.model");
const SchoolYear = require("../models/SchoolYear.model");
const GradeLevel = require("../models/GradeLevel.model");

function normalize(value) {
  return String(value ?? "").trim();
}

/* ---------------------------------------
   QUARTER NORMALIZER

   Frontend:
   Q1 / 1
   Q2 / 2
   Q3 / 3
   Q4 / 4

   Database:
   1st
   2nd
   3rd
   4th
--------------------------------------- */
function normalizeQuarter(value) {
  const quarter = normalize(value).toUpperCase();

  const map = {
    Q1: "1st",
    Q2: "2nd",
    Q3: "3rd",
    Q4: "4th",

    "1": "1st",
    "2": "2nd",
    "3": "3rd",
    "4": "4th",

    "1ST": "1st",
    "2ND": "2nd",
    "3RD": "3rd",
    "4TH": "4th",
  };

  return map[quarter] || null;
}

/* ---------------------------------------
   GET LOGGED-IN TEACHER
--------------------------------------- */
async function getTeacherBySession(req) {
  const userId =
    req.session?.user?.id ||
    req.session?.user?._id ||
    req.session?.userId;

  if (!userId) {
    return null;
  }

  const teacher = await Teacher.findOne({
    userId,
    isActive: true,
  }).lean();

  return teacher || null;
}

/* ---------------------------------------
   GET ACTIVE SCHOOL YEAR
--------------------------------------- */
async function getActiveSchoolYear() {
  return await SchoolYear.findOne({
    isActive: true,
  }).lean();
}

/* ---------------------------------------
   GET TEACHER CLASS / SECTION
--------------------------------------- */
function getTeacherScope(teacher) {
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
   GET GRADE LEVEL SUBJECTS
--------------------------------------- */
async function getSubjectsForGrade(className) {
  const gradeLevelDoc = await GradeLevel.findOne({
    grade: className,
  }).lean();

  return Array.isArray(gradeLevelDoc?.subjects)
    ? gradeLevelDoc.subjects
    : [];
}

/* ---------------------------------------
   GET GRADE ENCODING DATA

   Returns:
   - teacher scope
   - school year
   - students
   - subjects
--------------------------------------- */
exports.getGradeEncodingData = async (req, res) => {
  try {
    const teacher = await getTeacherBySession(req);

    if (!teacher) {
      return res.status(404).json({
        ok: false,
        message: "Teacher record not found.",
      });
    }

    const scope = getTeacherScope(teacher);

    if (!scope.className || !scope.sectionName) {
      return res.status(400).json({
        ok: false,
        message: "Teacher class/section assignment not found.",
      });
    }

    const schoolYear = await getActiveSchoolYear();

    if (!schoolYear) {
      return res.status(404).json({
        ok: false,
        message: "No active school year found.",
      });
    }

    /* ---------------------------------------
       GET STUDENTS
    --------------------------------------- */
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

    /* ---------------------------------------
       GET SUBJECTS
    --------------------------------------- */
    const subjects = await getSubjectsForGrade(
      scope.className
    );

    return res.json({
      ok: true,

      data: {
        teacherScope: scope,

        schoolYear: {
          id: String(schoolYear._id),
          name: normalize(schoolYear.name),
        },

        students,

        subjects,
      },
    });
  } catch (err) {
    console.error(
      "getGradeEncodingData error:",
      err
    );

    return res.status(500).json({
      ok: false,
      message: "Server error",
    });
  }
};

/* ---------------------------------------
   SAVE / UPDATE GRADE
--------------------------------------- */
exports.saveGrade = async (req, res) => {
  try {
    const teacher = await getTeacherBySession(req);

    if (!teacher) {
      return res.status(404).json({
        ok: false,
        message: "Teacher record not found.",
      });
    }

    const scope = getTeacherScope(teacher);

    if (!scope.className || !scope.sectionName) {
      return res.status(400).json({
        ok: false,
        message: "Teacher class/section assignment not found.",
      });
    }

    const schoolYear = await getActiveSchoolYear();

    if (!schoolYear) {
      return res.status(404).json({
        ok: false,
        message: "No active school year found.",
      });
    }

    const studentId = normalize(
      req.body.studentId
    );

    const subject = normalize(
      req.body.subject
    );

    const gradingPeriod =
      normalizeQuarter(
        req.body.quarter ||
        req.body.gradingPeriod
      );

    /* ---------------------------------------
       VALIDATION
    --------------------------------------- */

    if (!studentId) {
      return res.status(400).json({
        ok: false,
        message: "studentId is required.",
      });
    }

    if (!subject) {
      return res.status(400).json({
        ok: false,
        message: "subject is required.",
      });
    }

    if (!gradingPeriod) {
      return res.status(400).json({
        ok: false,
        message:
          "quarter must be Q1, Q2, Q3, Q4 or 1, 2, 3, 4.",
      });
    }

    /* ---------------------------------------
       VERIFY STUDENT
    --------------------------------------- */
    const student = await Student.findOne({
      studentId,
      isActive: true,
      className: scope.className,
      sectionName: scope.sectionName,
    }).lean();

    if (!student) {
      return res.status(400).json({
        ok: false,
        message:
          "Student does not belong to this class.",
      });
    }

    /* ---------------------------------------
       VERIFY SUBJECT
    --------------------------------------- */
    const subjects =
      await getSubjectsForGrade(
        scope.className
      );

    if (!subjects.includes(subject)) {
      return res.status(400).json({
        ok: false,
        message:
          "Subject is not available for this grade level.",
      });
    }

    /* ---------------------------------------
       PREPARE DATA
    --------------------------------------- */

    const writtenWorks =
      Array.isArray(
        req.body.writtenWorks
      )
        ? req.body.writtenWorks
        : [];

    const performanceTasks =
      Array.isArray(
        req.body.performanceTasks
      )
        ? req.body.performanceTasks
        : [];

    const quarterlyAssessment =
      req.body.quarterlyAssessment &&
      typeof req.body.quarterlyAssessment ===
        "object"
        ? {
            score:
              req.body.quarterlyAssessment.score ??
              null,

            total:
              req.body.quarterlyAssessment.total ??
              null,
          }
        : {
            score: null,
            total: null,
          };

    /* ---------------------------------------
       SAVE GRADE
    --------------------------------------- */

    const saved =
      await Grade.findOneAndUpdate(
        {
          studentId,

          subject,

          gradingPeriod,

          schoolYearId:
            schoolYear._id,
        },

        {
          $set: {
            studentId,

            gradeLevel:
              scope.className,

            sectionName:
              scope.sectionName,

            subject,

            schoolYearId:
              schoolYear._id,

            schoolYearName:
              normalize(
                schoolYear.name
              ),

            gradingPeriod,

            writtenWorks,

            performanceTasks,

            quarterlyAssessment,

            initialGrade:
              req.body.initialGrade ??
              null,

            quarterlyGrade:
              req.body.quarterlyGrade ??
              null,

            teacherId:
              teacher._id,
          },
        },

        {
          upsert: true,

          returnDocument:
            "after",

          setDefaultsOnInsert:
            true,
        }
      ).lean();

    return res.json({
      ok: true,

      message:
        "Grade saved successfully.",

      data: saved,
    });
  } catch (err) {
    console.error(
      "saveGrade error:",
      err
    );

    return res.status(500).json({
      ok: false,
      message: "Server error",
    });
  }
};
/* ---------------------------------------
   GET SAVED GRADES
--------------------------------------- */
exports.getSavedGrades = async (req, res) => {
  try {
    const teacher = await getTeacherBySession(req);

    if (!teacher) {
      return res.status(404).json({
        ok: false,
        message: "Teacher record not found.",
      });
    }

    const scope = getTeacherScope(teacher);

    if (!scope.className || !scope.sectionName) {
      return res.status(400).json({
        ok: false,
        message:
          "Teacher class/section assignment not found.",
      });
    }

    const schoolYear =
      await getActiveSchoolYear();

    if (!schoolYear) {
      return res.status(404).json({
        ok: false,
        message:
          "No active school year found.",
      });
    }

    const grades = await Grade.find({
      teacherId: teacher._id,

      gradeLevel:
        scope.className,

      sectionName:
        scope.sectionName,

      schoolYearId:
        schoolYear._id,
    })
      .sort({
        subject: 1,
        gradingPeriod: 1,
        studentId: 1,
      })
      .lean();

    return res.json({
      ok: true,

      data: grades,
    });
  } catch (err) {
    console.error(
      "getSavedGrades error:",
      err
    );

    return res.status(500).json({
      ok: false,
      message:
        "Failed to load saved grades.",
    });
  }
};