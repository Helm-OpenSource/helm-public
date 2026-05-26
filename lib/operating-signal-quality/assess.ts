import {
  OPERATING_SIGNAL_QUALITY_SCORE_BOUNDS,
  type OperatingSignalQualityAssessment,
  type OperatingSignalQualityCollaborationEvidence,
  type OperatingSignalQualityDeliveryEvidence,
  type OperatingSignalQualityEvidence,
  type OperatingSignalQualityGrade,
  type OperatingSignalQualityNoiseFindings,
  type OperatingSignalQualityPrInflationFindings,
  type OperatingSignalQualityReadinessEvidence,
  type OperatingSignalQualityScoreBreakdown,
  type OperatingSignalQualitySignalEvidence,
  type OperatingSignalQualitySubject,
} from "./types";

const BOUNDS = OPERATING_SIGNAL_QUALITY_SCORE_BOUNDS;

function clamp(value: number, min: number, max: number) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

function clampNonNegativeCount(value: number) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

function scoreDelivery(input: OperatingSignalQualityDeliveryEvidence) {
  // 4 项布尔证据，每项 10，合计 0..40。
  let score = 0;
  if (input.tenantUsable) score += 10;
  if (input.customerCanTest) score += 10;
  if (input.onlineVerified) score += 10;
  if (input.operatingPushForward) score += 10;
  return clamp(score, 0, BOUNDS.deliveryMax);
}

function scoreSignal(input: OperatingSignalQualitySignalEvidence) {
  // 加权 9 + 9 + 9 + 8 = 35。
  let score = 0;
  if (input.actionable) score += 9;
  if (input.timely) score += 9;
  if (input.accurate) score += 9;
  if (input.leadsToReview) score += 8;
  return clamp(score, 0, BOUNDS.signalMax);
}

function scoreReadiness(input: OperatingSignalQualityReadinessEvidence) {
  // 5 项布尔 × 3 = 15。
  let score = 0;
  if (input.envConfigured) score += 3;
  if (input.cronOrTokenSet) score += 3;
  if (input.dbMigrated) score += 3;
  if (input.tenantEnabled) score += 3;
  if (input.initialDataSeeded) score += 3;
  return clamp(score, 0, BOUNDS.readinessMax);
}

function scoreCollaboration(input: OperatingSignalQualityCollaborationEvidence) {
  // 加权 4 + 3 + 3 = 10。
  let score = 0;
  if (input.reducedBlockersForOthers) score += 4;
  if (input.clearHandoff) score += 3;
  if (input.teamSpeedUp) score += 3;
  return clamp(score, 0, BOUNDS.collaborationMax);
}

function scoreNoisePenalty(input: OperatingSignalQualityNoiseFindings) {
  // 重要：误导性信号权重最重，确保噪声不可被代码量抵消。
  // 单项权重（去重 -3 / 误导 -10 / 错误归因 -6 / 无效报表 -4）。
  const duplicates = clampNonNegativeCount(input.duplicateSignalCount);
  const misleading = clampNonNegativeCount(input.misleadingSignalCount);
  const wrongAttribution = clampNonNegativeCount(input.wrongAttributionCount);
  const invalidReports = clampNonNegativeCount(input.invalidReportCount);
  const raw =
    duplicates * -3 + misleading * -10 + wrongAttribution * -6 + invalidReports * -4;
  if (raw === 0) return 0;
  return clamp(raw, BOUNDS.noisePenaltyMin, 0);
}

function scorePrInflationPenalty(input: OperatingSignalQualityPrInflationFindings) {
  // tinyNonCohesiveSlice -2 / repeatedNonProgressiveCommit -3 / commitsForCountSake flat -8。
  const tiny = clampNonNegativeCount(input.tinyNonCohesiveSliceCount);
  const repeated = clampNonNegativeCount(input.repeatedNonProgressiveCommitCount);
  const flagged = input.commitsForCountSake ? -8 : 0;
  const raw = tiny * -2 + repeated * -3 + flagged;
  if (raw === 0) return 0;
  return clamp(raw, BOUNDS.prInflationPenaltyMin, 0);
}

function gradeFromTotal(total: number): OperatingSignalQualityGrade {
  if (total >= 70) return "high_value";
  if (total >= 40) return "useful";
  if (total >= 0) return "weak";
  return "harmful";
}

