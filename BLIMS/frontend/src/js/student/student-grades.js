// frontend/src/js/student/student-grades.js


document.addEventListener("DOMContentLoaded", () => {
  initTopbarMenu();
  initLogout();
  initGrades();
});


function $(id) {
  return document.getElementById(id);
}


/* =========================================================
   TOPBAR
========================================================= */


function initTopbarMenu() {
  const btn = $("userMenuBtn");
  const menu = $("userMenu");
  const box = $("userbox");


  if (!btn || !menu || !box) return;


  btn.addEventListener("click", (event) => {
    event.stopPropagation();
    menu.classList.toggle("open");
  });


  document.addEventListener("click", (event) => {
    if (!box.contains(event.target)) {
      menu.classList.remove("open");
    }
  });
}


function initLogout() {
  const btn = $("topbarLogout");


  if (!btn) return;


  btn.addEventListener("click", () => {
    window.location.href = "../../login.html";
  });
}


/* =========================================================
   GRADES
========================================================= */


function initGrades() {
  const tbody = $("gradesTbody");
  const empty = $("gradesEmpty");


  const gradeSectionEl = $("gradesGradeSection");
  const finalAverageEl = $("finalAverage");
  const promotionStatusEl = $("promotionStatus");


  const tabsContainer = $("gradesTabs");


  if (
    !tbody ||
    !empty ||
    !gradeSectionEl ||
    !finalAverageEl ||
    !promotionStatusEl ||
    !tabsContainer
  ) {
    console.error(
      "Student Grades: Required HTML elements are missing."
    );
    return;
  }


  const state = {
  selectedTermId: "",
  terms: [],
  subjects: [],
  grades: [],
  student: null,
};
  /* =======================================================
     HELPERS
  ======================================================= */


  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }


  function normalize(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase();
  }


  function getNumericGrade(value) {
    if (value === null || value === undefined || value === "") {
      return null;
    }


    const number = Number(value);


    return Number.isFinite(number) ? number : null;
  }


  function getRemark(grade) {
    const numericGrade = getNumericGrade(grade);


    if (numericGrade === null) {
      return "—";
    }


    return numericGrade >= 75
      ? "Passed"
      : "Needs Improvement";
  }


  /* =======================================================
     FETCH BACKEND DATA
  ======================================================= */


  async function fetchGrades() {
    try {
      setLoadingState();


      const response = await fetch(
        "/api/student/grades",
        {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        }
      );


      let result = null;


      try {
        result = await response.json();
      } catch {
        result = null;
      }


      if (!response.ok || !result?.ok) {
        throw new Error(
          result?.message ||
            "Failed to load student grades."
        );
      }


      const data = result.data || {};


      state.student = data.student || null;
      state.subjects = Array.isArray(data.subjects)
  ? data.subjects
      .map((subject) => String(subject || "").trim())
      .filter(Boolean)
  : [];


      state.terms = Array.isArray(data.terms)
        ? data.terms
            .map((term) => ({
              id: String(term?._id || term?.id || ""),
              name: String(term?.name || "").trim(),
              order: Number(term?.order || 0),
              locked: !!term?.locked,
            }))
            .filter((term) => term.id && term.name)
            .sort((a, b) => a.order - b.order)
        : [];


      state.grades = Array.isArray(data.grades)
        ? data.grades.map((grade) => ({
            id: String(grade?.id || ""),
            subject: String(
              grade?.subject || ""
            ).trim(),


            termId: String(
              grade?.termId || ""
            ),


            termName: String(
              grade?.termName || ""
            ).trim(),


            termOrder: Number(
              grade?.termOrder || 0
            ),


            locked: !!grade?.locked,


            initialGrade:
              grade?.initialGrade ??
              null,


            termGrade:
              grade?.termGrade ??
              null,
          }))
        : [];


      updateStudentInfo();
      buildTermTabs();


      /*
       * Select the first available term.
       */
      if (state.terms.length) {
        const firstTerm = state.terms[0];


        state.selectedTermId = firstTerm.id;
      } else {
        state.selectedTermId = "";
      }


      updateActiveTab();
      render();


    } catch (error) {
      console.error(
        "❌ Failed to fetch student grades:",
        error
      );


      state.student = null;
      state.terms = [];
      state.subjects = [];
      state.grades = [];
      state.selectedTermId = "";


      tabsContainer.innerHTML = "";


      gradeSectionEl.textContent = "Grade —";


      tbody.innerHTML = "";


      empty.textContent =
        "Unable to load grades.";


      empty.classList.remove("hidden");


      finalAverageEl.textContent = "—";
      promotionStatusEl.textContent = "—";
    }
  }


  /* =======================================================
     LOADING STATE
  ======================================================= */


  function setLoadingState() {
    tbody.innerHTML = "";


    empty.textContent =
      "Loading grades...";


    empty.classList.remove("hidden");


    finalAverageEl.textContent = "—";
    promotionStatusEl.textContent = "—";
  }


  /* =======================================================
     STUDENT INFORMATION
  ======================================================= */


  function updateStudentInfo() {
    if (!state.student) {
      gradeSectionEl.textContent = "Grade —";
      return;
    }


    const grade = String(
      state.student.grade || ""
    ).trim();


    const section = String(
      state.student.section || ""
    ).trim();


    if (grade && section) {
      gradeSectionEl.textContent =
        `${grade} - Section ${section}`;
    } else if (grade) {
      gradeSectionEl.textContent = grade;
    } else {
      gradeSectionEl.textContent = "Grade —";
    }
  }


  /* =======================================================
     TERM TABS
  ======================================================= */


  function buildTermTabs() {
    tabsContainer.innerHTML = "";


    if (!state.terms.length) {
      return;
    }


    state.terms.forEach((term) => {
      const button =
        document.createElement("button");


      button.type = "button";
      button.className = "grades-tab";


      button.setAttribute(
        "role",
        "tab"
      );


      button.setAttribute(
        "aria-selected",
        "false"
      );


      button.dataset.termId = term.id;


      button.textContent = term.name;


      /*
       * Locked terms are still visible.
       *
       * They are not disabled because the student
       * should still be able to see the term tab.
       *
       * Whether grades exist is determined by the
       * backend data.
       */
      if (term.locked) {
        button.classList.add("locked");
      }


      button.addEventListener(
        "click",
        () => {
          state.selectedTermId = term.id;


          updateActiveTab();
          render();
        }
      );


      tabsContainer.appendChild(button);
    });
  }


  function updateActiveTab() {
    const buttons =
      tabsContainer.querySelectorAll(
        ".grades-tab"
      );


    buttons.forEach((button) => {
      const isActive =
        button.dataset.termId ===
        state.selectedTermId;


      button.classList.toggle(
        "active",
        isActive
      );


      button.setAttribute(
        "aria-selected",
        isActive
          ? "true"
          : "false"
      );
    });
  }


  /* =======================================================
   GET CURRENT TERM GRADES
======================================================= */


