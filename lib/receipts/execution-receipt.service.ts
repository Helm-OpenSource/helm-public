import {
  ActorType,
  ExecutionReceiptOutcome,
  ExecutionReceiptSubjectType,
  ExecutionReceiptVerificationState,
  type RejectionReasonCode,
} from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { jsonStringify, safeParseJson } from "@/lib/utils";
import { computeExecutionReceiptQuality } from "@/lib/receipts/execution-receipt-quality";

// Receipt-level separation of duties: a receipt can only be VERIFIED by
// someone other than its executor. Surfaced as a decision result, not a crash.
export class ReceiptSelfVerificationError extends Error {
  constructor(english: boolean) {
    super(
      english
        ? "A receipt cannot be verified by the person who executed the work. Ask another reviewer to confirm it."
        : "回执不能由执行人本人验收，请交由其他复核人确认。",
    );
    this.name = "ReceiptSelfVerificationError";
  }
}

export type RecordExecutionReceiptInput = {
  workspaceId: string;
  subjectType: ExecutionReceiptSubjectType;
  subjectId: string;
  actionItemId?: string | null;
  outcome: ExecutionReceiptOutcome;
  actionTaken: string;
  evidenceRefs?: string[];
  rejectionReasonCode?: RejectionReasonCode | null;
  nextStep?: string | null;
  note?: string | null;
  executedByUserId?: string | null;
  executedByActorType?: ActorType | null;
  actorName?: string;
};

function buildQualityInput(receipt: {
  outcome: ExecutionReceiptOutcome;
  evidenceRefs: string[] | null;
  nextStep: string | null;
  note: string | null;
  rejectionReasonCode: RejectionReasonCode | null;
  verificationState: ExecutionReceiptVerificationState;
}) {
  return computeExecutionReceiptQuality({
    outcome: receipt.outcome,
    evidenceRefCount: receipt.evidenceRefs?.length ?? 0,
    hasNextStep: Boolean(receipt.nextStep && receipt.nextStep.trim().length > 0),
    hasNote: Boolean(receipt.note && receipt.note.trim().length > 0),
    rejectionReasonCode: receipt.rejectionReasonCode,
    verificationState: receipt.verificationState,
  });
}

// Record (or overwrite with the latest truth) the canonical receipt for a
// closed work item. Callers are expected to have already asserted workspace
// access on the enclosing flow; this service still scopes every query by
// workspaceId as defense in depth.
export async function recordExecutionReceipt(input: RecordExecutionReceiptInput) {
  const evidenceRefs = input.evidenceRefs?.filter((ref) => ref.trim().length > 0) ?? [];
  const quality = buildQualityInput({
    outcome: input.outcome,
    evidenceRefs,
    nextStep: input.nextStep ?? null,
    note: input.note ?? null,
    rejectionReasonCode: input.rejectionReasonCode ?? null,
    verificationState: ExecutionReceiptVerificationState.SELF_REPORTED,
  });

  const data = {
    workspaceId: input.workspaceId,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    actionItemId: input.actionItemId ?? null,
    outcome: input.outcome,
    actionTaken: input.actionTaken,
    evidenceRefs: evidenceRefs.length > 0 ? jsonStringify(evidenceRefs) : null,
    rejectionReasonCode: input.rejectionReasonCode ?? null,
    nextStep: input.nextStep ?? null,
    note: input.note ?? null,
    executedByUserId: input.executedByUserId ?? null,
    executedByActorType: input.executedByActorType ?? null,
    verifiedByUserId: null,
    verificationState: ExecutionReceiptVerificationState.SELF_REPORTED,
    qualityScore: quality.score,
    qualityFlags: quality.flags.length > 0 ? jsonStringify(quality.flags) : null,
  };

  const receipt = await db.executionReceipt.upsert({
    where: {
      subjectType_subjectId: {
        subjectType: input.subjectType,
        subjectId: input.subjectId,
      },
    },
    create: data,
    update: data,
  });

  await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.executedByUserId ?? undefined,
    actor: input.actorName ?? "Helm",
    actorType: input.executedByActorType ?? ActorType.SYSTEM,
    actionType: "EXECUTION_RECEIPT_RECORDED",
    targetType: "ExecutionReceipt",
    targetId: receipt.id,
    summary: `回执已记录：${input.actionTaken}（${input.outcome}）`,
    payload: {
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      outcome: input.outcome,
      rejectionReasonCode: input.rejectionReasonCode ?? null,
      evidenceRefCount: evidenceRefs.length,
      qualityScore: quality.score,
      qualityFlags: quality.flags,
    },
  });

  return receipt;
}

export type VerifyExecutionReceiptInput = {
  workspaceId: string;
  subjectType: ExecutionReceiptSubjectType;
  subjectId: string;
  verifierUserId: string;
  verifierName: string;
  english?: boolean;
};

// Upgrade a receipt from SELF_REPORTED to VERIFIED. Idempotent for the same
// verifier; hard-refuses executor self-verification.
export async function verifyExecutionReceipt(input: VerifyExecutionReceiptInput) {
  const english = input.english ?? false;
  const receipt = await db.executionReceipt.findFirst({
    where: {
      workspaceId: input.workspaceId,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
    },
  });

  if (!receipt) {
    throw new Error(english ? "Execution receipt not found" : "回执不存在");
  }

  if (receipt.executedByUserId && receipt.executedByUserId === input.verifierUserId) {
    throw new ReceiptSelfVerificationError(english);
  }

  if (
    receipt.verificationState === ExecutionReceiptVerificationState.VERIFIED &&
    receipt.verifiedByUserId === input.verifierUserId
  ) {
    return receipt;
  }

  const quality = buildQualityInput({
    outcome: receipt.outcome,
    evidenceRefs: safeParseJson<string[]>(receipt.evidenceRefs, []),
    nextStep: receipt.nextStep,
    note: receipt.note,
    rejectionReasonCode: receipt.rejectionReasonCode,
    verificationState: ExecutionReceiptVerificationState.VERIFIED,
  });

  const updated = await db.executionReceipt.update({
    where: { id: receipt.id },
    data: {
      verifiedByUserId: input.verifierUserId,
      verificationState: ExecutionReceiptVerificationState.VERIFIED,
      qualityScore: quality.score,
      qualityFlags: quality.flags.length > 0 ? jsonStringify(quality.flags) : null,
    },
  });

  await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.verifierUserId,
    actor: input.verifierName,
    actorType: ActorType.USER,
    actionType: "EXECUTION_RECEIPT_VERIFIED",
    targetType: "ExecutionReceipt",
    targetId: receipt.id,
    summary: `回执已由他人验收确认：${receipt.actionTaken}`,
    payload: {
      subjectType: receipt.subjectType,
      subjectId: receipt.subjectId,
      executedByUserId: receipt.executedByUserId,
      qualityScore: quality.score,
    },
  });

  return updated;
}
