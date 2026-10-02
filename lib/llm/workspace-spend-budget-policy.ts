/** Read-only candidate metadata. This file never authorizes provider execution. */
export type WorkspaceSpendBudgetPolicyRow = {
  llmBudgetMode: unknown;
  llmMonthlyBudgetMicros: unknown;
  llmBudgetEnforcementMode: unknown;
  llmBudgetPeriodPolicyVersion: unknown;
  llmBudgetConfigVersion: unknown;
  llmBudgetApprovalRef: unknown;
  llmBudgetUpdatedBy: unknown;
  llmBudgetUpdatedAt: unknown;
};

const MAX_SIGNED_BIGINT = BigInt("9223372036854775807");
const MAX_PRISMA_INT = 2147483647;

export type WorkspaceSpendBudgetDeclaration = {
  mode: "limited" | "unlimited";
  budgetMicros: bigint | null;
  periodPolicyVersion: string;
  configVersion: number;
  approvalRef: string;
  updatedBy: string;
  updatedAt: Date;
  approvalVerified: false;
};

export type WorkspaceSpendBudgetPolicyInvalidReason =
  | "workspace_not_found"
  | "expected_period_policy_version_missing"
  | "budget_mode_invalid"
  | "unconfigured_metadata_conflict"
  | "limited_amount_invalid"
  | "unlimited_amount_conflict"
  | "enforcement_mode_invalid"
  | "config_version_invalid"
  | "approval_ref_missing"
  | "updated_by_missing"
  | "updated_at_invalid"
  | "period_policy_version_mismatch";

export type WorkspaceSpendBudgetPolicyRead =
  | { status: "unconfigured"; reason: "budget_not_declared" | "enforcement_not_configured";
      providerAuthorized: false; declaration: WorkspaceSpendBudgetDeclaration | null }
  | { status: "shadow"; reason: null; providerAuthorized: false;
      declaration: WorkspaceSpendBudgetDeclaration }
  | { status: "enforce_blocked"; reason: "currency_and_price_unverified";
      providerAuthorized: false; declaration: WorkspaceSpendBudgetDeclaration }
  | { status: "invalid"; reason: WorkspaceSpendBudgetPolicyInvalidReason;
      providerAuthorized: false; declaration: null };

function invalid(reason: WorkspaceSpendBudgetPolicyInvalidReason): WorkspaceSpendBudgetPolicyRead {
  return { status: "invalid", reason, providerAuthorized: false, declaration: null };
}

function nonblankRef(value: unknown, maxLength = 191): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength &&
    value.trim() === value && !/[\x00-\x1f\x7f]/.test(value);
}

