import { describe, expect, it, vi } from "vitest";

import { canonicalJson, sha256 } from "@/lib/expert-capability/hashing";

import type {
  CaioModelAliasBinding,
  CaioModelAliasFallbackCandidate,
} from "./alias-contracts";
import {
  createCaioModelProxy,
  type CaioDispatchClaim,
} from "./proxy-engine";
import type {
  CaioProxyUpstreamClientPort,
  CaioProxyUpstreamInvocation,
  CaioUpstreamInvokeResult,
  CaioUpstreamStreamResult,
} from "./upstream/upstream-contracts";

const SECRET_PROMPT = "TOP-SECRET-PROMPT-CONTENT";

const UPSTREAM_500: CaioUpstreamInvokeResult = {
  status: "upstream_error",
  code: "upstream_failed",
  gatewayStatus: 502,
  upstreamStatus: 500,
  retryAfterSeconds: null,
};

function makeCandidate(
  overrides: Partial<CaioModelAliasFallbackCandidate> = {},
): CaioModelAliasFallbackCandidate {
  return {
    alias: "caio-codex-fallback",
    protocol: "responses",
    providerKey: "provider-a",
    upstreamModel: "provider-a-large-2",
    credentialRef: "provider-a-key-b",
    endpointBaseUrl: "https://upstream.example.internal/v1",
    region: "cn-hangzhou",
    dataRetentionPolicyKey: "retention-30d",
    trainingUsePolicyKey: "no-training",
    dataAuthorizationKey: "auth-tier-1",
    policyVersion: "policy-v3",
    status: "active",
    ...overrides,
  };
}

function makeBinding(
  overrides: Partial<CaioModelAliasBinding> = {},
): CaioModelAliasBinding {
  return {
    ...makeCandidate(),
    alias: "caio-codex-default",
    upstreamModel: "provider-a-large-1",
    credentialRef: "provider-a-key",
    fallbackCandidates: [],
    ...overrides,
  };
}

function makeHarness(input: {
  bindings?: CaioModelAliasBinding[];
  responsesInvokeResults?: Array<
    CaioUpstreamInvokeResult | CaioUpstreamStreamResult
  >;
} = {}) {
  const events: string[] = [];
  const okResult: CaioUpstreamInvokeResult = {
    status: "ok",
    upstreamStatus: 200,
    body: { id: "resp_ok" },
  };
  const queue = [...(input.responsesInvokeResults ?? [okResult])];
  const nextResult = () => queue.shift() ?? okResult;

  const responsesInvoke = vi.fn(
    async (_input: CaioProxyUpstreamInvocation) => {
      events.push("upstream");
      return nextResult() as CaioUpstreamInvokeResult;
    },
  );
  const responsesStream = vi.fn(
    async (
      _input: CaioProxyUpstreamInvocation & {
        onChunk: (chunk: string) => void;
      },
    ) => {
      events.push("upstream");
      return nextResult() as CaioUpstreamStreamResult;
    },
  );
  const chatInvoke = vi.fn(
    async (_input: CaioProxyUpstreamInvocation) => {
      events.push("upstream-chat");
      return okResult;
    },
  );
  const chatStream = vi.fn(
    async (
      _input: CaioProxyUpstreamInvocation & {
        onChunk: (chunk: string) => void;
      },
    ) => {
      events.push("upstream-chat");
      return { status: "ok", chunksForwarded: 1 } as CaioUpstreamStreamResult;
    },
  );

  const clients: {
    responses: CaioProxyUpstreamClientPort;
    chatCompletions: CaioProxyUpstreamClientPort;
  } = {
    responses: { invoke: responsesInvoke, invokeStreaming: responsesStream },
    chatCompletions: { invoke: chatInvoke, invokeStreaming: chatStream },
  };

  const claimDispatch = vi.fn(async (_claim: CaioDispatchClaim) => {
    events.push("audit");
    return { allowed: true as const, receiptId: "receipt-1" };
  });
  const credentialLoad = vi.fn(
    async ({ credentialRef }: { credentialRef: string }) =>
      `loaded-secret-for-${credentialRef}`,
  );

  const proxy = createCaioModelProxy({
    bindings: input.bindings ?? [makeBinding()],
    credentialLoader: { load: credentialLoad },
    clients,
    auditGate: { claimDispatch },
  });

  return {
    proxy,
    events,
    responsesInvoke,
    responsesStream,
    chatInvoke,
    chatStream,
    claimDispatch,
    credentialLoad,
  };
}

