import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createOpenAICompatibleAdapter } from "@/lib/llm/openai-adapter";
import type { LLMResolvedTask } from "@/lib/llm/types";

vi.mock("@/lib/llm/config", () => ({
  getOpenAICompatibleApiKey: () => "synthetic-test-key",
  getOpenAICompatibleBaseUrl: () => "https://provider.invalid/v1",
  isLLMProviderConfigured: () => true,
  isLLMEnabledByEnv: () => true,
}));

vi.mock("@/lib/runtime/deployment-capabilities", () => ({
  assertDeploymentCapabilityEnabled: () => {},
  isDeploymentCapabilityEnabled: () => true,
}));

const task: LLMResolvedTask<{ ok: boolean }> = {
  taskType: "CONTACT_BRIEFING",
  workspaceId: "workspace:deadline-test",
  promptKey: "deadline-test",
  promptVersion: "v1",
  systemPrompt: "Return JSON.",
  userPrompt: "Synthetic input.",
  parseOutput: (text) => JSON.parse(text) as { ok: boolean },
  fallbackOutput: { ok: false },
  outputMode: "json",
  provider: "openai",
  model: "test-model",
  modelRole: "BRIEFING",
};

function run() {
  return createOpenAICompatibleAdapter({
    provider: "openai",
    label: "deadline-test",
    audioTranscription: false,
  }).run(task);
}

describe("OpenAI-compatible response deadline", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv("LLM_HTTP_TIMEOUT_MS", "25");
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([200, 503])("aborts a stalled %i response body after headers", async (status) => {
    let signal: AbortSignal | null | undefined;
    vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init?: RequestInit) => {
      signal = init?.signal;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          signal?.addEventListener("abort", () => {
            controller.error(new DOMException("Synthetic deadline", "AbortError"));
          }, { once: true });
        },
      });
      return new Response(body, { status });
    }));

    // Attach the rejection handler before advancing time to avoid an unhandled rejection.
    const outcome = run().then(() => null, (error: unknown) => error);
    await vi.advanceTimersByTimeAsync(25);

    expect(await outcome).toBeInstanceOf(Error);
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("retains the deadline before headers arrive", async () => {
    vi.stubGlobal("fetch", vi.fn((_url: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Synthetic deadline", "AbortError"));
        }, { once: true });
      }),
    ));
    const outcome = run().then(() => null, (error: unknown) => error);
    await vi.advanceTimersByTimeAsync(25);
    expect(await outcome).toBeInstanceOf(Error);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears the timer after a successful complete response", async () => {
    let signal: AbortSignal | null | undefined;
    vi.stubGlobal("fetch", vi.fn(async (_url: unknown, init?: RequestInit) => {
      signal = init?.signal;
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] }));
    }));
    expect((await run()).output).toEqual({ ok: true });
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(30);
    expect(signal?.aborted).toBe(false);
  });

  it("clears the timer after a malformed response body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("not-json")));
    await expect(run()).rejects.toThrow("response parse failed");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears the timer after an immediate transport failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("Synthetic transport failure"); }));
    await expect(run()).rejects.toThrow("fetch failed");
    expect(vi.getTimerCount()).toBe(0);
  });
});
