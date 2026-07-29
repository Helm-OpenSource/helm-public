// CAIO model proxy — upstream client for the native OpenAI Responses API.
//
// Serves Codex-class clients. This client is intentionally independent of the
// Chat Completions client: it knows only the /responses wire format and never
// translates payloads to or from any other protocol. Bodies pass through
// verbatim (the proxy engine swaps the alias for the upstream model before
// invoking); tool/function-call fields are untouched.
//
// Security posture: the API key is fetched per request via apiKeyProvider,
// used for exactly one call, and never cached or logged. Upstream error
// bodies are never propagated into gateway errors.

import {
  isAbortError,
  mapUpstreamHttpError,
  type CaioProxyUpstreamClientPort,
  type CaioUpstreamInvokeResult,
  type CaioUpstreamStreamResult,
} from "./upstream-contracts";

// Terminal SSE marker for the Responses streaming protocol.
const RESPONSES_TERMINAL_EVENT = "response.completed";
// Keep enough tail across chunk boundaries to detect a split terminal token.
const SCAN_TAIL_CHARS = 256;

export type CaioResponsesUpstreamClientOptions = {
  fetchImpl: typeof fetch;
  endpointBaseUrl: string;
  apiKeyProvider: () => Promise<string>;
};

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/u, "")}${path}`;
}

function containsResponsesTerminal(text: string): boolean {
  return (
    text.includes(`event: ${RESPONSES_TERMINAL_EVENT}`) ||
    text.includes(`"type":"${RESPONSES_TERMINAL_EVENT}"`) ||
    text.includes(`"type": "${RESPONSES_TERMINAL_EVENT}"`)
  );
}

function syntheticIncompleteChunk(reason: string): string {
  return `data: ${JSON.stringify({ caio_incomplete_stream: true, reason })}\n\n`;
}

export class CaioResponsesUpstreamClient {
  private readonly fetchImpl: typeof fetch;
  private readonly endpointBaseUrl: string;
  private readonly apiKeyProvider: () => Promise<string>;

  constructor(options: CaioResponsesUpstreamClientOptions) {
    this.fetchImpl = options.fetchImpl;
    this.endpointBaseUrl = options.endpointBaseUrl;
    this.apiKeyProvider = options.apiKeyProvider;
  }

  private async post(input: {
    body: Record<string, unknown>;
    signal?: AbortSignal;
    streaming: boolean;
  }): Promise<Response> {
    // Key is scoped to this call only; never stored on the instance.
    const apiKey = await this.apiKeyProvider();
    return this.fetchImpl(joinUrl(this.endpointBaseUrl, "/responses"), {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        ...(input.streaming ? { accept: "text/event-stream" } : {}),
      },
      body: JSON.stringify(input.body),
      ...(input.signal ? { signal: input.signal } : {}),
    });
  }

  async invoke(input: {
    body: Record<string, unknown>;
    signal?: AbortSignal;
  }): Promise<CaioUpstreamInvokeResult> {
    let response: Response;
    try {
      response = await this.post({
        body: input.body,
        ...(input.signal ? { signal: input.signal } : {}),
        streaming: false,
      });
    } catch (error) {
      if (isAbortError(error, input.signal)) {
        return { status: "cancelled" };
      }
      return {
        status: "upstream_error",
        code: "upstream_unreachable",
        gatewayStatus: 502,
        upstreamStatus: null,
        retryAfterSeconds: null,
      };
    }
    if (!response.ok) {
      return {
        status: "upstream_error",
        ...mapUpstreamHttpError({
          upstreamStatus: response.status,
          retryAfterHeader: response.headers.get("retry-after"),
        }),
      };
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      if (isAbortError(error, input.signal)) {
        return { status: "cancelled" };
      }
      return {
        status: "upstream_error",
        code: "upstream_failed",
        gatewayStatus: 502,
        upstreamStatus: response.status,
        retryAfterSeconds: null,
      };
    }
    return { status: "ok", upstreamStatus: response.status, body };
  }

  // SSE pass-through. Chunks are forwarded verbatim as they arrive. Once ANY
  // chunk has been forwarded there is no retry path here or in the engine —
  // failures after first byte degrade to an explicit incomplete_stream with a
  // synthetic terminal marker so the downstream client can tell the stream
  // did not finish cleanly.
  async invokeStreaming(input: {
    body: Record<string, unknown>;
    signal?: AbortSignal;
    onChunk: (chunk: string) => void;
  }): Promise<CaioUpstreamStreamResult> {
    let response: Response;
    try {
      response = await this.post({
        body: input.body,
        ...(input.signal ? { signal: input.signal } : {}),
        streaming: true,
      });
    } catch (error) {
      if (isAbortError(error, input.signal)) {
        return { status: "cancelled", chunksForwarded: 0 };
      }
      return {
        status: "upstream_error",
        code: "upstream_unreachable",
        gatewayStatus: 502,
        upstreamStatus: null,
        retryAfterSeconds: null,
        chunksForwarded: 0,
      };
    }
    if (!response.ok) {
      return {
        status: "upstream_error",
        ...mapUpstreamHttpError({
          upstreamStatus: response.status,
          retryAfterHeader: response.headers.get("retry-after"),
        }),
        chunksForwarded: 0,
      };
    }
    if (!response.body) {
      const reason = "missing_body";
      input.onChunk(syntheticIncompleteChunk(reason));
      return { status: "incomplete_stream", reason, chunksForwarded: 0 };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let chunksForwarded = 0;
    let scanTail = "";
    let terminalSeen = false;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        if (text.length === 0) continue;
        input.onChunk(text);
        chunksForwarded += 1;
        const window = scanTail + text;
        if (containsResponsesTerminal(window)) terminalSeen = true;
        scanTail = window.slice(-SCAN_TAIL_CHARS);
      }
    } catch (error) {
      if (isAbortError(error, input.signal)) {
        return { status: "cancelled", chunksForwarded };
      }
      if (chunksForwarded === 0) {
        return {
          status: "upstream_error",
          code: "upstream_unreachable",
          gatewayStatus: 502,
          upstreamStatus: response.status,
          retryAfterSeconds: null,
          chunksForwarded: 0,
        };
      }
      const reason = "upstream_stream_error";
      input.onChunk(syntheticIncompleteChunk(reason));
      return { status: "incomplete_stream", reason, chunksForwarded };
    } finally {
      reader.releaseLock();
    }

    if (!terminalSeen) {
      const reason = "missing_terminal_event";
      input.onChunk(syntheticIncompleteChunk(reason));
      return { status: "incomplete_stream", reason, chunksForwarded };
    }
    return { status: "ok", chunksForwarded };
  }
}

// Per-request port used by the proxy engine: endpoint + key arrive with each
// invocation (the engine resolves them from the alias binding + credential
// loader), so one port instance serves every Responses-protocol binding. The
// key lives only inside the single call's closure.
export function createCaioResponsesUpstreamPort(deps: {
  fetchImpl: typeof fetch;
}): CaioProxyUpstreamClientPort {
  return {
    invoke: ({ endpointBaseUrl, apiKey, body, signal }) =>
      new CaioResponsesUpstreamClient({
        fetchImpl: deps.fetchImpl,
        endpointBaseUrl,
        apiKeyProvider: async () => apiKey,
      }).invoke({ body, ...(signal ? { signal } : {}) }),
    invokeStreaming: ({ endpointBaseUrl, apiKey, body, signal, onChunk }) =>
      new CaioResponsesUpstreamClient({
        fetchImpl: deps.fetchImpl,
        endpointBaseUrl,
        apiKeyProvider: async () => apiKey,
      }).invokeStreaming({ body, onChunk, ...(signal ? { signal } : {}) }),
  };
}
