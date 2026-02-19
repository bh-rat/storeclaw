import fs from "node:fs";
import { join } from "node:path";
import type { ModelRule, SystemEntry, SystemManifest } from "./types.js";

/**
 * Parse YAML frontmatter from a markdown file's content.
 * Returns the parsed manifest fields and the remaining body.
 * Handles a minimal subset of YAML — enough for SYSTEM.md frontmatter.
 */
function parseFrontmatter(content: string): { data: Record<string, unknown>; body: string } | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return null;
  }

  const yamlBlock = match[1];
  const body = match[2];
  const data: Record<string, unknown> = {};

  // Simple line-by-line YAML parser for flat keys, nested objects, and arrays
  let currentKey = "";
  let currentObj: Record<string, unknown> | null = null;
  let currentArray: unknown[] | null = null;
  // Track the current array item object for multi-line array items (- id: foo \n match: bar)
  let currentArrayItem: Record<string, unknown> | null = null;

  for (const rawLine of yamlBlock.split("\n")) {
    const line = rawLine.trimEnd();
    if (!line || line.startsWith("#")) continue;

    // Array item: "  - value" or "    - id: foo"
    const arrayItemMatch = line.match(/^(\s+)-\s+(.*)/);
    if (arrayItemMatch) {
      // If we don't have an array yet under the current key, start one
      if (!currentArray && currentKey) {
        currentArray = [];
        currentObj = null;
        currentArrayItem = null;
        data[currentKey] = currentArray;
      } else if (!currentArray && currentObj) {
        // Nested array under an object key — already handled via kvMatch empty value
      }

      if (currentArray) {
        const val = arrayItemMatch[2].trim();
        // Inline object { name: ..., cron: ..., task: ... }
        if (val.startsWith("{") && val.endsWith("}")) {
          const inner = val.slice(1, -1);
          const obj: Record<string, string> = {};
          for (const pair of inner.split(",")) {
            const [k, ...vParts] = pair.split(":");
            if (k && vParts.length > 0) {
              obj[k.trim()] = vParts
                .join(":")
                .trim()
                .replace(/^["']|["']$/g, "");
            }
          }
          currentArrayItem = null;
          currentArray.push(obj);
        } else {
          // Check if this is "- key: value" (multi-line object item)
          const itemKvMatch = val.match(/^(\w[\w_-]*):\s*(.*)/);
          if (itemKvMatch) {
            const obj: Record<string, string> = {};
            obj[itemKvMatch[1]] = itemKvMatch[2].trim().replace(/^["']|["']$/g, "");
            currentArrayItem = obj;
            currentArray.push(obj);
          } else {
            currentArrayItem = null;
            currentArray.push(val.replace(/^["']|["']$/g, ""));
          }
        }
        continue;
      }
    }

    // Top-level or nested key: value
    const kvMatch = line.match(/^(\s*)(\w[\w_-]*):\s*(.*)/);
    if (kvMatch) {
      const indent = kvMatch[1].length;
      const key = kvMatch[2];
      let value: string | unknown = kvMatch[3].trim();

      // Continuation of a multi-line array item object (e.g. "    match: ..." after "  - id: ...")
      if (indent > 0 && currentArrayItem && currentArray) {
        if (typeof value === "string" && value) {
          currentArrayItem[key] = value.replace(/^["']|["']$/g, "");
        } else {
          currentArrayItem[key] = value;
        }
        continue;
      }

      // Inline array [a, b, c]
      if (typeof value === "string" && value.startsWith("[") && value.endsWith("]")) {
        const items = value
          .slice(1, -1)
          .split(",")
          .map((s) => s.trim().replace(/^["']|["']$/g, ""))
          .filter(Boolean);
        if (indent > 0 && currentObj && currentKey) {
          currentObj[key] = items;
        } else {
          data[key] = items;
          currentKey = key;
          currentObj = null;
          currentArray = null;
          currentArrayItem = null;
        }
        continue;
      }

      // Empty value means start of nested object or array
      if (!value) {
        if (indent === 0) {
          currentKey = key;
          currentObj = {};
          currentArray = null;
          currentArrayItem = null;
          data[key] = currentObj;
        } else if (currentObj) {
          currentArray = [];
          currentArrayItem = null;
          currentObj[key] = currentArray;
        }
        continue;
      }

      // Strip quotes
      if (typeof value === "string") {
        value = value.replace(/^["']|["']$/g, "");
      }

      if (indent > 0 && currentObj && currentKey) {
        currentObj[key] = value;
        currentArray = null;
        currentArrayItem = null;
      } else {
        data[key] = value;
        currentKey = key;
        currentObj = null;
        currentArray = null;
        currentArrayItem = null;
      }
    }
  }

  return { data, body };
}

function parseModelRules(raw: unknown): ModelRule[] {
  if (!Array.isArray(raw)) return [];
  const rules: ModelRule[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || !item) continue;
    const obj = item as Record<string, unknown>;
    const id = typeof obj.id === "string" ? obj.id : undefined;
    const match = typeof obj.match === "string" ? obj.match : undefined;
    const processor = typeof obj.processor === "string" ? obj.processor : undefined;
    if (!id || !match || !processor) continue;
    const source = typeof obj.source === "string" ? obj.source : undefined;
    const priority = typeof obj.priority === "number" ? obj.priority : undefined;
    rules.push({
      id,
      match,
      processor,
      ...(source && ["memory", "sessions", "lancedb", "all"].includes(source)
        ? { source: source as ModelRule["source"] }
        : {}),
      ...(priority !== undefined ? { priority } : {}),
    });
  }
  return rules;
}

function computeCapabilities(manifest: SystemManifest): string[] {
  const caps: string[] = [];
  const hasModel =
    manifest.model?.store ||
    (manifest.model?.rules && manifest.model.rules.length > 0) ||
    (manifest.model?.state_files && manifest.model.state_files.length > 0);
  if (hasModel) caps.push("model");
  if (manifest.controller?.schemas && manifest.controller.schemas.length > 0) caps.push("schemas");
  if (manifest.controller?.workflows && manifest.controller.workflows.length > 0)
    caps.push("workflows");
  if (manifest.controller?.scripts && manifest.controller.scripts.length > 0) caps.push("scripts");
  if (manifest.views && manifest.views.length > 0) caps.push("views");
  if (manifest.schedule && manifest.schedule.length > 0) caps.push("schedule");
  return caps;
}

export function discoverSystems(workspaceDir: string): SystemEntry[] {
  const systemsDir = join(workspaceDir, "systems");

  try {
    if (!fs.existsSync(systemsDir) || !fs.statSync(systemsDir).isDirectory()) {
      return [];
    }
  } catch {
    return [];
  }

  const entries: SystemEntry[] = [];
  let dirents: fs.Dirent[];

  try {
    dirents = fs.readdirSync(systemsDir, { withFileTypes: true });
  } catch {
    return [];
  }

  for (const dirent of dirents) {
    if (!dirent.isDirectory()) continue;

    const systemDir = join(systemsDir, dirent.name);
    const systemMdPath = join(systemDir, "SYSTEM.md");

    try {
      if (!fs.existsSync(systemMdPath)) continue;
    } catch {
      continue;
    }

    let content: string;
    try {
      content = fs.readFileSync(systemMdPath, "utf-8");
    } catch {
      continue;
    }

    const parsed = parseFrontmatter(content);
    if (!parsed) continue;

    const data = parsed.data;
    const name = typeof data.name === "string" ? data.name : dirent.name;
    const description = typeof data.description === "string" ? data.description : "";

    if (!description) continue;

    const manifest: SystemManifest = {
      name,
      description,
    };

    // Parse model
    let modelDbPath: string | undefined;
    if (data.model && typeof data.model === "object") {
      const model = data.model as Record<string, unknown>;
      const store = typeof model.store === "string" ? model.store : undefined;
      const rules = parseModelRules(model.rules);
      manifest.model = {
        store: store ?? `${name}.sqlite`,
        rules: rules.length > 0 ? rules : undefined,
        state_files: Array.isArray(model.state_files) ? (model.state_files as string[]) : undefined,
      };
      modelDbPath = join(systemDir, manifest.model.store);
    }

    // Parse controller
    if (data.controller && typeof data.controller === "object") {
      const ctrl = data.controller as Record<string, unknown>;
      manifest.controller = {
        schemas: Array.isArray(ctrl.schemas) ? (ctrl.schemas as string[]) : undefined,
        workflows: Array.isArray(ctrl.workflows) ? (ctrl.workflows as string[]) : undefined,
        scripts: Array.isArray(ctrl.scripts) ? (ctrl.scripts as string[]) : undefined,
      };
    }

    // Parse views
    if (Array.isArray(data.views)) {
      manifest.views = data.views as string[];
    }

    // Parse schedule
    if (Array.isArray(data.schedule)) {
      manifest.schedule = (data.schedule as Record<string, string>[]).filter(
        (s) => s.name && s.cron && s.task,
      ) as SystemManifest["schedule"];
    }

    entries.push({
      name,
      dir: systemDir,
      manifest,
      systemMdPath,
      capabilities: computeCapabilities(manifest),
      modelDbPath,
    });
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));
  return entries;
}
