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
      // once bytes flow, failures degrade to incomplete_stream instead. This
      // literal documents the invariant but erases at runtime, so the engine
      // ALSO enforces it (see forwardedChunkCount in proxy-engine.ts).
      chunksForwarded: 0;
    } & CaioUpstreamErrorInfo)
  | { status: "cancelled"; chunksForwarded: number };

/** Reason reported when the DOWNSTREAM writer, not the upstream, failed. */
export const CAIO_DOWNSTREAM_WRITE_FAILED_REASON = "downstream_write_failed";

/**
 * Raised when the downstream chunk writer (onChunk) throws. Distinct from an
 * upstream failure: the bytes were already handed over, so the request is NEVER
 * retryable, no matter what the upstream would have done next.
 */
export class CaioDownstreamForwardError extends Error {
  readonly code = "caio_downstream_forward_failed";
  /** The writer's own error. Never propagated to a client-visible payload. */
  readonly forwardCause: unknown;

  constructor(forwardCause: unknown) {
    super("caio_downstream_forward_failed");
    this.name = "CaioDownstreamForwardError";
    this.forwardCause = forwardCause;
  }
}

/**
 * Chunk forwarding accounting shared by the protocol clients.
 *
 * `forward()` increments the counter BEFORE handing the chunk to the writer:
 * once the writer has been called the bytes may already be on the downstream
 * socket, so the attempt itself must make retry illegal. Counting afterwards
 * (the original order) let a writer that threw on the first chunk report
 * "0 chunks forwarded" and earn a second upstream POST that replayed the same
 * bytes.
 *
 * `emitTerminalMarker()` is best-effort and never counted: it carries the
 * synthetic incomplete-stream marker, and if the writer is already broken there
 * is nothing left to tell it.
 */
export function createCaioChunkForwarder(onChunk: (chunk: string) => void): {
  forward(chunk: string): void;
  emitTerminalMarker(chunk: string): void;
  readonly forwarded: number;
} {
  let forwarded = 0;
  return {
    forward(chunk: string): void {
      forwarded += 1;
      try {
        onChunk(chunk);
      } catch (error) {
        throw new CaioDownstreamForwardError(error);
      }
    },
    emitTerminalMarker(chunk: string): void {
      try {
        onChunk(chunk);
      } catch {
        // Downstream is already unwritable; the typed result carries the reason.
      }
    },
    get forwarded(): number {
      return forwarded;
    },
  };
}

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
