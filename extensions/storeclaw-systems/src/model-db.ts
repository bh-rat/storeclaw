import { DatabaseSync } from "node:sqlite";
import { ensureModelSchema } from "./model-schema.js";
import type { ModelStatus, ProcessingLogEntry, SourceRef } from "./types.js";

/**
 * Per-system SQLite database wrapping source references and processing state.
 * The model never stores source data — only references to agent memory entries.
 */
export class SystemModelDb {
  private db: DatabaseSync;

  constructor(dbPath: string) {
    this.db = new DatabaseSync(dbPath);
    this.db.exec("PRAGMA journal_mode = WAL;");
    ensureModelSchema(this.db);
  }

  pendingCount(): number {
    const row = this.db
      .prepare(
        `SELECT COUNT(*) as count FROM processing_log WHERE status IN ('pending', 'needs_reprocess')`,
      )
      .get() as { count: number } | undefined;
    return row?.count ?? 0;
  }

  getStatus(): ModelStatus {
    const rows = this.db
      .prepare(`SELECT status, COUNT(*) as count FROM processing_log GROUP BY status`)
      .all() as Array<{ status: string; count: number }>;

    const status: ModelStatus = {
      pending: 0,
      processed: 0,
      failed: 0,
      needs_reprocess: 0,
      total_refs: 0,
    };

    for (const row of rows) {
      if (row.status in status) {
        (status as Record<string, number>)[row.status] = row.count;
      }
    }

    const refRow = this.db.prepare(`SELECT COUNT(*) as count FROM source_refs`).get() as
      | { count: number }
      | undefined;
    status.total_refs = refRow?.count ?? 0;

    return status;
  }

  addSourceRef(ref: SourceRef): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO source_refs
        (id, rule_id, source_type, source_path, source_chunk_id,
         source_start_line, source_end_line, source_hash, snippet,
         created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        ref.id,
        ref.rule_id,
        ref.source_type,
        ref.source_path ?? null,
        ref.source_chunk_id ?? null,
        ref.source_start_line ?? null,
        ref.source_end_line ?? null,
        ref.source_hash ?? null,
        ref.snippet ?? null,
        ref.created_at,
        ref.updated_at,
      );
  }

  recordProcessing(entry: ProcessingLogEntry): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO processing_log
        (id, source_ref_id, rule_id, rule_version, processor,
         status, result_json, error, processed_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        entry.id,
        entry.source_ref_id,
        entry.rule_id,
        entry.rule_version,
        entry.processor,
        entry.status,
        entry.result_json ?? null,
        entry.error ?? null,
        entry.processed_at ?? null,
        entry.created_at,
      );
  }

  queryRefs(ruleId?: string, limit = 100): SourceRef[] {
    if (ruleId) {
      return this.db
        .prepare(`SELECT * FROM source_refs WHERE rule_id = ? ORDER BY created_at DESC LIMIT ?`)
        .all(ruleId, limit) as SourceRef[];
    }
    return this.db
      .prepare(`SELECT * FROM source_refs ORDER BY created_at DESC LIMIT ?`)
      .all(limit) as SourceRef[];
  }

  queryProcessingLog(ruleId?: string, status?: string, limit = 100): ProcessingLogEntry[] {
    const conditions: string[] = [];
    const params: unknown[] = [];

    if (ruleId) {
      conditions.push("rule_id = ?");
      params.push(ruleId);
    }
    if (status) {
      conditions.push("status = ?");
      params.push(status);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    params.push(limit);

    return this.db
      .prepare(`SELECT * FROM processing_log ${where} ORDER BY created_at DESC LIMIT ?`)
      .all(...params) as ProcessingLogEntry[];
  }

  addRuleVersion(ruleId: string, version: number, matchPattern: string, processor: string): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO rule_versions
        (rule_id, version, match_pattern, processor, created_at)
        VALUES (?, ?, ?, ?, ?)`,
      )
      .run(ruleId, version, matchPattern, processor, Date.now());
  }

  getLatestRuleVersion(ruleId: string): number {
    const row = this.db
      .prepare(`SELECT MAX(version) as version FROM rule_versions WHERE rule_id = ?`)
      .get(ruleId) as { version: number | null } | undefined;
    return row?.version ?? 0;
  }

  close(): void {
    this.db.close();
  }
}
