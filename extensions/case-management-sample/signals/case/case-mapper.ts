import type { CaseManagementSampleSignal } from "../types";

export function mapSampleCaseToSignal(input: {
  caseId: string;
  status: string;
}): CaseManagementSampleSignal {
  return {
    signalId: input.caseId,
    family: input.status === "pending_review" ? "approval_blocked" : "stage_or_status_stale",
    title: `Sample case ${input.caseId}`,
  };
}
