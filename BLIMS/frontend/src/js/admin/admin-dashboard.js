// frontend/src/js/admin/admin-dashboard.js

document.addEventListener("DOMContentLoaded", () => {

  const activeKey =
    (
      document.body?.dataset?.page ||
      "dashboard"
    ).trim();


  setupTopbarMenu();
  loadCurrentUser();
  setDashboardDate();

  setupLogout();

  setupCalendarDetailsModals();


  if (isDashboardPage(activeKey)) {

    loadDashboardData();

  }

});



/* =========================================================
   API HELPER
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
    await res.json().catch(() => null);


  if (!res.ok) {

    throw new Error(
      data?.message ||
      `Request failed (${res.status})`
    );

  }


  return data;

}



/* =========================================================
   HELPERS
========================================================= */

function esc(value) {

  return String(value ?? "")

    .replace(/&/g, "&amp;")

    .replace(/</g, "&lt;")

    .replace(/>/g, "&gt;")

    .replace(/"/g, "&quot;")

    .replace(/'/g, "&#039;");

}



function fmtDate(value) {

  try {

    return value
      ? new Date(value).toLocaleString()
      : "";

  } catch {

    return value || "";

  }

}



function fmtDateOnly(value) {

  try {

    return value
      ? new Date(value).toLocaleDateString()
      : "";

  } catch {

    return value || "";

  }

}



function toDateKey(value) {

  if (!value) return "";

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) {
    return "";
  }


  const yyyy =
    d.getFullYear();

  const mm =
    String(d.getMonth() + 1)
      .padStart(2, "0");

  const dd =
    String(d.getDate())
      .padStart(2, "0");


  return `${yyyy}-${mm}-${dd}`;

}



/* =========================================================
   ANNOUNCEMENT CATEGORY LABEL
========================================================= */

/*
 * IMPORTANT
 *
 * The database stores announcement.category as:
 *
 * general
 * events
 * academic
 * priority
 *
 * The calendar should use that database value
 * and only convert it into a display label here.
 *
 * DO NOT use "Announcement" for every announcement.
 */

function announcementCategoryLabel(
  category
) {

  const labels = {

    general:
      "General Announcement",

    events:
      "School Event",

    academic:
      "Academic Notice",

    priority:
      "Priority Alert",

  };


  return (
    labels[category] ||
    "General Announcement"
  );

}



/* =========================================================
   TOPBAR
========================================================= */
async function loadCurrentUser() {
  try {
    const data = await apiFetch("/api/auth/me");
    const user = data?.user;

    const name =
      `${user?.last_name || ""}, ${user?.first_name || ""}`
        .replace(/^,\s*|\s*,$/g, "")
        .trim();

    const nameEl = document.getElementById("tbName");
    const roleEl = document.getElementById("tbRole");

    if (nameEl) {
      nameEl.textContent = name || "User";
    }

    if (roleEl) {
      roleEl.textContent = user?.role
        ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
        : "User";
    }

    const welcomeNameEl =
      document.getElementById("welcomeName");

    if (welcomeNameEl) {
      welcomeNameEl.textContent = name || "User";
    }

  } catch (err) {
    console.error("Failed to load current user:", err);
  }
}

function setDashboardDate() {
  const today = new Date();

  const dateText = today.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  });

  const todayEl =
    document.getElementById("dashboardToday");

  if (todayEl) {
    todayEl.textContent = dateText;
  }
} 

function setupTopbarMenu() {

  const userMenuBtn =
    document.getElementById(
      "userMenuBtn"
    );

  const userMenu =
    document.getElementById(
      "userMenu"
    );

  const userbox =
    document.getElementById(
      "userbox"
    );


  if (
    !userMenuBtn ||
    !userMenu ||
    !userbox
  ) {
    return;
  }


  userMenuBtn.addEventListener(
    "click",
    (ev) => {

      ev.stopPropagation();

      userMenu.classList.toggle(
        "open"
      );

    }
  );


  document.addEventListener(
    "click",
    (ev) => {

      if (
        !userbox.contains(
          ev.target
        )
      ) {

        userMenu.classList.remove(
          "open"
        );

      }

    }
  );

}



