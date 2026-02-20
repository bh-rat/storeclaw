import fs from "node:fs/promises";
import path from "node:path";
import { Type } from "@sinclair/typebox";
import { type AnyAgentTool, jsonResult } from "./common.js";

const SYSTEMS_DIR = "systems";
const SYSTEM_MANIFEST = "SYSTEM.md";
const REGISTRY_FILE = "REGISTRY.md";

// ---------------------------------------------------------------------------
// business_system_create
// ---------------------------------------------------------------------------

const CreateSchema = Type.Object({
  name: Type.String(),
  description: Type.String(),
});

function scaffoldSystemMd(name: string, description: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const title = name
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
  return [
    "---",
    `name: ${name}`,
    `description: ${description}`,
    `created: ${today}`,
    "---",
    "",
    `# ${title}`,
    "",
    `_This is your business system for ${description.toLowerCase()}. Customize the sections below._`,
    "",
    "## Purpose",
    "_(What does this system track or automate? Write it in plain language.)_",
    "",
    "## Data Files",
    "_(List the files this system uses and their format. Example:)_",
    `- \`${name}.jsonl\` — one JSON object per entry \`{ id, ... }\``,
    "",
    "## How It Works",
    "_(How should you process information related to this system? What to extract from conversations, what to store, what to skip.)_",
    "",
    "## Views",
    "_(How should you present this data when the owner asks? What format, what level of detail?)_",
    "",
  ].join("\n");
}

function appendRegistryRow(existing: string, name: string, description: string): string {
  const row = `| ${name} | active | ${description} |`;
  if (!existing.trim()) {
    return [
      "# Business Systems",
      "",
      "| System | Status | Description |",
      "|--------|--------|-------------|",
      row,
      "",
    ].join("\n");
  }
  const trimmed = existing.trimEnd();
  return `${trimmed}\n${row}\n`;
}

export function createBusinessSystemCreateTool(options: { workspaceDir?: string }): AnyAgentTool {
  const workspaceDir = options.workspaceDir ?? process.cwd();

  return {
    label: "Business System Create",
    name: "business_system_create",
    description:
      "Create a new business tracking system (CRM, credit/udhar, inventory, orders, etc.) in the workspace. " +
      "Scaffolds the directory structure and manifest. After creation, read and customize the generated SYSTEM.md.",
    parameters: CreateSchema,
    execute: async (_toolCallId, params) => {
      const name = (params.name as string).trim().toLowerCase().replace(/\s+/g, "-");
      const description = (params.description as string).trim();

      if (!name) {
        return jsonResult({ error: "name is required" });
      }

      const systemsDir = path.join(workspaceDir, SYSTEMS_DIR);
      const systemDir = path.join(systemsDir, name);
      const systemMdPath = path.join(systemDir, SYSTEM_MANIFEST);
      const registryPath = path.join(systemsDir, REGISTRY_FILE);

      // Check if system already exists
      try {
        await fs.access(systemMdPath);
        return jsonResult({
          error: `Business system "${name}" already exists at ${systemMdPath}`,
          hint: "Use business_system_get to read the existing system, or choose a different name.",
        });
      } catch {
        // Expected — system doesn't exist yet
      }

      // Create directory + SYSTEM.md
      await fs.mkdir(systemDir, { recursive: true });
      await fs.writeFile(systemMdPath, scaffoldSystemMd(name, description), "utf-8");

      // Create/update REGISTRY.md
      let existingRegistry = "";
      try {
        existingRegistry = await fs.readFile(registryPath, "utf-8");
      } catch {
        // First system — registry doesn't exist yet
      }
      await fs.writeFile(
        registryPath,
        appendRegistryRow(existingRegistry, name, description),
        "utf-8",
      );

      const relSystemMd = path.join(SYSTEMS_DIR, name, SYSTEM_MANIFEST);
      return jsonResult({
        created: relSystemMd,
        message: `Created business system "${name}" at ${relSystemMd}`,
        nextSteps: [
          `Read ${relSystemMd}`,
          "Customize the Purpose, Data Files, How It Works, and Views sections based on what the owner needs",
          "Create any data files referenced in the Data Files section",
        ],
      });
    },
  };
}

