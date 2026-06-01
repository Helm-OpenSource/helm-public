import {
  CompositionFailureClass,
  ProblemSpaceStatus,
  TruthConflictStatus,
} from "@prisma/client";
import type { TruthReconciliationResult } from "@/lib/operating-system/truth-reconciliation";

export const operatingGapKinds = [
  "unresolved-conflict",
  "missing-owner",
  "missing-next-action",
  "missing-evidence",
  "missing-kpi-link",
  "source-not-connected",
  "blocked-too-long",
  "capability-gap",
] as const;

export type OperatingGapKind = (typeof operatingGapKinds)[number];

export const operatingGapSourceRepresentations = [
  "truth-conflict",
  "problem-space",
  "composition-failure",
  "coordination-metrics",
  "truth-reconciliation",
] as const;

export type OperatingGapSourceRepresentation =
  (typeof operatingGapSourceRepresentations)[number];

export const operatingGapSeverityLevels = [
  "critical",
  "high",
  "medium",
  "low",
] as const;

export type OperatingGapSeverity = (typeof operatingGapSeverityLevels)[number];

export const operatingGapEscalationPostures = [
  "review-required",
  "assign-owner",
  "restore-grounding",
  "connect-source",
  "resolve-capability",
  "watch",
] as const;

export type OperatingGapEscalationPosture =
  (typeof operatingGapEscalationPostures)[number];

export type OperatingGap = {
  id: string;
  gapKey: string;
  workspaceId: string;
  kind: OperatingGapKind;
  severity: OperatingGapSeverity;
  sourceRepresentation: OperatingGapSourceRepresentation;
  title: string;
  summary: string;
  ownerHint: string | null;
  nextActionHint: string | null;
  evidenceRefs: string[];
  evidenceSummary: string;
  escalationPosture: OperatingGapEscalationPosture;
  operatorReviewRequired: boolean;
  href: string;
  updatedAt: Date;
};

export type OperatingGapSummary = {
  totalOpen: number;
  reviewRequired: number;
  escalationRequired: number;
  kindCounts: Array<{
    kind: OperatingGapKind;
    count: number;
  }>;
};

export const businessLoopOperatingGapKinds = [
  "missing-kpi-link",
  "missing-owner",
  "missing-next-action",
  "unresolved-conflict",
  "missing-evidence",
] as const;

export type BusinessLoopOperatingGapKind =
  (typeof businessLoopOperatingGapKinds)[number];

export type BusinessLoopGapSummary = {
  totalOpen: number;
  reviewRequired: number;
  kindCounts: Array<{
    kind: BusinessLoopOperatingGapKind;
    count: number;
  }>;
  primaryGap: OperatingGap | null;
};

export type OperatingGapTruthConflictInput = {
  id: string;
  workspaceId: string;
  summary: string;
  status: TruthConflictStatus | "OPEN" | "RESOLVED" | "SUPPRESSED";
  subjectKey: string;
  href: string;
  createdAt: Date;
};

export type OperatingGapProblemSpaceInput = {
  id: string;
  workspaceId: string;
  title: string;
  summary: string;
  nextStep: string;
  status:
    | ProblemSpaceStatus
    | "DETECTED"
    | "SCOPED"
    | "OPEN"
    | "ASSIGNED"
    | "ACTIVE"
    | "BLOCKED"
    | "WATCHING"
    | "WAITING_ON_SIGNAL"
    | "WAITING_ON_AUTHORITY"
    | "RESOLVED"
    | "RETIRED";
  ownerHint: string | null;
  evidenceRefs: string[];
  href: string;
  updatedAt: Date;
};

export type OperatingGapCompositionFailureInput = {
  id: string;
  workspaceId: string;
  failureClass: CompositionFailureClass | `${CompositionFailureClass}`;
  summary: string;
  problemSpaceTitle: string | null;
  href: string;
  createdAt: Date;
};

export type OperatingGapCoordinationMetricsInput = {
  workspaceId: string;
  metricDate: Date;
  href: string;
};

export const operatingGapBlockedThresholdHours = 72;
export const operatingGapMetricsStaleThresholdHours = 48;

