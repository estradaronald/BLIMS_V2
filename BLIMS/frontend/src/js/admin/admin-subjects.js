// frontend/src/js/admin-subjects.js
// Subjects (Admin) - backend-connected (gradelevels.subjects only)
// Endpoints used:
//   GET    /api/csrf-token
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
  let grades = []; // [{ _id, grade }]
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

  function gradeKey(s) {
    return norm(s);
  }

  function uniqStrings(list) {
    const out = [];
    const seen = new Set();

    for (const item of Array.isArray(list) ? list : []) {
      const value = String(item || "").trim();
      if (!value) continue;

      const key = norm(value);
      if (seen.has(key)) continue;

      seen.add(key);
      out.push(value);
    }

    return out;
  }

  function showSubjectError(msg) {
    if (!subjectModalError) return;
    subjectModalError.textContent = msg;
    subjectModalError.classList.remove("hidden");
  }

  function hideSubjectError() {
    if (!subjectModalError) return;
    subjectModalError.textContent = "";
    subjectModalError.classList.add("hidden");
  }

  function showGradeError(msg) {
    if (!gradeModalError) return;
    gradeModalError.textContent = msg;
    gradeModalError.classList.remove("hidden");
  }

  function hideGradeError() {
    if (!gradeModalError) return;
    gradeModalError.textContent = "";
    gradeModalError.classList.add("hidden");
  }

  function gradeNameOf(item) {
    if (!item) return "";
    if (typeof item === "string") return String(item).trim();
    return String(item.grade || item.name || "").trim();
  }

  function getCurrentGradeDoc() {
    return grades.find((g) => gradeKey(gradeNameOf(g)) === gradeKey(activeGrade)) || null;
  }

  function getGradeNames() {
    return grades.map((g) => gradeNameOf(g)).filter(Boolean);
  }

  function findGradeName(name) {
    const key = gradeKey(name);
    return getGradeNames().find((g) => gradeKey(g) === key) || "";
  }

  function getSubjectsForGrade(grade) {
    const exactGrade = findGradeName(grade) || String(grade || "").trim();
    return uniqStrings(gradeSubjectsMap[exactGrade] || []);
  }

  function setModalBusy(isBusy) {
    if (addNewSubjectBtn) addNewSubjectBtn.disabled = isBusy;
    if (subjectSaveBtn) subjectSaveBtn.disabled = isBusy;
    if (subjectClearBtn) subjectClearBtn.disabled = isBusy;
    if (modalGrade) modalGrade.disabled = isBusy;
    if (newSubjectInput) newSubjectInput.disabled = isBusy;
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
    } catch {
      // ignore non-json
    }

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

    grades = list
      .map((item) => {
        if (typeof item === "string") {
          return { _id: item, grade: String(item).trim() };
        }
        return {
          _id: item._id || item.id || "",
          grade: String(item.grade || item.name || "").trim(),
        };
      })
      .filter((x) => x.grade);

    const names = getGradeNames();
    if (!names.length) {
      activeGrade = "";
    } else if (!findGradeName(activeGrade)) {
      activeGrade = names[0];
    } else {
      activeGrade = findGradeName(activeGrade);
    }
  }

  async function loadSummary() {
    await loadGradesFromBackend();

    const data = await apiFetch("/api/admin/subjects/summary");

    const payload =
      data && typeof data === "object" && data.ok === true && data.data
        ? data.data
        : data;

    const rows = Array.isArray(payload?.grades) ? payload.grades : [];
    const masters = Array.isArray(payload?.masterSubjects)
      ? payload.masterSubjects
      : [];

    const nextMap = {};
    getGradeNames().forEach((g) => {
      nextMap[g] = Array.isArray(gradeSubjectsMap[g])
        ? uniqStrings(gradeSubjectsMap[g])
        : [];
    });

    rows.forEach((r) => {
      const rowGrade = findGradeName(r?.grade);
      if (rowGrade) {
        nextMap[rowGrade] = uniqStrings(r.subjects || []);
      }
    });

    gradeSubjectsMap = nextMap;

    const combined = [
      ...masters,
      ...Object.values(nextMap).flat(),
    ];
    masterSubjects = uniqStrings(combined).sort((a, b) => a.localeCompare(b));

    const names = getGradeNames();
    if (!names.length) {
      activeGrade = "";
    } else if (!findGradeName(activeGrade)) {
      activeGrade = names[0];
    } else {
      activeGrade = findGradeName(activeGrade);
    }
  }

  async function loadSubjectsByGrade(grade) {
    const exactGrade = findGradeName(grade);
    if (!exactGrade) return;

    const data = await apiFetch(
      `/api/admin/subjects?grade=${encodeURIComponent(exactGrade)}`
    );

    const payload =
      data && typeof data === "object" && data.ok === true && data.data
        ? data.data
        : data;

    gradeSubjectsMap[exactGrade] = uniqStrings(payload?.subjects || []);
  }

  // ==============================
  // grade list
  // ==============================
  function buildGradeList() {
    if (!gradeList) return;
    gradeList.innerHTML = "";

    const gradeNames = getGradeNames();

    gradeNames.forEach((g) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "sub-grade-btn" + (gradeKey(g) === gradeKey(activeGrade) ? " active" : "");

      const left = document.createElement("span");
      left.textContent = g;

      const pill = document.createElement("span");
      pill.className = "sub-grade-pill";
      const n = getSubjectsForGrade(g).length;
      pill.textContent = `${n} subject${n === 1 ? "" : "s"}`;

      btn.appendChild(left);
      btn.appendChild(pill);

      btn.addEventListener("click", async () => {
        activeGrade = g;
        if (selectedGradeTitle) selectedGradeTitle.textContent = g;
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
    if (!subjectsTbody) return;

    const q = norm(searchInput?.value || "");
    const list = getSubjectsForGrade(activeGrade).sort((a, b) =>
      a.localeCompare(b)
    );

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
      await loadSummary();
      render();
    } catch (err) {
      alert(err.message || "Failed to remove subject.");
    }
  }

  // ==============================
  // subject modal
  // ==============================
  function openSubjectModal(mode = "add") {
    if (!subjectModal) return;

    if (subjectModalTitle) {
      subjectModalTitle.textContent =
        mode === "edit" ? "Edit Subjects" : "Add Subject";
    }

    if (subjectModalSub) {
      subjectModalSub.textContent = "Manage subjects for the chosen grade.";
    }

    hideSubjectError();

    if (modalGrade) {
      modalGrade.innerHTML = getGradeNames()
        .map((g) => `<option value="${esc(g)}">${esc(g)}</option>`)
        .join("");
      modalGrade.value = findGradeName(activeGrade) || activeGrade;
    }

    if (newSubjectInput) newSubjectInput.value = "";
    if (subjectClearBtn) subjectClearBtn.textContent = "Close";
    if (subjectSaveBtn) subjectSaveBtn.classList.add("hidden");

    buildChecklist();

    subjectModal.classList.remove("hidden");
    subjectModal.setAttribute("aria-hidden", "false");

    setTimeout(() => modalGrade?.focus(), 0);
  }

  function closeSubjectModal() {
    if (!subjectModal) return;
    subjectModal.classList.add("hidden");
    subjectModal.setAttribute("aria-hidden", "true");
    hideSubjectError();
  }

  function buildChecklist() {
    if (!subjectChecklist) return;

    const grade = findGradeName(modalGrade?.value || activeGrade);
    const subjects = getSubjectsForGrade(grade).sort((a, b) => a.localeCompare(b));

    if (!subjects.length) {
      subjectChecklist.innerHTML = `
        <div class="sub-empty-checklist">
          No subjects yet for ${esc(grade || "this grade")}.
        </div>
      `;
      return;
    }

    subjectChecklist.innerHTML = subjects
      .map((s, idx) => {
        return `
          <div class="sub-check" data-subject-row="true" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
            <span style="font-weight:600;">${idx + 1}. ${esc(s)}</span>
            <button
              type="button"
              class="sub-icon-btn sub-del"
              data-act="remove-modal-subject"
              data-name="${esc(s)}"
              title="Remove"
            >🗑</button>
          </div>
        `;
      })
      .join("");

    subjectChecklist
      .querySelectorAll("button[data-act='remove-modal-subject']")
      .forEach((btn) => {
        btn.addEventListener("click", async () => {
          const name = btn.getAttribute("data-name");
          if (!name) return;
          await removeSubjectFromGradeFromModal(name);
        });
      });
  }

  async function removeSubjectFromGradeFromModal(name) {
    const grade = findGradeName(modalGrade?.value || activeGrade);
    if (!grade || !name) return;

    const ok = window.confirm(`Remove "${name}" from ${grade}?`);
    if (!ok) return;

    try {
      setModalBusy(true);

      await apiFetch("/api/admin/subjects/assign", {
        method: "DELETE",
        body: JSON.stringify({
          grade,
          subject: name,
        }),
      });

      if (gradeKey(activeGrade) === gradeKey(grade)) {
        activeGrade = grade;
      }

      await loadSubjectsByGrade(grade);
      await loadSummary();

      if (selectedGradeTitle && gradeKey(activeGrade) === gradeKey(grade)) {
        selectedGradeTitle.textContent = grade;
      }

      buildChecklist();
      render();
    } catch (err) {
      showSubjectError(err.message || "Failed to remove subject.");
    } finally {
      setModalBusy(false);
    }
  }

  async function addNewSubjectToGrade() {
    const raw = String(newSubjectInput?.value || "").trim();
    const grade = findGradeName(modalGrade?.value || activeGrade);

    if (!grade) return showSubjectError("Grade is required.");
    if (!raw) return showSubjectError("Enter a subject name to add.");

    const existsInGrade = getSubjectsForGrade(grade).some((s) => norm(s) === norm(raw));
    if (existsInGrade) {
      return showSubjectError("That subject already exists in this grade.");
    }

    try {
      setModalBusy(true);

      await apiFetch("/api/admin/subjects", {
        method: "POST",
        body: JSON.stringify({
          grade,
          name: raw,
        }),
      });

      activeGrade = grade;

      await loadSubjectsByGrade(grade);
      await loadSummary();

      if (selectedGradeTitle) selectedGradeTitle.textContent = grade;

      if (newSubjectInput) newSubjectInput.value = "";
      hideSubjectError();
      buildChecklist();
      render();
    } catch (err) {
      showSubjectError(err.message || "Failed to add subject.");
    } finally {
      setModalBusy(false);
    }
  }

  // kept only so existing bindings won't break if HTML still has button
  function clearChecks() {
    closeSubjectModal();
  }

  // kept only so existing bindings won't break if HTML still has save button
  async function saveSubjectsToGrade() {
    closeSubjectModal();
  }

  // ==============================
  // grade modal
  // ==============================
  function openGradeModal() {
    if (gradeNameInput) gradeNameInput.value = "";
    hideGradeError();
    gradeModal?.classList.remove("hidden");
    gradeModal?.setAttribute("aria-hidden", "false");
    setTimeout(() => gradeNameInput?.focus(), 0);
  }

  function closeGradeModal() {
    gradeModal?.classList.add("hidden");
    gradeModal?.setAttribute("aria-hidden", "true");
    hideGradeError();
  }

  async function saveGrade() {
    const name = String(gradeNameInput?.value || "").trim();
    if (!name) return showGradeError("Grade level name is required.");

    try {
      await apiFetch("/api/admin/grade-levels", {
        method: "POST",
        body: JSON.stringify({ grade: name }),
      });

      await loadSummary();
      activeGrade = findGradeName(name) || name;

      if (selectedGradeTitle) selectedGradeTitle.textContent = activeGrade;

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

    if (!findGradeName(activeGrade)) {
      activeGrade = gradeNames[0] || "";
    } else {
      activeGrade = findGradeName(activeGrade);
    }

    if (selectedGradeTitle) {
      selectedGradeTitle.textContent = activeGrade || "No Grade";
    }

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

  modalGrade?.addEventListener("change", async () => {
    const grade = findGradeName(modalGrade.value);
    if (grade) {
      await loadSubjectsByGrade(grade);
    }
    buildChecklist();
    hideSubjectError();
  });

  subjectClearBtn?.addEventListener("click", clearChecks);
  subjectSaveBtn?.addEventListener("click", saveSubjectsToGrade);

  addNewSubjectBtn?.addEventListener("click", addNewSubjectToGrade);
  newSubjectInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addNewSubjectToGrade();
    }
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
    if (gradeModal && !gradeModal.classList.contains("hidden")) {
      return closeGradeModal();
    }
    if (subjectModal && !subjectModal.classList.contains("hidden")) {
      return closeSubjectModal();
    }
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