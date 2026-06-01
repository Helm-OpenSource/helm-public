import "server-only";

import { db } from "@/lib/db";
import {
  isOperatingSignalFlowRuntimeShadowEnabledForWorkspace,
  readOperatingSignalFlowRuntimeShadowFlagSnapshot,
} from "@/lib/feature-flags";
import type {
  OperatingSignalBlocker,
  OperatingSignalFlowEdge,
  OperatingSignalFlowEvent,
  OperatingSignalFlowNode,
  OperatingSignalFlowSnapshot,
  OperatingSignalState,
  OperatingSignalFamily,
} from "@/lib/operating-signal-flow/contract";

export type OperatingSignalFlowShadowWindow = OperatingSignalFlowSnapshot["window"];

export const OPERATING_SIGNAL_FLOW_SHADOW_FIELD_SELECTORS = {
  actionItem: {
    id: true,
    workspaceId: true,
    ownerId: true,
    actionType: true,
    sourceType: true,
    riskLevel: true,
    suggestedAt: true,
    dueDate: true,
    executedAt: true,
    status: true,
    executionStatus: true,
    executionMode: true,
    requiresApproval: true,
    createdAt: true,
    updatedAt: true,
  },
  approvalTask: {
    id: true,
    workspaceId: true,
    status: true,
    isHighRisk: true,
    autoExecute: true,
    reviewedAt: true,
    createdAt: true,
    updatedAt: true,
  },
  auditLog: {
    id: true,
    workspaceId: true,
    actorType: true,
    actionType: true,
    targetType: true,
    relatedObjectType: true,
    traceId: true,
    requestId: true,
    parentEventId: true,
    createdAt: true,
  },
} as const;

export type OperatingSignalFlowShadowActionRow = {
  readonly id: string;
  readonly workspaceId: string;
  readonly ownerId: string | null;
  readonly actionType: string;
  readonly sourceType: string | null;
  readonly riskLevel: string;
  readonly suggestedAt: Date | string;
  readonly dueDate: Date | string | null;
  readonly executedAt: Date | string | null;
  readonly status: string;
  readonly executionStatus: string;
  readonly executionMode: string;
  readonly requiresApproval: boolean;
  readonly createdAt: Date | string;
  readonly updatedAt: Date | string;
};

export type OperatingSignalFlowShadowApprovalRow = {
  readonly id: string;
  readonly workspaceId: string;
  readonly status: string;
  readonly isHighRisk: boolean;
  readonly autoExecute: boolean;
  readonly reviewedAt: Date | string | null;
  readonly createdAt: Date | string;
  readonly updatedAt: Date | string;
};

export type OperatingSignalFlowShadowAuditRow = {
  readonly id: string;
  readonly workspaceId: string;
  readonly actorType: string;
  readonly actionType: string;
  readonly targetType: string;
  readonly relatedObjectType: string | null;
  readonly traceId: string | null;
  readonly requestId: string | null;
  readonly parentEventId: string | null;
  readonly createdAt: Date | string;
};

export type OperatingSignalFlowRuntimeShadowDiagnostics = {
  readonly actionCount: number;
  readonly approvalCount: number;
  readonly auditCount: number;
  readonly boundaryCounter: number;
  readonly pendingReviewCount: number;
  readonly tracePresenceCount: number;
  readonly workspaceCount: number;
};

export type OperatingSignalFlowRuntimeShadowResult =
  | {
      readonly state: "disabled";
      readonly reason: "flag_off" | "workspace_not_in_allowlist";
    }
  | {
      readonly state: "degraded";
      readonly reason: "empty_window" | "cross_workspace_projection";
      readonly diagnostics: OperatingSignalFlowRuntimeShadowDiagnostics;
    }
  | {
      readonly state: "shadow_ready";
      readonly snapshot: OperatingSignalFlowSnapshot;
      readonly diagnostics: OperatingSignalFlowRuntimeShadowDiagnostics;
    };

