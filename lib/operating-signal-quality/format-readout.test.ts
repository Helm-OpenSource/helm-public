import { describe, expect, it } from "vitest";
import { assessOperatingSignalQuality } from "./assess";
import {
  formatOperatingSignalQualityBoundaryFooter,
  formatOperatingSignalQualityDimensionLabel,
  formatOperatingSignalQualityGradeBadgeVariant,
  formatOperatingSignalQualityGradeLabel,
  formatOperatingSignalQualityReadoutHeadline,
  formatOperatingSignalQualitySubjectKindLabel,
} from "./display-copy";
import {
  formatOperatingSignalQualityReadout,
  formatOperatingSignalQualityReadoutAsMarkdown,
} from "./format-readout";
import type { OperatingSignalQualityEvidence } from "./types";

function emptyEvidence(): OperatingSignalQualityEvidence {
  return {
    delivery: {
      tenantUsable: false,
      customerCanTest: false,
      onlineVerified: false,
      operatingPushForward: false,
    },
    signal: {
      actionable: false,
      timely: false,
      accurate: false,
      leadsToReview: false,
    },
    readiness: {
      envConfigured: false,
      cronOrTokenSet: false,
      dbMigrated: false,
      tenantEnabled: false,
      initialDataSeeded: false,
    },
    collaboration: {
      reducedBlockersForOthers: false,
      clearHandoff: false,
      teamSpeedUp: false,
    },
    noise: {
      duplicateSignalCount: 0,
      misleadingSignalCount: 0,
      wrongAttributionCount: 0,
      invalidReportCount: 0,
    },
    prInflation: {
      tinyNonCohesiveSliceCount: 0,
      repeatedNonProgressiveCommitCount: 0,
      commitsForCountSake: false,
    },
  };
}

describe("display-copy", () => {
  it("returns bilingual labels for each grade", () => {
    expect(formatOperatingSignalQualityGradeLabel("high_value", false)).toBe(
      "高价值",
    );
    expect(formatOperatingSignalQualityGradeLabel("high_value", true)).toBe(
      "High value",
    );
    expect(formatOperatingSignalQualityGradeLabel("harmful", false)).toBe(
      "造成干扰",
    );
    expect(formatOperatingSignalQualityGradeLabel("harmful", true)).toBe(
      "Harmful",
    );
  });

  it("maps each grade to a stable badge variant", () => {
    expect(formatOperatingSignalQualityGradeBadgeVariant("high_value")).toBe(
      "success",
    );
    expect(formatOperatingSignalQualityGradeBadgeVariant("useful")).toBe(
      "approval",
    );
    expect(formatOperatingSignalQualityGradeBadgeVariant("weak")).toBe(
      "warning",
    );
    expect(formatOperatingSignalQualityGradeBadgeVariant("harmful")).toBe(
      "danger",
    );
  });

  it("labels each scoring dimension in both languages", () => {
    expect(formatOperatingSignalQualityDimensionLabel("delivery", false)).toBe(
      "交付效果",
    );
    expect(formatOperatingSignalQualityDimensionLabel("delivery", true)).toBe(
      "Delivery effect",
    );
    expect(formatOperatingSignalQualityDimensionLabel("noise", false)).toBe(
      "噪声惩罚",
    );
    expect(formatOperatingSignalQualityDimensionLabel("prInflation", true)).toBe(
      "PR inflation penalty",
    );
  });

  it("labels each subject kind in both languages", () => {
    expect(
      formatOperatingSignalQualitySubjectKindLabel("contributor", false),
    ).toBe("贡献者");
    expect(
      formatOperatingSignalQualitySubjectKindLabel("delivery_batch", true),
    ).toBe("Delivery batch");
  });

  it("produces a boundary footer reminding readers this is not a contract", () => {
    expect(formatOperatingSignalQualityBoundaryFooter(false)).toContain(
      "保留租户",
    );
    expect(formatOperatingSignalQualityBoundaryFooter(false)).toContain(
      "不是结算依据",
    );
    expect(formatOperatingSignalQualityBoundaryFooter(true)).toContain(
      "Reserved-tenant",
    );
    expect(formatOperatingSignalQualityBoundaryFooter(true)).toContain(
      "GitHub",
    );
  });

  it("includes a directional headline that warns when grade is harmful", () => {
    const harmful = formatOperatingSignalQualityReadoutHeadline(
      "harmful",
      false,
    );
    expect(harmful).toContain("干扰");
    expect(formatOperatingSignalQualityReadoutHeadline("harmful", true)).toContain(
      "Harmful",
    );
  });
});

