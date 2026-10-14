// frontend/src/js/teacher/teacher-grades.js
//
// BLIMS Teacher Grades
//
// Backend:
// GET  /api/teacher/grades/encoding
// GET  /api/teacher/grades/grades
// POST /api/teacher/grades/save
//
// IMPORTANT:
// - No localStorage for grades.
// - Assessment IDs are persisted.
// - School-year terms come from MongoDB.
// - Locked terms are read-only.
// - Assessment definitions persist even when scores are blank.
// ============================================================

// ============================================================
// API
// ============================================================

const $ = (id) => document.getElementById(id);

async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    credentials: "include",

    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },

    ...options,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
}

// ============================================================
// HELPERS
// ============================================================

function normalize(value) {
  return String(value ?? "").trim();
}

function escapeHTML(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function makeId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function fullName(student) {
  return [
    student.firstName,
    student.middleName,
    student.lastName,
    student.suffix,
  ]
    .filter(Boolean)
    .join(" ");
}

function roundOne(value) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return null;
  }

  return Math.round(Number(value) * 10) / 10;
}

// ============================================================
// STATE
// ============================================================

let TEACHER_SCOPE = {
  className: "",
  sectionName: "",
};

let SCHOOL_YEAR = {
  id: "",
  name: "",
  terms: [],
};

let students = [];

let subjects = [];

// Structure:
//
// gradesStore[scope||termId||subject] = {
//
//   meta: {
//     ww: [],
//     pt: [],
//     exam: []
//   },
//
//   scores: {
//
//     [studentId]: {
//
//       ww: {
//         [assessmentId]: score
//       },
//
//       pt: {
//         [assessmentId]: score
//       },
//
//       exam: {
//         [assessmentId]: score
//       }
//
//     }
//
//   }
//
// }

let gradesStore = {};

// This now stores the actual SchoolYear term ID.
//
// The variable name "quarter" is kept so the rest
// of the page architecture remains compatible.
let quarter = "";

let subject = "";

let dirty = false;

let currentKey = "";

// ============================================================
// TERM HELPERS
// ============================================================

function getTerms() {
  return Array.isArray(SCHOOL_YEAR.terms) ? SCHOOL_YEAR.terms : [];
}

function getSelectedTerm() {
  return getTerms().find((term) => String(term.id) === String(quarter)) || null;
}

function isCurrentTermLocked() {
  const term = getSelectedTerm();

  return Boolean(term?.locked);
}

function getTermLabel(term) {
  if (!term) {
    return "";
  }

  return normalize(term.name) || `Term ${term.order}`;
}

function getTermIndexLabel(term) {
  if (!term) {
    return "";
  }

  return normalize(term.name) || `Term ${term.order}`;
}

// ============================================================
// GRADING HELPERS
// ============================================================

function clampScore(value, maxPoints) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }

  const number = Number(value);

  const max = Number(maxPoints);

  if (!Number.isFinite(number) || !Number.isFinite(max) || max <= 0) {
    return null;
  }

  return Math.max(0, Math.min(max, number));
}

function percentage(score, points) {
  if (
    typeof score !== "number" ||
    !Number.isFinite(score) ||
    typeof points !== "number" ||
    !Number.isFinite(points) ||
    points <= 0
  ) {
    return null;
  }

  return (score / points) * 100;
}

function average(values) {
  const valid = values.filter(
    (value) => typeof value === "number" && Number.isFinite(value),
  );

  if (!valid.length) {
    return null;
  }

  const total = valid.reduce((sum, value) => sum + value, 0);

  return roundOne(total / valid.length);
}

// ============================================================
// TEACHER DATA
// ============================================================

async function loadTeacherData() {
  const response = await apiFetch("/api/teacher/grades/encoding");

  /*
   * Support both:
   *
   * {
   *   teacherScope: ...
   * }
   *
   * and:
   *
   * {
   *   data: {
   *     teacherScope: ...
   *   }
   * }
   */
  const data = response.data || response;

  // ----------------------------------------------------------
  // Teacher scope
  // ----------------------------------------------------------

  TEACHER_SCOPE = {
    className: normalize(data.teacherScope?.className),

    sectionName: normalize(data.teacherScope?.sectionName),
  };

  // ----------------------------------------------------------
  // School year
  // ----------------------------------------------------------

  SCHOOL_YEAR = {
    id: normalize(data.schoolYear?.id),

    name: normalize(data.schoolYear?.name),

    terms: Array.isArray(data.schoolYear?.terms)
      ? data.schoolYear.terms
          .map((term) => ({
            id: normalize(term.id || term._id),

            order: Number(term.order),

            name: normalize(term.name),

            start: term.start || null,

            end: term.end || null,

            locked: Boolean(term.locked),
          }))
          .sort((a, b) => a.order - b.order)
      : [],
  };

  // ----------------------------------------------------------
  // Students
  // ----------------------------------------------------------

  students = Array.isArray(data.students) ? data.students : [];

  // ----------------------------------------------------------
  // Subjects
  // ----------------------------------------------------------

  subjects = Array.isArray(data.subjects)
    ? data.subjects
        .map((item) => {
          if (typeof item === "string") {
            return normalize(item);
          }

          return normalize(
            item?.value ||
              item?.name ||
              item?.label ||
              item?.subject ||
              item?.subjectName,
          );
        })
        .filter(Boolean)
    : [];

  // ----------------------------------------------------------
  // Default term
  // ----------------------------------------------------------

  if (
    !quarter ||
    !SCHOOL_YEAR.terms.some((term) => String(term.id) === String(quarter))
  ) {
    const firstUnlocked = SCHOOL_YEAR.terms.find((term) => !term.locked);

    quarter = firstUnlocked?.id || SCHOOL_YEAR.terms[0]?.id || "";
  }

  // ----------------------------------------------------------
  // Default subject
  // ----------------------------------------------------------

  if (!subject || !subjects.includes(subject)) {
    subject = subjects[0] || "";
  }

  console.log("Teacher scope:", TEACHER_SCOPE);

  console.log("School year:", SCHOOL_YEAR);

  console.log("Students:", students);

  console.log("Subjects:", subjects);
}