export async function resolveOperatingSignalFlowRuntimeShadowSnapshot(input: {
  readonly workspaceId: string;
  readonly window?: OperatingSignalFlowShadowWindow;
  readonly now?: Date;
  readonly take?: number;
}): Promise<OperatingSignalFlowRuntimeShadowResult> {
  const flagSnapshot = readOperatingSignalFlowRuntimeShadowFlagSnapshot();
  if (!isOperatingSignalFlowRuntimeShadowEnabledForWorkspace(input.workspaceId)) {
    return {
      state: "disabled",
      reason: flagSnapshot.flagEnabled ? "workspace_not_in_allowlist" : "flag_off",
    };
  }

  const window = input.window ?? "24h";
  const now = input.now ?? new Date();
  const since = getWindowStart(now, window);
  const take = normalizeTake(input.take);

  const [actions, approvals, audits] = await Promise.all([
    db.actionItem.findMany({
      where: {
        workspaceId: input.workspaceId,
        updatedAt: { gte: since },
      },
      select: OPERATING_SIGNAL_FLOW_SHADOW_FIELD_SELECTORS.actionItem,
      orderBy: { updatedAt: "desc" },
      take,
    }),
    db.approvalTask.findMany({
      where: {
        workspaceId: input.workspaceId,
        updatedAt: { gte: since },
      },
      select: OPERATING_SIGNAL_FLOW_SHADOW_FIELD_SELECTORS.approvalTask,
      orderBy: { updatedAt: "desc" },
      take,
    }),
    db.auditLog.findMany({
      where: {
        workspaceId: input.workspaceId,
        createdAt: { gte: since },
      },
      select: OPERATING_SIGNAL_FLOW_SHADOW_FIELD_SELECTORS.auditLog,
      orderBy: { createdAt: "desc" },
      take,
    }),
  ]);

  return buildOperatingSignalFlowRuntimeShadowSnapshot({
    workspaceId: input.workspaceId,
    window,
    generatedAt: now,
    actions,
    approvals,
    audits,
  });
}

export function buildOperatingSignalFlowRuntimeShadowSnapshot(input: {
  readonly workspaceId: string;
  readonly window: OperatingSignalFlowShadowWindow;
  readonly generatedAt: Date | string;
  readonly actions: readonly OperatingSignalFlowShadowActionRow[];
  readonly approvals: readonly OperatingSignalFlowShadowApprovalRow[];
  readonly audits: readonly OperatingSignalFlowShadowAuditRow[];
}): OperatingSignalFlowRuntimeShadowResult {
  const diagnostics = buildDiagnostics(input);
  if (diagnostics.workspaceCount !== 1) {
    return {
      state: "degraded",
      reason: "cross_workspace_projection",
      diagnostics,
    };
  }

  const events = [
    ...input.actions.map((row, index) => actionRowToEvent(row, index)),
    ...input.approvals.map((row, index) => approvalRowToEvent(row, index)),
    ...input.audits.map((row, index) => auditRowToEvent(row, index)),
  ].sort(compareEvents);

  if (events.length === 0) {
    return {
      state: "degraded",
      reason: "empty_window",
      diagnostics,
    };
  }

  const nodes = buildNodes(input.workspaceId, events, diagnostics);
  const edges = buildEdges(input.workspaceId, events, diagnostics, input.window);

  return {
    state: "shadow_ready",
    diagnostics,
    snapshot: {
      workspaceId: input.workspaceId,
      dataPosture: "current_window",
      window: input.window,
      generatedAt: toIso(input.generatedAt),
      judgementHeadline: "Operating Signal Flow runtime shadow candidate",
      boundaryStatementVisible: true,
      fixtureBannerVisible: false,
      animationPolicy: "affected_paths_static",
      selectedPathSignalKey: selectPressureSignalKey(events),
      aiWorkPosture: {
        deterministicCoveragePercent: 100,
        explanationCoveragePercent: 0,
        evidenceCoveragePercent: calculateEvidenceCoveragePercent(events),
        boundaryStoppedCount: diagnostics.boundaryCounter,
      },
      nodes,
      edges,
      events,
    },
  };
}

