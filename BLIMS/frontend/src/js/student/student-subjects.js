document.addEventListener("DOMContentLoaded", () => {
  initTopbarMenu();
  initLogout();
  initSubjects();
});

function $(id) {
  return document.getElementById(id);
}

// ==========================================
// TOPBAR MENU
// ==========================================

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

// ==========================================
// LOGOUT
// ==========================================

function initLogout() {
  const btn = $("topbarLogout");

  if (!btn) return;

  btn.addEventListener("click", () => {
    window.location.href = "../../login.html";
  });
}

// ==========================================
// STUDENT SUBJECTS
// ==========================================

function initSubjects() {
  const subjList = $("subjList");
  const subjEmpty = $("subjEmpty");

  const tabCurrent = $("tabCurrent");
  const tabArchive = $("tabArchive");

  const subjSearch = $("subjSearch");

  const gradeEl = $("subjGrade");

  if (
    !subjList ||
    !subjEmpty ||
    !tabCurrent ||
    !tabArchive
  ) {
    return;
  }

  const state = {
    mode: "current",
    q: "",
    grade: "",
    subjects: [],
  };

  // ==========================================
  // HELPERS
  // ==========================================

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function norm(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
  }

  // ==========================================
  // FETCH SUBJECTS
  // ==========================================

  async function fetchSubjects() {
    try {
      subjList.innerHTML = "";

      subjEmpty.textContent =
        "Loading subjects...";

      subjEmpty.classList.remove("hidden");

      const response = await fetch(
        "/api/student/subjects",
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
            "Failed to load student subjects."
        );
      }

      const data = result.data || {};

      // ==========================================
      // GRADE
      // ==========================================

      state.grade = String(
        data.grade || ""
      ).trim();

      // ==========================================
      // SUBJECTS
      // ==========================================

      state.subjects = Array.isArray(
        data.subjects
      )
        ? data.subjects
            .map((subject) =>
              String(subject || "").trim()
            )
            .filter(Boolean)
        : [];

      render();

    } catch (error) {

      console.error(
        "❌ Failed to fetch student subjects:",
        error
      );

      state.grade = "";
      state.subjects = [];

      subjList.innerHTML = "";

      subjEmpty.textContent =
        "Unable to load subjects.";

      subjEmpty.classList.remove("hidden");
    }
  }

  // ==========================================
  // TABS
  // ==========================================

  function setTab(mode) {
    const isCurrent =
      mode === "current";

    tabCurrent.classList.toggle(
      "active",
      isCurrent
    );

    tabCurrent.setAttribute(
      "aria-selected",
      isCurrent
        ? "true"
        : "false"
    );

    tabArchive.classList.toggle(
      "active",
      !isCurrent
    );

    tabArchive.setAttribute(
      "aria-selected",
      !isCurrent
        ? "true"
        : "false"
    );

    state.mode = mode;
  }

  // ==========================================
  // RENDER
  // ==========================================

  function render() {
    subjList.innerHTML = "";

    // ==========================================
    // DISPLAY GRADE
    // ==========================================

    if (gradeEl) {
      gradeEl.textContent =
        state.grade || "Grade —";
    }

    // ==========================================
    // SUBJECTS
    // ==========================================

    let subjects = [
      ...state.subjects,
    ];

    // Archive is not implemented yet.
    if (
      state.mode === "archive"
    ) {
      subjects = [];
    }

    // ==========================================
    // SEARCH
    // ==========================================

    const q = norm(
      state.q
    );

    if (q) {
      subjects =
        subjects.filter(
          (subject) =>
            norm(subject).includes(q)
        );
    }

    // ==========================================
    // EMPTY STATE
    // ==========================================

    if (!subjects.length) {

      subjEmpty.textContent =
        state.mode === "archive"
          ? "No archived subjects."
          : "No subjects to display.";

      subjEmpty.classList.remove(
        "hidden"
      );

      return;
    }

    subjEmpty.classList.add(
      "hidden"
    );

    // ==========================================
    // RENDER SUBJECTS
    // ==========================================

    subjects.forEach(
      (subject) => {

        const row =
          document.createElement(
            "div"
          );

        row.className =
          "subj-row";

        row.innerHTML = `
          <div>
            <div class="subj-name">
              ${escapeHtml(subject)}
            </div>

            <div class="subj-meta">
              ${escapeHtml(state.grade)}
            </div>
          </div>
        `;

        subjList.appendChild(
          row
        );
      }
    );
  }

  // ==========================================
  // CURRENT TAB
  // ==========================================

  tabCurrent.addEventListener(
    "click",
    () => {
      setTab("current");
      render();
    }
  );

  // ==========================================
  // ARCHIVE TAB
  // ==========================================

  tabArchive.addEventListener(
    "click",
    () => {
      setTab("archive");
      render();
    }
  );

  // ==========================================
  // SEARCH
  // ==========================================

  subjSearch?.addEventListener(
    "input",
    (event) => {

      state.q =
        String(
          event.target.value || ""
        );

      render();
    }
  );

  // ==========================================
  // INITIALIZE
  // ==========================================

  setTab("current");

  fetchSubjects();
}