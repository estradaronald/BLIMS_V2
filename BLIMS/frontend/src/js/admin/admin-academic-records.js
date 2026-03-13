// frontend/src/js/admin-academic-records.js
// Academic Records (Admin) - standalone LocalStorage
// - Filter by grade/section + search
// - Editable Q1-Q4 in table
// - Final Average auto-calculated
// - Promote button + status tracking
// - Export CSV: All vs Current Class/Section

document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  const LS_KEY = "blims_academic_records_v1";
  const LS_GRADESECTIONS = "blims_grade_sections_v1";

  const DEFAULT_GRADES = ["Kinder","Grade 1","Grade 2","Grade 3","Grade 4","Grade 5","Grade 6"];
  const DEFAULT_SECTION = "A";

  // UI
  const gradeSelect = $("gradeSelect");
  const sectionSelect = $("sectionSelect");
  const searchInput = $("searchInput");
  const recordsTbody = $("recordsTbody");
  const summaryLine = $("summaryLine");

  const exportBtn = $("exportBtn");
  const exportMenu = $("exportMenu");
  const exportAllBtn = $("exportAllBtn");
  const exportClassBtn = $("exportClassBtn");

  // confirm modal
  const confirmModal = $("confirmModal");
  const confirmBackdrop = $("confirmBackdrop");
  const confirmCloseX = $("confirmCloseX");
  const confirmCancel = $("confirmCancel");
  const confirmYes = $("confirmYes");
  const confirmText = $("confirmText");
  const confirmError = $("confirmError");

  let pendingPromoteId = null;

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

  // ---------- grade/section store ----------
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
    const gs = readGradeSectionsStore();
    if (gs) {
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

  // ---------- records store ----------
  function seedStore() {
    const data = [];
    localStorage.setItem(LS_KEY, JSON.stringify(data));
    return data;
  }

  function readStore() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      const data = raw ? JSON.parse(raw) : null;
      if (!Array.isArray(data)) return seedStore();
      return data;
    } catch {
      return seedStore();
    }
  }

  function writeStore(data) {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  }

  function ensureClassRecords(grade, section) {
    // If no records exist for this class, create a lightweight starter list.
    // This keeps the page usable even before student pages are wired.
    const store = readStore();
    const exists = store.some((r) => r.grade === grade && r.section === section);
    if (exists) return;

    const starters = [
      "Juan Dela Cruz",
      "Maria Santos",
      "Jose Rizal",
      "Ana Reyes",
      "Carlo Mendoza",
    ];

    starters.forEach((name) => {
      store.push({
        id: `AR-${Math.random().toString(16).slice(2)}-${Date.now()}`,
        grade,
        section,
        student: name,
        q1: "",
        q2: "",
        q3: "",
        q4: "",
        status: "pending", // pending | promoted | retained
        updatedAt: Date.now(),
      });
    });

    writeStore(store);
  }

  // ---------- compute ----------
  function toNum(v) {
    const n = Number(String(v ?? "").trim());
    return Number.isFinite(n) ? n : null;
  }

  function computeFinal(rec) {
    const vals = [toNum(rec.q1), toNum(rec.q2), toNum(rec.q3), toNum(rec.q4)].filter((x) => x != null);
    if (!vals.length) return null;
    const sum = vals.reduce((a, b) => a + b, 0);
    const avg = sum / vals.length;
    return Math.round(avg * 100) / 100;
  }

  function statusPill(status) {
    const s = norm(status);
    const cls = ["promoted","retained","pending"].includes(s) ? s : "pending";
    const label = cls === "pending" ? "Pending" : cls.charAt(0).toUpperCase() + cls.slice(1);
    return `<span class="ar-status ${cls}">${esc(label)}</span>`;
  }

  // ---------- filters ----------
  function buildGradeSelect() {
    const grades = getGrades();
    gradeSelect.innerHTML = grades.map((g) => `<option value="${esc(g)}">${esc(g)}</option>`).join("");
    if (!grades.includes(gradeSelect.value)) gradeSelect.value = grades[0] || DEFAULT_GRADES[0];
  }

  function buildSectionSelect() {
    const secs = getSections(gradeSelect.value);
    sectionSelect.innerHTML = secs.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
    if (!secs.includes(sectionSelect.value)) sectionSelect.value = secs[0] || DEFAULT_SECTION;
  }

  function applyFilters(store) {
    const g = gradeSelect.value;
    const s = sectionSelect.value;
    const q = norm(searchInput.value);

    let out = store.filter((r) => r.grade === g && r.section === s);

    if (q) {
      out = out.filter((r) => norm(r.student).includes(q));
    }

    out.sort((a, b) => (a.student || "").localeCompare(b.student || ""));
    return out;
  }

  // ---------- render ----------
  function render() {
    buildGradeSelect();
    buildSectionSelect();

    // ensure starter records for current class so page isn't dead
    ensureClassRecords(gradeSelect.value, sectionSelect.value);

    const store = readStore();
    const rows = applyFilters(store);

    summaryLine.textContent = `Showing: ${gradeSelect.value} • Section ${sectionSelect.value} • ${rows.length} student(s)`;

    if (!rows.length) {
      recordsTbody.innerHTML = `<tr class="ar-empty"><td colspan="9">No records found.</td></tr>`;
      return;
    }

    recordsTbody.innerHTML = rows.map((r, idx) => {
      const avg = computeFinal(r);
      const promoteDisabled = norm(r.status) === "promoted";

      return `
        <tr data-id="${esc(r.id)}">
          <td>${idx + 1}</td>
          <td><strong>${esc(r.student)}</strong></td>

          <td style="text-align:center;">
            <input class="ar-grade" data-k="q1" inputmode="decimal" value="${esc(r.q1)}" placeholder="—" />
          </td>
          <td style="text-align:center;">
            <input class="ar-grade" data-k="q2" inputmode="decimal" value="${esc(r.q2)}" placeholder="—" />
          </td>
          <td style="text-align:center;">
            <input class="ar-grade" data-k="q3" inputmode="decimal" value="${esc(r.q3)}" placeholder="—" />
          </td>
          <td style="text-align:center;">
            <input class="ar-grade" data-k="q4" inputmode="decimal" value="${esc(r.q4)}" placeholder="—" />
          </td>

          <td class="ar-avg">${avg == null ? "—" : esc(avg)}</td>
          <td style="text-align:center;">${statusPill(r.status)}</td>
          <td style="text-align:center;">
            <div class="ar-actions">
              <button class="ar-btn ar-promote" data-act="promote" ${promoteDisabled ? "disabled" : ""}>Promote</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    // bind edit inputs
    recordsTbody.querySelectorAll("tr[data-id]").forEach((tr) => {
      const id = tr.getAttribute("data-id");
      if (!id) return;

      tr.querySelectorAll("input[data-k]").forEach((inp) => {
        inp.addEventListener("input", () => {
          // basic sanitization: allow digits + dot
          inp.value = inp.value.replace(/[^0-9.]/g, "");

          const k = inp.getAttribute("data-k");
          const storeNow = readStore();
          const idx = storeNow.findIndex((x) => x.id === id);
          if (idx === -1) return;

          storeNow[idx][k] = inp.value;
          storeNow[idx].updatedAt = Date.now();
          writeStore(storeNow);

          // update avg display live
          const avgCell = tr.querySelector(".ar-avg");
          if (avgCell) {
            const avg = computeFinal(storeNow[idx]);
            avgCell.textContent = avg == null ? "—" : String(avg);
          }
        });
      });

      const promoteBtn = tr.querySelector("button[data-act='promote']");
      if (promoteBtn) {
        promoteBtn.addEventListener("click", () => {
          openConfirm(id);
        });
      }
    });
  }

  // ---------- promote confirm ----------
  function openConfirm(id) {
    pendingPromoteId = id;
    confirmError.classList.add("hidden");
    confirmError.textContent = "";

    const store = readStore();
    const rec = store.find((x) => x.id === id);
    if (!rec) return;

    const avg = computeFinal(rec);
    confirmText.textContent = `Promote "${rec.student}" from ${rec.grade} Section ${rec.section}? Final Avg: ${avg == null ? "—" : avg}`;
    confirmModal.classList.remove("hidden");
    confirmModal.setAttribute("aria-hidden", "false");
    setTimeout(() => confirmYes.focus(), 0);
  }

  function closeConfirm() {
    confirmModal.classList.add("hidden");
    confirmModal.setAttribute("aria-hidden", "true");
    pendingPromoteId = null;
  }

  function confirmPromote() {
    if (!pendingPromoteId) return;

    const store = readStore();
    const idx = store.findIndex((x) => x.id === pendingPromoteId);
    if (idx === -1) return;

    const avg = computeFinal(store[idx]);
    // Optional simple rule: if avg exists and < 75, keep pending (or mark retained)
    // For now: allow promoting regardless (admin decision).
    store[idx].status = "promoted";
    store[idx].updatedAt = Date.now();
    writeStore(store);

    closeConfirm();
    render();
  }

  // ---------- export ----------
  function csvEscape(value) {
    const s = String(value ?? "");
    const needs = /[",\n]/.test(s);
    const out = s.replaceAll('"', '""');
    return needs ? `"${out}"` : out;
  }

  function exportCSV(mode) {
    const store = readStore();
    let rows = store.slice();

    if (mode === "class") {
      rows = rows.filter((r) => r.grade === gradeSelect.value && r.section === sectionSelect.value);
    }

    rows.sort((a, b) => (a.student || "").localeCompare(b.student || ""));

    const headers = ["Grade Level","Section","Student","Q1","Q2","Q3","Q4","Final Average","Status"];
    const lines = [headers.join(",")];

    rows.forEach((r) => {
      const avg = computeFinal(r);
      lines.push([
        csvEscape(r.grade),
        csvEscape(r.section),
        csvEscape(r.student),
        csvEscape(r.q1),
        csvEscape(r.q2),
        csvEscape(r.q3),
        csvEscape(r.q4),
        csvEscape(avg == null ? "" : avg),
        csvEscape(r.status),
      ].join(","));
    });

    const csv = lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });

    const filename =
      mode === "class"
        ? `academic_records_${gradeSelect.value}_Section_${sectionSelect.value}.csv`
        : `academic_records_ALL.csv`;

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename.replaceAll(" ", "_");
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1200);
  }

  // ---------- export menu UX ----------
  function toggleExportMenu() {
    exportMenu.classList.toggle("hidden");
  }
  function closeExportMenu() {
    exportMenu.classList.add("hidden");
  }

  exportBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleExportMenu();
  });
  exportAllBtn.addEventListener("click", () => {
    closeExportMenu();
    exportCSV("all");
  });
  exportClassBtn.addEventListener("click", () => {
    closeExportMenu();
    exportCSV("class");
  });

  document.addEventListener("click", () => closeExportMenu());
  exportMenu.addEventListener("click", (e) => e.stopPropagation());

  // confirm modal events
  confirmBackdrop.addEventListener("click", closeConfirm);
  confirmCloseX.addEventListener("click", closeConfirm);
  confirmCancel.addEventListener("click", closeConfirm);
  confirmYes.addEventListener("click", confirmPromote);

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!confirmModal.classList.contains("hidden")) closeConfirm();
    closeExportMenu();
  });

  // filters
  gradeSelect.addEventListener("change", () => {
    buildSectionSelect();
    render();
  });
  sectionSelect.addEventListener("change", render);
  searchInput.addEventListener("input", render);

  // init
  buildGradeSelect();
  buildSectionSelect();
  render();
});
