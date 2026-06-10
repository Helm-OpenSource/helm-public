import { isClosedStage, type SampleCaseRecord } from "../../signals/case/case-mapper";
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
  const openCases = input.cases.filter((caseRecord) => !isClosedStage(caseRecord.stage));
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

  // Track remaining review capacity per employee and consume it on each
  // assignment. Without this every case was assigned to eligibleEmployees[0],
  // so capacity was never respected and flag_capacity_gap only fired when the
  // eligible pool was literally empty.
  const remainingCapacity = new Map<string, number>(
    eligibleEmployees.map((employee) => [employee.employeeRefId, employee.reviewCapacity]),
  );

  const pickEmployeeWithCapacity = (): SampleEmployeeRecord | null => {
    let maxRemaining = 0;
    for (const employee of eligibleEmployees) {
      maxRemaining = Math.max(maxRemaining, remainingCapacity.get(employee.employeeRefId) ?? 0);
    }
    if (maxRemaining <= 0) return null;
    // eligibleEmployees is sorted by (capacity desc, refId asc); return the
    // first employee currently at the max remaining for a deterministic pick.
    return (
      eligibleEmployees.find(
        (employee) => (remainingCapacity.get(employee.employeeRefId) ?? 0) === maxRemaining,
      ) ?? null
    );
  };

  for (const caseRecord of openCases) {
    if (caseRecord.blockedReason === "boundary_attempt") {
      proposals.push(wrapProposal(buildBoundaryFlag(caseRecord), mode));
      continue;
    }

    const selected = pickEmployeeWithCapacity();
    if (!selected) {
      proposals.push(wrapProposal(buildCapacityFlag(caseRecord), mode));
      continue;
    }

    remainingCapacity.set(
      selected.employeeRefId,
      (remainingCapacity.get(selected.employeeRefId) ?? 0) - 1,
    );
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
