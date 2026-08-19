import "server-only";

import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { runWithWriteConflictRetry } from "@/lib/db/conflict-aware-write";
import { canonicalJson } from "@/lib/expert-capability/hashing";
import {
  hashMemberWorkSignalPayload,
  judgeMemberWorkSignalChallenge,
  judgeMemberWorkSignalSubmission,
  judgeSupersedingSignalReceipt,
  MEMBER_SIGNAL_TAINT,
  validateMemberWorkSignalDraft,
  type MemberWorkSignalChallenge,
  type MemberWorkSignalDraft,
  type MemberWorkSignalKind,
  type MemberWorkSignalPayload,
  type MemberWorkSignalReceipt,
  type MemberWorkSignalSubmission,
} from "@/lib/member-gateway/signal";
import type {
  MemberPrincipal,
  MemberReadSurfaceDecision,
} from "@/lib/member-gateway/types";
import { safeParseJson } from "@/lib/utils";

type Tx = Prisma.TransactionClient;
type ChallengeRow = Prisma.MemberWorkSignalChallengeGetPayload<object>;
type ReceiptRow = Prisma.MemberWorkSignalReceiptGetPayload<object>;

const TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10_000,
  timeout: 30_000,
} as const;

const WRITE_RETRY_OPTIONS = {
  maxAttempts: 8,
  retryDelayMs: 50,
} as const;

export class MemberSignalStoreError extends Error {
  readonly reasons: readonly string[];

  constructor(message: string, reasons: readonly string[] = []) {
    super(reasons.length > 0 ? `${message}: ${reasons.join("; ")}` : message);
    this.name = "MemberSignalStoreError";
    this.reasons = reasons;
  }
}

function nonEmpty(value: string, reason: string): string {
  const normalized = value.trim();
  if (!normalized) throw new MemberSignalStoreError(reason);
  return normalized;
}

function isUniqueConstraintViolation(
  error: unknown,
  constraintName?: string,
): boolean {
  if (
    typeof error !== "object" ||
    error === null ||
    (error as { code?: string }).code !== "P2002"
  ) {
    return false;
  }
  if (!constraintName) return true;
  const target = (error as { meta?: { target?: unknown } }).meta?.target;
  if (typeof target === "string") return target.includes(constraintName);
  if (Array.isArray(target)) return target.includes(constraintName);
  return false;
}

