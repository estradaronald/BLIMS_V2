// frontend/src/js/student/student-announcements.js
//
// STUDENT ANNOUNCEMENTS
//
// Student:
//   - View announcements
//   - Search
//   - Filter by source
//   - Filter by category
//
// Student CANNOT:
//   - Create
//   - Edit
//   - Delete
//   - Archive
//
// Sources:
//   - Admin
//   - Teacher
//
// Students only see:
//   - Published
//   - Non-archived
//   - Non-future announcements
//


// =========================================================
// API
// =========================================================

const ANNOUNCEMENTS_API =
  "/api/student/announcements";


// =========================================================
// STATE
// =========================================================

let announcements = [];


// =========================================================
// DOM
// =========================================================

function $(id) {

  return document.getElementById(id);

}


// =========================================================
// HELPERS
// =========================================================

function normalize(value) {

  return String(
    value ?? ""
  ).trim();

}


function escapeHtml(value) {

  return String(
    value ?? ""
  )
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

}


// =========================================================
// USER
// =========================================================

function readUser() {

  try {

    return JSON.parse(
      localStorage.getItem("user") || "{}"
    );

  } catch {

    return {};

  }

}


function getStudentName() {

  const user =
    readUser();


  return (
    user.fullName ||

    [
      user.firstName,
      user.middleName,
      user.lastName,
    ]
      .filter(Boolean)
      .join(" ") ||

    user.username ||

    "Student"
  );

}


// =========================================================
// DATE
// =========================================================

function formatDate(value) {

  if (!value) {

    return "—";

  }


  const date =
    new Date(value);


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return "—";

  }


  return date.toLocaleString(
    undefined,
    {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }
  );

}


// =========================================================
// CATEGORY
// =========================================================

function categoryLabel(category) {

  const labels = {

    general:
      "General",

    events:
      "School Event",

    academic:
      "Academic",

    priority:
      "Priority",

  };


  return (
    labels[category] ||
    "General"
  );

}


function categoryClass(category) {

  return (

    {
      general: "",
      events: "events",
      academic: "academic",
      priority: "priority",
    }[category] || ""

  );

}


// =========================================================
// SOURCE
// =========================================================

function getSource(announcement) {

  const source =
    normalize(
      announcement?.source
    ).toLowerCase();


  const authorRole =
    normalize(
      announcement?.authorRole
    ).toLowerCase();


  const createdByRole =
    normalize(
      announcement?.createdByRole
    ).toLowerCase();


  const nestedRole =
    normalize(
      announcement?.createdBy?.role
    ).toLowerCase();


  if (
    source === "teacher" ||
    source === "faculty"
  ) {

    return "teacher";

  }


  if (
    source === "admin" ||
    source === "administrator"
  ) {

    return "admin";

  }


  if (
    authorRole === "teacher" ||
    authorRole === "faculty"
  ) {

    return "teacher";

  }


  if (
    authorRole === "admin" ||
    authorRole === "administrator"
  ) {

    return "admin";

  }


  if (
    createdByRole === "teacher" ||
    createdByRole === "faculty"
  ) {

    return "teacher";

  }


  if (
    createdByRole === "admin" ||
    createdByRole === "administrator"
  ) {

    return "admin";

  }


  if (
    nestedRole === "teacher" ||
    nestedRole === "faculty"
  ) {

    return "teacher";

  }


  return "admin";

}


// =========================================================
// VISIBILITY
// =========================================================

function isVisibleToStudent(announcement) {

  if (!announcement) {

    return false;

  }


  /*
    Archived announcements
    are not visible.
  */

  if (
    announcement.archived === true
  ) {

    return false;

  }


  /*
    Draft announcements
    are not visible.
  */

  if (
    announcement.draft === true
  ) {

    return false;

  }


  /*
    Future scheduled announcements
    are not visible yet.
  */

  if (
    announcement.publishAt
  ) {

    const publishTime =
      new Date(
        announcement.publishAt
      ).getTime();


    if (
      !Number.isNaN(
        publishTime
      ) &&
      publishTime >
        Date.now()
    ) {

      return false;

    }

  }


  return true;

}


