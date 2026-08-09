import "server-only";

import {
  ActionStatus,
  ActorType,
  ApprovalStatus,
  ExecutionReceiptOutcome,
  ExecutionReceiptSubjectType,
  MembershipStatus,
  Prisma,
  type ExecutionReceipt,
} from "@prisma/client";

import type { CaioAccessPrincipal } from "@/lib/caio-access-gateway/token-store.service";
import {
  WORKSPACE_CAPABILITIES,
  workspaceRoleHasCapability,
} from "@/lib/auth/authorization";
import { db } from "@/lib/db";
import { runWithWriteConflictRetry } from "@/lib/db/conflict-aware-write";
import {
  auditExecutionReceiptRecorded,
  recordExecutionReceipt,
} from "@/lib/receipts/execution-receipt.service";
import { safeParseJson } from "@/lib/utils";
import {
  parseCaioProPrivateExecutionResultProjection,
  type CaioProPrivateExecutionResultProjection,
} from "./caio-pro-fde-cross-repo-contract";
import {
  CaioFdeScopeResolutionError,
  resolveCaioFdeObservationEvidence,
  resolveCaioFdePortfolioScope,
} from "./caio-fde-scope-resolver.service";
import { validateOwnerCommandDraft } from "./contracts";
import type { OwnerCommandDraft } from "./types";

const TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10_000,
  timeout: 30_000,
} as const;

export class CaioPrivateExecutionResultIngressError extends Error {
  readonly reasons: readonly string[];

  constructor(reasons: readonly string[]) {
    const unique = [...new Set(reasons)];
    super(`CAIO private execution result ingress denied: ${unique.join(", ")}`);
    this.name = "CaioPrivateExecutionResultIngressError";
    this.reasons = unique;
  }
}

function opaqueId(ref: string): string {
  return ref.slice(ref.indexOf(":") + 1);
}

function principalUserId(userRef: string): string {
  if (!userRef.startsWith("user:")) {
    throw new CaioPrivateExecutionResultIngressError([
      "private_execution_result_user_principal_required",
    ]);
  }
  const userId = userRef.slice("user:".length);
  if (!userId || userId.trim() !== userId || userId.includes(":")) {
    throw new CaioPrivateExecutionResultIngressError([
      "private_execution_result_user_principal_required",
    ]);
  }
  return userId;
}

async function assertTransactionAuthorization(input: {
  client: Prisma.TransactionClient;
  workspaceId: string;
  userId: string;
  userRef: string;
  ownerCommandJson: string;
  actionOwnerId: string | null;
  approvalAssigneeId: string | null;
}) {
  const membership = await input.client.membership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: input.workspaceId,
        userId: input.userId,
      },
    },
    select: { role: true, status: true },
  });
  if (!membership || membership.status !== MembershipStatus.ACTIVE) {
    throw new CaioPrivateExecutionResultIngressError([
      "private_execution_result_membership_inactive",
    ]);
  }
  if (
    !workspaceRoleHasCapability(
      membership.role,
      WORKSPACE_CAPABILITIES.SUBMIT_PRIVATE_EXECUTION_RESULT,
    )
  ) {
    throw new CaioPrivateExecutionResultIngressError([
      "private_execution_result_operation_permission_required",
    ]);
  }

  const ownerCommand = safeParseJson<OwnerCommandDraft | null>(
    input.ownerCommandJson,
    null,
  );
  const explicitGrantMatches =
    ownerCommand !== null &&
    validateOwnerCommandDraft(ownerCommand).valid &&
    ownerCommand.executionTargetRef === input.userRef;
  if (
    input.actionOwnerId !== input.userId &&
    input.approvalAssigneeId !== input.userId &&
    !explicitGrantMatches
  ) {
    throw new CaioPrivateExecutionResultIngressError([
      "private_execution_result_executor_binding_required",
    ]);
  }
}

function receiptOutcome(
  value: CaioProPrivateExecutionResultProjection["receiptOutcome"],
) {
  switch (value) {
    case "SUCCESS":
      return ExecutionReceiptOutcome.SUCCESS;
    case "PARTIAL_SUCCESS":
      return ExecutionReceiptOutcome.PARTIAL_SUCCESS;
    case "FAILURE":
      return ExecutionReceiptOutcome.FAILURE;
  }
}

