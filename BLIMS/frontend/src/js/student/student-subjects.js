// frontend/src/js/student/student-subjects.js

document.addEventListener("DOMContentLoaded", () => {
  initTopbarMenu();
  initLogout();
  initSubjects();
});

function $(id) {
  return document.getElementById(id);
}

/* ===============================
   TOPBAR
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
   SUBJECTS (Student)
   - Reads Admin Subjects store:
     LS: blims_subjects_v1
     shape: { gradeSubjects: { "Grade 6": ["Math","English"] } }
   - Shows Active SY from Admin SY timeline:
     LS: blims_school_years_v1
================================= */
function initSubjects() {
  const subjList = $("subjList");
  const subjEmpty = $("subjEmpty");
  const sySelect = $("sySelect");
  const tabCurrent = $("tabCurrent");
  const tabArchive = $("tabArchive");
  const subjSearch = $("subjSearch");

  const gradeSectionEl = $("subjGradeSection");
  const syLabelEl = $("subjSYLabel");

  if (!subjList || !subjEmpty || !sySelect || !tabCurrent || !tabArchive) return;

  // Student context (prototype)
  const LS_ACTIVE_CLASS = "blims_active_student_class_v1";

  // Admin stores
  const LS_SCHOOL_YEARS = "blims_school_years_v1";
  const LS_SUBJECTS_STORE = "blims_subjects_v1";
  const LS_SCHEDULE = "blims_class_schedule_v1";

  const state = {
    mode: "current", // current | archive
    q: "",
    sy: "",
  };

  function readJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
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

  // Requirement: if account is new, SY dropdown should only show active SY
  function buildSYFromAdmin() {
    const adminSY = getAdminActiveSY();

    if (!adminSY) {
      sySelect.innerHTML = `<option value="">SY —</option>`;
      sySelect.disabled = true;
      state.sy = "";
      return;
    }

    state.sy = adminSY;
    sySelect.innerHTML = `<option value="${escapeHtml(adminSY)}">SY ${escapeHtml(adminSY)}</option>`;
    sySelect.value = adminSY;

    // ✅ New-account behavior: only active SY, no extra options
    sySelect.disabled = true;
  }

  // ✅ Read subjects exactly how Admin saves them
  // Admin shape: { gradeSubjects: { "Grade 6": ["Math", ...] } }
  function readAdminSubjectsForGrade(grade) {
    const store = readJSON(LS_SUBJECTS_STORE, null);
    if (!store || typeof store !== "object") return [];

    const gs = store.gradeSubjects;
    if (!gs || typeof gs !== "object") return [];

    const raw = gs[grade];
    if (!Array.isArray(raw)) return [];

    // normalize to { subject }
    return raw
      .map((s) => (typeof s === "string" ? String(s).trim() : ""))
      .filter(Boolean)
      .map((name) => ({ subject: name }));
  }

  // Optional: teacher lookup from schedule rows
  function buildTeacherMapFromSchedule(cls) {
    const rows = readJSON(LS_SCHEDULE, []);
    const list = Array.isArray(rows) ? rows : [];

    const relevant = list.filter(
      (x) =>
        x &&
        String(x.grade || "") === String(cls.grade) &&
        String(x.section || "") === String(cls.section)
    );

    // subject -> teacher -> count
    const counts = new Map();

    for (const r of relevant) {
      const subj = String(r.subject || "").trim();
      const tch = String(r.teacher || "").trim();
      if (!subj) continue;
      if (!counts.has(subj)) counts.set(subj, new Map());
      const m = counts.get(subj);
      if (!tch) continue;
      m.set(tch, (m.get(tch) || 0) + 1);
    }

    const best = new Map();
    for (const [subj, m] of counts.entries()) {
      let topTeacher = "";
      let topN = 0;
      for (const [tch, n] of m.entries()) {
        if (n > topN) {
          topTeacher = tch;
          topN = n;
        }
      }
      if (topTeacher) best.set(subj, topTeacher);
    }
    return best;
  }

  function setTab(mode) {
    const isCurrent = mode === "current";

    tabCurrent.classList.toggle("active", isCurrent);
    tabCurrent.setAttribute("aria-selected", isCurrent ? "true" : "false");

    tabArchive.classList.toggle("active", !isCurrent);
    tabArchive.setAttribute("aria-selected", !isCurrent ? "true" : "false");

    state.mode = mode;
  }

  function render() {
    const cls = getActiveClass();
    buildSYFromAdmin();

    // header labels
    if (gradeSectionEl) gradeSectionEl.textContent = `${cls.grade} - Section ${cls.section}`;
    if (syLabelEl) syLabelEl.textContent = state.sy ? `SY ${state.sy}` : "SY —";

    // If no active SY yet, show empty
    if (!state.sy) {
      subjList.innerHTML = "";
      subjEmpty.classList.remove("hidden");
      return;
    }

    // Subjects list from Admin gradeSubjects
    let subjects = readAdminSubjectsForGrade(cls.grade);

    // Current vs Archive:
    // Admin subjects store doesn't support archived SY yet,
    // so Archive tab will be empty for now (until we upgrade admin-subjects later).
    if (state.mode === "archive") {
      subjects = [];
    }

    // Search filter
    const q = norm(state.q);
    if (q) {
      subjects = subjects.filter((x) => norm(x.subject).includes(q));
    }

    subjList.innerHTML = "";

    if (!subjects.length) {
      subjEmpty.classList.remove("hidden");
      return;
    }
    subjEmpty.classList.add("hidden");

    const teacherMap = buildTeacherMapFromSchedule(cls);

    subjects.forEach((x) => {
      const subj = x.subject || "—";
      const teacher = teacherMap.get(subj) || "—";

      const row = document.createElement("div");
      row.className = "subj-row";
      row.innerHTML = `
        <div>
            <div class="subj-name">${escapeHtml(subj)}</div>
            <div class="subj-meta">${escapeHtml(cls.grade)}</div>
        </div>

        <div class="subj-pill">Section ${escapeHtml(cls.section)}</div>
        `;
      subjList.appendChild(row);
    });
  }

  // events
  tabCurrent.addEventListener("click", () => {
    setTab("current");
    render();
  });

  tabArchive.addEventListener("click", () => {
    setTab("archive");
    render();
  });

  // SY is admin-controlled single option now, but keep safe
  sySelect.addEventListener("change", () => {
    state.sy = sySelect.value || "";
    render();
  });

  subjSearch?.addEventListener("input", (e) => {
    state.q = String(e.target.value || "");
    render();
  });

  // boot
  setTab("current");
  render();
}