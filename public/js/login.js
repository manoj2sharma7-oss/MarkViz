		const loginTab = document.getElementById("loginTab");
		const signupTab = document.getElementById("signupTab");
		const confirmField = document.getElementById("confirmField");
		const confirmPassword = document.getElementById("confirmPassword");
		const signupFields = document.querySelectorAll(".signup-only");
		const fullName = document.getElementById("fullName");
		const schoolName = document.getElementById("schoolName");
		const schoolAddress = document.getElementById("schoolAddress");
		const username = document.getElementById("username");
		const phone = document.getElementById("phone");
		const captchaCode = document.getElementById("captchaCode");
		const captchaInput = document.getElementById("captchaInput");
		const refreshCaptcha = document.getElementById("refreshCaptcha");
		const email = document.getElementById("email");
		const password = document.getElementById("password");
		const authTitle = document.getElementById("authTitle");
		const authSubtitle = document.getElementById("authSubtitle");
		const submitButton = document.getElementById("submitButton");
		const form = document.getElementById("authForm");
		const message = document.getElementById("message");
		const closeAuth = document.getElementById("closeAuth");
		const forgotPassword = document.getElementById("forgotPassword");
		const recoveryForm = document.getElementById("recoveryForm");
		const recoveryUsername = document.getElementById("recoveryUsername");
		const recoveryPhone = document.getElementById("recoveryPhone");
		const recoveryNote = document.getElementById("recoveryNote");
		const identityFields = document.getElementById("identityFields");
		const newPasswordFields = document.getElementById("newPasswordFields");
		const newPassword = document.getElementById("newPassword");
		const newPasswordConfirm = document.getElementById("newPasswordConfirm");
		const recoveryButton = document.getElementById("recoveryButton");
		const savePasswordButton = document.getElementById("savePasswordButton");
		const recoveryMessage = document.getElementById("recoveryMessage");
		const backToLogin = document.getElementById("backToLogin");
		let signupMode = false;
		let generatedCaptcha = "";
		let resetToken = "";

		document.querySelectorAll(".password-toggle").forEach((toggle) => {
			toggle.addEventListener("click", () => {
				const input = document.getElementById(toggle.dataset.passwordTarget);
				const isVisible = input.type === "text";
				input.type = isVisible ? "password" : "text";
				toggle.textContent = isVisible ? "Show" : "Hide";
				toggle.setAttribute("aria-label", `${isVisible ? "Show" : "Hide"} ${input.getAttribute("aria-label") || input.id.replace(/([A-Z])/g, " $1").toLowerCase()}`);
			});
		});

		function setMessage(element, text, success = false) {
			element.textContent = text;
			element.classList.toggle("success", success);
		}

		function showRecovery(show) {
			form.hidden = show;
			recoveryForm.hidden = !show;
			forgotPassword.hidden = show;
			if (show) {
				authTitle.textContent = "Recover your password";
				authSubtitle.textContent = "Verify your signup details to regain access.";
				setMessage(recoveryMessage, "");
				recoveryNote.textContent = "Enter the username and phone number used during signup to verify your account.";
				identityFields.hidden = false;
				newPasswordFields.hidden = true;
				recoveryUsername.required = true;
				recoveryPhone.required = true;
				newPassword.required = false;
				newPasswordConfirm.required = false;
				recoveryButton.textContent = "Verify details";
				recoveryButton.hidden = false;
				savePasswordButton.hidden = true;
				resetToken = "";
				recoveryUsername.focus();
			} else {
				setMode(false);
				email.focus();
			}
		}

		closeAuth.addEventListener("click", (event) => {
			if (window.parent !== window) {
				event.preventDefault();
				window.parent.postMessage("closeMarkVizAuth", "*");
			}
		});

		function generateCaptcha() {
			const characters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
			generatedCaptcha = Array.from({ length: 6 }, () => characters[Math.floor(Math.random() * characters.length)]).join("");
			captchaCode.textContent = generatedCaptcha;
			captchaInput.value = "";
		}

		function setMode(isSignup) {
			signupMode = isSignup;
			loginTab.classList.toggle("active", !isSignup);
			signupTab.classList.toggle("active", isSignup);
			loginTab.setAttribute("aria-selected", String(!isSignup));
			signupTab.setAttribute("aria-selected", String(isSignup));
			confirmField.hidden = !isSignup;
			confirmPassword.required = isSignup;
			if (!isSignup) confirmPassword.value = "";
			signupFields.forEach((field) => {
				field.hidden = !isSignup;
				field.querySelector("input")?.toggleAttribute("required", isSignup);
			});
			forgotPassword.hidden = isSignup;
			if (isSignup) generateCaptcha();
			authTitle.textContent = isSignup ? "Create your workspace" : "Welcome back";
			authSubtitle.textContent = isSignup ? "Create an account to start using your academic workspace." : "Sign in to continue to your academic workspace.";
			submitButton.textContent = isSignup ? "Create account" : "Log in to MarkViz";
			setMessage(message, "");
		}

		loginTab.addEventListener("click", () => setMode(false));
		signupTab.addEventListener("click", () => setMode(true));
		forgotPassword.addEventListener("click", (event) => { event.preventDefault(); showRecovery(true); });
		backToLogin.addEventListener("click", (event) => { event.preventDefault(); showRecovery(false); });
		refreshCaptcha.addEventListener("click", generateCaptcha);

		form.addEventListener("submit", async (event) => {
			event.preventDefault();
			setMessage(message, "");
			if (!form.checkValidity()) {
				setMessage(message, "Please enter a valid email and a password of at least 6 characters.");
				form.reportValidity();
				return;
			}
			if (signupMode && password.value !== confirmPassword.value) {
				setMessage(message, "Passwords do not match.");
				confirmPassword.focus();
				return;
			}
			if (signupMode && captchaInput.value.trim().toLowerCase() !== generatedCaptcha.toLowerCase()) {
				setMessage(message, "The captcha does not match. Please try again.");
				captchaInput.focus();
				generateCaptcha();
				return;
			}
			submitButton.disabled = true;
			submitButton.textContent = signupMode ? "Creating account..." : "Signing in...";
			try {
				const response = await fetch(signupMode ? "/api/auth/signup" : "/api/auth/login", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					credentials: "same-origin",
					body: JSON.stringify(signupMode ? {
						fullName: fullName.value,
						schoolName: schoolName.value,
						schoolAddress: schoolAddress.value,
						username: username.value,
						phone: phone.value,
						email: email.value,
						password: password.value,
					} : { email: email.value, password: password.value }),
				});
				const result = await response.json();
				if (!response.ok) throw new Error(result.error || "Authentication failed.");
				if (signupMode) {
					setMode(false);
					password.value = "";
					setMessage(message, "Account created. Please log in to open your dashboard.", true);
					return;
				}
				if (window.parent !== window) {
					window.parent.postMessage("markvizAuthSuccess", window.location.origin);
				} else {
					window.location.href = "/dashboard";
				}
			} catch (error) {
				setMessage(message, error.message || "Unable to contact the MarkViz server.");
			} finally {
				submitButton.disabled = false;
				submitButton.textContent = signupMode ? "Create account" : "Log in to MarkViz";
			}
		});

		recoveryForm.addEventListener("submit", async (event) => {
			event.preventDefault();
			setMessage(recoveryMessage, "");
			if (!recoveryForm.checkValidity()) { recoveryForm.reportValidity(); return; }
			if (resetToken && newPassword.value !== newPasswordConfirm.value) {
				setMessage(recoveryMessage, "New passwords do not match.");
				newPasswordConfirm.focus();
				return;
			}
			if (resetToken) {
				recoveryButton.disabled = true;
				savePasswordButton.disabled = true;
				savePasswordButton.textContent = "Saving password...";
			} else {
				recoveryButton.disabled = true;
				recoveryButton.textContent = "Verifying...";
			}
			try {
				const response = await fetch(resetToken ? "/api/auth/reset-password" : "/api/auth/forgot-password", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					credentials: "same-origin",
					body: JSON.stringify(resetToken
						? { resetToken, newPassword: newPassword.value }
						: { username: recoveryUsername.value, phone: recoveryPhone.value }),
				});
				const result = await response.json();
				if (!response.ok) throw new Error(result.error || "Unable to recover the password.");
				if (!resetToken) {
					resetToken = result.resetToken;
					recoveryNote.textContent = "Identity verified. Create a new password for your account.";
					identityFields.hidden = true;
					newPasswordFields.hidden = false;
					recoveryUsername.required = false;
					recoveryPhone.required = false;
					newPassword.required = true;
					newPasswordConfirm.required = true;
					recoveryButton.hidden = true;
					recoveryButton.disabled = false;
					savePasswordButton.hidden = false;
					savePasswordButton.disabled = false;
					newPassword.focus();
				} else {
					recoveryUsername.value = "";
					recoveryPhone.value = "";
					newPassword.value = "";
					newPasswordConfirm.value = "";
					resetToken = "";
					showRecovery(false);
					setMessage(message, "Password changed successfully. Please log in with your new password.", true);
					email.focus();
				}
			} catch (error) {
				setMessage(recoveryMessage, error.message || "Unable to contact the MarkViz server.");
			} finally {
				recoveryButton.disabled = false;
				savePasswordButton.disabled = false;
				recoveryButton.textContent = "Verify details";
				savePasswordButton.textContent = "Save new password";
			}
		});

		async function saveNewPassword() {
			setMessage(recoveryMessage, "");
			if (!recoveryForm.checkValidity()) {
				recoveryForm.reportValidity();
				return;
			}
			if (newPassword.value !== newPasswordConfirm.value) {
				setMessage(recoveryMessage, "New passwords do not match.");
				newPasswordConfirm.focus();
				return;
			}
			savePasswordButton.disabled = true;
			savePasswordButton.textContent = "Saving password...";
			try {
				const response = await fetch("/api/auth/reset-password", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					credentials: "same-origin",
					body: JSON.stringify({ resetToken, newPassword: newPassword.value }),
				});
				const result = await response.json();
				if (!response.ok) throw new Error(result.error || "Unable to save the new password.");
				resetToken = "";
				showRecovery(false);
				setMessage(message, "Password changed successfully. Please log in with your new password.", true);
				email.focus();
			} catch (error) {
				setMessage(recoveryMessage, error.message || "Unable to contact the MarkViz server.");
			} finally {
				savePasswordButton.disabled = false;
				savePasswordButton.textContent = "Save new password";
			}
		}

		savePasswordButton.addEventListener("click", saveNewPassword);
