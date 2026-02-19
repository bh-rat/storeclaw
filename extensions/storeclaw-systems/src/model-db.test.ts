import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, test, expect, beforeEach, afterEach } from "vitest";
import { SystemModelDb } from "./model-db.js";

describe("SystemModelDb", () => {
  let tmpDir: string;
  let dbPath: string;

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "model-db-test-"));
    dbPath = path.join(tmpDir, "test.sqlite");
  });

  afterEach(async () => {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  test("constructor creates DB and schema", () => {
    const db = new SystemModelDb(dbPath);
    try {
      const status = db.getStatus();
      expect(status.total_refs).toBe(0);
      expect(status.pending).toBe(0);
      expect(status.processed).toBe(0);
      expect(status.failed).toBe(0);
      expect(status.needs_reprocess).toBe(0);
    } finally {
      db.close();
    }
  });

  test("addSourceRef and queryRefs", () => {
    const db = new SystemModelDb(dbPath);
    try {
      const now = Date.now();
      db.addSourceRef({
        id: "ref-1",
        rule_id: "extract-contact",
        source_type: "memory",
        source_path: "/memory/chunks.sqlite",
        source_chunk_id: "chunk-abc",
        source_start_line: 10,
        source_end_line: 20,
        source_hash: "abc123",
        snippet: "Customer Sharma-ji mentioned...",
        created_at: now,
        updated_at: now,
      });

      const refs = db.queryRefs();
      expect(refs).toHaveLength(1);
      expect(refs[0].id).toBe("ref-1");
      expect(refs[0].rule_id).toBe("extract-contact");
      expect(refs[0].source_type).toBe("memory");
      expect(refs[0].snippet).toBe("Customer Sharma-ji mentioned...");
    } finally {
      db.close();
    }
  });

  test("queryRefs filters by ruleId", () => {
    const db = new SystemModelDb(dbPath);
    try {
      const now = Date.now();
      db.addSourceRef({
        id: "ref-1",
        rule_id: "extract-contact",
        source_type: "memory",
        created_at: now,
        updated_at: now,
      });
      db.addSourceRef({
        id: "ref-2",
        rule_id: "track-credit",
        source_type: "sessions",
        created_at: now,
        updated_at: now,
      });

      const contactRefs = db.queryRefs("extract-contact");
      expect(contactRefs).toHaveLength(1);
      expect(contactRefs[0].id).toBe("ref-1");

      const creditRefs = db.queryRefs("track-credit");
      expect(creditRefs).toHaveLength(1);
      expect(creditRefs[0].id).toBe("ref-2");
    } finally {
      db.close();
    }
  });

  test("recordProcessing and queryProcessingLog", () => {
    const db = new SystemModelDb(dbPath);
    try {
      const now = Date.now();
      db.addSourceRef({
        id: "ref-1",
        rule_id: "extract-contact",
        source_type: "memory",
        created_at: now,
        updated_at: now,
      });

      db.recordProcessing({
        id: "log-1",
        source_ref_id: "ref-1",
        rule_id: "extract-contact",
        rule_version: 1,
        processor: "schemas/extract-contact.json",
        status: "processed",
        result_json: JSON.stringify({ name: "Sharma-ji", phone: "9876543210" }),
        processed_at: now,
        created_at: now,
      });

      const logs = db.queryProcessingLog();
      expect(logs).toHaveLength(1);
      expect(logs[0].id).toBe("log-1");
      expect(logs[0].status).toBe("processed");
      expect(logs[0].result_json).toContain("Sharma-ji");
    } finally {
      db.close();
    }
  });

  test("queryProcessingLog filters by ruleId and status", () => {
    const db = new SystemModelDb(dbPath);
    try {
      const now = Date.now();
      db.recordProcessing({
        id: "log-1",
        source_ref_id: "ref-1",
        rule_id: "extract-contact",
        rule_version: 1,
        processor: "schemas/extract-contact.json",
        status: "processed",
        created_at: now,
      });
      db.recordProcessing({
        id: "log-2",
        source_ref_id: "ref-2",
        rule_id: "track-credit",
        rule_version: 1,
        processor: "schemas/extract-credit.json",
        status: "pending",
        created_at: now,
      });
      db.recordProcessing({
        id: "log-3",
        source_ref_id: "ref-3",
        rule_id: "extract-contact",
        rule_version: 1,
        processor: "schemas/extract-contact.json",
        status: "failed",
        error: "Schema validation failed",
        created_at: now,
      });

      const pendingLogs = db.queryProcessingLog(undefined, "pending");
      expect(pendingLogs).toHaveLength(1);
      expect(pendingLogs[0].id).toBe("log-2");

      const contactLogs = db.queryProcessingLog("extract-contact");
      expect(contactLogs).toHaveLength(2);

      const contactFailed = db.queryProcessingLog("extract-contact", "failed");
      expect(contactFailed).toHaveLength(1);
      expect(contactFailed[0].error).toBe("Schema validation failed");
    } finally {
      db.close();
    }
  });

  test("pendingCount returns correct count", () => {
    const db = new SystemModelDb(dbPath);
    try {
      const now = Date.now();
      db.recordProcessing({
        id: "log-1",
        source_ref_id: "ref-1",
        rule_id: "r1",
        rule_version: 1,
        processor: "p1",
        status: "pending",
        created_at: now,
      });
      db.recordProcessing({
        id: "log-2",
        source_ref_id: "ref-2",
        rule_id: "r1",
        rule_version: 1,
        processor: "p1",
        status: "needs_reprocess",
        created_at: now,
      });
      db.recordProcessing({
        id: "log-3",
        source_ref_id: "ref-3",
        rule_id: "r1",
        rule_version: 1,
        processor: "p1",
        status: "processed",
        created_at: now,
      });

      expect(db.pendingCount()).toBe(2);
    } finally {
      db.close();
    }
  });

  test("getStatus returns aggregate counts", () => {
    const db = new SystemModelDb(dbPath);
    try {
      const now = Date.now();
      // Add some refs
      db.addSourceRef({
        id: "ref-1",
        rule_id: "r1",
        source_type: "memory",
        created_at: now,
        updated_at: now,
      });
      db.addSourceRef({
        id: "ref-2",
        rule_id: "r1",
        source_type: "memory",
        created_at: now,
        updated_at: now,
      });
      db.addSourceRef({
        id: "ref-3",
        rule_id: "r2",
        source_type: "sessions",
        created_at: now,
        updated_at: now,
      });

      // Add processing log entries
      db.recordProcessing({
        id: "l1",
        source_ref_id: "ref-1",
        rule_id: "r1",
        rule_version: 1,
        processor: "p1",
        status: "processed",
        created_at: now,
      });
      db.recordProcessing({
        id: "l2",
        source_ref_id: "ref-2",
        rule_id: "r1",
        rule_version: 1,
        processor: "p1",
        status: "pending",
        created_at: now,
      });
      db.recordProcessing({
        id: "l3",
        source_ref_id: "ref-3",
        rule_id: "r2",
        rule_version: 1,
        processor: "p2",
        status: "failed",
        created_at: now,
      });

      const status = db.getStatus();
      expect(status.total_refs).toBe(3);
      expect(status.processed).toBe(1);
      expect(status.pending).toBe(1);
      expect(status.failed).toBe(1);
      expect(status.needs_reprocess).toBe(0);
    } finally {
      db.close();
    }
  });

  test("addSourceRef upserts on same id", () => {
    const db = new SystemModelDb(dbPath);
    try {
      const now = Date.now();
      db.addSourceRef({
        id: "ref-1",
        rule_id: "r1",
        source_type: "memory",
        snippet: "original",
        created_at: now,
        updated_at: now,
      });
      db.addSourceRef({
        id: "ref-1",
        rule_id: "r1",
        source_type: "memory",
        snippet: "updated",
        created_at: now,
        updated_at: now + 1000,
      });

      const refs = db.queryRefs();
      expect(refs).toHaveLength(1);
      expect(refs[0].snippet).toBe("updated");
    } finally {
      db.close();
    }
  });

  test("addRuleVersion and getLatestRuleVersion", () => {
    const db = new SystemModelDb(dbPath);
    try {
      db.addRuleVersion("extract-contact", 1, "customer name, phone", "schemas/extract.json");
      db.addRuleVersion(
        "extract-contact",
        2,
        "customer name, phone, email",
        "schemas/extract-v2.json",
      );

      expect(db.getLatestRuleVersion("extract-contact")).toBe(2);
      expect(db.getLatestRuleVersion("nonexistent")).toBe(0);
    } finally {
      db.close();
    }
  });

  test("queryRefs respects limit", () => {
    const db = new SystemModelDb(dbPath);
    try {
      const now = Date.now();
      for (let i = 0; i < 10; i++) {
        db.addSourceRef({
          id: `ref-${i}`,
          rule_id: "r1",
          source_type: "memory",
          created_at: now + i,
          updated_at: now + i,
        });
      }

      const limited = db.queryRefs(undefined, 3);
      expect(limited).toHaveLength(3);
    } finally {
      db.close();
    }
  });
});
