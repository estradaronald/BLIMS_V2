// frontend/src/js/auth/login.js
(function () {
  if (window.__loginInit) return;
  window.__loginInit = true;

  const $ = (id) => document.getElementById(id);

  const loginForm = $("loginForm");
  const usernameEl = $("username");
  const passwordEl = $("password");
  const loginBtn = $("loginBtn");
  const loginMsg = $("loginMsg");

  const viewLogin = $("viewLogin");
  const viewForgot = $("viewForgot");
  const viewMFA = $("viewMFA");

  const forgotLink = $("forgotLink");
  const backToLogin = $("backToLogin");
  const backToLoginFromMFA = $("backToLoginFromMFA");

  const togglePasswordBtn = $("togglePassword");
  const eyeIcon = $("eyeIcon");
  const eyeOffIcon = $("eyeOffIcon");

  const capA = $("capA");
  const capB = $("capB");
  const capAns = $("capAns");
  const capRefresh = $("capRefresh");
  const capMsg = $("capMsg");

  const mfaForm = $("mfaForm");
  const mfaCodeEl = $("mfaCode");
  const mfaBtn = $("mfaBtn");
  const mfaMsg = $("mfaMsg");
  const mfaResendBtn = $("mfaResend");

  const LOGIN_ENDPOINT = "/api/auth/login";
  const MFA_VERIFY_ENDPOINT = "/api/auth/mfa/verify";
  const CSRF_ENDPOINT = "/api/auth/csrf"; 
  const CHANGE_PASSWORD_PAGE = "/change-password.html";

  const DASH_BY_ROLE = {
    admin: "/src/pages/admin/dashboard.html",
    teacher: "/src/pages/teachers/teacher-dashboard.html",
    student: "/src/pages/students/student-dashboard.html",
  };
  const DEFAULT_REDIRECT = "/src/pages/admin/dashboard.html";

  let pendingMfaUserId = null;
  let pendingMfaUsername = null;

  // ✅ CSRF token stored in memory
  let csrfToken = "";

  function setMsg(text, isError = true) {
    if (!loginMsg) return;
    loginMsg.textContent = text || "";
    loginMsg.style.color = isError ? "#c00" : "#0a7a2f";
  }
  function setCapMsg(text, isError = true) {
    if (!capMsg) return;
    capMsg.textContent = text || "";
    capMsg.style.color = isError ? "#c00" : "#0a7a2f";
  }
  function setMfaMsg(text, isError = true) {
    if (!mfaMsg) return;
    mfaMsg.textContent = text || "";
    mfaMsg.style.color = isError ? "#c00" : "#0a7a2f";
  }

  function setLoading(isLoading) {
    if (!loginBtn) return;
    loginBtn.disabled = isLoading;
    loginBtn.textContent = isLoading ? "Signing in..." : "Sign In";
  }

  function setMfaLoading(isLoading) {
    if (!mfaBtn) return;
    mfaBtn.disabled = isLoading;
    mfaBtn.textContent = isLoading ? "Verifying..." : "Verify Code";
  }

  function showView(which) {
    if (viewLogin) viewLogin.style.display = which === "login" ? "block" : "none";
    if (viewForgot) viewForgot.style.display = which === "forgot" ? "block" : "none";
    if (viewMFA) viewMFA.style.display = which === "mfa" ? "block" : "none";
    setMsg("");
    setCapMsg("");
    setMfaMsg("");
  }

  function pickRedirectByRole(role) {
    if (!role) return DEFAULT_REDIRECT;
    return DASH_BY_ROLE[role] || DEFAULT_REDIRECT;
  }

  // CAPTCHA
  let currentA = 0;
  let currentB = 0;

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function newCaptcha() {
    currentA = randInt(1, 9);
    currentB = randInt(1, 9);
    if (capA) capA.textContent = String(currentA);
    if (capB) capB.textContent = String(currentB);
    if (capAns) capAns.value = "";
    setCapMsg("");
  }

  function captchaOK() {
    const ans = (capAns?.value || "").trim();
    if (!ans) {
      setCapMsg("Please answer the math CAPTCHA.", true);
      return false;
    }
    const n = Number(ans);
    if (!Number.isFinite(n)) {
      setCapMsg("CAPTCHA must be a number.", true);
      return false;
    }
    if (n !== currentA + currentB) {
      setCapMsg("Wrong CAPTCHA. Please try again.", true);
      newCaptcha();
      return false;
    }
    setCapMsg("CAPTCHA OK.", false);
    return true;
  }

  function initPasswordToggle() {
    if (!togglePasswordBtn || !passwordEl) return;
    togglePasswordBtn.addEventListener("click", () => {
      const isHidden = passwordEl.type === "password";
      passwordEl.type = isHidden ? "text" : "password";
      if (eyeIcon) eyeIcon.style.display = isHidden ? "none" : "inline";
      if (eyeOffIcon) eyeOffIcon.style.display = isHidden ? "inline" : "none";
    });
  }

  // ✅ Fetch CSRF token once per page load
  async function fetchCsrf() {
    try {
      const res = await fetch(CSRF_ENDPOINT, { credentials: "include" });
      const ct = res.headers.get("content-type") || "";
      if (!res.ok || !ct.includes("application/json")) return;

      const payload = await res.json();
      if (payload?.ok && typeof payload.csrfToken === "string") {
        csrfToken = payload.csrfToken;
      }
    } catch {
      // ignore
    }
  }

  async function postJSON(url, data) {
    const headers = { "Content-Type": "application/json" };
    // ✅ attach CSRF token if we have it
    if (csrfToken) headers["X-CSRF-Token"] = csrfToken;

    const res = await fetch(url, {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify(data),
    });

    let payload = null;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) payload = await res.json();
    else payload = { ok: false, message: (await res.text()).slice(0, 200) };

    return { res, payload };
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();

    setMsg("");
    setCapMsg("");

    const username = (usernameEl?.value || "").trim();
    const password = (passwordEl?.value || "").trim();

    if (!username || !password) {
      setMsg("Please enter your username and password.", true);
      return;
    }

    if (!captchaOK()) return;

    setLoading(true);

    try {
      const { res, payload } = await postJSON(LOGIN_ENDPOINT, { username, password });

      if (!res.ok || !payload?.ok) {
        const msg =
          payload?.message ||
          (res.status === 401 ? "Invalid username or password." : "Login failed.");
        setMsg(msg, true);
        return;
      }

      if (payload.mfaRequired) {
        pendingMfaUserId = payload.userId || null;
        pendingMfaUsername = username;

        if (!pendingMfaUserId) {
          setMsg("MFA error: missing userId.", true);
          return;
        }

        setMfaMsg("We sent a 6-digit code to your admin email.", false);
        if (mfaCodeEl) mfaCodeEl.value = "";
        showView("mfa");
        return;
      }

      if (payload.mustChangePassword) {
        window.location.replace(CHANGE_PASSWORD_PAGE);
        return;
      }

      const redirect = pickRedirectByRole(payload.role);
      window.location.replace(redirect);
    } catch (err) {
      console.error(err);
      setMsg("Network error. Check if the server is running.", true);
    } finally {
      setLoading(false);
    }
  }

  async function handleMfaSubmit(e) {
    e.preventDefault();
    setMfaMsg("");

    const otp = (mfaCodeEl?.value || "").trim();

    if (!pendingMfaUserId) {
      setMfaMsg("Session expired. Please login again.", true);
      showView("login");
      return;
    }

    if (!otp || otp.length < 6) {
      setMfaMsg("Please enter the 6-digit code.", true);
      return;
    }

    setMfaLoading(true);

    try {
      const { res, payload } = await postJSON(MFA_VERIFY_ENDPOINT, {
        userId: pendingMfaUserId,
        otp,
      });

      if (!res.ok || !payload?.ok) {
        setMfaMsg(payload?.message || "Invalid code.", true);
        return;
      }

      if (payload.mustChangePassword) {
        window.location.replace(CHANGE_PASSWORD_PAGE);
        return;
      }

      const redirect = pickRedirectByRole(payload.role);
      window.location.replace(redirect);
    } catch (err) {
      console.error(err);
      setMfaMsg("Network error. Please try again.", true);
    } finally {
      setMfaLoading(false);
    }
  }

  function handleMfaResend() {
    if (!pendingMfaUsername) {
      setMfaMsg("Please login again to resend.", true);
      showView("login");
      return;
    }
    setMfaMsg("To resend, please sign in again.", false);
    showView("login");
  }

  function init() {
    showView("login");
    newCaptcha();
    if (capRefresh) capRefresh.addEventListener("click", newCaptcha);

    // ✅ CSRF token fetch (non-blocking)
    fetchCsrf();

    initPasswordToggle();

    if (forgotLink) {
      forgotLink.addEventListener("click", (e) => {
        e.preventDefault();
        showView("forgot");
      });
    }

    if (backToLogin) {
      backToLogin.addEventListener("click", (e) => {
        e.preventDefault();
        showView("login");
      });
    }

    if (backToLoginFromMFA) {
      backToLoginFromMFA.addEventListener("click", (e) => {
        e.preventDefault();
        pendingMfaUserId = null;
        pendingMfaUsername = null;
        showView("login");
      });
    }

    if (loginForm) loginForm.addEventListener("submit", handleLoginSubmit);
    if (mfaForm) mfaForm.addEventListener("submit", handleMfaSubmit);
    if (mfaResendBtn) mfaResendBtn.addEventListener("click", handleMfaResend);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();