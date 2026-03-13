// frontend/src/js/teacher/teacher-grades.js
// Teacher Grades (MVP):
// - Quarter-based
// - Per subject
// - Teacher enters multiple entries for Written Works and Performance, single Exam
// - System computes final grade: (PT avg * 0.50) + (WW avg * 0.30) + (Exam * 0.20)
// - Save All only

const $ = (id) => document.getElementById(id);

const LS_KEYS = {
  USER: "user",
  STUDENTS: "rbms_students_v1",
  GRADES: "rbms_grades_v1",
};

// ---------- localStorage ----------
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

// ---------- teacher scope ----------
function normalize(s) {
  return String(s || "").trim();
}
function getTeacherScope() {
  const u = readLS(LS_KEYS.USER, {}) || {};

  const cls =
    u.handledClass || u.className || u.class || u.advisoryClass || u.gradeLevel || "";

  const sec =
    u.handledSection || u.sectionName || u.section || u.advisorySection || "";

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
const TEACHER_SCOPE = getTeacherScope();

function scopeLabel(scope) {
  return [scope.className, scope.sectionName].filter(Boolean).join(" - ") || "—";
}
function fullName(s) {
  return [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" ");
}

// ---------- subjects ----------
function getSubjectsForScope() {
  // You can later make this dynamic per grade/section.
  return ["Filipino", "English", "Mathematics", "Science", "Makabansa", "GMRC"];
}

// ---------- grading helpers ----------
function clampScore(v) {
  if (v === "" || v == null) return null;
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  const clamped = Math.max(0, Math.min(100, n));
  return Math.round(clamped);
}
function avgOf(obj) {
  const vals = Object.values(obj || {}).filter((v) => typeof v === "number");
  if (vals.length === 0) return null;
  const a = vals.reduce((x, y) => x + y, 0) / vals.length;
  return Math.round(a * 10) / 10;
}
function computeFinal(wwAvg, ptAvg, exam) {
  const ww = typeof wwAvg === "number" ? wwAvg : null;
  const pt = typeof ptAvg === "number" ? ptAvg : null;
  const ex = typeof exam === "number" ? exam : null;

  if (ww == null && pt == null && ex == null) return null;

  const wwV = ww == null ? 0 : ww;
  const ptV = pt == null ? 0 : pt;
  const exV = ex == null ? 0 : ex;

  const final = ptV * 0.5 + wwV * 0.3 + exV * 0.2;
  return Math.round(final * 10) / 10;
}
function remark(final) {
  if (final == null) return "—";
  return final >= 75 ? "Passed" : "Failed";
}

// ---------- storage model ----------
/*
rbms_grades_v1 = {
  "Class 1||A||Q1||Mathematics": {
     meta: { ww: ["WW1"], pt: ["PT1"], exam: ["Exam"] },
     scores: { "STD-0001": { ww:{WW1:90}, pt:{PT1:80}, exam:{Exam:85} } },
     updatedAt
  }
}
*/
function bucketKey(scope, quarter, subject) {
  return `${scope.className}||${scope.sectionName}||${quarter}||${subject}`;
}

// ---------- state ----------
let students = [];
let subjects = [];
let gradesStore = {};

let quarter = "Q1";
let subject = "";
let dirty = false;

// cache current bucket key for speed
let currentKey = "";

// ---------- bucket ----------
function ensureBucket() {
  const k = bucketKey(TEACHER_SCOPE, quarter, subject);
  currentKey = k;

  if (!gradesStore[k]) {
    gradesStore[k] = {
      meta: { ww: ["WW1"], pt: ["PT1"], exam: ["Exam"] },
      scores: {},
      updatedAt: Date.now(),
    };
  }

  // ensure student packs exist
  students.forEach((stu) => {
    const sid = stu.studentId;
    if (!sid) return;
    if (!gradesStore[k].scores[sid]) {
      gradesStore[k].scores[sid] = { ww: {}, pt: {}, exam: {} };
    }
  });

  return gradesStore[k];
}

// ---------- status ----------
function setStatusSaved(isSaved) {
  const box = $("saveStatus");
  if (!box) return;

  if (isSaved) {
    box.textContent = "Saved";
    box.style.background = "rgba(25, 135, 84, 0.14)";
    box.style.color = "#0f5132";
  } else {
    box.textContent = "Not Saved";
    box.style.background = "rgba(255, 193, 7, 0.16)";
    box.style.color = "#7a5b00";
  }
}
function setDirty(val) {
  dirty = !!val;
  setStatusSaved(!dirty);
}

// ---------- header UI ----------
function renderHeader() {
  const scope = scopeLabel(TEACHER_SCOPE);

  // ✅ Keep title consistent with other pages
  $("grTitle").textContent = "Grades";

  // topbar role
  $("tbRole").textContent = scope ? `${scope} Teacher` : "Teacher";

  // show scope inside the card sublabel
  $("grScopeLabel").textContent = `Class & Section: ${scope} • ${quarter} • ${subject || "—"}`;
}


// ---------- thead ----------
function buildThead(meta) {
  const thead = $("gradesThead");
  if (!thead) return;

  const wwCount = meta.ww.length;
  const ptCount = meta.pt.length;
  const exCount = meta.exam.length;

  thead.innerHTML = `
    <tr class="group">
      <th rowspan="2" style="width:70px">No.</th>
      <th rowspan="2" style="min-width:220px">Student</th>

      <th colspan="${wwCount}" style="text-align:center">Written Works (30%)</th>
      <th colspan="${ptCount}" style="text-align:center">Performance / Recitation (50%)</th>
      <th colspan="${exCount}" style="text-align:center">Exam (20%)</th>

      <th rowspan="2" style="width:140px">Final Grade</th>
      <th rowspan="2" style="width:120px">Remarks</th>
    </tr>
    <tr class="cols">
      ${meta.ww.map((x) => `<th style="width:110px">${x}</th>`).join("")}
      ${meta.pt.map((x) => `<th style="width:110px">${x}</th>`).join("")}
      ${meta.exam.map((x) => `<th style="width:120px">${x}</th>`).join("")}
    </tr>
  `;
}

// ---------- row calc + summary ----------
function computeFinalForStudent(bucket, sid) {
  const pack = bucket.scores[sid] || { ww: {}, pt: {}, exam: {} };
  const wwAvg = avgOf(pack.ww);
  const ptAvg = avgOf(pack.pt);
  const exVal = typeof pack.exam?.Exam === "number" ? pack.exam.Exam : null;
  return computeFinal(wwAvg, ptAvg, exVal);
}

function renderSummary(bucket) {
  const total = students.length;
  const mTotal = $("mTotal");
  if (mTotal) mTotal.textContent = String(total);

  const mAvg = $("mAvg");
  const mHigh = $("mHigh");
  const mLow = $("mLow");

  if (total === 0) {
    if (mAvg) mAvg.textContent = "—";
    if (mHigh) mHigh.textContent = "—";
    if (mLow) mLow.textContent = "—";
    return;
  }

  const finals = students
    .map((stu) => computeFinalForStudent(bucket, stu.studentId))
    .filter((v) => typeof v === "number");

  if (finals.length === 0) {
    if (mAvg) mAvg.textContent = "—";
    if (mHigh) mHigh.textContent = "—";
    if (mLow) mLow.textContent = "—";
    return;
  }

  const avg = finals.reduce((a, b) => a + b, 0) / finals.length;
  const high = Math.max(...finals);
  const low = Math.min(...finals);

  if (mAvg) mAvg.textContent = `${Math.round(avg * 10) / 10}%`;
  if (mHigh) mHigh.textContent = `${high}%`;
  if (mLow) mLow.textContent = `${low}%`;
}

// ---------- body render ----------
function renderBody(meta, bucket) {
  const tbody = $("gradesTbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (students.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="99" class="gr-empty">No students found for your class & section.</td>`;
    tbody.appendChild(tr);
    renderSummary(bucket);
    return;
  }

  students.forEach((stu, idx) => {
    const sid = stu.studentId || "";
    const pack = bucket.scores[sid] || { ww: {}, pt: {}, exam: {} };

    const final = computeFinalForStudent(bucket, sid);

    const tr = document.createElement("tr");
    tr.dataset.sid = sid;

    tr.innerHTML = `
      <td>${String(idx + 1).padStart(2, "0")}</td>
      <td>
        <div class="gr-student">
          <img class="gr-ava" src="${stu.photoDataUrl || "../../assets/images/bg.jpg"}" alt="">
          <div>
            <div class="gr-name">${fullName(stu) || "—"}</div>
            <div class="gr-id">${sid || "—"}</div>
          </div>
        </div>
      </td>

      ${meta.ww
        .map((col) => {
          const v = typeof pack.ww[col] === "number" ? pack.ww[col] : "";
          return `
            <td>
              <input class="gr-input" type="number" min="0" max="100" step="1"
                data-sid="${sid}" data-group="ww" data-col="${col}"
                value="${v}" placeholder="—" />
            </td>
          `;
        })
        .join("")}

      ${meta.pt
        .map((col) => {
          const v = typeof pack.pt[col] === "number" ? pack.pt[col] : "";
          return `
            <td>
              <input class="gr-input" type="number" min="0" max="100" step="1"
                data-sid="${sid}" data-group="pt" data-col="${col}"
                value="${v}" placeholder="—" />
            </td>
          `;
        })
        .join("")}

      ${meta.exam
        .map((col) => {
          const v = typeof pack.exam[col] === "number" ? pack.exam[col] : "";
          return `
            <td>
              <input class="gr-input" type="number" min="0" max="100" step="1"
                data-sid="${sid}" data-group="exam" data-col="${col}"
                value="${v}" placeholder="—" />
            </td>
          `;
        })
        .join("")}

      <td class="gr-final" data-final="${sid}">${final == null ? "—" : `${final}%`}</td>
      <td class="gr-remark" data-remark="${sid}">${remark(final)}</td>
    `;

    tbody.appendChild(tr);
  });

  renderSummary(bucket);
}

// ---------- efficient update (no full rerender) ----------
function updateComputedCells(bucket, sid) {
  const final = computeFinalForStudent(bucket, sid);

  const finalCell = document.querySelector(`[data-final="${sid}"]`);
  const remarkCell = document.querySelector(`[data-remark="${sid}"]`);

  if (finalCell) finalCell.textContent = final == null ? "—" : `${final}%`;
  if (remarkCell) remarkCell.textContent = remark(final);
}

// ---------- input handler ----------
function onTableInput(e) {
  const el = e.target;
  if (!(el instanceof HTMLInputElement)) return;
  if (!el.classList.contains("gr-input")) return;

  const sid = el.dataset.sid || "";
  const group = el.dataset.group || "";
  const col = el.dataset.col || "";
  if (!sid || !group || !col) return;

  const bucket = ensureBucket();
  if (!bucket.scores[sid]) bucket.scores[sid] = { ww: {}, pt: {}, exam: {} };

  const pack = bucket.scores[sid];
  const n = clampScore(el.value);

  if (n == null) {
    if (pack[group]) delete pack[group][col];
    el.value = "";
  } else {
    if (!pack[group]) pack[group] = {};
    pack[group][col] = n;
    el.value = String(n);
  }

  bucket.updatedAt = Date.now();
  setDirty(true);

  // ✅ only update the computed cells + summary (no full render)
  updateComputedCells(bucket, sid);
  renderSummary(bucket);
}

// ---------- add column ----------
function addColumn(kind) {
  const bucket = ensureBucket();
  const meta = bucket.meta;

  if (kind === "ww") meta.ww.push(`WW${meta.ww.length + 1}`);
  if (kind === "pt") meta.pt.push(`PT${meta.pt.length + 1}`);

  bucket.updatedAt = Date.now();
  setDirty(true);

  buildThead(meta);
  renderBody(meta, bucket);
}

// ---------- save / clear ----------
function saveAll() {
  const bucket = ensureBucket();
  bucket.updatedAt = Date.now();

  writeLS(LS_KEYS.GRADES, gradesStore);
  setDirty(false);
}

function clearCurrent() {
  const ok = confirm(
    `Clear grades for ${scopeLabel(TEACHER_SCOPE)} • ${quarter} • ${subject}?`
  );
  if (!ok) return;

  const k = bucketKey(TEACHER_SCOPE, quarter, subject);
  if (gradesStore[k]) {
    gradesStore[k].scores = {};
    gradesStore[k].updatedAt = Date.now();
  }

  // re-ensure student packs exist
  const bucket = ensureBucket();
  setDirty(true);

  buildThead(bucket.meta);
  renderBody(bucket.meta, bucket);
}

// ---------- init ----------
function loadData() {
  const all = readLS(LS_KEYS.STUDENTS, []);

  // teacher scope filter
  students = all.filter((s) => {
    if (!TEACHER_SCOPE.className || !TEACHER_SCOPE.sectionName) return true;
    return (s.className || "") === TEACHER_SCOPE.className &&
           (s.sectionName || "") === TEACHER_SCOPE.sectionName;
  });

  gradesStore = readLS(LS_KEYS.GRADES, {}) || {};
  subjects = getSubjectsForScope();
}

function renderSubjectOptions() {
  const sel = $("subjectSelect");
  if (!sel) return;

  sel.innerHTML = "";
  subjects.forEach((s) => {
    const opt = document.createElement("option");
    opt.value = s;
    opt.textContent = s;
    sel.appendChild(opt);
  });

  subject = subjects[0] || "";
  sel.value = subject;
}

function bindEvents() {
  $("quarterSelect")?.addEventListener("change", () => {
    quarter = $("quarterSelect").value || "Q1";
    const bucket = ensureBucket();

    renderHeader();
    buildThead(bucket.meta);
    renderBody(bucket.meta, bucket);
    setDirty(false);
  });

  $("subjectSelect")?.addEventListener("change", () => {
    subject = $("subjectSelect").value || "";
    const bucket = ensureBucket();

    renderHeader();
    buildThead(bucket.meta);
    renderBody(bucket.meta, bucket);
    setDirty(false);
  });

  $("gradesTbody")?.addEventListener("input", onTableInput);

  $("addWWBtn")?.addEventListener("click", () => addColumn("ww"));
  $("addPTBtn")?.addEventListener("click", () => addColumn("pt"));

  $("saveAllBtn")?.addEventListener("click", saveAll);
  $("clearBtn")?.addEventListener("click", clearCurrent);
}

document.addEventListener("DOMContentLoaded", () => {
  loadData();

  // default quarter
  quarter = "Q1";
  const qSel = $("quarterSelect");
  if (qSel) qSel.value = quarter;

  // subjects
  renderSubjectOptions();

  // initial render
  renderHeader();
  const bucket = ensureBucket();
  buildThead(bucket.meta);
  renderBody(bucket.meta, bucket);

  setDirty(false);
  bindEvents();
});
