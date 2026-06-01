import type {
  BiReportComputedMetrics,
  BiReportEvaluation,
  BiReportMetricDefinition,
  BiReportRankingDefinition,
  BiReportResultCriteria,
  BiReportSeverity,
} from "@/lib/bi-report-skill/types";
import { biReportSeverities } from "@/lib/bi-report-skill/types";

const severityLabels: Record<BiReportSeverity, string> = {
  CLEAR: "正常",
  WATCH: "关注",
  WARN: "预警",
  ALERT: "告警",
  CRITICAL: "严重",
};

export function evaluateBiReportResult(input: {
  criteria: BiReportResultCriteria;
  metricDefinitions: BiReportMetricDefinition;
  computed: BiReportComputedMetrics;
}): BiReportEvaluation {
  const severityOrder: readonly BiReportSeverity[] = input.criteria.severityOrder ?? biReportSeverities;
  const matchedRules = input.criteria.rules.filter((rule) =>
    compareMetric(input.computed.metricsByKey[rule.metricKey] ?? 0, rule.operator, rule.threshold),
  );

  const severity = matchedRules.reduce<BiReportSeverity>(
    (current, rule) =>
      compareBiReportSeverity(rule.severity, current, severityOrder) > 0 ? rule.severity : current,
    "CLEAR",
  );
  const silenceThreshold = input.criteria.silenceThreshold ?? "WARN";
  const topFindings = buildTopFindings({
    criteria: input.criteria,
    metricDefinitions: input.metricDefinitions,
    computed: input.computed,
    matchedRules,
  });

  return {
    severity,
    matchedRules,
    topFindings,
    shouldSend: compareBiReportSeverity(severity, silenceThreshold, severityOrder) >= 0,
    silenceThreshold,
  };
}

export function compareBiReportSeverity(
  left: BiReportSeverity,
  right: BiReportSeverity,
  order: readonly BiReportSeverity[] = biReportSeverities,
) {
  return order.indexOf(left) - order.indexOf(right);
}

export function getBiReportSeverityLabel(severity: BiReportSeverity) {
  return severityLabels[severity];
}

function compareMetric(value: number, operator: "<" | "<=" | ">" | ">=" | "=", threshold: number) {
  switch (operator) {
    case "<":
      return value < threshold;
    case "<=":
      return value <= threshold;
    case ">":
      return value > threshold;
    case ">=":
      return value >= threshold;
    case "=":
      return value === threshold;
    default:
      return false;
  }
}

function buildTopFindings(input: {
  criteria: BiReportResultCriteria;
  metricDefinitions: BiReportMetricDefinition;
  computed: BiReportComputedMetrics;
  matchedRules: BiReportEvaluation["matchedRules"];
}) {
  const findings = input.matchedRules.map((rule) => `${rule.title}：${rule.reason}`);
  const maxFindings = input.criteria.maxFindings ?? 3;
  const rankingDefinitions = input.metricDefinitions.rankings ?? [];

  for (const rankingDefinition of rankingDefinitions) {
    if (findings.length >= maxFindings) break;
    const lead = input.computed.rankings[rankingDefinition.key]?.[0];
    if (!lead) continue;
    findings.push(describeRankingLead(rankingDefinition, lead.label, lead.score));
  }

  if (findings.length === 0) {
    return ["当前关键指标未触发预警规则。"];
  }

  return findings.slice(0, maxFindings);
}

function describeRankingLead(definition: BiReportRankingDefinition, label: string, score: number) {
  if (definition.type === "row_pct_change") {
    return `${definition.label ?? definition.key}：${label} 环比 ${formatPercent(score)}。`;
  }

  return `${definition.label ?? definition.key}：${label} 当前比率 ${formatPercent(score)}。`;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}
