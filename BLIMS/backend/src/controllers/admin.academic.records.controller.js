const Grade = require("../models/Grade.model");
const SchoolYear = require("../models/SchoolYear.model");

/* =========================================================
   GET ACADEMIC RECORDS
   Returns grades for the active school year.

   Optional query parameters:
   ?gradeLevel=Kindergarten
   ?sectionName=Sunflower
   ?studentId=STU-001
========================================================= */

async function getAcademicRecords(req, res) {
  try {
    const {
      gradeLevel,
      sectionName,
      studentId,
    } = req.query;

    /* -------------------------------------------------------
       GET ACTIVE SCHOOL YEAR
    ------------------------------------------------------- */

    const schoolYear = await SchoolYear.findOne({
      isActive: true,
    }).lean();

    if (!schoolYear) {
      return res.status(404).json({
        message: "No active school year found.",
      });
    }

    /* -------------------------------------------------------
       BUILD GRADE FILTER
    ------------------------------------------------------- */

    const gradeFilter = {
      schoolYearId: schoolYear._id,
    };

    if (gradeLevel) {
      gradeFilter.gradeLevel = gradeLevel;
    }

    if (sectionName) {
      gradeFilter.sectionName = sectionName;
    }

    if (studentId) {
      gradeFilter.studentId = studentId;
    }

    /* -------------------------------------------------------
       GET GRADES
    ------------------------------------------------------- */

    const grades = await Grade.find(gradeFilter)
      .sort({
        studentId: 1,
        subject: 1,
      })
      .lean();

    /* -------------------------------------------------------
       PREPARE TERMS
    ------------------------------------------------------- */

    const terms = (schoolYear.terms || [])
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((term) => ({
        id: String(term._id),
        order: term.order,
        name: term.name,
        start: term.start || null,
        end: term.end || null,
        locked: Boolean(term.locked),
      }));

    /* -------------------------------------------------------
       RETURN RESPONSE
    ------------------------------------------------------- */

    return res.status(200).json({
      schoolYear: {
        id: String(schoolYear._id),
        name: schoolYear.name,
        terms,
      },

      grades: grades.map((grade) => ({
        id: String(grade._id),

        studentId: grade.studentId,

        gradeLevel: grade.gradeLevel,

        sectionName: grade.sectionName,

        subject: grade.subject,

        schoolYearId: String(grade.schoolYearId),

        schoolYearName: grade.schoolYearName,

        termId: String(grade.termId),

        initialGrade:
          grade.initialGrade !== null &&
          grade.initialGrade !== undefined
            ? grade.initialGrade
            : null,

        termGrade:
          grade.termGrade !== null &&
          grade.termGrade !== undefined
            ? grade.termGrade
            : null,

        teacherId: grade.teacherId
          ? String(grade.teacherId)
          : null,
      })),
    });
  } catch (error) {
    console.error(
      "getAcademicRecords error:",
      error
    );

    return res.status(500).json({
      message: "Failed to load academic records.",
      error: error.message,
    });
  }
}

module.exports = {
  getAcademicRecords,
};