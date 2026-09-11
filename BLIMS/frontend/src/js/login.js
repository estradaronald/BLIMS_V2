(function () {
  if (window.__loginInit) return;
  window.__loginInit = true;

  const $ = (id) => document.getElementById(id);

  // =========================
  // LOGIN
  // =========================

  const loginForm = $("loginForm");
  const usernameEl = $("username");
  const passwordEl = $("password");
  const loginBtn = $("loginBtn");
  const loginMsg = $("loginMsg");

  // =========================
  // VIEWS
  // =========================

  const viewLogin = $("viewLogin");
  const viewForgot = $("viewForgot");
  const viewMFA = $("viewMFA");

  // =========================
  // NAVIGATION
  // =========================

  const forgotLink = $("forgotLink");
  const backToLogin = $("backToLogin");
  const backToLoginFromMFA = $("backToLoginFromMFA");

  // =========================
  // PASSWORD TOGGLE
  // =========================

  const togglePasswordBtn = $("togglePassword");
  const eyeIcon = $("eyeIcon");
  const eyeOffIcon = $("eyeOffIcon");

  // =========================
  // CAPTCHA
  // =========================

  const capA = $("capA");
  const capB = $("capB");
  const capAns = $("capAns");
  const capRefresh = $("capRefresh");
  const capMsg = $("capMsg");

  // =========================
  // SECONDARY PIN
  // =========================

  const mfaForm = $("mfaForm");
  const mfaCodeEl = $("mfaCode");
  const mfaBtn = $("mfaBtn");
  const mfaMsg = $("mfaMsg");

  // =========================
  // API ENDPOINTS
  // =========================

  const LOGIN_ENDPOINT = "/api/auth/login";
  const SECONDARY_VERIFY_ENDPOINT =
    "/api/auth/secondary/verify";

  const CSRF_ENDPOINT = "/api/auth/csrf";

  const CHANGE_PASSWORD_PAGE =
    "/change-password.html";

  // =========================
  // DASHBOARDS
  // =========================

  const DASH_BY_ROLE = {
    admin: "/src/pages/admin/dashboard.html",

    teacher:
      "/src/pages/teachers/teacher-dashboard.html",

    student:
      "/src/pages/students/student-dashboard.html",
  };

  const DEFAULT_REDIRECT =
    "/src/pages/admin/dashboard.html";

  // =========================
  // STATE
  // =========================

  let csrfToken = "";
  let captchaAnswer = null;


  // =========================
  // VIEW MANAGEMENT
  // =========================

  function showView(view) {

    const views = [
      viewLogin,
      viewForgot,
      viewMFA,
    ];

    views.forEach((element) => {

      if (!element) return;

      element.classList.remove("is-active");

    });


    if (view === "login" && viewLogin) {
      viewLogin.classList.add("is-active");
    }

    if (view === "forgot" && viewForgot) {
      viewForgot.classList.add("is-active");
    }

    if (view === "secondary" && viewMFA) {
      viewMFA.classList.add("is-active");
    }
  }


  // =========================
  // MESSAGE HELPERS
  // =========================

  function clearMessage(element) {

    if (!element) return;

    element.textContent = "";

    element.classList.remove(
      "error",
      "success"
    );
  }


  function showError(element, message) {

    if (!element) return;

    element.textContent = message;

    element.classList.remove("success");

    element.classList.add("error");
  }


  function showSuccess(element, message) {

    if (!element) return;

    element.textContent = message;

    element.classList.remove("error");

    element.classList.add("success");
  }


  // =========================
  // RESPONSE
  // =========================

  async function parseResponse(response) {

    let payload = {};

    try {
      payload = await response.json();
    } catch {
      payload = {};
    }

    return {
      ok: response.ok,
      status: response.status,
      data: payload,
    };
  }


  // =========================
  // CSRF
  // =========================

  async function loadCsrfToken() {

    try {

      const response = await fetch(
        CSRF_ENDPOINT,
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        }
      );


      const result =
        await parseResponse(response);


      if (
        result.ok &&
        result.data?.csrfToken
      ) {

        csrfToken =
          result.data.csrfToken;
      }

    } catch (error) {

      console.error(
        "Unable to load CSRF token:",
        error
      );
    }
  }


  async function ensureCsrfToken() {

    if (csrfToken) {
      return csrfToken;
    }

    await loadCsrfToken();

    return csrfToken;
  }


  // =========================
  // CAPTCHA
  // =========================

  function generateCaptcha() {

    if (!capA || !capB) {
      return;
    }


    const a =
      Math.floor(Math.random() * 9) + 1;

    const b =
      Math.floor(Math.random() * 9) + 1;


    captchaAnswer = a + b;


    capA.textContent = a;
    capB.textContent = b;


    if (capAns) {
      capAns.value = "";
    }


    clearMessage(capMsg);
  }


  function validateCaptcha() {

    if (
      !capAns ||
      captchaAnswer === null
    ) {
      return true;
    }


    const answer =
      Number(capAns.value.trim());


    if (!Number.isInteger(answer)) {

      showError(
        capMsg,
        "Please solve the CAPTCHA."
      );

      return false;
    }


    if (answer !== captchaAnswer) {

      showError(
        capMsg,
        "Incorrect CAPTCHA answer."
      );

      generateCaptcha();

      return false;
    }


    clearMessage(capMsg);

    return true;
  }


  // =========================
  // PASSWORD TOGGLE
  // =========================

  function setupPasswordToggle() {

    if (
      !togglePasswordBtn ||
      !passwordEl
    ) {
      return;
    }


    togglePasswordBtn.addEventListener(
      "click",
      function () {

        const isPassword =
          passwordEl.type === "password";


        passwordEl.type =
          isPassword
            ? "text"
            : "password";


        if (eyeIcon) {

          eyeIcon.style.display =
            isPassword
              ? "none"
              : "";
        }


        if (eyeOffIcon) {

          eyeOffIcon.style.display =
            isPassword
              ? ""
              : "none";
        }


        togglePasswordBtn.setAttribute(
          "aria-label",
          isPassword
            ? "Hide password"
            : "Show password"
        );
      }
    );
  }


  // =========================
  // REDIRECT
  // =========================

  function getDashboard(role) {

    return (
      DASH_BY_ROLE[role] ||
      DEFAULT_REDIRECT
    );
  }


  function redirectAfterLogin(payload) {

    if (payload?.mustChangePassword) {

      window.location.href =
        CHANGE_PASSWORD_PAGE;

      return;
    }


    window.location.href =
      getDashboard(payload?.role);
  }


  // =========================
  // LOGIN SUBMIT
  // =========================

  async function handleLoginSubmit(event) {

    event.preventDefault();

    clearMessage(loginMsg);


    if (
      !usernameEl ||
      !passwordEl
    ) {
      return;
    }


    const username =
      usernameEl.value.trim();

    const password =
      passwordEl.value;


    if (!username) {

      showError(
        loginMsg,
        "Please enter your username."
      );

      usernameEl.focus();

      return;
    }


    if (!password) {

      showError(
        loginMsg,
        "Please enter your password."
      );

      passwordEl.focus();

      return;
    }


    if (!validateCaptcha()) {
      return;
    }


    const originalText =
      loginBtn
        ? loginBtn.textContent
        : "Sign In";


    if (loginBtn) {

      loginBtn.disabled = true;

      loginBtn.textContent =
        "Signing In...";
    }


    try {

      const token =
        await ensureCsrfToken();


      const headers = {
        "Content-Type":
          "application/json",
      };


      if (token) {

        headers["X-CSRF-Token"] =
          token;
      }


      const response =
        await fetch(
          LOGIN_ENDPOINT,
          {
            method: "POST",

            credentials: "include",

            headers,

            body: JSON.stringify({
              username,
              password,
            }),
          }
        );


      const result =
        await parseResponse(response);

      const payload =
        result.data;


      // =========================
      // LOGIN FAILED
      // =========================

      if (
        !result.ok ||
        payload?.ok === false
      ) {

        showError(
          loginMsg,
          payload?.message ||
            "Invalid username or password."
        );

        generateCaptcha();

        return;
      }


      // =========================
      // ADMIN PIN REQUIRED
      // =========================

      if (
        payload.secondaryRequired
      ) {

        clearMessage(loginMsg);


        if (mfaMsg) {

          mfaMsg.textContent =
            "Enter your 6-digit Secondary PIN to continue.";
        }


        if (mfaCodeEl) {

          mfaCodeEl.value = "";
        }


        showView("secondary");


        setTimeout(() => {

          if (mfaCodeEl) {
            mfaCodeEl.focus();
          }

        }, 50);


        return;
      }


      // =========================
      // TEACHER / STUDENT
      // =========================

      if (payload.role) {

        redirectAfterLogin(
          payload
        );

        return;
      }


      showError(
        loginMsg,
        "Login succeeded, but no user role was returned."
      );

    } catch (error) {

      console.error(
        "Login error:",
        error
      );


      showError(
        loginMsg,
        "Unable to connect to the server. Please try again."
      );

    } finally {

      if (loginBtn) {

        loginBtn.disabled = false;

        loginBtn.textContent =
          originalText;
      }
    }
  }


  // =========================
  // SECONDARY PIN
  // =========================

  async function handleSecondarySubmit(event) {

    event.preventDefault();

    clearMessage(mfaMsg);


    if (!mfaCodeEl) {
      return;
    }


    const pin =
      mfaCodeEl.value.trim();


    // Exactly 6 digits

    if (!/^\d{6}$/.test(pin)) {

      showError(
        mfaMsg,
        "Secondary PIN must be exactly 6 digits."
      );

      mfaCodeEl.focus();

      return;
    }


    const originalText =
      mfaBtn
        ? mfaBtn.textContent
        : "Verify PIN";


    if (mfaBtn) {

      mfaBtn.disabled = true;

      mfaBtn.textContent =
        "Verifying...";
    }


    try {

      const token =
        await ensureCsrfToken();


      const headers = {
        "Content-Type":
          "application/json",
      };


      if (token) {

        headers["X-CSRF-Token"] =
          token;
      }


      const response =
        await fetch(
          SECONDARY_VERIFY_ENDPOINT,
          {
            method: "POST",

            credentials: "include",

            headers,

            body: JSON.stringify({
              pin,
            }),
          }
        );


      const result =
        await parseResponse(response);

      const payload =
        result.data;


      // =========================
      // PIN FAILED
      // =========================

      if (
        !result.ok ||
        payload?.ok === false
      ) {

        showError(
          mfaMsg,
          payload?.message ||
            "Invalid Secondary PIN."
        );


        mfaCodeEl.value = "";

        mfaCodeEl.focus();

        return;
      }


      // =========================
      // VERIFY ROLE
      // =========================

      if (
        payload.role !== "admin"
      ) {

        showError(
          mfaMsg,
          "Unexpected account role. Please sign in again."
        );

        return;
      }


      // =========================
      // ADMIN AUTHENTICATED
      // =========================

      redirectAfterLogin(
        payload
      );

    } catch (error) {

      console.error(
        "Secondary PIN verification error:",
        error
      );


      showError(
        mfaMsg,
        "Unable to connect to the server. Please try again."
      );

    } finally {

      if (mfaBtn) {

        mfaBtn.disabled = false;

        mfaBtn.textContent =
          originalText;
      }
    }
  }


  // =========================
  // NAVIGATION
  // =========================

  function setupNavigation() {

    // Forgot Password

    if (forgotLink) {

      forgotLink.addEventListener(
        "click",
        function () {

          clearMessage(loginMsg);

          clearMessage(mfaMsg);

          showView("forgot");
        }
      );
    }


    // Back from Forgot Password

    if (backToLogin) {

      backToLogin.addEventListener(
        "click",
        function () {

          clearMessage(loginMsg);

          showView("login");


          if (usernameEl) {
            usernameEl.focus();
          }
        }
      );
    }


    // Back from Secondary PIN

    if (
      backToLoginFromMFA
    ) {

      backToLoginFromMFA.addEventListener(
        "click",
        function () {

          clearMessage(mfaMsg);


          if (mfaCodeEl) {
            mfaCodeEl.value = "";
          }


          showView("login");


          if (passwordEl) {
            passwordEl.focus();
          }
        }
      );
    }
  }


  // =========================
  // PIN INPUT
  // =========================

  function setupPinInput() {

    if (!mfaCodeEl) {
      return;
    }


    mfaCodeEl.addEventListener(
      "input",
      function () {

        this.value =
          this.value
            .replace(/\D/g, "")
            .slice(0, 6);
      }
    );


    mfaCodeEl.addEventListener(
      "keydown",
      function (event) {

        const allowedKeys = [
          "Backspace",
          "Delete",
          "ArrowLeft",
          "ArrowRight",
          "Tab",
          "Home",
          "End",
        ];


        if (
          allowedKeys.includes(
            event.key
          ) ||
          event.ctrlKey ||
          event.metaKey
        ) {
          return;
        }


        if (
          !/^\d$/.test(
            event.key
          )
        ) {

          event.preventDefault();
        }
      }
    );
  }


  // =========================
  // EVENTS
  // =========================

  function setupEventListeners() {

    if (loginForm) {

      loginForm.addEventListener(
        "submit",
        handleLoginSubmit
      );
    }


    if (mfaForm) {

      mfaForm.addEventListener(
        "submit",
        handleSecondarySubmit
      );
    }


    if (capRefresh) {

      capRefresh.addEventListener(
        "click",
        generateCaptcha
      );
    }
  }


  // =========================
  // INITIALIZATION
  // =========================

  async function init() {

    // IMPORTANT:
    // Use the existing CSS .is-active class.

    showView("login");


    generateCaptcha();


    setupPasswordToggle();

    setupNavigation();

    setupPinInput();

    setupEventListeners();


    await loadCsrfToken();
  }


  init();

})();