function canonicalEvidenceRefs(
  projection: CaioProPrivateExecutionResultProjection,
): string[] {
  return [
    projection.actionItemRef,
    projection.approvalTaskRef,
    projection.contentHash,
    projection.decisionRecordRef,
    projection.evidenceSnapshotRef,
    ...projection.executionProofRefs,
    projection.portfolioRef,
    projection.projectionRef,
  ]
    .filter((value, index, values) => values.indexOf(value) === index)
    .sort((left, right) => left.localeCompare(right));
}

function exactReceiptReplay(input: {
  receipt: ExecutionReceipt;
  projection: CaioProPrivateExecutionResultProjection;
}): boolean {
  const storedRefs = safeParseJson<unknown>(input.receipt.evidenceRefs, null);
  if (
    !Array.isArray(storedRefs) ||
    !storedRefs.every((value) => typeof value === "string")
  ) {
    return false;
  }
  const normalizedStored = [...new Set(storedRefs as string[])].sort(
    (left, right) => left.localeCompare(right),
  );
  return (
    input.receipt.workspaceId === opaqueId(input.projection.workspaceRef) &&
    input.receipt.subjectType === ExecutionReceiptSubjectType.ACTION_ITEM &&
    input.receipt.subjectId === opaqueId(input.projection.actionItemRef) &&
    input.receipt.actionItemId === opaqueId(input.projection.actionItemRef) &&
    input.receipt.outcome === receiptOutcome(input.projection.receiptOutcome) &&
    input.receipt.actionTaken === input.projection.actionTaken &&
    input.receipt.executedByUserId === null &&
    input.receipt.executedByActorType === ActorType.SYSTEM &&
    input.receipt.rejectionReasonCode === null &&
    input.receipt.nextStep === null &&
    input.receipt.note === null &&
    JSON.stringify(normalizedStored) ===
      JSON.stringify(canonicalEvidenceRefs(input.projection))
  );
}

function normalizeError(error: unknown): never {
  if (error instanceof CaioPrivateExecutionResultIngressError) throw error;
  if (error instanceof CaioFdeScopeResolutionError) {
    throw new CaioPrivateExecutionResultIngressError(error.reasons);
  }
  if (
    error instanceof Error &&
    error.message.startsWith("private_execution_result_projection_")
  ) {
    throw new CaioPrivateExecutionResultIngressError([error.message]);
  }
  throw error;
}