export function createOperatingGapFromTruthConflict(
  input: OperatingGapTruthConflictInput,
): OperatingGap | null {
  if (input.status !== "OPEN") {
    return null;
  }

  return {
    id: input.id,
    gapKey: `${input.workspaceId}:truth-conflict:${input.id}:unresolved-conflict`,
    workspaceId: input.workspaceId,
    kind: "unresolved-conflict",
    severity: "high",
    sourceRepresentation: "truth-conflict",
    title: "Unresolved truth conflict",
    summary: input.summary,
    ownerHint: null,
    nextActionHint: "Resolve the conflicting sources before promoting this line into settled operating truth.",
    evidenceRefs: [input.subjectKey],
    evidenceSummary: `Conflict scope ${input.subjectKey}`,
    escalationPosture: "review-required",
    operatorReviewRequired: true,
    href: input.href,
    updatedAt: input.createdAt,
  };
}

export function createOperatingGapFromProblemSpace(
  input: OperatingGapProblemSpaceInput,
  now: Date,
): OperatingGap[] {
  const gaps: OperatingGap[] = [];
  const evidenceRefs = normalizeRefs(input.evidenceRefs);

  if (!input.ownerHint?.trim()) {
    gaps.push({
      id: `${input.id}:missing-owner`,
      gapKey: `${input.workspaceId}:problem-space:${input.id}:missing-owner`,
      workspaceId: input.workspaceId,
      kind: "missing-owner",
      severity:
        input.status === "ACTIVE" || input.status === "BLOCKED" ? "high" : "medium",
      sourceRepresentation: "problem-space",
      title: "Owner missing",
      summary: `${input.title} still has no explicit owner hint, so the follow-through path cannot be held accountable yet.`,
      ownerHint: null,
      nextActionHint: "Assign an owner hint before treating this problem space as an active operating thread.",
      evidenceRefs,
      evidenceSummary: buildEvidenceSummary(evidenceRefs),
      escalationPosture: "assign-owner",
      operatorReviewRequired: true,
      href: input.href,
      updatedAt: input.updatedAt,
    });
  }

  if (!input.nextStep.trim()) {
    gaps.push({
      id: `${input.id}:missing-next-action`,
      gapKey: `${input.workspaceId}:problem-space:${input.id}:missing-next-action`,
      workspaceId: input.workspaceId,
      kind: "missing-next-action",
      severity: "high",
      sourceRepresentation: "problem-space",
      title: "Next action missing",
      summary: `${input.title} is visible, but it still lacks a concrete next step that an operator can review and route.`,
      ownerHint: input.ownerHint,
      nextActionHint: "Write one bounded next step before promoting this item into active coordination.",
      evidenceRefs,
      evidenceSummary: buildEvidenceSummary(evidenceRefs),
      escalationPosture: "review-required",
      operatorReviewRequired: true,
      href: input.href,
      updatedAt: input.updatedAt,
    });
  }

  if (evidenceRefs.length === 0) {
    gaps.push({
      id: `${input.id}:missing-evidence`,
      gapKey: `${input.workspaceId}:problem-space:${input.id}:missing-evidence`,
      workspaceId: input.workspaceId,
      kind: "missing-evidence",
      severity: "high",
      sourceRepresentation: "problem-space",
      title: "Evidence missing",
      summary: `${input.title} is open, but it has no evidence refs yet, so the operator layer cannot replay why it exists.`,
      ownerHint: input.ownerHint,
      nextActionHint: "Attach grounded evidence before treating this problem space as settled operating context.",
      evidenceRefs,
      evidenceSummary: "No evidence refs attached yet",
      escalationPosture: "restore-grounding",
      operatorReviewRequired: true,
      href: input.href,
      updatedAt: input.updatedAt,
    });
  }

  const blockedHours = Math.round(
    (now.getTime() - input.updatedAt.getTime()) / (60 * 60 * 1000),
  );
  if (
    isWaitingStatus(input.status) &&
    blockedHours >= operatingGapBlockedThresholdHours
  ) {
    gaps.push({
      id: `${input.id}:blocked-too-long`,
      gapKey: `${input.workspaceId}:problem-space:${input.id}:blocked-too-long`,
      workspaceId: input.workspaceId,
      kind: "blocked-too-long",
      severity: "critical",
      sourceRepresentation: "problem-space",
      title: "Blocked too long",
      summary: `${input.title} has stayed in ${input.status} for ${blockedHours} hours, so the operator layer should escalate instead of letting the thread silently age.`,
      ownerHint: input.ownerHint,
      nextActionHint: "Escalate the blocker, refresh the signal, or explicitly retire the thread.",
      evidenceRefs,
      evidenceSummary: buildEvidenceSummary(evidenceRefs),
      escalationPosture: "review-required",
      operatorReviewRequired: true,
      href: input.href,
      updatedAt: input.updatedAt,
    });
  }

  return gaps;
}

