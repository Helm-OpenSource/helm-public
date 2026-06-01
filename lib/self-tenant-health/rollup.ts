import {
  bucketEstimatedCostMinorUnit,
  resolveBudgetState,
  sumEstimatedLLMCostMinorUnit,
} from "@/lib/self-tenant-health/cost";
import { createTenantAlias } from "@/lib/self-tenant-health/privacy";
import type {
  TenantHealthAuditTelemetryInput,
  TenantHealthApprovalTelemetryInput,
  TenantHealthBudgetState,
  TenantHealthDashboardData,
  TenantHealthLLMUsageInput,
  TenantHealthRollupRow,
  TenantHealthSafeSourceType,
  TenantHealthSignalTelemetryInput,
  TenantHealthState,
  TenantHealthWorkspaceInput,
} from "@/lib/self-tenant-health/types";

export type TenantHealthBudgetRuleInput = {
  workspaceId: string;
  monthlyLimit: number;
  warningThreshold: number;
};

const SAFE_SOURCE_TYPES = new Set<TenantHealthSafeSourceType>([
  "ask_helm",
  "meeting",
  "crm",
  "email_im",
  "external_agent",
  "resource_state",
  "other",
]);

function normalizeActionType(value: string) {
  return value.trim().toUpperCase();
}

function normalizeSourceType(sourceType: string | null): TenantHealthSafeSourceType {
  const normalized = (sourceType ?? "other").trim().toLowerCase();
  if (SAFE_SOURCE_TYPES.has(normalized as TenantHealthSafeSourceType)) {
    return normalized as TenantHealthSafeSourceType;
  }
  if (
    normalized === "bi_report" ||
    normalized === "bi_report_business_signal" ||
    normalized === "business_signal"
  ) {
    return "resource_state";
  }
  if (normalized === "email" || normalized === "im" || normalized === "email_im") {
    return "email_im";
  }
  if (normalized === "ask" || normalized === "askhelm") {
    return "ask_helm";
  }
  return "other";
}

function countWhere<T>(items: T[], fn: (item: T) => boolean) {
  return items.filter(fn).length;
}

function isWithinWindow(value: Date | null | undefined, windowStart: Date, windowEnd: Date) {
  if (!value) return false;
  return value >= windowStart && value <= windowEnd;
}

function auditTelemetryRef(item: TenantHealthAuditTelemetryInput, index: number) {
  return `${item.targetType}:${item.targetId ?? `${item.actionType}:${item.createdAt.toISOString()}:${index}`}`;
}

function mostCommon(values: string[], fallback: string) {
  const counts = values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
  return (
    Object.entries(counts).sort((left, right) => right[1] - left[1])[0]?.[0] ??
    fallback
  );
}

function resolveHealthState(input: {
  candidateCount: number;
  validityPassCount: number;
  duplicateCount: number;
  unsafeBoundaryCount: number;
  reviewRequiredCount: number;
  reviewedCount: number;
  acceptedCount: number;
  budgetState: TenantHealthBudgetState;
}): { healthState: TenantHealthState; supportReasonCodes: string[] } {
  const supportReasonCodes: string[] = [];
  const validityPassRate =
    input.candidateCount > 0 ? input.validityPassCount / input.candidateCount : 1;
  const duplicateRate =
    input.candidateCount > 0 ? input.duplicateCount / input.candidateCount : 0;
  const acceptedRate =
    input.candidateCount > 0 ? input.acceptedCount / input.candidateCount : 1;

  if (input.unsafeBoundaryCount > 0) {
    supportReasonCodes.push("boundary_incident");
  }
  if (input.reviewRequiredCount > input.reviewedCount) {
    supportReasonCodes.push("review_coverage_gap");
  }
  if (input.candidateCount >= 5 && validityPassRate < 0.7) {
    supportReasonCodes.push("low_validity_pass_rate");
  }
  if (input.candidateCount >= 5 && duplicateRate > 0.25) {
    supportReasonCodes.push("duplicate_noise");
  }
  if (input.candidateCount >= 5 && acceptedRate < 0.3) {
    supportReasonCodes.push("low_accepted_rate");
  }
  if (input.budgetState === "blocked" || input.budgetState === "risk") {
    supportReasonCodes.push("cost_risk");
  }
  if (input.budgetState === "watch") {
    supportReasonCodes.push("cost_watch");
  }

  if (
    input.unsafeBoundaryCount > 0 ||
    input.budgetState === "blocked" ||
    (input.reviewRequiredCount > 0 && input.reviewedCount < input.reviewRequiredCount)
  ) {
    return { healthState: "blocked", supportReasonCodes };
  }

  if (
    (input.candidateCount >= 5 && validityPassRate < 0.7) ||
    (input.candidateCount >= 5 && duplicateRate > 0.25) ||
    input.budgetState === "risk"
  ) {
    return { healthState: "risk", supportReasonCodes };
  }

  if (
    (input.candidateCount >= 5 && acceptedRate < 0.3) ||
    input.budgetState === "watch" ||
    input.candidateCount === 0
  ) {
    return { healthState: "watch", supportReasonCodes };
  }

  return { healthState: "green", supportReasonCodes };
}