async function lockWorkspace(tx: Tx, workspaceId: string): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM Workspace WHERE id = ${workspaceId} FOR UPDATE`;
  if (rows.length !== 1) {
    throw new MemberSignalStoreError("workspace_not_found");
  }
}

function contractChallengeFromRow(
  row: ChallengeRow,
): MemberWorkSignalChallenge {
  return Object.freeze({
    challengeRef: row.id,
    workspaceRef: row.workspaceId,
    memberRef: row.memberRef,
    objectRef: row.objectRef,
    objectVersion: row.objectVersion,
    payloadHash: row.payloadHash,
    issuedAt: row.issuedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  });
}

// Reconstructs the contract receipt from its stored row, re-verifying the
// payloadJson/payloadHash binding on every read — a receipt is never trusted
// on the strength of its columns alone (spec §5/§9).
function contractReceiptFromRow(row: ReceiptRow): MemberWorkSignalReceipt {
  const payload = safeParseJson<MemberWorkSignalPayload | null>(
    row.payloadJson,
    null,
  );
  if (
    !payload ||
    hashMemberWorkSignalPayload(payload) !== row.payloadHash
  ) {
    throw new MemberSignalStoreError("receipt_content_hash_mismatch");
  }
  if (row.candidate !== true) {
    throw new MemberSignalStoreError("stored_receipt_candidate_invalid");
  }
  if (row.taint !== MEMBER_SIGNAL_TAINT) {
    throw new MemberSignalStoreError("stored_receipt_taint_invalid");
  }
  return Object.freeze({
    receiptId: row.id,
    workspaceRef: row.workspaceId,
    memberRef: row.memberRef,
    deviceRegistrationRef: row.deviceRegistrationRef,
    clientId: row.clientId,
    objectRef: row.objectRef,
    objectVersion: row.objectVersion,
    kind: row.kind as MemberWorkSignalKind,
    payloadHash: row.payloadHash,
    policyRef: row.policyRef,
    policyVersion: row.policyVersion,
    submittedAt: row.submittedAt.toISOString(),
    candidate: true,
    taint: MEMBER_SIGNAL_TAINT,
    supersedesReceiptRef: row.supersedesReceiptRef,
  });
}

export type IssueMemberWorkSignalChallengeInput = {
  draft: MemberWorkSignalDraft;
  ttlMs: number;
};

// Issues a one-time work-signal challenge (spec §6.2). Pure judgment stays
// in signal.ts: this function only assembles the candidate challenge and
// lets judgeMemberWorkSignalChallenge act as the backstop (it enforces the
// TTL cap and the issued/expires window) before persisting.
export async function issueMemberWorkSignalChallenge(
  input: IssueMemberWorkSignalChallengeInput,
): Promise<MemberWorkSignalChallenge> {
  const draftValidation = validateMemberWorkSignalDraft(input.draft);
  if (!draftValidation.valid) {
    throw new MemberSignalStoreError(
      "signal_draft_invalid",
      draftValidation.errors,
    );
  }
  const workspaceId = nonEmpty(
    input.draft.principal.workspaceRef,
    "workspace_ref_required",
  );
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + input.ttlMs);
  const payloadHash = hashMemberWorkSignalPayload(input.draft.payload);
  const candidate: MemberWorkSignalChallenge = {
    challengeRef: randomUUID(),
    workspaceRef: workspaceId,
    memberRef: input.draft.principal.memberRef,
    objectRef: input.draft.objectRef,
    objectVersion: input.draft.objectVersion,
    payloadHash,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
  const challengeJudgment = judgeMemberWorkSignalChallenge(candidate);
  if (!challengeJudgment.valid) {
    throw new MemberSignalStoreError(
      "challenge_invalid",
      challengeJudgment.errors,
    );
  }

  return runWithWriteConflictRetry(
    () =>
      db.$transaction(async (tx) => {
        await lockWorkspace(tx, workspaceId);
        await tx.memberWorkSignalChallenge.create({
          data: {
            id: candidate.challengeRef,
            workspaceId,
            memberRef: candidate.memberRef,
            deviceRegistrationRef: input.draft.principal.deviceRegistrationRef,
            clientId: input.draft.principal.clientId,
            objectRef: candidate.objectRef,
            objectVersion: candidate.objectVersion,
            payloadHash,
            issuedAt,
            expiresAt,
          },
        });
        return Object.freeze({ ...candidate });
      }, TRANSACTION_OPTIONS),
    WRITE_RETRY_OPTIONS,
  );
}

export type SubmitMemberWorkSignalInput = {
  principal: MemberPrincipal;
  challengeRef: string;
  payload: MemberWorkSignalPayload;
  // The member's read-surface decision for the TARGET object of this
  // submission.
  surface: MemberReadSurfaceDecision;
  // Per-ref authorization evidence for payload.relatedEvidenceRefs (spec §9
  // over-privilege check; M2a as-built #7 — this is the store/runtime layer
  // that holds the per-ref data the pure judgment cannot see).
  evidenceSurfaces: ReadonlyMap<string, MemberReadSurfaceDecision>;
  policyRef: string;
  policyVersion: number;
  receiptId: string;
  supersedesReceiptRef?: string | null;
};

export type SubmitMemberWorkSignalResult = {
  outcome: "recorded" | "replayed";
  receipt: MemberWorkSignalReceipt;
};

// Submits a work signal against a previously issued challenge (spec
// §5/§6.2/§9). Serializable + inline transaction, workspace row locked
// first, challenge consumption is a CAS updateMany guarded by
// `consumedAt: null` and a `count !== 1` check — the only permitted
// mutation on MemberWorkSignalChallenge. Everything else is
// load-truth -> judge (via signal.ts) -> persist; no judgment is
// reimplemented here.
export async function submitMemberWorkSignal(
  input: SubmitMemberWorkSignalInput,
): Promise<SubmitMemberWorkSignalResult> {
  const workspaceId = nonEmpty(
    input.principal.workspaceRef,
    "workspace_ref_required",
  );
  const challengeRef = nonEmpty(input.challengeRef, "challenge_ref_required");
  const receiptId = nonEmpty(input.receiptId, "receipt_id_required");
  const supersedesReceiptRef = input.supersedesReceiptRef ?? null;
  const payloadHash = hashMemberWorkSignalPayload(input.payload);

  return runWithWriteConflictRetry(
    () =>
      db.$transaction(async (tx) => {
        await lockWorkspace(tx, workspaceId);

        // 1. Load the challenge row (id + workspaceId).
        const challengeRow = await tx.memberWorkSignalChallenge.findUnique({
          where: { id_workspaceId: { id: challengeRef, workspaceId } },
        });
        if (!challengeRow) {
          throw new MemberSignalStoreError("challenge_not_found");
        }

        // 2. Replay detection: same receiptId + a persisted receipt whose
        // payloadHash matches this submission's payload -> replay. Any
        // other already-consumed shape falls through to the contract
        // judgment below, which rejects with challenge_already_consumed.
        if (
          challengeRow.consumedAt !== null &&
          challengeRow.consumptionReceiptRef === receiptId
        ) {
          const existingReceipt = await tx.memberWorkSignalReceipt.findUnique(
            {
              where: { id_workspaceId: { id: receiptId, workspaceId } },
            },
          );
          if (existingReceipt && existingReceipt.payloadHash === payloadHash) {
            return {
              outcome: "replayed" as const,
              receipt: contractReceiptFromRow(existingReceipt),
            };
          }
        }

        // 3. Per-ref evidence authorization (M2a as-built #7): every
        // related evidence ref must be present in evidenceSurfaces AND
        // allowed.
        const evidenceReasons = input.payload.relatedEvidenceRefs
          .filter((ref) => {
            const decision = input.evidenceSurfaces.get(ref);
            return !decision || decision.allowed !== true;
          })
          .map((ref) => `evidence_ref_not_authorized:${ref}`);

        // 4. Contract submission judgment (challenge shape/window/replay,
        // draft shape, payload hash binding, surface authorization).
        const submittedAt = new Date();
        const submission: MemberWorkSignalSubmission = {
          challenge: contractChallengeFromRow(challengeRow),
          principal: input.principal,
          payload: input.payload,
          surface: input.surface,
          submittedAt: submittedAt.toISOString(),
          priorConsumptionRef: challengeRow.consumptionReceiptRef,
        };
        const submissionJudgment = judgeMemberWorkSignalSubmission(submission);
        const reasons = [...submissionJudgment.errors, ...evidenceReasons];
        if (reasons.length > 0) {
          throw new MemberSignalStoreError(
            "signal_submission_rejected",
            reasons,
          );
        }

        // 5. Superseding-chain judgment, when this submission corrects a
        // prior receipt.
        if (supersedesReceiptRef !== null) {
          const priorRow = await tx.memberWorkSignalReceipt.findUnique({
            where: {
              id_workspaceId: { id: supersedesReceiptRef, workspaceId },
            },
          });
          if (!priorRow) {
            throw new MemberSignalStoreError("supersedes_prior_not_found");
          }
          const alreadySuperseded =
            await tx.memberWorkSignalReceipt.findUnique({
              where: {
                workspaceId_supersedesReceiptRef: {
                  workspaceId,
                  supersedesReceiptRef,
                },
              },
            });
          const nextCandidate: MemberWorkSignalReceipt = {
            receiptId,
            workspaceRef: workspaceId,
            memberRef: input.principal.memberRef,
            deviceRegistrationRef: input.principal.deviceRegistrationRef,
            clientId: input.principal.clientId,
            objectRef: challengeRow.objectRef,
            objectVersion: challengeRow.objectVersion,
            kind: input.payload.kind,
            payloadHash,
            policyRef: input.policyRef,
            policyVersion: input.policyVersion,
            submittedAt: submission.submittedAt,
            candidate: true,
            taint: MEMBER_SIGNAL_TAINT,
            supersedesReceiptRef,
          };
          const supersedeJudgment = judgeSupersedingSignalReceipt({
            prior: contractReceiptFromRow(priorRow),
            next: nextCandidate,
            priorAlreadySupersededBy: alreadySuperseded?.id ?? null,
          });
          if (!supersedeJudgment.valid) {
            throw new MemberSignalStoreError(
              "superseding_receipt_rejected",
              supersedeJudgment.errors,
            );
          }
        }

        // 6. CAS consumption: the only permitted mutation on
        // MemberWorkSignalChallenge. Lexically inside this serializable
        // tx, issued on `tx`, with a state predicate (consumedAt: null) —
        // satisfies check:conditional-update-cas.
        const consumeResult = await tx.memberWorkSignalChallenge.updateMany({
          where: { id: challengeRef, workspaceId, consumedAt: null },
          data: { consumedAt: submittedAt, consumptionReceiptRef: receiptId },
        });
        if (consumeResult.count !== 1) {
          throw new MemberSignalStoreError("challenge_consumption_conflict");
        }

        // 7. Append-only receipt insert.
        try {
          const created = await tx.memberWorkSignalReceipt.create({
            data: {
              id: receiptId,
              workspaceId,
              memberRef: input.principal.memberRef,
              deviceRegistrationRef: input.principal.deviceRegistrationRef,
              clientId: input.principal.clientId,
              objectRef: challengeRow.objectRef,
              objectVersion: challengeRow.objectVersion,
              kind: input.payload.kind,
              payloadJson: canonicalJson(input.payload),
              payloadHash,
              policyRef: input.policyRef,
              policyVersion: input.policyVersion,
              submittedAt,
              candidate: true,
              taint: MEMBER_SIGNAL_TAINT,
              challengeRef,
              supersedesReceiptRef,
            },
          });
          return {
            outcome: "recorded" as const,
            receipt: contractReceiptFromRow(created),
          };
        } catch (error) {
          if (
            isUniqueConstraintViolation(
              error,
              "MWSignalReceipt_workspace_supersedes_key",
            )
          ) {
            throw new MemberSignalStoreError(
              "receipt_already_superseded_concurrent",
            );
          }
          if (isUniqueConstraintViolation(error)) {
            throw new MemberSignalStoreError("receipt_unique_conflict");
          }
          throw error;
        }
      }, TRANSACTION_OPTIONS),
    WRITE_RETRY_OPTIONS,
  );
}

// Read-only lookup. Re-verifies the payloadJson/payloadHash binding on
// every read (see contractReceiptFromRow) rather than trusting the stored
// columns.
export async function getMemberWorkSignalReceipt(
  workspaceId: string,
  receiptId: string,
): Promise<MemberWorkSignalReceipt | null> {
  const row = await db.memberWorkSignalReceipt.findUnique({
    where: { id_workspaceId: { id: receiptId, workspaceId } },
  });
  return row ? contractReceiptFromRow(row) : null;
}
