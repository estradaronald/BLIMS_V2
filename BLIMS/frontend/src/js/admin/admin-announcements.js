document.addEventListener("DOMContentLoaded", () => {
  const $ = (id) =>
    document.getElementById(id);

  const API_BASE =
    "/api/admin/announcements";


  // =========================================================
  // HELPERS
  // =========================================================

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }


  function nl2brSafe(value) {
    return escapeHtml(value)
      .replace(/\n/g, "<br>");
  }


  function clampText(value, max = 180) {
    const text =
      String(value ?? "").trim();

    if (text.length <= max) {
      return text;
    }

    return (
      text.slice(0, max).trim() +
      "…"
    );
  }


  function fmtShort(value) {
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


  function catLabel(category) {
    return (
      {
        general:
          "General Announcement",

        events:
          "School Event",

        academic:
          "Academic Notice",

        priority:
          "Priority Alert",
      }[category] ||
      "General Announcement"
    );
  }


  function catPillClass(category) {
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
  // AUDIENCE LABEL
  //
  // IMPORTANT:
  // These values MUST match the backend exactly:
  //
  // all
  // students
  // teachers
  //
  // There is NO "both"
  // There is NO "students_teachers"
  // =========================================================

  function audienceLabel(audience) {
    return (
      {
        all:
          "Students & Teachers",

        students:
          "Students Only",

        teachers:
          "Teachers Only",
      }[audience] ||
      "Students & Teachers"
    );
  }


  function computeStatus(a) {
    if (a.archived) {
      return "archived";
    }

    if (a.draft) {
      return "draft";
    }

    if (a.publishAt) {
      const time =
        new Date(
          a.publishAt
        ).getTime();

      if (
        !Number.isNaN(time) &&
        time > Date.now()
      ) {
        return "scheduled";
      }
    }

    return "published";
  }


  function statusLabel(status) {
    return (
      {
        published:
          "Published",

        scheduled:
          "Scheduled",

        draft:
          "Draft",

        archived:
          "Archived",
      }[status] ||
      "Published"
    );
  }


  function toLocalInputValue(value) {
    if (!value) {
      return "";
    }

    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "";
    }

    const pad = (n) =>
      String(n).padStart(
        2,
        "0"
      );

    return (
      `${date.getFullYear()}-` +
      `${pad(date.getMonth() + 1)}-` +
      `${pad(date.getDate())}T` +
      `${pad(date.getHours())}:` +
      `${pad(date.getMinutes())}`
    );
  }


  function debounce(
    fn,
    wait = 250
  ) {
    let timer = null;

    return (...args) => {
      clearTimeout(timer);

      timer = setTimeout(
        () => fn(...args),
        wait
      );
    };
  }


  // =========================================================
  // STATE
  // =========================================================

  let csrfToken = "";

  let announcements = [];

  let openMenuId = null;

  let editingId = null;

  let viewingId = null;


  // =========================================================
  // DOM
  // =========================================================

  const feed =
    $("annFeed");

  const empty =
    $("annEmpty");

  const search =
    $("annSearch");

  const typeFilter =
    $("typeFilter");

  const catFilter =
    $("catFilter");

  const createBtn =
    $("createAnnBtn");


  // Create/Edit

  const modal =
    $("annModal");

  const modalBackdrop =
    $("annModalBackdrop");

  const modalCloseX =
    $("annModalCloseX");

  const cancelBtn =
    $("annCancelBtn");

  const draftBtn =
    $("annDraftBtn");

  const publishBtn =
    $("annPublishBtn");

  const modalTitle =
    $("annModalTitle");

  const fTitle =
    $("annTitle");

  const fCat =
    $("annCategory");

  const fAudience =
    $("annAudience");

  const fMsg =
    $("annMessage");

  const fPublishNow =
    $("annPublishNow");

  const fScheduleLater =
    $("annScheduleLater");

  const scheduleFields =
    $("annScheduleFields");

  const fScheduleDate =
    $("annScheduleDate");

  const fScheduleTime =
    $("annScheduleTime");

  const formError =
    $("annFormError");


  // View

  const viewModal =
    $("annViewModal");

  const viewBackdrop =
    $("annViewBackdrop");

  const viewCloseX =
    $("annViewCloseX");

  const viewCloseBtn =
    $("annViewCloseBtn");

  const viewEditBtn =
    $("annViewEditBtn");

  const viewArchiveBtn =
    $("annViewArchiveBtn");

  const vMeta =
    $("annViewMeta");

  const vPill =
    $("annViewPill");

  const vStatus =
    $("annViewStatus");

  const vH =
    $("annViewH");

  const vAudience =
    $("annViewAudience");

  const vMsg =
    $("annViewMsg");


  // =========================================================
  // API
  // =========================================================

  async function fetchCsrfToken() {
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
        .catch(() => ({}));

    if (
      !response.ok ||
      !data.ok
    ) {
      throw new Error(
        data.message ||
          "Failed to fetch CSRF token."
      );
    }

    csrfToken =
      data.csrfToken || "";
  }


  async function api(
    url,
    options = {}
  ) {
    const method =
      (
        options.method ||
        "GET"
      ).toUpperCase();

    const headers = {
      ...(options.headers ||
        {}),
    };

    if (
      method !== "GET" &&
      method !== "HEAD"
    ) {
      headers[
        "x-csrf-token"
      ] = csrfToken;
    }

    const response =
      await fetch(
        url,
        {
          credentials:
            "include",

          ...options,

          headers,
        }
      );

    const data =
      await response
        .json()
        .catch(() => ({}));

    if (
      !response.ok ||
      data.ok === false
    ) {
      throw new Error(
        data.message ||
          "Request failed."
      );
    }

    return data;
  }


  // =========================================================
  // LOAD
  // =========================================================

  async function loadAnnouncements() {
    try {
      closeAllMenus();

      const params =
        new URLSearchParams({
          search:
            (
              search.value ||
              ""
            ).trim(),

          type:
            typeFilter.value ||
            "all",

          category:
            catFilter.value ||
            "all",
        });

      const data =
        await api(
          `${API_BASE}?${params.toString()}`
        );

      announcements =
        Array.isArray(
          data.data
        )
          ? data.data
          : [];

      render();

    } catch (error) {
      console.error(
        "Failed to load announcements:",
        error
      );

      announcements = [];

      render();

      setFormError(
        error.message ||
          "Failed to load announcements."
      );
    }
  }


  async function getAnnouncementById(
    id
  ) {
    const data =
      await api(
        `${API_BASE}/${encodeURIComponent(
          id
        )}`
      );

    return data.data;
  }


  async function createAnnouncement(
    payload
  ) {
    const data =
      await api(
        API_BASE,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify(
              payload
            ),
        }
      );

    return data.data;
  }


  async function updateAnnouncement(
    id,
    payload
  ) {
    const data =
      await api(
        `${API_BASE}/${encodeURIComponent(
          id
        )}`,
        {
          method: "PUT",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify(
              payload
            ),
        }
      );

    return data.data;
  }


  async function archiveAnnouncement(
    id
  ) {
    const data =
      await api(
        `${API_BASE}/${encodeURIComponent(
          id
        )}/archive`,
        {
          method: "PATCH",
        }
      );

    return data.data;
  }


  async function removeAnnouncement(
    id
  ) {
    await api(
      `${API_BASE}/${encodeURIComponent(
        id
      )}`,
      {
        method: "DELETE",
      }
    );
  }


  // =========================================================
  // EXPANDABLE CARD ACTIONS
  // =========================================================

  function closeAllMenus() {
    openMenuId = null;

    if (!feed) {
      return;
    }

    feed
      .querySelectorAll(
        ".ann-menu"
      )
      .forEach(
        (menu) =>
          menu.classList.add(
            "hidden"
          )
      );

    feed
      .querySelectorAll(
        ".ann-kebab"
      )
      .forEach(
        (button) => {
          button.classList.remove(
            "is-open"
          );

          button.setAttribute(
            "aria-expanded",
            "false"
          );
        }
      );
  }


  function toggleMenuForCard(
    card
  ) {
    const id =
      card.dataset.id;

    const menu =
      card.querySelector(
        ".ann-menu"
      );

    const button =
      card.querySelector(
        ".ann-kebab"
      );

    if (
      !id ||
      !menu ||
      !button
    ) {
      return;
    }

    const alreadyOpen =
      openMenuId === id;

    closeAllMenus();

    if (alreadyOpen) {
      return;
    }

    openMenuId = id;

    menu.classList.remove(
      "hidden"
    );

    button.classList.add(
      "is-open"
    );

    button.setAttribute(
      "aria-expanded",
      "true"
    );
  }


  // =========================================================
  // RENDER
  // =========================================================

  function render() {
    closeAllMenus();

    feed.innerHTML = "";

    if (
      !announcements.length
    ) {
      empty.classList.remove(
        "hidden"
      );

      return;
    }

    empty.classList.add(
      "hidden"
    );

    announcements.forEach(
      (a) => {
        const id =
          a._id ||
          a.id ||
          "";

        const category =
          catLabel(
            a.category
          );

        const pillClass =
          catPillClass(
            a.category
          );

        const status =
          a.status ||
          computeStatus(a);

        const card =
          document.createElement(
            "article"
          );

        card.className =
          "ann-card";

        card.dataset.id =
          id;

        card.innerHTML = `
          <div class="ann-card-top">

            <div class="ann-card-left">

              <span class="ann-pill ${pillClass}">
                ${escapeHtml(category)}
              </span>

              <h3
                class="ann-title"
                data-act="view"
                tabindex="0"
                role="button"
              >
                ${escapeHtml(
                  a.title ||
                    "Untitled Announcement"
                )}
              </h3>

              <p class="ann-body">
                ${nl2brSafe(
                  clampText(
                    a.message ||
                      ""
                  )
                )}
              </p>

              ${
                a.publishAt
                  ? `
                    <div class="ann-meta">
                      <span>
                        ${
                          status ===
                          "scheduled"
                            ? "Scheduled: "
                            : "Published: "
                        }
                        ${escapeHtml(
                          fmtShort(
                            a.publishAt
                          )
                        )}
                      </span>
                    </div>
                  `
                  : ""
              }

            </div>

            <div class="ann-card-right">

              <button
                class="ann-kebab"
                type="button"
                aria-label="Announcement actions"
                aria-expanded="false"
              >
                ⋮
              </button>

            </div>

          </div>

          <div
            class="ann-menu hidden"
            role="group"
          >

            <button
              type="button"
              data-act="view"
            >
              View Details
            </button>

            <button
              type="button"
              data-act="edit"
            >
              Edit
            </button>

            <button
              type="button"
              data-act="archive"
            >
              ${
                a.archived
                  ? "Unarchive"
                  : "Archive"
              }
            </button>

            <button
              type="button"
              data-act="delete"
              class="danger"
            >
              Delete
            </button>

          </div>
        `;

        feed.appendChild(
          card
        );
      }
    );
  }


  // =========================================================
  // FORM
  // =========================================================

  function setPublicationMode() {
    const scheduled =
      fScheduleLater.checked;

    scheduleFields.classList.toggle(
      "hidden",
      !scheduled
    );

    publishBtn.textContent =
      scheduled
        ? "Save"
        : "Publish";
  }


  function resetFormUI() {
    editingId = null;

    modalTitle.textContent =
      "Create New Announcement";

    draftBtn.textContent =
      "Save as Draft";

    publishBtn.textContent =
      "Publish";

    fTitle.value = "";

    fCat.value =
      "general";

    // Backend value:
    // all = Students & Teachers
    fAudience.value =
      "all";

    fMsg.value = "";

    fPublishNow.checked =
      true;

    fScheduleLater.checked =
      false;

    fScheduleDate.value =
      "";

    fScheduleTime.value =
      "";

    scheduleFields.classList.add(
      "hidden"
    );

    clearFormError();
  }


  function openCreate() {
    resetFormUI();

    openModal();
  }


  function openEdit(id) {
    const announcement =
      announcements.find(
        (item) =>
          (
            item._id ||
            item.id
          ) === id
      );

    if (!announcement) {
      return;
    }

    editingId = id;

    modalTitle.textContent =
      "Edit Announcement";

    draftBtn.textContent =
      "Save as Draft";

    fTitle.value =
      announcement.title ||
      "";

    fCat.value =
      announcement.category ||
      "general";

    /*
     * Use the backend value directly.
     *
     * Allowed:
     * all
     * students
     * teachers
     */
    fAudience.value =
      announcement.audience ||
      "all";

    fMsg.value =
      announcement.message ||
      "";

    if (
      announcement.publishAt
    ) {
      const date =
        new Date(
          announcement.publishAt
        );

      if (
        !Number.isNaN(
          date.getTime()
        )
      ) {
        const pad =
          (n) =>
            String(n).padStart(
              2,
              "0"
            );

        fScheduleDate.value =
          `${date.getFullYear()}-${pad(
            date.getMonth() + 1
          )}-${pad(
            date.getDate()
          )}`;

        fScheduleTime.value =
          `${pad(
            date.getHours()
          )}:${pad(
            date.getMinutes()
          )}`;

        fScheduleLater.checked =
          computeStatus(
            announcement
          ) === "scheduled";

        fPublishNow.checked =
          !fScheduleLater.checked;
      }
    } else {
      fPublishNow.checked =
        true;

      fScheduleLater.checked =
        false;
    }

    setPublicationMode();

    clearFormError();

    openModal();
  }


  function validateForm() {
    const title =
      (
        fTitle.value ||
        ""
      ).trim();

    const message =
      (
        fMsg.value ||
        ""
      ).trim();

    if (!title) {
      return "Title is required.";
    }

    if (!message) {
      return "Message is required.";
    }

    // =======================================================
    // AUDIENCE VALIDATION
    // =======================================================

    const validAudiences = [
      "all",
      "students",
      "teachers",
    ];

    if (
      !validAudiences.includes(
        fAudience.value
      )
    ) {
      return "Please select a valid audience.";
    }

    if (
      fScheduleLater.checked
    ) {
      if (
        !fScheduleDate.value
      ) {
        return "Please select a schedule date.";
      }

      if (
        !fScheduleTime.value
      ) {
        return "Please select a schedule time.";
      }
    }

    return null;
  }


  function buildPublishDate() {
    if (
      fPublishNow.checked
    ) {
      return null;
    }

    const localValue =
      `${fScheduleDate.value}T${fScheduleTime.value}`;

    const date =
      new Date(
        localValue
      );

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return null;
    }

    return date.toISOString();
  }


  async function saveAnnouncement(
    isDraft
  ) {
    clearFormError();

    const error =
      validateForm();

    if (error) {
      setFormError(error);
      return;
    }


    // =======================================================
    // PAYLOAD
    //
    // IMPORTANT:
    // The frontend now sends the backend values directly.
    //
    // all
    // students
    // teachers
    //
    // There is NO audience conversion.
    // =======================================================

    const payload = {
      title:
        (
          fTitle.value ||
          ""
        ).trim(),

      category:
        fCat.value ||
        "general",

      audience:
        fAudience.value ||
        "all",

      message:
        (
          fMsg.value ||
          ""
        ).trim(),

      /*
       * Publish Now:
       * draft = false
       * publishAt = null
       *
       * Schedule Later:
       * draft = false
       * publishAt = selected date/time
       *
       * Save as Draft:
       * draft = true
       * publishAt = null
       */
      publishAt:
        isDraft
          ? null
          : buildPublishDate(),

      draft:
        !!isDraft,

      archived:
        false,
    };


    console.log(
      "Announcement payload:",
      JSON.stringify(
        payload,
        null,
        2
      )
    );


    try {
      if (editingId) {
        await updateAnnouncement(
          editingId,
          payload
        );
      } else {
        await createAnnouncement(
          payload
        );
      }

      closeModal();

      resetFormUI();

      await loadAnnouncements();

    } catch (error2) {
      console.error(
        "Save failed:",
        error2
      );

      setFormError(
        error2.message ||
          "Failed to save announcement."
      );
    }
  }


  // =========================================================
  // VIEW
  // =========================================================

  async function openView(id) {
    try {
      const announcement =
        await getAnnouncementById(
          id
        );

      if (!announcement) {
        return;
      }

      viewingId = id;

      const status =
        announcement.status ||
        computeStatus(
          announcement
        );

      const label =
        catLabel(
          announcement.category
        );

      const pillClass =
        catPillClass(
          announcement.category
        );


      if (vMeta) {
        vMeta.textContent =
          announcement.publishAt
            ? (
                status ===
                "scheduled"
                  ? "Scheduled: "
                  : "Published: "
              ) +
              fmtShort(
                announcement.publishAt
              )
            : "No publication date";
      }


      if (vPill) {
        vPill.className =
          `ann-pill ${pillClass}`;

        vPill.textContent =
          label;
      }


      if (vStatus) {
        vStatus.textContent =
          statusLabel(
            status
          );
      }


      if (vH) {
        vH.textContent =
          announcement.title ||
          "Untitled Announcement";
      }


      if (vAudience) {
        vAudience.textContent =
          audienceLabel(
            announcement.audience
          );
      }


      if (vMsg) {
        vMsg.innerHTML =
          nl2brSafe(
            announcement.message ||
              "—"
          );
      }


      if (viewArchiveBtn) {
        viewArchiveBtn.textContent =
          announcement.archived
            ? "Unarchive"
            : "Archive";
      }

      openViewModal();

    } catch (error) {
      console.error(
        "Failed to open announcement:",
        error
      );

      alert(
        error.message ||
          "Failed to load announcement."
      );
    }
  }


  // =========================================================
  // MODAL OPEN/CLOSE
  // =========================================================

  function openModal() {
    modal.classList.remove(
      "hidden"
    );

    modal.setAttribute(
      "aria-hidden",
      "false"
    );

    document.body.style.overflow =
      "hidden";
  }


  function closeModal() {
    modal.classList.add(
      "hidden"
    );

    modal.setAttribute(
      "aria-hidden",
      "true"
    );

    document.body.style.overflow =
      "";

    clearFormError();
  }


  function openViewModal() {
    viewModal.classList.remove(
      "hidden"
    );

    viewModal.setAttribute(
      "aria-hidden",
      "false"
    );

    document.body.style.overflow =
      "hidden";
  }


  function closeViewModal() {
    viewModal.classList.add(
      "hidden"
    );

    viewModal.setAttribute(
      "aria-hidden",
      "true"
    );

    document.body.style.overflow =
      "";
  }


  function setFormError(
    message
  ) {
    if (!formError) {
      return;
    }

    formError.textContent =
      message;

    formError.classList.remove(
      "hidden"
    );
  }


  function clearFormError() {
    if (!formError) {
      return;
    }

    formError.textContent =
      "";

    formError.classList.add(
      "hidden"
    );
  }


  // =========================================================
  // ARCHIVE / DELETE
  // =========================================================

  async function toggleArchive(
    id
  ) {
    try {
      await archiveAnnouncement(
        id
      );

      await loadAnnouncements();

    } catch (error) {
      console.error(
        "Archive failed:",
        error
      );

      alert(
        error.message ||
          "Failed to update announcement."
      );
    }
  }


  async function deleteAnn(id) {
    const announcement =
      announcements.find(
        (item) =>
          (
            item._id ||
            item.id
          ) === id
      );

    if (!announcement) {
      return;
    }

    const confirmed =
      confirm(
        `Delete "${
          announcement.title ||
          "Untitled"
        }"? This cannot be undone.`
      );

    if (!confirmed) {
      return;
    }

    try {
      await removeAnnouncement(
        id
      );

      await loadAnnouncements();

      if (
        viewingId === id
      ) {
        viewingId = null;

        closeViewModal();
      }

    } catch (error) {
      console.error(
        "Delete failed:",
        error
      );

      alert(
        error.message ||
          "Failed to delete announcement."
      );
    }
  }


  // =========================================================
  // FEED EVENTS
  // =========================================================

  feed.addEventListener(
    "click",
    (event) => {
      const card =
        event.target.closest(
          ".ann-card"
        );

      if (!card) {
        return;
      }

      const id =
        card.dataset.id;


      // Three dots

      const kebab =
        event.target.closest(
          ".ann-kebab"
        );

      if (kebab) {
        event.preventDefault();

        event.stopPropagation();

        toggleMenuForCard(
          card
        );

        return;
      }


      // Action buttons

      const action =
        event.target.closest(
          ".ann-menu button"
        );

      if (action) {
        event.preventDefault();

        event.stopPropagation();

        const act =
          action.dataset.act;

        closeAllMenus();

        if (
          act === "view"
        ) {
          openView(id);
        }

        if (
          act === "edit"
        ) {
          openEdit(id);
        }

        if (
          act === "archive"
        ) {
          toggleArchive(id);
        }

        if (
          act === "delete"
        ) {
          deleteAnn(id);
        }

        return;
      }


      // Click title

      const title =
        event.target.closest(
          ".ann-title"
        );

      if (title) {
        event.preventDefault();

        closeAllMenus();

        openView(id);
      }
    }
  );


  // =========================================================
  // TITLE KEYBOARD
  // =========================================================

  feed.addEventListener(
    "keydown",
    (event) => {
      const title =
        event.target.closest(
          ".ann-title"
        );

      if (!title) {
        return;
      }

      if (
        event.key ===
          "Enter" ||
        event.key === " "
      ) {
        event.preventDefault();

        const card =
          title.closest(
            ".ann-card"
          );

        if (!card) {
          return;
        }

        openView(
          card.dataset.id
        );
      }
    }
  );


  // =========================================================
  // FORM EVENTS
  // =========================================================

  fPublishNow.addEventListener(
    "change",
    setPublicationMode
  );

  fScheduleLater.addEventListener(
    "change",
    setPublicationMode
  );


  createBtn.addEventListener(
    "click",
    openCreate
  );


  modalBackdrop.addEventListener(
    "click",
    closeModal
  );


  modalCloseX.addEventListener(
    "click",
    closeModal
  );


  cancelBtn.addEventListener(
    "click",
    closeModal
  );


  draftBtn.addEventListener(
    "click",
    () =>
      saveAnnouncement(
        true
      )
  );


  publishBtn.addEventListener(
    "click",
    () =>
      saveAnnouncement(
        false
      )
  );


  // =========================================================
  // SEARCH / FILTER
  // =========================================================

  const debouncedLoad =
    debounce(
      loadAnnouncements,
      250
    );

  search.addEventListener(
    "input",
    debouncedLoad
  );

  typeFilter.addEventListener(
    "change",
    loadAnnouncements
  );

  catFilter.addEventListener(
    "change",
    loadAnnouncements
  );


  // =========================================================
  // OUTSIDE CLICK
  // =========================================================

  document.addEventListener(
    "click",
    (event) => {
      if (
        !event.target.closest(
          ".ann-card"
        )
      ) {
        closeAllMenus();
      }
    }
  );


  // =========================================================
  // ESCAPE
  // =========================================================

  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key !== "Escape"
      ) {
        return;
      }

      if (
        !modal.classList.contains(
          "hidden"
        )
      ) {
        closeModal();
      }

      if (
        !viewModal.classList.contains(
          "hidden"
        )
      ) {
        closeViewModal();
      }

      closeAllMenus();
    }
  );


  // =========================================================
  // VIEW MODAL EVENTS
  // =========================================================

  viewBackdrop.addEventListener(
    "click",
    closeViewModal
  );


  viewCloseX.addEventListener(
    "click",
    closeViewModal
  );


  viewCloseBtn.addEventListener(
    "click",
    closeViewModal
  );


  viewEditBtn.addEventListener(
    "click",
    () => {
      if (!viewingId) {
        return;
      }

      closeViewModal();

      openEdit(
        viewingId
      );
    }
  );


  viewArchiveBtn.addEventListener(
    "click",
    async () => {
      if (!viewingId) {
        return;
      }

      const id =
        viewingId;

      await toggleArchive(
        id
      );

      closeViewModal();
    }
  );


  // =========================================================
  // INIT
  // =========================================================

  (async function init() {
    try {
      await fetchCsrfToken();

      await loadAnnouncements();

    } catch (error) {
      console.error(
        "Announcements init failed:",
        error
      );

      setFormError(
        error.message ||
          "Failed to initialize announcements."
      );
    }
  })();

});