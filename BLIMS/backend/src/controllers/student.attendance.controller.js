const Attendance = require("../models/Attendance.model");
const Student = require("../models/Student.model");
const User = require("../models/User.model");
const SchoolYear = require("../models/SchoolYear.model");

// ==========================================
// HELPERS
// ==========================================

function normalize(value) {
  return String(value ?? "").trim();
}

function normalizeStatus(value) {
  return normalize(value).toLowerCase();
}

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

// ==========================================
// GET ACTIVE SCHOOL YEAR
// ==========================================

async function getActiveSchoolYearDoc() {
  return await SchoolYear.findOne({
    isActive: true,
  }).lean();
}

// ==========================================
// GET STUDENT FROM SESSION
// ==========================================

async function getStudentBySession(req) {
  const userId =
    req.session?.user?.id ||
    req.session?.user?._id ||
    req.session?.userId;

  console.log(
    "Student attendance session user:",
    req.session?.user
  );

  console.log(
    "Student attendance resolved userId:",
    userId
  );

  if (!userId) {
    return null;
  }

  const user = await User.findById(userId).lean();

  if (!user) {
    return null;
  }

  if (
    normalize(user.role).toLowerCase() !==
    "student"
  ) {
    return null;
  }

  const student = await Student.findOne({
    userId: user._id,
    isActive: true,
  }).lean();

  console.log(
    "Student attendance resolved student:",
    student
      ? {
          id: student._id,
          studentId: student.studentId,
          className: student.className,
          sectionName: student.sectionName,
        }
      : null
  );

  return student || null;
}

// ==========================================
// GET MY ATTENDANCE
// GET /api/student/attendance
// ==========================================

exports.getMyAttendance = async (req, res) => {
  try {
    console.log("======================================");
    console.log("📅 GET STUDENT ATTENDANCE");
    console.log("======================================");

    // ==========================================
    // 1. GET LOGGED-IN STUDENT
    // ==========================================

    const student =
      await getStudentBySession(req);

    if (!student) {
      return res.status(401).json({
        ok: false,
        message:
          "Student account not found or unauthorized.",
      });
    }

    // ==========================================
    // 2. GET STUDENT CLASS
    // ==========================================

    const grade =
      normalize(student.className);

    const section =
      normalize(student.sectionName);

    if (
      !grade ||
      !section ||
      grade.toLowerCase() === "unassigned" ||
      section.toLowerCase() === "unassigned"
    ) {
      return res.json({
        ok: true,
        data: {
          student: {
            id: String(student._id),
            studentId: student.studentId,
            name: [
              student.firstName,
              student.middleName,
              student.lastName,
            ]
              .filter(Boolean)
              .join(" "),
            grade,
            section,
          },

          schoolYear: null,

          summary: {
            present: 0,
            absent: 0,
            late: 0,
            excused: 0,
            total: 0,
            attendanceRate: null,
          },

          records: [],
        },
      });
    }

    // ==========================================
    // 3. ACTIVE SCHOOL YEAR
    // ==========================================

    const activeSY =
      await getActiveSchoolYearDoc();

    if (!activeSY) {
      return res.status(404).json({
        ok: false,
        message:
          "No active school year found.",
      });
    }

    const schoolYearStart =
      toYmd(activeSY.start);

    const schoolYearEnd =
      toYmd(activeSY.end);

    // ==========================================
    // 4. OPTIONAL MONTH FILTER
    // ==========================================

    const requestedMonth =
      normalize(req.query?.month);

    const requestedYear =
      normalize(req.query?.year);

    // ==========================================
    // 5. FIND ATTENDANCE SESSIONS
    // ==========================================

    const attendanceSessions =
      await Attendance.find({
        schoolYearId: activeSY._id,

        className: {
          $regex: `^${grade.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
          )}$`,
          $options: "i",
        },

        sectionName: {
          $regex: `^${section.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
          )}$`,
          $options: "i",
        },

        date: {
          $gte: schoolYearStart,
          $lte: schoolYearEnd,
        },
      })
        .sort({
          date: -1,
        })
        .lean();

    // ==========================================
    // 6. GET ONLY THIS STUDENT'S RECORDS
    // ==========================================

    const studentId =
      normalize(student.studentId);

    const records = [];

    for (
      const session of attendanceSessions
    ) {
      const sessionDate =
        normalize(session.date);

      // Optional year filter
      if (
        requestedYear &&
        sessionDate.slice(0, 4) !==
          requestedYear
      ) {
        continue;
      }

      // Optional month filter
      //
      // Supports:
      // 1
      // 01
      // 2
      // 02
      // December
      //
      if (requestedMonth) {
        const monthNumber =
          Number(requestedMonth);

        if (
          Number.isInteger(monthNumber) &&
          monthNumber >= 1 &&
          monthNumber <= 12
        ) {
          const sessionMonth =
            Number(
              sessionDate.slice(5, 7)
            );

          if (
            sessionMonth !==
            monthNumber
          ) {
            continue;
          }
        } else {
          const monthName =
            new Date(
              `${sessionDate}T00:00:00Z`
            )
              .toLocaleString(
                "en-US",
                {
                  month: "long",
                  timeZone: "UTC",
                }
              )
              .toLowerCase();

          if (
            monthName !==
            requestedMonth.toLowerCase()
          ) {
            continue;
          }
        }
      }

      const studentRecord =
        Array.isArray(session.records)
          ? session.records.find(
              (record) =>
                normalize(
                  record.studentId
                ) === studentId
            )
          : null;

      if (!studentRecord) {
        continue;
      }

      const status =
        normalizeStatus(
          studentRecord.status
        );

      records.push({
        id: String(session._id),

        date: sessionDate,

        status,

        statusLabel:
          status
            ? status.charAt(0).toUpperCase() +
              status.slice(1)
            : "—",

        remarks:
          normalize(
            studentRecord.remarks
          ),

        schoolYear:
          normalize(
            session.schoolYearName
          ) ||
          normalize(activeSY.name),
      });
    }

    // ==========================================
    // 7. CALCULATE SUMMARY
    // ==========================================

    const summary = {
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      total: records.length,
      attendanceRate: null,
    };

    records.forEach((record) => {
      if (record.status === "present") {
        summary.present++;
      }

      else if (
        record.status === "absent"
      ) {
        summary.absent++;
      }

      else if (
        record.status === "late"
      ) {
        summary.late++;
      }

      else if (
        record.status === "excused"
      ) {
        summary.excused++;
      }
    });

    // Attendance rate:
    //
    // Present / Total × 100
    //
    if (summary.total > 0) {
      summary.attendanceRate =
        Math.round(
          (summary.present /
            summary.total) *
            100
        );
    }

    // ==========================================
    // 8. RESPONSE
    // ==========================================

    return res.json({
      ok: true,

      data: {
        student: {
          id: String(student._id),

          studentId:
            student.studentId,

          name: [
            student.firstName,
            student.middleName,
            student.lastName,
          ]
            .filter(Boolean)
            .join(" "),

          grade,

          section,
        },

        schoolYear: {
          id: String(activeSY._id),

          name:
            normalize(activeSY.name),

          start:
            schoolYearStart,

          end:
            schoolYearEnd,
        },

        summary,

        records,
      },
    });

  } catch (err) {
    console.error(
      "❌ Student attendance controller error:",
      err
    );

    return res.status(500).json({
      ok: false,
      message:
        "Failed to load student attendance.",
    });
  }
};