/* =========================================================
   LOGOUT
========================================================= */

function setupLogout() {

  const topbarLogout =
    document.getElementById(
      "topbarLogout"
    );


  if (!topbarLogout) return;


  topbarLogout.addEventListener(
    "click",
    async () => {

      try {

        await apiFetch(
          "/api/auth/logout",
          {
            method: "POST"
          }
        );

      } catch (err) {

        console.error(
          "Logout request failed:",
          err
        );

      }


      localStorage.removeItem(
        "token"
      );

      localStorage.removeItem(
        "user"
      );


      window.location.href = "/";

    }
  );

}



/* =========================================================
   PAGE CHECK
========================================================= */

function isDashboardPage(
  activeKey
) {

  if (
    activeKey === "dashboard"
  ) {
    return true;
  }


  const path =
    window.location.pathname ||
    "";


  return path.endsWith(
    "/dashboard.html"
  );

}



/* =========================================================
   DASHBOARD DATA
========================================================= */

async function loadDashboardData() {

  const studentsEl =
    document.getElementById(
      "statStudents"
    );

  const teachersEl =
    document.getElementById(
      "statTeachers"
    );

  const annEl =
    document.getElementById(
      "statAnnouncements"
    );


  try {

    const [
      dashboardData,
      announcementsData,
      eventsData
    ] = await Promise.all([

      apiFetch(
        "/api/admin/dashboard"
      ),

      apiFetch(
        "/api/admin/announcements"
      ).catch((err) => {

        console.warn(
          "Announcements fetch failed:",
          err
        );

        return {
          ok: false,
          data: []
        };

      }),

      apiFetch(
        "/api/admin/events"
      ).catch((err) => {

        console.warn(
          "Events fetch failed:",
          err
        );

        return {
          ok: false,
          data: []
        };

      })

    ]);


    console.log(
      "dashboardData:",
      dashboardData
    );

    console.log(
      "announcementsData:",
      announcementsData
    );

    console.log(
      "eventsData:",
      eventsData
    );


    const announcementsRows =
      Array.isArray(
        announcementsData?.data
      )
        ? announcementsData.data
        : [];


    const eventsRows =
      Array.isArray(
        eventsData?.data
      )
        ? eventsData.data
        : [];


    /*
     * Statistics
     */

    if (studentsEl) {

      studentsEl.textContent =
        String(
          dashboardData?.stats
            ?.totalStudents ?? 0
        );

    }


    if (teachersEl) {

      teachersEl.textContent =
        String(
          dashboardData?.stats
            ?.totalTeachers ?? 0
        );

    }


    if (annEl) {

      /*
       * Count actual announcements.
       *
       * Archived announcements are
       * excluded from the dashboard.
       */

      const activeAnnouncements =
        announcementsRows.filter(
          (a) => !a?.archived
        );


      annEl.textContent =
        String(
          activeAnnouncements.length
        );

    }


    /*
     * Build calendar data
     */

    const calendarEvents =
      buildCalendarItems({

        announcements:
          announcementsRows,

        events:
          eventsRows

      });


    console.log(
      "calendarEvents:",
      calendarEvents
    );


    setupMiniCalendar({

      events:
        calendarEvents,

      persistSelected:
        true

    });


  } catch (err) {

    console.error(
      "Dashboard load failed:",
      err
    );


    if (studentsEl) {
      studentsEl.textContent = "—";
    }


    if (teachersEl) {
      teachersEl.textContent = "—";
    }


    if (annEl) {
      annEl.textContent = "—";
    }


    setupMiniCalendar({

      events: {},

      persistSelected: true

    });

  }

}



/* =========================================================
   BUILD CALENDAR ITEMS
========================================================= */

