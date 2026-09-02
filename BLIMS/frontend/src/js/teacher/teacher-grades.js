// frontend/src/js/teacher/teacher-grades.js
//
// BLIMS Teacher Grades
//
// Backend:
// GET  /api/teacher/grades/encoding
// POST /api/teacher/grades/save
//
// Data comes from MongoDB through the backend.
// No grade localStorage.
//

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
  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
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

function roundOne(value) {
  return Math.round(value * 10) / 10;
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
};

let students = [];
let subjects = [];

let gradesStore = {};

let quarter = "1";
let subject = "";

let dirty = false;
let currentKey = "";

// ============================================================
// GRADING HELPERS
// ============================================================

function clampScore(value, maxPoints) {
  if (value === "" || value == null) {
    return null;
  }

  const number = Number(value);
  const max = Number(maxPoints);

  if (!Number.isFinite(number)) {
    return null;
  }

  if (!Number.isFinite(max) || max <= 0) {
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
    (value) =>
      typeof value === "number" &&
      Number.isFinite(value)
  );

  if (!valid.length) {
    return null;
  }

  const total = valid.reduce(
    (sum, value) => sum + value,
    0
  );

  return roundOne(total / valid.length);
}

// ============================================================
// TEACHER DATA
// ============================================================

async function loadTeacherData() {
  const response = await apiFetch(
    "/api/teacher/grades/encoding"
  );

  const data = response.data || {};

  // ----------------------------------------------------------
  // Teacher scope
  // ----------------------------------------------------------

  TEACHER_SCOPE = {
    className: normalize(
      data.teacherScope?.className
    ),

    sectionName: normalize(
      data.teacherScope?.sectionName
    ),
  };

  // ----------------------------------------------------------
  // School year
  // ----------------------------------------------------------

  SCHOOL_YEAR = {
    id: normalize(
      data.schoolYear?.id
    ),

    name: normalize(
      data.schoolYear?.name
    ),
  };

  // ----------------------------------------------------------
  // Students
  // ----------------------------------------------------------

  students = Array.isArray(data.students)
    ? data.students
    : [];

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
            item?.label
          );
        })
        .filter(Boolean)
    : [];

  console.log(
    "Teacher scope:",
    TEACHER_SCOPE
  );

  console.log(
    "School year:",
    SCHOOL_YEAR
  );

  console.log(
    "Students:",
    students
  );

  console.log(
    "Subjects:",
    subjects
  );
}

// ============================================================
// GRADE STORAGE
// ============================================================