// ============================================================
// LOAD SAVED GRADES
// ============================================================

async function loadSavedGrades() {
  const response = await apiFetch("/api/teacher/grades/grades");

  const data = response.data || response;

  const grades = Array.isArray(data.grades) ? data.grades : [];

  gradesStore = {};

  for (const grade of grades) {
    const termId = normalize(grade.termId);

    const subjectName = normalize(grade.subject);

    if (!termId || !subjectName) {
      continue;
    }

    const key = bucketKey(TEACHER_SCOPE, termId, subjectName);

    if (!gradesStore[key]) {
      gradesStore[key] = createEmptyBucket();
    }

    const bucket = gradesStore[key];

    const sid = normalize(grade.studentId);

    if (!sid) {
      continue;
    }

    if (!bucket.scores[sid]) {
      bucket.scores[sid] = {
        ww: {},
        pt: {},
        exam: {},
      };
    }

    // --------------------------------------------------------
    // Written Works
    // --------------------------------------------------------

    if (Array.isArray(grade.writtenWorks)) {
      grade.writtenWorks.forEach((assessment) => {
        /*
         * IMPORTANT:
         *
         * Use our custom assessmentId.
         *
         * DO NOT use MongoDB _id.
         */
        const assessmentId = normalize(assessment.assessmentId);

        if (!assessmentId) {
          return;
        }

        const existing = bucket.meta.ww.find(
          (item) => item.id === assessmentId,
        );

        if (!existing) {
          bucket.meta.ww.push({
            id: assessmentId,

            name: normalize(assessment.activity),

            points: Number(assessment.total),
          });
        }

        if (
          assessment.score !== null &&
          assessment.score !== undefined &&
          assessment.score !== ""
        ) {
          bucket.scores[sid].ww[assessmentId] = Number(assessment.score);
        } else {
          bucket.scores[sid].ww[assessmentId] = null;
        }
      });
    }

    // --------------------------------------------------------
    // Performance Tasks
    // --------------------------------------------------------

    if (Array.isArray(grade.performanceTasks)) {
      grade.performanceTasks.forEach((assessment) => {
        const assessmentId = normalize(assessment.assessmentId);

        if (!assessmentId) {
          return;
        }

        const existing = bucket.meta.pt.find(
          (item) => item.id === assessmentId,
        );

        if (!existing) {
          bucket.meta.pt.push({
            id: assessmentId,

            name: normalize(assessment.activity),

            points: Number(assessment.total),
          });
        }

        if (
          assessment.score !== null &&
          assessment.score !== undefined &&
          assessment.score !== ""
        ) {
          bucket.scores[sid].pt[assessmentId] = Number(assessment.score);
        } else {
          bucket.scores[sid].pt[assessmentId] = null;
        }
      });
    }

    // --------------------------------------------------------
    // Term Assessment / Exam
    // --------------------------------------------------------

    if (grade.termAssessment && typeof grade.termAssessment === "object") {
      const assessmentId = normalize(grade.termAssessment.assessmentId);

      if (assessmentId) {
        const existing = bucket.meta.exam.find(
          (item) => item.id === assessmentId,
        );

        if (!existing) {
          bucket.meta.exam.push({
            id: assessmentId,

            name: normalize(grade.termAssessment.activity) || "Term Exam",

            points:
              grade.termAssessment.total === null ||
              grade.termAssessment.total === undefined
                ? null
                : Number(grade.termAssessment.total),
          });
        }

        if (
          grade.termAssessment.score !== null &&
          grade.termAssessment.score !== undefined &&
          grade.termAssessment.score !== ""
        ) {
          bucket.scores[sid].exam[assessmentId] = Number(
            grade.termAssessment.score,
          );
        } else {
          bucket.scores[sid].exam[assessmentId] = null;
        }
      }
    }

    bucket.updatedAt = grade.updatedAt || Date.now();
  }

  /*
   * Make sure every loaded bucket has
   * score containers for every student.
   */
  Object.values(gradesStore).forEach((bucket) => {
    ensureBucketStructure(bucket);
  });

  console.log("Saved grades loaded:", gradesStore);
}

// ============================================================
// GRADE STORAGE
// ============================================================

