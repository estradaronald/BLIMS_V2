const mongoose = require("mongoose");
const Attendance = require("../models/Attendance.model");

/* =========================================================
   HELPERS
========================================================= */

function badRequest(res, message = "Invalid request.") {
  return res.status(400).json({
    ok: false,
    message,
  });
}

function serverError(res, err) {
  console.error("❌ Admin attendance controller error:", err);

  return res.status(500).json({
    ok: false,
    message: "Server error",
  });
}

/* =========================================================
   GET ATTENDANCE
   GET /api/admin/attendance
========================================================= */

exports.getAttendance = async (req, res) => {
  try {
    const {
      date,
      grade,
      section,
      status,
      search,
    } = req.query;

    const filter = {};

    /* -----------------------------------------------------
       DATE
    ----------------------------------------------------- */

    if (date) {
      filter.date = date;
    }

    /* -----------------------------------------------------
       GRADE LEVEL
       Frontend calls this "grade"
       Database calls this "className"
    ----------------------------------------------------- */

    if (grade && grade !== "all") {
      filter.className = grade;
    }

    /* -----------------------------------------------------
       SECTION
    ----------------------------------------------------- */

    if (section && section !== "all") {
      filter.sectionName = section;
    }

    /* -----------------------------------------------------
       STATUS
       Because records is an embedded array.
    ----------------------------------------------------- */

    if (status && status !== "all") {
      filter.records = {
        $elemMatch: {
          status,
        },
      };
    }

    /* -----------------------------------------------------
       SEARCH
       Currently searches studentId.
    ----------------------------------------------------- */

    if (search && search.trim()) {
      filter.records = {
        ...(filter.records || {}),
        $elemMatch: {
          ...(status && status !== "all"
            ? { status }
            : {}),
          studentId: {
            $regex: search.trim(),
            $options: "i",
          },
        },
      };
    }

    /* -----------------------------------------------------
       FETCH ATTENDANCE SHEETS
    ----------------------------------------------------- */

    const sheets = await Attendance.find(filter)
      .sort({
        date: -1,
        className: 1,
        sectionName: 1,
      })
      .lean();

    /* -----------------------------------------------------
       FLATTEN RECORDS
       
       One MongoDB attendance document can contain
       many students.

       Admin table needs one row per student.
    ----------------------------------------------------- */

    const data = [];

    for (const sheet of sheets) {
      for (const record of sheet.records || []) {
        /* Apply status filter again for safety */
        if (
          status &&
          status !== "all" &&
          record.status !== status
        ) {
          continue;
        }

        /* Apply search filter to individual record */
        if (
          search &&
          search.trim() &&
          !String(record.studentId || "")
            .toLowerCase()
            .includes(search.trim().toLowerCase())
        ) {
          continue;
        }

        data.push({
          id: `${sheet._id}-${record.studentId}`,

          attendanceId: String(sheet._id),

          studentId: record.studentId,

          date: sheet.date,

          grade: sheet.className,

          section: sheet.sectionName,

          status: record.status,

          teacherId: sheet.teacherId
            ? String(sheet.teacherId)
            : "",

          schoolYearId: sheet.schoolYearId
            ? String(sheet.schoolYearId)
            : "",

          schoolYearName: sheet.schoolYearName || "",

          remarks: "",
        });
      }
    }

    return res.json({
      ok: true,
      count: data.length,
      data,
    });
  } catch (err) {
    return serverError(res, err);
  }
};

/* =========================================================
   GET ONE ATTENDANCE SHEET
   GET /api/admin/attendance/:id
========================================================= */

exports.getAttendanceById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return badRequest(res, "Invalid attendance ID.");
    }

    const attendance = await Attendance.findById(id).lean();

    if (!attendance) {
      return res.status(404).json({
        ok: false,
        message: "Attendance record not found.",
      });
    }

    return res.json({
      ok: true,
      data: {
        id: String(attendance._id),

        date: attendance.date,

        grade: attendance.className,

        section: attendance.sectionName,

        teacherId: attendance.teacherId
          ? String(attendance.teacherId)
          : "",

        schoolYearId: attendance.schoolYearId
          ? String(attendance.schoolYearId)
          : "",

        schoolYearName:
          attendance.schoolYearName || "",

        records: (attendance.records || []).map(
          (record) => ({
            studentId: record.studentId,
            status: record.status,
          })
        ),

        createdAt: attendance.createdAt,
        updatedAt: attendance.updatedAt,
      },
    });
  } catch (err) {
    return serverError(res, err);
  }
};