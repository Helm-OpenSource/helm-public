import { describe, expect, it, vi } from "vitest";

import {
  isCaioAccessGatewayError,
  type CaioAccessGatewayError,
} from "@/lib/caio-access-gateway/gateway-error-contract";
import {
  caioModelDispatchOutcomeFromProxyResult,
  createCaioGatewayModelDispatchPort,
} from "@/lib/caio-access-gateway/model-dispatch-bridge";
import type { CaioAccessPrincipal } from "@/lib/caio-access-gateway/token-store.service";
import {
  CAIO_AUDIT_CONFLICT_ERROR_CODE,
  CAIO_AUDIT_REPLAY_LIMIT_ERROR_CODE,
  CAIO_AUDIT_UNAVAILABLE_ERROR_CODE,
} from "@/lib/caio-audit-state/audit-state-contracts";
import type {
  CaioModelProxy,
  CaioProxyAuditRefusal,
  CaioProxyExecuteResult,
} from "@/lib/caio-model-proxy/proxy-engine";

const PRINCIPAL: CaioAccessPrincipal = Object.freeze({
  tokenId: "tok_bridge_1",
  workspaceId: "ws_bridge",
  userRef: "user:ceo",
  clientType: "codex",
  deviceRef: "device:mac-studio",
  audience: "model",
});

function proxyResult(
  overrides: Partial<CaioProxyExecuteResult> = {},
): CaioProxyExecuteResult {
  return {
    status: "ok",
    httpStatus: 200,
    reasonCode: null,
    receiptId: "receipt-1",
    retryAfterSeconds: null,
    body: { id: "resp_ok" },
    upstream: null,
    fallbackAttempted: false,
    fallbackSucceeded: false,
    fallbackReceiptId: null,
    auditRefusal: null,
    ...overrides,
  };
}

function refusal(
  status: CaioProxyAuditRefusal["status"],
  retryAfterSeconds: number | null,
): CaioProxyAuditRefusal {
  const errorCode = {
    audit_unavailable: CAIO_AUDIT_UNAVAILABLE_ERROR_CODE,
    receipt_conflict: CAIO_AUDIT_CONFLICT_ERROR_CODE,
    replay_limit_exceeded: CAIO_AUDIT_REPLAY_LIMIT_ERROR_CODE,
  }[status];
  const httpStatus = {
    audit_unavailable: 503,
    receipt_conflict: 409,
    replay_limit_exceeded: 429,
  }[status];
  return Object.freeze({ status, errorCode, httpStatus, retryAfterSeconds });
}

function refusedResult(
  status: CaioProxyAuditRefusal["status"],
  retryAfterSeconds: number | null,
): CaioProxyExecuteResult {
  const outcome = refusal(status, retryAfterSeconds);
  return proxyResult({
    status,
    httpStatus: outcome.httpStatus,
    reasonCode: outcome.errorCode,
    receiptId: null,
    retryAfterSeconds,
    body: null,
    auditRefusal: outcome,
  });
}

function caught(run: () => unknown): CaioAccessGatewayError {
  try {
    run();
  } catch (error) {
    if (isCaioAccessGatewayError(error)) return error;
    throw error;
  }
  throw new Error("expected a CaioAccessGatewayError to be thrown");
}

