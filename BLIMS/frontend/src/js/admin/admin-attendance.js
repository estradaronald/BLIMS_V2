// frontend/src/js/admin-attendance.js

document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) => document.getElementById(id);

  const API_BASE = "/api/admin";

  // ==========================================================
  // STATE
  // ==========================================================

  let attendanceRows = [];
  let grades = [];
  let sectionRows = [];
  let sectionsCache = {};
  let loadingAttendance = false;

  // ==========================================================
  // DOM
  // ==========================================================

  const dateInput = $("dateInput");
  const gradeSelect = $("gradeSelect");
  const sectionSelect = $("sectionSelect");
  const statusSelect = $("statusSelect");
  const searchInput = $("searchInput");

  const attTbody = $("attTbody");
  const exportCsvBtn = $("exportCsvBtn");
  const refreshBtn = $("refreshBtn");

  const summaryLine = $("summaryLine");
  const dataSourceNote = $("dataSourceNote");

  const confirmModal = $("attConfirmModal");
  const confirmBackdrop = $("attConfirmBackdrop");
  const confirmTitle = $("attConfirmTitle");
  const confirmSub = $("attConfirmSub");
  const confirmText = $("attConfirmText");
  const confirmCloseX = $("attConfirmCloseX");
  const confirmCancelBtn = $("attConfirmCancelBtn");
  const confirmActionBtn = $("attConfirmActionBtn");

  const successToast = $("attSuccessToast");
  const successToastText = $("attSuccessToastText");

  // ==========================================================
  // CSRF
  // ==========================================================

  let csrfToken = "";

  async function loadCsrfToken() {
    try {
      const response = await fetch("/api/csrf-token", {
        credentials: "include",
      });

      const data = await response.json().catch(() => ({}));

      csrfToken = data?.csrfToken || "";
    } catch (error) {
      console.warn(
        "CSRF token could not be loaded:",
        error,
      );
    }
  }

  // ==========================================================
  // API HELPER
  // ==========================================================

  async function api(path, options = {}) {
    const method = (
      options.method || "GET"
    ).toUpperCase();

    const headers = {
      Accept: "application/json",
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
        headers["X-CSRF-Token"] =
          csrfToken;
      }
    }

    const response = await fetch(
      `${API_BASE}${path}`,
      {
        ...options,
        credentials: "include",
        headers,
      },
    );

    const text = await response.text();

    let data = null;

    try {
      data = text
        ? JSON.parse(text)
        : null;
    } catch {
      data = text;
    }

    if (!response.ok) {
      throw new Error(
        data?.message ||
          data?.error ||
          `Request failed (${response.status})`,
      );
    }

    // Backend response:
    // { ok: true, data: ... }
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

  function normalize(value) {
    return String(value ?? "").trim();
  }

  function norm(value) {
    return normalize(value)
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function todayISO() {
    const date = new Date();

    const yyyy = date.getFullYear();

    const mm = String(
      date.getMonth() + 1,
    ).padStart(2, "0");

    const dd = String(
      date.getDate(),
    ).padStart(2, "0");

    return `${yyyy}-${mm}-${dd}`;
  }

  function formatDate(value) {
    if (!value) {
      return "—";
    }

    const date = new Date(
      `${String(value).slice(0, 10)}T00:00:00`,
    );

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleDateString(
      undefined,
      {
        year: "numeric",
        month: "short",
        day: "2-digit",
      },
    );
  }

  function fullName(person) {
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
      .replace(/\s+/g, " ")
      .trim();
  }

  // ==========================================================
  // STATUS
  // ==========================================================

  function normalizeStatus(value) {
    return normalize(value).toLowerCase();
  }

  function statusLabel(value) {
    const status = normalizeStatus(value);

    const labels = {
      present: "Present",
      absent: "Absent",
      late: "Late",
      excused: "Excused",
    };

    return labels[status] || value || "—";
  }

  function statusPill(value) {
    const status = normalizeStatus(value);

    const allowed = [
      "present",
      "absent",
      "late",
      "excused",
    ];

    const className =
      allowed.includes(status)
        ? status
        : "";

    return `
      <span class="att-status ${className}">
        ${esc(statusLabel(value))}
      </span>
    `;
  }

  // ==========================================================
  // GRADE LEVELS
  // ==========================================================

  async function loadGradeLevels() {
    const data = await api(
      "/grade-levels",
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
      Array.isArray(data.gradeLevels)
    ) {
      list = data.gradeLevels;
    }

    grades = list
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

    grades.sort((a, b) =>
      String(a).localeCompare(
        String(b),
        undefined,
        {
          numeric: true,
          sensitivity: "base",
        },
      ),
    );

    buildGradeSelect();
  }

  // ==========================================================
  // FETCH REAL SECTIONS
  // ==========================================================

  async function loadSectionsForGrade(
    grade,
  ) {
    const cleanGrade =
      normalize(grade);

    if (!cleanGrade) {
      return [];
    }

    if (
      Array.isArray(
        sectionsCache[cleanGrade],
      )
    ) {
      return sectionsCache[
        cleanGrade
      ];
    }

    const data = await api(
      `/sections?grade=${encodeURIComponent(
        cleanGrade,
      )}`,
    );

    let rows = [];

    if (Array.isArray(data)) {
      rows = data;
    } else if (
      data &&
      Array.isArray(data.items)
    ) {
      rows = data.items;
    } else if (
      data &&
      Array.isArray(data.sections)
    ) {
      rows = data.sections;
    }

    sectionsCache[cleanGrade] =
      rows;

    return rows;
  }

  // ==========================================================
  // BUILD GRADE SELECT
  // ==========================================================

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

    grades.forEach((grade) => {
      const option =
        document.createElement(
          "option",
        );

      option.value = grade;
      option.textContent = grade;

      gradeSelect.appendChild(
        option,
      );
    });

    if (
      previous &&
      grades.includes(previous)
    ) {
      gradeSelect.value =
        previous;
    } else {
      gradeSelect.value =
        grades[0] || "";
    }
  }

  // ==========================================================
  // BUILD SECTION SELECT
  // ==========================================================

  async function buildSectionSelect() {
    if (!sectionSelect) {
      return false;
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
        gradeSelect?.value,
      );

    try {
      let rows = [];

      if (selectedGrade) {
        rows =
          await loadSectionsForGrade(
            selectedGrade,
          );
      } else {
        const allRows = [];

        for (const grade of grades) {
          const gradeRows =
            await loadSectionsForGrade(
              grade,
            );

          allRows.push(...gradeRows);
        }

        rows = allRows;
      }

      sectionRows = rows;

      const sectionNames = [
        ...new Set(
          rows
            .map((row) => {
              if (
                typeof row ===
                "string"
              ) {
                return normalize(row);
              }

              return normalize(
                row?.section ||
                  row?.sectionName ||
                  row?.name ||
                  "",
              );
            })
            .filter(Boolean),
        ),
      ].sort((a, b) =>
        a.localeCompare(
          b,
          undefined,
          {
            numeric: true,
            sensitivity: "base",
          },
        ),
      );

      // Empty value means:
      // ALL SECTIONS
      sectionSelect.innerHTML = `
        <option value="">
          All Sections
        </option>
      `;

      sectionNames.forEach(
        (section) => {
          const option =
            document.createElement(
              "option",
            );

          option.value = section;
          option.textContent =
            section;

          sectionSelect.appendChild(
            option,
          );
        },
      );

      if (
        previous &&
        sectionNames.includes(
          previous,
        )
      ) {
        sectionSelect.value =
          previous;
      } else {
        sectionSelect.value = "";
      }
    } catch (error) {
      console.error(
        "Failed to fetch sections:",
        error,
      );

      sectionRows = [];

      sectionSelect.innerHTML = `
        <option value="">
          No Sections Available
        </option>
      `;

      return false;
    }

    return true;
  }

  // ==========================================================
  // LOAD ATTENDANCE
  // ==========================================================

  async function loadAttendance() {
    if (loadingAttendance) {
      return false;
    }

    loadingAttendance = true;

    try {
      renderMessage(
        "Loading attendance records...",
      );

      const params =
        new URLSearchParams();

      const selectedDate =
        normalize(
          dateInput?.value,
        );

      const selectedGrade =
        normalize(
          gradeSelect?.value,
        );

      const selectedSection =
        normalize(
          sectionSelect?.value,
        );

      const selectedStatus =
        normalizeStatus(
          statusSelect?.value,
        );

      if (selectedDate) {
        params.set(
          "date",
          selectedDate,
        );
      }

      if (
        selectedGrade &&
        selectedGrade !== "all" &&
        selectedGrade !== "All"
      ) {
        params.set(
          "grade",
          selectedGrade,
        );
      }

      if (
        selectedSection &&
        selectedSection !== "all" &&
        selectedSection !== "All" &&
        selectedSection !==
          "All Sections"
      ) {
        params.set(
          "section",
          selectedSection,
        );
      }

      if (
        selectedStatus &&
        selectedStatus !== "all" &&
        selectedStatus !== "All"
      ) {
        params.set(
          "status",
          selectedStatus,
        );
      }

      const query =
        params.toString();

      const endpoint = query
        ? `/attendance?${query}`
        : "/attendance";

      console.log(
        "📥 Loading attendance:",
        endpoint,
      );

      const data =
        await api(endpoint);

      let rows = [];

      if (Array.isArray(data)) {
        rows = data;
      } else if (
        data &&
        Array.isArray(data.items)
      ) {
        rows = data.items;
      } else if (
        data &&
        Array.isArray(data.rows)
      ) {
        rows = data.rows;
      } else if (
        data &&
        Array.isArray(
          data.attendance,
        )
      ) {
        rows =
          data.attendance;
      }

      console.log(
        "📋 Attendance records received:",
        rows,
      );

      attendanceRows =
        normalizeAttendanceRows(
          rows,
        );

      console.log(
        "✅ Normalized attendance rows:",
        attendanceRows,
      );

      if (dataSourceNote) {
        dataSourceNote.textContent =
          "Data source: MongoDB Attendance";
      }

      render();

      return true;
    } catch (error) {
      console.error(
        "❌ Failed to load attendance:",
        error,
      );

      attendanceRows = [];

      if (dataSourceNote) {
        dataSourceNote.textContent =
          "Data source: MongoDB Attendance";
      }

      if (summaryLine) {
        summaryLine.textContent =
          "No attendance records yet.";
      }

      renderMessage(
        "No attendance yet. No attendance records have been submitted for the selected class and date.",
      );

      return false;
    } finally {
      loadingAttendance = false;
    }
  }

  // ==========================================================
  // NORMALIZE ATTENDANCE
  // ==========================================================

  function normalizeAttendanceRows(
    rows,
  ) {
    const output = [];

    if (!Array.isArray(rows)) {
      return output;
    }

    rows.forEach((row) => {
      if (
        !row ||
        typeof row !== "object"
      ) {
        return;
      }

      // ======================================================
      // FLAT BACKEND RECORD
      //
      // Example:
      //
      // {
      //   studentId: "STD-0010",
      //   date: "2026-10-12",
      //   grade: "Kindergarten",
      //   section: "Sunflower",
      //   status: "present"
      // }
      // ======================================================

      if (
        row.studentId &&
        (
          row.status ||
          row.attendanceStatus
        )
      ) {
        output.push(
          normalizeFlatAttendance(
            row,
          ),
        );

        return;
      }

      // ======================================================
      // MONGODB ATTENDANCE DOCUMENT
      // ======================================================

      const date = normalize(
        row.date,
      ).slice(0, 10);

      const grade = normalize(
        row.className ||
          row.grade ||
          row.gradeLevel,
      );

      const section = normalize(
        row.sectionName ||
          row.section ||
          row.classSection,
      );

      const teacher =
        resolvePersonName(
          row.teacher ||
            row.teacherName ||
            row.adviser,
        );

      const teacherId =
        normalize(
          row.teacherId,
        );

      const records =
        Array.isArray(
          row.records,
        )
          ? row.records
          : [];

      records.forEach(
        (record) => {
          const studentId =
            normalize(
              record?.studentId,
            );

          const studentName =
            resolvePersonName(
              record?.student ||
                record?.studentName ||
                record?.name,
            );

          output.push({
            id: String(
              row._id ||
                row.id ||
                `${date}-${grade}-${section}-${studentId}`,
            ),

            attendanceId:
              String(
                row._id ||
                  row.attendanceId ||
                  "",
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
                record?.status,
              ),

            teacher:
              teacher || "—",

            teacherId,

            remarks:
              normalize(
                record?.remarks ||
                  record?.remark ||
                  record?.note ||
                  record?.notes ||
                  row.remarks,
              ),

            schoolYearName:
              normalize(
                row.schoolYearName,
              ),

            createdAt:
              row.createdAt || "",

            updatedAt:
              row.updatedAt || "",
          });
        },
      );
    });

    return output;
  }

  // ==========================================================
  // FLAT ATTENDANCE
  // ==========================================================

  function normalizeFlatAttendance(
    row,
  ) {
    const student =
      row?.student;

    let studentName = "";

    if (
      typeof student ===
      "string"
    ) {
      studentName = student;
    } else if (
      student &&
      typeof student ===
        "object"
    ) {
      studentName =
        fullName(student) ||
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
      id: String(
        row?._id ||
          row?.id ||
          `${row?.date || ""}-${row?.studentId || ""}`,
      ),

      attendanceId:
        String(
          row?.attendanceId ||
            row?._id ||
            "",
        ),

      date: normalize(
        row?.date ||
          row?.attDate,
      ).slice(0, 10),

      grade: normalize(
        row?.className ||
          row?.grade ||
          row?.gradeLevel,
      ),

      section: normalize(
        row?.sectionName ||
          row?.section ||
          row?.classSection,
      ),

      student:
        normalize(studentName) ||
        normalize(
          row?.studentId,
        ) ||
        "—",

      studentId:
        normalize(
          row?.studentId,
        ),

      status:
        normalizeStatus(
          row?.status ||
            row?.attendanceStatus,
        ),

      teacher:
        resolvePersonName(
          row?.teacher ||
            row?.teacherName ||
            row?.adviser,
        ) || "—",

      teacherId:
        normalize(
          row?.teacherId,
        ),

      remarks: normalize(
        row?.remarks ||
          row?.remark ||
          row?.note ||
          row?.notes,
      ),

      schoolYearName:
        normalize(
          row?.schoolYearName,
        ),

      createdAt:
        row?.createdAt || "",

      updatedAt:
        row?.updatedAt || "",
    };
  }

  // ==========================================================
  // PERSON NAME
  // ==========================================================

  function resolvePersonName(
    value,
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
        fullName(value) ||
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

  // ==========================================================
  // FILTERS
  // ==========================================================

  function applyFilters(rows) {
    const selectedDate =
      normalize(
        dateInput?.value,
      );

    const selectedGrade =
      normalize(
        gradeSelect?.value,
      );

    const selectedSection =
      normalize(
        sectionSelect?.value,
      );

    const selectedStatus =
      normalizeStatus(
        statusSelect?.value,
      );

    const query = norm(
      searchInput?.value,
    );

    let result = rows.slice();

    // DATE
    if (selectedDate) {
      result = result.filter(
        (row) =>
          normalize(
            row.date,
          ).slice(0, 10) ===
          selectedDate,
      );
    }

    // GRADE
    if (
      selectedGrade &&
      selectedGrade !== "all" &&
      selectedGrade !== "All"
    ) {
      result = result.filter(
        (row) =>
          norm(row.grade) ===
          norm(selectedGrade),
      );
    }

    // SECTION
    if (
      selectedSection &&
      selectedSection !== "all" &&
      selectedSection !== "All" &&
      selectedSection !==
        "All Sections"
    ) {
      result = result.filter(
        (row) =>
          norm(row.section) ===
          norm(selectedSection),
      );
    }

    // STATUS
    if (
      selectedStatus &&
      selectedStatus !== "all" &&
      selectedStatus !== "All"
    ) {
      result = result.filter(
        (row) =>
          normalizeStatus(
            row.status,
          ) === selectedStatus,
      );
    }

    // SEARCH
    if (query) {
      result = result.filter(
        (row) => {
          const searchable = [
            row.date,
            row.grade,
            row.section,
            row.student,
            row.studentId,
            row.status,
            row.schoolYearName,
          ]
            .filter(Boolean)
            .join(" ");

          return norm(
            searchable,
          ).includes(query);
        },
      );
    }

    // SORT
    result.sort((a, b) => {
      const dateCompare =
        String(
          b.date || "",
        ).localeCompare(
          String(a.date || ""),
        );

      if (dateCompare !== 0) {
        return dateCompare;
      }

      return String(
        a.student || "",
      ).localeCompare(
        String(
          b.student || "",
        ),
      );
    });

    return result;
  }

  // ==========================================================
  // SUMMARY
  // ==========================================================

  function renderSummary(rows) {
    if (!summaryLine) {
      return;
    }

    const date = dateInput?.value
      ? formatDate(
          dateInput.value,
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
            statusSelect.value,
          )
        : "All statuses";

    summaryLine.textContent =
      `Showing: ${date} • ${grade} • ${section} • ${status} • ${rows.length} record(s)`;
  }

  // ==========================================================
  // TABLE
  // ==========================================================

  function renderTable(rows) {
    if (!attTbody) {
      return;
    }

    if (!rows.length) {
      renderMessage(
        "No attendance yet. No attendance records have been submitted for the selected class and date.",
      );

      return;
    }

    attTbody.innerHTML =
      rows
        .map(
          (row, index) => `
        <tr>
          <td>
            ${index + 1}
          </td>

          <td>
            ${esc(
              formatDate(
                row.date,
              ),
            )}
          </td>

          <td>
            <strong>
              ${esc(
                row.grade ||
                  "—",
              )}
            </strong>

            <span>•</span>

            ${esc(
              row.section ||
                "—",
            )}
          </td>

          <td>
            <strong>
              ${esc(
                row.student ||
                  "—",
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
                      row.studentId,
                    )}
                  </div>
                `
                : ""
            }
          </td>

          <td>
            ${statusPill(
              row.status,
            )}
          </td>
        </tr>
      `,
        )
        .join("");
  }

  // ==========================================================
  // RENDER
  // ==========================================================

  function render() {
    const filtered =
      applyFilters(
        attendanceRows,
      );

    renderSummary(
      filtered,
    );

    renderTable(
      filtered,
    );
  }

  // ==========================================================
  // EMPTY / MESSAGE
  // ==========================================================

  function renderMessage(
    message,
  ) {
    if (!attTbody) {
      return;
    }

    attTbody.innerHTML = `
      <tr class="att-empty">
        <td colspan="5">
          ${esc(message)}
        </td>
      </tr>
    `;
  }

  // ==========================================================
  // CSV
  // ==========================================================

  function csvEscape(value) {
    const text = String(
      value ?? "",
    );

    const escaped =
      text.replaceAll(
        '"',
        '""',
      );

    if (
      /[",\n]/.test(
        text,
      )
    ) {
      return `"${escaped}"`;
    }

    return escaped;
  }

  function exportCSV() {
    const filtered =
      applyFilters(
        attendanceRows,
      );

    if (!filtered.length) {
      alert(
        "There are no attendance records to export.",
      );

      return false;
    }

    const headers = [
      "No.",
      "Date",
      "Grade Level",
      "Section",
      "Student",
      "Student ID",
      "Status",
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
              row.status,
            ),
          ]
            .map(csvEscape)
            .join(","),
        );
      },
    );

    const blob = new Blob(
      [lines.join("\n")],
      {
        type: "text/csv;charset=utf-8",
      },
    );

    const url =
      URL.createObjectURL(
        blob,
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
          "_",
        )
        .replace(
          /[^a-zA-Z0-9_-]/g,
          "",
        );

    const safeSection =
      section
        .replace(
          /\s+/g,
          "_",
        )
        .replace(
          /[^a-zA-Z0-9_-]/g,
          "",
        );

    const filename =
      `attendance_${date}_${safeGrade}_${safeSection}.csv`;

    const link =
      document.createElement(
        "a",
      );

    link.href = url;
    link.download =
      filename;

    document.body.appendChild(
      link,
    );

    link.click();

    link.remove();

    setTimeout(() => {
      URL.revokeObjectURL(
        url,
      );
    }, 1200);

    return true;
  }

  // ==========================================================
  // REFRESH
  // ==========================================================

  async function refresh() {
    try {
      sectionsCache = {};

      await loadGradeLevels();

      await buildSectionSelect();

      const attendanceLoaded =
        await loadAttendance();

      return (
        attendanceLoaded ===
        true
      );
    } catch (error) {
      console.error(
        "Attendance refresh failed:",
        error,
      );

      return false;
    }
  }

  // ==========================================================
  // CONFIRMATION MODAL + SUCCESS TOAST
  // ==========================================================

  let confirmResolver =
    null;

  let successToastTimer =
    null;

  function openConfirmation({
    title,
    sub,
    message,
    actionLabel,
  }) {
    if (
      !confirmModal ||
      !confirmTitle ||
      !confirmSub ||
      !confirmText ||
      !confirmActionBtn
    ) {
      return Promise.resolve(
        false,
      );
    }

    if (confirmResolver) {
      return Promise.resolve(
        false,
      );
    }

    confirmTitle.textContent =
      title;

    confirmSub.textContent =
      sub;

    confirmText.textContent =
      message;

    confirmActionBtn.textContent =
      actionLabel;

    confirmModal.classList.remove(
      "hidden",
    );

    confirmModal.setAttribute(
      "aria-hidden",
      "false",
    );

    confirmModal
      .querySelector(
        ".t-confirm-dialog",
      )
      ?.focus();

    return new Promise(
      (resolve) => {
        confirmResolver =
          resolve;
      },
    );
  }

  function closeConfirmation(
    confirmed = false,
  ) {
    if (!confirmResolver) {
      return;
    }

    const resolve =
      confirmResolver;

    confirmResolver = null;

    confirmModal.classList.add(
      "hidden",
    );

    confirmModal.setAttribute(
      "aria-hidden",
      "true",
    );

    resolve(confirmed);
  }

  function showSuccessToast(
    message,
  ) {
    if (
      !successToast ||
      !successToastText
    ) {
      return;
    }

    clearTimeout(
      successToastTimer,
    );

    successToastText.textContent =
      message;

    successToast.hidden =
      false;

    successToastTimer =
      setTimeout(() => {
        successToast.hidden =
          true;
      }, 3000);
  }

  confirmCloseX?.addEventListener(
    "click",
    () => {
      closeConfirmation(
        false,
      );
    },
  );

  confirmCancelBtn?.addEventListener(
    "click",
    () => {
      closeConfirmation(
        false,
      );
    },
  );

  confirmBackdrop?.addEventListener(
    "click",
    () => {
      closeConfirmation(
        false,
      );
    },
  );

  confirmActionBtn?.addEventListener(
    "click",
    () => {
      closeConfirmation(
        true,
      );
    },
  );

  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key ===
          "Escape" &&
        confirmResolver
      ) {
        closeConfirmation(
          false,
        );
      }
    },
  );

  // ==========================================================
  // EVENTS
  // ==========================================================

  exportCsvBtn?.addEventListener(
    "click",
    async () => {
      const confirmed =
        await openConfirmation({
          title:
            "Export Attendance Report?",
          sub:
            "Download a CSV file.",
          message:
            "Export the attendance records matching your current filters?",
          actionLabel:
            "Export CSV",
        });

      if (!confirmed) {
        return;
      }

      const exported =
        exportCSV();

      if (exported) {
        showSuccessToast(
          "Attendance report exported successfully.",
        );
      }
    },
  );

  refreshBtn?.addEventListener(
    "click",
    async () => {
      await refresh();
    },
  );

  // DATE
  // Reload attendance from MongoDB.
  dateInput?.addEventListener(
    "change",
    async () => {
      await loadAttendance();
    },
  );

  // GRADE
  // Reload sections and attendance.
  gradeSelect?.addEventListener(
    "change",
    async () => {
      try {
        await buildSectionSelect();

        await loadAttendance();
      } catch (error) {
        console.error(
          "Failed to update sections:",
          error,
        );
      }
    },
  );

  // SECTION
  sectionSelect?.addEventListener(
    "change",
    async () => {
      await loadAttendance();
    },
  );

  // STATUS
  statusSelect?.addEventListener(
    "change",
    async () => {
      await loadAttendance();
    },
  );

  // SEARCH
  // Search locally.
  searchInput?.addEventListener(
    "input",
    render,
  );

  // ==========================================================
  // INIT
  // ==========================================================

  async function init() {
    try {
      if (
        dateInput &&
        !dateInput.value
      ) {
        dateInput.value =
          todayISO();
      }

      // 1. Fetch real grades.
      await loadGradeLevels();

      // 2. Fetch real sections.
      await buildSectionSelect();

      // 3. Fetch real attendance.
      await loadAttendance();
    } catch (error) {
      console.error(
        "Admin attendance initialization failed:",
        error,
      );

      attendanceRows = [];

      if (dataSourceNote) {
        dataSourceNote.textContent =
          "Data source: MongoDB Attendance";
      }

      if (summaryLine) {
        summaryLine.textContent =
          "No attendance records yet.";
      }

      renderMessage(
        "No attendance yet. No attendance records have been submitted for the selected class and date.",
      );
    }
  }

  init();
});