function baseExecuteInput(overrides: Record<string, unknown> = {}) {
  return {
    audienceContext: {
      workspaceId: "ws-1",
      userRef: "user-1",
      clientType: "codex" as const,
    },
    alias: "caio-codex-default",
    protocol: "responses" as const,
    body: {
      model: "caio-codex-default",
      input: SECRET_PROMPT,
      tools: [{ type: "function", name: "lookup" }],
    },
    requestId: "req-1",
    ...overrides,
  };
}

describe("createCaioModelProxy configuration", () => {
  it("rejects duplicate alias bindings at construction", () => {
    expect(() =>
      makeHarness({ bindings: [makeBinding(), makeBinding()] }),
    ).toThrow(/duplicate alias/);
  });

  it("rejects malformed bindings at construction", () => {
    expect(() =>
      makeHarness({
        bindings: [
          makeBinding({ credentialRef: "../escape" }),
        ],
      }),
    ).toThrow();
  });
});

describe("alias resolution", () => {
  it("returns no_route (503) for an unknown alias without touching audit or upstream", async () => {
    const h = makeHarness();
    const result = await h.proxy.execute(
      baseExecuteInput({ alias: "caio-nonexistent" }),
    );
    expect(result).toMatchObject({
      status: "no_route",
      httpStatus: 503,
      reasonCode: "alias_unknown",
      receiptId: null,
    });
    expect(h.claimDispatch).not.toHaveBeenCalled();
    expect(h.responsesInvoke).not.toHaveBeenCalled();
  });

  it("returns no_route for a disabled alias", async () => {
    const h = makeHarness({
      bindings: [makeBinding({ status: "disabled" })],
    });
    const result = await h.proxy.execute(baseExecuteInput());
    expect(result).toMatchObject({
      status: "no_route",
      reasonCode: "alias_disabled",
    });
    expect(h.responsesInvoke).not.toHaveBeenCalled();
  });

  it("returns no_route when the request protocol does not match the alias", async () => {
    const h = makeHarness();
    const result = await h.proxy.execute(
      baseExecuteInput({ protocol: "chat_completions" }),
    );
    expect(result).toMatchObject({
      status: "no_route",
      reasonCode: "protocol_mismatch",
    });
    expect(h.chatInvoke).not.toHaveBeenCalled();
    expect(h.responsesInvoke).not.toHaveBeenCalled();
  });
});

