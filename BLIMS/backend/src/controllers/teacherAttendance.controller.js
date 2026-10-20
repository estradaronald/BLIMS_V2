const Attendance = require("../models/Attendance.model");
const Student = require("../models/Student.model");
const Teacher = require("../models/Teacher.model");
const SchoolYear = require("../models/SchoolYear.model");

/* =========================================================
   HELPERS
========================================================= */

function normalize(value) {
  return String(value ?? "").trim();
}

/*
 * Convert a Date into YYYY-MM-DD using UTC.
 *
 * This matches the way your attendance dates are
 * currently stored.
 */
function toYmd(value) {
  if (!value) {
    return "";
  }

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    return "";
  }

  return d.toISOString().slice(0, 10);
}

/*
 * Get today's date.
 */

function getTodayYmd() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const dateParts = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );

  return `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
}

/* =========================================================
   GET TEACHER FROM SESSION
========================================================= */

async function getTeacherBySession(req) {
  const userId =
    req.session?.user?.id || req.session?.user?._id || req.session?.userId;

  console.log("Attendance session user:", req.session?.user);

  console.log("Attendance resolved userId:", userId);

  if (!userId) {
    return null;
  }

  const teacher = await Teacher.findOne({
    userId,
    isActive: true,
  }).lean();

  console.log(
    "Attendance resolved teacher:",
    teacher
      ? {
          id: teacher._id,
          userId: teacher.userId,
          className: teacher.className,
          sectionName: teacher.sectionName,
          handledClass: teacher.handledClass,
          handledSection: teacher.handledSection,
        }
      : null,
  );

  return teacher || null;
}

/* =========================================================
   GET ACTIVE SCHOOL YEAR
========================================================= */

async function getActiveSchoolYearDoc() {
  return await SchoolYear.findOne({
    isActive: true,
  }).lean();
}

/* =========================================================
   GET TEACHER CLASS / SECTION
========================================================= */

function getTeacherScopeFromDoc(teacher) {
  const scope = {
    className: normalize(
      teacher?.handledClass ||
        teacher?.className ||
        teacher?.gradeLevel ||
        teacher?.grade ||
        teacher?.advisoryClass,
    ),

    sectionName: normalize(
      teacher?.handledSection ||
        teacher?.sectionName ||
        teacher?.section ||
        teacher?.advisorySection,
    ),
  };

  console.log("Attendance teacher scope:", scope);

  return scope;
}

/* =========================================================
   GET STUDENTS FOR TEACHER
========================================================= */

async function getTeacherStudents(scope) {
  return await Student.find({
    isActive: true,

    className: scope.className,

    sectionName: scope.sectionName,
  })
    .sort({
      lastName: 1,
      firstName: 1,
    })
    .lean();
}

/* =========================================================
   GET ATTENDANCE BOOTSTRAP
========================================================= */

exports.getAttendanceBootstrap = async (req, res) => {
  try {
    /* ---------------------------------
         TEACHER
      --------------------------------- */

    const teacher = await getTeacherBySession(req);

    if (!teacher) {
      return res.status(404).json({
        ok: false,
        message: "Teacher record not found.",
      });
    }

    /* ---------------------------------
         TEACHER SCOPE
      --------------------------------- */

    const scope = getTeacherScopeFromDoc(teacher);

    if (!scope.className || !scope.sectionName) {
      return res.status(400).json({
        ok: false,
        message: "Teacher class/section assignment not found.",
      });
    }

    /* ---------------------------------
         ACTIVE SCHOOL YEAR
      --------------------------------- */

    const activeSY = await getActiveSchoolYearDoc();

    if (!activeSY) {
      return res.status(404).json({
        ok: false,
        message: "No active school year found.",
      });
    }

    const schoolYearStart = toYmd(activeSY.start);

    const schoolYearEnd = toYmd(activeSY.end);

    /* ---------------------------------
         TODAY

         IMPORTANT:
         Do not trust req.query.date.
         Attendance bootstrap always
         uses today's date.
      --------------------------------- */

    const date = getTodayYmd();

    /* ---------------------------------
         STUDENTS
      --------------------------------- */

    const students = await getTeacherStudents(scope);

    /* ---------------------------------
         EXISTING TODAY'S SESSION
      --------------------------------- */

    const session = await Attendance.findOne({
      date,

      className: scope.className,

      sectionName: scope.sectionName,

      schoolYearId: activeSY._id,
    }).lean();

    /* ---------------------------------
         RESPONSE
      --------------------------------- */

    return res.json({
      ok: true,

      data: {
        teacherScope: scope,

        schoolYear: {
          id: String(activeSY._id),

          name: normalize(activeSY.name),

          start: schoolYearStart,

          end: schoolYearEnd,
        },

        /*
         * This is always today's
         * attendance date.
         */
        date,

        students,

        session: session || null,
      },
    });
  } catch (err) {
    console.error("getAttendanceBootstrap error:", err);

    return res.status(500).json({
      ok: false,

      message: "Server error",

      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

/* =========================================================
   SAVE ATTENDANCE
========================================================= */

exports.saveAttendance = async (req, res) => {
  try {
    console.log("======================================");

    console.log("SAVE ATTENDANCE REQUEST");

    console.log("BODY:", JSON.stringify(req.body, null, 2));

    console.log("======================================");

    /* ---------------------------------
         TEACHER
      --------------------------------- */

    const teacher = await getTeacherBySession(req);

    if (!teacher) {
      return res.status(404).json({
        ok: false,
        message: "Teacher record not found.",
      });
    }

    /* ---------------------------------
         TEACHER SCOPE
      --------------------------------- */

    const scope = getTeacherScopeFromDoc(teacher);

    if (!scope.className || !scope.sectionName) {
      return res.status(400).json({
        ok: false,
        message: "Teacher class/section assignment not found.",
      });
    }

    /* ---------------------------------
         ACTIVE SCHOOL YEAR
      --------------------------------- */

    const activeSY = await getActiveSchoolYearDoc();

    if (!activeSY) {
      return res.status(404).json({
        ok: false,
        message: "No active school year found.",
      });
    }

    /* ---------------------------------
         DATE
         
         IMPORTANT:
         Ignore the submitted date.
         Attendance is always for today.
      --------------------------------- */

    const date = getTodayYmd();

    /* ---------------------------------
         REQUEST RECORDS
      --------------------------------- */

    const rawRecords = Array.isArray(req.body?.records) ? req.body.records : [];

    console.log("SAVE ATTENDANCE SCOPE:", scope);

    console.log("SAVE ATTENDANCE DATE:", date);

    console.log("SAVE ATTENDANCE RECORD COUNT:", rawRecords.length);

    /* ---------------------------------
         VALIDATE RECORDS
      --------------------------------- */

    if (!rawRecords.length) {
      return res.status(400).json({
        ok: false,
        message: "records are required.",
      });
    }

    /* ---------------------------------
         VALID STATUSES
      --------------------------------- */

    const validStatuses = new Set(["present", "absent", "late", "excused"]);

    /* ---------------------------------
         NORMALIZE RECORDS
      --------------------------------- */

    const records = rawRecords

      .map((record) => ({
        studentId: normalize(record?.studentId),

        status: normalize(record?.status).toLowerCase(),
      }))

      .filter((record) => record.studentId && validStatuses.has(record.status));

    if (!records.length) {
      return res.status(400).json({
        ok: false,
        message: "No valid attendance records found.",
      });
    }

    /* ---------------------------------
         GET ALLOWED STUDENTS
      --------------------------------- */

    const allowedStudents = await Student.find({
      isActive: true,

      className: scope.className,

      sectionName: scope.sectionName,
    })

      .select("_id studentId firstName middleName lastName")

      .lean();

    /* ---------------------------------
         CREATE ALLOWED STUDENT ID SET
      --------------------------------- */

    const allowedIds = new Set(
      allowedStudents.map((student) => normalize(student.studentId)),
    );

    /* ---------------------------------
         FILTER RECORDS
      --------------------------------- */

    const filteredRecords = records.filter((record) =>
      allowedIds.has(record.studentId),
    );

    if (!filteredRecords.length) {
      return res.status(400).json({
        ok: false,

        message:
          "No valid students found for this teacher's class and section.",
      });
    }

    /* ---------------------------------
         ATTENDANCE FILTER
      ---------------------------------

         IMPORTANT:

         Include schoolYearId.

         This makes the attendance
         explicitly belong to the
         active school year.
      */

    const attendanceFilter = {
      date,

      className: scope.className,

      sectionName: scope.sectionName,

      schoolYearId: activeSY._id,
    };

    console.log(
      "ATTENDANCE MONGODB FILTER:",
      JSON.stringify(attendanceFilter, null, 2),
    );

    /* ---------------------------------
         ATTENDANCE UPDATE
      --------------------------------- */

    const attendanceUpdate = {
      $set: {
        teacherId: teacher._id,

        schoolYearId: activeSY._id,

        schoolYearName: normalize(activeSY.name),

        records: filteredRecords,
      },
    };

    /* ---------------------------------
         SAVE
      --------------------------------- */

    const saved = await Attendance.findOneAndUpdate(
      attendanceFilter,

      attendanceUpdate,

      {
        returnDocument: "after",

        upsert: true,

        setDefaultsOnInsert: true,

        runValidators: true,
      },
    ).lean();

    if (!saved) {
      return res.status(500).json({
        ok: false,

        message: "Attendance could not be saved.",
      });
    }

    console.log("✅ ATTENDANCE SAVED:", saved._id);

    return res.status(200).json({
      ok: true,

      message: "Attendance saved successfully.",

      data: saved,
    });
  } catch (err) {
    console.error("❌ saveAttendance error:", err);

    return res.status(500).json({
      ok: false,

      message: "Server error while saving attendance.",

      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

/* =========================================================
   GET YTD SUMMARY
========================================================= */

exports.getYtdSummary = async (req, res) => {
  try {
    /* ---------------------------------
         TEACHER
      --------------------------------- */

    const teacher = await getTeacherBySession(req);

    if (!teacher) {
      return res.status(404).json({
        ok: false,
        message: "Teacher record not found.",
      });
    }

    /* ---------------------------------
         TEACHER SCOPE
      --------------------------------- */

    const scope = getTeacherScopeFromDoc(teacher);

    if (!scope.className || !scope.sectionName) {
      return res.status(400).json({
        ok: false,
        message: "Teacher class/section assignment not found.",
      });
    }

    /* ---------------------------------
         ACTIVE SCHOOL YEAR
      --------------------------------- */

    const activeSY = await getActiveSchoolYearDoc();

    if (!activeSY) {
      return res.status(404).json({
        ok: false,
        message: "No active school year found.",
      });
    }

    const start = toYmd(activeSY.start);

    const end = toYmd(activeSY.end);

    /* ---------------------------------
         STUDENTS
      --------------------------------- */

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

    /* ---------------------------------
         ATTENDANCE SESSIONS
      ---------------------------------

         IMPORTANT:

         Filter by schoolYearId too.
      */

    const sessions = await Attendance.find({
      schoolYearId: activeSY._id,

      className: scope.className,

      sectionName: scope.sectionName,

      date: {
        $gte: start,

        $lte: end,
      },
    })

      .lean();

    /* ---------------------------------
         CREATE COUNTS
      --------------------------------- */

    const counts = new Map();

    students.forEach((student) => {
      const studentId = normalize(student.studentId);

      counts.set(studentId, {
        studentId,

        fullName: [student.firstName, student.middleName, student.lastName]

          .filter(Boolean)

          .join(" "),

        photoDataUrl: student.photoDataUrl || "",

        present: 0,

        absent: 0,

        late: 0,

        excused: 0,

        total: 0,
      });
    });

    /* ---------------------------------
         PROCESS SESSIONS
      --------------------------------- */

    sessions.forEach((session) => {
      (session.records || []).forEach((record) => {
        const studentId = normalize(record.studentId);

        if (!counts.has(studentId)) {
          return;
        }

        const row = counts.get(studentId);

        const status = normalize(record.status).toLowerCase();

        if (status === "present") {
          row.present++;
        } else if (status === "absent") {
          row.absent++;
        } else if (status === "late") {
          row.late++;
        } else if (status === "excused") {
          row.excused++;
        }

        row.total++;
      });
    });

    /* ---------------------------------
         FINAL SUMMARY
      --------------------------------- */

    const summary = Array.from(counts.values()).map((row) => ({
      ...row,

      attendancePercent: row.total
        ? Math.round((row.present / row.total) * 100)
        : 0,
    }));

    return res.json({
      ok: true,

      data: {
        teacherScope: scope,

        schoolYear: {
          id: String(activeSY._id),

          name: normalize(activeSY.name),

          start,

          end,
        },

        sessionCount: sessions.length,

        summary,
      },
    });
  } catch (err) {
    console.error("getYtdSummary error:", err);

    return res.status(500).json({
      ok: false,

      message: "Server error",
    });
  }
};

/* =========================================================
   GET SESSION BY DATE
========================================================= */

exports.getAttendanceSessionByDate = async (req, res) => {
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

    /* ---------------------------------
         ACTIVE SCHOOL YEAR
      --------------------------------- */

    const activeSY = await getActiveSchoolYearDoc();

    if (!activeSY) {
      return res.status(404).json({
        ok: false,
        message: "No active school year found.",
      });
    }

    /* ---------------------------------
         DATE
         
         This endpoint is for the
         daily attendance page, so
         don't allow arbitrary dates.
      --------------------------------- */

    const date = getTodayYmd();

    /* ---------------------------------
         FIND TODAY'S SESSION
      --------------------------------- */

    const session = await Attendance.findOne({
      date,

      className: scope.className,

      sectionName: scope.sectionName,

      schoolYearId: activeSY._id,
    }).lean();

    return res.json({
      ok: true,

      data: session || null,
    });
  } catch (err) {
    console.error("getAttendanceSessionByDate error:", err);

    return res.status(500).json({
      ok: false,

      message: "Server error",
    });
  }
};
