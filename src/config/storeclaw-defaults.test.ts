import { describe, expect, it } from "vitest";
import { applyStoreclawDefaults } from "./storeclaw-defaults.js";

describe("applyStoreclawDefaults", () => {
  it("populates plugins.deny and skills.allowBundled on empty config", () => {
    const result = applyStoreclawDefaults({});

    expect(result.plugins?.deny).toBeDefined();
    expect(result.plugins!.deny!.length).toBeGreaterThan(0);
    expect(result.plugins!.deny).toContain("discord");
    expect(result.plugins!.deny).toContain("slack");
    expect(result.plugins!.deny).toContain("telegram");

    expect(result.skills?.allowBundled).toBeDefined();
    expect(result.skills!.allowBundled!.length).toBeGreaterThan(0);
    expect(result.skills!.allowBundled).toContain("weather");
    expect(result.skills!.allowBundled).toContain("wacli");
  });

  it("preserves existing plugins.deny (user override)", () => {
    const result = applyStoreclawDefaults({
      plugins: { deny: ["custom-plugin"] },
    });

    expect(result.plugins?.deny).toEqual(["custom-plugin"]);
  });

  it("preserves existing skills.allowBundled (user override)", () => {
    const result = applyStoreclawDefaults({
      skills: { allowBundled: ["weather"] },
    });

    expect(result.skills?.allowBundled).toEqual(["weather"]);
  });

  it("respects explicit empty deny list", () => {
    const result = applyStoreclawDefaults({
      plugins: { deny: [] },
    });

    expect(result.plugins?.deny).toEqual([]);
  });

  it("respects explicit empty allowBundled list", () => {
    const result = applyStoreclawDefaults({
      skills: { allowBundled: [] },
    });

    expect(result.skills?.allowBundled).toEqual([]);
  });

  it("returns same object when both fields are already set", () => {
    const cfg = {
      plugins: { deny: ["x"] },
      skills: { allowBundled: ["y"] },
    };
    const result = applyStoreclawDefaults(cfg);

    expect(result).toBe(cfg);
  });

  it("preserves other plugins/skills config fields", () => {
    const result = applyStoreclawDefaults({
      plugins: { enabled: false },
      skills: { load: { extraDirs: ["/tmp/skills"] } },
    });

    expect(result.plugins?.enabled).toBe(false);
    expect(result.plugins?.deny).toBeDefined();
    expect(result.skills?.load?.extraDirs).toEqual(["/tmp/skills"]);
    expect(result.skills?.allowBundled).toBeDefined();
  });
});
