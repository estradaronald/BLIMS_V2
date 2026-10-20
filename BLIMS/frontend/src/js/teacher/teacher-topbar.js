// frontend/src/js/teacher/teacher-topbar.js

(function () {
  // ==========================================
  // LOAD CURRENT USER
  // ==========================================

  async function loadCurrentUser() {
    const nameEl = document.getElementById("tbName");
    const welcomeNameEl = document.getElementById("welcomeName");

    try {
      const response = await fetch("/api/auth/me", {
        credentials: "include",
      });

      const data = await response.json();

      console.log("AUTH /me RESPONSE:", data);

      if (!response.ok) {
        console.error("AUTH /me FAILED:", response.status, data);

        if (nameEl) {
          nameEl.textContent = "User";
        }

        if (welcomeNameEl) {
          welcomeNameEl.textContent = "User";
        }

        return;
      }

      if (!data?.user) {
        console.error("AUTH /me returned no user:", data);

        if (nameEl) {
          nameEl.textContent = "User";
        }

        if (welcomeNameEl) {
          welcomeNameEl.textContent = "User";
        }

        return;
      }

      const user = data.user;

      console.log("CURRENT USER:", user);
      console.log("FIRST NAME:", user.first_name);
      console.log("LAST NAME:", user.last_name);

      const firstName = String(user.first_name || "").trim();
      const lastName = String(user.last_name || "").trim();

      const name = [lastName, firstName]
        .filter(Boolean)
        .join(", ") || "User";

      // Display name in the topbar
      if (nameEl) {
        nameEl.textContent = name;
      }

      // Display the SAME name in "Welcome back"
      if (welcomeNameEl) {
        welcomeNameEl.textContent = name;
      }

    } catch (err) {
      console.error("Failed to load current user:", err);

      if (nameEl) {
        nameEl.textContent = "User";
      }

      if (welcomeNameEl) {
        welcomeNameEl.textContent = "User";
      }
    }
  }


  // ==========================================
  // LOGOUT
  // ==========================================

  function setupLogout() {
    const topbarLogout = document.getElementById("topbarLogout");

    if (!topbarLogout) return;

    topbarLogout.addEventListener("click", async () => {
      try {
        await fetch("/api/auth/logout", {
          method: "POST",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        });
      } catch (err) {
        console.error("Logout request failed:", err);
      }

      localStorage.removeItem("token");
      localStorage.removeItem("user");

      window.location.replace("/");
    });
  }


  // ==========================================
  // INITIALIZE TOPBAR
  // ==========================================

  document.addEventListener("DOMContentLoaded", () => {
    loadCurrentUser();
    setupLogout();
  });
})();