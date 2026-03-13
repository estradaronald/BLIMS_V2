// frontend/src/js/student/student-attendance.js

document.addEventListener("DOMContentLoaded", () => {
  initTopbarMenu();
  initLogout();
  initAttendance();
});

function $(id) {
  return document.getElementById(id);
}

/* ===============================
   TOPBAR
================================= */
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

/* ===============================
   ATTENDANCE (Student)
   - Admin Active SY: blims_school_years_v1
   - Student active class: blims_active_student_class_v1
   - Attendance records (prototype): blims_attendance_v1
   - Backend-ready: keep parsing isolated in normalizeRecord()
================================= */
function initAttendance() {
  const gradeSectionEl = $("attGradeSection");
  const syLabelEl = $("attSYLabel");

  const sySelect = $("attSYSelect");
  const monthSelect = $("attMonthSelect");

  const tabTable = $("attTabTable");
  const tabCal = $("attTabCalendar");

  const viewTable = $("attViewTable");
  const viewCal = $("attViewCalendar");

  const tbody = $("attTbody");
  const calTitle = $("attCalTitle");
  const calGrid = $("attCalGrid");

  const empty = $("attEmpty");

  const presentEl = $("attPresent");
  const absentEl = $("attAbsent");
  const lateEl = $("attLate");
  const rateEl = $("attRate");

  if (
    !sySelect || !monthSelect || !tabTable || !tabCal ||
    !viewTable || !viewCal || !tbody || !calTitle || !calGrid ||
    !empty || !presentEl || !absentEl || !lateEl || !rateEl
  ) return;

  // LS keys
  const LS_ACTIVE_CLASS = "blims_active_student_class_v1";
  const LS_SCHOOL_YEARS = "blims_school_years_v1";
  const LS_ATT = "blims_attendance_v1";

    // ✅ DEV ONLY: seed mock attendance if empty
  function seedAttendanceIfEmpty(activeSY, cls) {
    const existing = readJSON(LS_ATT, null);
    if (Array.isArray(existing) && existing.length) return;

    function iso(y, m, d) {
      const mm = String(m).padStart(2, "0");
      const dd = String(d).padStart(2, "0");
      return `${y}-${mm}-${dd}`;
    }

    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;

    const demo = [
      { date: iso(y, m, 1), status: "present", remarks: "", grade: cls.grade, section: cls.section, schoolYear: activeSY },
      { date: iso(y, m, 2), status: "present", remarks: "", grade: cls.grade, section: cls.section, schoolYear: activeSY },
      { date: iso(y, m, 3), status: "late", remarks: "Arrived 10 mins late", grade: cls.grade, section: cls.section, schoolYear: activeSY },
      { date: iso(y, m, 4), status: "present", remarks: "", grade: cls.grade, section: cls.section, schoolYear: activeSY },
      { date: iso(y, m, 5), status: "absent", remarks: "Sick leave", grade: cls.grade, section: cls.section, schoolYear: activeSY },

      { date: iso(y, m, 8), status: "present", remarks: "", grade: cls.grade, section: cls.section, schoolYear: activeSY },
      { date: iso(y, m, 9), status: "present", remarks: "", grade: cls.grade, section: cls.section, schoolYear: activeSY },
      { date: iso(y, m, 10), status: "present", remarks: "", grade: cls.grade, section: cls.section, schoolYear: activeSY },
      { date: iso(y, m, 11), status: "late", remarks: "Traffic", grade: cls.grade, section: cls.section, schoolYear: activeSY },
      { date: iso(y, m, 12), status: "present", remarks: "", grade: cls.grade, section: cls.section, schoolYear: activeSY },
    ];

    localStorage.setItem(LS_ATT, JSON.stringify(demo));
    console.log("[Attendance] Mock data seeded.");
  }

  const state = {
    mode: "table",     // table | calendar
    sy: "",            // active school year name from admin, e.g. "2025-2026"
    month: "all",      // "all" or "0..11"
  };

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function norm(s) {
    return String(s || "").trim().toLowerCase();
  }

  function getActiveClass() {
    try {
      const raw = localStorage.getItem(LS_ACTIVE_CLASS);
      if (raw) {
        const v = JSON.parse(raw);
        if (v && v.grade != null && v.section != null) {
          return { grade: String(v.grade), section: String(v.section) };
        }
      }
    } catch {}
    // fallback demo
    return { grade: "Grade 6", section: "A" };
  }

  function getAdminActiveSY() {
    const store = readJSON(LS_SCHOOL_YEARS, null);
    if (!store || !Array.isArray(store.items)) return "";
    const active = store.items.find((x) => x && x.id === store.activeId);
    return active ? String(active.name || "").trim() : "";
  }

  // Admin-controlled: single option (active SY only)
  function buildSYFromAdmin() {
    const adminSY = getAdminActiveSY();

    if (!adminSY) {
      sySelect.innerHTML = `<option value="">SY —</option>`;
      sySelect.disabled = true;
      state.sy = "";
      return;
    }

    state.sy = adminSY;
    sySelect.innerHTML = `<option value="${escapeHtml(adminSY)}">SY ${escapeHtml(adminSY)}</option>`;
    sySelect.value = adminSY;
    sySelect.disabled = true;
  }

  // Normalize record shape so backend integration later is easy
  // Expected prototype shape (suggested):
  // { date:"2026-02-10", status:"present|absent|late", remarks:"", grade:"Grade 6", section:"A", schoolYear:"2025-2026" }
  function normalizeRecord(r) {
    if (!r || typeof r !== "object") return null;

    const date = String(r.date || r.day || r.attDate || "").trim();
    if (!date) return null;

    const statusRaw = norm(r.status || r.state || r.attendance || "");
    const status =
      statusRaw.includes("abs") ? "absent" :
      statusRaw.includes("late") ? "late" :
      statusRaw.includes("pres") ? "present" :
      "present";

    const remarks = String(r.remarks || r.note || "").trim();

    const grade = String(r.grade || r.gradeLevel || "").trim();
    const section = String(r.section || r.classSection || "").trim();
    const schoolYear = String(r.schoolYear || r.sy || "").trim();

    return { date, status, remarks, grade, section, schoolYear, raw: r };
  }

  function gradeMatches(itemGrade, activeGrade) {
    const a = norm(activeGrade);
    const g = norm(itemGrade);
    if (!a) return true;
    if (!g) return true;
    const aNum = a.match(/\d+/)?.[0] || "";
    const gNum = g.match(/\d+/)?.[0] || "";
    return a === g || (aNum && gNum && aNum === gNum);
  }

  function sectionMatches(itemSection, activeSection) {
    const a = norm(activeSection);
    const s = norm(itemSection);
    if (!a) return true;
    if (!s) return true;
    const aLetter = a.replace(/section/g, "").trim();
    const sLetter = s.replace(/section/g, "").trim();
    return a === s || aLetter === s || sLetter === a || aLetter === sLetter;
  }

  function parseMonthIndex(dateStr) {
    // expects YYYY-MM-DD
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return null;
    return d.getMonth(); // 0..11
  }

  function niceDate(dateStr) {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr || "—";
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  }

  function statusPill(status) {
    const cls =
      status === "present" ? "att-status att-present" :
      status === "absent" ? "att-status att-absent" :
      "att-status att-late";

    const txt =
      status === "present" ? "Present" :
      status === "absent" ? "Absent" :
      "Late";

    return `<span class="${cls}">${txt}</span>`;
  }

  function setMode(mode) {
    const isTable = mode === "table";

    tabTable.classList.toggle("active", isTable);
    tabTable.setAttribute("aria-selected", isTable ? "true" : "false");

    tabCal.classList.toggle("active", !isTable);
    tabCal.setAttribute("aria-selected", !isTable ? "true" : "false");

    viewTable.classList.toggle("hidden", !isTable);
    viewCal.classList.toggle("hidden", isTable);

    state.mode = mode;
  }

  function computeSummary(list) {
    let present = 0, absent = 0, late = 0;
    list.forEach((r) => {
      if (r.status === "present") present++;
      else if (r.status === "absent") absent++;
      else if (r.status === "late") late++;
    });

    const total = present + absent + late;
    const attended = present + late;
    const rate = total ? Math.round((attended / total) * 100) : 0;

    presentEl.textContent = String(present);
    absentEl.textContent = String(absent);
    lateEl.textContent = String(late);
    rateEl.textContent = total ? `${rate}%` : "—";
  }

  function renderTable(list) {
    tbody.innerHTML = "";

    // newest first
    const sorted = list.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));

    sorted.forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(niceDate(r.date))}</td>
        <td>${statusPill(r.status)}</td>
        <td>${escapeHtml(r.remarks || "—")}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function monthName(idx) {
    const names = ["January","February","March","April","May","June","July","August","September","October","November","December"];
    return names[idx] || "Month";
  }

  function renderCalendar(list) {
    // If month is "all", just show current month for calendar view
    let monthIdx = state.month === "all" ? new Date().getMonth() : Number(state.month);

    if (Number.isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11) monthIdx = new Date().getMonth();

    calTitle.textContent = monthName(monthIdx);

    // Build a map dateStr -> status (if multiple, prioritize absent > late > present)
    const map = new Map();
    list.forEach((r) => {
      const mi = parseMonthIndex(r.date);
      if (mi !== monthIdx) return;

      const prev = map.get(r.date);
      if (!prev) return map.set(r.date, r.status);

      const rank = (s) => (s === "absent" ? 3 : s === "late" ? 2 : 1);
      if (rank(r.status) > rank(prev)) map.set(r.date, r.status);
    });

    // Calendar grid for the month (simple)
    const year = new Date().getFullYear(); // frontend-only; backend can set this later
    const first = new Date(year, monthIdx, 1);
    const last = new Date(year, monthIdx + 1, 0);

    const startDow = first.getDay(); // 0 Sun .. 6 Sat
    const daysInMonth = last.getDate();

    calGrid.innerHTML = "";

    // pad blanks
    for (let i = 0; i < startDow; i++) {
      const blank = document.createElement("div");
      blank.className = "att-cal-day";
      blank.style.opacity = "0";
      calGrid.appendChild(blank);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, monthIdx, day);
      const iso = d.toISOString().slice(0, 10);

      const st = map.get(iso) || "";
      const cell = document.createElement("div");
      cell.className = "att-cal-day" + (st ? ` ${st}` : "");

      cell.innerHTML = `
        <div>${day}</div>
        <div style="font-weight:1000; font-size:10px; opacity:.8;">
          ${st ? (st === "present" ? "P" : st === "absent" ? "A" : "L") : ""}
        </div>
      `;

      calGrid.appendChild(cell);
    }
  }

  function getFilteredRecords() {
    const cls = getActiveClass();
    buildSYFromAdmin();

    // Header labels
    if (gradeSectionEl) gradeSectionEl.textContent = `${cls.grade} - Section ${cls.section}`;
    if (syLabelEl) syLabelEl.textContent = state.sy ? `SY ${state.sy}` : "SY —";

    // If no active SY set by admin, nothing to show
    if (!state.sy) return { cls, list: [] };

    const raw = readJSON(LS_ATT, []);
    const all = Array.isArray(raw) ? raw : [];

    let list = all
      .map(normalizeRecord)
      .filter(Boolean)
      .filter((r) => gradeMatches(r.grade, cls.grade))
      .filter((r) => sectionMatches(r.section, cls.section))
      .filter((r) => !r.schoolYear || r.schoolYear === state.sy);

    if (state.month !== "all") {
      const m = Number(state.month);
      list = list.filter((r) => parseMonthIndex(r.date) === m);
    }

    return { cls, list };
  }

  function render() {
  const cls = getActiveClass();
  buildSYFromAdmin();

  // ✅ seed mock data ONLY if empty and we have active SY
  if (state.sy) {
    seedAttendanceIfEmpty(state.sy, cls);
  }

  const { list } = getFilteredRecords();

    computeSummary(list);

    // Empty state handling
    const hasAny = list.length > 0;

    empty.classList.toggle("hidden", hasAny);
    viewTable.classList.toggle("hidden", !hasAny && state.mode === "table" ? false : state.mode !== "table");
    // Keep calendar visible when selected, even if empty
    // (we still show empty message below the views)
    // We'll just render empty views.
    if (state.mode === "table") renderTable(list);
    else renderCalendar(list);

    // If no records, still render blank table header (tbody empty) + calendar grid
    if (!hasAny) {
      if (state.mode === "table") tbody.innerHTML = "";
      else renderCalendar(list);
    }
  }

  // Events
  tabTable.addEventListener("click", () => {
    setMode("table");
    render();
  });

  tabCal.addEventListener("click", () => {
    setMode("calendar");
    render();
  });

  monthSelect.addEventListener("change", () => {
    state.month = monthSelect.value || "all";
    render();
  });

  // SY is admin-controlled single option but keep safe
  sySelect.addEventListener("change", () => {
    state.sy = sySelect.value || "";
    render();
  });

  // Boot
  setMode("table");
  render();
}