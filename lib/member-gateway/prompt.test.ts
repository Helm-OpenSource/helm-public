// lib/member-gateway/prompt.test.ts
import { describe, expect, it } from "vitest";

import {
  MEMBER_PROMPT_SEVERITIES,
  MEMBER_PROMPT_STATES,
  MEMBER_RESPONSE_CLASSES,
  MEMBER_TRUST_TIERS,
  decideMemberPromptDelivery,
  validateMemberPrompt,
} from "@/lib/member-gateway/prompt";
import type {
  MemberPrompt,
  MemberPromptDeliveryContext,
} from "@/lib/member-gateway/prompt";

describe("member prompt frozen literals", () => {
  it("freezes the two severities", () => {
    expect(MEMBER_PROMPT_SEVERITIES).toEqual(["critical", "normal"]);
  });

  it("freezes the seven lifecycle states", () => {
    expect(MEMBER_PROMPT_STATES).toEqual([
      "pending",
      "delivered",
      "snoozed",
      "responded",
      "withdrawn",
      "expired",
      "suppressed",
    ]);
  });

  it("freezes the four response write classes", () => {
    expect(MEMBER_RESPONSE_CLASSES).toEqual([
      "candidate_write",
      "interaction_receipt",
      "protected_human_response",
      "authority_bearing_action",
    ]);
  });

  it("freezes the four trust tiers", () => {
    expect(MEMBER_TRUST_TIERS).toEqual([
      "read",
      "challenge_write",
      "protected_response",
      "authority_action",
    ]);
  });
});

function makePrompt(overrides: Partial<MemberPrompt> = {}): MemberPrompt {
  return {
    promptRef: "prompt-1",
    workspaceRef: "workspace-1",
    memberRef: "member-1",
    severity: "normal",
    severityRuleRef: null,
    subjectObjectRef: "case-42",
    projectedSummary: "客户已确认还款意向,需要复核。",
    evidenceRefs: ["evidence-1"],
    issuedAt: "2026-08-19T00:00:00Z",
    expiresAt: "2026-08-19T00:05:00Z",
    ...overrides,
  };
}

describe("validateMemberPrompt", () => {
  it("accepts a well-formed normal prompt with no rule ref", () => {
    expect(validateMemberPrompt(makePrompt())).toEqual({
      valid: true,
      errors: [],
    });
  });

  it("accepts a normal prompt that also carries a rule ref", () => {
    expect(
      validateMemberPrompt(makePrompt({ severityRuleRef: "rule-1" })),
    ).toEqual({ valid: true, errors: [] });
  });

  it("accepts a critical prompt backed by a deterministic rule", () => {
    expect(
      validateMemberPrompt(
        makePrompt({ severity: "critical", severityRuleRef: "rule-1" }),
      ),
    ).toEqual({ valid: true, errors: [] });
  });

  it("rejects a missing prompt ref", () => {
    expect(validateMemberPrompt(makePrompt({ promptRef: "" })).errors).toContain(
      "prompt_ref_missing",
    );
  });

  it("rejects missing principal binding", () => {
    expect(
      validateMemberPrompt(makePrompt({ workspaceRef: "" })).errors,
    ).toContain("prompt_principal_binding_missing");
    expect(
      validateMemberPrompt(makePrompt({ memberRef: " " })).errors,
    ).toContain("prompt_principal_binding_missing");
  });

  it("rejects a missing subject object ref", () => {
    expect(
      validateMemberPrompt(makePrompt({ subjectObjectRef: "" })).errors,
    ).toContain("prompt_subject_missing");
  });

  it("rejects a missing projected summary", () => {
    expect(
      validateMemberPrompt(makePrompt({ projectedSummary: " " })).errors,
    ).toContain("prompt_summary_missing");
  });

  it("rejects unparseable instants", () => {
    expect(
      validateMemberPrompt(makePrompt({ issuedAt: "not-a-time" })).errors,
    ).toContain("prompt_instant_invalid");
    expect(
      validateMemberPrompt(makePrompt({ expiresAt: "2026" })).errors,
    ).toContain("prompt_instant_invalid");
  });

  it("rejects an inverted or zero-width window", () => {
    expect(
      validateMemberPrompt(
        makePrompt({ expiresAt: "2026-08-18T23:59:00Z" }),
      ).errors,
    ).toContain("prompt_window_invalid");
    expect(
      validateMemberPrompt(
        makePrompt({ expiresAt: "2026-08-19T00:00:00Z" }),
      ).errors,
    ).toContain("prompt_window_invalid");
  });

  it("rejects critical severity without a deterministic rule ref", () => {
    expect(
      validateMemberPrompt(
        makePrompt({ severity: "critical", severityRuleRef: null }),
      ).errors,
    ).toContain("critical_severity_without_rule");
    expect(
      validateMemberPrompt(
        makePrompt({ severity: "critical", severityRuleRef: " " }),
      ).errors,
    ).toContain("critical_severity_without_rule");
  });

  it("rejects any blank evidence ref", () => {
    expect(
      validateMemberPrompt(makePrompt({ evidenceRefs: ["evidence-1", " "] }))
        .errors,
    ).toContain("prompt_evidence_ref_invalid");
  });
});

