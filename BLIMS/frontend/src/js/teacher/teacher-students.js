// frontend/src/js/teacher/teacher-students.js
// Teacher Students - Enrollment Manager
// Teachers enroll admin-created student accounts into their assigned class/section

const $ = (id) => document.getElementById(id);

const LS_KEYS = {
  STUDENTS: "rbms_students_v1",
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

/* ---------------------------------------
   HELPERS
--------------------------------------- */
function normalize(s) {
  return String(s || "").trim();
}

function fullName(s) {
  return [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" ");
}

function classSectionLabel(s) {
  const out = [s.className, s.sectionName].filter(Boolean).join(" - ");
  return out || "—";
}

function getStudentById(id) {
  return students.find((s) => String(s.id) === String(id));
}

function setEnrollError(msg) {
  const box = $("enrollModalError");
  if (!box) return;
  box.textContent = msg;
  box.classList.remove("hidden");
}

function clearEnrollError() {
  const box = $("enrollModalError");
  if (!box) return;
  box.textContent = "";
  box.classList.add("hidden");
}

function getAddressValue(addr, key) {
  return (addr && addr[key]) || "";
}

/* ---------------------------------------
   TEACHER SCOPE
--------------------------------------- */
function parseScopeFromText(text) {
  const raw = normalize(text);

  if (!raw) return { className: "", sectionName: "" };

  const patterns = [
    /(Class\s*\d+|Grade\s*\d+)\s*-\s*([A-Za-z0-9]+)/i,
    /(Class\s*\d+|Grade\s*\d+)\s+([A-Za-z0-9]+)/i,
  ];

  for (const rx of patterns) {
    const m = raw.match(rx);
    if (m) {
      return {
        className: normalize(m[1]),
        sectionName: normalize(m[2]),
      };
    }
  }

  return { className: "", sectionName: "" };
}

function getTeacherScope() {
  const u = readLS("user", {}) || {};

  let cls =
    u.handledClass ||
    u.className ||
    u.class ||
    u.advisoryClass ||
    u.gradeLevel ||
    "";

  let sec =
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
    const parsed = parseScopeFromText(combined);
    cls = cls || parsed.className;
    sec = sec || parsed.sectionName;
  }

  // fallback: parse topbar role text like "Class 1 - A Teacher"
  if (!cls || !sec) {
    const roleText = document.querySelector(".tb-role")?.textContent || "";
    const cleaned = roleText.replace(/\bTeacher\b/i, "").trim();
    const parsed = parseScopeFromText(cleaned);
    cls = cls || parsed.className;
    sec = sec || parsed.sectionName;
  }

  return {
    className: normalize(cls),
    sectionName: normalize(sec),
  };
}

let TEACHER_SCOPE = { className: "", sectionName: "" };

function hasTeacherScope() {
  return !!TEACHER_SCOPE.className && !!TEACHER_SCOPE.sectionName;
}

/* ---------------------------------------
   STATE
--------------------------------------- */
let students = [];
let modalStudentId = null;

/* ---------------------------------------
   ENROLLMENT CHECKS
--------------------------------------- */
function isAssignedAnywhere(s) {
  return !!normalize(s.className) || !!normalize(s.sectionName);
}

function isEnrolledInTeacherClass(s) {
  if (!hasTeacherScope()) return false;

  return (
    normalize(s.className) === TEACHER_SCOPE.className &&
    normalize(s.sectionName) === TEACHER_SCOPE.sectionName
  );
}

