export type ModelRule = {
  id: string;
  match: string;
  source?: "memory" | "sessions" | "lancedb" | "all";
  processor: string;
  priority?: number;
};

export type SystemManifest = {
  name: string;
  description: string;
  model?: {
    store: string;
    rules?: ModelRule[];
    /** @deprecated Use store + rules instead. Kept for backward compatibility. */
    state_files?: string[];
  };
  controller?: {
    schemas?: string[];
    workflows?: string[];
    scripts?: string[];
  };
  views?: string[];
  schedule?: Array<{
    name: string;
    cron: string;
    task: string;
  }>;
};

export type SystemEntry = {
  name: string;
  dir: string;
  manifest: SystemManifest;
  systemMdPath: string;
  capabilities: string[];
  modelDbPath?: string;
};

export type SystemsConfig = {
  enabled: boolean;
  maxSystems: number;
};

export type SourceRef = {
  id: string;
  rule_id: string;
  source_type: "memory" | "sessions" | "lancedb";
  source_path?: string;
  source_chunk_id?: string;
  source_start_line?: number;
  source_end_line?: number;
  source_hash?: string;
  snippet?: string;
  created_at: number;
  updated_at: number;
};

export type ProcessingLogEntry = {
  id: string;
  source_ref_id: string;
  rule_id: string;
  rule_version: number;
  processor: string;
  status: "pending" | "processed" | "failed" | "needs_reprocess";
  result_json?: string;
  error?: string;
  processed_at?: number;
  created_at: number;
};

export type ModelStatus = {
  pending: number;
  processed: number;
  failed: number;
  needs_reprocess: number;
  total_refs: number;
};
