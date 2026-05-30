import type { SampleCaseRecord } from "../../signals/case/case-mapper";
import type { WorkerOperationMode } from "../worker-modes";

export type RecentCaseAction = Readonly<{
  caseId: string;
  observedDate: string;
  actionKind: "assigned" | "reviewed" | "evidence_added" | "closed";
}>;

export type StewardshipStatus = "on_track" | "needs_attention" | "stuck" | "dropped";

export type StewardshipRosterEntry = Readonly<{
  caseId: string;
  ownerRefId: string;
  idleDays: number;
  status: StewardshipStatus;
  reasonChain: ReadonlyArray<string>;
}>;

export type StewardshipFlagKind =
  | "flag_evidence_gap"
  | "flag_idle_case"
  | "flag_dropped_case";

export type StewardshipFlag = Readonly<{
  workerId: "case-stewardship-driver-v0";
  proposalKind: StewardshipFlagKind;
  proposalKey: string;
  caseId: string;
  ownerRefId: string;
  commitment: "suggestion_only";
  requiresApproval: false;
  reasonChain: ReadonlyArray<string>;
  mode: WorkerOperationMode;
  suppressed: boolean;
}>;

export type StewardshipDecideInput = Readonly<{
  cases: ReadonlyArray<SampleCaseRecord>;
  recentActions?: ReadonlyArray<RecentCaseAction>;
  today: string;
  operationMode?: WorkerOperationMode;
}>;

export type StewardshipDecideReport = Readonly<{
  roster: ReadonlyArray<StewardshipRosterEntry>;
  flags: ReadonlyArray<StewardshipFlag>;
  stats: Readonly<{
    activeCases: number;
    needsAttention: number;
    stuck: number;
    dropped: number;
  }>;
  mode: WorkerOperationMode;
}>;