function bucketKey(scope, termId, subjectValue) {
  return [
    normalize(scope.className),

    normalize(scope.sectionName),

    normalize(termId),

    normalize(subjectValue),
  ].join("||");
}

function createEmptyBucket() {
  return {
    meta: {
      ww: [],
      pt: [],
      exam: [],
    },

    scores: {},

    updatedAt: Date.now(),
  };
}

function ensureBucketStructure(bucket) {
  if (!bucket.meta) {
    bucket.meta = {};
  }

  bucket.meta.ww = Array.isArray(bucket.meta.ww) ? bucket.meta.ww : [];

  bucket.meta.pt = Array.isArray(bucket.meta.pt) ? bucket.meta.pt : [];

  bucket.meta.exam = Array.isArray(bucket.meta.exam) ? bucket.meta.exam : [];

  /*
   * Only one exam per subject/term.
   */
  if (bucket.meta.exam.length > 1) {
    bucket.meta.exam = bucket.meta.exam.slice(0, 1);
  }

  bucket.scores = bucket.scores || {};

  students.forEach((student) => {
    const sid = normalize(student.studentId);

    if (!sid) {
      return;
    }

    if (!bucket.scores[sid]) {
      bucket.scores[sid] = {
        ww: {},
        pt: {},
        exam: {},
      };
    }

    bucket.scores[sid].ww = bucket.scores[sid].ww || {};

    bucket.scores[sid].pt = bucket.scores[sid].pt || {};

    bucket.scores[sid].exam = bucket.scores[sid].exam || {};
  });
}

function ensureBucket() {
  const key = bucketKey(TEACHER_SCOPE, quarter, subject);

  currentKey = key;

  if (!gradesStore[key]) {
    gradesStore[key] = createEmptyBucket();
  }

  const bucket = gradesStore[key];

  ensureBucketStructure(bucket);

  return bucket;
}

// ============================================================
// STATUS
// ============================================================

function setStatusSaved(isSaved) {
  const box = $("saveStatus");

  if (!box) {
    return;
  }

  if (isSaved) {
    box.textContent = "Saved";

    box.style.background = "rgba(25, 135, 84, 0.14)";

    box.style.color = "#0f5132";
  } else {
    box.textContent = "Not Saved";

    box.style.background = "rgba(255, 193, 7, 0.16)";

    box.style.color = "#7a5b00";
  }
}

function setDirty(value) {
  dirty = Boolean(value);

  setStatusSaved(!dirty);
}

// ============================================================
// HEADER
// ============================================================

function scopeLabel(scope) {
  const parts = [scope.className, scope.sectionName].filter(Boolean);

  return parts.length ? parts.join(" - ") : "No assigned class";
}

function renderHeader() {
  const scope = scopeLabel(TEACHER_SCOPE);

  const term = getSelectedTerm();

  if ($("grTitle")) {
    $("grTitle").textContent = "Grades";
  }

  if ($("tbRole")) {
    $("tbRole").textContent =
      TEACHER_SCOPE.className && TEACHER_SCOPE.sectionName
        ? `${scope} Teacher`
        : "Teacher";
  }

  if ($("grScopeLabel")) {
    $("grScopeLabel").textContent = `${scope} • ${
      getTermLabel(term) || "No Term"
    } • ${subject || "No Subject"}`;
  }
}

// ============================================================
// TERM SELECT
// ============================================================

function renderTermOptions() {
  const select = $("quarterSelect");

  if (!select) {
    return;
  }

  select.innerHTML = "";

  if (!SCHOOL_YEAR.terms.length) {
    const option = document.createElement("option");

    option.value = "";

    option.textContent = "No terms available";

    select.appendChild(option);

    quarter = "";

    return;
  }

  SCHOOL_YEAR.terms.forEach((term) => {
    const option = document.createElement("option");

    option.value = term.id;

    option.textContent = getTermLabel(term);

    select.appendChild(option);
  });

  select.value = quarter;
}

// ============================================================
// SUBJECT SELECT
// ============================================================

function renderSubjectOptions() {
  const select = $("subjectSelect");

  if (!select) {
    return;
  }

  select.innerHTML = "";

  if (!subjects.length) {
    const option = document.createElement("option");

    option.value = "";

    option.textContent = "No subjects available";

    select.appendChild(option);

    subject = "";

    return;
  }

  subjects.forEach((subjectName) => {
    const option = document.createElement("option");

    option.value = subjectName;

    option.textContent = subjectName;

    select.appendChild(option);
  });

  if (!subject || !subjects.includes(subject)) {
    subject = subjects[0];
  }

  select.value = subject;
}

// ============================================================
// ASSESSMENT HELPERS
// ============================================================

function assessmentPercentage(assessment, score) {
  if (!assessment) {
    return null;
  }

  return percentage(score, Number(assessment.points));
}

function getAssessmentById(bucket, group, assessmentId) {
  const assessments = bucket?.meta?.[group] || [];

  return assessments.find((assessment) => assessment.id === assessmentId);
}

function getGroupAverage(bucket, sid, group) {
  const pack = bucket?.scores?.[sid] || {
    ww: {},
    pt: {},
    exam: {},
  };

  const assessments = bucket?.meta?.[group] || [];

  const values = [];

  assessments.forEach((assessment) => {
    const score = pack[group]?.[assessment.id];

    if (typeof score !== "number") {
      return;
    }

    const percent = assessmentPercentage(assessment, score);

    if (typeof percent === "number") {
      values.push(percent);
    }
  });

  return average(values);
}