// =========================================================
// API REQUEST
// =========================================================

async function apiRequest(
  url,
  options = {}
) {

  const response =
    await fetch(
      url,
      {

        credentials:
          "include",

        ...options,

        headers: {

          "Content-Type":
            "application/json",

          ...(options.headers || {}),

        },

      }
    );


  let data = null;


  try {

    data =
      await response.json();

  } catch {

    data = null;

  }


  if (
    !response.ok
  ) {

    throw new Error(
      data?.message ||
      `Request failed with status ${response.status}.`
    );

  }


  return data;

}


// =========================================================
// LOAD ANNOUNCEMENTS
// =========================================================

async function loadAnnouncements() {

  const feed =
    $("annFeed");


  const empty =
    $("annEmpty");


  if (feed) {

    feed.innerHTML = `

      <div class="student-announcement-empty">

        <div class="student-empty-icon">
          ⏳
        </div>

        <strong>
          Loading announcements...
        </strong>

      </div>

    `;

  }


  try {

    /*
      Student announcements are now loaded
      directly from the backend.
    */

    const result =
      await apiRequest(
        ANNOUNCEMENTS_API
      );


    if (
      Array.isArray(result)
    ) {

      announcements =
        result;

    }

    else if (
      Array.isArray(result?.data)
    ) {

      announcements =
        result.data;

    }

    else if (
      Array.isArray(result?.announcements)
    ) {

      announcements =
        result.announcements;

    }

    else {

      announcements =
        [];

    }


    console.log(
      "[student-announcements] loaded:",
      announcements
    );


    render();

  } catch (err) {

    console.error(
      "[student-announcements] load error:",
      err
    );


    announcements =
      [];


    if (feed) {

      feed.innerHTML = `

        <div class="student-announcement-empty">

          <div class="student-empty-icon">
            ⚠️
          </div>

          <strong>
            Unable to load announcements.
          </strong>

          <p>
            ${escapeHtml(
              err?.message ||
              "Please try again later."
            )}
          </p>

        </div>

      `;

    }


    if (empty) {

      empty.classList.add(
        "hidden"
      );

    }

  }

}


// =========================================================
// FILTERS
// =========================================================

function getFilters() {

  return {

    search:
      normalize(
        $("annSearch")?.value
      ).toLowerCase(),

    source:
      $("sourceFilter")?.value ||
      "all",

    category:
      $("catFilter")?.value ||
      "all",

  };

}


// =========================================================
// FILTER
// =========================================================

