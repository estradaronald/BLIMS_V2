// ============================================================
// BLIMS TEACHER PROMOTION
//
// Purpose:
// - End-of-school-year learner promotion recommendations
// - Faculty sees ONLY their assigned class
// - No class dropdown
// - Faculty recommends:
//      Promote
//      Retain
//      Transfer
// - Admin reviews and approves final promotion
//
// Backend:
// GET  /api/teacher/promotion
// POST /api/teacher/promotion/submit
//
// IMPORTANT:
// - Faculty assignment comes from backend/session.
// - Faculty cannot select another class.
// - Once the final term is LOCKED, promotion submission is
//   no longer available.
// ============================================================


// ============================================================
// API
// ============================================================

const $ = (id) =>
  document.getElementById(id);


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
      data.message ||
      "Request failed"
    );

  }


  return data;
}


// ============================================================
// HELPERS
// ============================================================

function normalize(value) {

  return String(
    value ?? ""
  ).trim();

}


function escapeHTML(value) {

  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

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
    !Number.isFinite(
      Number(value)
    )
  ) {

    return null;

  }


  return (
    Math.round(
      Number(value) * 10
    ) / 10
  );

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


// Each learner:
//
// promotionStore[studentId] = {
//
//   recommendation: "promote"
//                      "retain"
//                      "transfer"
//                      ""
//
//   status: "pending"
//          "submitted"
//          "approved"
//          "rejected"
//
//   finalGrade: number|null
//
// }

let promotionStore = {};

let dirty = false;

let finalTerm = null;

let teacherNameFromBackend = "";


// ============================================================
// TEACHER DATA
// ============================================================

async function loadPromotionData() {

  const response =
    await apiFetch(
      "/api/teacher/promotion"
    );


  const data =
    response.data ||
    response;


  // ----------------------------------------------------------
  // Teacher Scope
  // ----------------------------------------------------------

  TEACHER_SCOPE = {

    className:
      normalize(
        data.teacherScope?.className
      ),

    sectionName:
      normalize(
        data.teacherScope?.sectionName
      ),

  };


  // ----------------------------------------------------------
  // Teacher Name
  // ----------------------------------------------------------

  teacherNameFromBackend =
    [
      data.teacher?.firstName,
      data.teacher?.middleName,
      data.teacher?.lastName,
    ]
      .filter(Boolean)
      .join(" ")
      .trim();


  // ----------------------------------------------------------
  // School Year
  // ----------------------------------------------------------

  SCHOOL_YEAR = {

    id:
      normalize(
        data.schoolYear?.id
      ),

    name:
      normalize(
        data.schoolYear?.name
      ),

    terms:
      Array.isArray(
        data.schoolYear?.terms
      )

        ? data.schoolYear.terms
            .map((term) => ({

              id:
                normalize(
                  term.id ||
                  term._id
                ),

              order:
                Number(
                  term.order
                ),

              name:
                normalize(
                  term.name
                ),

              start:
                term.start ||
                null,

              end:
                term.end ||
                null,

              locked:
                Boolean(
                  term.locked
                ),

            }))
            .sort(
              (a, b) =>
                a.order -
                b.order
            )

        : [],

  };


  // ----------------------------------------------------------
  // Students
  // ----------------------------------------------------------

  students =
    Array.isArray(
      data.students
    )

      ? data.students

      : [];


  // ----------------------------------------------------------
  // Existing Promotion Records
  // ----------------------------------------------------------

  const existingPromotions =
    Array.isArray(
      data.promotions
    )

      ? data.promotions

      : [];


  promotionStore = {};


  existingPromotions.forEach(
    (promotion) => {

      const studentId =
        normalize(
          promotion.studentId
        );


      if (!studentId) {
        return;
      }


      promotionStore[
        studentId
      ] = {

        recommendation:
          normalize(
            promotion.recommendation
          ).toLowerCase(),

        status:
          normalize(
            promotion.status
          ).toLowerCase() ||
          "pending",

        finalGrade:
          promotion.finalGrade !==
            null &&
          promotion.finalGrade !==
            undefined
            ? Number(
                promotion.finalGrade
              )
            : null,

      };

    }
  );


  // ----------------------------------------------------------
  // Find Final Term
  //
  // Highest term order = final term
  // ----------------------------------------------------------

  finalTerm =
    SCHOOL_YEAR.terms.length
      ? SCHOOL_YEAR.terms[
          SCHOOL_YEAR.terms.length - 1
        ]
      : null;


  // ----------------------------------------------------------
  // Initialize students
  // ----------------------------------------------------------

  students.forEach(
    (student) => {

      const sid =
        normalize(
          student.studentId
        );


      if (!sid) {
        return;
      }


      if (
        !promotionStore[sid]
      ) {

        promotionStore[sid] = {

          recommendation:
            "",

          status:
            "pending",

          finalGrade:
            getStudentFinalGrade(
              student
            ),

        };

      }

    }
  );


  console.log(
    "Teacher scope:",
    TEACHER_SCOPE
  );


  console.log(
    "Teacher:",
    teacherNameFromBackend
  );


  console.log(
    "School year:",
    SCHOOL_YEAR
  );


  console.log(
    "Final term:",
    finalTerm
  );


  console.log(
    "Students:",
    students
  );


  console.log(
    "Promotion records:",
    promotionStore
  );

}


