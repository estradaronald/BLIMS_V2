// frontend/src/js/admin-class-schedule.js
// Class Schedule (Admin) - hybrid version
// - Grade levels + section counts + sections fetched from backend
// - Subjects from localStorage subjects page
// - Teachers from localStorage fallback keys
// - Schedule entries still stored in localStorage
// - Conflict checks:
//   A) overlaps per Grade+Section+Day
//   B) overlaps per Teacher+Day

document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  // Storage
  const LS_SCHEDULE = "blims_class_schedule_v1";
  const LS_SUBJECTS = "blims_subjects_v1";

  const API_BASE = "/api/admin";

  // Unknown teacher key in your project; try common keys first
  const TEACHER_KEYS_TRY = [
    "blims_teachers_v1",
    "rbms_teachers_v1",
    "rbms_teachers",
    "teachers_v1",
    "blims_admin_teachers_v1"
  ];

  const DEFAULT_GRADES = ["Kinder", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6"];
  const DEFAULT_SECTIONS = ["A"];
  const DEFAULT_SUBJECTS = ["English", "Filipino", "Mathematics", "Science", "Araling Panlipunan", "MAPEH", "ESP"];

  // UI
  const gradeList = $("gradeList");
  const sectionSelect = $("sectionSelect");
  const sectionHint = $("sectionHint");
  const selectedClassTitle = $("selectedClassTitle");
  const scheduleTbody = $("scheduleTbody");

  const addEntryBtn = $("addEntryBtn");

  const searchInput = $("searchInput");
  const teacherFilter = $("teacherFilter");
  const roomFilter = $("roomFilter");

  // modal
  const entryModal = $("entryModal");
  const entryBackdrop = $("entryBackdrop");
  const entryCloseX = $("entryCloseX");
  const entryCancel = $("entryCancel");
  const entryReset = $("entryReset");
  const entrySave = $("entrySave");
  const entryTitle = $("entryTitle");
  const entrySub = $("entrySub");
  const entryError = $("entryError");

  const modalGrade = $("modalGrade");
  const modalSection = $("modalSection");
  const modalSubject = $("modalSubject");
  const modalDay = $("modalDay");
  const modalStart = $("modalStart");
  const modalEnd = $("modalEnd");
  const modalRoom = $("modalRoom");
  const modalTeacherSelect = $("modalTeacherSelect");
  const modalTeacherText = $("modalTeacherText");
  const teacherHint = $("teacherHint");
  const modalNotes = $("modalNotes");

  // confirm
  const confirmModal = $("confirmModal");
  const confirmBackdrop = $("confirmBackdrop");
  const confirmCloseX = $("confirmCloseX");
  const confirmCancel = $("confirmCancel");
  const confirmDelete = $("confirmDelete");
  const confirmText = $("confirmText");

  // state
  let activeGrade = DEFAULT_GRADES[0];
  let activeSection = DEFAULT_SECTIONS[0];
  let editingId = null;
  let pendingDeleteId = null;

  // backend caches
  let backendGrades = [];
  let backendSectionsMap = {};
  let summaryCounts = {};

  // ---------- helpers ----------
  function uid(prefix = "SCH") {
    return `${prefix}-${Math.random().toString(16).slice(2)}-${Date.now()}`;
  }

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function norm(s) {
    return (s || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function parseTimeToMin(t) {
    if (!t || typeof t !== "string" || !t.includes(":")) return NaN;
    const [hh, mm] = t.split(":").map(Number);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) return NaN;
    return hh * 60 + mm;
  }

  function overlaps(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && bStart < aEnd;
  }

  function showErr(msg) {
    entryError.textContent = msg;
    entryError.classList.remove("hidden");
  }

  function hideErr() {
    entryError.textContent = "";
    entryError.classList.add("hidden");
  }

  function openModal() {
    entryModal.classList.remove("hidden");
    entryModal.setAttribute("aria-hidden", "false");
    setTimeout(() => modalSubject.focus(), 0);
  }

  function closeModal() {
    entryModal.classList.add("hidden");
    entryModal.setAttribute("aria-hidden", "true");
    hideErr();
    editingId = null;
  }

  function openConfirm() {
    confirmModal.classList.remove("hidden");
    confirmModal.setAttribute("aria-hidden", "false");
    setTimeout(() => confirmDelete.focus(), 0);
  }

  function closeConfirm() {
    confirmModal.classList.add("hidden");
    confirmModal.setAttribute("aria-hidden", "true");
    pendingDeleteId = null;
  }

  // ---------- backend ----------
  async function api(path) {
    const res = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      headers: { Accept: "application/json" }
    });

    const text = await res.text();
    let data = null;

    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!res.ok) {
      throw new Error((data && (data.message || data.error)) || `Request failed (${res.status})`);
    }

    if (data && typeof data === "object" && data.ok === true && "data" in data) {
      return data.data;
    }

    return data;
  }

  async function loadBackendGrades() {
    const data = await api("/grade-levels");

    let list = [];
    if (Array.isArray(data)) {
      list = data;
    } else if (data && Array.isArray(data.items)) {
      list = data.items;
    } else if (data && Array.isArray(data.gradeLevels)) {
      list = data.gradeLevels;
    }

    backendGrades = list
      .map((item) => {
        if (typeof item === "string") return item;
        return item?.grade || item?.name || "";
      })
      .filter(Boolean);

    if (!backendGrades.length) {
      backendGrades = DEFAULT_GRADES.slice();
    }
  }

  async function loadSummaryCounts() {
    const data = await api("/sections/summary");
    summaryCounts = data && typeof data === "object" ? data : {};
  }

  async function loadBackendSectionsForGrade(grade) {
    if (!grade) return;

    const data = await api(`/sections?grade=${encodeURIComponent(grade)}`);
    const rows = Array.isArray(data) ? data : [];

    const sectionNames = rows
      .map((item) => item?.section || "")
      .filter(Boolean);

    backendSectionsMap[grade] = sectionNames.length ? sectionNames : DEFAULT_SECTIONS.slice();
  }

  async function ensureSectionsLoaded(grade) {
    if (!grade) return;
    if (!Array.isArray(backendSectionsMap[grade])) {
      await loadBackendSectionsForGrade(grade);
    }
  }

  // ---------- storage ----------
  function readSchedule() {
    try {
      const raw = localStorage.getItem(LS_SCHEDULE);
      const data = raw ? JSON.parse(raw) : [];
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  function writeSchedule(list) {
    localStorage.setItem(LS_SCHEDULE, JSON.stringify(list));
  }

  function readSubjectsStore() {
    try {
      const raw = localStorage.getItem(LS_SUBJECTS);
      const obj = raw ? JSON.parse(raw) : null;
      if (!obj || typeof obj !== "object") return null;
      return obj;
    } catch {
      return null;
    }
  }

  function readTeachersList() {
    for (const key of TEACHER_KEYS_TRY) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;

        const obj = JSON.parse(raw);

        if (Array.isArray(obj)) {
          return obj
            .map((t) => typeof t === "string" ? t : (t?.name || t?.fullName || t?.teacherName || ""))
            .map((s) => String(s).trim())
            .filter(Boolean);
        }

        const candidate = obj.items || obj.list || obj.teachers || obj.data || obj.records;

        if (Array.isArray(candidate)) {
          return candidate
            .map((t) => typeof t === "string" ? t : (t?.name || t?.fullName || t?.teacherName || ""))
            .map((s) => String(s).trim())
            .filter(Boolean);
        }
      } catch {
        // ignore
      }
    }
    return [];
  }

  // ---------- data sources ----------
  function getGradeOptions() {
    return backendGrades.length ? backendGrades.slice() : DEFAULT_GRADES.slice();
  }

  function getSectionsForGrade(grade) {
    if (Array.isArray(backendSectionsMap[grade]) && backendSectionsMap[grade].length) {
      return backendSectionsMap[grade].slice();
    }
    return DEFAULT_SECTIONS.slice();
  }

  function getSubjectsForGrade(grade) {
    const sub = readSubjectsStore();

    if (sub?.gradeSubjects && Array.isArray(sub.gradeSubjects[grade]) && sub.gradeSubjects[grade].length) {
      return sub.gradeSubjects[grade].slice();
    }

    if (sub?.masterSubjects && Array.isArray(sub.masterSubjects) && sub.masterSubjects.length) {
      return sub.masterSubjects.slice();
    }

    return DEFAULT_SUBJECTS.slice();
  }

  // ---------- UI builders ----------
  function setSelectedTitle() {
    selectedClassTitle.textContent = `${activeGrade} • Section ${activeSection}`;
    sectionHint.textContent = `Editing schedules for ${activeGrade} — ${activeSection}`;
  }

  async function buildGradeList() {
    const grades = getGradeOptions();
    gradeList.innerHTML = "";

    grades.forEach((g) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cs-grade-btn" + (g === activeGrade ? " active" : "");

      const left = document.createElement("span");
      left.textContent = g;

      const pill = document.createElement("span");
      pill.className = "cs-pill";
      const n = Number(summaryCounts[g] || 0);
      pill.textContent = `${n} section${n === 1 ? "" : "s"}`;

      btn.appendChild(left);
      btn.appendChild(pill);

      btn.addEventListener("click", async () => {
        activeGrade = g;
        await ensureSectionsLoaded(activeGrade);
        const secs = getSectionsForGrade(activeGrade);
        activeSection = secs[0] || DEFAULT_SECTIONS[0];

        await buildGradeList(); // refresh active highlight
        await buildSectionSelect();
        setSelectedTitle();
        renderTable();
      });

      gradeList.appendChild(btn);
    });

    if (!grades.includes(activeGrade)) {
      activeGrade = grades[0] || DEFAULT_GRADES[0];
    }
  }

  async function buildSectionSelect() {
    await ensureSectionsLoaded(activeGrade);

    const secs = getSectionsForGrade(activeGrade);
    sectionSelect.innerHTML = secs.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join("");

    if (!secs.includes(activeSection)) {
      activeSection = secs[0] || DEFAULT_SECTIONS[0];
    }

    sectionSelect.value = activeSection;

    sectionSelect.onchange = () => {
      activeSection = sectionSelect.value;
      setSelectedTitle();
      renderTable();
    };
  }

  function buildFiltersFromSchedule(list) {
    const teachers = Array.from(new Set(list.map((x) => x.teacher).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    teacherFilter.innerHTML =
      `<option value="all">All Teachers</option>` +
      teachers.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("");

    const rooms = Array.from(new Set(list.map((x) => x.room).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    roomFilter.innerHTML =
      `<option value="all">All Rooms</option>` +
      rooms.map((r) => `<option value="${esc(r)}">${esc(r)}</option>`).join("");
  }

  // ---------- modal field builders ----------
  async function fillModalGradeSection() {
    const grades = getGradeOptions();
    modalGrade.innerHTML = grades.map((g) => `<option value="${esc(g)}">${esc(g)}</option>`).join("");
    modalGrade.value = activeGrade;

    await ensureSectionsLoaded(modalGrade.value);
    const secs = getSectionsForGrade(modalGrade.value);
    modalSection.innerHTML = secs.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
    modalSection.value = activeSection;

    modalGrade.onchange = async () => {
      const newGrade = modalGrade.value;
      await ensureSectionsLoaded(newGrade);
      const newSecs = getSectionsForGrade(newGrade);
      modalSection.innerHTML = newSecs.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
      modalSection.value = newSecs[0] || "";
      fillModalSubjects();
    };

    modalSection.onchange = () => {};
  }

  function fillModalSubjects() {
    const subs = getSubjectsForGrade(modalGrade.value);
    modalSubject.innerHTML = subs.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
  }

  function fillTeacherField() {
    const teachers = readTeachersList();

    if (teachers.length) {
      modalTeacherSelect.classList.remove("hidden");
      modalTeacherText.classList.add("hidden");
      teacherHint.textContent = "Teacher list loaded from saved teachers.";
      modalTeacherSelect.innerHTML =
        `<option value="">Select teacher</option>` +
        teachers.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("");
    } else {
      modalTeacherSelect.classList.add("hidden");
      modalTeacherText.classList.remove("hidden");
      teacherHint.textContent = "No saved teachers found — type the teacher name.";
      modalTeacherText.value = "";
    }
  }

  function getTeacherValue() {
    if (!modalTeacherSelect.classList.contains("hidden")) {
      return (modalTeacherSelect.value || "").trim();
    }
    return (modalTeacherText.value || "").trim();
  }

  function setTeacherValue(v) {
    const val = (v || "").trim();

    if (!modalTeacherSelect.classList.contains("hidden")) {
      const opt = Array.from(modalTeacherSelect.options).some((o) => norm(o.value) === norm(val));
      if (opt) {
        modalTeacherSelect.value = val;
      } else {
        modalTeacherSelect.classList.add("hidden");
        modalTeacherText.classList.remove("hidden");
        modalTeacherText.value = val;
        teacherHint.textContent = "Teacher not in list — using text input.";
      }
    } else {
      modalTeacherText.value = val;
    }
  }

  async function resetModalFields() {
    await fillModalGradeSection();
    fillModalSubjects();
    fillTeacherField();

    modalDay.value = "Monday";
    modalStart.value = "";
    modalEnd.value = "";
    modalRoom.value = "";
    modalNotes.value = "";
    hideErr();
  }

  // ---------- conflict validation ----------
  function validateEntry(candidate, list) {
    const startMin = parseTimeToMin(candidate.start);
    const endMin = parseTimeToMin(candidate.end);

    if (!candidate.grade) return "Grade is required.";
    if (!candidate.section) return "Section is required.";
    if (!candidate.subject) return "Subject is required.";
    if (!candidate.day) return "Day is required.";
    if (!Number.isFinite(startMin)) return "Start time is required.";
    if (!Number.isFinite(endMin)) return "End time is required.";
    if (endMin <= startMin) return "End time must be after start time.";
    if (!candidate.teacher) return "Teacher is required.";
    if (!candidate.room) return "Room is required.";

    const others = list.filter((x) => x.id !== candidate.id);

    for (const e of others) {
      if (e.day !== candidate.day) continue;

      const eStart = parseTimeToMin(e.start);
      const eEnd = parseTimeToMin(e.end);
      if (!Number.isFinite(eStart) || !Number.isFinite(eEnd)) continue;

      const timeHit = overlaps(startMin, endMin, eStart, eEnd);

      if (timeHit && e.grade === candidate.grade && e.section === candidate.section) {
        return `Conflict: overlaps ${e.day} ${e.start}-${e.end} for ${e.grade} Section ${e.section}.`;
      }

      if (timeHit && norm(e.teacher) === norm(candidate.teacher)) {
        return `Conflict: teacher "${candidate.teacher}" already has ${e.day} ${e.start}-${e.end}.`;
      }
    }

    return null;
  }

  // ---------- CRUD ----------
  async function startAdd() {
    editingId = null;
    entryTitle.textContent = "Add Schedule Entry";
    entrySub.textContent = "Fill in the schedule details.";
    await resetModalFields();

    modalGrade.value = activeGrade;
    await ensureSectionsLoaded(activeGrade);
    const secs = getSectionsForGrade(activeGrade);
    modalSection.innerHTML = secs.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
    modalSection.value = activeSection;

    fillModalSubjects();
    openModal();
  }

  async function startEdit(id) {
    const list = readSchedule();
    const item = list.find((x) => x.id === id);
    if (!item) return;

    editingId = id;
    entryTitle.textContent = "Edit Schedule Entry";
    entrySub.textContent = "Update the schedule details.";
    await resetModalFields();

    modalGrade.value = item.grade;
    await ensureSectionsLoaded(item.grade);
    const secs = getSectionsForGrade(item.grade);
    modalSection.innerHTML = secs.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
    modalSection.value = item.section;

    fillModalSubjects();
    modalSubject.value = item.subject;

    modalDay.value = item.day;
    modalStart.value = item.start;
    modalEnd.value = item.end;
    modalRoom.value = item.room || "";
    modalNotes.value = item.notes || "";

    setTeacherValue(item.teacher);

    openModal();
  }

  async function saveEntry() {
    const list = readSchedule();

    const entry = {
      id: editingId || uid("ENTRY"),
      grade: modalGrade.value,
      section: modalSection.value,
      subject: modalSubject.value,
      day: modalDay.value,
      start: modalStart.value,
      end: modalEnd.value,
      room: modalRoom.value.trim(),
      teacher: getTeacherValue(),
      notes: modalNotes.value.trim(),
      updatedAt: Date.now(),
      createdAt: editingId ? undefined : Date.now(),
    };

    const err = validateEntry(entry, list);
    if (err) return showErr(err);

    if (editingId) {
      const idx = list.findIndex((x) => x.id === editingId);
      if (idx === -1) return showErr("Could not find entry to edit.");
      list[idx] = { ...list[idx], ...entry, createdAt: list[idx].createdAt || Date.now() };
    } else {
      list.push(entry);
      activeGrade = entry.grade;
      activeSection = entry.section;
      await ensureSectionsLoaded(activeGrade);
      await loadSummaryCounts();
      await buildGradeList();
      await buildSectionSelect();
      setSelectedTitle();
    }

    writeSchedule(list);
    closeModal();
    await render();
  }

  function startDelete(id) {
    const list = readSchedule();
    const item = list.find((x) => x.id === id);
    if (!item) return;

    pendingDeleteId = id;
    confirmText.textContent = `Delete ${item.day} ${item.start}-${item.end} (${item.subject}) for ${item.grade} Section ${item.section}?`;
    openConfirm();
  }

  async function deletePending() {
    if (!pendingDeleteId) return;
    const list = readSchedule().filter((x) => x.id !== pendingDeleteId);
    writeSchedule(list);
    closeConfirm();
    await render();
  }

  // ---------- render table ----------
  function renderTable() {
    const list = readSchedule();

    let rows = list.filter((x) => x.grade === activeGrade && x.section === activeSection);

    const q = norm(searchInput.value);
    const tf = teacherFilter.value;
    const rf = roomFilter.value;

    if (tf !== "all") rows = rows.filter((x) => x.teacher === tf);
    if (rf !== "all") rows = rows.filter((x) => x.room === rf);

    if (q) {
      rows = rows.filter((x) => {
        const blob = norm(`${x.subject} ${x.teacher} ${x.room} ${x.day} ${x.start} ${x.end} ${x.notes || ""}`);
        return blob.includes(q);
      });
    }

    const dayOrder = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5 };
    rows.sort((a, b) => {
      const da = dayOrder[a.day] || 99;
      const db = dayOrder[b.day] || 99;
      if (da !== db) return da - db;
      const ta = parseTimeToMin(a.start);
      const tb = parseTimeToMin(b.start);
      return (ta || 0) - (tb || 0);
    });

    buildFiltersFromSchedule(list.filter((x) => x.grade === activeGrade && x.section === activeSection));

    if (!rows.length) {
      scheduleTbody.innerHTML = `
        <tr class="cs-empty">
          <td colspan="7">No schedule entries yet.</td>
        </tr>
      `;
      return;
    }

    scheduleTbody.innerHTML = rows.map((r, idx) => {
      return `
        <tr>
          <td>${idx + 1}</td>
          <td><strong>${esc(r.day)}</strong></td>
          <td>${esc(r.start)} - ${esc(r.end)}</td>
          <td>${esc(r.subject)}</td>
          <td>${esc(r.teacher)}</td>
          <td>${esc(r.room)}</td>
          <td style="text-align:center;">
            <div class="cs-actions">
              <button class="cs-icon-btn cs-edit" type="button" data-act="edit" data-id="${esc(r.id)}" title="Edit">✎</button>
              <button class="cs-icon-btn cs-del" type="button" data-act="del" data-id="${esc(r.id)}" title="Delete">🗑</button>
            </div>
          </td>
        </tr>
      `;
    }).join("");

    scheduleTbody.querySelectorAll("button[data-act]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const act = btn.getAttribute("data-act");
        if (!id) return;
        if (act === "edit") await startEdit(id);
        if (act === "del") startDelete(id);
      });
    });
  }

  async function render() {
    await loadSummaryCounts();
    await buildGradeList();
    await buildSectionSelect();
    setSelectedTitle();
    renderTable();
  }

  // ---------- events ----------
  addEntryBtn.addEventListener("click", startAdd);

  entryBackdrop.addEventListener("click", closeModal);
  entryCloseX.addEventListener("click", closeModal);
  entryCancel.addEventListener("click", closeModal);

  entryReset.addEventListener("click", async () => {
    if (editingId) await startEdit(editingId);
    else await resetModalFields();
  });

  entrySave.addEventListener("click", saveEntry);

  searchInput.addEventListener("input", renderTable);
  teacherFilter.addEventListener("change", renderTable);
  roomFilter.addEventListener("change", renderTable);

  confirmBackdrop.addEventListener("click", closeConfirm);
  confirmCloseX.addEventListener("click", closeConfirm);
  confirmCancel.addEventListener("click", closeConfirm);
  confirmDelete.addEventListener("click", deletePending);

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!confirmModal.classList.contains("hidden")) return closeConfirm();
    if (!entryModal.classList.contains("hidden")) return closeModal();
  });

  // init
  (async () => {
    try {
      await loadBackendGrades();

      const grades = getGradeOptions();
      if (!grades.includes(activeGrade)) {
        activeGrade = grades[0] || DEFAULT_GRADES[0];
      }

      await ensureSectionsLoaded(activeGrade);
      await loadSummaryCounts();

      const secs = getSectionsForGrade(activeGrade);
      activeSection = secs[0] || DEFAULT_SECTIONS[0];

      await render();
    } catch (err) {
      console.error("Class schedule init failed:", err);
      scheduleTbody.innerHTML = `
        <tr class="cs-empty">
          <td colspan="7">${esc(err?.message || "Failed to load grade levels and sections.")}</td>
        </tr>
      `;
    }
  })();
});