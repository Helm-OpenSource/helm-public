import {
  ActorType,
  ExecutionReceiptOutcome,
  ExecutionReceiptSubjectType,
  ExecutionReceiptVerificationState,
  type ExecutionReceipt,
  type PrismaClient,
  type RejectionReasonCode,
} from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import { jsonStringify, safeParseJson } from "@/lib/utils";
import { computeExecutionReceiptQuality } from "@/lib/receipts/execution-receipt-quality";

// Structural client type so the upsert can run inside a caller-owned
// transaction (Prisma.TransactionClient is structurally compatible).
export type ExecutionReceiptDbClient = Pick<PrismaClient, "executionReceipt">;

export class ExecutionReceiptNotFoundError extends Error {
  constructor(english: boolean) {
    super(english ? "Execution receipt not found" : "回执不存在");
    this.name = "ExecutionReceiptNotFoundError";
  }
}

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
//
// Fail-closed contract: when the caller closes a task's terminal state, it
// must pass its transaction client via options.client so the receipt commits
// (or rolls back) together with the state change — a closed task without a
// receipt must be impossible. With a caller-owned client the audit entry is
// deferred: call auditExecutionReceiptRecorded AFTER the transaction commits.
export async function recordExecutionReceipt(
  input: RecordExecutionReceiptInput,
  options?: { client?: ExecutionReceiptDbClient },
) {
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

  const receipt = await (options?.client ?? db).executionReceipt.upsert({
    where: {
      subjectType_subjectId: {
        subjectType: input.subjectType,
        subjectId: input.subjectId,
      },
    },
    create: data,
    update: data,
  });

  if (!options?.client) {
    await auditExecutionReceiptRecorded(input, receipt);
  }

  return receipt;
}

// Audit entry for a recorded receipt. Split from the write so transactional
// callers can log AFTER commit — an audit row must never describe a receipt
// that was rolled back.
export async function auditExecutionReceiptRecorded(
  input: Pick<
    RecordExecutionReceiptInput,
    "workspaceId" | "executedByUserId" | "executedByActorType" | "actorName"
  >,
  receipt: Pick<
    ExecutionReceipt,
    | "id"
    | "subjectType"
    | "subjectId"
    | "outcome"
    | "actionTaken"
    | "rejectionReasonCode"
    | "evidenceRefs"
    | "qualityScore"
    | "qualityFlags"
  >,
) {
  await writeAuditLog({
    workspaceId: input.workspaceId,
    userId: input.executedByUserId ?? undefined,
    actor: input.actorName ?? "Helm",
    actorType: input.executedByActorType ?? ActorType.SYSTEM,
    actionType: "EXECUTION_RECEIPT_RECORDED",
    targetType: "ExecutionReceipt",
    targetId: receipt.id,
    summary: `回执已记录：${receipt.actionTaken}（${receipt.outcome}）`,
    payload: {
      subjectType: receipt.subjectType,
      subjectId: receipt.subjectId,
      outcome: receipt.outcome,
      rejectionReasonCode: receipt.rejectionReasonCode ?? null,
      evidenceRefCount: safeParseJson<string[]>(receipt.evidenceRefs, []).length,
      qualityScore: receipt.qualityScore,
      qualityFlags: safeParseJson<string[]>(receipt.qualityFlags, []),
    },
  });
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
    throw new ExecutionReceiptNotFoundError(english);
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
