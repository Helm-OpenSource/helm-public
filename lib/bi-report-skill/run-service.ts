import { analyzeBiReportWithLLM } from "@/lib/llm-workflows/analyze-bi-report.workflow";
import { retrieveBiReportOdpsKnowledgeContext } from "@/lib/bi-report-skill/odps-knowledge";
import { assertValidBiReportRows } from "@/lib/bi-report-skill/schema-validator";
import { computeBiReportMetrics } from "@/lib/bi-report-skill/metric-engine";
import { renderBiReportMessage } from "@/lib/bi-report-skill/message-renderer";
import { evaluateBiReportResult, getBiReportSeverityLabel } from "@/lib/bi-report-skill/result-evaluator";
import type {
  BiReportAnalysisOutput,
  BiReportContinuityStatus,
  BiReportDeliveryChannel,
  BiReportFeedbackMemoryEntry,
  BiReportRecentFeedbackContext,
  BiReportRecentRunContext,
  BiReportRunMemoryEntry,
  BiReportSendDecision,
  BiReportSimilarCaseContext,
  BiReportSkillPack,
  BiReportSubscriptionConfig,
  PreparedBiReportDryRun,
} from "@/lib/bi-report-skill/types";
import { biReportDeliveryChannels } from "@/lib/bi-report-skill/types";

export async function prepareBiReportDryRun(input: {
  workspaceId: string;
  userId?: string | null;
  skill: BiReportSkillPack;
  subscription: BiReportSubscriptionConfig;
  resolvedSqlParams?: Record<string, string>;
  rows: Array<Record<string, unknown>>;
  useLLM?: boolean;
  recentRuns?: BiReportRunMemoryEntry[];
  recentFeedbacks?: BiReportFeedbackMemoryEntry[];
}): Promise<PreparedBiReportDryRun> {
  assertBiReportSubscriptionMatchesSkill(input.subscription, input.skill);
  const validatedRows = assertValidBiReportRows(input.skill.schema, input.rows);
  if (validatedRows.length === 0) {
    throw new Error(`Bi report dry-run aborted: skill ${input.skill.manifest.skillKey} returned no rows`);
  }
  const computed = computeBiReportMetrics({
    definitions: input.skill.metrics,
    rows: validatedRows,
  });
  const evaluation = evaluateBiReportResult({
    criteria: input.skill.resultCriteria,
    metricDefinitions: input.skill.metrics,
    computed,
  });
  const windowLabel = resolveWindowLabel(input.subscription, validatedRows, input.resolvedSqlParams);
  const recentRunContext = summarizeRecentRunContext({
    recentRuns: input.recentRuns ?? [],
    currentSeverity: evaluation.severity,
  });
  const recentFeedbackContext = summarizeRecentFeedbackContext(input.recentFeedbacks ?? []);
  const similarCaseContext = summarizeSimilarCaseContext({
    recentRuns: input.recentRuns ?? [],
    recentFeedbacks: input.recentFeedbacks ?? [],
    currentWindowLabel: windowLabel,
    currentSeverity: evaluation.severity,
    continuityStatus: recentRunContext.continuityStatus,
    topFindings: evaluation.topFindings,
  });
  const fallbackAnalysis = buildFallbackAnalysis({
    skill: input.skill,
    computed,
    evaluation,
    windowLabel,
    recentRunContext,
    recentFeedbackContext,
    similarCaseContext,
  });
  const odpsKnowledgeContext = retrieveBiReportOdpsKnowledgeContext({
    skillKey: input.skill.manifest.skillKey,
    deterministicFindings: evaluation.topFindings,
    matchedRules: evaluation.matchedRules.map((rule) => rule.title),
  });
  const analysis = input.useLLM
    ? (
        await analyzeBiReportWithLLM({
          workspaceId: input.workspaceId,
          userId: input.userId,
          skillName: input.skill.manifest.name,
          severityLabel: getBiReportSeverityLabel(evaluation.severity),
          windowLabel,
          boundaries: input.skill.manifest.boundaries,
          skillPromptTemplate: input.skill.promptTemplate,
          summaryMetrics: computed.summaryMetrics.map((item) => ({
            label: item.label,
            value: formatMetricValue(item.value, item.format),
          })),
          matchedRules: evaluation.matchedRules.map((rule) => rule.title),
          deterministicFindings: evaluation.topFindings,
          recentRunContext,
          recentFeedbackContext,
          similarCaseContext,
          odpsKnowledgeContext,
          fallback: fallbackAnalysis,
        })
      ).output
    : fallbackAnalysis;

  const message = renderBiReportMessage(input.skill.messageTemplate, {
    skill: {
      name: input.skill.manifest.name,
    },
    result: {
      severity: evaluation.severity,
      severityLabel: getBiReportSeverityLabel(evaluation.severity),
    },
    run: {
      windowLabel,
    },
    analysis,
    metrics: Object.fromEntries(
      computed.summaryMetrics.map((item) => [item.key, formatMetricValue(item.value, item.format)]),
    ),
  });

  return {
    skill: input.skill,
    subscription: input.subscription,
    rows: validatedRows,
    computed,
    evaluation,
    recentRunContext,
    recentFeedbackContext,
    similarCaseContext,
    analysis,
    message,
    windowLabel,
  };
}