export function createOperatingGapFromCompositionFailure(
  input: OperatingGapCompositionFailureInput,
): OperatingGap {
  const mapping = mapCompositionFailureToGap(input.failureClass);
  return {
    id: input.id,
    gapKey: `${input.workspaceId}:composition-failure:${input.id}:${mapping.kind}`,
    workspaceId: input.workspaceId,
    kind: mapping.kind,
    severity: mapping.severity,
    sourceRepresentation: "composition-failure",
    title: mapping.title,
    summary: input.summary,
    ownerHint: null,
    nextActionHint: mapping.nextActionHint,
    evidenceRefs: input.problemSpaceTitle ? [input.problemSpaceTitle] : [],
    evidenceSummary: input.problemSpaceTitle
      ? `Linked problem space ${input.problemSpaceTitle}`
      : "No linked problem space",
    escalationPosture: mapping.escalationPosture,
    operatorReviewRequired: true,
    href: input.href,
    updatedAt: input.createdAt,
  };
}

export function createOperatingGapFromReconciliationResult(input: {
  workspaceId: string;
  result: TruthReconciliationResult;
  href: string;
  updatedAt: Date;
}): OperatingGap | null {
  if (input.result.outcome !== "unresolved") {
    return null;
  }

  return {
    id: `${input.result.subjectKey}:truth-reconciliation`,
    gapKey: `${input.workspaceId}:truth-reconciliation:${input.result.subjectKey}`,
    workspaceId: input.workspaceId,
    kind: "unresolved-conflict",
    severity: input.result.confidence <= 45 ? "critical" : "high",
    sourceRepresentation: "truth-reconciliation",
    title: "Reconciliation still unresolved",
    summary: input.result.summary,
    ownerHint: null,
    nextActionHint: "Review the contested evidence chain before writing this claim into a settled belief or action layer.",
    evidenceRefs: input.result.evidenceChain.flatMap((item) => item.evidenceRefs),
    evidenceSummary: `${input.result.evidenceChain.length} contested evidence entries`,
    escalationPosture: "review-required",
    operatorReviewRequired: true,
    href: input.href,
    updatedAt: input.updatedAt,
  };
}

