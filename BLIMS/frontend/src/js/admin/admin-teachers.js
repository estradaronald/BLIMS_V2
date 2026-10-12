// frontend/src/js/admin/admin-teachers.js
// =====================================================
// ADMIN TEACHERS PAGE (Backend-connected)
// Endpoints used:
//   GET  /api/admin/teachers?q=
//   POST /api/admin/teachers
//
// Notes:
// - Uses sessions: fetch(..., { credentials: "include" })
// - Phone UI: +63 prefix, input is 10 digits only, stored as +63XXXXXXXXXX
// - PSGC dropdowns: Province -> City/Municipality -> Barangay (psgc.cloud)
// =====================================================
(function () {
  if (window.__adminTeachersInit) return;
  window.__adminTeachersInit = true;

  const $ = (id) => document.getElementById(id);

  // ==============================
  // CSRF
  // ==============================
  const CSRF_ENDPOINT = "/api/csrf-token";
  let csrfToken = "";

  async function fetchCsrf() {
    try {
      const res = await fetch(CSRF_ENDPOINT, {
        credentials: "include",
      });

      const ct = res.headers.get("content-type") || "";

      if (!res.ok || !ct.includes("application/json")) return;

      const payload = await res.json().catch(() => null);

      if (typeof payload?.csrfToken === "string" && payload.csrfToken.trim()) {
        csrfToken = payload.csrfToken.trim();
      }
    } catch (err) {
      console.warn("CSRF fetch failed:", err);
    }
  }

  // ==============================
  // API helpers
  // ==============================
  async function apiFetch(url, opts = {}) {
    const method = String(opts.method || "GET").toUpperCase();

    const headers = {
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    };

    if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
      if (!csrfToken) {
        await fetchCsrf();
      }

      if (csrfToken) {
        headers["X-CSRF-Token"] = csrfToken;
      }
    }

    const res = await fetch(url, {
      ...opts,
      headers,
      credentials: "include",
    });

    const contentType = res.headers.get("content-type") || "";
    let data = null;

    try {
      if (contentType.includes("application/json")) {
        data = await res.json();
      } else {
        const text = await res.text();
        data = text ? { message: text } : null;
      }
    } catch {
      data = null;
    }

    if (!res.ok) {
      console.error("API ERROR:", {
        url,
        method,
        status: res.status,
        response: data,
      });

      const msg =
        data?.message ||
        data?.error ||
        data?.details ||
        data?.errors?.[0]?.msg ||
        `Request failed (${res.status})`;

      throw new Error(msg);
    }

    return data;
  }

  // ==============================
  // PSGC (Province -> City -> Barangay)
  // ==============================
  const PSGC_BASE = "https://psgc.cloud/api";
  const PSGC_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

  function cacheKey(key) {
    return `psgc_${key}_v1`;
  }

  function cacheGet(key) {
    try {
      const raw = localStorage.getItem(cacheKey(key));

      if (!raw) return null;

      const parsed = JSON.parse(raw);

      if (!parsed?.data || !parsed?.expiresAt) return null;

      if (Date.now() > parsed.expiresAt) return null;

      return parsed.data;
    } catch {
      return null;
    }
  }

  function cacheSet(key, data) {
    try {
      localStorage.setItem(
        cacheKey(key),
        JSON.stringify({
          data,
          expiresAt: Date.now() + PSGC_CACHE_TTL_MS,
        }),
      );
    } catch {}
  }

  async function fetchJSON(url) {
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`Request failed: ${res.status}`);
    }

    return res.json();
  }

  async function getProvinces() {
    const cached = cacheGet("provinces");

    if (cached) return cached;

    const data = await fetchJSON(`${PSGC_BASE}/provinces`);

    cacheSet("provinces", data);

    return data;
  }

  async function getCitiesByProvince(provinceCode) {
    const key = `cities_${provinceCode}`;

    const cached = cacheGet(key);

    if (cached) return cached;

    const data = await fetchJSON(
      `${PSGC_BASE}/provinces/${provinceCode}/cities-municipalities`,
    );

    cacheSet(key, data);

    return data;
  }

  async function getBarangaysByCity(cityCode) {
    const key = `brgys_${cityCode}`;

    const cached = cacheGet(key);

    if (cached) return cached;

    const data = await fetchJSON(
      `${PSGC_BASE}/cities-municipalities/${cityCode}/barangays`,
    );

    cacheSet(key, data);

    return data;
  }

  async function loadProvinces() {
    const provSel = $("provinceSelect");
    const citySel = $("citySelect");
    const brgySel = $("brgySelect");

    if (!provSel) return;

    provSel.innerHTML = `<option value="">Select province</option>`;

    if (citySel) {
      citySel.innerHTML = `<option value="">Select city</option>`;

      citySel.disabled = true;
    }

    if (brgySel) {
      brgySel.innerHTML = `<option value="">Select barangay</option>`;

      brgySel.disabled = true;
    }

    try {
      const provinces = await getProvinces();

      provinces.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

      provinces.forEach((p) => {
        const opt = document.createElement("option");

        opt.value = String(p.code);
        opt.textContent = p.name;

        provSel.appendChild(opt);
      });
    } catch (e) {
      console.warn("PSGC provinces error:", e);
    }
  }

  async function onProvinceChange() {
    const provSel = $("provinceSelect");
    const citySel = $("citySelect");
    const brgySel = $("brgySelect");

    if (!provSel || !citySel || !brgySel) {
      return;
    }

    const provinceCode = provSel.value;

    citySel.innerHTML = `<option value="">Select city</option>`;

    citySel.disabled = true;

    brgySel.innerHTML = `<option value="">Select barangay</option>`;

    brgySel.disabled = true;

    if ($("postal")) {
      $("postal").value = "";
    }

    if (!provinceCode) return;

    try {
      const cities = await getCitiesByProvince(provinceCode);

      cities.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

      cities.forEach((c) => {
        const opt = document.createElement("option");

        opt.value = String(c.code);
        opt.textContent = c.name;

        citySel.appendChild(opt);
      });

      citySel.disabled = false;
    } catch (e) {
      console.warn("PSGC cities error:", e);
    }
  }

  async function onCityChange() {
    const citySel = $("citySelect");
    const brgySel = $("brgySelect");

    if (!citySel || !brgySel) return;

    const cityCode = citySel.value;

    brgySel.innerHTML = `<option value="">Select barangay</option>`;

    brgySel.disabled = true;

    if ($("postal")) {
      $("postal").value = "";
    }

    if (!cityCode) return;

    try {
      const brgys = await getBarangaysByCity(cityCode);

      brgys.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

      brgys.forEach((b) => {
        const opt = document.createElement("option");

        opt.value = String(b.code);
        opt.textContent = b.name;

        brgySel.appendChild(opt);
      });

      brgySel.disabled = false;
    } catch (e) {
      console.warn("PSGC barangays error:", e);
    }
  }

  // ==============================
  // Filtering helpers
  // ==============================

  function digitsOnly(s) {
    return String(s || "").replace(/\D/g, "");
  }

  function filterNameValue(raw) {
    let s = String(raw || "");

    s = s.replace(/[^A-Za-z\s'\-]/g, "");

    s = s.replace(/\s+/g, " ");

    s = s.trim();

    s = s.replace(/'{2,}/g, "'");

    s = s.replace(/\-{2,}/g, "-");

    return s;
  }

  function bindNameFilter(id) {
    const el = $(id);

    if (!el) return;

    el.addEventListener("input", () => {
      const cleaned = filterNameValue(el.value);

      if (el.value !== cleaned) {
        el.value = cleaned;
      }
    });

    el.addEventListener("paste", () => {
      requestAnimationFrame(() => {
        el.value = filterNameValue(el.value);
      });
    });
  }

  function filterEmailValue(raw) {
    let s = String(raw || "");

    s = s.replace(/\s+/g, "");

    s = s.toLowerCase();

    return s;
  }

  function bindEmailFilter(id) {
    const el = $(id);

    if (!el) return;

    el.addEventListener("input", () => {
      const cleaned = filterEmailValue(el.value);

      if (el.value !== cleaned) {
        el.value = cleaned;
      }
    });

    el.addEventListener("paste", () => {
      requestAnimationFrame(() => {
        el.value = filterEmailValue(el.value);
      });
    });
  }

  function toPostal4(raw) {
    let d = digitsOnly(raw);

    if (d.length > 4) {
      d = d.slice(0, 4);
    }

    return d;
  }

  function bindPostalFilter() {
    const el = $("postal");

    if (!el) return;

    el.setAttribute("maxlength", "4");

    el.addEventListener("input", () => {
      const cleaned = toPostal4(el.value);

      if (el.value !== cleaned) {
        el.value = cleaned;
      }
    });

    el.addEventListener("paste", () => {
      requestAnimationFrame(() => {
        el.value = toPostal4(el.value);
      });
    });
  }

  function bindPrcFilter() {
    const el = $("prcLicense");

    if (!el) return;

    el.addEventListener("input", () => {
      if (el.disabled) return;

      const cleaned = digitsOnly(el.value);

      if (el.value !== cleaned) {
        el.value = cleaned;
      }
    });

    el.addEventListener("paste", () => {
      if (el.disabled) return;

      requestAnimationFrame(() => {
        el.value = digitsOnly(el.value);
      });
    });
  }

  function toLocal10Digits(raw) {
    let d = digitsOnly(raw);

    if (d.startsWith("63")) {
      d = d.slice(2);
    }

    if (d.startsWith("0") && d.length >= 11) {
      d = d.slice(1);
    }

    if (d.length > 10) {
      d = d.slice(0, 10);
    }

    return d;
  }

  function toStoredPhone(local10) {
    const d = toLocal10Digits(local10);

    if (d.length !== 10) {
      return "";
    }

    return `+63${d}`;
  }

  function bindPhoneFilter() {
    const phoneEl = $("phone");

    if (!phoneEl) return;

    phoneEl.setAttribute("maxlength", "10");

    phoneEl.addEventListener("input", () => {
      const cleaned = toLocal10Digits(phoneEl.value);

      if (phoneEl.value !== cleaned) {
        phoneEl.value = cleaned;
      }
    });

    phoneEl.addEventListener("paste", () => {
      requestAnimationFrame(() => {
        phoneEl.value = toLocal10Digits(phoneEl.value);
      });
    });
  }

  // ==============================
  // State
  // ==============================

  let teachers = [];
  let activeTeacherId = null;
  let editingTeacherId = null;

  // Delete confirmation + success toast state
  let pendingDeleteId = null;
  let successToastTimer = null;

  const tempPassCache = {};

  // ==============================
  // Bulk Create State
  // ==============================

  let bulkTeacherCount = 2;

  // ==============================
  // View toggling
  // ==============================

  function showListView() {
    $("listView")?.classList.remove("hidden");
    $("formView")?.classList.add("hidden");
    $("bulkCreateView")?.classList.add("hidden");

    const formHeaderActions = $("formHeaderActions");
    const bulkBtn = $("bulkCreateBtn");
    const addBtn = $("addNewBtn");

    if (formHeaderActions) {
      formHeaderActions.classList.add("hidden");
    }

    if (bulkBtn) {
      bulkBtn.style.display = "";
    }

    if (addBtn) {
      addBtn.style.display = "";
    }
  }

  function showFormView() {
    $("listView")?.classList.add("hidden");
    $("formView")?.classList.remove("hidden");
    $("bulkCreateView")?.classList.add("hidden");

    const formHeaderActions = $("formHeaderActions");
    const bulkBtn = $("bulkCreateBtn");
    const addBtn = $("addNewBtn");

    if (formHeaderActions) {
      formHeaderActions.classList.remove("hidden");
    }

    /* Bulk Create remains available from the single-teacher form */
    if (bulkBtn) {
      bulkBtn.style.display = "";
    }

    /* Add New is unnecessary while already in the Add/Edit form */
    if (addBtn) {
      addBtn.style.display = "none";
    }
  }

  function showBulkCreateView() {
    $("listView")?.classList.add("hidden");
    $("formView")?.classList.add("hidden");
    $("bulkCreateView")?.classList.remove("hidden");

    const formHeaderActions = $("formHeaderActions");
    const bulkBtn = $("bulkCreateBtn");
    const addBtn = $("addNewBtn");

    if (formHeaderActions) {
      formHeaderActions.classList.add("hidden");
    }

    if (bulkBtn) {
      bulkBtn.style.display = "none";
    }

    if (addBtn) {
      addBtn.style.display = "none";
    }

    generateBulkTeacherRows(2);
  }

  function createBulkTeacherRow() {
    const container = $("bulkTeachersContainer");

    if (!container) return;

    bulkTeacherCount++;

    const row = document.createElement("div");

    row.className = "bulk-teacher-row";
    row.dataset.row = bulkTeacherCount;

    row.innerHTML = `
      <div class="bulk-teacher-row-header">


        <div class="bulk-teacher-number">
          Teacher ${bulkTeacherCount}
        </div>


        <button
          type="button"
          class="bulk-teacher-remove"
          title="Remove teacher"
        >
          Remove
        </button>


      </div>


      <div class="bulk-teacher-row-fields">


        <!-- First Name -->
        <div class="bulk-teacher-field">
          <label>
            First Name
          </label>


          <input
            type="text"
            data-field="firstName"
            placeholder="First name"
            autocomplete="off"
          />
        </div>


        <!-- Middle Name -->
        <div class="bulk-teacher-field">
          <label>
            Middle Name
          </label>


          <input
            type="text"
            data-field="middleName"
            placeholder="Middle name"
            autocomplete="off"
          />
        </div>


        <!-- Last Name -->
<div class="bulk-teacher-field">
  <label>
    Last Name
  </label>


  <input
    type="text"
    data-field="lastName"
    placeholder="Last name"
    autocomplete="off"
  />
</div>


<!-- Suffix -->
<div class="bulk-teacher-field">
  <label>
    Suffix
  </label>


  <select data-field="suffix">
    <option value="">None</option>
    <option value="Jr.">Jr.</option>
    <option value="Sr.">Sr.</option>
    <option value="II">II</option>
    <option value="III">III</option>
    <option value="IV">IV</option>
    <option value="V">V</option>
    <option value="VI">VI</option>
  </select>
</div>


<!-- Date of Birth -->
        <div class="bulk-teacher-field">
          <label>
            Date of Birth
          </label>


          <input
            type="date"
            data-field="dob"
            max="${(() => {
              const today = new Date();
              today.setFullYear(today.getFullYear() - 18);
              return today.toISOString().split("T")[0];
            })()}"
          />
        </div>


        <!-- Gender -->
        <div class="bulk-teacher-field">
          <label>
            Gender
          </label>


          <select data-field="gender">
            <option value="">
              Select gender
            </option>


            <option value="male">
              Male
            </option>


            <option value="female">
              Female
            </option>
          </select>
        </div>


        <!-- Phone -->
        <div class="bulk-teacher-field">
          <label>
            Phone
          </label>


          <div class="bulk-phone-wrap">
            <span class="bulk-phone-prefix">
              +63
            </span>


            <input
              type="text"
              data-field="phone"
              placeholder="9XXXXXXXXX"
              maxlength="10"
              inputmode="numeric"
              autocomplete="off"
            />
          </div>
        </div>


        <!-- Email -->
        <div class="bulk-teacher-field">
          <label>
            Email
          </label>


          <input
            type="email"
            data-field="email"
            placeholder="Email address"
            autocomplete="off"
          />
        </div>


        <!-- PRC License -->
        <div class="bulk-teacher-field">
          <label>
            PRC License No.
          </label>


          <input
            type="text"
            data-field="prcLicense"
            placeholder="PRC license number"
            autocomplete="off"
          />
        </div>


        <!-- Major / Specialization -->
        <div class="bulk-teacher-field">
          <label>
            Major / Specialization
          </label>


          <select data-field="majorSpec">
            <option value="">
              Select specialization
            </option>


            <option value="Elementary Education">
              Elementary Education
            </option>


            <option value="English">
              English
            </option>


            <option value="Filipino">
              Filipino
            </option>


            <option value="Mathematics">
              Mathematics
            </option>


            <option value="Science">
              Science
            </option>


            <option value="Social Studies">
              Social Studies
            </option>


            <option value="Physical Education">
              Physical Education
            </option>


            <option value="Special Education">
              Special Education
            </option>


            <option value="Other">
              Other
            </option>
          </select>
        </div>


        <!-- Specify Other Major / Specialization -->
        <div
          class="bulk-teacher-field hidden"
          data-other-major-wrap
        >
          <label>
            Specify Other
          </label>


          <input
            type="text"
            data-field="majorOther"
            placeholder="Enter specialization"
            autocomplete="off"
            disabled
          />
        </div>


        <!-- Highest Educational Attainment -->
        <div class="bulk-teacher-field">
          <label>
            Highest Educational Attainment
          </label>


          <select data-field="highestEduc">
            <option value="">
              Select attainment
            </option>


            <option value="Bachelor's Degree">
              Bachelor's Degree
            </option>


            <option value="Master's Degree">
              Master's Degree
            </option>


            <option value="Doctorate Degree">
              Doctorate Degree
            </option>
          </select>
        </div>


        <!-- Date Hired -->
        <div class="bulk-teacher-field">
          <label>
            Date Hired
          </label>


          <input
            type="date"
            data-field="dateHired"
          />
        </div>


      </div>
    `;

    container.appendChild(row);
  }

  function generateBulkTeacherRows(count) {
    const container = $("bulkTeachersContainer");

    if (!container) return;

    count = Math.max(1, Math.min(100, Number(count) || 2));

    container.innerHTML = "";

    bulkTeacherCount = 0;

    for (let i = 0; i < count; i++) {
      createBulkTeacherRow();
    }

    renumberBulkTeachers();
  }

  function renumberBulkTeachers() {
    const rows = document.querySelectorAll(
      "#bulkTeachersContainer .bulk-teacher-row",
    );

    rows.forEach((row, index) => {
      const number = row.querySelector(".bulk-teacher-number");

      if (number) {
        number.textContent = `Teacher ${index + 1}`;
      }

      row.dataset.row = index + 1;
    });

    bulkTeacherCount = rows.length;
  }

  function bindBulkTeacherFilters() {
    const container = $("bulkTeachersContainer");

    if (!container) return;

    container.addEventListener("input", (e) => {
      const field = e.target.closest("input[data-field]");

      if (!field) return;

      const type = field.dataset.field;

      if (
        type === "firstName" ||
        type === "middleName" ||
        type === "lastName" ||
        type === "majorOther"
      ) {
        const cleaned = filterNameValue(field.value);

        if (field.value !== cleaned) {
          field.value = cleaned;
        }

        return;
      }

      if (type === "phone") {
        const cleaned = toLocal10Digits(field.value);

        if (field.value !== cleaned) {
          field.value = cleaned;
        }

        return;
      }

      if (type === "email") {
        const cleaned = filterEmailValue(field.value);

        if (field.value !== cleaned) {
          field.value = cleaned;
        }

        return;
      }

      if (type === "prcLicense") {
        const cleaned = digitsOnly(field.value);

        if (field.value !== cleaned) {
          field.value = cleaned;
        }
      }
    });

    container.addEventListener("paste", (e) => {
      const field = e.target.closest("input[data-field]");

      if (!field) return;

      requestAnimationFrame(() => {
        const type = field.dataset.field;

        if (
          type === "firstName" ||
          type === "middleName" ||
          type === "lastName" ||
          type === "majorOther"
        ) {
          field.value = filterNameValue(field.value);

          return;
        }

        if (type === "phone") {
          field.value = toLocal10Digits(field.value);

          return;
        }

        if (type === "email") {
          field.value = filterEmailValue(field.value);

          return;
        }

        if (type === "prcLicense") {
          field.value = digitsOnly(field.value);
        }
      });
    });

    // Show/hide "Specify Other" for Major / Specialization
    container.addEventListener("change", (e) => {
      if (!e.target.matches('[data-field="majorSpec"]')) return;

      const row = e.target.closest(".bulk-teacher-row");
      if (!row) return;

      const otherWrap = row.querySelector("[data-other-major-wrap]");
      const otherInput = row.querySelector('[data-field="majorOther"]');

      if (!otherWrap || !otherInput) return;

      if (e.target.value === "Other") {
        otherWrap.classList.remove("hidden");
        otherInput.disabled = false;
        otherInput.focus();
      } else {
        otherWrap.classList.add("hidden");
        otherInput.disabled = true;
        otherInput.value = "";
      }
    });
  }

  function getBulkTeachers() {
    const rows = document.querySelectorAll(
      "#bulkTeachersContainer .bulk-teacher-row",
    );

    return Array.from(rows).map((row) => {
      const getValue = (field) => {
        const el = row.querySelector(`[data-field="${field}"]`);

        return (el?.value || "").trim();
      };

      return {
        firstName: getValue("firstName"),
        middleName: getValue("middleName"),
        lastName: getValue("lastName"),
        suffix: getValue("suffix"),
        dob: getValue("dob"),
        gender: getValue("gender"),
        phone: getValue("phone"),
        email: getValue("email"),
        prcLicense: getValue("prcLicense"),
        majorSpec: getValue("majorSpec"),
        majorOther: getValue("majorOther"),
        highestEduc: getValue("highestEduc"),
        dateHired: getValue("dateHired"),
      };
    });
  }

  function validateBulkTeachers(teachers) {
    if (!teachers.length) {
      return "At least one teacher is required.";
    }

    for (let i = 0; i < teachers.length; i++) {
      const teacher = teachers[i];
      const rowNumber = i + 1;

      if (!teacher.firstName || !teacher.lastName) {
        return `Teacher ${rowNumber}: First and last name are required.`;
      }

      if (!teacher.dob) {
        return `Teacher ${rowNumber}: Date of birth is required.`;
      }

      const dobDate = new Date(teacher.dob);
      const today = new Date();

      if (Number.isNaN(dobDate.getTime())) {
        return `Teacher ${rowNumber}: Please enter a valid date of birth.`;
      }

      if (dobDate > today) {
        return `Teacher ${rowNumber}: Date of birth cannot be in the future.`;
      }

      let age = today.getFullYear() - dobDate.getFullYear();

      const monthDiff = today.getMonth() - dobDate.getMonth();

      if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < dobDate.getDate())
      ) {
        age--;
      }

      if (age < 18) {
        return `Teacher ${rowNumber}: Teacher must be at least 18 years old.`;
      }

      if (age > 100) {
        return `Teacher ${rowNumber}: Please enter a valid date of birth.`;
      }

      if (!teacher.gender) {
        return `Teacher ${rowNumber}: Gender is required.`;
      }

      if (!teacher.email) {
        return `Teacher ${rowNumber}: Email is required.`;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(teacher.email)) {
        return `Teacher ${rowNumber}: Please enter a valid email address.`;
      }

      if (!/^\d{10}$/.test(teacher.phone)) {
        return `Teacher ${rowNumber}: Phone must be exactly 10 digits.`;
      }

      if (!teacher.prcLicense) {
        return `Teacher ${rowNumber}: PRC license number is required.`;
      }

      if (!teacher.majorSpec) {
        return `Teacher ${rowNumber}: Major / Specialization is required.`;
      }

      if (teacher.majorSpec.toLowerCase() === "other" && !teacher.majorOther) {
        return `Teacher ${rowNumber}: Please specify the Major / Specialization.`;
      }

      if (!teacher.highestEduc) {
        return `Teacher ${rowNumber}: Highest educational attainment is required.`;
      }

      if (!teacher.dateHired) {
        return `Teacher ${rowNumber}: Date hired is required.`;
      }
    }

    return "";
  }

  async function submitBulkTeacherCreate() {
    const errorBox = $("bulkTeacherCreateError");

    if (errorBox) {
      errorBox.textContent = "";
      errorBox.classList.add("hidden");
    }

    const teachers = getBulkTeachers();

    const validationError = validateBulkTeachers(teachers);

    if (validationError) {
      if (errorBox) {
        errorBox.textContent = validationError;

        errorBox.classList.remove("hidden");
      }

      return;
    }

    console.log("Bulk teachers ready:", teachers);

    alert(`${teachers.length} teacher(s) are ready for creation.`);
  }

  // ==============================
  // Excel: Template Download
  // ==============================

  function downloadBulkTeacherTemplate() {
    if (typeof XLSX === "undefined") {
      alert(
        "Excel functionality is unavailable. Please check the SheetJS library.",
      );

      return;
    }

    const rows = [
      {
        "First Name": "Juan",
        "Middle Name": "Santos",
        "Last Name": "Dela Cruz",
        Suffix: "Jr.",
        Email: "juan.delacruz@example.com",
        Phone: "9123456789",
        "Date of Birth": "2000-01-15",
        Gender: "male",
        "PRC License No.": "1234567",
        "Major / Specialization": "Elementary Education",
        "Highest Educational Attainment": "Bachelor's Degree",
        "Date Hired": "2025-06-01",
      },
      {
        "First Name": "Maria",
        "Middle Name": "",
        "Last Name": "Santos",
        Suffix: "Jr.",
        Email: "maria.santos@example.com",
        Phone: "9171234567",
        "Date of Birth": "1998-08-20",
        Gender: "female",
        "PRC License No.": "7654321",
        "Major / Specialization": "English",
        "Highest Educational Attainment": "Master's Degree",
        "Date Hired": "2025-06-01",
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(rows);

    worksheet["!cols"] = [
      { wch: 18 }, // First Name
      { wch: 18 }, // Middle Name
      { wch: 22 }, // Last Name
      { wch: 12 }, // Suffix
      { wch: 32 }, // Email
      { wch: 16 }, // Phone
      { wch: 18 }, // Date of Birth
      { wch: 12 }, // Gender
      { wch: 18 }, // PRC License
      { wch: 28 }, // Major / Specialization
      { wch: 34 }, // Highest Educational Attainment
      { wch: 18 }, // Date Hired
    ];

    const workbook = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(workbook, worksheet, "Teachers");

    XLSX.writeFile(workbook, "BLIMS_Teacher_Bulk_Create_Template.xlsx");
  }

  // ==============================
  // UI helpers
  // ==============================

  function setError(msg) {
    const box = $("formError");

    if (!box) return;

    box.textContent = msg;

    box.classList.remove("hidden");
  }

  function clearError() {
    const box = $("formError");

    if (!box) return;

    box.classList.add("hidden");

    box.textContent = "";
  }

  function fullName(t) {
    return [t.firstName, t.middleName, t.lastName].filter(Boolean).join(" ");
  }

  function getTeacherGenderText(t) {
    if (t.gender) {
      return t.gender === "female" ? "Female" : "Male";
    }

    if (t.sex) {
      return t.sex;
    }

    return "—";
  }

  function getTeacherAddress(t) {
    return t.address || {};
  }

  function getTeacherCredentials(t) {
    return t.credentials || {};
  }

  // ==============================
  // Render
  // ==============================

  function renderTeachersTable() {
    const tbody = $("teachersTbody");

    if (!tbody) return;

    const q = ($("searchInput")?.value || "").toLowerCase().trim();

    const filtered = teachers.filter((t) => {
      return (
        !q ||
        fullName(t).toLowerCase().includes(q) ||
        (t.teacherId || "").toLowerCase().includes(q) ||
        (t.email || "").toLowerCase().includes(q)
      );
    });

    tbody.innerHTML = "";

    if (filtered.length === 0) {
      const tr = document.createElement("tr");

      tr.innerHTML = `
      <td colspan="6" class="t-empty-cell">
        <div class="t-empty-state">
          <div class="t-empty-title">No faculty members found</div>
          <div class="t-empty-text">
            Try adjusting your search or add a new faculty member.
          </div>
        </div>
      </td>
    `;

      tbody.appendChild(tr);
      return;
    }

    const escapeHtml = (value) => {
      return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };

    const getInitials = (teacher) => {
      const first = String(teacher.firstName || "").trim();
      const last = String(teacher.lastName || "").trim();

      const firstInitial = first.charAt(0);
      const lastInitial = last.charAt(0);

      return `firstInitial{lastInitial}`.toUpperCase() || "T";
    };

    const formatDate = (value) => {
      if (!value) return "—";

      const date = new Date(value);

      if (Number.isNaN(date.getTime())) {
        return String(value);
      }

      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    };

    filtered.forEach((t, idx) => {
      const tr = document.createElement("tr");

      const address = getTeacherAddress(t);
      const credentials = getTeacherCredentials(t);

      const name = fullName(t) || "Unnamed Faculty";
      const teacherId = t.teacherId || "—";
      const email = t.email || "—";
      const phone = t.phone || "—";

      const major = credentials.majorSpec || t.majorSpec || "No specialization";

      const education =
        credentials.highestEduc || t.highestEduc || "No attainment recorded";

      const prc =
        credentials.prcLicense ||
        credentials.prcLicenseNo ||
        t.prcLicense ||
        t.prcLicenseNo ||
        "N/A";

      const dateHired = credentials.dateHired || t.dateHired || "";

      const position = t.position || "Teacher";

      const status = t.status || t.accountStatus || "Active";

      const statusText =
        String(status).toLowerCase() === "active" ? "Active" : String(status);

      tr.innerHTML = `
      <!-- NUMBER -->
      <td class="t-col-no">
        <span class="t-row-number">
          ${String(idx + 1).padStart(2, "0")}
        </span>
      </td>


      <!-- FACULTY MEMBER -->
      <td class="t-col-member">
        <div class="t-member-cell">


          <div class="t-member-avatar" aria-hidden="true">
            ${escapeHtml(getInitials(t))}
          </div>


          <div class="t-member-info">
            <div class="t-member-name">
              ${escapeHtml(name)}
            </div>


            <div class="t-member-id">
              ${escapeHtml(teacherId)}
            </div>
          </div>


        </div>
      </td>


      <!-- CONTACT -->
      <td class="t-col-contact">
        <div class="t-contact-cell">


          <div class="t-contact-main">
            ${escapeHtml(email)}
          </div>


          <div class="t-contact-sub">
            ${escapeHtml(phone)}
          </div>


        </div>
      </td>


      <!-- PROFESSIONAL DETAILS -->
      <td class="t-col-professional">
        <div class="t-professional-cell">


          <div class="t-professional-main">
            ${escapeHtml(major)}
          </div>


          <div class="t-professional-meta">
            <span class="t-detail-pill">
              ${escapeHtml(prc === "N/A" ? "No PRC" : "PRC " + prc)}
            </span>


            <span class="t-detail-secondary">
              ${escapeHtml(education)}
            </span>
          </div>


        </div>
      </td>


      <!-- EMPLOYMENT -->
      <td class="t-col-employment">
        <div class="t-employment-cell">


          <div class="t-employment-main">
            ${escapeHtml(position)}
          </div>


          <div class="t-employment-meta">
            ${
              dateHired
                ? `Hired ${escapeHtml(formatDate(dateHired))}`
                : "Date hired not recorded"
            }
          </div>


          <span class="t-status-badge">
            <span class="t-status-dot"></span>
            ${escapeHtml(statusText)}
          </span>


        </div>
      </td>


      <!-- ACTIONS -->
      <td class="t-action-cell">
        <div class="t-actions">


          <!-- EDIT -->
          <button
            class="t-icon-btn t-edit"
            data-id="${escapeHtml(t.id)}"
            title="Edit"
            aria-label="Edit Teacher"
            type="button"
          >
            <img
              src="../../assets/icons/edit.svg"
              alt="Edit"
            />
          </button>


          <!-- VIEW -->
          <button
            class="t-icon-btn t-view"
            data-id="${escapeHtml(t.id)}"
            title="View"
            aria-label="View Teacher"
            type="button"
          >
            <img
              src="../../assets/icons/view.svg"
              alt="View"
            />
          </button>


          <!-- DELETE -->
          <button
            class="t-icon-btn t-del"
            data-id="${escapeHtml(t.id)}"
            title="Delete"
            aria-label="Delete Teacher"
            type="button"
          >
            <img
              src="../../assets/icons/delete.svg"
              alt="Delete"
            />
          </button>


        </div>
      </td>
    `;

      tbody.appendChild(tr);
    });
  }

  // ==============================
  // Delete Confirmation + Toast
  // ==============================

  function openConfirm() {
    const modal = $("confirmModal");

    if (!modal) return;

    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");

    $("confirmDeleteBtn")?.focus();
  }

  function closeConfirm() {
    const modal = $("confirmModal");

    if (!modal) return;

    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");

    pendingDeleteId = null;
  }

  function showSuccess(message) {
    const toast = $("successToast");
    const toastText = $("successToastText");

    if (!toast || !toastText) return;

    toastText.textContent = message;
    toast.hidden = false;

    clearTimeout(successToastTimer);

    successToastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 3000);
  }

  function startDelete(id) {
    const teacher = teachers.find((t) => t.id === id);

    if (!teacher) return;

    pendingDeleteId = id;

    const teacherName = fullName(teacher) || "this teacher";

    const confirmText = $("confirmText");

    if (confirmText) {
      confirmText.textContent = `Are you sure you want to delete "${teacherName}"?`;
    }

    openConfirm();
  }

  async function deletePending() {
    if (!pendingDeleteId) return;

    const teacher = teachers.find((t) => t.id === pendingDeleteId);

    if (!teacher) {
      closeConfirm();
      return;
    }

    const teacherName = fullName(teacher) || "Teacher";
    const deleteBtn = $("confirmDeleteBtn");

    try {
      if (deleteBtn) {
        deleteBtn.disabled = true;
      }

      // Permanently delete the teacher and linked account from the backend.
      await apiFetch(
        `/api/admin/teachers/${encodeURIComponent(pendingDeleteId)}`,
        {
          method: "DELETE",
        },
      );

      // Remove the deleted teacher from the local table.
      teachers = teachers.filter((t) => t.id !== pendingDeleteId);

      closeConfirm();
      renderTeachersTable();

      showSuccess(`${teacherName} was deleted successfully.`);
    } catch (err) {
      console.error("Delete teacher failed:", err);

      // Keep the teacher in the table when the backend delete fails.
      closeConfirm();

      alert(err.message || "Failed to delete teacher.");
    } finally {
      if (deleteBtn) {
        deleteBtn.disabled = false;
      }
    }
  }
  // ==============================
  // Modal
  // ==============================

  function setText(id, value) {
    const el = $(id);

    if (el) {
      el.textContent = value ?? "";
    }
  }

  function setValue(id, value) {
    const el = $(id);

    if (el) {
      el.value = value ?? "";
    }
  }

  async function openTeacherModal(id) {
    const modal = $("teacherModal");

    if (!modal) return;

    const t = teachers.find((x) => x.id === id);

    if (!t) return;

    activeTeacherId = id;

    const avatar = $("tmAvatar");

    if (avatar) {
      avatar.src = "../../assets/images/bg.jpg";
    }

    const addr = getTeacherAddress(t);
    const creds = getTeacherCredentials(t);

    const teacherName = fullName(t) || "Unnamed Faculty";
    const teacherId = t.teacherId || "—";

    const position = t.position || "Teacher";

    const status = t.status || t.accountStatus || "Active";

    const statusText =
      String(status).toLowerCase() === "active" ? "Active" : String(status);

    const dateHired = creds.dateHired || t.dateHired || "—";

    setText("teacherModalTitle", "Teacher Profile");

    setText("tmTeacherId", `Teacher ID: ${teacherId}`);

    /* ==============================
     BASIC INFORMATION
  ============================== */

    setValue("tmFullName", teacherName);

    setValue("tmGender", getTeacherGenderText(t));

    setValue("tmDob", t.dob || "—");

    /* ==============================
     CONTACT & ADDRESS
  ============================== */

    setValue("tmPhone", t.phone || "—");

    setValue("tmEmail", t.email || "—");

    setValue("tmStreet", addr.street || "—");

    setValue("tmProvince", addr.provinceCode || "—");

    setValue("tmCity", addr.cityCode || "—");

    setValue("tmBrgy", addr.brgyCode || addr.barangayCode || "—");

    setValue("tmPostal", addr.postal || addr.postalCode || "—");

    /* ==============================
     PROFESSIONAL INFORMATION
  ============================== */

    setValue(
      "tmPrc",
      creds.prcLicense ||
        creds.prcLicenseNo ||
        t.prcLicense ||
        t.prcLicenseNo ||
        "N/A",
    );

    setValue("tmMajor", creds.majorSpec || t.majorSpec || "—");

    setValue("tmEduc", creds.highestEduc || t.highestEduc || "—");

    setValue("tmHired", dateHired);

    /* ==============================
     EMPLOYMENT SUMMARY
  ============================== */

    setText("tmSummaryTeacherId", teacherId);

    setText("tmSummaryPosition", position);

    setText("tmSummaryHired", dateHired);

    setText("tmSummaryStatus", statusText);

    /* ==============================
     ACCOUNT
  ============================== */

    setValue("tmAccId", teacherId);

    setValue("tmAccStatus", statusText);

    /*
     * Do not display the temporary password
     * in the teacher profile.
     */

    /* ==============================
     HEADER STATUS
  ============================== */

    const statusEl = $("tmStatus");

    if (statusEl) {
      const statusDot = statusEl.querySelector(".tmodal-status-dot");

      statusEl.textContent = "";

      if (statusDot) {
        statusEl.appendChild(statusDot);
      }

      statusEl.appendChild(document.createTextNode(` ${statusText}`));
    }

    /* ==============================
     RESET TO BASIC INFO
  ============================== */

    document.querySelectorAll(".tmodal-tab").forEach((b) => {
      b.classList.remove("active");
    });

    document.querySelectorAll(".tmodal-panel").forEach((p) => {
      p.classList.add("hidden");
    });

    document
      .querySelector('.tmodal-tab[data-tab="basic"]')
      ?.classList.add("active");

    document
      .querySelector('.tmodal-panel[data-panel="basic"]')
      ?.classList.remove("hidden");

    modal.classList.remove("hidden");

    modal.setAttribute("aria-hidden", "false");
  }

  function closeTeacherModal() {
    const modal = $("teacherModal");

    if (!modal) return;

    modal.classList.add("hidden");

    modal.setAttribute("aria-hidden", "true");

    activeTeacherId = null;
  }

  function bindTeacherModalEvents() {
    $("teacherModalBackdrop")?.addEventListener("click", closeTeacherModal);

    $("teacherModalCloseX")?.addEventListener("click", closeTeacherModal);

    $("teacherModalCloseBtn")?.addEventListener("click", closeTeacherModal);

    document.querySelectorAll(".tmodal-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        document
          .querySelectorAll(".tmodal-tab")
          .forEach((b) => b.classList.remove("active"));

        btn.classList.add("active");

        const tab = btn.dataset.tab;

        document
          .querySelectorAll(".tmodal-panel")
          .forEach((p) => p.classList.add("hidden"));

        document
          .querySelector(`.tmodal-panel[data-panel="${tab}"]`)
          ?.classList.remove("hidden");
      });
    });

    $("teacherModalEditBtn")?.addEventListener("click", () => {
      const id = activeTeacherId;

      closeTeacherModal();

      if (id) {
        startEditTeacher(id);
      }
    });

    document.addEventListener("keydown", (e) => {
      const modal = $("teacherModal");

      const isOpen = modal && !modal.classList.contains("hidden");

      if (isOpen && e.key === "Escape") {
        closeTeacherModal();
      }
    });
  }

  // ==============================
  // PRC logic
  // ==============================

  function setPrcState(hasPrc) {
    const prc = $("prcLicense");

    if (!prc) return;

    if (hasPrc) {
      prc.disabled = false;

      if (prc.value.trim().toUpperCase() === "N/A") {
        prc.value = "";
      }

      prc.placeholder = "Enter PRC License No.";
    } else {
      prc.disabled = true;

      prc.value = "N/A";

      prc.placeholder = "";
    }
  }

  function getHasPrcValue() {
    return !!$("hasPrcYes")?.checked;
  }

  function resetPrc() {
    if ($("hasPrcNo")) {
      $("hasPrcNo").checked = true;
    }

    if ($("hasPrcYes")) {
      $("hasPrcYes").checked = false;
    }

    setPrcState(false);
  }

  // ==============================
  // Form helpers
  // ==============================

  function getGenderValue() {
    const checked = document.querySelector('input[name="gender"]:checked');

    return checked ? checked.value : "male";
  }

  function clearForm() {
    if ($("firstName")) {
      $("firstName").value = "";
    }

    if ($("middleName")) {
      $("middleName").value = "";
    }

    if ($("lastName")) {
      $("lastName").value = "";
    }

    if ($("dob")) {
      $("dob").value = "";
    }

    const male = document.querySelector('input[name="gender"][value="male"]');

    if (male) {
      male.checked = true;
    }

    resetPrc();

    if ($("phone")) {
      $("phone").value = "";
    }

    if ($("email")) {
      $("email").value = "";
    }

    if ($("street")) {
      $("street").value = "";
    }

    if ($("provinceSelect")) {
      $("provinceSelect").value = "";
    }

    if ($("citySelect")) {
      $("citySelect").innerHTML = `<option value="">Select city</option>`;

      $("citySelect").disabled = true;
    }

    if ($("brgySelect")) {
      $("brgySelect").innerHTML = `<option value="">Select barangay</option>`;

      $("brgySelect").disabled = true;
    }

    if ($("postal")) {
      $("postal").value = "";
    }

    if ($("majorSpec")) {
      $("majorSpec").value = "";
    }

    if ($("majorOther")) {
      $("majorOther").value = "";
    }

    if ($("highestEduc")) {
      $("highestEduc").value = "";
    }

    if ($("dateHired")) {
      $("dateHired").value = "";
    }

    $("majorOtherWrap")?.classList.add("hidden");

    if ($("majorOther")) {
      $("majorOther").disabled = true;
    }

    if ($("teacherId")) {
      $("teacherId").value = "";
    }

    if ($("tempPass")) {
      $("tempPass").value = "";
    }

    clearError();
  }

  // ==============================
  // Backend: load teachers
  // ==============================

  async function loadTeachers() {
    const q = ($("searchInput")?.value || "").trim();

    const qs = new URLSearchParams();

    if (q) {
      qs.set("q", q);
    }

    const data = await apiFetch(`/api/admin/teachers?${qs.toString()}`);

    teachers = (data?.teachers || []).map((t) => ({
      ...t,
      id: t.id || t._id || "",
    }));

    renderTeachersTable();
  }

  // ==============================
  // Edit teacher
  // ==============================

  async function startEditTeacher(id) {
    const teacher = teachers.find((t) => t.id === id);

    if (!teacher) {
      return;
    }

    editingTeacherId = id;

    showFormView();
    clearError();

    const address = getTeacherAddress(teacher);
    const credentials = getTeacherCredentials(teacher);

    setValue("firstName", teacher.firstName || "");
    setValue("middleName", teacher.middleName || "");
    setValue("lastName", teacher.lastName || "");
    setValue("suffix", teacher.suffix || "");
    setValue("dob", teacher.dob || "");

    const gender = String(
      teacher.gender || teacher.sex || "male",
    ).toLowerCase();

    document.querySelectorAll('input[name="gender"]').forEach((radio) => {
      radio.checked = String(radio.value).toLowerCase() === gender;
    });

    setValue("phone", toLocal10Digits(teacher.phone || ""));
    setValue("email", teacher.email || "");

    setValue("street", address.street || "");
    setValue("postal", address.postal || address.postalCode || "");

    setValue(
      "prcLicense",
      credentials.prcLicense ||
        credentials.prcLicenseNo ||
        teacher.prcLicense ||
        teacher.prcLicenseNo ||
        "",
    );

    setValue("majorSpec", credentials.majorSpec || teacher.majorSpec || "");

    setValue(
      "highestEduc",
      credentials.highestEduc || teacher.highestEduc || "",
    );

    setValue("dateHired", credentials.dateHired || teacher.dateHired || "");

    if ($("teacherId")) {
      $("teacherId").value = teacher.teacherId || "";
    }

    if ($("tempPass")) {
      $("tempPass").value = tempPassCache[id] || "";
    }

    const hasPrc =
      String(
        credentials.prcLicense ||
          credentials.prcLicenseNo ||
          teacher.prcLicense ||
          teacher.prcLicenseNo ||
          "",
      ).trim() &&
      String(
        credentials.prcLicense ||
          credentials.prcLicenseNo ||
          teacher.prcLicense ||
          teacher.prcLicenseNo ||
          "",
      )
        .trim()
        .toUpperCase() !== "N/A";

    if ($("hasPrcYes")) {
      $("hasPrcYes").checked = !!hasPrc;
    }

    if ($("hasPrcNo")) {
      $("hasPrcNo").checked = !hasPrc;
    }

    setPrcState(!!hasPrc);

    // Load saved province/city/barangay selections
    await loadProvinces();

    if ($("provinceSelect") && address.provinceCode) {
      $("provinceSelect").value = String(address.provinceCode);
      await onProvinceChange();
    }

    if ($("citySelect") && address.cityCode) {
      $("citySelect").value = String(address.cityCode);
      await onCityChange();
    }

    if ($("brgySelect")) {
      $("brgySelect").value = String(
        address.brgyCode || address.barangayCode || "",
      );
    }

    // Handle "Other" major/specialization
    const majorValue = credentials.majorSpec || teacher.majorSpec || "";

    if (
      majorValue &&
      !Array.from($("majorSpec")?.options || []).some(
        (option) => option.value.toLowerCase() === majorValue.toLowerCase(),
      )
    ) {
      if ($("majorSpec")) {
        $("majorSpec").value = "Other";
      }

      if ($("majorOtherWrap")) {
        $("majorOtherWrap").classList.remove("hidden");
      }

      if ($("majorOther")) {
        $("majorOther").disabled = false;
        $("majorOther").value = majorValue;
      }
    } else {
      $("majorOtherWrap")?.classList.add("hidden");

      if ($("majorOther")) {
        $("majorOther").disabled = true;
        $("majorOther").value = "";
      }
    }
  }

  // ==============================
  // Save teacher
  // ==============================

  async function saveTeacher() {
    clearError();

    const firstName = ($("firstName")?.value || "").trim();

    const middleName = ($("middleName")?.value || "").trim();

    const lastName = ($("lastName")?.value || "").trim();

    const dob = $("dob")?.value || "";

    const gender = getGenderValue();

    const phoneLocal = ($("phone")?.value || "").trim();

    const phoneStored = toStoredPhone(phoneLocal);

    const email = ($("email")?.value || "").trim().toLowerCase();

    const street = ($("street")?.value || "").trim();

    const provinceCode = $("provinceSelect")?.value || "";

    const cityCode = $("citySelect")?.value || "";

    const brgyCode = $("brgySelect")?.value || "";

    const postal = ($("postal")?.value || "").trim();

    const hasPrc = getHasPrcValue();

    let prcLicense = ($("prcLicense")?.value || "").trim();

    if (!hasPrc) {
      prcLicense = "N/A";
    }

    const majorSpecSel = ($("majorSpec")?.value || "").trim();

    const majorOther = ($("majorOther")?.value || "").trim();

    const majorSpec =
      majorSpecSel.toLowerCase() === "other" ? majorOther : majorSpecSel;

    const highestEduc = ($("highestEduc")?.value || "").trim();

    const dateHired = $("dateHired")?.value || "";

    if (!firstName || !lastName) {
      return setError("First and last name are required.");
    }

    if (!dob) {
      return setError("Date of birth is required.");
    }

    const dobDate = new Date(dob);
    const today = new Date();

    if (Number.isNaN(dobDate.getTime())) {
      return setError("Please enter a valid date of birth.");
    }

    if (dobDate > today) {
      return setError("Date of birth cannot be in the future.");
    }

    let age = today.getFullYear() - dobDate.getFullYear();

    const monthDiff = today.getMonth() - dobDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < dobDate.getDate())
    ) {
      age--;
    }

    if (age < 18) {
      return setError("Teacher must be at least 18 years old.");
    }

    if (age > 100) {
      return setError("Please enter a valid date of birth.");
    }

    if (!email) {
      return setError("Email is required.");
    }

    if (!phoneStored) {
      return setError("Phone must be exactly 10 digits.");
    }

    if (postal && !/^\d{4}$/.test(postal)) {
      return setError("Postal must be exactly 4 digits.");
    }

    if (hasPrc && !prcLicense) {
      return setError("PRC license number required.");
    }

    if (!majorSpecSel) {
      return setError("Major is required.");
    }

    if (majorSpecSel.toLowerCase() === "other" && !majorOther) {
      return setError("Please specify the Major / Specialization.");
    }

    if (!highestEduc) {
      return setError("Highest educational attainment required.");
    }

    if (!dateHired) {
      return setError("Date hired is required.");
    }

    const payload = {
      firstName,
      middleName,
      lastName,
      suffix: $("suffix")?.value || "",
      dob,

      gender,

      sex: gender === "male" ? "Male" : "Female",

      phone: phoneStored,

      email,

      street,

      provinceCode,

      cityCode,

      barangayCode: brgyCode,

      postalCode: postal,

      hasPrc,

      prcLicenseNo: hasPrc ? prcLicense : "N/A",

      majorSpec,

      highestEduc,

      dateHired,

      position: "Teacher",
    };

    console.log("Teacher payload:", payload);

    try {
      const btn = $("saveBtn");

      if (btn) {
        btn.disabled = true;
      }

      const data = await apiFetch("/api/admin/teachers", {
        method: "POST",

        body: JSON.stringify(payload),
      });

      const created = data?.teacher || null;

      const tempPass = data?.tempPass || "";

      if (created?.id && tempPass) {
        tempPassCache[created.id] = tempPass;
      }

      if (created?._id && tempPass) {
        tempPassCache[created._id] = tempPass;
      }

      if ($("teacherId")) {
        $("teacherId").value = created?.teacherId || "";
      }

      if ($("tempPass")) {
        $("tempPass").value = tempPass || "";
      }

      alert(
        `✅ Teacher created!\n\n` +
          `Teacher ID: ${created?.teacherId || ""}\n` +
          `Temp Password: ${tempPass || ""}\n\n` +
          `⚠️ Save this password now. ` +
          `It will not be shown again later.`,
      );

      await loadTeachers();

      showListView();

      clearForm();
    } catch (err) {
      console.error("Create teacher failed:", err);

      setError(err.message || "Failed to create teacher.");
    } finally {
      const btn = $("saveBtn");

      if (btn) {
        btn.disabled = false;
      }
    }
  }

  // ==============================
  // Events
  // ==============================

  function bindEvents() {
    $("addNewBtn")?.addEventListener("click", async () => {
      editingTeacherId = null;

      showFormView();

      clearForm();

      clearError();

      await loadProvinces();
    });

    $("bulkCreateBtn")?.addEventListener("click", () => {
      showBulkCreateView();
    });

    $("generateBulkTeachersBtn")?.addEventListener("click", () => {
      const input = $("bulkTeacherCount");

      if (!input) return;

      let count = Number.parseInt(input.value, 10);

      if (Number.isNaN(count) || count < 1) {
        count = 1;
      }

      if (count > 100) {
        count = 100;
      }

      input.value = count;

      generateBulkTeacherRows(count);
    });

    $("addBulkTeacherBtn")?.addEventListener("click", () => {
      createBulkTeacherRow();
      renumberBulkTeachers();
    });

    $("saveBulkTeachersBtn")?.addEventListener(
      "click",
      submitBulkTeacherCreate,
    );

    // ==============================
    // Bulk Create Excel Buttons
    // ==============================

    const bulkTeacherDownloadTemplateBtn = document.getElementById(
      "bulkTeacherDownloadTemplateBtn",
    );

    if (bulkTeacherDownloadTemplateBtn) {
      bulkTeacherDownloadTemplateBtn.addEventListener(
        "click",
        downloadBulkTeacherTemplate,
      );
    }

    const bulkTeacherUploadBtn = document.getElementById(
      "bulkTeacherUploadBtn",
    );

    const bulkTeacherExcelInput = document.getElementById(
      "bulkTeacherExcelInput",
    );

    if (bulkTeacherUploadBtn && bulkTeacherExcelInput) {
      bulkTeacherUploadBtn.addEventListener("click", () => {
        bulkTeacherExcelInput.click();
      });
    }

    if (bulkTeacherExcelInput) {
      bulkTeacherExcelInput.addEventListener("change", async (e) => {
        const file = e.target.files?.[0];

        if (!file) return;

        if (typeof XLSX === "undefined") {
          alert(
            "Excel functionality is unavailable. Please check the SheetJS library.",
          );
          e.target.value = "";
          return;
        }

        const extension = file.name.split(".").pop().toLowerCase();

        if (!["xlsx", "xls"].includes(extension)) {
          alert("Please upload an Excel file (.xlsx or .xls).");
          e.target.value = "";
          return;
        }

        try {
          const arrayBuffer = await file.arrayBuffer();

          const workbook = XLSX.read(arrayBuffer, {
            type: "array",
          });

          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];

          const rows = XLSX.utils.sheet_to_json(worksheet, {
            defval: "",
          });

          if (!rows.length) {
            alert("The uploaded Excel file contains no teacher records.");
            e.target.value = "";
            return;
          }

          generateBulkTeacherRows(rows.length);

          const teacherRows = document.querySelectorAll(".bulk-teacher-row");

          rows.forEach((teacher, index) => {
            const row = teacherRows[index];

            if (!row) return;

            const setValue = (field, value) => {
              const input = row.querySelector(`[data-field="${field}"]`);

              if (input) {
                input.value = String(value ?? "");
              }
            };

            setValue("firstName", teacher["First Name"]);
            setValue("middleName", teacher["Middle Name"]);
            setValue("lastName", teacher["Last Name"]);
            const suffixValue = String(teacher["Suffix"] ?? "")
              .trim()
              .toLowerCase();

            const suffixSelect = row.querySelector('[data-field="suffix"]');

            if (suffixSelect) {
              const suffixOption = Array.from(suffixSelect.options).find(
                (option) => option.value.toLowerCase() === suffixValue,
              );

              if (suffixOption) {
                suffixSelect.value = suffixOption.value;
              } else {
                suffixSelect.value = "";
              }
            }
            setValue("email", filterEmailValue(teacher["Email"]));

            setValue("phone", toLocal10Digits(teacher["Phone"]));
            const formatExcelDate = (value) => {
              if (!value) return "";

              if (typeof value === "string") {
                const trimmed = value.trim();

                if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
                  return trimmed;
                }

                const parsed = new Date(trimmed);

                if (!Number.isNaN(parsed.getTime())) {
                  return parsed.toISOString().split("T")[0];
                }

                return "";
              }

              if (typeof value === "number") {
                const date = XLSX.SSF.parse_date_code(value);

                if (!date) return "";

                const month = String(date.m).padStart(2, "0");
                const day = String(date.d).padStart(2, "0");

                return `date.y-{month}-${day}`;
              }

              return "";
            };

            setValue("dob", formatExcelDate(teacher["Date of Birth"]));
            const genderValue = String(teacher["Gender"] ?? "")
              .trim()
              .toLowerCase();

            const genderSelect = row.querySelector('[data-field="gender"]');

            if (genderSelect) {
              const genderOption = Array.from(genderSelect.options).find(
                (option) => option.value.toLowerCase() === genderValue,
              );

              if (genderOption) {
                genderSelect.value = genderOption.value;
              }
            }
            setValue("prcLicense", digitsOnly(teacher["PRC License No."]));

            const majorValue = String(
              teacher["Major / Specialization"] ?? "",
            ).trim();

            const majorSelect = row.querySelector('[data-field="majorSpec"]');

            const otherWrap = row.querySelector("[data-other-major-wrap]");

            const otherInput = row.querySelector('[data-field="majorOther"]');

            if (majorSelect) {
              const matchingOption = Array.from(majorSelect.options).find(
                (option) =>
                  option.value.toLowerCase() === majorValue.toLowerCase(),
              );

              if (matchingOption) {
                majorSelect.value = matchingOption.value;

                if (otherWrap && otherInput) {
                  otherWrap.classList.add("hidden");
                  otherInput.disabled = true;
                  otherInput.value = "";
                }
              } else if (majorValue) {
                majorSelect.value = "Other";

                if (otherWrap && otherInput) {
                  otherWrap.classList.remove("hidden");
                  otherInput.disabled = false;
                  otherInput.value = majorValue;
                }
              }
            }
            const educationValue = String(
              teacher["Highest Educational Attainment"] ?? "",
            ).trim();

            const educationSelect = row.querySelector(
              '[data-field="highestEduc"]',
            );

            if (educationSelect) {
              const educationOption = Array.from(educationSelect.options).find(
                (option) =>
                  option.value.toLowerCase() === educationValue.toLowerCase(),
              );

              if (educationOption) {
                educationSelect.value = educationOption.value;
              }
            }
            setValue("dateHired", formatExcelDate(teacher["Date Hired"]));
          });

          alert(`${rows.length} teacher(s) imported successfully.`);
        } catch (error) {
          console.error("Teacher Excel import failed:", error);

          alert(
            "Unable to read the Excel file. Please check the file format and try again.",
          );
        }

        e.target.value = "";
      });
    }

    $("bulkTeachersContainer")?.addEventListener("click", (e) => {
      const removeBtn = e.target.closest(".bulk-teacher-remove");

      if (!removeBtn) return;

      const row = removeBtn.closest(".bulk-teacher-row");

      if (!row) return;

      row.remove();

      const rows = document.querySelectorAll(
        "#bulkTeachersContainer .bulk-teacher-row",
      );

      if (rows.length === 0) {
        bulkTeacherCount = 0;
        createBulkTeacherRow();
      }

      renumberBulkTeachers();
    });

    $("cancelBulkCreateBtn")?.addEventListener("click", () => {
      showListView();
    });

    $("cancelBtn")?.addEventListener("click", () => {
      editingTeacherId = null;

      showListView();

      clearForm();
    });

    $("resetBtn")?.addEventListener("click", async () => {
      if (editingTeacherId) {
        await startEditTeacher(editingTeacherId);
        return;
      }

      clearForm();

      await loadProvinces();
    });

    $("saveBtn")?.addEventListener("click", saveTeacher);

    $("searchInput")?.addEventListener("input", renderTeachersTable);

    $("provinceSelect")?.addEventListener("change", onProvinceChange);

    $("citySelect")?.addEventListener("change", onCityChange);

    $("hasPrcYes")?.addEventListener("change", () => setPrcState(true));

    $("hasPrcNo")?.addEventListener("change", () => setPrcState(false));

    $("majorSpec")?.addEventListener("change", () => {
      const sel = ($("majorSpec")?.value || "").trim().toLowerCase();

      const wrap = $("majorOtherWrap");

      const input = $("majorOther");

      if (!wrap || !input) {
        return;
      }

      if (sel === "other") {
        wrap.classList.remove("hidden");

        input.disabled = false;

        input.focus();
      } else {
        wrap.classList.add("hidden");

        input.value = "";

        input.disabled = true;
      }
    });

    // ==============================
    // Delete Confirmation Modal
    // ==============================

    $("confirmModalBackdrop")?.addEventListener("click", closeConfirm);

    $("confirmCloseX")?.addEventListener("click", closeConfirm);

    $("confirmCancelBtn")?.addEventListener("click", closeConfirm);

    $("confirmDeleteBtn")?.addEventListener("click", deletePending);

    document.addEventListener("keydown", (e) => {
      const modal = $("confirmModal");

      const isOpen = modal && !modal.classList.contains("hidden");

      if (isOpen && e.key === "Escape") {
        closeConfirm();
      }
    });

    $("teachersTbody")?.addEventListener("click", async (e) => {
      const btn = e.target.closest("button");

      if (!btn) return;

      const id = btn.dataset.id;

      if (!id) return;

      // ==========================
      // VIEW
      // ==========================
      if (btn.classList.contains("t-view")) {
        openTeacherModal(id);
      }

      // ==========================
      // EDIT
      // ==========================
      // Button is currently present
      // for consistent UI. Backend
      // update functionality can be
      // connected separately.
      if (btn.classList.contains("t-edit")) {
        startEditTeacher(id);
      }

      // ==========================
      // DELETE
      // ==========================
      // Button is currently present
      // for consistent UI. Backend
      // delete functionality can be
      // connected separately.
      if (btn.classList.contains("t-del")) {
        startDelete(id);
      }
    });
  }

  // ==============================
  // Init
  // ==============================

  async function init() {
    await fetchCsrf();

    bindEvents();

    bindTeacherModalEvents();

    bindPhoneFilter();

    bindPostalFilter();

    const dobInput = $("dob");

    if (dobInput) {
      const today = new Date();

      const maxDob = new Date(today);
      maxDob.setFullYear(today.getFullYear() - 18);

      const minDob = new Date(today);
      minDob.setFullYear(today.getFullYear() - 100);

      const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        return `year-{month}-${day}`;
      };

      dobInput.min = formatDate(minDob);
      dobInput.max = formatDate(maxDob);
    }

    bindNameFilter("firstName");
    bindNameFilter("middleName");

    bindNameFilter("lastName");

    bindEmailFilter("email");

    bindPrcFilter();

    bindBulkTeacherFilters();

    showListView();

    resetPrc();

    if ($("majorOther")) {
      $("majorOther").disabled = true;
    }

    try {
      await loadTeachers();
    } catch (e) {
      console.warn(e);

      setError(e.message || "Failed to load teachers.");
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, {
      once: true,
    });
  } else {
    init();
  }
})();
