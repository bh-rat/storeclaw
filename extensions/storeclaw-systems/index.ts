/**
 * StoreClaw Systems Plugin
 *
 * Discovers business systems from workspace/systems/ directories
 * and injects them as <active_systems> context, following the same
 * pattern as skill injection via <available_skills>.
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { systemsConfigSchema } from "./src/config.js";
import { discoverSystems } from "./src/discovery.js";
import { formatSystemsForPrompt } from "./src/format.js";

const systemsPlugin = {
  id: "storeclaw-systems",
  name: "StoreClaw Systems",
  description: "Business systems discovery and context injection",
  configSchema: systemsConfigSchema,

  register(api: OpenClawPluginApi) {
    const cfg = systemsConfigSchema.parse(api.pluginConfig);

    if (!cfg.enabled) {
      api.logger.info("storeclaw-systems: disabled by config");
      return;
    }

    // before_agent_start: discover systems and inject context
    api.on(
      "before_agent_start",
      (_event, ctx) => {
        const workspaceDir = ctx?.workspaceDir;

        if (!workspaceDir) {
          return;
        }

        const systems = discoverSystems(workspaceDir);

        if (systems.length === 0) {
          return;
        }

        const prependContext = formatSystemsForPrompt(systems, cfg.maxSystems);

        if (!prependContext) {
          return;
        }

        api.logger.info?.(`storeclaw-systems: injecting ${systems.length} system(s) into context`);

        return { prependContext };
      },
      { priority: 50 },
    );

    // agent_end: lightweight logging for debugging/analytics
    api.on("agent_end", () => {
      api.logger.info?.("storeclaw-systems: agent_end hook fired");
    });

    api.logger.info("storeclaw-systems: plugin registered");
  },
};

export default systemsPlugin;
