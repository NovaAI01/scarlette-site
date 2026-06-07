# Scarlette Site

Static one-page website for Scarlette, promoting the One Task Automation Sprint:
helping small businesses get rid of one repeated computer task with a small
working tool.

Core positioning: Scarlette helps small businesses remove copy-paste admin,
manual checks, file sorting, reports, and follow-ups one task at a time.

## Scope

Static one-page site with a Cloudflare Pages Function for the contact form.

No dashboard, login, SaaS app, blog, framework, or separate backend server.

Keep the offer focused on practical task removal, not on a specific technology
or one task type.

## Files

- `index.html` - page content and structure
- `styles.css` - responsive visual styling
- `script.js` - progressive form submission enhancement
- `functions/api/task-review.js` - Cloudflare Pages Function form handler
- `functions/api/task-review-status.js` - internal status and note update handler
- `functions/admin/submissions.js` - internal task review submissions page
- `schema.sql` - D1 table schema for captured task reviews
- `robots.txt` - crawler policy and sitemap location
- `sitemap.xml` - canonical public URL for search engines
- `README.md` - project notes and preview instructions

## SEO

`index.html` includes the page title, meta description, canonical URL, Open
Graph tags, and Twitter card tags for search and sharing previews.

`robots.txt` allows crawling and points search engines to `sitemap.xml`.

## Form Flow

Website form → `/api/task-review` → Cloudflare Pages Function → D1

## Local Preview

Run a local static server from the project root:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

Static file preview alone will not run Cloudflare Pages Functions. Use the
Cloudflare Pages local tooling when testing `/api/task-review`.

## Deployment

For Cloudflare Pages, deploy as a static site:

- Build command: none
- Output directory: `/`

Configure these Cloudflare Pages environment variables before testing the live
form:

- `DB`
- `TURNSTILE_SECRET_KEY`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`

Replace the public Turnstile placeholder in `index.html` before launch:

- `REPLACE_TURNSTILE_SITE_KEY`

After merge, configure the environment variables in the Cloudflare Pages project
settings before testing the live form.

## D1 Setup

`task_reviews` stores task review form submissions.

`project_events` stores audit events. Every successful form submission writes a
`submission_received` event after the task review row is captured.

`task_review_notes` stores internal notes for task review submissions.

Task review statuses are:

- `new`
- `reviewing`
- `quoted`
- `won`
- `lost`

The internal status update form writes a `task_review_status_updated` event to
`project_events`.

Create the D1 database:

```bash
wrangler d1 create scarlette-submissions
```

Apply `schema.sql` to the database:

```bash
wrangler d1 execute scarlette-submissions --file=schema.sql
```

Bind the D1 database to the Cloudflare Pages project as:

```text
DB
```

## Turnstile Setup

1. Create a Cloudflare Turnstile widget for `scarlettecreations.com`.
2. Copy the site key into `index.html`.
3. Add `TURNSTILE_SECRET_KEY` to Cloudflare Pages environment variables.
4. Confirm the D1 database is bound as `DB`.
5. Redeploy.
6. Submit a test form and confirm the row appears in D1.

## Outreach Checklist

Verify the form stores a row in D1 before sending the site to business owners.

## Internal Admin

`/admin/submissions` shows the latest task review submissions and lets you update
status or add a note.

`/admin/submissions` is protected by Basic Auth.

`/api/task-review-status` is also protected by Basic Auth.

`/api/task-review` remains public for customer form submissions.

Do not share the admin URL publicly.