describe("caioModelDispatchOutcomeFromProxyResult", () => {
  it("carries the proxy's audit receipt id through as auditReceiptId", () => {
    const outcome = caioModelDispatchOutcomeFromProxyResult(
      proxyResult({ receiptId: "receipt-42", body: { id: "resp_42" } }),
    );
    expect(outcome).toEqual({
      claim: "allowed",
      auditReceiptId: "receipt-42",
      body: { id: "resp_42" },
    });
  });

  it("serves a null upstream body as null rather than dropping the allowed arm", () => {
    const outcome = caioModelDispatchOutcomeFromProxyResult(
      proxyResult({ body: null }),
    );
    expect(outcome).toEqual({
      claim: "allowed",
      auditReceiptId: "receipt-1",
      body: null,
    });
  });

  it("maps a refused audit_unavailable claim to the refused arm with retry advice", () => {
    const outcome = caioModelDispatchOutcomeFromProxyResult(
      refusedResult("audit_unavailable", 30),
    );
    expect(outcome).toEqual({
      claim: "refused",
      refusal: "audit_unavailable",
      retryAfterSeconds: 30,
    });
  });

  it("maps a refused receipt_conflict claim with a defined null retryAfterSeconds", () => {
    const outcome = caioModelDispatchOutcomeFromProxyResult(
      refusedResult("receipt_conflict", null),
    );
    expect(outcome).toEqual({
      claim: "refused",
      refusal: "receipt_conflict",
      retryAfterSeconds: null,
    });
    expect(
      outcome.claim === "refused" ? outcome.retryAfterSeconds : "missing",
    ).not.toBeUndefined();
  });

  it("maps a refused replay_limit_exceeded claim distinctly", () => {
    const outcome = caioModelDispatchOutcomeFromProxyResult(
      refusedResult("replay_limit_exceeded", null),
    );
    expect(outcome).toEqual({
      claim: "refused",
      refusal: "replay_limit_exceeded",
      retryAfterSeconds: null,
    });
  });

  it("keeps the three refusals distinguishable after mapping", () => {
    const mapped = (
      ["audit_unavailable", "receipt_conflict", "replay_limit_exceeded"] as const
    ).map((status) => {
      const outcome = caioModelDispatchOutcomeFromProxyResult(
        refusedResult(status, null),
      );
      return outcome.claim === "refused" ? outcome.refusal : "allowed";
    });
    expect(mapped).toEqual([
      "audit_unavailable",
      "receipt_conflict",
      "replay_limit_exceeded",
    ]);
  });

  it("NEVER fabricates a receipt id when an ok result carries none", () => {
    const outcome = caioModelDispatchOutcomeFromProxyResult(
      proxyResult({ receiptId: null }),
    );
    expect(outcome).toEqual({
      claim: "refused",
      refusal: "audit_unavailable",
      retryAfterSeconds: null,
    });
    expect(JSON.stringify(outcome)).not.toContain("auditReceiptId");
  });

  it("NEVER fabricates a receipt id when an ok result carries an empty one", () => {
    const outcome = caioModelDispatchOutcomeFromProxyResult(
      proxyResult({ receiptId: "" }),
    );
    expect(outcome).toMatchObject({
      claim: "refused",
      refusal: "audit_unavailable",
    });
  });

  it("refuses fail-closed when a refusal status carries no refusal object", () => {
    // A JS caller can hand over a status with no auditRefusal payload.
    const outcome = caioModelDispatchOutcomeFromProxyResult(
      proxyResult({
        status: "receipt_conflict",
        receiptId: null,
        retryAfterSeconds: null,
        auditRefusal: null,
      }),
    );
    expect(outcome).toEqual({
      claim: "refused",
      refusal: "receipt_conflict",
      retryAfterSeconds: null,
    });
  });

  it("collapses an unmodelled refusal status onto audit_unavailable, never onto allowed", () => {
    const outcome = caioModelDispatchOutcomeFromProxyResult(
      proxyResult({
        receiptId: "receipt-1",
        auditRefusal: {
          status: "something_new",
          errorCode: "x",
          httpStatus: 200,
          retryAfterSeconds: null,
        } as unknown as CaioProxyAuditRefusal,
      }),
    );
    expect(outcome).toEqual({
      claim: "refused",
      refusal: "audit_unavailable",
      retryAfterSeconds: null,
    });
  });

  it("raises a typed 429 for a gateway rate limit instead of serving a body", () => {
    const error = caught(() =>
      caioModelDispatchOutcomeFromProxyResult(
        proxyResult({
          status: "rate_limited",
          httpStatus: 429,
          reasonCode: "gateway_rate_limited",
          receiptId: null,
          retryAfterSeconds: 5,
          body: null,
        }),
      ),
    );
    expect(error.code).toBe("rate_limited");
    expect(error.wireStatus).toBe(429);
    expect(error.retryAfterSeconds).toBe(5);
  });

  it("raises a typed 503 no_route for an unroutable alias", () => {
    const error = caught(() =>
      caioModelDispatchOutcomeFromProxyResult(
        proxyResult({
          status: "no_route",
          httpStatus: 503,
          reasonCode: "alias_unknown",
          receiptId: null,
          body: null,
        }),
      ),
    );
    expect(error.code).toBe("no_route");
    expect(error.wireStatus).toBe(503);
  });

  // P1-1: an alias the caller is not granted is an AUTHORIZATION refusal. It
  // must not be reported as a retryable 503 availability answer.
  it("raises a typed 403 scope_violation when the alias is outside the caller's grant", () => {
    const error = caught(() =>
      caioModelDispatchOutcomeFromProxyResult(
        proxyResult({
          status: "alias_not_granted",
          httpStatus: 403,
          reasonCode: "alias_not_granted",
          receiptId: null,
          body: null,
        }),
      ),
    );
    expect(error.code).toBe("scope_violation");
    expect(error.wireStatus).toBe(403);
    expect(error.retryAfterSeconds).toBeNull();
  });

  // Owner ruling 2026-07-30: an unadmitted governed route is a governance
  // refusal (403), never a retryable availability answer and never a 200.
  it("raises a typed 403 route_not_governed when no policy admits the route", () => {
    const error = caught(() =>
      caioModelDispatchOutcomeFromProxyResult(
        proxyResult({
          status: "route_not_admitted",
          httpStatus: 403,
          reasonCode: "route_not_admitted",
          receiptId: null,
          body: null,
        }),
      ),
    );
    expect(error.code).toBe("route_not_governed");
    expect(error.wireStatus).toBe(403);
    expect(error.retryAfterSeconds).toBeNull();
  });

  // A body that crossed the hard content boundary reuses the existing 422
  // release-denied identifier rather than minting a second one for the same
  // meaning.
  it("raises a typed 422 external_release_denied when the content boundary refuses", () => {
    const error = caught(() =>
      caioModelDispatchOutcomeFromProxyResult(
        proxyResult({
          status: "content_boundary_denied",
          httpStatus: 422,
          reasonCode: "content_boundary_denied",
          receiptId: null,
          body: null,
        }),
      ),
    );
    expect(error.code).toBe("external_release_denied");
    expect(error.wireStatus).toBe(422);
  });

  it("raises a typed failure for a credential outage even though a receipt exists", () => {
    // The claim succeeded, so a naive mapping would return the allowed arm and
    // the gateway would answer 200 with a null body for a dispatch that failed.
    const error = caught(() =>
      caioModelDispatchOutcomeFromProxyResult(
        proxyResult({
          status: "credential_unavailable",
          httpStatus: 503,
          reasonCode: "credential_unavailable",
          receiptId: "receipt-1",
          body: null,
        }),
      ),
    );
    expect(error.wireStatus).toBe(503);
  });

  it("raises a typed 502 for an upstream failure", () => {
    const error = caught(() =>
      caioModelDispatchOutcomeFromProxyResult(
        proxyResult({
          status: "upstream_error",
          httpStatus: 502,
          reasonCode: "upstream_failed",
          body: null,
        }),
      ),
    );
    expect(error.code).toBe("upstream_failed");
    expect(error.wireStatus).toBe(502);
  });

  it("preserves an upstream 429 as a rate limit with its retry advice", () => {
    const error = caught(() =>
      caioModelDispatchOutcomeFromProxyResult(
        proxyResult({
          status: "upstream_error",
          httpStatus: 429,
          reasonCode: "upstream_rate_limited",
          retryAfterSeconds: 12,
          body: null,
        }),
      ),
    );
    expect(error.wireStatus).toBe(429);
    expect(error.retryAfterSeconds).toBe(12);
  });

  it("raises a typed failure for streamed and cancelled dispatches", () => {
    for (const status of ["incomplete_stream", "cancelled"] as const) {
      const error = caught(() =>
        caioModelDispatchOutcomeFromProxyResult(
          proxyResult({ status, body: null }),
        ),
      );
      expect(error.wireStatus).toBe(502);
    }
  });
});

