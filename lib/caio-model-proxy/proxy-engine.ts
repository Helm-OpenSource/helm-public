// CAIO model proxy — orchestration engine used by the LAN gateway.
//
// Pipeline (fail-closed at every step): resolve alias binding → protocol
// check → local rate limit → hash input → claim audit dispatch (BEFORE any
// upstream traffic; audit down means no egress) → load credential → invoke
// the protocol-matching upstream client → optional single fallback attempt
// (only before any streamed byte, only to a fail-closed-equivalent binding).
//
// The audit claim carries ONLY {requestId, workspaceId, clientType,
// modelAlias, inputHash, policyVersion} — never the request body, never
// credential material. Receipts are hash-based by construction.

import { canonicalJson, sha256 } from "@/lib/expert-capability/hashing";

import {
  caioModelAliasBindingSchema,
  isFallbackAllowed,
  type CaioModelAliasBinding,
  type CaioModelAliasFallbackCandidate,
  type CaioModelProtocol,
} from "./alias-contracts";
import type {
  CaioProxyUpstreamClientPort,
  CaioUpstreamErrorInfo,
  CaioUpstreamInvokeResult,
  CaioUpstreamStreamResult,
} from "./upstream/upstream-contracts";

export const CAIO_PROXY_CLIENT_TYPES = ["codex", "workbuddy"] as const;
export type CaioProxyClientType = (typeof CAIO_PROXY_CLIENT_TYPES)[number];

export type CaioAudienceContext = {
  workspaceId: string;
  userRef: string;
  clientType: CaioProxyClientType;
};

// Minimal audit claim: hashes and refs only. Adding fields here widens what
// leaves the request path into the audit store — keep it closed.
export type CaioDispatchClaim = {
  requestId: string;
  workspaceId: string;
  clientType: CaioProxyClientType;
  modelAlias: string;
  inputHash: string;
  policyVersion: string;
};

export type CaioAuditGateDecision =
  | { allowed: true; receiptId: string }
  | {
      allowed: false;
      state: "audit_unavailable";
      retryAfterSeconds: number;
    };

export type CaioAuditGatePort = {
  claimDispatch(claim: CaioDispatchClaim): Promise<CaioAuditGateDecision>;
};

export type CaioRateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds?: number;
};

export type CaioRateLimiterPort = {
  check(input: {
    workspaceId: string;
    userRef: string;
    clientType: CaioProxyClientType;
    alias: string;
  }): CaioRateLimitDecision;
};

export type CaioCredentialLoaderPort = {
  load(input: { credentialRef: string }): Promise<string>;
};

export type CaioModelProxyDependencies = {
  bindings: readonly CaioModelAliasBinding[];
  credentialLoader: CaioCredentialLoaderPort;
  clients: {
    responses: CaioProxyUpstreamClientPort;
    chatCompletions: CaioProxyUpstreamClientPort;
  };
  auditGate: CaioAuditGatePort;
  rateLimiter?: CaioRateLimiterPort;
  now?: () => Date;
};

export type CaioProxyExecuteInput = {
  audienceContext: CaioAudienceContext;
  alias: string;
  protocol: CaioModelProtocol;
  body: Record<string, unknown>;
  requestId: string;
  signal?: AbortSignal;
  streaming?: boolean;
  onChunk?: (chunk: string) => void;
};

export type CaioProxyUpstreamDescriptor = {
  providerKey: string;
  upstreamModel: string;
  policyVersion: string;
};

export type CaioProxyExecuteStatus =
  | "ok"
  | "no_route"
  | "rate_limited"
  | "audit_unavailable"
  | "credential_unavailable"
  | "upstream_error"
  | "incomplete_stream"
  | "cancelled";

export type CaioProxyExecuteResult = {
  status: CaioProxyExecuteStatus;
  httpStatus: number;
  reasonCode: string | null;
  receiptId: string | null;
  retryAfterSeconds: number | null;
  // Upstream JSON body for non-streaming success; null otherwise (streamed
  // content flows through onChunk and is never buffered here).
  body: unknown;
  upstream: CaioProxyUpstreamDescriptor | null;
  fallbackAttempted: boolean;
  fallbackSucceeded: boolean;
};

export type CaioModelProxy = {
  execute(input: CaioProxyExecuteInput): Promise<CaioProxyExecuteResult>;
};

class CaioModelProxyConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CaioModelProxyConfigError";
  }
}

function describeUpstream(
  binding: Pick<
    CaioModelAliasFallbackCandidate,
    "providerKey" | "upstreamModel" | "policyVersion"
  >,
): CaioProxyUpstreamDescriptor {
  return {
    providerKey: binding.providerKey,
    upstreamModel: binding.upstreamModel,
    policyVersion: binding.policyVersion,
  };
}

function noRoute(reasonCode: string): CaioProxyExecuteResult {
  return {
    status: "no_route",
    httpStatus: 503,
    reasonCode,
    receiptId: null,
    retryAfterSeconds: null,
    body: null,
    upstream: null,
    fallbackAttempted: false,
    fallbackSucceeded: false,
  };
}

function upstreamErrorResult(
  error: CaioUpstreamErrorInfo,
  receiptId: string,
  upstream: CaioProxyUpstreamDescriptor,
  fallbackAttempted: boolean,
): CaioProxyExecuteResult {
  return {
    status: "upstream_error",
    httpStatus: error.gatewayStatus,
    reasonCode: error.code,
    receiptId,
    retryAfterSeconds: error.retryAfterSeconds,
    body: null,
    upstream,
    fallbackAttempted,
    fallbackSucceeded: false,
  };
}

