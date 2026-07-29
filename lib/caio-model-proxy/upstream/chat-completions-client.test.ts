import { describe, expect, it, vi } from "vitest";

import {
  CaioChatCompletionsUpstreamClient,
  createCaioChatCompletionsUpstreamPort,
} from "./chat-completions-client";

const BASE_URL = "https://upstream.example.internal/v1";
const API_KEY = "sk-upstream-secret-key";

function makeClient(fetchImpl: typeof fetch) {
  return new CaioChatCompletionsUpstreamClient({
    fetchImpl,
    endpointBaseUrl: BASE_URL,
    apiKeyProvider: async () => API_KEY,
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function sseResponse(
  chunks: string[],
  options: { errorAfter?: Error } = {},
): Response {
  const encoder = new TextEncoder();
  let nextChunk = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (nextChunk < chunks.length) {
        controller.enqueue(encoder.encode(chunks[nextChunk]));
        nextChunk += 1;
        return;
      }
      if (options.errorAfter) controller.error(options.errorAfter);
      else controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

describe("CaioChatCompletionsUpstreamClient.invoke", () => {
  it("posts the body verbatim to /chat/completions with a bearer key", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ id: "chatcmpl_1" }));
    const body = {
      model: "provider-a-large-1",
      messages: [{ role: "user", content: "hello" }],
      tools: [
        {
          type: "function",
          function: { name: "lookup", parameters: { type: "object" } },
        },
      ],
      tool_choice: "auto",
    };
    const result = await makeClient(
      fetchImpl as unknown as typeof fetch,
    ).invoke({ body });

    expect(result).toEqual({
      status: "ok",
      upstreamStatus: 200,
      body: { id: "chatcmpl_1" },
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(`${BASE_URL}/chat/completions`);
    expect(init.method).toBe("POST");
    expect(
      (init.headers as Record<string, string>).authorization,
    ).toBe(`Bearer ${API_KEY}`);
    // Tool/function-call fields pass through untouched.
    expect(JSON.parse(init.body as string)).toEqual(body);
  });

  it("fetches the api key per request via the provider", async () => {
    const apiKeyProvider = vi.fn(async () => API_KEY);
    const fetchImpl = vi.fn(async () => jsonResponse({}));
    const client = new CaioChatCompletionsUpstreamClient({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      endpointBaseUrl: BASE_URL,
      apiKeyProvider,
    });
    await client.invoke({ body: { messages: [] } });
    await client.invoke({ body: { messages: [] } });
    expect(apiKeyProvider).toHaveBeenCalledTimes(2);
  });

  const errorCases: Array<{
    upstreamStatus: number;
    code: string;
    gatewayStatus: number;
  }> = [
    { upstreamStatus: 401, code: "upstream_auth_failed", gatewayStatus: 502 },
    { upstreamStatus: 403, code: "upstream_auth_failed", gatewayStatus: 502 },
    {
      upstreamStatus: 404,
      code: "upstream_model_not_found",
      gatewayStatus: 502,
    },
    { upstreamStatus: 429, code: "upstream_rate_limited", gatewayStatus: 429 },
    { upstreamStatus: 500, code: "upstream_failed", gatewayStatus: 502 },
  ];

  for (const { upstreamStatus, code, gatewayStatus } of errorCases) {
    it(`maps upstream ${upstreamStatus} to ${code} (gateway ${gatewayStatus})`, async () => {
      const fetchImpl = vi.fn(async () =>
        new Response("secret upstream error detail", {
          status: upstreamStatus,
        }),
      );
      const result = await makeClient(
        fetchImpl as unknown as typeof fetch,
      ).invoke({ body: { messages: [] } });
      expect(result.status).toBe("upstream_error");
      if (result.status === "upstream_error") {
        expect(result.code).toBe(code);
        expect(result.gatewayStatus).toBe(gatewayStatus);
      }
      expect(JSON.stringify(result)).not.toContain(
        "secret upstream error detail",
      );
      expect(JSON.stringify(result)).not.toContain(API_KEY);
    });
  }

  it("carries upstream Retry-After through on 429", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response("slow down", {
        status: 429,
        headers: { "retry-after": "42" },
      }),
    );
    const result = await makeClient(
      fetchImpl as unknown as typeof fetch,
    ).invoke({ body: { messages: [] } });
    expect(result).toMatchObject({
      status: "upstream_error",
      code: "upstream_rate_limited",
      gatewayStatus: 429,
      retryAfterSeconds: 42,
    });
  });

  it("maps a network failure to upstream_unreachable", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ETIMEDOUT");
    });
    const result = await makeClient(
      fetchImpl as unknown as typeof fetch,
    ).invoke({ body: { messages: [] } });
    expect(result).toMatchObject({
      status: "upstream_error",
      code: "upstream_unreachable",
      gatewayStatus: 502,
    });
  });

  it("reports cancelled when the request is aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchImpl = vi.fn(async () => {
      throw Object.assign(new Error("aborted"), { name: "AbortError" });
    });
    const result = await makeClient(
      fetchImpl as unknown as typeof fetch,
    ).invoke({ body: { messages: [] }, signal: controller.signal });
    expect(result).toEqual({ status: "cancelled" });
  });
});

