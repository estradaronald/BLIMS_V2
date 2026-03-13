// frontend/src/js/teacher/teacher-attendance.js
// Teacher Attendance: one page, two states (home vs take attendance).
// Stores sessions in localStorage and shows YTD summary for the school year (Jun 1 – Mar 31).

const $ = (id) => document.getElementById(id);

const LS_KEYS = {
  STUDENTS: "rbms_students_v1",
  ATTENDANCE: "rbms_attendance_v1",
};

function readLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function writeLS(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ---------- Teacher scope (same idea as teacher-students.js) ----------
function normalize(s) {
  return String(s || "").trim();
}
function getTeacherScope() {
  const u = readLS("user", {}) || {};

  const cls =
    u.handledClass ||
    u.className ||
    u.class ||
    u.advisoryClass ||
    u.gradeLevel ||
    "";

  const sec =
    u.handledSection ||
    u.sectionName ||
    u.section ||
    u.advisorySection ||
    "";

  const combined =
    u.classSection ||
    u.handledClassSection ||
    u.advisory ||
    u.assignedClass ||
    u.roleLabel ||
    u.roleText ||
    "";

  if ((!cls || !sec) && combined) {
    const m = String(combined).match(
      /(Class\s*\d+|Grade\s*\d+)\s*-\s*([A-Za-z0-9]+)/i
    );
    if (m)
      return {
        className: normalize(cls || m[1]),
        sectionName: normalize(sec || m[2]),
      };
  }

  return { className: normalize(cls), sectionName: normalize(sec) };
}
const TEACHER_SCOPE = getTeacherScope();

// ---------- State ----------
let students = [];
let attendanceSessions = [];

let activeScope = { className: "", sectionName: "" };
let activeDateISO = "";
let viewMode = "home"; // "home" | "take"
let rowFilter = "all"; // all|present|absent|late|excused

// temp (unsaved) marks for current take session: { [studentId]: status }
let draftMarks = {};
let savedForThisSession = false;

// ---------- Utilities ----------
function fullName(s) {
  return [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" ");
}
function pad2(n) {
  return String(n).padStart(2, "0");
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function formatLongDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
function scopeLabel(scope) {
  return [scope.className, scope.sectionName].filter(Boolean).join(" - ") || "—";
}
function sessionId(iso, scope) {
  // stable ID per date + scope
  const c = (scope.className || "").replace(/\s+/g, "_");
  const s = (scope.sectionName || "").replace(/\s+/g, "_");
  return `ATT-${iso}-${c}_${s}`;
}
function inTeacherScope(stu) {
  if (!TEACHER_SCOPE.className || !TEACHER_SCOPE.sectionName) return true;
  return (
    (stu.className || "") === TEACHER_SCOPE.className &&
    (stu.sectionName || "") === TEACHER_SCOPE.sectionName
  );
}
function studentsInActiveScope() {
  return students.filter((s) => {
    const okTeacher = inTeacherScope(s);
    if (!okTeacher) return false;

    if (activeScope.className && activeScope.sectionName) {
      return (
        (s.className || "") === activeScope.className &&
        (s.sectionName || "") === activeScope.sectionName
      );
    }
    return true;
  });
}

// ---------- School year range: June 1 – March 31 ----------
function getSchoolYearRange(forDateISO) {
  const d = new Date(forDateISO + "T00:00:00");
  const y = d.getFullYear();
  const m = d.getMonth() + 1; // 1-12

  // If date is Jan/Feb/Mar, the school year started last year June 1
  const startYear = m <= 3 ? y - 1 : y;

  const start = `${startYear}-06-01`;
  const end = `${startYear + 1}-03-31`;

  return { start, end };
}
function withinRange(iso, startISO, endISO) {
  return iso >= startISO && iso <= endISO;
}

// ---------- View switching ----------
function setView(mode) {
  viewMode = mode;
  const home = $("attHomeView");
  const take = $("attTakeView");
  const backBtn = $("attBackBtn");

  if (mode === "home") {
    home?.classList.remove("hidden");
    take?.classList.add("hidden");
    backBtn?.classList.add("hidden");
    return;
  }

  home?.classList.add("hidden");
  take?.classList.remove("hidden");
  backBtn?.classList.remove("hidden");
}

// ---------- Scope selector ----------
function buildScopeOptions() {
  const sel = $("scopeSelect");
  if (!sel) return;

  sel.innerHTML = "";

  // If teacher scope exists, lock to it
  if (TEACHER_SCOPE.className && TEACHER_SCOPE.sectionName) {
    const opt = document.createElement("option");
    opt.value = `${TEACHER_SCOPE.className}||${TEACHER_SCOPE.sectionName}`;
    opt.textContent = `${TEACHER_SCOPE.className} - ${TEACHER_SCOPE.sectionName}`;
    sel.appendChild(opt);
    sel.value = opt.value;
    sel.disabled = true;

    activeScope = {
      className: TEACHER_SCOPE.className,
      sectionName: TEACHER_SCOPE.sectionName,
    };
    return;
  }

  // fallback: derive scopes from students list
  const scopes = new Map(); // key -> label
  students.forEach((s) => {
    const c = (s.className || "").trim();
    const sec = (s.sectionName || "").trim();
    if (!c || !sec) return;
    const key = `${c}||${sec}`;
    if (!scopes.has(key)) scopes.set(key, `${c} - ${sec}`);
  });

  if (scopes.size === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No class/section found";
    sel.appendChild(opt);
    sel.disabled = true;
    activeScope = { className: "", sectionName: "" };
    return;
  }

  // ✅ FIX: correct iteration
  [...scopes.entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))
    .forEach(([key, label]) => {
      const opt = document.createElement("option");
      opt.value = key;
      opt.textContent = label;
      sel.appendChild(opt);
    });

  sel.disabled = false;
  sel.value = sel.options[0].value;
  const [c, sec] = sel.value.split("||");
  activeScope = { className: c, sectionName: sec };
}

function syncHomeSubtitle() {
  const sub = $("attHomeSub");
  if (!sub) return;
  sub.textContent = `Ready for ${scopeLabel(activeScope)} • ${formatLongDate(
    activeDateISO
  )}`;
}

// ---------- YTD summary ----------
function computeYtdCounts(scope, baseDateISO) {
  const { start, end } = getSchoolYearRange(baseDateISO);

  const sessions = attendanceSessions.filter((sess) => {
    if ((sess.className || "") !== scope.className) return false;
    if ((sess.sectionName || "") !== scope.sectionName) return false;
    if (!sess.date) return false;
    return withinRange(sess.date, start, end);
  });

  // Map studentId => counts
  const counts = new Map();
  const classStudents = studentsInActiveScope();

  classStudents.forEach((stu) => {
    counts.set(stu.studentId, {
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      total: 0,
    });
  });

  sessions.forEach((sess) => {
    (sess.records || []).forEach((r) => {
      const sid = r.studentId;
      if (!counts.has(sid)) return;
      const c = counts.get(sid);
      const st = (r.status || "").toLowerCase();

      if (st === "present") c.present++;
      else if (st === "absent") c.absent++;
      else if (st === "late") c.late++;
      else if (st === "excused") c.excused++;

      c.total++;
    });
  });

  return { start, end, counts, sessionDays: sessions.length };
}

function renderYtdTable() {
  const tbody = $("ytdTbody");
  if (!tbody) return;

  const classStudents = studentsInActiveScope();
  tbody.innerHTML = "";

  if (
    !activeScope.className ||
    !activeScope.sectionName ||
    classStudents.length === 0
  ) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="8" class="att-empty">No students found for this class & section.</td>`;
    tbody.appendChild(tr);
    return;
  }

  const { start, end, counts, sessionDays } = computeYtdCounts(
    activeScope,
    activeDateISO
  );
  const sub = $("attYtdSub");
  if (sub)
    sub.textContent = `Counts are within the school year: ${start} to ${end} • Sessions recorded: ${sessionDays}`;

  classStudents.forEach((stu, idx) => {
    const c = counts.get(stu.studentId) || {
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      total: 0,
    };
    const pct = c.total ? Math.round((c.present / c.total) * 100) : 0;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${String(idx + 1).padStart(2, "0")}</td>
      <td>
        <div class="att-student-cell">
          <img class="att-avatar" src="${
            stu.photoDataUrl || "../../assets/images/bg.jpg"
          }" alt="">
          <div>
            <div class="att-name">${fullName(stu) || "—"}</div>
            <div class="att-subid">${stu.studentId || "—"}</div>
          </div>
        </div>
      </td>
      <td>${c.present}</td>
      <td>${c.absent}</td>
      <td>${c.late}</td>
      <td>${c.excused}</td>
      <td>${c.total}</td>
      <td>${c.total ? `${pct}%` : "—"}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ---------- Take session rendering ----------
function setSessionHeader() {
  $("sessionTitle").textContent = scopeLabel(activeScope);
  $("sessionDateLabel").textContent = formatLongDate(activeDateISO);
}

function ensureDraftMarks() {
  const list = studentsInActiveScope();

  // default to blank
  draftMarks = {};
  list.forEach((stu) => {
    draftMarks[stu.studentId] = "";
  });

  // If session exists, load existing marks
  const sid = sessionId(activeDateISO, activeScope);
  const existing = attendanceSessions.find((s) => s.id === sid);
  if (existing) {
    (existing.records || []).forEach((r) => {
      if (draftMarks.hasOwnProperty(r.studentId)) {
        draftMarks[r.studentId] = (r.status || "").toLowerCase();
      }
    });
    savedForThisSession = true;
    setSessionStatus(true);
  } else {
    savedForThisSession = false;
    setSessionStatus(false);
  }
}

function setSessionStatus(isSaved) {
  const box = $("sessionStatus");
  if (!box) return;

  if (isSaved) {
    box.textContent = "Saved";
    box.style.background = "rgba(25, 135, 84, 0.14)";
    box.style.color = "#0f5132";
  } else {
    box.textContent = "Not Saved";
    box.style.background = "rgba(255, 193, 7, 0.16)";
    box.style.color = "#7a5b00";
  }
}

function renderTakeTable() {
  const tbody = $("takeTbody");
  if (!tbody) return;

  const list = studentsInActiveScope();
  tbody.innerHTML = "";

  if (list.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="5" class="att-empty">No students found.</td>`;
    tbody.appendChild(tr);
    renderSideSummary();
    return;
  }

  const filtered = list.filter((stu) => {
    if (rowFilter === "all") return true;
    return (draftMarks[stu.studentId] || "") === rowFilter;
  });

  if (filtered.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="5" class="att-empty">No students match this filter.</td>`;
    tbody.appendChild(tr);
    renderSideSummary();
    return;
  }

  filtered.forEach((stu) => {
    const sid = stu.studentId;
    const status = (draftMarks[sid] || "").toLowerCase();

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div class="att-student-cell">
          <img class="att-avatar" src="${
            // ✅ FIX fallback path
            stu.photoDataUrl || "../../assets/images/bg.jpg"
          }" alt="">
          <div>
            <div class="att-name">${fullName(stu) || "—"}</div>
            <div class="att-subid">${sid || "—"}</div>
          </div>
        </div>
      </td>

      <td style="text-align:center">
        <input class="att-radio" type="radio" name="att_${sid}" data-sid="${sid}" value="present" ${
          status === "present" ? "checked" : ""
        } />
      </td>
      <td style="text-align:center">
        <input class="att-radio" type="radio" name="att_${sid}" data-sid="${sid}" value="absent" ${
          status === "absent" ? "checked" : ""
        } />
      </td>
      <td style="text-align:center">
        <input class="att-radio" type="radio" name="att_${sid}" data-sid="${sid}" value="late" ${
          status === "late" ? "checked" : ""
        } />
      </td>
      <td style="text-align:center">
        <input class="att-radio" type="radio" name="att_${sid}" data-sid="${sid}" value="excused" ${
          status === "excused" ? "checked" : ""
        } />
      </td>
    `;
    tbody.appendChild(tr);
  });

  renderSideSummary();
}