describe("audit gate ordering", () => {
  it("claims the audit dispatch BEFORE any upstream call", async () => {
    const h = makeHarness();
    await h.proxy.execute(baseExecuteInput());
    expect(h.events).toEqual(["audit", "upstream"]);
  });

  it("returns 503 audit_unavailable and never touches upstream when the claim is denied", async () => {
    const h = makeHarness();
    h.claimDispatch.mockResolvedValueOnce({
      allowed: false,
      state: "audit_unavailable",
      retryAfterSeconds: 30,
    } as never);
    const result = await h.proxy.execute(baseExecuteInput());
    expect(result).toMatchObject({
      status: "audit_unavailable",
      httpStatus: 503,
      retryAfterSeconds: 30,
      receiptId: null,
    });
    expect(h.responsesInvoke).not.toHaveBeenCalled();
    expect(h.responsesStream).not.toHaveBeenCalled();
    expect(h.credentialLoad).not.toHaveBeenCalled();
  });

  it("sends a minimal claim: exact fields, hash only, no body, no credential", async () => {
    const h = makeHarness();
    const input = baseExecuteInput();
    await h.proxy.execute(input);
    expect(h.claimDispatch).toHaveBeenCalledTimes(1);
    const claim = h.claimDispatch.mock.calls[0][0] as unknown as Record<
      string,
      unknown
    >;
    expect(Object.keys(claim).sort()).toEqual([
      "clientType",
      "inputHash",
      "modelAlias",
      "policyVersion",
      "requestId",
      "workspaceId",
    ]);
    expect(claim).toMatchObject({
      requestId: "req-1",
      workspaceId: "ws-1",
      clientType: "codex",
      modelAlias: "caio-codex-default",
      policyVersion: "policy-v3",
      inputHash: sha256(canonicalJson(input.body)),
    });
    const serialized = JSON.stringify(claim);
    expect(serialized).not.toContain(SECRET_PROMPT);
    expect(serialized).not.toContain("loaded-secret-for");
    expect(serialized).not.toContain("provider-a-key");
  });
});

describe("credential handling", () => {
  it("returns 503 credential_unavailable without touching upstream when the loader fails", async () => {
    const h = makeHarness();
    h.credentialLoad.mockRejectedValueOnce(
      new Error("credential_not_found:missing"),
    );
    const result = await h.proxy.execute(baseExecuteInput());
    expect(result).toMatchObject({
      status: "credential_unavailable",
      httpStatus: 503,
      receiptId: "receipt-1",
    });
    expect(h.responsesInvoke).not.toHaveBeenCalled();
  });
});

describe("successful dispatch", () => {
  it("replaces the model with the upstream model and passes tools through untouched", async () => {
    const h = makeHarness();
    const result = await h.proxy.execute(baseExecuteInput());
    expect(result).toMatchObject({
      status: "ok",
      httpStatus: 200,
      receiptId: "receipt-1",
      body: { id: "resp_ok" },
      upstream: {
        providerKey: "provider-a",
        upstreamModel: "provider-a-large-1",
        policyVersion: "policy-v3",
      },
      fallbackAttempted: false,
      fallbackSucceeded: false,
    });
    const call = h.responsesInvoke.mock.calls[0][0] as unknown as {
      body: Record<string, unknown>;
      apiKey: string;
      endpointBaseUrl: string;
    };
    expect(call.body.model).toBe("provider-a-large-1");
    expect(call.body.input).toBe(SECRET_PROMPT);
    expect(call.body.tools).toEqual([{ type: "function", name: "lookup" }]);
    expect(call.apiKey).toBe("loaded-secret-for-provider-a-key");
    expect(call.endpointBaseUrl).toBe("https://upstream.example.internal/v1");
  });

  it("routes chat_completions aliases to the chat client, not the responses client", async () => {
    const h = makeHarness({
      bindings: [
        makeBinding({
          alias: "caio-workbuddy-default",
          protocol: "chat_completions",
        }),
      ],
    });
    const result = await h.proxy.execute(
      baseExecuteInput({
        alias: "caio-workbuddy-default",
        protocol: "chat_completions",
        audienceContext: {
          workspaceId: "ws-1",
          userRef: "user-1",
          clientType: "workbuddy" as const,
        },
      }),
    );
    expect(result.status).toBe("ok");
    expect(h.chatInvoke).toHaveBeenCalledTimes(1);
    expect(h.responsesInvoke).not.toHaveBeenCalled();
  });
});

