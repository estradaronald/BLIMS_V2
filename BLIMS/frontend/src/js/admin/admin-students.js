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
// Bulk Create frontend:
//   - Manual learner entry
//   - Grade Level optional
//   - Section optional
//   - Excel upload
//   - Excel template download
//   - Validation
//   - Created account result display
//   - Created account Excel download
//
// Uses:
//   - Session cookies
//   - CSRF token
//   - PSGC API for Province / City / Barangay
//   - +63 phone format
//   - SheetJS for Excel import/export
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

      const parsed =
        JSON.parse(raw);

      if (
        !parsed?.data ||
        !parsed?.expiresAt
      ) {
        return null;
      }

      if (
        Date.now() >
        parsed.expiresAt
      ) {
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
    const response =
      await fetch(url);

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

    cacheSet(
      "provinces",
      data
    );

    return data;
  }

  async function getCitiesByProvince(
    provinceCode
  ) {
    const key =
      `cities_${provinceCode}`;

    const cached =
      cacheGet(key);

    if (cached) return cached;

    const data =
      await fetchJSON(
        `${PSGC_BASE}/provinces/${provinceCode}/cities-municipalities`
      );

    cacheSet(
      key,
      data
    );

    return data;
  }

  async function getBarangaysByCity(
    cityCode
  ) {
    const key =
      `brgys_${cityCode}`;

    const cached =
      cacheGet(key);

    if (cached) return cached;

    const data =
      await fetchJSON(
        `${PSGC_BASE}/cities-municipalities/${cityCode}/barangays`
      );

    cacheSet(
      key,
      data
    );

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
          element.value =
            cleaned;
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
          element.value =
            cleaned;
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

    if (
      digits.startsWith("63")
    ) {
      digits =
        digits.slice(2);
    }

    if (
      digits.startsWith("0") &&
      digits.length >= 11
    ) {
      digits =
        digits.slice(1);
    }

    return digits.slice(0, 10);
  }

  function toStoredPhone(value) {
    const digits =
      toLocal10Digits(value);

    if (
      digits.length !== 10
    ) {
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
          element.value =
            cleaned;
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
    const element =
      $("postal");

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
          element.value =
            cleaned;
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
    const element =
      $("lrn");

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
          element.value =
            cleaned;
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

  const tempPassCache = {};

  // Bulk state
  let bulkLearnerCount = 0;
  let bulkCreatedAccounts = [];

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
      ?.classList.remove(
        "hidden"
      );

    $("formView")
      ?.classList.add(
        "hidden"
      );

    $("bulkCreateView")
      ?.classList.add(
        "hidden"
      );

    const addButton =
      $("addNewBtn");

    const bulkButton =
      $("bulkCreateBtn");

    if (addButton) {
      addButton.style.display =
        "";
    }

    if (bulkButton) {
      bulkButton.style.display =
        "";
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

    $("bulkCreateView")
      ?.classList.add(
        "hidden"
      );

    const addButton =
      $("addNewBtn");

    const bulkButton =
      $("bulkCreateBtn");

    if (addButton) {
      addButton.style.display =
        "none";
    }

    if (bulkButton) {
      bulkButton.style.display =
        "none";
    }
  }

  function showBulkCreateView() {
    $("listView")
      ?.classList.add(
        "hidden"
      );

    $("formView")
      ?.classList.add(
        "hidden"
      );

    $("bulkCreateView")
      ?.classList.remove(
        "hidden"
      );

    const addButton =
      $("addNewBtn");

    const bulkButton =
      $("bulkCreateBtn");

    if (addButton) {
      addButton.style.display =
        "none";
    }

    if (bulkButton) {
      bulkButton.style.display =
        "none";
    }

    clearBulkCreateError();

    initializeBulkCreate();
  }

  function hideBulkCreateView() {
    $("bulkCreateView")
      ?.classList.add(
        "hidden"
      );

    $("listView")
      ?.classList.remove(
        "hidden"
      );

    const addButton =
      $("addNewBtn");

    const bulkButton =
      $("bulkCreateBtn");

    if (addButton) {
      addButton.style.display =
        "";
    }

    if (bulkButton) {
      bulkButton.style.display =
        "";
    }

    clearBulkCreateError();
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
  // BULK ERROR
  // =====================================================

  function setBulkCreateError(
    message
  ) {
    const box =
      $("bulkCreateError");

    if (!box) return;

    box.textContent =
      message;

    box.classList.remove(
      "hidden"
    );
  }

  function clearBulkCreateError() {
    const box =
      $("bulkCreateError");

    if (!box) return;

    box.textContent = "";

    box.classList.add(
      "hidden"
    );
  }

  // =====================================================
  // BULK IMPORT STATUS
  // =====================================================

  function showBulkImportStatus(
    message
  ) {
    const box =
      $("bulkImportStatus");

    if (!box) return;

    box.textContent =
      message;

    box.classList.remove(
      "hidden"
    );
  }

  function clearBulkImportStatus() {
    const box =
      $("bulkImportStatus");

    if (!box) return;

    box.textContent = "";

    box.classList.add(
      "hidden"
    );
  }

  // =====================================================
  // HELPERS
  // =====================================================

  function classSectionLabel(
    student
  ) {
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
      .forEach(
        (className) => {
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
        }
      );

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

    if (
      filtered.length === 0
    ) {
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

      tbody.appendChild(
        row
      );

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

        tbody.appendChild(
          row
        );
      }
    );
  }

  // =====================================================
  // BASIC HTML ESCAPE
  // =====================================================

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(
        /&/g,
        "&amp;"
      )
      .replace(
        /</g,
        "&lt;"
      )
      .replace(
        />/g,
        "&gt;"
      )
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

  function setText(
    id,
    value
  ) {
    const element = $(id);

    if (element) {
      element.textContent =
        value ?? "";
    }
  }

  function setValue(
    id,
    value
  ) {
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

  async function openStudentModal(
    id
  ) {
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
        student.studentId ||
        "—"
      }`
    );

    setValue(
      "smFullName",
      fullName(student) ||
        "—"
    );

    setValue(
      "smStudentIdBasic",
      student.studentId ||
        "—"
    );

    setValue(
      "smLRN",
      student.lrn ||
        "—"
    );

    setValue(
      "smGender",
      student.gender ||
        "—"
    );

    setValue(
      "smDob",
      student.dob ||
        "—"
    );

    setValue(
      "smPhone",
      student.phone ||
        "—"
    );

    setValue(
      "smEmail",
      student.email ||
        "—"
    );

    const address =
      student.address || {};

    setValue(
      "smStreet",
      address.street ||
        "—"
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
      address.postal ||
        "—"
    );

    const [
      provinceName,
      cityName,
      barangayName,
    ] =
      await Promise.all([
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
      provinceName ||
        "—"
    );

    setValue(
      "smCity",
      cityName ||
        "—"
    );

    setValue(
      "smBrgy",
      barangayName ||
        "—"
    );

    setValue(
      "smAccId",
      student.studentId ||
        "—"
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
      .forEach(
        (button) => {
          button.classList.remove(
            "active"
          );
        }
      );

    document
      .querySelectorAll(
        ".tmodal-panel"
      )
      .forEach(
        (panel) => {
          panel.classList.add(
            "hidden"
          );
        }
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
      .forEach(
        (button) => {
          button.addEventListener(
            "click",
            () => {
              document
                .querySelectorAll(
                  ".tmodal-tab"
                )
                .forEach(
                  (item) => {
                    item.classList.remove(
                      "active"
                    );
                  }
                );

              button.classList.add(
                "active"
              );

              const tab =
                button.dataset.tab;

              document
                .querySelectorAll(
                  ".tmodal-panel"
                )
                .forEach(
                  (panel) => {
                    panel.classList.add(
                      "hidden"
                    );
                  }
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
        }
      );

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
          if (
            !activeStudentId
          ) {
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

      provinces.sort(
        (a, b) =>
          String(
            a.name || ""
          ).localeCompare(
            String(
              b.name || ""
            )
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

    barangaySelect.disabled =
      true;

    if ($("postal")) {
      $("postal").value = "";
    }

    if (!provinceCode) return;

    try {
      const cities =
        await getCitiesByProvince(
          provinceCode
        );

      cities.sort(
        (a, b) =>
          String(
            a.name || ""
          ).localeCompare(
            String(
              b.name || ""
            )
          )
      );

      cities.forEach(
        (city) => {
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
        }
      );

      citySelect.disabled =
        false;
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

    barangaySelect.disabled =
      true;

    if ($("postal")) {
      $("postal").value = "";
    }

    if (!cityCode) return;

    try {
      const barangays =
        await getBarangaysByCity(
          cityCode
        );

      barangays.sort(
        (a, b) =>
          String(
            a.name || ""
          ).localeCompare(
            String(
              b.name || ""
            )
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

    fields.forEach(
      (id) => {
        const element = $(id);

        if (element) {
          element.value = "";
        }
      }
    );

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
      $("provinceSelect").value =
        "";
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
      .forEach(
        (radio) => {
          radio.checked =
            (
              radio.value || ""
            ).toLowerCase() ===
            gender;
        }
      );

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

      // UPDATE
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

      // CREATE
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

      if (
        created?.id &&
        tempPass
      ) {
        tempPassCache[
          created.id
        ] = tempPass;
      }

      if ($("studentId")) {
        $("studentId").value =
          created?.studentId || "";
      }

      if ($("tempPass")) {
        $("tempPass").value =
          tempPass;
      }

      await loadStudents();

      showFormView();

      editingStudentId = null;
      editingStudentSnapshot =
        null;

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
  // BULK CREATE
  // =====================================================

  function createBulkLearnerRow(
    data = {}
  ) {
    bulkLearnerCount++;

    const row =
      document.createElement(
        "div"
      );

    row.className =
      "bulk-learner-row";

    row.dataset.row =
      bulkLearnerCount;

    row.innerHTML = `
      <div class="bulk-row-header">

        <div class="bulk-row-number">
          Learner ${bulkLearnerCount}
        </div>

        <button
          type="button"
          class="bulk-remove-btn"
          title="Remove learner"
        >
          Remove
        </button>

      </div>


      <div class="bulk-row-fields">

        <!-- First Name -->

        <div class="bulk-field">

          <label>
            First Name
          </label>

          <input
            type="text"
            class="bulk-first-name"
            placeholder="First name"
            autocomplete="off"
          />

        </div>


        <!-- Last Name -->

        <div class="bulk-field">

          <label>
            Last Name
          </label>

          <input
            type="text"
            class="bulk-last-name"
            placeholder="Last name"
            autocomplete="off"
          />

        </div>


        <!-- LRN -->

        <div class="bulk-field">

          <label>
            LRN
          </label>

          <input
            type="text"
            class="bulk-lrn"
            placeholder="12-digit LRN"
            maxlength="12"
            inputmode="numeric"
            autocomplete="off"
          />

        </div>


        <!-- Grade Level -->

        <div class="bulk-field">

          <label>
            Grade Level
            <span class="bulk-optional">
              (Optional)
            </span>
          </label>

          <select class="bulk-grade">

            <option value="">
              Select grade
            </option>

            <option value="Kindergarten">
              Kindergarten
            </option>

            <option value="Grade 1">
              Grade 1
            </option>

            <option value="Grade 2">
              Grade 2
            </option>

            <option value="Grade 3">
              Grade 3
            </option>

            <option value="Grade 4">
              Grade 4
            </option>

            <option value="Grade 5">
              Grade 5
            </option>

            <option value="Grade 6">
              Grade 6
            </option>

          </select>

        </div>


        <!-- Section -->

        <div class="bulk-field">

          <label>
            Section
            <span class="bulk-optional">
              (Optional)
            </span>
          </label>

          <input
            type="text"
            class="bulk-section"
            placeholder="Section"
            autocomplete="off"
          />

        </div>

      </div>
    `;

    const firstName =
      row.querySelector(
        ".bulk-first-name"
      );

    const lastName =
      row.querySelector(
        ".bulk-last-name"
      );

    const lrn =
      row.querySelector(
        ".bulk-lrn"
      );

    const grade =
      row.querySelector(
        ".bulk-grade"
      );

    const section =
      row.querySelector(
        ".bulk-section"
      );


    // Apply imported values

    if (firstName) {
      firstName.value =
        filterNameValue(
          data.firstName || ""
        );
    }

    if (lastName) {
      lastName.value =
        filterNameValue(
          data.lastName || ""
        );
    }

    if (lrn) {
      lrn.value =
        digitsOnly(
          data.lrn || ""
        ).slice(0, 12);
    }

    if (grade) {
      grade.value =
        normalizeGradeLevel(
          data.gradeLevel || ""
        );
    }

    if (section) {
      section.value =
        filterNameValue(
          data.section || ""
        );
    }


    // Remove row

    const removeButton =
      row.querySelector(
        ".bulk-remove-btn"
      );

    removeButton?.addEventListener(
      "click",
      () => {

        row.remove();

        renumberBulkLearners();

        const remaining =
          document.querySelectorAll(
            ".bulk-learner-row"
          );

        if (
          remaining.length === 0
        ) {
          createBulkLearnerRow();
        }

      }
    );


    // Filters

    bindBulkNameFilter(
      firstName
    );

    bindBulkNameFilter(
      lastName
    );

    bindBulkNameFilter(
      section
    );

    bindBulkLRNFilter(
      lrn
    );


    $("bulkLearnersContainer")
      ?.appendChild(row);
  }

  // =====================================================
  // NORMALIZE GRADE LEVEL
  // =====================================================

  function normalizeGradeLevel(
    value
  ) {
    const normalized =
      String(value || "")
        .trim()
        .toLowerCase();

    const grades = {
      kindergarten:
        "Kindergarten",

      "grade 1":
        "Grade 1",

      grade1:
        "Grade 1",

      "grade 2":
        "Grade 2",

      grade2:
        "Grade 2",

      "grade 3":
        "Grade 3",

      grade3:
        "Grade 3",

      "grade 4":
        "Grade 4",

      grade4:
        "Grade 4",

      "grade 5":
        "Grade 5",

      grade5:
        "Grade 5",

      "grade 6":
        "Grade 6",

      grade6:
        "Grade 6",
    };

    return grades[
      normalized
    ] || "";
  }

  // =====================================================
  // BULK NAME FILTER
  // =====================================================

  function bindBulkNameFilter(
    element
  ) {
    if (!element) return;

    element.addEventListener(
      "input",
      () => {
        const cleaned =
          filterNameValue(
            element.value
          );

        if (
          element.value !==
          cleaned
        ) {
          element.value =
            cleaned;
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

  // =====================================================
  // BULK LRN FILTER
  // =====================================================

  function bindBulkLRNFilter(
    element
  ) {
    if (!element) return;

    element.addEventListener(
      "input",
      () => {
        const cleaned =
          digitsOnly(
            element.value
          ).slice(0, 12);

        if (
          element.value !==
          cleaned
        ) {
          element.value =
            cleaned;
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
  // RENUMBER BULK ROWS
  // =====================================================

  function renumberBulkLearners() {
    document
      .querySelectorAll(
        ".bulk-learner-row"
      )
      .forEach(
        (row, index) => {

          const number =
            row.querySelector(
              ".bulk-row-number"
            );

          if (number) {
            number.textContent =
              `Learner ${
                index + 1
              }`;
          }

        }
      );
  }

  // =====================================================
  // INITIALIZE BULK CREATE
  // =====================================================

  function initializeBulkCreate() {
    const container =
      $("bulkLearnersContainer");

    if (!container) return;

    container.innerHTML = "";

    bulkLearnerCount = 0;

    bulkCreatedAccounts = [];

    hideCreatedAccounts();

    clearBulkImportStatus();

    createBulkLearnerRow();

    createBulkLearnerRow();
  }

  // =====================================================
  // GET BULK LEARNERS
  // =====================================================

  function getBulkLearners() {
    const rows =
      Array.from(
        document.querySelectorAll(
          ".bulk-learner-row"
        )
      );

    return rows.map(
      (row) => ({

        firstName:
          row.querySelector(
            ".bulk-first-name"
          )?.value.trim() ||
          "",

        lastName:
          row.querySelector(
            ".bulk-last-name"
          )?.value.trim() ||
          "",

        lrn:
          row.querySelector(
            ".bulk-lrn"
          )?.value.trim() ||
          "",

        gradeLevel:
          row.querySelector(
            ".bulk-grade"
          )?.value ||
          "",

        section:
          row.querySelector(
            ".bulk-section"
          )?.value.trim() ||
          "",

      })
    );
  }

  // =====================================================
  // VALIDATE BULK LEARNERS
  // =====================================================

  function validateBulkLearners() {
    const learners =
      getBulkLearners();

    if (
      learners.length === 0
    ) {
      return (
        "Please add at least one learner."
      );
    }

    const seenLRNs =
      new Set();

    for (
      let index = 0;
      index < learners.length;
      index++
    ) {
      const learner =
        learners[index];

      const number =
        index + 1;

      if (
        !learner.firstName ||
        !learner.lastName
      ) {
        return (
          `Learner ${number}: First Name and Last Name are required.`
        );
      }

      if (
        !/^\d{12}$/.test(
          learner.lrn
        )
      ) {
        return (
          `Learner ${number}: LRN must be exactly 12 digits.`
        );
      }

      if (
        seenLRNs.has(
          learner.lrn
        )
      ) {
        return (
          `Learner ${number}: LRN ${learner.lrn} is duplicated in this batch.`
        );
      }

      seenLRNs.add(
        learner.lrn
      );

      /*
        Grade Level is optional.

        Section is optional.

        We intentionally do not
        validate either field.
      */
    }

    return "";
  }

  // =====================================================
  // EXCEL TEMPLATE DOWNLOAD
  // =====================================================

  function downloadBulkTemplate() {

    if (
      typeof XLSX === "undefined"
    ) {
      alert(
        "Excel functionality is unavailable. Please check the SheetJS library."
      );

      return;
    }

    const rows = [

      {
        "First Name":
          "Juan",

        "Last Name":
          "Dela Cruz",

        "LRN":
          "123456789012",

        "Grade Level":
          "Grade 6",

        "Section":
          "Mabini",
      },

      {
        "First Name":
          "Maria",

        "Last Name":
          "Santos",

        "LRN":
          "123456789013",

        "Grade Level":
          "",

        "Section":
          "",
      },

    ];


    const worksheet =
      XLSX.utils.json_to_sheet(
        rows
      );


    worksheet["!cols"] = [
      { wch: 18 },
      { wch: 22 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
    ];


    const workbook =
      XLSX.utils.book_new();


    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Learners"
    );


    XLSX.writeFile(
      workbook,
      "BLIMS_Learner_Bulk_Create_Template.xlsx"
    );
  }

  // =====================================================
  // EXCEL UPLOAD
  // =====================================================

  async function handleBulkExcelUpload(
    event
  ) {

    const file =
      event.target.files?.[0];

    if (!file) return;

    clearBulkCreateError();

    clearBulkImportStatus();


    const validExtensions = [
      ".xlsx",
      ".xls",
    ];


    const fileName =
      String(
        file.name || ""
      ).toLowerCase();


    const validFile =
      validExtensions.some(
        (extension) =>
          fileName.endsWith(
            extension
          )
      );


    if (!validFile) {

      setBulkCreateError(
        "Please upload an Excel file (.xlsx or .xls)."
      );

      event.target.value = "";

      return;
    }


    if (
      typeof XLSX === "undefined"
    ) {

      setBulkCreateError(
        "Excel functionality is unavailable. Please check the SheetJS library."
      );

      event.target.value = "";

      return;
    }


    try {

      showBulkImportStatus(
        "Reading Excel file..."
      );


      const arrayBuffer =
        await file.arrayBuffer();


      const workbook =
        XLSX.read(
          arrayBuffer,
          {
            type: "array",
          }
        );


      const firstSheetName =
        workbook.SheetNames?.[0];


      if (!firstSheetName) {

        throw new Error(
          "The Excel file does not contain a worksheet."
        );

      }


      const worksheet =
        workbook.Sheets[
          firstSheetName
        ];


      const rawRows =
        XLSX.utils.sheet_to_json(
          worksheet,
          {
            defval: "",
            raw: false,
          }
        );


      if (
        !Array.isArray(rawRows) ||
        rawRows.length === 0
      ) {

        throw new Error(
          "The Excel file does not contain any learner records."
        );

      }


      const learners =
        parseExcelLearners(
          rawRows
        );


      if (
        learners.length === 0
      ) {

        throw new Error(
          "No valid learner rows were found in the Excel file."
        );

      }


      const importError =
        validateImportedLearners(
          learners
        );


      if (importError) {

        throw new Error(
          importError
        );

      }


      const container =
        $("bulkLearnersContainer");

      if (!container) return;


      container.innerHTML = "";

      bulkLearnerCount = 0;


      learners.forEach(
        (learner) => {

          createBulkLearnerRow(
            learner
          );

        }
      );


      renumberBulkLearners();


      showBulkImportStatus(
        `${learners.length} learner(s) imported successfully from "${file.name}".`
      );

    } catch (error) {

      console.error(
        "Excel import error:",
        error
      );

      setBulkCreateError(
        error.message ||
        "Failed to import Excel file."
      );

    } finally {

      event.target.value = "";

    }
  }

  // =====================================================
  // PARSE EXCEL LEARNERS
  // =====================================================

  function parseExcelLearners(
    rows
  ) {

    return rows
      .map(
        (row) => {

          const normalized =
            {};

          Object.keys(row)
            .forEach(
              (key) => {

                const normalizedKey =
                  normalizeExcelHeader(
                    key
                  );

                normalized[
                  normalizedKey
                ] = String(
                  row[key] ?? ""
                ).trim();

              }
            );


          return {

            firstName:
              filterNameValue(
                normalized.firstName ||
                ""
              ),

            lastName:
              filterNameValue(
                normalized.lastName ||
                ""
              ),

            lrn:
              digitsOnly(
                normalized.lrn ||
                ""
              ).slice(0, 12),

            gradeLevel:
              normalizeGradeLevel(
                normalized.gradeLevel ||
                ""
              ),

            section:
              filterNameValue(
                normalized.section ||
                ""
              ),

          };

        }
      )
      .filter(
        (learner) =>
          learner.firstName ||
          learner.lastName ||
          learner.lrn ||
          learner.gradeLevel ||
          learner.section
      );
  }

  // =====================================================
  // NORMALIZE EXCEL HEADERS
  // =====================================================

  function normalizeExcelHeader(
    header
  ) {

    const value =
      String(
        header || ""
      )
        .trim()
        .toLowerCase()
        .replace(
          /[\s_-]+/g,
          ""
        );


    if (
      value === "firstname" ||
      value === "first"
    ) {
      return "firstName";
    }


    if (
      value === "lastname" ||
      value === "last"
    ) {
      return "lastName";
    }


    if (
      value === "lrn"
    ) {
      return "lrn";
    }


    if (
      value === "gradelevel" ||
      value === "grade"
    ) {
      return "gradeLevel";
    }


    if (
      value === "section"
    ) {
      return "section";
    }


    return value;
  }

  // =====================================================
  // VALIDATE IMPORTED LEARNERS
  // =====================================================

  function validateImportedLearners(
    learners
  ) {

    const seenLRNs =
      new Set();


    for (
      let index = 0;
      index < learners.length;
      index++
    ) {

      const learner =
        learners[index];

      const excelRow =
        index + 2;


      if (
        !learner.firstName
      ) {

        return (
          `Excel row ${excelRow}: First Name is required.`
        );

      }


      if (
        !learner.lastName
      ) {

        return (
          `Excel row ${excelRow}: Last Name is required.`
        );

      }


      if (
        !/^\d{12}$/.test(
          learner.lrn
        )
      ) {

        return (
          `Excel row ${excelRow}: LRN must be exactly 12 digits.`
        );

      }


      if (
        seenLRNs.has(
          learner.lrn
        )
      ) {

        return (
          `Excel row ${excelRow}: LRN ${learner.lrn} is duplicated in the uploaded file.`
        );

      }


      seenLRNs.add(
        learner.lrn
      );

    }


    return "";
  }

  // =====================================================
  // CREATED ACCOUNTS
  // =====================================================

  function showCreatedAccounts(
    accounts
  ) {

    const section =
      $("bulkCreatedAccounts");

    const tbody =
      $("bulkCreatedAccountsTbody");

    const message =
      $("bulkSuccessMessage");


    if (
      !section ||
      !tbody
    ) {
      return;
    }


    bulkCreatedAccounts =
      Array.isArray(accounts)
        ? accounts
        : [];


    tbody.innerHTML = "";


    bulkCreatedAccounts.forEach(
      (account, index) => {

        const row =
          document.createElement(
            "tr"
          );


        const learnerName =
          [
            account.firstName,
            account.lastName,
          ]
            .filter(Boolean)
            .join(" ");


        row.innerHTML = `
          <td>
            ${index + 1}
          </td>

          <td>
            ${escapeHtml(
              learnerName || "—"
            )}
          </td>

          <td>
            ${escapeHtml(
              account.lrn || "—"
            )}
          </td>

          <td>
            ${escapeHtml(
              account.gradeLevel || "—"
            )}
          </td>

          <td>
            ${escapeHtml(
              account.section || "—"
            )}
          </td>

          <td>
            ${escapeHtml(
              account.studentId || "—"
            )}
          </td>

          <td class="password-cell">
            ${escapeHtml(
              account.tempPass || "—"
            )}
          </td>
        `;


        tbody.appendChild(
          row
        );

      }
    );


    if (message) {

      message.textContent =
        `${bulkCreatedAccounts.length} learner account(s) were created successfully.`;

    }


    section.classList.remove(
      "hidden"
    );
  }

  function hideCreatedAccounts() {

    const section =
      $("bulkCreatedAccounts");

    if (!section) return;

    section.classList.add(
      "hidden"
    );


    const tbody =
      $("bulkCreatedAccountsTbody");

    if (tbody) {
      tbody.innerHTML = "";
    }


    bulkCreatedAccounts = [];
  }

  // =====================================================
  // DOWNLOAD CREATED ACCOUNTS
  // =====================================================

  function downloadCreatedAccounts() {

    if (
      typeof XLSX === "undefined"
    ) {

      alert(
        "Excel functionality is unavailable. Please check the SheetJS library."
      );

      return;
    }


    if (
      !bulkCreatedAccounts.length
    ) {

      alert(
        "There are no created accounts to download."
      );

      return;
    }


    const rows =
      bulkCreatedAccounts.map(
        (account) => ({

          "First Name":
            account.firstName || "",

          "Last Name":
            account.lastName || "",

          "LRN":
            account.lrn || "",

          "Grade Level":
            account.gradeLevel || "",

          "Section":
            account.section || "",

          "Student ID":
            account.studentId || "",

          "Temporary Password":
            account.tempPass || "",

        })
      );


    const worksheet =
      XLSX.utils.json_to_sheet(
        rows
      );


    worksheet["!cols"] = [
      { wch: 18 },
      { wch: 22 },
      { wch: 18 },
      { wch: 18 },
      { wch: 18 },
      { wch: 20 },
      { wch: 24 },
    ];


    const workbook =
      XLSX.utils.book_new();


    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Created Accounts"
    );


    XLSX.writeFile(
      workbook,
      "BLIMS_Created_Learner_Accounts.xlsx"
    );
  }

  // =====================================================
  // BULK CREATE SUBMIT
  // =====================================================

  async function submitBulkCreate() {

    clearBulkCreateError();


    const validationError =
      validateBulkLearners();


    if (validationError) {

      setBulkCreateError(
        validationError
      );

      return;
    }


    const learners =
      getBulkLearners();


    const submitButton =
      $("bulkCreateSubmitBtn");


    try {

      if (submitButton) {

        submitButton.disabled =
          true;

        submitButton.textContent =
          "Creating...";

      }


      /*
        =================================================
        BACKEND CONNECTION
        =================================================

        This is intentionally prepared for
        the future backend endpoint.

        Payload:

        {
          learners: [
            {
              firstName: "Juan",
              lastName: "Dela Cruz",
              lrn: "123456789012",
              gradeLevel: "Grade 6",
              section: "Mabini"
            }
          ]
        }

        Grade Level and Section may be "".

        Expected backend response:

        {
          students: [
            {
              firstName: "Juan",
              lastName: "Dela Cruz",
              lrn: "123456789012",
              gradeLevel: "Grade 6",
              section: "Mabini",
              studentId: "STU-000001",
              tempPass: "X7kP9mQ2"
            }
          ]
        }
      */


      /*
        FRONTEND ONLY FOR NOW

        We do NOT generate fake credentials.

        This makes sure Student IDs and temporary
        passwords come from the backend once connected.
      */

      console.log(
        "Bulk learners ready for backend:",
        {
          learners,
        }
      );


      alert(
        `${learners.length} learner(s) passed validation and are ready for backend creation.`
      );


    } catch (error) {

      console.error(
        "Bulk create error:",
        error
      );

      setBulkCreateError(
        error.message ||
        "Failed to create learners."
      );

    } finally {

      if (submitButton) {

        submitButton.disabled =
          false;

        submitButton.textContent =
          "Create Learners";

      }

    }
  }

  // =====================================================
  // EVENTS
  // =====================================================

  function bindEvents() {

    // ===================================================
    // ADD NEW
    // ===================================================

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


    // ===================================================
    // BULK CREATE
    // ===================================================

    $("bulkCreateBtn")
      ?.addEventListener(
        "click",
        () => {

          /*
            No classes are loaded here.

            Grade Level and Section are optional,
            so Bulk Create does not depend on the
            class summary endpoint.
          */

          showBulkCreateView();

        }
      );


    // ===================================================
    // ADD ANOTHER BULK LEARNER
    // ===================================================

    $("addBulkLearnerBtn")
      ?.addEventListener(
        "click",
        () => {

          createBulkLearnerRow();

        }
      );


    // ===================================================
    // CANCEL BULK CREATE
    // ===================================================

    $("bulkCancelBtn")
      ?.addEventListener(
        "click",
        () => {

          hideBulkCreateView();

        }
      );


    // ===================================================
    // SUBMIT BULK CREATE
    // ===================================================

    $("bulkCreateSubmitBtn")
      ?.addEventListener(
        "click",
        submitBulkCreate
      );


    // ===================================================
    // UPLOAD EXCEL
    // ===================================================

    $("bulkUploadBtn")
      ?.addEventListener(
        "click",
        () => {

          $("bulkExcelInput")
            ?.click();

        }
      );


    // ===================================================
    // EXCEL FILE SELECTED
    // ===================================================

    $("bulkExcelInput")
      ?.addEventListener(
        "change",
        handleBulkExcelUpload
      );


    // ===================================================
    // DOWNLOAD TEMPLATE
    // ===================================================

    $("bulkDownloadTemplateBtn")
      ?.addEventListener(
        "click",
        downloadBulkTemplate
      );


    // ===================================================
    // DOWNLOAD CREATED ACCOUNTS
    // ===================================================

    $("bulkDownloadAccountsBtn")
      ?.addEventListener(
        "click",
        downloadCreatedAccounts
      );


    // ===================================================
    // DONE
    // ===================================================

    $("bulkDoneBtn")
      ?.addEventListener(
        "click",
        async () => {

          hideCreatedAccounts();

          hideBulkCreateView();

          try {

            await loadStudents();

          } catch (error) {

            console.warn(
              "Failed to refresh learners:",
              error
            );

          }

        }
      );


    // ===================================================
    // CANCEL INDIVIDUAL FORM
    // ===================================================

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


    // ===================================================
    // RESET
    // ===================================================

    $("resetBtn")
      ?.addEventListener(
        "click",
        async () => {

          if (
            editingStudentId
          ) {

            await resetEditForm();

            return;
          }

          clearForm();

          await loadProvinces();

        }
      );


    // ===================================================
    // SAVE
    // ===================================================

    $("saveBtn")
      ?.addEventListener(
        "click",
        saveStudent
      );


    // ===================================================
    // SEARCH
    // ===================================================

    $("searchInput")
      ?.addEventListener(
        "input",
        renderStudentsTable
      );


    // ===================================================
    // CLASS FILTER
    // ===================================================

    $("classFilter")
      ?.addEventListener(
        "change",
        renderStudentsTable
      );


    // ===================================================
    // ADDRESS
    // ===================================================

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


    // ===================================================
    // STUDENT TABLE ACTIONS
    // ===================================================

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


      // Individual form filters

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


      // Initial page

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