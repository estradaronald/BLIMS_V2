// frontend/src/js/admin/sidebar.js

document.addEventListener("DOMContentLoaded", async () => {

  const STORAGE_KEY =
    "admin_sidebar_collapsed_v1";

  const FLOAT_GAP = 14;
  const FLOAT_NUDGE = 10;

  /*
   * Bump this whenever sidebar.html structure changes.
   */
  const SIDEBAR_CACHE_KEY =
    "__adminSidebarHTML_v8";


  /* =====================================================
     CURRENT PAGE
  ====================================================== */

  const rawKey =
    (document.body?.dataset?.page || "").trim();

  const activeKey =
    rawKey || "dashboard";


  /* =====================================================
     SIDEBAR MOUNT
  ====================================================== */

  const mount =
    document.getElementById("sidebar-mount");

  if (!mount) return;


  /* =====================================================
     HELPERS
  ====================================================== */

  const getSidebar = () =>
    document.getElementById("sidebar");


  const getFloatBtn = () =>
    document.getElementById(
      "sidebarFloatToggle"
    ) ||
    document.getElementById(
      "sidebarToggle"
    );


  const getBellIcon = () =>
    document.querySelector(".tb-icon") ||
    document.querySelector(
      ".topbar .tb-icon"
    ) ||
    document.querySelector(
      ".topbar .icon-btn"
    );


  const normalize = (value) =>
    (value || "")
      .trim()
      .toLowerCase();


  /* =====================================================
     FLOATING BUTTON
  ====================================================== */

  const setArrow = (collapsed) => {

    const btn = getFloatBtn();

    if (!btn) return;

    btn.textContent =
      collapsed
        ? "→"
        : "←";

    btn.title =
      collapsed
        ? "Expand sidebar"
        : "Collapse sidebar";

    btn.setAttribute(
      "aria-label",
      collapsed
        ? "Expand sidebar"
        : "Collapse sidebar"
    );
  };


  const applyCollapsed = (collapsed) => {

    const sidebar = getSidebar();

    if (!sidebar) return;

    sidebar.classList.toggle(
      "is-collapsed",
      collapsed
    );

    document.documentElement.classList.toggle(
      "sb-collapsed",
      collapsed
    );

    setArrow(collapsed);
  };


  /* =====================================================
     FLOATING BUTTON POSITION
  ====================================================== */

  let frozenTopPx = null;


  const computeTopFromBell = () => {

    const btn = getFloatBtn();
    const bell = getBellIcon();

    if (!btn || !bell) return null;

    const b =
      bell.getBoundingClientRect();

    const btnH =
      btn.offsetHeight || 40;

    return Math.round(
      b.top +
      b.height / 2 -
      btnH / 2
    );
  };


  const positionFloatButton = ({
    freezeTop = false
  } = {}) => {

    const sidebar = getSidebar();
    const btn = getFloatBtn();

    if (!sidebar || !btn) return;

    const rect =
      sidebar.getBoundingClientRect();

    btn.style.left =
      `${Math.round(
        rect.right +
        FLOAT_GAP +
        FLOAT_NUDGE
      )}px`;


    if (
      frozenTopPx == null ||
      freezeTop
    ) {

      const t =
        computeTopFromBell();

      if (t != null) {
        frozenTopPx = t;
      }
    }


    if (frozenTopPx != null) {

      btn.style.top =
        `${frozenTopPx}px`;
    }
  };


  const positionSafe = (opts) => {

    positionFloatButton(opts);

    requestAnimationFrame(() =>
      positionFloatButton(opts)
    );

    requestAnimationFrame(() =>
      positionFloatButton(opts)
    );

    setTimeout(
      () => positionFloatButton(opts),
      50
    );

    setTimeout(
      () => positionFloatButton(opts),
      250
    );
  };


  /* =====================================================
     SIDEBAR COLLAPSE
  ====================================================== */

  const toggleSidebar = () => {

    const sidebar = getSidebar();

    if (!sidebar) return;

    const collapsed =
      !sidebar.classList.contains(
        "is-collapsed"
      );

    localStorage.setItem(
      STORAGE_KEY,
      collapsed ? "1" : "0"
    );

    applyCollapsed(collapsed);

    positionSafe();
  };


  /* =====================================================
     LOAD SIDEBAR HTML
  ====================================================== */

  try {

    let html =
      sessionStorage.getItem(
        SIDEBAR_CACHE_KEY
      );


    /*
     * Load sidebar from cache first.
     */

    if (!html) {

      const res =
        await fetch(
          "../../components/sidebar.html",
          {
            cache: "no-store"
          }
        );


      if (!res.ok) {

        throw new Error(
          "Failed to load sidebar.html"
        );
      }


      html =
        await res.text();


      sessionStorage.setItem(
        SIDEBAR_CACHE_KEY,
        html
      );
    }


    mount.innerHTML = html;

  } catch (err) {

    console.error(err);

    mount.innerHTML =
      "<!-- admin sidebar failed to load -->";

    return;
  }


  /* =====================================================
     ACTIVE NAV ITEM
  ====================================================== */

  const current =
    normalize(activeKey);


  const candidates =
    mount.querySelectorAll(
      ".sb-item, a[data-nav], a[data-key]"
    );


  candidates.forEach((el) => {

    const key =
      normalize(
        el.dataset.nav ||
        el.dataset.key ||
        ""
      );


    const isActive =
      key &&
      key === current;


    el.classList.toggle(
      "active",
      isActive
    );


    if (isActive) {

      el.setAttribute(
        "aria-current",
        "page"
      );

    } else {

      el.removeAttribute(
        "aria-current"
      );
    }

  });


  /* =====================================================
     GROUP DROPDOWNS
  ====================================================== */

  const groups =
    mount.querySelectorAll(
      ".sb-group"
    );


  /*
   * Open or close a dropdown group.
   */

  function setGroupOpen(
    group,
    open
  ) {

    if (!group) return;

    const toggle =
      group.querySelector(
        ".sb-group-toggle"
      );

    if (!toggle) return;


    group.classList.toggle(
      "is-open",
      open
    );


    toggle.setAttribute(
      "aria-expanded",
      open
        ? "true"
        : "false"
    );
  }


  groups.forEach((group) => {

    const toggle =
      group.querySelector(
        ".sb-group-toggle"
      );


    if (!toggle) return;


    /*
     * Check whether the current page
     * belongs to this dropdown.
     */

    const hasActiveItem =
      !!group.querySelector(
        ".sb-item.active"
      );


    /*
     * Default behavior:
     *
     * CLOSED when the current page
     * is outside this group.
     *
     * OPEN when the current page
     * belongs to this group.
     */

    setGroupOpen(
      group,
      hasActiveItem
    );


    /* -----------------------------------------------
       TOGGLE DROPDOWN
    ------------------------------------------------ */

    toggle.addEventListener(
      "click",
      (event) => {

        event.preventDefault();
        event.stopPropagation();


        const isOpen =
          group.classList.contains(
            "is-open"
          );


        setGroupOpen(
          group,
          !isOpen
        );


        positionSafe();
      }
    );

  });


  /* =====================================================
     PREVENT ACTIVE LINK RELOAD GLITCH
  ====================================================== */

  mount
    .querySelectorAll(
      ".sb-item[href], " +
      "a[data-nav][href], " +
      "a[data-key][href]"
    )
    .forEach((a) => {

      a.addEventListener(
        "click",
        (event) => {

          const href =
            a.getAttribute("href");


          if (!href) return;


          const targetPath =
            new URL(
              href,
              window.location.href
            ).pathname;


          const currentPath =
            window.location.pathname;


          /*
           * Prevent unnecessary reload
           * when clicking the page
           * the user is already on.
           */

          if (
            targetPath ===
            currentPath
          ) {

            event.preventDefault();

            positionSafe();
          }

        }
      );

    });


  /* =====================================================
     APPLY PERSISTED SIDEBAR COLLAPSE
  ====================================================== */

  const collapsed =
    localStorage.getItem(
      STORAGE_KEY
    ) === "1";


  applyCollapsed(collapsed);


  /* =====================================================
     FLOATING COLLAPSE BUTTON
  ====================================================== */

  const floatBtn =
    getFloatBtn();


  if (
    floatBtn &&
    !floatBtn.dataset.bound
  ) {

    floatBtn.dataset.bound = "1";


    floatBtn.addEventListener(
      "click",
      (event) => {

        event.preventDefault();
        event.stopPropagation();

        toggleSidebar();
      }
    );
  }


  /* =====================================================
     KEEP BUTTON POSITIONED
  ====================================================== */

  window.addEventListener(
    "resize",
    () =>
      positionSafe({
        freezeTop: true
      })
  );


  window.addEventListener(
    "load",
    () =>
      positionSafe({
        freezeTop: true
      })
  );


  window.addEventListener(
    "scroll",
    () =>
      positionFloatButton(),
    {
      passive: true
    }
  );


  /* =====================================================
     INITIAL FLOATING BUTTON POSITION
  ====================================================== */

  positionSafe({
    freezeTop: true
  });

});