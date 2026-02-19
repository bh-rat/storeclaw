import type { DatabaseSync } from "node:sqlite";

/**
 * Ensures the system model SQLite schema exists.
 * Creates source_refs, processing_log, and rule_versions tables.
 */
export function ensureModelSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS source_refs (
      id TEXT PRIMARY KEY,
      rule_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_path TEXT,
      source_chunk_id TEXT,
      source_start_line INTEGER,
      source_end_line INTEGER,
      source_hash TEXT,
      snippet TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_source_refs_rule_id ON source_refs(rule_id);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_source_refs_source_type ON source_refs(source_type);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS processing_log (
      id TEXT PRIMARY KEY,
      source_ref_id TEXT NOT NULL,
      rule_id TEXT NOT NULL,
      rule_version INTEGER NOT NULL,
      processor TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      result_json TEXT,
      error TEXT,
      processed_at INTEGER,
      created_at INTEGER NOT NULL
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_processing_log_status ON processing_log(status);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_processing_log_rule_id ON processing_log(rule_id);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_processing_log_source_ref ON processing_log(source_ref_id);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS rule_versions (
      rule_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      match_pattern TEXT NOT NULL,
      processor TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (rule_id, version)
    );
  `);
}
