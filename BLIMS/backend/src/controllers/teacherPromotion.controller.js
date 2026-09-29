const mongoose = require("mongoose");

const Promotion = require("../models/Promotion.model");
const Student = require("../models/Student.model");
const Teacher = require("../models/Teacher.model");
const Grade = require("../models/Grade.model");
const SchoolYear = require("../models/SchoolYear.model");


/* =========================================================
   HELPERS
========================================================= */

function normalize(value) {
  return String(value ?? "").trim();
}


/**
 * Get logged-in teacher.
 *
 * Uses the same session structure as the existing
 * teacher grade controller.
 */
async function getTeacherBySession(req) {
  const sessionUserId =
    req.session?.user?.id ||
    req.session?.user?._id ||
    req.session?.userId;

  if (!sessionUserId) {
    return null;
  }

  return Teacher.findOne({
    userId: sessionUserId,
    isActive: true,
  }).lean();
}


/**
 * Get active school year.
 */
async function getActiveSchoolYear() {
  return SchoolYear.findOne({
    isActive: true,
  }).lean();
}


/**
 * Get teacher's assigned class and section.
 *
 * Uses the actual Teacher schema first.
 */
function getTeacherScope(teacher) {
  return {
    className: normalize(
      teacher?.className ||
        teacher?.handledClass ||
        teacher?.gradeLevel ||
        teacher?.grade ||
        teacher?.advisoryClass
    ),

    sectionName: normalize(
      teacher?.sectionName ||
        teacher?.handledSection ||
        teacher?.section ||
        teacher?.advisorySection
    ),
  };
}


/**
 * Get the final term.
 *
 * The final term is the term with the highest
 * configured order.
 */
function getFinalTerm(schoolYear) {
  if (
    !schoolYear ||
    !Array.isArray(schoolYear.terms) ||
    schoolYear.terms.length === 0
  ) {
    return null;
  }

  return [...schoolYear.terms]
    .sort((a, b) => a.order - b.order)
    .at(-1);
}


/**
 * Convert a term to the API response format.
 */
function serializeTerm(term) {
  if (!term) {
    return null;
  }

  return {
    id: String(term._id),
    order: term.order,
    name: normalize(term.name),
    start: term.start || null,
    end: term.end || null,
    locked: Boolean(term.locked),
  };
}


/**
 * Validate recommendation.
 */
function isValidRecommendation(value) {
  return [
    "promote",
    "retain",
    "transfer",
  ].includes(value);
}


/**
 * Calculate a student's final grade from the final term.
 *
 * A learner can have multiple subjects.
 *
 * We use the average of all available final-term
 * termGrade values.
 */
async function getFinalGrades(
  studentIds,
  schoolYearId,
  finalTermId
) {
  if (!studentIds.length) {
    return new Map();
  }

  const grades = await Grade.find({
    studentId: {
      $in: studentIds,
    },

    schoolYearId,

    termId: finalTermId,

    termGrade: {
      $ne: null,
    },
  })
    .select(
      "studentId subject termGrade"
    )
    .lean();

  const grouped = new Map();

  for (const grade of grades) {
    const studentId =
      normalize(grade.studentId);

    const value =
      Number(grade.termGrade);

    if (
      !studentId ||
      !Number.isFinite(value)
    ) {
      continue;
    }

    if (!grouped.has(studentId)) {
      grouped.set(studentId, []);
    }

    grouped.get(studentId).push(value);
  }

  const finalGrades = new Map();

  for (const [
    studentId,
    values,
  ] of grouped.entries()) {
    if (!values.length) {
      continue;
    }

    const total = values.reduce(
      (sum, value) => sum + value,
      0
    );

    const average =
      total / values.length;

    finalGrades.set(
      studentId,
      Number(average.toFixed(2))
    );
  }

  return finalGrades;
}


/* =========================================================
   GET PROMOTION DATA
========================================================= */

