import type { BiReportBusinessHandoffDraft, BiReportBusinessSignalRecord, BiReportSeverity } from "@/lib/bi-report-skill/types";

const severityPriorityMap: Record<BiReportSeverity, BiReportBusinessHandoffDraft["priority"]> = {
  CLEAR: "low",
  WATCH: "low",
  WARN: "medium",
  ALERT: "high",
  CRITICAL: "high",
};

export function buildBiReportBusinessHandoffDrafts(signal: BiReportBusinessSignalRecord): BiReportBusinessHandoffDraft[] {
  const base = {
    ownerUserId: signal.ownerUserId,
    ownerUserName: signal.ownerUserName,
    sourceSignalId: signal.id,
  } satisfies Pick<BiReportBusinessHandoffDraft, "ownerUserId" | "ownerUserName" | "sourceSignalId">;

  if (signal.severity === "CRITICAL") {
    return [
      {
        ...base,
        targetType: "approval",
        title: `经营审批：${signal.title}`,
        summary: buildSignalDetailSummary(signal),
        priority: "high",
      },
      {
        ...base,
        targetType: "action_item",
        title: `经营动作：${signal.title}`,
        summary: joinHandoffSummary(signal),
        priority: "high",
      },
    ];
  }

  if (signal.severity === "ALERT") {
    return [
      {
        ...base,
        targetType: "action_item",
        title: `经营动作：${signal.title}`,
        summary: joinHandoffSummary(signal),
        priority: "high",
      },
    ];
  }

  return [
    {
      ...base,
      targetType: "recommendation",
      title: `经营建议：${signal.title}`,
      summary: joinHandoffSummary(signal),
      priority: severityPriorityMap[signal.severity],
    },
  ];
}

function joinHandoffSummary(signal: BiReportBusinessSignalRecord) {
  return buildSignalDetailSummary(signal);
}

function buildSignalDetailSummary(signal: BiReportBusinessSignalRecord) {
  const sections = [signal.summary];
  const metricLines = buildMetricDetailLines(signal);

  if (metricLines.length) {
    sections.push(`未达标指标：\n${metricLines.join("\n")}`);
  }

  if (signal.recommendedActions.length) {
    sections.push(`建议动作：\n${signal.recommendedActions.map((item) => `- ${item}`).join("\n")}`);
  }

  return sections.join("\n\n");
}

function buildMetricDetailLines(signal: BiReportBusinessSignalRecord) {
  const metrics = signal.metrics ?? {};
  const evidence = signal.evidence ?? {};

  switch (signal.signalType) {
    case "daily_process_weak_signal":
      return [
        formatMetricComparisonLine("过案户数", metrics.processedUserCount, metrics.processedUserBaseline, readNestedNumber(evidence, ["dropPct", "processedUserCount"])),
        formatMetricComparisonLine("拨打次数", metrics.callOutTimes, metrics.callOutBaseline, readNestedNumber(evidence, ["dropPct", "callOutTimes"])),
        formatMetricComparisonLine("有效通时", metrics.validCallMinutes, metrics.validCallBaseline, readNestedNumber(evidence, ["dropPct", "validCallMinutes"])),
      ].filter(Boolean) as string[];
    case "connect_efficiency_gap":
      return [
        formatMetricComparisonLine("接通户数", metrics.connectedUserCount, metrics.connectedUserBaseline, readNestedNumber(evidence, ["dropPct", "connectedUserCount"])),
        formatMetricComparisonLine("接通次数", metrics.connectedTimes, metrics.connectedTimesBaseline, readNestedNumber(evidence, ["dropPct", "connectedTimes"])),
        formatMetricComparisonLine("本人接通率", metrics.selfConnectRatePct, metrics.selfConnectRateBaselinePct, readNestedNumber(evidence, ["dropPct", "selfConnectRatePct"]), true),
      ].filter(Boolean) as string[];
    case "complaint_risk_rising":
      return [
        formatMetricComparisonLine("投诉量", metrics.complaintCount, metrics.complaintBaseline, readNestedNumber(evidence, ["changePct", "complaintRisePct"])),
        formatMetricComparisonLine("投诉处理率", metrics.complaintResolutionRatePct, metrics.complaintResolutionBaselinePct, readNestedNumber(evidence, ["changePct", "resolutionDropPct"]), true),
      ].filter(Boolean) as string[];
    case "manager_daily_intervention_required": {
      const signalCount = readNumber(metrics.signalCount);
      const relatedSignalTypes = readStringArray(evidence.relatedSignalTypes);
      const lines = [];
      if (signalCount != null) {
        lines.push(`- 异常信号数：当前 ${formatNumber(signalCount)} 个`);
      }
      if (relatedSignalTypes.length) {
        lines.push(`- 涉及信号：${relatedSignalTypes.map(mapSignalTypeLabel).join("、")}`);
      }
      return lines;
    }
    default:
      return [];
  }
}

function formatMetricComparisonLine(
  label: string,
  current: unknown,
  baseline: unknown,
  deltaPct: number | null,
  percent = false,
) {
  const currentValue = readNumber(current);
  const baselineValue = readNumber(baseline);

  if (currentValue == null && baselineValue == null && deltaPct == null) {
    return null;
  }

  const details = [
    currentValue == null ? null : `当前 ${formatNumber(currentValue)}${percent ? "%" : ""}`,
    baselineValue == null ? null : `基线 ${formatNumber(baselineValue)}${percent ? "%" : ""}`,
    deltaPct == null ? null : `${percent ? "偏离" : "变化"} ${formatNumber(deltaPct)}%`,
  ].filter(Boolean);

  return details.length ? `- ${label}：${details.join("，")}` : null;
}

function readNestedNumber(source: Record<string, unknown>, path: string[]) {
  let current: unknown = source;
  for (const key of path) {
    if (!current || typeof current !== "object" || !(key in current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return readNumber(current);
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.length > 0) : [];
}

function formatNumber(value: number) {
  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

function mapSignalTypeLabel(value: string) {
  if (value === "daily_process_weak_signal") return "过程偏弱";
  if (value === "connect_efficiency_gap") return "触达偏弱";
  if (value === "complaint_risk_rising") return "投诉风险升高";
  if (value === "manager_daily_intervention_required") return "主管介入";
  return value;
}