// ============================================================
// SCOPE
// ============================================================

function scopeLabel() {

  const parts = [

    TEACHER_SCOPE.className,

    TEACHER_SCOPE.sectionName,

  ].filter(Boolean);


  return parts.length

    ? parts.join(" - ")

    : "No assigned class";

}


// ============================================================
// FINAL TERM
// ============================================================

function isFinalTermLocked() {

  return Boolean(
    finalTerm?.locked
  );

}


function finalTermLabel() {

  if (!finalTerm) {
    return "No final term";
  }


  return (
    normalize(
      finalTerm.name
    ) ||
    `Term ${finalTerm.order}`
  );

}


// ============================================================
// STUDENT FINAL GRADE
// ============================================================

function getStudentFinalGrade(
  student
) {

  if (!student) {
    return null;
  }


  // ----------------------------------------------------------
  // Backend should ideally provide finalGrade.
  // ----------------------------------------------------------

  if (
    student.finalGrade !==
      undefined &&
    student.finalGrade !==
      null &&
    Number.isFinite(
      Number(
        student.finalGrade
      )
    )
  ) {

    return roundOne(
      Number(
        student.finalGrade
      )
    );

  }


  // ----------------------------------------------------------
  // Support common backend naming.
  // ----------------------------------------------------------

  if (
    student.termGrade !==
      undefined &&
    student.termGrade !==
      null &&
    Number.isFinite(
      Number(
        student.termGrade
      )
    )
  ) {

    return roundOne(
      Number(
        student.termGrade
      )
    );

  }


  if (
    student.final !==
      undefined &&
    student.final !==
      null &&
    Number.isFinite(
      Number(
        student.final
      )
    )
  ) {

    return roundOne(
      Number(
        student.final
      )
    );

  }


  return null;

}


// ============================================================
// REMARK
// ============================================================

function gradeRemark(
  finalGrade
) {

  if (
    finalGrade === null ||
    finalGrade === undefined
  ) {

    return "—";

  }


  return Number(
    finalGrade
  ) >= 75

    ? "Passed"

    : "Failed";

}


// ============================================================
// RECOMMENDATION LABEL
// ============================================================

function recommendationLabel(
  recommendation
) {

  const value =
    normalize(
      recommendation
    ).toLowerCase();


  const labels = {

    promote:
      "Promote",

    retain:
      "Retain",

    transfer:
      "Transfer",

  };


  return (
    labels[value] ||
    "Pending"
  );

}


// ============================================================
// HEADER
// ============================================================