function getCurrentTermGrades() {
  if (!state.selectedTermId) {
    return [];
  }


  const selectedTerm = state.terms.find(
    (term) =>
      String(term.id).trim() ===
      String(state.selectedTermId).trim()
  );


  if (!selectedTerm) {
    return [];
  }


  const selectedTermId =
    String(selectedTerm.id || "").trim();


  const selectedTermName =
    normalize(selectedTerm.name);


  const selectedTermOrder =
    Number(selectedTerm.order || 0);


  return state.grades.filter((grade) => {
    const gradeTermId =
      String(grade.termId || "").trim();


    const gradeTermName =
      normalize(grade.termName);


    const gradeTermOrder =
      Number(grade.termOrder || 0);


    /*
     * 1. Best match: actual term ID
     */
    if (
      gradeTermId &&
      selectedTermId &&
      gradeTermId === selectedTermId
    ) {
      return true;
    }


    /*
     * 2. Fallback: term order
     *
     * This handles grades whose termId does not
     * match the SchoolYear term ID but whose
     * term order is correct.
     */
    if (
      gradeTermOrder > 0 &&
      selectedTermOrder > 0 &&
      gradeTermOrder === selectedTermOrder
    ) {
      return true;
    }


    /*
     * 3. Final fallback: term name
     */
    if (
      gradeTermName &&
      selectedTermName &&
      gradeTermName === selectedTermName
    ) {
      return true;
    }


    return false;
  });
}
 
  /* =======================================================
     FINAL AVERAGE
  ======================================================= */


  function calculateFinalAverage() {
    /*
     * Group grades by subject.
     *
     * Each subject can have multiple term grades.
     */


    const subjectMap = new Map();


    state.grades.forEach((grade) => {
      const subject = String(
        grade.subject || ""
      ).trim();


      const termGrade =
        getNumericGrade(
          grade.termGrade
        );


      if (!subject || termGrade === null) {
        return;
      }


      const key = normalize(subject);


      if (!subjectMap.has(key)) {
        subjectMap.set(key, []);
      }


      subjectMap
        .get(key)
        .push(termGrade);
    });


    if (!subjectMap.size) {
      return null;
    }


    const subjectAverages = [];


    subjectMap.forEach((grades) => {
      if (!grades.length) return;


      const total = grades.reduce(
        (sum, grade) =>
          sum + grade,
        0
      );


      const average =
        total / grades.length;


      subjectAverages.push(
        average
      );
    });


    if (!subjectAverages.length) {
      return null;
    }


    const total =
      subjectAverages.reduce(
        (sum, average) =>
          sum + average,
        0
      );


    return Math.round(
      total / subjectAverages.length
    );
  }


  /* =======================================================
     RENDER
  ======================================================= */


  function render() {
    tbody.innerHTML = "";


    /*
     * No terms configured.
     */
    if (!state.terms.length) {
      empty.textContent =
        "No grading terms available yet.";


      empty.classList.remove("hidden");


      finalAverageEl.textContent = "—";
      promotionStatusEl.textContent = "—";


      return;
    }


   const currentTermGrades =
  getCurrentTermGrades();


const gradeBySubject = new Map();


currentTermGrades.forEach((grade) => {
  const key = normalize(grade.subject);


  if (key) {
    gradeBySubject.set(key, grade);
  }
});


if (!state.subjects.length) {
  empty.textContent =
    "No subjects available.";


  empty.classList.remove("hidden");
} else {
  empty.classList.add("hidden");


  state.subjects.forEach((subject) => {
    const tr =
      document.createElement("tr");


    const grade =
      gradeBySubject.get(
        normalize(subject)
      );


    const termGrade = grade
      ? getNumericGrade(grade.termGrade)
      : null;


    const displayGrade =
      termGrade === null
        ? "—"
        : termGrade;


    const remark =
      getRemark(termGrade);


    tr.innerHTML = `
      <td>
        ${escapeHtml(subject)}
      </td>


      <td style="text-align:right;">
        ${escapeHtml(displayGrade)}
      </td>


      <td>
        ${escapeHtml(remark)}
      </td>
    `;


    tbody.appendChild(tr);
  });
}


    /*
     * Final average is based on all available
     * term grades across the school year.
     */
    const finalAverage =
      calculateFinalAverage();


    if (finalAverage === null) {
      finalAverageEl.textContent = "—";
      promotionStatusEl.textContent = "—";
      return;
    }


    finalAverageEl.textContent =
      finalAverage;


    promotionStatusEl.textContent =
      finalAverage >= 75
        ? "Promoted"
        : "For Review";
  }


  /* =======================================================
     INITIAL LOAD
  ======================================================= */


  fetchGrades();
}

