// frontend/src/js/admin-school-year.js
// School Year & Terms (Admin) - API version
// - Create school year
// - List school years + active indicator
// - Flexible 1–4 terms (3 by default)
// - Edit terms (dates + lock)
// - Delete school year
// - Reusable confirm modal


document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);


  const API_BASE = "/api/admin/school-years";


  let csrfToken = "";


  /* =========================================================
     UI
  ========================================================= */


  const syList = $("syList");


  const selectedSYTitle = $("selectedSYTitle");


  const selectedSYSub = $("selectedSYSub");


  const termsTbody = $("termsTbody");


  const addSchoolYearBtn = $("addSchoolYearBtn");


  const deleteSchoolYearBtn = $("deleteSchoolYearBtn");


  const setActiveBtn = $("setActiveBtn");


  const editTermsBtn = $("editTermsBtn");


  /* =========================================================
     CREATE SCHOOL YEAR MODAL
  ========================================================= */


  const createSYModal = $("createSYModal");


  const createSYBackdrop = $("createSYBackdrop");


  const createSYCloseX = $("createSYCloseX");


  const createSYCancel = $("createSYCancel");


  const createSYSave = $("createSYSave");


  const syNameInput = $("syNameInput");


  const syStartInput = $("syStartInput");


  const syEndInput = $("syEndInput");


  const numberOfTermsInput = $("numberOfTermsInput");


  const createSYError = $("createSYError");


  /* =========================================================
     EDIT TERMS MODAL
  ========================================================= */


  const editTermsModal = $("editTermsModal");


  const editTermsBackdrop = $("editTermsBackdrop");


  const editTermsCloseX = $("editTermsCloseX");


  const editTermsCancel = $("editTermsCancel");


  const editTermsSave = $("editTermsSave");


  const editTermsReset = $("editTermsReset");


  const editTermsName = $("editTermsName");


  const termsEditor = $("termsEditor");


  const editTermsError = $("editTermsError");


  /* =========================================================
     CONFIRM MODAL
  ========================================================= */


  const confirmModal = $("confirmModal");


  const confirmBackdrop = $("confirmBackdrop");


  const confirmCloseX = $("confirmCloseX");


  const confirmCancel = $("confirmCancel");


  const confirmDelete = $("confirmDelete");


  const confirmTitle = $("confirmTitle");


  const confirmSub = $("confirmSub");


  const confirmText = $("confirmText");


  /* =========================================================
     STATE
  ========================================================= */


  let selectedId = null;


  let confirmAction = null;


  let termsDraft = null;


  let store = {
    activeId: null,
    items: [],
  };


  /* =========================================================
     CONSTANTS
  ========================================================= */


  const DEFAULT_TERMS = 3;


  const MIN_TERMS = 1;


  const MAX_TERMS = 4;


  /* =========================================================
     HELPERS
  ========================================================= */


  function uid() {
    return "tmp-" + Math.random().toString(16).slice(2) + "-" + Date.now();
  }


  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }


  function formatDateForInput(value) {
    if (!value) {
      return "";
    }


    const date = new Date(value);


    if (Number.isNaN(date.getTime())) {
      return String(value).slice(0, 10);
    }


    return date.toISOString().slice(0, 10);
  }


  function niceDate(value) {
    if (!value) {
      return "—";
    }


    const date = new Date(value);


    if (Number.isNaN(date.getTime())) {
      return String(value);
    }


    return date.toISOString().slice(0, 10);
  }


  /* =========================================================
     NORMALIZE SCHOOL YEAR
  ========================================================= */


  function normalizeSchoolYear(item) {
    return {
      id: item._id,


      name: item.name || "",


      start: formatDateForInput(item.start),


      end: formatDateForInput(item.end),


      createdAt: item.createdAt ? new Date(item.createdAt).getTime() : 0,


      isActive: !!item.isActive,


      terms: Array.isArray(item.terms)
        ? item.terms.map((term, index) => ({
            id: term._id || uid(),


            order: term.order ?? index + 1,


            name: term.name || `Term ${index + 1}`,


            start: formatDateForInput(term.start),


            end: formatDateForInput(term.end),


            locked: !!term.locked,
          }))
        : [],
    };
  }


  /* =========================================================
     STORE
  ========================================================= */


  function syncStore(items) {
    store.items = items.map(normalizeSchoolYear);


    const active = store.items.find((item) => item.isActive);


    store.activeId = active ? active.id : null;
  }


  /* =========================================================
     MODAL HELPERS
  ========================================================= */


  function openModal(element) {
    if (!element) {
      return;
    }


    element.classList.remove("hidden");


    element.setAttribute("aria-hidden", "false");
  }


  function closeModal(element) {
    if (!element) {
      return;
    }


    element.classList.add("hidden");


    element.setAttribute("aria-hidden", "true");
  }


  function showErr(element, message) {
    if (!element) {
      return;
    }


    element.textContent = message;


    element.classList.remove("hidden");
  }


  function hideErr(element) {
    if (!element) {
      return;
    }


    element.textContent = "";


    element.classList.add("hidden");
  }


  /* =========================================================
   SUCCESS TOAST
========================================================= */


  let successToastTimer = null;


  function showSuccess(message) {
    const toast = document.querySelector(".sy-success-toast");
    const text = toast?.querySelector(".sy-success-text");


    if (!toast || !text) {
      return;
    }


    text.textContent = message;


    toast.classList.remove("hidden");
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");


    if (successToastTimer) {
      clearTimeout(successToastTimer);
    }


    successToastTimer = setTimeout(() => {
      toast.classList.add("hidden");
      successToastTimer = null;
    }, 3000);
  }


  /* =========================================================
     API
  ========================================================= */


  async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
      credentials: "include",


      ...options,


      headers: {
        ...(options.headers || {}),
      },
    });


    let data = {};


    try {
      data = await response.json();
    } catch {
      data = {};
    }


    if (!response.ok) {
      throw new Error(data.message || data.error || "Request failed.");
    }


    return data;
  }


  async function ensureCsrfToken() {
    if (csrfToken) {
      return csrfToken;
    }


    const data = await fetchJson("/api/csrf-token");


    csrfToken = data.csrfToken || "";


    return csrfToken;
  }


  async function loadSchoolYears() {
    const data = await fetchJson(API_BASE);


    syncStore(data.items || []);
  }


  /* =========================================================
     RENDER SCHOOL YEAR LIST
  ========================================================= */


  function renderSYList() {
    if (!syList) {
      return;
    }


    syList.innerHTML = "";


    if (!store.items.length) {
      syList.innerHTML = `
        <div
          style="
            padding:12px;
            color:rgba(11,44,74,.55);
            font-weight:900;
            font-size:12px;
          "
        >
          No school years yet.
          Create one to begin.
        </div>
      `;


      return;
    }


    store.items
      .slice()
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .forEach((schoolYear) => {
        const button = document.createElement("button");


        button.type = "button";


        button.className =
          "sy-item" + (schoolYear.id === selectedId ? " active" : "");


        const left = document.createElement("div");


        left.className = "sy-item-left";


        left.innerHTML = `
            <div class="sy-name">
              ${esc(schoolYear.name)}
            </div>


            <div class="sy-dates">
              ${esc(niceDate(schoolYear.start))}
              →
              ${esc(niceDate(schoolYear.end))}
            </div>
          `;


        const badges = document.createElement("div");


        badges.className = "sy-badges";


        if (store.activeId === schoolYear.id) {
          const activeBadge = document.createElement("span");


          activeBadge.className = "sy-pill active";


          activeBadge.textContent = "Active";


          badges.appendChild(activeBadge);
        }


        const count = document.createElement("span");


        count.className = "sy-pill";


        const numberOfTerms = (schoolYear.terms || []).length;


        count.textContent = `${numberOfTerms} term${
          numberOfTerms === 1 ? "" : "s"
        }`;


        badges.appendChild(count);


        button.appendChild(left);


        button.appendChild(badges);


        button.addEventListener("click", () => {
          selectedId = schoolYear.id;


          render();
        });


        syList.appendChild(button);
      });
  }


  /* =========================================================
     RENDER SCHOOL YEAR DETAILS
  ========================================================= */


  function renderDetails() {
    if (!selectedSYTitle || !selectedSYSub || !termsTbody) {
      return;
    }


    const schoolYear = store.items.find((item) => item.id === selectedId);


    if (!schoolYear) {
      selectedSYTitle.textContent = "—";


      selectedSYSub.textContent = "Select a school year to view details.";


      if (deleteSchoolYearBtn) {
        deleteSchoolYearBtn.disabled = true;
      }


      setActiveBtn.disabled = true;


      editTermsBtn.disabled = true;


      termsTbody.innerHTML = `
        <tr class="sy-empty">
          <td colspan="5">
            No terms to show.
          </td>
        </tr>
      `;


      return;
    }


    selectedSYTitle.textContent = schoolYear.name;


    selectedSYSub.textContent = `Timeline: ${niceDate(
      schoolYear.start,
    )} → ${niceDate(schoolYear.end)}`;


    if (deleteSchoolYearBtn) {
      deleteSchoolYearBtn.disabled = false;
    }


    setActiveBtn.disabled = store.activeId === schoolYear.id;


    editTermsBtn.disabled = false;


    const terms = Array.isArray(schoolYear.terms) ? schoolYear.terms : [];


    if (!terms.length) {
      termsTbody.innerHTML = `
        <tr class="sy-empty">
          <td colspan="5">
            No terms yet.
            Use “Edit Terms” to add.
          </td>
        </tr>
      `;


      return;
    }


    termsTbody.innerHTML = terms
      .slice()
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((term, index) => {
        const statusClass = term.locked ? "locked" : "open";


        const statusText = term.locked ? "Locked" : "Open";


        return `
              <tr>


                <td>
                  ${index + 1}
                </td>


                <td>
                  <strong>
                    ${esc(term.name || `Term ${index + 1}`)}
                  </strong>
                </td>


                <td>
                  ${esc(niceDate(term.start))}
                </td>


                <td>
                  ${esc(niceDate(term.end))}
                </td>


                <td
                  style="
                    text-align:center;
                  "
                >
                  <span
                    class="sy-status ${statusClass}"
                  >
                    ${esc(statusText)}
                  </span>
                </td>


              </tr>
            `;
      })
      .join("");
  }


  /* =========================================================
     RENDER
  ========================================================= */


  function render() {
    if (!selectedId && store.items.length) {
      selectedId = store.activeId || store.items[0].id;
    }


    if (selectedId && !store.items.some((item) => item.id === selectedId)) {
      selectedId =
        store.activeId || (store.items[0] ? store.items[0].id : null);
    }


    renderSYList();


    renderDetails();
  }


  /* =========================================================
     CREATE SCHOOL YEAR
  ========================================================= */


  function openCreateSY() {
    hideErr(createSYError);


    syNameInput.value = "";


    syStartInput.value = "";


    syEndInput.value = "";


    if (numberOfTermsInput) {
      numberOfTermsInput.value = String(DEFAULT_TERMS);
    }


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


    const numberOfTerms = Number(
      numberOfTermsInput ? numberOfTermsInput.value : DEFAULT_TERMS,
    );


    /* -----------------------------------------------------
       VALIDATE NAME
    ----------------------------------------------------- */


    if (!name) {
      return showErr(createSYError, "School year name is required.");
    }


    /* -----------------------------------------------------
       VALIDATE NUMBER OF TERMS
    ----------------------------------------------------- */


    if (
      !Number.isInteger(numberOfTerms) ||
      numberOfTerms < MIN_TERMS ||
      numberOfTerms > MAX_TERMS
    ) {
      return showErr(
        createSYError,
        `Number of terms must be between ${MIN_TERMS} and ${MAX_TERMS}.`,
      );
    }


    /* -----------------------------------------------------
       VALIDATE DATES
    ----------------------------------------------------- */


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


          numberOfTerms,
        }),
      });


      await loadSchoolYears();


      const created = store.items.find(
        (item) => item.name.trim().toLowerCase() === name.toLowerCase(),
      );


      if (created) {
        selectedId = created.id;
      }


      closeCreateSY();


      render();


      showSuccess("School year created successfully.");
    } catch (error) {
      showErr(createSYError, error.message || "Failed to create school year.");
    } finally {
      createSYSave.disabled = false;
    }
  }


  /* =========================================================
     DELETE SCHOOL YEAR
  ========================================================= */


  async function deleteSelectedSchoolYear() {
    const schoolYear = store.items.find((item) => item.id === selectedId);


    if (!schoolYear) {
      return;
    }


    try {
      if (deleteSchoolYearBtn) {
        deleteSchoolYearBtn.disabled = true;
      }


      setActiveBtn.disabled = true;


      editTermsBtn.disabled = true;


      await ensureCsrfToken();


      await fetchJson(`${API_BASE}/${schoolYear.id}`, {
        method: "DELETE",


        headers: {
          "x-csrf-token": csrfToken,
        },
      });


      await loadSchoolYears();


      if (store.activeId) {
        selectedId = store.activeId;
      } else if (store.items.length) {
        selectedId = store.items[0].id;
      } else {
        selectedId = null;
      }


      render();


      showSuccess("School year deleted successfully.");
    } catch (error) {
      alert(error.message || "Failed to delete school year.");


      await loadSchoolYears().catch(() => {});


      render();
    } finally {
      if (deleteSchoolYearBtn) {
        deleteSchoolYearBtn.disabled = false;
      }


      setActiveBtn.disabled = false;


      editTermsBtn.disabled = false;
    }
  }


  /* =========================================================
     SET ACTIVE SCHOOL YEAR
  ========================================================= */


  async function setSelectedActive() {
    const schoolYear = store.items.find((item) => item.id === selectedId);


    if (!schoolYear) {
      return;
    }


    try {
      setActiveBtn.disabled = true;


      await ensureCsrfToken();


      await fetchJson(`${API_BASE}/${schoolYear.id}/active`, {
        method: "PATCH",


        headers: {
          "x-csrf-token": csrfToken,
        },
      });


      await loadSchoolYears();


      selectedId = schoolYear.id;


      render();


      showSuccess("School year set as active successfully.");
    } catch (error) {
      alert(error.message || "Failed to set active school year.");


      render();
    }
  }


  /* =========================================================
     DEFAULT TERMS
  ========================================================= */


  function makeDefaultTerms(count = DEFAULT_TERMS) {
    return Array.from(
      {
        length: count,
      },
      (_, index) => ({
        id: uid(),


        order: index + 1,


        name: `Term ${index + 1}`,


        start: "",


        end: "",


        locked: false,
      }),
    );
  }


  /* =========================================================
     OPEN EDIT TERMS
  ========================================================= */


  function openEditTerms() {
    const schoolYear = store.items.find((item) => item.id === selectedId);


    if (!schoolYear) {
      return;
    }


    hideErr(editTermsError);


    editTermsName.textContent = schoolYear.name;


    termsDraft = (schoolYear.terms || [])
      .slice()
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((term, index) => ({
        id: term.id || uid(),


        order: term.order ?? index + 1,


        name: term.name || `Term ${index + 1}`,


        start: term.start || "",


        end: term.end || "",


        locked: !!term.locked,
      }));


    if (!termsDraft.length) {
      termsDraft = makeDefaultTerms();
    }


    termsDraft = termsDraft.slice(0, MAX_TERMS);


    buildTermsEditor();


    openModal(editTermsModal);


    setTimeout(() => {
      const first = termsEditor.querySelector("input, select, button");


      if (first) {
        first.focus();
      }
    }, 0);
  }


  function closeEditTerms() {
    closeModal(editTermsModal);


    hideErr(editTermsError);


    termsDraft = null;
  }


  /* =========================================================
     BUILD TERMS EDITOR
  ========================================================= */


  function buildTermsEditor() {
    if (!termsEditor) {
      return;
    }


    termsEditor.innerHTML = "";


    (termsDraft || []).forEach((term, index) => {
      const row = document.createElement("div");


      row.className = "sy-qrow";


      row.dataset.id = term.id;


      row.innerHTML = `
          <div>


            <strong>
              Term
            </strong>


            <input
              class="sy-mini"
              type="text"
              data-k="name"
              value="${esc(term.name)}"
            />


          </div>




          <div>


            <strong>
              Start
            </strong>


            <input
              class="sy-mini"
              type="date"
              data-k="start"
              value="${esc(term.start)}"
            />


          </div>




          <div>


            <strong>
              End
            </strong>


            <input
              class="sy-mini"
              type="date"
              data-k="end"
              value="${esc(term.end)}"
            />


          </div>




          <label class="sy-lock">


            <input
              type="checkbox"
              data-k="locked"
              ${term.locked ? "checked" : ""}
            />


            Lock


          </label>




          <button
            class="sy-icon-btn"
            type="button"
            data-act="del"
            title="Remove term"
          >
            🗑
          </button>
        `;


      row.querySelectorAll("[data-k]").forEach((element) => {
        element.addEventListener("input", () => {
          const id = row.dataset.id;


          const key = element.getAttribute("data-k");


          const item = termsDraft.find((termItem) => termItem.id === id);


          if (!item || !key) {
            return;
          }


          if (element.type === "checkbox") {
            item[key] = element.checked;
          } else {
            item[key] = element.value;
          }
        });


        element.addEventListener("change", () => {
          if (element.type !== "checkbox") {
            return;
          }


          const id = row.dataset.id;


          const item = termsDraft.find((termItem) => termItem.id === id);


          if (item) {
            item.locked = element.checked;
          }
        });
      });


      const deleteBtn = row.querySelector("[data-act='del']");


      deleteBtn.addEventListener("click", () => {
        confirmActionModal(
          {
            title: "Remove Term",


            sub: "This term will be removed from the draft.",


            text: `Remove "${term.name}"?`,


            confirmLabel: "Remove",


            confirmClass: "sy-danger",
          },


          () => {
            termsDraft = termsDraft.filter((item) => item.id !== term.id);


            termsDraft.forEach((item, index) => {
              item.order = index + 1;
            });


            buildTermsEditor();
          },
        );
      });


      termsEditor.appendChild(row);
    });


    /*
     * Add Term button was removed
     * from the new HTML.
     *
     * Terms are controlled by
     * the number selected during
     * school year creation.
     */
  }


  /* =========================================================
     RESET TERMS
  ========================================================= */


  function resetTerms() {
    const schoolYear = store.items.find((item) => item.id === selectedId);


    if (!schoolYear) {
      return;
    }


    termsDraft = (schoolYear.terms || [])
      .slice()
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map((term, index) => ({
        id: term.id || uid(),


        order: term.order ?? index + 1,


        name: term.name || `Term ${index + 1}`,


        start: term.start || "",


        end: term.end || "",


        locked: !!term.locked,
      }));


    if (!termsDraft.length) {
      termsDraft = makeDefaultTerms();
    }


    termsDraft = termsDraft.slice(0, MAX_TERMS);


    buildTermsEditor();


    hideErr(editTermsError);
  }


  /* =========================================================
     SAVE TERMS
  ========================================================= */


  async function saveTerms() {
    if (!termsDraft) {
      return;
    }


    /* -----------------------------------------------------
       VALIDATE TERM COUNT
    ----------------------------------------------------- */


    if (termsDraft.length < MIN_TERMS || termsDraft.length > MAX_TERMS) {
      return showErr(
        editTermsError,
        `A school year must have between ${MIN_TERMS} and ${MAX_TERMS} terms.`,
      );
    }


    /* -----------------------------------------------------
       VALIDATE TERM DATES
    ----------------------------------------------------- */


    for (const term of termsDraft) {
      if (term.start && term.end && term.start > term.end) {
        return showErr(
          editTermsError,
          `End date must be after start date for "${term.name}".`,
        );
      }
    }


    /* -----------------------------------------------------
       GET SCHOOL YEAR
    ----------------------------------------------------- */


    const schoolYear = store.items.find((item) => item.id === selectedId);


    if (!schoolYear) {
      return;
    }


    try {
      hideErr(editTermsError);


      editTermsSave.disabled = true;


      await ensureCsrfToken();


      await fetchJson(`${API_BASE}/${schoolYear.id}/terms`, {
        method: "PUT",


        headers: {
          "Content-Type": "application/json",


          "x-csrf-token": csrfToken,
        },


        body: JSON.stringify({
          terms: termsDraft.map((term, index) => ({
            order: index + 1,


            name: (term.name || `Term ${index + 1}`).trim(),


            start: term.start || null,


            end: term.end || null,


            locked: !!term.locked,
          })),
        }),
      });


      await loadSchoolYears();


      selectedId = schoolYear.id;


      closeEditTerms();


      render();


      showSuccess("Terms saved successfully.");
    } catch (error) {
      showErr(editTermsError, error.message || "Failed to save terms.");
    } finally {
      editTermsSave.disabled = false;
    }
  }


  /* =========================================================
     CONFIRM MODAL
  ========================================================= */


  function confirmActionModal(config, onYes) {
    const {
      title = "Confirm Action",


      sub = "Please confirm this action.",


      text = "Are you sure?",


      confirmLabel = "Confirm",


      confirmClass = "sy-danger",
    } = config || {};


    if (confirmTitle) {
      confirmTitle.textContent = title;
    }


    if (confirmSub) {
      confirmSub.textContent = sub;
    }


    if (confirmText) {
      confirmText.textContent = text;
    }


    if (confirmDelete) {
      confirmDelete.textContent = confirmLabel;


      confirmDelete.classList.remove("sy-danger", "sy-save", "sy-ghost");


      confirmDelete.classList.add(confirmClass);
    }


    confirmAction = onYes;


    openModal(confirmModal);


    setTimeout(() => {
      if (confirmDelete) {
        confirmDelete.focus();
      }
    }, 0);
  }


  function closeConfirm() {
    closeModal(confirmModal);


    confirmAction = null;


    if (confirmTitle) {
      confirmTitle.textContent = "Confirm Action";
    }


    if (confirmSub) {
      confirmSub.textContent = "Please confirm this action.";
    }


    if (confirmText) {
      confirmText.textContent = "Are you sure?";
    }


    if (confirmDelete) {
      confirmDelete.textContent = "Confirm";


      confirmDelete.classList.remove("sy-danger", "sy-save", "sy-ghost");


      confirmDelete.classList.add("sy-danger");
    }
  }


  function yesConfirm() {
    if (typeof confirmAction === "function") {
      confirmAction();
    }


    closeConfirm();
  }


  /* =========================================================
     EVENTS
  ========================================================= */


  if (addSchoolYearBtn) {
    addSchoolYearBtn.addEventListener("click", openCreateSY);
  }


  if (deleteSchoolYearBtn) {
    deleteSchoolYearBtn.addEventListener("click", () => {
      const schoolYear = store.items.find((item) => item.id === selectedId);


      if (!schoolYear) {
        return;
      }


      confirmActionModal(
        {
          title: "Delete School Year",


          sub: "This action cannot be undone.",


          text: `Delete school year "${schoolYear.name}"?`,


          confirmLabel: "Delete",


          confirmClass: "sy-danger",
        },


        deleteSelectedSchoolYear,
      );
    });
  }


  if (createSYBackdrop) {
    createSYBackdrop.addEventListener("click", closeCreateSY);
  }


  if (createSYCloseX) {
    createSYCloseX.addEventListener("click", closeCreateSY);
  }


  if (createSYCancel) {
    createSYCancel.addEventListener("click", closeCreateSY);
  }


  if (createSYSave) {
    createSYSave.addEventListener("click", saveCreateSY);
  }


  if (syNameInput) {
    syNameInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        saveCreateSY();
      }
    });
  }


  if (setActiveBtn) {
    setActiveBtn.addEventListener("click", () => {
      const schoolYear = store.items.find((item) => item.id === selectedId);


      if (!schoolYear) {
        return;
      }


      confirmActionModal(
        {
          title: "Set Active School Year",


          sub: "This will make the selected school year the active one.",


          text: `Set "${schoolYear.name}" as the active school year?`,


          confirmLabel: "Set Active",


          confirmClass: "sy-save",
        },


        setSelectedActive,
      );
    });
  }


  if (editTermsBtn) {
    editTermsBtn.addEventListener("click", openEditTerms);
  }


  if (editTermsBackdrop) {
    editTermsBackdrop.addEventListener("click", closeEditTerms);
  }


  if (editTermsCloseX) {
    editTermsCloseX.addEventListener("click", closeEditTerms);
  }


  if (editTermsCancel) {
    editTermsCancel.addEventListener("click", closeEditTerms);
  }


  if (editTermsSave) {
    editTermsSave.addEventListener("click", saveTerms);
  }


  if (editTermsReset) {
    editTermsReset.addEventListener("click", resetTerms);
  }


  if (confirmBackdrop) {
    confirmBackdrop.addEventListener("click", closeConfirm);
  }


  if (confirmCloseX) {
    confirmCloseX.addEventListener("click", closeConfirm);
  }


  if (confirmCancel) {
    confirmCancel.addEventListener("click", closeConfirm);
  }


  if (confirmDelete) {
    confirmDelete.addEventListener("click", yesConfirm);
  }


  /* =========================================================
     ESCAPE
  ========================================================= */


  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }


    if (confirmModal && !confirmModal.classList.contains("hidden")) {
      return closeConfirm();
    }


    if (editTermsModal && !editTermsModal.classList.contains("hidden")) {
      return closeEditTerms();
    }


    if (createSYModal && !createSYModal.classList.contains("hidden")) {
      return closeCreateSY();
    }
  });


  /* =========================================================
     INIT
  ========================================================= */


  async function init() {
    try {
      await ensureCsrfToken();


      await loadSchoolYears();


      render();
    } catch (error) {
      console.error(error);


      if (syList) {
        syList.innerHTML = `
          <div
            style="
              padding:12px;
              color:#b42318;
              font-weight:900;
              font-size:12px;
            "
          >
            Failed to load school years.
          </div>
        `;
      }
    }
  }


  init();
});



