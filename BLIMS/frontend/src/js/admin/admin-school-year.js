// frontend/src/js/admin-school-year.js
// School Year & Quarters (Admin) - API version
// - Create school year
// - List school years + active indicator
// - Edit quarters (dates + lock)
// - Optional: add/remove quarters

document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  const API_BASE = "/api/admin/school-years";
  let csrfToken = "";

  // UI
  const syList = $("syList");
  const selectedSYTitle = $("selectedSYTitle");
  const selectedSYSub = $("selectedSYSub");
  const quartersTbody = $("quartersTbody");

  const addSchoolYearBtn = $("addSchoolYearBtn");
  const setActiveBtn = $("setActiveBtn");
  const editQuartersBtn = $("editQuartersBtn");

  // create modal
  const createSYModal = $("createSYModal");
  const createSYBackdrop = $("createSYBackdrop");
  const createSYCloseX = $("createSYCloseX");
  const createSYCancel = $("createSYCancel");
  const createSYSave = $("createSYSave");
  const syNameInput = $("syNameInput");
  const syStartInput = $("syStartInput");
  const syEndInput = $("syEndInput");
  const autoQ4 = $("autoQ4");
  const createSYError = $("createSYError");

  // edit quarters modal
  const editQModal = $("editQModal");
  const editQBackdrop = $("editQBackdrop");
  const editQCloseX = $("editQCloseX");
  const editQCancel = $("editQCancel");
  const editQSave = $("editQSave");
  const editQReset = $("editQReset");
  const addQuarterBtn = $("addQuarterBtn");
  const editQName = $("editQName");
  const qEditor = $("qEditor");
  const editQError = $("editQError");

  // confirm modal
  const confirmModal = $("confirmModal");
  const confirmBackdrop = $("confirmBackdrop");
  const confirmCloseX = $("confirmCloseX");
  const confirmCancel = $("confirmCancel");
  const confirmDelete = $("confirmDelete");
  const confirmText = $("confirmText");

  // state
  let selectedId = null;
  let confirmAction = null;
  let qDraft = null;
  let store = {
    activeId: null,
    items: []
  };

  // ---------- helpers ----------
  function uid() {
    return "tmp-" + Math.random().toString(16).slice(2) + "-" + Date.now();
  }

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDateForInput(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      return String(value).slice(0, 10);
    }
    return d.toISOString().slice(0, 10);
  }

  function niceDate(value) {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toISOString().slice(0, 10);
  }

  function normalizeSchoolYear(item) {
    return {
      id: item._id,
      name: item.name || "",
      start: formatDateForInput(item.start),
      end: formatDateForInput(item.end),
      createdAt: item.createdAt ? new Date(item.createdAt).getTime() : 0,
      isActive: !!item.isActive,
      quarters: Array.isArray(item.quarters)
        ? item.quarters.map((q, i) => ({
            id: q._id || uid(),
            order: q.order ?? i + 1,
            name: q.name || `Quarter ${i + 1}`,
            start: formatDateForInput(q.start),
            end: formatDateForInput(q.end),
            locked: !!q.locked,
          }))
        : [],
    };
  }

  function syncStore(items) {
    store.items = items.map(normalizeSchoolYear);
    const active = store.items.find((x) => x.isActive);
    store.activeId = active ? active.id : null;
  }

  function openModal(el) {
    el.classList.remove("hidden");
    el.setAttribute("aria-hidden", "false");
  }

  function closeModal(el) {
    el.classList.add("hidden");
    el.setAttribute("aria-hidden", "true");
  }

  function showErr(el, msg) {
    el.textContent = msg;
    el.classList.remove("hidden");
  }

  function hideErr(el) {
    el.textContent = "";
    el.classList.add("hidden");
  }

  async function fetchJson(url, options = {}) {
    const res = await fetch(url, {
      credentials: "include",
      ...options,
      headers: {
        ...(options.headers || {}),
      },
    });

    let data = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    if (!res.ok) {
      throw new Error(data.message || data.error || "Request failed.");
    }

    return data;
  }

  async function ensureCsrfToken() {
    if (csrfToken) return csrfToken;
    const data = await fetchJson("/api/csrf-token");
    csrfToken = data.csrfToken || "";
    return csrfToken;
  }

  async function loadSchoolYears() {
    const data = await fetchJson(API_BASE);
    syncStore(data.items || []);
  }

  // ---------- render ----------
  function renderSYList() {
    syList.innerHTML = "";

    if (!store.items.length) {
      syList.innerHTML = `
        <div style="padding:12px; color: rgba(11,44,74,.55); font-weight:900; font-size:12px;">
          No school years yet. Create one to begin.
        </div>
      `;
      return;
    }

    store.items
      .slice()
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .forEach((sy) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "sy-item" + (sy.id === selectedId ? " active" : "");

        const left = document.createElement("div");
        left.className = "sy-item-left";
        left.innerHTML = `
          <div class="sy-name">${esc(sy.name)}</div>
          <div class="sy-dates">${esc(niceDate(sy.start))} → ${esc(niceDate(sy.end))}</div>
        `;

        const badges = document.createElement("div");
        badges.className = "sy-badges";

        if (store.activeId === sy.id) {
          const active = document.createElement("span");
          active.className = "sy-pill active";
          active.textContent = "Active";
          badges.appendChild(active);
        }

        const count = document.createElement("span");
        count.className = "sy-pill";
        const n = (sy.quarters || []).length;
        count.textContent = `${n} quarter${n === 1 ? "" : "s"}`;
        badges.appendChild(count);

        btn.appendChild(left);
        btn.appendChild(badges);

        btn.addEventListener("click", () => {
          selectedId = sy.id;
          render();
        });

        syList.appendChild(btn);
      });
  }

  function renderDetails() {
    const sy = store.items.find((x) => x.id === selectedId);

    if (!sy) {
      selectedSYTitle.textContent = "—";
      selectedSYSub.textContent = "Select a school year to view details.";
      setActiveBtn.disabled = true;
      editQuartersBtn.disabled = true;
      quartersTbody.innerHTML = `
        <tr class="sy-empty">
          <td colspan="5">No quarters to show.</td>
        </tr>
      `;
      return;
    }

    selectedSYTitle.textContent = sy.name;
    selectedSYSub.textContent = `Timeline: ${niceDate(sy.start)} → ${niceDate(sy.end)}`;

    setActiveBtn.disabled = store.activeId === sy.id;
    editQuartersBtn.disabled = false;

    const qs = Array.isArray(sy.quarters) ? sy.quarters : [];
    if (!qs.length) {
      quartersTbody.innerHTML = `
        <tr class="sy-empty">
          <td colspan="5">No quarters yet. Use “Edit Quarters” to add.</td>
        </tr>
      `;
      return;
    }

    quartersTbody.innerHTML = qs
      .slice()
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((q, idx) => {
        const statusClass = q.locked ? "locked" : "open";
        const statusText = q.locked ? "Locked" : "Open";
        return `
          <tr>
            <td>${idx + 1}</td>
            <td><strong>${esc(q.name || `Quarter ${idx + 1}`)}</strong></td>
            <td>${esc(niceDate(q.start))}</td>
            <td>${esc(niceDate(q.end))}</td>
            <td style="text-align:center;">
              <span class="sy-status ${statusClass}">${esc(statusText)}</span>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  function render() {
    if (!selectedId && store.items.length) {
      selectedId = store.activeId || store.items[0].id;
    }

    if (selectedId && !store.items.some((x) => x.id === selectedId)) {
      selectedId = store.activeId || (store.items[0] ? store.items[0].id : null);
    }

    renderSYList();
    renderDetails();
  }

  // ---------- create school year ----------
  function openCreateSY() {
    hideErr(createSYError);
    syNameInput.value = "";
    syStartInput.value = "";
    syEndInput.value = "";
    autoQ4.checked = true;
    openModal(createSYModal);
    setTimeout(() => syNameInput.focus(), 0);
  }

  function closeCreateSY() {
    closeModal(createSYModal);
    hideErr(createSYError);
  }

  async function saveCreateSY() {
    const name = syNameInput.value.trim();
    const start = syStartInput.value || "";
    const end = syEndInput.value || "";

    if (!name) {
      return showErr(createSYError, "School year name is required.");
    }

    if (start && end && start > end) {
      return showErr(createSYError, "End date must be after start date.");
    }

    try {
      hideErr(createSYError);
      createSYSave.disabled = true;

      await ensureCsrfToken();

      await fetchJson(API_BASE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({
          name,
          start: start || null,
          end: end || null,
          autoCreateQuarters: !!autoQ4.checked,
        }),
      });

      await loadSchoolYears();

      const created = store.items.find(
        (x) => x.name.trim().toLowerCase() === name.toLowerCase()
      );
      if (created) selectedId = created.id;

      closeCreateSY();
      render();
    } catch (err) {
      showErr(createSYError, err.message || "Failed to create school year.");
    } finally {
      createSYSave.disabled = false;
    }
  }

  // ---------- set active ----------
  async function setSelectedActive() {
    const sy = store.items.find((x) => x.id === selectedId);
    if (!sy) return;

    try {
      setActiveBtn.disabled = true;
      await ensureCsrfToken();

      await fetchJson(`${API_BASE}/${sy.id}/active`, {
        method: "PATCH",
        headers: {
          "x-csrf-token": csrfToken,
        },
      });

      await loadSchoolYears();
      selectedId = sy.id;
      render();
    } catch (err) {
      alert(err.message || "Failed to set active school year.");
      render();
    }
  }

  // ---------- edit quarters ----------
  function makeDefaultQuarters() {
    return [
      { id: uid(), order: 1, name: "Quarter 1", start: "", end: "", locked: false },
      { id: uid(), order: 2, name: "Quarter 2", start: "", end: "", locked: false },
      { id: uid(), order: 3, name: "Quarter 3", start: "", end: "", locked: false },
      { id: uid(), order: 4, name: "Quarter 4", start: "", end: "", locked: false },
    ];
  }

  function openEditQ() {
    const sy = store.items.find((x) => x.id === selectedId);
    if (!sy) return;

    hideErr(editQError);
    editQName.textContent = sy.name;

    qDraft = (sy.quarters || [])
      .slice()
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((q, i) => ({
        id: q.id || uid(),
        order: q.order ?? i + 1,
        name: q.name || `Quarter ${i + 1}`,
        start: q.start || "",
        end: q.end || "",
        locked: !!q.locked,
      }));

    if (!qDraft.length) {
      qDraft = makeDefaultQuarters();
    }

    buildQEditor();
    openModal(editQModal);

    setTimeout(() => {
      const first = qEditor.querySelector("input, select, button");
      if (first) first.focus();
    }, 0);
  }

  function closeEditQ() {
    closeModal(editQModal);
    hideErr(editQError);
    qDraft = null;
  }

  function buildQEditor() {
    qEditor.innerHTML = "";

    (qDraft || []).forEach((q, idx) => {
      const row = document.createElement("div");
      row.className = "sy-qrow";
      row.dataset.id = q.id;

      row.innerHTML = `
        <div>
          <strong>Quarter</strong>
          <input class="sy-mini" type="text" data-k="name" value="${esc(q.name)}" />
        </div>

        <div>
          <strong>Start</strong>
          <input class="sy-mini" type="date" data-k="start" value="${esc(q.start)}" />
        </div>

        <div>
          <strong>End</strong>
          <input class="sy-mini" type="date" data-k="end" value="${esc(q.end)}" />
        </div>

        <label class="sy-lock">
          <input type="checkbox" data-k="locked" ${q.locked ? "checked" : ""} />
          Lock
        </label>

        <button class="sy-icon-btn" type="button" data-act="del" title="Remove quarter">🗑</button>
      `;

      row.querySelectorAll("[data-k]").forEach((el) => {
        el.addEventListener("input", () => {
          const id = row.dataset.id;
          const k = el.getAttribute("data-k");
          const item = qDraft.find((x) => x.id === id);
          if (!item || !k) return;

          if (el.type === "checkbox") item[k] = el.checked;
          else item[k] = el.value;
        });

        el.addEventListener("change", () => {
          if (el.type === "checkbox") {
            const id = row.dataset.id;
            const item = qDraft.find((x) => x.id === id);
            if (item) item.locked = el.checked;
          }
        });
      });

      row.querySelector("[data-act='del']").addEventListener("click", () => {
        confirmActionModal(`Remove ${q.name}?`, () => {
          qDraft = qDraft.filter((x) => x.id !== q.id);
          qDraft.forEach((x, i) => (x.order = i + 1));
          buildQEditor();
        });
      });

      qEditor.appendChild(row);
    });
  }

  function addQuarter() {
    if (!qDraft) qDraft = [];
    const next = qDraft.length + 1;
    qDraft.push({
      id: uid(),
      order: next,
      name: `Quarter ${next}`,
      start: "",
      end: "",
      locked: false,
    });
    buildQEditor();
  }

  function resetQuarters() {
    const sy = store.items.find((x) => x.id === selectedId);
    if (!sy) return;

    qDraft = (sy.quarters || [])
      .slice()
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((q, i) => ({
        id: q.id || uid(),
        order: q.order ?? i + 1,
        name: q.name || `Quarter ${i + 1}`,
        start: q.start || "",
        end: q.end || "",
        locked: !!q.locked,
      }));

    if (!qDraft.length) qDraft = makeDefaultQuarters();

    buildQEditor();
    hideErr(editQError);
  }

  async function saveQuarters() {
    if (!qDraft) return;

    for (const q of qDraft) {
      if (q.start && q.end && q.start > q.end) {
        return showErr(editQError, `End date must be after start date for "${q.name}".`);
      }
    }

    const sy = store.items.find((x) => x.id === selectedId);
    if (!sy) return;

    try {
      hideErr(editQError);
      editQSave.disabled = true;
      await ensureCsrfToken();

      await fetchJson(`${API_BASE}/${sy.id}/quarters`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
        },
        body: JSON.stringify({
          quarters: qDraft.map((q, i) => ({
            order: i + 1,
            name: (q.name || `Quarter ${i + 1}`).trim(),
            start: q.start || null,
            end: q.end || null,
            locked: !!q.locked,
          })),
        }),
      });

      await loadSchoolYears();
      selectedId = sy.id;
      closeEditQ();
      render();
    } catch (err) {
      showErr(editQError, err.message || "Failed to save quarters.");
    } finally {
      editQSave.disabled = false;
    }
  }

  // ---------- confirm modal ----------
  function confirmActionModal(text, onYes) {
    confirmText.textContent = text;
    confirmAction = onYes;
    openModal(confirmModal);
    setTimeout(() => confirmDelete.focus(), 0);
  }

  function closeConfirm() {
    closeModal(confirmModal);
    confirmAction = null;
  }

  function yesConfirm() {
    if (typeof confirmAction === "function") confirmAction();
    closeConfirm();
  }

  // ---------- events ----------
  addSchoolYearBtn.addEventListener("click", openCreateSY);

  createSYBackdrop.addEventListener("click", closeCreateSY);
  createSYCloseX.addEventListener("click", closeCreateSY);
  createSYCancel.addEventListener("click", closeCreateSY);
  createSYSave.addEventListener("click", saveCreateSY);
  syNameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveCreateSY();
  });

  setActiveBtn.addEventListener("click", () => {
    confirmActionModal("Set this school year as Active?", setSelectedActive);
  });

  editQuartersBtn.addEventListener("click", openEditQ);

  editQBackdrop.addEventListener("click", closeEditQ);
  editQCloseX.addEventListener("click", closeEditQ);
  editQCancel.addEventListener("click", closeEditQ);
  editQSave.addEventListener("click", saveQuarters);
  editQReset.addEventListener("click", resetQuarters);
  addQuarterBtn.addEventListener("click", addQuarter);

  confirmBackdrop.addEventListener("click", closeConfirm);
  confirmCloseX.addEventListener("click", closeConfirm);
  confirmCancel.addEventListener("click", closeConfirm);
  confirmDelete.addEventListener("click", yesConfirm);

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!confirmModal.classList.contains("hidden")) return closeConfirm();
    if (!editQModal.classList.contains("hidden")) return closeEditQ();
    if (!createSYModal.classList.contains("hidden")) return closeCreateSY();
  });

  // ---------- init ----------
  async function init() {
    try {
      await ensureCsrfToken();
      await loadSchoolYears();
      render();
    } catch (err) {
      console.error(err);
      syList.innerHTML = `
        <div style="padding:12px; color:#b42318; font-weight:900; font-size:12px;">
          Failed to load school years.
        </div>
      `;
    }
  }

  init();
});