export function parseWorkspaceSpendBudgetPolicy(input: {
  row: WorkspaceSpendBudgetPolicyRow;
  expectedPeriodPolicyVersion: string;
}): WorkspaceSpendBudgetPolicyRead {
  const { row } = input;
  if (!nonblankRef(input.expectedPeriodPolicyVersion, 64)) {
    return invalid("expected_period_policy_version_missing");
  }
  if (row.llmBudgetMode === null) {
    if (row.llmMonthlyBudgetMicros !== null || row.llmBudgetEnforcementMode !== null ||
        row.llmBudgetPeriodPolicyVersion !== null || row.llmBudgetApprovalRef !== null ||
        row.llmBudgetUpdatedBy !== null || row.llmBudgetUpdatedAt !== null) {
      return invalid("unconfigured_metadata_conflict");
    }
    if (row.llmBudgetConfigVersion !== 0) return invalid("config_version_invalid");
    return { status: "unconfigured", reason: "budget_not_declared", providerAuthorized: false,
      declaration: null };
  }
  if (row.llmBudgetMode === "unconfigured") {
    if (row.llmMonthlyBudgetMicros !== null || row.llmBudgetEnforcementMode !== null) {
      return invalid("unconfigured_metadata_conflict");
    }
    if (!Number.isSafeInteger(row.llmBudgetConfigVersion) ||
        (row.llmBudgetConfigVersion as number) <= 0 ||
        (row.llmBudgetConfigVersion as number) > MAX_PRISMA_INT) return invalid("config_version_invalid");
    if (row.llmBudgetPeriodPolicyVersion !== null &&
        row.llmBudgetPeriodPolicyVersion !== input.expectedPeriodPolicyVersion) {
      return invalid("period_policy_version_mismatch");
    }
    const auditFields = [row.llmBudgetApprovalRef, row.llmBudgetUpdatedBy, row.llmBudgetUpdatedAt];
    if (auditFields.some((field) => field !== null)) {
      if (!nonblankRef(row.llmBudgetApprovalRef)) return invalid("approval_ref_missing");
      if (!nonblankRef(row.llmBudgetUpdatedBy)) return invalid("updated_by_missing");
      if (!(row.llmBudgetUpdatedAt instanceof Date) ||
          !Number.isFinite(row.llmBudgetUpdatedAt.getTime())) return invalid("updated_at_invalid");
    }
    return { status: "unconfigured", reason: "budget_not_declared", providerAuthorized: false,
      declaration: null };
  }
  if (row.llmBudgetMode !== "limited" && row.llmBudgetMode !== "unlimited") {
    return invalid("budget_mode_invalid");
  }
  if (row.llmBudgetMode === "limited" &&
      (typeof row.llmMonthlyBudgetMicros !== "bigint" ||
        row.llmMonthlyBudgetMicros < BigInt(0) || row.llmMonthlyBudgetMicros > MAX_SIGNED_BIGINT)) {
    return invalid("limited_amount_invalid");
  }
  if (row.llmBudgetMode === "unlimited" && row.llmMonthlyBudgetMicros !== null) {
    return invalid("unlimited_amount_conflict");
  }
  if (row.llmBudgetEnforcementMode !== null && row.llmBudgetEnforcementMode !== "shadow" &&
      row.llmBudgetEnforcementMode !== "enforce") {
    return invalid("enforcement_mode_invalid");
  }
  if (!Number.isSafeInteger(row.llmBudgetConfigVersion) ||
      (row.llmBudgetConfigVersion as number) <= 0 ||
      (row.llmBudgetConfigVersion as number) > MAX_PRISMA_INT) {
    return invalid("config_version_invalid");
  }
  if (!nonblankRef(row.llmBudgetApprovalRef)) return invalid("approval_ref_missing");
  if (!nonblankRef(row.llmBudgetUpdatedBy)) return invalid("updated_by_missing");
  if (!(row.llmBudgetUpdatedAt instanceof Date) ||
      !Number.isFinite(row.llmBudgetUpdatedAt.getTime())) return invalid("updated_at_invalid");
  if (!nonblankRef(row.llmBudgetPeriodPolicyVersion, 64) ||
      row.llmBudgetPeriodPolicyVersion !== input.expectedPeriodPolicyVersion) {
    return invalid("period_policy_version_mismatch");
  }

  const declaration: WorkspaceSpendBudgetDeclaration = {
    mode: row.llmBudgetMode,
    budgetMicros: row.llmBudgetMode === "limited" ? row.llmMonthlyBudgetMicros as bigint : null,
    periodPolicyVersion: row.llmBudgetPeriodPolicyVersion,
    configVersion: row.llmBudgetConfigVersion as number,
    approvalRef: row.llmBudgetApprovalRef,
    updatedBy: row.llmBudgetUpdatedBy,
    updatedAt: new Date(row.llmBudgetUpdatedAt.getTime()),
    approvalVerified: false,
  };
  if (row.llmBudgetEnforcementMode === null) {
    return { status: "unconfigured", reason: "enforcement_not_configured",
      providerAuthorized: false, declaration };
  }
  if (row.llmBudgetEnforcementMode === "shadow") {
    return { status: "shadow", reason: null, providerAuthorized: false, declaration };
  }
  return { status: "enforce_blocked", reason: "currency_and_price_unverified",
    providerAuthorized: false, declaration };
}
