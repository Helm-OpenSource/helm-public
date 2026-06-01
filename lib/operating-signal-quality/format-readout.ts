import {
  formatOperatingSignalQualityBoundaryFooter,
  formatOperatingSignalQualityDimensionLabel,
  formatOperatingSignalQualityGradeBadgeVariant,
  formatOperatingSignalQualityGradeLabel,
  formatOperatingSignalQualityReadoutHeadline,
  formatOperatingSignalQualitySubjectKindLabel,
  type OperatingSignalQualityGradeBadgeVariant,
  type OperatingSignalQualityScoreDimension,
} from "./display-copy";
import {
  OPERATING_SIGNAL_QUALITY_SCORE_BOUNDS,
  type OperatingSignalQualityAssessment,
  type OperatingSignalQualityScoreBreakdown,
} from "./types";

// 把评分结果格式化成可直接喂给 UI / Markdown / DingTalk 推送的结构化只读 readout。
// 仍保持 pure — 不接 React、不接 Prisma、不接租户字面量；caller 在 reserved-tenant gating 之后调用。

export type OperatingSignalQualityReadoutScoreLine = {
  dimension: OperatingSignalQualityScoreDimension;
  label: string;
  score: number;
  bound: { min: number; max: number };
  // tone 提示 UI 是正向、负向还是中性。
  tone: "positive" | "negative" | "neutral";
};

export type OperatingSignalQualityReadout = {
  subjectLabel: string;
  subjectKindLabel: string;
  gradeLabel: string;
  gradeBadgeVariant: OperatingSignalQualityGradeBadgeVariant;
  headline: string;
  totalScore: number;
  totalBound: { min: number; max: number };
  scoreLines: OperatingSignalQualityReadoutScoreLine[];
  positiveSignals: string[];
  noiseFindings: string[];
  deliveryEvidence: string[];
  readinessEvidence: string[];
  recommendations: string[];
  boundaryFooter: string;
};

function buildScoreLines(
  scores: OperatingSignalQualityScoreBreakdown,
  english: boolean,
): OperatingSignalQualityReadoutScoreLine[] {
  const BOUNDS = OPERATING_SIGNAL_QUALITY_SCORE_BOUNDS;
  return [
    {
      dimension: "delivery",
      label: formatOperatingSignalQualityDimensionLabel("delivery", english),
      score: scores.deliveryEffectScore,
      bound: { min: 0, max: BOUNDS.deliveryMax },
      tone: "positive",
    },
    {
      dimension: "signal",
      label: formatOperatingSignalQualityDimensionLabel("signal", english),
      score: scores.signalQualityScore,
      bound: { min: 0, max: BOUNDS.signalMax },
      tone: "positive",
    },
    {
      dimension: "readiness",
      label: formatOperatingSignalQualityDimensionLabel("readiness", english),
      score: scores.operationalReadinessScore,
      bound: { min: 0, max: BOUNDS.readinessMax },
      tone: "positive",
    },
    {
      dimension: "collaboration",
      label: formatOperatingSignalQualityDimensionLabel(
        "collaboration",
        english,
      ),
      score: scores.collaborationScore,
      bound: { min: 0, max: BOUNDS.collaborationMax },
      tone: "positive",
    },
    {
      dimension: "noise",
      label: formatOperatingSignalQualityDimensionLabel("noise", english),
      score: scores.noisePenalty,
      bound: { min: BOUNDS.noisePenaltyMin, max: 0 },
      tone: scores.noisePenalty < 0 ? "negative" : "neutral",
    },
    {
      dimension: "prInflation",
      label: formatOperatingSignalQualityDimensionLabel("prInflation", english),
      score: scores.prInflationPenalty,
      bound: { min: BOUNDS.prInflationPenaltyMin, max: 0 },
      tone: scores.prInflationPenalty < 0 ? "negative" : "neutral",
    },
  ];
}

export function formatOperatingSignalQualityReadout(input: {
  assessment: OperatingSignalQualityAssessment;
  english: boolean;
}): OperatingSignalQualityReadout {
  const { assessment, english } = input;
  return {
    subjectLabel: assessment.subject.label,
    subjectKindLabel: formatOperatingSignalQualitySubjectKindLabel(
      assessment.subject.kind,
      english,
    ),
    gradeLabel: formatOperatingSignalQualityGradeLabel(
      assessment.grade,
      english,
    ),
    gradeBadgeVariant: formatOperatingSignalQualityGradeBadgeVariant(
      assessment.grade,
    ),
    headline: formatOperatingSignalQualityReadoutHeadline(
      assessment.grade,
      english,
    ),
    totalScore: assessment.scores.totalScore,
    totalBound: {
      min: OPERATING_SIGNAL_QUALITY_SCORE_BOUNDS.totalMin,
      max: OPERATING_SIGNAL_QUALITY_SCORE_BOUNDS.totalMax,
    },
    scoreLines: buildScoreLines(assessment.scores, english),
    positiveSignals: assessment.positiveSignals,
    noiseFindings: assessment.noiseFindings,
    deliveryEvidence: assessment.deliveryEvidence,
    readinessEvidence: assessment.readinessEvidence,
    recommendations: assessment.recommendations,
    boundaryFooter: formatOperatingSignalQualityBoundaryFooter(english),
  };
}

// 给 DingTalk / Slack / Markdown 推送一个简短的纯文本版本。
// 仍是纯函数；caller 决定要不要发送、给谁、何时发。
export function formatOperatingSignalQualityReadoutAsMarkdown(input: {
  assessment: OperatingSignalQualityAssessment;
  english: boolean;
}): string {
  const readout = formatOperatingSignalQualityReadout(input);
  const lines: string[] = [];
  const subjectIntro = input.english
    ? `### Operating Signal Quality — ${readout.subjectKindLabel}: ${readout.subjectLabel}`
    : `### 经营信号质量评估 — ${readout.subjectKindLabel}：${readout.subjectLabel}`;
  lines.push(subjectIntro);
  lines.push("");
  lines.push(
    input.english
      ? `**Grade**: ${readout.gradeLabel} · **Score**: ${readout.totalScore} / ${readout.totalBound.max}`
      : `**评级**：${readout.gradeLabel} · **总分**：${readout.totalScore} / ${readout.totalBound.max}`,
  );
  lines.push("");
  lines.push(`> ${readout.headline}`);
  lines.push("");
  lines.push(input.english ? "**Breakdown**:" : "**分项**：");
  for (const line of readout.scoreLines) {
    lines.push(
      `- ${line.label}：${line.score} / ${line.bound.min === 0 ? line.bound.max : `${line.bound.min}..${line.bound.max}`}`,
    );
  }
  if (readout.positiveSignals.length) {
    lines.push("");
    lines.push(input.english ? "**Positive signals**:" : "**正面信号**：");
    for (const text of readout.positiveSignals) {
      lines.push(`- ${text}`);
    }
  }
  if (readout.noiseFindings.length) {
    lines.push("");
    lines.push(input.english ? "**Noise findings**:" : "**噪声 / 干扰**：");
    for (const text of readout.noiseFindings) {
      lines.push(`- ${text}`);
    }
  }
  if (readout.recommendations.length) {
    lines.push("");
    lines.push(input.english ? "**Recommendations**:" : "**改进建议**：");
    for (const text of readout.recommendations) {
      lines.push(`- ${text}`);
    }
  }
  lines.push("");
  lines.push(`*${readout.boundaryFooter}*`);
  return lines.join("\n");
}