async function getPromotionData(req, res) {
  try {
    /* -------------------------------------------------------
       TEACHER
    ------------------------------------------------------- */

    const teacher =
      await getTeacherBySession(req);

    if (!teacher) {
      return res.status(401).json({
        message:
          "Teacher session not found.",
      });
    }

    const teacherScope =
      getTeacherScope(teacher);

    if (
      !teacherScope.className ||
      !teacherScope.sectionName
    ) {
      return res.status(400).json({
        message:
          "Teacher class and section are not properly configured.",
      });
    }

    /* -------------------------------------------------------
       SCHOOL YEAR
    ------------------------------------------------------- */

    const schoolYear =
      await getActiveSchoolYear();

    if (!schoolYear) {
      return res.status(404).json({
        message:
          "No active school year found.",
      });
    }

    /* -------------------------------------------------------
       FINAL TERM
    ------------------------------------------------------- */

    const finalTerm =
      getFinalTerm(schoolYear);

    if (!finalTerm) {
      return res.status(404).json({
        message:
          "No final term configured for the active school year.",
      });
    }

    /* -------------------------------------------------------
       STUDENTS
    -------------------------------------------------------

       IMPORTANT:
       Student uses `className`, not `gradeLevel`.
    */

    const students =
      await Student.find({
        isActive: true,

        className:
          teacherScope.className,

        sectionName:
          teacherScope.sectionName,
      })
        .select(
          "_id studentId firstName middleName lastName suffix photoDataUrl className sectionName"
        )
        .lean();

    /* -------------------------------------------------------
       SORT STUDENTS
    ------------------------------------------------------- */

    students.sort((a, b) => {
      const lastA =
        normalize(a.lastName).toLowerCase();

      const lastB =
        normalize(b.lastName).toLowerCase();

      if (lastA !== lastB) {
        return lastA.localeCompare(lastB);
      }

      const firstA =
        normalize(a.firstName).toLowerCase();

      const firstB =
        normalize(b.firstName).toLowerCase();

      return firstA.localeCompare(firstB);
    });

    /* -------------------------------------------------------
       FINAL GRADES
    ------------------------------------------------------- */

    const studentIds =
      students.map(
        (student) =>
          normalize(student.studentId)
      );

    const finalGrades =
      await getFinalGrades(
        studentIds,
        schoolYear._id,
        finalTerm._id
      );

    /* -------------------------------------------------------
       EXISTING PROMOTIONS
    ------------------------------------------------------- */

    const existingPromotions =
      await Promotion.find({
        schoolYearId:
          schoolYear._id,

        finalTermId:
          finalTerm._id,

        teacherId:
          teacher._id,

        className:
          teacherScope.className,

        sectionName:
          teacherScope.sectionName,
      })
        .sort({
          createdAt: 1,
        })
        .lean();

    const promotionMap =
      new Map(
        existingPromotions.map(
          (promotion) => [
            normalize(
              promotion.studentId
            ),
            promotion,
          ]
        )
      );

    /* -------------------------------------------------------
       RESPONSE STUDENTS
    ------------------------------------------------------- */

    const responseStudents =
      students.map((student) => {
        const studentId =
          normalize(student.studentId);

        const promotion =
          promotionMap.get(studentId);

        return {
          studentId,

          firstName:
            normalize(student.firstName),

          middleName:
            normalize(student.middleName),

          lastName:
            normalize(student.lastName),

          suffix:
            normalize(student.suffix),

          photoDataUrl:
            student.photoDataUrl || "",

          className:
            normalize(student.className),

          sectionName:
            normalize(student.sectionName),

          finalGrade:
            finalGrades.has(studentId)
              ? finalGrades.get(studentId)
              : null,

          recommendation:
            promotion?.recommendation ||
            null,

          status:
            promotion?.status ||
            "pending",
        };
      });

    /* -------------------------------------------------------
       RESPONSE
    ------------------------------------------------------- */

    return res.json({
      teacherScope,

      teacher: {
        id: String(teacher._id),
        teacherId:
          normalize(teacher.teacherId),
        firstName:
          normalize(teacher.firstName),
        middleName:
          normalize(teacher.middleName),
        lastName:
          normalize(teacher.lastName),
      },

      schoolYear: {
        id: String(schoolYear._id),
        name:
          normalize(schoolYear.name),

        terms:
          [...(schoolYear.terms || [])]
            .sort(
              (a, b) =>
                a.order - b.order
            )
            .map(serializeTerm),
      },

      finalTerm:
        serializeTerm(finalTerm),

      students:
        responseStudents,

      promotions:
        existingPromotions.map(
          (promotion) => ({
            id: String(
              promotion._id
            ),

            studentId:
              normalize(
                promotion.studentId
              ),

            finalGrade:
              promotion.finalGrade,

            recommendation:
              promotion.recommendation,

            status:
              promotion.status,

            submittedAt:
              promotion.submittedAt,

            reviewedAt:
              promotion.reviewedAt,

            reviewRemarks:
              normalize(
                promotion.reviewRemarks
              ),
          })
        ),
    });
  } catch (error) {
    console.error(
      "getPromotionData error:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to load promotion data.",
    });
  }
}


