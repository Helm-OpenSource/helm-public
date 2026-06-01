import { describe, expect, it } from "vitest";
import {
  __INTERNALS_FOR_TESTING_ONLY__,
  assessOperatingSignalQuality,
  gradeOperatingSignalQuality,
} from "./assess";
import {
  OPERATING_SIGNAL_QUALITY_SCORE_BOUNDS,
  type OperatingSignalQualityEvidence,
} from "./types";

const { gradeFromTotal, scoreNoisePenalty, scorePrInflationPenalty } =
  __INTERNALS_FOR_TESTING_ONLY__;

function buildEvidence(
  override: Partial<{
    delivery: Partial<OperatingSignalQualityEvidence["delivery"]>;
    signal: Partial<OperatingSignalQualityEvidence["signal"]>;
    readiness: Partial<OperatingSignalQualityEvidence["readiness"]>;
    collaboration: Partial<OperatingSignalQualityEvidence["collaboration"]>;
    noise: Partial<OperatingSignalQualityEvidence["noise"]>;
    prInflation: Partial<OperatingSignalQualityEvidence["prInflation"]>;
  }> = {},
): OperatingSignalQualityEvidence {
  return {
    delivery: {
      tenantUsable: false,
      customerCanTest: false,
      onlineVerified: false,
      operatingPushForward: false,
      ...override.delivery,
    },
    signal: {
      actionable: false,
      timely: false,
      accurate: false,
      leadsToReview: false,
      ...override.signal,
    },
    readiness: {
      envConfigured: false,
      cronOrTokenSet: false,
      dbMigrated: false,
      tenantEnabled: false,
      initialDataSeeded: false,
      ...override.readiness,
    },
    collaboration: {
      reducedBlockersForOthers: false,
      clearHandoff: false,
      teamSpeedUp: false,
      ...override.collaboration,
    },
    noise: {
      duplicateSignalCount: 0,
      misleadingSignalCount: 0,
      wrongAttributionCount: 0,
      invalidReportCount: 0,
      ...override.noise,
    },
    prInflation: {
      tinyNonCohesiveSliceCount: 0,
      repeatedNonProgressiveCommitCount: 0,
      commitsForCountSake: false,
      ...override.prInflation,
    },
  };
}

