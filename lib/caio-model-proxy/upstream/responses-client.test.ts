import { describe, expect, it, vi } from "vitest";

import {
  CaioResponsesUpstreamClient,
  createCaioResponsesUpstreamPort,
} from "./responses-client";

const BASE_URL = "https://upstream.example.internal/v1";
const API_KEY = "sk-upstream-secret-key";

function makeClient(fetchImpl: typeof fetch) {
  return new CaioResponsesUpstreamClient({
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

describe("CaioResponsesUpstreamClient.invoke", () => {
  it("posts the body verbatim to /responses with a bearer key", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ id: "resp_1" }));
    const body = {
      model: "provider-a-large-1",
      input: "hello",
      tools: [{ type: "function", name: "lookup" }],
      tool_choice: "auto",
    };
    const result = await makeClient(fetchImpl as unknown as typeof fetch).invoke({
      body,
    });

    expect(result).toEqual({
      status: "ok",
      upstreamStatus: 200,
      body: { id: "resp_1" },
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(`${BASE_URL}/responses`);
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
    const client = new CaioResponsesUpstreamClient({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      endpointBaseUrl: BASE_URL,
      apiKeyProvider,
    });
    await client.invoke({ body: { input: "a" } });
    await client.invoke({ body: { input: "b" } });
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
    { upstreamStatus: 503, code: "upstream_failed", gatewayStatus: 502 },
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
      ).invoke({ body: { input: "x" } });
      expect(result.status).toBe("upstream_error");
      if (result.status === "upstream_error") {
        expect(result.code).toBe(code);
        expect(result.gatewayStatus).toBe(gatewayStatus);
      }
      // Upstream error bodies never leak into the gateway result.
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
        headers: { "retry-after": "17" },
      }),
    );
    const result = await makeClient(
      fetchImpl as unknown as typeof fetch,
    ).invoke({ body: { input: "x" } });
    expect(result).toMatchObject({
      status: "upstream_error",
      code: "upstream_rate_limited",
      gatewayStatus: 429,
      retryAfterSeconds: 17,
    });
  });

  it("maps a network failure to upstream_unreachable", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    const result = await makeClient(
      fetchImpl as unknown as typeof fetch,
    ).invoke({ body: { input: "x" } });
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
    ).invoke({ body: { input: "x" }, signal: controller.signal });
    expect(result).toEqual({ status: "cancelled" });
  });
});