/* =========================================================
   SUBMIT PROMOTION
========================================================= */

async function submitPromotion(req, res) {
  try {
    /* -------------------------------------------------------
       TEACHER
    ------------------------------------------------------- */

    const teacher =
      await getTeacherBySession(req);

    if (!teacher) {
      return res.status(401).json({
        message:
          "Teacher session not found.",
      });
    }

    const teacherScope =
      getTeacherScope(teacher);

    if (
      !teacherScope.className ||
      !teacherScope.sectionName
    ) {
      return res.status(400).json({
        message:
          "Teacher class and section are not properly configured.",
      });
    }

    /* -------------------------------------------------------
       SCHOOL YEAR
    ------------------------------------------------------- */

    const schoolYear =
      await getActiveSchoolYear();

    if (!schoolYear) {
      return res.status(404).json({
        message:
          "No active school year found.",
      });
    }

    /* -------------------------------------------------------
       FINAL TERM
    ------------------------------------------------------- */

    const finalTerm =
      getFinalTerm(schoolYear);

    if (!finalTerm) {
      return res.status(404).json({
        message:
          "No final term configured for the active school year.",
      });
    }

    /* -------------------------------------------------------
       FINAL TERM MUST BE LOCKED
    ------------------------------------------------------- */

    if (!finalTerm.locked) {
      return res.status(403).json({
        message:
          "Promotion recommendations can only be submitted after the final term is locked.",
      });
    }

    /* -------------------------------------------------------
       REQUEST VALIDATION
    ------------------------------------------------------- */

    const recommendations =
      req.body?.recommendations;

    if (
      !Array.isArray(
        recommendations
      )
    ) {
      return res.status(400).json({
        message:
          "Recommendations must be an array.",
      });
    }

    if (
      recommendations.length === 0
    ) {
      return res.status(400).json({
        message:
          "At least one recommendation is required.",
      });
    }

    /* -------------------------------------------------------
       REMOVE DUPLICATE STUDENTS
    ------------------------------------------------------- */

    const seenStudents =
      new Set();

    for (
      const item of recommendations
    ) {
      const studentId =
        normalize(
          item?.studentId
        );

      if (!studentId) {
        return res.status(400).json({
          message:
            "Every recommendation must contain a student ID.",
        });
      }

      if (
        seenStudents.has(studentId)
      ) {
        return res.status(400).json({
          message:
            `Duplicate recommendation for student ${studentId}.`,
        });
      }

      seenStudents.add(
        studentId
      );

      const recommendation =
        normalize(
          item?.recommendation
        ).toLowerCase();

      if (
        !isValidRecommendation(
          recommendation
        )
      ) {
        return res.status(400).json({
          message:
            `Invalid recommendation for student ${studentId}.`,
        });
      }
    }

    /* -------------------------------------------------------
       GET CURRENT STUDENTS
    ------------------------------------------------------- */

    const students =
      await Student.find({
        isActive: true,

        className:
          teacherScope.className,

        sectionName:
          teacherScope.sectionName,

        studentId: {
          $in: [
            ...seenStudents,
          ],
        },
      })
        .select(
          "studentId firstName middleName lastName className sectionName"
        )
        .lean();

    /* -------------------------------------------------------
       ENSURE EVERY REQUESTED STUDENT
       BELONGS TO TEACHER'S CLASS
    ------------------------------------------------------- */

    const validStudentIds =
      new Set(
        students.map(
          (student) =>
            normalize(
              student.studentId
            )
        )
      );

    for (
      const studentId of seenStudents
    ) {
      if (
        !validStudentIds.has(
          studentId
        )
      ) {
        return res.status(403).json({
          message:
            `Student ${studentId} is not part of your assigned class.`,
        });
      }
    }

    /* -------------------------------------------------------
       FINAL GRADES
    ------------------------------------------------------- */

    const studentIdList =
      students.map(
        (student) =>
          normalize(
            student.studentId
          )
      );

    const finalGrades =
      await getFinalGrades(
        studentIdList,
        schoolYear._id,
        finalTerm._id
      );

    /* -------------------------------------------------------
       REQUIRE FINAL GRADE
    -------------------------------------------------------

       We don't allow a promotion recommendation
       if the final grade is unavailable.
    */

    for (
      const student of students
    ) {
      const studentId =
        normalize(
          student.studentId
        );

      if (
        !finalGrades.has(
          studentId
        )
      ) {
        return res.status(400).json({
          message:
            `Final grade is not available for student ${studentId}.`,
        });
      }
    }

    /* -------------------------------------------------------
       CHECK EXISTING RECORDS
    ------------------------------------------------------- */

    const existingPromotions =
      await Promotion.find({
        schoolYearId:
          schoolYear._id,

        finalTermId:
          finalTerm._id,

        teacherId:
          teacher._id,

        studentId: {
          $in: [
            ...seenStudents,
          ],
        },
      })
        .lean();

    const existingMap =
      new Map(
        existingPromotions.map(
          (promotion) => [
            normalize(
              promotion.studentId
            ),
            promotion,
          ]
        )
      );

    /* -------------------------------------------------------
       BLOCK ALREADY APPROVED
    ------------------------------------------------------- */

    for (
      const item of recommendations
    ) {
      const studentId =
        normalize(
          item.studentId
        );

      const existing =
        existingMap.get(
          studentId
        );

      if (
        existing?.status ===
        "approved"
      ) {
        return res.status(409).json({
          message:
            `Promotion for student ${studentId} has already been approved and cannot be changed.`,
        });
      }
    }

    /* -------------------------------------------------------
       SAVE
    ------------------------------------------------------- */

    const savedPromotions = [];

    for (
      const item of recommendations
    ) {
      const studentId =
        normalize(
          item.studentId
        );

      const recommendation =
        normalize(
          item.recommendation
        ).toLowerCase();

      const finalGrade =
        finalGrades.get(
          studentId
        );

      const saved =
        await Promotion.findOneAndUpdate(
          {
            schoolYearId:
              schoolYear._id,

            finalTermId:
              finalTerm._id,

            teacherId:
              teacher._id,

            studentId,
          },

          {
            $set: {
              schoolYearId:
                schoolYear._id,

              schoolYearName:
                normalize(
                  schoolYear.name
                ),

              finalTermId:
                finalTerm._id,

              finalTermName:
                normalize(
                  finalTerm.name
                ),

              teacherId:
                teacher._id,

              className:
                teacherScope.className,

              sectionName:
                teacherScope.sectionName,

              studentId,

              finalGrade,

              recommendation,

              status:
                "submitted",

              submittedBy:
                teacher._id,

              submittedAt:
                new Date(),
            },
          },

          {
            upsert: true,

            new: true,

            setDefaultsOnInsert: true,

            runValidators: true,
          }
        ).lean();

      savedPromotions.push(
        saved
      );
    }

    /* -------------------------------------------------------
       RESPONSE
    ------------------------------------------------------- */

    return res.status(200).json({
      message:
        "Promotion recommendations submitted successfully.",

      schoolYear: {
        id:
          String(
            schoolYear._id
          ),

        name:
          normalize(
            schoolYear.name
          ),
      },

      finalTerm:
        serializeTerm(
          finalTerm
        ),

      teacherScope,

      promotions:
        savedPromotions.map(
          (promotion) => ({
            id:
              String(
                promotion._id
              ),

            studentId:
              normalize(
                promotion.studentId
              ),

            finalGrade:
              promotion.finalGrade,

            recommendation:
              promotion.recommendation,

            status:
              promotion.status,

            submittedAt:
              promotion.submittedAt,
          })
        ),
    });
  } catch (error) {
    console.error(
      "submitPromotion error:",
      error
    );

    return res.status(500).json({
      message:
        "Failed to submit promotion recommendations.",
      error:
        error.message,
    });
  }
}


/* =========================================================
   EXPORT
========================================================= */

module.exports = {
  getPromotionData,
  submitPromotion,
};