function buildDiagnostics(input: {
  readonly workspaceId: string;
  readonly actions: readonly OperatingSignalFlowShadowActionRow[];
  readonly approvals: readonly OperatingSignalFlowShadowApprovalRow[];
  readonly audits: readonly OperatingSignalFlowShadowAuditRow[];
}): OperatingSignalFlowRuntimeShadowDiagnostics {
  const workspaces = new Set<string>([input.workspaceId]);
  for (const row of input.actions) workspaces.add(row.workspaceId);
  for (const row of input.approvals) workspaces.add(row.workspaceId);
  for (const row of input.audits) workspaces.add(row.workspaceId);

  return {
    actionCount: input.actions.length,
    approvalCount: input.approvals.length,
    auditCount: input.audits.length,
    boundaryCounter:
      input.actions.filter((row) => row.executionMode === "AUTO_WITHIN_THRESHOLD").length +
      input.approvals.filter((row) => row.autoExecute).length,
    pendingReviewCount:
      input.actions.filter((row) => row.status === "PENDING_APPROVAL").length +
      input.approvals.filter((row) => row.status === "PENDING").length,
    tracePresenceCount: input.audits.filter((row) =>
      Boolean(row.traceId || row.requestId || row.parentEventId),
    ).length,
    workspaceCount: workspaces.size,
  };
}

function actionRowToEvent(
  row: OperatingSignalFlowShadowActionRow,
  index: number,
): OperatingSignalFlowEvent {
  const transitionTo = mapActionState(row);
  const boundaryBlocked = row.executionMode === "AUTO_WITHIN_THRESHOLD";
  const missingOwner = row.ownerId == null;
  return {
    id: `osf-shadow-action-event-${pad(index + 1)}`,
    workspaceId: row.workspaceId,
    signalKey: `osf-shadow-action-${pad(index + 1)}`,
    traceId: null,
    previousEventId: null,
    causedByEventId: null,
    sourceKind: "action_item",
    sourceRef: "action-item-shadow",
    signalFamily: row.riskLevel === "CRITICAL" || row.riskLevel === "HIGH" ? "risk" : "advancement",
    objectRef: "Workspace:runtime-shadow",
    objectKind: "Workspace",
    transitionFrom: null,
    transitionTo,
    triggeredBy: "deterministic_rule",
    ruleId: "osf-runtime-shadow-action",
    actorRef: null,
    currentBlockerType: boundaryBlocked ? "boundary_blocked" : missingOwner ? "missing_owner" : null,
    blockerSince: boundaryBlocked || missingOwner ? toIso(row.updatedAt) : null,
    awaitingReceiptSince: row.status === "EXECUTED" ? toIso(row.executedAt ?? row.updatedAt) : null,
    evidenceCoverage: { provided: missingOwner ? 0 : 1, required: 1 },
    confidenceBand: row.riskLevel === "LOW" ? "medium" : "high",
    confidenceSource: "deterministic",
    redactionStatus: "alias_only",
    crossTenantProjection: false,
    dedupeKey: null,
    mergedIntoSignalKey: null,
    supersededBySignalKey: null,
    revocationReason: null,
    boundaryCheckResult: boundaryBlocked ? "blocked" : "pass",
    policyVersion: "operating-signal-flow-runtime-shadow.v1",
    latencyFromPriorMs: null,
    occurredAt: toIso(row.updatedAt),
    evidenceRefs: missingOwner ? [] : ["owner_present"],
    reviewerRequired: row.requiresApproval || row.riskLevel === "CRITICAL" || row.riskLevel === "HIGH",
    allowedNextActions: [row.requiresApproval ? "/approvals" : "/memory"],
    forbiddenNextActions: ["auto_send", "auto_approve", "official_write"],
    boundaryNote: "Runtime shadow is read-only and must not replace the fixture surface.",
  };
}

