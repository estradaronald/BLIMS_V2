// frontend/src/js/student/student-dashboard.js

document.addEventListener("DOMContentLoaded", () => {
  setupTopbarMenu();
  setupLogout();
  setupHeroToday();
  setupQuickActions();
});

// ---------- Shared helpers (same style as admin-dashboard.js) ----------
function setupTopbarMenu() {
  const userMenuBtn = document.getElementById("userMenuBtn");
  const userMenu = document.getElementById("userMenu");
  const userbox = document.getElementById("userbox");
  if (!userMenuBtn || !userMenu || !userbox) return;

  userMenuBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    userMenu.classList.toggle("open");
  });

  document.addEventListener("click", (ev) => {
    if (!userbox.contains(ev.target)) userMenu.classList.remove("open");
  });
}

function setupLogout() {
  const topbarLogout = document.getElementById("topbarLogout");
  if (!topbarLogout) return;

  topbarLogout.addEventListener("click", () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/";
  });
}

function setupHeroToday() {
  const heroToday = document.getElementById("heroToday");
  if (!heroToday) return;

  try {
    const d = new Date();
    heroToday.textContent = d.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  } catch {}
}

function setupQuickActions() {
  const qaSchedule = document.getElementById("qaSchedule");
  const qaGrades = document.getElementById("qaGrades");
  const qaClasswork = document.getElementById("qaClasswork");
  const qaAnnouncements = document.getElementById("qaAnnouncements");

  const go = (href) => (window.location.href = href);

  // ✅ Use your student page filenames
  qaSchedule && qaSchedule.addEventListener("click", () => go("./student-schedule.html"));
  qaGrades && qaGrades.addEventListener("click", () => go("./student-grades.html"));
  qaClasswork && qaClasswork.addEventListener("click", () => go("./student-classwork.html"));
  qaAnnouncements && qaAnnouncements.addEventListener("click", () => go("./student-announcements.html"));
}