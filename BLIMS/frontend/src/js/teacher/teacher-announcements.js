// frontend/src/js/teacher/teacher-announcements.js
//
// Teacher Announcements
//
// My Class:
//   - Teacher can create
//   - Teacher can edit
//   - Teacher can delete
//
// Admin:
//   - Read-only
//
// Teacher assignment:
//   GET /api/teacher/students/scope
//
// Backend:
//   GET    /api/teacher/announcements
//   GET    /api/teacher/announcements/:id
//   POST   /api/teacher/announcements
//   PUT    /api/teacher/announcements/:id
//   PATCH  /api/teacher/announcements/:id/archive
//   DELETE /api/teacher/announcements/:id
//
// IMPORTANT:
// Teacher announcements are ALWAYS posted to the
// teacher's assigned class + section.
//
// Example:
//
//   className: "Grade 6"
//   sectionName: "Rizal"
//   audience: "class"
//
// Displayed audience:
//
//   Grade 6 - Rizal
//
// Teacher announcements must NEVER use:
//
//   audience: "all"
//
// Publication:
//   - Publish Now
//   - Schedule for later
//   - Save as Draft
//
// School Events are treated like every other
// announcement category.
//
// No file attachments.
// No event-specific fields.
// No posting-scope selector.
// No schedule popup.
//
// Schedule date/time appear directly in the form.
//

// =========================================================
// API
// =========================================================

const API_BASE = "/api/teacher/announcements";

const SCOPE_API = "/api/teacher/students/scope";

const $ = (id) => document.getElementById(id);

// =========================================================
// STATE
// =========================================================

let tab = "my";

let announcements = [];

let editingId = null;

let CURRENT_TEACHER_NAME = "";

