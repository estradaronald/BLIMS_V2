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

  const CAPTCHA_FAIL_ENDPOINT =
    "/api/auth/captcha/fail";

  const CAPTCHA_SUCCESS_ENDPOINT =
    "/api/auth/captcha/success";

  const CAPTCHA_STATUS_ENDPOINT =
    "/api/auth/captcha/status";

  const SECONDARY_VERIFY_ENDPOINT =
    "/api/auth/secondary/verify";

  const CSRF_ENDPOINT = "/api/auth/csrf";

  const CHANGE_PASSWORD_PAGE =
    "/change-password.html";



  // =========================
  // DASHBOARDS
  // =========================

  const DASH_BY_ROLE = {

    admin:
      "/src/pages/admin/dashboard.html",

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

  let captchaLocked = false;

  let captchaLockTimer = null;

  let captchaLockedUntil = 0;



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

      capAns.disabled = captchaLocked;

    }



    if (capRefresh) {

      capRefresh.disabled = captchaLocked;

    }



    if (!captchaLocked) {

      clearMessage(capMsg);

    }

  }



  function setCaptchaControlsDisabled(disabled) {

    if (capAns) {

      capAns.disabled = disabled;

    }



    if (capRefresh) {

      capRefresh.disabled = disabled;

    }



    if (loginBtn) {

      loginBtn.disabled = disabled;

    }

  }



  function stopCaptchaLockTimer() {

    if (captchaLockTimer) {

      clearInterval(captchaLockTimer);

      captchaLockTimer = null;

    }

  }



  function startCaptchaLock(seconds) {

    const safeSeconds =
      Math.max(
        1,
        Number(seconds) || 60
      );



    stopCaptchaLockTimer();



    captchaLocked = true;



    captchaLockedUntil =
      Date.now() +
      safeSeconds * 1000;



    setCaptchaControlsDisabled(true);



    generateCaptcha();



    function updateCountdown() {

      const remaining =
        Math.max(
          0,
          Math.ceil(
            (captchaLockedUntil - Date.now()) /
              1000
          )
        );



      if (remaining <= 0) {

        stopCaptchaLockTimer();



        captchaLocked = false;

        captchaLockedUntil = 0;



        setCaptchaControlsDisabled(false);



        generateCaptcha();



        showSuccess(
          capMsg,
          "CAPTCHA unlocked. Please try again."
        );



        return;

      }



      showError(
        capMsg,
        `Too many incorrect CAPTCHA attempts. ` +
        `Please wait ${remaining} seconds.`
      );

    }



    updateCountdown();



    captchaLockTimer =
      setInterval(
        updateCountdown,
        250
      );

  }



  async function loadCaptchaStatus() {

    try {

      const response =
        await fetch(
          CAPTCHA_STATUS_ENDPOINT,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store"
          }
        );



      const result =
        await parseResponse(response);



      if (
        result.ok &&
        result.data?.captchaLocked
      ) {

        startCaptchaLock(
          result.data.retryAfterSeconds
        );

        return;

      }



      captchaLocked = false;

      captchaLockedUntil = 0;



      setCaptchaControlsDisabled(false);



    } catch (error) {

      console.error(
        "Unable to load CAPTCHA status:",
        error
      );

    }

  }



  async function reportCaptchaFailure() {

    try {

      const response =
        await fetch(
          CAPTCHA_FAIL_ENDPOINT,
          {
            method: "POST",
            credentials: "include",
            cache: "no-store",
            headers: {
              "Content-Type":
                "application/json"
            },
            body: JSON.stringify({})
          }
        );



      const result =
        await parseResponse(response);



      const payload =
        result.data || {};



      if (
        response.status === 429 ||
        payload.captchaLocked
      ) {

        startCaptchaLock(
          payload.retryAfterSeconds || 60
        );



        return payload;

      }



      if (
        !result.ok ||
        payload.ok === false
      ) {

        showError(
          capMsg,
          payload.message ||
            "Incorrect CAPTCHA answer."
        );



        return payload;

      }



      return payload;



    } catch (error) {

      console.error(
        "CAPTCHA failure report error:",
        error
      );



      showError(
        capMsg,
        "Unable to verify CAPTCHA attempt. Please try again."
      );



      return null;

    }

  }



  async function reportCaptchaSuccess() {

    try {

      const response =
        await fetch(
          CAPTCHA_SUCCESS_ENDPOINT,
          {
            method: "POST",
            credentials: "include",
            cache: "no-store",
            headers: {
              "Content-Type":
                "application/json"
            },
            body: JSON.stringify({})
          }
        );



      const result =
        await parseResponse(response);



      const payload =
        result.data || {};



      if (
        response.status === 429 ||
        payload.captchaLocked
      ) {

        startCaptchaLock(
          payload.retryAfterSeconds || 60
        );



        return false;

      }



      if (
        !result.ok ||
        payload.ok === false
      ) {

        showError(
          capMsg,
          payload.message ||
            "Unable to verify CAPTCHA."
        );



        return false;

      }



      return true;



    } catch (error) {

      console.error(
        "CAPTCHA success report error:",
        error
      );



      showError(
        capMsg,
        "Unable to verify CAPTCHA. Please try again."
      );



      return false;

    }

  }



  async function validateCaptcha() {

    if (captchaLocked) {

      return false;

    }



    if (
      !capAns ||
      captchaAnswer === null
    ) {

      return true;

    }



    const answer =
      Number(
        capAns.value.trim()
      );



    if (!Number.isInteger(answer)) {

      showError(
        capMsg,
        "Please solve the CAPTCHA."
      );



      return false;

    }



    if (answer !== captchaAnswer) {

      // Generate a new CAPTCHA after
      // every incorrect answer.

      generateCaptcha();



      const result =
        await reportCaptchaFailure();



      if (
        result?.captchaLocked
      ) {

        return false;

      }



      const remaining =
        result?.remainingAttempts;



      if (
        Number.isInteger(remaining) &&
        remaining > 0
      ) {

        showError(
          capMsg,
          `Incorrect CAPTCHA answer. ` +
          `${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
        );

      } else {

        showError(
          capMsg,
          "Incorrect CAPTCHA answer."
        );

      }



      return false;

    }



    // Correct CAPTCHA:
    // reset the backend counter.

    const success =
      await reportCaptchaSuccess();



    if (!success) {

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



    if (!(await validateCaptcha())) {

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
      // CAPTCHA LOCKOUT
      // =========================

      if (
        response.status === 429 &&
        payload?.captchaLocked
      ) {

        startCaptchaLock(
          payload.retryAfterSeconds || 60
        );



        showError(
          capMsg,
          payload.message ||
            "Too many incorrect CAPTCHA attempts."
        );



        return;

      }



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

        loginBtn.disabled = captchaLocked;

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

      resetForgotPasswordUI();

      showView("forgot");

      if (forgotEmail) {
        forgotEmail.focus();
      }

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
// FORGOT PASSWORD
// =========================

const FORGOT_PASSWORD_ENDPOINT =
  "/api/auth/forgot-password";

const VERIFY_RESET_OTP_ENDPOINT =
  "/api/auth/verify-reset-otp";

const RESET_PASSWORD_ENDPOINT =
  "/api/auth/reset-password";

const forgotEmail = $("forgotEmail");
const forgotContinueBtn = $("forgotContinueBtn");
const forgotMsg = $("forgotMsg");

const forgotStepEmail = $("forgotStepEmail");
const forgotStepOtp = $("forgotStepOtp");
const forgotStepPassword = $("forgotStepPassword");

const forgotOtp = $("forgotOtp");
const verifyOtpBtn = $("verifyOtpBtn");
const otpMsg = $("otpMsg");

const resetNewPassword = $("resetNewPassword");
const resetConfirmPassword = $("resetConfirmPassword");
const resetPasswordBtn = $("resetPasswordBtn");
const resetPasswordMsg = $("resetPasswordMsg");

const backToForgotEmail = $("backToForgotEmail");


// =========================
// PASSWORD REQUIREMENTS
// =========================

function updatePasswordHints() {
  if (!resetNewPassword || !resetConfirmPassword) {
    return;
  }

  const password = resetNewPassword.value;
  const confirmPassword = resetConfirmPassword.value;

  const requirements = {
    hintLength: password.length >= 12,
    hintUppercase: /[A-Z]/.test(password),
    hintLowercase: /[a-z]/.test(password),
    hintNumber: /[0-9]/.test(password),
    hintSpecial: /[^A-Za-z0-9]/.test(password),
    hintMatch:
      password.length > 0 &&
      confirmPassword.length > 0 &&
      password === confirmPassword
  };

  Object.entries(requirements).forEach(
    ([id, met]) => {
      const element =
        document.getElementById(id);

      if (!element) {
        return;
      }

      const icon =
        element.querySelector(".hint-icon");

      element.classList.toggle(
        "met",
        met
      );

      if (icon) {
        icon.textContent =
          met ? "✓" : "○";
      }
    }
  );
}


// =========================
// RESET FORGOT PASSWORD UI
// =========================

function resetForgotPasswordUI() {

  if (forgotStepEmail) {
    forgotStepEmail.style.display = "";
  }

  if (forgotStepOtp) {
    forgotStepOtp.style.display = "none";
  }

  if (forgotStepPassword) {
    forgotStepPassword.style.display = "none";
  }

  if (forgotEmail) {
    forgotEmail.value = "";
  }

  if (forgotOtp) {
    forgotOtp.value = "";
  }

  if (resetNewPassword) {
    resetNewPassword.value = "";
  }

  if (resetConfirmPassword) {
    resetConfirmPassword.value = "";
  }

  clearMessage(forgotMsg);
  clearMessage(otpMsg);
  clearMessage(resetPasswordMsg);

  updatePasswordHints();
}


// =========================
// SHOW FORGOT PASSWORD STEP
// =========================

function showForgotStep(step) {

  if (forgotStepEmail) {
    forgotStepEmail.style.display =
      step === "email"
        ? ""
        : "none";
  }

  if (forgotStepOtp) {
    forgotStepOtp.style.display =
      step === "otp"
        ? ""
        : "none";
  }

  if (forgotStepPassword) {
    forgotStepPassword.style.display =
      step === "password"
        ? ""
        : "none";
  }

}


// =========================
// HANDLE FORGOT PASSWORD
// =========================

async function handleForgotPassword() {

  clearMessage(forgotMsg);

  if (!forgotEmail) {
    return;
  }

  const email =
    forgotEmail.value
      .trim()
      .toLowerCase();

  if (!email) {

    showError(
      forgotMsg,
      "Please enter your registered email address."
    );

    forgotEmail.focus();

    return;
  }

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {

    showError(
      forgotMsg,
      "Please enter a valid email address."
    );

    forgotEmail.focus();

    return;
  }

  const originalText =
    forgotContinueBtn
      ? forgotContinueBtn.textContent
      : "Continue";

  if (forgotContinueBtn) {

    forgotContinueBtn.disabled = true;

    forgotContinueBtn.textContent =
      "Sending OTP...";
  }

  try {

    const token =
      await ensureCsrfToken();

    const headers = {
      "Content-Type":
        "application/json"
    };

    if (token) {
      headers["X-CSRF-Token"] =
        token;
    }

    const response =
      await fetch(
        FORGOT_PASSWORD_ENDPOINT,
        {
          method: "POST",
          credentials: "include",
          headers,
          body: JSON.stringify({
            email
          })
        }
      );

    const result =
      await parseResponse(response);

    const payload =
      result.data || {};

    if (
      !result.ok ||
      payload.ok === false
    ) {

      showError(
        forgotMsg,
        payload.message ||
          "Unable to process your password reset request."
      );

      return;
    }

    showForgotStep("otp");

    clearMessage(forgotMsg);

    if (forgotOtp) {
      forgotOtp.focus();
    }

    showSuccess(
      otpMsg,
      "A 6-digit OTP has been sent to your registered email address."
    );

  } catch (error) {

    console.error(
      "Forgot password error:",
      error
    );

    showError(
      forgotMsg,
      "Unable to connect to the server. Please try again."
    );

  } finally {

    if (forgotContinueBtn) {

      forgotContinueBtn.disabled =
        false;

      forgotContinueBtn.textContent =
        originalText;
    }

  }
}


// =========================
// VERIFY RESET OTP
// =========================

async function handleVerifyResetOtp() {

  clearMessage(otpMsg);

  if (!forgotOtp) {
    return;
  }

  const otp =
    forgotOtp.value.trim();

  if (!/^\d{6}$/.test(otp)) {

    showError(
      otpMsg,
      "Please enter the 6-digit OTP sent to your email."
    );

    forgotOtp.focus();

    return;
  }

  const originalText =
    verifyOtpBtn
      ? verifyOtpBtn.textContent
      : "Verify OTP";

  if (verifyOtpBtn) {

    verifyOtpBtn.disabled = true;

    verifyOtpBtn.textContent =
      "Verifying...";
  }

  try {

    const token =
      await ensureCsrfToken();

    const headers = {
      "Content-Type":
        "application/json"
    };

    if (token) {
      headers["X-CSRF-Token"] =
        token;
    }

    const response =
      await fetch(
        VERIFY_RESET_OTP_ENDPOINT,
        {
          method: "POST",
          credentials: "include",
          headers,
          body: JSON.stringify({
            otp
          })
        }
      );

    const result =
      await parseResponse(response);

    const payload =
      result.data || {};

    if (
      !result.ok ||
      payload.ok === false
    ) {

      showError(
        otpMsg,
        payload.message ||
          "Invalid or expired OTP."
      );

      return;
    }

    showForgotStep("password");

    clearMessage(otpMsg);

    updatePasswordHints();

    if (resetNewPassword) {
      resetNewPassword.focus();
    }

    showSuccess(
      resetPasswordMsg,
      "OTP verified. Please create your new password."
    );

  } catch (error) {

    console.error(
      "OTP verification error:",
      error
    );

    showError(
      otpMsg,
      "Unable to connect to the server. Please try again."
    );

  } finally {

    if (verifyOtpBtn) {

      verifyOtpBtn.disabled =
        false;

      verifyOtpBtn.textContent =
        originalText;
    }

  }
}


// =========================
// RESET PASSWORD
// =========================

async function handleResetPassword() {

  clearMessage(resetPasswordMsg);

  if (
    !resetNewPassword ||
    !resetConfirmPassword
  ) {
    return;
  }

  const newPassword =
    resetNewPassword.value;

  const confirmPassword =
    resetConfirmPassword.value;


  if (!newPassword) {

    showError(
      resetPasswordMsg,
      "Please enter your new password."
    );

    resetNewPassword.focus();

    return;
  }


  if (!confirmPassword) {

    showError(
      resetPasswordMsg,
      "Please confirm your new password."
    );

    resetConfirmPassword.focus();

    return;
  }


  if (newPassword !== confirmPassword) {

    showError(
      resetPasswordMsg,
      "Passwords do not match."
    );

    resetConfirmPassword.focus();

    return;
  }


  if (newPassword.length < 12) {

    showError(
      resetPasswordMsg,
      "Password must be at least 12 characters."
    );

    resetNewPassword.focus();

    return;
  }


  if (!/[A-Z]/.test(newPassword)) {

    showError(
      resetPasswordMsg,
      "Password must include at least 1 uppercase letter."
    );

    resetNewPassword.focus();

    return;
  }


  if (!/[a-z]/.test(newPassword)) {

    showError(
      resetPasswordMsg,
      "Password must include at least 1 lowercase letter."
    );

    resetNewPassword.focus();

    return;
  }


  if (!/[0-9]/.test(newPassword)) {

    showError(
      resetPasswordMsg,
      "Password must include at least 1 number."
    );

    resetNewPassword.focus();

    return;
  }


  if (!/[^A-Za-z0-9]/.test(newPassword)) {

    showError(
      resetPasswordMsg,
      "Password must include at least 1 special character."
    );

    resetNewPassword.focus();

    return;
  }


  const originalText =
    resetPasswordBtn
      ? resetPasswordBtn.textContent
      : "Reset Password";


  if (resetPasswordBtn) {

    resetPasswordBtn.disabled =
      true;

    resetPasswordBtn.textContent =
      "Resetting...";
  }


  try {

    const token =
      await ensureCsrfToken();

    const headers = {
      "Content-Type":
        "application/json"
    };

    if (token) {
      headers["X-CSRF-Token"] =
        token;
    }


    const response =
      await fetch(
        RESET_PASSWORD_ENDPOINT,
        {
          method: "POST",
          credentials: "include",
          headers,
          body: JSON.stringify({
            newPassword,
            confirmPassword
          })
        }
      );


    const result =
      await parseResponse(response);

    const payload =
      result.data || {};


    if (
      !result.ok ||
      payload.ok === false
    ) {

      showError(
        resetPasswordMsg,
        payload.message ||
          "Unable to reset your password."
      );

      return;
    }


    showSuccess(
      resetPasswordMsg,
      "Password reset successful. You can now sign in."
    );


    if (resetNewPassword) {
      resetNewPassword.value = "";
    }

    if (resetConfirmPassword) {
      resetConfirmPassword.value = "";
    }

    updatePasswordHints();


    setTimeout(() => {

      resetForgotPasswordUI();

      showView("login");


      if (loginMsg) {

        showSuccess(
          loginMsg,
          "Your password has been reset. Please sign in with your new password."
        );

      }


      if (usernameEl) {
        usernameEl.focus();
      }

    }, 1200);


  } catch (error) {

    console.error(
      "Password reset error:",
      error
    );

    showError(
      resetPasswordMsg,
      "Unable to connect to the server. Please try again."
    );

  } finally {

    if (resetPasswordBtn) {

      resetPasswordBtn.disabled =
        false;

      resetPasswordBtn.textContent =
        originalText;
    }

  }
}


// =========================
// SETUP FORGOT PASSWORD
// =========================

function setupForgotPassword() {

  if (forgotContinueBtn) {

    forgotContinueBtn.addEventListener(
      "click",
      handleForgotPassword
    );

  }


  if (verifyOtpBtn) {

    verifyOtpBtn.addEventListener(
      "click",
      handleVerifyResetOtp
    );

  }


  if (resetPasswordBtn) {

    resetPasswordBtn.addEventListener(
      "click",
      handleResetPassword
    );

  }


  if (resetNewPassword) {

    resetNewPassword.addEventListener(
      "input",
      updatePasswordHints
    );

  }


  if (resetConfirmPassword) {

    resetConfirmPassword.addEventListener(
      "input",
      updatePasswordHints
    );

  }


  if (backToForgotEmail) {

    backToForgotEmail.addEventListener(
      "click",
      function () {

        clearMessage(otpMsg);

        showForgotStep("email");

        if (forgotEmail) {
          forgotEmail.focus();
        }

      }
    );

  }


  if (forgotOtp) {

    forgotOtp.addEventListener(
      "input",
      function () {

        this.value =
          this.value
            .replace(/\D/g, "")
            .slice(0, 6);

      }
    );

  }

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
        function () {

          if (captchaLocked) {

            return;

          }



          generateCaptcha();

        }
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

  
    setupForgotPassword();


    await loadCsrfToken();



    // Restore CAPTCHA lockout after refresh.

    await loadCaptchaStatus();

  }



  init();



})();