import { describe, expect, it } from "vitest";
import { normalizePlatformOperation, type PlatformOperationRequest } from "./platform-operations";

const RULING = "owner-ruling:synthetic-1";
const mode = (fromMode: string, toMode: string, workspaceId = "ws-1") =>
  ({ kind: "billing_mode", workspaceId, fromMode, toMode }) as PlatformOperationRequest;

describe("platform operation normalization", () => {
  it("derives a stable key from ruling, kind, workspace and mode step; the hash also covers the subject", () => {
    const onboard = (contractSubjectRef: string) => normalizePlatformOperation(RULING,
      { kind: "payer_onboard", workspaceId: "ws-1", contractSubjectRef });
    expect(onboard("subject-a").operationKey).toBe(onboard("subject-b").operationKey);
    expect(onboard("subject-a").contentHash).not.toBe(onboard("subject-b").contentHash);
    expect(normalizePlatformOperation(RULING, mode("off", "enforce")).operationKey)
      .not.toBe(normalizePlatformOperation(RULING, mode("enforce", "off")).operationKey);
    expect(normalizePlatformOperation("owner-ruling:other", mode("off", "enforce")).operationKey)
      .not.toBe(normalizePlatformOperation(RULING, mode("off", "enforce")).operationKey);
  });
  it("accepts every step between distinct modes and refuses no-ops, unknown modes and non-ASCII refs", () => {
    for (const [from, to] of [["off", "shadow"], ["shadow", "enforce"], ["off", "enforce"], ["enforce", "off"], ["enforce", "shadow"]]) {
      expect(() => normalizePlatformOperation(RULING, mode(from, to))).not.toThrow();
    }
    for (const request of [mode("off", "off"), mode("off", "live"), mode("off", "shadow", "ws 1"),
      { kind: "payer_delete", workspaceId: "ws-1" } as unknown as PlatformOperationRequest]) {
      expect(() => normalizePlatformOperation(RULING, request)).toThrow("platform_operation_input_invalid");
    }
    expect(() => normalizePlatformOperation("规划", mode("off", "shadow"))).toThrow("platform_operation_input_invalid");
  });
});
