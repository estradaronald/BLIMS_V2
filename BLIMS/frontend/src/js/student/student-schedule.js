// frontend/src/js/student/student-schedule.js
document.addEventListener("DOMContentLoaded", () => {
  initTopbarMenu();
  initLogout();
  initScheduleView();
});

function $(id) {
  return document.getElementById(id);
}

function initTopbarMenu() {
  const userMenuBtn = $("userMenuBtn");
  const userMenu = $("userMenu");
  const userbox = $("userbox");
  if (!userMenuBtn || !userMenu || !userbox) return;

  userMenuBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    userMenu.classList.toggle("open");
  });

  document.addEventListener("click", (ev) => {
    if (!userbox.contains(ev.target)) userMenu.classList.remove("open");
  });
}

function initLogout() {
  const btn = $("topbarLogout");
  if (!btn) return;
  btn.addEventListener("click", () => {
    window.location.href = "../../login.html";
  });
}

function initScheduleView() {
  const viewWeekBtn = $("viewWeekBtn");
  const viewDayBtn = $("viewDayBtn");
  const daySelect = $("daySelect");

  const weekView = $("weekView");
  const dayView = $("dayView");
  const dayViewTitle = $("dayViewTitle");
  const dayViewList = $("dayViewList");
  const empty = $("schedEmpty");

  // header fields
  const gradeSectionEl = $("schedGradeSection");
  const roomEl = $("schedRoom");

  if (!viewWeekBtn || !viewDayBtn || !daySelect || !weekView || !dayView || !dayViewTitle || !dayViewList) {
    return;
  }

  const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri"];
  const DAY_LABELS = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday" };

  // ✅ MUST match Admin schedule LS key
  const LS_SCHEDULE = "blims_class_schedule_v1";

  function readLS(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function escapeHtml(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function toKeyFromDay(day) {
    const d = String(day || "").toLowerCase();
    if (d.startsWith("mon")) return "mon";
    if (d.startsWith("tue")) return "tue";
    if (d.startsWith("wed")) return "wed";
    if (d.startsWith("thu")) return "thu";
    if (d.startsWith("fri")) return "fri";
    return "";
  }

  function toMinutes(hhmm) {
    if (!hhmm || typeof hhmm !== "string" || !hhmm.includes(":")) return 99999;
    const [h, m] = hhmm.split(":").map((n) => Number(n));
    return (h * 60) + (m || 0);
  }

  function fmtTime(hhmm) {
    if (!hhmm || typeof hhmm !== "string" || !hhmm.includes(":")) return hhmm || "—";
    const [h, m] = hhmm.split(":").map((n) => Number(n));
    const d = new Date();
    d.setHours(h || 0, m || 0, 0, 0);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }

  function fmtRange(start, end) {
    const a = fmtTime(start);
    const b = fmtTime(end);
    return `${a}–${b}`;
  }

  // ✅ Recommended: read active class from localStorage (frontend-only but backend-ready)
  function getActiveClass() {
    try {
      const raw = localStorage.getItem("blims_active_student_class_v1");
      if (raw) {
        const v = JSON.parse(raw);
        if (v && v.grade && v.section) return { grade: String(v.grade), section: String(v.section) };
      }
    } catch {}

    const label = String(gradeSectionEl?.textContent || "").trim();
    const m = label.match(/^(.*?)(?:-|\u2013)\s*Section\s*(.+)$/i);
    if (m) return { grade: m[1].trim(), section: m[2].trim() };

    return { grade: "Grade 6", section: "A" };
  }

  function mostCommonRoom(rows) {
    const freq = new Map();
    rows.forEach((r) => {
      const v = String(r.room || "").trim();
      if (!v) return;
      freq.set(v, (freq.get(v) || 0) + 1);
    });

    let best = "";
    let bestN = 0;
    for (const [room, n] of freq.entries()) {
      if (n > bestN) {
        best = room;
        bestN = n;
      }
    }

    if (!best) return "Room —";
    const cleaned = best.replace(/^room\s*/i, "").trim();
    return cleaned ? `Room ${cleaned}` : "Room —";
  }

  function buildScheduleMapFromAdmin(list, cls) {
    const map = { mon: [], tue: [], wed: [], thu: [], fri: [] };

    const rows = Array.isArray(list)
      ? list.filter((x) => x && x.grade === cls.grade && String(x.section) === String(cls.section))
      : [];

    rows.forEach((x) => {
      const key = toKeyFromDay(x.day);
      if (!key) return;

      map[key].push({
        startRaw: x.start || "",
        time: fmtRange(x.start, x.end),
        subject: x.subject || "—",
        teacher: x.teacher || "—",
      });
    });

    DAY_KEYS.forEach((k) => {
      map[k].sort((a, b) => toMinutes(a.startRaw) - toMinutes(b.startRaw));
      map[k] = map[k].map(({ startRaw, ...rest }) => rest);
    });

    return { map, rows };
  }

  function clearWeekColumns() {
    const cols = Array.from(weekView.querySelectorAll(".sched-col"));
    cols.forEach((col) => {
      col.querySelectorAll(".sched-item").forEach((n) => n.remove());
    });
  }

  function renderWeek(map) {
    const cols = Array.from(weekView.querySelectorAll(".sched-col"));

    cols.forEach((col) => {
      const head = col.querySelector(".sched-col-head")?.textContent?.trim().toLowerCase() || "";
      const key =
        head.startsWith("mon") ? "mon" :
        head.startsWith("tue") ? "tue" :
        head.startsWith("wed") ? "wed" :
        head.startsWith("thu") ? "thu" :
        head.startsWith("fri") ? "fri" : null;

      if (!key) return;

      col.querySelectorAll(".sched-item").forEach((n) => n.remove());

      const items = map[key] || [];
      items.forEach((x) => {
        const it = document.createElement("div");
        it.className = "sched-item";
        it.innerHTML = `
          <div class="sched-time">${escapeHtml(x.time)}</div>
          <div class="sched-main">
            <div class="sched-subject">${escapeHtml(x.subject)}</div>
            <div class="sched-meta">${escapeHtml(x.teacher)}</div>
          </div>
        `;
        col.appendChild(it);
      });
    });
  }

  function setActiveTab(mode) {
    const isWeek = mode === "week";

    viewWeekBtn.classList.toggle("active", isWeek);
    viewWeekBtn.setAttribute("aria-selected", isWeek ? "true" : "false");

    viewDayBtn.classList.toggle("active", !isWeek);
    viewDayBtn.setAttribute("aria-selected", !isWeek ? "true" : "false");

    weekView.classList.toggle("hidden", !isWeek);
    dayView.classList.toggle("hidden", isWeek);

    // ✅ now dropdown is only disabled in Week mode (normal behavior)
    daySelect.disabled = isWeek;
  }

  function renderDay(map, key) {
    const items = map[key] || [];
    dayViewTitle.textContent = DAY_LABELS[key] || "Day";
    dayViewList.innerHTML = "";

    if (!items.length) {
      empty?.classList.remove("hidden");
      return;
    }
    empty?.classList.add("hidden");

    items.forEach((x) => {
      const row = document.createElement("div");
      row.className = "sched-item";
      row.innerHTML = `
        <div class="sched-time">${escapeHtml(x.time)}</div>
        <div class="sched-main">
          <div class="sched-subject">${escapeHtml(x.subject)}</div>
          <div class="sched-meta">${escapeHtml(x.teacher)}</div>
        </div>
      `;
      dayViewList.appendChild(row);
    });
  }

  // ✅ NEW: keep tabs clickable; just show empty state when needed
  function applyEmptyUI(isEmpty, mode) {
    if (isEmpty) {
      empty?.classList.remove("hidden");

      // clear any leftover schedule items so it looks clean
      clearWeekColumns();
      dayViewList.innerHTML = "";

      // keep views visible depending on mode (so toggles feel normal)
      setActiveTab(mode || "week");
    } else {
      empty?.classList.add("hidden");
    }
  }

  function boot() {
    const cls = getActiveClass();
    const adminList = readLS(LS_SCHEDULE, []);
    const { map, rows } = buildScheduleMapFromAdmin(adminList, cls);

    // Header
    if (gradeSectionEl) gradeSectionEl.textContent = `${cls.grade} - Section ${cls.section}`;
    if (roomEl) roomEl.textContent = mostCommonRoom(rows);

    // Default mode: week
    daySelect.value = "mon";
    setActiveTab("week");

    // Render / empty UI
    if (!rows.length) {
      applyEmptyUI(true, "week");
    } else {
      applyEmptyUI(false, "week");
      renderWeek(map);
    }

    // Events: always clickable now
    viewDayBtn.addEventListener("click", () => {
      setActiveTab("day");

      if (!rows.length) {
        applyEmptyUI(true, "day");
        dayViewTitle.textContent = DAY_LABELS[daySelect.value || "mon"] || "Day";
        return;
      }

      applyEmptyUI(false, "day");
      renderDay(map, daySelect.value || "mon");
    });

    viewWeekBtn.addEventListener("click", () => {
      setActiveTab("week");

      if (!rows.length) {
        applyEmptyUI(true, "week");
        return;
      }

      applyEmptyUI(false, "week");
      renderWeek(map);
    });

    daySelect.addEventListener("change", () => {
      if (!rows.length) {
        applyEmptyUI(true, "day");
        dayViewTitle.textContent = DAY_LABELS[daySelect.value || "mon"] || "Day";
        return;
      }
      renderDay(map, daySelect.value || "mon");
    });
  }

  boot();
}