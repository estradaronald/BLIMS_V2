// frontend/src/js/auth/teacher-guard.js
(function () {
  if (window.__teacherGuardInit) return;
  window.__teacherGuardInit = true;

  async function apiMe() {
    const res = await fetch("/api/auth/me", {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
    });
    return res;
  }

  function kickToLogin() {
    window.location.replace("/");
  }

  async function enforce() {
    try {
      const res = await apiMe();
      if (!res.ok) return kickToLogin();

      const data = await res.json().catch(() => null);
      const role = data?.user?.role;

      // ✅ Teacher-only guard
      if (role !== "teacher") return kickToLogin();
    } catch {
      return kickToLogin();
    }
  }

  document.addEventListener("DOMContentLoaded", enforce);

  window.addEventListener("pageshow", () => {
    enforce();
  });
})();