function getVisibleAnnouncements() {

  const filters =
    getFilters();


  let rows =
    [...announcements];


  /*
    STUDENT VISIBILITY
  */

  rows =
    rows.filter(
      isVisibleToStudent
    );


  /*
    SOURCE
  */

  if (
    filters.source !== "all"
  ) {

    rows =
      rows.filter(
        (announcement) =>
          getSource(
            announcement
          ) ===
          filters.source
      );

  }


  /*
    CATEGORY
  */

  if (
    filters.category !== "all"
  ) {

    rows =
      rows.filter(
        (announcement) =>
          (
            announcement.category ||
            "general"
          ) ===
          filters.category
      );

  }


  /*
    SEARCH
  */

  if (
    filters.search
  ) {

    rows =
      rows.filter(
        (announcement) => {

          const haystack = [

            announcement.title,

            announcement.message,

            announcement.category,

            getSource(
              announcement
            ),

          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();


          return haystack.includes(
            filters.search
          );

        }
      );

  }


  /*
    NEWEST FIRST
  */

  rows.sort(
    (a, b) => {

      const aTime =
        new Date(
          a.createdAt ||
          a.updatedAt ||
          a.publishAt ||
          0
        ).getTime();


      const bTime =
        new Date(
          b.createdAt ||
          b.updatedAt ||
          b.publishAt ||
          0
        ).getTime();


      return (
        bTime - aTime
      );

    }
  );


  return rows;

}


// =========================================================
// RENDER
// =========================================================

function render() {

  const feed =
    $("annFeed");


  const empty =
    $("annEmpty");


  if (
    !feed ||
    !empty
  ) {

    return;

  }


  const rows =
    getVisibleAnnouncements();


  feed.innerHTML =
    "";


  if (
    rows.length === 0
  ) {

    empty.classList.remove(
      "hidden"
    );

    return;

  }


  empty.classList.add(
    "hidden"
  );


  rows.forEach(
    (announcement) => {

      const source =
        getSource(
          announcement
        );


      const sourceLabel =
        source === "teacher"
          ? "Teacher"
          : "Admin";


      const category =
        announcement.category ||
        "general";


      const item =
        document.createElement(
          "article"
        );


      item.className =
        "student-announcement-item";


      item.innerHTML = `

        <div class="student-announcement-item-top">


          <!-- LEFT -->

          <div class="student-announcement-item-main">

            <h3
              class="student-announcement-item-title"
            >
              ${escapeHtml(
                announcement.title ||
                "Untitled"
              )}
            </h3>


            <p
              class="student-announcement-item-message"
            >
              ${escapeHtml(
                announcement.message ||
                ""
              )}
            </p>


            <div
              class="student-announcement-item-meta"
            >

              <span>
                Posted:
              </span>

              <strong>
                ${escapeHtml(
                  formatDate(
                    announcement.publishAt ||
                    announcement.createdAt
                  )
                )}
              </strong>

            </div>

          </div>


          <!-- RIGHT -->

          <div
            class="student-announcement-item-right"
          >

            <span
              class="student-source-pill ${source}"
            >
              ${sourceLabel}
            </span>


            <span
              class="student-category-pill ${categoryClass(
                category
              )}"
            >
              ${escapeHtml(
                categoryLabel(
                  category
                )
              )}
            </span>


            <button
              type="button"
              class="student-announcement-view-btn"
              data-action="view"
            >
              View
            </button>

          </div>

        </div>

      `;


      /*
        Save announcement reference.
      */

      item.__announcement =
        announcement;


      feed.appendChild(
        item
      );

    }
  );

}


// =========================================================
// MODAL
// =========================================================

function openViewModal(
  announcement
) {

  const modal =
    $("annViewModal");


  if (
    !modal ||
    !announcement
  ) {

    return;

  }


  const source =
    getSource(
      announcement
    );


  const sourceLabel =
    source === "teacher"
      ? "Teacher"
      : "Admin";


  const category =
    announcement.category ||
    "general";


  /*
    Source
  */

  const sourceElement =
    $("annViewSource");


  if (
    sourceElement
  ) {

    sourceElement.className =
      `student-source-pill ${source}`;

    sourceElement.textContent =
      sourceLabel;

  }


  /*
    Category
  */

  const categoryElement =
    $("annViewPill");


  if (
    categoryElement
  ) {

    categoryElement.className =
      `student-category-pill ${categoryClass(
        category
      )}`;

    categoryElement.textContent =
      categoryLabel(
        category
      );

  }


  /*
    Header title
  */

  const title =
    announcement.title ||
    "Announcement";


  if (
    $("annViewTitle")
  ) {

    $("annViewTitle").textContent =
      "Announcement";

  }


  if (
    $("annViewH")
  ) {

    $("annViewH").textContent =
      title;

  }


  /*
    Date
  */

  if (
    $("annViewMeta")
  ) {

    $("annViewMeta").textContent =
      `Posted: ${formatDate(
        announcement.publishAt ||
        announcement.createdAt
      )}`;

  }


  /*
    Message
  */

  if (
    $("annViewMsg")
  ) {

    $("annViewMsg").textContent =
      announcement.message ||
      "";

  }


  /*
    Attachments
  */

  renderAttachments(
    announcement.files
  );


  /*
    Open
  */

  modal.classList.remove(
    "hidden"
  );


  modal.setAttribute(
    "aria-hidden",
    "false"
  );


  document.body.style.overflow =
    "hidden";


  $("annViewCloseBtn")?.focus();

}


// =========================================================
// CLOSE MODAL
// =========================================================

function closeViewModal() {

  const modal =
    $("annViewModal");


  if (!modal) {

    return;

  }


  modal.classList.add(
    "hidden"
  );


  modal.setAttribute(
    "aria-hidden",
    "true"
  );


  document.body.style.overflow =
    "";

}


// =========================================================
// ATTACHMENTS
// =========================================================

function renderAttachments(
  files
) {

  const container =
    $("annViewFiles");


  if (!container) {

    return;

  }


  container.innerHTML =
    "";


  if (
    !Array.isArray(files) ||
    files.length === 0
  ) {

    return;

  }


  files.forEach(
    (file) => {

      const src =
        typeof file === "string"
          ? file
          : file?.dataUrl ||
            file?.url ||
            file?.src ||
            "";


      if (!src) {

        return;

      }


      const image =
        document.createElement(
          "img"
        );


      image.src =
        src;


      image.alt =
        file?.name ||
        "Announcement attachment";


      container.appendChild(
        image
      );

    }
  );

}


// =========================================================
// EVENTS
// =========================================================

function bindEvents() {

  /*
    Search
  */

  $("annSearch")
    ?.addEventListener(
      "input",
      render
    );


  /*
    Source
  */

  $("sourceFilter")
    ?.addEventListener(
      "change",
      render
    );


  /*
    Category
  */

  $("catFilter")
    ?.addEventListener(
      "change",
      render
    );


  /*
    Feed
  */

  $("annFeed")
    ?.addEventListener(
      "click",
      (event) => {

        const button =
          event.target.closest(
            '[data-action="view"]'
          );


        const item =
          event.target.closest(
            ".student-announcement-item"
          );


        if (
          button &&
          item
        ) {

          openViewModal(
            item.__announcement
          );

          return;

        }


        /*
          Clicking the announcement itself
          also opens View.
        */

        if (
          item
        ) {

          openViewModal(
            item.__announcement
          );

        }

      }
    );


  /*
    Modal
  */

  $("annViewBackdrop")
    ?.addEventListener(
      "click",
      closeViewModal
    );


  $("annViewCloseX")
    ?.addEventListener(
      "click",
      closeViewModal
    );


  $("annViewCloseBtn")
    ?.addEventListener(
      "click",
      closeViewModal
    );


  /*
    Escape
  */

  document.addEventListener(
    "keydown",
    (event) => {

      if (
        event.key === "Escape"
      ) {

        const modal =
          $("annViewModal");


        if (
          modal &&
          !modal.classList.contains(
            "hidden"
          )
        ) {

          closeViewModal();

        }

      }

    }
  );

}


// =========================================================
// TOPBAR
// =========================================================

function initTopbarMenu() {

  const button =
    $("userMenuBtn");


  const menu =
    $("userMenu");


  const userbox =
    $("userbox");


  if (
    !button ||
    !menu ||
    !userbox
  ) {

    return;

  }


  button.addEventListener(
    "click",
    (event) => {

      event.stopPropagation();

      menu.classList.toggle(
        "open"
      );

    }
  );


  document.addEventListener(
    "click",
    (event) => {

      if (
        !userbox.contains(
          event.target
        )
      ) {

        menu.classList.remove(
          "open"
        );

      }

    }
  );

}


// =========================================================
// LOGOUT
// =========================================================

function initLogout() {

  const button =
    $("topbarLogout");


  if (!button) {

    return;

  }


  button.addEventListener(
    "click",
    () => {

      window.location.href =
        "../../login.html";

    }
  );

}


// =========================================================
// HEADER
// =========================================================

function renderHeader() {

  const name =
    getStudentName();


  if (
    $("tbName")
  ) {

    $("tbName").textContent =
      name;

  }


  if (
    $("tbRole")
  ) {

    $("tbRole").textContent =
      "Student";

  }

}


// =========================================================
// INIT
// =========================================================

document.addEventListener(
  "DOMContentLoaded",
  async () => {

    console.log(
      "[student-announcements] loaded"
    );


    initTopbarMenu();

    initLogout();

    bindEvents();

    renderHeader();

    await loadAnnouncements();

  }
);