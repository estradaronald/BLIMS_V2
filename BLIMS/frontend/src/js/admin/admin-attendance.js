// frontend/src/js/admin-attendance.js
// ============================================================
// BLIMS ADMIN ATTENDANCE MONITORING
// ============================================================
//
// Backend:
//   GET /api/admin/grade-levels
//   GET /api/admin/sections?grade=...
//   GET /api/admin/sections/summary
//   GET /api/admin/attendance
//
// Attendance MongoDB structure:
//
// {
//   date: "2026-08-15",
//   className: "Kindergarten",
//   sectionName: "Everlasting",
//   teacherId: "...",
//   schoolYearId: "...",
//   schoolYearName: "2025-2026",
//   records: [
//     {
//       studentId: "STD-0020",
//       status: "present"
//     }
//   ]
// }
//
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

  const $ = (id) =>
    document.getElementById(id);


  const API_BASE =
    "/api/admin";


  /* =========================================================
     STATE
  ========================================================= */

  let attendanceRows = [];

  let grades = [];

  let sectionRows = [];

  let sectionsCache = {};

  let loadingAttendance = false;


  /* =========================================================
     DOM
  ========================================================= */

  const dateInput =
    $("dateInput");

  const gradeSelect =
    $("gradeSelect");

  const sectionSelect =
    $("sectionSelect");

  const statusSelect =
    $("statusSelect");

  const searchInput =
    $("searchInput");

  const attTbody =
    $("attTbody");

  const exportCsvBtn =
    $("exportCsvBtn");

  const refreshBtn =
    $("refreshBtn");

  const summaryLine =
    $("summaryLine");

  const dataSourceNote =
    $("dataSourceNote");


  /* =========================================================
     CSRF
  ========================================================= */

  let csrfToken = "";


  async function loadCsrfToken() {

    try {

      const response =
        await fetch(
          "/api/csrf-token",
          {
            credentials:
              "include",
          }
        );


      const data =
        await response
          .json()
          .catch(
            () => ({})
          );


      csrfToken =
        data?.csrfToken ||
        "";

    } catch (error) {

      console.warn(
        "CSRF token could not be loaded:",
        error
      );

    }
  }


  /* =========================================================
     API HELPER
  ========================================================= */

  async function api(
    path,
    options = {}
  ) {

    const method =
      (
        options.method ||
        "GET"
      )
        .toUpperCase();


    const headers = {

      Accept:
        "application/json",

      ...(options.headers || {}),
    };


    if (
      options.body &&
      !headers["Content-Type"]
    ) {

      headers["Content-Type"] =
        "application/json";
    }


    if (
      method !== "GET" &&
      method !== "HEAD" &&
      method !== "OPTIONS"
    ) {

      if (!csrfToken) {

        await loadCsrfToken();

      }


      if (csrfToken) {

        headers[
          "X-CSRF-Token"
        ] =
          csrfToken;

      }
    }


    const response =
      await fetch(
        `${API_BASE}${path}`,
        {
          ...options,

          credentials:
            "include",

          headers,
        }
      );


    const text =
      await response.text();


    let data = null;


    try {

      data =
        text
          ? JSON.parse(text)
          : null;

    } catch {

      data = text;

    }


    if (!response.ok) {

      throw new Error(
        data?.message ||
        data?.error ||
        `Request failed (${response.status})`
      );

    }


    /*
     * Existing Admin API response:
     *
     * {
     *   ok: true,
     *   data: ...
     * }
     */

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


  /* =========================================================
     HELPERS
  ========================================================= */

  function esc(value) {

    return String(
      value ?? ""
    )

      .replaceAll(
        "&",
        "&amp;"
      )

      .replaceAll(
        "<",
        "&lt;"
      )

      .replaceAll(
        ">",
        "&gt;"
      )

      .replaceAll(
        '"',
        "&quot;"
      )

      .replaceAll(
        "'",
        "&#039;"
      );
  }


  function normalize(value) {

    return String(
      value ?? ""
    )
      .trim();
  }


  function norm(value) {

    return normalize(
      value
    )

      .toLowerCase()

      .replace(
        /\s+/g,
        " "
      );
  }


  function todayISO() {

    const date =
      new Date();


    const yyyy =
      date.getFullYear();


    const mm =
      String(
        date.getMonth() + 1
      )
        .padStart(
          2,
          "0"
        );


    const dd =
      String(
        date.getDate()
      )
        .padStart(
          2,
          "0"
        );


    return `${yyyy}-${mm}-${dd}`;
  }


  function formatDate(
    value
  ) {

    if (!value) {

      return "—";

    }


    const date =
      new Date(
        `${String(value).slice(
          0,
          10
        )}T00:00:00`
      );


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {

      return value;

    }


    return date.toLocaleDateString(
      undefined,
      {
        year:
          "numeric",

        month:
          "short",

        day:
          "2-digit",
      }
    );
  }


  function fullName(
    person
  ) {

    if (!person) {

      return "";

    }


    return [

      person.firstName,

      person.middleName,

      person.lastName,

      person.suffix,

    ]

      .filter(Boolean)

      .join(" ")

      .replace(
        /\s+/g,
        " "
      )

      .trim();
  }


  /* =========================================================
     STATUS
  ========================================================= */

  function normalizeStatus(
    value
  ) {

    return normalize(
      value
    )
      .toLowerCase();
  }


  function statusLabel(
    value
  ) {

    const status =
      normalizeStatus(
        value
      );


    const labels = {

      present:
        "Present",

      absent:
        "Absent",

      late:
        "Late",

      excused:
        "Excused",
    };


    return (
      labels[status] ||
      value ||
      "—"
    );
  }


  function statusPill(
    value
  ) {

    const status =
      normalizeStatus(
        value
      );


    const allowed = [

      "present",

      "absent",

      "late",

      "excused",

    ];


    const className =
      allowed.includes(
        status
      )
        ? status
        : "";


    return `
      <span class="att-status ${className}">
        ${esc(
          statusLabel(
            value
          )
        )}
      </span>
    `;
  }


  /* =========================================================
     GRADE LEVELS
  ========================================================= */

  async function loadGradeLevels() {

    /*
     * Existing Admin endpoint:
     *
     * GET /api/admin/grade-levels
     */

    const data =
      await api(
        "/grade-levels"
      );


    let list = [];


    if (
      Array.isArray(data)
    ) {

      list =
        data;

    } else if (
      data &&
      Array.isArray(
        data.items
      )
    ) {

      list =
        data.items;

    } else if (
      data &&
      Array.isArray(
        data.gradeLevels
      )
    ) {

      list =
        data.gradeLevels;

    }


    grades =
      list

        .map(
          (item) => {

            if (
              typeof item ===
              "string"
            ) {

              return item;

            }


            return (
              item?.grade ||
              item?.name ||
              ""
            );

          }
        )

        .filter(Boolean);


    /*
     * Sort exactly like the
     * existing Admin page.
     */

    grades.sort(
      (a, b) =>
        String(a).localeCompare(
          String(b),
          undefined,
          {
            numeric:
              true,

            sensitivity:
              "base",
          }
        )
    );


    buildGradeSelect();
  }


  /* =========================================================
     SECTION SUMMARY
  ========================================================= */

  async function loadSectionSummary() {

    /*
     * Existing endpoint:
     *
     * GET /api/admin/sections/summary
     */

    const data =
      await api(
        "/sections/summary"
      );


    if (
      !data ||
      typeof data !==
        "object"
    ) {

      return {};

    }


    return data;
  }


  /* =========================================================
     FETCH REAL SECTIONS
  ========================================================= */

  async function loadSectionsForGrade(
    grade
  ) {

    const cleanGrade =
      normalize(
        grade
      );


    if (!cleanGrade) {

      return [];

    }


    /*
     * Use cache if already fetched.
     */

    if (
      Array.isArray(
        sectionsCache[
          cleanGrade
        ]
      )
    ) {

      return sectionsCache[
        cleanGrade
      ];

    }


    /*
     * Fetch REAL sections
     * for this grade.
     *
     * Existing backend:
     *
     * GET /api/admin/sections?grade=Kindergarten
     */

    const data =
      await api(
        `/sections?grade=${encodeURIComponent(
          cleanGrade
        )}`
      );


    let rows = [];


    if (
      Array.isArray(data)
    ) {

      rows =
        data;

    } else if (
      data &&
      Array.isArray(
        data.items
      )
    ) {

      rows =
        data.items;

    } else if (
      data &&
      Array.isArray(
        data.sections
      )
    ) {

      rows =
        data.sections;

    }


    /*
     * Store actual backend
     * section objects.
     */

    sectionsCache[
      cleanGrade
    ] =
      rows;


    return rows;
  }


  /* =========================================================
     BUILD GRADE SELECT
  ========================================================= */

  function buildGradeSelect() {

    if (!gradeSelect) {

      return;

    }


    const previous =
      gradeSelect.value;


    gradeSelect.innerHTML = `
      <option value="">
        All Grade Levels
      </option>
    `;


    grades.forEach(
      (grade) => {

        const option =
          document.createElement(
            "option"
          );


        option.value =
          grade;


        option.textContent =
          grade;


        gradeSelect.appendChild(
          option
        );

      }
    );


    /*
     * Preserve previous
     * selection if possible.
     */

    if (
      previous &&
      grades.includes(
        previous
      )
    ) {

      gradeSelect.value =
        previous;

    } else {

      /*
       * Select the first REAL
       * grade instead of inventing
       * a default grade.
       */

      gradeSelect.value =
        grades[0] ||
        "";

    }
  }


  /* =========================================================
     BUILD SECTION SELECT
  ========================================================= */

  async function buildSectionSelect() {

    if (!sectionSelect) {

      return;

    }


    const previous =
      sectionSelect.value;


    sectionSelect.innerHTML = `
      <option value="">
        Loading sections...
      </option>
    `;


    const selectedGrade =
      normalize(
        gradeSelect?.value
      );


    try {

      let rows = [];


      /*
       * If a grade is selected,
       * fetch ONLY its sections.
       */

      if (
        selectedGrade
      ) {

        rows =
          await loadSectionsForGrade(
            selectedGrade
          );

      } else {

        /*
         * "All Grade Levels"
         *
         * Fetch real sections
         * for every real grade.
         */

        const allRows = [];


        for (
          const grade
          of grades
        ) {

          const gradeRows =
            await loadSectionsForGrade(
              grade
            );


          allRows.push(
            ...gradeRows
          );

        }


        rows =
          allRows;
      }


      sectionRows =
        rows;


      /*
       * Extract REAL section names
       * returned by backend.
       */

      const sectionNames =
        [

          ...new Set(

            rows

              .map(
                (row) => {

                  if (
                    typeof row ===
                    "string"
                  ) {

                    return normalize(
                      row
                    );

                  }


                  return normalize(
                    row?.section ||
                    row?.sectionName ||
                    row?.name ||
                    ""
                  );

                }
              )

              .filter(Boolean)

          ),

        ]

          .sort(
            (a, b) =>
              a.localeCompare(
                b,
                undefined,
                {
                  numeric:
                    true,

                  sensitivity:
                    "base",
                }
              )
          );


      sectionSelect.innerHTML = `
        <option value="">
          All Sections
        </option>
      `;


      sectionNames.forEach(
        (section) => {

          const option =
            document.createElement(
              "option"
            );


          option.value =
            section;


          option.textContent =
            section;


          sectionSelect.appendChild(
            option
          );

        }
      );


      /*
       * Restore previous section
       * if it still exists.
       */

      if (
        previous &&
        sectionNames.includes(
          previous
        )
      ) {

        sectionSelect.value =
          previous;

      } else {

        sectionSelect.value =
          "";

      }


    } catch (error) {

      console.error(
        "Failed to fetch sections:",
        error
      );


      sectionRows =
        [];


      /*
       * Do not expose backend
       * error messages to the user.
       */

      sectionSelect.innerHTML = `
        <option value="">
          No Sections Available
        </option>
      `;

    }
  }


  /* =========================================================
     LOAD ATTENDANCE
  ========================================================= */

  async function loadAttendance() {

    if (
      loadingAttendance
    ) {

      return;

    }


    loadingAttendance =
      true;


    try {

      /*
       * Show loading state
       * while fetching.
       */

      renderMessage(
        "Loading attendance records..."
      );


      /*
       * Attendance comes from
       * MongoDB through the
       * Admin attendance endpoint.
       */

      const data =
        await api(
          "/attendance"
        );


      let rows = [];


      if (
        Array.isArray(data)
      ) {

        rows =
          data;

      } else if (
        data &&
        Array.isArray(
          data.items
        )
      ) {

        rows =
          data.items;

      } else if (
        data &&
        Array.isArray(
          data.rows
        )
      ) {

        rows =
          data.rows;

      } else if (
        data &&
        Array.isArray(
          data.attendance
        )
      ) {

        rows =
          data.attendance;

      }


      attendanceRows =
        normalizeAttendanceRows(
          rows
        );


      if (
        dataSourceNote
      ) {

        dataSourceNote.textContent =
          "Data source: MongoDB Attendance";

      }


      render();


    } catch (error) {

      /*
       * IMPORTANT:
       *
       * Log the real error for
       * development/debugging.
       *
       * But DO NOT show the
       * backend error to admins.
       */

      console.error(
        "Failed to load attendance:",
        error
      );


      attendanceRows =
        [];


      if (
        dataSourceNote
      ) {

        dataSourceNote.textContent =
          "Data source: MongoDB Attendance";

      }


      /*
       * Show the normal empty state
       * instead of:
       *
       * "API route not found."
       *
       * or another backend error.
       */

      renderMessage(
        "No attendance yet. No attendance records have been submitted for the selected class and date."
      );


      if (
        summaryLine
      ) {

        summaryLine.textContent =
          "No attendance records yet.";

      }


    } finally {

      loadingAttendance =
        false;

    }
  }


  /* =========================================================
     NORMALIZE ATTENDANCE
  ========================================================= */

  function normalizeAttendanceRows(
    rows
  ) {

    const output = [];


    rows.forEach(
      (session) => {

        /*
         * If backend already returns
         * flat attendance records.
         */

        if (
          session &&
          (
            session.student ||
            session.studentName
          ) &&
          (
            session.status ||
            session.attendanceStatus
          )
        ) {

          output.push(
            normalizeFlatAttendance(
              session
            )
          );


          return;

        }


        /*
         * Normal MongoDB structure:
         *
         * Attendance document
         * contains records[].
         */

        const date =
          normalize(
            session?.date
          )
            .slice(
              0,
              10
            );


        const grade =
          normalize(
            session?.className ||
            session?.grade ||
            session?.gradeLevel
          );


        const section =
          normalize(
            session?.sectionName ||
            session?.section ||
            session?.classSection
          );


        const teacher =
          resolvePersonName(
            session?.teacher ||
            session?.teacherName ||
            session?.adviser
          );


        const teacherId =
          normalize(
            session?.teacherId
          );


        const records =
          Array.isArray(
            session?.records
          )
            ? session.records
            : [];


        records.forEach(
          (record) => {

            const studentId =
              normalize(
                record?.studentId
              );


            const studentName =
              resolvePersonName(
                record?.student ||
                record?.studentName ||
                record?.name
              );


            output.push({

              id:
                String(
                  session?._id ||
                  `${date}-${grade}-${section}-${studentId}`
                ),

              date,

              grade,

              section,

              student:
                studentName ||
                studentId ||
                "—",

              studentId,

              status:
                normalizeStatus(
                  record?.status
                ),

              teacher:
                teacher ||
                "—",

              teacherId,

              remarks:
                normalize(
                  record?.remarks ||
                  record?.note ||
                  record?.notes ||
                  session?.remarks
                ),

              schoolYearName:
                normalize(
                  session?.schoolYearName
                ),

              createdAt:
                session?.createdAt ||
                "",

              updatedAt:
                session?.updatedAt ||
                "",

            });

          }
        );

      }
    );


    return output;
  }


  /* =========================================================
     FLAT ATTENDANCE
  ========================================================= */

  function normalizeFlatAttendance(
    row
  ) {

    const student =
      row?.student;


    let studentName =
      "";


    if (
      typeof student ===
      "string"
    ) {

      studentName =
        student;

    } else if (
      student &&
      typeof student ===
        "object"
    ) {

      studentName =
        fullName(
          student
        ) ||
        student.fullName ||
        student.name ||
        "";

    } else {

      studentName =
        row?.studentName ||
        row?.name ||
        "";

    }


    return {

      id:
        String(
          row?._id ||
          row?.id ||
          `${row?.date || ""}-${row?.studentId || ""}`
        ),

      date:
        normalize(
          row?.date ||
          row?.attDate
        )
          .slice(
            0,
            10
          ),

      grade:
        normalize(
          row?.className ||
          row?.grade ||
          row?.gradeLevel
        ),

      section:
        normalize(
          row?.sectionName ||
          row?.section ||
          row?.classSection
        ),

      student:
        normalize(
          studentName
        ) ||
        normalize(
          row?.studentId
        ) ||
        "—",

      studentId:
        normalize(
          row?.studentId
        ),

      status:
        normalizeStatus(
          row?.status ||
          row?.attendanceStatus
        ),

      teacher:
        resolvePersonName(
          row?.teacher ||
          row?.teacherName ||
          row?.adviser
        ) ||
        "—",

      teacherId:
        normalize(
          row?.teacherId
        ),

      remarks:
        normalize(
          row?.remarks ||
          row?.note ||
          row?.notes
        ),

      schoolYearName:
        normalize(
          row?.schoolYearName
        ),
    };
  }


  /* =========================================================
     PERSON NAME
  ========================================================= */

  function resolvePersonName(
    value
  ) {

    if (!value) {

      return "";

    }


    if (
      typeof value ===
      "string"
    ) {

      return value.trim();

    }


    if (
      typeof value ===
      "object"
    ) {

      return (
        fullName(
          value
        ) ||
        value.fullName ||
        value.name ||
        value.label ||
        value.username ||
        ""
      )
        .toString()
        .trim();

    }


    return "";
  }


  /* =========================================================
     FILTERS
  ========================================================= */

  function applyFilters(
    rows
  ) {

    const selectedDate =
      normalize(
        dateInput?.value
      );


    const selectedGrade =
      normalize(
        gradeSelect?.value
      );


    const selectedSection =
      normalize(
        sectionSelect?.value
      );


    const selectedStatus =
      normalizeStatus(
        statusSelect?.value
      );


    const query =
      norm(
        searchInput?.value
      );


    let result =
      rows.slice();


    /*
     * DATE
     */

    if (
      selectedDate
    ) {

      result =
        result.filter(
          (row) =>
            normalize(
              row.date
            ).slice(
              0,
              10
            ) ===
            selectedDate
        );

    }


    /*
     * GRADE
     */

    if (
      selectedGrade
    ) {

      result =
        result.filter(
          (row) =>
            norm(
              row.grade
            ) ===
            norm(
              selectedGrade
            )
        );

    }


    /*
     * SECTION
     */

    if (
      selectedSection
    ) {

      result =
        result.filter(
          (row) =>
            norm(
              row.section
            ) ===
            norm(
              selectedSection
            )
        );

    }


    /*
     * STATUS
     */

    if (
      selectedStatus &&
      selectedStatus !==
        "all"
    ) {

      result =
        result.filter(
          (row) =>
            normalizeStatus(
              row.status
            ) ===
            selectedStatus
        );

    }


    /*
     * SEARCH
     */

    if (query) {

      result =
        result.filter(
          (row) => {

            const searchable =
              [

                row.date,

                row.grade,

                row.section,

                row.student,

                row.studentId,

                row.status,

                row.teacher,

                row.remarks,

                row.schoolYearName,

              ]

                .filter(Boolean)

                .join(" ");


            return norm(
              searchable
            )
              .includes(
                query
              );

          }
        );

    }


    /*
     * SORT
     */

    result.sort(
      (a, b) => {

        const dateCompare =
          String(
            b.date || ""
          )
            .localeCompare(
              String(
                a.date || ""
              )
            );


        if (
          dateCompare !== 0
        ) {

          return dateCompare;

        }


        return String(
          a.student || ""
        )
          .localeCompare(
            String(
              b.student || ""
            )
          );

      }
    );


    return result;
  }


  /* =========================================================
     SUMMARY
  ========================================================= */

  function renderSummary(
    rows
  ) {

    if (!summaryLine) {

      return;

    }


    const date =
      dateInput?.value
        ? formatDate(
            dateInput.value
          )
        : "Any date";


    const grade =
      gradeSelect?.value ||
      "All grades";


    const section =
      sectionSelect?.value
        ? `Section ${sectionSelect.value}`
        : "All sections";


    const status =
      statusSelect?.value &&
      statusSelect.value !==
        "all"

        ? statusLabel(
            statusSelect.value
          )

        : "All statuses";


    summaryLine.textContent =
      `Showing: ${date} • ${grade} • ${section} • ${status} • ${rows.length} record(s)`;
  }


  /* =========================================================
     TABLE
  ========================================================= */

  function renderTable(
    rows
  ) {

    if (!attTbody) {

      return;

    }


    /*
     * IMPORTANT:
     *
     * No attendance is NOT an error.
     *
     * If there are zero records after
     * applying the filters, display the
     * normal empty state.
     */

    if (!rows.length) {

      renderMessage(
        "No attendance yet. No attendance records have been submitted for the selected class and date."
      );


      return;
    }


    attTbody.innerHTML =
      rows

        .map(
          (row, index) => {

            return `
              <tr>

                <td>
                  ${index + 1}
                </td>

                <td>
                  ${esc(
                    formatDate(
                      row.date
                    )
                  )}
                </td>

                <td>
                  <strong>
                    ${esc(
                      row.grade ||
                      "—"
                    )}
                  </strong>

                  <span>
                    •
                  </span>

                  ${esc(
                    row.section ||
                    "—"
                  )}
                </td>

                <td>

                  <strong>
                    ${esc(
                      row.student ||
                      "—"
                    )}
                  </strong>

                  ${
                    row.studentId
                      ? `
                        <div
                          style="
                            font-size:11px;
                            opacity:.65;
                            margin-top:2px;
                          "
                        >
                          ${esc(
                            row.studentId
                          )}
                        </div>
                      `
                      : ""
                  }

                </td>

                <td>
                  ${statusPill(
                    row.status
                  )}
                </td>

                <td>
                  ${esc(
                    row.teacher ||
                    "—"
                  )}
                </td>

                <td>
                  ${esc(
                    row.remarks ||
                    "—"
                  )}
                </td>

              </tr>
            `;

          }
        )

        .join("");
  }


  /* =========================================================
     RENDER
  ========================================================= */

  function render() {

    const filtered =
      applyFilters(
        attendanceRows
      );


    renderSummary(
      filtered
    );


    renderTable(
      filtered
    );
  }


  /* =========================================================
     EMPTY / MESSAGE
  ========================================================= */

  function renderMessage(
    message
  ) {

    if (!attTbody) {

      return;

    }


    attTbody.innerHTML = `
      <tr class="att-empty">
        <td colspan="7">
          ${esc(
            message
          )}
        </td>
      </tr>
    `;
  }


  /* =========================================================
     CSV
  ========================================================= */

  function csvEscape(
    value
  ) {

    const text =
      String(
        value ?? ""
      );


    const escaped =
      text.replaceAll(
        '"',
        '""'
      );


    if (
      /[",\n]/.test(
        text
      )
    ) {

      return `"${escaped}"`;

    }


    return escaped;
  }


  function exportCSV() {

    const filtered =
      applyFilters(
        attendanceRows
      );


    if (!filtered.length) {

      alert(
        "There are no attendance records to export."
      );


      return;
    }


    const headers = [

      "No.",

      "Date",

      "Grade Level",

      "Section",

      "Student",

      "Student ID",

      "Status",

      "Teacher",

      "Remarks",

    ];


    const lines = [

      headers.join(","),

    ];


    filtered.forEach(
      (row, index) => {

        lines.push(

          [

            index + 1,

            row.date || "",

            row.grade || "",

            row.section || "",

            row.student || "",

            row.studentId || "",

            statusLabel(
              row.status
            ),

            row.teacher || "",

            row.remarks || "",

          ]

            .map(
              csvEscape
            )

            .join(",")

        );

      }
    );


    const blob =
      new Blob(
        [
          lines.join(
            "\n"
          ),
        ],
        {
          type:
            "text/csv;charset=utf-8",
        }
      );


    const url =
      URL.createObjectURL(
        blob
      );


    const date =
      dateInput?.value ||
      todayISO();


    const grade =
      gradeSelect?.value ||
      "AllGrades";


    const section =
      sectionSelect?.value ||
      "AllSections";


    const safeGrade =
      grade

        .replace(
          /\s+/g,
          "_"
        )

        .replace(
          /[^a-zA-Z0-9_-]/g,
          ""
        );


    const safeSection =
      section

        .replace(
          /\s+/g,
          "_"
        )

        .replace(
          /[^a-zA-Z0-9_-]/g,
          ""
        );


    const filename =
      `attendance_${date}_${safeGrade}_${safeSection}.csv`;


    const link =
      document.createElement(
        "a"
      );


    link.href =
      url;


    link.download =
      filename;


    document.body.appendChild(
      link
    );


    link.click();


    link.remove();


    setTimeout(
      () => {

        URL.revokeObjectURL(
          url
        );

      },
      1200
    );
  }


  /* =========================================================
     REFRESH
  ========================================================= */

  async function refresh() {

    try {

      /*
       * Clear section cache so
       * newly-created/edited sections
       * are fetched again.
       */

      sectionsCache = {};


      await loadGradeLevels();


      await buildSectionSelect();


      await loadAttendance();


    } catch (error) {

      /*
       * Keep actual errors in
       * the console only.
       */

      console.error(
        "Attendance refresh failed:",
        error
      );

    }
  }


  /* =========================================================
     EVENTS
  ========================================================= */

  exportCsvBtn?.addEventListener(
    "click",
    exportCSV
  );


  refreshBtn?.addEventListener(
    "click",
    refresh
  );


  dateInput?.addEventListener(
    "change",
    render
  );


  /*
   * When grade changes,
   * fetch that grade's REAL
   * sections.
   */

  gradeSelect?.addEventListener(
    "change",
    async () => {

      try {

        await buildSectionSelect();


        render();

      } catch (error) {

        console.error(
          "Failed to update sections:",
          error
        );

      }

    }
  );


  sectionSelect?.addEventListener(
    "change",
    render
  );


  statusSelect?.addEventListener(
    "change",
    render
  );


  searchInput?.addEventListener(
    "input",
    render
  );


  /* =========================================================
     INIT
  ========================================================= */

  async function init() {

    try {

      if (
        dateInput &&
        !dateInput.value
      ) {

        dateInput.value =
          todayISO();

      }


      /*
       * 1. Fetch REAL grades.
       */

      await loadGradeLevels();


      /*
       * 2. Fetch REAL sections.
       *
       * This calls:
       *
       * /api/admin/sections?grade=...
       */

      await buildSectionSelect();


      /*
       * 3. Fetch REAL attendance.
       */

      await loadAttendance();


    } catch (error) {

      /*
       * Log technical error only.
       */

      console.error(
        "Admin attendance initialization failed:",
        error
      );


      /*
       * Never expose backend/API
       * error messages to the admin.
       */

      attendanceRows =
        [];


      if (
        dataSourceNote
      ) {

        dataSourceNote.textContent =
          "Data source: MongoDB Attendance";

      }


      if (
        summaryLine
      ) {

        summaryLine.textContent =
          "No attendance records yet.";

      }


      renderMessage(
        "No attendance yet. No attendance records have been submitted for the selected class and date."
      );

    }

  }


  init();

});