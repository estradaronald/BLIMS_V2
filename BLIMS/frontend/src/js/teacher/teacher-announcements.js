// frontend/src/js/teacher/teacher-announcements.js
// Teacher Announcements:
// - Two tabs: My Class (teacher CRUD) + Admin announcements (read-only)
// - LocalStorage store (shared): rbms_announcements_v1

const $ = (id) => document.getElementById(id);

const LS_KEYS = {
  USER: "user",
  ANNOUNCE: "rbms_announcements_v1",
};

function readLS(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function writeLS(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function uid() {
  return "ANN-" + Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

function normalize(s) {
  return String(s || "").trim();
}

function escapeHtml(s) {
  return String(s || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function fmtDate(ts) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusFor(a) {
  if (a.publishAt && a.publishAt > Date.now()) return "scheduled";
  if (a.isDraft) return "draft";
  return "published";
}

function getTeacherScope() {
  const u = readLS(LS_KEYS.USER, {}) || {};

  const cls =
    u.handledClass ||
    u.className ||
    u.class ||
    u.advisoryClass ||
    u.gradeLevel ||
    "";

  const sec =
    u.handledSection ||
    u.sectionName ||
    u.section ||
    u.advisorySection ||
    "";

  const combined =
    u.classSection ||
    u.handledClassSection ||
    u.advisory ||
    u.assignedClass ||
    u.roleLabel ||
    u.roleText ||
    "";

  if ((!cls || !sec) && combined) {
    const m = String(combined).match(/(Class\s*\d+|Grade\s*\d+)\s*-\s*([A-Za-z0-9]+)/i);
    if (m) return { className: normalize(cls || m[1]), sectionName: normalize(sec || m[2]) };
  }

  return { className: normalize(cls), sectionName: normalize(sec) };
}

function scopeLabel(scope) {
  return [scope.className, scope.sectionName].filter(Boolean).join(" - ") || "(unassigned)";
}

// ----- State -----
const TEACHER_SCOPE = getTeacherScope();
let tab = "my"; // "my" | "admin"
let store = [];
let editingId = null;
let draftImages = [];

// ----- Store -----
function loadStore() {
  store = readLS(LS_KEYS.ANNOUNCE, []) || [];
}
function saveStore() {
  writeLS(LS_KEYS.ANNOUNCE, store);
}

// ----- Filter UI -----
function getFilters() {
  return {
    q: normalize($("searchInput")?.value || "").toLowerCase(),
    status: $("statusFilter")?.value || "all",
    cat: $("catFilter")?.value || "all",
  };
}

function matchFilters(a, f) {
  const st = statusFor(a);
  if (f.status !== "all" && st !== f.status) return false;
  if (f.cat !== "all" && (a.category || "General") !== f.cat) return false;

  if (f.q) {
    const hay = `${a.title || ""} ${a.message || ""} ${a.category || ""}`.toLowerCase();
    if (!hay.includes(f.q)) return false;
  }
  return true;
}

// ----- Data slices -----
function teacherOwnAnnouncements() {
  const hasScope = TEACHER_SCOPE.className && TEACHER_SCOPE.sectionName;

  return store.filter((a) => {
    if (a.authorRole !== "teacher") return false;
    if (a.audience !== "class") return false;

    const aC = (a.className || "").trim();
    const aS = (a.sectionName || "").trim();

    if (!hasScope) {
      return !aC && !aS; // only unassigned teacher posts
    }

    if (!aC && !aS) return true; // show unassigned too
    return aC === TEACHER_SCOPE.className && aS === TEACHER_SCOPE.sectionName;
  });
}

function adminAnnouncements() {
  return store
    .filter((a) => a.authorRole === "admin" && a.audience === "all")
    .sort((x, y) => (y.publishAt || y.updatedAt || y.createdAt) - (x.publishAt || x.updatedAt || x.createdAt));
}

// ----- Header meta -----
function renderHeaderMeta() {
  const label = scopeLabel(TEACHER_SCOPE);

  if ($("taSub")) $("taSub").textContent = `Posting to: ${label} • Admin announcements are read-only`;

  const u = readLS(LS_KEYS.USER, {}) || {};
  const name =
    u.fullName ||
    [u.firstName, u.middleName, u.lastName].filter(Boolean).join(" ") ||
    u.username ||
    "Teacher";

  if ($("tbName")) $("tbName").textContent = name;
  if ($("tbRole")) {
    $("tbRole").textContent =
      TEACHER_SCOPE.className && TEACHER_SCOPE.sectionName ? `${label} Teacher` : "Teacher";
  }
}

function badgeHtml(a) {
  const st = statusFor(a);
  const cat = a.category || "General";
  const scope =
    a.authorRole === "admin"
      ? "Admin"
      : scopeLabel({ className: a.className, sectionName: a.sectionName });

  return `
    <div class="ta-badges">
      <span class="ta-badge">${escapeHtml(cat)}</span>
      <span class="ta-badge">${escapeHtml(scope)}</span>
      <span class="ta-badge status-${st}">${st[0].toUpperCase() + st.slice(1)}</span>
    </div>
  `;
}

// ----- Render list -----
function renderList() {
  const wrap = $("listWrap");
  const empty = $("emptyState");
  if (!wrap || !empty) return;

  const f = getFilters();
  let items = tab === "my" ? teacherOwnAnnouncements() : adminAnnouncements();
  items = items.filter((a) => matchFilters(a, f));

  // newest first
  items.sort((x, y) => (y.updatedAt || y.createdAt) - (x.updatedAt || x.createdAt));

  const createBtn = $("btnCreate");
  if (createBtn) createBtn.style.display = tab === "my" ? "" : "none";

  // clear items
  wrap.querySelectorAll(".ta-item").forEach((n) => n.remove());

  if (items.length === 0) {
    empty.style.display = "";
    empty.textContent = tab === "admin" ? "No admin announcements found." : "No announcements found.";
    return;
  }

  empty.style.display = "none";

  items.forEach((a) => {
    const item = document.createElement("div");
    item.className = "ta-item";

    const time = fmtDate(a.updatedAt || a.createdAt || Date.now());
    const author = a.authorRole === "admin" ? "Admin" : a.authorName || "Teacher";
    const st = statusFor(a);

    const imgs = (a.images || [])
      .slice(0, 8)
      .map((src) => `<img class="ta-img" src="${src}" alt="">`)
      .join("");

    const actions =
      tab === "my"
        ? `
          <div class="ta-actions">
            <button class="ta-btn-sm" data-act="view" data-id="${a.id}">View</button>
            <button class="ta-btn-sm" data-act="edit" data-id="${a.id}">Edit</button>
            <button class="ta-btn-sm danger" data-act="del" data-id="${a.id}">Delete</button>
          </div>
        `
        : `
          <div class="ta-actions">
            <button class="ta-btn-sm" data-act="view" data-id="${a.id}">View</button>
          </div>
        `;

    const sched =
      st === "scheduled" && a.publishAt
        ? ` • Scheduled: ${new Date(a.publishAt).toLocaleDateString()}`
        : "";

    item.innerHTML = `
      <div class="ta-item-top">
        <div>
          <div class="ta-item-title">${escapeHtml(a.title || "Untitled")}</div>
          ${badgeHtml(a)}
        </div>
        ${actions}
      </div>

      <div class="ta-item-body">${escapeHtml(a.message || "")}</div>

      ${imgs ? `<div class="ta-images">${imgs}</div>` : ""}

      <div class="ta-item-foot">
        <div>By: ${escapeHtml(author)}${sched}</div>
        <div>${escapeHtml(time)}</div>
      </div>
    `;

    wrap.appendChild(item);
  });
}

// ----- Modal -----
function openModal(mode, announcement) {
  const modal = $("modal");
  if (!modal) return;

  const hint = $("formHint");
  if (hint) hint.textContent = "";

  editingId = null;
  draftImages = [];
  if ($("imgPreviews")) $("imgPreviews").innerHTML = "";

  const hasScope = TEACHER_SCOPE.className && TEACHER_SCOPE.sectionName;
  const scopeTxt = hasScope ? scopeLabel(TEACHER_SCOPE) : "(unassigned)";

  if (mode === "create") {
    if ($("modalTitle")) $("modalTitle").textContent = "Create New Announcement";
    if ($("modalSub")) $("modalSub").textContent = `This will be posted to: ${scopeTxt}`;

    if ($("inpTitle")) $("inpTitle").value = "";
    if ($("inpCategory")) $("inpCategory").value = "General";
    if ($("inpMessage")) $("inpMessage").value = "";
    if ($("inpSchedule")) $("inpSchedule").value = "";
    if ($("inpFiles")) $("inpFiles").value = "";
  }

  if (mode === "edit" && announcement) {
    editingId = announcement.id;

    if ($("modalTitle")) $("modalTitle").textContent = "Edit Announcement";
    if ($("modalSub")) $("modalSub").textContent = `Posting to: ${scopeTxt}`;

    if ($("inpTitle")) $("inpTitle").value = announcement.title || "";
    if ($("inpCategory")) $("inpCategory").value = announcement.category || "General";
    if ($("inpMessage")) $("inpMessage").value = announcement.message || "";
    if ($("inpSchedule")) {
      $("inpSchedule").value = announcement.publishAt
        ? new Date(announcement.publishAt).toISOString().slice(0, 10)
        : "";
    }
    if ($("inpFiles")) $("inpFiles").value = "";

    draftImages = Array.isArray(announcement.images) ? [...announcement.images] : [];
    renderPreviews();
  }

  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  const modal = $("modal");
  if (!modal) return;
  modal.classList.add("hidden");
  document.body.style.overflow = "";
}

function renderPreviews() {
  const box = $("imgPreviews");
  if (!box) return;

  box.innerHTML = "";
  draftImages.forEach((src, idx) => {
    const div = document.createElement("div");
    div.className = "ta-preview";
    div.innerHTML = `
      <img src="${src}" alt="">
      <button type="button" data-rm="${idx}">✕</button>
    `;
    box.appendChild(div);
  });
}

function readFilesAsDataUrls(files) {
  const list = Array.from(files || []);
  return Promise.all(
    list.map(
      (f) =>
        new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => resolve("");
          reader.readAsDataURL(f);
        })
    )
  ).then((arr) => arr.filter(Boolean));
}

function upsertAnnouncement(isDraft) {
  const hint = $("formHint");

  const title = normalize($("inpTitle")?.value);
  const category = $("inpCategory")?.value || "General";
  const message = normalize($("inpMessage")?.value);
  const scheduleISO = $("inpSchedule")?.value || "";

  if (!title) {
    if (hint) hint.textContent = "Title is required.";
    return;
  }
  if (!message) {
    if (hint) hint.textContent = "Message is required.";
    return;
  }

  const hasScope = TEACHER_SCOPE.className && TEACHER_SCOPE.sectionName;
  if (!hasScope && hint) {
    hint.textContent = "⚠️ No assigned class/section yet. This will be saved as (unassigned) for now.";
  }

  let publishAt = null;
  if (scheduleISO) {
    const t = new Date(scheduleISO + "T08:00:00").getTime();
    if (!Number.isNaN(t)) publishAt = t;
  }
  if (!publishAt && !isDraft) publishAt = Date.now();

  const u = readLS(LS_KEYS.USER, {}) || {};
  const authorName =
    u.fullName ||
    [u.firstName, u.middleName, u.lastName].filter(Boolean).join(" ") ||
    u.username ||
    "Teacher";

  const now = Date.now();

  const payloadBase = {
    title,
    category,
    message,
    images: [...draftImages],
    audience: "class",
    className: hasScope ? TEACHER_SCOPE.className : "",
    sectionName: hasScope ? TEACHER_SCOPE.sectionName : "",
    authorRole: "teacher",
    authorName,
    isDraft: !!isDraft,
    publishAt,
    updatedAt: now,
  };

  if (editingId) {
    const idx = store.findIndex((a) => a.id === editingId);
    if (idx >= 0) store[idx] = { ...store[idx], ...payloadBase };
  } else {
    store.push({ id: uid(), ...payloadBase, createdAt: now });
  }

  saveStore();
  closeModal();
  renderList();
}

function deleteAnnouncement(id) {
  const a = store.find((x) => x.id === id);
  if (!a) return;
  if (!confirm(`Delete "${a.title}"?`)) return;
  store = store.filter((x) => x.id !== id);
  saveStore();
  renderList();
}

function viewAnnouncement(id) {
  const a = store.find((x) => x.id === id);
  if (!a) return;
  alert(`${a.title}\n\n${a.message}`);
}

// ----- Tabs -----
function setTab(next) {
  tab = next;

  const my = $("tabMy");
  const adm = $("tabAdmin");
  if (my) {
    my.classList.toggle("active", tab === "my");
    my.setAttribute("aria-selected", tab === "my" ? "true" : "false");
  }
  if (adm) {
    adm.classList.toggle("active", tab === "admin");
    adm.setAttribute("aria-selected", tab === "admin" ? "true" : "false");
  }

  renderList();
}

// ----- Seed admin announcements -----
function seedAdminIfEmpty() {
  const hasAnyAdmin = store.some((a) => a.authorRole === "admin" && a.audience === "all");
  if (hasAnyAdmin) return;

  const now = Date.now();
  store.push(
    {
      id: uid(),
      title: "Welcome Back!",
      category: "General",
      message: "Classes resume this week. Please check your schedule and prepare your materials.",
      images: [],
      audience: "all",
      authorRole: "admin",
      authorName: "Admin",
      isDraft: false,
      publishAt: now - 1000 * 60 * 60 * 6,
      createdAt: now - 1000 * 60 * 60 * 6,
      updatedAt: now - 1000 * 60 * 60 * 6,
    },
    {
      id: uid(),
      title: "Reminder: Flag Ceremony",
      category: "Reminder",
      message: "Flag ceremony will be held every Monday, 7:15 AM. Please be on time.",
      images: [],
      audience: "all",
      authorRole: "admin",
      authorName: "Admin",
      isDraft: false,
      publishAt: now - 1000 * 60 * 60 * 24,
      createdAt: now - 1000 * 60 * 60 * 24,
      updatedAt: now - 1000 * 60 * 60 * 24,
    }
  );

  saveStore();
}

// ----- Bind -----
function bind() {
  $("tabMy")?.addEventListener("click", () => setTab("my"));
  $("tabAdmin")?.addEventListener("click", () => setTab("admin"));

  $("btnCreate")?.addEventListener("click", () => openModal("create"));

  $("searchInput")?.addEventListener("input", renderList);
  $("statusFilter")?.addEventListener("change", renderList);
  $("catFilter")?.addEventListener("change", renderList);

  // list actions
  $("listWrap")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;

    const act = btn.dataset.act;
    const id = btn.dataset.id;
    if (!id) return;

    if (act === "view") viewAnnouncement(id);
    if (act === "edit") {
      const a = store.find((x) => x.id === id);
      if (!a) return;
      openModal("edit", a);
    }
    if (act === "del") deleteAnnouncement(id);
  });

  // modal close
  $("modalBackdrop")?.addEventListener("click", closeModal);
  $("modalClose")?.addEventListener("click", closeModal);
  $("btnCancel")?.addEventListener("click", closeModal);

  // modal save buttons
  $("btnDraft")?.addEventListener("click", () => upsertAnnouncement(true));
  $("btnPublish")?.addEventListener("click", () => upsertAnnouncement(false));

  // file input
  $("inpFiles")?.addEventListener("change", async () => {
    const files = $("inpFiles")?.files;
    const dataUrls = await readFilesAsDataUrls(files);
    draftImages = [...draftImages, ...dataUrls].slice(0, 12);
    renderPreviews();
  });

  // remove preview
  $("imgPreviews")?.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-rm]");
    if (!b) return;
    const idx = Number(b.dataset.rm);
    if (Number.isNaN(idx)) return;
    draftImages.splice(idx, 1);
    renderPreviews();
  });

  // ESC close
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const modal = $("modal");
      if (modal && !modal.classList.contains("hidden")) closeModal();
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  // If the script is not running, you will NOT see this log.
  console.log("[teacher-announcements] loaded");

  loadStore();
  seedAdminIfEmpty();
  renderHeaderMeta();
  bind();
  setTab("my");
});
