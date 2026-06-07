const STATUSES = new Set(["new", "reviewing", "quoted", "won", "lost"]);
const MAX_NOTE_LENGTH = 2000;

export async function onRequest(context) {
  const { request, env } = context;
  const authResponse = requireAdminAuth(request, env);

  if (authResponse) {
    return authResponse;
  }

  if (request.method !== "POST") {
    return respond(request, 405, false, "Use the admin form to update a task review.");
  }

  if (!env.DB) {
    return respond(request, 500, false, "D1 binding DB is not configured.");
  }

  let formData;

  try {
    formData = await request.formData();
  } catch (error) {
    return respond(request, 400, false, "Please submit the form again.");
  }

  const id = parsePositiveInteger(getTrimmedValue(formData, "id"));
  const status = getTrimmedValue(formData, "status");
  const note = getTrimmedValue(formData, "note");

  if (!id) {
    return respond(request, 400, false, "Task review id is invalid.");
  }

  if (!STATUSES.has(status)) {
    return respond(request, 400, false, "Task review status is invalid.");
  }

  if (note.length > MAX_NOTE_LENGTH) {
    return respond(request, 400, false, "Note is too long.");
  }

  const existing = await env.DB.prepare("SELECT id FROM task_reviews WHERE id = ?")
    .bind(id)
    .first();

  if (!existing) {
    return respond(request, 404, false, "Task review was not found.");
  }

  const createdAt = new Date().toISOString();
  const noteAdded = note.length > 0;

  try {
    await env.DB.prepare("UPDATE task_reviews SET status = ? WHERE id = ?").bind(status, id).run();

    if (noteAdded) {
      await env.DB.prepare(
        `INSERT INTO task_review_notes
          (task_review_id, created_at, note)
          VALUES (?, ?, ?)`
      )
        .bind(id, createdAt, note)
        .run();
    }

    await env.DB.prepare(
      `INSERT INTO project_events
        (created_at, event_type, details)
        VALUES (?, ?, ?)`
    )
      .bind(createdAt, "task_review_status_updated", buildEventDetails(id, status, noteAdded))
      .run();
  } catch (error) {
    return respond(request, 500, false, "Task review could not be updated.");
  }

  return respond(request, 200, true, "Task review updated.");
}

function getTrimmedValue(formData, key) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function parsePositiveInteger(value) {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function buildEventDetails(id, status, noteAdded) {
  return JSON.stringify({
    task_review_id: id,
    status,
    note_added: noteAdded,
    source: "scarlette-admin",
  });
}

function wantsJson(request) {
  return request.headers.get("Accept")?.includes("application/json") || false;
}

function respond(request, status, ok, message) {
  if (wantsJson(request)) {
    return jsonResponse(status, ok, message);
  }

  if (ok) {
    return new Response(null, {
      status: 303,
      headers: {
        Location: "/admin/submissions",
        "Cache-Control": "no-store",
      },
    });
  }

  return htmlResponse(status, "Form error", message);
}

function requireAdminAuth(request, env) {
  if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD) {
    return respond(request, 500, false, "Admin authentication is not configured.");
  }

  const credentials = parseBasicAuth(request.headers.get("Authorization"));

  if (
    !credentials ||
    credentials.username !== env.ADMIN_USERNAME ||
    credentials.password !== env.ADMIN_PASSWORD
  ) {
    return authRequiredResponse(request);
  }

  return null;
}

function parseBasicAuth(header) {
  if (!header || !header.startsWith("Basic ")) {
    return null;
  }

  try {
    const decoded = atob(header.slice(6));
    const separatorIndex = decoded.indexOf(":");

    if (separatorIndex === -1) {
      return null;
    }

    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    };
  } catch (error) {
    return null;
  }
}

function authRequiredResponse(request) {
  const headers = {
    "WWW-Authenticate": 'Basic realm="Scarlette CRM"',
    "Cache-Control": "no-store",
  };

  if (wantsJson(request)) {
    headers["Content-Type"] = "application/json; charset=utf-8";
    return new Response(JSON.stringify({ ok: false, error: "Authentication required." }), {
      status: 401,
      headers,
    });
  }

  headers["Content-Type"] = "text/plain; charset=utf-8";
  return new Response("Authentication required.", {
    status: 401,
    headers,
  });
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
      <p><a href="/admin/submissions">Back to submissions</a></p>
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
