import { describe, expect, it } from "vitest";

import {
  CAIO_AUDIT_GATE_STATES,
  CAIO_AUDIT_RETRY_AFTER_HEADER,
  CAIO_AUDIT_UNAVAILABLE_ERROR_CODE,
  CAIO_AUDIT_UNAVAILABLE_HTTP_STATUS,
  caioAuditGateStateSchema,
  caioMinimalAuditReceiptSchema,
} from "@/lib/caio-audit-state/audit-state-contracts";

const VALID_RECEIPT = {
  requestId: "req-0001",
  client: "workbuddy",
  workspace: "ws-audit-contract",
  modelAlias: "caio-default",
  inputHash: `sha256:${"a".repeat(64)}`,
  policyVersion: "policy-v3",
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

  it("pins the 503 caio_audit_unavailable error contract", () => {
    expect(CAIO_AUDIT_UNAVAILABLE_HTTP_STATUS).toBe(503);
    expect(CAIO_AUDIT_UNAVAILABLE_ERROR_CODE).toBe("caio_audit_unavailable");
    expect(CAIO_AUDIT_RETRY_AFTER_HEADER).toBe("Retry-After");
  });
});
