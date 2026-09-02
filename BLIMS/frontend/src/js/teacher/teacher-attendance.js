// frontend/src/js/teacher/teacher-attendance.js
// Teacher Attendance: backend-driven version
//
// Rules:
// - Attendance is recorded for TODAY only.
// - Date is automatically populated.
// - Date cannot be changed by the teacher.
// - Active School Year comes from the backend.
// - Teacher class/section comes from the backend.
// - YTD summary comes from the active school year.
// - School year information is NEVER displayed on this page.

/* =========================================================
   DOM HELPER
========================================================= */

const $ = (id) =>
  document.getElementById(id);


/* =========================================================
   API
========================================================= */

async function apiFetch(url, options = {}) {

  const res = await fetch(url, {
    credentials: "include",

    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },

    ...options,
  });

  const data =
    await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      data.message || "Request failed"
    );
  }

  return data;
}


/* =========================================================
   HELPERS
========================================================= */

function normalize(value) {
  return String(value ?? "").trim();
}


function fullName(student) {
  return [
    student.firstName,
    student.middleName,
    student.lastName,
  ]
    .filter(Boolean)
    .join(" ");
}


function pad2(number) {
  return String(number).padStart(2, "0");
}


/* =========================================================
   TODAY
========================================================= */

function todayISO() {

  const d = new Date();

  return (
    `${d.getFullYear()}-` +
    `${pad2(d.getMonth() + 1)}-` +
    `${pad2(d.getDate())}`
  );
}


/* =========================================================
   DATE FORMATTING
========================================================= */

