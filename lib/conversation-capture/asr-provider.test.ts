import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/observability/llm-call-log.service", () => ({
  recordLLMCall: vi.fn().mockResolvedValue(undefined),
}));

import {
  getCaptureASRConfig,
  isCaptureASRConfigured,
  transcribeCaptureAudio,
} from "@/lib/conversation-capture/asr-provider";

const ENV_KEYS = [
  "ASR_ENABLED",
  "ASR_PROVIDER",
  "ASR_OPENAI_MODEL",
  "ASR_DASHSCOPE_MODEL",
  "ASR_DASHSCOPE_BASE_URL",
  "DASHSCOPE_API_KEY",
  "OPENAI_API_KEY",
] as const;

const savedEnv: Record<string, string | undefined> = {};

function makeAudioFile(bytes = 1024) {
  return new File([new Uint8Array(bytes)], "capture.webm", {
    type: "audio/webm",
  });
}

beforeEach(() => {
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  vi.restoreAllMocks();
});

describe("getCaptureASRConfig provider selection", () => {
  it("defaults to openai when ASR_PROVIDER is unset (unchanged behavior)", () => {
    const config = getCaptureASRConfig();
    expect(config.provider).toBe("openai");
    expect(config.model).toBe("gpt-4o-mini-transcribe");
  });

  it("selects dashscope with the qwen3-asr-flash default model", () => {
    process.env.ASR_PROVIDER = "dashscope";
    const config = getCaptureASRConfig();
    expect(config.provider).toBe("dashscope");
    expect(config.model).toBe("qwen3-asr-flash");
  });

  it("requires DASHSCOPE_API_KEY for the dashscope provider to be configured", () => {
    process.env.ASR_ENABLED = "true";
    process.env.ASR_PROVIDER = "dashscope";
    expect(isCaptureASRConfigured()).toBe(false);
    process.env.DASHSCOPE_API_KEY = "sk-test";
    expect(isCaptureASRConfigured()).toBe(true);
  });
});

describe("transcribeCaptureAudio via dashscope", () => {
  beforeEach(() => {
    process.env.ASR_ENABLED = "true";
    process.env.ASR_PROVIDER = "dashscope";
    process.env.DASHSCOPE_API_KEY = "sk-test";
  });

  it("posts inline base64 audio to the OpenAI-compatible chat endpoint and returns DASHSCOPE_ASR", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "买方确认下周复访。" } }],
          }),
          { status: 200 },
        ),
      );

    const result = await transcribeCaptureAudio({
      workspaceId: "ws-1",
      userId: "user-1",
      audioFile: makeAudioFile(),
    });

    expect(result.sourceType).toBe("DASHSCOPE_ASR");
    expect(result.provider).toBe("dashscope");
    expect(result.text).toBe("买方确认下周复访。");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    );
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("qwen3-asr-flash");
    expect(body.messages[0].content[0].type).toBe("input_audio");
    expect(body.messages[0].content[0].input_audio.data).toMatch(
      /^data:audio\/webm;base64,/,
    );
    expect(
      (init.headers as Record<string, string>).Authorization,
    ).toBe("Bearer sk-test");
  });

  it("respects ASR_DASHSCOPE_BASE_URL overrides", async () => {
    process.env.ASR_DASHSCOPE_BASE_URL =
      "https://example-workspace.cn-beijing.example/compatible-mode/v1/";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ choices: [{ message: { content: "ok" } }] }),
        { status: 200 },
      ),
    );

    await transcribeCaptureAudio({
      workspaceId: "ws-1",
      audioFile: makeAudioFile(),
    });

    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "https://example-workspace.cn-beijing.example/compatible-mode/v1/chat/completions",
    );
  });

  it("rejects audio above the inline base64 cap instead of degrading", async () => {
    await expect(
      transcribeCaptureAudio({
        workspaceId: "ws-1",
        audioFile: makeAudioFile(8 * 1024 * 1024),
      }),
    ).rejects.toThrow("7MB");
  });

  it("fails closed when dashscope returns no usable transcript", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: "" } }] }), {
        status: 200,
      }),
    );

    await expect(
      transcribeCaptureAudio({ workspaceId: "ws-1", audioFile: makeAudioFile() }),
    ).rejects.toThrow("未返回可用 transcript");
  });
});
