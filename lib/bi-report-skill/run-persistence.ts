import { db } from "@/lib/db";
import { isMissingTableError } from "@/lib/bi-report-skill/missing-table-error";
import type {
  BiReportDeliveryPreview,
  BiReportEffectivenessSummary,
  BiReportFeedbackMemoryEntry,
  BiReportHandoffExecutionLogRecord,
  BiReportRiskTrend,
  BiReportQueryWarningStat,
  BiReportRuleOptimizationSuggestion,
  BiReportReviewIssueCode,
  BiReportReviewIssueStat,
  BiReportRunExecutionHint,
  BiReportRunReadoutSummary,
  BiReportRunMemoryEntry,
  BiReportSendDecision,
  BiReportSimilarCasePreview,
  BiReportSubscriptionConfig,
  PreparedBiReportDryRun,
} from "@/lib/bi-report-skill/types";

type PersistedBiReportRun = {
  subscriptionId: string;
  runId: string;
  scheduledFor: Date;
  dedupeKey: string;
};

export const BI_REPORT_STALE_RUNNING_WINDOW_MS = 3 * 60 * 60 * 1000;

export async function startBiReportRunPersistence(input: {
  workspaceId: string;
  extensionKey?: string | null;
  userId?: string | null;
  skillKey: string;
  skillVersion: string;
  subscription: BiReportSubscriptionConfig;
  scheduledFor?: Date;
}): Promise<PersistedBiReportRun | null> {
  try {
    const subscription = await syncBiReportSubscriptionRecord(input);
    const scheduledFor = input.scheduledFor ?? new Date();
    const dedupeKey = buildBiReportRunDedupeKey({
      workspaceId: input.workspaceId,
      extensionKey: input.extensionKey,
      skillKey: input.skillKey,
      scheduledFor,
    });
    const run = await db.biReportRun.create({
      data: {
        subscriptionId: subscription.id,
        workspaceId: input.workspaceId,
        extensionKey: input.extensionKey ?? null,
        scheduledFor,
        dedupeKey,
        status: "RUNNING",
      },
      select: {
        id: true,
      },
    });
    await db.biReportSubscription.update({
      where: {
        id: subscription.id,
      },
      data: {
        lastPlannedAt: scheduledFor,
      },
    });

    return {
      subscriptionId: subscription.id,
      runId: run.id,
      scheduledFor,
      dedupeKey,
    };
  } catch (error) {
    if (isMissingBiReportPersistenceTableError(error)) {
      return null;
    }
    throw error;
  }
}

export async function recordBiReportDeliveries(input: {
  runId: string;
  workspaceId: string;
  extensionKey?: string | null;
  deliveryPreviews: BiReportDeliveryPreview[];
}) {
  try {
    for (const delivery of input.deliveryPreviews) {
      await db.biReportDelivery.create({
        data: {
          runId: input.runId,
          workspaceId: input.workspaceId,
          extensionKey: input.extensionKey ?? null,
          channel: delivery.channel,
          targetType: delivery.targetType,
          targetKey: delivery.targetKey,
          status: delivery.status,
          providerMessageId: extractProviderMessageId(delivery.responseBody),
          requestBody: delivery.requestBody ?? null,
          responseBody: delivery.responseBody ?? null,
          sentAt: delivery.status === "SENT" ? new Date() : null,
        },
      });
    }
  } catch (error) {
    if (isMissingBiReportPersistenceTableError(error)) {
      return;
    }
    throw error;
  }
}

export async function completeBiReportRunPersistence(input: {
  runId: string;
  queryMode: "sample_input" | "custom_sql" | "odps";
  effectiveSql: string;
  sqlParams: Record<string, string>;
  queryWarnings?: string[];
  assetSource?: string | null;
  prepared: PreparedBiReportDryRun;
  sendDecision?: BiReportSendDecision | null;
  deliveryPreviews: BiReportDeliveryPreview[];
}) {
  try {
    const finishedAt = new Date();
    const runStatus = deriveBiReportRunStatus({
      shouldSend: input.prepared.evaluation.shouldSend,
      deliveryPreviews: input.deliveryPreviews,
    });
    await db.biReportRun.update({
      where: {
        id: input.runId,
      },
      data: {
        status: runStatus,
        severity: input.prepared.evaluation.severity,
        rowCount: input.prepared.rows.length,
        querySummaryJson: JSON.stringify({
          queryMode: input.queryMode,
          sql: input.effectiveSql,
          sqlParams: input.sqlParams,
          assetSource: input.assetSource ?? null,
          windowLabel: input.prepared.windowLabel,
        }),
        metricsJson: JSON.stringify(input.prepared.computed),
        criteriaResultJson: JSON.stringify({
          severity: input.prepared.evaluation.severity,
          matchedRules: input.prepared.evaluation.matchedRules,
          topFindings: input.prepared.evaluation.topFindings,
          shouldSend: input.prepared.evaluation.shouldSend,
          silenceThreshold: input.prepared.evaluation.silenceThreshold,
        }),
        deterministicSummaryJson: JSON.stringify({
          windowLabel: input.prepared.windowLabel,
          summaryMetrics: input.prepared.computed.summaryMetrics,
          continuityStatus: input.prepared.recentRunContext.continuityStatus,
          feedbackContext: input.prepared.recentFeedbackContext.feedbackContext,
          message: input.prepared.message,
          analysisMeta: {
            generationMode: input.prepared.analysis.generationMode ?? null,
            promptKey: readLlmMetaString(input.prepared.analysis.llmMeta, "promptKey"),
            promptVersion: readLlmMetaString(input.prepared.analysis.llmMeta, "promptVersion"),
            model: readLlmMetaString(input.prepared.analysis.llmMeta, "model"),
            modelVersion: readLlmMetaString(input.prepared.analysis.llmMeta, "modelVersion"),
            sendDecision: input.sendDecision
              ? {
                  reason: input.sendDecision.reason,
                  dedupeWindowMinutes: input.sendDecision.dedupeWindowMinutes,
                  suppressed: !input.sendDecision.shouldSend,
                }
              : null,
            queryWarnings: input.queryWarnings ?? [],
            reviewer: readBiReportReviewerSummary(input.prepared.analysis.llmMeta),
          },
        }),
        analysisJson: JSON.stringify(input.prepared.analysis),
        llmMetaJson: input.prepared.analysis.llmMeta
          ? JSON.stringify(input.prepared.analysis.llmMeta)
          : null,
        errorSummary: null,
        finishedAt,
      },
    });
    await db.biReportSubscription.updateMany({
      where: {
        runs: {
          some: {
            id: input.runId,
          },
        },
      },
      data: {
        lastSucceededAt: finishedAt,
      },
    });
  } catch (error) {
    if (isMissingBiReportPersistenceTableError(error)) {
      return;
    }
    throw error;
  }
}

