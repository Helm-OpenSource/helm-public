import type { SampleCaseRecord } from "../../signals/case/case-mapper";
import { buildLifecycleObjective } from "../lifecycle-objectives";
import {
  DEFAULT_OPERATION_MODE,
  enforceModeInvariants,
  type WorkerOperationMode,
} from "../worker-modes";
import type {
  AllocationDecideInput,
  AllocationDecideReport,
  AllocationProposal,
  SampleEmployeeRecord,
} from "./types";

const WORKER_ID = "case-allocation-driver-v0" as const;

export function decideAllocations(input: AllocationDecideInput): AllocationDecideReport {
  const mode: WorkerOperationMode = input.operationMode ?? DEFAULT_OPERATION_MODE;
  const openCases = input.cases.filter((caseRecord) => caseRecord.stage !== "closed");
  const eligibleEmployees = input.employees
    .filter((employee) => employee.active && employee.reviewCapacity > 0)
    .filter((employee) => employee.role === "case-owner" || employee.role === "reviewer")
    .sort((left, right) => {
      if (right.reviewCapacity !== left.reviewCapacity) {
        return right.reviewCapacity - left.reviewCapacity;
      }
      return left.employeeRefId.localeCompare(right.employeeRefId);
    });

  const proposals: AllocationProposal[] = [];

  for (const caseRecord of openCases) {
    if (caseRecord.blockedReason === "boundary_attempt") {
      proposals.push(wrapProposal(buildBoundaryFlag(caseRecord), mode));
      continue;
    }

    const selected = eligibleEmployees[0];
    if (!selected) {
      proposals.push(wrapProposal(buildCapacityFlag(caseRecord), mode));
      continue;
    }

    proposals.push(wrapProposal(buildAssignmentProposal(caseRecord, selected), mode));
  }

  return {
    proposals,
    stats: {
      openCases: openCases.length,
      eligibleEmployees: eligibleEmployees.length,
      suppressedProposals: proposals.filter((proposal) => proposal.suppressed).length,
    },
    mode,
  };
}

function buildAssignmentProposal(
  caseRecord: SampleCaseRecord,
  employee: SampleEmployeeRecord,
): Omit<AllocationProposal, "mode" | "suppressed"> {
  const score = Math.min(
    100,
    Math.round(caseRecord.priorityScore * 0.7 + employee.reviewCapacity * 5),
  );
  const objective = buildLifecycleObjective({
    expectedRecoveryPoints: caseRecord.priorityScore,
    estimatedEffortMinutes: caseRecord.evidenceCount > 0 ? 30 : 60,
    estimatedDaysToResolve: caseRecord.ageDays >= 5 ? 2 : 5,
    subject: `${caseRecord.caseId} -> ${employee.employeeRefId}`,
  });

  return {
    workerId: WORKER_ID,
    proposalKind: "propose_assignment_recommendation",
    proposalKey: `allocation:${caseRecord.caseId}:${employee.employeeRefId}`,
    caseId: caseRecord.caseId,
    recommendedOwnerRefId: employee.employeeRefId,
    score,
    commitment: "suggestion_only",
    requiresApproval: true,
    reasonChain: [
      `priority score ${caseRecord.priorityScore}`,
      `selected ${employee.employeeRefId} with capacity ${employee.reviewCapacity}`,
      ...objective.reasonChain,
    ],
    objective,
    evidence: {
      caseId: caseRecord.caseId,
      employeeRefId: employee.employeeRefId,
      blockedReason: caseRecord.blockedReason,
    },
  };
}

function buildBoundaryFlag(
  caseRecord: SampleCaseRecord,
): Omit<AllocationProposal, "mode" | "suppressed"> {
  return {
    workerId: WORKER_ID,
    proposalKind: "flag_boundary_review_required",
    proposalKey: `allocation-boundary:${caseRecord.caseId}`,
    caseId: caseRecord.caseId,
    recommendedOwnerRefId: null,
    score: null,
    commitment: "suggestion_only",
    requiresApproval: false,
    reasonChain: ["case attempted to cross a boundary; route to human review first"],
    objective: null,
    evidence: {
      caseId: caseRecord.caseId,
      blockedReason: caseRecord.blockedReason,
    },
  };
}

function buildCapacityFlag(
  caseRecord: SampleCaseRecord,
): Omit<AllocationProposal, "mode" | "suppressed"> {
  return {
    workerId: WORKER_ID,
    proposalKind: "flag_capacity_gap",
    proposalKey: `allocation-capacity:${caseRecord.caseId}`,
    caseId: caseRecord.caseId,
    recommendedOwnerRefId: null,
    score: null,
    commitment: "suggestion_only",
    requiresApproval: false,
    reasonChain: ["no active reviewer or case-owner has remaining review capacity"],
    objective: null,
    evidence: {
      caseId: caseRecord.caseId,
      blockedReason: caseRecord.blockedReason,
    },
  };
}

function wrapProposal(
  proposal: Omit<AllocationProposal, "mode" | "suppressed">,
  mode: WorkerOperationMode,
): AllocationProposal {
  return enforceModeInvariants(proposal, mode);
}
