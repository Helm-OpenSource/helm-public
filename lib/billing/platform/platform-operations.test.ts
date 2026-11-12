import { describe, expect, it } from "vitest";
import { parseOperationList, parsePlatformBatchArgs } from "./platform-batch";
import { normalizePlatformOperation, type PlatformOperationRequest } from "./platform-operations";

const RULING = "owner-ruling:synthetic-1";
const mode = (fromMode: string, toMode: string, workspaceId = "ws-1") =>
  ({ kind: "billing_mode", workspaceId, fromMode, toMode }) as PlatformOperationRequest;
const list = (value: unknown) => Buffer.from(JSON.stringify(value));

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

describe("operation list and arguments", () => {
  it("hashes the exact bytes and refuses extra fields, duplicates and empty lists", () => {
    const value = { evidenceRef: RULING, entries: [mode("off", "enforce"), mode("off", "enforce", "ws-2")] };
    const parsed = parseOperationList(list(value));
    expect(parsed.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(parseOperationList(Buffer.from(JSON.stringify(value, null, 2))).sha256).not.toBe(parsed.sha256);
    for (const bad of [{ ...value, note: "x" }, { evidenceRef: RULING, entries: [] },
      { evidenceRef: RULING, entries: [mode("off", "enforce"), mode("off", "enforce")] },
      { evidenceRef: RULING, entries: [{ ...mode("off", "enforce"), payerAccountId: "p" }] }, "{"]) {
      expect(() => parseOperationList(typeof bad === "string" ? Buffer.from(bad) : list(bad))).toThrow("platform_operation_input_invalid");
    }
  });
  it("is dry run unless --apply carries the list sha, and review needs a decision and evidence", () => {
    const base = ["--command=draft", "--list-file=l.json", "--actor-user-id=u1"];
    expect(parsePlatformBatchArgs(base)).toMatchObject({ apply: false, listSha: null, planSha: null, confirmEnforce: false });
    expect(parsePlatformBatchArgs([...base, "--apply"])).toEqual({ invalid: "apply_requires_list_and_plan_sha" });
    expect(parsePlatformBatchArgs([...base, "--apply", "--list-sha=ab"])).toEqual({ invalid: "apply_requires_list_and_plan_sha" });
    expect(parsePlatformBatchArgs([...base, "--apply", "--list-sha=ab", "--plan-sha=cd"])).toMatchObject({ apply: true, listSha: "ab", planSha: "cd" });
    expect(parsePlatformBatchArgs([...base, "--decision=approve"])).toEqual({ invalid: "review_arguments_invalid" });
    expect(parsePlatformBatchArgs([...base, "--force"])).toEqual({ invalid: "unknown_argument" });
    expect(parsePlatformBatchArgs([...base, "--apply", "--apply", "--list-sha=ab", "--plan-sha=cd"])).toEqual({ invalid: "duplicate_argument" });
    const review = ["--command=review", "--list-file=l.json", "--actor-user-id=u2"];
    expect(parsePlatformBatchArgs(review)).toEqual({ invalid: "review_arguments_invalid" });
    expect(parsePlatformBatchArgs([...review, "--decision=approve", "--review-evidence-ref=r1", "--confirm-enforce"]))
      .toMatchObject({ decision: "approve", reviewEvidenceRef: "r1", confirmEnforce: true });
  });
});
