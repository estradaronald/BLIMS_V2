// frontend/src/js/admin/admin-class-schedule.js
document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);


  const API_BASE = "/api/admin";


  const DEFAULT_GRADES = [
    "Kinder",
    "Grade 1",
    "Grade 2",
    "Grade 3",
    "Grade 4",
    "Grade 5",
    "Grade 6",
  ];


  const DEFAULT_SECTIONS = ["A"];


  const gradeList = $("gradeList");
  const sectionSelect = $("sectionSelect");
  const sectionHint = $("sectionHint");
  const selectedClassTitle = $("selectedClassTitle");
  const scheduleTbody = $("scheduleTbody");


  const addEntryBtn = $("addEntryBtn");
  const searchInput = $("searchInput");
  const roomFilter = $("roomFilter");


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
  const modalDay = $("modalDay");
  const modalAdviser = $("modalAdviser");
  const adviserHint = $("adviserHint");
  const modalNotes = $("modalNotes");
  const subjectScheduleBody = $("subjectScheduleBody");


  const confirmModal = $("confirmModal");
  const confirmBackdrop = $("confirmBackdrop");
  const confirmCloseX = $("confirmCloseX");
  const confirmCancel = $("confirmCancel");
  const confirmDelete = $("confirmDelete");
  const confirmText = $("confirmText");


  const successToast = $("successToast");
  const successToastText = $("successToastText");
  let successToastTimer = null;


  let activeGrade = DEFAULT_GRADES[0];
  let activeSection = DEFAULT_SECTIONS[0];


  let editingDayKey = null;
  let originalEditSnapshot = null;
  let pendingDeleteId = null;


  let isSavingEntry = false;
  let isDeletingEntry = false;


  let backendGrades = [];
  let backendSectionsMap = {};
  let backendSubjectsMap = {};
  let summaryCounts = {};
  let scheduleCache = [];
  let csrfToken = "";


  // ==============================
  // helpers
  // ==============================


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


    if (!Number.isFinite(hh) || !Number.isFinite(mm)) {
      return NaN;
    }


    return hh * 60 + mm;
  }


  function overlaps(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && bStart < aEnd;
  }


  function dayKey(grade, section, day) {
    return `${grade}|||${section}|||${day}`;
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
  }


  function closeModal() {
    entryModal.classList.add("hidden");
    entryModal.setAttribute("aria-hidden", "true");
    hideErr();
    editingDayKey = null;
    originalEditSnapshot = null;
  }


  function openConfirm() {
    confirmModal.classList.remove("hidden");
    confirmModal.setAttribute("aria-hidden", "false");
  }


  function closeConfirm() {
    confirmModal.classList.add("hidden");
    confirmModal.setAttribute("aria-hidden", "true");
    pendingDeleteId = null;
  }


  function showSuccessToast(message) {
    if (!successToast || !successToastText) return;


    successToastText.textContent = message;
    successToast.hidden = false;


    if (successToastTimer) {
      clearTimeout(successToastTimer);
    }


    successToastTimer = setTimeout(() => {
      successToast.hidden = true;
      successToastTimer = null;
    }, 3000);
  }


  // ==============================
  // csrf + api
  // ==============================


  async function getCsrfToken() {
    if (csrfToken) return csrfToken;


    const res = await fetch("/api/csrf-token", {
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });


    const data = await res.json();


    csrfToken = data?.csrfToken || "";


    return csrfToken;
  }


  async function api(path, options = {}) {
    const method = (options.method || "GET").toUpperCase();


    const headers = {
      Accept: "application/json",
      ...(options.headers || {}),
    };


    if (options.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }


    if (method !== "GET" && method !== "HEAD") {
      const token = await getCsrfToken();


      if (token) {
        headers["x-csrf-token"] = token;
      }
    }


    const res = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      ...options,
      headers,
    });


    const text = await res.text();


    let data = null;


    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }


    if (!res.ok) {
      throw new Error(
        (data && (data.message || data.error)) ||
          `Request failed (${res.status})`,
      );
    }


    if (
      data &&
      typeof data === "object" &&
      data.ok === true &&
      "data" in data
    ) {
      return data.data;
    }


    return data;
  }


  // ==============================
  // backend grades
  // ==============================


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
        if (typeof item === "string") {
          return item;
        }


        return item?.grade || item?.name || "";
      })
      .filter(Boolean);


    if (!backendGrades.length) {
      backendGrades = DEFAULT_GRADES.slice();
    }
  }


  // ==============================
  // backend subjects
  // ==============================


  async function loadBackendSubjectsForGrade(grade) {
    if (!grade) return;


    const data = await api(`/subjects?grade=${encodeURIComponent(grade)}`);


    let subjects = [];


    if (Array.isArray(data)) {
      subjects = data;
    } else if (data && Array.isArray(data.subjects)) {
      subjects = data.subjects;
    } else if (data && Array.isArray(data.items)) {
      subjects = data.items;
    }


    backendSubjectsMap[grade] = subjects
      .map((subject) => {
        if (typeof subject === "string") {
          return subject.trim();
        }


        return String(
          subject?.name || subject?.subject || subject?.title || "",
        ).trim();
      })
      .filter(Boolean)
      .filter((subject, index, arr) => {
        return (
          arr.findIndex((existing) => norm(existing) === norm(subject)) ===
          index
        );
      })
      .sort((a, b) => a.localeCompare(b));
  }


  function getSubjectsForGrade(grade) {
    if (!grade) return [];


    return Array.isArray(backendSubjectsMap[grade])
      ? backendSubjectsMap[grade].slice()
      : [];
  }


  // ==============================
  // backend sections
  // ==============================


  async function loadSummaryCounts() {
    const data = await api("/sections/summary");


    summaryCounts = data && typeof data === "object" ? data : {};
  }


  async function loadBackendSectionsForGrade(grade) {
    if (!grade) return;


    const data = await api(`/sections?grade=${encodeURIComponent(grade)}`);


    const rows = Array.isArray(data) ? data : [];


    backendSectionsMap[grade] = rows.length
      ? rows
          .map((item) => ({
            section: item?.section || "",
            adviser: item?.adviser || "",
            adviserId: item?.adviserId || null,
          }))
          .filter((x) => x.section)
      : DEFAULT_SECTIONS.map((s) => ({
          section: s,
          adviser: "",
          adviserId: null,
        }));
  }


  async function ensureSectionsLoaded(grade) {
    if (!grade) return;


    if (!Array.isArray(backendSectionsMap[grade])) {
      await loadBackendSectionsForGrade(grade);
    }
  }


  // ==============================
  // schedules
  // ==============================


  async function loadSchedules() {
    const data = await api("/class-schedules");


    scheduleCache = Array.isArray(data) ? data : [];
  }


  function readSchedule() {
    return Array.isArray(scheduleCache) ? scheduleCache.slice() : [];
  }


  // ==============================
  // grades / sections
  // ==============================


  function getGradeOptions() {
    return backendGrades.length
      ? backendGrades.slice()
      : DEFAULT_GRADES.slice();
  }


  function getSectionsForGrade(grade) {
    if (
      Array.isArray(backendSectionsMap[grade]) &&
      backendSectionsMap[grade].length
    ) {
      return backendSectionsMap[grade].slice();
    }


    return DEFAULT_SECTIONS.map((s) => ({
      section: s,
      adviser: "",
      adviserId: null,
    }));
  }


  function getSectionInfo(grade, sectionName) {
    const sections = getSectionsForGrade(grade);


    return sections.find((s) => s.section === sectionName) || null;
  }


  // ==============================
  // selected class
  // ==============================


  function setSelectedTitle() {
    selectedClassTitle.textContent = `${activeGrade} • Section ${activeSection}`;


    sectionHint.textContent = `Editing schedules for ${activeGrade} — ${activeSection}`;
  }


  // ==============================
  // grade list
  // ==============================


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
        const previousGrade = activeGrade;
        const previousSection = activeSection;


        try {
          activeGrade = g;


          await ensureSectionsLoaded(activeGrade);
          await loadBackendSubjectsForGrade(activeGrade);


          const secs = getSectionsForGrade(activeGrade);
          activeSection = secs[0]?.section || DEFAULT_SECTIONS[0];


          await buildGradeList();
          await buildSectionSelect();


          setSelectedTitle();
          renderTable();
        } catch (err) {
          console.error("Failed to switch class schedule grade:", err);


          activeGrade = previousGrade;
          activeSection = previousSection;


          try {
            await buildGradeList();
            await buildSectionSelect();
            setSelectedTitle();
            renderTable();
          } catch (recoveryErr) {
            console.error(
              "Failed to restore previous grade selection:",
              recoveryErr,
            );
          }


          scheduleTbody.innerHTML = `
    <tr class="cs-empty">
      <td colspan="7">
        Failed to load this grade's sections or subjects.
        Please try again.
      </td>
    </tr>
  `;
        }
      });


      gradeList.appendChild(btn);
    });


    if (!grades.includes(activeGrade)) {
      activeGrade = grades[0] || DEFAULT_GRADES[0];
    }
  }


  // ==============================
  // section select
  // ==============================


  async function buildSectionSelect() {
    await ensureSectionsLoaded(activeGrade);


    const secs = getSectionsForGrade(activeGrade);


    sectionSelect.innerHTML = secs
      .map(
        (s) => `<option value="${esc(s.section)}">${esc(s.section)}</option>`,
      )
      .join("");


    if (!secs.some((s) => s.section === activeSection)) {
      activeSection = secs[0]?.section || DEFAULT_SECTIONS[0];
    }


    sectionSelect.value = activeSection;


    sectionSelect.onchange = () => {
      activeSection = sectionSelect.value;


      setSelectedTitle();
      renderTable();
    };
  }


  // ==============================
  // room filters
  // ==============================


  function buildFiltersFromSchedule(list) {
    const selectedRoom = roomFilter.value || "all";


    const rooms = Array.from(
      new Set(list.map((x) => x.room).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b));


    roomFilter.innerHTML =
      `<option value="all">All Rooms</option>` +
      rooms.map((r) => `<option value="${esc(r)}">${esc(r)}</option>`).join("");


    roomFilter.value = rooms.includes(selectedRoom) ? selectedRoom : "all";
  }


  // ==============================
  // modal grade / section
  // ==============================


  async function fillModalGradeSection() {
    const grades = getGradeOptions();


    modalGrade.innerHTML = grades
      .map((g) => `<option value="${esc(g)}">${esc(g)}</option>`)
      .join("");


    modalGrade.value = activeGrade;


    await ensureSectionsLoaded(modalGrade.value);


    // Fetch subjects for selected grade
    await loadBackendSubjectsForGrade(modalGrade.value);


    buildModalSectionOptions(modalGrade.value, activeSection);


    updateModalAdviser();


    renderSubjectScheduleRows();


    modalGrade.onchange = async () => {
      const newGrade = modalGrade.value;
      const previousGrade = modalGrade.dataset.previousGrade || activeGrade;


      modalGrade.disabled = true;


      try {
        await ensureSectionsLoaded(newGrade);
        await loadBackendSubjectsForGrade(newGrade);


        buildModalSectionOptions(newGrade);
        updateModalAdviser();
        renderSubjectScheduleRows();


        modalGrade.dataset.previousGrade = newGrade;
        hideErr();
      } catch (err) {
        console.error("Failed to load modal grade data:", err);


        modalGrade.value = previousGrade;


        showErr(
          "Unable to load sections or subjects for this grade. Please try again.",
        );
      } finally {
        modalGrade.disabled = false;
      }
    };


    modalSection.onchange = () => {
      updateModalAdviser();
    };
  }


  function buildModalSectionOptions(grade, selected = "") {
    const secs = getSectionsForGrade(grade);


    modalSection.innerHTML = secs
      .map(
        (s) => `<option value="${esc(s.section)}">${esc(s.section)}</option>`,
      )
      .join("");


    if (secs.some((s) => s.section === selected)) {
      modalSection.value = selected;
    } else {
      modalSection.value = secs[0]?.section || "";
    }
  }


  function updateModalAdviser() {
    const info = getSectionInfo(modalGrade.value, modalSection.value);


    const adviser = (info?.adviser || "").trim();


    modalAdviser.value = adviser;


    if (adviser) {
      adviserHint.textContent = "";
      adviserHint.classList.add("hidden");
    } else {
      adviserHint.textContent = "No adviser assigned yet for this section.";


      adviserHint.classList.remove("hidden");
    }
  }


  // ==============================
  // subject schedule rows
  // ==============================


  function renderSubjectScheduleRows(prefillMap = {}) {
    const subjects = getSubjectsForGrade(modalGrade.value);


    if (!subjects.length) {
      subjectScheduleBody.innerHTML = `
        <tr>
          <td colspan="5">
            No subjects found for ${esc(modalGrade.value || "this grade")}.
          </td>
        </tr>
      `;


      return;
    }


    subjectScheduleBody.innerHTML = subjects
      .map((subject, idx) => {
        const existing = prefillMap[subject] || {};


        return `
            <tr data-subject="${esc(subject)}">
              <td class="cs-bulk-index">
                ${idx + 1}
              </td>


              <td class="cs-bulk-subject">
                ${esc(subject)}
              </td>


              <td>
                <input
                  class="cs-time-input js-start"
                  type="time"
                  value="${esc(existing.start || "")}"
                />
              </td>


              <td>
                <input
                  class="cs-time-input js-end"
                  type="time"
                  value="${esc(existing.end || "")}"
                />
              </td>


              <td>
                <input
                  class="cs-room-input js-room"
                  type="text"
                  value="${esc(existing.room || "")}"
                  placeholder="e.g., Room 3"
                />
              </td>
            </tr>
          `;
      })
      .join("");
  }


  function getSubjectRowsFromModal() {
    const rows = Array.from(
      subjectScheduleBody.querySelectorAll("tr[data-subject]"),
    );


    return rows.map((tr) => {
      const subject = tr.getAttribute("data-subject") || "";


      const start = tr.querySelector(".js-start")?.value || "";


      const end = tr.querySelector(".js-end")?.value || "";


      const room = (tr.querySelector(".js-room")?.value || "").trim();


      return {
        subject,
        start,
        end,
        room,
      };
    });
  }


  // ==============================
  // modal reset
  // ==============================


  async function resetModalFields() {
    await fillModalGradeSection();


    modalDay.value = "Monday";
    modalNotes.value = "";


    hideErr();
  }


  // ==============================
  // validation
  // ==============================


  function validateSingleEntry(candidate, list, ignoreIds = []) {
    const hasAnyValue = candidate.start || candidate.end || candidate.room;


    if (!hasAnyValue) return null;


    const startMin = parseTimeToMin(candidate.start);


    const endMin = parseTimeToMin(candidate.end);


    if (!candidate.grade) {
      return "Grade is required.";
    }


    if (!candidate.section) {
      return "Section is required.";
    }


    if (!candidate.subject) {
      return "Subject is required.";
    }


    if (!candidate.day) {
      return "Day is required.";
    }


    if (!candidate.start) {
      return `Start time is required for ${candidate.subject}.`;
    }


    if (!candidate.end) {
      return `End time is required for ${candidate.subject}.`;
    }


    if (!Number.isFinite(startMin)) {
      return `Invalid start time for ${candidate.subject}.`;
    }


    if (!Number.isFinite(endMin)) {
      return `Invalid end time for ${candidate.subject}.`;
    }


    if (endMin <= startMin) {
      return `End time must be after start time for ${candidate.subject}.`;
    }


    const others = list.filter((x) => !ignoreIds.includes(x.id));


    for (const e of others) {
      if (e.day !== candidate.day) {
        continue;
      }


      const eStart = parseTimeToMin(e.start);


      const eEnd = parseTimeToMin(e.end);


      if (!Number.isFinite(eStart) || !Number.isFinite(eEnd)) {
        continue;
      }


      const timeHit = overlaps(startMin, endMin, eStart, eEnd);


      if (
        timeHit &&
        e.grade === candidate.grade &&
        e.section === candidate.section
      ) {
        return `Time already taken: ${candidate.subject} overlaps ${e.subject} (${e.start} - ${e.end}) for ${e.grade} Section ${e.section}.`;
      }


      if (
        candidate.teacher &&
        e.teacher &&
        timeHit &&
        norm(e.teacher) === norm(candidate.teacher)
      ) {
        return `Teacher conflict: "${candidate.teacher}" already has ${e.day} ${e.start}-${e.end}.`;
      }
    }


    return null;
  }


  function validateBulkEntries(entries, list, ignoreIds = []) {
    const activeEntries = entries.filter(
      (entry) => entry.start || entry.end || entry.room,
    );


    if (!activeEntries.length) {
      return "Please enter at least one subject schedule.";
    }


    for (const entry of activeEntries) {
      const err = validateSingleEntry(entry, list, ignoreIds);


      if (err) return err;
    }


    for (let i = 0; i < activeEntries.length; i++) {
      for (let j = i + 1; j < activeEntries.length; j++) {
        const a = activeEntries[i];


        const b = activeEntries[j];


        if (a.day !== b.day) {
          continue;
        }


        if (a.grade !== b.grade || a.section !== b.section) {
          continue;
        }


        const aStart = parseTimeToMin(a.start);


        const aEnd = parseTimeToMin(a.end);


        const bStart = parseTimeToMin(b.start);


        const bEnd = parseTimeToMin(b.end);


        if (!Number.isFinite(aStart) || !Number.isFinite(aEnd)) {
          continue;
        }


        if (!Number.isFinite(bStart) || !Number.isFinite(bEnd)) {
          continue;
        }


        if (overlaps(aStart, aEnd, bStart, bEnd)) {
          return `Time already taken: "${a.subject}" (${a.start} - ${a.end}) overlaps "${b.subject}" (${b.start} - ${b.end}).`;
        }
      }
    }


    return null;
  }


  // ==============================
  // add schedule
  // ==============================


  async function startAdd() {
    editingDayKey = null;


    entryTitle.textContent = "Add Day Schedule";


    entrySub.textContent =
      "Select grade, section, and day. Then assign time slots for all subjects at once.";


    await resetModalFields();


    modalGrade.value = activeGrade;
    modalGrade.dataset.previousGrade = activeGrade;


    await ensureSectionsLoaded(activeGrade);


    // Make sure current grade subjects are loaded
    await loadBackendSubjectsForGrade(activeGrade);


    buildModalSectionOptions(activeGrade, activeSection);


    updateModalAdviser();


    renderSubjectScheduleRows();


    openModal();
  }


  // ==============================
  // edit schedule
  // ==============================


  async function startEditByDay(id) {
    const list = readSchedule();


    const clicked = list.find((x) => x.id === id);


    if (!clicked) return;


    const key = dayKey(clicked.grade, clicked.section, clicked.day);


    const dayRows = list.filter(
      (x) => dayKey(x.grade, x.section, x.day) === key,
    );


    editingDayKey = key;


    entryTitle.textContent = "Edit Day Schedule";


    entrySub.textContent = `Update all subject schedules for ${clicked.grade} • Section ${clicked.section} • ${clicked.day}.`;


    await resetModalFields();


    modalGrade.value = clicked.grade;


    await ensureSectionsLoaded(clicked.grade);


    // Fetch subjects for the edited grade
    await loadBackendSubjectsForGrade(clicked.grade);


    buildModalSectionOptions(clicked.grade, clicked.section);


    modalDay.value = clicked.day;


    modalNotes.value = clicked.notes || "";


    updateModalAdviser();


    const prefillMap = {};


    dayRows.forEach((row) => {
      prefillMap[row.subject] = {
        start: row.start || "",
        end: row.end || "",
        room: row.room || "",
      };
    });


    renderSubjectScheduleRows(prefillMap);


    originalEditSnapshot = {
      grade: clicked.grade,
      section: clicked.section,
      day: clicked.day,
      notes: clicked.notes || "",
      entries: JSON.parse(JSON.stringify(prefillMap)),
    };


    openModal();
  }


  // ==============================
  // save schedule
  // ==============================


  async function saveEntry() {
    const wasEditing = Boolean(editingDayKey);


    const grade = modalGrade.value;


    const section = modalSection.value;


    const day = modalDay.value;


    const notes = modalNotes.value.trim();


    const rawRows = getSubjectRowsFromModal();


    const entries = rawRows
      .filter((r) => r.start || r.end || r.room)
      .map((r) => ({
        subject: r.subject,
        start: r.start,
        end: r.end,
        room: r.room,
      }));


    const tempList = entries.map((r) => ({
      id: uid("ENTRY"),
      grade,
      section,
      subject: r.subject,
      day,
      start: r.start,
      end: r.end,
      room: r.room,
      teacher: "",
      notes,
    }));


    const existingSchedules = readSchedule();


    const ignoreIds = editingDayKey
      ? existingSchedules
          .filter(
            (item) =>
              dayKey(item.grade, item.section, item.day) === editingDayKey,
          )
          .map((item) => item.id)
      : [];


    const err = validateBulkEntries(tempList, existingSchedules, ignoreIds);


    if (err) {
      return showErr(err);
    }


    try {
      if (editingDayKey) {
        const [oldGrade, oldSection, oldDay] = editingDayKey.split("|||");


        await api(
          `/class-schedules/${encodeURIComponent(oldGrade)}/${encodeURIComponent(
            oldSection,
          )}/${encodeURIComponent(oldDay)}`,
          {
            method: "PUT",
            body: JSON.stringify({
              notes,
              entries,
            }),
          },
        );
      } else {
        await api("/class-schedules", {
          method: "POST",
          body: JSON.stringify({
            grade,
            section,
            day,
            notes,
            entries,
          }),
        });
      }
    } catch (err) {
      console.error("Class schedule save request failed:", err);
      showErr(
        err?.message || "Failed to save class schedule. Please try again.",
      );
      return;
    }


    activeGrade = grade;
    activeSection = section;


    await ensureSectionsLoaded(activeGrade);


    await loadBackendSubjectsForGrade(activeGrade);


    await loadSummaryCounts();


    await buildGradeList();
    await buildSectionSelect();


    setSelectedTitle();


    closeModal();


    await render();


    showSuccessToast(
      wasEditing
        ? "Class schedule updated successfully."
        : "Class schedule saved successfully.",
    );
  }


  // ==============================
  // delete
  // ==============================


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


    const deleteId = pendingDeleteId;


    // Handle deletion request errors separately.
    try {
      await api(`/class-schedules/entry/${encodeURIComponent(deleteId)}`, {
        method: "DELETE",
      });
    } catch (err) {
      console.error("Class schedule delete request failed:", err);


      confirmText.textContent =
        err?.message || "Failed to delete schedule. Please try again.";


      return;
    }


    // Close confirmation only after deletion succeeds.
    closeConfirm();


    // Refresh the table after successful deletion.
    try {
      await render();
      showSuccessToast("Schedule deleted successfully.");
    } catch (err) {
      console.error("Schedule deleted, but refresh failed:", err);


      scheduleTbody.innerHTML = `
      <tr class="cs-empty">
        <td colspan="7">
          Schedule deleted, but the table could not refresh.
          Please reload the page.
        </td>
      </tr>
    `;
    }
  }


  // ==============================
  // schedule table
  // ==============================


  function renderTable() {
    const list = readSchedule();


    let rows = list.filter(
      (x) => x.grade === activeGrade && x.section === activeSection,
    );


    const q = norm(searchInput.value);


    const rf = roomFilter.value;


    if (rf !== "all") {
      rows = rows.filter((x) => x.room === rf);
    }


    if (q) {
      rows = rows.filter((x) => {
        const blob = norm(
          `${x.subject} ${x.teacher} ${x.room} ${x.day} ${x.start} ${x.end} ${x.notes || ""}`,
        );


        return blob.includes(q);
      });
    }


    const dayOrder = {
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
    };


    rows.sort((a, b) => {
      const da = dayOrder[a.day] || 99;


      const db = dayOrder[b.day] || 99;


      if (da !== db) {
        return da - db;
      }


      const ta = parseTimeToMin(a.start);


      const tb = parseTimeToMin(b.start);


      return (ta || 0) - (tb || 0);
    });


    buildFiltersFromSchedule(
      list.filter(
        (x) => x.grade === activeGrade && x.section === activeSection,
      ),
    );


    if (!rows.length) {
      const hasActiveFilters = Boolean(q) || rf !== "all";


      const emptyMessage = hasActiveFilters
        ? "No matching schedule entries found. Try changing your search or room filter."
        : "No schedule entries yet.";


      scheduleTbody.innerHTML = `
    <tr class="cs-empty">
      <td colspan="7">
        ${emptyMessage}
      </td>
    </tr>
  `;


      return;
    }


    scheduleTbody.innerHTML = rows
      .map(
        (r, idx) => `
            <tr>
              <td>${idx + 1}</td>


              <td>
                <strong>
                  ${esc(r.day)}
                </strong>
              </td>


              <td>
                ${esc(r.start)} -
                ${esc(r.end)}
              </td>


              <td>
                ${esc(r.subject)}
              </td>


              <td>
                ${esc(r.teacher)}
              </td>


              <td>
                ${esc(r.room)}
              </td>


              <td style="text-align:center;">
               
<div class="cs-actions">
  <button
    class="cs-icon-btn cs-edit"
    type="button"
    data-act="edit"
    data-id="${esc(r.id)}"
    title="Edit whole day"
    aria-label="Edit whole day"
  >
    <img src="../../assets/icons/edit.svg" alt="" />
  </button>


  <button
    class="cs-icon-btn cs-del"
    type="button"
    data-act="del"
    data-id="${esc(r.id)}"
    title="Delete row"
    aria-label="Delete row"
  >
    <img src="../../assets/icons/delete.svg" alt="" />
  </button>
</div>


              </td>
            </tr>
          `,
      )
      .join("");


    scheduleTbody.querySelectorAll("button[data-act]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-id");
        const act = btn.getAttribute("data-act");


        if (!id) return;


        if (act === "edit") {
          try {
            await startEditByDay(id);
          } catch (err) {
            console.error("Failed to open class schedule for editing:", err);
            alert(
              "Unable to open this schedule for editing. Please try again.",
            );
          }
        }


        if (act === "del") {
          startDelete(id);
        }
      });
    });
  }


  // ==============================
  // render
  // ==============================


  async function render() {
    await loadSchedules();


    await loadSummaryCounts();


    await buildGradeList();


    await buildSectionSelect();


    // Make sure the currently selected grade's
    // subjects are available.
    await loadBackendSubjectsForGrade(activeGrade);


    setSelectedTitle();


    renderTable();
  }


  // ==============================
  // events
  // ==============================


  addEntryBtn.addEventListener("click", async () => {
    if (isSavingEntry) return;


    try {
      await startAdd();
    } catch (err) {
      console.error("Failed to initialize Add Schedule modal:", err);


      entryTitle.textContent = "Add Day Schedule";
      entrySub.textContent =
        "Select grade, section, and day. Then assign time slots for all subjects at once.";


      openModal();
      showErr(
        err?.message || "Unable to load schedule form data. Please try again.",
      );
    }
  });


  entryBackdrop.addEventListener("click", closeModal);


  entryCloseX.addEventListener("click", closeModal);


  entryCancel.addEventListener("click", closeModal);


  entryReset.addEventListener("click", async () => {
    if (editingDayKey && originalEditSnapshot) {
      const snapshot = originalEditSnapshot;


      modalGrade.value = snapshot.grade;
      buildModalSectionOptions(snapshot.grade, snapshot.section);
      modalSection.value = snapshot.section;
      modalDay.value = snapshot.day;
      modalNotes.value = snapshot.notes;


      updateModalAdviser();
      renderSubjectScheduleRows(snapshot.entries);
      hideErr();


      return;
    }


    await resetModalFields();
  });


  entrySave.addEventListener("click", async () => {
    if (isSavingEntry) return;


    isSavingEntry = true;
    entrySave.disabled = true;


    try {
      await saveEntry();
    } catch (err) {
      console.error("Class schedule save handling failed:", err);
      showErr("Something went wrong. Please try saving again.");
    } finally {
      isSavingEntry = false;


      entrySave.disabled = !entryModal.classList.contains("hidden");
    }
  });


  searchInput.addEventListener("input", renderTable);


  roomFilter.addEventListener("change", renderTable);


  confirmBackdrop.addEventListener("click", closeConfirm);


  confirmCloseX.addEventListener("click", closeConfirm);


  confirmCancel.addEventListener("click", closeConfirm);


  confirmDelete.addEventListener("click", async () => {
    if (isDeletingEntry) return;


    isDeletingEntry = true;
    confirmDelete.disabled = true;


    try {
      await deletePending();
    } catch (err) {
      console.error("Class schedule delete handling failed:", err);


      if (confirmText) {
        confirmText.textContent =
          "Something went wrong. Please try deleting again.";
      }
    } finally {
      isDeletingEntry = false;
      confirmDelete.disabled = false;
    }
  });


  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") {
      return;
    }


    if (!confirmModal.classList.contains("hidden")) {
      return closeConfirm();
    }


    if (!entryModal.classList.contains("hidden")) {
      return closeModal();
    }
  });


  // ==============================
  // initialization
  // ==============================


  (async () => {
    try {
      // Load grades from MongoDB/backend
      await loadBackendGrades();


      const grades = getGradeOptions();


      if (!grades.includes(activeGrade)) {
        activeGrade = grades[0] || DEFAULT_GRADES[0];
      }


      // Load sections
      await ensureSectionsLoaded(activeGrade);


      // Load subjects from MongoDB/backend
      await loadBackendSubjectsForGrade(activeGrade);


      // Load section counts
      await loadSummaryCounts();


      const secs = getSectionsForGrade(activeGrade);


      activeSection = secs[0]?.section || DEFAULT_SECTIONS[0];


      await render();
    } catch (err) {
      console.error("Class schedule init failed:", err);


      scheduleTbody.innerHTML = `
        <tr class="cs-empty">
          <td colspan="7">
            ${esc(
              err?.message ||
                "Failed to load grade levels, sections, or subjects.",
            )}
          </td>
        </tr>
      `;
    }
  })();
});