export function createOperatingGapFromCoordinationMetrics(input: {
  workspaceId: string;
  coordinationMetrics: OperatingGapCoordinationMetricsInput | null;
  now: Date;
}): OperatingGap | null {
  if (!input.coordinationMetrics) {
    return {
      id: `${input.workspaceId}:missing-kpi-link`,
      gapKey: `${input.workspaceId}:coordination-metrics:missing-kpi-link`,
      workspaceId: input.workspaceId,
      kind: "missing-kpi-link",
      severity: "critical",
      sourceRepresentation: "coordination-metrics",
      title: "KPI link pending",
      summary:
        "Current operating loop still has no coordination metrics snapshot, so outcome movement cannot be compared against a current KPI or baseline readout yet.",
      ownerHint: null,
      nextActionHint:
        "Write one daily coordination metrics snapshot or attach one current report baseline before treating this loop as measurable.",
      evidenceRefs: [],
      evidenceSummary: "No coordination metrics snapshot attached yet",
      escalationPosture: "review-required",
      operatorReviewRequired: true,
      href: "/reports",
      updatedAt: input.now,
    };
  }

  const staleHours = Math.round(
    (input.now.getTime() - input.coordinationMetrics.metricDate.getTime()) /
      (60 * 60 * 1000),
  );
  if (staleHours < operatingGapMetricsStaleThresholdHours) {
    return null;
  }

  const metricRef = `coordination-metrics:${input.coordinationMetrics.metricDate.toISOString().slice(0, 10)}`;
  return {
    id: `${input.workspaceId}:stale-kpi-link`,
    gapKey: `${input.workspaceId}:coordination-metrics:stale-kpi-link`,
    workspaceId: input.workspaceId,
    kind: "missing-kpi-link",
    severity: "high",
    sourceRepresentation: "coordination-metrics",
    title: "KPI link stale",
    summary: `The current operating loop still points at a stale coordination metrics snapshot from ${input.coordinationMetrics.metricDate.toISOString().slice(0, 10)}, so KPI linkage needs a fresh baseline before it can guide current judgement.`,
    ownerHint: null,
    nextActionHint:
      "Refresh the coordination metrics snapshot or connect a current report baseline before ranking this loop by outcome movement.",
    evidenceRefs: [metricRef],
    evidenceSummary: `Last metric snapshot ${metricRef}`,
    escalationPosture: "review-required",
    operatorReviewRequired: true,
    href: input.coordinationMetrics.href,
    updatedAt: input.coordinationMetrics.metricDate,
  };
}

export function buildOperatingGapQueue(input: {
  workspaceId: string;
  truthConflicts: OperatingGapTruthConflictInput[];
  problemSpaces: OperatingGapProblemSpaceInput[];
  compositionFailures: OperatingGapCompositionFailureInput[];
  coordinationMetrics?: OperatingGapCoordinationMetricsInput | null;
  now?: Date;
}): OperatingGap[] {
  const now = input.now ?? new Date();
  const gaps = [
    ...input.truthConflicts
      .map((item) => createOperatingGapFromTruthConflict(item))
      .filter((item): item is OperatingGap => Boolean(item)),
    ...input.problemSpaces.flatMap((item) => createOperatingGapFromProblemSpace(item, now)),
    ...input.compositionFailures.map((item) =>
      createOperatingGapFromCompositionFailure(item),
    ),
  ].filter((item): item is OperatingGap => Boolean(item));

  if (input.coordinationMetrics !== undefined) {
    const metricsGap = createOperatingGapFromCoordinationMetrics({
      workspaceId: input.workspaceId,
      coordinationMetrics: input.coordinationMetrics,
      now,
    });
    if (metricsGap) {
      gaps.push(metricsGap);
    }
  }

  return gaps
    .slice()
    .sort((left, right) => {
      const severityDelta =
        getSeverityWeight(right.severity) - getSeverityWeight(left.severity);
      if (severityDelta !== 0) {
        return severityDelta;
      }
      return right.updatedAt.getTime() - left.updatedAt.getTime();
    })
    .slice(0, 8);
}

export function summarizeOperatingGaps(
  gaps: OperatingGap[],
): OperatingGapSummary {
  const kindCountMap = new Map<OperatingGapKind, number>();
  for (const gap of gaps) {
    kindCountMap.set(gap.kind, (kindCountMap.get(gap.kind) ?? 0) + 1);
  }

  return {
    totalOpen: gaps.length,
    reviewRequired: gaps.filter((item) => item.operatorReviewRequired).length,
    escalationRequired: gaps.filter((item) =>
      item.severity === "critical" || item.escalationPosture !== "watch",
    ).length,
    kindCounts: Array.from(kindCountMap.entries())
      .map(([kind, count]) => ({ kind, count }))
      .sort((left, right) => right.count - left.count),
  };
}

