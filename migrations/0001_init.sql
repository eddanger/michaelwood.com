-- Graffiti wall strokes. `data` is the client stroke JSON (color, size, points).
CREATE TABLE strokes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at INTEGER NOT NULL,
  ip_hash TEXT,
  data TEXT NOT NULL
);
CREATE INDEX idx_strokes_created ON strokes (created_at);
