// frontend/src/js/teacher/teacher-dashboard.js

document.addEventListener("DOMContentLoaded", () => {
  const activeKey = (document.body?.dataset?.page || "dashboard").trim();

  // ==========================================
  // 1) TOPBAR USER MENU
  // ==========================================
  setupTopbarMenu();

  // ==========================================
  // 2) LOGOUT (teacher backend-connected)
  // ==========================================
  setupLogout();

  // ==========================================
  // 3) QUICK ACTIONS NAVIGATION
  // ==========================================
  setupQuickActions();

  // ==========================================
  // 4) DASHBOARD-ONLY FEATURES
  // ==========================================
  if (isDashboardPage(activeKey)) {
    setupMiniCalendar({
      events: {
        "2026-02-03": [{ title: "Faculty Meeting" }],
        "2026-02-10": [{ title: "Math Quiz" }, { title: "Recitation" }],
        "2026-02-15": [{ title: "Nutrition Month" }],
      },
      persistSelected: true,
    });
  }
});

// ==========================================
// Shared helpers
// ==========================================
function setupTopbarMenu() {
  const userMenuBtn = document.getElementById("userMenuBtn");
  const userMenu = document.getElementById("userMenu");
  const userbox = document.getElementById("userbox");

  if (!userMenuBtn || !userMenu || !userbox) return;

  userMenuBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    userMenu.classList.toggle("open");
  });

  userMenu.addEventListener("click", (ev) => {
    ev.stopPropagation();
  });

  userbox.addEventListener("click", (ev) => {
    ev.stopPropagation();
  });

  document.addEventListener("click", () => {
    userMenu.classList.remove("open");
  });
}

function setupLogout() {
  const topbarLogout = document.getElementById("topbarLogout");
  if (!topbarLogout) return;

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

    localStorage.removeItem("token");
    localStorage.removeItem("user");

    window.location.replace("/");
  });
}

function setupQuickActions() {
  const go = (path) => {
    window.location.href = path;
  };

  const qaAttendance = document.getElementById("qaAttendance");
  const qaAssessment = document.getElementById("qaAssessment");
  const qaAnnouncements = document.getElementById("qaAnnouncements");
  const qaGrades = document.getElementById("qaGrades");

  if (qaAttendance) {
    qaAttendance.addEventListener("click", () => go("./teacher-attendance.html"));
  }

  if (qaAssessment) {
    qaAssessment.addEventListener("click", () => go("./teacher-assessment.html"));
  }

  if (qaAnnouncements) {
    qaAnnouncements.addEventListener("click", () => go("./teacher-announcements.html"));
  }

  if (qaGrades) {
    qaGrades.addEventListener("click", () => go("./teacher-grades.html"));
  }

  document.querySelectorAll(".t-schedule .t-ghost").forEach((btn) => {
    btn.addEventListener("click", () => go("./teacher-attendance.html"));
  });
}

function isDashboardPage(activeKey) {
  if (activeKey === "dashboard" || activeKey === "teacher-dashboard") return true;

  const path = window.location.pathname || "";
  return path.endsWith("/teacher-dashboard.html") || path.endsWith("/dashboard.html");
}

// ==========================================
// Mini Calendar
// ==========================================
function setupMiniCalendar(options = {}) {
  const title = document.getElementById("calTitle");
  const grid = document.getElementById("calGrid");
  const prev = document.getElementById("calPrev");
  const next = document.getElementById("calNext");

  if (!title || !grid || !prev || !next) return;

  const EVENTS = options.events || {};
  const PERSIST = !!options.persistSelected;
  const SELECT_KEY = "teacher_calendar_selected_v1";

  const today = new Date();
  const todayY = today.getFullYear();
  const todayM = today.getMonth();
  const todayD = today.getDate();

  let current = new Date(todayY, todayM, 1);
  let selected = new Date(todayY, todayM, todayD);

  if (PERSIST) {
    const saved = localStorage.getItem(SELECT_KEY);
    if (saved) {
      const parsed = new Date(saved);
      if (!Number.isNaN(parsed.getTime())) {
        selected = parsed;
      }
    }
  }

  const pad2 = (n) => String(n).padStart(2, "0");
  const toKey = (d) =>
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

  const isSameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const render = () => {
    grid.innerHTML = "";

    const year = current.getFullYear();
    const month = current.getMonth();
    const monthName = current.toLocaleString("en-US", { month: "long" });
    title.textContent = `${monthName} ${year}`;

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
      const el = document.createElement("div");
      el.className = "cal-cell is-empty";
      el.setAttribute("aria-hidden", "true");
      grid.appendChild(el);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(year, month, day);
      const key = toKey(dateObj);

      const el = document.createElement("button");
      el.type = "button";
      el.className = "cal-cell cal-day";
      el.textContent = String(day);
      el.dataset.date = key;

      if (year === todayY && month === todayM && day === todayD) {
        el.classList.add("today");
      }

      if (isSameDay(dateObj, selected)) {
        el.classList.add("selected");
      }

      const evts = EVENTS[key];
      if (Array.isArray(evts) && evts.length) {
        el.classList.add("has-events");

        const dots = document.createElement("span");
        dots.className = "cal-dots";

        const count = Math.min(3, evts.length);
        for (let i = 0; i < count; i++) {
          const dot = document.createElement("i");
          dot.className = "cal-dot";
          dots.appendChild(dot);
        }

        el.appendChild(dots);
        el.title = evts.map((x) => x.title).slice(0, 3).join(" • ");
      }

      el.addEventListener("click", () => {
        selected = dateObj;

        if (PERSIST) {
          localStorage.setItem(SELECT_KEY, selected.toISOString());
        }

        grid.querySelectorAll(".cal-day.selected").forEach((b) => {
          b.classList.remove("selected");
        });

        el.classList.add("selected");

        window.dispatchEvent(
          new CustomEvent("calendar:select", {
            detail: {
              date: key,
              events: EVENTS[key] || [],
            },
          })
        );
      });

      grid.appendChild(el);
    }
  };

  prev.addEventListener("click", () => {
    current = new Date(current.getFullYear(), current.getMonth() - 1, 1);
    render();
  });

  next.addEventListener("click", () => {
    current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
    render();
  });

  render();
}