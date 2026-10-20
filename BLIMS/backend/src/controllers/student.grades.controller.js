const mongoose = require("mongoose");


const Grade = require("../models/Grade.model");
const Student = require("../models/Student.model");
const User = require("../models/User.model");
const SchoolYear = require("../models/SchoolYear.model");
const GradeLevel = require("../models/GradeLevel.model");


/* =========================================================
   GET MY GRADES
   GET /api/student/grades
========================================================= */


exports.getMyGrades = async (req, res) => {
  try {
    // ==========================================
    // GET LOGGED-IN USER
    // ==========================================


    const sessionUser =
      req.session?.user || null;


    const userId =
      sessionUser?.id ||
      sessionUser?._id ||
      req.session?.userId ||
      null;


    if (!userId) {
      return res.status(401).json({
        ok: false,
        message: "Not authenticated.",
      });
    }


    // ==========================================
    // VERIFY USER
    // ==========================================


    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({
        ok: false,
        message: "Invalid user session.",
      });
    }


    const user = await User.findById(userId)
      .select("_id username role")
      .lean();


    if (!user) {
      return res.status(404).json({
        ok: false,
        message: "User account not found.",
      });
    }


    if (user.role !== "student") {
      return res.status(403).json({
        ok: false,
        message: "Student access required.",
      });
    }


    // ==========================================
    // FIND STUDENT
    // ==========================================


    const student = await Student.findOne({
      userId: user._id,
      isActive: true,
    }).lean();


    if (!student) {
      return res.status(404).json({
        ok: false,
        message: "Student record not found.",
      });
    }


    const studentId = String(
      student.studentId || ""
    ).trim();


    const gradeLevel = String(
      student.className || ""
    ).trim();


    const sectionName = String(
      student.sectionName || ""
    ).trim();


    if (!studentId) {
      return res.status(400).json({
        ok: false,
        message: "Student ID is missing.",
      });
    }


    // ==========================================
    // ACTIVE SCHOOL YEAR
    // ==========================================


    const activeSchoolYear =
      await SchoolYear.findOne({
        isActive: true,
      }).lean();


    if (!activeSchoolYear) {
      return res.status(404).json({
        ok: false,
        message: "No active school year found.",
      });
    }


    // ==========================================
    // TERMS
    // ==========================================


    const terms = Array.isArray(
      activeSchoolYear.terms
    )
      ? activeSchoolYear.terms
          .slice()
          .sort(
            (a, b) =>
              Number(a.order || 0) -
              Number(b.order || 0)
          )
      : [];


    // ==========================================
    // FETCH STUDENT GRADES
    // ==========================================


   const grades = await Grade.find({
  studentId,
  schoolYearId: activeSchoolYear._id,
})
  .sort({ subject: 1 })
  .lean();
  // ==========================================
// FETCH ALL SUBJECTS FOR STUDENT GRADE LEVEL
// ==========================================


const gradeLevelDoc = await GradeLevel.findOne({
  grade: gradeLevel,
  isActive: true,
}).lean();


const subjects = Array.isArray(gradeLevelDoc?.subjects)
  ? gradeLevelDoc.subjects
  : [];


    // ==========================================
    // MAP TERM INFORMATION
    // ==========================================


    const termMap = new Map();


    terms.forEach((term) => {
      termMap.set(
        String(term._id),
        {
          id: String(term._id),
          name: String(
            term.name || ""
          ).trim(),
          order: Number(
            term.order || 0
          ),
          locked: !!term.locked,
        }
      );
    });


    // ==========================================
    // FORMAT GRADES
    // ==========================================


    const formattedGrades = grades.map(
      (grade) => {
        const term =
          termMap.get(
            String(grade.termId)
          );


        return {
          id: String(
            grade._id
          ),


          subject: String(
            grade.subject || ""
          ).trim(),


          termId: String(
            grade.termId
          ),


          termName:
            term?.name || "Unknown Term",


          termOrder:
            term?.order || 0,


          locked:
            term?.locked ?? true,


          initialGrade:
            grade.initialGrade ??
            null,


          termGrade:
            grade.termGrade ??
            null,
        };
      }
    );


    // ==========================================
    // RESPONSE
    // ==========================================


    return res.json({
      ok: true,


      data: {
        student: {
          studentId,
          grade: gradeLevel,
          section: sectionName,
        },


        schoolYear: {
          id: String(
            activeSchoolYear._id
          ),
          name: String(
            activeSchoolYear.name || ""
          ).trim(),
        },


       terms,


subjects,


grades: formattedGrades,
      },
    });


  } catch (error) {
    console.error(
      "❌ Failed to fetch student grades:",
      error
    );


    return res.status(500).json({
      ok: false,
      message: "Failed to load student grades.",
    });
  }
};