function approvalRowToEvent(
  row: OperatingSignalFlowShadowApprovalRow,
  index: number,
): OperatingSignalFlowEvent {
  const transitionTo = mapApprovalState(row);
  return {
    id: `osf-shadow-approval-event-${pad(index + 1)}`,
    workspaceId: row.workspaceId,
    signalKey: `osf-shadow-approval-${pad(index + 1)}`,
    traceId: null,
    previousEventId: null,
    causedByEventId: null,
    sourceKind: "approval_task",
    sourceRef: "approval-task-shadow",
    signalFamily: row.isHighRisk ? "risk" : "advancement",
    objectRef: "Workspace:runtime-shadow",
    objectKind: "Workspace",
    transitionFrom: null,
    transitionTo,
    triggeredBy: "reviewer",
    ruleId: "osf-runtime-shadow-approval",
    actorRef: null,
    currentBlockerType: row.autoExecute ? "boundary_blocked" : null,
    blockerSince: row.autoExecute ? toIso(row.updatedAt) : null,
    awaitingReceiptSince: row.status === "EXECUTED" ? toIso(row.reviewedAt ?? row.updatedAt) : null,
    evidenceCoverage: { provided: row.reviewedAt ? 1 : 0, required: 1 },
    confidenceBand: row.isHighRisk ? "high" : "medium",
    confidenceSource: "deterministic",
    redactionStatus: "alias_only",
    crossTenantProjection: false,
    dedupeKey: null,
    mergedIntoSignalKey: null,
    supersededBySignalKey: null,
    revocationReason: null,
    boundaryCheckResult: row.autoExecute ? "blocked" : "pass",
    policyVersion: "operating-signal-flow-runtime-shadow.v1",
    latencyFromPriorMs: null,
    occurredAt: toIso(row.updatedAt),
    evidenceRefs: row.reviewedAt ? ["review_present"] : [],
    reviewerRequired: row.status === "PENDING" || row.isHighRisk,
    allowedNextActions: [row.status === "PENDING" ? "/approvals" : "/memory"],
    forbiddenNextActions: ["auto_send", "auto_approve", "official_write"],
    boundaryNote: "Runtime shadow keeps approvals review-first and read-only.",
  };
}

function auditRowToEvent(
  row: OperatingSignalFlowShadowAuditRow,
  index: number,
): OperatingSignalFlowEvent {
  const hasTrace = Boolean(row.traceId || row.requestId || row.parentEventId);
  return {
    id: `osf-shadow-audit-event-${pad(index + 1)}`,
    workspaceId: row.workspaceId,
    signalKey: `osf-shadow-audit-${pad(index + 1)}`,
    traceId: null,
    previousEventId: null,
    causedByEventId: null,
    sourceKind: "audit_log",
    sourceRef: "audit-log-shadow",
    signalFamily: row.actionType.toLowerCase().includes("boundary") ? "boundary_attempt" : "receipt",
    objectRef: "Workspace:runtime-shadow",
    objectKind: "Workspace",
    transitionFrom: null,
    transitionTo: "OUTCOME_RECORDED",
    triggeredBy: row.actorType === "USER" ? "owner" : "system_timer",
    ruleId: "osf-runtime-shadow-audit",
    actorRef: null,
    currentBlockerType: hasTrace ? null : "missing_evidence",
    blockerSince: hasTrace ? null : toIso(row.createdAt),
    awaitingReceiptSince: null,
    evidenceCoverage: { provided: hasTrace ? 1 : 0, required: 1 },
    confidenceBand: hasTrace ? "high" : "medium",
    confidenceSource: "deterministic",
    redactionStatus: "alias_only",
    crossTenantProjection: false,
    dedupeKey: null,
    mergedIntoSignalKey: null,
    supersededBySignalKey: null,
    revocationReason: null,
    boundaryCheckResult: "pass",
    policyVersion: "operating-signal-flow-runtime-shadow.v1",
    latencyFromPriorMs: null,
    occurredAt: toIso(row.createdAt),
    evidenceRefs: hasTrace ? ["trace_present"] : [],
    reviewerRequired: false,
    allowedNextActions: ["/memory"],
    forbiddenNextActions: ["raw_trace_display", "official_write"],
    boundaryNote: "Runtime shadow counts trace presence only and never projects raw trace identifiers.",
  };
}

