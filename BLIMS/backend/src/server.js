const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const express = require("express");
const cors = require("cors");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;

const connectDB = require("./config/db");
const authRoutes = require("./routes/auth.routes");

const adminTeachersRoutes = require("./routes/admin.teachers.routes");
const adminStudentsRoutes = require("./routes/admin.students.routes");
const adminDashboardRoutes = require("./routes/admin.dashboard.routes");
const adminAuditRoutes = require("./routes/admin.audit.routes");

// Grade Levels & Sections
const adminGradeLevelsRoutes = require("./routes/admin-grade-levels.routes");

// Subjects
const adminSubjectsRoutes = require("./routes/admin-subjects.routes");

// School Years
const adminSchoolYearsRoutes = require("./routes/admin.school-years.routes");

const { ensureCsrfToken, csrfProtect } = require("./middlewares/csrf");

// Backup Scheduler
const { startBackupScheduler } = require("./backup/backupDatabase");

const app = express();
let server;

// ==============================
// Trust proxy
// ==============================
app.set("trust proxy", 1);

// ==============================
// CORS
// ==============================
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

// ==============================
// Body parsers
// ==============================
app.use("/api", express.json({ limit: "20kb" }));
app.use("/api", express.urlencoded({ extended: true, limit: "20kb" }));

// ==============================
// Session
// ==============================
const SESSION_SECRET = process.env.SESSION_SECRET;
const MONGO_URL = process.env.MONGO_URL;

if (!SESSION_SECRET) {
  console.error("❌ Missing SESSION_SECRET in .env");
  process.exit(1);
}

if (!MONGO_URL) {
  console.error("❌ Missing MONGO_URL in .env");
  process.exit(1);
}

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
app.use("/api", ensureCsrfToken);

app.get("/api/csrf-token", (req, res) => {
  res.json({ ok: true, csrfToken: req.session?.csrfToken || "" });
});

app.use("/api/admin", csrfProtect);
app.use("/api/auth/change-password", csrfProtect);

// ==============================
// Serve Frontend
// ==============================
const FRONTEND_DIR = path.join(__dirname, "../../frontend");
app.use(express.static(FRONTEND_DIR));

app.get("/", (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, "login.html"));
});

// ==============================
// API Routes
// ==============================
app.use("/api/auth", authRoutes);

app.use("/api/admin", adminTeachersRoutes);
app.use("/api/admin", adminStudentsRoutes);
app.use("/api/admin", adminDashboardRoutes);
app.use("/api/admin", adminAuditRoutes);
app.use("/api/admin", adminGradeLevelsRoutes);
app.use("/api/admin", adminSubjectsRoutes);
app.use("/api/admin", adminSchoolYearsRoutes);

// ==============================
// Health
// ==============================
app.get("/api/health", (req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// ==============================
// Error Handler
// ==============================
app.use((err, req, res, next) => {
  console.error("❌ Server error:", err);
  res.status(500).json({ ok: false, message: err.message || "Server error" });
});

// ==============================
// Start Server
// ==============================
const PORT = process.env.PORT || 5000;

(async () => {
  try {
    await connectDB();

    // Start automatic backup scheduler
    startBackupScheduler();

    server = app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
    });

  } catch (err) {
    console.error("❌ Failed to start server:", err.message);
    process.exit(1);
  }
})();