function buildCalendarItems({
  announcements = [],
  events = []
}) {

  const map = {};


  function pushItem(
    dateKey,
    item
  ) {

    if (!dateKey) {
      return;
    }


    if (!map[dateKey]) {
      map[dateKey] = [];
    }


    map[dateKey].push(
      item
    );

  }



  /*
   * =======================================================
   * ANNOUNCEMENTS
   * =======================================================
   */

  announcements.forEach(
    (a) => {

      /*
       * Don't show archived
       * announcements.
       */

      if (a?.archived) {
        return;
      }


      const title =
        a?.title ||
        a?.headline ||
        a?.subject ||
        a?.name ||
        "Untitled Announcement";


      /*
       * Your announcement page uses
       * publishAt.
       *
       * So publishAt is checked first.
       */

      const rawDate =
        a?.publishAt ||
        a?.publishedAt ||
        a?.postedAt ||
        a?.createdAt ||
        a?.dateCreated ||
        a?.updatedAt;


      const dateKey =
        toDateKey(rawDate);


      if (!dateKey) {
        return;
      }


      /*
       * IMPORTANT FIX
       *
       * Get the real category from MongoDB.
       *
       * Example:
       *
       * "general"  -> General Announcement
       * "events"   -> School Event
       * "academic" -> Academic Notice
       * "priority" -> Priority Alert
       */

      const rawCategory =
        String(
          a?.category ||
          "general"
        )
          .trim()
          .toLowerCase();


      const displayCategory =
        announcementCategoryLabel(
          rawCategory
        );


      pushItem(
        dateKey,
        {

          id:
            a?._id ||
            a?.id ||
            "",

          type:
            "announcement",

          /*
           * FIXED:
           *
           * Previously this was:
           *
           * category: "Announcement"
           *
           * That caused every announcement
           * to display the same category.
           */

          category:
            displayCategory,

          title:
            title,

          message:
            a?.message ||
            "",

          /*
           * Keep the original database
           * category available.
           *
           * This remains:
           *
           * general
           * events
           * academic
           * priority
           */

          announcementCategory:
            rawCategory,

          publishAt:
            a?.publishAt ||
            null,

          createdAt:
            a?.createdAt ||
            null,

          archived:
            !!a?.archived

        }
      );

    }
  );



  /*
   * =======================================================
   * EVENTS
   * =======================================================
   */

  events.forEach(
    (e) => {

      const title =
        e?.title ||
        e?.name ||
        "Untitled Event";


      const rawDate =
        e?.start ||
        e?.startDate ||
        e?.eventDate ||
        e?.date ||
        e?.createdAt;


      const dateKey =
        toDateKey(rawDate);


      if (!dateKey) {
        return;
      }


      pushItem(
        dateKey,
        {

          id:
            e?._id ||
            e?.id ||
            "",

          type:
            "event",

          category:
            "Event",

          title:
            title,

          description:
            e?.description ||
            e?.details ||
            e?.message ||
            "",

          date:
            rawDate,

          location:
            e?.location ||
            "",

          status:
            e?.status ||
            ""

        }
      );

    }
  );


  return map;

}



/* =========================================================
   RECENT ACCOUNTS
========================================================= */

