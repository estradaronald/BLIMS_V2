// frontend/src/js/admin/sidebar.js
document.addEventListener("DOMContentLoaded", async () => {
  const STORAGE_KEY = "admin_sidebar_collapsed_v1";
  const FLOAT_GAP = 14;
  const FLOAT_NUDGE = 10;

  // ✅ cache sidebar markup for this browser tab
  // bump cache key so changes (like Audit Logs injection) won't get stuck
  const SIDEBAR_CACHE_KEY = "__adminSidebarHTML_v2";

  // ✅ page key from body
  const rawKey = (document.body?.dataset?.page || "").trim();
  const activeKey = rawKey || "dashboard";

  const mount = document.getElementById("sidebar-mount");
  if (!mount) return;

  // Helpers
  const getSidebar = () => document.getElementById("sidebar");
  const getFloatBtn = () =>
    document.getElementById("sidebarFloatToggle") ||
    document.getElementById("sidebarToggle"); // fallback

  const getBellIcon = () =>
    document.querySelector(".tb-icon") ||
    document.querySelector(".topbar .tb-icon") ||
    document.querySelector(".topbar .icon-btn");

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

  // ==============================
  // ✅ Sticky float button logic (same as teacher)
  // ==============================
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

    const rect = sidebar.getBoundingClientRect();
    btn.style.left = `${Math.round(rect.right + FLOAT_GAP + FLOAT_NUDGE)}px`;

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

  // ✅ Inject Audit Logs link if missing (so you don’t have to edit sidebar.html immediately)
  function ensureAuditLogsLink() {
    const normalize = (k) => (k || "").trim().toLowerCase();

    // already exists?
    const exists = mount.querySelector(
      `[data-nav="${"audit-logs"}"], [data-key="${"audit-logs"}"]`
    );
    if (exists) return;

    // find a reasonable nav container
    const container =
      mount.querySelector(".sb-nav") ||
      mount.querySelector(".sb-list") ||
      mount.querySelector(".sb-menu") ||
      mount.querySelector("nav") ||
      mount;

    // Create a link that matches your existing highlighting logic:
    // uses data-key="audit-logs" and class "sb-item"
    const a = document.createElement("a");
    a.className = "sb-item";
    a.href = "./audit-logs.html";
    a.dataset.key = "audit-logs";

    // Try to follow common sidebar markup patterns:
    // icon + label spans. If your CSS doesn’t use these, it still works.
    a.innerHTML = `
      <span class="sb-ico">🧾</span>
      <span class="sb-text">Audit Logs</span>
    `;

    container.appendChild(a);
  }

  // 1) Load sidebar HTML (cached in sessionStorage)
  try {
    let html = sessionStorage.getItem(SIDEBAR_CACHE_KEY);

    if (!html) {
      const res = await fetch("../../components/sidebar.html", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load sidebar.html");
      html = await res.text();
      sessionStorage.setItem(SIDEBAR_CACHE_KEY, html);
    }

    mount.innerHTML = html;

    // ✅ ensure new nav exists even if sidebar.html not updated yet
    ensureAuditLogsLink();
  } catch (err) {
    console.error(err);
    mount.innerHTML = "<!-- admin sidebar failed to load -->";
    return;
  }

  // 2) Active item highlight (same as teacher)
  const normalize = (k) => (k || "").trim().toLowerCase();
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

  // ✅ Prevent reload glitch if clicking the active/current link
  mount
    .querySelectorAll(".sb-item[href], .sb-link[href], a[data-nav][href], a[data-key][href]")
    .forEach((a) => {
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
  if (floatBtn && !floatBtn.dataset.bound) {
    floatBtn.dataset.bound = "1";
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

  positionSafe({ freezeTop: true });
});