export function assertBiReportSubscriptionMatchesSkill(
  subscription: BiReportSubscriptionConfig,
  skill: BiReportSkillPack,
) {
  if (subscription.skillKey !== skill.manifest.skillKey) {
    throw new Error(
      `Bi report subscription skill mismatch: expected ${skill.manifest.skillKey}, got ${subscription.skillKey}`,
    );
  }

  if (subscription.skillVersion !== skill.manifest.version) {
    throw new Error(
      `Bi report subscription version mismatch: expected ${skill.manifest.version}, got ${subscription.skillVersion}`,
    );
  }

  const supportedChannels = new Set<BiReportDeliveryChannel>(skill.manifest.supportedDeliveryChannels);

  for (const target of subscription.deliveryTargets) {
    if (!biReportDeliveryChannels.includes(target.channel)) {
      throw new Error(`Unsupported BI report delivery channel: ${String(target.channel)}`);
    }

    if (!supportedChannels.has(target.channel)) {
      throw new Error(
        `BI report delivery channel ${target.channel} is not supported by skill ${skill.manifest.skillKey}`,
      );
    }
  }
}

export function resolveBiReportSendDecision(input: {
  subscription: BiReportSubscriptionConfig;
  evaluation: PreparedBiReportDryRun["evaluation"];
  recentRuns: BiReportRunMemoryEntry[];
  continuityStatus: BiReportContinuityStatus;
}): BiReportSendDecision {
  const dedupeWindowMinutes = input.subscription.dedupeWindowMinutes ?? 0;

  if (!input.evaluation.shouldSend) {
    return {
      shouldSend: false,
      reason: "criteria_not_met",
      dedupeWindowMinutes,
    };
  }

  if (dedupeWindowMinutes <= 0) {
    return {
      shouldSend: true,
      reason: "criteria_met",
      dedupeWindowMinutes,
    };
  }

  const latestSentRun = input.recentRuns.find((run) => run.shouldSend);
  if (!latestSentRun?.createdAt) {
    return {
      shouldSend: true,
      reason: "criteria_met",
      dedupeWindowMinutes,
    };
  }

  const latestSentAt = Date.parse(latestSentRun.createdAt);
  if (Number.isNaN(latestSentAt)) {
    return {
      shouldSend: true,
      reason: "criteria_met",
      dedupeWindowMinutes,
    };
  }

  const elapsedMinutes = (Date.now() - latestSentAt) / (60 * 1000);
  if (elapsedMinutes > dedupeWindowMinutes) {
    return {
      shouldSend: true,
      reason: "criteria_met",
      dedupeWindowMinutes,
    };
  }

  if (severityRank(input.evaluation.severity) > severityRank(latestSentRun.severity)) {
    return {
      shouldSend: true,
      reason: "severity_escalated",
      dedupeWindowMinutes,
    };
  }

  if (input.continuityStatus === "worsening") {
    return {
      shouldSend: true,
      reason: "worsening",
      dedupeWindowMinutes,
    };
  }

  const latestFindings = new Set(latestSentRun.topFindings);
  const hasOverlap = input.evaluation.topFindings.some((finding) => latestFindings.has(finding));
  if (hasOverlap || input.continuityStatus === "recurring") {
    return {
      shouldSend: false,
      reason: "duplicate_within_dedupe_window",
      dedupeWindowMinutes,
    };
  }

  return {
    shouldSend: true,
    reason: "criteria_met",
    dedupeWindowMinutes,
  };
}

