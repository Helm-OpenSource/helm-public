import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getDefaultLocalGemmaModel,
  getLLMModelCatalog,
  probeOpenAICompatibleModels,
  resolveWorkspaceLLMModelsWithProbe,
} from "@/lib/llm/model-catalog";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("llm model catalog", () => {
  it("returns vendor groups including local gemma", () => {
    const catalog = getLLMModelCatalog();
    const vendors = catalog.map((group) => group.vendor);

    expect(vendors).toEqual(["local", "openai", "qwen", "deepseek", "anthropic"]);
    expect(catalog[0]?.models.some((model) => model.id === getDefaultLocalGemmaModel())).toBe(true);
  });

  it("checks healthz endpoint and does not require /models", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);

    const probe = await probeOpenAICompatibleModels({
      apiKey: "",
      baseUrl: "http://127.0.0.1:8000/v1",
    });

    expect(probe.hasCredential).toBe(false);
    expect(probe.reachable).toBe(true);
    expect(probe.probeMode).toBe("healthz");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/healthz",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("probes qwen provider via chat completions options instead of healthz", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 405 });
    vi.stubGlobal("fetch", fetchMock);

    const probe = await probeOpenAICompatibleModels({
      provider: "qwen",
      apiKey: "test_key",
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    });

    expect(probe.reachable).toBe(true);
    expect(probe.probeMode).toBe("chat_completions_options");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
      expect.objectContaining({ method: "OPTIONS" }),
    );
  });

  it("returns probe failure when health check is unreachable", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("fetch failed"));
    vi.stubGlobal("fetch", fetchMock);

    const probe = await probeOpenAICompatibleModels({
      apiKey: "test_key",
      baseUrl: "http://127.0.0.1:8000/v1",
    });

    expect(probe.hasCredential).toBe(true);
    expect(probe.reachable).toBe(false);
    expect(probe.errorMessage).toContain("fetch failed");
  });

  it("applies selected models directly when endpoint is reachable", () => {
    const result = resolveWorkspaceLLMModelsWithProbe({
      current: {
        defaultModel: "google/gemma-4-31B-it",
        extractionModel: "google/gemma-4-31B-it",
        briefingModel: "google/gemma-4-31B-it",
        reasoningModel: "google/gemma-4-31B-it",
      },
      proposed: {
        defaultModel: "deepseek-chat",
        extractionModel: "not-exists",
        briefingModel: "deepseek-chat",
        reasoningModel: "also-missing",
      },
      probe: {
        baseUrl: "http://127.0.0.1:8000/v1",
        hasCredential: true,
        reachable: true,
        availableModelIds: [],
        errorMessage: null,
        checkedAt: new Date().toISOString(),
        probeMode: "healthz",
      },
      english: true,
    });

    expect(result.next).toEqual({
      defaultModel: "deepseek-chat",
      extractionModel: "not-exists",
      briefingModel: "deepseek-chat",
      reasoningModel: "also-missing",
    });
    expect(result.warnings).toEqual([]);
  });

  it("still saves selected models when endpoint health check fails", () => {
    const result = resolveWorkspaceLLMModelsWithProbe({
      current: {
        defaultModel: "google/gemma-4-31B-it",
        extractionModel: "google/gemma-4-31B-it",
        briefingModel: "google/gemma-4-31B-it",
        reasoningModel: "google/gemma-4-31B-it",
      },
      proposed: {
        defaultModel: "gpt-4.1-mini",
        extractionModel: "gpt-4.1-mini",
        briefingModel: "gpt-4.1-mini",
        reasoningModel: "gpt-4.1-mini",
      },
      probe: {
        baseUrl: "http://127.0.0.1:8000/v1",
        hasCredential: true,
        reachable: false,
        availableModelIds: [],
        errorMessage: "fetch failed",
        checkedAt: new Date().toISOString(),
        probeMode: "healthz",
      },
      english: true,
    });

    expect(result.next).toEqual({
      defaultModel: "gpt-4.1-mini",
      extractionModel: "gpt-4.1-mini",
      briefingModel: "gpt-4.1-mini",
      reasoningModel: "gpt-4.1-mini",
    });
    expect(result.warnings).toHaveLength(1);
  });
});
