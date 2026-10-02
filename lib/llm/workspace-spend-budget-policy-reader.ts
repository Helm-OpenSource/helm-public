import "server-only";

import { db } from "@/lib/db";
import { parseWorkspaceSpendBudgetPolicy, type WorkspaceSpendBudgetPolicyRead,
  type WorkspaceSpendBudgetPolicyRow } from "./workspace-spend-budget-policy";

type ReadInput = {
  workspaceId: string;
  expectedPeriodPolicyVersion: string;
};

/** Small read-only seam: callers may use an independently controlled source. */
export function createWorkspaceSpendBudgetPolicyReader(
  findWorkspace: (workspaceId: string) => Promise<WorkspaceSpendBudgetPolicyRow | null>,
): (input: ReadInput) => Promise<WorkspaceSpendBudgetPolicyRead> {
  return async (input) => {
    const row = await findWorkspace(input.workspaceId);
    if (!row) {
      return { status: "invalid", reason: "workspace_not_found", providerAuthorized: false,
        declaration: null };
    }
    return parseWorkspaceSpendBudgetPolicy({ row,
      expectedPeriodPolicyVersion: input.expectedPeriodPolicyVersion });
  };
}

/** Reads candidate policy columns only. Database errors propagate unchanged. */
export const readWorkspaceSpendBudgetPolicy = createWorkspaceSpendBudgetPolicyReader(
  (workspaceId) => db.workspace.findUnique({
    where: { id: workspaceId },
    select: {
      llmBudgetMode: true,
      llmMonthlyBudgetMicros: true,
      llmBudgetEnforcementMode: true,
      llmBudgetPeriodPolicyVersion: true,
      llmBudgetConfigVersion: true,
      llmBudgetApprovalRef: true,
      llmBudgetUpdatedBy: true,
      llmBudgetUpdatedAt: true,
    },
  }),
);
