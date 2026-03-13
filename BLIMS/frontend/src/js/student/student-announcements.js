// frontend/src/js/student/student-announcements.js
document.addEventListener("DOMContentLoaded", () => {
  initTopbarMenu();
  initLogout();

  const feed = $("annFeed");
  const empty = $("annEmpty");

  const search = $("annSearch");
  const sourceFilter = $("sourceFilter");
  const catFilter = $("catFilter");

  // Modal elements
  const viewModal = $("annViewModal");
  const viewBackdrop = $("annViewBackdrop");
  const viewCloseX = $("annViewCloseX");
  const viewCloseBtn = $("annViewCloseBtn");

  const vTitleTop = $("annViewTitle");   // top modal title (small header)
  const vMeta = $("annViewMeta");
  const vSource = $("annViewSource");
  const vPill = $("annViewPill");
  const vH = $("annViewH");
  const vMsg = $("annViewMsg");
  const vFiles = $("annViewFiles");

  const LS_KEYS = { ANN: "rbms_announcements_v1" };

  function readLS(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function escapeHtml(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fmtShort(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function clampText(s, n = 180) {
    const t = String(s || "").trim();
    if (t.length <= n) return t;
    return t.slice(0, n).trim() + "…";
  }

  function catLabel(cat) {
    return (
      {
        general: "General",
        events: "Event",
        academic: "Notice",
        priority: "Alert",
      }[cat] || "General"
    );
  }

  function catPillClass(cat) {
    return (
      {
        general: "",
        events: "events",
        academic: "academic",
        priority: "priority",
      }[cat] || ""
    );
  }

  // ✅ Students only see published:
  function isVisibleToStudent(a) {
    if (!a) return false;
    if (a.archived) return false;
    if (a.draft) return false;
    if (a.publishAt) {
      const t = new Date(a.publishAt).getTime();
      if (!Number.isNaN(t) && t > Date.now()) return false;
    }
    return true;
  }

  // ✅ Source detection
  function getSource(a) {
    const s = String(a.source || a.createdByRole || a.authorRole || "").toLowerCase();
    if (s.includes("teacher")) return "teacher";
    if (s.includes("admin")) return "admin";
    return "admin";
  }

  // =========================
  // Modal helpers
  // =========================
  function openViewModal() {
    if (!viewModal) return;
    viewModal.classList.remove("hidden");
    viewModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeViewModal() {
    if (!viewModal) return;
    viewModal.classList.add("hidden");
    viewModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  viewBackdrop?.addEventListener("click", closeViewModal);
  viewCloseX?.addEventListener("click", closeViewModal);
  viewCloseBtn?.addEventListener("click", closeViewModal);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && viewModal && !viewModal.classList.contains("hidden")) {
      closeViewModal();
    }
  });

  function renderAttachments(files) {
    if (!vFiles) return;
    vFiles.innerHTML = "";

    if (!Array.isArray(files) || files.length === 0) return;

    files.forEach((f) => {
      // Possible shapes:
      // - string dataUrl
      // - { dataUrl, name }
      // - { url, name }
      const src =
        (typeof f === "string" && f) ||
        (f && (f.dataUrl || f.url || f.src)) ||
        "";

      if (!src) return;

      const img = document.createElement("img");
      img.src = src;
      img.alt = (f && f.name) ? f.name : "attachment";
      vFiles.appendChild(img);
    });
  }

  function showAnnouncementInModal(a) {
    if (!a) return;

    const srcKey = getSource(a);
    const srcLabel = srcKey === "teacher" ? "Teacher" : "Admin";

    // Source pill
    if (vSource) {
      vSource.className = `ann-source ${srcKey}`;
      vSource.textContent = srcLabel;
    }

    // Category pill (ann-pill already styled by admin css)
    if (vPill) {
      vPill.className = `ann-pill ${catPillClass(a.category)}`;
      vPill.textContent = catLabel(a.category);
    }

    // Titles + body
    const title = a.title || "Untitled";
    const message = a.message || "";

    if (vTitleTop) vTitleTop.textContent = "Announcement";
    if (vH) vH.textContent = title;
    if (vMsg) vMsg.textContent = message;

    // Meta
    const posted = fmtShort(a.createdAt);
    if (vMeta) vMeta.textContent = `Posted: ${posted}`;

    // Files
    renderAttachments(a.files);

    openViewModal();
  }

  // =========================
  // Render list
  // =========================
  function render() {
    const q = (search?.value || "").trim().toLowerCase();
    const src = sourceFilter?.value || "all";
    const cat = catFilter?.value || "all";

    let list = readLS(LS_KEYS.ANN, []);
    if (!Array.isArray(list)) list = [];

    // newest first
    list = list.slice().sort((a, b) => {
      const ta = new Date(a.createdAt || 0).getTime();
      const tb = new Date(b.createdAt || 0).getTime();
      return tb - ta;
    });

    list = list.filter(isVisibleToStudent);

    if (cat !== "all") list = list.filter((a) => (a.category || "general") === cat);
    if (src !== "all") list = list.filter((a) => getSource(a) === src);

    if (q) {
      list = list.filter((a) => {
        const hay = `${a.title || ""} ${a.message || ""}`.toLowerCase();
        return hay.includes(q);
      });
    }

    feed.innerHTML = "";

    if (!list.length) {
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");

    list.forEach((a) => {
      const pillText = catLabel(a.category);
      const pillClass = catPillClass(a.category);

      const srcKey = getSource(a);
      const srcLabel = srcKey === "teacher" ? "Teacher" : "Admin";

      const el = document.createElement("div");
      el.className = "ann-card";

      // store full announcement for modal use
      el.__ann = a;

      el.innerHTML = `
        <div class="ann-card-top">
          <div class="ann-card-left">
            <div class="ann-title-row">
              <h3 class="ann-title">${escapeHtml(a.title || "Untitled")}</h3>
            </div>

            <p class="ann-body">${escapeHtml(clampText(a.message || ""))}</p>

            <div class="ann-meta">
              <span>Posted: ${escapeHtml(fmtShort(a.createdAt))}</span>
              ${a.files && a.files.length ? `<span>• Attachments: ${a.files.length}</span>` : ""}
            </div>
          </div>

          <div class="ann-card-right">
            <span class="ann-source ${srcKey}">${srcLabel}</span>
            <span class="ann-pill ${pillClass}">${pillText}</span>
            <button class="ann-view-btn" type="button" data-act="view">View</button>
          </div>
        </div>
      `;

      feed.appendChild(el);

      // Clicking the whole card opens modal (except clicking the View button is already handled)
        el.addEventListener("click", (ev) => {
        // If user clicks the View button, that handler already covers it
        if (ev.target.closest('button[data-act="view"]')) return;

        // Avoid triggering when user highlights/selects text
        const sel = window.getSelection?.();
        if (sel && String(sel).trim().length > 0) return;

        showAnnouncementInModal(a);
        });
    });
  }

  // Delegate click for View buttons
  feed.addEventListener("click", (e) => {
    const btn = e.target.closest('button[data-act="view"]');
    if (!btn) return;

    const card = btn.closest(".ann-card");
    const a = card?.__ann;
    if (!a) return;

    showAnnouncementInModal(a);
  });

  // events
  search?.addEventListener("input", render);
  sourceFilter?.addEventListener("change", render);
  catFilter?.addEventListener("change", render);

  render();
});

function $(id) {
  return document.getElementById(id);
}

function initTopbarMenu() {
  const userMenuBtn = $("userMenuBtn");
  const userMenu = $("userMenu");
  const userbox = $("userbox");
  if (!userMenuBtn || !userMenu || !userbox) return;

  userMenuBtn.addEventListener("click", (ev) => {
    ev.stopPropagation();
    userMenu.classList.toggle("open");
  });

  document.addEventListener("click", (ev) => {
    if (!userbox.contains(ev.target)) userMenu.classList.remove("open");
  });
}

function initLogout() {
  const btn = $("topbarLogout");
  if (!btn) return;
  btn.addEventListener("click", () => {
    window.location.href = "../../login.html";
  });
}