function renderRecentAccounts(
  rows
) {

  const tbody =
    document.getElementById(
      "recentAccountsBody"
    );


  if (!tbody) {
    return;
  }


  if (!rows.length) {

    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="opacity:.7;">
          No recent accounts found.
        </td>
      </tr>
    `;

    return;
  }


  tbody.innerHTML =
    rows
      .map((r) => {

        const role =
          esc(r.role || "");

        const name =
          esc(
            r.name ||
            r.username ||
            ""
          );

        const email =
          esc(r.email || "");

        const contact =
          esc(
            r.contactNo ||
            ""
          );

        const date =
          esc(
            fmtDate(
              r.dateCreated
            )
          );


        return `
          <tr>

            <td>${role}</td>

            <td>${name}</td>

            <td>${email}</td>

            <td>${contact}</td>

            <td>${date}</td>

          </tr>
        `;

      })
      .join("");

}



/* =========================================================
   CALENDAR
========================================================= */

function setupMiniCalendar(
  options = {}
) {

  const title =
    document.getElementById(
      "calTitle"
    );

  const grid =
    document.getElementById(
      "calGrid"
    );

  const prev =
    document.getElementById(
      "calPrev"
    );

  const next =
    document.getElementById(
      "calNext"
    );

  const monthBtn =
    document.getElementById(
      "calendarMonthBtn"
    );

  const weekBtn =
    document.getElementById(
      "calendarWeekBtn"
    );

  const daysHeader =
    document.getElementById(
      "calDays"
    );


  if (
    !title ||
    !grid ||
    !prev ||
    !next
  ) {
    return;
  }


  const EVENTS =
    options.events || {};


  const PERSIST =
    !!options.persistSelected;


  const SELECT_KEY =
    "admin_calendar_selected_v1";


  const today =
    new Date();


  const todayY =
    today.getFullYear();

  const todayM =
    today.getMonth();

  const todayD =
    today.getDate();


  let current =
    new Date(
      todayY,
      todayM,
      1
    );


  let selected =
    new Date(
      todayY,
      todayM,
      todayD
    );


  let viewMode =
    "month";


  /*
   * Restore selected date.
   */

  if (PERSIST) {

    const saved =
      localStorage.getItem(
        SELECT_KEY
      );


    if (saved) {

      const parsed =
        new Date(saved);


      if (
        !Number.isNaN(
          parsed.getTime()
        )
      ) {

        selected =
          new Date(
            parsed.getFullYear(),
            parsed.getMonth(),
            parsed.getDate()
          );

      }

    }

  }



  const pad2 =
    (n) =>
      String(n).padStart(
        2,
        "0"
      );


  const toKey =
    (d) =>
      `${d.getFullYear()}-${pad2(
        d.getMonth() + 1
      )}-${pad2(
        d.getDate()
      )}`;



  const isSameDay =
    (a, b) =>
      a.getFullYear() ===
        b.getFullYear() &&

      a.getMonth() ===
        b.getMonth() &&

      a.getDate() ===
        b.getDate();



  /*
   * Set active view button.
   */

  function updateViewButtons() {

    monthBtn?.classList.toggle(
      "active",
      viewMode === "month"
    );


    weekBtn?.classList.toggle(
      "active",
      viewMode === "week"
    );

  }



  /*
   * Create event item.
   */

  function createEventItem(
    item
  ) {

    const button =
      document.createElement(
        "button"
      );


    button.type =
      "button";


    button.className =
      `cal-event-item ${
        item.type || ""
      }`;


    button.innerHTML = `

      <span
        class="cal-event-category"
      >
        ${esc(
          item.category ||
          "Calendar Item"
        )}
      </span>

      <span
        class="cal-event-title"
      >
        ${esc(
          item.title ||
          "Untitled"
        )}
      </span>

    `;


    button.title =
      "View full details";


    button.addEventListener(
      "click",
      (event) => {

        event.stopPropagation();

        openCalendarItemDetails(
          item
        );

      }
    );


    return button;

  }



  /*
   * Create events for a day.
   */

  function createEventList(
    evts
  ) {

    if (
      !Array.isArray(evts) ||
      !evts.length
    ) {

      return null;

    }


    const list =
      document.createElement(
        "div"
      );


    list.className =
      "cal-event-list";


    const visible =
      evts.slice(
        0,
        3
      );


    visible.forEach(
      (item) => {

        list.appendChild(
          createEventItem(
            item
          )
        );

      }
    );


    if (
      evts.length > 3
    ) {

      const more =
        document.createElement(
          "button"
        );


      more.type =
        "button";


      more.className =
        "cal-event-more";


      more.textContent =
        `+${evts.length - 3} more`;


      more.addEventListener(
        "click",
        (event) => {

          event.stopPropagation();

          openCalendarDayDetails(
            evts
          );

        }
      );


      list.appendChild(
        more
      );

    }


    return list;

  }



  /*
   * Render MONTH.
   */

  function renderMonth() {

    grid.innerHTML = "";


    grid.className =
      "cal-grid";


    if (daysHeader) {

      daysHeader.style.display =
        "grid";

    }


    const year =
      current.getFullYear();


    const month =
      current.getMonth();


    const monthName =
      current.toLocaleString(
        "en-US",
        {
          month: "long"
        }
      );


    title.textContent =
      `${monthName} ${year}`;


    const firstDay =
      new Date(
        year,
        month,
        1
      ).getDay();


    const daysInMonth =
      new Date(
        year,
        month + 1,
        0
      ).getDate();


    /*
     * Empty cells before
     * first day.
     */

    for (
      let i = 0;
      i < firstDay;
      i++
    ) {

      const empty =
        document.createElement(
          "div"
        );


      empty.className =
        "cal-cell is-empty";


      grid.appendChild(
        empty
      );

    }



    /*
     * Days.
     */

    for (
      let day = 1;
      day <= daysInMonth;
      day++
    ) {

      const dateObj =
        new Date(
          year,
          month,
          day
        );


      const key =
        toKey(dateObj);


      const cell =
        document.createElement(
          "div"
        );


      cell.className =
        "cal-cell cal-day";


      cell.dataset.date =
        key;


      /*
       * Date number.
       */

      const number =
        document.createElement(
          "span"
        );


      number.textContent =
        String(day);


      number.className =
        "cal-day-number";


      cell.appendChild(
        number
      );



      /*
       * Today.
       */

      if (
        year === todayY &&
        month === todayM &&
        day === todayD
      ) {

        cell.classList.add(
          "today"
        );

      }



      /*
       * Selected.
       */

      if (
        isSameDay(
          dateObj,
          selected
        )
      ) {

        cell.classList.add(
          "selected"
        );

      }



      /*
       * Calendar items.
       */

      const evts =
        EVENTS[key];


      if (
        Array.isArray(evts) &&
        evts.length
      ) {

        const eventList =
          createEventList(
            evts
          );


        if (eventList) {

          cell.appendChild(
            eventList
          );

        }

      }



      /*
       * Clicking empty area
       * selects the day.
       */

      cell.addEventListener(
        "click",
        () => {

          selected =
            dateObj;


          if (PERSIST) {

            localStorage.setItem(
              SELECT_KEY,
              selected.toISOString()
            );

          }


          grid
            .querySelectorAll(
              ".cal-day.selected"
            )
            .forEach(
              (el) =>
                el.classList.remove(
                  "selected"
                )
            );


          cell.classList.add(
            "selected"
          );


          window.dispatchEvent(
            new CustomEvent(
              "calendar:select",
              {
                detail: {
                  date: key,

                  events:
                    EVENTS[key] ||
                    []
                }
              }
            )
          );

        }
      );


      grid.appendChild(
        cell
      );

    }

  }



  /*
   * Get Sunday of selected week.
   */

  function getWeekStart(
    date
  ) {

    const d =
      new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate()
      );


    const day =
      d.getDay();


    d.setDate(
      d.getDate() - day
    );


    return d;

  }



  /*
   * Render WEEK.
   */

  function renderWeek() {

    grid.innerHTML = "";


    grid.className =
      "cal-grid week-view";


    if (daysHeader) {

      daysHeader.style.display =
        "none";

    }


    const weekStart =
      getWeekStart(
        selected
      );


    const weekEnd =
      new Date(
        weekStart
      );


    weekEnd.setDate(
      weekEnd.getDate() + 6
    );


    const startText =
      weekStart.toLocaleString(
        "en-US",
        {
          month: "short",
          day: "numeric"
        }
      );


    const endText =
      weekEnd.toLocaleString(
        "en-US",
        {
          month: "short",
          day: "numeric",
          year: "numeric"
        }
      );


    title.textContent =
      `${startText} – ${endText}`;



    for (
      let i = 0;
      i < 7;
      i++
    ) {

      const date =
        new Date(
          weekStart
        );


      date.setDate(
        date.getDate() + i
      );


      const key =
        toKey(date);


      const cell =
        document.createElement(
          "div"
        );


      cell.className =
        "cal-cell week-day";


      cell.dataset.date =
        key;



      /*
       * Week header.
       */

      const header =
        document.createElement(
          "div"
        );


      header.className =
        "cal-week-header";


      const dayName =
        document.createElement(
          "span"
        );


      dayName.className =
        "cal-week-name";


      dayName.textContent =
        date.toLocaleString(
          "en-US",
          {
            weekday: "short"
          }
        );


      const dayNumber =
        document.createElement(
          "span"
        );


      dayNumber.className =
        "cal-week-number";


      dayNumber.textContent =
        String(
          date.getDate()
        );


      header.appendChild(
        dayName
      );


      header.appendChild(
        dayNumber
      );


      cell.appendChild(
        header
      );



      /*
       * Today.
       */

      if (
        isSameDay(
          date,
          today
        )
      ) {

        cell.classList.add(
          "today"
        );

      }



      /*
       * Selected.
       */

      if (
        isSameDay(
          date,
          selected
        )
      ) {

        cell.classList.add(
          "selected"
        );

      }



      /*
       * Events.
       */

      const evts =
        EVENTS[key];


      if (
        Array.isArray(evts) &&
        evts.length
      ) {

        const eventList =
          createEventList(
            evts
          );


        if (eventList) {

          cell.appendChild(
            eventList
          );

        }

      }



      /*
       * Select day.
       */

      cell.addEventListener(
        "click",
        () => {

          selected =
            date;


          if (PERSIST) {

            localStorage.setItem(
              SELECT_KEY,
              selected.toISOString()
            );

          }


          render();


          window.dispatchEvent(
            new CustomEvent(
              "calendar:select",
              {
                detail: {
                  date: key,

                  events:
                    EVENTS[key] ||
                    []
                }
              }
            )
          );

        }
      );


      grid.appendChild(
        cell
      );

    }

  }



  /*
   * Render current view.
   */

  function render() {

    updateViewButtons();


    if (
      viewMode === "month"
    ) {

      renderMonth();

    } else {

      renderWeek();

    }

  }



  /*
   * MONTH button.
   */

  monthBtn?.addEventListener(
    "click",
    () => {

      viewMode =
        "month";

      render();

    }
  );



  /*
   * WEEK button.
   */

  weekBtn?.addEventListener(
    "click",
    () => {

      viewMode =
        "week";

      render();

    }
  );



  /*
   * Previous.
   */

  prev.addEventListener(
    "click",
    () => {

      if (
        viewMode === "month"
      ) {

        current =
          new Date(
            current.getFullYear(),
            current.getMonth() - 1,
            1
          );

      } else {

        selected =
          new Date(
            selected.getFullYear(),
            selected.getMonth(),
            selected.getDate() - 7
          );

      }


      render();

    }
  );



  /*
   * Next.
   */

  next.addEventListener(
    "click",
    () => {

      if (
        viewMode === "month"
      ) {

        current =
          new Date(
            current.getFullYear(),
            current.getMonth() + 1,
            1
          );

      } else {

        selected =
          new Date(
            selected.getFullYear(),
            selected.getMonth(),
            selected.getDate() + 7
          );

      }


      render();

    }
  );



  render();

}



/* =========================================================
   CALENDAR DETAILS
========================================================= */

function openCalendarItemDetails(
  item
) {

  const modal =
    document.getElementById(
      "calendarDetailsModal"
    );


  const category =
    document.getElementById(
      "calendarDetailsCategory"
    );


  const title =
    document.getElementById(
      "calendarDetailsTitle"
    );


  const body =
    document.getElementById(
      "calendarDetailsBody"
    );


  const meta =
    document.getElementById(
      "calendarDetailsMeta"
    );


  if (
    !modal ||
    !category ||
    !title ||
    !body ||
    !meta
  ) {
    return;
  }


  const isAnnouncement =
    item.type ===
    "announcement";


  category.textContent =
    item.category ||
    (
      isAnnouncement
        ? "Announcement"
        : "Event"
    );


  title.textContent =
    item.title ||
    "Untitled";


  /*
   * ANNOUNCEMENT
   */

  if (isAnnouncement) {

    body.innerHTML = `

      <div
        class="calendar-detail-section"
      >

        <div
          class="calendar-detail-label"
        >
          Message
        </div>

        <div
          class="calendar-detail-message"
        >
          ${esc(
            item.message ||
            "No message available."
          ).replace(
            /\n/g,
            "<br>"
          )}
        </div>

      </div>

    `;


    const metaParts = [];


    if (
      item.announcementCategory
    ) {

      metaParts.push(
        `Category: ${esc(
          announcementCategoryLabel(
            item.announcementCategory
          )
        )}`
      );

    }


    if (
      item.publishAt
    ) {

      metaParts.push(
        `Publish: ${esc(
          fmtDate(
            item.publishAt
          )
        )}`
      );

    }


    if (
      item.createdAt
    ) {

      metaParts.push(
        `Posted: ${esc(
          fmtDate(
            item.createdAt
          )
        )}`
      );

    }


    meta.textContent =
      metaParts.join(
        " • "
      );

  }



  /*
   * EVENT
   */

  else {

    body.innerHTML = `

      <div
        class="calendar-detail-section"
      >

        <div
          class="calendar-detail-label"
        >
          Details
        </div>

        <div
          class="calendar-detail-message"
        >
          ${
            esc(
              item.description ||
              "No additional details available."
            ).replace(
              /\n/g,
              "<br>"
            )
          }
        </div>

      </div>

      ${
        item.location
          ? `

            <div
              class="calendar-detail-section"
            >

              <div
                class="calendar-detail-label"
              >
                Location
              </div>

              <div
                class="calendar-detail-message"
              >
                ${esc(
                  item.location
                )}
              </div>

            </div>

          `
          : ""
      }

    `;


    const metaParts = [];


    if (item.date) {

      metaParts.push(
        `Date: ${esc(
          fmtDate(
            item.date
          )
        )}`
      );

    }


    if (item.status) {

      metaParts.push(
        `Status: ${esc(
          item.status
        )}`
      );

    }


    meta.textContent =
      metaParts.join(
        " • "
      );

  }


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



/* =========================================================
   MULTIPLE ITEMS ON SAME DAY
========================================================= */

function openCalendarDayDetails(
  items
) {

  const modal =
    document.getElementById(
      "calendarDayDetailsModal"
    );


  const list =
    document.getElementById(
      "calendarDayDetailsList"
    );


  if (!modal || !list) {
    return;
  }


  list.innerHTML = "";


  items.forEach(
    (item) => {

      const button =
        document.createElement(
          "button"
        );


      button.type =
        "button";


      button.className =
        `calendar-day-detail-item ${
          item.type || ""
        }`;


      button.innerHTML = `

        <span
          class="calendar-day-detail-category"
        >
          ${esc(
            item.category ||
            "Calendar Item"
          )}
        </span>

        <span
          class="calendar-day-detail-title"
        >
          ${esc(
            item.title ||
            "Untitled"
          )}
        </span>

      `;


      button.addEventListener(
        "click",
        () => {

          closeCalendarDayDetails();

          openCalendarItemDetails(
            item
          );

        }
      );


      list.appendChild(
        button
      );

    }
  );


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



/* =========================================================
   CLOSE CALENDAR MODALS
========================================================= */

function closeCalendarDetails() {

  const modal =
    document.getElementById(
      "calendarDetailsModal"
    );


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



function closeCalendarDayDetails() {

  const modal =
    document.getElementById(
      "calendarDayDetailsModal"
    );


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



/* =========================================================
   MODAL EVENTS
========================================================= */

function setupCalendarDetailsModals() {

  const modal =
    document.getElementById(
      "calendarDetailsModal"
    );


  const closeBtn =
    document.getElementById(
      "calendarDetailsClose"
    );


  const backdrop =
    document.getElementById(
      "calendarDetailsBackdrop"
    );


  if (modal) {

    closeBtn?.addEventListener(
      "click",
      closeCalendarDetails
    );


    backdrop?.addEventListener(
      "click",
      closeCalendarDetails
    );

  }



  const dayModal =
    document.getElementById(
      "calendarDayDetailsModal"
    );


  const dayClose =
    document.getElementById(
      "calendarDayDetailsClose"
    );


  const dayBackdrop =
    document.getElementById(
      "calendarDayDetailsBackdrop"
    );


  if (dayModal) {

    dayClose?.addEventListener(
      "click",
      closeCalendarDayDetails
    );


    dayBackdrop?.addEventListener(
      "click",
      closeCalendarDayDetails
    );

  }



  document.addEventListener(
    "keydown",
    (event) => {

      if (
        event.key !== "Escape"
      ) {
        return;
      }


      closeCalendarDetails();

      closeCalendarDayDetails();

    }
  );

}