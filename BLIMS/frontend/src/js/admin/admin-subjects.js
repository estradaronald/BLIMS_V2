// frontend/src/js/admin-subjects.js
// Subjects (Admin) - backend-connected
// Endpoints used:
//   GET    /api/csrf-token
//   GET    /api/admin/sections/summary
//   GET    /api/admin/subjects/summary
//   GET    /api/admin/subjects?grade=...
//   POST   /api/admin/subjects
//   PUT    /api/admin/subjects/assign
//   DELETE /api/admin/subjects/assign
//   POST   /api/admin/grade-levels
//   GET    /api/admin/grade-levels
//   DELETE /api/admin/grade-levels/:id

document.addEventListener("DOMContentLoaded", async () => {
  const $ = (id) => document.getElementById(id);

  // UI
  const gradeList = $("gradeList");
  const selectedGradeTitle = $("selectedGradeTitle");
  const subjectsTbody = $("subjectsTbody");
  const searchInput = $("searchInput");

  const addGradeBtn = $("addGradeBtn");
  const addSubjectBtn = $("addSubjectBtn");
  const editSubjectsBtn = $("editSubjectsBtn");
  const deleteGradeBtn = $("deleteGradeBtn");

  // subject modal
  const subjectModal = $("subjectModal");
  const subjectModalBackdrop = $("subjectModalBackdrop");
  const subjectModalCloseX = $("subjectModalCloseX");
  const subjectCancelBtn = $("subjectCancelBtn");
  const subjectClearBtn = $("subjectClearBtn");
  const subjectSaveBtn = $("subjectSaveBtn");
  const subjectModalTitle = $("subjectModalTitle");
  const subjectModalSub = $("subjectModalSub");
  const subjectModalError = $("subjectModalError");

  const modalGrade = $("modalGrade");
  const subjectChecklist = $("subjectChecklist");
  const newSubjectInput = $("newSubjectInput");
  const addNewSubjectBtn = $("addNewSubjectBtn");

  // grade modal
  const gradeModal = $("gradeModal");
  const gradeModalBackdrop = $("gradeModalBackdrop");
  const gradeModalCloseX = $("gradeModalCloseX");
  const gradeCancelBtn = $("gradeCancelBtn");
  const gradeSaveBtn = $("gradeSaveBtn");
  const gradeNameInput = $("gradeNameInput");
  const gradeModalError = $("gradeModalError");

  // state
  let activeGrade = "Kinder";
  let grades = []; // full grade objects: [{ _id, grade }]
  let masterSubjects = [];
  let gradeSubjectsMap = {};
  let csrfToken = "";

  // ==============================
  // helpers
  // ==============================
  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function norm(s) {
    return String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
  }

  function showSubjectError(msg) {
    subjectModalError.textContent = msg;
    subjectModalError.classList.remove("hidden");
  }

  function hideSubjectError() {
    subjectModalError.textContent = "";
    subjectModalError.classList.add("hidden");
  }

  function showGradeError(msg) {
    gradeModalError.textContent = msg;
    gradeModalError.classList.remove("hidden");
  }

  function hideGradeError() {
    gradeModalError.textContent = "";
    gradeModalError.classList.add("hidden");
  }

  function gradeNameOf(item) {
    if (!item) return "";
    if (typeof item === "string") return item;
    return item.grade || item.name || "";
  }

  function getCurrentGradeDoc() {
    return grades.find((g) => gradeNameOf(g) === activeGrade) || null;
  }

  function getGradeNames() {
    return grades.map((g) => gradeNameOf(g)).filter(Boolean);
  }

  // ==============================
  // csrf + api
  // ==============================
  async function fetchCsrf() {
    try {
      const res = await fetch("/api/csrf-token", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });

      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok && typeof data.csrfToken === "string") {
        csrfToken = data.csrfToken;
      }
    } catch {
        // ignore
    }
  }

  async function apiFetch(url, opts = {}) {
    const method = String(opts.method || "GET").toUpperCase();

    const headers = {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    };

    if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
      if (!csrfToken) await fetchCsrf();
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
    }

    const res = await fetch(url, {
      ...opts,
      headers,
      credentials: "include",
    });

    let data = null;
    try {
      data = await res.json();
    } catch {}

    if (!res.ok) {
      throw new Error(data?.message || `Request failed (${res.status})`);
    }

    return data;
  }

  // ==============================
  // backend loaders
  // ==============================
  async function loadGradesFromBackend() {
    const data = await apiFetch("/api/admin/grade-levels");

    let list = [];

    if (Array.isArray(data)) {
      list = data;
    } else if (data?.ok && Array.isArray(data.data)) {
      list = data.data;
    } else if (Array.isArray(data?.items)) {
      list = data.items;
    } else if (Array.isArray(data?.data?.items)) {
      list = data.data.items;
    } else if (Array.isArray(data?.gradeLevels)) {
      list = data.gradeLevels;
    } else if (Array.isArray(data?.data?.gradeLevels)) {
      list = data.data.gradeLevels;
    }

    grades = list.map((item) => {
      if (typeof item === "string") {
        return { _id: item, grade: item };
      }
      return {
        _id: item._id || item.id || "",
        grade: item.grade || item.name || "",
      };
    }).filter((x) => x.grade);

    const names = getGradeNames();
    if (!names.length) {
      activeGrade = "";
    } else if (!names.includes(activeGrade)) {
      activeGrade = names[0];
    }
  }

  async function loadSummary() {
    await loadGradesFromBackend();

    const data = await apiFetch("/api/admin/subjects/summary");

    const payload =
      data && typeof data === "object" && data.ok === true && data.data
        ? data.data
        : data;

    const rows = payload?.grades || [];
    const masters = payload?.masterSubjects || [];

    masterSubjects = Array.isArray(masters) ? masters.slice() : [];

    const nextMap = {};
    getGradeNames().forEach((g) => {
      nextMap[g] = Array.isArray(gradeSubjectsMap[g])
        ? gradeSubjectsMap[g].slice()
        : [];
    });

    rows.forEach((r) => {
      if (r?.grade) {
        nextMap[r.grade] = Array.isArray(r.subjects) ? r.subjects.slice() : [];
      }
    });

    gradeSubjectsMap = nextMap;

    const names = getGradeNames();
    if (!names.length) {
      activeGrade = "";
    } else if (!names.includes(activeGrade)) {
      activeGrade = names[0];
    }
  }

  async function loadSubjectsByGrade(grade) {
    if (!grade) return;

    const data = await apiFetch(`/api/admin/subjects?grade=${encodeURIComponent(grade)}`);

    const payload =
      data && typeof data === "object" && data.ok === true && data.data
        ? data.data
        : data;

    gradeSubjectsMap[grade] = Array.isArray(payload?.subjects)
      ? payload.subjects.slice()
      : [];
  }

  // ==============================
  // grade list
  // ==============================
  function buildGradeList() {
    gradeList.innerHTML = "";

    const gradeNames = getGradeNames();

    gradeNames.forEach((g) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "sub-grade-btn" + (g === activeGrade ? " active" : "");

      const left = document.createElement("span");
      left.textContent = g;

      const pill = document.createElement("span");
      pill.className = "sub-grade-pill";
      const n = (gradeSubjectsMap[g] || []).length;
      pill.textContent = `${n} subject${n === 1 ? "" : "s"}`;

      btn.appendChild(left);
      btn.appendChild(pill);

      btn.addEventListener("click", async () => {
        activeGrade = g;
        selectedGradeTitle.textContent = g;
        await loadSubjectsByGrade(g);
        render();
      });

      gradeList.appendChild(btn);
    });
  }

  // ==============================
  // table
  // ==============================
  function renderTable() {
    const q = norm(searchInput.value);
    const list = (gradeSubjectsMap[activeGrade] || [])
      .slice()
      .sort((a, b) => a.localeCompare(b));

    const filtered = list.filter((s) => !q || norm(s).includes(q));

    if (!filtered.length) {
      subjectsTbody.innerHTML = `
        <tr class="sub-empty">
          <td colspan="3">No subjects yet for this grade.</td>
        </tr>
      `;
      return;
    }

    subjectsTbody.innerHTML = filtered
      .map((subj, idx) => {
        return `
          <tr>
            <td>${idx + 1}</td>
            <td><strong>${esc(subj)}</strong></td>
            <td style="text-align:center;">
              <div class="sub-actions">
                <button class="sub-icon-btn sub-del" type="button" data-act="del" data-name="${esc(subj)}" title="Remove">🗑</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    subjectsTbody.querySelectorAll("button[data-act='del']").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const name = btn.getAttribute("data-name");
        if (!name) return;
        await removeSubjectFromGrade(name);
      });
    });
  }

  async function removeSubjectFromGrade(name) {
    if (!activeGrade) return;

    try {
      await apiFetch("/api/admin/subjects/assign", {
        method: "DELETE",
        body: JSON.stringify({
          grade: activeGrade,
          subject: name,
        }),
      });

      await loadSubjectsByGrade(activeGrade);
      render();
    } catch (err) {
      alert(err.message || "Failed to remove subject.");
    }
  }

  // ==============================
  // subject modal
  // ==============================
  function openSubjectModal(mode = "add") {
    subjectModalTitle.textContent = mode === "edit" ? "Edit Subjects" : "Add Subjects";
    subjectModalSub.textContent = "Select subjects for the chosen grade.";
    hideSubjectError();

    modalGrade.innerHTML = getGradeNames()
      .map((g) => `<option value="${esc(g)}">${esc(g)}</option>`)
      .join("");

    modalGrade.value = activeGrade;
    newSubjectInput.value = "";
    buildChecklist();

    subjectModal.classList.remove("hidden");
    subjectModal.setAttribute("aria-hidden", "false");

    setTimeout(() => modalGrade.focus(), 0);
  }

  function closeSubjectModal() {
    subjectModal.classList.add("hidden");
    subjectModal.setAttribute("aria-hidden", "true");
    hideSubjectError();
  }

  function buildChecklist() {
    const grade = modalGrade.value || activeGrade;
    const assigned = new Set((gradeSubjectsMap[grade] || []).map((s) => norm(s)));

    const subjects = masterSubjects.slice().sort((a, b) => a.localeCompare(b));

    subjectChecklist.innerHTML = subjects
      .map((s) => {
        const id = "chk_" + norm(s).replace(/[^a-z0-9]+/g, "_");
        const checked = assigned.has(norm(s)) ? "checked" : "";

        return `
          <label class="sub-check" for="${esc(id)}">
            <input type="checkbox" id="${esc(id)}" value="${esc(s)}" ${checked} />
            <span>${esc(s)}</span>
          </label>
        `;
      })
      .join("");
  }

  function getCheckedSubjects() {
    const checked = Array.from(
      subjectChecklist.querySelectorAll("input[type='checkbox']:checked")
    );
    return checked.map((c) => c.value).filter(Boolean);
  }

  function clearChecks() {
    subjectChecklist
      .querySelectorAll("input[type='checkbox']")
      .forEach((c) => (c.checked = false));
  }

  async function addNewSubjectToMaster() {
    const raw = newSubjectInput.value.trim();
    if (!raw) return showSubjectError("Enter a subject name to add.");

    try {
      await apiFetch("/api/admin/subjects", {
        method: "POST",
        body: JSON.stringify({ name: raw }),
      });

      await loadSummary();
      newSubjectInput.value = "";
      hideSubjectError();
      buildChecklist();
      render();
    } catch (err) {
      showSubjectError(err.message || "Failed to add subject.");
    }
  }

  async function saveSubjectsToGrade() {
    const grade = modalGrade.value;
    if (!grade) return showSubjectError("Please select a grade level.");

    const chosen = getCheckedSubjects();

    try {
      await apiFetch("/api/admin/subjects/assign", {
        method: "PUT",
        body: JSON.stringify({
          grade,
          subjects: chosen,
        }),
      });

      activeGrade = grade;
      selectedGradeTitle.textContent = grade;

      await loadSubjectsByGrade(grade);
      closeSubjectModal();
      render();
    } catch (err) {
      showSubjectError(err.message || "Failed to save subjects.");
    }
  }

  // ==============================
  // grade modal
  // ==============================
  function openGradeModal() {
    gradeNameInput.value = "";
    hideGradeError();
    gradeModal.classList.remove("hidden");
    gradeModal.setAttribute("aria-hidden", "false");
    setTimeout(() => gradeNameInput.focus(), 0);
  }

  function closeGradeModal() {
    gradeModal.classList.add("hidden");
    gradeModal.setAttribute("aria-hidden", "true");
    hideGradeError();
  }

  async function saveGrade() {
    const name = gradeNameInput.value.trim();
    if (!name) return showGradeError("Grade level name is required.");

    try {
      await apiFetch("/api/admin/grade-levels", {
        method: "POST",
        body: JSON.stringify({ grade: name }),
      });

      await loadSummary();
      activeGrade = name;
      selectedGradeTitle.textContent = name;

      closeGradeModal();
      render();
    } catch (err) {
      showGradeError(err.message || "Failed to add grade level.");
    }
  }

  async function deleteGradeLevel() {
    if (!activeGrade) {
      return alert("No grade level selected.");
    }

    const gradeDoc = getCurrentGradeDoc();
    const gradeId = gradeDoc?._id;

    if (!gradeId) {
      return alert("Grade level ID not found.");
    }

    const ok = window.confirm(
      `Delete grade level "${activeGrade}"?\n\nThis may also affect sections and subject assignments under this grade.`
    );
    if (!ok) return;

    try {
      await apiFetch(`/api/admin/grade-levels/${encodeURIComponent(gradeId)}`, {
        method: "DELETE",
      });

      delete gradeSubjectsMap[activeGrade];

      await loadSummary();

      if (activeGrade) {
        await loadSubjectsByGrade(activeGrade);
      }

      render();
      alert("Grade level deleted successfully.");
    } catch (err) {
      alert(err.message || "Failed to delete grade level.");
    }
  }

  // ==============================
  // render
  // ==============================
  function render() {
    const gradeNames = getGradeNames();

    if (!gradeNames.includes(activeGrade)) {
      activeGrade = gradeNames[0] || "";
    }

    selectedGradeTitle.textContent = activeGrade || "No Grade";
    buildGradeList();
    renderTable();

    if (deleteGradeBtn) {
      deleteGradeBtn.disabled = !activeGrade;
    }
  }

  // ==============================
  // events
  // ==============================
  addGradeBtn?.addEventListener("click", openGradeModal);
  deleteGradeBtn?.addEventListener("click", deleteGradeLevel);

  addSubjectBtn?.addEventListener("click", () => openSubjectModal("add"));
  editSubjectsBtn?.addEventListener("click", () => openSubjectModal("edit"));

  // subject modal
  subjectModalBackdrop?.addEventListener("click", closeSubjectModal);
  subjectModalCloseX?.addEventListener("click", closeSubjectModal);
  subjectCancelBtn?.addEventListener("click", closeSubjectModal);

  modalGrade?.addEventListener("change", () => {
    buildChecklist();
  });

  subjectClearBtn?.addEventListener("click", clearChecks);
  subjectSaveBtn?.addEventListener("click", saveSubjectsToGrade);

  addNewSubjectBtn?.addEventListener("click", addNewSubjectToMaster);
  newSubjectInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addNewSubjectToMaster();
  });

  // grade modal
  gradeModalBackdrop?.addEventListener("click", closeGradeModal);
  gradeModalCloseX?.addEventListener("click", closeGradeModal);
  gradeCancelBtn?.addEventListener("click", closeGradeModal);
  gradeSaveBtn?.addEventListener("click", saveGrade);
  gradeNameInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveGrade();
  });

  // search
  searchInput?.addEventListener("input", render);

  // ESC close
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (gradeModal && !gradeModal.classList.contains("hidden")) return closeGradeModal();
    if (subjectModal && !subjectModal.classList.contains("hidden")) return closeSubjectModal();
  });

  // ==============================
  // init
  // ==============================
  try {
    await fetchCsrf();
    await loadSummary();
    if (activeGrade) {
      await loadSubjectsByGrade(activeGrade);
    }
    render();
  } catch (err) {
    console.error(err);
    alert("Failed to load subjects. Make sure the backend routes are working.");
  }
});