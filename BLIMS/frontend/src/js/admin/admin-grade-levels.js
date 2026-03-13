// frontend/src/js/admin/admin-grade-levels.js
// Grade Levels & Sections (Admin) - Backend API CRUD (Express + MongoDB)
// Dynamic grade levels from backend
// CSRF is session-based: fetch from /api/csrf-token then send X-CSRF-Token.

document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  const API_BASE = "/api/admin";

  // UI refs
  const gradeList = $("gradeList");
  const selectedGradeTitle = $("selectedGradeTitle");
  const sectionsTbody = $("sectionsTbody");
  const searchInput = $("searchInput");
  const capacityFilter = $("capacityFilter");
  const addSectionBtnTop = $("addSectionBtnTop");

  // modals
  const sectionModal = $("sectionModal");
  const sectionModalBackdrop = $("sectionModalBackdrop");
  const sectionModalCloseX = $("sectionModalCloseX");
  const modalCancelBtn = $("modalCancelBtn");
  const modalResetBtn = $("modalResetBtn");
  const modalSaveBtn = $("modalSaveBtn");
  const sectionModalTitle = $("sectionModalTitle");
  const sectionModalSub = $("sectionModalSub");
  const modalError = $("modalError");

  const modalGrade = $("modalGrade");
  const modalSection = $("modalSection");
  const modalAdviser = $("modalAdviser");
  const modalCapacity = $("modalCapacity");

  const confirmModal = $("confirmModal");
  const confirmModalBackdrop = $("confirmModalBackdrop");
  const confirmCloseX = $("confirmCloseX");
  const confirmCancelBtn = $("confirmCancelBtn");
  const confirmDeleteBtn = $("confirmDeleteBtn");
  const confirmText = $("confirmText");

  // state
  let grades = [];
  let activeGrade = "";
  let editingId = null;
  let pendingDeleteId = null;

  // data cache
  let summaryCounts = {};
  let gradeRows = [];

  // csrf
  let csrfToken = "";

  async function loadCsrfToken() {
    const res = await fetch("/api/csrf-token", { credentials: "include" });
    const data = await res.json().catch(() => ({}));
    csrfToken = data?.csrfToken || "";
  }

  // --------------------------
  // API helper
  // --------------------------
  async function api(path, opts = {}) {
    const method = (opts.method || "GET").toUpperCase();
    const needsCsrf = ["POST", "PUT", "PATCH", "DELETE"].includes(method);

    const headers = { ...(opts.headers || {}) };

    if (needsCsrf) {
      if (!csrfToken) await loadCsrfToken();
      headers["X-CSRF-Token"] = csrfToken || "";
    }

    if (opts.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      ...opts,
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
      const msg =
        (data && (data.error || data.message)) ||
        `Request failed (${res.status})`;
      throw new Error(msg);
    }

    if (data && typeof data === "object" && data.ok === true && "data" in data) {
      return data.data;
    }

    return data;
  }

  // --------------------------
  // UI helpers
  // --------------------------
  function openModal() {
    sectionModal.classList.remove("hidden");
    sectionModal.setAttribute("aria-hidden", "false");
    setTimeout(() => modalSection.focus(), 0);
  }

  function closeModal() {
    sectionModal.classList.add("hidden");
    sectionModal.setAttribute("aria-hidden", "true");
    hideError();
    editingId = null;
  }

  function openConfirm() {
    confirmModal.classList.remove("hidden");
    confirmModal.setAttribute("aria-hidden", "false");
    setTimeout(() => confirmDeleteBtn.focus(), 0);
  }

  function closeConfirm() {
    confirmModal.classList.add("hidden");
    confirmModal.setAttribute("aria-hidden", "true");
    pendingDeleteId = null;
  }

  function showError(msg) {
    modalError.textContent = msg;
    modalError.classList.remove("hidden");
  }

  function hideError() {
    modalError.textContent = "";
    modalError.classList.add("hidden");
  }

  function normalize(s) {
    return (s || "").toLowerCase().trim();
  }

  function matchesCapacity(cap, filter) {
    const n = Number(cap);
    if (!Number.isFinite(n)) return false;
    if (filter === "lt30") return n < 30;
    if (filter === "30to40") return n >= 30 && n <= 40;
    if (filter === "gt40") return n > 40;
    return true;
  }

  function escapeHtml(str) {
    return String(str ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function ensureActiveGrade() {
    if (!grades.length) {
      activeGrade = "";
      return;
    }
    if (!grades.includes(activeGrade)) {
      activeGrade = grades[0];
    }
  }

  function fillGradeSelect() {
    modalGrade.innerHTML = grades
      .map((g) => `<option value="${escapeHtml(g)}">${escapeHtml(g)}</option>`)
      .join("");

    modalGrade.value = activeGrade || grades[0] || "";
  }

  function resetModalFields() {
    modalGrade.value = activeGrade || grades[0] || "";
    modalSection.value = "";
    modalAdviser.value = "";
    modalCapacity.value = "";
    hideError();
  }

  // --------------------------
  // Render
  // --------------------------
  function buildGradeList() {
    gradeList.innerHTML = "";

    if (!grades.length) {
      gradeList.innerHTML = `
        <div style="padding:12px; opacity:.7;">No grade levels found.</div>
      `;
      return;
    }

    grades.forEach((g) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "gl-grade-btn" + (g === activeGrade ? " active" : "");

      const left = document.createElement("span");
      left.textContent = g;

      const count = Number(summaryCounts[g] || 0);
      const pill = document.createElement("span");
      pill.className = "gl-grade-pill";
      pill.textContent = `${count} section${count === 1 ? "" : "s"}`;

      btn.appendChild(left);
      btn.appendChild(pill);

      btn.addEventListener("click", async () => {
        activeGrade = g;
        selectedGradeTitle.textContent = g;
        buildGradeList();

        sectionsTbody.innerHTML = `
          <tr class="gl-empty">
            <td colspan="5">Loading...</td>
          </tr>
        `;

        try {
          await loadActiveGrade();
          renderTable();
        } catch (e) {
          sectionsTbody.innerHTML = `
            <tr class="gl-empty">
              <td colspan="5">${escapeHtml(
                e?.message || "Failed to load sections."
              )}</td>
            </tr>
          `;
        }
      });

      gradeList.appendChild(btn);
    });
  }

  function renderTable() {
    const rawRows = gradeRows || [];
    const q = normalize(searchInput.value);
    const capF = capacityFilter.value;

    const rows = rawRows.filter((r) => {
      const section = normalize(r.section);
      const adviser = normalize(r.adviser);
      const hit = !q || section.includes(q) || adviser.includes(q);
      const capOk = matchesCapacity(r.capacity, capF);
      return hit && capOk;
    });

    if (!rows.length) {
      sectionsTbody.innerHTML = `
        <tr class="gl-empty">
          <td colspan="5">No sections found for this grade.</td>
        </tr>
      `;
      return;
    }

    sectionsTbody.innerHTML = rows
      .map((r, idx) => {
        const safeSection = escapeHtml(r.section);
        const safeAdviser = escapeHtml(r.adviser || "—");
        const safeCap = escapeHtml(String(r.capacity ?? "—"));
        return `
          <tr>
            <td>${idx + 1}</td>
            <td><strong>${safeSection}</strong></td>
            <td>${safeAdviser}</td>
            <td>${safeCap}</td>
            <td style="text-align:center;">
              <div class="gl-actions">
                <button class="gl-icon-btn gl-edit" type="button" data-act="edit" data-id="${r.id}" title="Edit">✎</button>
                <button class="gl-icon-btn gl-del" type="button" data-act="del" data-id="${r.id}" title="Delete">🗑</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    sectionsTbody.querySelectorAll("button[data-act]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const act = btn.getAttribute("data-act");
        if (!id) return;

        if (act === "edit") startEdit(id);
        if (act === "del") startDelete(id);
      });
    });
  }

  // --------------------------
  // Data loaders
  // --------------------------
  async function loadGradeLevels() {
    const data = await api("/grade-levels");

    let list = [];
    if (Array.isArray(data)) {
      list = data;
    } else if (data && Array.isArray(data.items)) {
      list = data.items;
    } else if (data && Array.isArray(data.gradeLevels)) {
      list = data.gradeLevels;
    }

    grades = list
      .map((item) => {
        if (typeof item === "string") return item;
        return item?.grade || item?.name || "";
      })
      .filter(Boolean);

    ensureActiveGrade();
  }

  async function loadSummary() {
    summaryCounts = await api("/sections/summary");

    if (!summaryCounts || typeof summaryCounts !== "object") {
      summaryCounts = {};
    }
  }

  async function loadActiveGrade() {
    ensureActiveGrade();

    if (!activeGrade) {
      gradeRows = [];
      return;
    }

    gradeRows = await api(`/sections?grade=${encodeURIComponent(activeGrade)}`);
    if (!Array.isArray(gradeRows)) {
      gradeRows = [];
    }
  }

  async function refreshAll() {
    await loadGradeLevels();
    await loadSummary();

    // include grades that appear in summary but not in grade-level list
    Object.keys(summaryCounts || {}).forEach((g) => {
      if (g && !grades.includes(g)) grades.push(g);
    });

    ensureActiveGrade();
    await loadActiveGrade();
    buildGradeList();
    selectedGradeTitle.textContent = activeGrade || "No Grade";
    renderTable();
  }

  // --------------------------
  // Actions
  // --------------------------
  function startAdd() {
    editingId = null;
    sectionModalTitle.textContent = "Add Section";
    sectionModalSub.textContent =
      "Create a section under the selected grade level.";
    fillGradeSelect();
    resetModalFields();
    openModal();
  }

  function startEdit(id) {
    const item = (gradeRows || []).find((x) => x.id === id);
    if (!item) return;

    editingId = id;
    sectionModalTitle.textContent = "Edit Section";
    sectionModalSub.textContent =
      "Update section details for the selected grade level.";

    fillGradeSelect();
    modalGrade.value = activeGrade;
    modalSection.value = item.section || "";
    modalAdviser.value = item.adviser || "";
    modalCapacity.value = item.capacity ?? "";

    hideError();
    openModal();
  }

  function startDelete(id) {
    const item = (gradeRows || []).find((x) => x.id === id);
    if (!item) return;

    pendingDeleteId = id;
    confirmText.textContent = `Delete section "${item.section}" under ${activeGrade}?`;
    openConfirm();
  }

  async function saveSection() {
    const grade = modalGrade.value;
    const section = modalSection.value.trim();
    const adviser = modalAdviser.value.trim();
    const capacity = Number(modalCapacity.value);

    if (!grade || !grades.includes(grade)) {
      return showError("Please select a valid grade level.");
    }
    if (!section) return showError("Section name is required.");
    if (!Number.isFinite(capacity) || capacity <= 0) {
      return showError("Capacity must be a positive number.");
    }

    try {
      if (editingId) {
        await api(`/sections/${encodeURIComponent(editingId)}`, {
          method: "PUT",
          body: JSON.stringify({ section, adviser, capacity }),
        });
      } else {
        await api("/sections", {
          method: "POST",
          body: JSON.stringify({ grade, section, adviser, capacity }),
        });

        activeGrade = grade;
        selectedGradeTitle.textContent = grade;
      }

      closeModal();
      await refreshAll();
    } catch (e) {
      showError(e.message || "Failed to save section.");
    }
  }

  async function deletePending() {
    if (!pendingDeleteId) return;

    try {
      await api(`/sections/${encodeURIComponent(pendingDeleteId)}`, {
        method: "DELETE",
      });

      closeConfirm();
      await refreshAll();
    } catch (e) {
      confirmText.textContent = e.message || "Failed to delete section.";
    }
  }

  // --------------------------
  // Events
  // --------------------------
  addSectionBtnTop.addEventListener("click", startAdd);

  sectionModalBackdrop.addEventListener("click", closeModal);
  sectionModalCloseX.addEventListener("click", closeModal);
  modalCancelBtn.addEventListener("click", closeModal);

  modalResetBtn.addEventListener("click", () => {
    if (editingId) startEdit(editingId);
    else {
      resetModalFields();
      modalSection.focus();
    }
  });

  modalSaveBtn.addEventListener("click", saveSection);

  confirmModalBackdrop.addEventListener("click", closeConfirm);
  confirmCloseX.addEventListener("click", closeConfirm);
  confirmCancelBtn.addEventListener("click", closeConfirm);
  confirmDeleteBtn.addEventListener("click", deletePending);

  searchInput.addEventListener("input", renderTable);
  capacityFilter.addEventListener("change", renderTable);

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!confirmModal.classList.contains("hidden")) return closeConfirm();
    if (!sectionModal.classList.contains("hidden")) return closeModal();
  });

  // init
  selectedGradeTitle.textContent = activeGrade || "No Grade";

  (async () => {
    try {
      await loadCsrfToken();
      await refreshAll();
    } catch (e) {
      sectionsTbody.innerHTML = `
        <tr class="gl-empty">
          <td colspan="5">${escapeHtml(
            e?.message || "Backend not reachable or API route missing."
          )}</td>
        </tr>
      `;
    }
  })();
});