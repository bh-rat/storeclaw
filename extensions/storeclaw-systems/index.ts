/**
 * StoreClaw Systems Plugin
 *
 * Discovers business systems from workspace/systems/ directories
 * and injects them as <active_systems> context, following the same
 * pattern as skill injection via <available_skills>.
 *
 * Registers the `system_model` tool for agents to query/update
 * per-system SQLite model databases (source refs + processing state).
 */

import fs from "node:fs";
import { join } from "node:path";
import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { systemsConfigSchema } from "./src/config.js";
import { discoverSystems } from "./src/discovery.js";
import { formatSystemsForPrompt } from "./src/format.js";
import type { SystemModelInfo } from "./src/format.js";
import { SystemModelDb } from "./src/model-db.js";
import type { ModelStatus, SystemEntry } from "./src/types.js";

function tryGetModelStatus(sys: SystemEntry): ModelStatus | undefined {
  if (!sys.modelDbPath) return undefined;
  try {
    if (!fs.existsSync(sys.modelDbPath)) return undefined;
    const db = new SystemModelDb(sys.modelDbPath);
    try {
      return db.getStatus();
    } finally {
      db.close();
    }
  } catch {
    return undefined;
  }
}

function appendAuditLog(sys: SystemEntry, entry: Record<string, unknown>): void {
  if (!sys.dir) return;
  const logPath = join(sys.dir, "processing.jsonl");
  try {
    const line = JSON.stringify({ ...entry, timestamp: Date.now() }) + "\n";
    fs.appendFileSync(logPath, line, "utf-8");
  } catch {
    // best-effort
  }
}

