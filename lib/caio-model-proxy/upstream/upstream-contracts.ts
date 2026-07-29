// CAIO model proxy — transport-level upstream result contracts.
//
// This file is deliberately protocol-agnostic: it defines error codes, result
// unions, the per-request port shape, and HTTP status mapping shared by the
// two INDEPENDENT protocol clients (Responses, Chat Completions). It contains
// NO request/response body handling and NO translation between the two
// protocols — each client owns its own wire format end to end.

export const CAIO_UPSTREAM_ERROR_CODES = [
  "upstream_unreachable",
  "upstream_auth_failed",
  "upstream_model_not_found",
  "upstream_rate_limited",
  "upstream_failed",
] as const;

export type CaioUpstreamErrorCode =
  (typeof CAIO_UPSTREAM_ERROR_CODES)[number];

// All upstream failures surface to gateway clients as 502, except rate limits
// which pass through as 429 (with upstream Retry-After when present).
export function gatewayStatusForUpstreamError(
  code: CaioUpstreamErrorCode,
): 429 | 502 {
  return code === "upstream_rate_limited" ? 429 : 502;
}

export type CaioUpstreamErrorInfo = {
  code: CaioUpstreamErrorCode;
  gatewayStatus: 429 | 502;
  upstreamStatus: number | null;
  retryAfterSeconds: number | null;
};

export type CaioUpstreamInvokeResult =
  | { status: "ok"; upstreamStatus: number; body: unknown }
  | ({ status: "upstream_error" } & CaioUpstreamErrorInfo)
  | { status: "cancelled" };

export type CaioUpstreamStreamResult =
  | { status: "ok"; chunksForwarded: number }
  | {
      status: "incomplete_stream";
      reason: string;
      chunksForwarded: number;
    }
  | ({
      status: "upstream_error";
      // Errors are only reportable as such when nothing has been forwarded;
      // once bytes flow, failures degrade to incomplete_stream instead.
      chunksForwarded: 0;
    } & CaioUpstreamErrorInfo)
  | { status: "cancelled"; chunksForwarded: number };

// Maps an upstream non-2xx HTTP status to a typed gateway error. Upstream
// response bodies are intentionally NEVER read into the mapped error — only
// the status and a safe code cross the boundary.
export function mapUpstreamHttpError(input: {
  upstreamStatus: number;
  retryAfterHeader: string | null;
}): CaioUpstreamErrorInfo {
  let code: CaioUpstreamErrorCode;
  if (input.upstreamStatus === 401 || input.upstreamStatus === 403) {
    code = "upstream_auth_failed";
  } else if (input.upstreamStatus === 404) {
    code = "upstream_model_not_found";
  } else if (input.upstreamStatus === 429) {
    code = "upstream_rate_limited";
  } else {
    // 5xx and any other unexpected status: opaque upstream failure.
    code = "upstream_failed";
  }
  let retryAfterSeconds: number | null = null;
  if (code === "upstream_rate_limited" && input.retryAfterHeader) {
    const parsed = Number.parseInt(input.retryAfterHeader, 10);
    if (Number.isFinite(parsed) && parsed >= 0) {
      retryAfterSeconds = parsed;
    }
  }
  return {
    code,
    gatewayStatus: gatewayStatusForUpstreamError(code),
    upstreamStatus: input.upstreamStatus,
    retryAfterSeconds,
  };
}

export function isAbortError(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  return (
    error instanceof Error &&
    (error.name === "AbortError" ||
      (error as { code?: unknown }).code === "ABORT_ERR")
  );
}

// Per-request invocation shape used by the proxy engine. The API key is
// resolved per request through the credential loader port and passed down for
// this single call only — the port implementations never cache it.
export type CaioProxyUpstreamInvocation = {
  endpointBaseUrl: string;
  apiKey: string;
  body: Record<string, unknown>;
  signal?: AbortSignal;
};

export type CaioProxyUpstreamClientPort = {
  invoke(
    input: CaioProxyUpstreamInvocation,
  ): Promise<CaioUpstreamInvokeResult>;
  invokeStreaming(
    input: CaioProxyUpstreamInvocation & {
      onChunk: (chunk: string) => void;
    },
  ): Promise<CaioUpstreamStreamResult>;
};
