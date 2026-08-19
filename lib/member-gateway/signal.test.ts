// lib/member-gateway/signal.test.ts
import { describe, expect, it } from "vitest";

import {
  MEMBER_SIGNAL_CHALLENGE_TTL_CAP_MS,
  MEMBER_SIGNAL_DETAIL_MAX_CHARS,
  MEMBER_SIGNAL_MAX_EVIDENCE_REFS,
  MEMBER_SIGNAL_MAX_LINKS,
  MEMBER_SIGNAL_SUMMARY_MAX_CHARS,
  MEMBER_SIGNAL_TAINT,
  MEMBER_WORK_SIGNAL_KINDS,
} from "@/lib/member-gateway/signal";
import type { MemberWorkSignalReceipt } from "@/lib/member-gateway/signal";

describe("member work signal frozen literals", () => {
  it("freezes the three signal kinds", () => {
    expect(MEMBER_WORK_SIGNAL_KINDS).toEqual([
      "progress",
      "blocker",
      "customer_signal",
    ]);
  });

  it("freezes taint and limits", () => {
    expect(MEMBER_SIGNAL_TAINT).toBe("untrusted");
    expect(MEMBER_SIGNAL_SUMMARY_MAX_CHARS).toBe(500);
    expect(MEMBER_SIGNAL_DETAIL_MAX_CHARS).toBe(4000);
    expect(MEMBER_SIGNAL_MAX_LINKS).toBe(3);
    expect(MEMBER_SIGNAL_MAX_EVIDENCE_REFS).toBe(10);
    expect(MEMBER_SIGNAL_CHALLENGE_TTL_CAP_MS).toBe(5 * 60_000);
  });

  it("a receipt is structurally candidate and untrusted", () => {
    const receipt: MemberWorkSignalReceipt = {
      receiptId: "receipt-1",
      workspaceRef: "workspace-1",
      memberRef: "member-1",
      deviceRegistrationRef: "device-1",
      clientId: "workbuddy-desktop",
      objectRef: "case-42",
      objectVersion: 3,
      kind: "progress",
      payloadHash: "hash-1",
      policyRef: "signal-policy-1",
      policyVersion: 1,
      submittedAt: "2026-08-19T00:00:00Z",
      candidate: true,
      taint: "untrusted",
      supersedesReceiptRef: null,
    };
    expect(receipt.candidate).toBe(true);
    expect(receipt.taint).toBe("untrusted");
  });
});
