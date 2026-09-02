// =====================================================
// ADMIN STUDENTS PAGE
// Backend-connected
//
// Endpoints:
//   GET    /api/admin/students?q=&class=all
//   POST   /api/admin/students
//   PUT    /api/admin/students/:studentId
//   DELETE /api/admin/students/:studentId
//   PATCH  /api/admin/students/:studentId/disable
//   POST   /api/admin/students/:studentId/reset-password
//
// Uses:
//   - Session cookies
//   - CSRF token
//   - PSGC API for Province / City / Barangay
//   - +63 phone format
// =====================================================

(function () {
  if (window.__adminStudentsInit) return;
  window.__adminStudentsInit = true;

  // =====================================================
  // DOM HELPER
  // =====================================================

  const $ = (id) => document.getElementById(id);

  // =====================================================
  // CSRF
  // =====================================================

  const CSRF_ENDPOINT = "/api/csrf-token";
  let csrfToken = "";

  async function fetchCsrf() {
    try {
      const res = await fetch(CSRF_ENDPOINT, {
        credentials: "include",
      });

      const contentType =
        res.headers.get("content-type") || "";

      if (
        !res.ok ||
        !contentType.includes("application/json")
      ) {
        return;
      }

      const data = await res.json();

      if (
        data?.ok &&
        typeof data.csrfToken === "string"
      ) {
        csrfToken = data.csrfToken;
      }
    } catch (err) {
      console.warn(
        "CSRF token could not be loaded:",
        err
      );
    }
  }

  // =====================================================
  // API HELPER
  // =====================================================

  async function apiFetch(url, options = {}) {
    const method = String(
      options.method || "GET"
    ).toUpperCase();

    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };

    if (
      method !== "GET" &&
      method !== "HEAD" &&
      method !== "OPTIONS"
    ) {
      if (csrfToken) {
        headers["X-CSRF-Token"] = csrfToken;
      }
    }

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
    });

    let data = null;

    try {
      data = await response.json();
    } catch {
      // Response may have no JSON body
    }

    if (!response.ok) {
      const message =
        data?.message ||
        data?.error ||
        `Request failed (${response.status})`;

      throw new Error(message);
    }

    return data;
  }

  // =====================================================
  // PSGC
  // =====================================================

  const PSGC_BASE =
    "https://psgc.cloud/api";

  const PSGC_CACHE_TTL_MS =
    7 * 24 * 60 * 60 * 1000;

  function cacheKey(key) {
    return `psgc_${key}_v1`;
  }

  function cacheGet(key) {
    try {
      const raw =
        localStorage.getItem(
          cacheKey(key)
        );

      if (!raw) return null;

      const parsed = JSON.parse(raw);

      if (
        !parsed?.data ||
        !parsed?.expiresAt
      ) {
        return null;
      }

      if (Date.now() > parsed.expiresAt) {
        return null;
      }

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
          expiresAt:
            Date.now() +
            PSGC_CACHE_TTL_MS,
        })
      );
    } catch {
      // Ignore localStorage errors
    }
  }

  async function fetchJSON(url) {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `Request failed: ${response.status}`
      );
    }

    return response.json();
  }

  async function getProvinces() {
    const cached =
      cacheGet("provinces");

    if (cached) return cached;

    const data =
      await fetchJSON(
        `${PSGC_BASE}/provinces`
      );

    cacheSet("provinces", data);

    return data;
  }

  async function getCitiesByProvince(
    provinceCode
  ) {
    const key =
      `cities_${provinceCode}`;

    const cached = cacheGet(key);

    if (cached) return cached;

    const data =
      await fetchJSON(
        `${PSGC_BASE}/provinces/${provinceCode}/cities-municipalities`
      );

    cacheSet(key, data);

    return data;
  }

  async function getBarangaysByCity(
    cityCode
  ) {
    const key =
      `brgys_${cityCode}`;

    const cached = cacheGet(key);

    if (cached) return cached;

    const data =
      await fetchJSON(
        `${PSGC_BASE}/cities-municipalities/${cityCode}/barangays`
      );

    cacheSet(key, data);

    return data;
  }

  // =====================================================
  // INPUT FILTERS
  // =====================================================

  function digitsOnly(value) {
    return String(value || "")
      .replace(/\D/g, "");
  }

  function filterNameValue(value) {
    let result =
      String(value || "");

    result = result.replace(
      /[^A-Za-z\s'-]/g,
      ""
    );

    result = result.replace(
      /\s+/g,
      " "
    );

    result = result.trim();

    result = result.replace(
      /'{2,}/g,
      "'"
    );

    result = result.replace(
      /-{2,}/g,
      "-"
    );

    return result;
  }

  function bindNameFilter(id) {
    const element = $(id);

    if (!element) return;

    element.addEventListener(
      "input",
      () => {
        const cleaned =
          filterNameValue(
            element.value
          );

        if (
          element.value !== cleaned
        ) {
          element.value = cleaned;
        }
      }
    );

    element.addEventListener(
      "paste",
      () => {
        requestAnimationFrame(() => {
          element.value =
            filterNameValue(
              element.value
            );
        });
      }
    );
  }

  function filterEmailValue(value) {
    let result =
      String(value || "");

    result = result.replace(
      /\s+/g,
      ""
    );

    result = result.toLowerCase();

    return result;
  }

  function bindEmailFilter(id) {
    const element = $(id);

    if (!element) return;

    element.addEventListener(
      "input",
      () => {
        const cleaned =
          filterEmailValue(
            element.value
          );

        if (
          element.value !== cleaned
        ) {
          element.value = cleaned;
        }
      }
    );

    element.addEventListener(
      "paste",
      () => {
        requestAnimationFrame(() => {
          element.value =
            filterEmailValue(
              element.value
            );
        });
      }
    );
  }

  // =====================================================
  // PHONE
  // =====================================================

  function toLocal10Digits(value) {
    let digits =
      digitsOnly(value);

    if (digits.startsWith("63")) {
      digits = digits.slice(2);
    }

    if (
      digits.startsWith("0") &&
      digits.length >= 11
    ) {
      digits = digits.slice(1);
    }

    return digits.slice(0, 10);
  }

  function toStoredPhone(value) {
    const digits =
      toLocal10Digits(value);

    if (digits.length !== 10) {
      return "";
    }

    return `+63${digits}`;
  }

  function bindPhoneFilter(id) {
    const element = $(id);

    if (!element) return;

    element.setAttribute(
      "maxlength",
      "10"
    );

    element.addEventListener(
      "input",
      () => {
        const cleaned =
          toLocal10Digits(
            element.value
          );

        if (
          element.value !== cleaned
        ) {
          element.value = cleaned;
        }
      }
    );

    element.addEventListener(
      "paste",
      () => {
        requestAnimationFrame(() => {
          element.value =
            toLocal10Digits(
              element.value
            );
        });
      }
    );
  }

  // =====================================================
  // POSTAL CODE
  // =====================================================

  function bindPostalFilter() {
    const element = $("postal");

    if (!element) return;

    element.setAttribute(
      "maxlength",
      "4"
    );

    element.addEventListener(
      "input",
      () => {
        const cleaned =
          digitsOnly(
            element.value
          ).slice(0, 4);

        if (
          element.value !== cleaned
        ) {
          element.value = cleaned;
        }
      }
    );

    element.addEventListener(
      "paste",
      () => {
        requestAnimationFrame(() => {
          element.value =
            digitsOnly(
              element.value
            ).slice(0, 4);
        });
      }
    );
  }

  // =====================================================
  // LRN
  // =====================================================

  function bindLRNFilter() {
    const element = $("lrn");

    if (!element) return;

    element.setAttribute(
      "maxlength",
      "12"
    );

    element.addEventListener(
      "input",
      () => {
        const cleaned =
          digitsOnly(
            element.value
          ).slice(0, 12);

        if (
          element.value !== cleaned
        ) {
          element.value = cleaned;
        }
      }
    );

    element.addEventListener(
      "paste",
      () => {
        requestAnimationFrame(() => {
          element.value =
            digitsOnly(
              element.value
            ).slice(0, 12);
        });
      }
    );
  }

  // =====================================================
  // STATE
  // =====================================================

  let students = [];
  let classes = [];

  let activeStudentId = null;

  let editingStudentId = null;
  let editingStudentSnapshot = null;

  // Temporary passwords are only kept
  // during this page session.
  const tempPassCache = {};

  // =====================================================
  // CLASSES / SECTIONS
  // =====================================================

  async function loadClasses() {
    try {
      const response =
        await apiFetch(
          "/api/admin/sections/summary"
        );

      const grades =
        response?.data || {};

      classes =
        Object.keys(grades);
    } catch (error) {
      console.error(
        "Failed to load grade levels:",
        error
      );
    }
  }

  // =====================================================
  // VIEW TOGGLE
  // =====================================================

  function showListView() {
    $("listView")
      ?.classList.remove("hidden");

    $("formView")
      ?.classList.add("hidden");

    const addButton =
      $("addNewBtn");

    if (addButton) {
      addButton.style.display = "";
    }
  }

  function showFormView() {
    $("listView")
      ?.classList.add("hidden");

    $("formView")
      ?.classList.remove("hidden");

    const addButton =
      $("addNewBtn");

    if (addButton) {
      addButton.style.display = "none";
    }
  }

  // =====================================================
  // ERROR MESSAGE
  // =====================================================

  function setError(message) {
    const box =
      $("formError");

    if (!box) return;

    box.textContent =
      message;

    box.classList.remove(
      "hidden"
    );
  }

  function clearError() {
    const box =
      $("formError");

    if (!box) return;

    box.textContent = "";

    box.classList.add(
      "hidden"
    );
  }

  // =====================================================
  // HELPERS
  // =====================================================

  function classSectionLabel(student) {
    const className =
      student.className || "";

    const sectionName =
      student.sectionName || "";

    const result = [
      className,
      sectionName,
    ]
      .filter(Boolean)
      .join(" - ");

    return result || "—";
  }

  function fullName(student) {
    return [
      student.firstName,
      student.middleName,
      student.lastName,
      student.suffix,
    ]
      .filter(Boolean)
      .join(" ");
  }

  function cloneDeep(object) {
    return object
      ? JSON.parse(
          JSON.stringify(object)
        )
      : object;
  }

  function getGenderValue() {
    const checked =
      document.querySelector(
        'input[name="gender"]:checked'
      );

    return checked
      ? checked.value
      : "male";
  }

  // =====================================================
  // CLASS FILTER
  // =====================================================

  function renderClassFilter() {
    const filter =
      $("classFilter");

    if (!filter) return;

    const current =
      filter.value || "all";

    filter.innerHTML = `
      <option value="all">
        All Classes
      </option>
    `;

    classes
      .slice()
      .sort((a, b) =>
        String(a).localeCompare(
          String(b)
        )
      )
      .forEach((className) => {
        const option =
          document.createElement(
            "option"
          );

        option.value =
          className;

        option.textContent =
          className;

        filter.appendChild(
          option
        );
      });

    filter.value =
      classes.includes(current)
        ? current
        : "all";
  }

  // =====================================================
  // STUDENT TABLE
  // =====================================================

  function renderStudentsTable() {
    const tbody =
      $("studentsTbody");

    if (!tbody) return;

    const search =
      (
        $("searchInput")
          ?.value || ""
      )
        .toLowerCase()
        .trim();

    const classFilter =
      $("classFilter")
        ?.value || "all";

    const filtered =
      students.filter(
        (student) => {
          const name =
            fullName(
              student
            ).toLowerCase();

          const studentId =
            String(
              student.studentId ||
                ""
            ).toLowerCase();

          const lrn =
            String(
              student.lrn || ""
            ).toLowerCase();

          const matchesSearch =
            !search ||
            name.includes(search) ||
            studentId.includes(search) ||
            lrn.includes(search);

          const matchesClass =
            classFilter === "all" ||
            student.className ===
              classFilter;

          return (
            matchesSearch &&
            matchesClass
          );
        }
      );

    tbody.innerHTML = "";

    if (filtered.length === 0) {
      const row =
        document.createElement(
          "tr"
        );

      row.className =
        "t-empty";

      row.innerHTML = `
        <td colspan="8">
          No students yet.
        </td>
      `;

      tbody.appendChild(row);

      return;
    }

    filtered.forEach(
      (student, index) => {
        const row =
          document.createElement(
            "tr"
          );

        row.innerHTML = `
          <td>
            ${String(
              index + 1
            ).padStart(2, "0")}
          </td>

          <td>
            <div style="font-weight:800;">
              ${escapeHtml(
                fullName(student)
              )}
            </div>
          </td>

          <td>
            ${escapeHtml(
              student.studentId ||
                "—"
            )}
          </td>

          <td>
            ${escapeHtml(
              student.lrn ||
                "—"
            )}
          </td>

          <td>
            ${escapeHtml(
              student.email ||
                "—"
            )}
          </td>

          <td>
            ${escapeHtml(
              classSectionLabel(
                student
              )
            )}
          </td>

          <td>
            ${escapeHtml(
              student.phone ||
                "—"
            )}
          </td>

          <td>
            <div class="t-actions">

              <button
                class="t-icon-btn t-edit"
                data-id="${student.id}"
                title="Edit"
                type="button"
              >
                <img
                  src="../../assets/icons/edit.svg"
                  alt="Edit"
                />
              </button>

              <button
                class="t-icon-btn t-view"
                data-id="${student.id}"
                title="View"
                type="button"
              >
                <img
                  src="../../assets/icons/view.svg"
                  alt="View"
                />
              </button>

              <button
                class="t-icon-btn t-del"
                data-id="${student.id}"
                title="Delete"
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

        tbody.appendChild(row);
      }
    );
  }

  // =====================================================
  // BASIC HTML ESCAPE
  // =====================================================

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(
        /"/g,
        "&quot;"
      )
      .replace(
        /'/g,
        "&#039;"
      );
  }

  // =====================================================
  // MODAL HELPERS
  // =====================================================

  function setText(id, value) {
    const element = $(id);

    if (element) {
      element.textContent =
        value ?? "";
    }
  }

  function setValue(id, value) {
    const element = $(id);

    if (element) {
      element.value =
        value ?? "";
    }
  }

  // =====================================================
  // PSGC NAME RESOLUTION
  // =====================================================

  async function resolveProvinceName(
    provinceCode
  ) {
    if (!provinceCode) {
      return "—";
    }

    try {
      const provinces =
        await getProvinces();

      const province =
        provinces.find(
          (item) =>
            String(item.code) ===
            String(provinceCode)
        );

      return (
        province?.name ||
        provinceCode
      );
    } catch {
      return provinceCode;
    }
  }

  async function resolveCityName(
    provinceCode,
    cityCode
  ) {
    if (
      !provinceCode ||
      !cityCode
    ) {
      return "—";
    }

    try {
      const cities =
        await getCitiesByProvince(
          provinceCode
        );

      const city =
        cities.find(
          (item) =>
            String(item.code) ===
            String(cityCode)
        );

      return (
        city?.name ||
        cityCode
      );
    } catch {
      return cityCode;
    }
  }

  async function resolveBarangayName(
    cityCode,
    brgyCode
  ) {
    if (
      !cityCode ||
      !brgyCode
    ) {
      return "—";
    }

    try {
      const barangays =
        await getBarangaysByCity(
          cityCode
        );

      const barangay =
        barangays.find(
          (item) =>
            String(item.code) ===
            String(brgyCode)
        );

      return (
        barangay?.name ||
        brgyCode
      );
    } catch {
      return brgyCode;
    }
  }

  // =====================================================
  // OPEN STUDENT MODAL
  // =====================================================

  async function openStudentModal(id) {
    const modal =
      $("studentModal");

    if (!modal) return;

    const student =
      students.find(
        (item) =>
          String(item.id) ===
          String(id)
      );

    if (!student) return;

    activeStudentId = id;

    setText(
      "studentModalTitle",
      "Student Profile"
    );

    setText(
      "smStudentId",
      `Student ID: ${
        student.studentId || "—"
      }`
    );

    setValue(
      "smFullName",
      fullName(student) || "—"
    );

    setValue(
      "smStudentIdBasic",
      student.studentId || "—"
    );

    setValue(
      "smLRN",
      student.lrn || "—"
    );

    setValue(
      "smGender",
      student.gender || "—"
    );

    setValue(
      "smDob",
      student.dob || "—"
    );

    setValue(
      "smPhone",
      student.phone || "—"
    );

    setValue(
      "smEmail",
      student.email || "—"
    );

    const address =
      student.address || {};

    setValue(
      "smStreet",
      address.street || "—"
    );

    setValue(
      "smProvince",
      "Loading..."
    );

    setValue(
      "smCity",
      "Loading..."
    );

    setValue(
      "smBrgy",
      "Loading..."
    );

    setValue(
      "smPostal",
      address.postal || "—"
    );

    const [
      provinceName,
      cityName,
      barangayName,
    ] = await Promise.all([
      resolveProvinceName(
        address.provinceCode
      ),
      resolveCityName(
        address.provinceCode,
        address.cityCode
      ),
      resolveBarangayName(
        address.cityCode,
        address.brgyCode
      ),
    ]);

    setValue(
      "smProvince",
      provinceName || "—"
    );

    setValue(
      "smCity",
      cityName || "—"
    );

    setValue(
      "smBrgy",
      barangayName || "—"
    );

    setValue(
      "smAccId",
      student.studentId || "—"
    );

    const status =
      student.accountStatus ||
      student.status ||
      "Active";

    setValue(
      "smAccountStatus",
      status
    );

    document
      .querySelectorAll(
        ".tmodal-tab"
      )
      .forEach((button) => {
        button.classList.remove(
          "active"
        );
      });

    document
      .querySelectorAll(
        ".tmodal-panel"
      )
      .forEach((panel) => {
        panel.classList.add(
          "hidden"
        );
      });

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

  // =====================================================
  // CLOSE STUDENT MODAL
  // =====================================================

  function closeStudentModal() {
    const modal =
      $("studentModal");

    if (!modal) return;

    modal.classList.add(
      "hidden"
    );

    modal.setAttribute(
      "aria-hidden",
      "true"
    );

    activeStudentId = null;
  }

  // =====================================================
  // MODAL EVENTS
  // =====================================================

  function bindStudentModalEvents() {
    $("studentModalBackdrop")
      ?.addEventListener(
        "click",
        closeStudentModal
      );

    $("studentModalCloseX")
      ?.addEventListener(
        "click",
        closeStudentModal
      );

    $("studentModalCloseBtn")
      ?.addEventListener(
        "click",
        closeStudentModal
      );

    document
      .querySelectorAll(
        ".tmodal-tab"
      )
      .forEach((button) => {
        button.addEventListener(
          "click",
          () => {
            document
              .querySelectorAll(
                ".tmodal-tab"
              )
              .forEach((item) => {
                item.classList.remove(
                  "active"
                );
              });

            button.classList.add(
              "active"
            );

            const tab =
              button.dataset.tab;

            document
              .querySelectorAll(
                ".tmodal-panel"
              )
              .forEach((panel) => {
                panel.classList.add(
                  "hidden"
                );
              });

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

    $("studentModalEditBtn")
      ?.addEventListener(
        "click",
        () => {
          const id =
            activeStudentId;

          closeStudentModal();

          if (id) {
            startEditStudent(id);
          }
        }
      );

    $("studentModalDisableBtn")
      ?.addEventListener(
        "click",
        async () => {
          if (!activeStudentId) {
            return;
          }

          const student =
            students.find(
              (item) =>
                String(item.id) ===
                String(
                  activeStudentId
                )
            );

          if (!student) return;

          const confirmed =
            confirm(
              `Disable the account of "${fullName(
                student
              )}"?`
            );

          if (!confirmed) return;

          try {
            await apiFetch(
              `/api/admin/students/${activeStudentId}/disable`,
              {
                method: "PATCH",
              }
            );

            closeStudentModal();

            await loadStudents();

            alert(
              "Student account disabled successfully."
            );
          } catch (error) {
            alert(
              error.message ||
                "Failed to disable account."
            );
          }
        }
      );

    document.addEventListener(
      "keydown",
      (event) => {
        const modal =
          $("studentModal");

        const isOpen =
          modal &&
          !modal.classList.contains(
            "hidden"
          );

        if (
          isOpen &&
          event.key === "Escape"
        ) {
          closeStudentModal();
        }
      }
    );
  }

  // =====================================================
  // ADDRESS DROPDOWNS
  // =====================================================

  async function loadProvinces() {
    const provinceSelect =
      $("provinceSelect");

    const citySelect =
      $("citySelect");

    const barangaySelect =
      $("brgySelect");

    if (!provinceSelect) return;

    provinceSelect.innerHTML = `
      <option value="">
        Select province
      </option>
    `;

    if (citySelect) {
      citySelect.innerHTML = `
        <option value="">
          Select city
        </option>
      `;

      citySelect.disabled = true;
    }

    if (barangaySelect) {
      barangaySelect.innerHTML = `
        <option value="">
          Select barangay
        </option>
      `;

      barangaySelect.disabled = true;
    }

    try {
      const provinces =
        await getProvinces();

      provinces.sort((a, b) =>
        String(a.name || "")
          .localeCompare(
            String(b.name || "")
          )
      );

      provinces.forEach(
        (province) => {
          const option =
            document.createElement(
              "option"
            );

          option.value =
            province.code;

          option.textContent =
            province.name;

          provinceSelect.appendChild(
            option
          );
        }
      );
    } catch (error) {
      console.warn(
        "PSGC provinces error:",
        error
      );
    }
  }

  async function onProvinceChange() {
    const provinceSelect =
      $("provinceSelect");

    const citySelect =
      $("citySelect");

    const barangaySelect =
      $("brgySelect");

    if (
      !provinceSelect ||
      !citySelect ||
      !barangaySelect
    ) {
      return;
    }

    const provinceCode =
      provinceSelect.value;

    citySelect.innerHTML = `
      <option value="">
        Select city
      </option>
    `;

    citySelect.disabled = true;

    barangaySelect.innerHTML = `
      <option value="">
        Select barangay
      </option>
    `;

    barangaySelect.disabled = true;

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
        String(a.name || "")
          .localeCompare(
            String(b.name || "")
          )
      );

      cities.forEach((city) => {
        const option =
          document.createElement(
            "option"
          );

        option.value =
          city.code;

        option.textContent =
          city.name;

        citySelect.appendChild(
          option
        );
      });

      citySelect.disabled = false;
    } catch (error) {
      console.warn(
        "PSGC cities error:",
        error
      );
    }
  }

  async function onCityChange() {
    const citySelect =
      $("citySelect");

    const barangaySelect =
      $("brgySelect");

    if (
      !citySelect ||
      !barangaySelect
    ) {
      return;
    }

    const cityCode =
      citySelect.value;

    barangaySelect.innerHTML = `
      <option value="">
        Select barangay
      </option>
    `;

    barangaySelect.disabled = true;

    if ($("postal")) {
      $("postal").value = "";
    }

    if (!cityCode) return;

    try {
      const barangays =
        await getBarangaysByCity(
          cityCode
        );

      barangays.sort((a, b) =>
        String(a.name || "")
          .localeCompare(
            String(b.name || "")
          )
      );

      barangays.forEach(
        (barangay) => {
          const option =
            document.createElement(
              "option"
            );

          option.value =
            barangay.code;

          option.textContent =
            barangay.name;

          barangaySelect.appendChild(
            option
          );
        }
      );

      barangaySelect.disabled =
        false;
    } catch (error) {
      console.warn(
        "PSGC barangays error:",
        error
      );
    }
  }

  async function setAddressFromSaved(
    address = {}
  ) {
    await loadProvinces();

    if (
      $("provinceSelect") &&
      address.provinceCode
    ) {
      $("provinceSelect").value =
        address.provinceCode;

      await onProvinceChange();
    }

    if (
      $("citySelect") &&
      address.cityCode
    ) {
      $("citySelect").value =
        address.cityCode;

      await onCityChange();
    }

    if (
      $("brgySelect") &&
      address.brgyCode
    ) {
      $("brgySelect").value =
        address.brgyCode;
    }

    if ($("postal")) {
      $("postal").value =
        address.postal || "";
    }
  }

  // =====================================================
  // CLEAR FORM
  // =====================================================

  function clearForm() {
    const fields = [
      "firstName",
      "middleName",
      "lastName",
      "dob",
      "lrn",
      "phone",
      "email",
      "street",
      "postal",
      "studentId",
      "tempPass",
    ];

    fields.forEach((id) => {
      const element = $(id);

      if (element) {
        element.value = "";
      }
    });

    if ($("suffix")) {
      $("suffix").value = "";
    }

    const male =
      document.querySelector(
        'input[name="gender"][value="male"]'
      );

    const female =
      document.querySelector(
        'input[name="gender"][value="female"]'
      );

    if (male) {
      male.checked = true;
    }

    if (female) {
      female.checked = false;
    }

    if ($("provinceSelect")) {
      $("provinceSelect").value = "";
    }

    if ($("citySelect")) {
      $("citySelect").innerHTML = `
        <option value="">
          Select city
        </option>
      `;

      $("citySelect").disabled =
        true;
    }

    if ($("brgySelect")) {
      $("brgySelect").innerHTML = `
        <option value="">
          Select barangay
        </option>
      `;

      $("brgySelect").disabled =
        true;
    }

    clearError();
  }

  // =====================================================
  // LOAD STUDENTS
  // =====================================================

  async function loadStudents() {
    const search =
      (
        $("searchInput")
          ?.value || ""
      ).trim();

    const classFilter =
      $("classFilter")
        ?.value || "all";

    const params =
      new URLSearchParams();

    if (search) {
      params.set(
        "q",
        search
      );
    }

    params.set(
      "class",
      classFilter
    );

    const data =
      await apiFetch(
        `/api/admin/students?${params.toString()}`
      );

    students =
      Array.isArray(
        data?.students
      )
        ? data.students.map(
            (student) => ({
              ...student,
              id: student.id,
            })
          )
        : [];

    const classSet =
      new Set(classes);

    students.forEach(
      (student) => {
        if (student.className) {
          classSet.add(
            student.className
          );
        }
      }
    );

    classes =
      Array.from(classSet);

    renderClassFilter();
    renderStudentsTable();
  }

  // =====================================================
  // START EDIT
  // =====================================================

  async function startEditStudent(
    id
  ) {
    const student =
      students.find(
        (item) =>
          String(item.id) ===
          String(id)
      );

    if (!student) return;

    editingStudentId = id;

    editingStudentSnapshot =
      cloneDeep(student);

    showFormView();

    clearForm();
    clearError();

    if ($("firstName")) {
      $("firstName").value =
        student.firstName || "";
    }

    if ($("middleName")) {
      $("middleName").value =
        student.middleName || "";
    }

    if ($("lastName")) {
      $("lastName").value =
        student.lastName || "";
    }

    if ($("suffix")) {
      $("suffix").value =
        student.suffix || "";
    }

    if ($("dob")) {
      $("dob").value =
        student.dob || "";
    }

    if ($("lrn")) {
      $("lrn").value =
        student.lrn || "";
    }

    const gender =
      (
        student.gender ||
        "male"
      ).toLowerCase();

    document
      .querySelectorAll(
        'input[name="gender"]'
      )
      .forEach((radio) => {
        radio.checked =
          (
            radio.value || ""
          ).toLowerCase() ===
          gender;
      });

    if ($("phone")) {
      $("phone").value =
        toLocal10Digits(
          student.phone || ""
        );
    }

    if ($("email")) {
      $("email").value =
        student.email || "";
    }

    const address =
      student.address || {};

    if ($("street")) {
      $("street").value =
        address.street || "";
    }

    await setAddressFromSaved(
      address
    );

    if ($("studentId")) {
      $("studentId").value =
        student.studentId || "";
    }

    if ($("tempPass")) {
      $("tempPass").value =
        tempPassCache[id] || "";
    }
  }

  async function resetEditForm() {
    if (
      !editingStudentId ||
      !editingStudentSnapshot
    ) {
      return;
    }

    await startEditStudent(
      editingStudentId
    );
  }

  // =====================================================
  // VALIDATION
  // =====================================================

  function validateStudentForm() {
    const firstName =
      (
        $("firstName")
          ?.value || ""
      ).trim();

    const lastName =
      (
        $("lastName")
          ?.value || ""
      ).trim();

    const lrn =
      (
        $("lrn")
          ?.value || ""
      ).trim();

    const email =
      (
        $("email")
          ?.value || ""
      ).trim();

    const phone =
      toStoredPhone(
        $("phone")
          ?.value || ""
      );

    const postal =
      (
        $("postal")
          ?.value || ""
      ).trim();

    if (
      !firstName ||
      !lastName
    ) {
      return (
        "Please enter student first and last name."
      );
    }

    if (
      !lrn ||
      !/^\d{12}$/.test(lrn)
    ) {
      return (
        "LRN must be exactly 12 digits."
      );
    }

    if (!email) {
      return "Email is required.";
    }

    if (!phone) {
      return (
        "Phone must be exactly 10 digits."
      );
    }

    if (
      postal &&
      !/^\d{4}$/.test(postal)
    ) {
      return (
        "Postal Code must be exactly 4 digits."
      );
    }

    return "";
  }

  // =====================================================
  // SAVE STUDENT
  // =====================================================

  async function saveStudent() {
    clearError();

    const validationError =
      validateStudentForm();

    if (validationError) {
      setError(
        validationError
      );
      return;
    }

    const payload = {
      firstName:
        (
          $("firstName")
            ?.value || ""
        ).trim(),

      middleName:
        (
          $("middleName")
            ?.value || ""
        ).trim(),

      lastName:
        (
          $("lastName")
            ?.value || ""
        ).trim(),

      suffix:
        $("suffix")?.value || "",

      dob:
        $("dob")?.value || "",

      gender:
        getGenderValue(),

      lrn:
        (
          $("lrn")
            ?.value || ""
        ).trim(),

      phone:
        toStoredPhone(
          $("phone")
            ?.value || ""
        ),

      email:
        (
          $("email")
            ?.value || ""
        )
          .trim()
          .toLowerCase(),

      street:
        (
          $("street")
            ?.value || ""
        ).trim(),

      provinceCode:
        $("provinceSelect")
          ?.value || "",

      cityCode:
        $("citySelect")
          ?.value || "",

      brgyCode:
        $("brgySelect")
          ?.value || "",

      postal:
        (
          $("postal")
            ?.value || ""
        ).trim(),
    };

    const saveButton =
      $("saveBtn");

    try {
      if (saveButton) {
        saveButton.disabled =
          true;
      }

      // =================================================
      // UPDATE EXISTING STUDENT
      // =================================================

      if (editingStudentId) {
        await apiFetch(
          `/api/admin/students/${editingStudentId}`,
          {
            method: "PUT",
            body: JSON.stringify(
              payload
            ),
          }
        );

        alert(
          "Student updated successfully."
        );

        editingStudentId = null;
        editingStudentSnapshot =
          null;

        await loadStudents();

        showListView();

        clearForm();

        return;
      }

      // =================================================
      // CREATE NEW STUDENT
      // =================================================

      const data =
        await apiFetch(
          "/api/admin/students",
          {
            method: "POST",
            body: JSON.stringify(
              payload
            ),
          }
        );

      const created =
        data?.student;

      const tempPass =
        data?.tempPass || "";

      // Store temporary password
      // only for this page session.
      if (
        created?.id &&
        tempPass
      ) {
        tempPassCache[
          created.id
        ] = tempPass;
      }

      // =================================================
      // DISPLAY GENERATED CREDENTIALS
      // DIRECTLY IN LOGIN / ACCOUNT DETAILS
      // =================================================

      if ($("studentId")) {
        $("studentId").value =
          created?.studentId || "";
      }

      if ($("tempPass")) {
        $("tempPass").value =
          tempPass;
      }

      // Keep the form open so the admin
      // can see the generated credentials.
      showFormView();

      // Refresh the student table
      // in the background.
      await loadStudents();

      // Make sure we remain on the form.
      showFormView();

      // This is now a new student,
      // not an editing session.
      editingStudentId = null;
      editingStudentSnapshot =
        null;

      // Do NOT clear the form here.
      // The Student ID and Temporary Password
      // must remain visible.

    } catch (error) {
      console.error(
        "Save student error:",
        error
      );

      setError(
        error.message ||
          "Failed to save student."
      );
    } finally {
      if (saveButton) {
        saveButton.disabled =
          false;
      }
    }
  }

  // =====================================================
  // DELETE STUDENT
  // =====================================================

  async function deleteStudentById(
    id
  ) {
    const student =
      students.find(
        (item) =>
          String(item.id) ===
          String(id)
      );

    if (!student) return;

    const confirmed =
      confirm(
        `Delete student "${fullName(
          student
        )}"?`
      );

    if (!confirmed) return;

    try {
      await apiFetch(
        `/api/admin/students/${id}`,
        {
          method: "DELETE",
        }
      );

      await loadStudents();

      alert(
        "Student deleted successfully."
      );
    } catch (error) {
      console.error(
        "Delete student error:",
        error
      );

      alert(
        error.message ||
          "Failed to delete student."
      );
    }
  }

  // =====================================================
  // EVENTS
  // =====================================================

  function bindEvents() {
    // Add New
    $("addNewBtn")
      ?.addEventListener(
        "click",
        async () => {
          editingStudentId =
            null;

          editingStudentSnapshot =
            null;

          showFormView();

          clearForm();
          clearError();

          await loadProvinces();
        }
      );

    // Cancel
    $("cancelBtn")
      ?.addEventListener(
        "click",
        () => {
          editingStudentId =
            null;

          editingStudentSnapshot =
            null;

          showListView();

          clearForm();
        }
      );

    // Reset
    $("resetBtn")
      ?.addEventListener(
        "click",
        async () => {
          if (editingStudentId) {
            await resetEditForm();
            return;
          }

          clearForm();

          await loadProvinces();
        }
      );

    // Save
    $("saveBtn")
      ?.addEventListener(
        "click",
        saveStudent
      );

    // Search
    $("searchInput")
      ?.addEventListener(
        "input",
        renderStudentsTable
      );

    // Class filter
    $("classFilter")
      ?.addEventListener(
        "change",
        renderStudentsTable
      );

    // Address
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

    // Student table actions
    $("studentsTbody")
      ?.addEventListener(
        "click",
        (event) => {
          const button =
            event.target.closest(
              "button"
            );

          if (!button) return;

          const id =
            button.dataset.id;

          if (!id) return;

          if (
            button.classList.contains(
              "t-view"
            )
          ) {
            openStudentModal(id);
            return;
          }

          if (
            button.classList.contains(
              "t-edit"
            )
          ) {
            startEditStudent(id);
            return;
          }

          if (
            button.classList.contains(
              "t-del"
            )
          ) {
            deleteStudentById(id);
          }
        }
      );
  }

  // =====================================================
  // INITIALIZE
  // =====================================================

  document.addEventListener(
    "DOMContentLoaded",
    async () => {
      await fetchCsrf();

      bindEvents();

      bindStudentModalEvents();

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

      bindPhoneFilter(
        "phone"
      );

      bindPostalFilter();

      bindLRNFilter();

      renderClassFilter();

      showListView();

      try {
        await loadClasses();

        await loadStudents();
      } catch (error) {
        console.warn(error);

        setError(
          "Backend not reachable or route missing. Make sure the server is running and /api/admin/students exists."
        );
      }
    }
  );
})();