function bucketKey(
  scope,
  quarterValue,
  subjectValue
) {
  return [
    scope.className,
    scope.sectionName,
    quarterValue,
    subjectValue,
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

function ensureBucket() {
  const key = bucketKey(
    TEACHER_SCOPE,
    quarter,
    subject
  );

  currentKey = key;

  if (!gradesStore[key]) {
    gradesStore[key] =
      createEmptyBucket();
  }

  const bucket = gradesStore[key];

  bucket.meta = bucket.meta || {};

  bucket.meta.ww = Array.isArray(
    bucket.meta.ww
  )
    ? bucket.meta.ww
    : [];

  bucket.meta.pt = Array.isArray(
    bucket.meta.pt
  )
    ? bucket.meta.pt
    : [];

  bucket.meta.exam = Array.isArray(
    bucket.meta.exam
  )
    ? bucket.meta.exam
    : [];

  if (bucket.meta.exam.length > 1) {
    bucket.meta.exam =
      bucket.meta.exam.slice(0, 1);
  }

  bucket.scores =
    bucket.scores || {};

  students.forEach((student) => {
    const sid =
      student.studentId;

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

    bucket.scores[sid].ww =
      bucket.scores[sid].ww || {};

    bucket.scores[sid].pt =
      bucket.scores[sid].pt || {};

    bucket.scores[sid].exam =
      bucket.scores[sid].exam || {};
  });

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
    box.style.background =
      "rgba(25, 135, 84, 0.14)";
    box.style.color = "#0f5132";
  } else {
    box.textContent = "Not Saved";
    box.style.background =
      "rgba(255, 193, 7, 0.16)";
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
  const parts = [
    scope.className,
    scope.sectionName,
  ].filter(Boolean);

  return parts.length
    ? parts.join(" - ")
    : "No assigned class";
}

function renderHeader() {
  const scope =
    scopeLabel(TEACHER_SCOPE);

  if ($("grTitle")) {
    $("grTitle").textContent =
      "Grades";
  }

  if ($("tbRole")) {
    $("tbRole").textContent =
      TEACHER_SCOPE.className &&
      TEACHER_SCOPE.sectionName
        ? `${scope} Teacher`
        : "Teacher";
  }

  if ($("grScopeLabel")) {
    $("grScopeLabel").textContent =
      `${scope} • Quarter ${quarter} • ${
        subject || "No Subject"
      }`;
  }
}

// ============================================================
// SUBJECT SELECT
// ============================================================

function renderSubjectOptions() {
  const select =
    $("subjectSelect");

  if (!select) {
    return;
  }

  select.innerHTML = "";

  if (!subjects.length) {
    const option =
      document.createElement("option");

    option.value = "";
    option.textContent =
      "No subjects available";

    select.appendChild(option);

    subject = "";

    return;
  }

  subjects.forEach(
    (subjectName) => {
      const option =
        document.createElement("option");

      option.value =
        subjectName;

      option.textContent =
        subjectName;

      select.appendChild(option);
    }
  );

  subject =
    subjects[0];

  select.value =
    subject;
}

// ============================================================
// ASSESSMENT HELPERS
// ============================================================

function assessmentPercentage(
  assessment,
  score
) {
  if (!assessment) {
    return null;
  }

  return percentage(
    score,
    Number(assessment.points)
  );
}

function getAssessmentById(
  bucket,
  group,
  assessmentId
) {
  const assessments =
    bucket?.meta?.[group] || [];

  return assessments.find(
    (assessment) =>
      assessment.id ===
      assessmentId
  );
}

function getGroupAverage(
  bucket,
  sid,
  group
) {
  const pack =
    bucket?.scores?.[sid] || {
      ww: {},
      pt: {},
      exam: {},
    };

  const assessments =
    bucket?.meta?.[group] || [];

  const values = [];

  assessments.forEach(
    (assessment) => {
      const score =
        pack[group]?.[
          assessment.id
        ];

      if (
        typeof score !== "number"
      ) {
        return;
      }

      const percent =
        assessmentPercentage(
          assessment,
          score
        );

      if (
        typeof percent === "number"
      ) {
        values.push(percent);
      }
    }
  );

  return average(values);
}

function getExamPercentage(
  bucket,
  sid
) {
  const exams =
    bucket?.meta?.exam || [];

  if (!exams.length) {
    return null;
  }

  const exam = exams[0];

  const score =
    bucket?.scores?.[sid]
      ?.exam?.[exam.id];

  if (
    typeof score !== "number"
  ) {
    return null;
  }

  return assessmentPercentage(
    exam,
    score
  );
}

function computeFinalForStudent(
  bucket,
  sid
) {
  const wwAverage =
    getGroupAverage(
      bucket,
      sid,
      "ww"
    );

  const ptAverage =
    getGroupAverage(
      bucket,
      sid,
      "pt"
    );

  const examAverage =
    getExamPercentage(
      bucket,
      sid
    );

  if (
    wwAverage == null &&
    ptAverage == null &&
    examAverage == null
  ) {
    return null;
  }

  const ww =
    wwAverage ?? 0;

  const pt =
    ptAverage ?? 0;

  const exam =
    examAverage ?? 0;

  return roundOne(
    pt * 0.5 +
    ww * 0.3 +
    exam * 0.2
  );
}

function remark(final) {
  if (final == null) {
    return "—";
  }

  return final >= 75
    ? "Passed"
    : "Failed";
}

// ============================================================
// ASSESSMENT LIST
// ============================================================

function renderAssessmentList(
  bucket
) {
  const container =
    $("assessmentList");

  if (!container) {
    return;
  }

  const ww =
    bucket.meta.ww || [];

  const pt =
    bucket.meta.pt || [];

  const exam =
    bucket.meta.exam || [];

  const total =
    ww.length +
    pt.length +
    exam.length;

  if (!total) {
    container.innerHTML = `
      <div class="gr-assessment-empty">
        No assessments added yet.
      </div>
    `;

    return;
  }

  const createGroup = (
    title,
    weight,
    group,
    assessments
  ) => {
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
                  data-assessment-id="${escapeHTML(
                    assessment.id
                  )}"
                >

                  <div class="gr-assessment-info">

                    <div class="gr-assessment-name">
                      ${escapeHTML(
                        assessment.name
                      )}
                    </div>

                    <div class="gr-assessment-points">
                      ${Number(
                        assessment.points
                      )} points
                    </div>

                  </div>

                  <button
                    type="button"
                    class="gr-assessment-delete"
                    data-delete-assessment="${escapeHTML(
                      assessment.id
                    )}"
                    data-delete-group="${escapeHTML(
                      group
                    )}"
                    title="Remove assessment"
                  >
                    ×
                  </button>

                </div>
              `
            )
            .join("")}

        </div>
      </div>
    `;
  };

  container.innerHTML = `
    ${createGroup(
      "Written Works",
      "30%",
      "ww",
      ww
    )}

    ${createGroup(
      "Performance / Recitation",
      "50%",
      "pt",
      pt
    )}

    ${createGroup(
      "Exam",
      "20%",
      "exam",
      exam
    )}
  `;
}

