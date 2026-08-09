import "server-only";

import {
  ActorType,
  ExecutionReceiptSubjectType,
  ExecutionReceiptVerificationState,
} from "@prisma/client";

import { isWorkspaceServiceGovernanceError } from "@/lib/auth/service-governance";
import { db } from "@/lib/db";
import {
  caioProTerminalBusinessOutcomeSchema,
  type CaioProTerminalBusinessOutcome,
} from "./caio-pro-fde-cross-repo-contract";
import {
  evaluateStage1DecisionRecord,
  Stage1DecisionEvaluationError,
} from "./decision-evaluation.service";
import {
  recordStage1SupervisionSignal,
  Stage1DecisionGateError,
} from "./decision-follow-through.service";

export type Stage1TerminalBusinessOutcome = CaioProTerminalBusinessOutcome;

export type ReconcileStage1TerminalResultInput = {
  workspaceId: string;
  actionItemId: string;
  outcome: Stage1TerminalBusinessOutcome;
  actorName: string;
  actorUserId?: string | null;
  actorType?: ActorType;
  english?: boolean;
};

export class Stage1TerminalResultReconciliationError extends Error {
  readonly reasons: string[];

  constructor(reasons: string[]) {
    super(`Stage 1 terminal result reconciliation denied: ${reasons.join(", ")}`);
    this.name = "Stage1TerminalResultReconciliationError";
    this.reasons = reasons;
  }
}

function validateInput(input: ReconcileStage1TerminalResultInput): void {
  const reasons: string[] = [];
  if (!input.workspaceId.trim()) reasons.push("workspace_required");
  if (!input.actionItemId.trim()) reasons.push("action_item_required");
  if (!input.actorName.trim()) reasons.push("actor_name_required");
  if (!input.outcome.outcomeRef?.trim()) {
    reasons.push("business_outcome_ref_required");
  } else if (!caioProTerminalBusinessOutcomeSchema.safeParse(input.outcome).success) {
    reasons.push("business_outcome_ref_invalid");
  }
  if (!(["success", "failure"] as const).includes(input.outcome.result)) {
    reasons.push("business_outcome_not_final");
  }
  if (
    input.actorType !== undefined &&
    input.actorType !== ActorType.USER
  ) {
    reasons.push("actor_user_identity_required");
  } else if (!input.actorUserId?.trim()) {
    reasons.push("actor_user_identity_required");
  }
  if (reasons.length > 0) {
    throw new Stage1TerminalResultReconciliationError(reasons);
  }
}

async function runGovernedReconciliationStep<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (
      error instanceof Stage1DecisionEvaluationError ||
      error instanceof Stage1DecisionGateError
    ) {
      throw new Stage1TerminalResultReconciliationError([
        ...new Set(error.reasons),
      ]);
    }
    if (isWorkspaceServiceGovernanceError(error)) {
      throw new Stage1TerminalResultReconciliationError([
        "workspace_insight_permission_required",
      ]);
    }
    throw error;
  }
}