function renderHeader() {

  const scope =
    scopeLabel();


  if ($("tpTitle")) {

    $("tpTitle").textContent =
      "Promotion";

  }


  if ($("tbRole")) {

    $("tbRole").textContent =
      TEACHER_SCOPE.className &&
      TEACHER_SCOPE.sectionName

        ? `${scope} Teacher`

        : "Faculty";

  }


  if ($("tbName")) {

    const teacherName =
      normalize(
        teacherNameFromBackend
      );


    if (teacherName) {

      $("tbName").textContent =
        teacherName;

    }

  }


  if ($("schoolYearLabel")) {

    $("schoolYearLabel").textContent =
      SCHOOL_YEAR.name ||
      "No School Year";

  }


  if ($("assignedClassLabel")) {

    $("assignedClassLabel").textContent =
      scope;

  }


  if ($("finalTermLabel")) {

    $("finalTermLabel").textContent =
      finalTermLabel();

  }


  if ($("promotionScopeLabel")) {

    $("promotionScopeLabel").textContent =
      `${scope} • ${SCHOOL_YEAR.name || "No School Year"}`;

  }

}


// ============================================================
// FINAL TERM STATUS
// ============================================================

function renderFinalTermStatus() {

  const status =
    $("finalTermStatus");


  if (!status) {
    return;
  }


  status.className =
    "tp-status-badge";


  if (!finalTerm) {

    status.textContent =
      "No Final Term";

    status.classList.add(
      "danger"
    );

    return;

  }


  if (finalTerm.locked) {

    status.textContent =
      "Locked";

    status.classList.add(
      "success"
    );

    return;

  }


  status.textContent =
    "Not Locked";

  status.classList.add(
    "warning"
  );

}


// ============================================================
// PROMOTION AVAILABILITY
// ============================================================

function renderPromotionAvailability() {

  const warning =
    $("promotionWarning");


  const card =
    $("promotionCard");


  const warningText =
    $("promotionWarningText");


  const submitButton =
    $("submitPromotionBtn");


  if (!warning || !card) {
    return;
  }


  // ----------------------------------------------------------
  // NO FINAL TERM
  // ----------------------------------------------------------

  if (!finalTerm) {

    warning.hidden =
      false;

    card.classList.add(
      "tp-disabled-card"
    );


    if (warningText) {

      warningText.textContent =
        "No final term is configured for the current school year.";

    }


    if (submitButton) {

      submitButton.disabled =
        true;

      submitButton.textContent =
        "🔒 Promotion Unavailable";

    }


    return;

  }


  // ----------------------------------------------------------
  // FINAL TERM IS LOCKED
  //
  // Promotion submission is CLOSED.
  // ----------------------------------------------------------

  if (finalTerm.locked) {

    warning.hidden =
      false;

    card.classList.add(
      "tp-disabled-card"
    );


    if (warningText) {

      warningText.textContent =
        `${finalTermLabel()} is locked. Promotion recommendations can no longer be submitted.`;

    }


    if (submitButton) {

      submitButton.disabled =
        true;

      submitButton.textContent =
        "🔒 Promotion Locked";

    }


    return;

  }


  // ----------------------------------------------------------
  // FINAL TERM IS NOT LOCKED
  //
  // Faculty can submit recommendations.
  // ----------------------------------------------------------

  warning.hidden =
    true;

  card.classList.remove(
    "tp-disabled-card"
  );


  if (submitButton) {

    submitButton.disabled =
      false;

    submitButton.textContent =
      "Submit Promotion Recommendations";

  }

}


// ============================================================
// STATUS
// ============================================================

function setDirty(
  value
) {

  dirty =
    Boolean(
      value
    );


  const status =
    $("submissionStatus");


  if (!status) {
    return;
  }


  if (dirty) {

    status.textContent =
      "Unsaved changes";

    status.className =
      "tp-save-status warning";

  } else {

    status.textContent =
      "No changes made";

    status.className =
      "tp-save-status";

  }

}


// ============================================================
// TABLE
// ============================================================

function renderTable() {

  const tbody =
    $("promotionTbody");


  if (!tbody) {
    return;
  }


  tbody.innerHTML = "";


  if (!students.length) {

    tbody.innerHTML = `

      <tr>

        <td
          colspan="6"
          class="tp-empty"
        >
          No learners found for
          ${escapeHTML(
            scopeLabel()
          )}.
        </td>

      </tr>

    `;


    renderSummary();

    return;

  }


  students.forEach(
    (
      student,
      index
    ) => {

      renderStudentRow(
        tbody,
        student,
        index
      );

    }
  );


  renderSummary();

}


