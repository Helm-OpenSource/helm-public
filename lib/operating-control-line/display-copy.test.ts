import { describe, expect, it } from "vitest";
import {
  formatControlLineStatusBadgeVariant,
  formatControlLineStatusLabel,
  formatControlLineTemplateLabel,
  formatEvidenceReadinessBadgeVariant,
  formatEvidenceReadinessLabel,
} from "./display-copy";

describe("control line template labels", () => {
  it("returns bilingual variants", () => {
    expect(formatControlLineTemplateLabel("LEAD_FOLLOW_UP", false)).toBe(
      "线索跟进控制线",
    );
    expect(formatControlLineTemplateLabel("LEAD_FOLLOW_UP", true)).toBe(
      "Lead follow-up",
    );
    expect(formatControlLineTemplateLabel("OTHER", false)).toBe("其他");
  });
});

describe("evidence readiness labels + badge variants", () => {
  it("emits explicit hypothesis hint for DECLARED", () => {
    expect(formatEvidenceReadinessLabel("DECLARED", true)).toContain(
      "hypothesis",
    );
    expect(formatEvidenceReadinessLabel("DECLARED", false)).toContain(
      "待证实",
    );
  });

  it("badge variants: DECLARED neutral → VERIFIED success", () => {
    expect(formatEvidenceReadinessBadgeVariant("DECLARED")).toBe("neutral");
    expect(formatEvidenceReadinessBadgeVariant("PARTIAL")).toBe("warning");
    expect(formatEvidenceReadinessBadgeVariant("READY")).toBe("approval");
    expect(formatEvidenceReadinessBadgeVariant("VERIFIED")).toBe("success");
  });
});

describe("control line status labels + badge variants", () => {
  it("returns bilingual labels", () => {
    expect(formatControlLineStatusLabel("EVIDENCE_NEEDED", false)).toBe(
      "需补证据",
    );
    expect(formatControlLineStatusLabel("TRIAL_PREMISE", true)).toBe(
      "Trial premise accepted",
    );
    expect(formatControlLineStatusLabel("REJECTED", false)).toBe("已拒绝");
  });

  it("EVIDENCE_NEEDED is warning, REVIEW_REQUIRED is approval", () => {
    expect(formatControlLineStatusBadgeVariant("EVIDENCE_NEEDED")).toBe(
      "warning",
    );
    expect(formatControlLineStatusBadgeVariant("REVIEW_REQUIRED")).toBe(
      "approval",
    );
  });

  it("TRIAL_PREMISE is success and REJECTED is danger", () => {
    expect(formatControlLineStatusBadgeVariant("TRIAL_PREMISE")).toBe("success");
    expect(formatControlLineStatusBadgeVariant("REJECTED")).toBe("danger");
  });
});
