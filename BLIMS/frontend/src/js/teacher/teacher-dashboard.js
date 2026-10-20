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
    // Update today's date
    setupTeacherTodayDate();

    // Fetch teacher's class + section
    loadTeacherClassSection();

    // Fetch total learners in the teacher's assigned class
    loadTotalLearners();

    // Fetch today's attendance rate
    loadAttendanceRate();

    // Load real announcements for the dashboard.
    loadDashboardAnnouncements();

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
// Dashboard Today's Date
// ==========================================

function setupTeacherTodayDate() {
  const dateEl = document.getElementById("teacherTodayDate");

  if (!dateEl) return;

  const today = new Date();

  dateEl.textContent = today.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

// ==========================================
// Teacher Class + Section
// ==========================================

async function loadTeacherClassSection() {
  const classSectionEl = document.getElementById("teacherClassSection");

  if (!classSectionEl) return;

  try {
    classSectionEl.textContent = "Loading...";

    const response = await fetch("/api/teacher/my-schedule", {
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.message || "Failed to load class section.");
    }

    const schedules = Array.isArray(data?.data) ? data.data : [];

    if (!schedules.length) {
      classSectionEl.textContent = "No assigned class";
      return;
    }

    const firstSchedule = schedules[0];

    const classSection =
      firstSchedule?.gradeSection ||
      [firstSchedule?.grade, firstSchedule?.section]
        .filter(Boolean)
        .join(" - ");

    classSectionEl.textContent = classSection || "No assigned class";
  } catch (error) {
    console.error("Failed to load teacher class and section:", error);

    classSectionEl.textContent = "Unable to load class";
  }
}

// ==========================================
// Total Learners KPI
// ==========================================

async function loadTotalLearners() {
  const countEl = document.getElementById("totalLearnersCount");

  if (!countEl) return;

  try {
    countEl.textContent = "—";

    // Get the logged-in teacher's assigned class and section.
    const scopeResponse = await fetch("/api/teacher/students/scope", {
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });

    const scopeResult = await scopeResponse.json();

    if (!scopeResponse.ok || !scopeResult?.ok) {
      throw new Error(
        scopeResult?.message || "Failed to load teacher assignment.",
      );
    }

    const className = String(scopeResult?.data?.className || "").trim();

    const sectionName = String(scopeResult?.data?.sectionName || "").trim();

    if (!className || !sectionName) {
      countEl.textContent = "0";
      return;
    }

    // Fetch active learners assigned to this class and section.
    const params = new URLSearchParams({
      className,
      sectionName,
    });

    const studentsResponse = await fetch(
      `/api/teacher/students/class?${params.toString()}`,
      {
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      },
    );

    const studentsResult = await studentsResponse.json();

    if (!studentsResponse.ok || !studentsResult?.ok) {
      throw new Error(studentsResult?.message || "Failed to load learners.");
    }

    const students = Array.isArray(studentsResult.data)
      ? studentsResult.data
      : [];

    countEl.textContent = String(students.length);
  } catch (error) {
    console.error("Failed to load total learners:", error);
    countEl.textContent = "—";
  }
}

// ==========================================
// Attendance Rate KPI
// ==========================================

async function loadAttendanceRate() {
  const rateEl = document.getElementById("attendanceRateCount");

  if (!rateEl) return;

  try {
    rateEl.textContent = "—";

    // Use the current date in the Philippines.
    const dateParts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());

    const dateValues = Object.fromEntries(
      dateParts.map(({ type, value }) => [type, value]),
    );

    const today = `${dateValues.year}-${dateValues.month}-${dateValues.day}`;

    // Load today's attendance session for the logged-in teacher.
    const response = await fetch(
      `/api/teacher/attendance/bootstrap?date=${encodeURIComponent(today)}`,
      {
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      },
    );

    const result = await response.json();

    if (!response.ok || result?.ok === false) {
      throw new Error(result?.message || "Failed to load today's attendance.");
    }

    const session = result?.data?.session;

    // No saved session means there is no attendance rate to calculate.
    if (!session || !Array.isArray(session.records)) {
      rateEl.textContent = "—";
      return;
    }

    const validStatuses = ["present", "absent", "late", "excused"];

    const records = session.records.filter((record) =>
      validStatuses.includes(
        String(record?.status || "")
          .trim()
          .toLowerCase(),
      ),
    );

    if (!records.length) {
      rateEl.textContent = "—";
      return;
    }

    const presentCount = records.filter(
      (record) => String(record.status).trim().toLowerCase() === "present",
    ).length;

    const attendanceRate = (presentCount / records.length) * 100;

    rateEl.textContent = `${attendanceRate.toFixed(1)}%`;
  } catch (error) {
    console.error("Failed to load attendance rate:", error);
    rateEl.textContent = "—";
  }
}

// ==========================================
// Dashboard Announcements
// ==========================================

