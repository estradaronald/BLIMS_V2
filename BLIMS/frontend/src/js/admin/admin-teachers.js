// frontend/src/js/admin/admin-teachers.js
// =====================================================
// ADMIN TEACHERS PAGE (Backend-connected)
// Endpoints used:
//   GET  /api/admin/teachers?q=&class=all
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
    if (!provSel || !citySel || !brgySel) return;

    const provinceCode = provSel.value;

    citySel.innerHTML = `<option value="">Select city</option>`;
    citySel.disabled = true;

    brgySel.innerHTML = `<option value="">Select barangay</option>`;
    brgySel.disabled = true;

    if ($("postal")) $("postal").value = "";
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

    if ($("postal")) $("postal").value = "";
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

  function toPostal4(raw) {
    let d = digitsOnly(raw);
    if (d.length > 4) d = d.slice(0, 4);
    return d;
  }

  function bindPostalFilter() {
    const el = $("postal");
    if (!el) return;

    el.setAttribute("maxlength", "4");

    el.addEventListener("input", () => {
      const cleaned = toPostal4(el.value);
      if (el.value !== cleaned) el.value = cleaned;
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
      if (el.value !== cleaned) el.value = cleaned;
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

  function bindPhoneFilter() {
    const phoneEl = $("phone");
    if (!phoneEl) return;

    phoneEl.setAttribute("maxlength", "10");

    phoneEl.addEventListener("input", () => {
      const cleaned = toLocal10Digits(phoneEl.value);
      if (phoneEl.value !== cleaned) phoneEl.value = cleaned;
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
  let classes = [];
  let sections = [];
  let currentPhotoDataUrl = "";
  let activeTeacherId = null;

  const tempPassCache = {};

  // ==============================
  // Load Grade Levels / Sections
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
      const res = await apiFetch(`/api/admin/sections?grade=${encodeURIComponent(grade)}`);
      const rows = res?.data || [];

      const secSel = $("sectionSelect");
      if (!secSel) return;

      secSel.innerHTML = `<option value="">Select section</option>`;
      sections = rows.map((r) => r.section);

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

  function advisoryLabel(t) {
    const cls = t.className || "";
    const sec = t.sectionName || "";
    const out = [cls, sec].filter(Boolean).join(" - ");
    return out || "—";
  }

  function fullName(t) {
    return [t.firstName, t.middleName, t.lastName].filter(Boolean).join(" ");
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

  function renderTeachersTable() {
    const tbody = $("teachersTbody");
    if (!tbody) return;

    const q = ($("searchInput")?.value || "").toLowerCase().trim();
    const classFilter = $("classFilter")?.value || "all";

    const filtered = teachers.filter((t) => {
      const matchesSearch =
        !q ||
        fullName(t).toLowerCase().includes(q) ||
        (t.teacherId || "").toLowerCase().includes(q);

      const matchesClass = classFilter === "all" || t.className === classFilter;
      return matchesSearch && matchesClass;
    });

    tbody.innerHTML = "";

    if (filtered.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="7" style="padding:16px;color:#6b7b8a;">No teachers yet.</td>`;
      tbody.appendChild(tr);
      return;
    }

    filtered.forEach((t, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${String(idx + 1).padStart(2, "0")}</td>
        <td>
          <div style="font-weight:800">${fullName(t)}</div>
          <div style="font-size:11px;color:#6b7b8a">${t.teacherId || "—"}</div>
        </td>
        <td>${t.email || "—"}</td>
        <td>*****</td>
        <td>${advisoryLabel(t)}</td>
        <td>${t.phone || "—"}</td>
        <td>
          <div class="t-actions">
            <button class="t-icon-btn t-view" data-id="${t.id}" title="View" type="button">
              <img src="../../assets/icons/view.svg" alt="View" />
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ==============================
  // Modal
  // ==============================
  function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value ?? "";
  }

  function setValue(id, value) {
    const el = $(id);
    if (el) el.value = value ?? "";
  }

  async function openTeacherModal(id) {
    const modal = $("teacherModal");
    if (!modal) return;

    const t = teachers.find((x) => x.id === id);
    if (!t) return;

    activeTeacherId = id;

    const avatar = $("tmAvatar");
    if (avatar) avatar.src = t.photoDataUrl || "../../assets/images/bg.jpg";

    setText("teacherModalTitle", "Teacher Profile");
    setText("tmTeacherId", `Teacher ID: ${t.teacherId || "—"}`);

    setValue("tmFullName", fullName(t) || "—");
    setValue("tmGender", t.gender || "—");
    setValue("tmDob", t.dob || "—");
    setValue("tmAdvisory", advisoryLabel(t));

    setValue("tmPhone", t.phone || "—");
    setValue("tmEmail", t.email || "—");

    const addr = t.address || {};
    setValue("tmStreet", addr.street || "—");
    setValue("tmProvince", addr.provinceCode || "—");
    setValue("tmCity", addr.cityCode || "—");
    setValue("tmBrgy", addr.brgyCode || "—");
    setValue("tmPostal", addr.postal || "—");

    const creds = t.credentials || {};
    const prc = creds.hasPrc ? creds.prcLicense || "—" : "N/A";
    setValue("tmPrc", prc);
    setValue("tmMajor", creds.majorSpec || "—");
    setValue("tmEduc", creds.highestEduc || "—");
    setValue("tmHired", creds.dateHired || "—");

    setValue("tmAccId", t.teacherId || "—");
    setValue("tmAccPass", tempPassCache[id] || "—");

    document.querySelectorAll(".tmodal-tab").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tmodal-panel").forEach((p) => p.classList.add("hidden"));
    document.querySelector('.tmodal-tab[data-tab="basic"]')?.classList.add("active");
    document.querySelector('.tmodal-panel[data-panel="basic"]')?.classList.remove("hidden");

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
        document.querySelectorAll(".tmodal-tab").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");

        const tab = btn.dataset.tab;
        document.querySelectorAll(".tmodal-panel").forEach((p) => p.classList.add("hidden"));
        document.querySelector(`.tmodal-panel[data-panel="${tab}"]`)?.classList.remove("hidden");
      });
    });

    document.addEventListener("keydown", (e) => {
      const modal = $("teacherModal");
      const isOpen = modal && !modal.classList.contains("hidden");
      if (isOpen && e.key === "Escape") closeTeacherModal();
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
      if (prc.value.trim().toUpperCase() === "N/A") prc.value = "";
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
    $("hasPrcNo") && ($("hasPrcNo").checked = true);
    $("hasPrcYes") && ($("hasPrcYes").checked = false);
    setPrcState(false);
  }

  // ==============================
  // Photo upload / preview
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
        <div class="t-upload-ico">🖼️</div>
        <div class="t-upload-text">Drop your profile photo to upload</div>
        <button id="selectFilesBtn" class="t-ghost small" type="button">Select photo</button>
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

    preview.addEventListener("click", () => input.click());

    preview.addEventListener("dragover", (e) => {
      e.preventDefault();
      preview.style.borderColor = "#0b4d7a";
    });

    preview.addEventListener("dragleave", () => {
      preview.style.borderColor = "#d9e4f2";
    });

    preview.addEventListener("drop", (e) => {
      e.preventDefault();
      preview.style.borderColor = "#d9e4f2";
      const file = e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) handlePhotoFile(file);
    });

    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      if (file) handlePhotoFile(file);
    });

    removeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      input.value = "";
      setPhoto("");
    });

    bindSelectFilesButton(preview);
  }

  function handlePhotoFile(file) {
    if (!file.type.startsWith("image/")) {
      alert("Please upload an image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result);
    reader.readAsDataURL(file);
  }

  // ==============================
  // Form helpers
  // ==============================
  function getGenderValue() {
    const checked = document.querySelector('input[name="gender"]:checked');
    return checked ? checked.value : "male";
  }

  function clearForm() {
    $("firstName") && ($("firstName").value = "");
    $("middleName") && ($("middleName").value = "");
    $("lastName") && ($("lastName").value = "");
    $("dob") && ($("dob").value = "");

    const male = document.querySelector('input[name="gender"][value="male"]');
    if (male) male.checked = true;

    resetPrc();

    $("classSelect") && ($("classSelect").value = "");
    if ($("sectionSelect")) {
      $("sectionSelect").innerHTML = `<option value="">Select section</option>`;
    }

    $("phone") && ($("phone").value = "");
    $("email") && ($("email").value = "");
    $("street") && ($("street").value = "");

    $("provinceSelect") && ($("provinceSelect").value = "");
    if ($("citySelect")) {
      $("citySelect").innerHTML = `<option value="">Select city</option>`;
      $("citySelect").disabled = true;
    }
    if ($("brgySelect")) {
      $("brgySelect").innerHTML = `<option value="">Select barangay</option>`;
      $("brgySelect").disabled = true;
    }
    $("postal") && ($("postal").value = "");

    $("majorSpec") && ($("majorSpec").value = "");
    $("majorOther") && ($("majorOther").value = "");
    $("highestEduc") && ($("highestEduc").value = "");
    $("dateHired") && ($("dateHired").value = "");

    $("majorOtherWrap")?.classList.add("hidden");
    $("majorOther") && ($("majorOther").disabled = true);

    $("teacherId") && ($("teacherId").value = "");
    $("tempPass") && ($("tempPass").value = "");

    setPhoto("");
    clearError();
  }

  // ==============================
  // Backend: load teachers
  // ==============================
  async function loadTeachers() {
    const q = ($("searchInput")?.value || "").trim();
    const classFilter = $("classFilter")?.value || "all";

    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (classFilter) qs.set("class", classFilter);

    const data = await apiFetch(`/api/admin/teachers?${qs.toString()}`);

    teachers = (data?.teachers || []).map((t) => ({
      ...t,
      id: t.id || t._id || "",
    }));

    const set = new Set(classes);
    teachers.forEach((t) => {
      if (t.className) set.add(t.className);
    });
    classes = Array.from(set);

    renderClassFilter();
    renderTeachersTable();
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

    const className = $("classSelect")?.value || "";
    const sectionName = $("sectionSelect")?.value || "";

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
    if (!hasPrc) prcLicense = "N/A";

    const majorSpecSel = ($("majorSpec")?.value || "").trim();
    const majorOther = ($("majorOther")?.value || "").trim();
    const majorSpec =
      majorSpecSel.toLowerCase() === "other" ? majorOther : majorSpecSel;

    const highestEduc = ($("highestEduc")?.value || "").trim();
    const dateHired = $("dateHired")?.value || "";

    if (!firstName || !lastName) return setError("First and last name are required.");
    if (!dob) return setError("Date of birth is required.");
    if (!className || !sectionName) return setError("Class and section are required.");
    if (!email) return setError("Email is required.");
    if (!phoneStored) return setError("Phone must be exactly 10 digits.");
    if (postal && !/^\d{4}$/.test(postal)) return setError("Postal must be exactly 4 digits.");
    if (hasPrc && !prcLicense) return setError("PRC license number required.");
    if (!majorSpecSel) return setError("Major is required.");
    if (majorSpecSel.toLowerCase() === "other" && !majorOther) {
      return setError("Please specify the Major / Specialization.");
    }
    if (!highestEduc) return setError("Highest educational attainment required.");
    if (!dateHired) return setError("Date hired is required.");

    const payload = {
      firstName,
      middleName,
      lastName,
      dob,
      gender,
      className,
      sectionName,

      phone: phoneLocal,
      email,

      street,
      provinceCode,
      cityCode,
      brgyCode,
      postal,

      hasPrc,
      prcLicense,
      majorSpec,
      highestEduc,
      dateHired,

      photoDataUrl: currentPhotoDataUrl,
    };

    try {
      const btn = $("saveBtn");
      if (btn) btn.disabled = true;

      const data = await apiFetch("/api/admin/teachers", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const created = data.teacher;
      const tempPass = data.tempPass;

      if (created?.id && tempPass) tempPassCache[created.id] = tempPass;

      $("teacherId") && ($("teacherId").value = created?.teacherId || "");
      $("tempPass") && ($("tempPass").value = tempPass || "");

      alert(
        `✅ Teacher created!\n\nTeacher ID: ${created?.teacherId || ""}\nTemp Password: ${tempPass || ""}\n\n⚠️ Save this password now. It will not be shown again later.`
      );

      await loadTeachers();
      showListView();
      clearForm();
    } catch (err) {
      setError(err.message || "Failed to create teacher.");
    } finally {
      const btn = $("saveBtn");
      if (btn) btn.disabled = false;
    }
  }

  // ==============================
  // Events
  // ==============================
  function bindEvents() {
    $("classSelect")?.addEventListener("change", async (e) => {
      const grade = e.target.value;
      if (grade) {
        await loadSectionsByGrade(grade);
      } else if ($("sectionSelect")) {
        $("sectionSelect").innerHTML = `<option value="">Select section</option>`;
      }
    });

    $("addNewBtn")?.addEventListener("click", async () => {
      showFormView();
      clearForm();
      clearError();

      await loadClasses();
      await loadProvinces();
    });

    $("cancelBtn")?.addEventListener("click", () => {
      showListView();
      clearForm();
    });

    $("resetBtn")?.addEventListener("click", async () => {
      clearForm();
      await loadClasses();
      await loadProvinces();
    });

    $("saveBtn")?.addEventListener("click", saveTeacher);

    $("searchInput")?.addEventListener("input", renderTeachersTable);
    $("classFilter")?.addEventListener("change", renderTeachersTable);

    $("provinceSelect")?.addEventListener("change", onProvinceChange);
    $("citySelect")?.addEventListener("change", onCityChange);

    $("hasPrcYes")?.addEventListener("change", () => setPrcState(true));
    $("hasPrcNo")?.addEventListener("change", () => setPrcState(false));

    $("majorSpec")?.addEventListener("change", () => {
      const sel = ($("majorSpec")?.value || "").trim().toLowerCase();
      const wrap = $("majorOtherWrap");
      const input = $("majorOther");
      if (!wrap || !input) return;

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

    $("teachersTbody")?.addEventListener("click", (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;

      const id = btn.dataset.id;
      if (!id) return;

      if (btn.classList.contains("t-view")) {
        openTeacherModal(id);
      }
    });
  }

  // ==============================
  // Init
  // ==============================
  document.addEventListener("DOMContentLoaded", async () => {
    await fetchCsrf();

    bindEvents();
    bindTeacherModalEvents();
    bindPhotoUpload();

    bindPhoneFilter();
    bindPostalFilter();
    bindNameFilter("firstName");
    bindNameFilter("middleName");
    bindNameFilter("lastName");
    bindEmailFilter("email");
    bindPrcFilter();

    renderClassFilter();
    showListView();
    resetPrc();
    $("majorOther") && ($("majorOther").disabled = true);

    try {
      await loadClasses();
      await loadTeachers();
    } catch (e) {
      console.warn(e);
      setError(
        "Backend not reachable or route missing. Make sure server is running and /api/admin/teachers exists."
      );
    }
  });
})();