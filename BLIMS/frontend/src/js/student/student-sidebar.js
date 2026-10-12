/* frontend/src/js/student/student-sidebar.js */
(() => {
  const STORAGE_KEY = "student_sidebar_collapsed_v1";
  const GROUPS_STORAGE_KEY = "student_sidebar_groups_v1";


  const FLOAT_GAP = 14;
  const FLOAT_NUDGE = 10;


  const normalize = (value) =>
    String(value || "")
      .trim()
      .toLowerCase();


  const getSidebar = () => document.getElementById("sidebar");


  const getFloatBtn = () =>
    document.getElementById("sidebarFloatToggle") ||
    document.getElementById("sidebarToggle");


  const getUserBox = () =>
    document.getElementById("userbox") || document.querySelector(".tb-user");


  const rawKey = (document.body?.dataset?.page || "").trim();
  const activeKey = rawKey || "dashboard";


  const sidebar = getSidebar();
  if (!sidebar) return;


  const root = document.documentElement;
  const isMobile = () => window.matchMedia("(max-width: 700px)").matches;


  /* =====================================================
     RESTORE INITIAL SIDEBAR STATE
  ====================================================== */


  const savedCollapsed = localStorage.getItem(STORAGE_KEY) === "1";


  if (isMobile()) {
    sidebar.classList.remove("is-collapsed");
    root.classList.remove("sb-collapsed");
    root.classList.remove("sb-mobile-open");
  } else {
    sidebar.classList.toggle("is-collapsed", savedCollapsed);
    root.classList.toggle("sb-collapsed", savedCollapsed);
  }


  /* =====================================================
     GROUP STORAGE
  ====================================================== */


  const readGroups = () => {
    try {
      const saved = localStorage.getItem(GROUPS_STORAGE_KEY);
      if (!saved) return {};


      const parsed = JSON.parse(saved);


      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  };


  const writeGroups = (groups) => {
    localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(groups));
  };


  /* =====================================================
     COLLAPSE STATE AND BUTTON ARROW
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


    btn.setAttribute("aria-controls", "sidebar");
    btn.setAttribute("aria-expanded", String(!collapsed));
  };


  const applyCollapsed = (collapsed) => {
    sidebar.classList.toggle("is-collapsed", collapsed);
    root.classList.toggle("sb-collapsed", collapsed);
    setArrow(collapsed);
  };


  const applyMobileState = (open) => {
    root.classList.toggle("sb-mobile-open", open);
    root.classList.toggle("sb-mobile-closed", !open);
  };


  /* =====================================================
     FLOATING BUTTON POSITIONING
  ====================================================== */


  let frozenTopPx = null;


  const computeTopFromUserBox = () => {
    const btn = getFloatBtn();
    const userBox = getUserBox();


    if (!btn || !userBox) return null;


    const userRect = userBox.getBoundingClientRect();
    const btnHeight = btn.offsetHeight || 40;


    return Math.round(userRect.top + userRect.height / 2 - btnHeight / 2);
  };


  const positionFloatButton = ({ freezeTop = false } = {}) => {
    const btn = getFloatBtn();
    const currentSidebar = getSidebar();


    if (!btn || !currentSidebar) return;


    if (isMobile()) {
      const mobileOpen = root.classList.contains("sb-mobile-open");


      btn.style.left = mobileOpen ? "284px" : "18px";
      btn.style.top = "18px";
      btn.style.right = "auto";
      btn.style.visibility = "visible";


      return;
    }


    const rect = currentSidebar.getBoundingClientRect();


    btn.style.left = `${Math.round(rect.right + FLOAT_GAP + FLOAT_NUDGE)}px`;


    btn.style.right = "auto";


    if (frozenTopPx === null || freezeTop) {
      const top = computeTopFromUserBox();


      if (top !== null) {
        frozenTopPx = top;
      }
    }


    if (frozenTopPx !== null) {
      btn.style.top = `${frozenTopPx}px`;
    }


    btn.style.visibility = "visible";
  };


  const positionSafe = (options = {}) => {
    const btn = getFloatBtn();
    if (!btn) return;


    btn.style.visibility = "hidden";


    positionFloatButton(options);


    requestAnimationFrame(() => {
      positionFloatButton(options);
      btn.style.visibility = "visible";
    });


    requestAnimationFrame(() => positionFloatButton(options));


    setTimeout(() => positionFloatButton(options), 50);
    setTimeout(() => positionFloatButton(options), 250);
  };


  /* =====================================================
     MOBILE BACKDROP
  ====================================================== */


  let backdrop = document.querySelector(".sb-mobile-backdrop");


  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.className = "sb-mobile-backdrop";
    backdrop.setAttribute("aria-hidden", "true");
    document.body.appendChild(backdrop);
  }


  const closeMobileSidebar = () => {
    applyMobileState(false);
    positionSafe();
  };


  backdrop.addEventListener("click", closeMobileSidebar);


  /* =====================================================
     ACTIVE NAVIGATION ITEM
  ====================================================== */


  const current = normalize(activeKey);


  sidebar
    .querySelectorAll(".sb-item, a[data-nav], a[data-key]")
    .forEach((link) => {
      const key = normalize(link.dataset.nav || link.dataset.key);
      const active = key === current;


      link.classList.toggle("active", active);


      if (active) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });


  /* =====================================================
     MY LEARNING GROUP
  ====================================================== */


  const savedGroups = readGroups();


  sidebar.querySelectorAll(".sb-group").forEach((group) => {
    const groupKey =
      group.dataset.group ||
      (group.id === "studentLearningGroup" ? "my-learning" : "");
    const toggle = group.querySelector(".sb-group-toggle");
    const submenu = group.querySelector(".sb-submenu");


    if (!groupKey || !toggle || !submenu) return;


    const containsActivePage = Boolean(group.querySelector(".sb-item.active"));


    const hasSavedState = Object.prototype.hasOwnProperty.call(
      savedGroups,
      groupKey,
    );


    const shouldOpen = hasSavedState
      ? savedGroups[groupKey] === true
      : containsActivePage;


    group.classList.toggle("is-open", shouldOpen);
    toggle.setAttribute("aria-expanded", String(shouldOpen));


    if (groupKey === "my-learning") {
      root.classList.remove("sb-preopen-learning");
    }


    if (!hasSavedState && shouldOpen) {
      savedGroups[groupKey] = true;
    }


    toggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();


      const currentlyOpen = toggle.getAttribute("aria-expanded") === "true";


      const nextOpen = !currentlyOpen;


      group.classList.toggle("is-open", nextOpen);
      toggle.setAttribute("aria-expanded", String(nextOpen));


      const groups = readGroups();
      groups[groupKey] = nextOpen;
      writeGroups(groups);


      positionSafe();
    });
  });


  writeGroups(savedGroups);


  /* =====================================================
     NAVIGATION LINKS
  ====================================================== */


  sidebar.querySelectorAll("a[href]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href");
      if (!href) return;


      const targetPath = new URL(href, window.location.href).pathname;


      if (targetPath !== window.location.pathname) {
        if (isMobile()) {
          closeMobileSidebar();
        }


        return;
      }


      event.preventDefault();


      if (isMobile()) {
        closeMobileSidebar();
      } else {
        positionSafe();
      }
    });
  });


  /* =====================================================
     FLOATING COLLAPSE BUTTON
  ====================================================== */


  const floatBtn = getFloatBtn();


  if (floatBtn && floatBtn.dataset.bound !== "true") {
    floatBtn.dataset.bound = "true";


    floatBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();


      if (isMobile()) {
        const mobileOpen = root.classList.contains("sb-mobile-open");


        applyMobileState(!mobileOpen);
        positionSafe();


        return;
      }


      const collapsed = !sidebar.classList.contains("is-collapsed");


      localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");


      applyCollapsed(collapsed);
      positionSafe();
    });
  }


  /* =====================================================
     RESIZE, LOAD, AND SCROLL
  ====================================================== */


  window.addEventListener("resize", () => {
    if (isMobile()) {
      applyCollapsed(false);
      positionSafe({ freezeTop: true });
    } else {
      applyMobileState(false);


      applyCollapsed(localStorage.getItem(STORAGE_KEY) === "1");


      positionSafe({ freezeTop: true });
    }
  });


  window.addEventListener("load", () => {
    positionSafe({ freezeTop: true });
  });


  window.addEventListener("scroll", () => positionFloatButton(), {
    passive: true,
  });


  /* =====================================================
     INITIALIZE
  ====================================================== */


  setArrow(!isMobile() && savedCollapsed);
  positionSafe({ freezeTop: true });
})();