function renderSideSummary() {
  const list = studentsInActiveScope();
  const total = list.length;

  let p = 0,
    a = 0,
    l = 0,
    e = 0;
  list.forEach((stu) => {
    const st = (draftMarks[stu.studentId] || "").toLowerCase();
    if (st === "present") p++;
    else if (st === "absent") a++;
    else if (st === "late") l++;
    else if (st === "excused") e++;
  });

  $("sumPresent").textContent = String(p);
  $("sumAbsent").textContent = String(a);
  $("sumLate").textContent = String(l);
  $("sumExcused").textContent = String(e);
  $("sumTotal").textContent = String(total);
}

// ---------- Actions ----------
function setChipActive(filter) {
  rowFilter = filter;
  document.querySelectorAll("#statusChips .att-chip").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.filter === filter);
  });
  renderTakeTable();
}

function markAll(status) {
  const list = studentsInActiveScope();
  list.forEach((stu) => {
    draftMarks[stu.studentId] = status;
  });
  savedForThisSession = false;
  setSessionStatus(false);
  renderTakeTable();
}

function clearAll() {
  const list = studentsInActiveScope();
  list.forEach((stu) => {
    draftMarks[stu.studentId] = "";
  });
  savedForThisSession = false;
  setSessionStatus(false);
  renderTakeTable();
}

