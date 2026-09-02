// frontend/src/js/teacher/teacher-students.js
// Teacher Students - Enrollment Manager
// Teachers enroll admin-created student accounts into their assigned class/section

const $ = (id) => document.getElementById(id);

/* ---------------------------------------
   API
--------------------------------------- */
async function apiFetch(url, options = {}) {
  const res = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.message || "Request failed");
  }

  return data;
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
  const cls = normalize(s.className);
  const sec = normalize(s.sectionName);

  if (
    !cls ||
    !sec ||
    cls.toLowerCase() === "unassigned" ||
    sec.toLowerCase() === "unassigned"
  ) {
    return "—";
  }

  return `${cls} - ${sec}`;
}

function getStudentById(id) {
  return students.find((s) => String(s._id || s.id) === String(id));
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
   STATE
--------------------------------------- */
let TEACHER_SCOPE = { className: "", sectionName: "" };
let students = [];
let unassignedStudents = [];
let modalStudentId = null;

function hasTeacherScope() {
  return !!normalize(TEACHER_SCOPE.className) && !!normalize(TEACHER_SCOPE.sectionName);
}

/* ---------------------------------------
   LOADERS
--------------------------------------- */
async function loadTeacherScope() {
  try {
    const res = await apiFetch("/api/teacher/students/scope");
    TEACHER_SCOPE = res.data || { className: "", sectionName: "" };
  } catch (err) {
    console.error("loadTeacherScope error:", err);
    TEACHER_SCOPE = { className: "", sectionName: "" };
  }
}

async function loadStudents() {
  if (!hasTeacherScope()) {
    students = [];
    renderStudentsTable();
    return;
  }

  try {
    const res = await apiFetch(
      `/api/teacher/students/class?className=${encodeURIComponent(
        TEACHER_SCOPE.className
      )}&sectionName=${encodeURIComponent(TEACHER_SCOPE.sectionName)}`
    );

    students = Array.isArray(res.data) ? res.data : [];
    renderStudentsTable();
  } catch (err) {
    console.error("loadStudents error:", err);
    students = [];
    renderStudentsTable();
  }
}

async function loadUnassignedStudents() {
  try {
    const res = await apiFetch("/api/teacher/students/unassigned");
    unassignedStudents = Array.isArray(res.data) ? res.data : [];
  } catch (err) {
    console.error("loadUnassignedStudents error:", err);
    unassignedStudents = [];
  }
}

/* ---------------------------------------
   CHECKS
--------------------------------------- */
function isAssignedAnywhere(s) {
  const cls = normalize(s.className).toLowerCase();
  const sec = normalize(s.sectionName).toLowerCase();
  return !!cls && !!sec && cls !== "unassigned" && sec !== "unassigned";
}

function isEnrolledInTeacherClass(s) {
  if (!hasTeacherScope()) return false;

  return (
    normalize(s.className) === normalize(TEACHER_SCOPE.className) &&
    normalize(s.sectionName) === normalize(TEACHER_SCOPE.sectionName)
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
    const id = s._id || s.id || "";

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
            data-id="${id}"
            type="button"
            title="View"
          >
            <img src="../../assets/icons/view.svg" alt="View" />
          </button>

          <button
            class="t-icon-btn t-unenroll"
            data-id="${id}"
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
async function openEnrollModal() {
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

  await loadUnassignedStudents();
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

  return unassignedStudents.filter((s) => {
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
    const id = s._id || s.id || "";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="text-align:center;">
        <input class="tem-check" type="checkbox" value="${id}" />
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
      <td><span class="tem-current-class unassigned">Unassigned</span></td>
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
   ACTIONS
--------------------------------------- */
async function enrollSelectedStudents() {
  clearEnrollError();

  if (!hasTeacherScope()) {
    return setEnrollError("Teacher class/section assignment not found.");
  }

  const checks = Array.from(document.querySelectorAll(".tem-check:checked"));

  if (!checks.length) {
    return setEnrollError("Please select at least one student to enroll.");
  }

  const studentIds = checks.map((c) => c.value);

  try {
    await apiFetch("/api/teacher/students/enroll", {
      method: "POST",
      body: JSON.stringify({
        studentIds,
        className: TEACHER_SCOPE.className,
        sectionName: TEACHER_SCOPE.sectionName,
      }),
    });

    closeEnrollModal();
    await loadStudents();
  } catch (err) {
    console.error("enrollSelectedStudents error:", err);
    setEnrollError(err.message || "Failed to enroll students.");
  }
}

async function unenrollStudent(id) {
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

  try {
    await apiFetch(`/api/teacher/students/unenroll/${id}`, {
      method: "PATCH",
    });

    await loadStudents();

    if (modalStudentId === id) {
      closeStudentModal();
    }
  } catch (err) {
    console.error("unenrollStudent error:", err);
    alert(err.message || "Failed to unenroll student.");
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
document.addEventListener("DOMContentLoaded", async () => {
  bindEvents();

  await loadTeacherScope();

  const sub = document.querySelector(".t-subtitle");
  if (sub) {
    sub.textContent = hasTeacherScope()
      ? `Students in ${TEACHER_SCOPE.className} - ${TEACHER_SCOPE.sectionName}`
      : "Teacher class/section assignment not found.";
  }

  await loadStudents();

  console.log("TEACHER_SCOPE:", TEACHER_SCOPE);
});