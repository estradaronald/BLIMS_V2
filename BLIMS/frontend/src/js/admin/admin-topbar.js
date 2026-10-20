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

      const name =
        `${user.last_name || ""}, ${user.first_name || ""}`
          .replace(/^,\s*|\s*,$/g, "")
          .trim();

      const nameEl = document.getElementById("tbName");
      const roleEl = document.getElementById("tbRole");

      if (nameEl) {
        nameEl.textContent = name || "User";
      }

      if (roleEl) {
        roleEl.textContent = user.role
          ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
          : "User";
      }
    } catch (err) {
      console.error("Failed to load current user:", err);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    loadCurrentUser();
  });
})();