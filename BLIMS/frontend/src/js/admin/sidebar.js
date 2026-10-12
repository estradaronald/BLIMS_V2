// frontend/src/js/admin/sidebar.js


(() => {
  const STORAGE_KEY = "admin_sidebar_collapsed_v1";
  const GROUPS_STORAGE_KEY = "admin_sidebar_groups_v1";


  const FLOAT_GAP = 14;
  const FLOAT_NUDGE = 10;


  /* =====================================================
     CURRENT PAGE
  ====================================================== */


  const rawKey = (document.body?.dataset?.page || "").trim();
  const activeKey = rawKey || "dashboard";


  /* =====================================================
     SIDEBAR
  ====================================================== */


  /*
   * The sidebar is already embedded directly
   * in the HTML page.
   *
   * We no longer fetch or replace sidebar.html.
   */
  const mount = document.getElementById("sidebar");


  if (!mount) return;


  // Apply the saved collapsed state to the sidebar immediately
  // so it does not briefly render expanded on page navigation.
  const savedCollapsed = localStorage.getItem(STORAGE_KEY) === "1";


  mount.classList.toggle("is-collapsed", savedCollapsed);
  document.documentElement.classList.toggle("sb-collapsed", savedCollapsed);


  /* =====================================================
   APPLY SAVED SIDEBAR STATE EARLY
====================================================== */


  const isMobile = window.matchMedia("(max-width: 700px)").matches;


  if (!isMobile) {
    document.documentElement.classList.toggle("sb-collapsed", savedCollapsed);
  } else {
    mount.classList.remove("is-collapsed");
    document.documentElement.classList.remove("sb-collapsed");
    document.documentElement.classList.remove("sb-mobile-open");
  }


  /* =====================================================
     HELPERS
  ====================================================== */


  const getSidebar = () => document.getElementById("sidebar");


  const getFloatBtn = () =>
    document.getElementById("sidebarFloatToggle") ||
    document.getElementById("sidebarToggle");


  const getUserBox = () => document.getElementById("userbox");


  const normalize = (value) => (value || "").trim().toLowerCase();


  /* =====================================================
   DROPDOWN STATE
====================================================== */


  const getSavedGroups = () => {
    try {
      const saved = localStorage.getItem(GROUPS_STORAGE_KEY);


      if (!saved) return {};


      const parsed = JSON.parse(saved);


      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  };


  const saveGroupState = (groupKey, open) => {
    if (!groupKey) return;


    const groups = getSavedGroups();


    groups[groupKey] = open;


    localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(groups));
  };


  /* =====================================================
     FLOATING BUTTON
  ====================================================== */


  const setArrow = (collapsed) => {
    const btn = getFloatBtn();


    if (!btn) return;


    btn.textContent = collapsed ? "→" : "←";


    btn.title = collapsed ? "Expand sidebar" : "Collapse sidebar";


    btn.setAttribute(
      "aria-label",
      collapsed ? "Expand sidebar" : "Collapse sidebar",
    );
  };


  /* =====================================================
     APPLY COLLAPSED STATE
  ====================================================== */


  const applyCollapsed = (collapsed) => {
    const sidebar = getSidebar();


    if (!sidebar) return;


    sidebar.classList.toggle("is-collapsed", collapsed);


    document.documentElement.classList.toggle("sb-collapsed", collapsed);


    setArrow(collapsed);
  };


  /* =====================================================
     FLOATING BUTTON POSITION
  ====================================================== */


  let frozenTopPx = null;


  const computeTopFromUserBox = () => {
    const btn = getFloatBtn();
    const userBox = getUserBox();


    if (!btn || !userBox) return null;


    const userRect = userBox.getBoundingClientRect();


    const btnH = btn.offsetHeight || 40;


    return Math.round(userRect.top + userRect.height / 2 - btnH / 2);
  };


  const positionFloatButton = ({ freezeTop = false } = {}) => {
    const sidebar = getSidebar();
    const btn = getFloatBtn();


    if (!sidebar || !btn) return;


    const rect = sidebar.getBoundingClientRect();


    btn.style.left = `${Math.round(rect.right + FLOAT_GAP + FLOAT_NUDGE)}px`;


    if (frozenTopPx == null || freezeTop) {
      const t = computeTopFromUserBox();


      if (t != null) {
        frozenTopPx = t;
      }
    }


    if (frozenTopPx != null) {
      btn.style.top = `${frozenTopPx}px`;
    }
  };


  /*
   * Position the floating button without
   * showing it in an incorrect position first.
   *
   * The sidebar is already in the HTML,
   * so we no longer need several delayed
   * positioning passes.
   */
  const positionSafe = (opts = {}) => {
    const btn = getFloatBtn();


    if (!btn) return;


    /*
     * Hide the button while its correct
     * position is calculated.
     */
    btn.style.visibility = "hidden";


    /*
     * Calculate position immediately.
     */
    positionFloatButton(opts);


    /*
     * Show it after the browser has
     * completed the current layout.
     */
    requestAnimationFrame(() => {
      positionFloatButton(opts);
      btn.style.visibility = "visible";
    });
  };


  /* =====================================================
     SIDEBAR COLLAPSE
  ====================================================== */


  const toggleSidebar = () => {
    const sidebar = getSidebar();


    if (!sidebar) return;


    const isMobile = window.matchMedia("(max-width: 700px)").matches;


    /* =========================================
       MOBILE DRAWER
    ========================================== */


    if (isMobile) {
      const mobileOpen =
        document.documentElement.classList.contains("sb-mobile-open");


      document.documentElement.classList.toggle("sb-mobile-open", !mobileOpen);


      return;
    }


    /* =========================================
       DESKTOP COLLAPSE
    ========================================== */


    const collapsed = !sidebar.classList.contains("is-collapsed");


    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");


    applyCollapsed(collapsed);


    positionSafe();
  };


  /* =====================================================
     MOBILE SIDEBAR BACKDROP
  ====================================================== */


  let mobileBackdrop = document.querySelector(".sb-mobile-backdrop");


  if (!mobileBackdrop) {
    mobileBackdrop = document.createElement("div");


    mobileBackdrop.className = "sb-mobile-backdrop";


    document.body.appendChild(mobileBackdrop);
  }


  /*
   * Close mobile sidebar when backdrop
   * is clicked.
   */
  mobileBackdrop.addEventListener("click", () => {
    document.documentElement.classList.remove("sb-mobile-open");
  });


  /* =====================================================
     ACTIVE NAV ITEM
  ====================================================== */


  const current = normalize(activeKey);


  const candidates = mount.querySelectorAll(
    ".sb-item, a[data-nav], a[data-key]",
  );


  candidates.forEach((el) => {
    const key = normalize(el.dataset.nav || el.dataset.key || "");


    const isActive = key && key === current;


    el.classList.toggle("active", isActive);


    if (isActive) {
      el.setAttribute("aria-current", "page");
    } else {
      el.removeAttribute("aria-current");
    }
  });


  /* =====================================================
     GROUP DROPDOWNS
  ====================================================== */


  const groups = mount.querySelectorAll(".sb-group");


  /*
   * Open or close a dropdown group.
   */
  function setGroupOpen(group, open) {
    if (!group) return;


    const toggle = group.querySelector(".sb-group-toggle");


    if (!toggle) return;


    group.classList.toggle("is-open", open);


    toggle.setAttribute("aria-expanded", open ? "true" : "false");
  }


  groups.forEach((group) => {
    const toggle = group.querySelector(".sb-group-toggle");


    if (!toggle) return;


    /* -----------------------------------------------
     GROUP KEY
  ------------------------------------------------ */


    const groupKey = group.dataset.group;


    if (!groupKey) return;


    /* -----------------------------------------------
     CURRENT PAGE
  ------------------------------------------------ */


    const hasActiveItem = !!group.querySelector(".sb-item.active");


    /* -----------------------------------------------
     SAVED STATE
  ------------------------------------------------ */


    const savedGroups = getSavedGroups();


    const hasSavedState = Object.prototype.hasOwnProperty.call(
      savedGroups,
      groupKey,
    );


    /* -----------------------------------------------
     INITIAL STATE


     Restore the user's previous choice.
     If no choice exists yet, open the group
     containing the current page.
  ------------------------------------------------ */


    let shouldOpen;


    if (hasSavedState) {
      shouldOpen = savedGroups[groupKey] === true;
    } else {
      shouldOpen = hasActiveItem;


      if (shouldOpen) {
        saveGroupState(groupKey, true);
      }
    }


    setGroupOpen(group, shouldOpen);


    /* -----------------------------------------------
     TOGGLE DROPDOWN
  ------------------------------------------------ */


    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();


      const isOpen = group.classList.contains("is-open");


      const nextState = !isOpen;


      setGroupOpen(group, nextState);


      /* Remember the user's choice */
      saveGroupState(groupKey, nextState);


      positionSafe();
    });
  });


  document.documentElement.classList.remove(
  "sb-preopen-user-management",
  "sb-preopen-academic-setup",
  "sb-preopen-records",
);


 /* =====================================================
   NAVIGATION
====================================================== */


