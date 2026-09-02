// frontend/src/js/teacher/teacher-assessment.js
// Teacher Assessment
// Subjects + Subject Detail + Assignments + Create/Edit/Delete Assignment

(function () {
  const $ = (id) => document.getElementById(id);

  // =========================================================
  // API HELPER
  // =========================================================

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

  // =========================================================
  // STATE
  // =========================================================

  let API_SUBJECTS = [];

  let TEACHER_SCOPE = {
    className: "",
    sectionName: "",
  };

  let TEACHER_INFO = null;

  let ACTIVE_SCHOOL_YEAR = null;

  let CURRENT_SUBJECT = null;

  let ALL_ASSIGNMENTS = [];

  let FILTERED_ASSIGNMENTS = [];

  let EDITING_ASSIGNMENT_ID = null;

  // =========================================================
  // DOM
  // =========================================================

  const subjectCards = $("asSubjectCards");
  const subjectsEmpty = $("asSubjectsEmpty");
  const subjectSearch = $("asSubjectSearch");

  const subjectsView = $("asSubjectsView");
  const detailView = $("asDetailView");

  const backToSubjectsBtn = $("asBackToSubjectsBtn");

  // =========================================================
  // DETAIL
  // =========================================================

  const heroTitle = $("asHeroTitle");
  const heroSection = $("asHeroSection");
  const heroTeacher = $("asHeroTeacher");
  const heroAvatar = $("asHeroAvatar");

  // =========================================================
  // ASSIGNMENT AREA
  // =========================================================

  const activityStream = $("asActivityStream");
  const activityEmpty = $("asActivityEmpty");

  const statusFilter = $("asStatusFilter");
  const quarterFilter = $("asQuarterFilter");

  const overviewTotal = $("asOverviewTotal");
  const overviewPublished = $("asOverviewPublished");
  const overviewDrafts = $("asOverviewDrafts");
  const overviewDueWeek = $("asOverviewDueWeek");

  const upcomingText = $("asUpcomingText");
  const jumpLatestBtn = $("asJumpLatestBtn");

  // =========================================================
  // MODAL
  // =========================================================

  const createActivityBtn = $("asCreateActivityBtn");
  const activityModal = $("asActivityModal");

  const modalCloseBtn = $("asModalCloseBtn");

  const modalBackdrop =
    activityModal?.querySelector(".as-modal-backdrop");

  const activityTitleInput =
    $("asActivityTitleInput");

  const activityQuarterSelect =
    $("asActivityQuarterSelect");

  const activityPointsInput =
    $("asActivityPointsInput");

  const activityDueDateInput =
    $("asActivityDueDateInput");

  const activityDueTimeInput =
    $("asActivityDueTimeInput");

  const activityInstructionsInput =
    $("asActivityInstructionsInput");

  const saveDraftBtn =
    $("asSaveDraftBtn");

  const publishActivityBtn =
    $("asPublishActivityBtn");

  const modalTitle =
    $("asModalTitle");

  const modalSub =
    $("asModalSub");

  // =========================================================
  // HELPERS
  // =========================================================

  function safeStr(value) {
    return String(value ?? "");
  }

  function escapeHTML(str) {
    return safeStr(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getSubjectName(subject) {
    if (!subject) return "";

    if (typeof subject === "string") {
      return subject.trim();
    }

    return safeStr(
      subject.label ||
        subject.name ||
        subject.value ||
        ""
    ).trim();
  }

  function formatDate(dateString) {
    if (!dateString) return "—";

    const date = new Date(
      `${dateString}T00:00:00`
    );

    if (Number.isNaN(date.getTime())) {
      return dateString;
    }

    return date.toLocaleDateString(
      "en-US",
      {
        month: "short",
        day: "numeric",
        year: "numeric",
      }
    );
  }

  function formatTime(timeString) {
    if (!timeString) return "";

    const parts = timeString.split(":");

    if (parts.length < 2) {
      return timeString;
    }

    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);

    if (
      Number.isNaN(hours) ||
      Number.isNaN(minutes)
    ) {
      return timeString;
    }

    const date = new Date();

    date.setHours(hours);
    date.setMinutes(minutes);
    date.setSeconds(0);

    return date.toLocaleTimeString(
      "en-US",
      {
        hour: "numeric",
        minute: "2-digit",
      }
    );
  }

  function formatStatus(status) {
    if (!status) return "Unknown";

    return (
      status.charAt(0).toUpperCase() +
      status.slice(1)
    );
  }

  function getStatusClass(status) {
    switch (status) {
      case "published":
        return "published";

      case "draft":
        return "draft";

      case "archived":
        return "archived";

      default:
        return "";
    }
  }

  function isDueThisWeek(dateString) {
    if (!dateString) return false;

    const due = new Date(
      `${dateString}T00:00:00`
    );

    if (Number.isNaN(due.getTime())) {
      return false;
    }

    const now = new Date();

    const today = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    const end = new Date(today);

    end.setDate(
      end.getDate() + 7
    );

    return (
      due >= today &&
      due <= end
    );
  }

  // =========================================================
  // LOAD ASSESSMENT META
  // =========================================================

  async function loadAssessmentMeta() {
    try {
      console.log(
        "Loading teacher assessment meta..."
      );

      const res = await apiFetch(
        "/api/teacher/assessment/meta"
      );

      const data = res.data || {};

      TEACHER_INFO =
        data.teacher || null;

      TEACHER_SCOPE =
        data.scope || {
          className: "",
          sectionName: "",
        };

      ACTIVE_SCHOOL_YEAR =
        data.schoolYear || null;

      API_SUBJECTS =
        Array.isArray(data.subjects)
          ? data.subjects
          : [];

      console.log(
        "Teacher:",
        TEACHER_INFO
      );

      console.log(
        "Scope:",
        TEACHER_SCOPE
      );

      console.log(
        "School Year:",
        ACTIVE_SCHOOL_YEAR
      );

      console.log(
        "Subjects:",
        API_SUBJECTS
      );

      renderSubjects();
    } catch (err) {
      console.error(
        "loadAssessmentMeta error:",
        err
      );

      API_SUBJECTS = [];

      showSubjectsEmpty(
        "Unable to load subjects.",
        "Please check your connection or try again."
      );
    }
  }

  // =========================================================
  // SUBJECTS
  // =========================================================

  function renderSubjects(searchTerm = "") {
    if (!subjectCards) return;

    const query = safeStr(searchTerm)
      .trim()
      .toLowerCase();

    const filteredSubjects =
      API_SUBJECTS.filter(
        (subject) => {
          const label =
            getSubjectName(
              subject
            ).toLowerCase();

          return (
            !query ||
            label.includes(query)
          );
        }
      );

    if (!filteredSubjects.length) {
      subjectCards.innerHTML = "";

      showSubjectsEmpty(
        "No subjects found.",
        query
          ? `No subject matches "${searchTerm}".`
          : "No subjects have been assigned to you yet."
      );

      return;
    }

    hideSubjectsEmpty();

    subjectCards.innerHTML =
      filteredSubjects
        .map(
          (subject, index) => {
            const value =
              getSubjectName(
                subject
              );

            const label =
              getSubjectName(
                subject
              );

            const initial =
              label
                .charAt(0)
                .toUpperCase();

            return `
              <button
                type="button"
                class="as-subject-card reveal-item"
                data-subject-index="${index}"
              >

                <div class="as-subject-card-icon">
                  ${escapeHTML(initial)}
                </div>

                <div class="as-subject-card-content">

                  <div class="as-subject-card-title">
                    ${escapeHTML(label)}
                  </div>

                  <div class="as-subject-card-sub">
                    ${escapeHTML(
                      TEACHER_SCOPE.className ||
                        "Class"
                    )}

                    ${
                      TEACHER_SCOPE.sectionName
                        ? ` • ${escapeHTML(
                            TEACHER_SCOPE.sectionName
                          )}`
                        : ""
                    }
                  </div>

                </div>

                <div class="as-subject-card-arrow">
                  →
                </div>

              </button>
            `;
          }
        )
        .join("");

    wireSubjectCards(
      filteredSubjects
    );
  }

  function showSubjectsEmpty(
    title,
    text
  ) {
    if (!subjectsEmpty) return;

    const titleEl =
      subjectsEmpty.querySelector(
        ".as-empty-title"
      );

    const textEl =
      subjectsEmpty.querySelector(
        ".as-empty-text"
      );

    if (titleEl) {
      titleEl.textContent = title;
    }

    if (textEl) {
      textEl.textContent = text;
    }

    subjectsEmpty.hidden = false;

    subjectsEmpty.classList.remove(
      "hidden"
    );

    subjectsEmpty.setAttribute(
      "aria-hidden",
      "false"
    );
  }

  function hideSubjectsEmpty() {
    if (!subjectsEmpty) return;

    subjectsEmpty.hidden = true;

    subjectsEmpty.classList.add(
      "hidden"
    );

    subjectsEmpty.setAttribute(
      "aria-hidden",
      "true"
    );
  }

  function wireSubjectCards(
    subjects
  ) {
    if (!subjectCards) return;

    const cards =
      subjectCards.querySelectorAll(
        ".as-subject-card"
      );

    cards.forEach(
      (card) => {
        card.addEventListener(
          "click",
          () => {
            const index =
              Number(
                card.dataset.subjectIndex
              );

            const subject =
              subjects[index];

            if (!subject) return;

            openSubject(
              subject
            );
          }
        );
      }
    );
  }

  // =========================================================
  // OPEN SUBJECT
  // =========================================================

  async function openSubject(
    subject
  ) {
    CURRENT_SUBJECT = subject;

    const subjectName =
      getSubjectName(
        subject
      ) || "Subject";

    console.log(
      "Opening subject:",
      subjectName
    );

    if (heroTitle) {
      heroTitle.textContent =
        subjectName;
    }

    if (heroSection) {
      const className =
        safeStr(
          TEACHER_SCOPE.className
        );

      const sectionName =
        safeStr(
          TEACHER_SCOPE.sectionName
        );

      if (
        className &&
        sectionName
      ) {
        heroSection.textContent =
          `${className} - ${sectionName}`;
      } else if (className) {
        heroSection.textContent =
          className;
      } else {
        heroSection.textContent =
          "No class assigned";
      }
    }

    if (heroTeacher) {
      const teacherName =
        TEACHER_INFO?.name ||
        TEACHER_INFO?.fullName ||
        TEACHER_INFO?.teacherName ||
        "Teacher";

      heroTeacher.textContent =
        teacherName;
    }

    if (heroAvatar) {
      heroAvatar.textContent =
        subjectName
          .charAt(0)
          .toUpperCase();
    }

    showDetailView();

    await loadAssignments();
  }

  // =========================================================
  // LOAD ASSIGNMENTS
  // =========================================================

  async function loadAssignments() {
    if (!CURRENT_SUBJECT) return;

    const subjectName =
      getSubjectName(
        CURRENT_SUBJECT
      );

    try {
      console.log(
        "Loading assignments for:",
        subjectName
      );

      const query =
        new URLSearchParams();

      query.set(
        "subject",
        subjectName
      );

      const status =
        statusFilter?.value;

      const quarter =
        quarterFilter?.value;

      if (
        status &&
        status !== "all"
      ) {
        query.set(
          "status",
          status
        );
      }

      if (
        quarter &&
        quarter !== "all"
      ) {
        query.set(
          "quarter",
          quarter
        );
      }

      const res =
        await apiFetch(
          `/api/teacher/assessment/assignments?${query.toString()}`
        );

      ALL_ASSIGNMENTS =
        Array.isArray(
          res.data
        )
          ? res.data
          : [];

      FILTERED_ASSIGNMENTS =
        ALL_ASSIGNMENTS;

      console.log(
        "Assignments:",
        ALL_ASSIGNMENTS
      );

      renderAssignments();

      updateOverview();

      updateUpcoming();
    } catch (err) {
      console.error(
        "loadAssignments error:",
        err
      );

      ALL_ASSIGNMENTS = [];

      FILTERED_ASSIGNMENTS = [];

      renderAssignmentsError(
        err.message
      );
    }
  }

  // =========================================================
  // RENDER ASSIGNMENTS
  // =========================================================

  function renderAssignments() {
    if (!activityStream) return;

    if (
      !FILTERED_ASSIGNMENTS.length
    ) {
      activityStream.innerHTML = "";

      showAssignmentEmpty();

      return;
    }

    hideAssignmentEmpty();

    activityStream.innerHTML =
      FILTERED_ASSIGNMENTS
        .map(
          (assignment) =>
            renderAssignmentRow(
              assignment
            )
        )
        .join("");

    wireAssignmentActions();
  }

  // =========================================================
  // ASSIGNMENT ROW
  // =========================================================

  function renderAssignmentRow(
    assignment
  ) {
    const id =
      safeStr(
        assignment._id
      );

    const title =
      safeStr(
        assignment.title
      ) || "Untitled Assignment";

    const quarter =
      safeStr(
        assignment.quarter
      ) || "—";

    const dueDate =
      formatDate(
        assignment.dueDate
      );

    const dueTime =
      formatTime(
        assignment.dueTime
      );

    const points =
      assignment.totalPoints ??
      "—";

    const status =
      safeStr(
        assignment.status
      );

    const statusLabel =
      formatStatus(
        status
      );

    const statusClass =
      getStatusClass(
        status
      );

    const instructions =
      safeStr(
        assignment.instructions
      );

    return `
      <tr
        class="as-assignment-row"
        data-assignment-id="${escapeHTML(id)}"
      >

        <!-- Assignment -->

        <td class="as-assignment-main-cell">

          <div class="as-assignment-main">

            <div class="as-assignment-title">
              ${escapeHTML(title)}
            </div>

            ${
              instructions
                ? `
                  <div class="as-assignment-description">
                    ${escapeHTML(
                      instructions
                    )}
                  </div>
                `
                : ""
            }

          </div>

        </td>


        <!-- Quarter -->

        <td class="as-assignment-quarter-cell">

          <span class="as-quarter-badge">
            ${escapeHTML(
              quarter
            )}
          </span>

        </td>


        <!-- Due Date -->

        <td class="as-assignment-due-cell">

          <div class="as-due-date">
            ${escapeHTML(
              dueDate
            )}
          </div>

          ${
            dueTime
              ? `
                <div class="as-due-time">
                  ${escapeHTML(
                    dueTime
                  )}
                </div>
              `
              : ""
          }

        </td>


        <!-- Points -->

        <td class="as-assignment-points-cell">

          <strong>
            ${escapeHTML(
              points
            )}
          </strong>

        </td>


        <!-- Status -->

        <td class="as-assignment-status-cell">

          <span
            class="as-status-badge ${escapeHTML(
              statusClass
            )}"
          >
            ${escapeHTML(
              statusLabel
            )}
          </span>

        </td>


        <!-- Actions -->

        <td class="as-assignment-actions-cell">

          <div class="as-assignment-actions">

            <button
              type="button"
              class="as-action-btn as-edit-assignment"
              data-id="${escapeHTML(id)}"
              title="Edit assignment"
            >
              Edit
            </button>

            <button
              type="button"
              class="as-action-btn as-delete-assignment"
              data-id="${escapeHTML(id)}"
              title="Delete assignment"
            >
              Delete
            </button>

          </div>

        </td>

      </tr>
    `;
  }

  // =========================================================
  // EMPTY ASSIGNMENTS
  // =========================================================

  function showAssignmentEmpty() {
    if (!activityEmpty) return;

    activityEmpty.hidden = false;

    activityEmpty.classList.remove(
      "hidden"
    );

    activityEmpty.setAttribute(
      "aria-hidden",
      "false"
    );
  }

  function hideAssignmentEmpty() {
    if (!activityEmpty) return;

    activityEmpty.hidden = true;

    activityEmpty.classList.add(
      "hidden"
    );

    activityEmpty.setAttribute(
      "aria-hidden",
      "true"
    );
  }

  function renderAssignmentsError(
    message
  ) {
    if (!activityStream) return;

    hideAssignmentEmpty();

    activityStream.innerHTML = `
      <tr>
        <td
          colspan="6"
          class="as-table-message"
        >
          Unable to load assignments.
          ${
            message
              ? `<div>${escapeHTML(
                  message
                )}</div>`
              : ""
          }
        </td>
      </tr>
    `;
  }

  // =========================================================
  // OVERVIEW
  // =========================================================

  function updateOverview() {
    const total =
      ALL_ASSIGNMENTS.length;

    const published =
      ALL_ASSIGNMENTS.filter(
        (item) =>
          item.status ===
          "published"
      ).length;

    const drafts =
      ALL_ASSIGNMENTS.filter(
        (item) =>
          item.status ===
          "draft"
      ).length;

    const dueThisWeek =
      ALL_ASSIGNMENTS.filter(
        (item) =>
          isDueThisWeek(
            item.dueDate
          )
      ).length;

    if (overviewTotal) {
      overviewTotal.textContent =
        total;
    }

    if (overviewPublished) {
      overviewPublished.textContent =
        published;
    }

    if (overviewDrafts) {
      overviewDrafts.textContent =
        drafts;
    }

    if (overviewDueWeek) {
      overviewDueWeek.textContent =
        dueThisWeek;
    }
  }

  // =========================================================
  // UPCOMING
  // =========================================================

  function updateUpcoming() {
    if (!upcomingText) return;

    const upcoming =
      [...ALL_ASSIGNMENTS]
        .filter(
          (item) =>
            item.dueDate &&
            item.status !==
              "archived"
        )
        .sort(
          (a, b) => {
            const dateA =
              new Date(
                `${a.dueDate}T${
                  a.dueTime ||
                  "23:59"
                }`
              );

            const dateB =
              new Date(
                `${b.dueDate}T${
                  b.dueTime ||
                  "23:59"
                }`
              );

            return (
              dateA - dateB
            );
          }
        )[0];

    if (!upcoming) {
      upcomingText.textContent =
        "No upcoming assignments yet.";

      return;
    }

    const date =
      formatDate(
        upcoming.dueDate
      );

    const time =
      formatTime(
        upcoming.dueTime
      );

    upcomingText.textContent =
      `${upcoming.title} — Due ${date}${
        time
          ? ` at ${time}`
          : ""
      }`;
  }

  // =========================================================
  // ASSIGNMENT ACTIONS
  // =========================================================

  function wireAssignmentActions() {
    if (!activityStream) return;

    const editButtons =
      activityStream.querySelectorAll(
        ".as-edit-assignment"
      );

    editButtons.forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            const id =
              button.dataset.id;

            editAssignment(
              id
            );
          }
        );
      }
    );

    const deleteButtons =
      activityStream.querySelectorAll(
        ".as-delete-assignment"
      );

    deleteButtons.forEach(
      (button) => {
        button.addEventListener(
          "click",
          () => {
            const id =
              button.dataset.id;

            deleteAssignment(
              id
            );
          }
        );
      }
    );
  }

  // =========================================================
  // CREATE / EDIT MODAL
  // =========================================================

  function openActivityModal(
    assignment = null
  ) {
    if (!activityModal) {
      console.error(
        "Assignment modal not found."
      );

      return;
    }

    EDITING_ASSIGNMENT_ID =
      assignment
        ? assignment._id
        : null;

    resetActivityForm();

    if (assignment) {
      if (modalTitle) {
        modalTitle.textContent =
          "Edit Assignment";
      }

      if (modalSub) {
        modalSub.textContent =
          "Update the assignment details.";
      }

      if (activityTitleInput) {
        activityTitleInput.value =
          assignment.title ||
          "";
      }

      if (activityQuarterSelect) {
        activityQuarterSelect.value =
          assignment.quarter ||
          "Q1";
      }

      if (activityPointsInput) {
        activityPointsInput.value =
          assignment.totalPoints ??
          "";
      }

      if (activityDueDateInput) {
        activityDueDateInput.value =
          assignment.dueDate ||
          "";
      }

      if (activityDueTimeInput) {
        activityDueTimeInput.value =
          assignment.dueTime ||
          "";
      }

      if (
        activityInstructionsInput
      ) {
        activityInstructionsInput.value =
          assignment.instructions ||
          "";
      }

      if (saveDraftBtn) {
        saveDraftBtn.textContent =
          "Save Changes";
      }

      if (
        publishActivityBtn
      ) {
        publishActivityBtn.textContent =
          assignment.status ===
          "published"
            ? "Update Assignment"
            : "Publish Assignment";
      }
    } else {
      if (modalTitle) {
        modalTitle.textContent =
          "Create Assignment";
      }

      if (modalSub) {
        modalSub.textContent =
          "Create an assignment for the selected subject.";
      }

      if (saveDraftBtn) {
        saveDraftBtn.textContent =
          "Save as Draft";
      }

      if (
        publishActivityBtn
      ) {
        publishActivityBtn.textContent =
          "Publish Assignment";
      }
    }

    activityModal.classList.remove(
      "hidden"
    );

    activityModal.removeAttribute(
      "hidden"
    );

    activityModal.setAttribute(
      "aria-hidden",
      "false"
    );

    setTimeout(
      () => {
        activityTitleInput?.focus();
      },
      50
    );
  }

  function closeActivityModal() {
    if (!activityModal) return;

    activityModal.classList.add(
      "hidden"
    );

    activityModal.setAttribute(
      "hidden",
      ""
    );

    activityModal.setAttribute(
      "aria-hidden",
      "true"
    );

    EDITING_ASSIGNMENT_ID =
      null;
  }

  function resetActivityForm() {
    if (activityTitleInput) {
      activityTitleInput.value =
        "";
    }

    if (activityQuarterSelect) {
      activityQuarterSelect.value =
        "Q1";
    }

    if (activityPointsInput) {
      activityPointsInput.value =
        "";
    }

    if (activityDueDateInput) {
      activityDueDateInput.value =
        "";
    }

    if (activityDueTimeInput) {
      activityDueTimeInput.value =
        "";
    }

    if (
      activityInstructionsInput
    ) {
      activityInstructionsInput.value =
        "";
    }
  }

  // =========================================================
  // FORM DATA
  // =========================================================

  function getActivityFormData() {
    const title =
      safeStr(
        activityTitleInput?.value
      ).trim();

    const quarter =
      safeStr(
        activityQuarterSelect?.value
      ).trim();

    const points =
      Number(
        activityPointsInput?.value
      );

    const dueDate =
      safeStr(
        activityDueDateInput?.value
      ).trim();

    const dueTime =
      safeStr(
        activityDueTimeInput?.value
      ).trim();

    const instructions =
      safeStr(
        activityInstructionsInput
          ?.value
      ).trim();

    const subject =
      getSubjectName(
        CURRENT_SUBJECT
      );

    if (!subject) {
      alert(
        "No subject selected."
      );

      return null;
    }

    if (!title) {
      alert(
        "Please enter an assignment title."
      );

      activityTitleInput?.focus();

      return null;
    }

    if (
      !["Q1", "Q2", "Q3", "Q4"].includes(
        quarter
      )
    ) {
      alert(
        "Please select a valid quarter."
      );

      activityQuarterSelect?.focus();

      return null;
    }

    if (
      !Number.isFinite(points) ||
      points < 1 ||
      points > 1000
    ) {
      alert(
        "Please enter valid total points between 1 and 1000."
      );

      activityPointsInput?.focus();

      return null;
    }

    if (!dueDate) {
      alert(
        "Please select a due date."
      );

      activityDueDateInput?.focus();

      return null;
    }

    return {
      subject,
      title,
      quarter,
      totalPoints: points,
      dueDate,
      dueTime,
      instructions,
    };
  }

  // =========================================================
  // SAVE DRAFT
  // =========================================================

  async function saveDraft() {
    const formData =
      getActivityFormData();

    if (!formData) return;

    try {
      setModalButtonsLoading(
        true
      );

      if (
        EDITING_ASSIGNMENT_ID
      ) {
        const res =
          await apiFetch(
            `/api/teacher/assessment/assignments/${EDITING_ASSIGNMENT_ID}`,
            {
              method: "PUT",
              body: JSON.stringify({
                ...formData,
                status: "draft",
              }),
            }
          );

        alert(
          res.message ||
            "Assignment updated successfully."
        );
      } else {
        const res =
          await apiFetch(
            "/api/teacher/assessment/assignments",
            {
              method: "POST",
              body: JSON.stringify({
                ...formData,
                status: "draft",
              }),
            }
          );

        alert(
          res.message ||
            "Assignment saved as draft."
        );
      }

      closeActivityModal();

      await loadAssignments();
    } catch (err) {
      console.error(
        "saveDraft error:",
        err
      );

      alert(
        err.message ||
          "Failed to save assignment."
      );
    } finally {
      setModalButtonsLoading(
        false
      );
    }
  }

  // =========================================================
  // PUBLISH
  // =========================================================

  async function publishAssignment() {
    const formData =
      getActivityFormData();

    if (!formData) return;

    try {
      setModalButtonsLoading(
        true
      );

      if (
        EDITING_ASSIGNMENT_ID
      ) {
        const res =
          await apiFetch(
            `/api/teacher/assessment/assignments/${EDITING_ASSIGNMENT_ID}`,
            {
              method: "PUT",
              body: JSON.stringify({
                ...formData,
                status: "published",
              }),
            }
          );

        alert(
          res.message ||
            "Assignment updated successfully."
        );
      } else {
        const res =
          await apiFetch(
            "/api/teacher/assessment/assignments",
            {
              method: "POST",
              body: JSON.stringify({
                ...formData,
                status: "published",
              }),
            }
          );

        alert(
          res.message ||
            "Assignment published successfully."
        );
      }

      closeActivityModal();

      await loadAssignments();
    } catch (err) {
      console.error(
        "publishAssignment error:",
        err
      );

      alert(
        err.message ||
          "Failed to publish assignment."
      );
    } finally {
      setModalButtonsLoading(
        false
      );
    }
  }

  // =========================================================
  // EDIT
  // =========================================================

  function editAssignment(id) {
    const assignment =
      ALL_ASSIGNMENTS.find(
        (item) =>
          String(
            item._id
          ) === String(id)
      );

    if (!assignment) {
      alert(
        "Assignment not found."
      );

      return;
    }

    openActivityModal(
      assignment
    );
  }

  // =========================================================
  // DELETE
  // =========================================================

  async function deleteAssignment(
    id
  ) {
    const assignment =
      ALL_ASSIGNMENTS.find(
        (item) =>
          String(
            item._id
          ) === String(id)
      );

    if (!assignment) {
      alert(
        "Assignment not found."
      );

      return;
    }

    const confirmed =
      confirm(
        `Delete "${assignment.title}"? This action cannot be undone.`
      );

    if (!confirmed) return;

    try {
      const res =
        await apiFetch(
          `/api/teacher/assessment/assignments/${id}`,
          {
            method: "DELETE",
          }
        );

      alert(
        res.message ||
          "Assignment deleted successfully."
      );

      await loadAssignments();
    } catch (err) {
      console.error(
        "deleteAssignment error:",
        err
      );

      alert(
        err.message ||
          "Failed to delete assignment."
      );
    }
  }

  // =========================================================
  // BUTTON LOADING
  // =========================================================

  function setModalButtonsLoading(
    loading
  ) {
    if (saveDraftBtn) {
      saveDraftBtn.disabled =
        loading;
    }

    if (
      publishActivityBtn
    ) {
      publishActivityBtn.disabled =
        loading;
    }

    if (loading) {
      if (saveDraftBtn) {
        saveDraftBtn.textContent =
          "Saving...";
      }

      if (
        publishActivityBtn
      ) {
        publishActivityBtn.textContent =
          "Publishing...";
      }
    }
  }

  // =========================================================
  // VIEW SWITCHING
  // =========================================================

  function showSubjectsView() {
    if (
      !subjectsView ||
      !detailView
    ) {
      return;
    }

    subjectsView.classList.remove(
      "hidden"
    );

    subjectsView.hidden = false;

    subjectsView.setAttribute(
      "aria-hidden",
      "false"
    );

    detailView.classList.add(
      "hidden"
    );

    detailView.hidden = true;

    detailView.setAttribute(
      "aria-hidden",
      "true"
    );
  }

  function showDetailView() {
    if (
      !subjectsView ||
      !detailView
    ) {
      return;
    }

    subjectsView.classList.add(
      "hidden"
    );

    subjectsView.hidden = true;

    subjectsView.setAttribute(
      "aria-hidden",
      "true"
    );

    detailView.classList.remove(
      "hidden"
    );

    detailView.hidden = false;

    detailView.setAttribute(
      "aria-hidden",
      "false"
    );
  }

  // =========================================================
  // SEARCH
  // =========================================================

  function wireSearch() {
    if (!subjectSearch) return;

    subjectSearch.addEventListener(
      "input",
      () => {
        renderSubjects(
          subjectSearch.value
        );
      }
    );
  }

  // =========================================================
  // FILTERS
  // =========================================================

  function wireFilters() {
    statusFilter?.addEventListener(
      "change",
      () => {
        loadAssignments();
      }
    );

    quarterFilter?.addEventListener(
      "change",
      () => {
        loadAssignments();
      }
    );
  }

  // =========================================================
  // BACK BUTTON
  // =========================================================

  function wireBackButton() {
    if (!backToSubjectsBtn) return;

    backToSubjectsBtn.addEventListener(
      "click",
      () => {
        closeActivityModal();

        CURRENT_SUBJECT =
          null;

        ALL_ASSIGNMENTS = [];

        FILTERED_ASSIGNMENTS = [];

        showSubjectsView();
      }
    );
  }

  // =========================================================
  // LATEST ASSIGNMENT
  // =========================================================

  function wireJumpLatest() {
    jumpLatestBtn?.addEventListener(
      "click",
      () => {
        const latest =
          ALL_ASSIGNMENTS[0];

        if (!latest) return;

        const row =
          activityStream?.querySelector(
            `[data-assignment-id="${latest._id}"]`
          );

        row?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    );
  }

  // =========================================================
  // MODAL
  // =========================================================

  function wireActivityModal() {
    if (!activityModal) {
      console.warn(
        "Create Assignment modal not found."
      );

      return;
    }

    createActivityBtn?.addEventListener(
      "click",
      () => {
        openActivityModal();
      }
    );

    modalCloseBtn?.addEventListener(
      "click",
      () => {
        closeActivityModal();
      }
    );

    modalBackdrop?.addEventListener(
      "click",
      () => {
        closeActivityModal();
      }
    );

    saveDraftBtn?.addEventListener(
      "click",
      () => {
        saveDraft();
      }
    );

    publishActivityBtn?.addEventListener(
      "click",
      () => {
        publishAssignment();
      }
    );

    document.addEventListener(
      "keydown",
      (event) => {
        if (
          event.key === "Escape" &&
          activityModal &&
          !activityModal.hidden
        ) {
          closeActivityModal();
        }
      }
    );
  }

  // =========================================================
  // TOPBAR
  // =========================================================

  function wireTopbarMenu() {
    const btn =
      $("userMenuBtn");

    const menu =
      $("userMenu");

    if (!btn || !menu) return;

    btn.addEventListener(
      "click",
      (e) => {
        e.stopPropagation();

        menu.classList.toggle(
          "open"
        );
      }
    );

    document.addEventListener(
      "click",
      () => {
        menu.classList.remove(
          "open"
        );
      }
    );
  }

  // =========================================================
  // INIT
  // =========================================================

  async function init() {
    console.log(
      "Teacher Assessment initialized."
    );

    wireTopbarMenu();

    wireSearch();

    wireFilters();

    wireBackButton();

    wireJumpLatest();

    wireActivityModal();

    showSubjectsView();

    await loadAssessmentMeta();
  }

  init();
})();