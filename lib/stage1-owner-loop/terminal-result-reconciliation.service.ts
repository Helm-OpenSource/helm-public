import "server-only";

import {
  ActorType,
  ExecutionReceiptOutcome,
  ExecutionReceiptSubjectType,
  Prisma,
} from "@prisma/client";

import {
  assertWorkspaceInsightServiceAccess,
  isWorkspaceServiceGovernanceError,
} from "@/lib/auth/service-governance";
import { db } from "@/lib/db";
import { runWithWriteConflictRetry } from "@/lib/db/conflict-aware-write";
import { canonicalJson, sha256 } from "@/lib/expert-capability/hashing";
import {
  ExecutionReceiptNotFoundError,
  ReceiptChangedDuringVerificationError,
  ReceiptSelfVerificationError,
  verifyExecutionReceipt,
} from "@/lib/receipts/execution-receipt.service";
import { safeParseJson } from "@/lib/utils";
import {
  caioProTerminalBusinessOutcomeSchema,
  type CaioProTerminalBusinessOutcome,
} from "./caio-pro-fde-cross-repo-contract";
import {
  CaioFdeScopeResolutionError,
  resolveCaioFdeObservationEvidence,
} from "./caio-fde-scope-resolver.service";
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

  constructor(reasons: readonly string[]) {
    const unique = [...new Set(reasons)];
    super(`Stage 1 terminal result reconciliation denied: ${unique.join(", ")}`);
    this.name = "Stage1TerminalResultReconciliationError";
    this.reasons = unique;
  }
}

const TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10_000,
  timeout: 30_000,
} as const;

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

function canonicalBusinessResult(
  outcome: ExecutionReceiptOutcome,
): "success" | "failure" {
  return outcome === ExecutionReceiptOutcome.SUCCESS ? "success" : "failure";
}

function reconciliationHash(input: {
  workspaceId: string;
  decisionRecordId: string;
  actionItemId: string;
  approvalTaskId: string;
  receiptId: string;
  receiptOutcome: ExecutionReceiptOutcome;
  outcome: Stage1TerminalBusinessOutcome;
}) {
  return sha256(
    canonicalJson({
      schemaVersion: "helm.caio-pro-fde.stage1-reconciliation.v1",
      ...input,
    }),
  );
}

function normalizeError(error: unknown): never {
  if (error instanceof Stage1TerminalResultReconciliationError) {
    throw error;
  }
  if (
    error instanceof Stage1DecisionEvaluationError ||
    error instanceof Stage1DecisionGateError ||
    error instanceof CaioFdeScopeResolutionError
  ) {
    throw new Stage1TerminalResultReconciliationError(error.reasons);
  }
  if (error instanceof ExecutionReceiptNotFoundError) {
    throw new Stage1TerminalResultReconciliationError([
      "execution_receipt_required",
    ]);
  }
  if (error instanceof ReceiptSelfVerificationError) {
    throw new Stage1TerminalResultReconciliationError([
      "independent_receipt_verifier_required",
    ]);
  }
  if (error instanceof ReceiptChangedDuringVerificationError) {
    throw new Stage1TerminalResultReconciliationError([
      "receipt_verification_conflict",
    ]);
  }
  if (isWorkspaceServiceGovernanceError(error)) {
    throw new Stage1TerminalResultReconciliationError([
      "workspace_insight_permission_required",
    ]);
  }
  if (error instanceof Error && /^[a-z0-9_]+$/u.test(error.message)) {
    throw new Stage1TerminalResultReconciliationError([error.message]);
  }
  throw error;
}

