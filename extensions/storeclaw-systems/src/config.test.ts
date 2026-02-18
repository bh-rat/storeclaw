import { describe, test, expect } from "vitest";
import { systemsConfigSchema, DEFAULT_CONFIG } from "./config.js";

describe("systemsConfigSchema", () => {
  test("returns defaults for undefined input", () => {
    const result = systemsConfigSchema.parse(undefined);
    expect(result).toEqual(DEFAULT_CONFIG);
  });

  test("returns defaults for null input", () => {
    const result = systemsConfigSchema.parse(null);
    expect(result).toEqual(DEFAULT_CONFIG);
  });

  test("returns defaults for empty object", () => {
    const result = systemsConfigSchema.parse({});
    expect(result).toEqual(DEFAULT_CONFIG);
  });

  test("overrides enabled", () => {
    const result = systemsConfigSchema.parse({ enabled: false });
    expect(result.enabled).toBe(false);
    expect(result.maxSystems).toBe(DEFAULT_CONFIG.maxSystems);
  });

  test("overrides maxSystems", () => {
    const result = systemsConfigSchema.parse({ maxSystems: 10 });
    expect(result.maxSystems).toBe(10);
    expect(result.enabled).toBe(DEFAULT_CONFIG.enabled);
  });

  test("clamps maxSystems to floor", () => {
    const result = systemsConfigSchema.parse({ maxSystems: 5.7 });
    expect(result.maxSystems).toBe(5);
  });

  test("rejects maxSystems <= 0", () => {
    const result = systemsConfigSchema.parse({ maxSystems: 0 });
    expect(result.maxSystems).toBe(DEFAULT_CONFIG.maxSystems);
  });

  test("rejects maxSystems > 100", () => {
    const result = systemsConfigSchema.parse({ maxSystems: 200 });
    expect(result.maxSystems).toBe(DEFAULT_CONFIG.maxSystems);
  });

  test("throws on unknown keys", () => {
    expect(() => systemsConfigSchema.parse({ foo: "bar" })).toThrow("unknown keys: foo");
  });

  test("accepts both keys together", () => {
    const result = systemsConfigSchema.parse({ enabled: false, maxSystems: 5 });
    expect(result.enabled).toBe(false);
    expect(result.maxSystems).toBe(5);
  });
});