type BiReportExecutionHintRow = {
  runId: string;
  skillKey: string;
  startedAt: Date;
  finishedAt: Date | null;
  deterministicSummaryJson: string | null;
  llmMetaJson: string | null;
};

type BiReportRunReadoutRow = {
  runId: string;
  skillKey: string;
  status: BiReportRunReadoutSummary["status"];
  severity: NonNullable<BiReportRunReadoutSummary["severity"]> | null;
  rowCount: number;
  scheduledFor: Date;
  startedAt: Date;
  finishedAt: Date | null;
  errorSummary: string | null;
};

export async function listRecentBiReportRunExecutionHints(input: {
  workspaceId: string;
  extensionKey?: string | null;
  skillKey: string;
  take: number;
}): Promise<BiReportRunExecutionHint[]> {
  try {
    const rows = await db.biReportRun.findMany({
      where: {
        workspaceId: input.workspaceId,
        ...(input.extensionKey == null ? {} : { extensionKey: input.extensionKey }),
        subscription: {
          skillKey: input.skillKey,
        },
      },
      orderBy: {
        startedAt: "desc",
      },
      take: Math.max(1, Math.min(input.take, 20)),
      select: {
        id: true,
        startedAt: true,
        finishedAt: true,
        deterministicSummaryJson: true,
        llmMetaJson: true,
        subscription: {
          select: {
            skillKey: true,
          },
        },
      },
    });

    return rows.map((row) =>
      mapBiReportExecutionHintRow({
        runId: row.id,
        // The query is already scoped by input.skillKey, so a missing relation
        // should degrade to the requested skill rather than widen this hint type.
        skillKey: row.subscription?.skillKey ?? input.skillKey,
        startedAt: row.startedAt,
        finishedAt: row.finishedAt,
        deterministicSummaryJson: row.deterministicSummaryJson,
        llmMetaJson: row.llmMetaJson,
      }),
    );
  } catch (error) {
    if (isMissingBiReportPersistenceTableError(error)) {
      return [];
    }
    throw error;
  }
}

export async function listRecentBiReportRunReadoutSummaries(input: {
  workspaceId: string;
  extensionKey?: string | null;
  skillKey: string;
  take: number;
}): Promise<BiReportRunReadoutSummary[]> {
  try {
    const rows = await db.biReportRun.findMany({
      where: {
        workspaceId: input.workspaceId,
        ...(input.extensionKey == null ? {} : { extensionKey: input.extensionKey }),
        subscription: {
          skillKey: input.skillKey,
        },
      },
      orderBy: {
        startedAt: "desc",
      },
      take: Math.max(1, Math.min(input.take, 20)),
      select: {
        id: true,
        status: true,
        severity: true,
        rowCount: true,
        scheduledFor: true,
        startedAt: true,
        finishedAt: true,
        errorSummary: true,
        subscription: {
          select: {
            skillKey: true,
          },
        },
      },
    });

    return rows.map((row) =>
      mapBiReportRunReadoutRow({
        runId: row.id,
        skillKey: row.subscription.skillKey,
        status: row.status,
        severity: row.severity,
        rowCount: row.rowCount,
        scheduledFor: row.scheduledFor,
        startedAt: row.startedAt,
        finishedAt: row.finishedAt,
        errorSummary: row.errorSummary,
      }),
    );
  } catch (error) {
    if (isMissingBiReportPersistenceTableError(error)) {
      return [];
    }
    throw error;
  }
}