// ---------------------------------------------------------------------------
// business_system_get
// ---------------------------------------------------------------------------

const GetSchema = Type.Object({
  name: Type.String(),
});

async function introspectFile(
  filePath: string,
  relPath: string,
): Promise<{ file: string; size: number; preview?: string }> {
  const stat = await fs.stat(filePath);
  const size = stat.size;
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".jsonl") {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const lines = content.split("\n").filter((l) => l.trim());
      const sampleLines = lines.slice(0, 3);
      const fields: string[] = [];
      for (const line of sampleLines) {
        try {
          const obj = JSON.parse(line);
          if (obj && typeof obj === "object" && !Array.isArray(obj)) {
            for (const key of Object.keys(obj)) {
              if (!fields.includes(key)) {
                fields.push(key);
              }
            }
          }
        } catch {
          // skip unparseable lines
        }
      }
      const schema = fields.length > 0 ? `Fields: { ${fields.join(", ")} }` : undefined;
      const sample = sampleLines[0] ?? undefined;
      return {
        file: relPath,
        size,
        preview: [
          `${lines.length} entries`,
          schema,
          sample ? `Sample: ${sample.slice(0, 200)}` : undefined,
        ]
          .filter(Boolean)
          .join("\n"),
      };
    } catch {
      return { file: relPath, size };
    }
  }

  if (ext === ".json") {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const parsed = JSON.parse(content);
      const keys = parsed && typeof parsed === "object" ? Object.keys(parsed) : [];
      return {
        file: relPath,
        size,
        preview: keys.length > 0 ? `Top-level keys: ${keys.join(", ")}` : undefined,
      };
    } catch {
      return { file: relPath, size };
    }
  }

  if (ext === ".md" && path.basename(filePath) !== SYSTEM_MANIFEST) {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const lines = content.split("\n").slice(0, 5);
      return { file: relPath, size, preview: lines.join("\n") };
    } catch {
      return { file: relPath, size };
    }
  }

  return { file: relPath, size };
}

export function createBusinessSystemGetTool(options: { workspaceDir?: string }): AnyAgentTool {
  const workspaceDir = options.workspaceDir ?? process.cwd();

  return {
    label: "Business System Get",
    name: "business_system_get",
    description:
      "Get full details of a business tracking system — its instructions, data files, and data structure summaries. " +
      "Use this to understand a system built in a prior session.",
    parameters: GetSchema,
    execute: async (_toolCallId, params) => {
      const name = (params.name as string).trim().toLowerCase();

      if (!name) {
        return jsonResult({ error: "name is required" });
      }

      const systemDir = path.join(workspaceDir, SYSTEMS_DIR, name);
      const systemMdPath = path.join(systemDir, SYSTEM_MANIFEST);

      // Read SYSTEM.md
      let manifest: string;
      try {
        manifest = await fs.readFile(systemMdPath, "utf-8");
      } catch {
        return jsonResult({
          error: `Business system "${name}" not found at ${systemMdPath}`,
          hint: "Check systems/REGISTRY.md for available systems.",
        });
      }

      // List and introspect all files
      const files: Awaited<ReturnType<typeof introspectFile>>[] = [];
      try {
        const entries = await fs.readdir(systemDir, { withFileTypes: true });
        for (const entry of entries) {
          if (!entry.isFile()) {
            continue;
          }
          const filePath = path.join(systemDir, entry.name);
          const relPath = path.join(SYSTEMS_DIR, name, entry.name);
          files.push(await introspectFile(filePath, relPath));
        }
      } catch {
        // directory listing failed — just return manifest
      }

      return jsonResult({
        system: name,
        manifest,
        files,
      });
    },
  };
}
