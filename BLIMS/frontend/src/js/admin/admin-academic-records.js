// frontend/src/js/admin/admin-academic-records.js

// ============================================================
// ACADEMIC RECORDS - ADMIN
// ============================================================
//
// Data sources:
//
// GET /api/admin/students?class=all
// GET /api/admin/grade-levels
// GET /api/admin/sections?grade=...
// GET /api/admin/academic-records
//
// Academic Records endpoint returns:
//
// {
//   schoolYear: {
//     id,
//     name,
//     terms: [
//       {
//         id,
//         order,
//         name,
//         start,
//         end,
//         locked
//       }
//     ]
//   },
//   grades: [
//     {
//       id,
//       studentId,
//       gradeLevel,
//       sectionName,
//       subject,
//       schoolYearId,
//       schoolYearName,
//       termId,
//       initialGrade,
//       termGrade,
//       teacherId
//     }
//   ]
// }
//
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  // ==========================================================
  // API
  // ==========================================================

  const ADMIN_API = "/api/admin";

  let csrfToken = "";

  // ==========================================================
  // UI
  // ==========================================================

  const gradeSelect = $("gradeSelect");
  const sectionSelect = $("sectionSelect");
  const searchInput = $("searchInput");
  const recordsTbody = $("recordsTbody");
  const summaryLine = $("summaryLine");

  const refreshBtn = $("refreshBtn");

  const exportBtn = $("exportBtn");
  const exportMenu = $("exportMenu");
  const exportClassBtn = $("exportClassBtn");
  const exportGradeBtn = $("exportGradeBtn");
  const exportAllBtn = $("exportAllBtn");

  // ==========================================================
  // STATE
  // ==========================================================

  let students = [];
  let gradeLevels = [];
  let sections = [];

  let activeSchoolYear = null;
  let terms = [];

  // All Grade collection records returned by backend.
  let gradeRecords = [];

  // Filtered students currently shown.
  let currentRows = [];

  // ==========================================================
  // HELPERS
  // ==========================================================

  function esc(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function norm(value) {
    return String(value ?? "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function fullName(student) {
    return [
      student?.firstName,
      student?.middleName,
      student?.lastName,
      student?.suffix,
    ]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getStudentName(student) {
    return (
      fullName(student) ||
      student?.name ||
      student?.fullName ||
      student?.studentName ||
      "Unnamed Student"
    );
  }

  // ==========================================================
  // GET STUDENT ID
  // ==========================================================
  //
  // Grade.model stores studentId as a STRING.
  //
  // Prefer the actual studentId first, then fall back to
  // id / _id for projects where the student API uses Mongo IDs.
  //
  // ==========================================================

  function getStudentId(student) {
    return String(
      student?.studentId ||
      student?.id ||
      student?._id ||
      ""
    ).trim();
  }

  // ==========================================================
  // CSRF
  // ==========================================================

  async function loadCsrfToken() {
    try {
      const response = await fetch("/api/csrf-token", {
        credentials: "include",
      });

      const data = await response.json().catch(() => ({}));

      csrfToken = data?.csrfToken || "";

      return csrfToken;
    } catch (error) {
      console.warn("Failed to load CSRF token:", error);

      return "";
    }
  }

  // ==========================================================
  // API HELPER
  // ==========================================================

  async function api(path, options = {}) {
    const method = String(
      options.method || "GET"
    ).toUpperCase();

    const headers = {
      ...(options.headers || {}),
    };

    if (
      ["POST", "PUT", "PATCH", "DELETE"].includes(method)
    ) {
      if (!csrfToken) {
        await loadCsrfToken();
      }

      headers["X-CSRF-Token"] = csrfToken || "";
    }

    if (
      options.body &&
      !headers["Content-Type"]
    ) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(
      `${ADMIN_API}${path}`,
      {
        ...options,
        credentials: "include",
        headers,
      }
    );

    let data = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      throw new Error(
        data?.message ||
        data?.error ||
        `Request failed (${response.status})`
      );
    }

    // Support APIs that return:
    //
    // {
    //   ok: true,
    //   data: ...
    // }
    //
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

  // ==========================================================
  // LOAD GRADE LEVELS
  // ==========================================================

  async function loadGradeLevels() {
    const data = await api("/grade-levels");

    let list = [];

    if (Array.isArray(data)) {
      list = data;
    } else if (
      data &&
      Array.isArray(data.items)
    ) {
      list = data.items;
    } else if (
      data &&
      Array.isArray(data.gradeLevels)
    ) {
      list = data.gradeLevels;
    }

    gradeLevels = list
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        return (
          item?.grade ||
          item?.name ||
          ""
        );
      })
      .filter(Boolean);

    gradeLevels = [
      ...new Set(gradeLevels),
    ];
  }

  // ==========================================================
  // LOAD SECTIONS
  // ==========================================================

  async function loadSections(grade) {
    sections = [];

    if (!grade) {
      buildSectionSelect();
      return;
    }

    const data = await api(
      `/sections?grade=${encodeURIComponent(grade)}`
    );

    let list = [];

    if (Array.isArray(data)) {
      list = data;
    } else if (
      data &&
      Array.isArray(data.items)
    ) {
      list = data.items;
    } else if (
      data &&
      Array.isArray(data.sections)
    ) {
      list = data.sections;
    }

    sections = list
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }

        return (
          item?.section ||
          item?.name ||
          ""
        );
      })
      .filter(Boolean);

    sections = [
      ...new Set(sections),
    ];

    buildSectionSelect();
  }

  // ==========================================================
  // LOAD ACTIVE SCHOOL YEAR + TERMS
  // ==========================================================

  async function loadActiveSchoolYear() {
    const data = await api("/school-years");

    let schoolYears = [];

    if (Array.isArray(data)) {
      schoolYears = data;
    } else if (
      data &&
      Array.isArray(data.items)
    ) {
      schoolYears = data.items;
    } else if (
      data &&
      Array.isArray(data.schoolYears)
    ) {
      schoolYears = data.schoolYears;
    }

    activeSchoolYear =
      schoolYears.find(
        (item) =>
          item?.isActive === true
      ) || null;

    if (!activeSchoolYear) {
      terms = [];
      return;
    }

    terms = Array.isArray(
      activeSchoolYear.terms
    )
      ? activeSchoolYear.terms
          .slice()
          .sort(
            (a, b) =>
              (a.order || 0) -
              (b.order || 0)
          )
      : [];
  }

  // ==========================================================
  // LOAD STUDENTS
  // ==========================================================

  async function loadStudents() {
    const data = await api(
      "/students?class=all"
    );

    if (Array.isArray(data)) {
      students = data;
    } else if (
      data &&
      Array.isArray(data.students)
    ) {
      students = data.students;
    } else if (
      data &&
      Array.isArray(data.items)
    ) {
      students = data.items;
    } else {
      students = [];
    }
  }

  // ==========================================================
  // LOAD ACTUAL ACADEMIC RECORDS
  // ==========================================================
  //
  // This is the important new part.
  //
  // The grades are NOT stored inside the student object.
  // They come from Grade.model through:
  //
  // GET /api/admin/academic-records
  //
  // ==========================================================

  async function loadAcademicRecords() {
    const data = await api(
      "/academic-records"
    );

    gradeRecords = Array.isArray(
      data?.grades
    )
      ? data.grades
      : [];

    // If the academic-records controller provides
    // the school year and terms, prefer those.
    if (
      data?.schoolYear &&
      Array.isArray(
        data.schoolYear.terms
      )
    ) {
      activeSchoolYear = {
        ...(activeSchoolYear || {}),
        ...data.schoolYear,
        terms: data.schoolYear.terms,
      };

      terms = data.schoolYear.terms
        .slice()
        .sort(
          (a, b) =>
            (a.order || 0) -
            (b.order || 0)
        );
    }

    console.log(
      "Academic records loaded:",
      gradeRecords.length
    );
  }

  // ==========================================================
  // GRADE / SECTION HELPERS
  // ==========================================================

  function getStudentGrade(student) {
    return (
      student?.className ||
      student?.grade ||
      student?.gradeLevel ||
      ""
    );
  }

  function getStudentSection(student) {
    return (
      student?.sectionName ||
      student?.section ||
      ""
    );
  }

  // ==========================================================
  // BUILD GRADE SELECT
  // ==========================================================

  function buildGradeSelect() {
    if (!gradeSelect) {
      return;
    }

    const current =
      gradeSelect.value;

    gradeSelect.innerHTML =
      gradeLevels
        .map(
          (grade) => `
            <option value="${esc(grade)}">
              ${esc(grade)}
            </option>
          `
        )
        .join("");

    if (
      gradeLevels.includes(current)
    ) {
      gradeSelect.value =
        current;
    } else {
      gradeSelect.value =
        gradeLevels[0] || "";
    }
  }

  // ==========================================================
  // BUILD SECTION SELECT
  // ==========================================================

  function buildSectionSelect() {
    if (!sectionSelect) {
      return;
    }

    const current =
      sectionSelect.value;

    sectionSelect.innerHTML =
      sections
        .map(
          (section) => `
            <option value="${esc(section)}">
              ${esc(section)}
            </option>
          `
        )
        .join("");

    if (
      sections.includes(current)
    ) {
      sectionSelect.value =
        current;
    } else {
      sectionSelect.value =
        sections[0] || "";
    }
  }

  // ==========================================================
  // FILTER STUDENTS
  // ==========================================================

  function getFilteredStudents() {
    const grade =
      gradeSelect?.value || "";

    const section =
      sectionSelect?.value || "";

    const query =
      norm(searchInput?.value);

    let result = students.filter(
      (student) => {
        const studentGrade =
          getStudentGrade(student);

        const studentSection =
          getStudentSection(student);

        const matchesGrade =
          norm(studentGrade) ===
          norm(grade);

        const matchesSection =
          norm(studentSection) ===
          norm(section);

        return (
          matchesGrade &&
          matchesSection
        );
      }
    );

    if (query) {
      result = result.filter(
        (student) =>
          norm(
            getStudentName(student)
          ).includes(query)
      );
    }

    result.sort((a, b) =>
      getStudentName(a).localeCompare(
        getStudentName(b)
      )
    );

    currentRows = result;

    return result;
  }

  // ==========================================================
  // FIND GRADES FOR STUDENT
  // ==========================================================

  function getStudentGradeRecords(student) {
    const studentId =
      getStudentId(student);

    if (!studentId) {
      return [];
    }

    return gradeRecords.filter(
      (record) =>
        String(
          record?.studentId ?? ""
        ).trim() === studentId
    );
  }

  // ==========================================================
  // GET TERM GRADE
  // ==========================================================
  //
  // Grade records are stored per subject.
  //
  // Example:
  //
  // Student A
  //   Math      Term 1 = 90
  //   English   Term 1 = 88
  //   Science   Term 1 = 92
  //
  // The Academic Records table does not have a Subject column.
  // Therefore, the displayed Term 1 value is the average of
  // the student's available subject term grades.
  //
  // ==========================================================

  function getTermGrade(
    student,
    term,
    index
  ) {
    const studentRecords =
      getStudentGradeRecords(
        student
      );

    if (!studentRecords.length) {
      return null;
    }

    const termId = String(
      term?._id ||
      term?.id ||
      ""
    ).trim();

    const termName =
      norm(term?.name);

    let matchingRecords =
      studentRecords.filter(
        (record) => {
          const recordTermId =
            String(
              record?.termId ?? ""
            ).trim();

          return (
            (termId &&
              recordTermId ===
                termId) ||
            (!termId &&
              termName &&
              norm(
                record?.termName
              ) === termName)
          );
        }
      );

    // Fallback for older data where termId
    // may not match exactly but term order
    // corresponds to the term index.
    if (
      !matchingRecords.length &&
      !termId
    ) {
      matchingRecords =
        studentRecords;
    }

    const values =
      matchingRecords
        .map((record) => {
          // termGrade is the final grade for
          // that subject and term.
          if (
            record?.termGrade !==
              null &&
            record?.termGrade !==
              undefined &&
            String(
              record.termGrade
            ).trim() !== ""
          ) {
            return Number(
              record.termGrade
            );
          }

          // Fallback to initialGrade
          // if termGrade is not available.
          if (
            record?.initialGrade !==
              null &&
            record?.initialGrade !==
              undefined &&
            String(
              record.initialGrade
            ).trim() !== ""
          ) {
            return Number(
              record.initialGrade
            );
          }

          return null;
        })
        .filter(
          (value) =>
            Number.isFinite(value)
        );

    if (!values.length) {
      return null;
    }

    const total =
      values.reduce(
        (sum, value) =>
          sum + value,
        0
      );

    return (
      Math.round(
        (total / values.length) *
          100
      ) / 100
    );
  }

  // ==========================================================
  // NUMBER HELPER
  // ==========================================================

  function toNumber(value) {
    if (
      value === null ||
      value === undefined ||
      String(value).trim() === ""
    ) {
      return null;
    }

    const number =
      Number(value);

    return Number.isFinite(
      number
    )
      ? number
      : null;
  }

  // ==========================================================
  // FINAL AVERAGE
  // ==========================================================

  function computeFinal(student) {
    const values = terms
      .map(
        (term, index) =>
          toNumber(
            getTermGrade(
              student,
              term,
              index
            )
          )
      )
      .filter(
        (value) =>
          value !== null
      );

    if (!values.length) {
      return null;
    }

    const total =
      values.reduce(
        (sum, value) =>
          sum + value,
        0
      );

    return (
      Math.round(
        (total / values.length) *
          100
      ) / 100
    );
  }

  // ==========================================================
  // STATUS
  // ==========================================================

  function statusPill(status) {
    const normalized =
      norm(status);

    let className =
      "pending";

    let label =
      "Pending";

    if (
      normalized ===
      "promoted"
    ) {
      className =
        "promoted";

      label =
        "Promoted";
    } else if (
      normalized ===
      "retained"
    ) {
      className =
        "retained";

      label =
        "Retained";
    } else if (
      normalized ===
      "missed"
    ) {
      className =
        "missed";

      label =
        "Missed";
    }

    return `
      <span
        class="ar-status ${className}"
      >
        ${esc(label)}
      </span>
    `;
  }

  // ==========================================================
  // RENDER TABLE HEADER
  // ==========================================================

  function renderHeaders() {
    const table =
      document.querySelector(
        ".ar-table"
      );

    if (!table) {
      return;
    }

    const thead =
      table.querySelector(
        "thead"
      );

    if (!thead) {
      return;
    }

    const termHeaders =
      terms
        .map(
          (term) => `
            <th
              style="
                width:90px;
                text-align:center;
              "
            >
              ${esc(
                term?.name ||
                "Term"
              )}
            </th>
          `
        )
        .join("");

    thead.innerHTML = `
      <tr>

        <th
          style="width:70px;"
        >
          No.
        </th>

        <th>
          Student
        </th>

        ${termHeaders}

        <th
          style="
            width:130px;
            text-align:center;
          "
        >
          Final Avg
        </th>

        <th
          style="
            width:140px;
            text-align:center;
          "
        >
          Status
        </th>

      </tr>
    `;
  }

  // ==========================================================
  // RENDER TABLE
  // ==========================================================

  function render() {
    renderHeaders();

    if (!recordsTbody) {
      return;
    }

    const rows =
      getFilteredStudents();

    const grade =
      gradeSelect?.value ||
      "—";

    const section =
      sectionSelect?.value ||
      "—";

    if (summaryLine) {
      summaryLine.textContent =
        `Showing: ${grade} • Section ${section} • ${rows.length} student(s)`;
    }

    const colspan =
      2 +
      terms.length +
      2;

    if (!rows.length) {
      recordsTbody.innerHTML = `
        <tr class="ar-empty">
          <td colspan="${colspan}">
            No students found.
          </td>
        </tr>
      `;

      return;
    }

    recordsTbody.innerHTML =
      rows
        .map(
          (student, index) => {
            const finalAverage =
              computeFinal(
                student
              );

            const termCells =
              terms
                .map(
                  (
                    term,
                    termIndex
                  ) => {
                    const grade =
                      getTermGrade(
                        student,
                        term,
                        termIndex
                      );

                    return `
                      <td
                        style="
                          text-align:center;
                        "
                      >
                        ${
                          grade ===
                            null ||
                          grade ===
                            undefined ||
                          String(
                            grade
                          ).trim() ===
                            ""
                            ? "—"
                            : esc(
                                grade
                              )
                        }
                      </td>
                    `;
                  }
                )
                .join("");

            return `
              <tr
                data-id="${esc(
                  student.id ||
                  student._id ||
                  student.studentId ||
                  ""
                )}"
              >

                <td>
                  ${index + 1}
                </td>

                <td>
                  <strong>
                    ${esc(
                      getStudentName(
                        student
                      )
                    )}
                  </strong>
                </td>

                ${termCells}

                <td
                  class="ar-avg"
                >
                  ${
                    finalAverage ===
                    null
                      ? "—"
                      : esc(
                          finalAverage
                        )
                  }
                </td>

                <td
                  style="
                    text-align:center;
                  "
                >
                  ${statusPill(
                    student.status
                  )}
                </td>

              </tr>
            `;
          }
        )
        .join("");
  }

  // ==========================================================
  // CSV HELPERS
  // ==========================================================

  function csvEscape(value) {
    const text =
      String(value ?? "");

    const escaped =
      text.replaceAll(
        '"',
        '""'
      );

    if (
      /[",\n]/.test(text)
    ) {
      return `"${escaped}"`;
    }

    return escaped;
  }

  function downloadCsv(
    rows,
    filename
  ) {
    const headers = [
      "Grade Level",
      "Section",
      "Student",

      ...terms.map(
        (term) =>
          term?.name ||
          "Term"
      ),

      "Final Average",
      "Status",
    ];

    const lines = [
      headers
        .map(csvEscape)
        .join(","),
    ];

    rows.forEach(
      (student) => {
        const values = [
          getStudentGrade(
            student
          ),

          getStudentSection(
            student
          ),

          getStudentName(
            student
          ),
        ];

        terms.forEach(
          (
            term,
            index
          ) => {
            values.push(
              getTermGrade(
                student,
                term,
                index
              ) ?? ""
            );
          }
        );

        values.push(
          computeFinal(
            student
          ) ?? ""
        );

        values.push(
          student.status ||
            "Pending"
        );

        lines.push(
          values
            .map(csvEscape)
            .join(",")
        );
      }
    );

    const csv =
      lines.join("\n");

    const blob =
      new Blob(
        [csv],
        {
          type:
            "text/csv;charset=utf-8",
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const link =
      document.createElement(
        "a"
      );

    link.href = url;
    link.download =
      filename;

    document.body.appendChild(
      link
    );

    link.click();

    link.remove();

    setTimeout(
      () =>
        URL.revokeObjectURL(
          url
        ),
      1200
    );
  }

  // ==========================================================
  // EXPORT CURRENT VIEW
  // ==========================================================

  function exportCurrentView() {
    const rows =
      currentRows.slice();

    if (!rows.length) {
      alert(
        "There are no student records to export."
      );

      return;
    }

    const grade =
      gradeSelect?.value ||
      "All";

    const section =
      sectionSelect?.value ||
      "All";

    const filename =
      `academic_records_${grade}_Section_${section}.csv`
        .replaceAll(
          " ",
          "_"
        );

    downloadCsv(
      rows,
      filename
    );
  }

  // ==========================================================
  // EXPORT GRADE LEVEL
  // ==========================================================

  function exportGradeLevel() {
    const selectedGrade =
      gradeSelect?.value;

    if (!selectedGrade) {
      alert(
        "Please select a grade level first."
      );

      return;
    }

    // Grade Level export includes
    // ALL sections under that grade.

    const rows =
      students
        .filter(
          (student) =>
            norm(
              getStudentGrade(
                student
              )
            ) ===
            norm(
              selectedGrade
            )
        )
        .sort(
          (a, b) => {
            const sectionCompare =
              getStudentSection(
                a
              ).localeCompare(
                getStudentSection(
                  b
                )
              );

            if (
              sectionCompare !==
              0
            ) {
              return sectionCompare;
            }

            return getStudentName(
              a
            ).localeCompare(
              getStudentName(
                b
              )
            );
          }
        );

    if (!rows.length) {
      alert(
        `No student records found for ${selectedGrade}.`
      );

      return;
    }

    const filename =
      `academic_records_${selectedGrade}.csv`
        .replaceAll(
          " ",
          "_"
        );

    downloadCsv(
      rows,
      filename
    );
  }

  // ==========================================================
  // EXPORT ALL RECORDS
  // ==========================================================

  function exportAllRecords() {
    const rows =
      students
        .slice()
        .sort(
          (a, b) => {
            const gradeCompare =
              getStudentGrade(
                a
              ).localeCompare(
                getStudentGrade(
                  b
                )
              );

            if (
              gradeCompare !==
              0
            ) {
              return gradeCompare;
            }

            const sectionCompare =
              getStudentSection(
                a
              ).localeCompare(
                getStudentSection(
                  b
                )
              );

            if (
              sectionCompare !==
              0
            ) {
              return sectionCompare;
            }

            return getStudentName(
              a
            ).localeCompare(
              getStudentName(
                b
              )
            );
          }
        );

    if (!rows.length) {
      alert(
        "There are no student records to export."
      );

      return;
    }

    downloadCsv(
      rows,
      "academic_records_all.csv"
    );
  }

  // ==========================================================
  // EXPORT MENU
  // ==========================================================

  function toggleExportMenu() {
    exportMenu?.classList.toggle(
      "hidden"
    );
  }

  function closeExportMenu() {
    exportMenu?.classList.add(
      "hidden"
    );
  }

  exportBtn?.addEventListener(
    "click",
    (event) => {
      event.stopPropagation();

      toggleExportMenu();
    }
  );

  // Current View

  exportClassBtn?.addEventListener(
    "click",
    () => {
      closeExportMenu();

      exportCurrentView();
    }
  );

  // Grade Level

  exportGradeBtn?.addEventListener(
    "click",
    () => {
      closeExportMenu();

      exportGradeLevel();
    }
  );

  // All Records

  exportAllBtn?.addEventListener(
    "click",
    () => {
      closeExportMenu();

      exportAllRecords();
    }
  );

  document.addEventListener(
    "click",
    () => {
      closeExportMenu();
    }
  );

  exportMenu?.addEventListener(
    "click",
    (event) => {
      event.stopPropagation();
    }
  );

  // ==========================================================
  // GRADE CHANGE
  // ==========================================================

  gradeSelect?.addEventListener(
    "change",
    async () => {
      try {
        gradeSelect.disabled =
          true;

        sectionSelect.disabled =
          true;

        await loadSections(
          gradeSelect.value
        );

        render();
      } catch (error) {
        showTableError(
          error.message ||
            "Failed to load sections."
        );
      } finally {
        gradeSelect.disabled =
          false;

        sectionSelect.disabled =
          false;
      }
    }
  );

  // ==========================================================
  // SECTION CHANGE
  // ==========================================================

  sectionSelect?.addEventListener(
    "change",
    () => {
      render();
    }
  );

  // ==========================================================
  // SEARCH
  // ==========================================================

  searchInput?.addEventListener(
    "input",
    () => {
      render();
    }
  );

  // ==========================================================
  // ERROR
  // ==========================================================

  function showTableError(
    message
  ) {
    if (!recordsTbody) {
      return;
    }

    const colspan =
      2 +
      terms.length +
      2;

    recordsTbody.innerHTML = `
      <tr class="ar-empty">

        <td
          colspan="${colspan}"
        >
          ${esc(
            message ||
              "Failed to load records."
          )}
        </td>

      </tr>
    `;
  }

  // ==========================================================
  // INITIALIZE
  // ==========================================================

  async function init() {
    try {
      await loadCsrfToken();

      // Load all required data.
      //
      // Students:
      //   Used for names, grade level,
      //   section and status.
      //
      // Grade records:
      //   Used for actual term grades.
      //
      // School year:
      //   Used for term columns.

      await Promise.all([
        loadGradeLevels(),
        loadActiveSchoolYear(),
        loadStudents(),
        loadAcademicRecords(),
      ]);

      // Build grade selector.

      buildGradeSelect();

      // Load sections for selected grade.

      await loadSections(
        gradeSelect?.value
      );

      // Render table.

      render();
    } catch (error) {
      console.error(
        "Academic Records initialization failed:",
        error
      );

      showTableError(
        error.message ||
          "Failed to load academic records."
      );
    }
  }

  // ==========================================================
  // REFRESH
  // ==========================================================

  async function refresh() {
    closeExportMenu();

    await init();
  }

  refreshBtn?.addEventListener(
    "click",
    async () => {
      await refresh();
    }
  );

  // ==========================================================
  // START
  // ==========================================================

  init();
});