// ============================================================
// TABLE HEADER
// ============================================================

function buildThead(meta) {
  const thead =
    $("gradesThead");

  if (!thead) {
    return;
  }

  const ww = meta.ww || [];
  const pt = meta.pt || [];
  const exam = meta.exam || [];

  const assessmentCount =
    ww.length +
    pt.length +
    exam.length;

  if (!assessmentCount) {
    thead.innerHTML = `
      <tr>
        <th style="width:70px">No.</th>

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

      <th rowspan="2" style="width:70px">
        No.
      </th>

      <th rowspan="2" style="min-width:240px">
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

      <th rowspan="2" style="width:140px">
        Final Grade
      </th>

      <th rowspan="2" style="width:120px">
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

function renderAssessmentHeaders(
  assessments
) {
  return assessments
    .map(
      (assessment) => `
        <th style="width:130px">

          <span class="gr-assessment-header-name">
            ${escapeHTML(
              assessment.name
            )}
          </span>

          <br>

          <small>
            ${Number(
              assessment.points
            )} pts
          </small>

        </th>
      `
    )
    .join("");
}

// ============================================================
// TABLE BODY
// ============================================================

function renderBody(
  meta,
  bucket
) {
  const tbody =
    $("gradesTbody");

  if (!tbody) {
    return;
  }

  tbody.innerHTML = "";

  if (!students.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="99" class="gr-empty">
          No students found for
          ${escapeHTML(
            scopeLabel(
              TEACHER_SCOPE
            )
          )}.
        </td>
      </tr>
    `;

    renderSummary(bucket);

    return;
  }

  const assessmentCount =
    meta.ww.length +
    meta.pt.length +
    meta.exam.length;

  students.forEach(
    (student, index) => {
      renderStudentRow(
        tbody,
        student,
        index,
        meta,
        bucket,
        assessmentCount > 0
      );
    }
  );

  renderSummary(bucket);
}

function renderStudentRow(
  tbody,
  student,
  index,
  meta,
  bucket,
  showInputs
) {
  const sid =
    student.studentId || "";

  if (!bucket.scores[sid]) {
    bucket.scores[sid] = {
      ww: {},
      pt: {},
      exam: {},
    };
  }

  const pack =
    bucket.scores[sid];

  const final =
    computeFinalForStudent(
      bucket,
      sid
    );

  const tr =
    document.createElement("tr");

  tr.dataset.sid = sid;

  const assessmentInputs =
    showInputs
      ? `
        ${renderAssessmentInputs(
          meta.ww,
          pack.ww,
          sid,
          "ww"
        )}

        ${renderAssessmentInputs(
          meta.pt,
          pack.pt,
          sid,
          "pt"
        )}

        ${renderAssessmentInputs(
          meta.exam,
          pack.exam,
          sid,
          "exam"
        )}
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
          src="${
            student.photoDataUrl ||
            "../../assets/images/bg.jpg"
          }"
          alt=""
        >

        <div>

          <div class="gr-name">
            ${escapeHTML(
              fullName(student) || "—"
            )}
          </div>

          <div class="gr-id">
            ${escapeHTML(
              sid || "—"
            )}
          </div>

        </div>

      </div>
    </td>

    ${assessmentInputs}

    <td
      class="gr-final"
      data-final="${escapeHTML(sid)}"
    >
      ${
        final == null
          ? "—"
          : `${final}%`
      }
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

function renderAssessmentInputs(
  assessments,
  scores,
  sid,
  group
) {
  return assessments
    .map((assessment) => {
      const value =
        typeof scores?.[
          assessment.id
        ] === "number"
          ? scores[assessment.id]
          : "";

      return `
        <td>

          <input
            class="gr-input"
            type="number"
            min="0"
            max="${Number(
              assessment.points
            )}"
            step="0.01"

            data-sid="${escapeHTML(sid)}"

            data-group="${escapeHTML(group)}"

            data-col="${escapeHTML(
              assessment.id
            )}"

            value="${value}"

            placeholder="—"

            title="Maximum: ${Number(
              assessment.points
            )}"
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
  const total =
    students.length;

  if ($("mTotal")) {
    $("mTotal").textContent =
      String(total);
  }

  const finals =
    students
      .map((student) =>
        computeFinalForStudent(
          bucket,
          student.studentId
        )
      )
      .filter(
        (value) =>
          typeof value === "number"
      );

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

  const avg =
    finals.reduce(
      (sum, value) =>
        sum + value,
      0
    ) / finals.length;

  const high =
    Math.max(...finals);

  const low =
    Math.min(...finals);

  if ($("mAvg")) {
    $("mAvg").textContent =
      `${roundOne(avg)}%`;
  }

  if ($("mHigh")) {
    $("mHigh").textContent =
      `${high}%`;
  }

  if ($("mLow")) {
    $("mLow").textContent =
      `${low}%`;
  }
}