// The approvals terminal result is the only Stage 1 trigger. Verification,
// evaluation, observed-memory projection, supervision and all their audits
// commit in one SERIALIZABLE transaction. Existing non-Stage1 verification
// continues to use verifyExecutionReceipt's standalone path.
export async function reconcileStage1TerminalResult(
  input: ReconcileStage1TerminalResultInput,
) {
  validateInput(input);
  const actorType = ActorType.USER;
  try {
    await assertWorkspaceInsightServiceAccess({
      workspaceId: input.workspaceId,
      userId: input.actorUserId,
      actorType,
      english: input.english ?? false,
    });

    return await runWithWriteConflictRetry(() =>
      db.$transaction(async (tx) => {
        const lockedClaims = await tx.$queryRaw<
          Array<{ id: string; decisionRecordId: string }>
        >`
          SELECT claim.id, claim.decisionRecordId
          FROM DecisionWorkPacketClaim claim
          INNER JOIN ActionItem actionItem ON actionItem.id = claim.actionItemId
          LEFT JOIN ExecutionReceipt receipt ON receipt.actionItemId = actionItem.id
          WHERE claim.workspaceId = ${input.workspaceId}
            AND claim.actionItemId = ${input.actionItemId}
          FOR UPDATE`;
        if (lockedClaims.length === 0) {
          return { kind: "not_stage1" as const };
        }
        const claim = await tx.decisionWorkPacketClaim.findFirst({
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
          throw new Stage1TerminalResultReconciliationError([
            "stage1_claim_changed",
          ]);
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
        if (!claim.actionItem.opportunityId) {
          throw new Stage1TerminalResultReconciliationError([
            "portfolio_scope_required",
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
        if (canonicalBusinessResult(receipt.outcome) !== input.outcome.result) {
          throw new Stage1TerminalResultReconciliationError([
            "business_outcome_receipt_mismatch",
          ]);
        }
        const receiptEvidenceRefs = safeParseJson<string[]>(
          receipt.evidenceRefs,
          [],
        );
        const outcomeRef = input.outcome.outcomeRef.trim();
        if (!receiptEvidenceRefs.includes(outcomeRef)) {
          throw new Stage1TerminalResultReconciliationError([
            "business_outcome_not_bound_to_receipt",
          ]);
        }
        const portfolioRef = `opportunity:${claim.actionItem.opportunityId}`;
        await resolveCaioFdeObservationEvidence({
          client: tx,
          workspaceId: input.workspaceId,
          evidenceRef: outcomeRef,
          portfolioRef,
          requiredBindingRefs: [
            `decision-record:${claim.decisionRecordId}`,
            `action-item:${input.actionItemId}`,
            `approval-task:${approvalTask.id}`,
          ],
          expectedBusinessResult: input.outcome.result,
        });

        await verifyExecutionReceipt(
          {
            workspaceId: input.workspaceId,
            subjectType: ExecutionReceiptSubjectType.ACTION_ITEM,
            subjectId: input.actionItemId,
            verifierUserId: input.actorUserId!,
            verifierName: input.actorName,
            english: input.english ?? false,
          },
          { client: tx },
        );
        const evaluation = await evaluateStage1DecisionRecord(
          {
            workspaceId: input.workspaceId,
            decisionRecordId: claim.decisionRecordId,
            followedAiRecommendation: input.outcome.followedAiRecommendation,
            outcome: { outcomeRef, result: input.outcome.result },
            actorName: input.actorName,
            actorUserId: input.actorUserId,
            actorType,
            english: input.english ?? false,
          },
          { client: tx, governanceAlreadyAsserted: true },
        );

        const hash = reconciliationHash({
          workspaceId: input.workspaceId,
          decisionRecordId: claim.decisionRecordId,
          actionItemId: input.actionItemId,
          approvalTaskId: approvalTask.id,
          receiptId: receipt.id,
          receiptOutcome: receipt.outcome,
          outcome: { ...input.outcome, outcomeRef },
        });
        const succeeded = input.outcome.result === "success";
        const supervisionSignal = await recordStage1SupervisionSignal(
          {
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
                outcomeRef,
                `evaluation:${evaluation.evaluation.evaluationId}`,
                `memory-fact:${evaluation.memoryFact.id}`,
                `stage1-reconciliation:${hash}`,
              ],
              severity: succeeded ? "info" : "warning",
              confidence: "high",
              recommendedRoute: succeeded ? "watch" : "owner_review",
              ownerRef: claim.decisionRecord.ownerRef,
              deadlineOrSla: null,
              status: succeeded ? "resolved" : "open",
              observedFact: succeeded
                ? "An independently verified execution receipt is paired with a resolved workspace-scoped successful outcome."
                : "An independently verified execution receipt is paired with a resolved workspace-scoped unsuccessful outcome.",
              interpretation: succeeded
                ? "The governed result is available for decision evaluation; no authority or external action is granted."
                : "The governed result requires owner review; no corrective action is executed automatically.",
            },
            expectedState:
              "A terminal Stage 1 work packet has an independently verified receipt and a workspace-resolved business outcome.",
            actualState: succeeded
              ? "verified_receipt_with_successful_business_outcome"
              : "verified_receipt_with_unsuccessful_business_outcome",
            responsibilityScopeRef: portfolioRef,
            escalationCondition: succeeded
              ? "Re-open owner review if later evidence contradicts the recorded outcome."
              : "Owner review is required before any correction, rollback, or new work packet is proposed.",
            actorName: input.actorName,
            actorUserId: input.actorUserId,
            actorType,
            english: input.english ?? false,
          },
          { client: tx, governanceAlreadyAsserted: true },
        );

        return {
          kind: "reconciled" as const,
          decisionRecordId: claim.decisionRecordId,
          reconciliationHash: hash,
          evaluation,
          supervisionSignal,
        };
      }, TRANSACTION_OPTIONS),
    );
  } catch (error) {
    normalizeError(error);
  }
}
