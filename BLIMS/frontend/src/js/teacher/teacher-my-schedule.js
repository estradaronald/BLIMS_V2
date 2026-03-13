// frontend/src/js/teacher/teacher-my-schedule.js

document.addEventListener("DOMContentLoaded", () => {
  // ============================
  // TOPBAR USER MENU
  // ============================
  const userMenuBtn = document.getElementById("userMenuBtn");
  const userMenu = document.getElementById("userMenu");
  const userbox = document.getElementById("userbox");

  if (userMenuBtn && userMenu && userbox) {
    userMenuBtn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      userMenu.classList.toggle("open");
    });

    document.addEventListener("click", (ev) => {
      if (!userbox.contains(ev.target)) userMenu.classList.remove("open");
    });
  }

  // ============================
  // LOGOUT
  // ============================
  const topbarLogout = document.getElementById("topbarLogout");
  if (topbarLogout) {
    topbarLogout.addEventListener("click", () => {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "../../login.html";
    });
  }

  // ============================
  // STORAGE HELPERS
  // ============================
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

  // ✅ IMPORTANT: escape text before putting into innerHTML
  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ============================
  // CLASS & SECTION OPTIONS
  // ============================
  const CLASS_KEY = "teacher_classes_v1";
  const filterClass = document.getElementById("filterClass");

  let classes = readLS(CLASS_KEY, null);
  if (!Array.isArray(classes) || classes.length === 0) {
    classes = [
      { id: "class-1-a", label: "Class 1 - A" },
      { id: "class-1-b", label: "Class 1 - B" },
    ];
    writeLS(CLASS_KEY, classes);
  }

  function renderClassOptions(selectedId) {
    if (!filterClass) return;
    const keep = selectedId || filterClass.value || classes[0]?.id;

    filterClass.innerHTML = "";
    classes.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.label;
      filterClass.appendChild(opt);
    });

    if (keep) filterClass.value = keep;
  }

  renderClassOptions(classes[0]?.id);

  // Add Class modal
  const btnAddClass = document.getElementById("btnAddClass");
  const classModal = document.getElementById("classModal");
  const classModalBackdrop = document.getElementById("classModalBackdrop");
  const classModalClose = document.getElementById("classModalClose");
  const classModalCancel = document.getElementById("classModalCancel");
  const classModalSave = document.getElementById("classModalSave");
  const inpClass = document.getElementById("inpClass");
  const inpSection = document.getElementById("inpSection");
  const classModalHint = document.getElementById("classModalHint");

  const normalizeLabel = (s) =>
    String(s).trim().replace(/\s+/g, " ").toLowerCase();
  const slugify = (s) =>
    String(s)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9\-]/g, "");

  function openClassModal() {
    classModal?.classList.remove("hidden");
    if (classModalHint) classModalHint.textContent = "";
    if (inpClass) inpClass.value = "";
    if (inpSection) inpSection.value = "";
    setTimeout(() => inpClass?.focus(), 0);
  }
  function closeClassModal() {
    classModal?.classList.add("hidden");
  }
  function existsClassLabel(label) {
    const x = normalizeLabel(label);
    return classes.some((c) => normalizeLabel(c.label) === x);
  }

  btnAddClass?.addEventListener("click", openClassModal);
  classModalBackdrop?.addEventListener("click", closeClassModal);
  classModalClose?.addEventListener("click", closeClassModal);
  classModalCancel?.addEventListener("click", closeClassModal);

  classModalSave?.addEventListener("click", () => {
    const c = inpClass?.value?.trim();
    const s = inpSection?.value?.trim();

    if (!c || !s) {
      if (classModalHint)
        classModalHint.textContent = "Please enter both Class and Section.";
      return;
    }

    const label = `${c} - ${s}`;
    if (existsClassLabel(label)) {
      if (classModalHint)
        classModalHint.textContent = "That class & section already exists.";
      return;
    }

    const id = slugify(label);
    classes.push({ id, label });
    writeLS(CLASS_KEY, classes);

    renderClassOptions(id);
    closeClassModal();

    // keep selection clear if manage mode is on
    selectedId = null;
    syncSelectionUI();
    renderSchedule();
  });

  // ============================
  // SUBJECT OPTIONS + MODAL
  // ============================
  const SUBJECTS_KEY = "teacher_subjects_v1";
  let subjects = readLS(SUBJECTS_KEY, null);
  if (!Array.isArray(subjects) || subjects.length === 0) {
    subjects = [
      "Mathematics",
      "Science",
      "English",
      "Filipino",
      "Araling Panlipunan",
    ];
    writeLS(SUBJECTS_KEY, subjects);
  }

  const filterSubject = document.getElementById("filterSubject");

  function renderSubjectFilter() {
    if (!filterSubject) return;

    const keep = filterSubject.value || "all";
    filterSubject.innerHTML = "";

    const all = document.createElement("option");
    all.value = "all";
    all.textContent = "All Subjects";
    filterSubject.appendChild(all);

    subjects.forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      filterSubject.appendChild(opt);
    });

    const exists = Array.from(filterSubject.options).some((o) => o.value === keep);
    filterSubject.value = exists ? keep : "all";
  }

  renderSubjectFilter();

  // Subject modal wiring
  const btnAddSubject = document.getElementById("btnAddSubject");
  const subjectModal = document.getElementById("subjectModal");
  const subjectModalBackdrop = document.getElementById("subjectModalBackdrop");
  const subjectModalClose = document.getElementById("subjectModalClose");
  const subjectModalCancel = document.getElementById("subjectModalCancel");
  const subjectModalSave = document.getElementById("subjectModalSave");
  const inpSubject = document.getElementById("inpSubject");
  const subjectModalHint = document.getElementById("subjectModalHint");

  const normalizeSubject = (s) => String(s || "").trim().replace(/\s+/g, " ");

  function openSubjectModal() {
    subjectModal?.classList.remove("hidden");
    if (subjectModalHint) subjectModalHint.textContent = "";
    if (inpSubject) inpSubject.value = "";
    setTimeout(() => inpSubject?.focus(), 0);
  }
  function closeSubjectModal() {
    subjectModal?.classList.add("hidden");
  }
  function subjectExists(name) {
    const n = normalizeLabel(name);
    return subjects.some((s) => normalizeLabel(s) === n);
  }

  btnAddSubject?.addEventListener("click", openSubjectModal);
  subjectModalBackdrop?.addEventListener("click", closeSubjectModal);
  subjectModalClose?.addEventListener("click", closeSubjectModal);
  subjectModalCancel?.addEventListener("click", closeSubjectModal);

  // ============================
  // SETUP MODAL REFS (declared early so subject modal can refresh if open)
  // ============================
  const setupModal = document.getElementById("setupModal");
  const setupSubject = document.getElementById("setupSubject");

  subjectModalSave?.addEventListener("click", () => {
    const name = normalizeSubject(inpSubject?.value);
    if (!name) {
      if (subjectModalHint) subjectModalHint.textContent = "Please enter a subject name.";
      return;
    }
    if (subjectExists(name)) {
      if (subjectModalHint) subjectModalHint.textContent = "That subject already exists.";
      return;
    }

    subjects.push(name);
    writeLS(SUBJECTS_KEY, subjects);

    renderSubjectFilter();

    // refresh setup modal subject list if open
    if (setupSubject && setupModal && !setupModal.classList.contains("hidden")) {
      const keep = setupSubject.value;
      setupSubject.innerHTML = "";
      subjects.forEach((s) => {
        const opt = document.createElement("option");
        opt.value = s;
        opt.textContent = s;
        setupSubject.appendChild(opt);
      });
      setupSubject.value = keep && subjects.includes(keep) ? keep : name;
    }

    closeSubjectModal();
  });

  // ============================
  // WEEKLY GRID RENDER
  // ============================
  const gridHost = document.getElementById("msGrid");
  const weekLabel = document.getElementById("weekLabel");
  const msEmpty = document.getElementById("msEmpty");
  const gridWrap = document.querySelector(".ms-grid-wrap");

  const daysFull = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const dayShort = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const hours = [];
  const times = [];

  for (let h = 6; h <= 17; h++) {
    hours.push(h);
    const hr12 = ((h + 11) % 12) + 1;
    const ampm = h < 12 ? "AM" : "PM";
    times.push(`${hr12}:00 ${ampm}`);
  }

  let base = new Date();
  base.setHours(0, 0, 0, 0);

  function startOfWeekMon(d) {
    const x = new Date(d);
    const day = x.getDay();
    const diff = (day === 0 ? -6 : 1) - day;
    x.setDate(x.getDate() + diff);
    return x;
  }

  function fmtRangeLabel(monDate) {
    const fri = new Date(monDate);
    fri.setDate(fri.getDate() + 4);

    const month = monDate.toLocaleString("en-US", { month: "long" });
    const year = monDate.getFullYear();
    const d1 = monDate.getDate();
    const d2 = fri.getDate();

    return `${month} ${d1} - ${d2}, ${year}`;
  }

  function cell(text, className, data = null) {
    const el = document.createElement("div");
    el.className = className;
    el.textContent = text;
    if (data) Object.entries(data).forEach(([k, v]) => (el.dataset[k] = String(v)));
    return el;
  }

  function getOrCreateOverlay() {
    if (!gridHost) return null;

    gridHost.style.position = "relative";
    let overlay = gridHost.querySelector(".ms-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.className = "ms-overlay";
      overlay.style.position = "absolute";
      overlay.style.inset = "0";
      overlay.style.pointerEvents = "none";
      overlay.style.zIndex = "5";
      gridHost.appendChild(overlay);
    }
    return overlay;
  }

  function renderGrid() {
    if (!gridHost) return;

    const ROW_H = 80;

    const inner = document.createElement("div");
    inner.className = "ms-grid-inner";
    inner.style.gridTemplateColumns = `110px repeat(5, 1fr)`;
    inner.style.gridTemplateRows = `44px repeat(${times.length}, ${ROW_H}px)`;

    inner.appendChild(cell("", "ms-cell ms-day"));

    for (let c = 0; c < daysFull.length; c++) {
      const isLast = c === daysFull.length - 1;
      inner.appendChild(cell(daysFull[c], `ms-cell ms-day ${isLast ? "last-col" : ""}`));
    }

    for (let r = 0; r < times.length; r++) {
      inner.appendChild(cell(times[r], "ms-cell ms-time"));

      for (let c = 0; c < daysFull.length; c++) {
        const isLast = c === daysFull.length - 1;
        inner.appendChild(
          cell("", `ms-cell ms-slot ${isLast ? "last-col" : ""}`, {
            day: dayShort[c],
            hour: hours[r],
          })
        );
      }
    }

    gridHost.innerHTML = "";
    gridHost.appendChild(inner);

    getOrCreateOverlay();
  }

  function renderWeekLabel() {
    const mon = startOfWeekMon(base);
    if (weekLabel) weekLabel.textContent = fmtRangeLabel(mon);
  }

  // ============================
  // SCHEDULE STORAGE + RENDER
  // ============================
  const SCHED_KEY = "teacher_schedule_items_v1";

  // ✅ subtitle element (FIX)
  const msSubtitle = document.querySelector(".ms-h2");

  function getActiveClassId() {
    return filterClass?.value || classes[0]?.id;
  }
  function getActiveSubject() {
    return filterSubject?.value || "all";
  }

  function loadSchedule() {
    const all = readLS(SCHED_KEY, []);
    return Array.isArray(all) ? all : [];
  }

  function saveSchedule(items) {
    writeLS(SCHED_KEY, items);
  }

  function clearGridSlots() {
    document.querySelectorAll(".ms-slot").forEach((el) => (el.innerHTML = ""));
    const overlay = getOrCreateOverlay();
    if (overlay) overlay.innerHTML = "";
  }

  // ✅ update subtitle based on schedule state (FIX)
  function updateSubtitleAndEmpty(itemsForClass, visibleItems) {
    if (!msSubtitle) return;

    const defaultMsg =
      "No schedule set up yet. Add your weekly class schedule this year.";

    if (!itemsForClass.length) {
      msSubtitle.textContent = defaultMsg;
      return;
    }

    if (!visibleItems.length) {
      msSubtitle.textContent = "No schedules match the selected subject filter.";
      return;
    }

    const activeClassLabel =
      classes.find((c) => c.id === getActiveClassId())?.label || "this class";
    msSubtitle.textContent = `Schedule loaded for ${activeClassLabel}.`;
  }

  // ============================
  // MANAGE MODE (NEW)
  // ============================
  let isManage = false;
  let selectedId = null;

  function getItemById(id) {
    if (!id) return null;
    const all = loadSchedule();
    return all.find((x) => x.id === id) || null;
  }

  function selectedLabel() {
    const it = getItemById(selectedId);
    if (!it) return "No selected schedule";
    const clsLabel =
      (it.classLabel && String(it.classLabel).trim()) ||
      classes.find((c) => c.id === it.classId)?.label ||
      "";
    const startLabel = times[hours.indexOf(Number(it.startHour))] || `${it.startHour}:00`;
    const endLabel = times[hours.indexOf(Number(it.endHour))] || `${it.endHour}:00`;
    return `${it.subject} • ${clsLabel} • ${it.day} • ${startLabel} - ${endLabel}`;
  }

  // Create manage bar UI under the grid (no HTML edits needed)
  let manageBar, manageToggle, manageEdit, manageDelete, manageLabel;

  function ensureManageBar() {
    if (!gridWrap) return;

    if (manageBar) return;

    manageBar = document.createElement("div");
    manageBar.className = "ms-managebar";

    manageBar.innerHTML = `
      <div class="ms-managebar-left">
        <button class="ms-ghost" id="msManageToggle" type="button">Manage schedule</button>
        <div class="ms-manage-label" id="msManageLabel">No selected schedule</div>
      </div>
      <div class="ms-managebar-right">
        <button class="ms-ghost" id="msManageEdit" type="button" disabled>Edit</button>
        <button class="ms-ghost ms-danger" id="msManageDelete" type="button" disabled>Delete</button>
      </div>
    `;

    gridWrap.appendChild(manageBar);

    manageToggle = manageBar.querySelector("#msManageToggle");
    manageEdit = manageBar.querySelector("#msManageEdit");
    manageDelete = manageBar.querySelector("#msManageDelete");
    manageLabel = manageBar.querySelector("#msManageLabel");

    manageToggle?.addEventListener("click", () => {
      isManage = !isManage;
      if (!isManage) {
        selectedId = null;
      }
      syncManageUI();
      syncSelectionUI();
    });

    manageEdit?.addEventListener("click", () => {
      if (!selectedId) return;
      const item = getItemById(selectedId);
      if (!item) return;
      openEditForItem(item);
    });

    manageDelete?.addEventListener("click", () => {
      if (!selectedId) return;
      const item = getItemById(selectedId);
      if (!item) return;

      const ok = confirm(`Delete this schedule?\n\n${item.subject} (${item.day})`);
      if (!ok) return;

      const all = loadSchedule().filter((x) => x.id !== selectedId);
      saveSchedule(all);

      selectedId = null;
      syncManageUI();
      renderSchedule(); // re-render blocks + subtitle
    });

    syncManageUI();
  }

  function syncManageUI() {
    if (!manageToggle || !manageEdit || !manageDelete || !manageLabel) return;

    manageToggle.textContent = isManage ? "Done" : "Manage schedule";
    manageLabel.textContent = selectedLabel();

    const hasSelection = Boolean(selectedId) && Boolean(getItemById(selectedId));
    manageEdit.disabled = !isManage || !hasSelection;
    manageDelete.disabled = !isManage || !hasSelection;

    // add a class so CSS can change cursor/feel
    if (gridWrap) {
      gridWrap.classList.toggle("is-manage", isManage);
    }
  }

  function syncSelectionUI() {
    // mark selected block only
    document.querySelectorAll(".ms-block").forEach((b) => {
      const id = b.dataset.id || "";
      b.classList.toggle("is-selected", Boolean(selectedId) && id === selectedId);
    });

    syncManageUI();
  }

  // ============================
  // RENDER SCHEDULE (updated)
  // ============================
  function renderSchedule() {
    ensureManageBar();

    const items = loadSchedule();
    const classId = getActiveClassId();
    const subj = getActiveSubject();

    const classLabelMap = new Map(classes.map((c) => [c.id, c.label]));

    // ✅ all items for this class (ignores subject filter)
    const itemsForClass = items.filter((it) => it.classId === classId);

    // ✅ visible after subject filter
    const visible = itemsForClass.filter((it) => {
      if (subj !== "all" && it.subject !== subj) return false;
      return true;
    });

    // ✅ empty overlay should show ONLY if class has ZERO schedules
    if (msEmpty) msEmpty.style.display = itemsForClass.length ? "none" : "flex";

    // ✅ update subtitle properly (FIX)
    updateSubtitleAndEmpty(itemsForClass, visible);

    // if selection is no longer visible, clear it
    if (selectedId && !visible.some((x) => x.id === selectedId)) {
      selectedId = null;
    }

    clearGridSlots();

    const overlay = getOrCreateOverlay();
    if (!overlay || !gridHost) return;

    const gridRect = gridHost.getBoundingClientRect();

    visible.forEach((it) => {
      const start = Number(it.startHour);
      const end = Number(it.endHour);

      const startSlot = document.querySelector(
        `.ms-slot[data-day="${it.day}"][data-hour="${start}"]`
      );
      const endSlot = document.querySelector(
        `.ms-slot[data-day="${it.day}"][data-hour="${end - 1}"]`
      );

      if (!startSlot || !endSlot) return;

      const startRect = startSlot.getBoundingClientRect();
      const endRect = endSlot.getBoundingClientRect();

      const left = startRect.left - gridRect.left;
      const top = startRect.top - gridRect.top;
      const width = startRect.width;
      const height = endRect.bottom - startRect.top;

      const startLabel = times[hours.indexOf(start)] || `${start}:00`;
      const endLabel = times[hours.indexOf(end)] || `${end}:00`;

      const clsLabel = classLabelMap.get(it.classId) || it.classLabel || "";
      const roomText = (it.room || "").trim() ? it.room.trim() : "No room";

      const block = document.createElement("div");
      block.className = "ms-block";
      block.dataset.id = it.id || "";

      const GAP = 6;
      block.style.position = "absolute";
      block.style.left = `${left + GAP}px`;
      block.style.top = `${top + GAP}px`;
      block.style.width = `${Math.max(0, width - GAP * 2)}px`;
      block.style.height = `${Math.max(0, height - GAP * 2)}px`;
      block.style.zIndex = "6";
      block.style.pointerEvents = "auto";

      // ✅ VIEW-ONLY block (no edit button inside)
      block.innerHTML = `
        <div class="ms-block-bar"></div>
        <div class="ms-block-title">${esc(it.subject || "Untitled Subject")}</div>
        <div class="ms-block-sub">${esc(clsLabel)}</div>
        <div class="ms-block-time">${esc(startLabel)} - ${esc(endLabel)}</div>
        <div class="ms-block-room">Room ${esc(roomText)}</div>
      `;

      overlay.appendChild(block);
    });

    syncSelectionUI();
  }

  // ============================
  // BLOCK CLICK: select ONLY in manage mode
  // ============================
  document.addEventListener("click", (e) => {
    const block = e.target.closest(".ms-block");
    if (!block) return;

    // if not in manage mode -> do nothing (view-only)
    if (!isManage) return;

    const id = block.dataset.id;
    if (!id) return;

    // toggle selection
    selectedId = selectedId === id ? null : id;
    syncSelectionUI();
  });

  // Initial render
  renderGrid();
  renderWeekLabel();
  renderSchedule();

  filterClass?.addEventListener("change", () => {
    selectedId = null;
    syncSelectionUI();
    renderSchedule();
  });

  filterSubject?.addEventListener("change", () => {
    selectedId = null;
    syncSelectionUI();
    renderSchedule();
  });

  window.addEventListener("resize", () => {
    renderSchedule();
  });

  document.getElementById("weekPrev")?.addEventListener("click", () => {
    base.setDate(base.getDate() - 7);
    renderWeekLabel();
  });

  document.getElementById("weekNext")?.addEventListener("click", () => {
    base.setDate(base.getDate() + 7);
    renderWeekLabel();
  });

  // ============================
  // SETUP SCHEDULE MODAL LOGIC
  // ============================
  const btnSetup = document.getElementById("btnSetupSchedule");

  const setupModalBackdrop = document.getElementById("setupModalBackdrop");
  const setupModalClose = document.getElementById("setupModalClose");
  const setupCancel = document.getElementById("setupCancel");
  const setupSave = document.getElementById("setupSave");
  const setupDelete = document.getElementById("setupDelete"); // still exists in HTML

  const setupClass = document.getElementById("setupClass");
  const setupStart = document.getElementById("setupStart");
  const setupEnd = document.getElementById("setupEnd");
  const setupRoom = document.getElementById("setupRoom");
  const setupHint = document.getElementById("setupHint");
  const setupList = document.getElementById("setupList");
  const btnAddLine = document.getElementById("btnAddLine");
  const setupDays = document.getElementById("setupDays");

  let draft = [];
  let editingId = null;

  function resetSetupHeader() {
    const title = document.getElementById("setupModalTitle");
    if (title) title.textContent = "Set Up Schedule";
    if (setupSave) setupSave.textContent = "Save";

    // We are NOT deleting from inside modal anymore (manage bar handles delete)
    if (setupDelete) setupDelete.classList.add("hidden");
  }

  function openSetupModal() {
    setupModal?.classList.remove("hidden");
    if (setupHint) setupHint.textContent = "";
    resetSetupHeader();

    // subjects
    if (setupSubject) {
      setupSubject.innerHTML = "";
      subjects.forEach((s) => {
        const opt = document.createElement("option");
        opt.value = s;
        opt.textContent = s;
        setupSubject.appendChild(opt);
      });
    }

    // class list
    if (setupClass) {
      setupClass.innerHTML = "";
      classes.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = c.label;
        setupClass.appendChild(opt);
      });
      setupClass.value = getActiveClassId();
    }

    // time options
    if (setupStart && setupEnd) {
      setupStart.innerHTML = "";
      setupEnd.innerHTML = "";

      hours.forEach((h, idx) => {
        const o1 = document.createElement("option");
        o1.value = String(h);
        o1.textContent = times[idx];
        setupStart.appendChild(o1);

        const o2 = document.createElement("option");
        o2.value = String(h + 1);
        o2.textContent = times[idx + 1] || `${h + 1}:00`;
        setupEnd.appendChild(o2);
      });

      setupStart.value = "6";
      setupEnd.value = "7";
    }

    if (setupRoom) setupRoom.value = "";

    draft = [];
    renderDraft();
    setTimeout(() => setupSubject?.focus(), 0);
  }

  function closeSetupModal() {
    setupModal?.classList.add("hidden");
    editingId = null;
    resetSetupHeader();
  }

  function getSelectedDay() {
    const btn = setupDays?.querySelector(".ms-daypill.active");
    return btn ? btn.dataset.day : "Mon";
  }

  setupDays?.addEventListener("click", (e) => {
    const b = e.target.closest(".ms-daypill");
    if (!b) return;
    setupDays.querySelectorAll(".ms-daypill").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
  });

  function overlaps(a, b) {
    if (a.classId !== b.classId) return false;
    if (a.day !== b.day) return false;
    return !(a.endHour <= b.startHour || b.endHour <= a.startHour);
  }

  function renderDraft() {
    if (!setupList) return;
    setupList.innerHTML = "";
    if (!draft.length) return;

    draft.forEach((it, idx) => {
      const row = document.createElement("div");
      row.className = "ms-item";
      row.innerHTML = `
        <div class="ms-item-left">
          <div class="ms-item-bar"></div>
          <div>
            <div class="ms-item-title">
              <span>${esc(it.subject)}</span>
              <span>|</span>
              <span>${esc(it.classLabel)}</span>
              <span>|</span>
              <span>${esc(it.day)}</span>
            </div>
            <div class="ms-item-sub">${esc(it.startLabel)} - ${esc(it.endLabel)}${it.room ? " • " + esc(it.room) : ""}</div>
          </div>
        </div>
        <div class="ms-item-right">
          <button class="ms-remove" type="button" data-idx="${idx}">🗑 Remove</button>
        </div>
      `;
      setupList.appendChild(row);
    });
  }

  setupList?.addEventListener("click", (e) => {
    const btn = e.target.closest(".ms-remove");
    if (!btn) return;
    const idx = Number(btn.dataset.idx);
    if (Number.isFinite(idx)) {
      draft.splice(idx, 1);
      renderDraft();
    }
  });

  btnAddLine?.addEventListener("click", () => {
    if (!setupHint) return;
    setupHint.textContent = "";

    const subject = setupSubject?.value?.trim();
    const classId = setupClass?.value;
    const classLabel = classes.find((c) => c.id === classId)?.label || "";
    const day = getSelectedDay();

    const startHour = Number(setupStart?.value);
    const endHour = Number(setupEnd?.value);
    const room = setupRoom?.value?.trim() || "";

    if (!subject) return (setupHint.textContent = "Please select a subject.");
    if (!classId) return (setupHint.textContent = "Please select a Grade/Section.");
    if (!Number.isFinite(startHour) || !Number.isFinite(endHour) || endHour <= startHour) {
      setupHint.textContent = "Please select a valid time range.";
      return;
    }

    const startLabel = times[hours.indexOf(startHour)] || `${startHour}:00`;
    const endLabel = times[hours.indexOf(endHour)] || `${endHour}:00`;

    const newItem = {
      subject,
      classId,
      classLabel,
      day,
      startHour,
      endHour,
      startLabel,
      endLabel,
      room,
    };

    if (draft.some((x) => overlaps(x, newItem))) {
      setupHint.textContent = "This time overlaps with another entry for the same day.";
      return;
    }

    draft.push(newItem);
    renderDraft();
  });

  function mergeAndSaveDraft() {
    const all = loadSchedule();

    // conflict check with existing schedule (excluding the one being edited)
    for (const d of draft) {
      const conflict = all.some((x) => {
        if (editingId && x.id === editingId) return false;
        return overlaps(x, d);
      });
      if (conflict) {
        if (setupHint) setupHint.textContent = "Some entries overlap with your existing schedule.";
        return false;
      }
    }

    let merged = all;

    // if editing, replace that item
    if (editingId) {
      merged = merged.filter((x) => x.id !== editingId);
    }

    merged = [
      ...merged,
      ...draft.map((d) => ({
        id: editingId || `sch_${Date.now()}_${Math.random().toString(16).slice(2)}`,
        subject: d.subject,
        classId: d.classId,
        classLabel: d.classLabel,
        day: d.day,
        startHour: d.startHour,
        endHour: d.endHour,
        room: d.room,
      })),
    ];

    saveSchedule(merged);
    return true;
  }

  btnSetup?.addEventListener("click", () => {
    // create new schedule entries
    editingId = null;
    openSetupModal();
  });

  setupModalBackdrop?.addEventListener("click", closeSetupModal);
  setupModalClose?.addEventListener("click", closeSetupModal);
  setupCancel?.addEventListener("click", closeSetupModal);

  setupSave?.addEventListener("click", () => {
    if (!draft.length) {
      if (setupHint) setupHint.textContent = "Add at least one schedule entry before saving.";
      return;
    }

    const ok = mergeAndSaveDraft();
    if (!ok) return;

    closeSetupModal();
    renderSchedule(); // ✅ updates subtitle too
  });

  function openEditForItem(item) {
    editingId = item.id;
    openSetupModal();

    setTimeout(() => {
      const title = document.getElementById("setupModalTitle");
      if (title) title.textContent = "Edit Schedule";
      if (setupSave) setupSave.textContent = "Update";

      // ensure delete in modal stays hidden
      if (setupDelete) setupDelete.classList.add("hidden");

      if (setupSubject) setupSubject.value = item.subject;
      if (setupClass) setupClass.value = item.classId;

      setupDays?.querySelectorAll(".ms-daypill").forEach((p) => {
        p.classList.toggle("active", p.dataset.day === item.day);
      });

      if (setupStart) setupStart.value = String(item.startHour);
      if (setupEnd) setupEnd.value = String(item.endHour);
      if (setupRoom) setupRoom.value = item.room || "";

      draft = [
        {
          subject: item.subject,
          classId: item.classId,
          classLabel:
            (item.classLabel && String(item.classLabel).trim()) ||
            classes.find((c) => c.id === item.classId)?.label ||
            "",
          day: item.day,
          startHour: Number(item.startHour),
          endHour: Number(item.endHour),
          startLabel: times[hours.indexOf(Number(item.startHour))] || `${item.startHour}:00`,
          endLabel: times[hours.indexOf(Number(item.endHour))] || `${item.endHour}:00`,
          room: item.room || "",
        },
      ];
      renderDraft();
    }, 0);
  }

  // ============================
  // ESC TO CLOSE
  // ============================
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;

    if (setupModal && !setupModal.classList.contains("hidden")) closeSetupModal();
    if (classModal && !classModal.classList.contains("hidden")) closeClassModal();
    if (subjectModal && !subjectModal.classList.contains("hidden")) closeSubjectModal();
  });

  // Optional helper
  window.clearTeacherSchedule = function () {
    localStorage.removeItem("teacher_schedule_items_v1");
    location.reload();
  };
});
