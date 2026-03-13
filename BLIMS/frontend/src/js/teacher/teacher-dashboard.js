// frontend/src/js/teacher/teacher-dashboard.js
document.addEventListener("DOMContentLoaded", () => {
  // ============================
  // 1) TOPBAR USER MENU (same logic as admin)
  // ============================
  const userMenuBtn = document.getElementById("userMenuBtn");
  const userMenu = document.getElementById("userMenu");
  const userbox = document.getElementById("userbox");

  if (userMenuBtn && userMenu && userbox) {
    userMenuBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      userMenu.classList.toggle("open");
    });

    document.addEventListener("click", (ev) => {
      if (!userbox.contains(ev.target)) userMenu.classList.remove("open");
    });
  }

  // ============================
  // 2) LOGOUT (calls backend)
  // ============================
  const topbarLogout = document.getElementById("topbarLogout");
  if (topbarLogout) {
    topbarLogout.addEventListener("click", async () => {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "include",
          headers: { Accept: "application/json" },
        });
      } catch (err) {
        console.error("Logout request failed:", err);
      }

      // optional cleanup (you had these)
      localStorage.removeItem("token");
      localStorage.removeItem("user");

      // ✅ redirect to root (server serves login.html at "/")
      window.location.replace("/");
    });
  }

  // ============================
  // 3) QUICK ACTIONS NAVIGATION
  // ============================
  const go = (path) => (window.location.href = path);

  const qaAttendance = document.getElementById("qaAttendance");
  const qaAssessment = document.getElementById("qaAssessment");
  const qaAnnouncements = document.getElementById("qaAnnouncements");
  const qaGrades = document.getElementById("qaGrades");

  if (qaAttendance) qaAttendance.addEventListener("click", () => go("./teacher-attendance.html"));
  if (qaAssessment) qaAssessment.addEventListener("click", () => go("./teacher-assessment.html"));
  if (qaAnnouncements) qaAnnouncements.addEventListener("click", () => go("./teacher-announcements.html"));
  if (qaGrades) qaGrades.addEventListener("click", () => go("./teacher-grades.html"));

  // NOTE: Your current HTML doesn’t show ".t-ghost" buttons inside schedule,
  // so this will only work if those buttons exist in the page.
  document.querySelectorAll(".t-schedule .t-ghost").forEach((btn) => {
    btn.addEventListener("click", () => go("./teacher-attendance.html"));
  });
});