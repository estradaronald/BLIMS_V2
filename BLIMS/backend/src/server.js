// backend/server.js

const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, "../.env"),
});

const express = require("express");
const cors = require("cors");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const rateLimit = require("express-rate-limit");

const connectDB = require("./config/db");

// ==============================
// Authentication
// ==============================

const authRoutes = require("./routes/auth.routes");

// ==============================
// Admin routes
// ==============================

const adminTeachersRoutes = require("./routes/admin.teachers.routes");
const adminStudentsRoutes = require("./routes/admin.students.routes");
const adminDashboardRoutes = require("./routes/admin.dashboard.routes");
const adminAuditRoutes = require("./routes/admin.audit.routes");
const adminGradeLevelsRoutes = require("./routes/admin-grade-levels.routes");
const adminSubjectsRoutes = require("./routes/admin-subjects.routes");
const adminSchoolYearsRoutes = require("./routes/admin.school-years.routes");
const adminClassScheduleRoutes = require("./routes/admin.class-schedule.routes");

// Combined admin announcements + events
const adminAnnouncementsRoutes = require("./routes/announcement.routes");

// ==============================
// Teacher routes
// ==============================

const teacherStudentsRoutes = require("./routes/teacherStudents.routes");
const teacherAttendanceRoutes = require("./routes/teacherAttendance.routes");
const teacherRoutes = require("./routes/teacher.routes");
const teacherScheduleRoutes = require("./routes/teacher.schedule.routes");
const teacherAssessmentRoutes = require("./routes/teacher.assessment.routes");
const teacherGradeRoutes = require("./routes/teacherGrade.routes");

// Teacher announcements
const teacherAnnouncementsRoutes = require("./routes/teacher.announcements.routes");

// ==============================
// Student routes
// ==============================

// Student schedule
const studentScheduleRoutes = require("./routes/student.schedule.routes");

// Student announcements
const studentAnnouncementsRoutes = require("./routes/student.announcements.routes");

// Student assignments
const studentAssignmentRoutes = require("./routes/student.assignment.routes");

// ==============================
// Middleware
// ==============================

const {
  ensureCsrfToken,
  csrfProtect,
} = require("./middlewares/csrf");

// ==============================
// Backup Scheduler
// ==============================

const {
  startBackupScheduler,
} = require("./backup/backupDatabase");

// ==============================
// APP
// ==============================

const app = express();

let server;

// ==============================
// ENV CHECKS
// ==============================

const SESSION_SECRET = process.env.SESSION_SECRET;
const MONGO_URL = process.env.MONGO_URL;
const PORT = process.env.PORT || 5000;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || true;

if (!SESSION_SECRET) {
  console.error("❌ Missing SESSION_SECRET in .env");
  process.exit(1);
}

if (!MONGO_URL) {
  console.error("❌ Missing MONGO_URL in .env");
  process.exit(1);
}

// ==============================
// TRUST PROXY
// ==============================

app.set("trust proxy", 1);

// ==============================
// RATE LIMIT
// ==============================

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,

  standardHeaders: true,
  legacyHeaders: false,

  message: {
    ok: false,
    message: "Too many requests. Please try again later.",
  },
});

app.use("/api", apiLimiter);

// ==============================
// CORS
// ==============================

app.use(
  cors({
    origin: CLIENT_ORIGIN,
    credentials: true,
  })
);

// ==============================
// BODY PARSERS
// ==============================

app.use(
  "/api",
  express.json({
    limit: "20kb",
  })
);

app.use(
  "/api",
  express.urlencoded({
    extended: true,
    limit: "20kb",
  })
);

// ==============================
// SESSION
// ==============================

app.use(
  session({
    name: "blims.sid",

    secret: SESSION_SECRET,

    resave: false,

    saveUninitialized: false,

    rolling: true,

    store: MongoStore.create({
      mongoUrl: MONGO_URL,
      collectionName: "sessions",
      ttl: 60 * 30,
    }),

    cookie: {
      httpOnly: true,

      sameSite: "lax",

      secure: false,

      maxAge: 1000 * 60 * 30,
    },
  })
);

// ==============================
// CSRF
// ==============================

app.use(
  "/api",
  ensureCsrfToken
);

app.get(
  "/api/csrf-token",
  (req, res) => {
    res.json({
      ok: true,
      csrfToken:
        req.session?.csrfToken || "",
    });
  }
);

app.use(
  "/api/admin",
  csrfProtect
);

app.use(
  "/api/auth/change-password",
  csrfProtect
);

// ==============================
// STATIC / FRONTEND
// ==============================

const FRONTEND_DIR = path.join(
  __dirname,
  "../../frontend"
);

app.use(
  express.static(FRONTEND_DIR)
);

// ==============================
// UPLOADS
// ==============================

const UPLOADS_DIR = path.join(
  __dirname,
  "../uploads"
);

