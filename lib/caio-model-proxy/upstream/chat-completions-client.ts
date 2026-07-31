// CAIO model proxy — upstream client for the OpenAI Chat Completions API.
//
// Serves WorkBuddy-class clients. This client is intentionally independent of
// the Responses client: it knows only the /chat/completions wire format and
// never translates payloads to or from any other protocol. Bodies pass
// through verbatim (the proxy engine swaps the alias for the upstream model
// before invoking); tool/function-call fields are untouched.
//
// NOT STREAMING. The gateway serves one buffered JSON body per request, so
// this client has one call shape and no SSE path. The gateway refuses
// `stream: true` with 400 rather than answering it as buffered JSON.
//
// Security posture: the API key is fetched per request via apiKeyProvider,
// used for exactly one call, and never cached or logged. Upstream error
// bodies are never propagated into gateway errors. Redirects are REFUSED
// (redirect: "error"), so a 3xx can never move the request — with its
// credential and its projected prompt — to another host or down to plaintext.

import {
  isAbortError,
  mapUpstreamHttpError,
  type CaioProxyUpstreamClientPort,
  type CaioUpstreamInvokeResult,
} from "./upstream-contracts";

export type CaioChatCompletionsUpstreamClientOptions = {
  fetchImpl: typeof fetch;
  endpointBaseUrl: string;
  apiKeyProvider: () => Promise<string>;
};

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/u, "")}${path}`;
}

export class CaioChatCompletionsUpstreamClient {
  private readonly fetchImpl: typeof fetch;
  private readonly endpointBaseUrl: string;
  private readonly apiKeyProvider: () => Promise<string>;

  constructor(options: CaioChatCompletionsUpstreamClientOptions) {
    this.fetchImpl = options.fetchImpl;
    this.endpointBaseUrl = options.endpointBaseUrl;
    this.apiKeyProvider = options.apiKeyProvider;
  }

  private async post(input: {
    body: Record<string, unknown>;
    signal?: AbortSignal;
  }): Promise<Response> {
    // Key is scoped to this call only; never stored on the instance.
    const apiKey = await this.apiKeyProvider();
    return this.fetchImpl(
      joinUrl(this.endpointBaseUrl, "/chat/completions"),
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(input.body),
        // A followed redirect is an unreviewed second egress: it can move the
        // bearer key and the prompt to a different host, or to plaintext http.
        // The binding named ONE https endpoint, so a 3xx is a transport
        // failure.
        redirect: "error",
        ...(input.signal ? { signal: input.signal } : {}),
      },
    );
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
      });
    } catch (error) {
      if (isAbortError(error, input.signal)) {
        return { status: "cancelled" };
      }
      // Includes the refused-redirect TypeError: no hop was completed, so
      // this is indistinguishable from "the endpoint could not be reached".
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
}

// Per-request port used by the proxy engine: endpoint + key arrive with each
// invocation (the engine resolves them from the alias binding + credential
// loader), so one port instance serves every Chat Completions binding. The
// key lives only inside the single call's closure.
export function createCaioChatCompletionsUpstreamPort(deps: {
  fetchImpl: typeof fetch;
}): CaioProxyUpstreamClientPort {
  return {
    invoke: ({ endpointBaseUrl, apiKey, body, signal }) =>
      new CaioChatCompletionsUpstreamClient({
        fetchImpl: deps.fetchImpl,
        endpointBaseUrl,
        apiKeyProvider: async () => apiKey,
      }).invoke({ body, ...(signal ? { signal } : {}) }),
  };
}