function makeCtx(
  overrides: Partial<MemberPromptDeliveryContext> = {},
): MemberPromptDeliveryContext {
  return {
    now: "2026-08-19T00:01:00Z",
    inQuietHours: false,
    doNotDisturb: false,
    ...overrides,
  };
}

describe("decideMemberPromptDelivery", () => {
  it("delivers a normal prompt outside quiet hours and DND", () => {
    expect(decideMemberPromptDelivery(makePrompt(), makeCtx())).toEqual({
      deliver: true,
      heldReason: null,
    });
  });

  it("holds as expired when now is unparseable", () => {
    expect(
      decideMemberPromptDelivery(makePrompt(), makeCtx({ now: "bad" })),
    ).toEqual({ deliver: false, heldReason: "prompt_expired" });
  });

  it("holds as expired when now is at or past expiresAt", () => {
    expect(
      decideMemberPromptDelivery(
        makePrompt(),
        makeCtx({ now: "2026-08-19T00:05:00Z" }),
      ),
    ).toEqual({ deliver: false, heldReason: "prompt_expired" });
    expect(
      decideMemberPromptDelivery(
        makePrompt(),
        makeCtx({ now: "2026-08-19T00:06:00Z" }),
      ),
    ).toEqual({ deliver: false, heldReason: "prompt_expired" });
  });

  it("holds a normal prompt in quiet hours", () => {
    expect(
      decideMemberPromptDelivery(makePrompt(), makeCtx({ inQuietHours: true })),
    ).toEqual({ deliver: false, heldReason: "held_quiet_hours" });
  });

  it("holds a normal prompt under do-not-disturb", () => {
    expect(
      decideMemberPromptDelivery(makePrompt(), makeCtx({ doNotDisturb: true })),
    ).toEqual({ deliver: false, heldReason: "held_do_not_disturb" });
  });

  it("delivers a critical prompt through quiet hours", () => {
    const critical = makePrompt({
      severity: "critical",
      severityRuleRef: "rule-1",
    });
    expect(
      decideMemberPromptDelivery(critical, makeCtx({ inQuietHours: true })),
    ).toEqual({ deliver: true, heldReason: null });
  });

  it("delivers a critical prompt through do-not-disturb", () => {
    const critical = makePrompt({
      severity: "critical",
      severityRuleRef: "rule-1",
    });
    expect(
      decideMemberPromptDelivery(critical, makeCtx({ doNotDisturb: true })),
    ).toEqual({ deliver: true, heldReason: null });
  });

  it("delivers a critical prompt through both quiet hours and DND at once", () => {
    const critical = makePrompt({
      severity: "critical",
      severityRuleRef: "rule-1",
    });
    expect(
      decideMemberPromptDelivery(
        critical,
        makeCtx({ inQuietHours: true, doNotDisturb: true }),
      ),
    ).toEqual({ deliver: true, heldReason: null });
  });

  it("still holds a critical prompt as expired past its window", () => {
    const critical = makePrompt({
      severity: "critical",
      severityRuleRef: "rule-1",
    });
    expect(
      decideMemberPromptDelivery(
        critical,
        makeCtx({ now: "2026-08-19T00:05:00Z" }),
      ),
    ).toEqual({ deliver: false, heldReason: "prompt_expired" });
  });
});

