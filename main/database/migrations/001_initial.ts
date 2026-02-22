import Database from 'better-sqlite3';

export function runMigrations(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS meetings (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT 'Untitled Meeting',
      started_at TEXT NOT NULL,
      ended_at TEXT,
      duration_secs INTEGER,
      audio_path TEXT,
      status TEXT NOT NULL DEFAULT 'recording' CHECK(status IN ('recording', 'analyzing', 'completed', 'error')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS transcripts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
      speaker_label TEXT NOT NULL DEFAULT 'Speaker',
      content TEXT NOT NULL,
      start_time REAL NOT NULL,
      end_time REAL NOT NULL,
      confidence REAL NOT NULL DEFAULT 0.0,
      is_final INTEGER NOT NULL DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_transcripts_meeting ON transcripts(meeting_id);

    CREATE TABLE IF NOT EXISTS meeting_notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id TEXT NOT NULL UNIQUE REFERENCES meetings(id) ON DELETE CASCADE,
      executive_summary TEXT NOT NULL DEFAULT '',
      key_takeaways TEXT NOT NULL DEFAULT '[]',
      discussion_topics TEXT NOT NULL DEFAULT '[]',
      next_steps TEXT NOT NULL DEFAULT '[]',
      meeting_type TEXT NOT NULL DEFAULT 'general',
      sentiment TEXT NOT NULL DEFAULT 'neutral'
    );

    CREATE TABLE IF NOT EXISTS action_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      owner TEXT,
      due_date TEXT,
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('high', 'medium', 'low')),
      completed INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_action_items_meeting ON action_items(meeting_id);

    CREATE TABLE IF NOT EXISTS decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      context TEXT,
      decided_by TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_decisions_meeting ON decisions(meeting_id);

    CREATE TABLE IF NOT EXISTS attendees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      role TEXT,
      speaker_label TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_attendees_meeting ON attendees(meeting_id);
  `);

  // FTS5 virtual table for full-text search
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS meetings_fts USING fts5(
      meeting_id,
      title,
      transcript_text,
      summary,
      content='',
      tokenize='porter'
    );
  `);
}