function buildNodes(
  workspaceId: string,
  events: readonly OperatingSignalFlowEvent[],
  diagnostics: OperatingSignalFlowRuntimeShadowDiagnostics,
): OperatingSignalFlowNode[] {
  const latestEventAt = events[events.length - 1]?.occurredAt ?? null;
  const familyMix = countFamilies(events);
  const blockedCount = events.filter((event) => event.currentBlockerType).length;

  return [
    node({
      id: "runtime-shadow-source",
      workspaceId,
      kind: "source",
      lane: "flowing",
      label: "Runtime shadow rows",
      signalCount: events.length,
      latestEventAt,
      familyMix,
      blockedCount,
      boundaryIncidentCount: diagnostics.boundaryCounter,
      pendingReviewCount: diagnostics.pendingReviewCount,
    }),
    node({
      id: "runtime-shadow-gate",
      workspaceId,
      kind: "gate",
      lane: diagnostics.boundaryCounter > 0 ? "blocked" : "flowing",
      label: "Read-only boundary gate",
      signalCount: events.length,
      latestEventAt,
      familyMix,
      blockedCount,
      boundaryIncidentCount: diagnostics.boundaryCounter,
      pendingReviewCount: diagnostics.pendingReviewCount,
    }),
    node({
      id: "runtime-shadow-review",
      workspaceId,
      kind: "review",
      lane: diagnostics.pendingReviewCount > 0 ? "review_required" : "flowing",
      label: "Review queue",
      signalCount: diagnostics.approvalCount,
      latestEventAt,
      familyMix,
      blockedCount: 0,
      boundaryIncidentCount: diagnostics.boundaryCounter,
      pendingReviewCount: diagnostics.pendingReviewCount,
    }),
    node({
      id: "runtime-shadow-action",
      workspaceId,
      kind: "action_candidate",
      lane: "flowing",
      label: "Action candidates",
      signalCount: diagnostics.actionCount,
      latestEventAt,
      familyMix,
      blockedCount,
      boundaryIncidentCount: diagnostics.boundaryCounter,
      pendingReviewCount: diagnostics.pendingReviewCount,
    }),
    node({
      id: "runtime-shadow-outcome",
      workspaceId,
      kind: "outcome",
      lane: "watch_only_learned",
      label: "Audit receipts",
      signalCount: diagnostics.auditCount,
      latestEventAt,
      familyMix,
      blockedCount: events.filter((event) => event.currentBlockerType === "missing_evidence").length,
      boundaryIncidentCount: 0,
      pendingReviewCount: 0,
    }),
  ];
}

function node(input: {
  readonly id: string;
  readonly workspaceId: string;
  readonly kind: OperatingSignalFlowNode["kind"];
  readonly lane: OperatingSignalFlowNode["lane"];
  readonly label: string;
  readonly signalCount: number;
  readonly latestEventAt: string | null;
  readonly familyMix: OperatingSignalFlowNode["signalFamilyMix"];
  readonly blockedCount: number;
  readonly boundaryIncidentCount: number;
  readonly pendingReviewCount: number;
}): OperatingSignalFlowNode {
  return {
    id: input.id,
    workspaceId: input.workspaceId,
    kind: input.kind,
    lane: input.lane,
    label: input.label,
    status:
      input.lane === "blocked"
        ? "blocked"
        : input.lane === "review_required"
          ? "review_required"
          : input.lane === "watch_only_learned"
            ? "watch_only"
            : "healthy",
    signalCount: input.signalCount,
    blockedCount: input.blockedCount,
    boundaryIncidentCount: input.boundaryIncidentCount,
    pendingReviewCount: input.pendingReviewCount,
    signalFamilyMix: input.familyMix,
    latestEventAt: input.latestEventAt,
    lastBlockerAt: null,
    staleness: "fresh",
    connectorPosture: "n/a",
    boundaryNote: "Read-only runtime shadow; no UI adoption or official write authority.",
  };
}

