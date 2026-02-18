import { describe, test, expect } from "vitest";
import { formatSystemsForPrompt } from "./format.js";
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
});
