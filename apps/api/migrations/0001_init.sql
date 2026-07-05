-- Migration number: 0001    init
CREATE TABLE categories (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  key  TEXT UNIQUE NOT NULL
);

CREATE TABLE category_translations (
  category_id INTEGER NOT NULL REFERENCES categories(id),
  lang        TEXT NOT NULL,
  name        TEXT NOT NULL,
  PRIMARY KEY (category_id, lang)
);

CREATE TABLE items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id  INTEGER REFERENCES categories(id),
  image_key    TEXT,
  votes_left   INTEGER NOT NULL DEFAULT 0,
  votes_right  INTEGER NOT NULL DEFAULT 0,
  report_count INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'pending',
  submitted_by TEXT,
  created_at   INTEGER NOT NULL
);
CREATE INDEX idx_items_status ON items(status);

CREATE TABLE item_translations (
  item_id INTEGER NOT NULL REFERENCES items(id),
  lang    TEXT NOT NULL,
  label   TEXT NOT NULL,
  PRIMARY KEY (item_id, lang)
);

CREATE TABLE reports (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id          INTEGER NOT NULL REFERENCES items(id),
  reason           TEXT,
  reporter_session TEXT,
  created_at       INTEGER NOT NULL
);

CREATE TABLE votes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id    INTEGER NOT NULL REFERENCES items(id),
  side       TEXT NOT NULL CHECK (side IN ('left', 'right')),
  session_id TEXT,
  ip_hash    TEXT,
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX idx_votes_dedupe ON votes(item_id, session_id);
CREATE INDEX idx_votes_iphash ON votes(item_id, ip_hash);
