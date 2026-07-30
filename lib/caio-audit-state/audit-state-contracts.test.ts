import { describe, expect, it } from "vitest";

import {
  CAIO_AUDIT_GATE_STATES,
  CAIO_AUDIT_RETRY_AFTER_HEADER,
  CAIO_AUDIT_UNAVAILABLE_ERROR_CODE,
  CAIO_AUDIT_UNAVAILABLE_HTTP_STATUS,
  caioAuditGateStateSchema,
  caioMinimalAuditReceiptSchema,
  caioReceiptDigest,
  canonicalCaioReceiptPayload,
} from "@/lib/caio-audit-state/audit-state-contracts";
import { CAIO_DEPLOYMENT_POSTURES } from "@/lib/caio-audit-state/deployment-posture";

const VALID_RECEIPT = {
  requestId: "req-0001",
  client: "workbuddy",
  workspace: "ws-audit-contract",
  modelAlias: "caio-default",
  inputHash: `sha256:${"a".repeat(64)}`,
  policyVersion: "policy-v3",
  posture: "self_service" as const,
};

describe("caio audit state contracts", () => {
  it("declares the four gate states", () => {
    expect([...CAIO_AUDIT_GATE_STATES]).toEqual([
      "NORMAL",
      "PRIMARY_DEGRADED",
      "AUDIT_UNAVAILABLE",
      "RECOVERING",
    ]);
    expect(caioAuditGateStateSchema.parse("RECOVERING")).toBe("RECOVERING");
    expect(() => caioAuditGateStateSchema.parse("HALTED")).toThrow();
  });

  it("accepts the exact minimal receipt shape", () => {
    expect(caioMinimalAuditReceiptSchema.parse(VALID_RECEIPT)).toEqual(
      VALID_RECEIPT,
    );
  });

  it("rejects a receipt smuggling a prompt or body key", () => {
    expect(() =>
      caioMinimalAuditReceiptSchema.parse({
        ...VALID_RECEIPT,
        prompt: "the raw user prompt must never be persisted",
      }),
    ).toThrow();
    expect(() =>
      caioMinimalAuditReceiptSchema.parse({
        ...VALID_RECEIPT,
        body: { messages: [] },
      }),
    ).toThrow();
  });

  it("rejects a receipt with a missing field or malformed hash", () => {
    const { inputHash: _inputHash, ...withoutHash } = VALID_RECEIPT;
    expect(() => caioMinimalAuditReceiptSchema.parse(withoutHash)).toThrow();
    expect(() =>
      caioMinimalAuditReceiptSchema.parse({
        ...VALID_RECEIPT,
        inputHash: "not-a-hash",
      }),
    ).toThrow();
  });

  // The receipt set is CLOSED and was widened DELIBERATELY, once, by the
  // owner ruling of 2026-07-30: a receipt that does not name its deployment
  // posture lets one posture's evidence pass as the other's.
  it("declares a closed SEVEN-field set including the deployment posture", () => {
    const parsed = caioMinimalAuditReceiptSchema.parse(VALID_RECEIPT);
    expect(Object.keys(parsed).sort()).toEqual([
      "client",
      "inputHash",
      "modelAlias",
      "policyVersion",
      "posture",
      "requestId",
      "workspace",
    ]);
  });

  it("refuses a receipt with no posture, or a posture outside the vocabulary", () => {
    const { posture: _posture, ...withoutPosture } = VALID_RECEIPT;
    expect(() =>
      caioMinimalAuditReceiptSchema.parse(withoutPosture),
    ).toThrow();
    expect(() =>
      caioMinimalAuditReceiptSchema.parse({
        ...VALID_RECEIPT,
        posture: "best_effort",
      }),
    ).toThrow();
    expect([...CAIO_DEPLOYMENT_POSTURES]).toEqual([
      "self_service",
      "governed_fde",
    ]);
  });

  // The digest is what binds stored content to a receipt identity, so a
  // receipt produced under one posture must NOT be readable as the other.
  it("makes the same dispatch under a different posture a different receipt", () => {
    const selfService = caioMinimalAuditReceiptSchema.parse(VALID_RECEIPT);
    const governed = caioMinimalAuditReceiptSchema.parse({
      ...VALID_RECEIPT,
      posture: "governed_fde",
    });
    expect(canonicalCaioReceiptPayload(selfService)).not.toBe(
      canonicalCaioReceiptPayload(governed),
    );
    expect(caioReceiptDigest(selfService)).not.toBe(
      caioReceiptDigest(governed),
    );
    // Positional encoding: the posture is the seventh position, in lockstep
    // with the schema above.
    expect(JSON.parse(canonicalCaioReceiptPayload(governed))[6]).toBe(
      "governed_fde",
    );
  });

  it("pins the 503 caio_audit_unavailable error contract", () => {
    expect(CAIO_AUDIT_UNAVAILABLE_HTTP_STATUS).toBe(503);
    expect(CAIO_AUDIT_UNAVAILABLE_ERROR_CODE).toBe("caio_audit_unavailable");
    expect(CAIO_AUDIT_RETRY_AFTER_HEADER).toBe("Retry-After");
  });
});