function getExamPercentage(bucket, sid) {
  const exams = bucket?.meta?.exam || [];

  if (!exams.length) {
    return null;
  }

  const exam = exams[0];

  const score = bucket?.scores?.[sid]?.exam?.[exam.id];

  if (typeof score !== "number") {
    return null;
  }

  return assessmentPercentage(exam, score);
}

// ============================================================
// FINAL GRADE
// ============================================================

function computeFinalForStudent(bucket, sid) {
  const wwAverage = getGroupAverage(bucket, sid, "ww");

  const ptAverage = getGroupAverage(bucket, sid, "pt");

  const examAverage = getExamPercentage(bucket, sid);

  /*
   * If absolutely nothing has been
   * entered, don't display a grade.
   */
  if (wwAverage == null && ptAverage == null && examAverage == null) {
    return null;
  }

  /*
   * Keep the existing BLIMS behavior:
   *
   * WW = 30%
   * PT = 50%
   * Exam = 20%
   *
   * Missing components contribute 0.
   */
  const ww = wwAverage ?? 0;

  const pt = ptAverage ?? 0;

  const exam = examAverage ?? 0;

  return roundOne(pt * 0.5 + ww * 0.3 + exam * 0.2);
}

function remark(final) {
  if (final == null) {
    return "—";
  }

  return final >= 75 ? "Passed" : "Failed";
}

// ============================================================
// EDITABILITY / LOCK
// ============================================================

function applyEditability() {
  const locked = isCurrentTermLocked();

  // ----------------------------------------------------------
  // Inputs
  // ----------------------------------------------------------

  document.querySelectorAll(".gr-input").forEach((input) => {
    input.disabled = locked;
  });

  // ----------------------------------------------------------
  // Delete buttons
  // ----------------------------------------------------------

  document.querySelectorAll(".gr-assessment-delete").forEach((button) => {
    button.disabled = locked;
  });

  // ----------------------------------------------------------
  // Add buttons
  // ----------------------------------------------------------

  const addButtons = [$("addWWBtn"), $("addPTBtn"), $("addExamBtn")];

  addButtons.forEach((button) => {
    if (button) {
      button.disabled = locked;
    }
  });

  // ----------------------------------------------------------
  // Save
  // ----------------------------------------------------------

  const saveButton = $("saveAllBtn");

  if (saveButton) {
    saveButton.disabled = locked;
  }

  // ----------------------------------------------------------
  // Status
  // ----------------------------------------------------------

  const status = $("saveStatus");

  if (status) {
    if (locked) {
      status.textContent = `${getTermLabel(getSelectedTerm())} is Locked`;

      status.style.background = "rgba(108, 117, 125, 0.14)";

      status.style.color = "#495057";
    } else if (!dirty) {
      setStatusSaved(true);
    }
  }
}

// ============================================================
// ASSESSMENT LIST
// ============================================================

function renderAssessmentList(bucket) {
  const container = $("assessmentList");

  if (!container) {
    return;
  }

  const ww = bucket.meta.ww || [];

  const pt = bucket.meta.pt || [];

  const exam = bucket.meta.exam || [];

  const total = ww.length + pt.length + exam.length;

  if (!total) {
    container.innerHTML = `
      <div class="gr-assessment-empty">
        No assessments added yet.
      </div>
    `;

    applyEditability();

    return;
  }

  const createGroup = (title, weight, group, assessments) => {
    if (!assessments.length) {
      return "";
    }

    return `
      <div class="gr-assessment-group">

        <div class="gr-assessment-group-title">

          <span>
            ${escapeHTML(title)}
          </span>

          <small>
            ${escapeHTML(weight)}
          </small>

        </div>


        <div class="gr-assessment-items">

          ${assessments
            .map(
              (assessment) => `
                <div
                  class="gr-assessment-item"
                  data-assessment-id="${escapeHTML(assessment.id)}"
                >

                  <div class="gr-assessment-info">

                    <div class="gr-assessment-name">
                      ${escapeHTML(assessment.name)}
                    </div>

                    <div class="gr-assessment-points">
                      ${Number(assessment.points)} points
                    </div>

                  </div>


                  <button
                    type="button"
                    class="gr-assessment-delete"
                    data-delete-assessment="${escapeHTML(assessment.id)}"
                    data-delete-group="${escapeHTML(group)}"
                    title="Remove assessment"
                  >
                    ×
                  </button>

                </div>
              `,
            )
            .join("")}

        </div>

      </div>
    `;
  };

  container.innerHTML = `
    ${createGroup("Written Works", "30%", "ww", ww)}

    ${createGroup("Performance / Recitation", "50%", "pt", pt)}

    ${createGroup("Exam", "20%", "exam", exam)}
  `;

  applyEditability();
}

// ============================================================
// TABLE HEADER
// ============================================================