describe("rate limiter", () => {
  it("returns 429 before claiming audit when the gateway rate limit denies", async () => {
    const check = vi.fn(() => ({ allowed: false, retryAfterSeconds: 5 }));
    const h = makeHarness();
    const proxy = createCaioModelProxy({
      bindings: [makeBinding()],
      credentialLoader: { load: h.credentialLoad },
      clients: {
        responses: {
          invoke: h.responsesInvoke,
          invokeStreaming: h.responsesStream,
        },
        chatCompletions: {
          invoke: h.chatInvoke,
          invokeStreaming: h.chatStream,
        },
      },
      auditGate: { claimDispatch: h.claimDispatch },
      rateLimiter: { check },
    });
    const result = await proxy.execute(baseExecuteInput());
    expect(result).toMatchObject({
      status: "rate_limited",
      httpStatus: 429,
      retryAfterSeconds: 5,
    });
    expect(check).toHaveBeenCalledTimes(1);
    expect(h.claimDispatch).not.toHaveBeenCalled();
    expect(h.responsesInvoke).not.toHaveBeenCalled();
  });
});

describe("fallback", () => {
  it("attempts at most ONE equivalence-passing fallback on pre-stream upstream failure", async () => {
    const h = makeHarness({
      bindings: [
        makeBinding({
          fallbackCandidates: [
            // Cross-provider: must be skipped by the fail-closed rule.
            makeCandidate({ providerKey: "provider-b" }),
            makeCandidate(),
            // A second equivalent candidate that must never be tried.
            makeCandidate({ upstreamModel: "provider-a-large-3" }),
          ],
        }),
      ],
      responsesInvokeResults: [
        UPSTREAM_500,
        { status: "ok", upstreamStatus: 200, body: { id: "resp_fb" } },
      ],
    });
    const result = await h.proxy.execute(baseExecuteInput());
    expect(result).toMatchObject({
      status: "ok",
      fallbackAttempted: true,
      fallbackSucceeded: true,
      upstream: {
        providerKey: "provider-a",
        upstreamModel: "provider-a-large-2",
        policyVersion: "policy-v3",
      },
      body: { id: "resp_fb" },
    });
    expect(h.responsesInvoke).toHaveBeenCalledTimes(2);
    const fallbackCall = h.responsesInvoke.mock.calls[1][0] as unknown as {
      body: Record<string, unknown>;
      apiKey: string;
    };
    expect(fallbackCall.body.model).toBe("provider-a-large-2");
    expect(fallbackCall.apiKey).toBe(
      "loaded-secret-for-provider-a-key-b",
    );
  });

  it("stops after one fallback attempt even when it also fails", async () => {
    const h = makeHarness({
      bindings: [
        makeBinding({
          fallbackCandidates: [
            makeCandidate(),
            makeCandidate({ upstreamModel: "provider-a-large-3" }),
          ],
        }),
      ],
      responsesInvokeResults: [UPSTREAM_500, UPSTREAM_500],
    });
    const result = await h.proxy.execute(baseExecuteInput());
    expect(result).toMatchObject({
      status: "upstream_error",
      httpStatus: 502,
      fallbackAttempted: true,
      fallbackSucceeded: false,
    });
    expect(h.responsesInvoke).toHaveBeenCalledTimes(2);
  });

  it("does not fall back when no candidate passes the equivalence rule", async () => {
    const h = makeHarness({
      bindings: [
        makeBinding({
          fallbackCandidates: [
            makeCandidate({ providerKey: "provider-b" }),
            makeCandidate({ region: "us-east-1" }),
            makeCandidate({ status: "disabled" }),
          ],
        }),
      ],
      responsesInvokeResults: [UPSTREAM_500],
    });
    const result = await h.proxy.execute(baseExecuteInput());
    expect(result).toMatchObject({
      status: "upstream_error",
      fallbackAttempted: false,
      fallbackSucceeded: false,
      upstream: { upstreamModel: "provider-a-large-1" },
    });
    expect(h.responsesInvoke).toHaveBeenCalledTimes(1);
  });

  it("reports the original upstream error when the fallback credential fails to load", async () => {
    const h = makeHarness({
      bindings: [
        makeBinding({ fallbackCandidates: [makeCandidate()] }),
      ],
      responsesInvokeResults: [UPSTREAM_500],
    });
    h.credentialLoad
      .mockResolvedValueOnce("loaded-secret-for-provider-a-key")
      .mockRejectedValueOnce(new Error("credential_not_found:missing"));
    const result = await h.proxy.execute(baseExecuteInput());
    expect(result).toMatchObject({
      status: "upstream_error",
      reasonCode: "upstream_failed",
      fallbackAttempted: true,
      fallbackSucceeded: false,
    });
    expect(h.responsesInvoke).toHaveBeenCalledTimes(1);
  });

  it("NEVER falls back after streaming has forwarded bytes", async () => {
    const h = makeHarness({
      bindings: [
        makeBinding({ fallbackCandidates: [makeCandidate()] }),
      ],
      responsesInvokeResults: [
        {
          status: "incomplete_stream",
          reason: "upstream_stream_error",
          chunksForwarded: 3,
        },
      ],
    });
    const result = await h.proxy.execute(
      baseExecuteInput({ streaming: true, onChunk: () => {} }),
    );
    expect(result).toMatchObject({
      status: "incomplete_stream",
      reasonCode: "upstream_stream_error",
      fallbackAttempted: false,
      fallbackSucceeded: false,
    });
    expect(h.responsesStream).toHaveBeenCalledTimes(1);
    expect(h.responsesInvoke).not.toHaveBeenCalled();
  });

  it("allows a fallback when a streaming attempt fails before any byte", async () => {
    const h = makeHarness({
      bindings: [
        makeBinding({ fallbackCandidates: [makeCandidate()] }),
      ],
      responsesInvokeResults: [
        {
          status: "upstream_error",
          code: "upstream_unreachable",
          gatewayStatus: 502,
          upstreamStatus: null,
          retryAfterSeconds: null,
          chunksForwarded: 0,
        },
        { status: "ok", chunksForwarded: 5 },
      ],
    });
    const result = await h.proxy.execute(
      baseExecuteInput({ streaming: true, onChunk: () => {} }),
    );
    expect(result).toMatchObject({
      status: "ok",
      fallbackAttempted: true,
      fallbackSucceeded: true,
    });
    expect(h.responsesStream).toHaveBeenCalledTimes(2);
  });

  it("does not fall back on cancellation", async () => {
    const h = makeHarness({
      bindings: [
        makeBinding({ fallbackCandidates: [makeCandidate()] }),
      ],
      responsesInvokeResults: [{ status: "cancelled" }],
    });
    const result = await h.proxy.execute(baseExecuteInput());
    expect(result).toMatchObject({
      status: "cancelled",
      httpStatus: 499,
      fallbackAttempted: false,
    });
    expect(h.responsesInvoke).toHaveBeenCalledTimes(1);
  });
});

describe("normalized result hygiene", () => {
  it("never carries credential material in any result", async () => {
    const h = makeHarness({
      bindings: [
        makeBinding({ fallbackCandidates: [makeCandidate()] }),
      ],
      responsesInvokeResults: [UPSTREAM_500, UPSTREAM_500],
    });
    const result = await h.proxy.execute(baseExecuteInput());
    expect(JSON.stringify(result)).not.toContain("loaded-secret-for");
  });

  it("passes upstream Retry-After through on rate-limited upstream errors", async () => {
    const h = makeHarness({
      responsesInvokeResults: [
        {
          status: "upstream_error",
          code: "upstream_rate_limited",
          gatewayStatus: 429,
          upstreamStatus: 429,
          retryAfterSeconds: 12,
        },
      ],
    });
    const result = await h.proxy.execute(baseExecuteInput());
    expect(result).toMatchObject({
      status: "upstream_error",
      httpStatus: 429,
      reasonCode: "upstream_rate_limited",
      retryAfterSeconds: 12,
    });
  });
});