export function summarizeBusinessLoopGaps(
  gaps: OperatingGap[],
): BusinessLoopGapSummary {
  const businessLoopGaps = gaps.filter((gap): gap is OperatingGap & {
    kind: BusinessLoopOperatingGapKind;
  } => businessLoopOperatingGapKinds.includes(gap.kind as BusinessLoopOperatingGapKind));
  const kindCountMap = new Map<BusinessLoopOperatingGapKind, number>();
  for (const gap of businessLoopGaps) {
    kindCountMap.set(gap.kind, (kindCountMap.get(gap.kind) ?? 0) + 1);
  }

  const primaryGap =
    businessLoopGaps
      .slice()
      .sort((left, right) => {
        const priorityDelta =
          getBusinessLoopGapPriority(left.kind) - getBusinessLoopGapPriority(right.kind);
        if (priorityDelta !== 0) {
          return priorityDelta;
        }
        const severityDelta =
          getSeverityWeight(right.severity) - getSeverityWeight(left.severity);
        if (severityDelta !== 0) {
          return severityDelta;
        }
        return right.updatedAt.getTime() - left.updatedAt.getTime();
      })[0] ?? null;

  return {
    totalOpen: businessLoopGaps.length,
    reviewRequired: businessLoopGaps.filter((item) => item.operatorReviewRequired).length,
    kindCounts: Array.from(kindCountMap.entries())
      .map(([kind, count]) => ({ kind, count }))
      .sort((left, right) => right.count - left.count),
    primaryGap,
  };
}

function normalizeRefs(value: string[]) {
  return value.map((item) => item.trim()).filter(Boolean);
}

function isWaitingStatus(status: OperatingGapProblemSpaceInput["status"]) {
  return (
    status === "BLOCKED" ||
    status === "WATCHING" ||
    status === "WAITING_ON_SIGNAL" ||
    status === "WAITING_ON_AUTHORITY"
  );
}

function getSeverityWeight(severity: OperatingGapSeverity) {
  switch (severity) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    default:
      return 0;
  }
}

function getBusinessLoopGapPriority(kind: BusinessLoopOperatingGapKind) {
  switch (kind) {
    case "missing-kpi-link":
      return 1;
    case "missing-owner":
      return 2;
    case "missing-next-action":
      return 3;
    case "unresolved-conflict":
      return 4;
    case "missing-evidence":
      return 5;
    default:
      return 99;
  }
}

function buildEvidenceSummary(evidenceRefs: string[]) {
  if (evidenceRefs.length === 0) {
    return "No evidence refs attached yet";
  }
  if (evidenceRefs.length === 1) {
    return `Evidence ${evidenceRefs[0]}`;
  }
  return `${evidenceRefs.length} evidence refs attached`;
}

function mapCompositionFailureToGap(
  failureClass: OperatingGapCompositionFailureInput["failureClass"],
): {
  kind: OperatingGapKind;
  severity: OperatingGapSeverity;
  title: string;
  nextActionHint: string;
  escalationPosture: OperatingGapEscalationPosture;
} {
  switch (failureClass) {
    case "SIGNAL_GAP":
      return {
        kind: "source-not-connected",
        severity: "high",
        title: "Source not connected",
        nextActionHint: "Reconnect or validate the missing source before relying on this runtime path.",
        escalationPosture: "connect-source",
      };
    case "CONTEXT_MISS":
    case "VERIFICATION_FAIL":
    case "CONFIDENCE_GAP":
      return {
        kind: "missing-evidence",
        severity: failureClass === "VERIFICATION_FAIL" ? "high" : "medium",
        title: "Evidence missing",
        nextActionHint: "Restore grounded evidence before promoting or routing this line.",
        escalationPosture: "restore-grounding",
      };
    case "POLICY_BLOCK":
    case "TOOL_MISS":
    case "AUTHORITY_GAP":
    case "BUDGET_EXHAUSTED":
      return {
        kind: "capability-gap",
        severity: "high",
        title: "Capability gap",
        nextActionHint: "Resolve the missing authority, tool, policy posture, or budget path before retrying.",
        escalationPosture: "resolve-capability",
      };
    default:
      return {
        kind: "capability-gap",
        severity: "medium",
        title: "Capability gap",
        nextActionHint: "Review the runtime path before retrying.",
        escalationPosture: "review-required",
      };
  }
}