function buildThead(meta) {
  const thead = $("gradesThead");

  if (!thead) {
    return;
  }

  const ww = meta.ww || [];

  const pt = meta.pt || [];

  const exam = meta.exam || [];

  const assessmentCount = ww.length + pt.length + exam.length;

  if (!assessmentCount) {
    thead.innerHTML = `
      <tr>

        <th style="width:70px">
          No.
        </th>

        <th style="min-width:240px">
          Student
        </th>

        <th style="width:140px">
          Final Grade
        </th>

        <th style="width:120px">
          Remarks
        </th>

      </tr>
    `;

    return;
  }

  thead.innerHTML = `
    <tr class="group">

      <th
        rowspan="2"
        style="width:70px"
      >
        No.
      </th>


      <th
        rowspan="2"
        style="min-width:240px"
      >
        Student
      </th>


      ${
        ww.length
          ? `
            <th
              colspan="${ww.length}"
              style="text-align:center"
            >
              Written Works (30%)
            </th>
          `
          : ""
      }


      ${
        pt.length
          ? `
            <th
              colspan="${pt.length}"
              style="text-align:center"
            >
              Performance / Recitation (50%)
            </th>
          `
          : ""
      }


      ${
        exam.length
          ? `
            <th
              colspan="${exam.length}"
              style="text-align:center"
            >
              Exam (20%)
            </th>
          `
          : ""
      }


      <th
        rowspan="2"
        style="width:140px"
      >
        Final Grade
      </th>


      <th
        rowspan="2"
        style="width:120px"
      >
        Remarks
      </th>

    </tr>


    <tr class="cols">

      ${renderAssessmentHeaders(ww)}

      ${renderAssessmentHeaders(pt)}

      ${renderAssessmentHeaders(exam)}

    </tr>
  `;
}

function renderAssessmentHeaders(assessments) {
  return assessments
    .map(
      (assessment) => `
        <th style="width:130px">

          <span class="gr-assessment-header-name">
            ${escapeHTML(assessment.name)}
          </span>

          <br>

          <small>
            ${Number(assessment.points)} pts
          </small>

        </th>
      `,
    )
    .join("");
}

// ============================================================
// TABLE BODY
// ============================================================

function renderBody(meta, bucket) {
  const tbody = $("gradesTbody");

  if (!tbody) {
    return;
  }

  tbody.innerHTML = "";

  if (!students.length) {
    tbody.innerHTML = `
      <tr>

        <td
          colspan="99"
          class="gr-empty"
        >
          No students found for
          ${escapeHTML(scopeLabel(TEACHER_SCOPE))}.
        </td>

      </tr>
    `;

    renderSummary(bucket);

    return;
  }

  const assessmentCount = meta.ww.length + meta.pt.length + meta.exam.length;

  students.forEach((student, index) => {
    renderStudentRow(tbody, student, index, meta, bucket, assessmentCount > 0);
  });

  renderSummary(bucket);

  applyEditability();
}

// ============================================================
// STUDENT ROW
// ============================================================

function renderStudentRow(tbody, student, index, meta, bucket, showInputs) {
  const sid = normalize(student.studentId);

  if (!bucket.scores[sid]) {
    bucket.scores[sid] = {
      ww: {},
      pt: {},
      exam: {},
    };
  }

  const pack = bucket.scores[sid];

  const final = computeFinalForStudent(bucket, sid);

  const tr = document.createElement("tr");

  tr.dataset.sid = sid;

  const assessmentInputs = showInputs
    ? `
        ${renderAssessmentInputs(meta.ww, pack.ww, sid, "ww")}

        ${renderAssessmentInputs(meta.pt, pack.pt, sid, "pt")}

        ${renderAssessmentInputs(meta.exam, pack.exam, sid, "exam")}
      `
    : "";

  tr.innerHTML = `
    <td>
      ${String(index + 1).padStart(2, "0")}
    </td>


    <td>

      <div class="gr-student">

        <img
          class="gr-ava"
          src="${student.photoDataUrl || "../../assets/images/bg.jpg"}"
          alt=""
        >


        <div>

          <div class="gr-name">
            ${escapeHTML(fullName(student) || "—")}
          </div>


          <div class="gr-id">
            ${escapeHTML(sid || "—")}
          </div>

        </div>

      </div>

    </td>


    ${assessmentInputs}


    <td
      class="gr-final"
      data-final="${escapeHTML(sid)}"
    >
      ${final == null ? "—" : `${final}%`}
    </td>


    <td
      class="gr-remark"
      data-remark="${escapeHTML(sid)}"
    >
      ${remark(final)}
    </td>
  `;

  tbody.appendChild(tr);
}

// ============================================================
// ASSESSMENT INPUTS
// ============================================================

function renderAssessmentInputs(assessments, scores, sid, group) {
  return assessments
    .map((assessment) => {
      const score = scores?.[assessment.id];

      const value = typeof score === "number" ? score : "";

      return `
          <td>

            <input
              class="gr-input"
              type="number"
              min="0"
              max="${Number(assessment.points)}"
              step="0.01"

              data-sid="${escapeHTML(sid)}"

              data-group="${escapeHTML(group)}"

              data-col="${escapeHTML(assessment.id)}"

              value="${value}"

              placeholder="—"

              title="Maximum: ${Number(assessment.points)}"
            >

          </td>
        `;
    })
    .join("");
}

// ============================================================
// SUMMARY
// ============================================================

