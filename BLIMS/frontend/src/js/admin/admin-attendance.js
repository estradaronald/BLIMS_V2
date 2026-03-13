// frontend/src/js/admin-attendance.js
// Admin Attendance Monitoring (Template 2: Monitor)
// Reads attendance records from teacher attendance LS (shared store).
// - Filters: date, grade, section, status, search
// - Export filtered view to CSV
//
// Important: We do NOT assume a single LS key; we try common keys.
// If nothing exists, we show empty state but keep UI functional.

document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  // Try common teacher attendance LS keys (adjust/add if your project uses a different one)
  const TEACHER_ATT_KEYS_TRY = [
    "blims_teacher_attendance_v1",
    "blims_attendance_v1",
    "rbms_teacher_attendance_v1",
    "rbms_attendance_v1",
    "teacher_attendance_v1",
    "attendance_v1"
  ];

  // Optional: grade/section store (from your grade-levels page)
  const LS_GRADESECTIONS = "blims_grade_sections_v1";

  const DEFAULT_GRADES = ["Kinder","Grade 1","Grade 2","Grade 3","Grade 4","Grade 5","Grade 6"];
  const DEFAULT_SECTION = "A";

  // UI
  const dateInput = $("dateInput");
  const gradeSelect = $("gradeSelect");
  const sectionSelect = $("sectionSelect");
  const statusSelect = $("statusSelect");
  const searchInput = $("searchInput");
  const attTbody = $("attTbody");
  const exportCsvBtn = $("exportCsvBtn");
  const refreshBtn = $("refreshBtn");
  const summaryLine = $("summaryLine");
  const dataSourceNote = $("dataSourceNote");

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }
  function norm(s) {
    return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function todayISO() {
    const d = new Date();
    // local YYYY-MM-DD
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  // -------- data reading (shared store) --------
  function tryReadKey(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed;
    } catch {
      return null;
    }
  }

  function normalizeRecords(anyData) {
    // We accept multiple shapes and normalize into:
    // { date, grade, section, student, status, teacher, remarks }
    //
    // supported examples:
    // - array of records
    // - { items: [...] } / { records: [...] } / { data: [...] }
    // - nested by date/grade/section (best-effort flatten)

    let arr = null;

    if (Array.isArray(anyData)) arr = anyData;
    else if (anyData && typeof anyData === "object") {
      const cand = anyData.items || anyData.records || anyData.data || anyData.list;
      if (Array.isArray(cand)) arr = cand;
    }

    if (Array.isArray(arr)) {
      return arr
        .map((r) => {
          const date = r.date || r.attDate || r.day || r.createdAtDate || "";
          const grade = r.grade || r.gradeLevel || r.level || "";
          const section = r.section || r.classSection || r.sec || "";
          const student = r.student || r.studentName || r.name || r.pupil || "";
          const status = (r.status || r.attendanceStatus || r.state || "").toString();
          const teacher = r.teacher || r.teacherName || r.adviser || "";
          const remarks = r.remarks || r.note || r.notes || "";
          return {
            date: String(date || "").slice(0, 10),
            grade: String(grade || ""),
            section: String(section || ""),
            student: String(student || ""),
            status: norm(status) || "",
            teacher: String(teacher || ""),
            remarks: String(remarks || ""),
          };
        })
        .filter((x) => x.date || x.student || x.grade || x.section || x.status || x.teacher || x.remarks);
    }

    // Best-effort flatten for nested object style:
    // { "2026-02-19": { "Grade 1": { "A": [ {student,status,...} ] } } }
    if (anyData && typeof anyData === "object") {
      const out = [];
      for (const [kDate, v1] of Object.entries(anyData)) {
        if (!v1 || typeof v1 !== "object") continue;
        for (const [kGrade, v2] of Object.entries(v1)) {
          if (!v2 || typeof v2 !== "object") continue;
          for (const [kSec, v3] of Object.entries(v2)) {
            if (!Array.isArray(v3)) continue;
            v3.forEach((r) => {
              out.push({
                date: String(kDate).slice(0, 10),
                grade: String(kGrade),
                section: String(kSec),
                student: String(r?.student || r?.studentName || r?.name || ""),
                status: norm(r?.status || r?.attendanceStatus || ""),
                teacher: String(r?.teacher || r?.teacherName || ""),
                remarks: String(r?.remarks || r?.note || ""),
              });
            });
          }
        }
      }
      return out;
    }

    return [];
  }

  function loadAttendance() {
    for (const key of TEACHER_ATT_KEYS_TRY) {
      const parsed = tryReadKey(key);
      if (parsed == null) continue;

      const recs = normalizeRecords(parsed);
      if (recs.length) {
        dataSourceNote.textContent = `Data source: LocalStorage "${key}"`;
        return { key, recs };
      }
    }

    dataSourceNote.textContent = `Data source: none found (waiting for teacher attendance records)`;
    return { key: null, recs: [] };
  }

  // -------- grade/section helpers --------
  function readGradeSectionsStore() {
    try {
      const raw = localStorage.getItem(LS_GRADESECTIONS);
      const obj = raw ? JSON.parse(raw) : null;
      if (!obj || typeof obj !== "object") return null;
      return obj;
    } catch {
      return null;
    }
  }

  function getGrades() {
    // use store if exists (custom grade names), else default
    const gs = readGradeSectionsStore();
    if (gs && typeof gs === "object") {
      const keys = Object.keys(gs);
      if (keys.length) return keys;
    }
    return DEFAULT_GRADES.slice();
  }

  function getSections(grade) {
    const gs = readGradeSectionsStore();
    if (gs && Array.isArray(gs[grade]) && gs[grade].length) {
      const names = gs[grade].map((x) => x.section).filter(Boolean);
      if (names.length) return names;
    }
    return [DEFAULT_SECTION];
  }

  // -------- render --------
  function buildGradeSelect() {
    const grades = getGrades();
    gradeSelect.innerHTML = grades.map((g) => `<option value="${esc(g)}">${esc(g)}</option>`).join("");
    if (!grades.includes(gradeSelect.value)) gradeSelect.value = grades[0] || DEFAULT_GRADES[0];
  }

  function buildSectionSelect() {
    const grade = gradeSelect.value;
    const secs = getSections(grade);
    sectionSelect.innerHTML = secs.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
    if (!secs.includes(sectionSelect.value)) sectionSelect.value = secs[0] || DEFAULT_SECTION;
  }

  function applyFilters(recs) {
    const fDate = dateInput.value;
    const fGrade = gradeSelect.value;
    const fSection = sectionSelect.value;
    const fStatus = statusSelect.value;
    const q = norm(searchInput.value);

    let out = recs.slice();

    if (fDate) out = out.filter((r) => r.date === fDate);
    if (fGrade) out = out.filter((r) => r.grade === fGrade);
    if (fSection) out = out.filter((r) => r.section === fSection);

    if (fStatus !== "all") out = out.filter((r) => norm(r.status) === fStatus);

    if (q) {
      out = out.filter((r) => {
        const blob = norm(`${r.student} ${r.teacher} ${r.remarks} ${r.status} ${r.grade} ${r.section} ${r.date}`);
        return blob.includes(q);
      });
    }

    // stable sort: student name
    out.sort((a, b) => (a.student || "").localeCompare(b.student || ""));
    return out;
  }

  function statusPill(statusRaw) {
    const s = norm(statusRaw);
    const cls = ["present","absent","late","excused"].includes(s) ? s : "";
    const label = s || "—";
    return `<span class="att-status ${cls}">${esc(label)}</span>`;
  }

  function render() {
    const { recs } = loadAttendance();

    // keep selects populated
    buildGradeSelect();
    buildSectionSelect();

    const filtered = applyFilters(recs);

    // summary
    const d = dateInput.value ? dateInput.value : "Any date";
    const g = gradeSelect.value || "Any grade";
    const s = sectionSelect.value ? `Section ${sectionSelect.value}` : "Any section";
    const st = statusSelect.value === "all" ? "All statuses" : statusSelect.value;
    summaryLine.textContent = `Showing: ${d} • ${g} • ${s} • ${st} • ${filtered.length} record(s)`;

    // table
    if (!filtered.length) {
      attTbody.innerHTML = `
        <tr class="att-empty">
          <td colspan="7">No attendance records found.</td>
        </tr>
      `;
      return;
    }

    attTbody.innerHTML = filtered.map((r, idx) => {
      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${esc(r.date || "—")}</td>
          <td><strong>${esc(r.grade || "—")}</strong> • ${esc(r.section || "—")}</td>
          <td><strong>${esc(r.student || "—")}</strong></td>
          <td>${statusPill(r.status)}</td>
          <td>${esc(r.teacher || "—")}</td>
          <td>${esc(r.remarks || "—")}</td>
        </tr>
      `;
    }).join("");
  }

  // -------- CSV export --------
  function csvEscape(value) {
    const s = String(value ?? "");
    // Escape quotes and wrap in quotes if needed
    const needs = /[",\n]/.test(s);
    const out = s.replaceAll('"', '""');
    return needs ? `"${out}"` : out;
  }

  function exportCSV() {
    const { recs, key } = loadAttendance();
    const filtered = applyFilters(recs);

    const headers = ["Date","Grade Level","Section","Student","Status","Teacher","Remarks"];
    const lines = [headers.join(",")];

    filtered.forEach((r) => {
      lines.push([
        csvEscape(r.date),
        csvEscape(r.grade),
        csvEscape(r.section),
        csvEscape(r.student),
        csvEscape(r.status),
        csvEscape(r.teacher),
        csvEscape(r.remarks),
      ].join(","));
    });

    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });

    const d = dateInput.value || todayISO();
    const g = gradeSelect.value || "AllGrades";
    const s = sectionSelect.value || "AllSections";

    const filename = `attendance_${d}_${g}_${s}${key ? "" : "_EMPTY"}.csv`
      .replaceAll(" ", "_")
      .replaceAll("•", "-");

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1200);
  }

  // events
  exportCsvBtn.addEventListener("click", exportCSV);
  refreshBtn.addEventListener("click", render);

  dateInput.addEventListener("change", render);
  gradeSelect.addEventListener("change", () => {
    buildSectionSelect();
    render();
  });
  sectionSelect.addEventListener("change", render);
  statusSelect.addEventListener("change", render);
  searchInput.addEventListener("input", render);

  // init defaults
  dateInput.value = todayISO();
  buildGradeSelect();
  buildSectionSelect();
  render();
});