function loadLastSession() {
  // find most recent session before activeDateISO for this scope
  const relevant = attendanceSessions
    .filter(
      (s) =>
        (s.className || "") === activeScope.className &&
        (s.sectionName || "") === activeScope.sectionName
    )
    .filter((s) => s.date && s.date < activeDateISO)
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  if (relevant.length === 0) {
    alert("No previous session found.");
    return;
  }

  const last = relevant[0];
  // reset to empty then fill
  const list = studentsInActiveScope();
  list.forEach((stu) => (draftMarks[stu.studentId] = ""));
  (last.records || []).forEach((r) => {
    if (draftMarks.hasOwnProperty(r.studentId)) {
      draftMarks[r.studentId] = (r.status || "").toLowerCase();
    }
  });

  savedForThisSession = false;
  setSessionStatus(false);
  renderTakeTable();
}

function saveAttendance() {
  const list = studentsInActiveScope();
  if (list.length === 0) return alert("No students to mark.");

  const auto = $("autoExcused")?.checked;

  const records = list.map((stu) => {
    let st = (draftMarks[stu.studentId] || "").toLowerCase();
    if (!st && auto) st = "excused";
    return { studentId: stu.studentId, status: st || "excused" };
  });

  const sid = sessionId(activeDateISO, activeScope);
  const now = Date.now();

  const payload = {
    id: sid,
    date: activeDateISO,
    className: activeScope.className,
    sectionName: activeScope.sectionName,
    records,
    updatedAt: now,
  };

  const existingIdx = attendanceSessions.findIndex((s) => s.id === sid);
  if (existingIdx >= 0) {
    payload.createdAt = attendanceSessions[existingIdx].createdAt || now;
    attendanceSessions[existingIdx] = payload;
  } else {
    payload.createdAt = now;
    attendanceSessions.push(payload);
  }

  writeLS(LS_KEYS.ATTENDANCE, attendanceSessions);

  savedForThisSession = true;
  setSessionStatus(true);

  // refresh home summary too
  renderYtdTable();

  // ✅ go back to home view after saving
  setView("home");
}

