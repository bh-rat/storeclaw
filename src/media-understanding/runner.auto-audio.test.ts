import { describe, expect, it } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { buildProviderRegistry, runCapability } from "./runner.js";
import { withAudioFixture } from "./runner.test-utils.js";

function createOpenAiAudioProvider(
  transcribeAudio: (req: { model?: string }) => Promise<{ text: string; model: string }>,
) {
  return buildProviderRegistry({
    openai: {
      id: "openai",
      capabilities: ["audio"],
      transcribeAudio,
    },
  });
}

function createOpenAiAudioCfg(extra?: Partial<OpenClawConfig>): OpenClawConfig {
  return {
    models: {
      providers: {
        openai: {
          apiKey: "test-key",
          models: [],
        },
      },
    },
    ...extra,
  } as unknown as OpenClawConfig;
}

async function runAutoAudioCase(params: {
  transcribeAudio: (req: { model?: string }) => Promise<{ text: string; model: string }>;
  cfgExtra?: Partial<OpenClawConfig>;
}) {
  let runResult: Awaited<ReturnType<typeof runCapability>> | undefined;
  await withAudioFixture("openclaw-auto-audio", async ({ ctx, media, cache }) => {
    const providerRegistry = createOpenAiAudioProvider(params.transcribeAudio);
    const cfg = createOpenAiAudioCfg(params.cfgExtra);
    runResult = await runCapability({
      capability: "audio",
      cfg,
      ctx,
      attachments: cache,
      media,
      providerRegistry,
    });
  });
  if (!runResult) {
    throw new Error("Expected auto audio case result");
  }
  return runResult;
}

async function withAudioFixture(
  run: (params: {
    ctx: MsgContext;
    media: ReturnType<typeof normalizeMediaAttachments>;
    cache: ReturnType<typeof createMediaAttachmentCache>;
  }) => Promise<void>,
) {
  const originalPath = process.env.PATH;
  process.env.PATH = "";
  const tmpPath = path.join(os.tmpdir(), `openclaw-auto-audio-${Date.now()}.wav`);
  await fs.writeFile(tmpPath, Buffer.from("RIFF"));
  const ctx: MsgContext = { MediaPath: tmpPath, MediaType: "audio/wav" };
  const media = normalizeMediaAttachments(ctx);
  const cache = createMediaAttachmentCache(media, {
    localPathRoots: [path.dirname(tmpPath)],
  });

  try {
    await run({ ctx, media, cache });
  } finally {
    process.env.PATH = originalPath;
    await cache.cleanup();
    await fs.unlink(tmpPath).catch(() => {});
  }
}

function createOpenAiAudioProvider(
  transcribeAudio: (req: { model?: string }) => Promise<{ text: string; model: string }>,
) {
  return buildProviderRegistry({
    openai: {
      id: "openai",
      capabilities: ["audio"],
      transcribeAudio,
    },
  });
}

function createOpenAiAudioCfg(extra?: Partial<OpenClawConfig>): OpenClawConfig {
  return {
    models: {
      providers: {
        openai: {
          apiKey: "test-key",
          models: [],
        },
      },
    },
    ...extra,
  } as unknown as OpenClawConfig;
}

describe("runCapability auto audio entries", () => {
  it("uses provider keys to auto-enable audio transcription", async () => {
    let seenModel: string | undefined;
    const result = await runAutoAudioCase({
      transcribeAudio: async (req) => {
        seenModel = req.model;
        return { text: "ok", model: req.model ?? "unknown" };
      },
    });
    expect(result.outputs[0]?.text).toBe("ok");
    expect(seenModel).toBe("gpt-4o-mini-transcribe");
    expect(result.decision.outcome).toBe("success");
  });

  it("skips auto audio when disabled", async () => {
    const result = await runAutoAudioCase({
      transcribeAudio: async () => ({
        text: "ok",
        model: "whisper-1",
      }),
      cfgExtra: {
        tools: {
          media: {
            audio: {
              enabled: false,
            },
          },
        },
      },
    });
    expect(result.outputs).toHaveLength(0);
    expect(result.decision.outcome).toBe("disabled");
  });

  it("prefers explicitly configured audio model entries", async () => {
    let seenModel: string | undefined;
    const result = await runAutoAudioCase({
      transcribeAudio: async (req) => {
        seenModel = req.model;
        return { text: "ok", model: req.model ?? "unknown" };
      },
      cfgExtra: {
        tools: {
          media: {
            audio: {
              models: [{ provider: "openai", model: "whisper-1" }],
            },
          },
        },
      },
    });

    expect(result.outputs[0]?.text).toBe("ok");
    expect(seenModel).toBe("whisper-1");
  });
});