// ============================================================
// STUDENT ROW
// ============================================================

function renderStudentRow(
  tbody,
  student,
  index
) {

  const sid =
    normalize(
      student.studentId
    );


  if (!sid) {
    return;
  }


  const record =
    promotionStore[sid] ||
    {

      recommendation:
        "",

      status:
        "pending",

      finalGrade:
        getStudentFinalGrade(
          student
        ),

    };


  const finalGrade =
    record.finalGrade;


  const remarks =
    gradeRemark(
      finalGrade
    );


  const tr =
    document.createElement(
      "tr"
    );


  tr.dataset.sid =
    sid;


  // ----------------------------------------------------------
  // Submitted/approved records are permanently disabled.
  // Locked final term also disables recommendations.
  // ----------------------------------------------------------

  const submitted =
    [
      "submitted",
      "approved",
    ].includes(
      record.status
    );


  const locked =
    isFinalTermLocked();


  const disabled =
    submitted ||
    locked;


  tr.innerHTML = `

    <td class="tp-no">

      ${String(
        index + 1
      ).padStart(
        2,
        "0"
      )}

    </td>


    <td>

      <div class="tp-student">

        <img
          class="tp-avatar"
          src="${
            student.photoDataUrl ||
            "../../assets/images/bg.jpg"
          }"
          alt=""
        />


        <div>

          <div class="tp-student-name">

            ${escapeHTML(
              fullName(
                student
              ) || "—"
            )}

          </div>


          <div class="tp-student-id">

            ${escapeHTML(
              sid
            )}

          </div>

        </div>

      </div>

    </td>


    <td>

      <span class="tp-grade">

        ${
          finalGrade === null ||
          finalGrade === undefined

            ? "—"

            : `${finalGrade}`

        }

      </span>

    </td>


    <td>

      <span
        class="tp-remark ${
          remarks === "Passed"
            ? "passed"
            : remarks === "Failed"
              ? "failed"
              : ""
        }"
      >

        ${escapeHTML(
          remarks
        )}

      </span>

    </td>


    <td>

      <select
        class="tp-recommendation"
        data-sid="${escapeHTML(
          sid
        )}"
        ${disabled ? "disabled" : ""}
      >

        <option
          value=""
          ${
            !record.recommendation
              ? "selected"
              : ""
          }
        >
          Select recommendation
        </option>


        <option
          value="promote"
          ${
            record.recommendation ===
            "promote"
              ? "selected"
              : ""
          }
        >
          Promote
        </option>


        <option
          value="retain"
          ${
            record.recommendation ===
            "retain"
              ? "selected"
              : ""
          }
        >
          Retain
        </option>


        <option
          value="transfer"
          ${
            record.recommendation ===
            "transfer"
              ? "selected"
              : ""
          }
        >
          Transfer
        </option>

      </select>

    </td>


    <td>

      <span
        class="tp-row-status ${getStatusClass(
          record.status
        )}"
      >

        ${escapeHTML(
          getStatusLabel(
            record.status
          )
        )}

      </span>

    </td>

  `;


  tbody.appendChild(
    tr
  );

}


// ============================================================
// STATUS LABEL
// ============================================================

function getStatusLabel(
  status
) {

  switch (
    normalize(
      status
    ).toLowerCase()
  ) {

    case "submitted":
      return "Submitted";

    case "approved":
      return "Approved";

    case "rejected":
      return "Rejected";

    default:
      return "Pending";

  }

}


function getStatusClass(
  status
) {

  switch (
    normalize(
      status
    ).toLowerCase()
  ) {

    case "submitted":
      return "submitted";

    case "approved":
      return "approved";

    case "rejected":
      return "rejected";

    default:
      return "pending";

  }

}


// ============================================================
// SUMMARY
// ============================================================

