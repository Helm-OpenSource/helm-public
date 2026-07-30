import { describe, expect, it } from "vitest";

import type { CaioAuditGate } from "@/lib/caio-audit-state/audit-gate.service";
import {
  CAIO_CANONICAL_AUDIT_CLAIM_FIELD_MAP,
  caioAuditWireRefusal,
  caioGatewayReadinessFromAuditGate,
  createCaioCanonicalAuditGatePort,
  toCaioMinimalAuditReceipt,
  type CaioCanonicalAuditClaim,
} from "@/lib/caio-audit-state/gateway-audit-gate-adapter";

const CLAIM: CaioCanonicalAuditClaim = {
  requestId: "req-canonical-1",
  workspaceId: "ws-1",
  clientType: "codex",
  modelAlias: "caio-codex-default",
  inputHash: `sha256:${"a".repeat(64)}`,
  policyVersion: "policy-v3",
};

function gateReturning(result: unknown): CaioAuditGate {
  return {
    claimDispatch: async () =>
      result as Awaited<ReturnType<CaioAuditGate["claimDispatch"]>>,
    recover: async () => ({ replayed: 0, remaining: 0, conflicts: 0 }),
    getState: () => "NORMAL",
    getReadiness: async () => "ready",
  };
}

describe("canonical audit gate port", () => {
  // F9: the gateway core declared workspace/client field names against a
  // .strict() receipt schema, so a naive adapter threw ZodError. The mapping is
  // now published as data and as one function.
  it("maps the canonical claim vocabulary onto the strict receipt shape", () => {
    expect(toCaioMinimalAuditReceipt(CLAIM)).toEqual({
      requestId: "req-canonical-1",
      client: "codex",
      workspace: "ws-1",
      modelAlias: "caio-codex-default",
      inputHash: `sha256:${"a".repeat(64)}`,
      policyVersion: "policy-v3",
    });
    expect(CAIO_CANONICAL_AUDIT_CLAIM_FIELD_MAP.workspaceId).toBe("workspace");
    expect(CAIO_CANONICAL_AUDIT_CLAIM_FIELD_MAP.clientType).toBe("client");
    expect(Object.keys(CAIO_CANONICAL_AUDIT_CLAIM_FIELD_MAP).sort()).toEqual([
      "clientType",
      "inputHash",
      "modelAlias",
      "policyVersion",
      "requestId",
      "workspaceId",
    ]);
  });

  it("rejects a claim carrying an extra key before anything is persisted", () => {
    expect(() =>
      toCaioMinimalAuditReceipt({
        ...CLAIM,
        prompt: "leak",
      } as unknown as CaioCanonicalAuditClaim),
    ).toThrow();
  });

  it("passes an allowed claim through with its receipt and attempt ordinal", async () => {
    const port = createCaioCanonicalAuditGatePort(
      gateReturning({
        allowed: true,
        receiptId: "row-1",
        persistedVia: "primary",
        dispatchAttempt: 2,
      }),
    );
    expect(await port.claimDispatch(CLAIM)).toEqual({
      status: "allowed",
      receiptId: "row-1",
      persistedVia: "primary",
      dispatchAttempt: 2,
    });
  });

  // F9: a receipt conflict used to collapse into 503 with an undefined
  // Retry-After. It is now its own 409 outcome with a DEFINED retryAfter.
  it("surfaces a receipt conflict as a distinct 409 with a defined retryAfter", async () => {
    const port = createCaioCanonicalAuditGatePort(
      gateReturning({
        allowed: false,
        reason: "receipt_conflict",
        errorCode: "caio_audit_receipt_conflict",
        httpStatus: 409,
        retryAfterSeconds: null,
      }),
    );
    const outcome = await port.claimDispatch(CLAIM);
    expect(outcome).toEqual({
      status: "receipt_conflict",
      errorCode: "caio_audit_receipt_conflict",
      httpStatus: 409,
      retryAfterSeconds: null,
    });
    expect("retryAfterSeconds" in outcome).toBe(true);
    if ("retryAfterSeconds" in outcome) {
      expect(outcome.retryAfterSeconds).not.toBeUndefined();
    }
  });

  it("maps every refusal reason to a defined status, code and retryAfter", () => {
    const cases = [
      {
        reason: "audit_unavailable" as const,
        errorCode: "caio_audit_unavailable" as const,
        httpStatus: 503,
        retryAfterSeconds: 30,
        expected: "audit_unavailable",
      },
      {
        reason: "recovery_rate_limited" as const,
        errorCode: "caio_audit_unavailable" as const,
        httpStatus: 503,
        retryAfterSeconds: 30,
        expected: "audit_unavailable",
      },
      {
        reason: "receipt_conflict" as const,
        errorCode: "caio_audit_receipt_conflict" as const,
        httpStatus: 409,
        retryAfterSeconds: null,
        expected: "receipt_conflict",
      },
      {
        reason: "replay_limit_exceeded" as const,
        errorCode: "caio_audit_replay_limit_exceeded" as const,
        httpStatus: 429,
        retryAfterSeconds: null,
        expected: "replay_limit_exceeded",
      },
    ];
    for (const testCase of cases) {
      const wire = caioAuditWireRefusal({
        allowed: false,
        reason: testCase.reason,
        errorCode: testCase.errorCode,
        httpStatus: testCase.httpStatus,
        retryAfterSeconds: testCase.retryAfterSeconds,
      });
      expect(wire.status).toBe(testCase.expected);
      expect(wire.httpStatus).toBe(testCase.httpStatus);
      expect(wire.retryAfterSeconds).not.toBeUndefined();
    }
  });

  it("never reports undefined retryAfter even when the gate omits it", () => {
    const wire = caioAuditWireRefusal({
      allowed: false,
      reason: "audit_unavailable",
      errorCode: "caio_audit_unavailable",
      httpStatus: 503,
    } as never);
    expect(wire.retryAfterSeconds).toBeNull();
  });

  it("propagates a thrown gate error so the transport fails closed", async () => {
    const port = createCaioCanonicalAuditGatePort({
      claimDispatch: async () => {
        throw new Error("caio_audit_reserved_request_id");
      },
      recover: async () => ({ replayed: 0, remaining: 0, conflicts: 0 }),
      getState: () => "NORMAL",
      getReadiness: async () => "ready",
    });
    await expect(port.claimDispatch(CLAIM)).rejects.toThrow(
      /reserved_request_id/u,
    );
  });

  it("collapses the four gate readiness states onto the gateway's three", () => {
    expect(caioGatewayReadinessFromAuditGate("ready")).toBe("ready");
    expect(caioGatewayReadinessFromAuditGate("degraded")).toBe("degraded");
    expect(caioGatewayReadinessFromAuditGate("recovering")).toBe("degraded");
    expect(caioGatewayReadinessFromAuditGate("unavailable")).toBe(
      "unavailable",
    );
  });
});