// ---------- Init ----------
function loadData() {
  students = readLS(LS_KEYS.STUDENTS, []).filter(inTeacherScope);
  attendanceSessions = readLS(LS_KEYS.ATTENDANCE, []);
}

// ✅ Refresh when returning from Students page (or another tab)
function refreshFromStorage() {
  const prevScope = `${activeScope.className}||${activeScope.sectionName}`;

  loadData();
  buildScopeOptions();

  // keep previous selection if still exists and not locked
  const sel = $("scopeSelect");
  if (sel && !sel.disabled) {
    const found = [...sel.options].some((o) => o.value === prevScope);
    if (found) {
      sel.value = prevScope;
      const [c, s] = prevScope.split("||");
      activeScope = { className: c || "", sectionName: s || "" };
    }
  }

  syncHomeSubtitle();
  renderYtdTable();

  if (viewMode === "take") {
    ensureDraftMarks();
    renderTakeTable();
  }
}

function bindEvents() {
  $("dateInput")?.addEventListener("change", () => {
    activeDateISO = $("dateInput").value || todayISO();
    syncHomeSubtitle();
    renderYtdTable();
  });

  $("scopeSelect")?.addEventListener("change", () => {
    const v = $("scopeSelect").value || "";
    const [c, s] = v.split("||");
    activeScope = { className: c || "", sectionName: s || "" };
    syncHomeSubtitle();
    renderYtdTable();
  });

  $("takeAttendanceBtn")?.addEventListener("click", () => {
    setView("take");
    setSessionHeader();
    setChipActive("all");
    ensureDraftMarks();
    renderTakeTable();
  });

  $("attBackBtn")?.addEventListener("click", () => setView("home"));
  $("cancelTakeBtn")?.addEventListener("click", () => setView("home"));

  $("statusChips")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-filter]");
    if (!btn) return;
    setChipActive(btn.dataset.filter);
  });

  $("takeTbody")?.addEventListener("change", (e) => {
    const el = e.target;
    if (!(el instanceof HTMLInputElement)) return;
    if (!el.classList.contains("att-radio")) return;

    const sid = el.dataset.sid;
    const val = (el.value || "").toLowerCase();
    if (!sid) return;

    draftMarks[sid] = val;
    savedForThisSession = false;
    setSessionStatus(false);
    renderSideSummary();
  });

  $("markAllPresentBtn")?.addEventListener("click", () => markAll("present"));
  $("quickMarkAllPresent")?.addEventListener("click", () => markAll("present"));

  $("quickClearAll")?.addEventListener("click", () => clearAll());

  $("loadLastSessionBtn")?.addEventListener("click", () => loadLastSession());

  $("saveAttendanceBtn")?.addEventListener("click", () => saveAttendance());

  // ✅ refresh when user returns to this page
  window.addEventListener("focus", refreshFromStorage);
  window.addEventListener("pageshow", refreshFromStorage); // handles bfcache
  window.addEventListener("storage", (e) => {
    if (e.key === LS_KEYS.STUDENTS) refreshFromStorage();
  });
}

document.addEventListener("DOMContentLoaded", () => {
  loadData();

  activeDateISO = todayISO();
  const dateInput = $("dateInput");
  if (dateInput) dateInput.value = activeDateISO;

  buildScopeOptions();
  syncHomeSubtitle();

  renderYtdTable();
  setView("home");

  bindEvents();
});
