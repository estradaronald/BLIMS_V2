// frontend/src/js/teacher/teacher-sidebar.js
document.addEventListener("DOMContentLoaded", async () => {
  const STORAGE_KEY = "teacher_sidebar_collapsed_v1";
  const FLOAT_GAP = 14;
  const FLOAT_NUDGE = 10;

  // cache sidebar markup for this browser tab
  const SIDEBAR_CACHE_KEY = "__teacherSidebarHTML";

  // page key from body
  const rawKey = (document.body?.dataset?.page || "").trim();
  const activeKey = rawKey || "dashboard";

  const mount = document.getElementById("sidebar-mount");
  if (!mount) return;

  // Helpers
  const getSidebar = () => document.getElementById("sidebar");
  const getFloatBtn = () => document.getElementById("sidebarFloatToggle");

  const getBellIcon = () =>
    document.querySelector(".tb-icon") ||
    document.querySelector(".topbar .tb-icon") ||
    document.querySelector(".topbar .icon-btn");

  const normalize = (s) => String(s || "").trim().toLowerCase();

  const setArrow = (collapsed) => {
    const btn = getFloatBtn();
    if (!btn) return;
    btn.textContent = collapsed ? "→" : "←";
    btn.title = collapsed ? "Expand sidebar" : "Collapse sidebar";
    btn.setAttribute(
      "aria-label",
      collapsed ? "Expand sidebar" : "Collapse sidebar"
    );
  };

  const applyCollapsed = (collapsed) => {
    const sidebar = getSidebar();
    if (!sidebar) return;

    sidebar.classList.toggle("is-collapsed", collapsed);
    document.documentElement.classList.toggle("sb-collapsed", collapsed);
    setArrow(collapsed);
  };

  // Sticky float button logic
  let frozenTopPx = null;

  const computeTopFromBell = () => {
    const btn = getFloatBtn();
    const bell = getBellIcon();
    if (!btn || !bell) return null;

    const b = bell.getBoundingClientRect();
    const btnH = btn.offsetHeight || 40;
    return Math.round(b.top + b.height / 2 - btnH / 2);
  };

  const positionFloatButton = ({ freezeTop = false } = {}) => {
    const sidebar = getSidebar();
    const btn = getFloatBtn();
    if (!sidebar || !btn) return;

    // LEFT: always stick beside sidebar edge
    const rect = sidebar.getBoundingClientRect();
    btn.style.left = `${Math.round(rect.right + FLOAT_GAP + FLOAT_NUDGE)}px`;

    // TOP: freeze at first good bell-aligned position
    if (frozenTopPx == null || freezeTop) {
      const t = computeTopFromBell();
      if (t != null) frozenTopPx = t;
    }

    if (frozenTopPx != null) {
      btn.style.top = `${frozenTopPx}px`;
    }
  };

  const positionSafe = (opts) => {
    positionFloatButton(opts);
    requestAnimationFrame(() => positionFloatButton(opts));
    requestAnimationFrame(() => positionFloatButton(opts));
    setTimeout(() => positionFloatButton(opts), 50);
    setTimeout(() => positionFloatButton(opts), 250);
  };

  const toggleSidebar = () => {
    const sidebar = getSidebar();
    if (!sidebar) return;

    const collapsed = !sidebar.classList.contains("is-collapsed");
    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
    applyCollapsed(collapsed);

    positionSafe();
  };

  // 1) Load sidebar HTML
  try {
    let html = sessionStorage.getItem(SIDEBAR_CACHE_KEY);

    if (!html) {
      const res = await fetch("../../components/teacher-sidebar.html");
      if (!res.ok) throw new Error("Failed to load teacher-sidebar.html");
      html = await res.text();
      sessionStorage.setItem(SIDEBAR_CACHE_KEY, html);
    }

    mount.innerHTML = html;
  } catch (err) {
    console.error(err);
    mount.innerHTML = "<!-- teacher sidebar failed to load -->";
    return;
  }

  // 2) Active item highlight
  const current = normalize(activeKey);

  const candidates = mount.querySelectorAll(
    ".sb-item, .sb-link, a[data-nav], a[data-key]"
  );

  candidates.forEach((el) => {
    const key = normalize(el.dataset.nav || el.dataset.key || "");
    const isActive = key && key === current;

    el.classList.toggle("active", isActive);
    if (isActive) el.setAttribute("aria-current", "page");
    else el.removeAttribute("aria-current");
  });

  // 2.5) Prevent reload glitch if clicking the active/current link
  mount.querySelectorAll(".sb-item[href], .sb-link[href], a[href]").forEach((a) => {
    a.addEventListener("click", (e) => {
      const href = a.getAttribute("href");
      if (!href) return;

      const targetPath = new URL(href, window.location.href).pathname;
      const currentPath = window.location.pathname;

      if (targetPath === currentPath) {
        e.preventDefault();
        positionSafe();
      }
    });
  });

  // 3) Apply persisted collapsed state
  const collapsed = localStorage.getItem(STORAGE_KEY) === "1";
  applyCollapsed(collapsed);

  // 4) Bind floating collapse button
  const floatBtn = getFloatBtn();
  if (floatBtn) {
    floatBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleSidebar();
    });
  }

  // 5) Keep button positioned correctly
  window.addEventListener("resize", () => positionSafe({ freezeTop: true }));
  window.addEventListener("load", () => positionSafe({ freezeTop: true }));
  window.addEventListener("scroll", () => positionFloatButton(), { passive: true });

  // initial position
  positionSafe({ freezeTop: true });
});