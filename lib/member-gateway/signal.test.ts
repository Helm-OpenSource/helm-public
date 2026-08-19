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
  judgeMemberWorkSignalChallenge,
  judgeMemberWorkSignalSubmission,
  judgeSupersedingSignalReceipt,
  validateMemberWorkSignalDraft,
} from "@/lib/member-gateway/signal";
import type {
  MemberWorkSignalChallenge,
  MemberWorkSignalDraft,
  MemberWorkSignalPayload,
  MemberWorkSignalReceipt,
  MemberWorkSignalSubmission,
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

  it("counts links case-insensitively", () => {
    expect(
      validateMemberWorkSignalDraft(
        makeDraft({
          payload: makePayload({
            summary: "HTTP://a HTTPS://b Http://c https://d",
          }),
        }),
      ).errors,
    ).toContain("signal_links_exceeded");
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

function makeChallenge(
  overrides: Partial<MemberWorkSignalChallenge> = {},
): MemberWorkSignalChallenge {
  return {
    challengeRef: "challenge-1",
    workspaceRef: "workspace-1",
    memberRef: "member-1",
    objectRef: "case-42",
    objectVersion: 3,
    payloadHash: hashMemberWorkSignalPayload(makePayload()),
    issuedAt: "2026-08-19T00:00:00Z",
    expiresAt: "2026-08-19T00:04:00Z",
    ...overrides,
  };
}

function makeSubmission(
  overrides: Partial<MemberWorkSignalSubmission> = {},
): MemberWorkSignalSubmission {
  return {
    challenge: makeChallenge(),
    principal: makeDraft().principal,
    payload: makePayload(),
    surface: { allowed: true, deniedDimensions: [] },
    submittedAt: "2026-08-19T00:01:00Z",
    priorConsumptionRef: null,
    ...overrides,
  };
}

describe("judgeMemberWorkSignalChallenge", () => {
  it("accepts a well-formed challenge", () => {
    expect(judgeMemberWorkSignalChallenge(makeChallenge())).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("rejects lax instants, inverted windows, and over-cap TTL", () => {
    expect(
      judgeMemberWorkSignalChallenge(makeChallenge({ issuedAt: "2026" }))
        .errors,
    ).toContain("challenge_instant_invalid");
    expect(
      judgeMemberWorkSignalChallenge(
        makeChallenge({ expiresAt: "2026-08-18T23:59:00Z" }),
      ).errors,
    ).toContain("challenge_window_invalid");
    expect(
      judgeMemberWorkSignalChallenge(
        makeChallenge({ expiresAt: "2026-08-19T00:06:00Z" }),
      ).errors,
    ).toContain("challenge_ttl_exceeds_cap");
  });

  it("rejects missing binding refs", () => {
    expect(
      judgeMemberWorkSignalChallenge(
        makeChallenge({
          challengeRef: "",
          payloadHash: " ",
          workspaceRef: "",
          objectRef: " ",
          objectVersion: 0,
        }),
      ).errors,
    ).toEqual(
      expect.arrayContaining([
        "challenge_ref_missing",
        "challenge_payload_hash_missing",
        "challenge_principal_binding_missing",
        "challenge_object_binding_missing",
        "challenge_object_version_invalid",
      ]),
    );
  });
});

describe("judgeMemberWorkSignalSubmission", () => {
  it("accepts a bound, in-window, unconsumed, authorized submission", () => {
    expect(judgeMemberWorkSignalSubmission(makeSubmission())).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("rejects binding mismatches", () => {
    const sub = makeSubmission();
    sub.principal = { ...sub.principal, memberRef: "member-2" };
    expect(judgeMemberWorkSignalSubmission(sub).errors).toContain(
      "challenge_binding_mismatch",
    );
  });

  it("rejects payload drift after prepare", () => {
    expect(
      judgeMemberWorkSignalSubmission(
        makeSubmission({ payload: makePayload({ summary: "改过了" }) }),
      ).errors,
    ).toContain("challenge_payload_hash_mismatch");
  });

  it("rejects expiry, pre-issue submission, and reuse", () => {
    expect(
      judgeMemberWorkSignalSubmission(
        makeSubmission({ submittedAt: "2026-08-19T00:05:00Z" }),
      ).errors,
    ).toContain("challenge_expired");
    expect(
      judgeMemberWorkSignalSubmission(
        makeSubmission({ submittedAt: "2026-08-18T23:59:59Z" }),
      ).errors,
    ).toContain("submission_before_issue");
    expect(
      judgeMemberWorkSignalSubmission(
        makeSubmission({ priorConsumptionRef: "consumption-1" }),
      ).errors,
    ).toContain("challenge_already_consumed");
  });

  it("rejects signals about objects outside the member read surface", () => {
    expect(
      judgeMemberWorkSignalSubmission(
        makeSubmission({
          surface: { allowed: false, deniedDimensions: ["tool_scope"] },
        }),
      ).errors,
    ).toContain("signal_object_not_authorized");
  });

  it("merges draft content violations", () => {
    expect(
      judgeMemberWorkSignalSubmission(
        makeSubmission({
          payload: makePayload({ summary: "" }),
        }),
      ).errors,
    ).toEqual(
      expect.arrayContaining([
        "signal_summary_missing",
        "challenge_payload_hash_mismatch",
      ]),
    );
  });

  it("rejects an unparseable submission instant", () => {
    expect(
      judgeMemberWorkSignalSubmission(
        makeSubmission({ submittedAt: "not-a-time" }),
      ).errors,
    ).toContain("submission_instant_invalid");
  });

  it("pins the window boundary instants", () => {
    expect(
      judgeMemberWorkSignalSubmission(
        makeSubmission({ submittedAt: "2026-08-19T00:00:00Z" }),
      ).valid,
    ).toBe(true);
    expect(
      judgeMemberWorkSignalSubmission(
        makeSubmission({ submittedAt: "2026-08-19T00:04:00Z" }),
      ).errors,
    ).toContain("challenge_expired");
    expect(
      judgeMemberWorkSignalChallenge(
        makeChallenge({ expiresAt: "2026-08-19T00:05:00Z" }),
      ).valid,
    ).toBe(true);
  });
});

function makeReceipt(
  overrides: Partial<MemberWorkSignalReceipt> = {},
): MemberWorkSignalReceipt {
  return {
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
    submittedAt: "2026-08-19T00:01:00Z",
    candidate: true,
    taint: "untrusted",
    supersedesReceiptRef: null,
    ...overrides,
  };
}

describe("judgeSupersedingSignalReceipt", () => {
  const prior = makeReceipt();
  const next = makeReceipt({
    receiptId: "receipt-2",
    supersedesReceiptRef: "receipt-1",
    submittedAt: "2026-08-19T00:10:00Z",
  });

  it("accepts a well-formed correction", () => {
    expect(
      judgeSupersedingSignalReceipt({
        prior,
        next,
        priorAlreadySupersededBy: null,
      }),
    ).toEqual({ valid: true, errors: [] });
  });

  it("rejects ref mismatch, scope mismatch, and double supersede", () => {
    expect(
      judgeSupersedingSignalReceipt({
        prior,
        next: { ...next, supersedesReceiptRef: "receipt-9" },
        priorAlreadySupersededBy: null,
      }).errors,
    ).toContain("supersedes_ref_mismatch");
    expect(
      judgeSupersedingSignalReceipt({
        prior,
        next: { ...next, memberRef: "member-2" },
        priorAlreadySupersededBy: null,
      }).errors,
    ).toContain("supersedes_scope_mismatch");
    expect(
      judgeSupersedingSignalReceipt({
        prior,
        next,
        priorAlreadySupersededBy: "receipt-8",
      }).errors,
    ).toContain("receipt_already_superseded");
  });

  it("rejects corrections that do not move forward in time", () => {
    expect(
      judgeSupersedingSignalReceipt({
        prior,
        next: { ...next, submittedAt: "2026-08-19T00:01:00Z" },
        priorAlreadySupersededBy: null,
      }).errors,
    ).toContain("supersedes_order_invalid");
  });

  it("rejects self-supersede", () => {
    expect(
      judgeSupersedingSignalReceipt({
        prior,
        next: { ...prior, supersedesReceiptRef: "receipt-1" },
        priorAlreadySupersededBy: null,
      }).errors,
    ).toContain("supersedes_self_reference");
  });
});