export function createCaioModelProxy(
  deps: CaioModelProxyDependencies,
): CaioModelProxy {
  // Fail fast on malformed gateway configuration: every binding must satisfy
  // the alias contract and aliases must be unique.
  const bindingsByAlias = new Map<string, CaioModelAliasBinding>();
  for (const raw of deps.bindings) {
    const binding = caioModelAliasBindingSchema.parse(raw);
    if (bindingsByAlias.has(binding.alias)) {
      throw new CaioModelProxyConfigError(
        `duplicate alias binding: ${binding.alias}`,
      );
    }
    bindingsByAlias.set(binding.alias, binding);
  }

  function clientForProtocol(
    protocol: CaioModelProtocol,
  ): CaioProxyUpstreamClientPort {
    return protocol === "responses"
      ? deps.clients.responses
      : deps.clients.chatCompletions;
  }

  async function invokeBinding(
    target: CaioModelAliasFallbackCandidate | CaioModelAliasBinding,
    input: CaioProxyExecuteInput,
    apiKey: string,
  ): Promise<CaioUpstreamInvokeResult | CaioUpstreamStreamResult> {
    const client = clientForProtocol(target.protocol);
    // Passthrough body with ONLY the model field replaced by the upstream
    // model name; tool/function-call fields flow through untouched.
    const upstreamBody: Record<string, unknown> = {
      ...input.body,
      model: target.upstreamModel,
    };
    if (input.streaming) {
      const onChunk = input.onChunk ?? (() => {});
      return client.invokeStreaming({
        endpointBaseUrl: target.endpointBaseUrl,
        apiKey,
        body: upstreamBody,
        onChunk,
        ...(input.signal ? { signal: input.signal } : {}),
      });
    }
    return client.invoke({
      endpointBaseUrl: target.endpointBaseUrl,
      apiKey,
      body: upstreamBody,
      ...(input.signal ? { signal: input.signal } : {}),
    });
  }

  function toResult(
    outcome: CaioUpstreamInvokeResult | CaioUpstreamStreamResult,
    receiptId: string,
    upstream: CaioProxyUpstreamDescriptor,
    fallback: { attempted: boolean; succeeded: boolean },
  ): CaioProxyExecuteResult {
    switch (outcome.status) {
      case "ok":
        return {
          status: "ok",
          httpStatus: 200,
          reasonCode: null,
          receiptId,
          retryAfterSeconds: null,
          body: "body" in outcome ? outcome.body : null,
          upstream,
          fallbackAttempted: fallback.attempted,
          fallbackSucceeded: fallback.succeeded,
        };
      case "incomplete_stream":
        // Headers were already sent when streaming began; the synthetic
        // terminal marker chunk has been emitted by the client.
        return {
          status: "incomplete_stream",
          httpStatus: 200,
          reasonCode: outcome.reason,
          receiptId,
          retryAfterSeconds: null,
          body: null,
          upstream,
          fallbackAttempted: fallback.attempted,
          fallbackSucceeded: false,
        };
      case "cancelled":
        return {
          status: "cancelled",
          httpStatus: 499,
          reasonCode: "client_cancelled",
          receiptId,
          retryAfterSeconds: null,
          body: null,
          upstream,
          fallbackAttempted: fallback.attempted,
          fallbackSucceeded: false,
        };
      case "upstream_error":
        return upstreamErrorResult(
          outcome,
          receiptId,
          upstream,
          fallback.attempted,
        );
    }
  }

  async function execute(
    input: CaioProxyExecuteInput,
  ): Promise<CaioProxyExecuteResult> {
    const binding = bindingsByAlias.get(input.alias);
    if (!binding) return noRoute("alias_unknown");
    if (binding.status !== "active") return noRoute("alias_disabled");
    if (binding.protocol !== input.protocol) {
      return noRoute("protocol_mismatch");
    }

    if (deps.rateLimiter) {
      const decision = deps.rateLimiter.check({
        workspaceId: input.audienceContext.workspaceId,
        userRef: input.audienceContext.userRef,
        clientType: input.audienceContext.clientType,
        alias: input.alias,
      });
      if (!decision.allowed) {
        return {
          status: "rate_limited",
          httpStatus: 429,
          reasonCode: "gateway_rate_limited",
          receiptId: null,
          retryAfterSeconds: decision.retryAfterSeconds ?? null,
          body: null,
          upstream: null,
          fallbackAttempted: false,
          fallbackSucceeded: false,
        };
      }
    }

    const inputHash = sha256(canonicalJson(input.body));

    // Audit gate BEFORE any upstream traffic. If the audit store cannot take
    // the claim, the request never reaches an upstream provider.
    const claim: CaioDispatchClaim = {
      requestId: input.requestId,
      workspaceId: input.audienceContext.workspaceId,
      clientType: input.audienceContext.clientType,
      modelAlias: input.alias,
      inputHash,
      policyVersion: binding.policyVersion,
    };
    const gate = await deps.auditGate.claimDispatch(claim);
    if (!gate.allowed) {
      return {
        status: "audit_unavailable",
        httpStatus: 503,
        reasonCode: "audit_unavailable",
        receiptId: null,
        retryAfterSeconds: gate.retryAfterSeconds,
        body: null,
        upstream: null,
        fallbackAttempted: false,
        fallbackSucceeded: false,
      };
    }
    const receiptId = gate.receiptId;

    let apiKey: string;
    try {
      apiKey = await deps.credentialLoader.load({
        credentialRef: binding.credentialRef,
      });
    } catch {
      // Never propagate loader error details (they can describe key files).
      return {
        status: "credential_unavailable",
        httpStatus: 503,
        reasonCode: "credential_unavailable",
        receiptId,
        retryAfterSeconds: null,
        body: null,
        upstream: null,
        fallbackAttempted: false,
        fallbackSucceeded: false,
      };
    }

    const primaryOutcome = await invokeBinding(binding, input, apiKey);
    const primaryUpstream = describeUpstream(binding);

    if (primaryOutcome.status !== "upstream_error") {
      return toResult(primaryOutcome, receiptId, primaryUpstream, {
        attempted: false,
        succeeded: false,
      });
    }

    // Fallback is only legal before any streamed byte has been forwarded.
    // Streaming upstream_error results structurally carry chunksForwarded: 0;
    // any post-first-byte failure surfaces as incomplete_stream (no retry).
    const candidate = binding.fallbackCandidates.find((c) =>
      isFallbackAllowed(binding, c),
    );
    if (!candidate) {
      return upstreamErrorResult(
        primaryOutcome,
        receiptId,
        primaryUpstream,
        false,
      );
    }

    // Max ONE fallback attempt, to the first equivalence-passing candidate.
    let fallbackKey: string;
    try {
      fallbackKey = await deps.credentialLoader.load({
        credentialRef: candidate.credentialRef,
      });
    } catch {
      return upstreamErrorResult(
        primaryOutcome,
        receiptId,
        primaryUpstream,
        true,
      );
    }

    const fallbackOutcome = await invokeBinding(candidate, input, fallbackKey);
    return toResult(fallbackOutcome, receiptId, describeUpstream(candidate), {
      attempted: true,
      succeeded: fallbackOutcome.status === "ok",
    });
  }

  return { execute };
}
