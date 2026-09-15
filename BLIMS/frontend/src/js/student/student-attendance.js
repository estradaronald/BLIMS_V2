// frontend/src/js/student/student-attendance.js

document.addEventListener("DOMContentLoaded", () => {
  initTopbarMenu();
  initLogout();
  initAttendance();
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
   ATTENDANCE
   Student
   Backend-connected
================================= */

function initAttendance() {
  const gradeSectionEl = $("attGradeSection");

  const monthSelect = $("attMonthSelect");

  const tabTable = $("attTabTable");
  const tabCal = $("attTabCalendar");

  const viewTable = $("attViewTable");
  const viewCal = $("attViewCalendar");

  const tbody = $("attTbody");
  const calTitle = $("attCalTitle");
  const calGrid = $("attCalGrid");

  const empty = $("attEmpty");

  const presentEl = $("attPresent");
  const absentEl = $("attAbsent");
  const lateEl = $("attLate");
  const rateEl = $("attRate");

  // School Year is intentionally not used here.
  // It is handled internally by the backend.

  if (
    !monthSelect ||
    !tabTable ||
    !tabCal ||
    !viewTable ||
    !viewCal ||
    !tbody ||
    !calTitle ||
    !calGrid ||
    !empty ||
    !presentEl ||
    !absentEl ||
    !lateEl ||
    !rateEl
  ) {
    return;
  }

  // ==========================================
  // STATE
  // ==========================================

  const state = {
    mode: "table",
    month: "all",

    grade: "",
    section: "",

    records: [],
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

  function normalizeRecord(record) {
    if (!record || typeof record !== "object") {
      return null;
    }

    const date = String(
      record.date || ""
    ).trim();

    if (!date) {
      return null;
    }

    const status = norm(
      record.status
    );

    let normalizedStatus = "";

    if (status === "present") {
      normalizedStatus = "present";
    } else if (status === "absent") {
      normalizedStatus = "absent";
    } else if (status === "late") {
      normalizedStatus = "late";
    } else if (status === "excused") {
      normalizedStatus = "excused";
    }

    return {
      id: String(record.id || ""),
      date,
      status: normalizedStatus,

      statusLabel:
        record.statusLabel ||
        (
          normalizedStatus
            ? normalizedStatus.charAt(0).toUpperCase() +
              normalizedStatus.slice(1)
            : "—"
        ),
    };
  }

  function parseDate(dateStr) {
    if (!dateStr) {
      return null;
    }

    const d = new Date(
      `${dateStr}T00:00:00`
    );

    if (Number.isNaN(d.getTime())) {
      return null;
    }

    return d;
  }

  function parseMonthIndex(dateStr) {
    const d = parseDate(dateStr);

    if (!d) {
      return null;
    }

    return d.getMonth();
  }

  function niceDate(dateStr) {
    const d = parseDate(dateStr);

    if (!d) {
      return dateStr || "—";
    }

    return d.toLocaleDateString(
      undefined,
      {
        year: "numeric",
        month: "short",
        day: "2-digit",
      }
    );
  }

  function monthName(index) {
    const names = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    return names[index] || "Month";
  }

  // ==========================================
  // STATUS PILL
  // ==========================================

  function statusPill(status) {
    const cls =
      status === "present"
        ? "att-status att-present"
        : status === "absent"
        ? "att-status att-absent"
        : status === "late"
        ? "att-status att-late"
        : "att-status";

    const text =
      status === "present"
        ? "Present"
        : status === "absent"
        ? "Absent"
        : status === "late"
        ? "Late"
        : status === "excused"
        ? "Excused"
        : "—";

    return `
      <span class="${cls}">
        ${escapeHtml(text)}
      </span>
    `;
  }

  // ==========================================
  // FETCH ATTENDANCE
  // ==========================================

  async function fetchAttendance() {
    try {
      empty.textContent =
        "Loading attendance...";

      empty.classList.remove(
        "hidden"
      );

      tbody.innerHTML = "";
      calGrid.innerHTML = "";

      const response = await fetch(
        "/api/student/attendance",
        {
          method: "GET",

          credentials: "include",

          headers: {
            Accept: "application/json",
          },
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
            "Failed to load attendance."
        );
      }

      const data =
        result.data || {};

      // ==========================================
      // STUDENT
      // ==========================================

      const student =
        data.student || {};

      state.grade = String(
        student.grade || ""
      ).trim();

      state.section = String(
        student.section || ""
      ).trim();

      // ==========================================
      // RECORDS
      // ==========================================

      state.records =
        Array.isArray(
          data.records
        )
          ? data.records
              .map(normalizeRecord)
              .filter(Boolean)
          : [];

      // ==========================================
      // INITIAL MONTH
      // ==========================================

      state.month =
        monthSelect.value ||
        "all";

      render();

    } catch (error) {
      console.error(
        "❌ Failed to fetch student attendance:",
        error
      );

      state.records = [];
      state.grade = "";
      state.section = "";

      tbody.innerHTML = "";
      calGrid.innerHTML = "";

      empty.textContent =
        "Unable to load attendance.";

      empty.classList.remove(
        "hidden"
      );
    }
  }

  // ==========================================
  // MODE
  // ==========================================

  function setMode(mode) {
    const isTable =
      mode === "table";

    tabTable.classList.toggle(
      "active",
      isTable
    );

    tabTable.setAttribute(
      "aria-selected",
      isTable
        ? "true"
        : "false"
    );

    tabCal.classList.toggle(
      "active",
      !isTable
    );

    tabCal.setAttribute(
      "aria-selected",
      !isTable
        ? "true"
        : "false"
    );

    viewTable.classList.toggle(
      "hidden",
      !isTable
    );

    viewCal.classList.toggle(
      "hidden",
      isTable
    );

    state.mode = mode;
  }

  // ==========================================
  // FILTER RECORDS
  // ==========================================

  function getFilteredRecords() {
    let list = [
      ...state.records,
    ];

    if (
      state.month !== "all"
    ) {
      const monthIndex =
        Number(state.month);

      list =
        list.filter(
          (record) =>
            parseMonthIndex(
              record.date
            ) === monthIndex
        );
    }

    return list;
  }

  // ==========================================
  // SUMMARY
  // ==========================================

  function computeSummary(list) {
    let present = 0;
    let absent = 0;
    let late = 0;

    list.forEach((record) => {
      if (
        record.status ===
        "present"
      ) {
        present++;
      }

      else if (
        record.status ===
        "absent"
      ) {
        absent++;
      }

      else if (
        record.status ===
        "late"
      ) {
        late++;
      }
    });

    const total =
      present +
      absent +
      late;

    // Match backend calculation:
    // present / total * 100

    const rate =
      total > 0
        ? Math.round(
            (present / total) *
              100
          )
        : null;

    presentEl.textContent =
      String(present);

    absentEl.textContent =
      String(absent);

    lateEl.textContent =
      String(late);

    rateEl.textContent =
      rate === null
        ? "—"
        : `${rate}%`;
  }

  // ==========================================
  // TABLE
  // ==========================================

  function renderTable(list) {
    tbody.innerHTML = "";

    const sorted =
      list
        .slice()
        .sort((a, b) =>
          String(b.date).localeCompare(
            String(a.date)
          )
        );

    sorted.forEach((record) => {
      const tr =
        document.createElement(
          "tr"
        );

      tr.innerHTML = `
        <td>
          ${escapeHtml(
            niceDate(record.date)
          )}
        </td>

        <td>
          ${statusPill(
            record.status
          )}
        </td>
      `;

      tbody.appendChild(
        tr
      );
    });
  }

  // ==========================================
  // CALENDAR
  // ==========================================

  function renderCalendar(list) {
    let monthIndex =
      state.month === "all"
        ? new Date().getMonth()
        : Number(state.month);

    if (
      Number.isNaN(monthIndex) ||
      monthIndex < 0 ||
      monthIndex > 11
    ) {
      monthIndex =
        new Date().getMonth();
    }

    calTitle.textContent =
      monthName(monthIndex);

    // ------------------------------------------
    // Determine calendar year
    // ------------------------------------------

    let year =
      new Date().getFullYear();

    const monthRecord =
      list.find(
        (record) =>
          parseMonthIndex(
            record.date
          ) === monthIndex
      );

    if (monthRecord) {
      const d =
        parseDate(
          monthRecord.date
        );

      if (d) {
        year =
          d.getFullYear();
      }
    }

    // ------------------------------------------
    // Map attendance by date
    // ------------------------------------------

    const map = new Map();

    list.forEach((record) => {
      const recordMonth =
        parseMonthIndex(
          record.date
        );

      if (
        recordMonth !==
        monthIndex
      ) {
        return;
      }

      const previous =
        map.get(record.date);

      if (!previous) {
        map.set(
          record.date,
          record.status
        );

        return;
      }

      // Priority:
      // absent > late > excused > present

      const rank = (status) => {
        if (
          status === "absent"
        ) {
          return 4;
        }

        if (
          status === "late"
        ) {
          return 3;
        }

        if (
          status === "excused"
        ) {
          return 2;
        }

        if (
          status === "present"
        ) {
          return 1;
        }

        return 0;
      };

      if (
        rank(record.status) >
        rank(previous)
      ) {
        map.set(
          record.date,
          record.status
        );
      }
    });

    // ------------------------------------------
    // Build calendar
    // ------------------------------------------

    const first =
      new Date(
        year,
        monthIndex,
        1
      );

    const last =
      new Date(
        year,
        monthIndex + 1,
        0
      );

    const startDow =
      first.getDay();

    const daysInMonth =
      last.getDate();

    calGrid.innerHTML = "";

    // Blank cells before day 1
    for (
      let i = 0;
      i < startDow;
      i++
    ) {
      const blank =
        document.createElement(
          "div"
        );

      blank.className =
        "att-cal-day";

      blank.style.opacity =
        "0";

      calGrid.appendChild(
        blank
      );
    }

    // Days
    for (
      let day = 1;
      day <= daysInMonth;
      day++
    ) {
      const month =
        String(
          monthIndex + 1
        ).padStart(
          2,
          "0"
        );

      const dayString =
        String(day).padStart(
          2,
          "0"
        );

      const iso =
        `${year}-${month}-${dayString}`;

      const status =
        map.get(iso) || "";

      const cell =
        document.createElement(
          "div"
        );

      cell.className =
        "att-cal-day" +
        (
          status
            ? ` ${status}`
            : ""
        );

      let statusLetter = "";

      if (
        status === "present"
      ) {
        statusLetter = "P";
      }

      else if (
        status === "absent"
      ) {
        statusLetter = "A";
      }

      else if (
        status === "late"
      ) {
        statusLetter = "L";
      }

      else if (
        status === "excused"
      ) {
        statusLetter = "E";
      }

      cell.innerHTML = `
        <div>
          ${day}
        </div>

        <div
          style="
            font-weight:1000;
            font-size:10px;
            opacity:.8;
          "
        >
          ${statusLetter}
        </div>
      `;

      calGrid.appendChild(
        cell
      );
    }
  }

  // ==========================================
  // RENDER
  // ==========================================

  function render() {
    // ------------------------------------------
    // Grade + Section
    // ------------------------------------------

    if (gradeSectionEl) {
      const grade =
        state.grade ||
        "Grade —";

      const section =
        state.section;

      gradeSectionEl.textContent =
        section
          ? `${grade} - Section ${section}`
          : grade;
    }

    // ------------------------------------------
    // Filter
    // ------------------------------------------

    const list =
      getFilteredRecords();

    // ------------------------------------------
    // Summary
    // ------------------------------------------

    computeSummary(list);

    // ------------------------------------------
    // Empty state
    // ------------------------------------------

    const hasRecords =
      list.length > 0;

    empty.classList.toggle(
      "hidden",
      hasRecords
    );

    if (!hasRecords) {
      empty.textContent =
        "No attendance record yet.";
    }

    // ------------------------------------------
    // Current view
    // ------------------------------------------

    if (
      state.mode === "table"
    ) {
      renderTable(list);
    } else {
      renderCalendar(list);
    }
  }

  // ==========================================
  // EVENTS
  // ==========================================

  tabTable.addEventListener(
    "click",
    () => {
      setMode("table");
      render();
    }
  );

  tabCal.addEventListener(
    "click",
    () => {
      setMode("calendar");
      render();
    }
  );

  monthSelect.addEventListener(
    "change",
    () => {
      state.month =
        monthSelect.value ||
        "all";

      render();
    }
  );

  // ==========================================
  // BOOT
  // ==========================================

  setMode("table");

  fetchAttendance();
}