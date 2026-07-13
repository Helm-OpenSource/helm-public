import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createOpenAICompatibleAdapter } from "@/lib/llm/openai-adapter";
import type { LLMProvider, LLMResolvedTask } from "@/lib/llm/types";

const configMocks = vi.hoisted(() => ({
  getApiKey: vi.fn(),
  getBaseUrl: vi.fn(),
  isConfigured: vi.fn(),
}));

vi.mock("@/lib/llm/config", () => ({
  getOpenAICompatibleApiKey: configMocks.getApiKey,
  getOpenAICompatibleBaseUrl: configMocks.getBaseUrl,
  isLLMProviderConfigured: configMocks.isConfigured,
}));

function createTask(
  provider: LLMProvider,
  outputMode: "json" | "text",
): LLMResolvedTask<{ ok: boolean }> {
  return {
    taskType: "JUDGEMENT_BOUNDARY_REVIEW",
    workspaceId: "workspace:test",
    userId: null,
    promptKey: "qwen-json-thinking-mode-test",
    promptVersion: "v1",
    systemPrompt: "Return the requested format.",
    userPrompt: "Review this synthetic input.",
    parseOutput: (rawText) => JSON.parse(rawText) as { ok: boolean },
    fallbackOutput: { ok: false },
    outputMode,
    jsonSchema:
      outputMode === "json"
        ? {
            type: "object",
            additionalProperties: false,
            required: ["ok"],
            properties: { ok: { type: "boolean" } },
          }
        : undefined,
    provider,
    model: provider === "qwen" ? "qwen3.7-max" : "gpt-4.1-mini",
    modelRole: "REASONING",
    maxOutputTokens: 1200,
  };
}

function createAdapter(provider: LLMProvider) {
  return createOpenAICompatibleAdapter({
    provider,
    label: `${provider}-test`,
    audioTranscription: false,
  });
}

function requestBody() {
  const fetchMock = vi.mocked(global.fetch);
  const init = fetchMock.mock.calls[0]?.[1];
  expect(typeof init?.body).toBe("string");
  return JSON.parse(init?.body as string) as Record<string, unknown>;
}

describe("OpenAI-compatible adapter provider options", () => {
  beforeEach(() => {
    configMocks.getApiKey.mockReturnValue("test-api-key");
    configMocks.getBaseUrl.mockReturnValue("https://provider.invalid/v1");
    configMocks.isConfigured.mockReturnValue(true);
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () =>
        new Response(
          JSON.stringify({
            choices: [{ finish_reason: "stop", message: { content: '{"ok":true}' } }],
            usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("disables Qwen thinking for structured JSON output", async () => {
    await createAdapter("qwen").run(createTask("qwen", "json"));

    expect(requestBody()).toMatchObject({
      model: "qwen3.7-max",
      enable_thinking: false,
      response_format: { type: "json_schema" },
    });
  });

  it("does not add the Qwen-specific option to text or OpenAI requests", async () => {
    await createAdapter("qwen").run(createTask("qwen", "text"));
    expect(requestBody()).not.toHaveProperty("enable_thinking");

    vi.mocked(global.fetch).mockClear();
    await createAdapter("openai").run(createTask("openai", "json"));
    expect(requestBody()).not.toHaveProperty("enable_thinking");
  });
});
