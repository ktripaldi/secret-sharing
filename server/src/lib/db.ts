import Database from 'better-sqlite3'

export type Db = Database.Database

const SCHEMA = `
CREATE TABLE IF NOT EXISTS secrets (
  id_hash     TEXT PRIMARY KEY,
  ciphertext  TEXT,
  iv          TEXT,
  max_views   INTEGER NOT NULL,
  views       INTEGER NOT NULL DEFAULT 0,
  expires_at  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL,
  consumed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_secrets_expires_at ON secrets (expires_at);
`

/** Open (or create) the SQLite database and ensure the schema exists. */
export function createDb(filename = ':memory:'): Db {
  const db = new Database(filename)
  db.pragma('journal_mode = WAL')
  db.exec(SCHEMA)
  return db
}