export function buildTenantHealthDashboardData(input: {
  workspaces: TenantHealthWorkspaceInput[];
  signalEvents: TenantHealthSignalTelemetryInput[];
  auditLogs: TenantHealthAuditTelemetryInput[];
  approvalTasks?: TenantHealthApprovalTelemetryInput[];
  llmCalls: TenantHealthLLMUsageInput[];
  budgetRules?: TenantHealthBudgetRuleInput[];
  windowStart: Date;
  windowEnd: Date;
  aliasSalt?: string;
}): TenantHealthDashboardData {
  const budgetsByWorkspace = new Map(
    (input.budgetRules ?? []).map((item) => [item.workspaceId, item]),
  );

  const rows: TenantHealthRollupRow[] = input.workspaces.map((workspace) => {
    const signalEvents = input.signalEvents.filter(
      (item) => item.workspaceId === workspace.id,
    );
    const auditLogs = input.auditLogs.filter(
      (item) => item.workspaceId === workspace.id,
    );
    const approvalTasks = (input.approvalTasks ?? []).filter(
      (item) => item.workspaceId === workspace.id,
    );
    const llmCalls = input.llmCalls.filter((item) => item.workspaceId === workspace.id);
    const askHelmCandidateCount = countWhere(
      auditLogs,
      (item) =>
        item.actionType === "ASK_HELM_SIGNAL_CANDIDATE_SUBMITTED" ||
        item.targetType === "AskHelmSignalCandidate",
    );
    const actionTypes = auditLogs.map((item) => normalizeActionType(item.actionType));
    const candidateCount = signalEvents.length + askHelmCandidateCount;
    const validityPassCount = countWhere(
      signalEvents,
      (item) => (item.truthWeight ?? 0) > 0,
    );
    const validityFailCount = countWhere(
      signalEvents,
      (item) => (item.truthWeight ?? 0) <= 0,
    );
    const duplicateCount = countWhere(actionTypes, (item) => item.includes("DUPLICATE"));
    const staleCount = countWhere(actionTypes, (item) => item.includes("STALE"));
    const contradictoryCount =
      countWhere(actionTypes, (item) => item.includes("CONTRADICTION")) +
      countWhere(signalEvents, (item) =>
        (item.signalType ?? "").toLowerCase().includes("conflict"),
      );
    const crossTenantBlockedCount = countWhere(actionTypes, (item) =>
      item.includes("CROSS_TENANT"),
    );
    const unsafeBoundaryCount =
      countWhere(actionTypes, (item) => item.includes("BOUNDARY")) +
      countWhere(actionTypes, (item) => item.includes("UNSAFE"));
    const reviewRequiredRefs = new Set<string>();
    const reviewedRefs = new Set<string>();
    const acceptedRefs = new Set<string>();
    const rejectedRefs = new Set<string>();

    auditLogs.forEach((item, index) => {
      const actionType = normalizeActionType(item.actionType);
      const ref = auditTelemetryRef(item, index);
      if (
        item.actionType === "ASK_HELM_SIGNAL_CANDIDATE_SUBMITTED" ||
        item.targetType === "AskHelmSignalCandidate" ||
        actionType.includes("REVIEW_REQUIRED")
      ) {
        reviewRequiredRefs.add(ref);
      }
      if (
        actionType.includes("REVIEWED") ||
        actionType.includes("APPROVED") ||
        actionType.includes("REJECTED")
      ) {
        if (item.targetType === "ApprovalTask") {
          reviewRequiredRefs.add(ref);
        }
        reviewedRefs.add(ref);
      }
      if (actionType.includes("ACCEPTED") || actionType.includes("APPROVED")) {
        acceptedRefs.add(ref);
      }
      if (actionType.includes("REJECTED")) {
        rejectedRefs.add(ref);
      }
    });

    approvalTasks.forEach((task) => {
      const ref = `ApprovalTask:${task.id}`;
      const createdInWindow = isWithinWindow(task.createdAt, input.windowStart, input.windowEnd);
      const reviewedInWindow = isWithinWindow(task.reviewedAt, input.windowStart, input.windowEnd);
      if (createdInWindow || reviewedInWindow || task.status === "PENDING") {
        reviewRequiredRefs.add(ref);
      }
      if (reviewedInWindow) {
        reviewedRefs.add(ref);
        if (task.status === "EXECUTED") {
          acceptedRefs.add(ref);
        }
        if (task.status === "REJECTED") {
          rejectedRefs.add(ref);
        }
      }
    });

    const reviewRequiredCount = reviewRequiredRefs.size;
    const reviewedCount = reviewedRefs.size;
    const acceptedCount = acceptedRefs.size;
    const rejectedCount = rejectedRefs.size;
    const downgradedCount = countWhere(actionTypes, (item) => item.includes("DOWNGRADED"));
    const quarantinedCount = countWhere(actionTypes, (item) =>
      item.includes("QUARANTINED"),
    );
    const estimated = sumEstimatedLLMCostMinorUnit(llmCalls);
    const budgetRule = budgetsByWorkspace.get(workspace.id) ?? null;
    const budgetState = resolveBudgetState({
      estimatedCostMinorUnit: estimated.estimatedCostMinorUnit,
      monthlyLimitMinorUnit: budgetRule?.monthlyLimit ?? null,
      warningThresholdPercent: budgetRule?.warningThreshold ?? null,
    });
    const { healthState, supportReasonCodes } = resolveHealthState({
      candidateCount,
      validityPassCount,
      duplicateCount,
      unsafeBoundaryCount,
      reviewRequiredCount,
      reviewedCount,
      acceptedCount,
      budgetState,
    });

    return {
      workspaceId: workspace.id,
      tenantAlias: createTenantAlias(workspace.id, input.aliasSalt),
      windowStart: input.windowStart.toISOString(),
      windowEnd: input.windowEnd.toISOString(),
      candidateCount,
      validityPassCount,
      validityFailCount,
      duplicateCount,
      staleCount,
      contradictoryCount,
      crossTenantBlockedCount,
      unsafeBoundaryCount,
      reviewRequiredCount,
      reviewedCount,
      acceptedCount,
      rejectedCount,
      downgradedCount,
      quarantinedCount,
      llmCallCount: llmCalls.length,
      llmSuccessCount: countWhere(llmCalls, (item) => item.success),
      llmFallbackCount: countWhere(llmCalls, (item) => !item.success || Boolean(item.fallbackReason)),
      estimatedCostMinorUnit: estimated.estimatedCostMinorUnit,
      costBucket: bucketEstimatedCostMinorUnit(estimated.estimatedCostMinorUnit),
      budgetState,
      healthState,
      primarySourceType: normalizeSourceType(
        mostCommon(
          signalEvents.map((item) => normalizeSourceType(item.sourceType)),
          "other",
        ),
      ),
      topCostFeatureArea: mostCommon(
        llmCalls.map((item) => item.taskType || "other"),
        "none",
      ),
      supportReasonCodes,
    };
  });

  const sortedRows = rows.sort((left, right) => {
    const rank: Record<TenantHealthState, number> = {
      blocked: 0,
      risk: 1,
      watch: 2,
      green: 3,
    };
    return rank[left.healthState] - rank[right.healthState];
  });
  const safeRows = sortedRows.map(
    ({
      workspaceId: _workspaceId,
      estimatedCostMinorUnit: _estimatedCostMinorUnit,
      topCostFeatureArea: _topCostFeatureArea,
      ...row
    }) => row,
  );

  return {
    summary: {
      totalTenants: sortedRows.length,
      greenCount: countWhere(sortedRows, (item) => item.healthState === "green"),
      watchCount: countWhere(sortedRows, (item) => item.healthState === "watch"),
      riskCount: countWhere(sortedRows, (item) => item.healthState === "risk"),
      blockedCount: countWhere(sortedRows, (item) => item.healthState === "blocked"),
      suppressedBucketCount: countWhere(
        sortedRows,
        (item) => item.candidateCount > 0 && item.candidateCount < 5,
      ),
      windowStart: input.windowStart.toISOString(),
      windowEnd: input.windowEnd.toISOString(),
    },
    rows: safeRows,
  };
}