function buildFallbackAnalysis(input: {
  skill: BiReportSkillPack;
  computed: PreparedBiReportDryRun["computed"];
  evaluation: PreparedBiReportDryRun["evaluation"];
  windowLabel: string;
  recentRunContext: BiReportRecentRunContext;
  recentFeedbackContext: BiReportRecentFeedbackContext;
  similarCaseContext: BiReportSimilarCaseContext;
}): BiReportAnalysisOutput {
  const summaryLine = input.computed.summaryMetrics
    .slice(0, 3)
    .map((item) => `${item.label} ${formatMetricValue(item.value, item.format)}`)
    .join("；");
  const pctChangeRanking = input.skill.metrics.rankings?.find((item) => item.type === "row_pct_change");
  const thresholdRanking = input.skill.metrics.rankings?.find((item) => item.type === "row_ratio_threshold");
  const declineLead = pctChangeRanking ? input.computed.rankings[pctChangeRanking.key]?.[0] : null;
  const lowSuccessLead = thresholdRanking ? input.computed.rankings[thresholdRanking.key]?.[0] : null;
  const possibleCauses: string[] = [];

  if (declineLead) {
    possibleCauses.push(`优先复核 ${declineLead.label} 对应分组的核心指标、金额口径和结构变化。`);
  }
  if (lowSuccessLead) {
    possibleCauses.push("偏弱分组提示可能存在收入下滑、支出抬升、数据口径变化或结算结构波动。");
  }
  if (input.recentFeedbackContext.confirmedCauseHints[0]) {
    possibleCauses.unshift(`历史复盘里，曾确认过的原因包括：${input.recentFeedbackContext.confirmedCauseHints[0]}`);
  }
  if (input.similarCaseContext.caseContext) {
    possibleCauses.push(`相似案例参考：${input.similarCaseContext.caseContext}`);
  }
  if (possibleCauses.length === 0) {
    possibleCauses.push("当前更多是指标波动提示，建议继续观察下一周期变化。");
  }

  const recommendedActions =
    input.evaluation.severity === "CLEAR"
      ? ["保持当前观察节奏，下一周期继续对比关键指标。"]
      : [
          "先复核异常分组的核心指标、口径变化和结构波动。",
          "把本次预警带入人工复盘，不把当前解释直接当成已确认根因。",
        ];
  if (input.recentFeedbackContext.confirmedActionHints[0] && !recommendedActions.includes(input.recentFeedbackContext.confirmedActionHints[0])) {
    recommendedActions.unshift(`可优先复用历史已确认动作：${input.recentFeedbackContext.confirmedActionHints[0]}`);
  }
  if (
    input.similarCaseContext.relatedFeedbacks[0]?.confirmedAction &&
    !recommendedActions.some((item) => item.includes(input.similarCaseContext.relatedFeedbacks[0]?.confirmedAction ?? ""))
  ) {
    recommendedActions.unshift(`相似案例里曾采用：${input.similarCaseContext.relatedFeedbacks[0].confirmedAction}`);
  }

  return {
    headline:
      input.evaluation.matchedRules[0]?.title ??
      `${input.skill.manifest.name} 当前未触发高优先级预警`,
    summary: `时间窗口 ${input.windowLabel}，当前等级为 ${getBiReportSeverityLabel(input.evaluation.severity)}。${summaryLine}。`,
    findings: input.evaluation.topFindings,
    possibleCauses,
    recommendedActions,
    confidence:
      input.evaluation.severity === "CLEAR"
        ? 0.9
        : input.evaluation.matchedRules.length > 0
          ? 0.78
          : 0.65,
    continuityStatus: input.recentRunContext.continuityStatus,
    historicalContext: input.recentRunContext.historicalContext,
    feedbackContext: input.recentFeedbackContext.feedbackContext,
    boundaryNote: "本次结论等级来自既定规则，当前解释只基于聚合报表结果，不代表自动决策或自动执行。",
    generationMode: "fallback",
    llmMeta: null,
  };
}

