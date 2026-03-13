// frontend/src/js/auth/admin-guard.js
(function () {
  if (window.__adminGuardInit) return;
  window.__adminGuardInit = true;

  async function apiMe() {
    const res = await fetch("/api/auth/me", {
      method: "GET",
      credentials: "include",
      headers: { "Accept": "application/json" },
    });
    return res;
  }

  function kickToLogin() {
    // Use replace so the protected page isn't kept in history
    window.location.replace("/");
  }

  async function enforce() {
    try {
      const res = await apiMe();
      if (!res.ok) return kickToLogin();

      const data = await res.json().catch(() => null);
      // Expecting { user: ... } or similar. If your /me returns something else, keep only res.ok check.
      const role = data?.user?.role;

      // ✅ Admin-only guard
      if (role !== "admin") return kickToLogin();
    } catch {
      return kickToLogin();
    }
  }

  // Run on normal load
  document.addEventListener("DOMContentLoaded", enforce);

  // ✅ Handles "Back button" / BFCache restores
  window.addEventListener("pageshow", (ev) => {
    // ev.persisted means the page was restored from cache in many browsers
    // even if false, it's safe to re-check
    enforce();
  });
})();