function renderSummary(bucket) {
  const total = students.length;

  if ($("mTotal")) {
    $("mTotal").textContent = String(total);
  }

  const finals = students
    .map((student) =>
      computeFinalForStudent(bucket, normalize(student.studentId)),
    )
    .filter((value) => typeof value === "number");

  if (!finals.length) {
    if ($("mAvg")) {
      $("mAvg").textContent = "—";
    }

    if ($("mHigh")) {
      $("mHigh").textContent = "—";
    }

    if ($("mLow")) {
      $("mLow").textContent = "—";
    }

    return;
  }

  const avg = finals.reduce((sum, value) => sum + value, 0) / finals.length;

  const high = Math.max(...finals);

  const low = Math.min(...finals);

  if ($("mAvg")) {
    $("mAvg").textContent = `${roundOne(avg)}%`;
  }

  if ($("mHigh")) {
    $("mHigh").textContent = `${high}%`;
  }

  if ($("mLow")) {
    $("mLow").textContent = `${low}%`;
  }
}

// ============================================================
// COMPUTED CELLS
// ============================================================

function updateComputedCells(bucket, sid) {
  const final = computeFinalForStudent(bucket, sid);

  document.querySelectorAll("#gradesTbody tr").forEach((row) => {
    if (row.dataset.sid !== sid) {
      return;
    }

    const finalCell = row.querySelector(".gr-final");

    const remarkCell = row.querySelector(".gr-remark");

    if (finalCell) {
      finalCell.textContent = final == null ? "—" : `${final}%`;
    }

    if (remarkCell) {
      remarkCell.textContent = remark(final);
    }
  });
}

// ============================================================
// TABLE INPUT
// ============================================================

function onTableInput(event) {
  const element = event.target;

  if (!(element instanceof HTMLInputElement)) {
    return;
  }

  if (!element.classList.contains("gr-input")) {
    return;
  }

  /*
   * Extra frontend protection.
   *
   * Backend also enforces this.
   */
  if (isCurrentTermLocked()) {
    element.blur();

    return;
  }

  const sid = element.dataset.sid || "";

  const group = element.dataset.group || "";

  const assessmentId = element.dataset.col || "";

  if (!sid || !group || !assessmentId) {
    return;
  }

  const bucket = ensureBucket();

  const pack = bucket.scores[sid];

  const assessment = getAssessmentById(bucket, group, assessmentId);

  if (!assessment) {
    return;
  }

  const value = clampScore(element.value, assessment.points);

  if (value == null) {
    delete pack[group][assessmentId];

    element.value = "";
  } else {
    pack[group][assessmentId] = value;

    element.value = String(value);
  }

  bucket.updatedAt = Date.now();

  setDirty(true);

  updateComputedCells(bucket, sid);

  renderSummary(bucket);
}

// ============================================================
// ADD ASSESSMENT MODAL
// ============================================================

function openAssessmentModal(kind) {
  if (isCurrentTermLocked()) {
    alert("This term is locked and cannot be edited.");

    return;
  }

  const labels = {
    ww: {
      title: "Add Written Work",

      description:
        "Add a quiz, written activity, worksheet, or other written assessment.",

      placeholder: "e.g. Quiz 1",
    },

    pt: {
      title: "Add Performance",

      description:
        "Add a recitation, performance task, project, or other performance assessment.",

      placeholder: "e.g. Recitation 1",
    },

    exam: {
      title: "Add Exam",

      description: "Add the term examination.",

      placeholder: "e.g. Term 1 Exam",
    },
  };

  const config = labels[kind];

  if (!config) {
    return;
  }

  const bucket = ensureBucket();

  if (kind === "exam" && bucket.meta.exam.length) {
    alert("This term already has an exam.");

    return;
  }

  document.querySelector(".gr-modal-overlay")?.remove();

  const overlay = document.createElement("div");

  overlay.className = "gr-modal-overlay";

  overlay.innerHTML = `
    <div
      class="gr-modal"
      role="dialog"
      aria-modal="true"
    >

      <div class="gr-modal-header">

        <div>

          <div class="gr-modal-title">
            ${escapeHTML(config.title)}
          </div>

          <div class="gr-modal-description">
            ${escapeHTML(config.description)}
          </div>

        </div>


        <button
          type="button"
          class="gr-modal-close"
          id="grModalClose"
        >
          ×
        </button>

      </div>


      <form
        id="assessmentForm"
        novalidate
      >

        <div class="gr-form-group">

          <label
            for="assessmentName"
          >
            Assessment Name
          </label>


          <input
            id="assessmentName"
            type="text"
            placeholder="${escapeHTML(config.placeholder)}"
            maxlength="100"
            required
          >

        </div>


        <div class="gr-form-group">

          <label
            for="assessmentPoints"
          >
            Total Points
          </label>


          <input
            id="assessmentPoints"
            type="number"
            min="1"
            max="1000"
            step="1"
            placeholder="e.g. 20"
            required
          >

        </div>


        <div class="gr-modal-actions">

          <button
            type="button"
            class="gr-btn gr-btn-ghost"
            id="grModalCancel"
          >
            Cancel
          </button>


          <button
            type="submit"
            class="gr-btn gr-btn-primary"
          >
            Add Assessment
          </button>

        </div>

      </form>

    </div>
  `;

  document.body.appendChild(overlay);

  const closeModal = () => {
    overlay.remove();
  };

  $("grModalClose")?.addEventListener("click", closeModal);

  $("grModalCancel")?.addEventListener("click", closeModal);

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeModal();
    }
  });

  $("assessmentForm")?.addEventListener("submit", (event) => {
    event.preventDefault();

    const name = normalize($("assessmentName")?.value);

    const points = Number($("assessmentPoints")?.value);

    if (!name) {
      alert("Please enter an assessment name.");

      $("assessmentName")?.focus();

      return;
    }

    if (!Number.isFinite(points) || points <= 0) {
      alert("Please enter a valid total point value.");

      $("assessmentPoints")?.focus();

      return;
    }

    addAssessment(kind, name, points);

    closeModal();
  });

  $("assessmentName")?.focus();
}