export function summarizeBiReportReviewIssueStats(
  hints: BiReportRunExecutionHint[],
): BiReportReviewIssueStat[] {
  const counts = new Map<BiReportReviewIssueCode, number>();
  for (const hint of hints) {
    for (const code of hint.reviewIssueCodes) {
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((left, right) => right.count - left.count || left.code.localeCompare(right.code));
}

export function summarizeBiReportQueryWarningStats(
  hints: BiReportRunExecutionHint[],
): BiReportQueryWarningStat[] {
  const counts = new Map<string, number>();
  for (const hint of hints) {
    for (const warning of hint.queryWarnings) {
      counts.set(warning, (counts.get(warning) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([warning, count]) => ({ warning, count }))
    .sort((left, right) => right.count - left.count || left.warning.localeCompare(right.warning));
}

export function summarizeBiReportReviewIssueTrend(input: {
  hints: BiReportRunExecutionHint[];
  latestWindowSize: number;
  baselineWindowSize: number;
}): BiReportRiskTrend | null {
  const latestWindow = input.hints.slice(0, input.latestWindowSize);
  const baselineWindow = input.hints.slice(0, input.baselineWindowSize);
  if (latestWindow.length === 0 || baselineWindow.length === 0) {
    return {
      label: "Reviewer 问题",
      latestWindowCount: latestWindow.reduce((sum, item) => sum + item.reviewIssueCount, 0),
      baselineWindowCount: baselineWindow.reduce((sum, item) => sum + item.reviewIssueCount, 0),
      trend: "insufficient_data",
    };
  }

  const latestWindowCount = latestWindow.reduce((sum, item) => sum + item.reviewIssueCount, 0);
  const baselineWindowCount = baselineWindow.reduce((sum, item) => sum + item.reviewIssueCount, 0);

  return {
    label: "Reviewer 问题",
    latestWindowCount,
    baselineWindowCount,
    trend: compareWindowCounts(latestWindowCount, baselineWindowCount),
  };
}

export function summarizeBiReportQueryWarningTrend(input: {
  hints: BiReportRunExecutionHint[];
  latestWindowSize: number;
  baselineWindowSize: number;
}): BiReportRiskTrend | null {
  const latestWindow = input.hints.slice(0, input.latestWindowSize);
  const baselineWindow = input.hints.slice(0, input.baselineWindowSize);
  if (latestWindow.length === 0 || baselineWindow.length === 0) {
    return {
      label: "查询口径风险",
      latestWindowCount: latestWindow.reduce((sum, item) => sum + item.queryWarnings.length, 0),
      baselineWindowCount: baselineWindow.reduce((sum, item) => sum + item.queryWarnings.length, 0),
      trend: "insufficient_data",
    };
  }

  const latestWindowCount = latestWindow.reduce((sum, item) => sum + item.queryWarnings.length, 0);
  const baselineWindowCount = baselineWindow.reduce((sum, item) => sum + item.queryWarnings.length, 0);

  return {
    label: "查询口径风险",
    latestWindowCount,
    baselineWindowCount,
    trend: compareWindowCounts(latestWindowCount, baselineWindowCount),
  };
}

export function summarizeBiReportEffectiveness(input: {
  runs: BiReportRunMemoryEntry[];
  feedbacks: BiReportFeedbackMemoryEntry[];
  hints: BiReportRunExecutionHint[];
}): BiReportEffectivenessSummary {
  const runCount = input.runs.length;
  const sendCount = input.runs.filter((run) => run.shouldSend).length;
  const suppressedCount = input.hints.filter((hint) => hint.sendSuppressed).length;
  const feedbackCount = input.feedbacks.length;
  const falsePositiveCount = input.feedbacks.filter((feedback) => feedback.isFalsePositive === true).length;
  const actionableFeedbacks = input.feedbacks.filter((feedback) => feedback.actionEffective != null);
  const actionEffectiveCount = actionableFeedbacks.filter((feedback) => feedback.actionEffective === true).length;
  const ruleAdjustmentCount = input.feedbacks.filter((feedback) => feedback.needsRuleAdjustment === true).length;

  return {
    runCount,
    sendCount,
    sendRate: runCount > 0 ? sendCount / runCount : 0,
    suppressedCount,
    feedbackCount,
    falsePositiveCount,
    falsePositiveRate: feedbackCount > 0 ? falsePositiveCount / feedbackCount : null,
    actionableFeedbackCount: actionableFeedbacks.length,
    actionEffectiveCount,
    actionEffectiveRate: actionableFeedbacks.length > 0 ? actionEffectiveCount / actionableFeedbacks.length : null,
    ruleAdjustmentCount,
  };
}

export function summarizeBiReportRuleOptimizationSuggestions(input: {
  runs: BiReportRunMemoryEntry[];
  feedbacks: BiReportFeedbackMemoryEntry[];
  hints: BiReportRunExecutionHint[];
  executionLogs?: BiReportHandoffExecutionLogRecord[];
}): BiReportRuleOptimizationSuggestion[] {
  const suggestions: BiReportRuleOptimizationSuggestion[] = [];
  const effectiveness = summarizeBiReportEffectiveness(input);
  const queryWarningStats = summarizeBiReportQueryWarningStats(input.hints);
  const reviewIssueStats = summarizeBiReportReviewIssueStats(input.hints);
  const latestRunAt = input.runs[0]?.createdAt ?? null;
  const latestFeedbackAt = input.feedbacks[0]?.createdAt ?? null;
  const latestHintAt = input.hints[0]?.startedAt ?? null;
  const latestExecutionLogAt = input.executionLogs?.[0]?.updatedAt ?? null;
  const ineffectiveResults =
    input.executionLogs?.filter(
      (log) => log.stage === "result" && log.isEffective === false,
    ) ?? [];
  const followUpResults =
    input.executionLogs?.filter(
      (log) => log.stage === "result" && log.followUpNeeded === true,
    ) ?? [];

  if (effectiveness.falsePositiveCount > 0) {
    suggestions.push({
      id: "false-positive-review",
      category: "threshold_review",
      title: "复核告警阈值或过滤条件",
      reason:
        effectiveness.falsePositiveRate != null
          ? `最近反馈里有 ${effectiveness.falsePositiveCount} 次误报，误报率约 ${(effectiveness.falsePositiveRate * 100).toFixed(0)}%。`
          : `最近反馈里有 ${effectiveness.falsePositiveCount} 次误报，需要复核阈值和过滤条件。`,
      evidenceCount: effectiveness.falsePositiveCount,
      level: effectiveness.falsePositiveRate != null && effectiveness.falsePositiveRate >= 0.3 ? "action" : "warning",
      priority: effectiveness.falsePositiveRate != null && effectiveness.falsePositiveRate >= 0.3 ? "high" : "medium",
      bucket: effectiveness.falsePositiveRate != null && effectiveness.falsePositiveRate >= 0.3 ? "immediate" : "this_week",
      latestEvidenceAt: latestFeedbackAt,
    });
  }

  if (effectiveness.ruleAdjustmentCount > 0) {
    suggestions.push({
      id: "feedback-rule-adjustment",
      category: "threshold_review",
      title: "处理人工建议调规则反馈",
      reason: `最近反馈里有 ${effectiveness.ruleAdjustmentCount} 次明确提出需要调规则。`,
      evidenceCount: effectiveness.ruleAdjustmentCount,
      level: "action",
      priority: "high",
      bucket: "immediate",
      latestEvidenceAt: latestFeedbackAt,
    });
  }

  if (queryWarningStats[0] && queryWarningStats[0].count >= 2) {
    suggestions.push({
      id: "query-guard-hardening",
      category: "query_governance",
      title: "固化查询口径保护",
      reason: `最近最常见的查询风险“${queryWarningStats[0].warning}”已出现 ${queryWarningStats[0].count} 次。`,
      evidenceCount: queryWarningStats[0].count,
      level: "warning",
      priority: "medium",
      bucket: "this_week",
      latestEvidenceAt: latestHintAt,
    });
  }

  if (reviewIssueStats[0] && reviewIssueStats[0].count >= 2) {
    suggestions.push({
      id: "reviewer-prompt-tightening",
      category: "reviewer_tuning",
      title: "收紧解释提示词或 reviewer 约束",
      reason: `最近 reviewer 最常见问题出现 ${reviewIssueStats[0].count} 次，建议继续收紧解释边界。`,
      evidenceCount: reviewIssueStats[0].count,
      level: "info",
      priority: "low",
      bucket: "observe",
      latestEvidenceAt: latestHintAt,
    });
  }

  if (effectiveness.runCount > 0 && effectiveness.sendRate < 0.2) {
    suggestions.push({
      id: "send-threshold-review",
      category: "send_policy",
      title: "评估当前发送门槛是否过高",
      reason: `最近 ${effectiveness.runCount} 次运行中仅 ${effectiveness.sendCount} 次进入发送，发送率约 ${(effectiveness.sendRate * 100).toFixed(0)}%。`,
      evidenceCount: effectiveness.sendCount,
      level: "info",
      priority: "low",
      bucket: "observe",
      latestEvidenceAt: latestRunAt,
    });
  }

  if (effectiveness.suppressedCount >= 2) {
    suggestions.push({
      id: "dedupe-policy-review",
      category: "send_policy",
      title: "复核降噪窗口是否过宽",
      reason: `最近有 ${effectiveness.suppressedCount} 次运行被智能降噪跳过，建议复核 dedupe window 和升级策略。`,
      evidenceCount: effectiveness.suppressedCount,
      level: effectiveness.suppressedCount >= 4 ? "warning" : "info",
      priority: effectiveness.suppressedCount >= 4 ? "medium" : "low",
      bucket: effectiveness.suppressedCount >= 4 ? "this_week" : "observe",
      latestEvidenceAt: latestHintAt,
    });
  }

  if (input.runs.length >= 3 && input.feedbacks.length === 0) {
    suggestions.push({
      id: "missing-feedback-loop",
      category: "feedback_backfill",
      title: "补充人工复盘，形成学习闭环",
      reason: `最近已有 ${input.runs.length} 次运行，但还没有人工反馈，建议补录 confirmedCause / confirmedAction。`,
      evidenceCount: input.runs.length,
      level: "warning",
      priority: "medium",
      bucket: "this_week",
      latestEvidenceAt: latestRunAt,
    });
  }

  if (ineffectiveResults.length > 0 || followUpResults.length >= 2) {
    suggestions.push({
      id: "execution-playbook-refresh",
      category: "action_playbook",
      title: "沉淀并更新经营处理打法",
      reason:
        ineffectiveResults.length > 0
          ? `最近有 ${ineffectiveResults.length} 次执行结果明确标记为无效，建议更新这类 BI 信号的默认处理打法。`
          : `最近有 ${followUpResults.length} 次处理结果仍需继续跟进，建议把处理步骤和后续观察要点固化成标准打法。`,
      evidenceCount: Math.max(ineffectiveResults.length, followUpResults.length),
      level: ineffectiveResults.length > 0 ? "warning" : "info",
      priority: ineffectiveResults.length > 0 ? "medium" : "low",
      bucket: ineffectiveResults.length > 0 ? "this_week" : "observe",
      latestEvidenceAt: latestExecutionLogAt,
    });
  }

  return suggestions.sort(compareOptimizationSuggestions);
}

export function summarizeBiReportSimilarCasePreview(input: {
  runs: BiReportRunMemoryEntry[];
  feedbacks: BiReportFeedbackMemoryEntry[];
  executionLogs?: BiReportHandoffExecutionLogRecord[];
}): BiReportSimilarCasePreview | null {
  const latestRun = input.runs[0] ?? null;
  const relatedRun =
    input.runs.find((run) => run.windowLabel !== latestRun?.windowLabel) ??
    latestRun;
  const relatedFeedback =
    input.feedbacks.find((feedback) => feedback.windowLabel && feedback.windowLabel !== latestRun?.windowLabel) ??
    input.feedbacks[0] ??
    null;

  if (!relatedRun && !relatedFeedback) {
    return null;
  }

  const latestPlan =
    input.executionLogs?.find((log) => log.stage === "plan") ?? null;
  const latestResult =
    input.executionLogs?.find((log) => log.stage === "result") ?? null;

  return {
    windowLabel: relatedRun?.windowLabel ?? relatedFeedback?.windowLabel ?? null,
    severity: relatedRun?.severity ?? null,
    confirmedCause: relatedFeedback?.confirmedCause ?? null,
    confirmedAction: relatedFeedback?.confirmedAction ?? null,
    falsePositiveSignal: relatedFeedback?.isFalsePositive === true,
    latestPlanSummary: latestPlan?.summary ?? null,
    latestResultSummary: latestResult?.summary ?? null,
    latestExecutionEffective: latestResult?.isEffective ?? null,
  };
}

export async function getLatestBiReportRunExecutionHint(input: {
  workspaceId: string;
  extensionKey?: string | null;
  skillKey: string;
}): Promise<BiReportRunExecutionHint | null> {
  try {
    const hints = await listRecentBiReportRunExecutionHints({
      ...input,
      take: 1,
    });
    return hints[0] ?? null;
  } catch (error) {
    if (isMissingBiReportPersistenceTableError(error)) {
      return null;
    }
    throw error;
  }
}

export async function failBiReportRunPersistence(input: {
  runId: string;
  errorSummary: string;
}) {
  try {
    const finishedAt = new Date();
    await db.biReportRun.update({
      where: {
        id: input.runId,
      },
      data: {
        status: "FAILED",
        errorSummary: input.errorSummary,
        finishedAt,
      },
    });
    await db.biReportSubscription.updateMany({
      where: {
        runs: {
          some: {
            id: input.runId,
          },
        },
      },
      data: {
        lastFailedAt: finishedAt,
      },
    });
  } catch (error) {
    if (isMissingBiReportPersistenceTableError(error)) {
      return;
    }
    throw error;
  }
}

export async function markStaleBiReportRuns(input: {
  workspaceId: string;
  extensionKey?: string | null;
  staleAfterMs?: number;
  now?: Date;
}) {
  try {
    const now = input.now ?? new Date();
    const staleAfterMs = input.staleAfterMs ?? BI_REPORT_STALE_RUNNING_WINDOW_MS;
    const staleStartedAt = new Date(now.getTime() - staleAfterMs);

    const staleRuns = await db.biReportRun.findMany({
      where: {
        workspaceId: input.workspaceId,
        ...(input.extensionKey == null ? {} : { extensionKey: input.extensionKey }),
        status: "RUNNING",
        startedAt: {
          lte: staleStartedAt,
        },
      },
      select: {
        id: true,
      },
      orderBy: {
        startedAt: "asc",
      },
      take: 100,
    });

    if (staleRuns.length === 0) {
      return {
        staleCount: 0,
      };
    }

    const staleRunIds = staleRuns.map((run) => run.id);
    await db.biReportRun.updateMany({
      where: {
        id: {
          in: staleRunIds,
        },
      },
      data: {
        status: "FAILED",
        errorSummary: `Marked stale after running longer than ${Math.round(staleAfterMs / 60000)} minutes.`,
        finishedAt: now,
      },
    });
    await db.biReportSubscription.updateMany({
      where: {
        runs: {
          some: {
            id: {
              in: staleRunIds,
            },
          },
        },
      },
      data: {
        lastFailedAt: now,
      },
    });

    return {
      staleCount: staleRunIds.length,
      staleRunIds,
    };
  } catch (error) {
    if (isMissingBiReportPersistenceTableError(error)) {
      return {
        staleCount: 0,
      };
    }
    throw error;
  }
}

export async function listActiveBiReportSubscriptions(input: {
  workspaceId: string;
  extensionKey?: string | null;
  skillKeys?: string[];
}) {
  try {
    const rows = await db.biReportSubscription.findMany({
      where: {
        workspaceId: input.workspaceId,
        extensionKey: input.extensionKey ?? null,
        enabled: true,
        ...(input.skillKeys?.length
          ? {
              skillKey: {
                in: input.skillKeys,
              },
            }
          : {}),
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        name: true,
        skillKey: true,
        skillVersion: true,
        enabled: true,
        scheduleCron: true,
        timezone: true,
        sqlParamsJson: true,
        analysisOverridesJson: true,
        deliveryTargetsJson: true,
        silencePolicyJson: true,
        dedupeWindowMinutes: true,
      },
    });

    return rows.map((row) => ({
      id: row.id,
      config: {
        name: row.name,
        skillKey: row.skillKey,
        skillVersion: row.skillVersion,
        enabled: row.enabled,
        scheduleCron: row.scheduleCron,
        timezone: row.timezone,
        sqlParams: safeParseJson<Record<string, string>>(row.sqlParamsJson, {}),
        deliveryTargets: safeParseJson<BiReportSubscriptionConfig["deliveryTargets"]>(row.deliveryTargetsJson, []),
        signalRouting:
          safeParseJson<{ signalRouting?: BiReportSubscriptionConfig["signalRouting"] } | null>(
            row.analysisOverridesJson,
            null,
          )?.signalRouting ?? undefined,
        silencePolicy: safeParseJson<BiReportSubscriptionConfig["silencePolicy"] | null>(row.silencePolicyJson, null) ?? undefined,
        dedupeWindowMinutes: row.dedupeWindowMinutes ?? undefined,
      } satisfies BiReportSubscriptionConfig,
    }));
  } catch (error) {
    if (isMissingBiReportPersistenceTableError(error)) {
      return [];
    }
    throw error;
  }
}

export function deriveBiReportRunStatus(input: {
  shouldSend: boolean;
  deliveryPreviews: BiReportDeliveryPreview[];
}) {
  if (!input.shouldSend) {
    return "SKIPPED";
  }

  if (
    input.deliveryPreviews.length > 0 &&
    input.deliveryPreviews.every((item) => item.status === "SKIPPED")
  ) {
    return "SKIPPED";
  }

  const hasFailedDelivery = input.deliveryPreviews.some((item) => item.status === "FAILED");
  if (hasFailedDelivery) {
    return "COMPLETED_WITH_WARNINGS";
  }

  return "COMPLETED";
}

async function syncBiReportSubscriptionRecord(input: {
  workspaceId: string;
  extensionKey?: string | null;
  userId?: string | null;
  skillKey: string;
  skillVersion: string;
  subscription: BiReportSubscriptionConfig;
}) {
  const existing = await db.biReportSubscription.findFirst({
    where: {
      workspaceId: input.workspaceId,
      extensionKey: input.extensionKey ?? null,
      name: input.subscription.name,
      skillKey: input.skillKey,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
    },
  });
  const data = {
    extensionKey: input.extensionKey ?? null,
    name: input.subscription.name,
    skillKey: input.skillKey,
    skillVersion: input.skillVersion,
    enabled: input.subscription.enabled,
    scheduleCron: input.subscription.scheduleCron,
    timezone: input.subscription.timezone,
    sqlParamsJson: JSON.stringify(input.subscription.sqlParams),
    analysisOverridesJson: input.subscription.signalRouting
      ? JSON.stringify({
          signalRouting: input.subscription.signalRouting,
        })
      : null,
    deliveryTargetsJson: JSON.stringify(input.subscription.deliveryTargets),
    silencePolicyJson: input.subscription.silencePolicy
      ? JSON.stringify(input.subscription.silencePolicy)
      : null,
    dedupeWindowMinutes: input.subscription.dedupeWindowMinutes ?? 90,
  };

  if (existing) {
    return db.biReportSubscription.update({
      where: {
        id: existing.id,
      },
      data,
      select: {
        id: true,
      },
    });
  }

  return db.biReportSubscription.create({
    data: {
      workspaceId: input.workspaceId,
      createdByUserId: input.userId ?? null,
      ...data,
    },
    select: {
      id: true,
    },
  });
}

function buildBiReportRunDedupeKey(input: {
  workspaceId: string;
  extensionKey?: string | null;
  skillKey: string;
  scheduledFor: Date;
}) {
  // Deterministic key per (workspace, extension, skill, scheduledFor).
  // R1 review fix: removed crypto.randomUUID() which made every retry / parallel
  // run a unique key, defeating the dedupe semantics this column was named for.
  // See parent doc §4.5 for the lifecycle uniqueness contract this aligns with.
  return [
    input.workspaceId,
    input.extensionKey ?? "no-extension",
    input.skillKey,
    input.scheduledFor.toISOString(),
  ].join(":");
}

function extractProviderMessageId(responseBody: string | null | undefined) {
  if (!responseBody) {
    return null;
  }

  try {
    const parsed = JSON.parse(responseBody) as Record<string, unknown>;
    const taskId = parsed.task_id ?? parsed.taskId ?? parsed.messageId ?? parsed.msgId;
    return typeof taskId === "string" ? taskId : null;
  } catch {
    return null;
  }
}

function safeParseJson<T>(raw: string | null | undefined, fallback: T) {
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function readObject(source: Record<string, unknown> | null, key: string) {
  const value = source?.[key];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function readString(source: Record<string, unknown> | null | undefined, key: string) {
  const value = source?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readLlmMetaString(source: Record<string, unknown> | null | undefined, key: string) {
  return readString(source ?? null, key);
}

function readBoolean(source: Record<string, unknown> | null | undefined, key: string) {
  const value = source?.[key];
  return typeof value === "boolean" ? value : null;
}

function readStringList(source: Record<string, unknown> | null | undefined, key: string) {
  const value = source?.[key];
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
}

function readReviewIssueCodeList(source: Record<string, unknown> | null | undefined, key: string) {
  const allowed = new Set<BiReportReviewIssueCode>([
    "SPECULATION_AS_FACT",
    "OUT_OF_EVIDENCE_SCOPE",
    "BOUNDARY_VIOLATION",
    "OVERSTRONG_ACTION",
  ]);
  return readStringList(source, key).filter(
    (item): item is BiReportReviewIssueCode => allowed.has(item as BiReportReviewIssueCode),
  );
}

function readBiReportReviewerSummary(source: Record<string, unknown> | null | undefined) {
  const reviewer = readObject(source ?? null, "reviewer");
  if (!reviewer) {
    return null;
  }

  return {
    approved: readBoolean(reviewer, "approved"),
    issueCodes: readReviewIssueCodeList(reviewer, "issueCodes"),
    issueNotes: readStringList(reviewer, "issueNotes"),
    rewritten: readBoolean(reviewer, "rewritten") ?? false,
  };
}

function readBiReportReviewApproved(
  llmMeta: Record<string, unknown> | null,
  embeddedMeta: Record<string, unknown> | null,
) {
  const reviewer =
    readObject(llmMeta, "reviewer") ?? readObject(embeddedMeta, "reviewer");
  return reviewer ? readBoolean(reviewer, "approved") : null;
}

function readBiReportReviewIssueCodes(
  llmMeta: Record<string, unknown> | null,
  embeddedMeta: Record<string, unknown> | null,
) {
  const reviewer =
    readObject(llmMeta, "reviewer") ?? readObject(embeddedMeta, "reviewer");
  return reviewer ? readReviewIssueCodeList(reviewer, "issueCodes") : [];
}

function readBiReportReviewIssueNotes(
  llmMeta: Record<string, unknown> | null,
  embeddedMeta: Record<string, unknown> | null,
) {
  const reviewer =
    readObject(llmMeta, "reviewer") ?? readObject(embeddedMeta, "reviewer");
  return reviewer ? readStringList(reviewer, "issueNotes") : [];
}

function readBiReportReviewRewritten(
  llmMeta: Record<string, unknown> | null,
  embeddedMeta: Record<string, unknown> | null,
) {
  const reviewer =
    readObject(llmMeta, "reviewer") ?? readObject(embeddedMeta, "reviewer");
  return reviewer ? (readBoolean(reviewer, "rewritten") ?? false) : false;
}

function mapBiReportExecutionHintRow(row: BiReportExecutionHintRow): BiReportRunExecutionHint {
  const deterministicSummary = safeParseJson<Record<string, unknown> | null>(
    row.deterministicSummaryJson,
    null,
  );
  const embeddedMeta = readObject(deterministicSummary, "analysisMeta");
  const llmMeta = safeParseJson<Record<string, unknown> | null>(row.llmMetaJson, null);
  const reviewIssueCodes = readBiReportReviewIssueCodes(llmMeta, embeddedMeta);

  return {
    runId: row.runId,
    skillKey: row.skillKey,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
    generationMode: normalizeGenerationMode(readString(embeddedMeta, "generationMode")),
    promptKey: readString(llmMeta, "promptKey") ?? readString(embeddedMeta, "promptKey"),
    promptVersion: readString(llmMeta, "promptVersion") ?? readString(embeddedMeta, "promptVersion"),
    model: readString(llmMeta, "model") ?? readString(embeddedMeta, "model"),
    modelVersion: readString(llmMeta, "modelVersion") ?? readString(embeddedMeta, "modelVersion"),
    reviewApproved: readBiReportReviewApproved(llmMeta, embeddedMeta),
    reviewIssueCount: reviewIssueCodes.length,
    reviewIssueCodes,
    reviewIssueNotes: readBiReportReviewIssueNotes(llmMeta, embeddedMeta),
    reviewRewritten: readBiReportReviewRewritten(llmMeta, embeddedMeta),
    sendDecisionReason: readBiReportSendDecisionReason(embeddedMeta),
    sendSuppressed: readBiReportSendSuppressed(embeddedMeta),
    dedupeWindowMinutes: readBiReportDedupeWindowMinutes(embeddedMeta),
    queryWarnings: readStringList(embeddedMeta, "queryWarnings"),
  };
}

function mapBiReportRunReadoutRow(row: BiReportRunReadoutRow): BiReportRunReadoutSummary {
  const failure = summarizeBiReportRunFailure({
    status: row.status,
    errorSummary: row.errorSummary,
  });

  return {
    runId: row.runId,
    skillKey: row.skillKey,
    status: row.status,
    severity: row.severity,
    rowCount: row.rowCount,
    scheduledFor: row.scheduledFor.toISOString(),
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
    errorSummary: row.errorSummary,
    failureStage: failure.failureStage,
    actionableReason: failure.actionableReason,
    impactsSignalGeneration: failure.impactsSignalGeneration,
    nextStep: failure.nextStep,
  };
}

function summarizeBiReportRunFailure(input: {
  status: BiReportRunReadoutSummary["status"];
  errorSummary: string | null;
}) {
  if (input.status !== "FAILED") {
    return {
      failureStage: null,
      actionableReason: null,
      impactsSignalGeneration: false,
      nextStep: null,
    } satisfies Pick<
      BiReportRunReadoutSummary,
      "failureStage" | "actionableReason" | "impactsSignalGeneration" | "nextStep"
    >;
  }

  const error = (input.errorSummary ?? "").toLowerCase();

  if (
    error.includes("odps") ||
    error.includes("query") ||
    error.includes("fetch failed") ||
    error.includes("network") ||
    error.includes("econnreset") ||
    error.includes("etimedout") ||
    error.includes("socket hang up")
  ) {
    return {
      failureStage: "query",
      actionableReason: "ODPS 查询或上游查询桥接不可用、超时或网络失败，当前运行没有完成信号输入构建。",
      impactsSignalGeneration: true,
      nextStep: "检查 BI_REPORT_ODPS_MCP_COMMAND / BI_REPORT_ODPS_API_URL、上游查询服务可用性与分区口径。",
    } satisfies Pick<
      BiReportRunReadoutSummary,
      "failureStage" | "actionableReason" | "impactsSignalGeneration" | "nextStep"
    >;
  }

  if (
    error.includes("invalid_api_key") ||
    error.includes("unauthorized") ||
    error.includes("provider_error") ||
    error.includes("dashscope") ||
    error.includes("openai")
  ) {
    return {
      failureStage: "analysis",
      actionableReason: "LLM 分析或 reviewer 调用失败，当前运行可能回退或中断在解释层。",
      impactsSignalGeneration: true,
      nextStep: "检查 DASHSCOPE / OPENAI 凭据、模型配置与 provider 网络连通性。",
    } satisfies Pick<
      BiReportRunReadoutSummary,
      "failureStage" | "actionableReason" | "impactsSignalGeneration" | "nextStep"
    >;
  }

  if (
    error.includes("dingtalk") ||
    error.includes("webhook") ||
    error.includes("unionid") ||
    error.includes("delivery")
  ) {
    return {
      failureStage: "delivery",
      actionableReason: "信号已进入交付阶段，但通知通道或发送配置失败。",
      impactsSignalGeneration: false,
      nextStep: "检查 BI_REPORT_DINGTALK_* 目标配置、鉴权参数与对应发送通道状态。",
    } satisfies Pick<
      BiReportRunReadoutSummary,
      "failureStage" | "actionableReason" | "impactsSignalGeneration" | "nextStep"
    >;
  }

  if (
    error.includes("prisma") ||
    error.includes("foreign key") ||
    error.includes("does not exist") ||
    error.includes("no such table")
  ) {
    return {
      failureStage: "persistence",
      actionableReason: "运行结果在持久化阶段失败，租户面可能看不到最新 run / signal / handoff 记录。",
      impactsSignalGeneration: true,
      nextStep: "检查数据库迁移是否齐全，以及 BiReportRun / signal / handoff 相关表的写入权限。",
    } satisfies Pick<
      BiReportRunReadoutSummary,
      "failureStage" | "actionableReason" | "impactsSignalGeneration" | "nextStep"
    >;
  }

  if (error.includes("cron token") || error.includes("unauthorized cron token")) {
    return {
      failureStage: "authorization",
      actionableReason: "定时触发入口鉴权失败，运行没有进入正式收集流程。",
      impactsSignalGeneration: true,
      nextStep: "检查 SIGNAL_COLLECTION_CRON_TOKEN / BI_REPORT_CRON_TOKEN 与外部调度器请求头。",
    } satisfies Pick<
      BiReportRunReadoutSummary,
      "failureStage" | "actionableReason" | "impactsSignalGeneration" | "nextStep"
    >;
  }

  return {
    failureStage: "unknown",
    actionableReason: "最近一次运行失败，但当前错误还不能自动归类到固定阶段。",
    impactsSignalGeneration: true,
    nextStep: "查看 errorSummary 与关联 traceId，定位失败发生在查询、解释、持久化还是交付阶段。",
  } satisfies Pick<
    BiReportRunReadoutSummary,
    "failureStage" | "actionableReason" | "impactsSignalGeneration" | "nextStep"
  >;
}

function normalizeGenerationMode(value: string | null) {
  return value === "fallback" || value === "llm_enhanced" ? value : null;
}

function compareWindowCounts(latestWindowCount: number, baselineWindowCount: number) {
  if (latestWindowCount > baselineWindowCount) {
    return "up" as const;
  }
  if (latestWindowCount < baselineWindowCount) {
    return "down" as const;
  }
  return "flat" as const;
}

function compareOptimizationSuggestions(
  left: BiReportRuleOptimizationSuggestion,
  right: BiReportRuleOptimizationSuggestion,
) {
  const bucketRank = rankOptimizationBucket(left.bucket) - rankOptimizationBucket(right.bucket);
  if (bucketRank !== 0) {
    return bucketRank;
  }

  const priorityRank = rankOptimizationPriority(left.priority) - rankOptimizationPriority(right.priority);
  if (priorityRank !== 0) {
    return priorityRank;
  }

  const leftTime = left.latestEvidenceAt ? Date.parse(left.latestEvidenceAt) : 0;
  const rightTime = right.latestEvidenceAt ? Date.parse(right.latestEvidenceAt) : 0;
  if (leftTime !== rightTime) {
    return rightTime - leftTime;
  }

  return right.evidenceCount - left.evidenceCount || left.title.localeCompare(right.title);
}

function rankOptimizationBucket(bucket: BiReportRuleOptimizationSuggestion["bucket"]) {
  switch (bucket) {
    case "immediate":
      return 0;
    case "this_week":
      return 1;
    case "observe":
      return 2;
  }
}

function rankOptimizationPriority(priority: BiReportRuleOptimizationSuggestion["priority"]) {
  switch (priority) {
    case "high":
      return 0;
    case "medium":
      return 1;
    case "low":
      return 2;
  }
}

function readBiReportSendDecision(source: Record<string, unknown> | null) {
  return readObject(source, "sendDecision");
}

function readBiReportSendDecisionReason(source: Record<string, unknown> | null) {
  const sendDecision = readBiReportSendDecision(source);
  const reason = readString(sendDecision, "reason");
  return reason === "criteria_not_met" ||
    reason === "criteria_met" ||
    reason === "severity_escalated" ||
    reason === "worsening" ||
    reason === "duplicate_within_dedupe_window"
    ? reason
    : null;
}

function readBiReportSendSuppressed(source: Record<string, unknown> | null) {
  const sendDecision = readBiReportSendDecision(source);
  return readBoolean(sendDecision, "suppressed") ?? false;
}

function readBiReportDedupeWindowMinutes(source: Record<string, unknown> | null) {
  const sendDecision = readBiReportSendDecision(source);
  const value = sendDecision?.dedupeWindowMinutes;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function isMissingBiReportPersistenceTableError(error: unknown) {
  return isMissingTableError(error);
}
