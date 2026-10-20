// frontend/src/js/admin/admin-audit-logs.js

(function () {
  if (window.__adminAuditLogsInit) return;

  window.__adminAuditLogsInit = true;

  // =====================================================
  // HELPERS
  // =====================================================

  const $ = (id) => document.getElementById(id);

  // =====================================================
  // STATE
  // =====================================================

  const state = {
    page: 1,

    limit: 10,

    pages: 1,

    total: 0,

    q: "",

    action: "",

    outcome: "",

    date: "",
  };

  // =====================================================
  // DATE FORMAT
  // =====================================================

  function fmtDate(iso) {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso || "";
    }
  }

  // =====================================================
  // ESCAPE HTML
  // =====================================================

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")

      .replaceAll("<", "&lt;")

      .replaceAll(">", "&gt;")

      .replaceAll('"', "&quot;")

      .replaceAll("'", "&#39;");
  }

  // =====================================================
  // OUTCOME BADGE
  // =====================================================

  function outcomeBadge(outcome) {
    const value = String(outcome || "")
      .trim()
      .toUpperCase();

    let className = "info";

    if (value === "SUCCESS") {
      className = "success";
    } else if (value === "FAIL") {
      className = "fail";
    } else if (value === "INFO") {
      className = "info";
    }

    return `
      <span class="audit-badge ${className}">
        ${esc(value || "—")}
      </span>
    `;
  }

  // =====================================================
  // ERROR
  // =====================================================

  function showError(msg) {
    const tbody = $("auditBody");

    const meta = $("auditMeta");

    if (meta) {
      meta.textContent = msg || "Failed to load audit logs.";
    }

    if (tbody) {
      tbody.innerHTML = `
        <tr>

          <td
            colspan="8"
            class="audit-empty"
          >
            ${esc(msg || "Failed to load audit logs.")}
          </td>

        </tr>
      `;
    }
  }

  // =====================================================
  // RENDER ROWS
  // =====================================================

  function renderRows(rows) {
    const tbody = $("auditBody");

    if (!tbody) return;

    if (!rows || rows.length === 0) {
      tbody.innerHTML = `
        <tr>

          <td
            colspan="8"
            class="audit-empty"
          >
            No audit logs found.
          </td>

        </tr>
      `;

      return;
    }

    tbody.innerHTML = rows

      .map((r, idx) => {
        const user = r.actor_username || "—";

        const role = r.actor_role || "—";

        const msg = r.message || "—";

        const ip = r.ip || "—";

        const rowNumber = (state.page - 1) * state.limit + idx + 1;

        return `
          <tr>

            <td class="audit-number">
              ${String(rowNumber).padStart(2, "0")}
            </td>

            <td class="audit-date-cell">
              ${esc(fmtDate(r.createdAt))}
            </td>

            <td>
              ${esc(user)}
            </td>

            <td>
              <span class="audit-role">
                ${esc(role)}
              </span>
            </td>

            <td class="audit-action">
              ${esc(r.action || "—")}
            </td>

            <td>
              ${outcomeBadge(r.outcome)}
            </td>

            <td class="audit-message">
              ${esc(msg)}
            </td>

            <td class="audit-ip">
              ${esc(ip)}
            </td>

          </tr>
        `;
      })

      .join("");
  }

  // =====================================================
  // RENDER META
  // =====================================================

  function renderMeta() {
    const meta = $("auditMeta");

    const start = state.total === 0 ? 0 : (state.page - 1) * state.limit + 1;

    const end = Math.min(state.page * state.limit, state.total);

    if (meta) {
      meta.textContent = `Showing ${start} to ${end} of ${state.total} logs`;
    }

    renderPagination();
  }

  // =====================================================
  // PAGINATION
  // =====================================================

  function renderPagination() {
    const container = $("pageNumbers");

    if (!container) return;

    container.innerHTML = "";

    const maxVisible = 5;

    let startPage = Math.max(1, state.page - 2);

    let endPage = Math.min(state.pages, startPage + maxVisible - 1);

    if (endPage - startPage + 1 < maxVisible) {
      startPage = Math.max(1, endPage - maxVisible + 1);
    }

    for (let page = startPage; page <= endPage; page++) {
      const btn = document.createElement("button");

      btn.type = "button";

      btn.className = "audit-page-number";

      if (page === state.page) {
        btn.classList.add("active");
      }

      btn.textContent = page;

      btn.addEventListener("click", () => {
        if (page === state.page) {
          return;
        }

        state.page = page;

        fetchLogs().catch(() => {});
      });

      container.appendChild(btn);
    }

    if (state.pages > endPage) {
      const dots = document.createElement("span");

      dots.className = "audit-page-dots";

      dots.textContent = "…";

      container.appendChild(dots);

      const last = document.createElement("button");

      last.type = "button";

      last.className = "audit-page-number";

      last.textContent = state.pages;

      last.addEventListener("click", () => {
        state.page = state.pages;

        fetchLogs().catch(() => {});
      });

      container.appendChild(last);
    }

    const prev = $("prevBtn");

    const next = $("nextBtn");

    if (prev) {
      prev.disabled = state.page <= 1;
    }

    if (next) {
      next.disabled = state.page >= state.pages;
    }
  }

  // =====================================================
  // FETCH LOGS
  // =====================================================

  async function fetchLogs() {
    const qs = new URLSearchParams();

    qs.set("page", String(state.page));

    qs.set("limit", String(state.limit));

    if (state.q) {
      qs.set("q", state.q);
    }

    if (state.action) {
      qs.set("action", state.action);
    }

    if (state.outcome) {
      qs.set("outcome", state.outcome);
    }

    if (state.date) {
      qs.set("date", state.date);
    }

    const url = `/api/admin/audit-logs?${qs.toString()}`;

    let res;

    try {
      res = await fetch(url, {
        method: "GET",

        credentials: "include",

        headers: {
          Accept: "application/json",
        },

        cache: "no-store",
      });
    } catch (e) {
      showError("Network error: unable to reach server.");

      return;
    }

    // =================================================
    // AUTH
    // =================================================

    if (res.status === 401 || res.status === 403) {
      location.replace("/");

      return;
    }

    // =================================================
    // 404
    // =================================================

    if (res.status === 404) {
      showError(
        "Audit Logs API not found (404). Backend route /api/admin/audit-logs is not mounted.",
      );

      return;
    }

    // =================================================
    // OTHER ERROR
    // =================================================

    if (!res.ok) {
      const text = await res.text().catch(() => "");

      showError(
        `Failed to load audit logs (${res.status}). ${text || ""}`.trim(),
      );

      return;
    }

    // =================================================
    // RESPONSE
    // =================================================

    const data = await res.json().catch(() => null);

    if (!data) {
      showError("Invalid server response.");

      return;
    }

    state.page = data.page || 1;

    state.limit = data.limit || state.limit;

    state.total = data.total || 0;

    state.pages = data.pages || 1;

    renderRows(data.rows || []);

    renderMeta();
  }

  // =====================================================
  // APPLY FILTERS
  // =====================================================

  function applyFilters() {
    state.page = 1;

    state.q = ($("qInput")?.value || "").trim();

    state.action = $("actionSelect")?.value || "";

    state.outcome = $("outcomeSelect")?.value || "";

    state.date = $("auditDate")?.value || "";

    fetchLogs().catch(() => {});
  }

  // =====================================================
  // CLEAR FILTERS
  // =====================================================

  function clearFilters() {
    state.page = 1;

    state.q = "";

    state.action = "";

    state.outcome = "";

    state.date = "";

    const q = $("qInput");

    const a = $("actionSelect");

    const o = $("outcomeSelect");

    const date = $("auditDate");

    if (q) {
      q.value = "";
    }

    if (a) {
      a.value = "";
    }

    if (o) {
      o.value = "";
    }

    if (date) {
      date.value = "";
    }

    fetchLogs().catch(() => {});
  }

  // =====================================================
  // CONTROLS
  // =====================================================

  function initControls() {
    $("applyBtn")?.addEventListener("click", applyFilters);

    $("clearBtn")?.addEventListener("click", clearFilters);

    $("prevBtn")?.addEventListener("click", () => {
      if (state.page > 1) {
        state.page -= 1;

        fetchLogs().catch(() => {});
      }
    });

    $("nextBtn")?.addEventListener("click", () => {
      if (state.page < state.pages) {
        state.page += 1;

        fetchLogs().catch(() => {});
      }
    });

    $("limitSelect")?.addEventListener("change", () => {
      state.limit = Number($("limitSelect").value) || 10;

      state.page = 1;

      fetchLogs().catch(() => {});
    });

    $("qInput")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        applyFilters();
      }
    });
  }

  // =====================================================
  // INIT
  // =====================================================

  document.addEventListener("DOMContentLoaded", () => {
    initControls();

    // Audit Logs topbar dropdown
    const userMenuBtn = $("userMenuBtn");
    const userMenu = $("userMenu");
    const logoutBtn = $("topbarLogout");

    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        logoutBtn.disabled = true;

        try {
          await fetch("/api/auth/logout", {
            method: "POST",
            credentials: "include",
          });
        } catch (err) {
          console.error("Logout request failed:", err);
        } finally {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          window.location.href = "/";
        }
      });
    }

    if (userMenuBtn && userMenu) {
      userMenuBtn.addEventListener("click", (event) => {
        event.stopPropagation();
        userMenu.classList.toggle("open");
      });

      document.addEventListener("click", (event) => {
        if (
          !userMenu.contains(event.target) &&
          !userMenuBtn.contains(event.target)
        ) {
          userMenu.classList.remove("open");
        }
      });
    }

    fetchLogs().catch(() => {});
  });
})();