/* ---------------------------------------
   MAIN TABLE
--------------------------------------- */
function renderStudentsTable() {
  const tbody = $("studentsTbody");
  if (!tbody) return;

  const q = ($("searchInput")?.value || "").toLowerCase().trim();

  const filtered = students.filter((s) => {
    if (!isEnrolledInTeacherClass(s)) return false;

    return (
      !q ||
      fullName(s).toLowerCase().includes(q) ||
      String(s.studentId || "").toLowerCase().includes(q) ||
      String(s.lrn || "").toLowerCase().includes(q)
    );
  });

  tbody.innerHTML = "";

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr class="t-empty">
        <td colspan="8">${
          hasTeacherScope()
            ? "No students enrolled yet."
            : "Teacher class/section assignment not found."
        }</td>
      </tr>
    `;
    return;
  }

  filtered.forEach((s, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${String(idx + 1).padStart(2, "0")}</td>

      <td>
        <div style="font-weight:800">${fullName(s) || "—"}</div>
        <div style="font-size:11px;color:#6b7b8a">${s.studentId || "—"}</div>
      </td>

      <td>${s.lrn || "—"}</td>
      <td>${s.email || "—"}</td>
      <td>${s.studentId || "—"}</td>
      <td>${classSectionLabel(s)}</td>
      <td>${s.phone || "—"}</td>

      <td>
        <div class="t-actions">
          <button
            class="t-icon-btn t-view"
            data-id="${s.id}"
            type="button"
            title="View"
          >
            <img src="../../assets/icons/view.svg" alt="View" />
          </button>

          <button
            class="t-icon-btn t-unenroll"
            data-id="${s.id}"
            type="button"
            title="Unenroll"
          >
            <img src="../../assets/icons/delete.svg" alt="Unenroll" />
          </button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

/* ---------------------------------------
   ENROLL MODAL
--------------------------------------- */
function openEnrollModal() {
  if (!hasTeacherScope()) {
    alert("Teacher class/section assignment not found.");
    return;
  }

  clearEnrollError();

  if ($("enrollSearchInput")) $("enrollSearchInput").value = "";
  if ($("selectAllEnroll")) {
    $("selectAllEnroll").checked = false;
    $("selectAllEnroll").indeterminate = false;
  }

  const scopeText = `Assigned Class: ${TEACHER_SCOPE.className} - ${TEACHER_SCOPE.sectionName}`;
  if ($("enrollScopeText")) $("enrollScopeText").textContent = scopeText;

  $("enrollModal")?.classList.remove("hidden");
  $("enrollModal")?.setAttribute("aria-hidden", "false");

  renderEnrollList();
}

function closeEnrollModal() {
  $("enrollModal")?.classList.add("hidden");
  $("enrollModal")?.setAttribute("aria-hidden", "true");
  clearEnrollError();

  if ($("selectAllEnroll")) {
    $("selectAllEnroll").checked = false;
    $("selectAllEnroll").indeterminate = false;
  }
}

function getAvailableStudentsForEnroll() {
  const q = ($("enrollSearchInput")?.value || "").toLowerCase().trim();

  return students.filter((s) => {
    if (isEnrolledInTeacherClass(s)) return false;

    return (
      !q ||
      fullName(s).toLowerCase().includes(q) ||
      String(s.studentId || "").toLowerCase().includes(q) ||
      String(s.lrn || "").toLowerCase().includes(q)
    );
  });
}

function renderEnrollList() {
  const tbody = $("enrollStudentsTbody");
  if (!tbody) return;

  const pool = getAvailableStudentsForEnroll();
  tbody.innerHTML = "";

  if ($("selectAllEnroll")) {
    $("selectAllEnroll").checked = false;
    $("selectAllEnroll").indeterminate = false;
  }

  if (!pool.length) {
    tbody.innerHTML = `
      <tr class="t-empty">
        <td colspan="6">No available student accounts found.</td>
      </tr>
    `;
    return;
  }

  pool.forEach((s) => {
    const assignedElsewhere = isAssignedAnywhere(s) && !isEnrolledInTeacherClass(s);
    const currentClassText = classSectionLabel(s);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="text-align:center;">
        <input
          class="tem-check"
          type="checkbox"
          value="${s.id}"
          ${assignedElsewhere ? "disabled" : ""}
        />
      </td>

      <td>
        <div class="tem-student-meta">
          <div class="tem-student-name">${fullName(s) || "—"}</div>
          <div class="tem-student-sub">${s.studentId || "—"}</div>
        </div>
      </td>

      <td>${s.lrn || "—"}</td>
      <td>${s.email || "—"}</td>
      <td>${s.studentId || "—"}</td>

      <td>
        <span class="tem-current-class ${
          !assignedElsewhere && !isAssignedAnywhere(s) ? "unassigned" : ""
        }">
          ${currentClassText}
        </span>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

function updateSelectAllState() {
  const all = Array.from(document.querySelectorAll(".tem-check")).filter(
    (el) => !el.disabled
  );
  const checked = all.filter((el) => el.checked);

  if (!$("selectAllEnroll")) return;

  if (!all.length) {
    $("selectAllEnroll").checked = false;
    $("selectAllEnroll").indeterminate = false;
    return;
  }

  $("selectAllEnroll").checked = checked.length === all.length;
  $("selectAllEnroll").indeterminate =
    checked.length > 0 && checked.length < all.length;
}

/* ---------------------------------------
   ENROLL ACTION
--------------------------------------- */
function enrollSelectedStudents() {
  clearEnrollError();

  if (!hasTeacherScope()) {
    return setEnrollError("Teacher class/section assignment not found.");
  }

  const checks = Array.from(document.querySelectorAll(".tem-check:checked"));

  if (!checks.length) {
    return setEnrollError("Please select at least one student to enroll.");
  }

  const selectedIds = checks.map((c) => c.value);
  const blockedNames = [];

  selectedIds.forEach((id) => {
    const s = getStudentById(id);
    if (!s) return;

    if (isAssignedAnywhere(s) && !isEnrolledInTeacherClass(s)) {
      blockedNames.push(fullName(s) || s.studentId || "Student");
      return;
    }

    s.className = TEACHER_SCOPE.className;
    s.sectionName = TEACHER_SCOPE.sectionName;
  });

  if (blockedNames.length) {
    return setEnrollError(
      `These students are already assigned to another class/section: ${blockedNames.join(", ")}.`
    );
  }

  writeLS(LS_KEYS.STUDENTS, students);
  closeEnrollModal();
  renderStudentsTable();
}

/* ---------------------------------------
   UNENROLL
--------------------------------------- */
function unenrollStudent(id) {
  const s = getStudentById(id);
  if (!s) return;

  if (!isEnrolledInTeacherClass(s)) {
    alert("You can only unenroll students from your assigned class.");
    return;
  }

  const ok = confirm(
    `Remove "${fullName(s)}" from ${TEACHER_SCOPE.className} - ${TEACHER_SCOPE.sectionName}?`
  );
  if (!ok) return;

  s.className = "";
  s.sectionName = "";

  writeLS(LS_KEYS.STUDENTS, students);
  renderStudentsTable();

  if (modalStudentId === id) {
    closeStudentModal();
  }
}

/* ---------------------------------------
   STUDENT VIEW MODAL
--------------------------------------- */
function openStudentModal(id) {
  const s = getStudentById(id);
  if (!s) return;

  if (!isEnrolledInTeacherClass(s)) {
    alert("You can only view students enrolled in your assigned class.");
    return;
  }

  modalStudentId = id;

  $("studentModal")?.classList.remove("hidden");
  $("studentModal")?.setAttribute("aria-hidden", "false");

  if ($("smAvatar")) {
    $("smAvatar").src = s.photoDataUrl || "../../assets/images/bg.jpg";
  }

  if ($("smStudentId")) {
    $("smStudentId").textContent = `Student ID: ${s.studentId || "—"}`;
  }

  if ($("smFullName")) $("smFullName").value = fullName(s) || "";
  if ($("smLRN")) $("smLRN").value = s.lrn || "";
  if ($("smGender")) $("smGender").value = s.gender || "";
  if ($("smDob")) $("smDob").value = s.dob || "";
  if ($("smClassSection")) $("smClassSection").value = classSectionLabel(s);

  if ($("smPhone")) $("smPhone").value = s.phone || "";
  if ($("smEmail")) $("smEmail").value = s.email || "";
  if ($("smStreet")) $("smStreet").value = getAddressValue(s.address, "street");
  if ($("smProvince")) $("smProvince").value = getAddressValue(s.address, "provinceCode");
  if ($("smCity")) $("smCity").value = getAddressValue(s.address, "cityCode");
  if ($("smBarangay")) $("smBarangay").value = getAddressValue(s.address, "brgyCode");
  if ($("smZip")) $("smZip").value = getAddressValue(s.address, "postal");

  const p = s.parents || {};
  if ($("smFatherName")) $("smFatherName").value = p.fatherName || "";
  if ($("smFatherOccupation")) $("smFatherOccupation").value = p.fatherOccupation || "";
  if ($("smFatherContact")) $("smFatherContact").value = p.fatherContact || "";
  if ($("smMotherName")) $("smMotherName").value = p.motherName || "";
  if ($("smMotherOccupation")) $("smMotherOccupation").value = p.motherOccupation || "";
  if ($("smMotherContact")) $("smMotherContact").value = p.motherContact || "";

  if ($("smAccId")) $("smAccId").value = s.studentId || "";
  if ($("smAccPass")) $("smAccPass").value = s.tempPass || "";

  setActiveStudentModalTab("basic");
}

function closeStudentModal() {
  $("studentModal")?.classList.add("hidden");
  $("studentModal")?.setAttribute("aria-hidden", "true");
  modalStudentId = null;
}

function setActiveStudentModalTab(tabName) {
  document.querySelectorAll(".tmodal-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tabName);
  });

  document.querySelectorAll(".tmodal-panel").forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.panel !== tabName);
  });
}

/* ---------------------------------------
   EVENTS
--------------------------------------- */
function bindEvents() {
  $("addNewBtn")?.addEventListener("click", openEnrollModal);

  $("searchInput")?.addEventListener("input", renderStudentsTable);

  $("enrollSearchInput")?.addEventListener("input", () => {
    renderEnrollList();
    updateSelectAllState();
  });

  $("enrollModalCloseX")?.addEventListener("click", closeEnrollModal);
  $("enrollModalCloseBtn")?.addEventListener("click", closeEnrollModal);
  $("enrollModalBackdrop")?.addEventListener("click", closeEnrollModal);

  $("confirmEnrollBtn")?.addEventListener("click", enrollSelectedStudents);

  $("selectAllEnroll")?.addEventListener("change", (e) => {
    const checked = !!e.target.checked;
    document.querySelectorAll(".tem-check").forEach((box) => {
      if (!box.disabled) box.checked = checked;
    });
    updateSelectAllState();
  });

  $("enrollStudentsTbody")?.addEventListener("change", (e) => {
    if (e.target.classList.contains("tem-check")) {
      updateSelectAllState();
    }
  });

  $("studentsTbody")?.addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;

    const id = btn.dataset.id;
    if (!id) return;

    if (btn.classList.contains("t-view")) {
      openStudentModal(id);
      return;
    }

    if (btn.classList.contains("t-unenroll")) {
      unenrollStudent(id);
    }
  });

  $("studentModalCloseBtn")?.addEventListener("click", closeStudentModal);
  $("studentModalCloseX")?.addEventListener("click", closeStudentModal);
  $("studentModalBackdrop")?.addEventListener("click", closeStudentModal);

  $("studentModalUnenrollBtn")?.addEventListener("click", () => {
    if (!modalStudentId) return;
    unenrollStudent(modalStudentId);
  });

  document.querySelectorAll(".tmodal-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      setActiveStudentModalTab(btn.dataset.tab);
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!$("studentModal")?.classList.contains("hidden")) closeStudentModal();
    if (!$("enrollModal")?.classList.contains("hidden")) closeEnrollModal();
  });
}

/* ---------------------------------------
   INIT
--------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  students = readLS(LS_KEYS.STUDENTS, []);
  TEACHER_SCOPE = getTeacherScope();

  const sub = document.querySelector(".t-subtitle");
  if (sub) {
    sub.textContent = hasTeacherScope()
      ? `Students in ${TEACHER_SCOPE.className} - ${TEACHER_SCOPE.sectionName}`
      : "Teacher class/section assignment not found.";
  }

  bindEvents();
  renderStudentsTable();

  // helpful debug
  console.log("TEACHER_SCOPE:", TEACHER_SCOPE);
});