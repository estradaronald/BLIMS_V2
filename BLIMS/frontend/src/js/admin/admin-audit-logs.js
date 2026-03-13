// frontend/src/js/admin/admin-audit-logs.js
(function () {
  if (window.__adminAuditLogsInit) return;
  window.__adminAuditLogsInit = true;

  const $ = (id) => document.getElementById(id);

  const state = {
    page: 1,
    limit: 25,
    pages: 1,
    total: 0,
    q: "",
    action: "",
    outcome: "",
  };

  function fmtDate(iso) {
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso || "";
    }
  }

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function showError(msg) {
    const tbody = $("auditBody");
    const meta = $("auditMeta");
    if (meta) meta.textContent = msg || "Failed to load audit logs.";
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="padding:14px;opacity:.8;">
            ${esc(msg || "Failed to load audit logs.")}
          </td>
        </tr>
      `;
    }
  }

  function renderRows(rows) {
    const tbody = $("auditBody");
    if (!tbody) return;

    if (!rows || rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="padding:14px;opacity:.75;">No audit logs found.</td></tr>`;
      return;
    }

    tbody.innerHTML = rows
      .map((r) => {
        const user = r.actor_username || "—";
        const role = r.actor_role || "—";
        const msg = r.message || "";
        const ip = r.ip || "—";

        return `
          <tr>
            <td>${esc(fmtDate(r.createdAt))}</td>
            <td>${esc(user)}</td>
            <td>${esc(role)}</td>
            <td>${esc(r.action)}</td>
            <td>${esc(r.outcome)}</td>
            <td>${esc(msg)}</td>
            <td>${esc(ip)}</td>
          </tr>
        `;
      })
      .join("");
  }

  function renderMeta() {
    const meta = $("auditMeta");
    const label = $("pageLabel");
    if (meta) meta.textContent = `Showing page ${state.page} of ${state.pages} • Total: ${state.total}`;
    if (label) label.textContent = `Page ${state.page}`;

    const prev = $("prevBtn");
    const next = $("nextBtn");
    if (prev) prev.disabled = state.page <= 1;
    if (next) next.disabled = state.page >= state.pages;
  }

  async function fetchLogs() {
    const qs = new URLSearchParams();
    qs.set("page", String(state.page));
    qs.set("limit", String(state.limit));
    if (state.q) qs.set("q", state.q);
    if (state.action) qs.set("action", state.action);
    if (state.outcome) qs.set("outcome", state.outcome);

    const url = `/api/admin/audit-logs?${qs.toString()}`;

    let res;
    try {
      res = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
    } catch (e) {
      showError("Network error: unable to reach server.");
      return;
    }

    // ✅ Only redirect for auth problems
    if (res.status === 401 || res.status === 403) {
      location.replace("/");
      return;
    }

    // ✅ Handle 404 separately (this is the most likely issue)
    if (res.status === 404) {
      showError("Audit Logs API not found (404). Backend route /api/admin/audit-logs is not mounted.");
      return;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      showError(`Failed to load audit logs (${res.status}). ${text || ""}`.trim());
      return;
    }

    const data = await res.json().catch(() => null);
    if (!data) {
      showError("Invalid server response.");
      return;
    }

    state.page = data.page || 1;
    state.limit = data.limit || 25;
    state.total = data.total || 0;
    state.pages = data.pages || 1;

    renderRows(data.rows || []);
    renderMeta();
  }

  function applyFilters() {
    state.page = 1;
    state.q = ($("qInput")?.value || "").trim();
    state.action = $("actionSelect")?.value || "";
    state.outcome = $("outcomeSelect")?.value || "";
    fetchLogs().catch(() => {});
  }

  function clearFilters() {
    state.page = 1;
    state.q = "";
    state.action = "";
    state.outcome = "";

    const q = $("qInput");
    const a = $("actionSelect");
    const o = $("outcomeSelect");
    if (q) q.value = "";
    if (a) a.value = "";
    if (o) o.value = "";

    fetchLogs().catch(() => {});
  }

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

    $("qInput")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") applyFilters();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    initControls();
    fetchLogs().catch(() => {});
  });
})();