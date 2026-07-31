import { describe, expect, it, vi } from "vitest";

import {
  CaioChatCompletionsUpstreamClient,
  createCaioChatCompletionsUpstreamPort,
} from "./chat-completions-client";

const BASE_URL = "https://upstream.example.internal/v1";
const API_KEY = "sk-upstream-secret-key";
/** Where a redirect would take the request if the client followed one. */
const PLAINTEXT_HOP =
  "http://upstream.example.internal/v1/chat/completions";

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

  it("refuses a redirect instead of following it down to plaintext", async () => {
    // Models real fetch: under redirect:"error" a 3xx becomes a TypeError and
    // there is no second hop; under any other setting the redirect is followed
    // transparently, which is exactly how an https route downgrades to http.
    const dialled: string[] = [];
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      dialled.push(url);
      if (init.redirect === "error") {
        throw new TypeError("unexpected redirect");
      }
      dialled.push(PLAINTEXT_HOP);
      return jsonResponse({ id: "chat_from_plaintext_hop" });
    });

    const result = await makeClient(
      fetchImpl as unknown as typeof fetch,
    ).invoke({ body: { messages: [] } });

    expect(result).toMatchObject({
      status: "upstream_error",
      code: "upstream_unreachable",
      gatewayStatus: 502,
    });
    expect(dialled).toEqual([`${BASE_URL}/chat/completions`]);
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