async function loadCurrentTeacherName() {
  try {
    const data = await apiRequest("/api/auth/me");
    const user = data?.user;

    if (!user) return;

    const name = [user.first_name, user.middle_name, user.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();

    if (name) {
      CURRENT_TEACHER_NAME = name;

      const nameElement = $("tbName");
      if (nameElement) {
        nameElement.textContent = name;
      }
    }
  } catch (error) {
    console.error("[teacher-announcements] Failed to load user name:", error);
  }
}

// =========================================================
// TEACHER SCOPE
// =========================================================
//
// Loaded from:
//
// GET /api/teacher/students/scope
//
// Example:
//
// {
//   ok: true,
//   data: {
//     className: "Grade 6",
//     sectionName: "Rizal"
//   }
// }
//
// The scope is used for:
//
// 1. Displaying the teacher's audience
// 2. Sending className + sectionName
//    to the backend
//
// The backend remains the final authority.
//

let TEACHER_SCOPE = {
  className: "",

  sectionName: "",
};

// =========================================================
// LOCAL USER
// =========================================================

function readUser() {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch (err) {
    console.error("[teacher-announcements] Failed to read local user:", err);

    return {};
  }
}

// =========================================================
// HELPERS
// =========================================================

function normalize(value) {
  return String(value ?? "").trim();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// =========================================================
// DATE HELPERS
// =========================================================

function parseDate(value) {
  if (!value) {
    return null;
  }

  const d = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(d.getTime())) {
    return null;
  }

  return d;
}

function formatDate(value) {
  const d = parseDate(value);

  if (!d) {
    return "—";
  }

  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateOnly(value) {
  const d = parseDate(value);

  if (!d) {
    return "";
  }

  const year = d.getFullYear();

  const month = String(d.getMonth() + 1).padStart(2, "0");

  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatTimeOnly(value) {
  const d = parseDate(value);

  if (!d) {
    return "";
  }

  const hours = String(d.getHours()).padStart(2, "0");

  const minutes = String(d.getMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
}

// =========================================================
// STATUS
// =========================================================

function getStatus(a) {
  if (a?.archived === true) {
    return "archived";
  }

  if (a?.draft === true) {
    return "draft";
  }

  if (a?.publishAt) {
    const publishTime = new Date(a.publishAt).getTime();

    if (!Number.isNaN(publishTime) && publishTime > Date.now()) {
      return "scheduled";
    }
  }

  return "published";
}

// =========================================================
// SOURCE / ROLE
// =========================================================

function getAnnouncementSource(a) {
  const source = normalize(a?.source).toLowerCase();

  const authorRole = normalize(a?.authorRole).toLowerCase();

  const createdByRole = normalize(a?.createdByRole).toLowerCase();

  const createdBy = a?.createdBy;

  const createdByRoleNested = normalize(createdBy?.role).toLowerCase();

  /*
    ADMIN
  */

  if (source === "admin" || source === "administrator") {
    return "admin";
  }

  if (authorRole === "admin" || authorRole === "administrator") {
    return "admin";
  }

  if (createdByRole === "admin" || createdByRole === "administrator") {
    return "admin";
  }

  if (
    createdByRoleNested === "admin" ||
    createdByRoleNested === "administrator"
  ) {
    return "admin";
  }

  /*
    Everything else shown
    in this teacher page is
    treated as teacher.
  */

  return "teacher";
}

function isAdminAnnouncement(a) {
  return getAnnouncementSource(a) === "admin";
}

function getSourceLabel(a) {
  return isAdminAnnouncement(a) ? "Admin" : "Teacher";
}

// =========================================================
// TEACHER ASSIGNMENT
// =========================================================

async function loadTeacherScope() {
  try {
    console.log("[teacher-announcements] Loading teacher scope...");

    const result = await apiRequest(SCOPE_API);

    const scope = result?.data || result?.scope || {};

    TEACHER_SCOPE = {
      className: normalize(
        scope.className || scope.class || scope.grade || scope.gradeLevel || "",
      ),

      sectionName: normalize(scope.sectionName || scope.section || ""),
    };

    console.log("[teacher-announcements] TEACHER_SCOPE:", TEACHER_SCOPE);
  } catch (err) {
    console.error("[teacher-announcements] Failed to load teacher scope:", err);

    TEACHER_SCOPE = {
      className: "",

      sectionName: "",
    };
  }
}

function hasTeacherScope() {
  return (
    !!normalize(TEACHER_SCOPE.className) &&
    !!normalize(TEACHER_SCOPE.sectionName)
  );
}

function scopeLabel() {
  if (hasTeacherScope()) {
    return `${TEACHER_SCOPE.className} - ` + `${TEACHER_SCOPE.sectionName}`;
  }

  return "(unassigned)";
}

// =========================================================
// AUDIENCE
// =========================================================
//
// IMPORTANT:
//
// Teacher audience is NOT taken from:
//
//   announcement.audience
//
// Instead, teacher audience is derived from:
//
//   className + sectionName
//
// This prevents an old/wrong "all" value from
// being displayed as the teacher's audience.
//

function getTeacherAudienceLabel() {
  return scopeLabel();
}

function getAnnouncementAudienceLabel(announcement) {
  /*
    ADMIN ANNOUNCEMENT
  */

  if (isAdminAnnouncement(announcement)) {
    /*
      Admin audience can use the actual
      audience value stored in the model.

      Admin may use:

        all
        students
        teachers
        class
    */

    const audience = normalize(announcement?.audience).toLowerCase();

    if (audience === "students") {
      return "Students";
    }

    if (audience === "teachers") {
      return "Teachers";
    }

    if (audience === "all") {
      return "School-wide";
    }

    if (
      audience === "class" &&
      announcement?.className &&
      announcement?.sectionName
    ) {
      return `${normalize(announcement.className)} - ${normalize(
        announcement.sectionName,
      )}`;
    }

    return "School-wide";
  }

  /*
    TEACHER ANNOUNCEMENT
  */

  const className = normalize(announcement?.className);

  const sectionName = normalize(announcement?.sectionName);

  /*
    Always prefer the class/section
    stored on the announcement.

    This is important when viewing
    an older announcement whose teacher
    assignment may have changed later.
  */

  if (className && sectionName) {
    return `${className} - ${sectionName}`;
  }

  /*
    Fallback to the currently
    loaded teacher assignment.
  */

  return getTeacherAudienceLabel();
}

// =========================================================
// TEACHER NAME
// =========================================================

function getTeacherName() {
  const u = readUser();

  return (
    CURRENT_TEACHER_NAME ||
    u.fullName ||
    [
      u.firstName || u.first_name,
      u.middleName || u.middle_name,
      u.lastName || u.last_name,
    ]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    u.username ||
    "Teacher"
  );
}

// =========================================================
// AUTHOR NAME
// =========================================================

function getAuthorName(a) {
  if (isAdminAnnouncement(a)) {
    return "Administrator";
  }

  const createdBy = a?.createdBy;

  return (
    createdBy?.fullName ||
    createdBy?.name ||
    a?.authorName ||
    a?.createdByName ||
    getTeacherName()
  );
}

// =========================================================
// API
// =========================================================

async function apiRequest(url, options = {}) {
  const config = {
    credentials: "include",

    ...options,

    headers: {
      "Content-Type": "application/json",

      ...(options.headers || {}),
    },
  };

  const response = await fetch(url, config);

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      data?.message || `Request failed with status ${response.status}.`,
    );
  }

  return data;
}

// =========================================================
// LOAD ANNOUNCEMENTS
// =========================================================

async function loadAnnouncements() {
  const feed = $("annFeed");

  const empty = $("annEmpty");

  if (feed) {
    feed.innerHTML = `

      <div class="ann-empty">

        <div class="ann-loading-spinner"></div>

        <p>
          Loading announcements...
        </p>

      </div>

    `;
  }

  try {
    const result = await apiRequest(API_BASE);

    if (Array.isArray(result)) {
      announcements = result;
    } else if (Array.isArray(result?.data)) {
      announcements = result.data;
    } else if (Array.isArray(result?.announcements)) {
      announcements = result.announcements;
    } else {
      announcements = [];
    }

    console.log("[teacher-announcements] loaded:", announcements);

    renderList();
  } catch (err) {
    console.error("[teacher-announcements] Failed to load:", err);

    announcements = [];

    if (feed) {
      feed.innerHTML = `

        <div class="ann-empty ann-error">

          <strong>
            Failed to load announcements.
          </strong>

          <small>
            ${escapeHtml(err.message)}
          </small>

        </div>

      `;
    }

    if (empty) {
      empty.classList.add("hidden");
    }
  }
}

// =========================================================
// FILTERS
// =========================================================

function getFilters() {
  return {
    search: normalize($("annSearch")?.value || "").toLowerCase(),

    status: $("statusFilter")?.value || "all",

    category: $("catFilter")?.value || "all",
  };
}

// =========================================================
// FILTER MATCHING
// =========================================================

function matchesFilters(announcement, filters) {
  const status = getStatus(announcement);

  if (filters.status !== "all" && status !== filters.status) {
    return false;
  }

  const category = announcement.category || "general";

  if (filters.category !== "all" && category !== filters.category) {
    return false;
  }

  if (filters.search) {
    const haystack = [
      announcement.title,

      announcement.message,

      announcement.category,

      announcement.className,

      announcement.sectionName,

      announcement.audience,

      getAnnouncementAudienceLabel(announcement),

      getAuthorName(announcement),

      getSourceLabel(announcement),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (!haystack.includes(filters.search)) {
      return false;
    }
  }

  return true;
}

// =========================================================
// TAB DATA
// =========================================================

function getVisibleAnnouncements() {
  const filters = getFilters();

  let rows = [...announcements];

  /*
    MY CLASS

    Only teacher announcements.
  */

  if (tab === "my") {
    rows = rows.filter((a) => !isAdminAnnouncement(a));
  }

  /*
    ADMIN

    Only admin announcements.
  */

  if (tab === "admin") {
    rows = rows.filter((a) => isAdminAnnouncement(a));
  }

  rows = rows.filter((a) => matchesFilters(a, filters));

  /*
    NEWEST FIRST
  */

  rows.sort((a, b) => {
    const aTime = new Date(
      a.updatedAt || a.createdAt || a.publishAt || 0,
    ).getTime();

    const bTime = new Date(
      b.updatedAt || b.createdAt || b.publishAt || 0,
    ).getTime();

    return bTime - aTime;
  });

  return rows;
}

// =========================================================
// CATEGORY LABEL
// =========================================================

function categoryLabel(category) {
  const labels = {
    general: "General",

    events: "School Event",

    academic: "Academic",

    priority: "Priority",
  };

  return labels[category] || "General";
}

// =========================================================
// STATUS LABEL
// =========================================================

function statusLabel(status) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// =========================================================
// BADGES
// =========================================================

function badgeHtml(a) {
  const status = getStatus(a);

  const category = a.category || "general";

  const source = getAnnouncementSource(a);

  return `

    <div class="ta-badges">

      <span class="ta-badge">

        ${escapeHtml(categoryLabel(category))}

      </span>


      <span
        class="ta-source-pill ${escapeHtml(source)}"
      >

        ${escapeHtml(source === "admin" ? "Admin" : "My Class")}

      </span>


      <span
        class="ta-status-pill ${escapeHtml(status)}"
      >

        ${escapeHtml(statusLabel(status))}

      </span>

    </div>

  `;
}

// =========================================================
// RENDER LIST
// =========================================================

function renderList() {
  const feed = $("annFeed");

  const empty = $("annEmpty");

  if (!feed || !empty) {
    return;
  }

  const rows = getVisibleAnnouncements();

  feed.innerHTML = "";

  if (rows.length === 0) {
    empty.classList.remove("hidden");

    empty.innerHTML = `

      <div class="ann-empty-icon">
        📢
      </div>


      <strong>

        ${tab === "admin" ? "No admin announcements" : "No class announcements"}

      </strong>


      <span>

        ${
          tab === "admin"
            ? "There are no announcements published by administrators."
            : `Create an announcement for ${escapeHtml(
                getTeacherAudienceLabel(),
              )}.`
        }

      </span>

    `;

    return;
  }

  empty.classList.add("hidden");

  rows.forEach((a) => {
    const author = getAuthorName(a);

    const id = a._id || a.id;

    const admin = isAdminAnnouncement(a);

    const status = getStatus(a);

    const audience = getAnnouncementAudienceLabel(a);

    const item = document.createElement("article");

    item.className = "ann-feed-item";

    item.innerHTML = `

        <div class="ta-item-top">

          <div class="ta-item-heading">

            <div class="ta-item-title">

              ${escapeHtml(a.title || "Untitled")}

            </div>


            ${badgeHtml(a)}

          </div>


          <div class="ta-actions">

            <button
              type="button"
              class="ta-btn-sm"
              data-action="view"
              data-id="${escapeHtml(id)}"
            >
              View
            </button>


            ${
              !admin
                ? `

                  <button
                    type="button"
                    class="ta-btn-sm"
                    data-action="edit"
                    data-id="${escapeHtml(id)}"
                  >
                    Edit
                  </button>


                  <button
                    type="button"
                    class="ta-btn-sm danger"
                    data-action="delete"
                    data-id="${escapeHtml(id)}"
                  >
                    Delete
                  </button>

                `
                : `

                  <span class="ta-readonly-label">
                    Read-only
                  </span>

                `
            }

          </div>

        </div>


        <div class="ta-item-body">

          ${escapeHtml(a.message || "")}

        </div>


        <div class="ta-item-foot">

          <div class="ta-author">

            <span>
              Posted by
            </span>


            <strong>
              ${escapeHtml(author)}
            </strong>

          </div>


          <div class="ta-date">

            <span>
              Audience:
            </span>


            <strong>
              ${escapeHtml(audience)}
            </strong>

          </div>

        </div>


        <div class="ta-item-foot">

          <div class="ta-author">

            <span>
              Source:
            </span>


            <strong>
              ${escapeHtml(admin ? "Administrator" : "Teacher")}
            </strong>

          </div>


          <div class="ta-date">

            <span>

              ${
                status === "scheduled"
                  ? "Scheduled:"
                  : status === "draft"
                    ? "Updated:"
                    : a.publishAt
                      ? "Published:"
                      : "Created:"
              }

            </span>


            ${escapeHtml(
              formatDate(
                status === "scheduled"
                  ? a.publishAt
                  : a.publishAt || a.updatedAt || a.createdAt,
              ),
            )}

          </div>

        </div>

      `;

    feed.appendChild(item);
  });
}

// =========================================================
// VIEW MODAL
// =========================================================

function openViewModal(id) {
  const announcement = announcements.find(
    (a) => String(a._id || a.id) === String(id),
  );

  if (!announcement) {
    return;
  }

  const modal = $("annViewModal");

  if (!modal) {
    return;
  }

  const status = getStatus(announcement);

  const category = announcement.category || "general";

  const admin = isAdminAnnouncement(announcement);

  const title = announcement.title || "Announcement";

  const audience = getAnnouncementAudienceLabel(announcement);

  if ($("annViewTitle")) {
    $("annViewTitle").textContent = title;
  }

  if ($("annViewMeta")) {
    $("annViewMeta").textContent = formatDate(
      status === "scheduled"
        ? announcement.publishAt
        : announcement.publishAt ||
            announcement.updatedAt ||
            announcement.createdAt,
    );
  }

  if ($("annViewH")) {
    $("annViewH").textContent = title;
  }

  if ($("annViewMsg")) {
    $("annViewMsg").textContent = announcement.message || "";
  }

  if ($("annViewSource")) {
    $("annViewSource").textContent = admin ? "Administrator" : "Teacher";
  }

  if ($("annViewPill")) {
    $("annViewPill").textContent = categoryLabel(category);
  }

  if ($("annViewStatus")) {
    $("annViewStatus").textContent = statusLabel(status);

    $("annViewStatus").className = `ta-status-pill ${status}`;
  }

  /*
    Audience.

    If the HTML contains:

      #annViewAudience

    populate it.
  */

  const viewAudience = $("annViewAudience");

  if (viewAudience) {
    viewAudience.textContent = audience;
  }

  /*
    Event information removed.
  */

  const eventInfo = $("annViewEventInfo");

  if (eventInfo) {
    eventInfo.style.display = "none";
  }

  /*
    Files removed.
  */

  const files = $("annViewFiles");

  if (files) {
    files.innerHTML = "";

    files.style.display = "none";
  }

  /*
    ACTIONS
  */

  const actions = $("annViewActions");

  if (actions) {
    actions.style.display = "";
  }

  /*
    EDIT
  */

  const editButton = $("annViewEditBtn");

  if (editButton) {
    editButton.style.display = admin ? "none" : "";

    editButton.onclick = () => {
      closeViewModal();

      openFormModal("edit", announcement);
    };
  }

  /*
    DELETE
  */

  const deleteButton = $("annViewDeleteBtn");

  if (deleteButton) {
    deleteButton.style.display = admin ? "none" : "";

    deleteButton.onclick = async () => {
      closeViewModal();

      await deleteAnnouncement(announcement._id || announcement.id);
    };
  }

  /*
    OPEN
  */

  modal.classList.remove("hidden");

  modal.setAttribute("aria-hidden", "false");

  document.body.style.overflow = "hidden";
}

function closeViewModal() {
  const modal = $("annViewModal");

  if (!modal) {
    return;
  }

  modal.classList.add("hidden");

  modal.setAttribute("aria-hidden", "true");

  document.body.style.overflow = "";
}

// =========================================================
// PUBLICATION VISIBILITY
// =========================================================

function updatePublicationFields(clearSchedule = true) {
  const scheduleRadio = $("publicationSchedule");

  const scheduleWrap = $("scheduleWrap");

  const scheduleDate = $("inpScheduleDate");

  const scheduleTime = $("inpScheduleTime");

  if (!scheduleRadio) {
    console.warn("[teacher-announcements] publicationSchedule not found");

    return;
  }

  const shouldShowSchedule = scheduleRadio.checked;

  if (scheduleWrap) {
    if (shouldShowSchedule) {
      scheduleWrap.hidden = false;

      scheduleWrap.style.display = "flex";

      scheduleWrap.classList.remove("hidden");

      scheduleWrap.classList.add("schedule-visible");

      scheduleWrap.setAttribute("aria-hidden", "false");
    } else {
      scheduleWrap.hidden = true;

      scheduleWrap.style.display = "none";

      scheduleWrap.classList.remove("schedule-visible");

      scheduleWrap.classList.add("hidden");

      scheduleWrap.setAttribute("aria-hidden", "true");
    }
  }

  if (scheduleDate) {
    scheduleDate.disabled = !shouldShowSchedule;

    scheduleDate.required = shouldShowSchedule;
  }

  if (scheduleTime) {
    scheduleTime.disabled = !shouldShowSchedule;

    scheduleTime.required = shouldShowSchedule;
  }

  if (!shouldShowSchedule && clearSchedule) {
    if (scheduleDate) {
      scheduleDate.value = "";
    }

    if (scheduleTime) {
      scheduleTime.value = "";
    }
  }

  console.log(
    "[teacher-announcements] publication mode:",
    shouldShowSchedule ? "schedule" : "now",
  );
}

// =========================================================
// GET PUBLICATION MODE
// =========================================================

function getPublicationMode() {
  const schedule = $("publicationSchedule");

  if (schedule?.checked) {
    return "schedule";
  }

  return "now";
}

// =========================================================
// CREATE / EDIT MODAL
// =========================================================

function openFormModal(mode, announcement = null) {
  /*
    Prevent editing admin announcements.
  */

  if (mode === "edit" && announcement && isAdminAnnouncement(announcement)) {
    alert("Admin announcements are read-only.");

    return;
  }

  /*
    Teacher assignment check.
  */

  if (!hasTeacherScope()) {
    alert("Teacher class/section assignment not found.");

    return;
  }

  const modal = $("annFormModal");

  if (!modal) {
    return;
  }

  editingId = mode === "edit" ? announcement?._id || announcement?.id : null;

  /*
    HEADER
  */

  if ($("annFormTitle")) {
    $("annFormTitle").textContent =
      mode === "edit" ? "Edit Announcement" : "New Announcement";
  }

  if ($("annFormSub")) {
    $("annFormSub").textContent =
      mode === "edit"
        ? `Update your announcement for ${scopeLabel()}.`
        : `Compose a message for ${scopeLabel()}.`;
  }

  /*
    BASIC FIELDS
  */

  if ($("inpTitle")) {
    $("inpTitle").value = announcement?.title || "";
  }

  if ($("inpCategory")) {
    $("inpCategory").value = announcement?.category || "general";
  }

  if ($("inpMessage")) {
    $("inpMessage").value = announcement?.message || "";
  }

  /*
    PUBLICATION
  */

  const status = mode === "edit" ? getStatus(announcement) : "published";

  const publishNow = $("publicationNow");

  const scheduleLater = $("publicationSchedule");

  const isScheduled = status === "scheduled";

  if (publishNow) {
    publishNow.checked = !isScheduled;
  }

  if (scheduleLater) {
    scheduleLater.checked = isScheduled;
  }

  /*
    SCHEDULE DATE
  */

  if ($("inpScheduleDate")) {
    $("inpScheduleDate").value = isScheduled
      ? formatDateOnly(announcement?.publishAt)
      : "";
  }

  /*
    SCHEDULE TIME
  */

  if ($("inpScheduleTime")) {
    $("inpScheduleTime").value = isScheduled
      ? formatTimeOnly(announcement?.publishAt)
      : "";
  }

  /*
    =======================================================
    AUDIENCE
    =======================================================

    READ-ONLY.

    Teacher cannot change the audience.

    The audience is always:

      current teacher assignment
  */

  if ($("inpAudienceLabel")) {
    $("inpAudienceLabel").value = getTeacherAudienceLabel();

    $("inpAudienceLabel").readOnly = true;

    $("inpAudienceLabel").disabled = false;
  }

  /*
    FORM HINT
  */

  if ($("formHint")) {
    $("formHint").textContent = "";
  }

  /*
    UPDATE PUBLICATION UI

    Do not clear existing schedule.
  */

  updatePublicationFields(false);

  /*
    SHOW MODAL
  */

  modal.classList.remove("hidden");

  modal.setAttribute("aria-hidden", "false");

  document.body.style.overflow = "hidden";
}

function closeFormModal() {
  const modal = $("annFormModal");

  if (!modal) {
    return;
  }

  modal.classList.add("hidden");

  modal.setAttribute("aria-hidden", "true");

  document.body.style.overflow = "";

  editingId = null;
}

// =========================================================
// VALIDATE SCHEDULE
// =========================================================

function validateSchedule() {
  const date = normalize($("inpScheduleDate")?.value);

  const time = normalize($("inpScheduleTime")?.value);

  const hint = $("formHint");

  if (!date) {
    if (hint) {
      hint.textContent = "Please select a schedule date.";
    }

    $("inpScheduleDate")?.focus();

    return null;
  }

  if (!time) {
    if (hint) {
      hint.textContent = "Please select a schedule time.";
    }

    $("inpScheduleTime")?.focus();

    return null;
  }

  const scheduledDate = new Date(`${date}T${time}`);

  if (Number.isNaN(scheduledDate.getTime())) {
    if (hint) {
      hint.textContent = "Please enter a valid schedule date and time.";
    }

    return null;
  }

  if (scheduledDate.getTime() <= Date.now()) {
    if (hint) {
      hint.textContent = "Schedule date and time must be in the future.";
    }

    return null;
  }

  return scheduledDate;
}

// =========================================================
// SAVE ANNOUNCEMENT
// =========================================================

async function saveAnnouncement(forceDraft) {
  const hint = $("formHint");

  /*
    =======================================================
    TEACHER ASSIGNMENT
    =======================================================
  */

  if (!hasTeacherScope()) {
    if (hint) {
      hint.textContent = "Teacher class/section assignment not found.";
    }

    return;
  }

  /*
    =======================================================
    BASIC DATA
    =======================================================
  */

  const title = normalize($("inpTitle")?.value);

  const category = normalize($("inpCategory")?.value || "general");

  const message = normalize($("inpMessage")?.value);

  /*
    =======================================================
    VALIDATION
    =======================================================
  */

  if (!title) {
    if (hint) {
      hint.textContent = "Title is required.";
    }

    $("inpTitle")?.focus();

    return;
  }

  if (!message) {
    if (hint) {
      hint.textContent = "Message is required.";
    }

    $("inpMessage")?.focus();

    return;
  }

  /*
    =======================================================
    PUBLICATION
    =======================================================
  */

  let draft = false;

  let publishAt = null;

  /*
    DRAFT
  */

  if (forceDraft) {
    draft = true;

    publishAt = null;
  } else if (getPublicationMode() === "now") {
    /*
    PUBLISH NOW
  */
    draft = false;

    publishAt = null;
  } else if (getPublicationMode() === "schedule") {
    /*
    SCHEDULE
  */
    const scheduledDate = validateSchedule();

    if (!scheduledDate) {
      return;
    }

    draft = false;

    publishAt = scheduledDate.toISOString();
  }

  /*
    =======================================================
    PAYLOAD
    =======================================================

    IMPORTANT:

    Teacher announcements ALWAYS send:

      audience: "class"

    plus:

      className
      sectionName

    The backend should use the authenticated
    teacher assignment as the final authority.
  */

  const payload = {
    title,

    category,

    message,

    draft,

    publishAt,

    /*
      Audience type.

      NEVER "all".
    */

    audience: "class",

    /*
      Teacher assignment.
    */

    className: TEACHER_SCOPE.className,

    sectionName: TEACHER_SCOPE.sectionName,

    /*
      Source.
    */

    source: "teacher",

    authorRole: "teacher",
  };

  console.log(
    "[teacher-announcements] teacher audience:",
    `${payload.className} - ${payload.sectionName}`,
  );

  console.log("[teacher-announcements] audience type:", payload.audience);

  console.log("[teacher-announcements] payload:", payload);

  /*
    =======================================================
    STATUS MESSAGE
    =======================================================
  */

  if (hint) {
    if (editingId) {
      if (draft) {
        hint.textContent = "Updating draft...";
      } else if (publishAt) {
        hint.textContent = "Updating scheduled announcement...";
      } else {
        hint.textContent = "Publishing update...";
      }
    } else {
      if (draft) {
        hint.textContent = "Saving draft...";
      } else if (publishAt) {
        hint.textContent = "Scheduling announcement...";
      } else {
        hint.textContent = "Publishing...";
      }
    }
  }

  /*
    =======================================================
    BUTTONS
    =======================================================
  */

  const draftButton = $("btnDraft");

  const publishButton = $("btnPublish");

  if (draftButton) {
    draftButton.disabled = true;
  }

  if (publishButton) {
    publishButton.disabled = true;
  }

  /*
    =======================================================
    SAVE
    =======================================================
  */

  try {
    let result;

    /*
      UPDATE
    */

    if (editingId) {
      result = await apiRequest(
        `${API_BASE}/${encodeURIComponent(editingId)}`,

        {
          method: "PUT",

          body: JSON.stringify(payload),
        },
      );
    } else {
      /*
      CREATE
    */
      result = await apiRequest(
        API_BASE,

        {
          method: "POST",

          body: JSON.stringify(payload),
        },
      );
    }

    console.log("[teacher-announcements] saved:", result);

    /*
      Helpful debug:

      Confirm what backend actually returned.
    */

    if (result?.data) {
      console.log(
        "[teacher-announcements] saved audience:",
        result.data.audience,
      );

      console.log(
        "[teacher-announcements] saved class:",
        result.data.className,
      );

      console.log(
        "[teacher-announcements] saved section:",
        result.data.sectionName,
      );
    }

    closeFormModal();

    await loadAnnouncements();
  } catch (err) {
    console.error("[teacher-announcements] save error:", err);

    if (hint) {
      hint.textContent = err.message || "Failed to save announcement.";
    }
  } finally {
    if (draftButton) {
      draftButton.disabled = false;
    }

    if (publishButton) {
      publishButton.disabled = false;
    }
  }
}

// =========================================================
// DELETE
// =========================================================

async function deleteAnnouncement(id) {
  const announcement = announcements.find(
    (a) => String(a._id || a.id) === String(id),
  );

  if (!announcement) {
    return;
  }

  /*
    NEVER DELETE ADMIN ANNOUNCEMENTS.
  */

  if (isAdminAnnouncement(announcement)) {
    alert("Admin announcements are read-only.");

    return;
  }

  const confirmed = confirm(`Delete "${announcement.title}"?`);

  if (!confirmed) {
    return;
  }

  try {
    await apiRequest(
      `${API_BASE}/${encodeURIComponent(id)}`,

      {
        method: "DELETE",
      },
    );

    await loadAnnouncements();
  } catch (err) {
    console.error("[teacher-announcements] delete error:", err);

    alert(err.message || "Failed to delete announcement.");
  }
}

// =========================================================
// TABS
// =========================================================

function setTab(nextTab) {
  tab = nextTab === "admin" ? "admin" : "my";

  const my = $("tabMy");

  const admin = $("tabAdmin");

  my?.classList.toggle("active", tab === "my");

  admin?.classList.toggle("active", tab === "admin");

  my?.setAttribute("aria-selected", tab === "my" ? "true" : "false");

  admin?.setAttribute("aria-selected", tab === "admin" ? "true" : "false");

  const title = $("listTitle");

  const sub = $("listSubtext");

  const newButton = $("btnNew");

  /*
    MY CLASS
  */

  if (tab === "my") {
    if (title) {
      title.textContent = "My Class Announcements";
    }

    if (sub) {
      sub.textContent = hasTeacherScope()
        ? `Create and manage announcements for ${scopeLabel()}.`
        : "Create and manage announcements for your handled class.";
    }

    if (newButton) {
      newButton.style.display = "";
    }
  } else {
    /*
    ADMIN
  */
    if (title) {
      title.textContent = "Admin Announcements";
    }

    if (sub) {
      sub.textContent = "Announcements published by administrators. Read-only.";
    }

    if (newButton) {
      newButton.style.display = "none";
    }
  }

  renderList();
}

// =========================================================
// EVENT BINDING
// =========================================================

function bindEvents() {
  /*
    =======================================================
    TABS
    =======================================================
  */

  $("tabMy")?.addEventListener("click", () => setTab("my"));

  $("tabAdmin")?.addEventListener("click", () => setTab("admin"));

  /*
    =======================================================
    CREATE
    =======================================================
  */

  $("btnNew")?.addEventListener("click", () => openFormModal("create"));

  /*
    =======================================================
    FILTERS
    =======================================================
  */

  $("annSearch")?.addEventListener("input", renderList);

  $("statusFilter")?.addEventListener("change", renderList);

  $("catFilter")?.addEventListener("change", renderList);

  /*
    =======================================================
    PUBLICATION
    =======================================================
  */

  const publicationNow = $("publicationNow");

  const publicationSchedule = $("publicationSchedule");

  /*
    PUBLISH NOW
  */

  if (publicationNow) {
    publicationNow.addEventListener("change", () => {
      updatePublicationFields(true);
    });
  }

  /*
    SCHEDULE FOR LATER
  */

  if (publicationSchedule) {
    publicationSchedule.addEventListener("change", () => {
      updatePublicationFields(false);

      $("inpScheduleDate")?.focus();
    });
  }

  /*
    =======================================================
    FEED ACTIONS
    =======================================================
  */

  $("annFeed")?.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");

    if (!button) {
      return;
    }

    const action = button.dataset.action;

    const id = button.dataset.id;

    if (!id) {
      return;
    }

    /*
        VIEW
      */

    if (action === "view") {
      openViewModal(id);

      return;
    }

    const announcement = announcements.find(
      (a) => String(a._id || a.id) === String(id),
    );

    if (!announcement) {
      return;
    }

    /*
        EDIT
      */

    if (action === "edit") {
      if (isAdminAnnouncement(announcement)) {
        alert("Admin announcements are read-only.");

        return;
      }

      openFormModal("edit", announcement);

      return;
    }

    /*
        DELETE
      */

    if (action === "delete") {
      await deleteAnnouncement(id);
    }
  });

  /*
    =======================================================
    VIEW MODAL
    =======================================================
  */

  $("annViewBackdrop")?.addEventListener("click", closeViewModal);

  $("annViewCloseX")?.addEventListener("click", closeViewModal);

  $("annViewCloseBtn")?.addEventListener("click", closeViewModal);

  /*
    =======================================================
    FORM MODAL
    =======================================================
  */

  $("annFormBackdrop")?.addEventListener("click", closeFormModal);

  $("annFormCloseX")?.addEventListener("click", closeFormModal);

  $("btnCancel")?.addEventListener("click", closeFormModal);

  /*
    =======================================================
    SAVE AS DRAFT
    =======================================================
  */

  $("btnDraft")?.addEventListener("click", () => saveAnnouncement(true));

  /*
    =======================================================
    PUBLISH / SCHEDULE
    =======================================================
  */

  $("btnPublish")?.addEventListener("click", () => saveAnnouncement(false));

  /*
    =======================================================
    ESCAPE
    =======================================================
  */

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") {
      return;
    }

    const viewModal = $("annViewModal");

    const formModal = $("annFormModal");

    if (viewModal && !viewModal.classList.contains("hidden")) {
      closeViewModal();

      return;
    }

    if (formModal && !formModal.classList.contains("hidden")) {
      closeFormModal();
    }
  });
}

