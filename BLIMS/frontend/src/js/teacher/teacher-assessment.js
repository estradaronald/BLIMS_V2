// frontend/src/js/teacher/teacher-assessment.js
// Teacher Assessment (Classwork / Create / Submissions)
// LocalStorage-based (same style as your other teacher pages)

(function () {
  const $ = (id) => document.getElementById(id);

  // =========================
  // LocalStorage keys
  // =========================
  const LS_KEYS = {
    USER: "user",
    STUDENTS: "rbms_students_v1",
    CLASSES: "rbms_classes_v1",
    SECTIONS: "rbms_sections_v1",
    ASSESS: "rbms_teacher_assessments_v1",
  };

  // =========================
  // Helpers
  // =========================
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
  function uid(prefix) {
    return (
      (prefix || "AS") +
      "-" +
      Date.now().toString(16) +
      "-" +
      Math.random().toString(16).slice(2, 8).toUpperCase()
    );
  }
  function clampNum(n, min, max) {
    const x = Number(n);
    if (Number.isNaN(x)) return min;
    return Math.max(min, Math.min(max, x));
  }
  function safeStr(v) {
    return String(v ?? "");
  }
  function escapeHTML(str) {
    return safeStr(str)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fmtDue(dateStr, timeStr) {
    if (!dateStr) return "—";
    // keep it simple: YYYY-MM-DD -> Mon DD, YYYY (browser locale)
    const d = new Date(dateStr + "T00:00:00");
    const datePart = isNaN(d.getTime())
      ? dateStr
      : d.toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "2-digit",
        });

    if (!timeStr) return datePart;
    return `${datePart} ${timeStr}`;
  }

  // =========================
  // Topbar menu (same pattern)
  // =========================
  function wireTopbarMenu() {
    const btn = $("userMenuBtn");
    const menu = $("userMenu");
    if (!btn || !menu) return;

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.classList.toggle("open");
    });

    document.addEventListener("click", () => menu.classList.remove("open"));
  }

  // =========================
  // Tabs (3 main tabs)
  // =========================
  const views = {
    classwork: $("asClassworkView"),
    create: $("asCreateView"),
    submissions: $("asSubmissionsView"),
  };
  const mainTabs = Array.from(document.querySelectorAll(".as-main-tab"));

  function setActiveMainTab(viewKey) {
    // toggle tabs
    mainTabs.forEach((t) => {
      const active = t.dataset.view === viewKey;
      t.classList.toggle("is-active", active);
      t.setAttribute("aria-selected", active ? "true" : "false");
    });

    // toggle views
    Object.entries(views).forEach(([k, el]) => {
      if (!el) return;
      const show = k === viewKey;
      el.classList.toggle("hidden", !show);
      el.setAttribute("aria-hidden", show ? "false" : "true");
    });
  }

  // =========================
  // Classwork status tabs (Active / Drafts / Archived)
  // =========================
  const statusTabs = Array.from(document.querySelectorAll(".as-tab"));
  let currentStatus = "active"; // active | draft | archived

  function setStatus(status) {
    currentStatus = status;

    statusTabs.forEach((b) => {
      b.classList.toggle("is-active", b.dataset.status === status);
      b.setAttribute("aria-selected", b.dataset.status === status ? "true" : "false");
    });

    renderList();
    renderStats();
  }

  // =========================
  // Data model
  // =========================
  function getStudents() {
    // teacher-students.js writes here
    return readLS(LS_KEYS.STUDENTS, []);
  }
  function getAssessments() {
    return readLS(LS_KEYS.ASSESS, []);
  }
  function setAssessments(list) {
    writeLS(LS_KEYS.ASSESS, list);
  }

  // Keep current selection (for Edit/Submissions)
  let activeAssessmentId = null;

  function findAssessment(id) {
    return getAssessments().find((a) => a.id === id) || null;
  }

  // =========================
  // DOM refs (Classwork list)
  // =========================
  const listTbody = $("asListTbody");
  const quarterFilter = $("asQuarterFilter");
  const typeFilter = $("asTypeFilter");
  const searchInput = $("asSearchInput");

  // Stats
  const statActive = $("asStatActive");
  const statDraft = $("asStatDraft");
  const statArchived = $("asStatArchived");
  const statDueWeek = $("asStatDueWeek");

  // Buttons
  const newBtn = $("asNewBtn");
  const backToListBtn = $("asBackToListBtn");
  const backToListBtn2 = $("asBackToListBtn2");

  // =========================
  // DOM refs (Create form)
  // =========================
  const detailHeading = $("asDetailHeading");
  const detailSub = $("asDetailSub");
  const statusBadge = $("asStatusBadge");

  const titleInput = $("asTitleInput");
  const descInput = $("asDescInput");
  const typeSelect = $("asTypeSelect");
  const quarterSelect = $("asQuarterSelect");
  const subjectSelect = $("asSubjectSelect");
  const pointsInput = $("asPointsInput");
  const dueDateInput = $("asDueDateInput");
  const dueTimeInput = $("asDueTimeInput");
  const scopeSelect = $("asScopeSelect");

  // Attachments (UI-only)
  const attachBtn = $("asAttachBtn");
  const attachInput = $("asAttachInput");
  const attachList = $("asAttachList");

  // Recipients
  const recipAll = $("asRecipAll");
  const recipSelected = $("asRecipSelected");
  const studentPicker = $("asStudentPicker");
  const studentSearch = $("asStudentSearch");
  const studentList = $("asStudentList");
  const recipCount = $("asRecipientCount");
  const selectAllBtn = $("asSelectAllBtn");
  const clearAllBtn = $("asClearAllBtn");

  // Form action buttons
  const saveDraftBtn = $("asSaveDraftBtn");
  const postBtn = $("asPostBtn");

  // Detail actions
  const editBtn = $("asEditBtn");
  const archiveBtn = $("asArchiveBtn");
  const deleteBtn = $("asDeleteBtn");

  // =========================
  // DOM refs (Submissions tab)
  // =========================
  const assignedCount = $("asAssignedCount");
  const submittedCount = $("asSubmittedCount");
  const missingCount = $("asMissingCount");
  const submissionsTbody = $("asSubmissionsTbody");

  // =========================
  // Attachments: UI only
  // =========================
  let currentAttachments = [];

  function renderAttachments() {
    if (!attachList) return;
    if (!currentAttachments.length) {
      attachList.innerHTML = `<div class="as-attach-empty">No attachments added.</div>`;
      return;
    }
    attachList.innerHTML = currentAttachments
      .map(
        (a, idx) => `
      <div class="as-attach-item">
        <div class="as-attach-name">${escapeHTML(a.name)}</div>
        <button class="as-attach-x" type="button" data-idx="${idx}">✕</button>
      </div>
    `
      )
      .join("");

    attachList.querySelectorAll(".as-attach-x").forEach((btn) => {
      btn.addEventListener("click", () => {
        const i = Number(btn.dataset.idx);
        currentAttachments.splice(i, 1);
        renderAttachments();
      });
    });
  }

  function wireAttachments() {
    if (!attachBtn || !attachInput) return;

    attachBtn.addEventListener("click", () => attachInput.click());
    attachInput.addEventListener("change", () => {
      const file = attachInput.files && attachInput.files[0];
      if (!file) return;
      currentAttachments.push({ name: file.name, size: file.size });
      attachInput.value = "";
      renderAttachments();
    });
  }

  // =========================
  // Recipients picker
  // =========================
  let selectedStudentIds = new Set();

  function setPickerVisible(visible) {
    if (!studentPicker) return;
    studentPicker.classList.toggle("hidden", !visible);
    studentPicker.setAttribute("aria-hidden", visible ? "false" : "true");
  }

  function getCurrentRecipientsMode() {
    return recipSelected && recipSelected.checked ? "selected" : "all";
  }

  function computeRecipientIds() {
    const students = getStudents();
    if (getCurrentRecipientsMode() === "all") {
      return students.map((s) => s.studentId || s.id).filter(Boolean);
    }
    return Array.from(selectedStudentIds);
  }

  function renderRecipientCount() {
    if (!recipCount) return;
    const mode = getCurrentRecipientsMode();
    if (mode === "all") {
      const total = getStudents().length;
      recipCount.textContent = `All students (${total})`;
    } else {
      recipCount.textContent = `${selectedStudentIds.size} selected`;
    }
  }

  function renderStudentPickerList() {
    if (!studentList) return;

    const students = getStudents();
    const q = (studentSearch ? studentSearch.value : "").trim().toLowerCase();

    const filtered = students.filter((s) => {
      const full = `${s.firstName || ""} ${s.lastName || ""}`.trim().toLowerCase();
      const sid = safeStr(s.studentId || s.id).toLowerCase();
      const lrn = safeStr(s.lrn || "").toLowerCase();
      return (
        !q ||
        full.includes(q) ||
        sid.includes(q) ||
        lrn.includes(q)
      );
    });

    if (!filtered.length) {
      studentList.innerHTML = `<div class="as-student-empty">No students found.</div>`;
      renderRecipientCount();
      return;
    }

    studentList.innerHTML = filtered
      .map((s) => {
        const id = s.studentId || s.id;
        const full = `${s.firstName || ""} ${s.lastName || ""}`.trim() || "Student";
        const sub = (s.studentId || s.id) ? `ID: ${s.studentId || s.id}` : (s.lrn ? `LRN: ${s.lrn}` : "");
        const checked = selectedStudentIds.has(id) ? "checked" : "";
        return `
          <label class="as-student-item">
            <input class="as-student-check" type="checkbox" data-id="${escapeHTML(id)}" ${checked} />
            <div class="as-student-meta">
              <div class="as-student-name">${escapeHTML(full)}</div>
              <div class="as-student-sub">${escapeHTML(sub)}</div>
            </div>
          </label>
        `;
      })
      .join("");

    // wire checkbox clicks
    studentList.querySelectorAll(".as-student-check").forEach((cb) => {
      cb.addEventListener("change", () => {
        const id = cb.getAttribute("data-id");
        if (!id) return;
        if (cb.checked) selectedStudentIds.add(id);
        else selectedStudentIds.delete(id);
        renderRecipientCount();
      });
    });

    renderRecipientCount();
  }

  function wireRecipients() {
    if (recipAll) {
      recipAll.addEventListener("change", () => {
        if (recipAll.checked) setPickerVisible(false);
        renderRecipientCount();
      });
    }
    if (recipSelected) {
      recipSelected.addEventListener("change", () => {
        if (recipSelected.checked) {
          setPickerVisible(true);
          renderStudentPickerList();
        }
        renderRecipientCount();
      });
    }
    if (studentSearch) {
      studentSearch.addEventListener("input", renderStudentPickerList);
    }
    if (selectAllBtn) {
      selectAllBtn.addEventListener("click", () => {
        getStudents().forEach((s) => {
          const id = s.studentId || s.id;
          if (id) selectedStudentIds.add(id);
        });
        renderStudentPickerList();
      });
    }
    if (clearAllBtn) {
      clearAllBtn.addEventListener("click", () => {
        selectedStudentIds.clear();
        renderStudentPickerList();
      });
    }
  }

  // =========================
  // Populate select options (basic)
  // =========================
  function populateScopeSelect() {
    if (!scopeSelect) return;

    // If you already store classes/sections elsewhere, you can swap this later.
    // For now: "All (Unassigned)" + unique class-section pairs derived from students.
    const students = getStudents();

    const pairs = new Map();
    students.forEach((s) => {
      const cls = safeStr(s.className || s.class || "").trim();
      const sec = safeStr(s.sectionName || s.section || "").trim();
      const key = `${cls}||${sec}`.trim();
      if (!cls && !sec) return;
      pairs.set(key, { cls, sec });
    });

    const options = [
      `<option value="all">All (Unassigned)</option>`,
      ...Array.from(pairs.values()).map((p) => {
        const label = [p.cls, p.sec].filter(Boolean).join(" - ");
        const value = label || "Unassigned";
        return `<option value="${escapeHTML(value)}">${escapeHTML(label)}</option>`;
      }),
    ];

    scopeSelect.innerHTML = options.join("");
  }

  // =========================
  // Classwork list rendering
  // =========================
  function filterAssessments(list) {
    const qf = quarterFilter ? quarterFilter.value : "all";
    const tf = typeFilter ? typeFilter.value : "all";
    const q = (searchInput ? searchInput.value : "").trim().toLowerCase();

    return list.filter((a) => {
      // status filter already applied outside
      const okQuarter = qf === "all" || a.quarter === qf;
      const okType = tf === "all" || a.type === tf;
      const hay = `${a.title || ""} ${a.instructions || ""}`.toLowerCase();
      const okSearch = !q || hay.includes(q);
      return okQuarter && okType && okSearch;
    });
  }

  function renderList() {
    if (!listTbody) return;

    const all = getAssessments();

    const byStatus = all.filter((a) => a.status === currentStatus);
    const shown = filterAssessments(byStatus);

    if (!shown.length) {
      listTbody.innerHTML = `
        <tr>
          <td colspan="8" class="as-empty">
            No ${escapeHTML(currentStatus)} activities yet.
          </td>
        </tr>
      `;
      return;
    }

    listTbody.innerHTML = shown
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .map((a) => {
        const due = fmtDue(a.dueDate, a.dueTime);
        const recCount =
          a.recipientsMode === "all"
            ? "All"
            : `${(a.recipientIds || []).length}`;

        const statusLabel =
          a.status === "active" ? "Active" : a.status === "draft" ? "Draft" : "Archived";

        return `
          <tr>
            <td><b>${escapeHTML(a.title || "Untitled")}</b></td>
            <td>${escapeHTML((a.type || "").toUpperCase())}</td>
            <td>${escapeHTML(a.quarter || "—")}</td>
            <td>${escapeHTML(due)}</td>
            <td>${escapeHTML(a.points ?? "—")}</td>
            <td>${escapeHTML(recCount)}</td>
            <td>${escapeHTML(statusLabel)}</td>
            <td style="text-align:right;">
              <div class="row-actions">
                <button class="small" type="button" data-act="view" data-id="${escapeHTML(a.id)}">View</button>
                <button class="small" type="button" data-act="subs" data-id="${escapeHTML(a.id)}">Submissions</button>
              </div>
            </td>
          </tr>
        `;
      })
      .join("");

    listTbody.querySelectorAll("button[data-act]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const act = btn.getAttribute("data-act");
        const id = btn.getAttribute("data-id");
        if (!id) return;

        if (act === "view") {
          openAssessmentInCreate(id, true); // view mode
        } else if (act === "subs") {
          openSubmissions(id);
        }
      });
    });
  }

  function renderStats() {
    const all = getAssessments();
    const active = all.filter((a) => a.status === "active").length;
    const draft = all.filter((a) => a.status === "draft").length;
    const archived = all.filter((a) => a.status === "archived").length;

    // due this week: simple 7-day window (active only)
    const now = new Date();
    const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const dueWeek = all.filter((a) => {
      if (a.status !== "active" || !a.dueDate) return false;
      const d = new Date(a.dueDate + "T00:00:00");
      return !isNaN(d.getTime()) && d >= now && d <= in7;
    }).length;

    if (statActive) statActive.textContent = String(active);
    if (statDraft) statDraft.textContent = String(draft);
    if (statArchived) statArchived.textContent = String(archived);
    if (statDueWeek) statDueWeek.textContent = String(dueWeek);
  }

  // =========================
  // Create / View / Edit helpers
  // =========================
  function clearForm() {
    activeAssessmentId = null;

    if (titleInput) titleInput.value = "";
    if (descInput) descInput.value = "";
    if (typeSelect) typeSelect.value = "activity";
    if (quarterSelect) quarterSelect.value = "Q1";
    if (subjectSelect) subjectSelect.value = "all";
    if (pointsInput) pointsInput.value = "";
    if (dueDateInput) dueDateInput.value = "";
    if (dueTimeInput) dueTimeInput.value = "";

    if (scopeSelect) scopeSelect.value = "all";

    currentAttachments = [];
    renderAttachments();

    if (recipAll) recipAll.checked = true;
    if (recipSelected) recipSelected.checked = false;
    selectedStudentIds.clear();
    setPickerVisible(false);
    renderRecipientCount();

    setDetailMode("create", "draft");
  }

  function fillForm(a) {
    if (!a) return;
    activeAssessmentId = a.id;

    if (titleInput) titleInput.value = a.title || "";
    if (descInput) descInput.value = a.instructions || "";
    if (typeSelect) typeSelect.value = a.type || "activity";
    if (quarterSelect) quarterSelect.value = a.quarter || "Q1";
    if (subjectSelect) subjectSelect.value = a.subject || "all";
    if (pointsInput) pointsInput.value = a.points ?? "";
    if (dueDateInput) dueDateInput.value = a.dueDate || "";
    if (dueTimeInput) dueTimeInput.value = a.dueTime || "";
    if (scopeSelect) scopeSelect.value = a.scope || "all";

    currentAttachments = Array.isArray(a.attachments) ? a.attachments.slice() : [];
    renderAttachments();

    if (a.recipientsMode === "selected") {
      if (recipSelected) recipSelected.checked = true;
      if (recipAll) recipAll.checked = false;
      selectedStudentIds = new Set((a.recipientIds || []).filter(Boolean));
      setPickerVisible(true);
      renderStudentPickerList();
    } else {
      if (recipAll) recipAll.checked = true;
      if (recipSelected) recipSelected.checked = false;
      selectedStudentIds.clear();
      setPickerVisible(false);
    }
    renderRecipientCount();

    setDetailMode("view", a.status || "draft");
  }

  function setDetailMode(mode, status) {
    // mode: create | view | edit
    const isView = mode === "view";
    const isEdit = mode === "edit" || mode === "create";

    if (detailHeading) {
      detailHeading.textContent = mode === "create" ? "New Activity" : "Activity Details";
    }
    if (detailSub) {
      detailSub.textContent =
        mode === "create"
          ? "Fill out the details below, then Post."
          : "Review details. Click Edit to make changes.";
    }

    if (statusBadge) {
      const label =
        status === "active" ? "Active" : status === "archived" ? "Archived" : "Draft";
      statusBadge.textContent = label;
    }

    // inputs enabled only in edit/create
    const inputs = [
      titleInput,
      descInput,
      typeSelect,
      quarterSelect,
      subjectSelect,
      pointsInput,
      dueDateInput,
      dueTimeInput,
      scopeSelect,
      attachBtn,
      studentSearch,
      selectAllBtn,
      clearAllBtn,
    ].filter(Boolean);

    inputs.forEach((el) => {
      // buttons/selects/inputs
      const tag = el.tagName.toLowerCase();
      if (tag === "button") {
        el.disabled = !isEdit;
      } else {
        el.disabled = !isEdit;
      }
    });

    if (recipAll) recipAll.disabled = !isEdit;
    if (recipSelected) recipSelected.disabled = !isEdit;

    // Toggle picker visibility in view mode only if it was selected
    if (!isEdit) {
      // keep visible if selected mode, otherwise hidden
      const wantsPicker = getCurrentRecipientsMode() === "selected";
      setPickerVisible(wantsPicker);
    }

    // action buttons
    if (saveDraftBtn) saveDraftBtn.style.display = isEdit ? "" : "none";
    if (postBtn) postBtn.style.display = isEdit ? "" : "none";

    if (editBtn) editBtn.style.display = isView ? "" : "none";
  }

  function openCreate() {
    clearForm();
    setActiveMainTab("create");
  }

  function openAssessmentInCreate(id, viewOnly) {
    const a = findAssessment(id);
    if (!a) return;

    fillForm(a);
    setActiveMainTab("create");

    if (!viewOnly) {
      // switch to edit
      setDetailMode("edit", a.status || "draft");
    }
  }

  function openSubmissions(id) {
    activeAssessmentId = id;
    setActiveMainTab("submissions");
    renderSubmissions();
  }

  // =========================
  // Save draft / Post
  // =========================
  function getFormPayload() {
    const title = safeStr(titleInput ? titleInput.value : "").trim();
    const instructions = safeStr(descInput ? descInput.value : "").trim();
    const type = safeStr(typeSelect ? typeSelect.value : "activity");
    const quarter = safeStr(quarterSelect ? quarterSelect.value : "Q1");
    const subject = safeStr(subjectSelect ? subjectSelect.value : "all");
    const points = pointsInput && pointsInput.value !== "" ? clampNum(pointsInput.value, 0, 100000) : "";
    const dueDate = safeStr(dueDateInput ? dueDateInput.value : "");
    const dueTime = safeStr(dueTimeInput ? dueTimeInput.value : "");
    const scope = safeStr(scopeSelect ? scopeSelect.value : "all");

    const recipientsMode = getCurrentRecipientsMode();
    const recipientIds = recipientsMode === "selected" ? Array.from(selectedStudentIds) : [];

    return {
      title,
      instructions,
      type,
      quarter,
      subject,
      points,
      dueDate,
      dueTime,
      scope,
      attachments: currentAttachments.slice(),
      recipientsMode,
      recipientIds,
    };
  }

  function validate(payload) {
    // minimal validation only
    if (!payload.title) return "Title is required.";
    if (!payload.instructions) return "Instructions are required.";
    return "";
  }

  function saveAs(status) {
    const payload = getFormPayload();
    const err = validate(payload);
    if (err && status === "active") {
      alert(err);
      return;
    }

    const list = getAssessments();

    if (!activeAssessmentId) {
      // create new
      const item = {
        id: uid("AS"),
        status, // draft | active
        createdAt: Date.now(),
        updatedAt: Date.now(),
        submissions: [], // future
        ...payload,
      };
      list.push(item);
      setAssessments(list);
      activeAssessmentId = item.id;
      fillForm(item);
    } else {
      // update existing
      const idx = list.findIndex((a) => a.id === activeAssessmentId);
      if (idx === -1) return;

      list[idx] = {
        ...list[idx],
        ...payload,
        status,
        updatedAt: Date.now(),
      };
      setAssessments(list);
      fillForm(list[idx]);
    }

    renderList();
    renderStats();
    alert(status === "active" ? "Posted successfully." : "Draft saved.");
  }

  // =========================
  // Archive / Delete / Edit
  // =========================
  function archiveCurrent() {
    if (!activeAssessmentId) return;
    const list = getAssessments();
    const idx = list.findIndex((a) => a.id === activeAssessmentId);
    if (idx === -1) return;

    const ok = confirm("Archive this activity?");
    if (!ok) return;

    list[idx].status = "archived";
    list[idx].updatedAt = Date.now();
    setAssessments(list);

    fillForm(list[idx]);
    renderList();
    renderStats();
  }

  function deleteCurrent() {
    if (!activeAssessmentId) return;

    const ok = confirm("Delete this activity? This cannot be undone.");
    if (!ok) return;

    const next = getAssessments().filter((a) => a.id !== activeAssessmentId);
    setAssessments(next);

    activeAssessmentId = null;
    renderList();
    renderStats();

    // back to classwork
    setActiveMainTab("classwork");
    setStatus("active");
  }

  function enableEdit() {
    const a = activeAssessmentId ? findAssessment(activeAssessmentId) : null;
    setDetailMode("edit", a ? a.status : "draft");
  }

  // =========================
  // Submissions rendering (placeholder now)
  // =========================
  function renderSubmissions() {
    const a = activeAssessmentId ? findAssessment(activeAssessmentId) : null;

    const students = getStudents();

    // if no activity selected
    if (!a) {
      if (assignedCount) assignedCount.textContent = "0";
      if (submittedCount) submittedCount.textContent = "0";
      if (missingCount) missingCount.textContent = "0";
      if (submissionsTbody) {
        submissionsTbody.innerHTML = `
          <tr>
            <td colspan="3" class="as-empty">Select an activity from Classwork first.</td>
          </tr>
        `;
      }
      return;
    }

    // assigned recipients
    let recipients = [];
    if (a.recipientsMode === "all") {
      recipients = students;
    } else {
      const set = new Set((a.recipientIds || []).filter(Boolean));
      recipients = students.filter((s) => set.has(s.studentId || s.id));
    }

    // placeholder submissions (future)
    const subs = Array.isArray(a.submissions) ? a.submissions : [];
    const subsById = new Map(subs.map((s) => [s.studentId, s]));

    const assigned = recipients.length;
    let submitted = 0;

    const rows = recipients.map((stu) => {
      const sid = stu.studentId || stu.id || "";
      const full = `${stu.firstName || ""} ${stu.lastName || ""}`.trim() || "Student";
      const sub = subsById.get(sid);

      const status = sub ? "Submitted" : "Missing";
      if (sub) submitted += 1;

      const fileLabel = sub && sub.fileName ? sub.fileName : "—";

      return `
        <tr>
          <td>
            <div class="as-sub-stu">
              <div class="as-sub-name">${escapeHTML(full)}</div>
              <div class="as-sub-id">${escapeHTML(sid)}</div>
            </div>
          </td>
          <td>${escapeHTML(status)}</td>
          <td>${escapeHTML(fileLabel)}</td>
        </tr>
      `;
    });

    const missing = assigned - submitted;

    if (assignedCount) assignedCount.textContent = String(assigned);
    if (submittedCount) submittedCount.textContent = String(submitted);
    if (missingCount) missingCount.textContent = String(Math.max(0, missing));

    if (submissionsTbody) {
      submissionsTbody.innerHTML =
        rows.length > 0
          ? rows.join("")
          : `<tr><td colspan="3" class="as-empty">No recipients found.</td></tr>`;
    }
  }

  // =========================
  // Wiring
  // =========================
  function wireMainTabs() {
    mainTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const v = tab.dataset.view;
        if (!v) return;

        // if submissions tab opened with no selection, keep placeholder
        setActiveMainTab(v);
        if (v === "classwork") {
          renderList();
          renderStats();
        }
        if (v === "create") {
          // if nothing selected, prepare empty create
          if (!activeAssessmentId) clearForm();
          populateScopeSelect();
        }
        if (v === "submissions") {
          renderSubmissions();
        }
      });
    });
  }

  function wireStatusTabs() {
    statusTabs.forEach((b) => {
      b.addEventListener("click", () => {
        const s = b.dataset.status;
        if (!s) return;
        setStatus(s);
      });
    });
  }

  function wireListFilters() {
    [quarterFilter, typeFilter, searchInput].filter(Boolean).forEach((el) => {
      el.addEventListener("input", () => {
        renderList();
      });
      el.addEventListener("change", () => {
        renderList();
      });
    });
  }

  function wireButtons() {
    if (newBtn) newBtn.addEventListener("click", () => openCreate());

    if (backToListBtn) {
      backToListBtn.addEventListener("click", () => {
        setActiveMainTab("classwork");
        setStatus("active");
      });
    }
    if (backToListBtn2) {
      backToListBtn2.addEventListener("click", () => {
        setActiveMainTab("classwork");
        setStatus("active");
      });
    }

    if (saveDraftBtn) saveDraftBtn.addEventListener("click", () => saveAs("draft"));
    if (postBtn) postBtn.addEventListener("click", () => saveAs("active"));

    if (editBtn) editBtn.addEventListener("click", enableEdit);
    if (archiveBtn) archiveBtn.addEventListener("click", archiveCurrent);
    if (deleteBtn) deleteBtn.addEventListener("click", deleteCurrent);
  }

  function wireNewBtnToCreateTab() {
    // From Classwork header button
    if (!newBtn) return;
    newBtn.addEventListener("click", () => {
      // also toggle main tab button state
      setActiveMainTab("create");
      clearForm();
      populateScopeSelect();
    });
  }

  // =========================
  // Init
  // =========================
  function init() {
    wireTopbarMenu();

    wireMainTabs();
    wireStatusTabs();
    wireListFilters();
    wireButtons();

    wireAttachments();
    wireRecipients();

    // Default view
    setActiveMainTab("classwork");
    setStatus("active");

    // Basic select population
    populateScopeSelect();

    // Initial render
    renderList();
    renderStats();
    renderRecipientCount();
    renderAttachments();
  }

  init();
})();