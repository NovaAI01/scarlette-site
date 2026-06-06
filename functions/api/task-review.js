const SUCCESS_MESSAGE = "Thanks — your task review request has been received.";
const DEFAULT_ERROR_MESSAGE = "Something went wrong. Please try again.";

const FIELD_LIMITS = {
  name: 120,
  email: 200,
  task: 2000,
  tools: 1500,
  problems: 1500,
};

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "POST") {
    return respond(request, 405, false, "Use the form to send a task review request.");
  }

  let formData;

  try {
    formData = await request.formData();
  } catch (error) {
    return respond(request, 400, false, "Please submit the form again.");
  }

  const fields = {
    name: getTrimmedValue(formData, "name"),
    email: getTrimmedValue(formData, "email"),
    task: getTrimmedValue(formData, "task"),
    tools: getTrimmedValue(formData, "tools"),
    problems: getTrimmedValue(formData, "problems"),
    companyWebsite: getTrimmedValue(formData, "company_website"),
  };
  const turnstileToken = getTrimmedValue(formData, "cf-turnstile-response");

  if (fields.companyWebsite) {
    return respond(request, 200, true, SUCCESS_MESSAGE);
  }

  if (!fields.name || !fields.email || !fields.task) {
    return respond(request, 400, false, "Please fill in your name, email, and task.");
  }

  if (hasTooLongField(fields)) {
    return respond(request, 400, false, "Please shorten the form details and try again.");
  }

  if (!isValidEmail(fields.email)) {
    return respond(request, 400, false, "Please enter a valid email address.");
  }

  if (!env.TURNSTILE_SECRET_KEY) {
    return respond(request, 500, false, "Form verification is not configured yet.");
  }

  if (!turnstileToken) {
    return respond(request, 400, false, "Please complete the verification check.");
  }

  const turnstileOk = await verifyTurnstileToken({
    secret: env.TURNSTILE_SECRET_KEY,
    token: turnstileToken,
    remoteIp: request.headers.get("CF-Connecting-IP"),
  });

  if (!turnstileOk) {
    return respond(request, 400, false, "Verification failed. Please try again.");
  }

  if (!env.DB) {
    return respond(request, 500, false, "Submission storage is not configured yet.");
  }

  try {
    await env.DB.prepare(
      `INSERT INTO task_reviews
        (created_at, name, email, task, tools, problems, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(new Date().toISOString(), fields.name, fields.email, fields.task, fields.tools, fields.problems, "new")
      .run();
  } catch (error) {
    return respond(request, 500, false, DEFAULT_ERROR_MESSAGE);
  }

  return respond(request, 200, true, SUCCESS_MESSAGE);
}

function getTrimmedValue(formData, key) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function hasTooLongField(fields) {
  return Object.entries(FIELD_LIMITS).some(([field, limit]) => fields[field].length > limit);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function verifyTurnstileToken({ secret, token, remoteIp }) {
  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);

  if (remoteIp) {
    body.append("remoteip", remoteIp);
  }

  try {
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body,
    });

    if (!response.ok) {
      return false;
    }

    const result = await response.json();
    return result.success === true;
  } catch (error) {
    return false;
  }
}

function wantsJson(request) {
  return request.headers.get("Accept")?.includes("application/json") || false;
}

function respond(request, status, ok, message) {
  if (wantsJson(request)) {
    return jsonResponse(status, ok, message);
  }

  return htmlResponse(status, ok ? "Thanks" : "Form error", message);
}

function jsonResponse(status, ok, message) {
  const body = ok ? { ok, message } : { ok, error: message };

  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function htmlResponse(status, title, message) {
  return new Response(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
      <p><a href="/">Back to Scarlette</a></p>
    </main>
  </body>
</html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    },
  );
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => {
    const replacements = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return replacements[character];
  });
}
