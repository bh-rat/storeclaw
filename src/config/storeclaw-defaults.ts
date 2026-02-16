import type { OpenClawConfig } from "./types.js";

/**
 * Non-WhatsApp channel plugins to deny by default in the Storeclaw fork.
 * Matches paths listed in the upstream-prune manifest.
 */
const STORECLAW_DENIED_PLUGINS: readonly string[] = [
  "bluebubbles",
  "discord",
  "feishu",
  "google-antigravity-auth",
  "googlechat",
  "imessage",
  "irc",
  "line",
  "matrix",
  "mattermost",
  "msteams",
  "nextcloud-talk",
  "nostr",
  "signal",
  "slack",
  "telegram",
  "thread-ownership",
  "tlon",
  "twitch",
  "voice-call",
  "zalo",
  "zalouser",
];

/**
 * Bundled skills to keep active in the Storeclaw fork.
 * Everything not listed here is implicitly disabled when the default applies.
 */
const STORECLAW_ALLOWED_SKILLS: readonly string[] = [
  "blogwatcher",
  "canvas",
  "clawhub",
  "coding-agent",
  "gemini",
  "gifgrep",
  "gog",
  "goplaces",
  "healthcheck",
  "himalaya",
  "mcporter",
  "model-usage",
  "nano-banana-pro",
  "nano-pdf",
  "openai-image-gen",
  "openai-whisper",
  "openai-whisper-api",
  "oracle",
  "peekaboo",
  "sag",
  "session-logs",
  "sherpa-onnx-tts",
  "skill-creator",
  "songsee",
  "summarize",
  "tmux",
  "trello",
  "video-frames",
  "voice-call",
  "wacli",
  "weather",
];

/**
 * Apply Storeclaw fork defaults to a config object.
 *
 * This is inserted as the **lowest-precedence** step in the defaults chain so
 * that every other default function and the user's own config file can override
 * anything set here.
 *
 * Only touches a field when the user has not set it at all (`undefined`).
 */
export function applyStoreclawDefaults(cfg: OpenClawConfig): OpenClawConfig {
  let mutated = false;
  let nextPlugins = cfg.plugins;
  let nextSkills = cfg.skills;

  if (cfg.plugins?.deny === undefined) {
    nextPlugins = {
      ...cfg.plugins,
      deny: [...STORECLAW_DENIED_PLUGINS],
    };
    mutated = true;
  }

  if (cfg.skills?.allowBundled === undefined) {
    nextSkills = {
      ...cfg.skills,
      allowBundled: [...STORECLAW_ALLOWED_SKILLS],
    };
    mutated = true;
  }

  if (!mutated) {
    return cfg;
  }

  return {
    ...cfg,
    plugins: nextPlugins,
    skills: nextSkills,
  };
}
