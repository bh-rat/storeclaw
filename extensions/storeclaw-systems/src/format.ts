import type { SystemEntry } from "./types.js";

export function formatSystemsForPrompt(systems: SystemEntry[], maxSystems: number): string {
  if (systems.length === 0) return "";

  const limited = systems.slice(0, maxSystems);

  const systemBlocks = limited
    .map((sys) => {
      const caps = sys.capabilities.length > 0 ? sys.capabilities.join(", ") : "model";
      return [
        "<system>",
        `  <name>${sys.name}</name>`,
        `  <description>${sys.manifest.description}</description>`,
        `  <location>${sys.systemMdPath}</location>`,
        `  <capabilities>${caps}</capabilities>`,
        "</system>",
      ].join("\n");
    })
    .join("\n");

  return [
    "<active_systems>",
    "Before replying: scan <active_systems> descriptions.",
    "If a system clearly applies to this conversation, read its SYSTEM.md at <location> and follow it.",
    "",
    systemBlocks,
    "</active_systems>",
  ].join("\n");
}
