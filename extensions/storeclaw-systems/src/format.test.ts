import { describe, test, expect } from "vitest";
import { formatSystemsForPrompt } from "./format.js";
import type { SystemModelInfo } from "./format.js";
import type { SystemEntry } from "./types.js";

function makeEntry(overrides: Partial<SystemEntry> = {}): SystemEntry {
  return {
    name: "test",
    dir: "/workspace/systems/test",
    manifest: {
      name: "test",
      description: "A test system.",
    },
    systemMdPath: "/workspace/systems/test/SYSTEM.md",
    capabilities: ["model"],
    ...overrides,
  };
}

describe("formatSystemsForPrompt", () => {
  test("returns empty string for empty array", () => {
    expect(formatSystemsForPrompt([], 20)).toBe("");
  });

  test("formats a single system correctly", () => {
    const result = formatSystemsForPrompt([makeEntry()], 20);

    expect(result).toContain("<active_systems>");
    expect(result).toContain("</active_systems>");
    expect(result).toContain("<name>test</name>");
    expect(result).toContain("<description>A test system.</description>");
    expect(result).toContain("<location>/workspace/systems/test/SYSTEM.md</location>");
    expect(result).toContain("<capabilities>model</capabilities>");
    expect(result).toContain("scan <active_systems> descriptions");
  });

  test("respects maxSystems cap", () => {
    const entries = Array.from({ length: 5 }, (_, i) =>
      makeEntry({
        name: `sys-${i}`,
        manifest: { name: `sys-${i}`, description: `System ${i}.` },
        systemMdPath: `/workspace/systems/sys-${i}/SYSTEM.md`,
      }),
    );

    const result = formatSystemsForPrompt(entries, 3);

    // Only first 3 should be included
    expect(result).toContain("sys-0");
    expect(result).toContain("sys-1");
    expect(result).toContain("sys-2");
    expect(result).not.toContain("sys-3");
    expect(result).not.toContain("sys-4");
  });

  test("includes all capabilities in output", () => {
    const entry = makeEntry({
      capabilities: ["model", "schemas", "workflows", "views", "schedule"],
    });

    const result = formatSystemsForPrompt([entry], 20);
    expect(result).toContain(
      "<capabilities>model, schemas, workflows, views, schedule</capabilities>",
    );
  });

  test("formats multiple systems", () => {
    const entries = [
      makeEntry({
        name: "customer",
        manifest: { name: "customer", description: "Track customers." },
        systemMdPath: "/workspace/systems/customer/SYSTEM.md",
      }),
      makeEntry({
        name: "credit",
        manifest: { name: "credit", description: "Track credit." },
        systemMdPath: "/workspace/systems/credit/SYSTEM.md",
      }),
    ];

    const result = formatSystemsForPrompt(entries, 20);
    expect(result).toContain("<name>customer</name>");
    expect(result).toContain("<name>credit</name>");
    // Should have exactly two <system> blocks
    const systemTags = result.match(/<system>/g);
    expect(systemTags).toHaveLength(2);
  });

  test("defaults capabilities to model when empty", () => {
    const entry = makeEntry({ capabilities: [] });
    const result = formatSystemsForPrompt([entry], 20);
    expect(result).toContain("<capabilities>model</capabilities>");
  });

  test("includes model_status when provided", () => {
    const entry = makeEntry({ name: "customer" });
    const modelInfos: SystemModelInfo[] = [
      {
        name: "customer",
        status: {
          pending: 3,
          processed: 10,
          failed: 1,
          needs_reprocess: 2,
          total_refs: 16,
        },
      },
    ];

    const result = formatSystemsForPrompt([entry], 20, modelInfos);
    expect(result).toContain('<model_status refs="16"');
    expect(result).toContain('pending="3"');
    expect(result).toContain('processed="10"');
    expect(result).toContain('failed="1"');
    expect(result).toContain('needs_reprocess="2"');
  });

  test("includes model_attention when there are pending items", () => {
    const entry = makeEntry({ name: "customer" });
    const modelInfos: SystemModelInfo[] = [
      {
        name: "customer",
        status: {
          pending: 2,
          processed: 5,
          failed: 0,
          needs_reprocess: 1,
          total_refs: 8,
        },
      },
    ];

    const result = formatSystemsForPrompt([entry], 20, modelInfos);
    expect(result).toContain("<model_attention>");
    expect(result).toContain("3 source ref(s) need processing");
  });

  test("does not include model_attention when nothing pending", () => {
    const entry = makeEntry({ name: "customer" });
    const modelInfos: SystemModelInfo[] = [
      {
        name: "customer",
        status: {
          pending: 0,
          processed: 5,
          failed: 0,
          needs_reprocess: 0,
          total_refs: 5,
        },
      },
    ];

    const result = formatSystemsForPrompt([entry], 20, modelInfos);
    expect(result).not.toContain("<model_attention>");
  });

  test("includes controller_hint for workflows", () => {
    const entry = makeEntry({
      manifest: {
        name: "customer",
        description: "Track customers.",
        controller: {
          workflows: ["workflows/update.lobster"],
        },
      },
    });

    const result = formatSystemsForPrompt([entry], 20);
    expect(result).toContain("<controller_hint>");
    expect(result).toContain("lobster run");
    expect(result).toContain("workflows/update.lobster");
  });

  test("includes extraction_hint for schemas", () => {
    const entry = makeEntry({
      manifest: {
        name: "customer",
        description: "Track customers.",
        controller: {
          schemas: ["schemas/extract.json"],
        },
      },
    });

    const result = formatSystemsForPrompt([entry], 20);
    expect(result).toContain("<extraction_hint>");
    expect(result).toContain("llm-task");
    expect(result).toContain("schemas/extract.json");
  });

  test("includes view_hint for views", () => {
    const entry = makeEntry({
      manifest: {
        name: "customer",
        description: "Track customers.",
        views: ["views/summary.md"],
      },
    });

    const result = formatSystemsForPrompt([entry], 20);
    expect(result).toContain("<view_hint>");
    expect(result).toContain("views/summary.md");
  });

  test("does not include hints when no controller/views", () => {
    const entry = makeEntry();
    const result = formatSystemsForPrompt([entry], 20);
    expect(result).not.toContain("<controller_hint>");
    expect(result).not.toContain("<extraction_hint>");
    expect(result).not.toContain("<view_hint>");
  });
});