function formatLongDate(iso) {

  if (!iso) {
    return "—";
  }

  const d =
    new Date(`${iso}T00:00:00`);

  if (Number.isNaN(d.getTime())) {
    return "—";
  }

  return d.toLocaleDateString(
    undefined,
    {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  );
}


/* =========================================================
   SCOPE
========================================================= */

function scopeLabel(scope) {

  return [
    scope?.className,
    scope?.sectionName,
  ]
    .filter(Boolean)
    .join(" - ") || "—";
}


/* =========================================================
   STATE
========================================================= */

let TEACHER_SCOPE = {
  className: "",
  sectionName: "",
};


/*
 * School year is still stored because
 * the backend uses it for YTD calculations.
 *
 * It is NOT displayed anywhere.
 */

let SCHOOL_YEAR = {
  id: "",
  name: "",
  start: "",
  end: "",
};


let students = [];

let ytdSummary = [];

let existingSession = null;


let activeScope = {
  className: "",
  sectionName: "",
};


let activeDateISO = "";

let viewMode = "home";

let rowFilter = "all";

let draftMarks = {};

let savedForThisSession = false;


/* =========================================================
   UI STATE
========================================================= */

function setView(mode) {

  viewMode = mode;

  const home =
    $("attHomeView");

  const take =
    $("attTakeView");

  const backBtn =
    $("attBackBtn");

  if (mode === "home") {

    home?.classList.remove("hidden");

    take?.classList.add("hidden");

    backBtn?.classList.add("hidden");

    return;
  }

  home?.classList.add("hidden");

  take?.classList.remove("hidden");

  backBtn?.classList.remove("hidden");
}


/* =========================================================
   HOME SUBTITLE
========================================================= */

/*
 * IMPORTANT:
 *
 * School year is intentionally NOT included here.
 *
 * Display:
 *
 * Grade/Section • Today's Date
 *
 * Example:
 *
 * Grade 6 - Rizal • Friday, August 28, 2026
 */

function syncHomeSubtitle() {

  const sub =
    $("attHomeSub");

  if (!sub) {
    return;
  }

  const scope =
    scopeLabel(activeScope);

  const date =
    formatLongDate(activeDateISO);

  sub.textContent =
    `${scope} • ${date}`;
}


/* =========================================================
   HIDE SCHOOL YEAR SUBTITLE
========================================================= */

/*
 * This function is intentionally kept as a safety layer.
 *
 * If #attYtdSub still exists in the HTML,
 * it will always remain empty and hidden.
 *
 * NO school year is displayed.
 */

function syncSchoolYearSubtitle() {

  const element =
    $("attYtdSub");

  if (!element) {
    return;
  }

  element.textContent = "";

  element.style.display = "none";
}


/* =========================================================
   SESSION HEADER
========================================================= */

function setSessionHeader() {

  const title =
    $("sessionTitle");

  const date =
    $("sessionDateLabel");

  if (title) {

    title.textContent =
      scopeLabel(activeScope);

  }

  if (date) {

    date.textContent =
      formatLongDate(activeDateISO);

  }
}


/* =========================================================
   SESSION STATUS
========================================================= */

function setSessionStatus(isSaved) {

  const box =
    $("sessionStatus");

  if (!box) {
    return;
  }

  if (isSaved) {

    box.textContent = "Saved";

    box.style.background =
      "rgba(25, 135, 84, 0.14)";

    box.style.color =
      "#0f5132";

  } else {

    box.textContent = "Not Saved";

    box.style.background =
      "rgba(255, 193, 7, 0.16)";

    box.style.color =
      "#7a5b00";
  }
}


/* =========================================================
   LOCK DATE FIELD
========================================================= */

function lockDateField() {

  const dateInput =
    $("dateInput");

  if (!dateInput) {
    return;
  }

  /*
   * Always force today's date.
   */

  dateInput.value =
    todayISO();

  /*
   * Completely disable date selection.
   */

  dateInput.disabled = true;

  dateInput.readOnly = true;

  dateInput.setAttribute(
    "aria-disabled",
    "true"
  );

  dateInput.setAttribute(
    "title",
    "Attendance can only be recorded for today."
  );
}


/* =========================================================
   BACKEND LOADERS
========================================================= */

async function loadBootstrap(dateISO) {

  const response =
    await apiFetch(
      `/api/teacher/attendance/bootstrap?date=${encodeURIComponent(
        dateISO
      )}`
    );

  const data =
    response.data || {};


  /* -------------------------------------------------------
     TEACHER SCOPE
  ------------------------------------------------------- */

  TEACHER_SCOPE =
    data.teacherScope || {
      className: "",
      sectionName: "",
    };


  /* -------------------------------------------------------
     ACTIVE SCHOOL YEAR
     
     Backend data is still stored internally.
     It is NOT displayed.
  ------------------------------------------------------- */

  SCHOOL_YEAR =
    data.schoolYear || {
      id: "",
      name: "",
      start: "",
      end: "",
    };


  /* -------------------------------------------------------
     STUDENTS
  ------------------------------------------------------- */

  students =
    Array.isArray(data.students)
      ? data.students
      : [];


  /* -------------------------------------------------------
     TODAY'S EXISTING SESSION
  ------------------------------------------------------- */

  existingSession =
    data.session || null;


  /* -------------------------------------------------------
     ACTIVE TEACHER SCOPE
  ------------------------------------------------------- */

  activeScope = {

    className:
      normalize(
        TEACHER_SCOPE.className
      ),

    sectionName:
      normalize(
        TEACHER_SCOPE.sectionName
      ),
  };


  /* -------------------------------------------------------
     GRADE / SECTION
  ------------------------------------------------------- */

  const scopeInput =
    $("scopeInput");

  if (scopeInput) {

    scopeInput.value =
      scopeLabel(activeScope);

  }


  /* -------------------------------------------------------
     HOME SUBTITLE
     
     ONLY CLASS + DATE
     
     NO SCHOOL YEAR
  ------------------------------------------------------- */

  syncHomeSubtitle();
}


/* =========================================================
   LOAD YTD SUMMARY
========================================================= */

async function loadYtdSummary() {

  const response =
    await apiFetch(
      "/api/teacher/attendance/summary"
    );

  const data =
    response.data || {};


  /* -------------------------------------------------------
     SUMMARY
  ------------------------------------------------------- */

  ytdSummary =
    Array.isArray(data.summary)
      ? data.summary
      : [];


  /* -------------------------------------------------------
     SCHOOL YEAR
     
     Keep backend data internally.
     
     DO NOT DISPLAY IT.
  ------------------------------------------------------- */

  if (data.schoolYear) {

    SCHOOL_YEAR = {

      id:
        normalize(
          data.schoolYear.id
        ),

      name:
        normalize(
          data.schoolYear.name
        ),

      start:
        normalize(
          data.schoolYear.start
        ),

      end:
        normalize(
          data.schoolYear.end
        ),
    };
  }


  /* -------------------------------------------------------
     REMOVE / HIDE ANY SCHOOL YEAR SUBTITLE
  ------------------------------------------------------- */

  syncSchoolYearSubtitle();


  /*
   * Refresh home subtitle.
   *
   * It only contains:
   *
   * Class / Section
   * +
   * Today's date
   */

  syncHomeSubtitle();
}


/* =========================================================
   YTD TABLE
========================================================= */

function renderYtdTable() {

  const tbody =
    $("ytdTbody");

  if (!tbody) {
    return;
  }

  tbody.innerHTML = "";


  if (
    !activeScope.className ||
    !activeScope.sectionName ||
    !ytdSummary.length
  ) {

    const tr =
      document.createElement("tr");

    tr.innerHTML = `
      <td
        colspan="8"
        class="att-empty"
      >
        No students found for this class & section.
      </td>
    `;

    tbody.appendChild(tr);

    return;
  }


  ytdSummary.forEach(
    (row, index) => {

      const tr =
        document.createElement("tr");

      tr.innerHTML = `

        <td>
          ${String(index + 1).padStart(2, "0")}
        </td>

        <td>

          <div class="att-student-cell">

            <img
              class="att-avatar"
              src="${
                row.photoDataUrl ||
                "../../assets/images/bg.jpg"
              }"
              alt=""
            />

            <div>

              <div class="att-name">
                ${row.fullName || "—"}
              </div>

              <div class="att-subid">
                ${row.studentId || "—"}
              </div>

            </div>

          </div>

        </td>

        <td>
          ${row.present || 0}
        </td>

        <td>
          ${row.absent || 0}
        </td>

        <td>
          ${row.late || 0}
        </td>

        <td>
          ${row.excused || 0}
        </td>

        <td>
          ${row.total || 0}
        </td>

        <td>
          ${
            row.total
              ? `${row.attendancePercent || 0}%`
              : "—"
          }
        </td>

      `;

      tbody.appendChild(tr);
    }
  );
}


/* =========================================================
   TAKE ATTENDANCE
========================================================= */

function ensureDraftMarks() {

  draftMarks = {};


  students.forEach(
    (student) => {

      draftMarks[
        student.studentId
      ] = "";

    }
  );


  /*
   * Load today's saved attendance.
   */

  if (
    existingSession &&
    Array.isArray(
      existingSession.records
    )
  ) {

    existingSession.records.forEach(
      (record) => {

        if (
          Object.prototype.hasOwnProperty.call(
            draftMarks,
            record.studentId
          )
        ) {

          draftMarks[
            record.studentId
          ] =
            normalize(
              record.status
            ).toLowerCase();

        }
      }
    );


    savedForThisSession =
      true;

    setSessionStatus(true);

  } else {

    savedForThisSession =
      false;

    setSessionStatus(false);
  }
}


/* =========================================================
   RENDER TAKE TABLE
========================================================= */

function renderTakeTable() {

  const tbody =
    $("takeTbody");

  if (!tbody) {
    return;
  }

  tbody.innerHTML = "";


  if (!students.length) {

    const tr =
      document.createElement("tr");

    tr.innerHTML = `
      <td
        colspan="5"
        class="att-empty"
      >
        No students found.
      </td>
    `;

    tbody.appendChild(tr);

    renderSideSummary();

    return;
  }


  const filtered =
    students.filter(
      (student) => {

        if (
          rowFilter === "all"
        ) {
          return true;
        }

        return (
          normalize(
            draftMarks[
              student.studentId
            ]
          )
            .toLowerCase() ===
          rowFilter
        );
      }
    );


  if (!filtered.length) {

    const tr =
      document.createElement("tr");

    tr.innerHTML = `
      <td
        colspan="5"
        class="att-empty"
      >
        No students match this filter.
      </td>
    `;

    tbody.appendChild(tr);

    renderSideSummary();

    return;
  }


  filtered.forEach(
    (student) => {

      const sid =
        student.studentId;

      const status =
        normalize(
          draftMarks[sid]
        ).toLowerCase();


      const tr =
        document.createElement("tr");


      tr.innerHTML = `

        <td>

          <div class="att-student-cell">

            <img
              class="att-avatar"
              src="${
                student.photoDataUrl ||
                "../../assets/images/bg.jpg"
              }"
              alt=""
            />

            <div>

              <div class="att-name">
                ${fullName(student) || "—"}
              </div>

              <div class="att-subid">
                ${sid || "—"}
              </div>

            </div>

          </div>

        </td>


        <td style="text-align:center">

          <input
            class="att-radio"
            type="radio"
            name="att_${sid}"
            data-sid="${sid}"
            value="present"
            ${
              status === "present"
                ? "checked"
                : ""
            }
          />

        </td>


        <td style="text-align:center">

          <input
            class="att-radio"
            type="radio"
            name="att_${sid}"
            data-sid="${sid}"
            value="absent"
            ${
              status === "absent"
                ? "checked"
                : ""
            }
          />

        </td>


        <td style="text-align:center">

          <input
            class="att-radio"
            type="radio"
            name="att_${sid}"
            data-sid="${sid}"
            value="late"
            ${
              status === "late"
                ? "checked"
                : ""
            }
          />

        </td>


        <td style="text-align:center">

          <input
            class="att-radio"
            type="radio"
            name="att_${sid}"
            data-sid="${sid}"
            value="excused"
            ${
              status === "excused"
                ? "checked"
                : ""
            }
          />

        </td>

      `;


      tbody.appendChild(tr);
    }
  );


  renderSideSummary();
}


/* =========================================================
   SIDE SUMMARY
========================================================= */

function renderSideSummary() {

  const total =
    students.length;

  let present = 0;
  let absent = 0;
  let late = 0;
  let excused = 0;


  students.forEach(
    (student) => {

      const status =
        normalize(
          draftMarks[
            student.studentId
          ]
        ).toLowerCase();


      if (status === "present") {
        present++;
      }

      else if (status === "absent") {
        absent++;
      }

      else if (status === "late") {
        late++;
      }

      else if (status === "excused") {
        excused++;
      }
    }
  );


  if ($("sumPresent")) {
    $("sumPresent").textContent =
      String(present);
  }

  if ($("sumAbsent")) {
    $("sumAbsent").textContent =
      String(absent);
  }

  if ($("sumLate")) {
    $("sumLate").textContent =
      String(late);
  }

  if ($("sumExcused")) {
    $("sumExcused").textContent =
      String(excused);
  }

  if ($("sumTotal")) {
    $("sumTotal").textContent =
      String(total);
  }
}


/* =========================================================
   FILTER
========================================================= */

function setChipActive(filter) {

  rowFilter =
    filter;


  document
    .querySelectorAll(
      "#statusChips .att-chip"
    )
    .forEach(
      (button) => {

        button.classList.toggle(
          "active",
          button.dataset.filter === filter
        );

      }
    );


  renderTakeTable();
}


/* =========================================================
   MARK ALL
========================================================= */

function markAll(status) {

  students.forEach(
    (student) => {

      draftMarks[
        student.studentId
      ] = status;

    }
  );


  savedForThisSession =
    false;

  setSessionStatus(false);

  renderTakeTable();
}


/* =========================================================
   CLEAR ALL
========================================================= */

function clearAll() {

  students.forEach(
    (student) => {

      draftMarks[
        student.studentId
      ] = "";

    }
  );


  savedForThisSession =
    false;

  setSessionStatus(false);

  renderTakeTable();
}


/* =========================================================
   LAST SESSION
========================================================= */

function loadLastSession() {

  alert(
    "Last Session backend loading is not added yet."
  );
}


/* =========================================================
   SAVE ATTENDANCE
========================================================= */

async function saveAttendance() {

  if (!students.length) {

    alert(
      "No students to mark."
    );

    return;
  }


  /*
   * ALWAYS use today's date.
   */

  activeDateISO =
    todayISO();


  /*
   * Keep date field locked.
   */

  lockDateField();


  const auto =
    $("autoExcused")?.checked;


  const records =
    students.map(
      (student) => {

        let status =
          normalize(
            draftMarks[
              student.studentId
            ]
          ).toLowerCase();


        if (
          !status &&
          auto
        ) {

          status =
            "excused";
        }


        return {

          studentId:
            student.studentId,

          status:
            status || "excused",
        };
      }
    );


  try {

    await apiFetch(
      "/api/teacher/attendance/save",
      {
        method: "POST",

        body:
          JSON.stringify({
            date:
              activeDateISO,

            records,
          }),
      }
    );


    savedForThisSession =
      true;

    setSessionStatus(true);


    /*
     * Reload today's backend data.
     */

    await loadBootstrap(
      activeDateISO
    );


    /*
     * Reload YTD data.
     */

    await loadYtdSummary();


    renderYtdTable();


    /*
     * Make absolutely sure
     * no school year subtitle
     * appears.
     */

    syncSchoolYearSubtitle();


    setView("home");

  } catch (err) {

    console.error(
      "saveAttendance error:",
      err
    );

    alert(
      err.message ||
      "Failed to save attendance."
    );
  }
}


/* =========================================================
   EVENTS
========================================================= */

function bindEvents() {


  /* -------------------------------------------------------
     TAKE ATTENDANCE
  ------------------------------------------------------- */

  $("takeAttendanceBtn")
    ?.addEventListener(
      "click",
      () => {

        /*
         * Always use today's date.
         */

        activeDateISO =
          todayISO();


        lockDateField();


        setView("take");


        setSessionHeader();


        setChipActive("all");


        ensureDraftMarks();


        renderTakeTable();

      }
    );


  /* -------------------------------------------------------
     BACK
  ------------------------------------------------------- */

  $("attBackBtn")
    ?.addEventListener(
      "click",
      () => {
        setView("home");
      }
    );


  $("cancelTakeBtn")
    ?.addEventListener(
      "click",
      () => {
        setView("home");
      }
    );


  /* -------------------------------------------------------
     STATUS FILTERS
  ------------------------------------------------------- */

  $("statusChips")
    ?.addEventListener(
      "click",
      (event) => {

        const button =
          event.target.closest(
            "button[data-filter]"
          );

        if (!button) {
          return;
        }

        setChipActive(
          button.dataset.filter
        );
      }
    );


  /* -------------------------------------------------------
     RADIO CHANGE
  ------------------------------------------------------- */

  $("takeTbody")
    ?.addEventListener(
      "change",
      (event) => {

        const element =
          event.target;


        if (
          !(element instanceof HTMLInputElement)
        ) {
          return;
        }


        if (
          !element.classList.contains(
            "att-radio"
          )
        ) {
          return;
        }


        const sid =
          element.dataset.sid;


        const value =
          normalize(
            element.value
          ).toLowerCase();


        if (!sid) {
          return;
        }


        draftMarks[sid] =
          value;


        savedForThisSession =
          false;


        setSessionStatus(false);


        renderSideSummary();
      }
    );


  /* -------------------------------------------------------
     QUICK ACTIONS
  ------------------------------------------------------- */

  $("markAllPresentBtn")
    ?.addEventListener(
      "click",
      () => {
        markAll("present");
      }
    );


  $("quickMarkAllPresent")
    ?.addEventListener(
      "click",
      () => {
        markAll("present");
      }
    );


  $("quickClearAll")
    ?.addEventListener(
      "click",
      clearAll
    );


  $("loadLastSessionBtn")
    ?.addEventListener(
      "click",
      loadLastSession
    );


  $("saveAttendanceBtn")
    ?.addEventListener(
      "click",
      saveAttendance
    );
}


/* =========================================================
   INIT
========================================================= */

async function init() {

  try {

    /*
     * Always initialize attendance
     * to TODAY.
     */

    activeDateISO =
      todayISO();


    /*
     * Lock date immediately.
     */

    lockDateField();


    /* -----------------------------------------------------
       LOAD BACKEND DATA
    ----------------------------------------------------- */

    await loadBootstrap(
      activeDateISO
    );


    /* -----------------------------------------------------
       LOAD YTD SUMMARY
    ----------------------------------------------------- */

    await loadYtdSummary();


    /* -----------------------------------------------------
       RENDER
    ----------------------------------------------------- */

    /*
     * Re-lock date after backend
     * loading just in case.
     */

    activeDateISO =
      todayISO();

    lockDateField();


    syncHomeSubtitle();


    /*
     * IMPORTANT:
     *
     * Do NOT display school year.
     *
     * This only clears the old HTML
     * element if it still exists.
     */

    syncSchoolYearSubtitle();


    renderYtdTable();


    setView("home");


    bindEvents();

  } catch (err) {

    console.error(
      "teacher attendance init error:",
      err
    );


    const tbody =
      $("ytdTbody");


    if (tbody) {

      tbody.innerHTML = `
        <tr>
          <td
            colspan="8"
            class="att-empty"
          >
            Failed to load attendance data.
          </td>
        </tr>
      `;
    }


    const subtitle =
      $("attHomeSub");


    if (subtitle) {

      subtitle.textContent =
        err.message ||
        "Failed to load attendance data.";
    }


    console.error(
      err.message ||
      "Failed to load attendance page."
    );
  }
}


/* =========================================================
   START
========================================================= */

document.addEventListener(
  "DOMContentLoaded",
  init
);