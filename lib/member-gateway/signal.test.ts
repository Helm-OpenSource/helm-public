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
  hashMemberWorkSignalPayload,
  validateMemberWorkSignalDraft,
} from "@/lib/member-gateway/signal";
import type {
  MemberWorkSignalDraft,
  MemberWorkSignalPayload,
  MemberWorkSignalReceipt,
} from "@/lib/member-gateway/signal";

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

function makePayload(
  overrides: Partial<MemberWorkSignalPayload> = {},
): MemberWorkSignalPayload {
  return {
    kind: "progress",
    summary: "客户已确认还款意向",
    detail: "电话沟通 20 分钟,确认周五前处理。",
    relatedEvidenceRefs: ["evidence-1"],
    ...overrides,
  };
}

function makeDraft(
  overrides: Partial<MemberWorkSignalDraft> = {},
): MemberWorkSignalDraft {
  return {
    principal: {
      workspaceRef: "workspace-1",
      memberRef: "member-1",
      sessionRef: "session-1",
      deviceRegistrationRef: "device-1",
      clientId: "workbuddy-desktop",
    },
    objectRef: "case-42",
    objectVersion: 3,
    payload: makePayload(),
    ...overrides,
  };
}

describe("validateMemberWorkSignalDraft", () => {
  it("accepts a complete draft", () => {
    expect(validateMemberWorkSignalDraft(makeDraft())).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("rejects principal gaps with the principal error codes", () => {
    const draft = makeDraft();
    draft.principal = { ...draft.principal, sessionRef: "" };
    expect(validateMemberWorkSignalDraft(draft).errors).toContain(
      "session_ref_missing",
    );
  });

  it("rejects unknown kind, missing summary, and bad object binding", () => {
    expect(
      validateMemberWorkSignalDraft(
        makeDraft({
          payload: makePayload({ kind: "gossip" as never, summary: " " }),
          objectRef: "",
          objectVersion: 0,
        }),
      ).errors,
    ).toEqual(
      expect.arrayContaining([
        "signal_kind_unknown",
        "signal_summary_missing",
        "signal_object_ref_missing",
        "signal_object_version_invalid",
      ]),
    );
  });

  it("enforces length, link, and evidence-ref limits", () => {
    const longSummary = "x".repeat(501);
    const longDetail = "y".repeat(4001);
    const linky = "见 https://a.example https://b.example";
    const linkyDetail = "https://c.example 与 https://d.example";
    expect(
      validateMemberWorkSignalDraft(
        makeDraft({ payload: makePayload({ summary: longSummary }) }),
      ).errors,
    ).toContain("signal_summary_too_long");
    expect(
      validateMemberWorkSignalDraft(
        makeDraft({ payload: makePayload({ detail: longDetail }) }),
      ).errors,
    ).toContain("signal_detail_too_long");
    expect(
      validateMemberWorkSignalDraft(
        makeDraft({
          payload: makePayload({ summary: linky, detail: linkyDetail }),
        }),
      ).errors,
    ).toContain("signal_links_exceeded");
    expect(
      validateMemberWorkSignalDraft(
        makeDraft({
          payload: makePayload({
            relatedEvidenceRefs: Array.from({ length: 11 }, (_, i) => `e-${i}`),
          }),
        }),
      ).errors,
    ).toContain("signal_evidence_refs_exceeded");
    expect(
      validateMemberWorkSignalDraft(
        makeDraft({ payload: makePayload({ relatedEvidenceRefs: [" "] }) }),
      ).errors,
    ).toContain("signal_evidence_ref_invalid");
  });
});

describe("hashMemberWorkSignalPayload", () => {
  it("is deterministic and content-sensitive", () => {
    expect(hashMemberWorkSignalPayload(makePayload())).toBe(
      hashMemberWorkSignalPayload(makePayload()),
    );
    expect(hashMemberWorkSignalPayload(makePayload())).not.toBe(
      hashMemberWorkSignalPayload(makePayload({ summary: "changed" })),
    );
  });
});
