import type { ModelStatus, SystemEntry } from "./types.js";

export type SystemModelInfo = {
  name: string;
  status?: ModelStatus;
};

export function formatSystemsForPrompt(
  systems: SystemEntry[],
  maxSystems: number,
  modelInfos?: SystemModelInfo[],
): string {
  if (systems.length === 0) return "";

  const limited = systems.slice(0, maxSystems);
  const infoMap = new Map((modelInfos ?? []).map((m) => [m.name, m]));

  const systemBlocks = limited
    .map((sys) => {
      const caps = sys.capabilities.length > 0 ? sys.capabilities.join(", ") : "model";
      const lines = [
        "<system>",
        `  <name>${sys.name}</name>`,
        `  <description>${sys.manifest.description}</description>`,
        `  <location>${sys.systemMdPath}</location>`,
        `  <capabilities>${caps}</capabilities>`,
      ];

      // Model status
      const info = infoMap.get(sys.name);
      if (info?.status) {
        const s = info.status;
        const actionable = s.pending + s.needs_reprocess;
        lines.push(
          `  <model_status refs="${s.total_refs}" pending="${s.pending}" processed="${s.processed}" failed="${s.failed}" needs_reprocess="${s.needs_reprocess}" />`,
        );
        if (actionable > 0) {
          lines.push(
            `  <model_attention>${actionable} source ref(s) need processing — use system_model tool to review and process.</model_attention>`,
          );
        }
      }

      // Controller hints
      if (sys.manifest.controller?.workflows && sys.manifest.controller.workflows.length > 0) {
        const wfPaths = sys.manifest.controller.workflows.map((w) => `${sys.dir}/${w}`).join(", ");
        lines.push(
          `  <controller_hint>Run workflows with: lobster run ${wfPaths}</controller_hint>`,
        );
      }

      if (sys.manifest.controller?.schemas && sys.manifest.controller.schemas.length > 0) {
        const schemaPaths = sys.manifest.controller.schemas
          .map((s) => `${sys.dir}/${s}`)
          .join(", ");
        lines.push(
          `  <extraction_hint>Extract structured data with: llm-task with schema from ${schemaPaths}</extraction_hint>`,
        );
      }

      if (sys.manifest.views && sys.manifest.views.length > 0) {
        const viewPaths = sys.manifest.views.map((v) => `${sys.dir}/${v}`).join(", ");
        lines.push(
          `  <view_hint>Read view template(s) at ${viewPaths} and format responses following the template.</view_hint>`,
        );
      }

      lines.push("</system>");
      return lines.join("\n");
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