// ============================================================
// ADD ASSESSMENT
// ============================================================

function addAssessment(kind, name, points) {
  if (isCurrentTermLocked()) {
    return;
  }

  const bucket = ensureBucket();

  if (!["ww", "pt", "exam"].includes(kind)) {
    return;
  }

  if (kind === "exam" && bucket.meta.exam.length) {
    alert("Only one exam is allowed per term and subject.");

    return;
  }

  /*
   * IMPORTANT:
   *
   * This ID is generated ONCE.
   *
   * It is then sent to MongoDB for
   * every student.
   *
   * This is what fixes the refresh bug.
   */
  const assessment = {
    id: makeId(kind === "ww" ? "WW" : kind === "pt" ? "PT" : "EXAM"),

    name: normalize(name),

    points: Number(points),
  };

  bucket.meta[kind].push(assessment);

  /*
   * Initialize score containers
   * immediately.
   *
   * This means the assessment
   * can be saved even if all
   * scores are blank.
   */
  students.forEach((student) => {
    const sid = normalize(student.studentId);

    if (!sid) {
      return;
    }

    if (!bucket.scores[sid]) {
      bucket.scores[sid] = {
        ww: {},
        pt: {},
        exam: {},
      };
    }

    bucket.scores[sid][kind] = bucket.scores[sid][kind] || {};

    bucket.scores[sid][kind][assessment.id] = null;
  });

  bucket.updatedAt = Date.now();

  setDirty(true);

  renderCurrentView();
}

// ============================================================
// DELETE ASSESSMENT
// ============================================================

function deleteAssessment(kind, assessmentId) {
  if (isCurrentTermLocked()) {
    return;
  }

  const bucket = ensureBucket();

  const assessments = bucket.meta[kind] || [];

  const assessment = assessments.find((item) => item.id === assessmentId);

  if (!assessment) {
    return;
  }

  const confirmed = confirm(
    `Remove "${assessment.name}"?\n\nAll scores for this assessment will also be removed.`,
  );

  if (!confirmed) {
    return;
  }

  bucket.meta[kind] = assessments.filter((item) => item.id !== assessmentId);

  Object.keys(bucket.scores || {}).forEach((sid) => {
    if (bucket.scores[sid]?.[kind]) {
      delete bucket.scores[sid][kind][assessmentId];
    }
  });

  bucket.updatedAt = Date.now();

  setDirty(true);

  renderCurrentView();
}

// ============================================================
// SAVE ALL GRADES
// ============================================================

