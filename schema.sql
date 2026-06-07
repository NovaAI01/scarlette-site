CREATE TABLE IF NOT EXISTS task_reviews (
id INTEGER PRIMARY KEY AUTOINCREMENT,
created_at TEXT NOT NULL,
name TEXT NOT NULL,
email TEXT NOT NULL,
task TEXT NOT NULL,
tools TEXT,
problems TEXT,
status TEXT NOT NULL DEFAULT 'new'
);

CREATE TABLE IF NOT EXISTS project_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  event_type TEXT NOT NULL,
  details TEXT
);

CREATE TABLE IF NOT EXISTS task_review_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_review_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  note TEXT NOT NULL,
  FOREIGN KEY (task_review_id) REFERENCES task_reviews(id)
);
