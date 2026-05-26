import type { SampleCaseRecord } from "../../signals/case/case-mapper";
import type { LifecycleObjective } from "../lifecycle-objectives";
import type { WorkerOperationMode } from "../worker-modes";

export type SampleEmployeeRecord = {
  employeeRefId: string;
  displayName: string;
  role: "case-owner" | "reviewer" | "manager" | "observer";
  active: boolean;
  reviewCapacity: number;
};

export type AllocationDecideInput = Readonly<{
  cases: ReadonlyArray<SampleCaseRecord>;
  employees: ReadonlyArray<SampleEmployeeRecord>;
  operationMode?: WorkerOperationMode;
}>;

export type AllocationProposalKind =
  | "propose_assignment_recommendation"
  | "flag_boundary_review_required"
  | "flag_capacity_gap";

export type AllocationProposal = Readonly<{
  workerId: "case-allocation-driver-v0";
  proposalKind: AllocationProposalKind;
  proposalKey: string;
  caseId: string;
  recommendedOwnerRefId: string | null;
  score: number | null;
  commitment: "suggestion_only";
  requiresApproval: boolean;
  reasonChain: ReadonlyArray<string>;
  objective: LifecycleObjective | null;
  evidence: Readonly<{
    caseId: string;
    employeeRefId?: string;
    blockedReason?: SampleCaseRecord["blockedReason"];
  }>;
  mode: WorkerOperationMode;
  suppressed: boolean;
}>;

export type AllocationDecideReport = Readonly<{
  proposals: ReadonlyArray<AllocationProposal>;
  stats: Readonly<{
    openCases: number;
    eligibleEmployees: number;
    suppressedProposals: number;
  }>;
  mode: WorkerOperationMode;
}>;