function buildEdges(
  workspaceId: string,
  events: readonly OperatingSignalFlowEvent[],
  diagnostics: OperatingSignalFlowRuntimeShadowDiagnostics,
  window: OperatingSignalFlowShadowWindow,
): OperatingSignalFlowEdge[] {
  const latestEventAt = events.at(-1)?.occurredAt ?? toIso(new Date(0));
  const throughputPerHour = Number((events.length / windowHours(window)).toFixed(2));
  const evidenceCoveragePercent = calculateEvidenceCoveragePercent(events);

  return [
    edge({
      id: "runtime-shadow-source-to-gate",
      workspaceId,
      fromNodeId: "runtime-shadow-source",
      toNodeId: "runtime-shadow-gate",
      signalCount: events.length,
      pendingCount: diagnostics.pendingReviewCount,
      throughputPerHour,
      latestEventAt,
      blockedCount: diagnostics.boundaryCounter,
      boundaryCounter: diagnostics.boundaryCounter,
      evidenceCoveragePercent,
      reviewRequiredCount: diagnostics.pendingReviewCount,
    }),
    edge({
      id: "runtime-shadow-gate-to-review",
      workspaceId,
      fromNodeId: "runtime-shadow-gate",
      toNodeId: "runtime-shadow-review",
      signalCount: diagnostics.approvalCount,
      pendingCount: diagnostics.pendingReviewCount,
      throughputPerHour,
      latestEventAt,
      blockedCount: 0,
      boundaryCounter: diagnostics.boundaryCounter,
      evidenceCoveragePercent,
      reviewRequiredCount: diagnostics.pendingReviewCount,
    }),
    edge({
      id: "runtime-shadow-review-to-action",
      workspaceId,
      fromNodeId: "runtime-shadow-review",
      toNodeId: "runtime-shadow-action",
      signalCount: diagnostics.actionCount,
      pendingCount: diagnostics.pendingReviewCount,
      throughputPerHour,
      latestEventAt,
      blockedCount: events.filter((event) => event.currentBlockerType === "missing_owner").length,
      boundaryCounter: diagnostics.boundaryCounter,
      evidenceCoveragePercent,
      reviewRequiredCount: diagnostics.pendingReviewCount,
    }),
    edge({
      id: "runtime-shadow-action-to-outcome",
      workspaceId,
      fromNodeId: "runtime-shadow-action",
      toNodeId: "runtime-shadow-outcome",
      signalCount: diagnostics.auditCount,
      pendingCount: 0,
      throughputPerHour,
      latestEventAt,
      blockedCount: events.filter((event) => event.currentBlockerType === "missing_evidence").length,
      boundaryCounter: 0,
      evidenceCoveragePercent,
      reviewRequiredCount: 0,
    }),
  ];
}

function edge(input: {
  readonly id: string;
  readonly workspaceId: string;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly signalCount: number;
  readonly pendingCount: number;
  readonly throughputPerHour: number;
  readonly latestEventAt: string;
  readonly blockedCount: number;
  readonly boundaryCounter: number;
  readonly evidenceCoveragePercent: number;
  readonly reviewRequiredCount: number;
}): OperatingSignalFlowEdge {
  return {
    id: input.id,
    workspaceId: input.workspaceId,
    fromNodeId: input.fromNodeId,
    toNodeId: input.toNodeId,
    direction: "forward",
    signalCount: input.signalCount,
    pendingCount: input.pendingCount,
    throughputPerHour: input.throughputPerHour,
    medianLatencySeconds: null,
    flowPosture: input.boundaryCounter > 0 ? "stalled" : input.pendingCount > 0 ? "slow" : "flowing",
    lastEventAt: input.latestEventAt,
    oldestPendingSince: null,
    blockedCount: input.blockedCount,
    blockedReasonsBreakdown: buildBlockedReasonsBreakdown(input.blockedCount, input.boundaryCounter),
    sweepEligible: false,
    boundaryCounter: input.boundaryCounter,
    evidenceCoveragePercent: input.evidenceCoveragePercent,
    reviewRequiredCount: input.reviewRequiredCount,
  };
}