export async function ingestCaioPrivateExecutionResultProjection(input: {
  principal: CaioAccessPrincipal;
  projection: unknown;
  now?: Date;
}) {
  const projection = (() => {
    try {
      return parseCaioProPrivateExecutionResultProjection(input.projection);
    } catch (error) {
      normalizeError(error);
    }
  })();
  const workspaceId = opaqueId(projection.workspaceRef);
  if (
    input.principal.audience !== "mcp" ||
    input.principal.clientType !== "workbuddy"
  ) {
    throw new CaioPrivateExecutionResultIngressError([
      "workbuddy_mcp_principal_required",
    ]);
  }
  if (workspaceId !== input.principal.workspaceId) {
    throw new CaioPrivateExecutionResultIngressError([
      "projection_workspace_mismatch",
    ]);
  }
  const userId = principalUserId(input.principal.userRef);
  const now = input.now ?? new Date();
  const recordedAt = new Date(projection.recordedAt);
  if (recordedAt > now) {
    throw new CaioPrivateExecutionResultIngressError([
      "projection_recorded_at_invalid",
    ]);
  }

  const decisionRecordId = opaqueId(projection.decisionRecordRef);
  const actionItemId = opaqueId(projection.actionItemRef);
  const approvalTaskId = opaqueId(projection.approvalTaskRef);

  try {
    return await runWithWriteConflictRetry(() =>
      db.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT claim.id
          FROM DecisionWorkPacketClaim claim
          INNER JOIN ActionItem actionItem ON actionItem.id = claim.actionItemId
          LEFT JOIN ExecutionReceipt receipt ON receipt.actionItemId = actionItem.id
          WHERE claim.workspaceId = ${workspaceId}
            AND claim.actionItemId = ${actionItemId}
          FOR UPDATE`;
        if (locked.length !== 1) {
          throw new CaioPrivateExecutionResultIngressError([
            "governed_work_packet_not_found",
          ]);
        }
        const claim = await tx.decisionWorkPacketClaim.findFirst({
          where: { workspaceId, actionItemId },
          include: {
            decisionRecord: {
              select: { id: true, workspaceId: true, status: true },
            },
            actionItem: {
              include: { approvalTask: true, executionReceipt: true },
            },
          },
        });
        if (!claim) {
          throw new CaioPrivateExecutionResultIngressError([
            "governed_work_packet_changed",
          ]);
        }
        const approvalTask = claim.actionItem.approvalTask;
        const receipt = claim.actionItem.executionReceipt;
        const scopeMatches =
          claim.workspaceId === workspaceId &&
          claim.decisionRecordId === decisionRecordId &&
          claim.decisionRecord.id === decisionRecordId &&
          claim.decisionRecord.workspaceId === workspaceId &&
          claim.actionItemId === actionItemId &&
          claim.actionItem.id === actionItemId &&
          claim.actionItem.workspaceId === workspaceId &&
          claim.actionItem.opportunityId ===
            opaqueId(projection.portfolioRef) &&
          approvalTask?.id === approvalTaskId &&
          approvalTask.workspaceId === workspaceId;
        if (!scopeMatches) {
          throw new CaioPrivateExecutionResultIngressError([
            "projection_work_packet_scope_mismatch",
          ]);
        }

        await assertTransactionAuthorization({
          client: tx,
          workspaceId,
          userId,
          userRef: input.principal.userRef,
          ownerCommandJson: claim.ownerCommandJson,
          actionOwnerId: claim.actionItem.ownerId,
          approvalAssigneeId: approvalTask.approverId,
        });

        if (receipt) {
          if (
            claim.actionItem.status === ActionStatus.EXECUTED &&
            exactReceiptReplay({ receipt, projection })
          ) {
            return {
              kind: "replayed" as const,
              receiptId: receipt.id,
              projectionRef: projection.projectionRef,
              contentHash: projection.contentHash,
            };
          }
          throw new CaioPrivateExecutionResultIngressError([
            "projection_replay_conflict",
          ]);
        }

        await resolveCaioFdePortfolioScope({
          client: tx,
          workspaceId,
          workspaceRef: projection.workspaceRef,
          portfolioRef: projection.portfolioRef,
        });
        const evidence = await resolveCaioFdeObservationEvidence({
          client: tx,
          workspaceId,
          evidenceRef: projection.evidenceSnapshotRef,
          portfolioRef: projection.portfolioRef,
          requiredBindingRefs: [
            projection.decisionRecordRef,
            projection.actionItemRef,
            projection.approvalTaskRef,
            ...projection.executionProofRefs,
          ],
          expectedBusinessResult: projection.outcome.result,
          now,
        });
        if (recordedAt < evidence.observedAt) {
          throw new CaioPrivateExecutionResultIngressError([
            "projection_recorded_at_invalid",
          ]);
        }

        if (
          claim.decisionRecord.status !== "DISPATCHED" ||
          claim.actionItem.status !== ActionStatus.APPROVED ||
          approvalTask?.status !== ApprovalStatus.EXECUTED
        ) {
          throw new CaioPrivateExecutionResultIngressError([
            "governed_work_packet_state_invalid",
          ]);
        }

        const closed = await tx.actionItem.updateMany({
          where: {
            id: actionItemId,
            workspaceId,
            status: ActionStatus.APPROVED,
            updatedAt: claim.actionItem.updatedAt,
          },
          data: {
            status: ActionStatus.EXECUTED,
            executionStatus: "executed",
            executedAt: recordedAt,
            statusReason:
              "Private executor result accepted by governed Core ingress.",
          },
        });
        if (closed.count !== 1) {
          throw new CaioPrivateExecutionResultIngressError([
            "action_item_cas_conflict",
          ]);
        }

        const canonicalReceipt = await recordExecutionReceipt(
          {
            workspaceId,
            subjectType: ExecutionReceiptSubjectType.ACTION_ITEM,
            subjectId: actionItemId,
            actionItemId,
            outcome: receiptOutcome(projection.receiptOutcome),
            actionTaken: projection.actionTaken,
            evidenceRefs: canonicalEvidenceRefs(projection),
            executedByUserId: null,
            executedByActorType: ActorType.SYSTEM,
            actorName: "CAIO private execution ingress",
          },
          { client: tx },
        );
        await auditExecutionReceiptRecorded(
          {
            workspaceId,
            executedByUserId: null,
            executedByActorType: ActorType.SYSTEM,
            actorName: "CAIO private execution ingress",
          },
          canonicalReceipt,
          { client: tx },
        );
        return {
          kind: "recorded" as const,
          receiptId: canonicalReceipt.id,
          projectionRef: projection.projectionRef,
          contentHash: projection.contentHash,
        };
      }, TRANSACTION_OPTIONS),
    );
  } catch (error) {
    normalizeError(error);
  }
}
