// frontend/src/js/teacher/teacher-my-schedule.js

document.addEventListener("DOMContentLoaded", () => {

  // =========================================================
  // TOPBAR USER MENU
  // =========================================================

  const userMenuBtn =
    document.getElementById("userMenuBtn");

  const userMenu =
    document.getElementById("userMenu");

  const userbox =
    document.getElementById("userbox");


  if (
    userMenuBtn &&
    userMenu &&
    userbox
  ) {

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


  // =========================================================
  // LOGOUT
  // =========================================================

  const topbarLogout =
    document.getElementById(
      "topbarLogout"
    );


  if (topbarLogout) {

    topbarLogout.addEventListener(
      "click",
      async () => {

        try {

          await fetch(
            "/api/auth/logout",
            {
              method: "POST",
              credentials: "include",
            }
          );

        } catch (_) {}


        localStorage.removeItem(
          "token"
        );

        localStorage.removeItem(
          "user"
        );


        window.location.href =
          "../../login.html";

      }
    );

  }


  // =========================================================
  // HELPERS
  // =========================================================

  function esc(value) {

    return String(value ?? "")
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      )
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /'/g,
        "&#39;"
      );

  }


  async function apiFetch(
    url,
    options = {}
  ) {

    const res =
      await fetch(
        url,
        {
          credentials:
            "include",

          headers: {
            "Content-Type":
              "application/json",

            ...(options.headers || {}),
          },

          ...options,
        }
      );


    let data = null;


    try {

      data =
        await res.json();

    } catch (_) {

      data = null;

    }


    if (!res.ok) {

      const message =
        data?.message ||
        `Request failed (${res.status})`;


      throw new Error(
        message
      );

    }


    return data;

  }


  // =========================================================
  // TIME
  // =========================================================

  function to12Hour(value) {

    if (
      value == null ||
      value === ""
    ) {

      return "—";

    }


    const raw =
      String(value).trim();


    // Already formatted
    if (
      raw.includes(":") &&
      /am|pm/i.test(raw)
    ) {

      return raw;

    }


    // 13:00
    if (
      /^\d{1,2}:\d{2}$/.test(
        raw
      )
    ) {

      const [hh, mm] =
        raw
          .split(":")
          .map(Number);


      const h12 =
        ((hh + 11) % 12) + 1;


      const ampm =
        hh >= 12
          ? "PM"
          : "AM";


      return `${h12}:${String(
        mm
      ).padStart(
        2,
        "0"
      )} ${ampm}`;

    }


    // Numeric hour
    const num =
      Number(raw);


    if (
      !Number.isNaN(num)
    ) {

      const h12 =
        ((num + 11) % 12) + 1;


      const ampm =
        num >= 12
          ? "PM"
          : "AM";


      return `${h12}:00 ${ampm}`;

    }


    return raw;

  }


  function parseTimeToSortable(
    value
  ) {

    const raw =
      String(value || "")
        .trim()
        .toLowerCase();


    if (!raw) {

      return 0;

    }


    // 13:30
    if (
      /^\d{1,2}:\d{2}$/.test(
        raw
      )
    ) {

      const [hour, minute] =
        raw
          .split(":")
          .map(Number);


      return (
        hour +
        minute / 60
      );

    }


    // 1:30 PM
    const match =
      raw.match(
        /^(\d{1,2}):(\d{2})\s*(am|pm)$/i
      );


    if (match) {

      let hour =
        Number(match[1]);


      const minute =
        Number(match[2]);


      const ampm =
        match[3].toLowerCase();


      if (
        ampm === "pm" &&
        hour !== 12
      ) {

        hour += 12;

      }


      if (
        ampm === "am" &&
        hour === 12
      ) {

        hour = 0;

      }


      return (
        hour +
        minute / 60
      );

    }


    const number =
      Number(raw);


    return Number.isNaN(
      number
    )
      ? 0
      : number;

  }


  // =========================================================
  // DAY
  // =========================================================

  function normalizeDay(day) {

    const value =
      String(day || "")
        .trim()
        .toLowerCase();


    const map = {

      mon: "mon",
      monday: "mon",

      tue: "tue",
      tues: "tue",
      tuesday: "tue",

      wed: "wed",
      wednesday: "wed",

      thu: "thu",
      thur: "thu",
      thurs: "thu",
      thursday: "thu",

      fri: "fri",
      friday: "fri",

    };


    return (
      map[value] || ""
    );

  }


  function dayLabel(dayKey) {

    const map = {

      mon: "Monday",
      tue: "Tuesday",
      wed: "Wednesday",
      thu: "Thursday",
      fri: "Friday",

    };


    return (
      map[dayKey] ||
      "Monday"
    );

  }


  // =========================================================
  // ROOM
  // =========================================================

  function formatRoom(value) {

    if (
      value == null ||
      String(value).trim() === ""
    ) {

      return "—";

    }


    let room =
      String(value)
        .trim();


    /*
     * Prevent:
     *
     * Room Room1
     *
     * Room Room 1
     *
     * room1
     *
     * room 1
     *
     * from displaying inconsistently.
     */


    room =
      room.replace(
        /^room\s*/i,
        ""
      );


    room =
      room.trim();


    if (!room) {

      return "—";

    }


    /*
     * Convert:
     *
     * 1   -> Room 1
     * 01  -> Room 01
     * Room1 -> Room 1
     */


    return `Room ${room}`;

  }


  // =========================================================
  // NORMALIZE SCHEDULE ITEM
  // =========================================================

  function normalizeItem(
    item,
    index
  ) {

    const day =
      normalizeDay(
        item.day ||
        item.scheduleDay ||
        item.weekday
      );


    const grade =
      item.grade ||
      item.gradeLevel ||
      "";


    const section =
      item.section ||
      "";


    const classLabel =
      item.classLabel ||
      item.gradeSection ||
      [
        grade,
        section,
      ]
        .filter(Boolean)
        .join(" - ") ||
      item.className ||
      "Unassigned Class";


    return {

      id:
        item.id ||
        item._id ||
        `sched-${index}`,

      day,

      subject:
        item.subject ||
        item.subjectName ||
        item.title ||
        "Untitled Subject",

      classLabel,

      room:
        item.room ||
        item.roomName ||
        "",

      schoolYear:
        item.schoolYear ||
        item.sy ||
        "",

      startText:
        to12Hour(
          item.startTime ||
          item.start ||
          item.startHour
        ),

      endText:
        to12Hour(
          item.endTime ||
          item.end ||
          item.endHour
        ),

      startSort:
        parseTimeToSortable(
          item.startTime ||
          item.start ||
          item.startHour ||
          ""
        ),

      raw:
        item,

    };

  }


  // =========================================================
  // DOM
  // =========================================================

  const schedGradeSection =
    document.getElementById(
      "schedGradeSection"
    );


  const weekView =
    document.getElementById(
      "weekView"
    );


  const dayView =
    document.getElementById(
      "dayView"
    );


  const dayViewTitle =
    document.getElementById(
      "dayViewTitle"
    );


  const dayViewList =
    document.getElementById(
      "dayViewList"
    );


  const schedEmpty =
    document.getElementById(
      "schedEmpty"
    );


  const viewWeekBtn =
    document.getElementById(
      "viewWeekBtn"
    );


  const viewDayBtn =
    document.getElementById(
      "viewDayBtn"
    );


  const daySelect =
    document.getElementById(
      "daySelect"
    );


  const days = [
    "mon",
    "tue",
    "wed",
    "thu",
    "fri",
  ];


  let scheduleItems = [];


  let currentMode =
    "week";


  // =========================================================
  // META
  // =========================================================

  function setMeta(items) {

    /*
     * Only display the class/section.
     *
     * Room and School Year are intentionally
     * removed from the header.
     */

    if (
      schedGradeSection
    ) {

      if (!items.length) {

        schedGradeSection.textContent =
          "—";

      } else {

        schedGradeSection.textContent =
          items[0].classLabel ||
          "—";

      }

    }

  }


  // =========================================================
  // EMPTY STATE
  // =========================================================

  function showEmpty(
    show,
    message =
      "No schedule available yet."
  ) {

    if (!schedEmpty) {

      return;

    }


    schedEmpty.textContent =
      message;


    schedEmpty.classList.toggle(
      "hidden",
      !show
    );

  }


  // =========================================================
  // SCHEDULE CARD
  // =========================================================

  function buildScheduleCard(
    item
  ) {

    const div =
      document.createElement(
        "div"
      );


    div.className =
      "sched-item";


    const roomText =
      formatRoom(
        item.room
      );


    div.innerHTML = `

      <div class="sched-item-time">
        ${esc(
          item.startText
        )} - ${esc(
          item.endText
        )}
      </div>

      <div class="sched-item-title">
        ${esc(
          item.subject
        )}
      </div>

      <div class="sched-item-meta">
        ${esc(
          item.classLabel
        )}
      </div>

      <div class="sched-item-room">
        ${esc(
          roomText
        )}
      </div>

    `;


    return div;

  }


  // =========================================================
  // WEEK COLUMNS
  // =========================================================

  function getWeekColumns() {

    if (!weekView) {

      return {};

    }


    const cols =
      Array.from(
        weekView.querySelectorAll(
          ".sched-col"
        )
      );


    return {

      mon:
        cols[0] || null,

      tue:
        cols[1] || null,

      wed:
        cols[2] || null,

      thu:
        cols[3] || null,

      fri:
        cols[4] || null,

    };

  }


  function clearWeekColumns() {

    const columns =
      getWeekColumns();


    Object.entries(
      columns
    ).forEach(
      ([key, column]) => {

        if (!column) {

          return;

        }


        column.innerHTML =
          "";


        const head =
          document.createElement(
            "div"
          );


        head.className =
          "sched-col-head";


        head.textContent =
          dayLabel(key);


        column.appendChild(
          head
        );

      }
    );

  }


  // =========================================================
  // WEEK VIEW
  // =========================================================

  function renderWeekView(
    items
  ) {

    clearWeekColumns();


    const columns =
      getWeekColumns();


    days.forEach(
      (dayKey) => {

        const column =
          columns[dayKey];


        if (!column) {

          return;

        }


        const list =
          items
            .filter(
              (item) =>
                item.day ===
                dayKey
            )
            .sort(
              (a, b) =>
                a.startSort -
                b.startSort
            );


        if (!list.length) {

          const empty =
            document.createElement(
              "div"
            );


          empty.className =
            "sched-slot-empty";


          empty.textContent =
            "No class";


          column.appendChild(
            empty
          );


          return;

        }


        list.forEach(
          (item) => {

            column.appendChild(
              buildScheduleCard(
                item
              )
            );

          }
        );

      }
    );

  }


  // =========================================================
  // DAY VIEW
  // =========================================================

  function renderDayView(
    items,
    dayKey
  ) {

    if (dayViewTitle) {

      dayViewTitle.textContent =
        dayLabel(dayKey);

    }


    if (!dayViewList) {

      return;

    }


    dayViewList.innerHTML =
      "";


    const list =
      items
        .filter(
          (item) =>
            item.day ===
            dayKey
        )
        .sort(
          (a, b) =>
            a.startSort -
            b.startSort
        );


    if (!list.length) {

      const empty =
        document.createElement(
          "div"
        );


      empty.className =
        "sched-slot-empty";


      empty.textContent =
        "No class for this day.";


      dayViewList.appendChild(
        empty
      );


      return;

    }


    list.forEach(
      (item) => {

        dayViewList.appendChild(
          buildScheduleCard(
            item
          )
        );

      }
    );

  }


  // =========================================================
  // VIEW MODE
  // =========================================================

  function updateModeUI() {

    const isWeek =
      currentMode ===
      "week";


    if (weekView) {

      weekView.classList.toggle(
        "hidden",
        !isWeek
      );

    }


    if (dayView) {

      dayView.classList.toggle(
        "hidden",
        isWeek
      );

    }


    if (viewWeekBtn) {

      viewWeekBtn.classList.toggle(
        "active",
        isWeek
      );


      viewWeekBtn.setAttribute(
        "aria-selected",
        String(isWeek)
      );

    }


    if (viewDayBtn) {

      viewDayBtn.classList.toggle(
        "active",
        !isWeek
      );


      viewDayBtn.setAttribute(
        "aria-selected",
        String(!isWeek)
      );

    }


    if (daySelect) {

      daySelect.disabled =
        isWeek;

    }

  }


  // =========================================================
  // RENDER ALL
  // =========================================================

  function renderAll() {

    const hasItems =
      scheduleItems.length >
      0;


    showEmpty(
      !hasItems,
      "No schedule available yet."
    );


    if (!hasItems) {

      clearWeekColumns();


      if (dayViewList) {

        dayViewList.innerHTML =
          "";

      }


      setMeta([]);


      return;

    }


    setMeta(
      scheduleItems
    );


    renderWeekView(
      scheduleItems
    );


    renderDayView(
      scheduleItems,
      daySelect?.value ||
        "mon"
    );

  }


  // =========================================================
  // EXTRACT SCHEDULE DATA
  // =========================================================

  function extractScheduleItems(
    data
  ) {

    /*
     * Supports the common API response shapes:
     *
     * {
     *   ok: true,
     *   data: [...]
     * }
     *
     * {
     *   ok: true,
     *   items: [...]
     * }
     *
     * {
     *   ok: true,
     *   data: {
     *     items: [...]
     *   }
     * }
     *
     * {
     *   ok: true,
     *   schedule: [...]
     * }
     */


    if (
      Array.isArray(
        data?.data
      )
    ) {

      return data.data;

    }


    if (
      Array.isArray(
        data?.items
      )
    ) {

      return data.items;

    }


    if (
      Array.isArray(
        data?.data?.items
      )
    ) {

      return data.data.items;

    }


    if (
      Array.isArray(
        data?.schedule
      )
    ) {

      return data.schedule;

    }


    return [];

  }


  // =========================================================
  // FETCH TEACHER SCHEDULE
  // =========================================================

  async function loadTeacherSchedule() {

    try {

      console.log(
        "📚 Loading teacher schedule..."
      );


      const data =
        await apiFetch(
          "/api/teacher/my-schedule"
        );


      console.log(
        "📚 Teacher schedule response:",
        data
      );


      if (
        data &&
        data.ok === false
      ) {

        throw new Error(
          data.message ||
          "Failed to load schedule."
        );

      }


      const rawItems =
        extractScheduleItems(
          data
        );


      if (
        !Array.isArray(
          rawItems
        )
      ) {

        console.warn(
          "Schedule response is not an array:",
          rawItems
        );


        scheduleItems = [];

      } else {

        scheduleItems =
          rawItems
            .map(
              normalizeItem
            )
            .filter(
              (item) =>
                item.day
            );

      }


      console.log(
        "📚 Normalized schedule:",
        scheduleItems
      );


      renderAll();

    } catch (err) {

      console.error(
        "❌ loadTeacherSchedule error:",
        err
      );


      scheduleItems = [];


      renderAll();


      showEmpty(
        true,
        err.message ||
          "Failed to load schedule."
      );

    }

  }


  // =========================================================
  // EVENTS
  // =========================================================

  viewWeekBtn?.addEventListener(
    "click",
    () => {

      currentMode =
        "week";


      updateModeUI();

    }
  );


  viewDayBtn?.addEventListener(
    "click",
    () => {

      currentMode =
        "day";


      updateModeUI();


      renderDayView(
        scheduleItems,
        daySelect?.value ||
          "mon"
      );

    }
  );


  daySelect?.addEventListener(
    "change",
    () => {

      renderDayView(
        scheduleItems,
        daySelect.value
      );

    }
  );


  // =========================================================
  // INIT
  // =========================================================

  updateModeUI();

  loadTeacherSchedule();

});