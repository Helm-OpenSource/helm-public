export const TENANT_HEALTH_STATES = ["green", "watch", "risk", "blocked"] as const;
export type TenantHealthState = (typeof TENANT_HEALTH_STATES)[number];

export const TENANT_HEALTH_COST_BUCKETS = [
  "unknown",
  "cny_0_100",
  "cny_100_1000",
  "cny_1000_10000",
  "cny_10000_plus",
] as const;
export type TenantHealthCostBucket = (typeof TENANT_HEALTH_COST_BUCKETS)[number];

export const TENANT_HEALTH_BUDGET_STATES = [
  "not_configured",
  "ok",
  "watch",
  "risk",
  "blocked",
  "unknown",
] as const;
export type TenantHealthBudgetState = (typeof TENANT_HEALTH_BUDGET_STATES)[number];

export const TENANT_HEALTH_SAFE_SOURCE_TYPES = [
  "ask_helm",
  "meeting",
  "crm",
  "email_im",
  "external_agent",
  "resource_state",
  "other",
] as const;
export type TenantHealthSafeSourceType = (typeof TENANT_HEALTH_SAFE_SOURCE_TYPES)[number];

export type TenantHealthSignalTelemetryInput = {
  workspaceId: string;
  sourceType: string | null;
  signalType: string | null;
  truthWeight: number | null;
  createdAt: Date;
};

export type TenantHealthAuditTelemetryInput = {
  workspaceId: string;
  actionType: string;
  targetType: string;
  targetId?: string | null;
  relatedObjectType: string | null;
  createdAt: Date;
};

export type TenantHealthApprovalTelemetryInput = {
  id: string;
  workspaceId: string;
  status: string;
  createdAt: Date;
  reviewedAt: Date | null;
};

export type TenantHealthLLMUsageInput = {
  workspaceId: string;
  provider: string;
  model: string;
  modelRole: string | null;
  taskType: string;
  tokenUsagePrompt: number | null;
  tokenUsageCompletion: number | null;
  latencyMs: number | null;
  success: boolean;
  fallbackReason: string | null;
  createdAt: Date;
};

export type TenantHealthWorkspaceInput = {
  id: string;
  status?: string | null;
};

export type TenantHealthRollupRow = {
  workspaceId: string;
  tenantAlias: string;
  windowStart: string;
  windowEnd: string;
  candidateCount: number;
  validityPassCount: number;
  validityFailCount: number;
  duplicateCount: number;
  staleCount: number;
  contradictoryCount: number;
  crossTenantBlockedCount: number;
  unsafeBoundaryCount: number;
  reviewRequiredCount: number;
  reviewedCount: number;
  acceptedCount: number;
  rejectedCount: number;
  downgradedCount: number;
  quarantinedCount: number;
  llmCallCount: number;
  llmSuccessCount: number;
  llmFallbackCount: number;
  estimatedCostMinorUnit: number | null;
  costBucket: TenantHealthCostBucket;
  budgetState: TenantHealthBudgetState;
  healthState: TenantHealthState;
  primarySourceType: TenantHealthSafeSourceType;
  topCostFeatureArea: string;
  supportReasonCodes: string[];
};

export type TenantHealthDashboardRow = Omit<
  TenantHealthRollupRow,
  "workspaceId" | "estimatedCostMinorUnit" | "topCostFeatureArea"
>;

export type TenantHealthDashboardSummary = {
  totalTenants: number;
  greenCount: number;
  watchCount: number;
  riskCount: number;
  blockedCount: number;
  suppressedBucketCount: number;
  windowStart: string;
  windowEnd: string;
};

export type TenantHealthDashboardData = {
  summary: TenantHealthDashboardSummary;
  rows: TenantHealthDashboardRow[];
};
