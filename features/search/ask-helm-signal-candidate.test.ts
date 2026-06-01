import { describe, expect, it } from "vitest";
import {
  ASK_HELM_SIGNAL_BOUNDARY_NOTE,
  ASK_HELM_SIGNAL_CANDIDATE_ACTION_TYPE,
  ASK_HELM_SIGNAL_CANDIDATE_TARGET_TYPE,
  AskHelmSignalCandidateError,
  buildAskHelmSignalCandidatePayload,
  normalizeAskHelmSignalType,
  normalizeAskHelmSignalUrgency,
  redactAskHelmSignalText,
} from "@/features/search/ask-helm-signal-candidate";

describe("redactAskHelmSignalText", () => {
  it("masks email addresses inside free text", () => {
    const redacted = redactAskHelmSignalText(
      "客户对接人 Vivian (vivian.zhao@example.com) 反馈交付有阻塞",
    );
    expect(redacted).not.toContain("vivian.zhao@example.com");
    expect(redacted).toContain("[redacted-email]");
  });

  it("masks mainland mobile numbers and international phones", () => {
    const redacted = redactAskHelmSignalText(
      "客户电话 13800001111 / 海外联系 +1 415-555-7788 都已尝试",
    );
    expect(redacted).not.toContain("13800001111");
    expect(redacted).not.toContain("415-555-7788");
    expect(redacted).toContain("[redacted-phone]");
  });

  it("masks dashed landline numbers", () => {
    const redacted = redactAskHelmSignalText("总机 010-12345678 没人接");
    expect(redacted).not.toContain("010-12345678");
    expect(redacted).toContain("[redacted-phone]");
  });

  it("returns an empty string for nullish input", () => {
    expect(redactAskHelmSignalText(null)).toBe("");
    expect(redactAskHelmSignalText(undefined)).toBe("");
  });
});

describe("normalizeAskHelmSignalType", () => {
  it("accepts known signal types case-insensitively", () => {
    expect(normalizeAskHelmSignalType("RISK")).toBe("risk");
    expect(normalizeAskHelmSignalType("blocker")).toBe("blocker");
    expect(normalizeAskHelmSignalType("customer_waiting")).toBe("customer_waiting");
    expect(normalizeAskHelmSignalType("internal_handoff")).toBe("internal_handoff");
  });

  it("falls back to 'other' for unknown or non-string input", () => {
    expect(normalizeAskHelmSignalType("random_text")).toBe("other");
    expect(normalizeAskHelmSignalType("<script>")).toBe("other");
    expect(normalizeAskHelmSignalType(undefined)).toBe("other");
    expect(normalizeAskHelmSignalType(123)).toBe("other");
  });
});

describe("normalizeAskHelmSignalUrgency", () => {
  it("accepts known urgencies case-insensitively", () => {
    expect(normalizeAskHelmSignalUrgency("HIGH")).toBe("high");
    expect(normalizeAskHelmSignalUrgency("critical")).toBe("critical");
  });

  it("falls back to 'normal' for unknown or non-string input", () => {
    expect(normalizeAskHelmSignalUrgency("urgent-now")).toBe("normal");
    expect(normalizeAskHelmSignalUrgency(null)).toBe("normal");
    expect(normalizeAskHelmSignalUrgency(42)).toBe("normal");
  });
});

describe("buildAskHelmSignalCandidatePayload", () => {
  const baseInput = {
    workspaceId: "workspace_demo",
    createdByUserId: "user_demo",
    sourceQuery: "客户最近沉默，是不是有风险",
    summary: "客户 Vivian 反映交付延期，需要复核",
    signalType: "risk",
    urgency: "high",
    evidenceNote: "上次会议纪要见 meeting:abc",
  } as const;

  it("emits review_required posture, ask_helm source and the canonical boundary note", () => {
    const payload = buildAskHelmSignalCandidatePayload(baseInput);
    expect(payload.source).toBe("ask_helm");
    expect(payload.reviewPosture).toBe("review_required");
    expect(payload.boundaryNote).toBe(ASK_HELM_SIGNAL_BOUNDARY_NOTE);
    expect(payload.boundaryNote).toMatch(/不会自动外发/);
    expect(payload.boundaryNote).toMatch(/不会自动承诺/);
    expect(payload.boundaryNote).toMatch(/不会自动生成 Must Push/);
    expect(payload.workspaceId).toBe("workspace_demo");
    expect(payload.createdByUserId).toBe("user_demo");
  });

  it("never lets raw email or phone PII leak into summary, evidenceNote or sourceQuery", () => {
    const payload = buildAskHelmSignalCandidatePayload({
      ...baseInput,
      sourceQuery: "联系电话 13800009999 / vivian.zhao@example.com 等回复",
      summary:
        "Vivian (vivian.zhao@example.com) 13800009999 提到合同条款卡住",
      evidenceNote:
        "邮件证据: support@vendor.io / 客服电话 +86 010-12345678 没接通",
    });

    expect(payload.summary).not.toContain("vivian.zhao@example.com");
    expect(payload.summary).not.toContain("13800009999");
    expect(payload.summary).toContain("[redacted-email]");
    expect(payload.summary).toContain("[redacted-phone]");

    expect(payload.evidenceNote).not.toContain("support@vendor.io");
    expect(payload.evidenceNote).not.toContain("010-12345678");
    expect(payload.evidenceNote).toContain("[redacted-email]");
    expect(payload.evidenceNote).toContain("[redacted-phone]");

    expect(payload.sourceQuery).not.toContain("13800009999");
    expect(payload.sourceQuery).not.toContain("vivian.zhao@example.com");
  });

  it("normalizes invalid signalType to 'other' and invalid urgency to 'normal'", () => {
    const payload = buildAskHelmSignalCandidatePayload({
      ...baseInput,
      signalType: "<inject>not-a-type</inject>",
      urgency: "extreme",
    });
    expect(payload.signalType).toBe("other");
    expect(payload.urgency).toBe("normal");
  });

  it("attaches relatedObject only when both type and id are valid", () => {
    const valid = buildAskHelmSignalCandidatePayload({
      ...baseInput,
      relatedObject: { type: "opportunity", id: "opp_123" },
    });
    expect(valid.relatedObject).toEqual({ type: "opportunity", id: "opp_123" });

    const invalidType = buildAskHelmSignalCandidatePayload({
      ...baseInput,
      relatedObject: { type: "spaceship", id: "opp_123" },
    });
    expect(invalidType.relatedObject).toBeUndefined();

    const missingId = buildAskHelmSignalCandidatePayload({
      ...baseInput,
      relatedObject: { type: "opportunity", id: "  " },
    });
    expect(missingId.relatedObject).toBeUndefined();
  });

  it("throws AskHelmSignalCandidateError when summary is blank", () => {
    expect(() =>
      buildAskHelmSignalCandidatePayload({
        ...baseInput,
        summary: "   ",
      }),
    ).toThrowError(AskHelmSignalCandidateError);
  });

  it("exposes stable audit constants so the action and the audit query agree", () => {
    expect(ASK_HELM_SIGNAL_CANDIDATE_TARGET_TYPE).toBe("AskHelmSignalCandidate");
    expect(ASK_HELM_SIGNAL_CANDIDATE_ACTION_TYPE).toBe(
      "ASK_HELM_SIGNAL_CANDIDATE_SUBMITTED",
    );
  });
});