function renderSummary() {

  let promote = 0;

  let retain = 0;

  let transfer = 0;

  let pending = 0;


  students.forEach(
    (student) => {

      const sid =
        normalize(
          student.studentId
        );


      const record =
        promotionStore[sid];


      const recommendation =
        normalize(
          record?.recommendation
        ).toLowerCase();


      switch (
        recommendation
      ) {

        case "promote":
          promote++;
          break;

        case "retain":
          retain++;
          break;

        case "transfer":
          transfer++;
          break;

        default:
          pending++;

      }

    }
  );


  if ($("summaryTotal")) {

    $("summaryTotal").textContent =
      students.length;

  }


  if ($("summaryPromote")) {

    $("summaryPromote").textContent =
      promote;

  }


  if ($("summaryRetain")) {

    $("summaryRetain").textContent =
      retain;

  }


  if ($("summaryTransfer")) {

    $("summaryTransfer").textContent =
      transfer;

  }


  if ($("summaryPending")) {

    $("summaryPending").textContent =
      pending;

  }

}


// ============================================================
// RECOMMENDATION CHANGE
// ============================================================

function onRecommendationChange(
  event
) {

  const select =
    event.target;


  if (
    !(select instanceof
      HTMLSelectElement)
  ) {

    return;

  }


  if (
    !select.classList.contains(
      "tp-recommendation"
    )
  ) {

    return;

  }


  const sid =
    normalize(
      select.dataset.sid
    );


  if (!sid) {
    return;
  }


  // ----------------------------------------------------------
  // Final term is locked.
  // ----------------------------------------------------------

  if (isFinalTermLocked()) {

    alert(
      "The final term is locked. Promotion recommendations can no longer be changed."
    );


    select.value =
      promotionStore[sid]
        ?.recommendation ||
        "";


    return;

  }


  const current =
    promotionStore[sid] ||
    {

      recommendation:
        "",

      status:
        "pending",

      finalGrade:
        getStudentFinalGrade(
          students.find(
            (student) =>
              normalize(
                student.studentId
              ) === sid
          )
        ),

    };


  // ----------------------------------------------------------
  // Do not allow changing an already submitted record.
  // ----------------------------------------------------------

  if (
    [
      "submitted",
      "approved",
    ].includes(
      current.status
    )
  ) {

    select.value =
      current.recommendation ||
      "";

    return;

  }


  current.recommendation =
    normalize(
      select.value
    ).toLowerCase();


  current.status =
    "pending";


  promotionStore[sid] =
    current;


  setDirty(
    true
  );


  renderSummary();

}


// ============================================================
// VALIDATION
// ============================================================

function validateRecommendations() {

  // ----------------------------------------------------------
  // FINAL TERM LOCK
  // ----------------------------------------------------------

  if (isFinalTermLocked()) {

    return {

      valid: false,

      message:
        "The final term is locked. Promotion recommendations can no longer be submitted.",

    };

  }


  // ----------------------------------------------------------
  // NO STUDENTS
  // ----------------------------------------------------------

  if (!students.length) {

    return {

      valid: false,

      message:
        "There are no learners to submit.",

    };

  }


  // ----------------------------------------------------------
  // CHECK MISSING RECOMMENDATIONS
  // ----------------------------------------------------------

  const missing = [];


  students.forEach(
    (student) => {

      const sid =
        normalize(
          student.studentId
        );


      const recommendation =
        normalize(
          promotionStore[sid]
            ?.recommendation
        );


      if (!recommendation) {

        missing.push(
          fullName(
            student
          ) || sid
        );

      }

    }
  );


  if (missing.length) {

    return {

      valid: false,

      message:
        `Please select a promotion recommendation for all learners.\n\nMissing:\n${missing
          .slice(0, 10)
          .join("\n")}${
          missing.length > 10
            ? "\n..."
            : ""
        }`,

    };

  }


  return {

    valid: true,

    message: "",

  };

}


// ============================================================
// SUBMIT
// ============================================================