describe("formatOperatingSignalQualityReadout", () => {
  it("renders a complete readout structure from an assessment", () => {
    const evidence = emptyEvidence();
    evidence.delivery.tenantUsable = true;
    evidence.delivery.customerCanTest = true;
    evidence.signal.actionable = true;
    evidence.signal.timely = true;
    evidence.readiness.envConfigured = true;
    evidence.collaboration.clearHandoff = true;
    const assessment = assessOperatingSignalQuality({
      subject: { kind: "delivery_batch", label: "Sprint-12" },
      evidence,
    });
    const readout = formatOperatingSignalQualityReadout({
      assessment,
      english: false,
    });
    expect(readout.subjectLabel).toBe("Sprint-12");
    expect(readout.subjectKindLabel).toBe("交付批次");
    expect(readout.gradeLabel).toBeTypeOf("string");
    expect(readout.gradeBadgeVariant).toBeTypeOf("string");
    expect(readout.totalScore).toBe(assessment.scores.totalScore);
    expect(readout.totalBound).toEqual({ min: -60, max: 100 });
    expect(readout.scoreLines).toHaveLength(6);
    expect(readout.scoreLines.map((line) => line.dimension)).toEqual([
      "delivery",
      "signal",
      "readiness",
      "collaboration",
      "noise",
      "prInflation",
    ]);
    expect(readout.boundaryFooter).toContain("保留租户");
  });

  it("marks noise / prInflation rows as negative tone only when actually negative", () => {
    const cleanAssessment = assessOperatingSignalQuality({
      subject: { kind: "contributor", label: "clean" },
      evidence: emptyEvidence(),
    });
    const cleanReadout = formatOperatingSignalQualityReadout({
      assessment: cleanAssessment,
      english: false,
    });
    const cleanNoiseLine = cleanReadout.scoreLines.find(
      (line) => line.dimension === "noise",
    );
    expect(cleanNoiseLine?.tone).toBe("neutral");

    const noisy = emptyEvidence();
    noisy.noise.misleadingSignalCount = 3;
    noisy.prInflation.tinyNonCohesiveSliceCount = 5;
    const noisyAssessment = assessOperatingSignalQuality({
      subject: { kind: "contributor", label: "noisy" },
      evidence: noisy,
    });
    const noisyReadout = formatOperatingSignalQualityReadout({
      assessment: noisyAssessment,
      english: false,
    });
    const noisyNoiseLine = noisyReadout.scoreLines.find(
      (line) => line.dimension === "noise",
    );
    const noisyInflationLine = noisyReadout.scoreLines.find(
      (line) => line.dimension === "prInflation",
    );
    expect(noisyNoiseLine?.tone).toBe("negative");
    expect(noisyInflationLine?.tone).toBe("negative");
  });
});

describe("formatOperatingSignalQualityReadoutAsMarkdown", () => {
  it("emits a markdown summary that callers can paste into DingTalk / Slack / brief", () => {
    const evidence = emptyEvidence();
    evidence.delivery.tenantUsable = true;
    evidence.delivery.operatingPushForward = true;
    evidence.signal.actionable = true;
    evidence.readiness.envConfigured = true;
    evidence.collaboration.clearHandoff = true;
    evidence.noise.duplicateSignalCount = 2;

    const assessment = assessOperatingSignalQuality({
      subject: { kind: "contributor", label: "Tommy" },
      evidence,
    });
    const markdown = formatOperatingSignalQualityReadoutAsMarkdown({
      assessment,
      english: false,
    });
    expect(markdown).toContain("### 经营信号质量评估");
    expect(markdown).toContain("贡献者");
    expect(markdown).toContain("Tommy");
    expect(markdown).toContain("**总分**");
    expect(markdown).toContain("正面信号");
    expect(markdown).toContain("噪声 / 干扰");
    expect(markdown).toContain("改进建议");
    expect(markdown).toContain("保留租户");
  });

  it("produces english output when english=true", () => {
    const assessment = assessOperatingSignalQuality({
      subject: { kind: "contributor", label: "Tommy" },
      evidence: emptyEvidence(),
    });
    const markdown = formatOperatingSignalQualityReadoutAsMarkdown({
      assessment,
      english: true,
    });
    expect(markdown).toContain("Operating Signal Quality");
    expect(markdown).toContain("**Grade**");
    expect(markdown).toContain("Reserved-tenant");
  });
});