describe("createCaioGatewayModelDispatchPort", () => {
  function harness(result: CaioProxyExecuteResult = proxyResult()) {
    const execute = vi.fn(async () => result);
    const proxy: CaioModelProxy = { execute };
    const port = createCaioGatewayModelDispatchPort({ proxy });
    return { execute, port };
  }

  const REQUEST = Object.freeze({
    principal: PRINCIPAL,
    requestId: "ws_bridge:req-1",
    clientCorrelationId: "client-hint-1",
    payload: { model: "caio-codex-default", input: "hello" },
  });

  it("dispatches /v1/responses on the responses protocol", async () => {
    const h = harness();
    const outcome = await h.port.responses(REQUEST);
    expect(outcome).toMatchObject({
      claim: "allowed",
      auditReceiptId: "receipt-1",
    });
    expect(h.execute).toHaveBeenCalledTimes(1);
    expect(h.execute.mock.calls[0][0]).toMatchObject({
      protocol: "responses",
      alias: "caio-codex-default",
      requestId: "ws_bridge:req-1",
      audienceContext: {
        workspaceId: "ws_bridge",
        userRef: "user:ceo",
        clientType: "codex",
      },
      body: { model: "caio-codex-default", input: "hello" },
    });
  });

  it("dispatches /v1/chat/completions on the chat_completions protocol", async () => {
    const h = harness();
    await h.port.chatCompletions(REQUEST);
    expect(h.execute.mock.calls[0][0]).toMatchObject({
      protocol: "chat_completions",
    });
  });

  it("uses the server-generated request id, never the client correlation hint", async () => {
    const h = harness();
    await h.port.responses(REQUEST);
    const call = h.execute.mock.calls[0][0];
    expect(call.requestId).toBe("ws_bridge:req-1");
    expect(JSON.stringify(call)).not.toContain("client-hint-1");
  });

  it("never requests streaming: the gateway response shape cannot stream", async () => {
    const h = harness();
    await h.port.responses(REQUEST);
    expect(h.execute.mock.calls[0][0].streaming).toBeUndefined();
  });

  it("refuses a payload that is not a JSON object", async () => {
    const h = harness();
    for (const payload of [null, "text", 7, [1, 2]]) {
      const error = await h.port
        .responses({ ...REQUEST, payload })
        .then(() => null)
        .catch((e: unknown) => e);
      expect(isCaioAccessGatewayError(error)).toBe(true);
      expect((error as CaioAccessGatewayError).wireStatus).toBe(400);
    }
    expect(h.execute).not.toHaveBeenCalled();
  });

  it("refuses a payload with no usable model alias", async () => {
    const h = harness();
    for (const payload of [{}, { model: "" }, { model: 7 }]) {
      const error = await h.port
        .responses({ ...REQUEST, payload })
        .then(() => null)
        .catch((e: unknown) => e);
      expect((error as CaioAccessGatewayError).wireStatus).toBe(400);
    }
    expect(h.execute).not.toHaveBeenCalled();
  });

  it("refuses a streaming request instead of answering it as buffered JSON", async () => {
    const h = harness();
    const error = await h.port
      .responses({ ...REQUEST, payload: { ...REQUEST.payload, stream: true } })
      .then(() => null)
      .catch((e: unknown) => e);
    expect((error as CaioAccessGatewayError).wireStatus).toBe(400);
    expect(h.execute).not.toHaveBeenCalled();
  });

  it("refuses a principal whose client type the proxy does not model", async () => {
    const h = harness();
    const error = await h.port
      .responses({
        ...REQUEST,
        principal: {
          ...PRINCIPAL,
          clientType: "unknown_client",
        } as unknown as CaioAccessPrincipal,
      })
      .then(() => null)
      .catch((e: unknown) => e);
    expect(isCaioAccessGatewayError(error)).toBe(true);
    expect(h.execute).not.toHaveBeenCalled();
  });

  it("maps a refused claim from the proxy straight onto the refused arm", async () => {
    const h = harness(refusedResult("receipt_conflict", null));
    const outcome = await h.port.responses(REQUEST);
    expect(outcome).toEqual({
      claim: "refused",
      refusal: "receipt_conflict",
      retryAfterSeconds: null,
    });
  });
});
