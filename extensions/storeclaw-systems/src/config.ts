import type { SystemsConfig } from "./types.js";

const ALLOWED_KEYS = ["enabled", "maxSystems"];

function assertAllowedKeys(value: Record<string, unknown>, allowed: string[], label: string) {
  const unknown = Object.keys(value).filter((key) => !allowed.includes(key));
  if (unknown.length > 0) {
    throw new Error(`${label} has unknown keys: ${unknown.join(", ")}`);
  }
}

export const DEFAULT_CONFIG: SystemsConfig = {
  enabled: true,
  maxSystems: 20,
};

export const systemsConfigSchema = {
  parse(value: unknown): SystemsConfig {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { ...DEFAULT_CONFIG };
    }
    const cfg = value as Record<string, unknown>;
    assertAllowedKeys(cfg, ALLOWED_KEYS, "storeclaw-systems config");

    const enabled = typeof cfg.enabled === "boolean" ? cfg.enabled : DEFAULT_CONFIG.enabled;
    const maxSystems =
      typeof cfg.maxSystems === "number" && cfg.maxSystems > 0 && cfg.maxSystems <= 100
        ? Math.floor(cfg.maxSystems)
        : DEFAULT_CONFIG.maxSystems;

    return { enabled, maxSystems };
  },
};
