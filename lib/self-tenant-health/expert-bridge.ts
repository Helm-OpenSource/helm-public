import type { ExpertOutput } from "@/lib/expert-capability/contracts";
import { assertTelemetryProjectionIsSafe } from "@/lib/self-tenant-health/privacy";
import {
  TENANT_HEALTH_BUDGET_STATES,
  TENANT_HEALTH_COST_BUCKETS,
  TENANT_HEALTH_SAFE_SOURCE_TYPES,
  TENANT_HEALTH_STATES,
  type TenantHealthDashboardRow,
} from "@/lib/self-tenant-health/types";

export type SelfTenantHealthJudgementPacketInput = {
  row: TenantHealthDashboardRow;
  caseId: string;
  inputSnapshotRef: string;
  expertRevisionId?: string;
};

const SAFE_DASHBOARD_ROW_KEYS = new Set([
  "tenantAlias",
  "windowStart",
  "windowEnd",
  "candidateCount",
  "validityPassCount",
  "validityFailCount",
  "duplicateCount",
  "staleCount",
  "contradictoryCount",
  "crossTenantBlockedCount",
  "unsafeBoundaryCount",
  "reviewRequiredCount",
  "reviewedCount",
  "acceptedCount",
  "rejectedCount",
  "downgradedCount",
  "quarantinedCount",
  "llmCallCount",
  "llmSuccessCount",
  "llmFallbackCount",
  "costBucket",
  "budgetState",
  "healthState",
  "primarySourceType",
  "supportReasonCodes",
]);

function assertString(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid self-tenant health bridge field: ${field}`);
  }
}

function assertFiniteNumber(value: unknown, field: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid self-tenant health bridge field: ${field}`);
  }
}

function assertAllowed<T extends readonly string[]>(value: unknown, field: string, allowed: T) {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new Error(`Invalid self-tenant health bridge field: ${field}`);
  }
}

export function assertSelfTenantHealthBridgeInputSafe(
  value: unknown,
): asserts value is TenantHealthDashboardRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid self-tenant health bridge input");
  }
  const record = value as Record<string, unknown>;
  assertTelemetryProjectionIsSafe(record);

  const unsafeKeys = Object.keys(record).filter((key) => !SAFE_DASHBOARD_ROW_KEYS.has(key));
  if (unsafeKeys.length > 0) {
    throw new Error(`Unsafe self-tenant health bridge field(s): ${unsafeKeys.join(", ")}`);
  }

  assertString(record.tenantAlias, "tenantAlias");
  assertString(record.windowStart, "windowStart");
  assertString(record.windowEnd, "windowEnd");
  assertAllowed(record.costBucket, "costBucket", TENANT_HEALTH_COST_BUCKETS);
  assertAllowed(record.budgetState, "budgetState", TENANT_HEALTH_BUDGET_STATES);
  assertAllowed(record.healthState, "healthState", TENANT_HEALTH_STATES);
  assertAllowed(record.primarySourceType, "primarySourceType", TENANT_HEALTH_SAFE_SOURCE_TYPES);

  for (const field of [
    "candidateCount",
    "validityPassCount",
    "validityFailCount",
    "duplicateCount",
    "staleCount",
    "contradictoryCount",
    "crossTenantBlockedCount",
    "unsafeBoundaryCount",
    "reviewRequiredCount",
    "reviewedCount",
    "acceptedCount",
    "rejectedCount",
    "downgradedCount",
    "quarantinedCount",
    "llmCallCount",
    "llmSuccessCount",
    "llmFallbackCount",
  ]) {
    assertFiniteNumber(record[field], field);
  }

  if (
    !Array.isArray(record.supportReasonCodes) ||
    record.supportReasonCodes.some((reason) => typeof reason !== "string")
  ) {
    throw new Error("Invalid self-tenant health bridge field: supportReasonCodes");
  }
}

function normalizeEvidenceSegment(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_:-]+/g, "_");
}

function resolveDisposition(row: TenantHealthDashboardRow): string {
  if (row.unsafeBoundaryCount > 0 || row.supportReasonCodes.includes("boundary_incident")) {
    return "flag_self_tenant_boundary_incident";
  }
  if (
    row.reviewRequiredCount > row.reviewedCount ||
    row.supportReasonCodes.includes("review_coverage_gap")
  ) {
    return "flag_self_tenant_review_backlog_blocked";
  }
  if (row.budgetState === "blocked" || row.supportReasonCodes.includes("cost_risk")) {
    return "flag_self_tenant_budget_risk";
  }
  switch (row.healthState) {
    case "green":
      return "record_self_tenant_health_green";
    case "watch":
      return "watch_self_tenant_health";
    case "risk":
      return "flag_self_tenant_health_risk";
    case "blocked":
      return "flag_self_tenant_health_blocked";
  }
}

function buildEvidenceRefs(row: TenantHealthDashboardRow) {
  const refs = [
    `evidence:self-tenant-health-state:${row.healthState}`,
    `evidence:self-tenant-primary-source:${normalizeEvidenceSegment(row.primarySourceType)}`,
    `evidence:self-tenant-cost-bucket:${row.costBucket}`,
    `evidence:self-tenant-budget-state:${row.budgetState}`,
    `evidence:self-tenant-review-coverage:${row.reviewedCount}-of-${row.reviewRequiredCount}`,
    `evidence:self-tenant-signal-volume:${row.candidateCount}`,
  ];

  for (const reason of row.supportReasonCodes) {
    refs.push(`evidence:self-tenant-reason:${normalizeEvidenceSegment(reason)}`);
  }

  return refs;
}

export function buildSelfTenantHealthJudgementPacket(
  input: SelfTenantHealthJudgementPacketInput,
): ExpertOutput {
  assertSelfTenantHealthBridgeInputSafe(input.row);
  assertString(input.caseId, "caseId");
  assertString(input.inputSnapshotRef, "inputSnapshotRef");

  return {
    expertRevisionId: input.expertRevisionId ?? "org-health-deterministic-reference-v0",
    disposition: resolveDisposition(input.row),
    evidenceRefs: buildEvidenceRefs(input.row),
    commitmentClass: "advice",
    boundaryNote:
      "Self-tenant health diagnostic reference only: advice, not a commitment, performance conclusion, writeback, external send, approval, or memory promotion. 组织健康诊断建议,非绩效结论、非承诺、不触发自动动作或外发。",
    humanReviewerRequired: true,
    forbiddenActionRefs: [],
  };
}