async function loadDashboardAnnouncements() {
  const countEl = document.getElementById("teacherAnnouncementsCount");
  const feed = document.querySelector(".t-announcements .t-ann");

  if (!countEl && !feed) return;

  if (countEl) countEl.textContent = "—";

  if (feed) {
    feed.innerHTML = `
    <div class="t-ann-item">
      <div class="t-ann-title">Loading announcements...</div>
    </div>
  `;
  }

  try {
    const response = await fetch("/api/teacher/announcements", {
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });

    const result = await response.json();

    if (!response.ok || result?.ok === false) {
      throw new Error(result?.message || "Failed to load announcements.");
    }

    const announcements = Array.isArray(result)
      ? result
      : Array.isArray(result?.data)
        ? result.data
        : Array.isArray(result?.announcements)
          ? result.announcements
          : [];

    const now = Date.now();

    // Show published announcements only.
    const published = announcements
      .filter((announcement) => {
        if (announcement?.archived === true || announcement?.draft === true) {
          return false;
        }

        if (announcement?.publishAt) {
          const publishTime = new Date(announcement.publishAt).getTime();

          if (!Number.isNaN(publishTime) && publishTime > now) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const dateA = new Date(
          a.publishAt || a.createdAt || a.updatedAt || 0,
        ).getTime();

        const dateB = new Date(
          b.publishAt || b.createdAt || b.updatedAt || 0,
        ).getTime();

        return dateB - dateA;
      });

    // Display the total count, not just the three announcements in the preview.
    if (countEl) {
      countEl.textContent = String(published.length);
    }

    const recentAnnouncements = published.slice(0, 3);

    if (!feed) return;

    feed.innerHTML = "";

    if (!recentAnnouncements.length) {
      const item = document.createElement("div");
      item.className = "t-ann-item";

      const title = document.createElement("div");
      title.className = "t-ann-title";
      title.textContent = "No published announcements";

      item.appendChild(title);
      feed.appendChild(item);
      return;
    }

    const categoryLabels = {
      general: "General",
      events: "School Event",
      academic: "Academic",
      priority: "Priority",
    };

    recentAnnouncements.forEach((announcement) => {
      const item = document.createElement("div");
      item.className = "t-ann-item reveal-item";

      const title = document.createElement("div");
      title.className = "t-ann-title";
      title.textContent =
        announcement.title ||
        announcement.headline ||
        announcement.subject ||
        "Untitled Announcement";

      const rawDate =
        announcement.publishAt ||
        announcement.createdAt ||
        announcement.updatedAt;

      const date = rawDate ? new Date(rawDate) : null;

      const dateText =
        date && !Number.isNaN(date.getTime())
          ? date.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })
          : "Date unavailable";

      const category = String(announcement.category || "general").toLowerCase();

      const dateMeta = document.createElement("div");
      dateMeta.className = "t-ann-meta";
      dateMeta.textContent = `Date: ${dateText}`;

      const categoryMeta = document.createElement("div");
      categoryMeta.className = "t-ann-meta";
      categoryMeta.textContent = `Category: ${categoryLabels[category] || "General"}`;

      item.append(title, dateMeta, categoryMeta);
      feed.appendChild(item);
    });
  } catch (error) {
    console.error("Failed to load dashboard announcements:", error);

    if (countEl) countEl.textContent = "—";

    if (feed) {
      feed.innerHTML = "";

      const item = document.createElement("div");
      item.className = "t-ann-item";

      const title = document.createElement("div");
      title.className = "t-ann-title";
      title.textContent = "Unable to load announcements";

      item.appendChild(title);
      feed.appendChild(item);
    }
  }
}

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
    qaAttendance.addEventListener("click", () => {
      go("./teacher-attendance.html");
    });
  }

  if (qaAssessment) {
    qaAssessment.addEventListener("click", () => {
      go("./teacher-assessment.html");
    });
  }

  if (qaAnnouncements) {
    qaAnnouncements.addEventListener("click", () => {
      go("./teacher-announcements.html");
    });
  }

  if (qaGrades) {
    qaGrades.addEventListener("click", () => {
      go("./teacher-grades.html");
    });
  }

  document.querySelectorAll(".t-schedule .t-ghost").forEach((btn) => {
    btn.addEventListener("click", () => {
      go("./teacher-attendance.html");
    });
  });
}

function isDashboardPage(activeKey) {
  if (activeKey === "dashboard" || activeKey === "teacher-dashboard")
    return true;

  const path = window.location.pathname || "";
  return (
    path.endsWith("/teacher-dashboard.html") || path.endsWith("/dashboard.html")
  );
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
    const monthName = current.toLocaleString("en-US", {
      month: "long",
    });

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

        el.title = evts
          .map((x) => x.title)
          .slice(0, 3)
          .join(" • ");
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
          }),
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
