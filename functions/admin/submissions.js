const STATUSES = ["new", "reviewing", "quoted", "won", "lost"];

export async function onRequest(context) {
  const { request, env } = context;
  const authResponse = requireAdminAuth(request, env);

  if (authResponse) {
    return authResponse;
  }

  if (request.method !== "GET") {
    return new Response("Method not allowed", {
      status: 405,
      headers: {
        Allow: "GET",
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }

  if (!env.DB) {
    return htmlResponse(500, "Admin error", "D1 binding DB is not configured.");
  }

  const reviews = await getReviews(env.DB);
  const notesByReviewId = await getNotesByReviewId(env.DB, reviews);

  return htmlResponse(200, "Scarlette Task Reviews", renderPage(reviews, notesByReviewId));
}

async function getReviews(db) {
  const { results } = await db
    .prepare(
      `SELECT id, created_at, name, email, task, tools, problems, status
       FROM task_reviews
       ORDER BY id DESC
       LIMIT 50`
    )
    .all();

  return results || [];
}

async function getNotesByReviewId(db, reviews) {
  const ids = reviews.map((review) => review.id);
  const notesByReviewId = new Map();

  if (ids.length === 0) {
    return notesByReviewId;
  }

  const placeholders = ids.map(() => "?").join(", ");
  const { results } = await db
    .prepare(
      `SELECT id, task_review_id, created_at, note
       FROM task_review_notes
       WHERE task_review_id IN (${placeholders})
       ORDER BY created_at ASC, id ASC`
    )
    .bind(...ids)
    .all();

  for (const note of results || []) {
    const existing = notesByReviewId.get(note.task_review_id) || [];
    existing.push(note);
    notesByReviewId.set(note.task_review_id, existing);
  }

  return notesByReviewId;
}

function renderPage(reviews, notesByReviewId) {
  const rows = reviews.length
    ? reviews.map((review) => renderReview(review, notesByReviewId.get(review.id) || [])).join("")
    : '<p class="empty">No task reviews yet.</p>';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Scarlette Task Reviews</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #101113;
        --panel: #181a1f;
        --panel-strong: #202329;
        --text: #f2f0eb;
        --muted: #c5c0b8;
        --line: #343840;
        --accent: #e6b35c;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        background: var(--bg);
        color: var(--text);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        line-height: 1.5;
      }

      main {
        width: min(1180px, calc(100% - 32px));
        margin: 0 auto;
        padding: 32px 0 56px;
      }

      h1 {
        margin: 0 0 16px;
        font-size: 2.6rem;
        line-height: 1.05;
      }

      h2 {
        margin: 0 0 8px;
        font-size: 1.25rem;
      }

      .warning {
        margin: 0 0 24px;
        padding: 14px 16px;
        border: 1px solid rgba(230, 179, 92, 0.65);
        border-radius: 8px;
        background: rgba(230, 179, 92, 0.14);
        color: var(--text);
        font-weight: 800;
      }

      .reviews {
        display: grid;
        gap: 16px;
      }

      article {
        display: grid;
        gap: 18px;
        padding: 20px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--panel);
      }

      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 8px 16px;
        color: var(--muted);
        font-weight: 700;
      }

      .content {
        display: grid;
        gap: 12px;
      }

      .field-title {
        margin: 0 0 4px;
        color: var(--accent);
        font-size: 0.78rem;
        font-weight: 800;
        text-transform: uppercase;
      }

      p {
        margin: 0;
      }

      .text-block,
      .notes {
        padding: 12px;
        border: 1px solid var(--line);
        border-radius: 6px;
        background: #111318;
        white-space: pre-wrap;
      }

      .notes {
        display: grid;
        gap: 10px;
      }

      .note-time {
        display: block;
        margin-bottom: 4px;
        color: var(--muted);
        font-size: 0.85rem;
        font-weight: 700;
      }

      form {
        display: grid;
        gap: 10px;
        padding-top: 4px;
      }

      label {
        display: grid;
        gap: 6px;
        font-weight: 800;
      }

      select,
      textarea {
        width: 100%;
        border: 1px solid var(--line);
        border-radius: 6px;
        background: #111318;
        color: var(--text);
        font: inherit;
      }

      select {
        min-height: 44px;
        padding: 8px 10px;
      }

      textarea {
        min-height: 90px;
        padding: 10px;
        resize: vertical;
      }

      select:focus,
      textarea:focus {
        border-color: rgba(230, 179, 92, 0.7);
        outline: 3px solid rgba(240, 199, 115, 0.18);
      }

      button {
        width: fit-content;
        min-height: 44px;
        padding: 10px 16px;
        border: 1px solid #dca64d;
        border-radius: 6px;
        background: var(--accent);
        color: #15120d;
        font: inherit;
        font-weight: 850;
        cursor: pointer;
      }

      .empty {
        padding: 20px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: var(--panel);
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Scarlette Task Reviews</h1>
      <p class="warning">Internal page. Basic authentication is enabled.</p>
      <section class="reviews" aria-label="Task review submissions">
        ${rows}
      </section>
    </main>
  </body>
</html>`;
}

function renderReview(review, notes) {
  return `<article>
  <header>
    <h2>#${escapeHtml(String(review.id))} ${escapeHtml(review.name)}</h2>
    <div class="meta">
      <span>${escapeHtml(review.created_at)}</span>
      <span>${escapeHtml(review.email)}</span>
      <span>Status: ${escapeHtml(review.status)}</span>
    </div>
  </header>
  <div class="content">
    ${renderField("Task", review.task)}
    ${renderField("Tools/files involved", review.tools || "Not provided")}
    ${renderField("What usually goes wrong", review.problems || "Not provided")}
    ${renderNotes(notes)}
  </div>
  <form action="/api/task-review-status" method="POST">
    <input type="hidden" name="id" value="${escapeHtml(String(review.id))}">
    <label>
      <span>Status</span>
      <select name="status">
        ${renderStatusOptions(review.status)}
      </select>
    </label>
    <label>
      <span>Note</span>
      <textarea name="note" maxlength="2000"></textarea>
    </label>
    <button type="submit">Update</button>
  </form>
</article>`;
}

function renderField(label, value) {
  return `<section>
  <p class="field-title">${escapeHtml(label)}</p>
  <p class="text-block">${escapeHtml(value)}</p>
</section>`;
}

function renderNotes(notes) {
  if (notes.length === 0) {
    return `<section>
  <p class="field-title">Notes</p>
  <p class="text-block">No notes yet.</p>
</section>`;
  }

  const noteItems = notes
    .map(
      (note) => `<p>
  <span class="note-time">${escapeHtml(note.created_at)}</span>
  ${escapeHtml(note.note)}
</p>`
    )
    .join("");

  return `<section>
  <p class="field-title">Notes</p>
  <div class="notes">${noteItems}</div>
</section>`;
}

function renderStatusOptions(currentStatus) {
  return STATUSES.map((status) => {
    const selected = status === currentStatus ? " selected" : "";
    return `<option value="${escapeHtml(status)}"${selected}>${escapeHtml(status)}</option>`;
  }).join("");
}

function htmlResponse(status, title, body) {
  const responseBody = body.startsWith("<!doctype html>")
    ? body
    : `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(body)}</p>
    </main>
  </body>
</html>`;

  return new Response(responseBody, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function requireAdminAuth(request, env) {
  if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD) {
    return new Response("Admin authentication is not configured.", {
      status: 500,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  const credentials = parseBasicAuth(request.headers.get("Authorization"));

  if (
    !credentials ||
    credentials.username !== env.ADMIN_USERNAME ||
    credentials.password !== env.ADMIN_PASSWORD
  ) {
    return new Response("Authentication required.", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Scarlette CRM"',
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
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
