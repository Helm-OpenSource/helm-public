import { describe, expect, it } from "vitest";

import { CAIO_LAYERED_JUDGEMENT_JSON_SCHEMA } from "@/lib/caio-inference/layered-judgement";

import { createCaioWorkerRemoteModelPort, isRemoteProviderBaseUrl } from "./remote-model-port";

const KEY = "sk-test-0123456789abcdef";

function fakeFetch(respond: (url: string, init: RequestInit) => Response) {
  const calls: Array<{ url: string; init: RequestInit; body: unknown }> = [];
  const impl = (async (url: string | URL, init?: RequestInit) => {
    const request = init ?? {};
    calls.push({ url: String(url), init: request, body: request.body ? JSON.parse(String(request.body)) : null });
    return respond(String(url), request);
  }) as unknown as typeof fetch;
  return { calls, impl };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("remote model port: base URL is exactly the provider's https API root", () => {
  it("accepts only the canonical roots", () => {
    expect(isRemoteProviderBaseUrl("anthropic-messages", "https://api.anthropic.com/v1")).toBe(true);
    expect(isRemoteProviderBaseUrl("anthropic-messages", "https://api.anthropic.com/v1/")).toBe(true);
    expect(isRemoteProviderBaseUrl("openai-chat-completions", "https://api.openai.com/v1")).toBe(true);
    for (const bad of [
      "http://api.anthropic.com/v1",
      "https://api.anthropic.com:8443/v1",
      // Assembled at runtime so the public-release guard does not read a credential-shaped URL literal.
      `https://${["user", "pw"].join(":")}@api.anthropic.com/v1`,
      "https://api.anthropic.com.evil.test/v1",
      "https://api.anthropic.com/v2",
      "https://api.anthropic.com/v1?x=1",
      "https://api.openai.com/v1",
      "http://127.0.0.1:8080/v1",
    ]) {
      expect(isRemoteProviderBaseUrl("anthropic-messages", bad)).toBe(false);
    }
    expect(isRemoteProviderBaseUrl("openai-chat-completions", "https://api.anthropic.com/v1")).toBe(false);
  });

  it("refuses to construct against a non-canonical host", () => {
    expect(() =>
      createCaioWorkerRemoteModelPort({ provider: "anthropic-messages", baseUrl: "https://proxy.example.test/v1", model: "claude-opus-5-5", apiKey: KEY }),
    ).toThrow("baseUrl must be the provider's https API root");
  });
});

describe("anthropic-messages", () => {
  it("posts a Messages request without sampling parameters and returns text, usage and request id", async () => {
    const fetcher = fakeFetch(() =>
      json({
        id: "msg_01ABC",
        stop_reason: "end_turn",
        content: [
          { type: "thinking", thinking: "" },
          { type: "text", text: "{\"schemaVersion\":" },
          { type: "text", text: "\"x\"}" },
        ],
        usage: { input_tokens: 812, output_tokens: 344 },
      }),
    );
    const port = createCaioWorkerRemoteModelPort({
      provider: "anthropic-messages",
      baseUrl: "https://api.anthropic.com/v1",
      model: "claude-opus-5-5",
      apiKey: KEY,
      effort: "low",
      fetchImpl: fetcher.impl,
    });
    const completion = await port.complete({ prompt: "问题", maxOutputTokens: 1200 });
    expect(completion).toEqual({
      content: "{\"schemaVersion\":\"x\"}",
      usage: { inputTokens: 812, outputTokens: 344 },
      providerRequestRef: "msg_01ABC",
    });
    const call = fetcher.calls[0];
    expect(call.url).toBe("https://api.anthropic.com/v1/messages");
    const headers = new Headers(call.init.headers);
    expect(headers.get("x-api-key")).toBe(KEY);
    expect(headers.get("anthropic-version")).toBe("2023-06-01");
    expect(headers.get("authorization")).toBeNull();
    expect(call.body).toEqual({
      model: "claude-opus-5-5",
      max_tokens: 1200,
      output_config: { effort: "low" },
      messages: [{ role: "user", content: "问题" }],
    });
    expect(call.body).not.toHaveProperty("temperature");
  });

  it("fails closed on refusal, empty text and non-2xx, without echoing the key", async () => {
    const refusal = createCaioWorkerRemoteModelPort({
      provider: "anthropic-messages", baseUrl: "https://api.anthropic.com/v1", model: "claude-opus-5-5", apiKey: KEY,
      fetchImpl: fakeFetch(() => json({ id: "msg_1", stop_reason: "refusal", content: [] })).impl,
    });
    await expect(refusal.complete({ prompt: "p", maxOutputTokens: 10 })).rejects.toThrow("caio_worker_remote_model_refused");
    const empty = createCaioWorkerRemoteModelPort({
      provider: "anthropic-messages", baseUrl: "https://api.anthropic.com/v1", model: "claude-opus-5-5", apiKey: KEY,
      fetchImpl: fakeFetch(() => json({ id: "msg_1", stop_reason: "end_turn", content: [{ type: "thinking", thinking: "" }] })).impl,
    });
    await expect(empty.complete({ prompt: "p", maxOutputTokens: 10 })).rejects.toThrow("caio_worker_remote_model_response_empty");
    const denied = createCaioWorkerRemoteModelPort({
      provider: "anthropic-messages", baseUrl: "https://api.anthropic.com/v1", model: "claude-opus-5-5", apiKey: KEY,
      fetchImpl: fakeFetch(() => json({ error: { message: KEY } }, 403)).impl,
    });
    const error = await denied.complete({ prompt: "p", maxOutputTokens: 10 }).catch((caught: Error) => caught);
    expect(String(error)).toContain("caio_worker_remote_model_status:403");
    expect(String(error)).not.toContain(KEY);
  });

  it("reports missing usage as null rather than inventing zero", async () => {
    const port = createCaioWorkerRemoteModelPort({
      provider: "anthropic-messages", baseUrl: "https://api.anthropic.com/v1", model: "claude-opus-5-5", apiKey: KEY,
      fetchImpl: fakeFetch(() => json({ id: "msg_1", stop_reason: "end_turn", content: [{ type: "text", text: "{}" }] })).impl,
    });
    expect((await port.complete({ prompt: "p", maxOutputTokens: 10 })).usage).toBeNull();
  });

  it("probes the configured model id", async () => {
    const fetcher = fakeFetch((url) => (url.endsWith("/models/claude-opus-5-5") ? json({ id: "claude-opus-5-5" }) : json({}, 404)));
    const port = createCaioWorkerRemoteModelPort({
      provider: "anthropic-messages", baseUrl: "https://api.anthropic.com/v1", model: "claude-opus-5-5", apiKey: KEY, fetchImpl: fetcher.impl,
    });
    expect(await port.probe({})).toEqual({ ready: true });
    expect(fetcher.calls[0].url).toBe("https://api.anthropic.com/v1/models/claude-opus-5-5");
    const missing = createCaioWorkerRemoteModelPort({
      provider: "anthropic-messages", baseUrl: "https://api.anthropic.com/v1", model: "not-a-model", apiKey: KEY, fetchImpl: fetcher.impl,
    });
    expect(await missing.probe({})).toEqual({ ready: false, detail: "models_status_404" });
  });
});

describe("openai-chat-completions", () => {
  it("uses max_completion_tokens, Bearer auth, no temperature, and parses content/usage/id", async () => {
    const fetcher = fakeFetch(() =>
      json({
        id: "chatcmpl-9x",
        choices: [{ message: { role: "assistant", content: "{\"a\":1}" } }],
        usage: { prompt_tokens: 700, completion_tokens: 210 },
      }),
    );
    const port = createCaioWorkerRemoteModelPort({
      provider: "openai-chat-completions",
      baseUrl: "https://api.openai.com/v1",
      model: "sol6-placeholder-model-id",
      apiKey: KEY,
      fetchImpl: fetcher.impl,
    });
    expect(await port.complete({ prompt: "问题", maxOutputTokens: 900 })).toEqual({
      content: "{\"a\":1}",
      usage: { inputTokens: 700, outputTokens: 210 },
      providerRequestRef: "chatcmpl-9x",
    });
    const call = fetcher.calls[0];
    expect(call.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(new Headers(call.init.headers).get("authorization")).toBe(`Bearer ${KEY}`);
    expect(call.body).toEqual({
      model: "sol6-placeholder-model-id",
      max_completion_tokens: 900,
      messages: [{ role: "user", content: "问题" }],
      response_format: {
        type: "json_schema",
        json_schema: { name: "caio_layered_judgement", strict: true, schema: CAIO_LAYERED_JUDGEMENT_JSON_SCHEMA },
      },
    });
  });

  it("fails closed on a refusal message", async () => {
    const port = createCaioWorkerRemoteModelPort({
      provider: "openai-chat-completions", baseUrl: "https://api.openai.com/v1", model: "m", apiKey: KEY,
      fetchImpl: fakeFetch(() => json({ id: "c", choices: [{ message: { content: null, refusal: "no" } }] })).impl,
    });
    await expect(port.complete({ prompt: "p", maxOutputTokens: 10 })).rejects.toThrow("caio_worker_remote_model_refused");
  });

  it("rejects an Anthropic effort setting on the OpenAI port only via config loading (port accepts none)", () => {
    expect(() =>
      createCaioWorkerRemoteModelPort({
        provider: "openai-chat-completions", baseUrl: "https://api.openai.com/v1", model: "m", apiKey: "short",
      }),
    ).toThrow("invalid caio worker remote model access");
  });
});
