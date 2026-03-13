// frontend/src/js/admin-announcements.js
document.addEventListener("DOMContentLoaded", function () {
  const $ = (id) => document.getElementById(id);

  const LS_KEYS = { ANN: "rbms_announcements_v1" };

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

  function uid(prefix = "ANN") {
    return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`;
  }
  function nowISO() {
    return new Date().toISOString();
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
  function escapeHtml(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
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
  function computeStatus(a) {
    if (a.archived) return "archived";
    if (a.draft) return "draft";
    if (a.publishAt) {
      const t = new Date(a.publishAt).getTime();
      if (!Number.isNaN(t) && t > Date.now()) return "scheduled";
    }
    return "published";
  }
  function statusLabel(st) {
    return (
      {
        published: "Published",
        scheduled: "Scheduled",
        draft: "Draft",
        archived: "Archived",
      }[st] || "Published"
    );
  }
  function toISOFromLocal(localStr) {
    if (!localStr) return "";
    const d = new Date(localStr);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString();
  }

  // -------- State --------
  let announcements = readLS(LS_KEYS.ANN, []);
  let openMenuId = null;

  let editingId = null;
  let tempFiles = [];
  let viewingId = null;

  // -------- DOM --------
  const feed = $("annFeed");
  const empty = $("annEmpty");

  const search = $("annSearch");
  const typeFilter = $("typeFilter");
  const catFilter = $("catFilter");

  const createBtn = $("createAnnBtn");

  // create/edit modal
  const modal = $("annModal");
  const modalBackdrop = $("annModalBackdrop");
  const modalCloseX = $("annModalCloseX");
  const cancelBtn = $("annCancelBtn");
  const draftBtn = $("annDraftBtn");
  const publishBtn = $("annPublishBtn");
  const modalTitle = $("annModalTitle");

  const fTitle = $("annTitle");
  const fCat = $("annCategory");
  const fMsg = $("annMessage");
  const fPublishAt = $("annPublishAt");
  const fFiles = $("annFiles");
  const drop = $("annDrop");
  const pickFiles = $("annPickFiles");
  const filesList = $("annFilesList");
  const formError = $("annFormError");

  // view modal
  const viewModal = $("annViewModal");
  const viewBackdrop = $("annViewBackdrop");
  const viewCloseX = $("annViewCloseX");
  const viewCloseBtn = $("annViewCloseBtn");
  const viewEditBtn = $("annViewEditBtn");
  const viewArchiveBtn = $("annViewArchiveBtn");

  const vMeta = $("annViewMeta");
  const vPill = $("annViewPill");
  const vStatus = $("annViewStatus");
  const vH = $("annViewH");
  const vMsg = $("annViewMsg");
  const vFiles = $("annViewFiles");

  // -------- Seed sample --------
  if (!Array.isArray(announcements) || announcements.length === 0) {
    announcements = [
      {
        id: uid(),
        title: "Emergency Drill Tomorrow",
        category: "priority",
        message:
          "Please be advised of a mandatory emergency drill tomorrow. Kindly follow the nearest exit routes and assemble at the designated area.",
        publishAt: "",
        createdAt: nowISO(),
        updatedAt: nowISO(),
        draft: false,
        archived: false,
        files: [],
      },
      {
        id: uid(),
        title: "New Curriculum Workshop",
        category: "events",
        message:
          "There will be a workshop to discuss the changes for the new curriculum updates for all teachers on Friday at 2:00 pm in the library.",
        publishAt: "",
        createdAt: nowISO(),
        updatedAt: nowISO(),
        draft: false,
        archived: false,
        files: [],
      },
      {
        id: uid(),
        title: "Parent–Teacher Conference",
        category: "academic",
        message:
          "All parents are encouraged to attend the conference scheduled for Friday next week at 1:00 pm in their child’s classroom.",
        publishAt: "",
        createdAt: nowISO(),
        updatedAt: nowISO(),
        draft: false,
        archived: false,
        files: [],
      },
    ];
    writeLS(LS_KEYS.ANN, announcements);
  }

  // -------- Menus --------
  function closeAllMenus() {
    openMenuId = null;
    feed.querySelectorAll(".ann-menu").forEach((m) => m.classList.add("hidden"));
  }

  function toggleMenuForCard(cardEl) {
    const id = cardEl?.dataset?.id;
    if (!id) return;

    const menu = cardEl.querySelector(".ann-menu");
    if (!menu) return;

    const isOpen = openMenuId === id;
    closeAllMenus();

    if (!isOpen) {
      openMenuId = id;
      menu.classList.remove("hidden");
    }
  }

  // -------- Render --------
  function render() {
    closeAllMenus();

    const q = (search.value || "").trim().toLowerCase();
    const type = typeFilter.value;
    const cat = catFilter.value;

    let list = announcements.slice();
    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (cat !== "all") list = list.filter((a) => (a.category || "general") === cat);
    if (type !== "all") list = list.filter((a) => computeStatus(a) === type);

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
      const st = computeStatus(a);
      const pillText = catLabel(a.category);
      const pillClass = catPillClass(a.category);

      const el = document.createElement("div");
      el.className = "ann-card";
      el.dataset.id = a.id;

      el.innerHTML = `
        <div class="ann-card-top">
          <div class="ann-card-left">
            <div class="ann-title-row">
              <h3 class="ann-title">${escapeHtml(a.title || "Untitled")}</h3>
              <span class="ann-status">${statusLabel(st)}</span>
            </div>

            <p class="ann-body">${escapeHtml(clampText(a.message || ""))}</p>

            <div class="ann-meta">
              <span>Posted: ${escapeHtml(fmtShort(a.createdAt))}</span>
              ${
                a.publishAt
                  ? `<span>• Publish: ${escapeHtml(fmtShort(toISOFromLocal(a.publishAt)))}</span>`
                  : ""
              }
              ${a.files && a.files.length ? `<span>• Attachments: ${a.files.length}</span>` : ""}
            </div>
          </div>

          <div class="ann-card-right">
            <span class="ann-pill ${pillClass}">${pillText}</span>
            <button class="ann-kebab" type="button" aria-label="More">⋮</button>
          </div>
        </div>

        <div class="ann-menu hidden" role="menu">
          <button type="button" data-act="view">View</button>
          <button type="button" data-act="edit">Edit</button>
          <button type="button" data-act="archive">${a.archived ? "Unarchive" : "Archive"}</button>
          <button type="button" data-act="delete" class="danger">Delete</button>
        </div>
      `;

      feed.appendChild(el);
    });
  }

  // -------- Modals --------
  function openModal() {
    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
  function closeModal() {
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    clearFormError();
  }
  function openViewModal() {
    viewModal.classList.remove("hidden");
    viewModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }
  function closeViewModal() {
    viewModal.classList.add("hidden");
    viewModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }
  function setFormError(msg) {
    formError.textContent = msg;
    formError.classList.remove("hidden");
  }
  function clearFormError() {
    formError.textContent = "";
    formError.classList.add("hidden");
  }

  function renderFiles() {
    filesList.innerHTML = "";
    if (!tempFiles.length) return;

    tempFiles.forEach((f, idx) => {
      const item = document.createElement("div");
      item.className = "ann-file";
      item.innerHTML = `
        <img src="${f.dataUrl}" alt="file preview">
        <div class="ann-file-name" title="${escapeHtml(f.name)}">${escapeHtml(f.name)}</div>
        <button class="ann-file-x" type="button" aria-label="Remove">✕</button>
      `;
      item.querySelector(".ann-file-x").addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        tempFiles.splice(idx, 1);
        renderFiles();
      });
      filesList.appendChild(item);
    });
  }

  function resetFormUI() {
    editingId = null;
    tempFiles = [];
    modalTitle.textContent = "Create New Announcement";
    draftBtn.textContent = "Draft";
    publishBtn.textContent = "Publish";
    fTitle.value = "";
    fCat.value = "general";
    fMsg.value = "";
    fPublishAt.value = "";
    renderFiles();
    clearFormError();
  }

  function openCreate() {
    resetFormUI();
    openModal();
  }

  function openEdit(id) {
    const a = announcements.find((x) => x.id === id);
    if (!a) return;

    editingId = id;
    modalTitle.textContent = "Edit Announcement";
    draftBtn.textContent = "Save Draft";
    publishBtn.textContent = "Save & Publish";

    fTitle.value = a.title || "";
    fCat.value = a.category || "general";
    fMsg.value = a.message || "";
    fPublishAt.value = a.publishAt || "";
    tempFiles = Array.isArray(a.files) ? a.files.slice() : [];
    renderFiles();
    openModal();
  }

  function openView(id) {
    const a = announcements.find((x) => x.id === id);
    if (!a) return;

    viewingId = id;

    const st = computeStatus(a);
    const label = catLabel(a.category);
    const pillClass = catPillClass(a.category);

    vMeta.textContent = `Posted: ${fmtShort(a.createdAt)}${
      a.publishAt ? " • Publish: " + fmtShort(toISOFromLocal(a.publishAt)) : ""
    }`;

    vPill.className = `ann-pill ${pillClass}`;
    vPill.textContent = label;
    vStatus.textContent = statusLabel(st);

    vH.textContent = a.title || "Untitled";
    vMsg.textContent = a.message || "—";

    vFiles.innerHTML = "";
    if (a.files && a.files.length) {
      a.files.forEach((f) => {
        const img = document.createElement("img");
        img.src = f.dataUrl;
        img.alt = f.name;
        vFiles.appendChild(img);
      });
    }

    viewArchiveBtn.textContent = a.archived ? "Unarchive" : "Archive";
    openViewModal();
  }

  // -------- CRUD --------
  function validateForm() {
    const title = (fTitle.value || "").trim();
    const msg = (fMsg.value || "").trim();
    if (!title) return "Title is required.";
    if (!msg) return "Message is required.";
    if (tempFiles.length > 5) return "Please attach up to 5 images only.";
    return null;
  }

  function saveAnnouncement({ draft, publish }) {
    clearFormError();

    const err = validateForm();
    if (err) return setFormError(err);

    const obj = {
      title: (fTitle.value || "").trim(),
      category: fCat.value || "general",
      message: (fMsg.value || "").trim(),
      publishAt: fPublishAt.value || "",
      files: tempFiles.slice(),
      updatedAt: nowISO(),
      draft: !!draft,
      archived: false,
    };

    if (editingId) {
      const idx = announcements.findIndex((x) => x.id === editingId);
      if (idx === -1) return;
      announcements[idx] = {
        ...announcements[idx],
        ...obj,
        draft: publish ? false : obj.draft,
      };
    } else {
      announcements.push({
        id: uid(),
        createdAt: nowISO(),
        ...obj,
        draft: publish ? false : obj.draft,
      });
    }

    writeLS(LS_KEYS.ANN, announcements);
    closeModal();
    render();
  }

  function toggleArchive(id) {
    const idx = announcements.findIndex((x) => x.id === id);
    if (idx === -1) return;
    announcements[idx].archived = !announcements[idx].archived;
    announcements[idx].updatedAt = nowISO();
    writeLS(LS_KEYS.ANN, announcements);
    render();
  }

  function deleteAnn(id) {
    const a = announcements.find((x) => x.id === id);
    if (!a) return;
    const ok = confirm(`Delete "${a.title || "Untitled"}"? This cannot be undone.`);
    if (!ok) return;
    announcements = announcements.filter((x) => x.id !== id);
    writeLS(LS_KEYS.ANN, announcements);
    render();
  }

  // -------- Files --------
  function readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ""));
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    const images = files.filter((f) => f.type && f.type.startsWith("image/"));
    if (!images.length) return setFormError("Only image attachments are supported for now.");

    (async () => {
      for (const f of images) {
        if (tempFiles.length >= 5) break;
        const dataUrl = await readAsDataURL(f);
        tempFiles.push({ name: f.name, dataUrl });
      }
      renderFiles();
    })().catch(() => setFormError("Failed to attach image(s). Try a smaller file."));
  }

  // -------- Toolbar --------
  function initToolbar() {
    const toolbar = $("annToolbar");
    if (!toolbar) return;

    function wrapSelection(textarea, left, right) {
      textarea.focus();
      const start = textarea.selectionStart ?? 0;
      const end = textarea.selectionEnd ?? 0;
      const val = textarea.value;
      const selected = val.slice(start, end);

      if (start === end) {
        const insert = left + right;
        textarea.value = val.slice(0, start) + insert + val.slice(end);
        const pos = start + left.length;
        textarea.setSelectionRange(pos, pos);
        return;
      }

      textarea.value = val.slice(0, start) + left + selected + right + val.slice(end);
      textarea.setSelectionRange(start + left.length, end + left.length);
    }

    function prefixLines(textarea, prefixFn) {
      textarea.focus();
      const val = textarea.value;
      const start = textarea.selectionStart ?? 0;
      const end = textarea.selectionEnd ?? 0;

      const selected = val.slice(start, end);
      const lines = selected ? selected.split("\n") : [""];
      const updated = lines
        .map((line, i) => {
          if (!line.trim()) return line;
          return prefixFn(i, line) + line;
        })
        .join("\n");

      textarea.value = val.slice(0, start) + updated + val.slice(end);
      textarea.setSelectionRange(start, start + updated.length);
    }

    toolbar.addEventListener("click", (e) => {
      const btn = e.target.closest(".ann-tool");
      if (!btn || btn.disabled) return;
      const act = btn.dataset.act;
      if (!act) return;

      if (act === "bold") wrapSelection(fMsg, "**", "**");
      if (act === "italic") wrapSelection(fMsg, "*", "*");
      if (act === "underline") wrapSelection(fMsg, "__", "__");
      if (act === "bullets") prefixLines(fMsg, () => "• ");
      if (act === "numbered") prefixLines(fMsg, (i) => `${i + 1}. `);
    });
  }

  // ============================
  // ✅ ONE CLICK HANDLER (delegation) — removes glitch
  // ============================
  feed.addEventListener("click", (e) => {
    const kebab = e.target.closest(".ann-kebab");
    const menuBtn = e.target.closest(".ann-menu button[data-act]");
    const card = e.target.closest(".ann-card");

    // kebab toggle
    if (kebab && card) {
      e.preventDefault();
      e.stopPropagation();
      toggleMenuForCard(card);
      return;
    }

    // menu action
    if (menuBtn && card) {
      e.preventDefault();
      e.stopPropagation();
      const id = card.dataset.id;
      const act = menuBtn.dataset.act;
      closeAllMenus();

      if (act === "view") openView(id);
      if (act === "edit") openEdit(id);
      if (act === "archive") toggleArchive(id);
      if (act === "delete") deleteAnn(id);
      return;
    }

    // click on card body opens view
    if (card) {
      // ignore any button clicks
      if (e.target.closest("button") || e.target.closest("a")) return;
      openView(card.dataset.id);
    }
  });

  // -------- other events --------
  search.addEventListener("input", render);
  typeFilter.addEventListener("change", render);
  catFilter.addEventListener("change", render);

  createBtn.addEventListener("click", openCreate);

  modalBackdrop.addEventListener("click", closeModal);
  modalCloseX.addEventListener("click", closeModal);
  cancelBtn.addEventListener("click", closeModal);

  draftBtn.addEventListener("click", () => saveAnnouncement({ draft: true, publish: false }));
  publishBtn.addEventListener("click", () => saveAnnouncement({ draft: false, publish: true }));

  pickFiles.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    fFiles.click();
  });
  drop.addEventListener("click", () => fFiles.click());
  fFiles.addEventListener("change", (e) => handleFiles(e.target.files));

  drop.addEventListener("dragover", (e) => {
    e.preventDefault();
    drop.style.filter = "brightness(.99)";
  });
  drop.addEventListener("dragleave", () => {
    drop.style.filter = "";
  });
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.style.filter = "";
    handleFiles(e.dataTransfer.files);
  });

  document.addEventListener("click", () => closeAllMenus());
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!modal.classList.contains("hidden")) closeModal();
      if (!viewModal.classList.contains("hidden")) closeViewModal();
      closeAllMenus();
    }
  });

  viewBackdrop.addEventListener("click", closeViewModal);
  viewCloseX.addEventListener("click", closeViewModal);
  viewCloseBtn.addEventListener("click", closeViewModal);

  viewEditBtn.addEventListener("click", () => {
    if (!viewingId) return;
    closeViewModal();
    openEdit(viewingId);
  });

  viewArchiveBtn.addEventListener("click", () => {
    if (!viewingId) return;
    const id = viewingId;
    closeViewModal();
    toggleArchive(id);
    openView(id);
  });

  // init
  initToolbar();
  render();
});