describe("CaioChatCompletionsUpstreamClient.invokeStreaming", () => {
  it("forwards SSE chunks verbatim and completes on [DONE]", async () => {
    const chunks = [
      'data: {"choices":[{"delta":{"content":"he"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"llo"}}]}\n\n',
      "data: [DONE]\n\n",
    ];
    const fetchImpl = vi.fn(async () => sseResponse(chunks));
    const forwarded: string[] = [];
    const result = await makeClient(
      fetchImpl as unknown as typeof fetch,
    ).invokeStreaming({
      body: { messages: [], stream: true },
      onChunk: (c) => forwarded.push(c),
    });
    expect(result).toEqual({ status: "ok", chunksForwarded: 3 });
    expect(forwarded).toEqual(chunks);
  });

  it("detects a [DONE] marker split across chunk boundaries", async () => {
    const fetchImpl = vi.fn(async () =>
      sseResponse(['data: {"x":1}\n\ndata: [D', "ONE]\n\n"]),
    );
    const result = await makeClient(
      fetchImpl as unknown as typeof fetch,
    ).invokeStreaming({
      body: { messages: [], stream: true },
      onChunk: () => {},
    });
    expect(result.status).toBe("ok");
  });

  it("emits a synthetic terminal marker when the stream ends without [DONE]", async () => {
    const fetchImpl = vi.fn(async () =>
      sseResponse(['data: {"choices":[{"delta":{"content":"partial"}}]}\n\n']),
    );
    const forwarded: string[] = [];
    const result = await makeClient(
      fetchImpl as unknown as typeof fetch,
    ).invokeStreaming({
      body: { messages: [], stream: true },
      onChunk: (c) => forwarded.push(c),
    });
    expect(result).toEqual({
      status: "incomplete_stream",
      reason: "missing_terminal_event",
      chunksForwarded: 1,
    });
    const marker = JSON.parse(
      forwarded[forwarded.length - 1].replace(/^data: /, "").trim(),
    );
    expect(marker).toEqual({
      caio_incomplete_stream: true,
      reason: "missing_terminal_event",
    });
  });

  it("does NOT treat the responses protocol terminal event as [DONE]", async () => {
    const fetchImpl = vi.fn(async () =>
      sseResponse([
        'data: {"x":1}\n\n',
        'event: response.completed\ndata: {"type":"response.completed"}\n\n',
      ]),
    );
    const result = await makeClient(
      fetchImpl as unknown as typeof fetch,
    ).invokeStreaming({
      body: { messages: [], stream: true },
      onChunk: () => {},
    });
    expect(result.status).toBe("incomplete_stream");
  });

  it("degrades to incomplete_stream on mid-stream failure and never retries", async () => {
    const fetchImpl = vi.fn(async () =>
      sseResponse(['data: {"x":1}\n\n'], {
        errorAfter: new Error("connection reset"),
      }),
    );
    const forwarded: string[] = [];
    const result = await makeClient(
      fetchImpl as unknown as typeof fetch,
    ).invokeStreaming({
      body: { messages: [], stream: true },
      onChunk: (c) => forwarded.push(c),
    });
    expect(result).toEqual({
      status: "incomplete_stream",
      reason: "upstream_stream_error",
      chunksForwarded: 1,
    });
    expect(forwarded[forwarded.length - 1]).toContain(
      '"caio_incomplete_stream":true',
    );
    // NO automatic retry once any streamed byte has been forwarded.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("returns a typed upstream_error when it fails before any streamed byte", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response("upstream exploded", { status: 503 }),
    );
    const result = await makeClient(
      fetchImpl as unknown as typeof fetch,
    ).invokeStreaming({
      body: { messages: [], stream: true },
      onChunk: () => {},
    });
    expect(result).toMatchObject({
      status: "upstream_error",
      code: "upstream_failed",
      gatewayStatus: 502,
      chunksForwarded: 0,
    });
  });

  it("reports cancelled with forwarded chunk count on mid-stream abort", async () => {
    const fetchImpl = vi.fn(async () =>
      sseResponse(['data: {"x":1}\n\n'], {
        errorAfter: Object.assign(new Error("aborted"), {
          name: "AbortError",
        }),
      }),
    );
    const result = await makeClient(
      fetchImpl as unknown as typeof fetch,
    ).invokeStreaming({
      body: { messages: [], stream: true },
      onChunk: () => {},
    });
    expect(result).toEqual({ status: "cancelled", chunksForwarded: 1 });
  });
});

describe("createCaioChatCompletionsUpstreamPort", () => {
  it("routes per-request endpoint and key without caching", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ id: "chatcmpl_2" }));
    const port = createCaioChatCompletionsUpstreamPort({
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const result = await port.invoke({
      endpointBaseUrl: "https://other.example.internal/v1",
      apiKey: "sk-other-key",
      body: { messages: [] },
    });
    expect(result.status).toBe("ok");
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://other.example.internal/v1/chat/completions");
    expect(
      (init.headers as Record<string, string>).authorization,
    ).toBe("Bearer sk-other-key");
  });
});