// ============================================================
// COMPUTED CELLS
// ============================================================

function updateComputedCells(
  bucket,
  sid
) {
  const final =
    computeFinalForStudent(
      bucket,
      sid
    );

  document
    .querySelectorAll(
      "#gradesTbody tr"
    )
    .forEach((row) => {
      if (
        row.dataset.sid !== sid
      ) {
        return;
      }

      const finalCell =
        row.querySelector(
          ".gr-final"
        );

      const remarkCell =
        row.querySelector(
          ".gr-remark"
        );

      if (finalCell) {
        finalCell.textContent =
          final == null
            ? "—"
            : `${final}%`;
      }

      if (remarkCell) {
        remarkCell.textContent =
          remark(final);
      }
    });
}

// ============================================================
// TABLE INPUT
// ============================================================

function onTableInput(event) {
  const element =
    event.target;

  if (
    !(element instanceof HTMLInputElement)
  ) {
    return;
  }

  if (
    !element.classList.contains(
      "gr-input"
    )
  ) {
    return;
  }

  const sid =
    element.dataset.sid || "";

  const group =
    element.dataset.group || "";

  const assessmentId =
    element.dataset.col || "";

  if (
    !sid ||
    !group ||
    !assessmentId
  ) {
    return;
  }

  const bucket =
    ensureBucket();

  const pack =
    bucket.scores[sid];

  const assessment =
    getAssessmentById(
      bucket,
      group,
      assessmentId
    );

  if (!assessment) {
    return;
  }

  const value =
    clampScore(
      element.value,
      assessment.points
    );

  if (value == null) {
    delete pack[group][
      assessmentId
    ];

    element.value = "";
  } else {
    pack[group][
      assessmentId
    ] = value;

    element.value =
      String(value);
  }

  bucket.updatedAt =
    Date.now();

  setDirty(true);

  updateComputedCells(
    bucket,
    sid
  );

  renderSummary(bucket);
}

// ============================================================
// ADD ASSESSMENT MODAL
// ============================================================

