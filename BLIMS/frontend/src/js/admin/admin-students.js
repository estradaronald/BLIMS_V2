// frontend/src/js/admin/admin-students.js
// =====================================================
// ADMIN STUDENTS PAGE (Backend-connected)
// Endpoints used:
//   GET    /api/admin/students?q=&class=all
//   POST   /api/admin/students
//   PUT    /api/admin/students/:studentId
//   DELETE /api/admin/students/:studentId
//   PATCH  /api/admin/students/:studentId/disable
//   POST   /api/admin/students/:studentId/reset-password
//
// Notes:
// - Uses sessions: fetch(..., { credentials: "include" })
// - CSRF endpoint in your backend: /api/csrf-token
// - Phone UI: +63 prefix, input is 10 digits only, stored as +63XXXXXXXXXX
// =====================================================
(function () {
  if (window.__adminStudentsInit) return;
  window.__adminStudentsInit = true;

  // ==============================
  // DOM helpers
  // ==============================
  const $ = (id) => document.getElementById(id);

  // ==============================
  // CSRF
  // ==============================
  const CSRF_ENDPOINT = "/api/csrf-token";
  let csrfToken = "";

  async function fetchCsrf() {
    try {
      const res = await fetch(CSRF_ENDPOINT, { credentials: "include" });
      const ct = res.headers.get("content-type") || "";
      if (!res.ok || !ct.includes("application/json")) return;

      const payload = await res.json();
      if (payload?.ok && typeof payload.csrfToken === "string") {
        csrfToken = payload.csrfToken;
      }
    } catch {
      // ignore
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
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
    }

    const res = await fetch(url, {
      ...opts,
      headers,
      credentials: "include",
    });

    let data = null;
    try {
      data = await res.json();
    } catch {}

    if (!res.ok) {
      const msg = data?.message || `Request failed (${res.status})`;
      throw new Error(msg);
    }

    return data;
  }

  // ==============================
  // PSGC
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
        JSON.stringify({ data, expiresAt: Date.now() + PSGC_CACHE_TTL_MS })
      );
    } catch {}
  }

  async function fetchJSON(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
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
      `${PSGC_BASE}/provinces/${provinceCode}/cities-municipalities`
    );
    cacheSet(key, data);
    return data;
  }

  async function getBarangaysByCity(cityCode) {
    const key = `brgys_${cityCode}`;
    const cached = cacheGet(key);
    if (cached) return cached;
    const data = await fetchJSON(
      `${PSGC_BASE}/cities-municipalities/${cityCode}/barangays`
    );
    cacheSet(key, data);
    return data;
  }

  // ==============================
  // Input filters
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
      if (el.value !== cleaned) el.value = cleaned;
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
      if (el.value !== cleaned) el.value = cleaned;
    });

    el.addEventListener("paste", () => {
      requestAnimationFrame(() => {
        el.value = filterEmailValue(el.value);
      });
    });
  }

  function toLocal10Digits(raw) {
    let d = digitsOnly(raw);

    if (d.startsWith("63")) d = d.slice(2);
    if (d.startsWith("0") && d.length >= 11) d = d.slice(1);
    if (d.length > 10) d = d.slice(0, 10);

    return d;
  }

  function toStoredPhone(local10) {
    const d = toLocal10Digits(local10);
    if (d.length !== 10) return "";
    return `+63${d}`;
  }

  function bindPhoneFilter(id) {
    const el = $(id);
    if (!el) return;

    el.setAttribute("maxlength", "10");

    el.addEventListener("input", () => {
      const cleaned = toLocal10Digits(el.value);
      if (el.value !== cleaned) el.value = cleaned;
    });

    el.addEventListener("paste", () => {
      requestAnimationFrame(() => {
        el.value = toLocal10Digits(el.value);
      });
    });
  }

  function bindPostalFilter() {
    const el = $("postal");
    if (!el) return;

    el.setAttribute("maxlength", "4");

    el.addEventListener("input", () => {
      const cleaned = digitsOnly(el.value).slice(0, 4);
      if (el.value !== cleaned) el.value = cleaned;
    });

    el.addEventListener("paste", () => {
      requestAnimationFrame(() => {
        el.value = digitsOnly(el.value).slice(0, 4);
      });
    });
  }

  function bindLRNFilter() {
    const el = $("lrn");
    if (!el) return;

    el.setAttribute("maxlength", "12");

    el.addEventListener("input", () => {
      const cleaned = digitsOnly(el.value).slice(0, 12);
      if (el.value !== cleaned) el.value = cleaned;
    });

    el.addEventListener("paste", () => {
      requestAnimationFrame(() => {
        el.value = digitsOnly(el.value).slice(0, 12);
      });
    });
  }

  // ==============================
  // State
  // ==============================
  let students = [];
  let classes = [];
  let currentPhotoDataUrl = "";
  let activeStudentId = null;
  let editingStudentId = null;
  let editingStudentSnapshot = null;

  // one-time temp password cache
  const tempPassCache = {};

  // ==============================
  // Backend grade levels / sections
  // ==============================
  async function loadClasses() {
    try {
      const res = await apiFetch("/api/admin/sections/summary");
      const grades = res?.data || {};

      classes = Object.keys(grades);

      const classSel = $("classSelect");
      if (!classSel) return;

      classSel.innerHTML = `<option value="">Select class</option>`;

      classes.forEach((g) => {
        const opt = document.createElement("option");
        opt.value = g;
        opt.textContent = g;
        classSel.appendChild(opt);
      });
    } catch (err) {
      console.error("Failed to load grade levels:", err);
    }
  }

  async function loadSectionsByGrade(grade) {
    try {
      const res = await apiFetch(
        `/api/admin/sections?grade=${encodeURIComponent(grade)}`
      );

      const rows = res?.data || [];
      const secSel = $("sectionSelect");
      if (!secSel) return;

      secSel.innerHTML = `<option value="">Select section</option>`;

      rows.forEach((s) => {
        const opt = document.createElement("option");
        opt.value = s.section;
        opt.textContent = s.section;
        secSel.appendChild(opt);
      });
    } catch (err) {
      console.error("Failed to load sections:", err);
    }
  }

  // ==============================
  // View toggling
  // ==============================
  function showListView() {
    $("listView")?.classList.remove("hidden");
    $("formView")?.classList.add("hidden");

    const addBtn = $("addNewBtn");
    if (addBtn) addBtn.style.display = "";
  }

  function showFormView() {
    $("listView")?.classList.add("hidden");
    $("formView")?.classList.remove("hidden");

    const addBtn = $("addNewBtn");
    if (addBtn) addBtn.style.display = "none";
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

  function classSectionLabel(s) {
    const cls = s.className || "";
    const sec = s.sectionName || "";
    const out = [cls, sec].filter(Boolean).join(" - ");
    return out || "—";
  }

  function fullName(s) {
    return [s.firstName, s.middleName, s.lastName].filter(Boolean).join(" ");
  }

  function cloneDeep(obj) {
    return obj ? JSON.parse(JSON.stringify(obj)) : obj;
  }

  function getGenderValue() {
    const checked = document.querySelector('input[name="gender"]:checked');
    return checked ? checked.value : "male";
  }

  // ==============================
  // Render
  // ==============================
  function renderClassFilter() {
    const filter = $("classFilter");
    if (!filter) return;

    const current = filter.value || "all";
    filter.innerHTML = `<option value="all">All Classes</option>`;

    classes.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      filter.appendChild(opt);
    });

    filter.value = classes.includes(current) ? current : "all";
  }

  function renderStudentsTable() {
    const tbody = $("studentsTbody");
    if (!tbody) return;

    const q = ($("searchInput")?.value || "").toLowerCase().trim();
    const classFilter = $("classFilter")?.value || "all";

    const filtered = students.filter((s) => {
      const matchesSearch =
        !q ||
        fullName(s).toLowerCase().includes(q) ||
        (s.studentId || "").toLowerCase().includes(q) ||
        (s.lrn || "").toLowerCase().includes(q);

      const matchesClass = classFilter === "all" || s.className === classFilter;
      return matchesSearch && matchesClass;
    });

    tbody.innerHTML = "";

    if (filtered.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="8" style="padding:16px;color:#6b7b8a;">No students yet.</td>`;
      tbody.appendChild(tr);
      return;
    }

    filtered.forEach((s, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${String(idx + 1).padStart(2, "0")}</td>
        <td>
          <div style="font-weight:800">${fullName(s)}</div>
          <div style="font-size:11px;color:#6b7b8a">${s.studentId}</div>
        </td>
        <td>${s.lrn || "—"}</td>
        <td>${s.email || "—"}</td>
        <td>*****</td>
        <td>${classSectionLabel(s)}</td>
        <td>${s.phone || "—"}</td>
        <td>
          <div class="t-actions">
            <button class="t-icon-btn t-edit" data-id="${s.id}" title="Edit" type="button">
              <img src="../../assets/icons/edit.svg" alt="Edit" />
            </button>

            <button class="t-icon-btn t-view" data-id="${s.id}" title="View" type="button">
              <img src="../../assets/icons/view.svg" alt="View" />
            </button>

            <button class="t-icon-btn t-del" data-id="${s.id}" title="Delete" type="button">
              <img src="../../assets/icons/delete.svg" alt="Delete" />
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ==============================
  // Modal helpers
  // ==============================
  function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value ?? "";
  }

  function setValue(id, value) {
    const el = $(id);
    if (el) el.value = value ?? "";
  }

  async function resolveProvinceName(provinceCode) {
    if (!provinceCode) return "—";
    try {
      const provinces = await getProvinces();
      const p = provinces.find((x) => String(x.code) === String(provinceCode));
      return p?.name || provinceCode;
    } catch {
      return provinceCode;
    }
  }

  async function resolveCityName(provinceCode, cityCode) {
    if (!provinceCode || !cityCode) return "—";
    try {
      const cities = await getCitiesByProvince(provinceCode);
      const c = cities.find((x) => String(x.code) === String(cityCode));
      return c?.name || cityCode;
    } catch {
      return cityCode;
    }
  }

  async function resolveBarangayName(cityCode, brgyCode) {
    if (!cityCode || !brgyCode) return "—";
    try {
      const brgys = await getBarangaysByCity(cityCode);
      const b = brgys.find((x) => String(x.code) === String(brgyCode));
      return b?.name || brgyCode;
    } catch {
      return brgyCode;
    }
  }

  async function openStudentModal(id) {
    const modal = $("studentModal");
    if (!modal) return;

    const s = students.find((x) => x.id === id);
    if (!s) return;

    activeStudentId = id;

    const avatar = $("smAvatar");
    if (avatar) avatar.src = s.photoDataUrl || "../../assets/images/bg.jpg";

    setText("studentModalTitle", "Student Profile");
    setText("smStudentId", `Student ID: ${s.studentId || "—"}`);

    setValue("smFullName", fullName(s) || "—");
    setValue("smLRN", s.lrn || "—");
    setValue("smGender", s.gender || "—");
    setValue("smDob", s.dob || "—");
    setValue("smClassSection", classSectionLabel(s));

    setValue("smPhone", s.phone || "—");
    setValue("smEmail", s.email || "—");

    const addr = s.address || {};
    setValue("smStreet", addr.street || "—");
    setValue("smProvince", "Loading...");
    setValue("smCity", "Loading...");
    setValue("smBrgy", "Loading...");

    const provName = await resolveProvinceName(addr.provinceCode);
    const cityName = await resolveCityName(addr.provinceCode, addr.cityCode);
    const brgyName = await resolveBarangayName(addr.cityCode, addr.brgyCode);

    setValue("smProvince", provName || "—");
    setValue("smCity", cityName || "—");
    setValue("smBrgy", brgyName || "—");
    setValue("smPostal", addr.postal || "—");

    const p = s.parents || {};
    setValue("smFatherName", p.fatherName || "—");
    setValue("smFatherContact", p.fatherContact || "—");
    setValue("smFatherOccupation", p.fatherOccupation || "—");
    setValue("smMotherName", p.motherName || "—");
    setValue("smMotherContact", p.motherContact || "—");
    setValue("smMotherOccupation", p.motherOccupation || "—");

    setValue("smAccId", s.studentId || "—");
    setValue("smAccPass", tempPassCache[id] || "—");

    document.querySelectorAll(".tmodal-tab").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tmodal-panel").forEach((pnl) => pnl.classList.add("hidden"));
    document.querySelector('.tmodal-tab[data-tab="basic"]')?.classList.add("active");
    document.querySelector('.tmodal-panel[data-panel="basic"]')?.classList.remove("hidden");

    modal.classList.remove("hidden");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeStudentModal() {
    const modal = $("studentModal");
    if (!modal) return;
    modal.classList.add("hidden");
    modal.setAttribute("aria-hidden", "true");
    activeStudentId = null;
  }

  function bindStudentModalEvents() {
    $("studentModalBackdrop")?.addEventListener("click", closeStudentModal);
    $("studentModalCloseX")?.addEventListener("click", closeStudentModal);
    $("studentModalCloseBtn")?.addEventListener("click", closeStudentModal);

    document.querySelectorAll(".tmodal-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tmodal-tab").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        const tab = btn.dataset.tab;
        document.querySelectorAll(".tmodal-panel").forEach((p) => p.classList.add("hidden"));
        document.querySelector(`.tmodal-panel[data-panel="${tab}"]`)?.classList.remove("hidden");
      });
    });

    $("studentModalEditBtn")?.addEventListener("click", () => {
      const id = activeStudentId;
      closeStudentModal();
      if (id) startEditStudent(id);
    });

    $("studentModalDisableBtn")?.addEventListener("click", async () => {
      if (!activeStudentId) return;

      const ok = confirm("Disable this student account?");
      if (!ok) return;

      try {
        await apiFetch(`/api/admin/students/${activeStudentId}/disable`, {
          method: "PATCH",
        });

        closeStudentModal();
        await loadStudents();
      } catch (err) {
        alert(err.message || "Failed to disable account.");
      }
    });

    document.addEventListener("keydown", (e) => {
      const modal = $("studentModal");
      const isOpen = modal && !modal.classList.contains("hidden");
      if (isOpen && e.key === "Escape") closeStudentModal();
    });
  }

  // ==============================
  // Photo preview
  // ==============================
  function bindSelectFilesButton(previewEl) {
    const btn = previewEl.querySelector("#selectFilesBtn");
    if (btn) {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        $("photoInput")?.click();
      });
    }
  }

  function setPhoto(dataUrl) {
    currentPhotoDataUrl = dataUrl || "";

    const preview = $("photoPreview");
    const removeBtn = $("removePhotoBtn");
    if (!preview || !removeBtn) return;

    if (!currentPhotoDataUrl) {
      preview.style.backgroundImage = "";
      preview.style.backgroundSize = "";
      preview.style.backgroundPosition = "";
      preview.innerHTML = `
        <div class="t-upload-ico">📄</div>
        <div class="t-upload-text">Drop your files to upload</div>
        <button id="selectFilesBtn" class="t-ghost small" type="button">Select files</button>
      `;
      removeBtn.classList.add("hidden");
      bindSelectFilesButton(preview);
      return;
    }

    preview.innerHTML = `
      <div class="t-upload-text">Profile photo selected</div>
      <div style="font-size:12px;color:#6b7b8a">Click to change</div>
    `;
    preview.style.backgroundImage = `url('${currentPhotoDataUrl}')`;
    preview.style.backgroundSize = "cover";
    preview.style.backgroundPosition = "center";
    removeBtn.classList.remove("hidden");
  }

  function bindPhotoUpload() {
    const preview = $("photoPreview");
    const input = $("photoInput");
    const removeBtn = $("removePhotoBtn");
    if (!preview || !input || !removeBtn) return;

    const handleFile = (file) => {
      if (!file?.type?.startsWith("image/")) {
        alert("Please upload an image file.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => setPhoto(reader.result);
      reader.readAsDataURL(file);
    };

    preview.addEventListener("click", () => input.click());

    preview.addEventListener("dragover", (e) => {
      e.preventDefault();
      preview.style.filter = "brightness(.98)";
    });

    preview.addEventListener("dragleave", () => {
      preview.style.filter = "";
    });

    preview.addEventListener("drop", (e) => {
      e.preventDefault();
      preview.style.filter = "";
      const file = e.dataTransfer?.files?.[0];
      if (file) handleFile(file);
    });

    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (file) handleFile(file);
    });

    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      input.value = "";
      setPhoto("");
    });

    bindSelectFilesButton(preview);
  }

  // ==============================
  // Address dropdown logic
  // ==============================
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
        opt.value = p.code;
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
    if (!provSel || !citySel || !brgySel) return;

    const provinceCode = provSel.value;

    if ($("postal")) $("postal").value = "";

    citySel.innerHTML = `<option value="">Select city</option>`;
    citySel.disabled = true;

    brgySel.innerHTML = `<option value="">Select barangay</option>`;
    brgySel.disabled = true;

    if (!provinceCode) return;

    try {
      const cities = await getCitiesByProvince(provinceCode);
      cities.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      cities.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c.code;
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

    if ($("postal")) $("postal").value = "";

    brgySel.innerHTML = `<option value="">Select barangay</option>`;
    brgySel.disabled = true;

    if (!cityCode) return;

    try {
      const brgys = await getBarangaysByCity(cityCode);
      brgys.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      brgys.forEach((b) => {
        const opt = document.createElement("option");
        opt.value = b.code;
        opt.textContent = b.name;
        brgySel.appendChild(opt);
      });
      brgySel.disabled = false;
    } catch (e) {
      console.warn("PSGC barangays error:", e);
    }
  }

  async function setAddressFromSaved(addr = {}) {
    await loadProvinces();

    if ($("provinceSelect") && addr.provinceCode) {
      $("provinceSelect").value = addr.provinceCode;
      await onProvinceChange();
    }

    if ($("citySelect") && addr.cityCode) {
      $("citySelect").value = addr.cityCode;
      await onCityChange();
    }

    if ($("brgySelect") && addr.brgyCode) {
      $("brgySelect").value = addr.brgyCode;
    }

    if ($("postal")) $("postal").value = addr.postal || "";
  }

  // ==============================
  // Clear form
  // ==============================
  function clearForm() {
    $("firstName") && ($("firstName").value = "");
    $("middleName") && ($("middleName").value = "");
    $("lastName") && ($("lastName").value = "");
    $("dob") && ($("dob").value = "");
    $("lrn") && ($("lrn").value = "");

    const male = document.querySelector('input[name="gender"][value="male"]');
    const female = document.querySelector('input[name="gender"][value="female"]');
    if (male) male.checked = true;
    if (female) female.checked = false;

    $("classSelect") && ($("classSelect").value = "");
    $("sectionSelect") && ($("sectionSelect").innerHTML = `<option value="">Select section</option>`);

    $("fatherName") && ($("fatherName").value = "");
    $("fatherContact") && ($("fatherContact").value = "");
    $("fatherOccupation") && ($("fatherOccupation").value = "");
    $("motherName") && ($("motherName").value = "");
    $("motherContact") && ($("motherContact").value = "");
    $("motherOccupation") && ($("motherOccupation").value = "");

    $("phone") && ($("phone").value = "");
    $("email") && ($("email").value = "");
    $("street") && ($("street").value = "");

    if ($("provinceSelect")) $("provinceSelect").value = "";
    if ($("citySelect")) {
      $("citySelect").innerHTML = `<option value="">Select city</option>`;
      $("citySelect").disabled = true;
    }
    if ($("brgySelect")) {
      $("brgySelect").innerHTML = `<option value="">Select barangay</option>`;
      $("brgySelect").disabled = true;
    }
    $("postal") && ($("postal").value = "");

    $("studentId") && ($("studentId").value = "");
    $("tempPass") && ($("tempPass").value = "");

    setPhoto("");
    clearError();
  }

  // ==============================
  // Load students
  // ==============================
  async function loadStudents() {
    const q = ($("searchInput")?.value || "").trim();
    const classFilter = $("classFilter")?.value || "all";

    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (classFilter) qs.set("class", classFilter);

    const data = await apiFetch(`/api/admin/students?${qs.toString()}`);
    students = (data?.students || []).map((s) => ({
      ...s,
      id: s.id,
    }));

    const set = new Set(classes);
    students.forEach((s) => {
      if (s.className) set.add(s.className);
    });
    classes = Array.from(set);

    renderClassFilter();
    renderStudentsTable();
  }

  // ==============================
  // Edit flow
  // ==============================
  async function startEditStudent(id) {
    const s = students.find((x) => x.id === id);
    if (!s) return;

    editingStudentId = id;
    editingStudentSnapshot = cloneDeep(s);

    showFormView();
    clearForm();
    clearError();

    await loadClasses();
    if (s.className && $("classSelect")) {
      $("classSelect").value = s.className || "";
      await loadSectionsByGrade(s.className);
    }

    $("firstName") && ($("firstName").value = s.firstName || "");
    $("middleName") && ($("middleName").value = s.middleName || "");
    $("lastName") && ($("lastName").value = s.lastName || "");
    $("dob") && ($("dob").value = s.dob || "");
    $("lrn") && ($("lrn").value = s.lrn || "");

    const g = (s.gender || "male").toLowerCase();
    document.querySelectorAll('input[name="gender"]').forEach((r) => {
      r.checked = (r.value || "").toLowerCase() === g;
    });

    $("classSelect") && ($("classSelect").value = s.className || "");
    $("sectionSelect") && ($("sectionSelect").value = s.sectionName || "");

    const p = s.parents || {};
    $("fatherName") && ($("fatherName").value = p.fatherName || "");
    $("fatherContact") && ($("fatherContact").value = toLocal10Digits(p.fatherContact || ""));
    $("fatherOccupation") && ($("fatherOccupation").value = p.fatherOccupation || "");
    $("motherName") && ($("motherName").value = p.motherName || "");
    $("motherContact") && ($("motherContact").value = toLocal10Digits(p.motherContact || ""));
    $("motherOccupation") && ($("motherOccupation").value = p.motherOccupation || "");

    $("phone") && ($("phone").value = toLocal10Digits(s.phone || ""));
    $("email") && ($("email").value = s.email || "");

    $("street") && ($("street").value = s.address?.street || "");
    await setAddressFromSaved(s.address || {});

    $("studentId") && ($("studentId").value = s.studentId || "");
    $("tempPass") && ($("tempPass").value = tempPassCache[id] || "");

    setPhoto(s.photoDataUrl || "");
  }

  async function resetEditForm() {
    if (!editingStudentId || !editingStudentSnapshot) return;
    await startEditStudent(editingStudentId);
  }

  // ==============================
  // Validation
  // ==============================
  function validateStudentForm() {
    const firstName = ($("firstName")?.value || "").trim();
    const lastName = ($("lastName")?.value || "").trim();
    const lrn = ($("lrn")?.value || "").trim();
    const className = $("classSelect")?.value || "";
    const sectionName = $("sectionSelect")?.value || "";
    const email = ($("email")?.value || "").trim();
    const phone = toStoredPhone(($("phone")?.value || "").trim());
    const postal = ($("postal")?.value || "").trim();

    if (!firstName || !lastName) {
      return "Please enter student first and last name.";
    }

    if (!lrn || !/^\d{12}$/.test(lrn)) {
      return "LRN must be exactly 12 digits.";
    }

    if (!className || !sectionName) {
      return "Class and section are required.";
    }

    if (!email) {
      return "Email is required.";
    }

    if (!phone) {
      return "Phone must be exactly 10 digits.";
    }

    if (postal && !/^\d{4}$/.test(postal)) {
      return "Postal must be exactly 4 digits.";
    }

    return "";
  }

  // ==============================
  // Save student
  // ==============================
  async function saveStudent() {
    clearError();

    const err = validateStudentForm();
    if (err) {
      setError(err);
      return;
    }

    const payload = {
      firstName: ($("firstName")?.value || "").trim(),
      middleName: ($("middleName")?.value || "").trim(),
      lastName: ($("lastName")?.value || "").trim(),
      dob: $("dob")?.value || "",
      gender: getGenderValue(),
      lrn: ($("lrn")?.value || "").trim(),

      className: $("classSelect")?.value || "",
      sectionName: $("sectionSelect")?.value || "",

      phone: ($("phone")?.value || "").trim(),
      email: ($("email")?.value || "").trim().toLowerCase(),

      street: ($("street")?.value || "").trim(),
      provinceCode: $("provinceSelect")?.value || "",
      cityCode: $("citySelect")?.value || "",
      brgyCode: $("brgySelect")?.value || "",
      postal: ($("postal")?.value || "").trim(),

      fatherName: ($("fatherName")?.value || "").trim(),
      fatherOccupation: ($("fatherOccupation")?.value || "").trim(),
      fatherContact: ($("fatherContact")?.value || "").trim(),

      motherName: ($("motherName")?.value || "").trim(),
      motherOccupation: ($("motherOccupation")?.value || "").trim(),
      motherContact: ($("motherContact")?.value || "").trim(),

      photoDataUrl: currentPhotoDataUrl || "",
    };

    const btn = $("saveBtn");

    try {
      if (btn) btn.disabled = true;

      if (editingStudentId) {
        const data = await apiFetch(`/api/admin/students/${editingStudentId}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });

        const updated = data?.student;
        if (updated?.id && tempPassCache[updated.id]) {
          // keep temp pass cache if already exists
          tempPassCache[updated.id] = tempPassCache[updated.id];
        }
      } else {
        const data = await apiFetch("/api/admin/students", {
          method: "POST",
          body: JSON.stringify(payload),
        });

        const created = data?.student;
        const tempPass = data?.tempPass;

        if (created?.id && tempPass) {
          tempPassCache[created.id] = tempPass;
        }

        $("studentId") && ($("studentId").value = created?.studentId || "");
        $("tempPass") && ($("tempPass").value = tempPass || "");

        alert(
          `✅ Student created!\n\nStudent ID: ${created?.studentId || ""}\nTemp Password: ${tempPass || ""}\n\n⚠️ Save this password now. It will not be shown again later.`
        );
      }

      editingStudentId = null;
      editingStudentSnapshot = null;

      await loadStudents();
      showListView();
      clearForm();
    } catch (err2) {
      setError(err2.message || "Failed to save student.");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // ==============================
  // Delete student
  // ==============================
  async function deleteStudentById(id) {
    const s = students.find((x) => x.id === id);
    if (!s) return;

    const ok = confirm(`Delete student "${fullName(s)}"?`);
    if (!ok) return;

    try {
      await apiFetch(`/api/admin/students/${id}`, {
        method: "DELETE",
      });

      await loadStudents();
    } catch (err) {
      alert(err.message || "Failed to delete student.");
    }
  }

  // ==============================
  // Reset password
  // ==============================
  async function regenerateStudentPassword() {
    if (!editingStudentId) return;

    const ok = confirm("Reset this student's password?");
    if (!ok) return;

    try {
      const data = await apiFetch(
        `/api/admin/students/${editingStudentId}/reset-password`,
        {
          method: "POST",
          body: JSON.stringify({}),
        }
      );

      const tempPass = data?.tempPass || "";
      if (tempPass) {
        tempPassCache[editingStudentId] = tempPass;
        $("tempPass") && ($("tempPass").value = tempPass);
        alert(
          `✅ Password reset successful.\n\nNew Temp Password: ${tempPass}\n\n⚠️ Save this password now.`
        );
      }
    } catch (err) {
      alert(err.message || "Failed to reset password.");
    }
  }

  // ==============================
  // Events
  // ==============================
  function bindEvents() {
    $("addNewBtn")?.addEventListener("click", async () => {
      editingStudentId = null;
      editingStudentSnapshot = null;

      showFormView();
      clearForm();
      clearError();

      await loadClasses();
      await loadProvinces();
    });

    $("cancelBtn")?.addEventListener("click", () => {
      editingStudentId = null;
      editingStudentSnapshot = null;
      showListView();
      clearForm();
    });

    $("classSelect")?.addEventListener("change", async (e) => {
      const grade = e.target.value;
      const secSel = $("sectionSelect");
      if (secSel) {
        secSel.innerHTML = `<option value="">Select section</option>`;
      }
      if (grade) await loadSectionsByGrade(grade);
    });

    $("resetBtn")?.addEventListener("click", async () => {
      if (editingStudentId) {
        await resetEditForm();
        return;
      }

      clearForm();
      await loadClasses();
      await loadProvinces();
    });

    $("saveBtn")?.addEventListener("click", saveStudent);

    $("regenPassBtn")?.addEventListener("click", async () => {
      if (!editingStudentId) {
        alert("Password is generated automatically after creating the student.");
        return;
      }
      await regenerateStudentPassword();
    });

    $("addClassBtn")?.addEventListener("click", () => {
      alert("Classes are loaded from the backend sections setup.");
    });

    $("addSectionBtn")?.addEventListener("click", () => {
      alert("Sections are loaded from the backend sections setup.");
    });

    $("searchInput")?.addEventListener("input", renderStudentsTable);
    $("classFilter")?.addEventListener("change", renderStudentsTable);

    $("provinceSelect")?.addEventListener("change", onProvinceChange);
    $("citySelect")?.addEventListener("change", onCityChange);

    $("studentsTbody")?.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;

      const id = btn.dataset.id;
      if (!id) return;

      if (btn.classList.contains("t-view")) {
        openStudentModal(id);
        return;
      }

      if (btn.classList.contains("t-edit")) {
        startEditStudent(id);
        return;
      }

      if (btn.classList.contains("t-del")) {
        deleteStudentById(id);
      }
    });
  }

  // ==============================
  // Init
  // ==============================
  document.addEventListener("DOMContentLoaded", async () => {
    await fetchCsrf();

    bindEvents();
    bindStudentModalEvents();
    bindPhotoUpload();

    bindNameFilter("firstName");
    bindNameFilter("middleName");
    bindNameFilter("lastName");

    bindEmailFilter("email");

    bindPhoneFilter("phone");
    bindPhoneFilter("fatherContact");
    bindPhoneFilter("motherContact");

    bindPostalFilter();
    bindLRNFilter();

    renderClassFilter();
    showListView();

    try {
      await loadClasses();
      await loadStudents();
    } catch (e) {
      console.warn(e);
      setError(
        "Backend not reachable or route missing. Make sure server is running and /api/admin/students exists."
      );
    }
  });
})();