mount
  .querySelectorAll(
    ".sb-item[href], " +
      "a[data-nav][href], " +
      "a[data-key][href]",
  )
  .forEach((a) => {
    a.addEventListener("click", (event) => {
      const href = a.getAttribute("href");


      if (!href) return;


      const targetPath = new URL(
        href,
        window.location.href
      ).pathname;


      const currentPath = window.location.pathname;


      /*
       * Prevent unnecessary reload
       * when clicking the page the
       * user is already on.
       */
      if (targetPath === currentPath) {
        event.preventDefault();
        positionSafe();
      }
    });
  });


  /* =====================================================
     APPLY PERSISTED SIDEBAR COLLAPSE
  ====================================================== */


  const collapsed = localStorage.getItem(STORAGE_KEY) === "1";


  applyCollapsed(collapsed);


  /* =====================================================
     FLOATING COLLAPSE BUTTON
  ====================================================== */


  const floatBtn = getFloatBtn();


  if (floatBtn && !floatBtn.dataset.bound) {
    floatBtn.dataset.bound = "1";


    floatBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();


      toggleSidebar();
    });
  }


  /* =====================================================
     KEEP BUTTON POSITIONED
  ====================================================== */


  window.addEventListener("resize", () =>
    positionSafe({
      freezeTop: true,
    }),
  );


  window.addEventListener("load", () =>
    positionSafe({
      freezeTop: true,
    }),
  );


  window.addEventListener("scroll", () => positionFloatButton(), {
    passive: true,
  });


  /* =====================================================
     INITIAL FLOATING BUTTON POSITION
  ====================================================== */


  positionSafe({
    freezeTop: true,
  });
})();