function buildScoreBreakdown(
  evidence: OperatingSignalQualityEvidence,
): OperatingSignalQualityScoreBreakdown {
  const deliveryEffectScore = scoreDelivery(evidence.delivery);
  const signalQualityScore = scoreSignal(evidence.signal);
  const operationalReadinessScore = scoreReadiness(evidence.readiness);
  const collaborationScore = scoreCollaboration(evidence.collaboration);
  const noisePenalty = scoreNoisePenalty(evidence.noise);
  const prInflationPenalty = scorePrInflationPenalty(evidence.prInflation);
  const rawTotal =
    deliveryEffectScore +
    signalQualityScore +
    operationalReadinessScore +
    collaborationScore +
    noisePenalty +
    prInflationPenalty;
  return {
    deliveryEffectScore,
    signalQualityScore,
    operationalReadinessScore,
    collaborationScore,
    noisePenalty,
    prInflationPenalty,
    totalScore: clamp(rawTotal, BOUNDS.totalMin, BOUNDS.totalMax),
  };
}

function buildPositiveSignals(evidence: OperatingSignalQualityEvidence) {
  const lines: string[] = [];
  if (evidence.delivery.tenantUsable) lines.push("租户实际可用");
  if (evidence.delivery.customerCanTest) lines.push("客户能真实测试或试用");
  if (evidence.delivery.onlineVerified) lines.push("线上验证已通过");
  if (evidence.delivery.operatingPushForward) lines.push("真实推动经营推进");
  if (evidence.signal.actionable) lines.push("数据能转成明确动作");
  if (evidence.signal.timely) lines.push("信号到达及时");
  if (evidence.signal.accurate) lines.push("信号准确，未误导");
  if (evidence.signal.leadsToReview) lines.push("能进入复核 / 决策");
  if (evidence.collaboration.reducedBlockersForOthers) lines.push("减少了他人阻塞");
  if (evidence.collaboration.clearHandoff) lines.push("清晰交接，下一棒能直接接");
  if (evidence.collaboration.teamSpeedUp) lines.push("让团队整体推进更快");
  return lines;
}

function buildDeliveryEvidence(evidence: OperatingSignalQualityEvidence) {
  const lines: string[] = [];
  if (evidence.delivery.tenantUsable) lines.push("租户可用");
  if (evidence.delivery.customerCanTest) lines.push("客户可测试");
  if (evidence.delivery.onlineVerified) lines.push("线上验证");
  if (evidence.delivery.operatingPushForward) lines.push("经营推进可见");
  if (evidence.delivery.notes) lines.push(...evidence.delivery.notes);
  return lines;
}

function buildReadinessEvidence(evidence: OperatingSignalQualityEvidence) {
  const lines: string[] = [];
  if (evidence.readiness.envConfigured) lines.push("env / secret 已配置");
  if (evidence.readiness.cronOrTokenSet) lines.push("cron / token 已落");
  if (evidence.readiness.dbMigrated) lines.push("DB migration 已就绪");
  if (evidence.readiness.tenantEnabled) lines.push("租户 enablement 已开");
  if (evidence.readiness.initialDataSeeded) lines.push("初始化 / seed 已落");
  if (evidence.readiness.notes) lines.push(...evidence.readiness.notes);
  return lines;
}

function buildNoiseFindings(evidence: OperatingSignalQualityEvidence) {
  const lines: string[] = [];
  const noise = evidence.noise;
  if (clampNonNegativeCount(noise.duplicateSignalCount) > 0) {
    lines.push(`重复信号 ${clampNonNegativeCount(noise.duplicateSignalCount)} 条`);
  }
  if (clampNonNegativeCount(noise.misleadingSignalCount) > 0) {
    lines.push(`误导性信号 ${clampNonNegativeCount(noise.misleadingSignalCount)} 条（最重惩罚）`);
  }
  if (clampNonNegativeCount(noise.wrongAttributionCount) > 0) {
    lines.push(`归因错误 ${clampNonNegativeCount(noise.wrongAttributionCount)} 条`);
  }
  if (clampNonNegativeCount(noise.invalidReportCount) > 0) {
    lines.push(`无效报表 ${clampNonNegativeCount(noise.invalidReportCount)} 条（不驱动 action）`);
  }
  if (noise.notes) lines.push(...noise.notes);
  const prInflation = evidence.prInflation;
  if (clampNonNegativeCount(prInflation.tinyNonCohesiveSliceCount) > 0) {
    lines.push(
      `过小且不构成独立交付价值切片 ${clampNonNegativeCount(prInflation.tinyNonCohesiveSliceCount)} 个`,
    );
  }
  if (clampNonNegativeCount(prInflation.repeatedNonProgressiveCommitCount) > 0) {
    lines.push(
      `反复重写但未推进交付的 commit ${clampNonNegativeCount(prInflation.repeatedNonProgressiveCommitCount)} 个`,
    );
  }
  if (prInflation.commitsForCountSake) {
    lines.push("明显为提交数量而提交（已扣分）");
  }
  if (prInflation.notes) lines.push(...prInflation.notes);
  return lines;
}

