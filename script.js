const form = document.getElementById("task-review-form");

if (form) {
  const status = document.getElementById("form-status");
  const submitButton = form.querySelector('button[type="submit"]');
  const successMessage = "Thanks — your task review request has been sent.";
  const errorMessage =
    "Something went wrong. Please try again or email hello@scarlettecreations.com.";

  const resetTurnstile = () => {
    if (window.turnstile && typeof window.turnstile.reset === "function") {
      window.turnstile.reset();
    }
  };

  const setStatus = (message, type) => {
    if (!status) {
      return;
    }

    status.textContent = message;
    status.className = "form-status";

    if (type) {
      status.classList.add(`form-status-${type}`);
    }
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setStatus("", "");

    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
    }

    try {
      const response = await fetch("/api/task-review", {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
        body: new FormData(form),
      });

      if (!response.ok) {
        throw new Error("Form submission failed");
      }

      form.reset();
      resetTurnstile();
      setStatus(successMessage, "success");
    } catch (error) {
      resetTurnstile();
      setStatus(errorMessage, "error");
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
      }
    }
  });
}
