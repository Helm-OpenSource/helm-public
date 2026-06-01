import { describe, expect, it } from "vitest";
import { __testOnly } from "@/lib/bi-report-skill/feedback-memory";

describe("bi report feedback memory note compatibility", () => {
  it("keeps legacy plain-text notes readable", () => {
    expect(__testOnly.parseStructuredFeedbackNote("人工复盘确认")).toEqual({
      note: "人工复盘确认",
      isFalsePositive: null,
      actionEffective: null,
      needsRuleAdjustment: null,
    });
  });

  it("encodes and decodes structured feedback signals inside the note payload", () => {
    const encoded = __testOnly.buildStructuredFeedbackNote({
      note: "建议下调阈值",
      isFalsePositive: true,
      actionEffective: false,
      needsRuleAdjustment: true,
    });

    expect(__testOnly.parseStructuredFeedbackNote(encoded)).toEqual({
      note: "建议下调阈值",
      isFalsePositive: true,
      actionEffective: false,
      needsRuleAdjustment: true,
    });
  });
});