function buildRecommendations(
  evidence: OperatingSignalQualityEvidence,
  scores: OperatingSignalQualityScoreBreakdown,
) {
  const lines: string[] = [];
  if (scores.deliveryEffectScore < BOUNDS.deliveryMax) {
    if (!evidence.delivery.tenantUsable) lines.push("先让租户真正可用，再追加任何 polish");
    if (!evidence.delivery.customerCanTest) lines.push("打通客户实际测试路径");
    if (!evidence.delivery.onlineVerified) lines.push("补齐线上验证证据");
    if (!evidence.delivery.operatingPushForward) {
      lines.push("把改动落到经营推进，而不是仅仅落到代码里");
    }
  }
  if (scores.signalQualityScore < BOUNDS.signalMax) {
    if (!evidence.signal.actionable) lines.push("把数据收敛成可执行的下一步");
    if (!evidence.signal.timely) lines.push("缩短信号产出到推进窗口的延迟");
    if (!evidence.signal.accurate) lines.push("先治准确性，再做新维度");
    if (!evidence.signal.leadsToReview) lines.push("把信号接入复核或决策表面");
  }
  if (scores.operationalReadinessScore < BOUNDS.readinessMax) {
    if (!evidence.readiness.envConfigured) lines.push("补齐 env / secret 配置");
    if (!evidence.readiness.cronOrTokenSet) lines.push("补齐 cron / token / webhook 配置");
    if (!evidence.readiness.dbMigrated) lines.push("补齐 schema / migration 上线");
    if (!evidence.readiness.tenantEnabled) lines.push("打开租户 enablement / feature flag");
    if (!evidence.readiness.initialDataSeeded) lines.push("补齐必要的初始化 / seed 数据");
  }
  if (scores.collaborationScore < BOUNDS.collaborationMax) {
    if (!evidence.collaboration.reducedBlockersForOthers) {
      lines.push("把别人当前的阻塞当成自己的目标解一下");
    }
    if (!evidence.collaboration.clearHandoff) lines.push("交接前显式标清楚下一棒是谁、走哪条路");
    if (!evidence.collaboration.teamSpeedUp) lines.push("评估改动是否让整体推进加速，而不是只让自己看起来忙");
  }
  if (scores.noisePenalty < 0) {
    lines.push("先清噪声 / 误导 / 重复 / 错误归因，再追求新维度");
  }
  if (scores.prInflationPenalty < 0) {
    lines.push("合并过小切片或非推进式 commit，避免靠数量制造贡献感");
  }
  if (lines.length === 0) {
    lines.push("继续保持：信号、交付、上线准备、协同四象都已到位");
  }
  return lines;
}

export function assessOperatingSignalQuality(input: {
  subject: OperatingSignalQualitySubject;
  evidence: OperatingSignalQualityEvidence;
}): OperatingSignalQualityAssessment {
  const scores = buildScoreBreakdown(input.evidence);
  return {
    subject: input.subject,
    scores,
    grade: gradeFromTotal(scores.totalScore),
    positiveSignals: buildPositiveSignals(input.evidence),
    noiseFindings: buildNoiseFindings(input.evidence),
    deliveryEvidence: buildDeliveryEvidence(input.evidence),
    readinessEvidence: buildReadinessEvidence(input.evidence),
    recommendations: buildRecommendations(input.evidence, scores),
    boundary: {
      reservedOnly: true,
      notAPerformanceContractor: true,
      notAFinancialSettlementInput: true,
      aiOutputAttributedToHumanGithub: true,
    },
  };
}

export function gradeOperatingSignalQuality(
  evidence: OperatingSignalQualityEvidence,
): OperatingSignalQualityGrade {
  const scores = buildScoreBreakdown(evidence);
  return gradeFromTotal(scores.totalScore);
}

// 给单测和外部 callers 公开的辅助。
export const __INTERNALS_FOR_TESTING_ONLY__ = {
  scoreDelivery,
  scoreSignal,
  scoreReadiness,
  scoreCollaboration,
  scoreNoisePenalty,
  scorePrInflationPenalty,
  gradeFromTotal,
};
