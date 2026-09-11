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

      if (
        typeof payload?.csrfToken === "string" &&
        payload.csrfToken.trim()
      ) {
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

    if (
      method !== "GET" &&
      method !== "HEAD" &&
      method !== "OPTIONS"
    ) {
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
        })
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

    const data = await fetchJSON(
      `${PSGC_BASE}/provinces`
    );

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

    provSel.innerHTML =
      `<option value="">Select province</option>`;

    if (citySel) {
      citySel.innerHTML =
        `<option value="">Select city</option>`;

      citySel.disabled = true;
    }

    if (brgySel) {
      brgySel.innerHTML =
        `<option value="">Select barangay</option>`;

      brgySel.disabled = true;
    }

    try {
      const provinces = await getProvinces();

      provinces.sort((a, b) =>
        (a.name || "").localeCompare(
          b.name || ""
        )
      );

      provinces.forEach((p) => {
        const opt =
          document.createElement("option");

        opt.value = String(p.code);
        opt.textContent = p.name;

        provSel.appendChild(opt);
      });
    } catch (e) {
      console.warn(
        "PSGC provinces error:",
        e
      );
    }
  }

  async function onProvinceChange() {
    const provSel = $("provinceSelect");
    const citySel = $("citySelect");
    const brgySel = $("brgySelect");

    if (
      !provSel ||
      !citySel ||
      !brgySel
    ) {
      return;
    }

    const provinceCode =
      provSel.value;

    citySel.innerHTML =
      `<option value="">Select city</option>`;

    citySel.disabled = true;

    brgySel.innerHTML =
      `<option value="">Select barangay</option>`;

    brgySel.disabled = true;

    if ($("postal")) {
      $("postal").value = "";
    }

    if (!provinceCode) return;

    try {
      const cities =
        await getCitiesByProvince(
          provinceCode
        );

      cities.sort((a, b) =>
        (a.name || "").localeCompare(
          b.name || ""
        )
      );

      cities.forEach((c) => {
        const opt =
          document.createElement("option");

        opt.value = String(c.code);
        opt.textContent = c.name;

        citySel.appendChild(opt);
      });

      citySel.disabled = false;
    } catch (e) {
      console.warn(
        "PSGC cities error:",
        e
      );
    }
  }

  async function onCityChange() {
    const citySel = $("citySelect");
    const brgySel = $("brgySelect");

    if (!citySel || !brgySel) return;

    const cityCode =
      citySel.value;

    brgySel.innerHTML =
      `<option value="">Select barangay</option>`;

    brgySel.disabled = true;

    if ($("postal")) {
      $("postal").value = "";
    }

    if (!cityCode) return;

    try {
      const brgys =
        await getBarangaysByCity(
          cityCode
        );

      brgys.sort((a, b) =>
        (a.name || "").localeCompare(
          b.name || ""
        )
      );

      brgys.forEach((b) => {
        const opt =
          document.createElement("option");

        opt.value = String(b.code);
        opt.textContent = b.name;

        brgySel.appendChild(opt);
      });

      brgySel.disabled = false;
    } catch (e) {
      console.warn(
        "PSGC barangays error:",
        e
      );
    }
  }

  // ==============================
  // Filtering helpers
  // ==============================

  function digitsOnly(s) {
    return String(s || "")
      .replace(/\D/g, "");
  }

  function filterNameValue(raw) {
    let s = String(raw || "");

    s = s.replace(
      /[^A-Za-z\s'\-]/g,
      ""
    );

    s = s.replace(/\s+/g, " ");

    s = s.trim();

    s = s.replace(/'{2,}/g, "'");

    s = s.replace(/\-{2,}/g, "-");

    return s;
  }

  function bindNameFilter(id) {
    const el = $(id);

    if (!el) return;

    el.addEventListener(
      "input",
      () => {
        const cleaned =
          filterNameValue(el.value);

        if (el.value !== cleaned) {
          el.value = cleaned;
        }
      }
    );

    el.addEventListener(
      "paste",
      () => {
        requestAnimationFrame(() => {
          el.value =
            filterNameValue(
              el.value
            );
        });
      }
    );
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

    el.addEventListener(
      "input",
      () => {
        const cleaned =
          filterEmailValue(
            el.value
          );

        if (el.value !== cleaned) {
          el.value = cleaned;
        }
      }
    );

    el.addEventListener(
      "paste",
      () => {
        requestAnimationFrame(() => {
          el.value =
            filterEmailValue(
              el.value
            );
        });
      }
    );
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

    el.setAttribute(
      "maxlength",
      "4"
    );

    el.addEventListener(
      "input",
      () => {
        const cleaned =
          toPostal4(el.value);

        if (el.value !== cleaned) {
          el.value = cleaned;
        }
      }
    );

    el.addEventListener(
      "paste",
      () => {
        requestAnimationFrame(() => {
          el.value =
            toPostal4(el.value);
        });
      }
    );
  }

  function bindPrcFilter() {
    const el = $("prcLicense");

    if (!el) return;

    el.addEventListener(
      "input",
      () => {
        if (el.disabled) return;

        const cleaned =
          digitsOnly(el.value);

        if (el.value !== cleaned) {
          el.value = cleaned;
        }
      }
    );

    el.addEventListener(
      "paste",
      () => {
        if (el.disabled) return;

        requestAnimationFrame(() => {
          el.value =
            digitsOnly(
              el.value
            );
        });
      }
    );
  }

  function toLocal10Digits(raw) {
    let d = digitsOnly(raw);

    if (d.startsWith("63")) {
      d = d.slice(2);
    }

    if (
      d.startsWith("0") &&
      d.length >= 11
    ) {
      d = d.slice(1);
    }

    if (d.length > 10) {
      d = d.slice(0, 10);
    }

    return d;
  }

  function toStoredPhone(local10) {
    const d =
      toLocal10Digits(local10);

    if (d.length !== 10) {
      return "";
    }

    return `+63${d}`;
  }

  function bindPhoneFilter() {
    const phoneEl = $("phone");

    if (!phoneEl) return;

    phoneEl.setAttribute(
      "maxlength",
      "10"
    );

    phoneEl.addEventListener(
      "input",
      () => {
        const cleaned =
          toLocal10Digits(
            phoneEl.value
          );

        if (
          phoneEl.value !==
          cleaned
        ) {
          phoneEl.value = cleaned;
        }
      }
    );

    phoneEl.addEventListener(
      "paste",
      () => {
        requestAnimationFrame(() => {
          phoneEl.value =
            toLocal10Digits(
              phoneEl.value
            );
        });
      }
    );
  }

  // ==============================
  // State
  // ==============================

  let teachers = [];
  let activeTeacherId = null;

  const tempPassCache = {};

  // ==============================
  // View toggling
  // ==============================

  function showListView() {
    $("listView")
      ?.classList.remove(
        "hidden"
      );

    $("formView")
      ?.classList.add(
        "hidden"
      );

    const addBtn =
      $("addNewBtn");

    if (addBtn) {
      addBtn.style.display = "";
    }
  }

  function showFormView() {
    $("listView")
      ?.classList.add(
        "hidden"
      );

    $("formView")
      ?.classList.remove(
        "hidden"
      );

    const addBtn =
      $("addNewBtn");

    if (addBtn) {
      addBtn.style.display =
        "none";
    }
  }

  // ==============================
  // UI helpers
  // ==============================

  function setError(msg) {
    const box =
      $("formError");

    if (!box) return;

    box.textContent = msg;

    box.classList.remove(
      "hidden"
    );
  }

  function clearError() {
    const box =
      $("formError");

    if (!box) return;

    box.classList.add(
      "hidden"
    );

    box.textContent = "";
  }

  function fullName(t) {
    return [
      t.firstName,
      t.middleName,
      t.lastName,
    ]
      .filter(Boolean)
      .join(" ");
  }

  function getTeacherGenderText(t) {
    if (t.gender) {
      return t.gender === "female"
        ? "Female"
        : "Male";
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
    const tbody =
      $("teachersTbody");

    if (!tbody) return;

    const q =
      ($("searchInput")?.value ||
        "")
        .toLowerCase()
        .trim();

    const filtered =
      teachers.filter((t) => {
        return (
          !q ||
          fullName(t)
            .toLowerCase()
            .includes(q) ||
          (t.teacherId || "")
            .toLowerCase()
            .includes(q)
        );
      });

    tbody.innerHTML = "";

    if (filtered.length === 0) {
      const tr =
        document.createElement(
          "tr"
        );

      tr.innerHTML = `
        <td
          colspan="6"
          style="
            padding:16px;
            color:#6b7b8a;
          "
        >
          No teachers yet.
        </td>
      `;

      tbody.appendChild(tr);

      return;
    }

    filtered.forEach((t, idx) => {
      const tr =
        document.createElement(
          "tr"
        );

      tr.innerHTML = `
        <td>
          ${String(idx + 1).padStart(2, "0")}
        </td>

        <td>
          <div style="font-weight:800">
            ${fullName(t)}
          </div>

          <div
            style="
              font-size:11px;
              color:#6b7b8a;
            "
          >
            ${t.teacherId || "—"}
          </div>
        </td>

        <td>
          ${t.email || "—"}
        </td>

        <td>
          *****
        </td>

        <td>
          ${t.phone || "—"}
        </td>

        <td>
          <div class="t-actions">

            <!-- EDIT -->
            <button
              class="t-icon-btn t-edit"
              data-id="${t.id}"
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
              data-id="${t.id}"
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
              data-id="${t.id}"
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
  // Modal
  // ==============================

  function setText(id, value) {
    const el = $(id);

    if (el) {
      el.textContent =
        value ?? "";
    }
  }

  function setValue(id, value) {
    const el = $(id);

    if (el) {
      el.value =
        value ?? "";
    }
  }

  async function openTeacherModal(id) {
    const modal =
      $("teacherModal");

    if (!modal) return;

    const t =
      teachers.find(
        (x) => x.id === id
      );

    if (!t) return;

    activeTeacherId = id;

    const avatar =
      $("tmAvatar");

    if (avatar) {
      avatar.src =
        "../../assets/images/bg.jpg";
    }

    const addr =
      getTeacherAddress(t);

    const creds =
      getTeacherCredentials(t);

    setText(
      "teacherModalTitle",
      "Teacher Profile"
    );

    setText(
      "tmTeacherId",
      `Teacher ID: ${
        t.teacherId || "—"
      }`
    );

    setValue(
      "tmFullName",
      fullName(t) || "—"
    );

    setValue(
      "tmGender",
      getTeacherGenderText(t)
    );

    setValue(
      "tmDob",
      t.dob || "—"
    );

    setValue(
      "tmPhone",
      t.phone || "—"
    );

    setValue(
      "tmEmail",
      t.email || "—"
    );

    setValue(
      "tmStreet",
      addr.street || "—"
    );

    setValue(
      "tmProvince",
      addr.provinceCode || "—"
    );

    setValue(
      "tmCity",
      addr.cityCode || "—"
    );

    setValue(
      "tmBrgy",
      addr.brgyCode ||
        addr.barangayCode ||
        "—"
    );

    setValue(
      "tmPostal",
      addr.postal ||
        addr.postalCode ||
        "—"
    );

    setValue(
      "tmPrc",
      creds.prcLicense ||
        "N/A"
    );

    setValue(
      "tmMajor",
      creds.majorSpec ||
        "—"
    );

    setValue(
      "tmEduc",
      creds.highestEduc ||
        "—"
    );

    setValue(
      "tmHired",
      creds.dateHired ||
        "—"
    );

    setValue(
      "tmAccId",
      t.teacherId || "—"
    );

    setValue(
      "tmAccPass",
      tempPassCache[id] ||
        "—"
    );

    document
      .querySelectorAll(
        ".tmodal-tab"
      )
      .forEach((b) =>
        b.classList.remove(
          "active"
        )
      );

    document
      .querySelectorAll(
        ".tmodal-panel"
      )
      .forEach((p) =>
        p.classList.add(
          "hidden"
        )
      );

    document
      .querySelector(
        '.tmodal-tab[data-tab="basic"]'
      )
      ?.classList.add(
        "active"
      );

    document
      .querySelector(
        '.tmodal-panel[data-panel="basic"]'
      )
      ?.classList.remove(
        "hidden"
      );

    modal.classList.remove(
      "hidden"
    );

    modal.setAttribute(
      "aria-hidden",
      "false"
    );
  }

  function closeTeacherModal() {
    const modal =
      $("teacherModal");

    if (!modal) return;

    modal.classList.add(
      "hidden"
    );

    modal.setAttribute(
      "aria-hidden",
      "true"
    );

    activeTeacherId = null;
  }

  function bindTeacherModalEvents() {
    $("teacherModalBackdrop")
      ?.addEventListener(
        "click",
        closeTeacherModal
      );

    $("teacherModalCloseX")
      ?.addEventListener(
        "click",
        closeTeacherModal
      );

    $("teacherModalCloseBtn")
      ?.addEventListener(
        "click",
        closeTeacherModal
      );

    document
      .querySelectorAll(
        ".tmodal-tab"
      )
      .forEach((btn) => {
        btn.addEventListener(
          "click",
          () => {
            document
              .querySelectorAll(
                ".tmodal-tab"
              )
              .forEach((b) =>
                b.classList.remove(
                  "active"
                )
              );

            btn.classList.add(
              "active"
            );

            const tab =
              btn.dataset.tab;

            document
              .querySelectorAll(
                ".tmodal-panel"
              )
              .forEach((p) =>
                p.classList.add(
                  "hidden"
                )
              );

            document
              .querySelector(
                `.tmodal-panel[data-panel="${tab}"]`
              )
              ?.classList.remove(
                "hidden"
              );
          }
        );
      });

    document.addEventListener(
      "keydown",
      (e) => {
        const modal =
          $("teacherModal");

        const isOpen =
          modal &&
          !modal.classList.contains(
            "hidden"
          );

        if (
          isOpen &&
          e.key === "Escape"
        ) {
          closeTeacherModal();
        }
      }
    );
  }

  // ==============================
  // PRC logic
  // ==============================

  function setPrcState(hasPrc) {
    const prc =
      $("prcLicense");

    if (!prc) return;

    if (hasPrc) {
      prc.disabled = false;

      if (
        prc.value
          .trim()
          .toUpperCase() ===
        "N/A"
      ) {
        prc.value = "";
      }

      prc.placeholder =
        "Enter PRC License No.";
    } else {
      prc.disabled = true;

      prc.value = "N/A";

      prc.placeholder = "";
    }
  }

  function getHasPrcValue() {
    return !!$(
      "hasPrcYes"
    )?.checked;
  }

  function resetPrc() {
    if ($("hasPrcNo")) {
      $("hasPrcNo").checked =
        true;
    }

    if ($("hasPrcYes")) {
      $("hasPrcYes").checked =
        false;
    }

    setPrcState(false);
  }

  // ==============================
  // Form helpers
  // ==============================

  function getGenderValue() {
    const checked =
      document.querySelector(
        'input[name="gender"]:checked'
      );

    return checked
      ? checked.value
      : "male";
  }

  function clearForm() {
    if ($("firstName")) {
      $("firstName").value =
        "";
    }

    if ($("middleName")) {
      $("middleName").value =
        "";
    }

    if ($("lastName")) {
      $("lastName").value =
        "";
    }

    if ($("dob")) {
      $("dob").value = "";
    }

    const male =
      document.querySelector(
        'input[name="gender"][value="male"]'
      );

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
      $("provinceSelect").value =
        "";
    }

    if ($("citySelect")) {
      $("citySelect").innerHTML =
        `<option value="">Select city</option>`;

      $("citySelect").disabled =
        true;
    }

    if ($("brgySelect")) {
      $("brgySelect").innerHTML =
        `<option value="">Select barangay</option>`;

      $("brgySelect").disabled =
        true;
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
      $("highestEduc").value =
        "";
    }

    if ($("dateHired")) {
      $("dateHired").value = "";
    }

    $("majorOtherWrap")
      ?.classList.add(
        "hidden"
      );

    if ($("majorOther")) {
      $("majorOther").disabled =
        true;
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
    const q =
      ($("searchInput")?.value ||
        "")
        .trim();

    const qs =
      new URLSearchParams();

    if (q) {
      qs.set("q", q);
    }

    const data =
      await apiFetch(
        `/api/admin/teachers?${qs.toString()}`
      );

    teachers =
      (data?.teachers || [])
        .map((t) => ({
          ...t,
          id:
            t.id ||
            t._id ||
            "",
        }));

    renderTeachersTable();
  }

  // ==============================
  // Save teacher
  // ==============================

  async function saveTeacher() {
    clearError();

    const firstName =
      ($("firstName")?.value ||
        "")
        .trim();

    const middleName =
      ($("middleName")?.value ||
        "")
        .trim();

    const lastName =
      ($("lastName")?.value ||
        "")
        .trim();

    const dob =
      $("dob")?.value || "";

    const gender =
      getGenderValue();

    const phoneLocal =
      ($("phone")?.value ||
        "")
        .trim();

    const phoneStored =
      toStoredPhone(
        phoneLocal
      );

    const email =
      ($("email")?.value ||
        "")
        .trim()
        .toLowerCase();

    const street =
      ($("street")?.value ||
        "")
        .trim();

    const provinceCode =
      $("provinceSelect")
        ?.value || "";

    const cityCode =
      $("citySelect")
        ?.value || "";

    const brgyCode =
      $("brgySelect")
        ?.value || "";

    const postal =
      ($("postal")?.value ||
        "")
        .trim();

    const hasPrc =
      getHasPrcValue();

    let prcLicense =
      ($("prcLicense")
        ?.value || "")
        .trim();

    if (!hasPrc) {
      prcLicense = "N/A";
    }

    const majorSpecSel =
      ($("majorSpec")
        ?.value || "")
        .trim();

    const majorOther =
      ($("majorOther")
        ?.value || "")
        .trim();

    const majorSpec =
      majorSpecSel
        .toLowerCase() ===
      "other"
        ? majorOther
        : majorSpecSel;

    const highestEduc =
      ($("highestEduc")
        ?.value || "")
        .trim();

    const dateHired =
      $("dateHired")
        ?.value || "";

    if (!firstName || !lastName) {
      return setError(
        "First and last name are required."
      );
    }

    if (!dob) {
      return setError(
        "Date of birth is required."
      );
    }

    if (!email) {
      return setError(
        "Email is required."
      );
    }

    if (!phoneStored) {
      return setError(
        "Phone must be exactly 10 digits."
      );
    }

    if (
      postal &&
      !/^\d{4}$/.test(
        postal
      )
    ) {
      return setError(
        "Postal must be exactly 4 digits."
      );
    }

    if (
      hasPrc &&
      !prcLicense
    ) {
      return setError(
        "PRC license number required."
      );
    }

    if (!majorSpecSel) {
      return setError(
        "Major is required."
      );
    }

    if (
      majorSpecSel
        .toLowerCase() ===
        "other" &&
      !majorOther
    ) {
      return setError(
        "Please specify the Major / Specialization."
      );
    }

    if (!highestEduc) {
      return setError(
        "Highest educational attainment required."
      );
    }

    if (!dateHired) {
      return setError(
        "Date hired is required."
      );
    }

    const payload = {
      firstName,
      middleName,
      lastName,
      dob,

      gender,

      sex:
        gender === "male"
          ? "Male"
          : "Female",

      phone:
        phoneStored,

      email,

      street,

      provinceCode,

      cityCode,

      barangayCode:
        brgyCode,

      postalCode:
        postal,

      hasPrc,

      prcLicenseNo:
        hasPrc
          ? prcLicense
          : "N/A",

      majorSpec,

      highestEduc,

      dateHired,

      position:
        "Teacher",
    };

    console.log(
      "Teacher payload:",
      payload
    );

    try {
      const btn =
        $("saveBtn");

      if (btn) {
        btn.disabled = true;
      }

      const data =
        await apiFetch(
          "/api/admin/teachers",
          {
            method: "POST",

            body:
              JSON.stringify(
                payload
              ),
          }
        );

      const created =
        data?.teacher ||
        null;

      const tempPass =
        data?.tempPass ||
        "";

      if (
        created?.id &&
        tempPass
      ) {
        tempPassCache[
          created.id
        ] = tempPass;
      }

      if (
        created?._id &&
        tempPass
      ) {
        tempPassCache[
          created._id
        ] = tempPass;
      }

      if ($("teacherId")) {
        $("teacherId").value =
          created?.teacherId ||
          "";
      }

      if ($("tempPass")) {
        $("tempPass").value =
          tempPass || "";
      }

      alert(
        `✅ Teacher created!\n\n` +
        `Teacher ID: ${
          created?.teacherId ||
          ""
        }\n` +
        `Temp Password: ${
          tempPass || ""
        }\n\n` +
        `⚠️ Save this password now. ` +
        `It will not be shown again later.`
      );

      await loadTeachers();

      showListView();

      clearForm();
    } catch (err) {
      console.error(
        "Create teacher failed:",
        err
      );

      setError(
        err.message ||
        "Failed to create teacher."
      );
    } finally {
      const btn =
        $("saveBtn");

      if (btn) {
        btn.disabled =
          false;
      }
    }
  }

  // ==============================
  // Events
  // ==============================

  function bindEvents() {
    $("addNewBtn")
      ?.addEventListener(
        "click",
        async () => {
          showFormView();

          clearForm();

          clearError();

          await loadProvinces();
        }
      );

    $("cancelBtn")
      ?.addEventListener(
        "click",
        () => {
          showListView();

          clearForm();
        }
      );

    $("resetBtn")
      ?.addEventListener(
        "click",
        async () => {
          clearForm();

          await loadProvinces();
        }
      );

    $("saveBtn")
      ?.addEventListener(
        "click",
        saveTeacher
      );

    $("searchInput")
      ?.addEventListener(
        "input",
        renderTeachersTable
      );

    $("provinceSelect")
      ?.addEventListener(
        "change",
        onProvinceChange
      );

    $("citySelect")
      ?.addEventListener(
        "change",
        onCityChange
      );

    $("hasPrcYes")
      ?.addEventListener(
        "change",
        () =>
          setPrcState(true)
      );

    $("hasPrcNo")
      ?.addEventListener(
        "change",
        () =>
          setPrcState(false)
      );

    $("majorSpec")
      ?.addEventListener(
        "change",
        () => {
          const sel =
            ($("majorSpec")
              ?.value || "")
              .trim()
              .toLowerCase();

          const wrap =
            $("majorOtherWrap");

          const input =
            $("majorOther");

          if (!wrap || !input) {
            return;
          }

          if (sel === "other") {
            wrap.classList.remove(
              "hidden"
            );

            input.disabled =
              false;

            input.focus();
          } else {
            wrap.classList.add(
              "hidden"
            );

            input.value = "";

            input.disabled =
              true;
          }
        }
      );

    $("teachersTbody")
      ?.addEventListener(
        "click",
        (e) => {
          const btn =
            e.target.closest(
              "button"
            );

          if (!btn) return;

          const id =
            btn.dataset.id;

          if (!id) return;

          // ==========================
          // VIEW
          // ==========================
          if (
            btn.classList.contains(
              "t-view"
            )
          ) {
            openTeacherModal(id);
          }

          // ==========================
          // EDIT
          // ==========================
          // Button is currently present
          // for consistent UI. Backend
          // update functionality can be
          // connected separately.
          if (
            btn.classList.contains(
              "t-edit"
            )
          ) {
            console.log(
              "Edit teacher:",
              id
            );
          }

          // ==========================
          // DELETE
          // ==========================
          // Button is currently present
          // for consistent UI. Backend
          // delete functionality can be
          // connected separately.
          if (
            btn.classList.contains(
              "t-del"
            )
          ) {
            console.log(
              "Delete teacher:",
              id
            );
          }
        }
      );
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

    bindNameFilter(
      "firstName"
    );

    bindNameFilter(
      "middleName"
    );

    bindNameFilter(
      "lastName"
    );

    bindEmailFilter(
      "email"
    );

    bindPrcFilter();

    showListView();

    resetPrc();

    if ($("majorOther")) {
      $("majorOther").disabled =
        true;
    }

    try {
      await loadTeachers();
    } catch (e) {
      console.warn(e);

      setError(
        e.message ||
        "Failed to load teachers."
      );
    }
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      init,
      {
        once: true,
      }
    );
  } else {
    init();
  }
})();