// =========================================================
// HEADER
// =========================================================

function renderHeader() {
  const name = getTeacherName();

  const scope = scopeLabel();

  if ($("tbName")) {
    $("tbName").textContent = name;
  }

  if ($("tbRole")) {
    $("tbRole").textContent =
      scope !== "(unassigned)" ? `${scope} Teacher` : "Teacher";
  }

  if ($("taSub")) {
    $("taSub").textContent = `Posting to: ${scope}`;
  }

  /*
    Update audience field if it exists.
  */

  if ($("inpAudienceLabel")) {
    $("inpAudienceLabel").value = getTeacherAudienceLabel();
  }
}

// =========================================================
// INIT
// =========================================================

document.addEventListener("DOMContentLoaded", async () => {
  console.log("[teacher-announcements] loaded");

  /*
      Bind UI first.
    */

  bindEvents();

  /*
      IMPORTANT:

      Load the actual teacher assignment
      BEFORE allowing announcement creation.
    */

  await loadTeacherScope();
  await loadCurrentTeacherName();

  /*
  Render header using assignment.
*/

  renderHeader();

  /*
      Initialize publication controls.
    */

  updatePublicationFields(false);

  /*
      Start on My Class.
    */

  setTab("my");

  /*
      Load announcements.
    */

  await loadAnnouncements();
});
