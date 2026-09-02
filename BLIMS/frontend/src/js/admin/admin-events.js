// frontend/src/js/admin-events.js
(function () {
  const $ = (id) => document.getElementById(id);

  const API_BASE = "/api/admin/events";
  let csrfToken = "";

  // -------- Helpers --------
  function nowISO() {
    return new Date().toISOString();
  }

  function toISOFromLocal(localStr) {
    if (!localStr) return "";
    const d = new Date(localStr);
    if (Number.isNaN(d.getTime())) return "";
    return d.toISOString();
  }

  function toLocalInputValue(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";

    const pad = (n) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());

    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
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

  function clampText(s, n = 140) {
    const t = String(s || "").trim();
    if (t.length <= n) return t;
    return t.slice(0, n).trim() + "…";
  }

  function typeLabel(t) {
    return (
      {
        school: "School Event",
        holiday: "Holiday",
        exam: "Exam",
        meeting: "Meeting",
        other: "Other",
      }[t] || "School Event"
    );
  }

  function typeClass(t) {
    return (
      {
        school: "",
        holiday: "holiday",
        exam: "exam",
        meeting: "meeting",
        other: "other",
      }[t] || ""
    );
  }

  function audienceLabel(aud) {
    return (
      {
        all: "All",
        teachers: "Teachers",
        students: "Students",
      }[aud] || "All"
    );
  }

  function normalizeEvent(ev) {
    return {
      id: String(ev._id || ev.id || ""),
      _id: String(ev._id || ev.id || ""),
      title: ev.title || "",
      type: ev.type || "school",
      audience: ev.audience || "all",
      start: ev.start ? toLocalInputValue(ev.start) : "",
      end: ev.end ? toLocalInputValue(ev.end) : "",
      location: ev.location || "",
      description: ev.description || "",
      image: ev.image || null,
      createdAt: ev.createdAt || nowISO(),
      updatedAt: ev.updatedAt || nowISO(),
    };
  }

  function computeStatus(ev) {
    const startISO = toISOFromLocal(ev.start);
    const endISO = toISOFromLocal(ev.end);

    const startT = startISO ? new Date(startISO).getTime() : NaN;
    const endT = endISO ? new Date(endISO).getTime() : NaN;
    const nowT = Date.now();

    if (!Number.isNaN(startT) && !Number.isNaN(endT)) {
      if (nowT < startT) return "upcoming";
      if (nowT >= startT && nowT <= endT) return "ongoing";
      return "past";
    }

    if (!Number.isNaN(startT) && Number.isNaN(endT)) {
      if (nowT < startT) return "upcoming";
      return "past";
    }

    return "upcoming";
  }

  function statusLabel(st) {
    return (
      {
        upcoming: "Upcoming",
        ongoing: "Ongoing",
        past: "Past",
      }[st] || "Upcoming"
    );
  }

  function escapeHtml(s) {
    return String(s || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function ensureCsrfToken() {
    if (csrfToken) return csrfToken;

    const res = await fetch("/api/csrf-token", {
      credentials: "include",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || !data?.ok || !data?.csrfToken) {
      throw new Error(data?.message || "Failed to get CSRF token.");
    }

    csrfToken = data.csrfToken;
    return csrfToken;
  }

  async function api(url, options = {}) {
    const method = String(options.method || "GET").toUpperCase();

    const headers = {
      ...(options.headers || {}),
    };

    if (method !== "GET") {
      await ensureCsrfToken();
      headers["x-csrf-token"] = csrfToken;
    }

    if (options.body && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok || data?.ok === false) {
      throw new Error(data?.message || "Request failed.");
    }

    return data;
  }

  // -------- State --------
  let events = [];
  let editingId = null;
  let tempImage = null; // {name, dataUrl} | null
  let viewingId = null;
  let openMenuId = null;

  // -------- DOM --------
  const feed = $("evFeed");
  const empty = $("evEmpty");

  const search = $("evSearch");
  const statusFilter = $("evStatusFilter");
  const typeFilter = $("evTypeFilter");
  const audienceFilter = $("evAudienceFilter");

  const createBtn = $("createEventBtn");

  // create/edit modal
  const modal = $("evModal");
  const modalBackdrop = $("evModalBackdrop");
  const modalCloseX = $("evModalCloseX");
  const cancelBtn = $("evCancelBtn");
  const saveBtn = $("evSaveBtn");
  const deleteBtn = $("evDeleteBtn");
  const modalTitle = $("evModalTitle");

  const fTitle = $("evTitle");
  const fType = $("evType");
  const fAudience = $("evAudience");
  const fStart = $("evStart");
  const fEnd = $("evEnd");
  const fLoc = $("evLocation");
  const fDesc = $("evDesc");
  const fFile = $("evFile");
  const drop = $("evDrop");
  const pick = $("evPickFile");
  const preview = $("evFilePreview");
  const formError = $("evFormError");

  // view modal
  const viewModal = $("evViewModal");
  const viewBackdrop = $("evViewBackdrop");
  const viewCloseX = $("evViewCloseX");
  const viewCloseBtn = $("evViewCloseBtn");
  const viewEditBtn = $("evViewEditBtn");

  const vMeta = $("evViewMeta");
  const vTypePill = $("evViewTypePill");
  const vAudPill = $("evViewAudiencePill");
  const vStatus = $("evViewStatus");
  const vH = $("evViewH");
  const vStart = $("evViewStart");
  const vEnd = $("evViewEnd");
  const vLoc = $("evViewLoc");
  const vDesc = $("evViewDesc");
  const vImgWrap = $("evViewImgWrap");
  const vImg = $("evViewImg");

  // -------- UI helpers --------
  function setFormError(msg) {
    formError.textContent = msg;
    formError.classList.remove("hidden");
  }

  function clearFormError() {
    formError.textContent = "";
    formError.classList.add("hidden");
  }

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

  function resetFormUI() {
    editingId = null;
    tempImage = null;

    modalTitle.textContent = "Create New Event";
    deleteBtn.classList.add("hidden");

    fTitle.value = "";
    fType.value = "school";
    fAudience.value = "all";
    fStart.value = "";
    fEnd.value = "";
    fLoc.value = "";
    fDesc.value = "";

    renderImagePreview();
    clearFormError();
  }

  function renderImagePreview() {
    preview.innerHTML = "";
    if (!tempImage) return;

    const img = document.createElement("img");
    img.src = tempImage.dataUrl;
    img.alt = tempImage.name;

    const x = document.createElement("button");
    x.type = "button";
    x.className = "ev-file-x";
    x.textContent = "✕";
    x.addEventListener("click", (e) => {
      e.stopPropagation();
      tempImage = null;
      renderImagePreview();
    });

    preview.appendChild(img);
    preview.appendChild(x);
  }

  function openCreate() {
    resetFormUI();
    openModal();
  }

  function openEdit(id) {
    const ev = events.find((x) => x.id === id);
    if (!ev) return;

    editingId = id;
    modalTitle.textContent = "Edit Event";
    deleteBtn.classList.remove("hidden");

    fTitle.value = ev.title || "";
    fType.value = ev.type || "school";
    fAudience.value = ev.audience || "all";
    fStart.value = ev.start || "";
    fEnd.value = ev.end || "";
    fLoc.value = ev.location || "";
    fDesc.value = ev.description || "";

    tempImage = ev.image ? { ...ev.image } : null;
    renderImagePreview();

    openModal();
  }

  function openView(id) {
    const ev = events.find((x) => x.id === id);
    if (!ev) return;

    viewingId = id;

    const st = computeStatus(ev);
    const tLbl = typeLabel(ev.type);
    const tCls = typeClass(ev.type);
    const audLbl = audienceLabel(ev.audience);

    vMeta.textContent = `Created: ${fmtShort(ev.createdAt)} • Updated: ${fmtShort(ev.updatedAt)}`;
    vTypePill.className = `ev-pill ${tCls}`;
    vTypePill.textContent = tLbl;

    vAudPill.className = "ev-pill soft";
    vAudPill.textContent = `Audience: ${audLbl}`;

    vStatus.textContent = statusLabel(st);

    vH.textContent = ev.title || "Untitled";
    vStart.value = ev.start ? fmtShort(toISOFromLocal(ev.start)) : "—";
    vEnd.value = ev.end ? fmtShort(toISOFromLocal(ev.end)) : "—";
    vLoc.value = ev.location || "—";
    vDesc.textContent = ev.description || "—";

    if (ev.image && ev.image.dataUrl) {
      vImgWrap.classList.remove("hidden");
      vImg.src = ev.image.dataUrl;
    } else {
      vImgWrap.classList.add("hidden");
      vImg.removeAttribute("src");
    }

    openViewModal();
  }

  function closeAllMenus() {
    openMenuId = null;
    document.querySelectorAll(".ev-menu").forEach((m) => m.classList.add("hidden"));
  }

  // -------- Data loading --------
  async function loadEvents() {
    feed.innerHTML = "";
    empty.classList.add("hidden");

    try {
      const data = await api(API_BASE);
      const rows = Array.isArray(data?.data) ? data.data : [];
      events = rows.map(normalizeEvent);
      render();
    } catch (err) {
      console.error("loadEvents error:", err);
      events = [];
      empty.classList.remove("hidden");
      if (empty) empty.textContent = err.message || "Failed to load events.";
    }
  }

  // -------- Render list --------
  function render() {
    closeAllMenus();

    const q = (search.value || "").trim().toLowerCase();
    const stFilter = statusFilter.value;
    const ty = typeFilter.value;
    const aud = audienceFilter.value;

    let list = events.slice();

    list.sort((a, b) => {
      const sa = new Date(toISOFromLocal(a.start) || a.createdAt).getTime();
      const sb = new Date(toISOFromLocal(b.start) || b.createdAt).getTime();
      return sa - sb;
    });

    if (ty !== "all") list = list.filter((e) => (e.type || "school") === ty);

    if (aud === "teachers" || aud === "students") {
      list = list.filter((e) => (e.audience || "all") === aud);
    }

    if (stFilter !== "all") {
      list = list.filter((e) => computeStatus(e) === stFilter);
    }

    if (q) {
      list = list.filter((e) => {
        const hay = `${e.title || ""} ${e.location || ""} ${e.description || ""}`.toLowerCase();
        return hay.includes(q);
      });
    }

    feed.innerHTML = "";

    if (list.length === 0) {
      empty.classList.remove("hidden");
      return;
    }

    empty.classList.add("hidden");

    list.forEach((ev) => {
      const st = computeStatus(ev);
      const stLbl = statusLabel(st);
      const tLbl = typeLabel(ev.type);
      const tCls = typeClass(ev.type);

      const el = document.createElement("div");
      el.className = "ev-card";
      el.dataset.id = ev.id;

      const startISO = toISOFromLocal(ev.start);
      const endISO = toISOFromLocal(ev.end);

      el.innerHTML = `
        <div class="ev-card-top">
          <div class="ev-left">
            <h3 class="ev-title">${escapeHtml(ev.title || "Untitled")}</h3>
            <div class="ev-sub">${escapeHtml(clampText(ev.description || "", 160) || "—")}</div>

            <div class="ev-meta">
              <span>Start: ${escapeHtml(startISO ? fmtShort(startISO) : "—")}</span>
              <span>• End: ${escapeHtml(endISO ? fmtShort(endISO) : "—")}</span>
              ${ev.location ? `<span>• Location: ${escapeHtml(ev.location)}</span>` : ""}
            </div>
          </div>

          <div class="ev-right">
            <span class="ev-pill ${tCls}">${escapeHtml(tLbl)}</span>
            <span class="ev-pill soft">Audience: ${escapeHtml(audienceLabel(ev.audience))}</span>
            <span class="ev-status">${escapeHtml(stLbl)}</span>

            <button class="ev-kebab" type="button" aria-label="More">⋮</button>
          </div>
        </div>

        <div class="ev-menu hidden" role="menu">
          <button type="button" data-act="view">View</button>
          <button type="button" data-act="edit">Edit</button>
          <button type="button" data-act="delete" class="danger">Delete</button>
        </div>
      `;

      el.addEventListener("click", () => openView(ev.id));

      const kebab = el.querySelector(".ev-kebab");
      const menu = el.querySelector(".ev-menu");

      kebab.addEventListener("click", (e) => {
        e.stopPropagation();

        const isOpen = openMenuId === ev.id;
        closeAllMenus();

        if (!isOpen) {
          openMenuId = ev.id;
          menu.classList.remove("hidden");
        }
      });

      menu.addEventListener("click", (e) => {
        e.stopPropagation();
        const btn = e.target.closest("button[data-act]");
        if (!btn) return;

        const act = btn.dataset.act;
        closeAllMenus();

        if (act === "view") openView(ev.id);
        if (act === "edit") openEdit(ev.id);
        if (act === "delete") deleteEvent(ev.id);
      });

      feed.appendChild(el);
    });
  }

  // -------- Validation + CRUD --------
  function validateForm() {
    const title = (fTitle.value || "").trim();
    if (!title) return "Event title is required.";

    const start = fStart.value;
    const end = fEnd.value;

    if (!start) return "Start date/time is required.";

    if (end) {
      const s = new Date(start).getTime();
      const e = new Date(end).getTime();
      if (!Number.isNaN(s) && !Number.isNaN(e) && e < s) {
        return "End time must be after Start time.";
      }
    }

    if (tempImage && tempImage.dataUrl && tempImage.dataUrl.length > 2_500_000) {
      return "Image is too large. Please use a smaller image.";
    }

    return null;
  }

  async function saveEvent() {
    clearFormError();

    const err = validateForm();
    if (err) {
      setFormError(err);
      return;
    }

    const payload = {
      title: (fTitle.value || "").trim(),
      type: fType.value || "school",
      audience: fAudience.value || "all",
      start: fStart.value ? new Date(fStart.value).toISOString() : null,
      end: fEnd.value ? new Date(fEnd.value).toISOString() : null,
      location: (fLoc.value || "").trim(),
      description: (fDesc.value || "").trim(),
      image: tempImage ? { ...tempImage } : null,
    };

    saveBtn.disabled = true;

    try {
      if (editingId) {
        await api(`${API_BASE}/${encodeURIComponent(editingId)}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await api(API_BASE, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      closeModal();
      await loadEvents();
    } catch (err) {
      console.error("saveEvent error:", err);
      setFormError(err.message || "Failed to save event.");
    } finally {
      saveBtn.disabled = false;
    }
  }

  async function deleteEvent(id) {
    const ev = events.find((x) => x.id === id);
    if (!ev) return;

    const ok = confirm(`Delete "${ev.title || "Untitled"}"? This cannot be undone.`);
    if (!ok) return;

    try {
      await api(`${API_BASE}/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      if (editingId === id) closeModal();
      if (viewingId === id) closeViewModal();

      await loadEvents();
    } catch (err) {
      console.error("deleteEvent error:", err);
      alert(err.message || "Failed to delete event.");
    }
  }

  // -------- Image handling --------
  function handleImage(file) {
    if (!file) return;

    if (!file.type || !file.type.startsWith("image/")) {
      setFormError("Only image files are supported for the banner.");
      return;
    }

    readAsDataURL(file)
      .then((dataUrl) => {
        tempImage = { name: file.name, dataUrl };
        renderImagePreview();
      })
      .catch(() => setFormError("Failed to load image. Try a smaller file."));
  }

  function readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result || ""));
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  // -------- Events wiring --------
  search.addEventListener("input", render);
  statusFilter.addEventListener("change", render);
  typeFilter.addEventListener("change", render);
  audienceFilter.addEventListener("change", render);

  createBtn.addEventListener("click", openCreate);

  modalBackdrop.addEventListener("click", closeModal);
  modalCloseX.addEventListener("click", closeModal);
  cancelBtn.addEventListener("click", closeModal);

  saveBtn.addEventListener("click", saveEvent);
  deleteBtn.addEventListener("click", () => {
    if (!editingId) return;
    deleteEvent(editingId);
  });

  pick.addEventListener("click", (e) => {
    e.stopPropagation();
    fFile.click();
  });

  drop.addEventListener("click", () => fFile.click());
  fFile.addEventListener("change", (e) => handleImage(e.target.files?.[0]));

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
    const file = e.dataTransfer.files?.[0];
    if (file) handleImage(file);
  });

  document.addEventListener("click", () => closeAllMenus());

  viewBackdrop.addEventListener("click", closeViewModal);
  viewCloseX.addEventListener("click", closeViewModal);
  viewCloseBtn.addEventListener("click", closeViewModal);

  viewEditBtn.addEventListener("click", () => {
    if (!viewingId) return;
    closeViewModal();
    openEdit(viewingId);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (!modal.classList.contains("hidden")) closeModal();
      if (!viewModal.classList.contains("hidden")) closeViewModal();
      closeAllMenus();
    }
  });

  // init
  loadEvents();
})();