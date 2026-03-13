// frontend/src/js/student/student-classwork.js

document.addEventListener("DOMContentLoaded", () => {
  initTopbarMenu();
  initLogout();
  initClasswork();
});

function $(id) {
  return document.getElementById(id);
}

/* ===============================
   TOPBAR (same pattern as your other student pages)
================================= */
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

/* ===============================
   CLASSWORK (student view)
   - Frontend-only now, backend-ready
   - Reads:
     Active class: blims_active_student_class_v1
     Active SY:    blims_school_years_v1
     Classwork LS: blims_classwork_v1 (recommended)
================================= */
function initClasswork() {
  const listEl = $("cwList");
  const emptyEl = $("cwEmpty");

  const gradeSectionEl = $("cwGradeSection");
  const syLabelEl = $("cwSYLabel");

  const statusFilter = $("cwStatusFilter");
  const subjectFilter = $("cwSubjectFilter");
  const searchInput = $("cwSearch");

  // view modal
  const viewModal = $("cwViewModal");
  const viewBackdrop = $("cwViewBackdrop");
  const viewCloseX = $("cwViewCloseX");
  const viewCloseBtn = $("cwViewCloseBtn");

  const viewTitle = $("cwViewTitle");
  const viewSub = $("cwViewSub");
  const viewChips = $("cwViewChips");
  const viewDesc = $("cwViewDesc");
  const viewFile = $("cwViewFile");
  const downloadBtn = $("cwDownloadBtn");
  const submitOpenBtn = $("cwSubmitOpenBtn");

  // submit modal
  const submitModal = $("cwSubmitModal");
  const submitBackdrop = $("cwSubmitBackdrop");
  const submitCloseX = $("cwSubmitCloseX");
  const submitCancelBtn = $("cwSubmitCancelBtn");
  const submitBtn = $("cwSubmitBtn");

  const submitSub = $("cwSubmitSub");
  const submitFile = $("cwSubmitFile");
  const submitNotes = $("cwSubmitNotes");
  const submitMsg = $("cwSubmitMsg");

  if (!listEl || !emptyEl) return;

  // LocalStorage keys (prototype)
  const LS_ACTIVE_CLASS = "blims_active_student_class_v1";
  const LS_SCHOOL_YEARS = "blims_school_years_v1";
  const LS_CLASSWORK = "blims_classwork_v1"; // ✅ recommended new LS key

  const state = {
    status: "all",
    subject: "all",
    q: "",
    selectedId: null,
  };

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function norm(s) {
    return String(s || "").trim().toLowerCase();
  }

  function fmtDue(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString(undefined, { year: "numeric", month: "short", day: "2-digit" });
  }

  function clampText(s, n = 120) {
    const t = String(s || "").trim();
    if (t.length <= n) return t;
    return t.slice(0, n).trim() + "…";
  }

  function getActiveClass() {
    try {
      const raw = localStorage.getItem(LS_ACTIVE_CLASS);
      if (raw) {
        const v = JSON.parse(raw);
        if (v && v.grade != null && v.section != null) {
          return { grade: String(v.grade), section: String(v.section) };
        }
      }
    } catch {}
    return { grade: "Grade 6", section: "A" }; // fallback demo
  }

  function getAdminActiveSY() {
    const store = readJSON(LS_SCHOOL_YEARS, null);
    if (!store || !Array.isArray(store.items)) return "";
    const active = store.items.find((x) => x && x.id === store.activeId);
    return active ? String(active.name || "").trim() : "";
  }

  function openModal(el) {
    if (!el) return;
    el.classList.remove("hidden");
    el.setAttribute("aria-hidden", "false");
  }

  function closeModal(el) {
    if (!el) return;
    el.classList.add("hidden");
    el.setAttribute("aria-hidden", "true");
  }

  // ✅ Mock data seed (you can delete later)
  // Put your real backend fetch replacement inside getClasswork()
  function seedMockIfEmpty() {
    const cur = readJSON(LS_CLASSWORK, null);
    if (Array.isArray(cur) && cur.length) return;

    const now = Date.now();
    const mock = [
      {
        id: "CW-" + now,
        grade: "Grade 6",
        section: "A",
        schoolYear: getAdminActiveSY() || "2025-2026",
        subject: "Mathematics",
        title: "Worksheet 1: Fractions",
        description: "Answer pages 12–14. Show your solutions clearly.",
        teacher: "Ms. Cruz",
        dueAt: new Date(Date.now() + 3 * 86400000).toISOString(),
        file: { name: "fractions-worksheet.pdf", url: "" }, // url later
        status: "pending", // pending | submitted
        createdAt: Date.now() - 86400000,
      },
      {
        id: "CW-" + (now + 1),
        grade: "Grade 6",
        section: "A",
        schoolYear: getAdminActiveSY() || "2025-2026",
        subject: "English",
        title: "Book Report",
        description: "Write a short report (1–2 pages) on the assigned book.",
        teacher: "Ms. Cruz",
        dueAt: new Date(Date.now() + 6 * 86400000).toISOString(),
        file: null,
        status: "submitted",
        createdAt: Date.now() - 2 * 86400000,
      },
    ];

    writeJSON(LS_CLASSWORK, mock);
  }

  function getClasswork() {
    // ✅ Later replace with fetch:
    // return fetch("/api/student/classwork", { credentials:"include" }).then(r=>r.json())...
    const list = readJSON(LS_CLASSWORK, []);
    return Array.isArray(list) ? list : [];
  }

  function buildSubjectOptions(items) {
    const subs = Array.from(
      new Set(items.map((x) => String(x.subject || "").trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b));

    // keep "all"
    subjectFilter.innerHTML = `<option value="all">Subject: All</option>` +
      subs.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");
  }

  function applyFilters(items) {
    let out = items.slice();

    if (state.status !== "all") {
      out = out.filter((x) => String(x.status || "").toLowerCase() === state.status);
    }

    if (state.subject !== "all") {
      out = out.filter((x) => String(x.subject || "") === state.subject);
    }

    const q = norm(state.q);
    if (q) {
      out = out.filter((x) => {
        const hay = `${x.title || ""} ${x.description || ""} ${x.subject || ""}`.toLowerCase();
        return hay.includes(q);
      });
    }

    // sort soonest due first (Google Classroom-ish)
    out.sort((a, b) => new Date(a.dueAt || 0).getTime() - new Date(b.dueAt || 0).getTime());
    return out;
  }

  function renderRow(x) {
    const el = document.createElement("div");
    el.className = "cw-item";
    el.dataset.id = x.id;

    const status = String(x.status || "pending").toLowerCase();
    const statusText = status === "submitted" ? "Submitted" : "Pending";

    el.innerHTML = `
      <div>
        <div class="cw-title">${escapeHtml(x.title || "Untitled")}</div>
        <div class="cw-meta">
          <span>${escapeHtml(x.subject || "—")}</span>
          <span>•</span>
          <span>Due: ${escapeHtml(fmtDue(x.dueAt))}</span>
        </div>
        <div class="cw-desc">${escapeHtml(clampText(x.description || ""))}</div>
      </div>

      <div class="cw-teacher">${escapeHtml(x.teacher || "—")}</div>
      <div class="cw-due">${escapeHtml(fmtDue(x.dueAt))}</div>
      <div class="cw-pill ${status}">${escapeHtml(statusText)}</div>
    `;

    el.addEventListener("click", () => openDetails(x.id));
    return el;
  }

  function render() {
    const cls = getActiveClass();
    const sy = getAdminActiveSY();

    if (gradeSectionEl) gradeSectionEl.textContent = `${cls.grade} - Section ${cls.section}`;
    if (syLabelEl) syLabelEl.textContent = sy ? `SY ${sy}` : "SY —";

    const all = getClasswork()
      .filter((x) => x && String(x.grade || "") === String(cls.grade) && String(x.section || "") === String(cls.section))
      .filter((x) => {
        // if classwork has SY stored, it must match active SY
        if (!sy) return true;
        return !x.schoolYear || String(x.schoolYear) === sy;
      });

    // build subject dropdown
    if (subjectFilter) buildSubjectOptions(all);

    const finalList = applyFilters(all);

    listEl.innerHTML = "";
    if (!finalList.length) {
      emptyEl.classList.remove("hidden");
      return;
    }
    emptyEl.classList.add("hidden");

    finalList.forEach((x) => listEl.appendChild(renderRow(x)));
  }

  function chip(text, tone) {
    const c = document.createElement("span");
    c.className = "cw-chip " + (tone || "gray");
    c.textContent = text;
    return c;
  }

  function openDetails(id) {
    const cls = getActiveClass();
    const sy = getAdminActiveSY();
    const item = getClasswork().find((x) => x && x.id === id);
    if (!item) return;

    state.selectedId = id;

    if (viewTitle) viewTitle.textContent = item.title || "Classwork Details";
    if (viewSub) viewSub.textContent = `${cls.grade} - Section ${cls.section}${sy ? " • SY " + sy : ""}`;

    // chips
    if (viewChips) {
      viewChips.innerHTML = "";
      viewChips.appendChild(chip(item.subject || "—", "blue"));
      viewChips.appendChild(chip("Due: " + fmtDue(item.dueAt), "orange"));
      viewChips.appendChild(chip(item.teacher || "—", "gray"));

      const st = String(item.status || "pending").toLowerCase();
      viewChips.appendChild(chip(st === "submitted" ? "Submitted" : "Pending", st === "submitted" ? "green" : "orange"));
    }

    if (viewDesc) viewDesc.textContent = item.description || "—";

    // file
    if (viewFile) {
      if (item.file && item.file.name) {
        viewFile.innerHTML = `<span>${escapeHtml(item.file.name)}</span>`;
      } else {
        viewFile.innerHTML = `<span class="cw-file-muted">No file attached.</span>`;
      }
    }

    // buttons
    if (downloadBtn) {
      downloadBtn.disabled = !(item.file && (item.file.url || item.file.name));
    }

    if (submitOpenBtn) {
      const st = String(item.status || "pending").toLowerCase();
      submitOpenBtn.textContent = st === "submitted" ? "Resubmit" : "Submit";
    }

    openModal(viewModal);
  }

  function openSubmit() {
    const item = getClasswork().find((x) => x && x.id === state.selectedId);
    if (!item) return;

    if (submitSub) submitSub.textContent = item.title || "—";
    if (submitFile) submitFile.value = "";
    if (submitNotes) submitNotes.value = "";
    if (submitMsg) {
      submitMsg.textContent = "";
      submitMsg.classList.add("hidden");
    }

    openModal(submitModal);
  }

  function handleSubmit() {
    const item = getClasswork().find((x) => x && x.id === state.selectedId);
    if (!item) return;

    // Frontend-only: mark as submitted
    const fileObj = submitFile?.files?.[0] || null;
    const notes = String(submitNotes?.value || "").trim();

    const all = getClasswork();
    const idx = all.findIndex((x) => x && x.id === item.id);
    if (idx === -1) return;

    all[idx] = {
      ...all[idx],
      status: "submitted",
      submittedAt: new Date().toISOString(),
      submission: {
        fileName: fileObj ? fileObj.name : "",
        notes,
      },
    };

    writeJSON(LS_CLASSWORK, all);

    if (submitMsg) {
      submitMsg.textContent = "Submitted (frontend-only). Hook this to backend upload later.";
      submitMsg.classList.remove("hidden");
    }

    // refresh list & modal chips
    render();
    openDetails(item.id);
  }

  // ===============================
  // EVENTS
  // ===============================
  statusFilter?.addEventListener("change", () => {
    state.status = statusFilter.value || "all";
    render();
  });

  subjectFilter?.addEventListener("change", () => {
    state.subject = subjectFilter.value || "all";
    render();
  });

  searchInput?.addEventListener("input", (e) => {
    state.q = String(e.target.value || "");
    render();
  });

  // view modal close
  viewBackdrop?.addEventListener("click", () => closeModal(viewModal));
  viewCloseX?.addEventListener("click", () => closeModal(viewModal));
  viewCloseBtn?.addEventListener("click", () => closeModal(viewModal));

  // view modal actions
  downloadBtn?.addEventListener("click", () => {
    const item = getClasswork().find((x) => x && x.id === state.selectedId);
    if (!item || !item.file) return;

    // later: real file URL
    if (item.file.url) window.open(item.file.url, "_blank");
    else alert("No download URL yet (frontend-only).");
  });

  submitOpenBtn?.addEventListener("click", () => {
    closeModal(viewModal);
    openSubmit();
  });

  // submit modal close
  submitBackdrop?.addEventListener("click", () => closeModal(submitModal));
  submitCloseX?.addEventListener("click", () => closeModal(submitModal));
  submitCancelBtn?.addEventListener("click", () => closeModal(submitModal));

  submitBtn?.addEventListener("click", handleSubmit);

  // ESC close
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (submitModal && !submitModal.classList.contains("hidden")) return closeModal(submitModal);
    if (viewModal && !viewModal.classList.contains("hidden")) return closeModal(viewModal);
  });

  // boot
  seedMockIfEmpty();
  render();
}