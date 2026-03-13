// frontend/src/js/change-password.js
(function () {
  if (window.__changePasswordInit) return;
  window.__changePasswordInit = true;

  const $ = (id) => document.getElementById(id);

  // Elements
  const form = $("changePassForm");
  const msg = $("cpMsg");
  const newPass = $("newPassword");
  const confirmPass = $("confirmPassword");

  const toggleNewBtn = $("toggleNewPassword");
  const eyeNewIcon = $("eyeNewIcon");
  const eyeNewOffIcon = $("eyeNewOffIcon");

  const toggleConfirmBtn = $("toggleConfirmPassword");
  const eyeConfirmIcon = $("eyeConfirmIcon");
  const eyeConfirmOffIcon = $("eyeConfirmOffIcon");

  const logoutBtn = $("cpLogout");

  // Rules UI
  const ruleLen = $("ruleLen");
  const ruleUpper = $("ruleUpper");
  const ruleLower = $("ruleLower");
  const ruleNum = $("ruleNum");
  const ruleSym = $("ruleSym");
  const ruleMatch = $("ruleMatch");

  const strengthLabel = $("strengthLabel");
  const strengthFill = $("strengthFill");

  // CSRF
  const CSRF_ENDPOINT = "/api/csrf-token";
  let csrfToken = "";

  // Redirect map
  const DASH_BY_ROLE = {
    admin: "/src/pages/admin/dashboard.html",
    teacher: "/src/pages/teachers/teacher-dashboard.html",
    student: "/src/pages/students/student-dashboard.html",
  };

  function setMsg(text, isError = true) {
    if (!msg) return;
    msg.textContent = text || "";
    msg.style.color = isError ? "#c0392b" : "#0f766e";
  }

  function togglePassword(inputEl, eyeEl, eyeOffEl) {
    if (!inputEl) return;
    const isHidden = inputEl.type === "password";
    inputEl.type = isHidden ? "text" : "password";
    if (eyeEl) eyeEl.style.display = isHidden ? "none" : "";
    if (eyeOffEl) eyeOffEl.style.display = isHidden ? "" : "none";
  }

  function setRule(el, ok) {
    if (!el) return;
    el.classList.toggle("is-pass", !!ok);
  }

  function computeRules(pw, confirm) {
    const len = pw.length >= 12;
    const upper = /[A-Z]/.test(pw);
    const lower = /[a-z]/.test(pw);
    const num = /[0-9]/.test(pw);
    const sym = /[^A-Za-z0-9]/.test(pw);
    const match = pw.length > 0 && pw === confirm;

    return { len, upper, lower, num, sym, match };
  }

  function computeStrength(rules) {
    const score =
      (rules.len ? 1 : 0) +
      (rules.upper ? 1 : 0) +
      (rules.lower ? 1 : 0) +
      (rules.num ? 1 : 0) +
      (rules.sym ? 1 : 0);

    const pct = (score / 5) * 100;

    let label = "Weak";
    if (score >= 5) label = "Very Strong";
    else if (score === 4) label = "Strong";
    else if (score === 3) label = "Medium";

    return { score, pct, label };
  }

  function renderPolicy() {
    const pw = newPass?.value || "";
    const cf = confirmPass?.value || "";

    const rules = computeRules(pw, cf);

    setRule(ruleLen, rules.len);
    setRule(ruleUpper, rules.upper);
    setRule(ruleLower, rules.lower);
    setRule(ruleNum, rules.num);
    setRule(ruleSym, rules.sym);
    setRule(ruleMatch, rules.match);

    const { pct, label } = computeStrength(rules);
    if (strengthLabel) strengthLabel.textContent = `Strength: ${label}`;
    if (strengthFill) strengthFill.style.width = `${pct}%`;

    return rules;
  }

  async function fetchCsrf() {
    try {
      const res = await fetch(CSRF_ENDPOINT, {
        method: "GET",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.ok && typeof data.csrfToken === "string") {
        csrfToken = data.csrfToken;
      }
    } catch (err) {
      console.warn("Failed to fetch CSRF token:", err);
    }
  }

  async function apiFetch(url, options = {}) {
    const method = String(options.method || "GET").toUpperCase();

    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers || {}),
    };

    // attach csrf token for unsafe methods
    if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") {
      if (!csrfToken) {
        await fetchCsrf();
      }
      if (csrfToken) {
        headers["X-CSRF-Token"] = csrfToken;
      }
    }

    const res = await fetch(url, {
      credentials: "include",
      ...options,
      headers,
    });

    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    return { res, data };
  }

  async function guardSession() {
    const { res } = await apiFetch("/api/auth/me", { method: "GET" });
    if (!res.ok) {
      window.location.replace("/");
      return false;
    }
    return true;
  }

  async function doLogout() {
    try {
      await apiFetch("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      window.location.replace("/");
    }
  }

  function validateClientSide(rules) {
    if (!rules.len) return "Password must be at least 12 characters.";
    if (!rules.upper) return "Password must include at least 1 uppercase letter.";
    if (!rules.lower) return "Password must include at least 1 lowercase letter.";
    if (!rules.num) return "Password must include at least 1 number.";
    if (!rules.sym) return "Password must include at least 1 symbol.";
    if (!rules.match) return "Passwords do not match.";
    return null;
  }

  function pickRedirect(role) {
    const key = String(role || "").toLowerCase();
    return DASH_BY_ROLE[key] || "/";
  }

  async function submitChangePassword(ev) {
    ev.preventDefault();
    setMsg("");

    const ok = await guardSession();
    if (!ok) return;

    const rules = renderPolicy();
    const err = validateClientSide(rules);
    if (err) {
      setMsg(err, true);
      return;
    }

    const payload = {
      newPassword: newPass.value,
      confirmPassword: confirmPass.value,
    };

    const { res, data } = await apiFetch("/api/auth/change-password", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (!res.ok || !data?.ok) {
      const message =
        data?.message ||
        (res.status === 401
          ? "Session expired. Please log in again."
          : res.status === 403
          ? "Forbidden. Please refresh the page and try again."
          : "Unable to update password. Please try again.");

      setMsg(message, true);

      if (res.status === 401) {
        window.location.replace("/");
      }
      return;
    }

    setMsg("Password updated successfully. Redirecting…", false);

    const redirect = pickRedirect(data.role);
    window.location.replace(redirect);
  }

  async function init() {
    await fetchCsrf();

    await guardSession();
    window.addEventListener("pageshow", () => guardSession());

    if (toggleNewBtn) {
      toggleNewBtn.addEventListener("click", () =>
        togglePassword(newPass, eyeNewIcon, eyeNewOffIcon)
      );
    }

    if (toggleConfirmBtn) {
      toggleConfirmBtn.addEventListener("click", () =>
        togglePassword(confirmPass, eyeConfirmIcon, eyeConfirmOffIcon)
      );
    }

    if (newPass) newPass.addEventListener("input", renderPolicy);
    if (confirmPass) confirmPass.addEventListener("input", renderPolicy);
    renderPolicy();

    if (form) form.addEventListener("submit", submitChangePassword);

    if (logoutBtn) logoutBtn.addEventListener("click", doLogout);
  }

  document.addEventListener("DOMContentLoaded", init);
})();