const systemsPlugin = {
  id: "storeclaw-systems",
  name: "StoreClaw Systems",
  description: "Business systems discovery and context injection",
  configSchema: systemsConfigSchema,

  register(api: OpenClawPluginApi) {
    const cfg = systemsConfigSchema.parse(api.pluginConfig);

    if (!cfg.enabled) {
      api.logger.info("storeclaw-systems: disabled by config");
      return;
    }

    // Cache discovered systems for tool access
    let discoveredSystems: SystemEntry[] = [];

    // before_agent_start: discover systems, compute model status, inject context
    api.on(
      "before_agent_start",
      (_event, ctx) => {
        const workspaceDir = ctx?.workspaceDir;

        if (!workspaceDir) {
          return;
        }

        const systems = discoverSystems(workspaceDir);
        discoveredSystems = systems;

        if (systems.length === 0) {
          return;
        }

        // Compute model status for systems with SQLite DBs
        const modelInfos: SystemModelInfo[] = systems.map((sys) => ({
          name: sys.name,
          status: tryGetModelStatus(sys),
        }));

        const prependContext = formatSystemsForPrompt(systems, cfg.maxSystems, modelInfos);

        if (!prependContext) {
          return;
        }

        api.logger.info?.(`storeclaw-systems: injecting ${systems.length} system(s) into context`);

        return { prependContext };
      },
      { priority: 50 },
    );

    // Register system_model tool
    api.registerTool(
      {
        name: "system_model",
        label: "System Model",
        description:
          "Query and update per-system model databases. Actions: status (get processing status), query (query source_refs or processing_log), add_ref (add source reference), process (record processing result).",
        parameters: Type.Object({
          system: Type.String({
            description: "System name (matches the name in SYSTEM.md)",
          }),
          action: Type.Union(
            [
              Type.Literal("status"),
              Type.Literal("query"),
              Type.Literal("add_ref"),
              Type.Literal("process"),
            ],
            { description: "Action to perform" },
          ),
          // query params
          target: Type.Optional(
            Type.Union([Type.Literal("source_refs"), Type.Literal("processing_log")], {
              description: "For query action: which table to query",
            }),
          ),
          rule_id: Type.Optional(
            Type.String({ description: "Filter by rule_id (for query/add_ref/process)" }),
          ),
          filter_status: Type.Optional(
            Type.String({
              description:
                "For query action on processing_log: filter by status (pending|processed|failed|needs_reprocess)",
            }),
          ),
          limit: Type.Optional(
            Type.Number({ description: "Max results for query action (default 100)" }),
          ),
          // add_ref params
          ref_id: Type.Optional(Type.String({ description: "For add_ref: unique reference ID" })),
          source_type: Type.Optional(
            Type.String({ description: "For add_ref: memory | sessions | lancedb" }),
          ),
          source_path: Type.Optional(
            Type.String({ description: "For add_ref: file path in agent memory" }),
          ),
          source_chunk_id: Type.Optional(
            Type.String({ description: "For add_ref: chunk ID from memory SQLite" }),
          ),
          source_start_line: Type.Optional(Type.Number({ description: "For add_ref: start line" })),
          source_end_line: Type.Optional(Type.Number({ description: "For add_ref: end line" })),
          source_hash: Type.Optional(
            Type.String({ description: "For add_ref: hash of content at time of reference" }),
          ),
          snippet: Type.Optional(
            Type.String({ description: "For add_ref: short preview (NOT full data copy)" }),
          ),
          // process params
          log_id: Type.Optional(
            Type.String({ description: "For process: unique processing log entry ID" }),
          ),
          source_ref_id: Type.Optional(
            Type.String({ description: "For process: source reference ID" }),
          ),
          rule_version: Type.Optional(
            Type.Number({ description: "For process: rule version number" }),
          ),
          processor: Type.Optional(
            Type.String({ description: "For process: processor identifier" }),
          ),
          status: Type.Optional(
            Type.String({
              description: "For process: result status (pending|processed|failed|needs_reprocess)",
            }),
          ),
          result_json: Type.Optional(
            Type.String({ description: "For process: extracted/derived output as JSON string" }),
          ),
          error: Type.Optional(
            Type.String({ description: "For process: error message if failed" }),
          ),
        }),

        async execute(_id: string, params: Record<string, unknown>) {
          const systemName = params.system as string;
          const action = params.action as string;

          const sys = discoveredSystems.find((s) => s.name === systemName);
          if (!sys) {
            return [{ text: `Error: system "${systemName}" not found` }];
          }

          if (!sys.modelDbPath) {
            return [
              {
                text: `Error: system "${systemName}" has no model configured. Add model.store to SYSTEM.md frontmatter.`,
              },
            ];
          }

          const db = new SystemModelDb(sys.modelDbPath);
          try {
            switch (action) {
              case "status": {
                const st = db.getStatus();
                return [{ text: JSON.stringify(st, null, 2) }];
              }

              case "query": {
                const target = (params.target as string) || "source_refs";
                const ruleId = params.rule_id as string | undefined;
                const limit = (params.limit as number) || 100;

                if (target === "processing_log") {
                  const filterStatus = params.filter_status as string | undefined;
                  const rows = db.queryProcessingLog(ruleId, filterStatus, limit);
                  return [{ text: JSON.stringify(rows, null, 2) }];
                }
                const rows = db.queryRefs(ruleId, limit);
                return [{ text: JSON.stringify(rows, null, 2) }];
              }

              case "add_ref": {
                const refId = params.ref_id as string;
                const ruleId = params.rule_id as string;
                const sourceType = params.source_type as "memory" | "sessions" | "lancedb";
                if (!refId || !ruleId || !sourceType) {
                  return [{ text: "Error: add_ref requires ref_id, rule_id, and source_type" }];
                }
                const now = Date.now();
                db.addSourceRef({
                  id: refId,
                  rule_id: ruleId,
                  source_type: sourceType,
                  source_path: params.source_path as string | undefined,
                  source_chunk_id: params.source_chunk_id as string | undefined,
                  source_start_line: params.source_start_line as number | undefined,
                  source_end_line: params.source_end_line as number | undefined,
                  source_hash: params.source_hash as string | undefined,
                  snippet: params.snippet as string | undefined,
                  created_at: now,
                  updated_at: now,
                });
                return [{ text: `Source reference "${refId}" added for rule "${ruleId}".` }];
              }

              case "process": {
                const logId = params.log_id as string;
                const sourceRefId = params.source_ref_id as string;
                const ruleId = params.rule_id as string;
                const ruleVersion = (params.rule_version as number) ?? 1;
                const processor = params.processor as string;
                const resultStatus =
                  (params.status as "pending" | "processed" | "failed" | "needs_reprocess") ??
                  "processed";
                if (!logId || !sourceRefId || !ruleId || !processor) {
                  return [
                    {
                      text: "Error: process requires log_id, source_ref_id, rule_id, and processor",
                    },
                  ];
                }
                const now = Date.now();
                db.recordProcessing({
                  id: logId,
                  source_ref_id: sourceRefId,
                  rule_id: ruleId,
                  rule_version: ruleVersion,
                  processor,
                  status: resultStatus,
                  result_json: params.result_json as string | undefined,
                  error: params.error as string | undefined,
                  processed_at: resultStatus === "processed" ? now : undefined,
                  created_at: now,
                });

                // Audit log
                appendAuditLog(sys, {
                  action: "process",
                  log_id: logId,
                  source_ref_id: sourceRefId,
                  rule_id: ruleId,
                  status: resultStatus,
                });

                return [
                  {
                    text: `Processing recorded: "${logId}" status=${resultStatus} for rule "${ruleId}".`,
                  },
                ];
              }

              default:
                return [{ text: `Error: unknown action "${action}"` }];
            }
          } finally {
            db.close();
          }
        },
      },
      { name: "system_model", optional: true },
    );

    // agent_end: lightweight logging for debugging/analytics
    api.on("agent_end", () => {
      api.logger.info?.("storeclaw-systems: agent_end hook fired");

      // Write session summary to processing.jsonl for each system that has a model
      for (const sys of discoveredSystems) {
        if (sys.modelDbPath) {
          appendAuditLog(sys, {
            event: "agent_end",
            system: sys.name,
          });
        }
      }
    });

    api.logger.info("storeclaw-systems: plugin registered");
  },
};

export default systemsPlugin;
