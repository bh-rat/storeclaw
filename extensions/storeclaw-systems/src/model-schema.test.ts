import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { ensureModelSchema } from "./model-schema.js";

describe("ensureModelSchema", () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "model-schema-test-"));
    dbPath = path.join(tmpDir, "test.sqlite");
  });

  afterEach(async () => {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  test("creates all three tables", () => {
    const db = new DatabaseSync(dbPath);
    try {
      ensureModelSchema(db);

      const tables = db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
        .all() as Array<{ name: string }>;

      const tableNames = tables.map((t) => t.name);
      expect(tableNames).toContain("source_refs");
      expect(tableNames).toContain("processing_log");
      expect(tableNames).toContain("rule_versions");
    } finally {
      db.close();
    }
  });

  test("source_refs table has expected columns", () => {
    const db = new DatabaseSync(dbPath);
    try {
      ensureModelSchema(db);

      const columns = db.prepare(`PRAGMA table_info(source_refs)`).all() as Array<{ name: string }>;

      const colNames = columns.map((c) => c.name);
      expect(colNames).toContain("id");
      expect(colNames).toContain("rule_id");
      expect(colNames).toContain("source_type");
      expect(colNames).toContain("source_path");
      expect(colNames).toContain("source_chunk_id");
      expect(colNames).toContain("source_start_line");
      expect(colNames).toContain("source_end_line");
      expect(colNames).toContain("source_hash");
      expect(colNames).toContain("snippet");
      expect(colNames).toContain("created_at");
      expect(colNames).toContain("updated_at");
    } finally {
      db.close();
    }
  });

  test("processing_log table has expected columns", () => {
    const db = new DatabaseSync(dbPath);
    try {
      ensureModelSchema(db);

      const columns = db.prepare(`PRAGMA table_info(processing_log)`).all() as Array<{
        name: string;
      }>;

      const colNames = columns.map((c) => c.name);
      expect(colNames).toContain("id");
      expect(colNames).toContain("source_ref_id");
      expect(colNames).toContain("rule_id");
      expect(colNames).toContain("rule_version");
      expect(colNames).toContain("processor");
      expect(colNames).toContain("status");
      expect(colNames).toContain("result_json");
      expect(colNames).toContain("error");
      expect(colNames).toContain("processed_at");
      expect(colNames).toContain("created_at");
    } finally {
      db.close();
    }
  });

  test("rule_versions table has composite primary key", () => {
    const db = new DatabaseSync(dbPath);
    try {
      ensureModelSchema(db);

      const columns = db.prepare(`PRAGMA table_info(rule_versions)`).all() as Array<{
        name: string;
        pk: number;
      }>;

      const pkCols = columns.filter((c) => c.pk > 0).map((c) => c.name);
      expect(pkCols).toContain("rule_id");
      expect(pkCols).toContain("version");
    } finally {
      db.close();
    }
  });

  test("idempotent — calling twice does not throw", () => {
    const db = new DatabaseSync(dbPath);
    try {
      ensureModelSchema(db);
      ensureModelSchema(db);
      // If it gets here without throwing, the test passes
      const tables = db
        .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
        .all() as Array<{ name: string }>;
      expect(tables.length).toBeGreaterThanOrEqual(3);
    } finally {
      db.close();
    }
  });

  test("creates expected indexes", () => {
    const db = new DatabaseSync(dbPath);
    try {
      ensureModelSchema(db);

      const indexes = db
        .prepare(
          `SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name`,
        )
        .all() as Array<{ name: string }>;

      const indexNames = indexes.map((i) => i.name);
      expect(indexNames).toContain("idx_source_refs_rule_id");
      expect(indexNames).toContain("idx_source_refs_source_type");
      expect(indexNames).toContain("idx_processing_log_status");
      expect(indexNames).toContain("idx_processing_log_rule_id");
      expect(indexNames).toContain("idx_processing_log_source_ref");
    } finally {
      db.close();
    }
  });
});