describe("assessOperatingSignalQuality", () => {
  it("gives a high-value grade when delivery + signal + readiness + collab all fire and there is no noise", () => {
    const evidence = buildEvidence({
      delivery: {
        tenantUsable: true,
        customerCanTest: true,
        onlineVerified: true,
        operatingPushForward: true,
      },
      signal: {
        actionable: true,
        timely: true,
        accurate: true,
        leadsToReview: true,
      },
      readiness: {
        envConfigured: true,
        cronOrTokenSet: true,
        dbMigrated: true,
        tenantEnabled: true,
        initialDataSeeded: true,
      },
      collaboration: {
        reducedBlockersForOthers: true,
        clearHandoff: true,
        teamSpeedUp: true,
      },
    });
    const result = assessOperatingSignalQuality({
      subject: { kind: "contributor", label: "Tommy" },
      evidence,
    });
    expect(result.scores.deliveryEffectScore).toBe(40);
    expect(result.scores.signalQualityScore).toBe(35);
    expect(result.scores.operationalReadinessScore).toBe(15);
    expect(result.scores.collaborationScore).toBe(10);
    expect(result.scores.noisePenalty).toBe(0);
    expect(result.scores.prInflationPenalty).toBe(0);
    expect(result.scores.totalScore).toBe(100);
    expect(result.grade).toBe("high_value");
    expect(result.positiveSignals.length).toBeGreaterThanOrEqual(8);
    expect(result.noiseFindings).toEqual([]);
    expect(result.recommendations).toEqual([
      "继续保持：信号、交付、上线准备、协同四象都已到位",
    ]);
  });

  it("downgrades to weak when delivery is missing even if collaboration is full", () => {
    const evidence = buildEvidence({
      collaboration: {
        reducedBlockersForOthers: true,
        clearHandoff: true,
        teamSpeedUp: true,
      },
      readiness: {
        envConfigured: true,
        cronOrTokenSet: true,
      },
    });
    const result = assessOperatingSignalQuality({
      subject: { kind: "delivery_batch", label: "Sprint-12" },
      evidence,
    });
    // delivery 0 + signal 0 + readiness 6 + collab 10 = 16 → weak
    expect(result.scores.deliveryEffectScore).toBe(0);
    expect(result.scores.totalScore).toBe(16);
    expect(result.grade).toBe("weak");
    expect(result.recommendations).toContain(
      "先让租户真正可用，再追加任何 polish",
    );
  });

  it("makes noise penalty heavy enough that high commit count cannot compensate", () => {
    // Even with FULL positive scores (100), heavy noise should drag down meaningfully.
    const evidence = buildEvidence({
      delivery: {
        tenantUsable: true,
        customerCanTest: true,
        onlineVerified: true,
        operatingPushForward: true,
      },
      signal: {
        actionable: true,
        timely: true,
        accurate: true,
        leadsToReview: true,
      },
      readiness: {
        envConfigured: true,
        cronOrTokenSet: true,
        dbMigrated: true,
        tenantEnabled: true,
        initialDataSeeded: true,
      },
      collaboration: {
        reducedBlockersForOthers: true,
        clearHandoff: true,
        teamSpeedUp: true,
      },
      noise: {
        duplicateSignalCount: 3,
        misleadingSignalCount: 4,
        wrongAttributionCount: 3,
        invalidReportCount: 4,
      },
    });
    const result = assessOperatingSignalQuality({
      subject: { kind: "contributor", label: "Bot-flooded contributor" },
      evidence,
    });
    expect(result.scores.noisePenalty).toBe(
      OPERATING_SIGNAL_QUALITY_SCORE_BOUNDS.noisePenaltyMin,
    );
    // total = 100 - 60 = 40 → "useful" cap. Confirms noise CAN cut a full positive score in half.
    expect(result.scores.totalScore).toBe(40);
    expect(result.grade).toBe("useful");
    expect(
      result.recommendations.some((line) => line.includes("先清噪声")),
    ).toBe(true);
  });

  it("flips to harmful when noise overwhelms even moderate positive scoring", () => {
    const evidence = buildEvidence({
      delivery: {
        tenantUsable: true,
        operatingPushForward: true,
      },
      signal: { actionable: true },
      noise: {
        misleadingSignalCount: 5,
        wrongAttributionCount: 3,
      },
    });
    const result = assessOperatingSignalQuality({
      subject: { kind: "data_source", label: "noisy-ingest" },
      evidence,
    });
    // delivery 20 + signal 9 + readiness 0 + collab 0 = 29. noise = clamp(-50 + -18, -60, 0) = -60.
    expect(result.scores.noisePenalty).toBe(-60);
    expect(result.scores.totalScore).toBeLessThan(0);
    expect(result.grade).toBe("harmful");
  });

  it("applies PR-inflation penalty independently and bounds at -20", () => {
    const evidence = buildEvidence({
      delivery: {
        tenantUsable: true,
        customerCanTest: true,
        onlineVerified: true,
        operatingPushForward: true,
      },
      prInflation: {
        tinyNonCohesiveSliceCount: 20, // -40 raw → cap to -20
        repeatedNonProgressiveCommitCount: 10, // additional -30 raw
        commitsForCountSake: true, // additional -8 raw
      },
    });
    const result = assessOperatingSignalQuality({
      subject: { kind: "contributor", label: "PR-flooder" },
      evidence,
    });
    expect(result.scores.prInflationPenalty).toBe(
      OPERATING_SIGNAL_QUALITY_SCORE_BOUNDS.prInflationPenaltyMin,
    );
    // delivery 40 - 20 = 20, grade = weak
    expect(result.scores.totalScore).toBe(20);
    expect(result.grade).toBe("weak");
    expect(
      result.recommendations.some((line) => line.includes("合并过小切片")),
    ).toBe(true);
  });

  it("rewards operational readiness explicitly (env/cron/migration/tenant/seed)", () => {
    const evidence = buildEvidence({
      readiness: {
        envConfigured: true,
        cronOrTokenSet: true,
        dbMigrated: true,
        tenantEnabled: true,
        initialDataSeeded: true,
      },
    });
    const result = assessOperatingSignalQuality({
      subject: { kind: "delivery_batch", label: "Tenant enablement batch" },
      evidence,
    });
    expect(result.scores.operationalReadinessScore).toBe(15);
    expect(result.readinessEvidence).toEqual(
      expect.arrayContaining([
        "env / secret 已配置",
        "cron / token 已落",
        "DB migration 已就绪",
        "租户 enablement 已开",
        "初始化 / seed 已落",
      ]),
    );
  });

  it("attributes the boundary fields so AI output stays attached to a human GitHub handle", () => {
    const result = assessOperatingSignalQuality({
      subject: {
        kind: "contributor",
        label: "Tommy",
        githubHandle: "hzqian2026",
      },
      evidence: buildEvidence(),
    });
    expect(result.boundary).toEqual({
      reservedOnly: true,
      notAPerformanceContractor: true,
      notAFinancialSettlementInput: true,
      aiOutputAttributedToHumanGithub: true,
    });
    expect(result.subject.githubHandle).toBe("hzqian2026");
  });

  it("clamps the total score to the documented bounds", () => {
    expect(gradeFromTotal(101)).toBe("high_value");
    expect(gradeFromTotal(70)).toBe("high_value");
    expect(gradeFromTotal(69.9)).toBe("useful");
    expect(gradeFromTotal(40)).toBe("useful");
    expect(gradeFromTotal(0)).toBe("weak");
    expect(gradeFromTotal(-1)).toBe("harmful");
  });

  it("ignores negative or NaN counts so callers cannot inflate noise underflow", () => {
    const penalty = scoreNoisePenalty({
      duplicateSignalCount: -5,
      misleadingSignalCount: Number.NaN,
      wrongAttributionCount: 2,
      invalidReportCount: 0,
    });
    expect(penalty).toBe(-12); // only wrongAttributionCount * -6 lands
    const prPenalty = scorePrInflationPenalty({
      tinyNonCohesiveSliceCount: -10,
      repeatedNonProgressiveCommitCount: 1,
      commitsForCountSake: false,
    });
    expect(prPenalty).toBe(-3);
  });

  it("exposes a grade-only helper for fast pipeline checks", () => {
    expect(
      gradeOperatingSignalQuality(
        buildEvidence({
          noise: { misleadingSignalCount: 6 },
        }),
      ),
    ).toBe("harmful");
  });
});