async function submitPromotion() {

  const validation =
    validateRecommendations();


  if (
    !validation.valid
  ) {

    alert(
      validation.message
    );

    return;

  }


  const confirmed =
    confirm(
      "Submit all promotion recommendations?\n\nAfter submission, the recommendations will be sent to Admin for review."
    );


  if (!confirmed) {
    return;
  }


  const button =
    $("submitPromotionBtn");


  try {

    if (button) {

      button.disabled =
        true;

      button.textContent =
        "Submitting...";

    }


    const recommendations =
      students.map(
        (student) => {

          const sid =
            normalize(
              student.studentId
            );


          const record =
            promotionStore[sid];


          return {

            studentId:
              sid,

            recommendation:
              record.recommendation,

            finalGrade:
              record.finalGrade,

          };

        }
      );


    await apiFetch(
      "/api/teacher/promotion/submit",
      {

        method: "POST",

        body:
          JSON.stringify({

            schoolYearId:
              SCHOOL_YEAR.id,

            schoolYear:
              SCHOOL_YEAR.name,

            finalTermId:
              finalTerm?.id ||
              "",

            finalTerm:
              finalTermLabel(),

            teacherScope: {

              className:
                TEACHER_SCOPE.className,

              sectionName:
                TEACHER_SCOPE.sectionName,

            },

            recommendations,

          }),

      }
    );


    await loadPromotionData();


    setDirty(
      false
    );


    renderAll();


    alert(
      "Promotion recommendations submitted successfully. They are now pending Admin review."
    );


  } catch (error) {

    console.error(
      "submitPromotion error:",
      error
    );


    alert(
      error.message ||
      "Failed to submit promotion recommendations."
    );


  } finally {

    renderPromotionAvailability();


    const currentButton =
      $("submitPromotionBtn");


    if (currentButton) {

      // If term became locked while processing,
      // keep the locked state.
      if (isFinalTermLocked()) {

        currentButton.disabled =
          true;

        currentButton.textContent =
          "🔒 Promotion Locked";

      } else {

        currentButton.textContent =
          "Submit Promotion Recommendations";

      }

    }

  }

}


// ============================================================
// REFRESH
// ============================================================

async function refreshData() {

  if (dirty) {

    const proceed =
      confirm(
        "You have unsaved promotion recommendations. Refresh anyway?"
      );


    if (!proceed) {
      return;
    }

  }


  try {

    const button =
      $("refreshBtn");


    if (button) {

      button.disabled =
        true;

      button.textContent =
        "Refreshing...";

    }


    await loadPromotionData();


    setDirty(
      false
    );


    renderAll();


  } catch (error) {

    console.error(
      "refreshData error:",
      error
    );


    alert(
      error.message ||
      "Failed to refresh promotion data."
    );


  } finally {

    const button =
      $("refreshBtn");


    if (button) {

      button.disabled =
        false;

      button.textContent =
        "↻ Refresh";

    }

  }

}


// ============================================================
// RENDER
// ============================================================

function renderAll() {

  renderHeader();

  renderFinalTermStatus();

  renderPromotionAvailability();

  renderTable();

}


// ============================================================
// EVENTS
// ============================================================

function bindEvents() {

  // ----------------------------------------------------------
  // Recommendation
  // ----------------------------------------------------------

  $("promotionTbody")
    ?.addEventListener(
      "change",
      onRecommendationChange
    );


  // ----------------------------------------------------------
  // Submit
  // ----------------------------------------------------------

  $("submitPromotionBtn")
    ?.addEventListener(
      "click",
      submitPromotion
    );


  // ----------------------------------------------------------
  // Refresh
  // ----------------------------------------------------------

  $("refreshBtn")
    ?.addEventListener(
      "click",
      refreshData
    );

}


// ============================================================
// INITIALIZE
// ============================================================

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    try {

      await loadPromotionData();


      renderAll();


      setDirty(
        false
      );


      bindEvents();


    } catch (error) {

      console.error(
        "Teacher promotion initialization error:",
        error
      );


      const tbody =
        $("promotionTbody");


      if (tbody) {

        tbody.innerHTML = `

          <tr>

            <td
              colspan="6"
              class="tp-empty tp-error"
            >

              Failed to load promotion data.

              <br>

              ${escapeHTML(
                error.message ||
                "Unknown error"
              )}

            </td>

          </tr>

        `;

      }


      alert(
        error.message ||
        "Failed to load promotion data."
      );

    }

  }
);