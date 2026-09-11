// frontend/src/js/admin/create-admin.js

document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("createAdminForm");
    const cancelButton = document.getElementById("cancelButton");
    const formMessage = document.getElementById("formMessage");


    // =========================
    // ELEMENTS
    // =========================

    const firstName = document.getElementById("firstName");
    const middleName = document.getElementById("middleName");
    const lastName = document.getElementById("lastName");
    const suffix = document.getElementById("suffix");

    const email = document.getElementById("email");
    const phoneNumber = document.getElementById("phoneNumber");

    const username = document.getElementById("username");

    const password = document.getElementById("password");
    const confirmPassword =
        document.getElementById("confirmPassword");

    const secondaryPin =
        document.getElementById("secondaryPin");

    const confirmSecondaryPin =
        document.getElementById("confirmSecondaryPin");


    // =========================
    // PASSWORD TOGGLE
    // =========================

    document.querySelectorAll(".password-toggle").forEach(button => {

        button.addEventListener("click", () => {

            const targetId = button.dataset.target;
            const input = document.getElementById(targetId);

            if (!input) return;

            if (input.type === "password") {

                input.type = "text";
                button.textContent = "Hide";
                button.setAttribute(
                    "aria-label",
                    "Hide password"
                );

            } else {

                input.type = "password";
                button.textContent = "Show";
                button.setAttribute(
                    "aria-label",
                    "Show password"
                );

            }

        });

    });


    // =========================
    // NUMERIC PIN ONLY
    // =========================

    secondaryPin.addEventListener("input", () => {

        secondaryPin.value =
            secondaryPin.value.replace(/\D/g, "").slice(0, 6);

    });


    confirmSecondaryPin.addEventListener("input", () => {

        confirmSecondaryPin.value =
            confirmSecondaryPin.value
                .replace(/\D/g, "")
                .slice(0, 6);

    });


    // =========================
    // PHONE NUMBER
    // =========================

    phoneNumber.addEventListener("input", () => {

        phoneNumber.value =
            phoneNumber.value.replace(/\D/g, "").slice(0, 11);

    });


    // =========================
    // HELPERS
    // =========================

    function setError(field, message) {

        const group = field.closest(".form-group");
        const error =
            document.getElementById(`${field.id}Error`);

        if (group) {
            group.classList.add("has-error");
        }

        if (error) {
            error.textContent = message;
        }

    }


    function clearError(field) {

        const group = field.closest(".form-group");
        const error =
            document.getElementById(`${field.id}Error`);

        if (group) {
            group.classList.remove("has-error");
        }

        if (error) {
            error.textContent = "";
        }

    }


    function clearAllErrors() {

        document.querySelectorAll(".form-group").forEach(group => {

            group.classList.remove("has-error");

        });

        document.querySelectorAll(".error-message").forEach(error => {

            error.textContent = "";

        });

    }


    function showMessage(message, type) {

        formMessage.textContent = message;

        formMessage.className = "form-message";

        if (type) {
            formMessage.classList.add(type);
        }

    }


    // =========================
    // PASSWORD VALIDATION
    // =========================

    function validateStrongPassword(value) {

        if (value.length < 12) {

            return "Password must be at least 12 characters.";

        }

        if (!/[A-Z]/.test(value)) {

            return "Password must include at least 1 uppercase letter.";

        }

        if (!/[a-z]/.test(value)) {

            return "Password must include at least 1 lowercase letter.";

        }

        if (!/[0-9]/.test(value)) {

            return "Password must include at least 1 number.";

        }

        if (!/[^A-Za-z0-9]/.test(value)) {

            return "Password must include at least 1 symbol.";

        }

        return null;

    }


    // =========================
    // VALIDATION
    // =========================

    function validateForm() {

        clearAllErrors();

        let valid = true;


        // =========================
        // FIRST NAME
        // =========================

        if (!firstName.value.trim()) {

            setError(
                firstName,
                "First name is required."
            );

            valid = false;

        }


        // =========================
        // LAST NAME
        // =========================

        if (!lastName.value.trim()) {

            setError(
                lastName,
                "Last name is required."
            );

            valid = false;

        }


        // =========================
        // EMAIL
        // =========================

        if (email.value.trim()) {

            const emailPattern =
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            if (!emailPattern.test(email.value.trim())) {

                setError(
                    email,
                    "Enter a valid email address."
                );

                valid = false;

            }

        }


        // =========================
        // PHONE
        // =========================

        if (phoneNumber.value.trim()) {

            if (!/^09\d{9}$/.test(phoneNumber.value.trim())) {

                setError(
                    phoneNumber,
                    "Enter a valid 11-digit Philippine phone number."
                );

                valid = false;

            }

        }


        // =========================
        // USERNAME
        // =========================

        if (!username.value.trim()) {

            setError(
                username,
                "Username is required."
            );

            valid = false;

        } else if (username.value.trim().length < 4) {

            setError(
                username,
                "Username must be at least 4 characters."
            );

            valid = false;

        } else if (username.value.trim().length > 64) {

            setError(
                username,
                "Username must not exceed 64 characters."
            );

            valid = false;

        }


        // =========================
        // PASSWORD
        // =========================

        if (!password.value) {

            setError(
                password,
                "Password is required."
            );

            valid = false;

        } else {

            const passwordError =
                validateStrongPassword(password.value);

            if (passwordError) {

                setError(
                    password,
                    passwordError
                );

                valid = false;

            }

        }


        // =========================
        // CONFIRM PASSWORD
        // =========================

        if (!confirmPassword.value) {

            setError(
                confirmPassword,
                "Please confirm the password."
            );

            valid = false;

        } else if (
            password.value !== confirmPassword.value
        ) {

            setError(
                confirmPassword,
                "Passwords do not match."
            );

            valid = false;

        }


        // =========================
        // SECONDARY PIN
        // =========================

        if (!secondaryPin.value) {

            setError(
                secondaryPin,
                "Secondary PIN is required."
            );

            valid = false;

        } else if (!/^\d{6}$/.test(secondaryPin.value)) {

            setError(
                secondaryPin,
                "Secondary PIN must contain exactly 6 numbers."
            );

            valid = false;

        }


        // =========================
        // CONFIRM PIN
        // =========================

        if (!confirmSecondaryPin.value) {

            setError(
                confirmSecondaryPin,
                "Please confirm the secondary PIN."
            );

            valid = false;

        } else if (
            secondaryPin.value !== confirmSecondaryPin.value
        ) {

            setError(
                confirmSecondaryPin,
                "Secondary PINs do not match."
            );

            valid = false;

        }


        return valid;

    }


    // =========================
    // GET CSRF TOKEN
    // =========================

    async function getCsrfToken() {

        const response = await fetch(
            "/api/csrf-token",
            {
                method: "GET",
                credentials: "include"
            }
        );

        const data = await response.json();

        if (!response.ok || !data.ok || !data.csrfToken) {

            throw new Error(
                "Unable to obtain security token."
            );

        }

        return data.csrfToken;

    }


    // =========================
    // SUBMIT
    // =========================

    form.addEventListener("submit", async (event) => {

        event.preventDefault();

        clearAllErrors();

        formMessage.className = "form-message";
        formMessage.textContent = "";


        // =========================
        // VALIDATE
        // =========================

        const isValid = validateForm();

        if (!isValid) {

            showMessage(
                "Please correct the highlighted fields.",
                "error"
            );

            return;

        }


        // =========================
        // DISABLE SUBMIT
        // =========================

        const submitButton =
            form.querySelector('button[type="submit"]');

        const originalButtonText =
            submitButton.textContent;

        submitButton.disabled = true;
        submitButton.textContent = "Creating...";


        try {

            // =========================
            // CSRF TOKEN
            // =========================

            const csrfToken =
                await getCsrfToken();


            // =========================
            // REQUEST DATA
            // =========================

            const adminData = {

                first_name:
                    firstName.value.trim(),

                middle_name:
                    middleName.value.trim() || null,

                last_name:
                    lastName.value.trim(),

                suffix:
                    suffix.value || null,

                email:
                    email.value.trim() || null,

                phone_number:
                    phoneNumber.value.trim() || null,

                username:
                    username.value.trim(),

                password:
                    password.value,

                secondary_password:
                    secondaryPin.value

            };


            // =========================
            // CREATE ADMIN
            // =========================

            const response = await fetch(
                "/api/admin/create",
                {
                    method: "POST",

                    credentials: "include",

                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRF-Token": csrfToken
                    },

                    body: JSON.stringify(adminData)
                }
            );


            const data = await response.json();


            // =========================
            // BACKEND ERROR
            // =========================

            if (!response.ok || !data.ok) {

                throw new Error(
                    data.message ||
                    "Unable to create admin account."
                );

            }


            // =========================
            // SUCCESS
            // =========================

            showMessage(
                "Admin account created successfully.",
                "success"
            );


            // Reset form

            form.reset();

            clearAllErrors();


        } catch (error) {

            console.error(
                "Create admin error:",
                error
            );

            showMessage(
                error.message ||
                "Something went wrong. Please try again.",
                "error"
            );


        } finally {

            submitButton.disabled = false;
            submitButton.textContent =
                originalButtonText;

        }

    });


    // =========================
    // CANCEL
    // =========================

    cancelButton.addEventListener("click", () => {

        form.reset();

        clearAllErrors();

        formMessage.className = "form-message";
        formMessage.textContent = "";

    });

});