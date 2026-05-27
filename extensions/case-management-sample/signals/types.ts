export type CaseManagementSampleSignalFamily =
  | "commitment_missing"
  | "stage_or_status_stale"
  | "approval_blocked"
  | "owner_mismatch"
  | "duplicate_or_conflict"
  | "boundary_attempt";

export type CaseManagementSampleSignal = {
  signalId: string;
  family: CaseManagementSampleSignalFamily;
  title: string;
};