describe("CaioResponsesUpstreamClient.invokeStreaming", () => {
  it("forwards SSE chunks verbatim and completes on response.completed", async () => {
    const chunks = [
      'event: response.output_text.delta\ndata: {"delta":"he"}\n\n',
      'event: response.output_text.delta\ndata: {"delta":"llo"}\n\n',
      'event: response.completed\ndata: {"type":"response.completed"}\n\n',
    ];
    const fetchImpl = vi.fn(async () => sseResponse(chunks));
    const forwarded: string[] = [];
    const result = await makeClient(
      fetchImpl as unknown as typeof fetch,
    ).invokeStreaming({
      body: { input: "x", stream: true },
      onChunk: (c) => forwarded.push(c),
    });
    expect(result).toEqual({ status: "ok", chunksForwarded: 3 });
    expect(forwarded).toEqual(chunks);
  });

  it("detects a terminal event split across chunk boundaries", async () => {
    const fetchImpl = vi.fn(async () =>
      sseResponse([
        'data: {"delta":"hi"}\n\nevent: response.co',
        'mpleted\ndata: {"type":"response.completed"}\n\n',
      ]),
    );
    const result = await makeClient(
      fetchImpl as unknown as typeof fetch,
    ).invokeStreaming({
      body: { input: "x", stream: true },
      onChunk: () => {},
    });
    expect(result.status).toBe("ok");
  });

  it("emits a synthetic terminal marker when the stream ends without response.completed", async () => {
    const fetchImpl = vi.fn(async () =>
      sseResponse(['data: {"delta":"partial"}\n\n']),
    );
    const forwarded: string[] = [];
    const result = await makeClient(
      fetchImpl as unknown as typeof fetch,
    ).invokeStreaming({
      body: { input: "x", stream: true },
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

  it("does NOT treat the chat-completions [DONE] marker as terminal", async () => {
    const fetchImpl = vi.fn(async () =>
      sseResponse(['data: {"delta":"x"}\n\n', "data: [DONE]\n\n"]),
    );
    const result = await makeClient(
      fetchImpl as unknown as typeof fetch,
    ).invokeStreaming({
      body: { input: "x", stream: true },
      onChunk: () => {},
    });
    expect(result.status).toBe("incomplete_stream");
  });

  it("degrades to incomplete_stream on mid-stream failure and never retries", async () => {
    const fetchImpl = vi.fn(async () =>
      sseResponse(['data: {"delta":"started"}\n\n'], {
        errorAfter: new Error("connection reset"),
      }),
    );
    const forwarded: string[] = [];
    const result = await makeClient(
      fetchImpl as unknown as typeof fetch,
    ).invokeStreaming({
      body: { input: "x", stream: true },
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

  // F3 regression: onChunk() ran BEFORE chunksForwarded += 1, so a downstream
  // writer that threw on the first chunk reported chunksForwarded: 0 with an
  // upstream_error status — which the engine treats as retryable even though
  // the bytes had already been handed downstream.
  it("F3: counts a chunk as forwarded before handing it to the writer, so a throwing writer is never retryable", async () => {
    const fetchImpl = vi.fn(async () =>
      sseResponse([
        'data: {"delta":"chunk-1"}\n\n',
        'event: response.completed\ndata: {"type":"response.completed"}\n\n',
      ]),
    );
    const forwarded: string[] = [];
    const result = await makeClient(
      fetchImpl as unknown as typeof fetch,
    ).invokeStreaming({
      body: { input: "x", stream: true },
      onChunk: (chunk) => {
        forwarded.push(chunk);
        throw new Error("downstream write failed");
      },
    });

    expect(result).toEqual({
      status: "incomplete_stream",
      reason: "downstream_write_failed",
      chunksForwarded: 1,
    });
    // Never reported as upstream_error, which is the only retryable status.
    expect(result.status).not.toBe("upstream_error");
    expect(forwarded).toHaveLength(1);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("F3: a writer that throws on a later chunk still reports the forwarded count", async () => {
    const fetchImpl = vi.fn(async () =>
      sseResponse([
        'data: {"delta":"a"}\n\n',
        'data: {"delta":"b"}\n\n',
        'event: response.completed\n\n',
      ]),
    );
    let seen = 0;
    const result = await makeClient(
      fetchImpl as unknown as typeof fetch,
    ).invokeStreaming({
      body: { input: "x", stream: true },
      onChunk: () => {
        seen += 1;
        if (seen === 2) throw new Error("downstream write failed");
      },
    });
    expect(result).toEqual({
      status: "incomplete_stream",
      reason: "downstream_write_failed",
      chunksForwarded: 2,
    });
  });

  it("F3: a writer that throws while emitting the synthetic marker does not escape as an exception", async () => {
    const fetchImpl = vi.fn(async () =>
      sseResponse(['data: {"delta":"partial"}\n\n']),
    );
    let seen = 0;
    const result = await makeClient(
      fetchImpl as unknown as typeof fetch,
    ).invokeStreaming({
      body: { input: "x", stream: true },
      onChunk: () => {
        seen += 1;
        // The upstream chunk lands; only the synthetic terminal marker fails.
        if (seen > 1) throw new Error("downstream write failed");
      },
    });
    expect(result).toEqual({
      status: "incomplete_stream",
      reason: "missing_terminal_event",
      chunksForwarded: 1,
    });
  });

  it("returns a typed upstream_error when it fails before any streamed byte", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response("upstream exploded", { status: 500 }),
    );
    const result = await makeClient(
      fetchImpl as unknown as typeof fetch,
    ).invokeStreaming({
      body: { input: "x", stream: true },
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
      sseResponse(['data: {"delta":"a"}\n\n'], {
        errorAfter: Object.assign(new Error("aborted"), {
          name: "AbortError",
        }),
      }),
    );
    const result = await makeClient(
      fetchImpl as unknown as typeof fetch,
    ).invokeStreaming({
      body: { input: "x", stream: true },
      onChunk: () => {},
    });
    expect(result).toEqual({ status: "cancelled", chunksForwarded: 1 });
  });
});

describe("createCaioResponsesUpstreamPort", () => {
  it("routes per-request endpoint and key without caching", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ id: "resp_2" }));
    const port = createCaioResponsesUpstreamPort({
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const result = await port.invoke({
      endpointBaseUrl: "https://other.example.internal/v1",
      apiKey: "sk-other-key",
      body: { input: "x" },
    });
    expect(result.status).toBe("ok");
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://other.example.internal/v1/responses");
    expect(
      (init.headers as Record<string, string>).authorization,
    ).toBe("Bearer sk-other-key");
  });
});