app.use(
  "/uploads",
  express.static(UPLOADS_DIR)
);

// ==============================
// FRONTEND ENTRY
// ==============================

app.get(
  "/",
  (req, res) => {
    res.sendFile(
      path.join(
        FRONTEND_DIR,
        "login.html"
      )
    );
  }
);

// ==============================
// API ROUTES
// ==============================

// ==============================
// Authentication
// ==============================

app.use(
  "/api/auth",
  authRoutes
);

// ==============================
// ADMIN ROUTES
// ==============================

app.use(
  "/api/admin",
  adminTeachersRoutes
);

app.use(
  "/api/admin",
  adminStudentsRoutes
);

app.use(
  "/api/admin",
  adminDashboardRoutes
);

app.use(
  "/api/admin",
  adminAuditRoutes
);

app.use(
  "/api/admin",
  adminGradeLevelsRoutes
);

app.use(
  "/api/admin",
  adminSubjectsRoutes
);

app.use(
  "/api/admin",
  adminSchoolYearsRoutes
);

app.use(
  "/api/admin",
  adminClassScheduleRoutes
);

// ==================================================
// ADMIN ANNOUNCEMENTS + EVENTS
// ==================================================
//
// GET    /api/admin/announcements
// GET    /api/admin/announcements/:id
// POST   /api/admin/announcements
// PUT    /api/admin/announcements/:id
// PATCH  /api/admin/announcements/:id/archive
// DELETE /api/admin/announcements/:id
//
// Events use:
// category: "events"
// ==================================================

app.use(
  "/api/admin/announcements",
  adminAnnouncementsRoutes
);

// ==============================
// TEACHER ROUTES
// ==============================

// General teacher routes

app.use(
  "/api/teacher",
  teacherRoutes
);

// Teacher schedule

app.use(
  "/api/teacher",
  teacherScheduleRoutes
);

// Teacher students

app.use(
  "/api/teacher/students",
  teacherStudentsRoutes
);

// Teacher attendance

app.use(
  "/api/teacher/attendance",
  teacherAttendanceRoutes
);

// Teacher assessment

app.use(
  "/api/teacher/assessment",
  teacherAssessmentRoutes
);

// Teacher grade encoding

app.use(
  "/api/teacher/grades",
  teacherGradeRoutes
);

// ==================================================
// TEACHER ANNOUNCEMENTS
// ==================================================
//
// Frontend uses:
//
// /api/teacher/announcements
//
// Routes:
//
// GET    /api/teacher/announcements
// GET    /api/teacher/announcements/:id
// POST   /api/teacher/announcements
// PUT    /api/teacher/announcements/:id
// PATCH  /api/teacher/announcements/:id/archive
// DELETE /api/teacher/announcements/:id
//
// ==================================================

app.use(
  "/api/teacher/announcements",
  teacherAnnouncementsRoutes
);

// ==============================
// STUDENT ROUTES
// ==============================

// Student schedule
//
// Frontend:
// student-schedule.js
//
// API base:
// /api/student
//
// Example:
// GET /api/student/schedule

app.use(
  "/api/student",
  studentScheduleRoutes
);

// ==================================================
// STUDENT ANNOUNCEMENTS
// ==================================================
//
// Frontend uses:
//
// /api/student/announcements
//
// Routes:
//
// GET /api/student/announcements
// GET /api/student/announcements/:id
//
// ==================================================

app.use(
  "/api/student/announcements",
  studentAnnouncementsRoutes
);

// ==================================================
// STUDENT ASSIGNMENTS
// ==================================================
//
// Frontend uses:
//
// /api/student/assignments
//
// Routes:
//
// GET /api/student/assignments
// GET /api/student/assignments/:id
//
// ==================================================

app.use(
  "/api/student/assignments",
  studentAssignmentRoutes
);

// ==============================
// HEALTH CHECK
// ==============================

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      ok: true,
      time: new Date().toISOString(),
    });
  }
);

// ==============================
// 404 API HANDLER
// ==============================

app.use(
  "/api",
  (req, res) => {
    res.status(404).json({
      ok: false,
      message: "API route not found.",
    });
  }
);

// ==============================
// ERROR HANDLER
// ==============================

app.use(
  (err, req, res, next) => {
    console.error(
      "❌ Server error:",
      err
    );

    res.status(
      err.status || 500
    ).json({
      ok: false,
      message:
        err.message ||
        "Server error",
    });
  }
);

// ==============================
// START SERVER
// ==============================

(async () => {
  try {
    await connectDB();

    startBackupScheduler();

    server = app.listen(
      PORT,
      () => {
        console.log(
          `🚀 Server running at http://localhost:${PORT}`
        );
      }
    );
  } catch (err) {
    console.error(
      "❌ Failed to start server:",
      err.message
    );

    process.exit(1);
  }
})();