function openAssessmentModal(kind) {
  const labels = {
    ww: {
      title: "Add Written Work",

      description:
        "Add a quiz, written activity, worksheet, or other written assessment.",

      placeholder:
        "e.g. Quiz 1",
    },

    pt: {
      title: "Add Performance",

      description:
        "Add a recitation, performance task, project, or other performance assessment.",

      placeholder:
        "e.g. Recitation 1",
    },

    exam: {
      title: "Add Exam",

      description:
        "Add the quarter examination.",

      placeholder:
        "e.g. Quarter 1 Exam",
    },
  };

  const config =
    labels[kind];

  if (!config) {
    return;
  }

  const bucket =
    ensureBucket();

  if (
    kind === "exam" &&
    bucket.meta.exam.length
  ) {
    alert(
      "This quarter already has an exam."
    );

    return;
  }

  document
    .querySelector(
      ".gr-modal-overlay"
    )
    ?.remove();

  const overlay =
    document.createElement("div");

  overlay.className =
    "gr-modal-overlay";

  overlay.innerHTML = `
    <div
      class="gr-modal"
      role="dialog"
      aria-modal="true"
    >

      <div class="gr-modal-header">

        <div>

          <div class="gr-modal-title">
            ${escapeHTML(
              config.title
            )}
          </div>

          <div class="gr-modal-description">
            ${escapeHTML(
              config.description
            )}
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

      <form id="assessmentForm" novalidate>

        <div class="gr-form-group">

          <label for="assessmentName">
            Assessment Name
          </label>

          <input
            id="assessmentName"
            type="text"
            placeholder="${escapeHTML(
              config.placeholder
            )}"
            maxlength="100"
            required
          >

        </div>

        <div class="gr-form-group">

          <label for="assessmentPoints">
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

  document.body.appendChild(
    overlay
  );

  const closeModal = () => {
    overlay.remove();
  };

  $("grModalClose")
    ?.addEventListener(
      "click",
      closeModal
    );

  $("grModalCancel")
    ?.addEventListener(
      "click",
      closeModal
    );

  overlay.addEventListener(
    "click",
    (event) => {
      if (
        event.target === overlay
      ) {
        closeModal();
      }
    }
  );

  $("assessmentForm")
    ?.addEventListener(
      "submit",
      (event) => {
        event.preventDefault();

        const name =
          normalize(
            $("assessmentName")?.value
          );

        const points =
          Number(
            $("assessmentPoints")?.value
          );

        if (!name) {
          alert(
            "Please enter an assessment name."
          );

          $("assessmentName")?.focus();

          return;
        }

        if (
          !Number.isFinite(points) ||
          points <= 0
        ) {
          alert(
            "Please enter a valid total point value."
          );

          $("assessmentPoints")?.focus();

          return;
        }

        addAssessment(
          kind,
          name,
          points
        );

        closeModal();
      }
    );

  $("assessmentName")?.focus();
}

// ============================================================
// ADD ASSESSMENT
// ============================================================

function addAssessment(
  kind,
  name,
  points
) {
  const bucket =
    ensureBucket();

  if (
    !["ww", "pt", "exam"].includes(
      kind
    )
  ) {
    return;
  }

  if (
    kind === "exam" &&
    bucket.meta.exam.length
  ) {
    alert(
      "Only one exam is allowed per quarter and subject."
    );

    return;
  }

  bucket.meta[kind].push({
    id: makeId(
      kind === "ww"
        ? "WW"
        : kind === "pt"
        ? "PT"
        : "EXAM"
    ),

    name: normalize(name),

    points: Number(points),
  });

  bucket.updatedAt =
    Date.now();

  setDirty(true);

  renderCurrentView();
}

// ============================================================
// DELETE ASSESSMENT
// ============================================================

function deleteAssessment(
  kind,
  assessmentId
) {
  const bucket =
    ensureBucket();

  const assessments =
    bucket.meta[kind] || [];

  const assessment =
    assessments.find(
      (item) =>
        item.id ===
        assessmentId
    );

  if (!assessment) {
    return;
  }

  const confirmed =
    confirm(
      `Remove "${assessment.name}"?\n\nAll scores for this assessment will also be removed.`
    );

  if (!confirmed) {
    return;
  }

  bucket.meta[kind] =
    assessments.filter(
      (item) =>
        item.id !==
        assessmentId
    );

  Object.keys(
    bucket.scores || {}
  ).forEach((sid) => {
    if (
      bucket.scores[sid]?.[kind]
    ) {
      delete bucket.scores[sid][
        kind
      ][assessmentId];
    }
  });

  bucket.updatedAt =
    Date.now();

  setDirty(true);

  renderCurrentView();
}

// ============================================================
// SAVE ALL GRADES
// ============================================================

async function saveAll() {
  try {
    const bucket =
      ensureBucket();

    const payloadStudents =
      students.map((student) => {
        const sid =
          student.studentId;

        const pack =
          bucket.scores[sid] || {
            ww: {},
            pt: {},
            exam: {},
          };

        const writtenWorks =
          bucket.meta.ww.map(
            (assessment) => {
              const score =
                pack.ww[
                  assessment.id
                ];

              return {
                activity:
                  assessment.name,

                score:
                  typeof score ===
                  "number"
                    ? score
                    : 0,

                total:
                  Number(
                    assessment.points
                  ),
              };
            }
          );

        const performanceTasks =
          bucket.meta.pt.map(
            (assessment) => {
              const score =
                pack.pt[
                  assessment.id
                ];

              return {
                activity:
                  assessment.name,

                score:
                  typeof score ===
                  "number"
                    ? score
                    : 0,

                total:
                  Number(
                    assessment.points
                  ),
              };
            }
          );

        let quarterlyAssessment = {
          score: null,
          total: null,
        };

        if (bucket.meta.exam.length) {
          const exam =
            bucket.meta.exam[0];

          const score =
            pack.exam[
              exam.id
            ];

          quarterlyAssessment = {
            score:
              typeof score ===
              "number"
                ? score
                : null,

            total:
              Number(
                exam.points
              ),
          };
        }

        const final =
          computeFinalForStudent(
            bucket,
            sid
          );

        return {
          studentId: sid,

          subject,

          quarter,

          writtenWorks,

          performanceTasks,

          quarterlyAssessment,

          initialGrade:
            final,

          quarterlyGrade:
            final,
        };
      });

    for (
      const grade of payloadStudents
    ) {
      const hasData =
        grade.writtenWorks.length ||
        grade.performanceTasks.length ||
        grade.quarterlyAssessment
          .score !== null;

      if (!hasData) {
        continue;
      }

      await apiFetch(
        "/api/teacher/grades/save",
        {
          method: "POST",

          body: JSON.stringify(
            grade
          ),
        }
      );
    }

    setDirty(false);

    alert(
      "Grades saved successfully."
    );

  } catch (error) {
    console.error(
      "saveAll error:",
      error
    );

    setDirty(true);

    alert(
      error.message ||
        "Failed to save grades."
    );
  }
}

// ============================================================
// RENDER CURRENT VIEW
// ============================================================

function renderCurrentView() {
  const bucket =
    ensureBucket();

  renderHeader();

  renderAssessmentList(
    bucket
  );

  buildThead(
    bucket.meta
  );

  renderBody(
    bucket.meta,
    bucket
  );
}

// ============================================================
// EVENTS
// ============================================================

function bindEvents() {
  // ----------------------------------------------------------
  // Quarter
  // ----------------------------------------------------------

  $("quarterSelect")
    ?.addEventListener(
      "change",
      () => {
        quarter =
          $("quarterSelect")
            .value || "1";

        renderCurrentView();

        setDirty(false);
      }
    );

  // ----------------------------------------------------------
  // Subject
  // ----------------------------------------------------------

  $("subjectSelect")
    ?.addEventListener(
      "change",
      () => {
        subject =
          $("subjectSelect")
            .value || "";

        renderCurrentView();

        setDirty(false);
      }
    );

  // ----------------------------------------------------------
  // Grade inputs
  // ----------------------------------------------------------

  $("gradesTbody")
    ?.addEventListener(
      "input",
      onTableInput
    );

  // ----------------------------------------------------------
  // Add Written Work
  // ----------------------------------------------------------

  $("addWWBtn")
    ?.addEventListener(
      "click",
      () =>
        openAssessmentModal(
          "ww"
        )
    );

  // ----------------------------------------------------------
  // Add Performance
  // ----------------------------------------------------------

  $("addPTBtn")
    ?.addEventListener(
      "click",
      () =>
        openAssessmentModal(
          "pt"
        )
    );

  // ----------------------------------------------------------
  // Add Exam
  // ----------------------------------------------------------

  $("addExamBtn")
    ?.addEventListener(
      "click",
      () =>
        openAssessmentModal(
          "exam"
        )
    );

  // ----------------------------------------------------------
  // Delete assessment
  // ----------------------------------------------------------

  $("assessmentList")
    ?.addEventListener(
      "click",
      (event) => {
        const button =
          event.target.closest(
            "[data-delete-assessment]"
          );

        if (!button) {
          return;
        }

        deleteAssessment(
          button.dataset.deleteGroup,
          button.dataset.deleteAssessment
        );
      }
    );

  // ----------------------------------------------------------
  // Save
  // ----------------------------------------------------------

  $("saveAllBtn")
    ?.addEventListener(
      "click",
      saveAll
    );
}

// ============================================================
// INITIALIZE
// ============================================================

document.addEventListener(
  "DOMContentLoaded",
  async () => {
    try {
      await loadTeacherData();

      quarter = "1";

      const quarterSelect =
        $("quarterSelect");

      if (quarterSelect) {
        quarterSelect.value =
          quarter;
      }

      renderSubjectOptions();

      renderCurrentView();

      setDirty(false);

      bindEvents();

    } catch (error) {
      console.error(
        "Teacher grades initialization error:",
        error
      );

      alert(
        error.message ||
          "Failed to load teacher grades data."
      );
    }
  }
);