// Canonical trigger: a second reviewer verifies the existing ActionItem
// ExecutionReceipt from the approvals result path, then calls this reconciler.
// Evaluation runs first so a conflicting replay is rejected by DecisionRecord
// CAS before it can create a second supervision fact. Either step is
// independently idempotent, allowing an interrupted call to converge on retry.
export async function reconcileStage1TerminalResult(
  input: ReconcileStage1TerminalResultInput,
) {
  validateInput(input);
  const actorType = ActorType.USER;
  const claim = await db.decisionWorkPacketClaim.findFirst({
    where: {
      workspaceId: input.workspaceId,
      actionItemId: input.actionItemId,
    },
    include: {
      decisionRecord: {
        select: { id: true, workspaceId: true, ownerRef: true },
      },
      actionItem: {
        include: { approvalTask: true, executionReceipt: true },
      },
    },
  });

  if (!claim) {
    return { kind: "not_stage1" as const };
  }

  const receipt = claim.actionItem.executionReceipt;
  const approvalTask = claim.actionItem.approvalTask;

  if (
    claim.actionItemId !== input.actionItemId ||
    claim.actionItem.id !== input.actionItemId
  ) {
    throw new Stage1TerminalResultReconciliationError([
      "action_item_mismatch",
    ]);
  }
  if (!approvalTask) {
    throw new Stage1TerminalResultReconciliationError([
      "approval_task_required",
    ]);
  }
  if (!receipt) {
    throw new Stage1TerminalResultReconciliationError([
      "execution_receipt_required",
    ]);
  }
  const workspaceMatches =
    claim.workspaceId === input.workspaceId &&
    claim.decisionRecord.workspaceId === input.workspaceId &&
    claim.actionItem.workspaceId === input.workspaceId &&
    approvalTask.workspaceId === input.workspaceId &&
    receipt.workspaceId === input.workspaceId;
  if (!workspaceMatches) {
    throw new Stage1TerminalResultReconciliationError([
      "workspace_mismatch",
    ]);
  }
  if (
    receipt.subjectType !== ExecutionReceiptSubjectType.ACTION_ITEM ||
    receipt.subjectId !== input.actionItemId
  ) {
    throw new Stage1TerminalResultReconciliationError([
      "execution_receipt_subject_mismatch",
    ]);
  }
  if (
    receipt.verificationState !==
    ExecutionReceiptVerificationState.VERIFIED
  ) {
    throw new Stage1TerminalResultReconciliationError([
      "verified_execution_receipt_required",
    ]);
  }

  const evaluation = await runGovernedReconciliationStep(() =>
    evaluateStage1DecisionRecord({
      workspaceId: input.workspaceId,
      decisionRecordId: claim.decisionRecordId,
      followedAiRecommendation: input.outcome.followedAiRecommendation,
      outcome: {
        outcomeRef: input.outcome.outcomeRef.trim(),
        result: input.outcome.result,
      },
      actorName: input.actorName,
      actorUserId: input.actorUserId,
      actorType,
      english: input.english ?? false,
    }),
  );

  const succeeded = input.outcome.result === "success";
  const supervisionSignal = await runGovernedReconciliationStep(() =>
    recordStage1SupervisionSignal({
      workspaceId: input.workspaceId,
      decisionRecordId: claim.decisionRecordId,
      signal: {
        signalId: `stage1-terminal-result:${claim.decisionRecordId}`,
        tenantRef: `workspace:${input.workspaceId}`,
        signalType: succeeded ? "opportunity" : "anomaly",
        observedObjectRef: `action-item:${input.actionItemId}`,
        baselineRef: `decision-record:${claim.decisionRecordId}`,
        evidenceRefs: [
          `execution-receipt:${receipt.id}`,
          input.outcome.outcomeRef.trim(),
          `evaluation:${evaluation.evaluation.evaluationId}`,
          `memory-fact:${evaluation.memoryFact.id}`,
        ],
        severity: succeeded ? "info" : "warning",
        confidence: "high",
        recommendedRoute: succeeded ? "watch" : "owner_review",
        ownerRef: claim.decisionRecord.ownerRef,
        deadlineOrSla: null,
        status: succeeded ? "resolved" : "open",
        observedFact: succeeded
          ? "An independently verified execution receipt is paired with an explicit successful business outcome."
          : "An independently verified execution receipt is paired with an explicit unsuccessful business outcome.",
        interpretation: succeeded
          ? "The governed result is available for decision evaluation; no authority or external action is granted."
          : "The governed result requires owner review; no corrective action is executed automatically.",
      },
      expectedState:
        "A terminal Stage 1 work packet has an independently verified receipt and an explicit business outcome.",
      actualState: succeeded
        ? "verified_receipt_with_successful_business_outcome"
        : "verified_receipt_with_unsuccessful_business_outcome",
      responsibilityScopeRef: `workspace:${input.workspaceId}`,
      escalationCondition: succeeded
        ? "Re-open owner review if later evidence contradicts the recorded outcome."
        : "Owner review is required before any correction, rollback, or new work packet is proposed.",
      actorName: input.actorName,
      actorUserId: input.actorUserId,
      actorType,
      english: input.english ?? false,
    }),
  );

  return {
    kind: "reconciled" as const,
    decisionRecordId: claim.decisionRecordId,
    evaluation,
    supervisionSignal,
  };
}