async function saveAll() {
  if (isCurrentTermLocked()) {
    alert("This term is locked and cannot be edited.");

    return;
  }

  try {
    const bucket = ensureBucket();

    const saveButton = $("saveAllBtn");

    if (saveButton) {
      saveButton.disabled = true;

      saveButton.textContent = "Saving...";
    }

    /*
     * We save each student.
     *
     * Assessment definitions are included
     * even if that student's score is blank.
     */
    for (const student of students) {
      const sid = normalize(student.studentId);

      if (!sid) {
        continue;
      }

      const pack = bucket.scores[sid] || {
        ww: {},
        pt: {},
        exam: {},
      };

      // ------------------------------------------------------
      // Written Works
      // ------------------------------------------------------

      const writtenWorks = bucket.meta.ww.map((assessment) => {
        const score = pack.ww?.[assessment.id];

        return {
          /*
           * CRITICAL:
           * Persist our own assessment ID.
           */
          assessmentId: assessment.id,

          activity: assessment.name,

          score: typeof score === "number" ? score : null,

          total: Number(assessment.points),
        };
      });

      // ------------------------------------------------------
      // Performance Tasks
      // ------------------------------------------------------

      const performanceTasks = bucket.meta.pt.map((assessment) => {
        const score = pack.pt?.[assessment.id];

        return {
          /*
           * CRITICAL:
           * Persist our own assessment ID.
           */
          assessmentId: assessment.id,

          activity: assessment.name,

          score: typeof score === "number" ? score : null,

          total: Number(assessment.points),
        };
      });

      // ------------------------------------------------------
      // Term Assessment
      // ------------------------------------------------------

      let termAssessment = null;

      if (bucket.meta.exam.length) {
        const exam = bucket.meta.exam[0];

        const score = pack.exam?.[exam.id];

        termAssessment = {
          /*
           * CRITICAL:
           * Persist exam ID AND name.
           */
          assessmentId: exam.id,

          activity: exam.name,

          score: typeof score === "number" ? score : null,

          total:
            exam.points === null || exam.points === undefined
              ? null
              : Number(exam.points),
        };
      }

      // ------------------------------------------------------
      // Final Grade
      // ------------------------------------------------------

      const final = computeFinalForStudent(bucket, sid);

      /*
       * Do NOT skip a student just because
       * their scores are blank.
       *
       * If an assessment exists, the
       * assessment definition must persist.
       */
      const hasAssessments =
        writtenWorks.length > 0 ||
        performanceTasks.length > 0 ||
        termAssessment !== null;

      const hasScores =
        writtenWorks.some(
          (item) => item.score !== null && item.score !== undefined,
        ) ||
        performanceTasks.some(
          (item) => item.score !== null && item.score !== undefined,
        ) ||
        (termAssessment &&
          termAssessment.score !== null &&
          termAssessment.score !== undefined);

      if (!hasAssessments && !hasScores) {
        continue;
      }

      await apiFetch("/api/teacher/grades/save", {
        method: "POST",

        body: JSON.stringify({
          studentId: sid,

          subject: subject,

          termId: quarter,

          writtenWorks: writtenWorks,

          performanceTasks: performanceTasks,

          termAssessment: termAssessment,

          initialGrade: final,

          termGrade: final,
        }),
      });
    }

    /*
     * Reload directly from MongoDB.
     *
     * This is important because it verifies
     * the saved data can be reconstructed.
     */
    await loadSavedGrades();

    setDirty(false);

    renderCurrentView();

    setDirty(false);

    alert("Grades saved successfully.");
  } catch (error) {
    console.error("saveAll error:", error);

    setDirty(true);

    alert(error.message || "Failed to save grades.");
  } finally {
    applyEditability();

    const saveButton = $("saveAllBtn");

    if (saveButton) {
      saveButton.textContent = "💾 Save All Grades";
    }
  }
}

// ============================================================
// RENDER CURRENT VIEW
// ============================================================

function renderCurrentView() {
  const bucket = ensureBucket();

  renderHeader();

  renderAssessmentList(bucket);

  buildThead(bucket.meta);

  renderBody(bucket.meta, bucket);

  applyEditability();
}

// ============================================================
// EVENTS
// ============================================================

function bindEvents() {
  // ----------------------------------------------------------
  // Term
  // ----------------------------------------------------------

  $("quarterSelect")?.addEventListener("change", () => {
    /*
     * Do not silently destroy unsaved changes.
     */
    if (dirty) {
      const proceed = confirm("You have unsaved changes. Switch terms anyway?");

      if (!proceed) {
        $("quarterSelect").value = quarter;

        return;
      }
    }

    quarter = $("quarterSelect").value || "";

    setDirty(false);

    renderCurrentView();
  });

  // ----------------------------------------------------------
  // Subject
  // ----------------------------------------------------------

  $("subjectSelect")?.addEventListener("change", () => {
    if (dirty) {
      const proceed = confirm(
        "You have unsaved changes. Switch subjects anyway?",
      );

      if (!proceed) {
        $("subjectSelect").value = subject;

        return;
      }
    }

    subject = $("subjectSelect").value || "";

    setDirty(false);

    renderCurrentView();
  });

  // ----------------------------------------------------------
  // Grade inputs
  // ----------------------------------------------------------

  $("gradesTbody")?.addEventListener("input", onTableInput);

  // ----------------------------------------------------------
  // Add Written Work
  // ----------------------------------------------------------

  $("addWWBtn")?.addEventListener("click", () => openAssessmentModal("ww"));

  // ----------------------------------------------------------
  // Add Performance
  // ----------------------------------------------------------

  $("addPTBtn")?.addEventListener("click", () => openAssessmentModal("pt"));

  // ----------------------------------------------------------
  // Add Exam
  // ----------------------------------------------------------

  $("addExamBtn")?.addEventListener("click", () => openAssessmentModal("exam"));

  // ----------------------------------------------------------
  // Delete assessment
  // ----------------------------------------------------------

  $("assessmentList")?.addEventListener("click", (event) => {
    const button = event.target.closest("[data-delete-assessment]");

    if (!button) {
      return;
    }

    deleteAssessment(
      button.dataset.deleteGroup,

      button.dataset.deleteAssessment,
    );
  });

  // ----------------------------------------------------------
  // Save
  // ----------------------------------------------------------

  $("saveAllBtn")?.addEventListener("click", saveAll);
}

// ============================================================
// INITIALIZE
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadTeacherData();

    /*
     * IMPORTANT:
     *
     * We dynamically populate the existing
     * #quarterSelect from MongoDB terms.
     *
     * The hardcoded HTML options are replaced.
     */
    renderTermOptions();

    renderSubjectOptions();

    /*
     * Load existing grades BEFORE rendering.
     */
    await loadSavedGrades();

    renderCurrentView();

    setDirty(false);

    bindEvents();
  } catch (error) {
    console.error("Teacher grades initialization error:", error);

    alert(error.message || "Failed to load teacher grades data.");
  }
});
