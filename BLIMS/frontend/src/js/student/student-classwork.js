// frontend/src/js/student/student-classwork.js

document.addEventListener("DOMContentLoaded", () => {
  initTopbarMenu();
  initLogout();
  initClasswork();
});

function $(id) {
  return document.getElementById(id);
}

/* ===============================
   TOPBAR
================================= */

function initTopbarMenu() {
  const userMenuBtn = $("userMenuBtn");
  const userMenu = $("userMenu");
  const userbox = $("userbox");

  if (!userMenuBtn || !userMenu || !userbox) return;

  userMenuBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    userMenu.classList.toggle("open");
  });

  document.addEventListener("click", (ev) => {
    if (!userbox.contains(ev.target)) {
      userMenu.classList.remove("open");
    }
  });
}

/* ===============================
   LOGOUT
================================= */

function initLogout() {
  const btn = $("topbarLogout");

  if (!btn) return;

  btn.addEventListener("click", () => {
    window.location.href = "../../login.html";
  });
}

/* ===============================
   CLASSWORK
================================= */

function initClasswork() {
  const listEl = $("cwList");
  const emptyEl = $("cwEmpty");

  const gradeSectionEl = $("cwGradeSection");

  const subjectFilter = $("cwSubjectFilter");
  const searchInput = $("cwSearch");

  /* ===============================
     VIEW MODAL
  ================================= */

  const viewModal = $("cwViewModal");
  const viewBackdrop = $("cwViewBackdrop");
  const viewCloseX = $("cwViewCloseX");
  const viewCloseBtn = $("cwViewCloseBtn");

  const viewTitle = $("cwViewTitle");
  const viewSub = $("cwViewSub");
  const viewChips = $("cwViewChips");
  const viewDesc = $("cwViewDesc");
  const viewFile = $("cwViewFile");
  const downloadBtn = $("cwDownloadBtn");

  if (!listEl || !emptyEl) return;

  const state = {
    assignments: [],

    /* All subjects for student's grade */
    subjects: [],

    subject: "all",
    q: "",
    selectedId: null,

    progressLoading: false,
  };

  /* ===============================
     CONSTANTS
  ================================= */

  const VALID_PROGRESS_STATUSES = [
    "not_started",
    "in_progress",
    "done",
  ];

  /* ===============================
     HELPERS
  ================================= */

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function norm(s) {
    return String(s || "")
      .trim()
      .toLowerCase();
  }

  function fmtDue(value) {
    if (!value) return "—";

    const d = new Date(value);

    if (Number.isNaN(d.getTime())) {
      return String(value);
    }

    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  }

  function clampText(s, n = 120) {
    const t = String(s || "").trim();

    if (t.length <= n) {
      return t;
    }

    return t.slice(0, n).trim() + "…";
  }

  function openModal(el) {
    if (!el) return;

    el.classList.remove("hidden");
    el.setAttribute("aria-hidden", "false");
  }

  function closeModal(el) {
    if (!el) return;

    el.classList.add("hidden");
    el.setAttribute("aria-hidden", "true");
  }

  /* ===============================
     PROGRESS HELPERS
  ================================= */

  function getProgressStatus(assignment) {
    const status =
      assignment?.progressStatus;

    if (
      VALID_PROGRESS_STATUSES.includes(
        status
      )
    ) {
      return status;
    }

    return "not_started";
  }

  function getProgressLabel(status) {
    switch (status) {
      case "in_progress":
        return "In Progress";

      case "done":
        return "Done";

      case "not_started":
      default:
        return "Not Started";
    }
  }

  function getProgressClass(status) {
    switch (status) {
      case "in_progress":
        return "in-progress";

      case "done":
        return "done";

      case "not_started":
      default:
        return "not-started";
    }
  }

  /* ===============================
     LOAD ASSIGNMENTS
  ================================= */

  async function loadAssignments() {
    listEl.innerHTML = `
      <div class="cw-loading">
        Loading assignments...
      </div>
    `;

    emptyEl.classList.add("hidden");

    try {
      const response = await fetch(
        "/api/student/assignments",
        {
          method: "GET",

          credentials: "include",

          headers: {
            Accept: "application/json",
          },
        }
      );

      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(
          result.message ||
            "Failed to load assignments."
        );
      }

      /* ===============================
         ASSIGNMENTS
      ================================= */

      state.assignments =
        Array.isArray(result.data)
          ? result.data
          : [];

      /* ===============================
         SUBJECTS
         
         These come from the student's
         grade-level configuration.
      ================================= */

      state.subjects =
        Array.isArray(result.subjects)
          ? result.subjects
          : [];

      /* ===============================
         STUDENT CLASS / SECTION
      ================================= */

      const scope =
        result.studentScope;

      if (
        scope &&
        gradeSectionEl
      ) {
        gradeSectionEl.textContent =
          `${scope.className} - Section ${scope.sectionName}`;
      }

      /* ===============================
         SUBJECT FILTER
      ================================= */

      buildSubjectOptions(
        state.subjects
      );

      /* ===============================
         RENDER
      ================================= */

      render();

    } catch (err) {
      console.error(
        "loadAssignments error:",
        err
      );

      state.assignments = [];
      state.subjects = [];

      listEl.innerHTML = "";

      emptyEl.classList.remove(
        "hidden"
      );

      emptyEl.textContent =
        "Unable to load assignments.";
    }
  }

  /* ===============================
     SUBJECT FILTER
     
     Uses ALL subjects assigned to
     student's grade.
  ================================= */

  function buildSubjectOptions(
    subjects
  ) {
    if (!subjectFilter) return;

    const normalizedSubjects =
      Array.from(
        new Set(
          (
            Array.isArray(subjects)
              ? subjects
              : []
          )
            .map((subject) =>
              String(
                subject || ""
              ).trim()
            )
            .filter(Boolean)
        )
      ).sort((a, b) =>
        a.localeCompare(b)
      );

    state.subjects =
      normalizedSubjects;

    subjectFilter.innerHTML =
      `<option value="all">Subject: All</option>` +
      normalizedSubjects
        .map(
          (subject) =>
            `<option value="${escapeHtml(
              subject
            )}">
              ${escapeHtml(subject)}
            </option>`
        )
        .join("");

    /* ===============================
       PRESERVE CURRENT FILTER
    ================================= */

    if (
      state.subject !== "all" &&
      normalizedSubjects.includes(
        state.subject
      )
    ) {
      subjectFilter.value =
        state.subject;
    } else {
      state.subject = "all";

      subjectFilter.value =
        "all";
    }
  }

  /* ===============================
     FILTERS
  ================================= */

  function applyFilters(items) {
    let out = items.slice();

    /* ===============================
       SUBJECT
    ================================= */

    if (state.subject !== "all") {
      out = out.filter(
        (x) =>
          String(
            x.subject || ""
          ).trim() ===
          state.subject
      );
    }

    /* ===============================
       SEARCH
    ================================= */

    const q = norm(
      state.q
    );

    if (q) {
      out = out.filter((x) => {
        const hay = `
          ${x.title || ""}
          ${x.instructions || ""}
          ${x.subject || ""}
          ${x.className || ""}
          ${x.sectionName || ""}
        `.toLowerCase();

        return hay.includes(q);
      });
    }

    /* ===============================
       SORT
       Soonest due date first
    ================================= */

    out.sort((a, b) => {
      const dateA =
        new Date(
          a.dueDate || 0
        ).getTime();

      const dateB =
        new Date(
          b.dueDate || 0
        ).getTime();

      return dateA - dateB;
    });

    return out;
  }

  /* ===============================
     UPDATE PROGRESS
  ================================= */

  async function updateAssignmentProgress(
    assignment,
    newStatus
  ) {
    if (!assignment?._id) {
      return;
    }

    if (
      !VALID_PROGRESS_STATUSES.includes(
        newStatus
      )
    ) {
      return;
    }

    if (
      state.progressLoading
    ) {
      return;
    }

    const previousStatus =
      getProgressStatus(
        assignment
      );

    if (
      previousStatus ===
      newStatus
    ) {
      return;
    }

    state.progressLoading =
      true;

    try {
      const response =
        await fetch(
          `/api/student/assignments/${assignment._id}/progress`,
          {
            method: "PATCH",

            credentials: "include",

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json",
            },

            body: JSON.stringify({
              status: newStatus,
            }),
          }
        );

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.ok
      ) {
        throw new Error(
          result.message ||
            "Failed to update assignment progress."
        );
      }

      /* ===============================
         UPDATE LOCAL STATE
      ================================= */

      assignment.progressStatus =
        result.data?.progressStatus ||
        newStatus;

      assignment.startedAt =
        result.data?.startedAt ||
        null;

      assignment.completedAt =
        result.data?.completedAt ||
        null;

      /* ===============================
         IMPORTANT
         
         Turn loading OFF before
         rendering the new dropdown.
      ================================= */

      state.progressLoading =
        false;

      /* ===============================
         REFRESH LIST
      ================================= */

      render();

      /* ===============================
         REFRESH OPEN MODAL
      ================================= */

      if (
        state.selectedId &&
        String(
          state.selectedId
        ) ===
          String(
            assignment._id
          )
      ) {
        openDetails(
          assignment._id
        );
      }

    } catch (err) {
      console.error(
        "updateAssignmentProgress error:",
        err
      );

      /* ===============================
         RESET LOADING
      ================================= */

      state.progressLoading =
        false;

      alert(
        err.message ||
          "Unable to update assignment progress."
      );

      /* ===============================
         MAKE DROPDOWN USABLE AGAIN
      ================================= */

      render();

      /* ===============================
         REOPEN MODAL
      ================================= */

      if (
        state.selectedId &&
        String(
          state.selectedId
        ) ===
          String(
            assignment._id
          )
      ) {
        openDetails(
          assignment._id
        );
      }
    }
  }

  /* ===============================
     CREATE PROGRESS SELECT
  ================================= */

  function createProgressSelect(
    assignment
  ) {
    const wrapper =
      document.createElement(
        "div"
      );

    wrapper.className =
      "cw-progress-wrap";

    const select =
      document.createElement(
        "select"
      );

    select.className =
      "cw-progress-select";

    select.setAttribute(
      "aria-label",
      "Assignment progress"
    );

    const currentStatus =
      getProgressStatus(
        assignment
      );

    const options = [
      {
        value: "not_started",
        label: "Not Started",
      },

      {
        value: "in_progress",
        label: "In Progress",
      },

      {
        value: "done",
        label: "Done",
      },
    ];

    options.forEach(
      (option) => {
        const el =
          document.createElement(
            "option"
          );

        el.value =
          option.value;

        el.textContent =
          option.label;

        if (
          option.value ===
          currentStatus
        ) {
          el.selected =
            true;
        }

        select.appendChild(
          el
        );
      }
    );

    select.disabled =
      state.progressLoading;

    /* ===============================
       PREVENT ROW CLICK
    ================================= */

    select.addEventListener(
      "click",
      (event) => {
        event.stopPropagation();
      }
    );

    select.addEventListener(
      "change",
      async (event) => {
        event.stopPropagation();

        const newStatus =
          event.target.value;

        await updateAssignmentProgress(
          assignment,
          newStatus
        );
      }
    );

    wrapper.appendChild(
      select
    );

    return wrapper;
  }

  /* ===============================
     RENDER ASSIGNMENT
  ================================= */

  function renderRow(
    assignment
  ) {
    const el =
      document.createElement(
        "div"
      );

    el.className =
      "cw-item";

    el.dataset.id =
      assignment._id;

    const progressStatus =
      getProgressStatus(
        assignment
      );

    const progressLabel =
      getProgressLabel(
        progressStatus
      );

    const progressClass =
      getProgressClass(
        progressStatus
      );

    el.innerHTML = `
      <div>

        <div class="cw-title">
          ${escapeHtml(
            assignment.title ||
              "Untitled Assignment"
          )}
        </div>

        <div class="cw-meta">

          <span>
            ${escapeHtml(
              assignment.subject ||
                "—"
            )}
          </span>

          <span>•</span>

          <span>
            Due:
            ${escapeHtml(
              fmtDue(
                assignment.dueDate
              )
            )}
          </span>

        </div>

        <div class="cw-desc">
          ${escapeHtml(
            clampText(
              assignment.instructions ||
                ""
            )
          )}
        </div>

      </div>

      <div class="cw-teacher">
        —
      </div>

      <div class="cw-due">

        <div>
          ${escapeHtml(
            fmtDue(
              assignment.dueDate
            )
          )}
        </div>

        <div class="cw-row-status">

          <span
            class="cw-status ${progressClass}"
          >
            ${escapeHtml(
              progressLabel
            )}
          </span>

        </div>

      </div>
    `;

    /* ===============================
       PROGRESS SELECT
    ================================= */

    const progressSelect =
      createProgressSelect(
        assignment
      );

    el.appendChild(
      progressSelect
    );

    /* ===============================
       OPEN DETAILS
    ================================= */

    el.addEventListener(
      "click",
      () =>
        openDetails(
          assignment._id
        )
    );

    return el;
  }

  /* ===============================
     RENDER
  ================================= */

  function render() {
    const finalList =
      applyFilters(
        state.assignments
      );

    listEl.innerHTML = "";

    if (!finalList.length) {
      emptyEl.classList.remove(
        "hidden"
      );

      return;
    }

    emptyEl.classList.add(
      "hidden"
    );

    finalList.forEach(
      (assignment) => {
        listEl.appendChild(
          renderRow(
            assignment
          )
        );
      }
    );
  }

  /* ===============================
     CHIP
  ================================= */

  function chip(
    text,
    tone
  ) {
    const c =
      document.createElement(
        "span"
      );

    c.className =
      "cw-chip " +
      (tone || "gray");

    c.textContent =
      text;

    return c;
  }

  /* ===============================
     OPEN ASSIGNMENT DETAILS
  ================================= */

  function openDetails(id) {
    const item =
      state.assignments.find(
        (x) =>
          x &&
          String(x._id) ===
            String(id)
      );

    if (!item) return;

    state.selectedId =
      item._id;

    /* ===============================
       TITLE
    ================================= */

    if (viewTitle) {
      viewTitle.textContent =
        item.title ||
        "Assignment Details";
    }

    /* ===============================
       CLASS / SECTION
    ================================= */

    if (viewSub) {
      viewSub.textContent =
        `${item.className || "—"} - Section ${
          item.sectionName || "—"
        }`;
    }

    /* ===============================
       CHIPS
    ================================= */

    if (viewChips) {
      viewChips.innerHTML =
        "";

      viewChips.appendChild(
        chip(
          item.subject || "—",
          "blue"
        )
      );

      viewChips.appendChild(
        chip(
          "Due: " +
            fmtDue(
              item.dueDate
            ),
          "orange"
        )
      );

      viewChips.appendChild(
        chip(
          item.quarter || "—",
          "gray"
        )
      );

      const progressStatus =
        getProgressStatus(
          item
        );

      const progressLabel =
        getProgressLabel(
          progressStatus
        );

      const progressClass =
        getProgressClass(
          progressStatus
        );

      viewChips.appendChild(
        chip(
          progressLabel,
          progressClass
        )
      );
    }

    /* ===============================
       INSTRUCTIONS
    ================================= */

    if (viewDesc) {
      viewDesc.textContent =
        item.instructions ||
        "No instructions provided.";
    }

    /* ===============================
       FILE
    ================================= */

    if (viewFile) {
      viewFile.innerHTML = `
        <span class="cw-file-muted">
          No file attached.
        </span>
      `;
    }

    if (downloadBtn) {
      downloadBtn.disabled =
        true;
    }

    /* ===============================
       MODAL PROGRESS
    ================================= */

    createModalProgressSelect(
      item
    );

    openModal(
      viewModal
    );
  }

  /* ===============================
     MODAL PROGRESS SELECT
  ================================= */

  function createModalProgressSelect(
    assignment
  ) {
    if (!viewModal) return;

    const footerRight =
      viewModal.querySelector(
        ".tmodal-foot-right"
      );

    if (!footerRight) return;

    /* ===============================
       REMOVE PREVIOUS
    ================================= */

    const oldWrap =
      footerRight.querySelector(
        ".cw-modal-progress-wrap"
      );

    if (oldWrap) {
      oldWrap.remove();
    }

    /* ===============================
       WRAPPER
    ================================= */

    const wrapper =
      document.createElement(
        "div"
      );

    wrapper.className =
      "cw-modal-progress-wrap";

    /* ===============================
       LABEL
    ================================= */

    const label =
      document.createElement(
        "span"
      );

    label.className =
      "cw-modal-progress-label";

    label.textContent =
      "Progress:";

    /* ===============================
       SELECT
    ================================= */

    const select =
      document.createElement(
        "select"
      );

    select.className =
      "cw-progress-select";

    select.setAttribute(
      "aria-label",
      "Assignment progress"
    );

    const currentStatus =
      getProgressStatus(
        assignment
      );

    [
      [
        "not_started",
        "Not Started",
      ],

      [
        "in_progress",
        "In Progress",
      ],

      [
        "done",
        "Done",
      ],
    ].forEach(
      ([value, text]) => {
        const option =
          document.createElement(
            "option"
          );

        option.value =
          value;

        option.textContent =
          text;

        option.selected =
          value ===
          currentStatus;

        select.appendChild(
          option
        );
      }
    );

    select.disabled =
      state.progressLoading;

    /* ===============================
       PREVENT MODAL INTERFERENCE
    ================================= */

    select.addEventListener(
      "click",
      (event) => {
        event.stopPropagation();
      }
    );

    select.addEventListener(
      "change",
      async () => {
        await updateAssignmentProgress(
          assignment,
          select.value
        );
      }
    );

    /* ===============================
       APPEND
    ================================= */

    wrapper.appendChild(
      label
    );

    wrapper.appendChild(
      select
    );

    footerRight.insertBefore(
      wrapper,
      footerRight.firstChild
    );
  }

  /* ===============================
     SUBJECT FILTER EVENT
  ================================= */

  subjectFilter?.addEventListener(
    "change",
    () => {
      state.subject =
        subjectFilter.value ||
        "all";

      render();
    }
  );

  /* ===============================
     SEARCH EVENT
  ================================= */

  searchInput?.addEventListener(
    "input",
    (e) => {
      state.q =
        String(
          e.target.value || ""
        );

      render();
    }
  );

  /* ===============================
     VIEW MODAL CLOSE
  ================================= */

  viewBackdrop?.addEventListener(
    "click",
    () =>
      closeModal(
        viewModal
      )
  );

  viewCloseX?.addEventListener(
    "click",
    () =>
      closeModal(
        viewModal
      )
  );

  viewCloseBtn?.addEventListener(
    "click",
    () =>
      closeModal(
        viewModal
      )
  );

  /* ===============================
     DOWNLOAD
  ================================= */

  downloadBtn?.addEventListener(
    "click",
    () => {
      const item =
        state.assignments.find(
          (x) =>
            x &&
            String(x._id) ===
              String(
                state.selectedId
              )
        );

      if (!item) return;

      alert(
        "No assignment file is attached."
      );
    }
  );

  /* ===============================
     ESC
  ================================= */

  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Escape") {
        return;
      }

      if (
        viewModal &&
        !viewModal.classList.contains(
          "hidden"
        )
      ) {
        closeModal(
          viewModal
        );
      }
    }
  );

  /* ===============================
     BOOT
  ================================= */

  loadAssignments();
}