import fs from "node:fs";
import { join } from "node:path";
import type { SystemEntry, SystemManifest } from "./types.js";

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

  // Simple line-by-line YAML parser for flat keys and arrays
  let currentKey = "";
  let currentObj: Record<string, unknown> | null = null;
  let currentArray: unknown[] | null = null;

  for (const rawLine of yamlBlock.split("\n")) {
    const line = rawLine.trimEnd();
    if (!line || line.startsWith("#")) continue;

    // Array item under a key
    const arrayItemMatch = line.match(/^\s+-\s+(.*)/);
    if (arrayItemMatch && !currentArray && currentKey) {
      // First array item under a top-level key — convert from object to array
      currentArray = [];
      currentObj = null;
      data[currentKey] = currentArray;
    }
    if (arrayItemMatch && currentArray) {
      const val = arrayItemMatch[1].trim();
      // Check for inline object { name: ..., cron: ..., task: ... }
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
        currentArray.push(obj);
      } else {
        currentArray.push(val.replace(/^["']|["']$/g, ""));
      }
      continue;
    }

    // Top-level or nested key: value
    const kvMatch = line.match(/^(\s*)(\w[\w_]*):\s*(.*)/);
    if (kvMatch) {
      const indent = kvMatch[1].length;
      const key = kvMatch[2];
      let value: string | unknown = kvMatch[3].trim();

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
        }
        continue;
      }

      // Empty value means start of nested object or array
      if (!value) {
        if (indent === 0) {
          currentKey = key;
          currentObj = {};
          currentArray = null;
          data[key] = currentObj;
        } else if (currentObj) {
          currentArray = [];
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
      } else {
        data[key] = value;
        currentKey = key;
        currentObj = null;
        currentArray = null;
      }
    }
  }

  return { data, body };
}

function computeCapabilities(manifest: SystemManifest): string[] {
  const caps: string[] = [];
  if (manifest.model?.state_files && manifest.model.state_files.length > 0) caps.push("model");
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
    if (data.model && typeof data.model === "object") {
      const model = data.model as Record<string, unknown>;
      manifest.model = {
        state_files: Array.isArray(model.state_files) ? (model.state_files as string[]) : undefined,
      };
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
    });
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));
  return entries;
}