function mapActionState(row: OperatingSignalFlowShadowActionRow): OperatingSignalState {
  if (row.executionMode === "AUTO_WITHIN_THRESHOLD") return "BOUNDARY_BLOCKED";
  switch (row.status) {
    case "PENDING_APPROVAL":
      return "REVIEW_PENDING";
    case "APPROVED":
    case "MANUAL":
      return "HUMAN_DECIDED";
    case "EXECUTED":
      return "OUTCOME_RECORDED";
    case "REJECTED":
      return "REJECTED";
    case "WITHDRAWN":
      return "REVOKED";
    case "BLOCKED":
      return "BOUNDARY_BLOCKED";
    case "SUGGESTED":
    default:
      return "PACKETIZED";
  }
}

function mapApprovalState(row: OperatingSignalFlowShadowApprovalRow): OperatingSignalState {
  if (row.autoExecute) return "BOUNDARY_BLOCKED";
  switch (row.status) {
    case "PENDING":
      return "REVIEW_PENDING";
    case "EXECUTED":
      return "HUMAN_DECIDED";
    case "REJECTED":
      return "REJECTED";
    case "WITHDRAWN":
    default:
      return "REVOKED";
  }
}

function countFamilies(
  events: readonly OperatingSignalFlowEvent[],
): Array<{ family: OperatingSignalFamily; count: number }> {
  const counts = new Map<OperatingSignalFamily, number>();
  for (const event of events) {
    counts.set(event.signalFamily, (counts.get(event.signalFamily) ?? 0) + 1);
  }
  return [...counts.entries()].map(([family, count]) => ({ family, count }));
}

function selectPressureSignalKey(events: readonly OperatingSignalFlowEvent[]): string | null {
  return (
    events.find((event) => event.boundaryCheckResult === "blocked") ??
    events.find((event) => event.reviewerRequired) ??
    events.at(0) ??
    null
  )?.signalKey ?? null;
}

function calculateEvidenceCoveragePercent(events: readonly OperatingSignalFlowEvent[]) {
  const required = events.reduce((sum, event) => sum + event.evidenceCoverage.required, 0);
  if (required === 0) return 100;
  const provided = events.reduce((sum, event) => sum + event.evidenceCoverage.provided, 0);
  return Math.round((provided / required) * 100);
}

function buildBlockedReasonsBreakdown(
  blockedCount: number,
  boundaryCounter: number,
): Array<{ reason: OperatingSignalBlocker; count: number }> {
  if (blockedCount <= 0 && boundaryCounter <= 0) return [];
  if (boundaryCounter > 0) return [{ reason: "boundary_blocked", count: boundaryCounter }];
  return [{ reason: "missing_evidence", count: blockedCount }];
}

function compareEvents(a: OperatingSignalFlowEvent, b: OperatingSignalFlowEvent) {
  const timeDiff = Date.parse(a.occurredAt) - Date.parse(b.occurredAt);
  if (timeDiff !== 0) return timeDiff;
  return a.signalKey.localeCompare(b.signalKey);
}

function getWindowStart(now: Date, window: OperatingSignalFlowShadowWindow) {
  return new Date(now.getTime() - windowHours(window) * 60 * 60 * 1000);
}

function windowHours(window: OperatingSignalFlowShadowWindow) {
  if (window === "1h") return 1;
  if (window === "7d") return 24 * 7;
  return 24;
}

function normalizeTake(value: number | undefined) {
  if (!Number.isFinite(value)) return 200;
  return Math.min(Math.max(Math.trunc(value ?? 200), 1), 500);
}

function toIso(value: Date | string) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function pad(value: number) {
  return String(value).padStart(3, "0");
}
