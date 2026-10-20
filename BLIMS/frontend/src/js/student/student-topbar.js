// frontend/src/js/student/student-topbar.js

(function () {
  async function loadCurrentUser() {
    try {
      const response = await fetch("/api/auth/me", {
        credentials: "include",
      });

      const data = await response.json();

      if (!response.ok || !data?.user) {
        return;
      }

      const user = data.user;

      const firstName = user.first_name || "";
      const lastName = user.last_name || "";

      const name = `${lastName}, ${firstName}`
        .replace(/^,\s*|\s*,$/g, "")
        .trim();

      // Topbar name
      const nameEl = document.getElementById("tbName");

      if (nameEl) {
        nameEl.textContent = name || "User";
      }

      // Welcome message
      const welcomeNameEl = document.getElementById("welcomeName");

      if (welcomeNameEl) {
        welcomeNameEl.textContent = name || "User";
      }
    } catch (err) {
      console.error("Failed to load current user:", err);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadCurrentUser();
  });
})();