function summarizeSimilarCaseContext(input: {
  recentRuns: BiReportRunMemoryEntry[];
  recentFeedbacks: BiReportFeedbackMemoryEntry[];
  currentWindowLabel: string;
  currentSeverity: PreparedBiReportDryRun["evaluation"]["severity"];
  continuityStatus: BiReportContinuityStatus;
  topFindings: string[];
}): BiReportSimilarCaseContext {
  const currentTokens = tokenizeBiReportFindings(input.topFindings);
  const relatedRuns = input.recentRuns
    .filter((run) => run.windowLabel !== input.currentWindowLabel)
    .map((run) => ({
      run,
      score: scoreSimilarRun(run, input.currentSeverity, input.continuityStatus, currentTokens),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 2)
    .map((item) => item.run);

  const relatedFeedbacks = input.recentFeedbacks
    .map((feedback) => ({
      feedback,
      score: scoreSimilarFeedback(feedback, currentTokens),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 2)
    .map((item) => item.feedback);

  const fragments: string[] = [];
  if (relatedRuns[0]) {
    fragments.push(
      `最近相似运行是 ${relatedRuns[0].windowLabel}（${relatedRuns[0].severity ? getBiReportSeverityLabel(relatedRuns[0].severity) : "未记录"}）`,
    );
  }
  if (relatedFeedbacks[0]?.confirmedCause) {
    fragments.push(`相似案例曾确认原因：${relatedFeedbacks[0].confirmedCause}`);
  }
  if (relatedFeedbacks[0]?.confirmedAction) {
    fragments.push(`相似案例曾确认动作：${relatedFeedbacks[0].confirmedAction}`);
  }
  if (relatedFeedbacks[0]?.isFalsePositive) {
    fragments.push("相似案例里出现过误报标记，当前解释需要保持保守");
  }

  return {
    relatedRuns,
    relatedFeedbacks,
    caseContext: fragments.length > 0 ? fragments.join("；") : null,
  };
}

function summarizeRecentRunContext(input: {
  recentRuns: BiReportRunMemoryEntry[];
  currentSeverity: PreparedBiReportDryRun["evaluation"]["severity"];
}): BiReportRecentRunContext {
  if (input.recentRuns.length === 0) {
    return {
      recentRuns: [],
      continuityStatus: "first_seen",
      historicalContext: "当前没有可用的历史运行记忆，这次先按首次观察处理。",
    };
  }

  const latest = input.recentRuns[0];
  const latestSeverity = latest.severity;
  let continuityStatus: BiReportContinuityStatus = "recurring";

  if (latestSeverity) {
    const currentRank = severityRank(input.currentSeverity);
    const latestRank = severityRank(latestSeverity);
    if (currentRank > latestRank) {
      continuityStatus = "worsening";
    } else if (currentRank < latestRank) {
      continuityStatus = "recovering";
    }
  }

  const recentSeverities = input.recentRuns
    .slice(0, 3)
    .map((run) => `${run.windowLabel} ${run.severity ? getBiReportSeverityLabel(run.severity) : "未记录"}`)
    .join("；");
  const recurringFinding = findRecurringFinding(input.recentRuns);
  const historicalContext = recurringFinding
    ? `最近 ${input.recentRuns.length} 次同类运行里，最近一条是 ${latest.windowLabel}（${latestSeverity ? getBiReportSeverityLabel(latestSeverity) : "未记录"}），并且“${recurringFinding}”重复出现。最近轨迹：${recentSeverities}。`
    : `最近 ${input.recentRuns.length} 次同类运行里，最近一条是 ${latest.windowLabel}（${latestSeverity ? getBiReportSeverityLabel(latestSeverity) : "未记录"}）。最近轨迹：${recentSeverities}。`;

  return {
    recentRuns: input.recentRuns,
    continuityStatus,
    historicalContext,
  };
}

function findRecurringFinding(recentRuns: BiReportRunMemoryEntry[]) {
  const counts = new Map<string, number>();
  for (const run of recentRuns) {
    for (const finding of run.topFindings) {
      counts.set(finding, (counts.get(finding) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
}

function tokenizeBiReportFindings(findings: string[]) {
  return new Set(
    findings
      .flatMap((finding) => finding.split(/[\s，。,；：:（）()、]+/))
      .map((token) => token.trim())
      .filter((token) => token.length >= 2),
  );
}

function scoreSimilarRun(
  run: BiReportRunMemoryEntry,
  currentSeverity: PreparedBiReportDryRun["evaluation"]["severity"],
  continuityStatus: BiReportContinuityStatus,
  currentTokens: Set<string>,
) {
  let score = 0;
  if (run.severity === currentSeverity) {
    score += 3;
  }
  if (run.continuityStatus === continuityStatus) {
    score += 2;
  }
  const overlap = run.topFindings.reduce((sum, finding) => {
    const tokens = finding
      .split(/[\s，。,；：:（）()、]+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2);
    return sum + tokens.filter((token) => currentTokens.has(token)).length;
  }, 0);
  score += overlap;
  return score;
}

function scoreSimilarFeedback(
  feedback: BiReportFeedbackMemoryEntry,
  currentTokens: Set<string>,
) {
  let score = 0;
  const source = [feedback.confirmedCause, feedback.confirmedAction, feedback.note]
    .filter((item): item is string => Boolean(item))
    .join(" ");
  for (const token of source.split(/[\s，。,；：:（）()、]+/).map((token) => token.trim())) {
    if (token.length >= 2 && currentTokens.has(token)) {
      score += 1;
    }
  }
  if (feedback.confirmedCause) {
    score += 1;
  }
  if (feedback.confirmedAction) {
    score += 1;
  }
  return score;
}

function severityRank(severity: PreparedBiReportDryRun["evaluation"]["severity"] | null) {
  switch (severity) {
    case "CLEAR":
      return 0;
    case "WATCH":
      return 1;
    case "WARN":
      return 2;
    case "ALERT":
      return 3;
    case "CRITICAL":
      return 4;
    default:
      return 0;
  }
}

function summarizeRecentFeedbackContext(recentFeedbacks: BiReportFeedbackMemoryEntry[]): BiReportRecentFeedbackContext {
  if (recentFeedbacks.length === 0) {
    return {
      recentFeedbacks: [],
      feedbackContext: "当前还没有可用的人工复盘反馈记忆。",
      confirmedCauseHints: [],
      confirmedActionHints: [],
      falsePositiveSignal: false,
      ruleAdjustmentSignal: false,
    };
  }

  const confirmedCauseHints = recentFeedbacks
    .map((item) => item.confirmedCause?.trim())
    .filter((item): item is string => Boolean(item))
    .slice(0, 2);
  const confirmedActionHints = recentFeedbacks
    .map((item) => item.confirmedAction?.trim())
    .filter((item): item is string => Boolean(item))
    .slice(0, 2);
  const latest = recentFeedbacks[0];
  const falsePositiveSignal = recentFeedbacks.some((item) => item.isFalsePositive === true);
  const ruleAdjustmentSignal = recentFeedbacks.some((item) => item.needsRuleAdjustment === true);
  const feedbackContext = [
    `最近 ${recentFeedbacks.length} 条复盘反馈里，最新一条状态是 ${latest.feedbackStatus}。`,
    confirmedCauseHints[0] ? `曾确认原因：${confirmedCauseHints.join("；")}。` : null,
    confirmedActionHints[0] ? `曾确认动作：${confirmedActionHints.join("；")}。` : null,
    falsePositiveSignal ? "历史上出现过误报标记，建议复核规则阈值和数据口径。" : null,
    ruleAdjustmentSignal ? "历史反馈建议调规则，当前解释应保守引用既有规则结果。" : null,
  ]
    .filter((item): item is string => Boolean(item))
    .join("");

  return {
    recentFeedbacks,
    feedbackContext,
    confirmedCauseHints,
    confirmedActionHints,
    falsePositiveSignal,
    ruleAdjustmentSignal,
  };
}

function resolveWindowLabel(
  subscription: BiReportSubscriptionConfig,
  rows: PreparedBiReportDryRun["rows"],
  resolvedSqlParams?: Record<string, string>,
) {
  const fallbackBizDate = typeof rows[0]?.biz_date === "string" ? formatWindowLabelValue(rows[0].biz_date) : "未提供";
  const bizDate = formatWindowLabelValue(
    resolveDateHint(resolvedSqlParams?.biz_date ?? subscription.sqlParams.biz_date, fallbackBizDate),
  );
  const prevDate = resolveDateHint(
    resolvedSqlParams?.prev_date ?? subscription.sqlParams.prev_date,
    shiftMonthLabel(bizDate, -1) ?? shiftDateLabel(bizDate, -1) ?? "未提供",
  );
  return `${bizDate} vs ${formatWindowLabelValue(prevDate)}`;
}

function resolveDateHint(rawValue: string | undefined, fallback: string) {
  if (!rawValue || rawValue.includes("{{")) {
    return fallback;
  }
  return rawValue;
}

function shiftDateLabel(value: string, offsetDays: number) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  parsed.setDate(parsed.getDate() + offsetDays);
  return parsed.toISOString().slice(0, 10);
}

function shiftMonthLabel(value: string, offsetMonths: number) {
  const matched = value.match(/^(\d{4})(?:-(\d{2})|(\d{2}))$/);
  if (!matched) {
    return null;
  }

  const [, yearText, hyphenMonthText, compactMonthText] = matched;
  const monthText = hyphenMonthText ?? compactMonthText;
  const year = Number(yearText);
  const month = Number(monthText);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    return null;
  }

  const shifted = new Date(Date.UTC(year, month - 1, 1));
  shifted.setUTCMonth(shifted.getUTCMonth() + offsetMonths);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatWindowLabelValue(value: string) {
  const compactMonth = value.match(/^(\d{4})(\d{2})$/);
  if (compactMonth) {
    return `${compactMonth[1]}-${compactMonth[2]}`;
  }

  return value;
}

function formatMetricValue(value: number, format: "integer" | "decimal" | "currency" | "percent") {
  switch (format) {
    case "integer":
      return new Intl.NumberFormat("zh-CN", {
        maximumFractionDigits: 0,
      }).format(value);
    case "currency":
      return new Intl.NumberFormat("zh-CN", {
        style: "currency",
        currency: "CNY",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(value);
    case "percent":
      return `${(value * 100).toFixed(1)}%`;
    case "decimal":
    default:
      return new Intl.NumberFormat("zh-CN", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(value);
  }
}
