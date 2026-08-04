import "server-only";

import {
  Prisma,
  type WorkBuddyMutationChallenge as StoredChallenge,
  type WorkBuddyMutationReceipt as StoredReceipt,
} from "@prisma/client";

import {
  WorkBuddyCollaborationError,
} from "@/lib/caio-collaboration/contracts";
import {
  governedMutationSubmissionReceiptSchema,
  type GovernedMutationResultStore,
  type GovernedMutationSubmissionReceipt,
} from "@/lib/caio-collaboration/governed-mutation-adapter.service";
import {
  governedMutationChallengeConsumptionSchema,
  governedMutationChallengeSchema,
  type GovernedMutationChallenge,
  type GovernedMutationChallengeConsumption,
  type GovernedMutationChallengeStore,
} from "@/lib/caio-collaboration/governed-mutation.service";
import { db } from "@/lib/db";
import { runWithWriteConflictRetry } from "@/lib/db/conflict-aware-write";
import {
  canonicalJson,
  sha256,
} from "@/lib/expert-capability/hashing";

type Tx = Prisma.TransactionClient;
type StoredReceiptWithChallenge =
  Prisma.WorkBuddyMutationReceiptGetPayload<{
    include: { challenge: true };
  }>;

const TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10_000,
  timeout: 30_000,
} as const;

const WRITE_RETRY_OPTIONS = {
  maxAttempts: 8,
  retryDelayMs: 50,
} as const;

function sameValue(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

function parseJson<T>(
  value: string,
  parser: (input: unknown) => T,
  expectedHash: string,
): T {
  let raw: unknown;
  try {
    raw = JSON.parse(value);
  } catch {
    throw new WorkBuddyCollaborationError(
      "INTERNAL_ERROR",
      "A stored WorkBuddy mutation record is not valid JSON.",
    );
  }
  const parsed = parser(raw);
  if (sha256(canonicalJson(parsed)) !== expectedHash) {
    throw new WorkBuddyCollaborationError(
      "INTERNAL_ERROR",
      "A stored WorkBuddy mutation record failed its content hash.",
    );
  }
  return parsed;
}

function freezeChallenge(
  challenge: GovernedMutationChallenge,
): GovernedMutationChallenge {
  return Object.freeze({
    ...challenge,
    target: Object.freeze({ ...challenge.target }),
  });
}

function freezeReceipt(
  receipt: GovernedMutationSubmissionReceipt,
): GovernedMutationSubmissionReceipt {
  return Object.freeze({
    ...receipt,
    target: Object.freeze({ ...receipt.target }),
  });
}

type MutationBindingInput = Readonly<{
  workspaceId: string;
  actionKind: string;
  idempotencyKey: string;
  target: Readonly<{
    objectKind: string;
    objectId: string;
  }>;
  expectedVersion: number;
  summaryHash: string;
}>;

export function computeWorkBuddyMutationBindingHash(
  input: MutationBindingInput,
): string {
  return sha256(
    canonicalJson({
      schemaVersion:
        "helm.workbuddy-mutation-challenge-receipt-binding/v1",
      workspaceId: input.workspaceId,
      actionKind: input.actionKind,
      idempotencyKey: input.idempotencyKey,
      target: input.target,
      expectedVersion: input.expectedVersion,
      summaryHash: input.summaryHash,
    }),
  );
}

function parseStoredChallenge(
  row: StoredChallenge,
): GovernedMutationChallenge {
  const challenge = parseJson(
    row.challengeJson,
    (value) => governedMutationChallengeSchema.parse(value),
    row.contentHash,
  );
  if (
    challenge.challengeId !== row.id ||
    challenge.workspaceId !== row.workspaceId ||
    challenge.clientId !== row.clientId ||
    challenge.actorUserId !== row.actorUserId ||
    challenge.ceoBindingRef !== row.ceoBindingRef ||
    challenge.mandateRef !== row.mandateRef ||
    challenge.ceoRef !== row.ceoRef ||
    challenge.actionKind !== row.actionKind ||
    challenge.target.objectKind !== row.targetObjectKind ||
    challenge.target.objectId !== row.targetObjectId ||
    challenge.expectedVersion !== row.expectedVersion ||
    challenge.summaryHash !== row.summaryHash ||
    challenge.idempotencyKey !== row.idempotencyKey ||
    computeWorkBuddyMutationBindingHash(challenge) !==
      row.bindingHash ||
    sha256(challenge.nonce) !== row.nonceHash ||
    challenge.issuedAt !== row.issuedAt.toISOString() ||
    challenge.expiresAt !== row.expiresAt.toISOString() ||
    (row.consumedAt === null) !== (row.proofHash === null)
  ) {
    throw new WorkBuddyCollaborationError(
      "INTERNAL_ERROR",
      "A stored WorkBuddy mutation challenge has inconsistent indexed fields.",
    );
  }
  return freezeChallenge(challenge);
}

function parseStoredReceipt(
  row: StoredReceipt | StoredReceiptWithChallenge,
): GovernedMutationSubmissionReceipt {
  const receipt = parseJson(
    row.receiptJson,
    (value) => governedMutationSubmissionReceiptSchema.parse(value),
    row.contentHash,
  );
  if (
    receipt.receiptRef !== row.id ||
    receipt.challengeId !== row.challengeId ||
    receipt.workspaceId !== row.workspaceId ||
    receipt.actionKind !== row.actionKind ||
    receipt.idempotencyKey !== row.idempotencyKey ||
    receipt.target.objectKind !== row.targetObjectKind ||
    receipt.target.objectId !== row.targetObjectId ||
    receipt.expectedVersion !== row.expectedVersion ||
    receipt.summaryHash !== row.summaryHash ||
    computeWorkBuddyMutationBindingHash(receipt) !==
      row.bindingHash ||
    receipt.canonicalReceiptRef !== row.canonicalReceiptRef ||
    receipt.authorityEffect !== row.authorityEffect ||
    receipt.recordedAt !== row.recordedAt.toISOString()
  ) {
    throw new WorkBuddyCollaborationError(
      "INTERNAL_ERROR",
      "A stored WorkBuddy mutation receipt has inconsistent indexed fields.",
    );
  }
  if ("challenge" in row) {
    const challenge = parseStoredChallenge(row.challenge);
    if (
      challenge.challengeId !== receipt.challengeId ||
      row.challenge.bindingHash !== row.bindingHash ||
      row.challenge.consumedAt === null ||
      row.challenge.proofHash === null ||
      receipt.recordedAt !==
        row.challenge.consumedAt.toISOString()
    ) {
      throw new WorkBuddyCollaborationError(
        "INTERNAL_ERROR",
        "A stored WorkBuddy mutation receipt is not bound to its consumed challenge.",
      );
    }
  }
  return freezeReceipt(receipt);
}

function challengeBinding(
  challenge: GovernedMutationChallenge,
): Readonly<Record<string, unknown>> {
  return {
    workspaceId: challenge.workspaceId,
    clientId: challenge.clientId,
    actorUserId: challenge.actorUserId,
    ceoBindingRef: challenge.ceoBindingRef,
    mandateRef: challenge.mandateRef,
    ceoRef: challenge.ceoRef,
    actionKind: challenge.actionKind,
    target: challenge.target,
    expectedVersion: challenge.expectedVersion,
    summaryHash: challenge.summaryHash,
    idempotencyKey: challenge.idempotencyKey,
  };
}

async function lockWorkspace(tx: Tx, workspaceId: string): Promise<void> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM Workspace WHERE id = ${workspaceId} FOR UPDATE`;
  if (rows.length !== 1) {
    throw new WorkBuddyCollaborationError(
      "INVALID_TOOL_INPUT",
      "The WorkBuddy workspace does not exist.",
    );
  }
}

function transaction<T>(work: (tx: Tx) => Promise<T>): Promise<T> {
  return runWithWriteConflictRetry(
    () => db.$transaction(work, TRANSACTION_OPTIONS),
    WRITE_RETRY_OPTIONS,
  );
}

export function createPrismaGovernedMutationChallengeStore(): GovernedMutationChallengeStore {
  return Object.freeze({
    async register(
      rawChallenge: GovernedMutationChallenge,
    ): Promise<GovernedMutationChallenge> {
      const challenge = freezeChallenge(
        governedMutationChallengeSchema.parse(rawChallenge),
      );
      return transaction(async (tx) => {
        await lockWorkspace(tx, challenge.workspaceId);
        const existingById =
          await tx.workBuddyMutationChallenge.findUnique({
            where: { id: challenge.challengeId },
          });
        if (existingById) {
          const existing = parseStoredChallenge(existingById);
          if (!sameValue(existing, challenge)) {
            throw new WorkBuddyCollaborationError(
              "REPLAY_REJECTED",
              "The challenge id is already bound to another mutation.",
            );
          }
          return existing;
        }

        const current =
          await tx.workBuddyMutationChallenge.findUnique({
            where: {
              workspaceId_actionKind_idempotencyKey: {
                workspaceId: challenge.workspaceId,
                actionKind: challenge.actionKind,
                idempotencyKey: challenge.idempotencyKey,
              },
            },
          });
        if (current) {
          const existing = parseStoredChallenge(current);
          if (
            !sameValue(
              challengeBinding(existing),
              challengeBinding(challenge),
            )
          ) {
            throw new WorkBuddyCollaborationError(
              "VERSION_CONFLICT",
              "The idempotency key is already bound to another mutation challenge.",
            );
          }
          return existing;
        }

        const nonceHash = sha256(challenge.nonce);
        const nonceOwner =
          await tx.workBuddyMutationChallenge.findUnique({
            where: {
              workspaceId_clientId_nonceHash: {
                workspaceId: challenge.workspaceId,
                clientId: challenge.clientId,
                nonceHash,
              },
            },
          });
        if (nonceOwner) {
          throw new WorkBuddyCollaborationError(
            "REPLAY_REJECTED",
            "The mutation challenge nonce is already bound to another challenge.",
          );
        }

        const challengeJson = canonicalJson(challenge);
        const bindingHash =
          computeWorkBuddyMutationBindingHash(challenge);
        await tx.workBuddyMutationChallenge.create({
          data: {
            id: challenge.challengeId,
            workspaceId: challenge.workspaceId,
            clientId: challenge.clientId,
            actorUserId: challenge.actorUserId,
            ceoBindingRef: challenge.ceoBindingRef,
            mandateRef: challenge.mandateRef,
            ceoRef: challenge.ceoRef,
            actionKind: challenge.actionKind,
            targetObjectKind: challenge.target.objectKind,
            targetObjectId: challenge.target.objectId,
            expectedVersion: challenge.expectedVersion,
            summaryHash: challenge.summaryHash,
            idempotencyKey: challenge.idempotencyKey,
            nonceHash,
            bindingHash,
            issuedAt: new Date(challenge.issuedAt),
            expiresAt: new Date(challenge.expiresAt),
            challengeJson,
            contentHash: sha256(challengeJson),
          },
        });
        return challenge;
      });
    },

    async get(challengeId: string) {
      const row = await db.workBuddyMutationChallenge.findUnique({
        where: { id: challengeId },
      });
      return row ? parseStoredChallenge(row) : null;
    },

    async getConsumption(
      challengeId: string,
    ): Promise<GovernedMutationChallengeConsumption | null> {
      const row = await db.workBuddyMutationChallenge.findUnique({
        where: { id: challengeId },
      });
      if (!row?.consumedAt || !row.proofHash) return null;
      return Object.freeze(
        governedMutationChallengeConsumptionSchema.parse({
          schemaVersion:
            "helm.workbuddy-governed-mutation-consumption/v1",
          challengeId: row.id,
          workspaceId: row.workspaceId,
          clientId: row.clientId,
          proofHash: row.proofHash,
          consumedAt: row.consumedAt.toISOString(),
        }),
      );
    },

    async consume(input: {
      challengeId: string;
      workspaceId: string;
      clientId: string;
      proofHash: string;
      consumedAt: string;
    }): Promise<boolean> {
      return transaction(async (tx) => {
        await lockWorkspace(tx, input.workspaceId);
        const row = await tx.workBuddyMutationChallenge.findFirst({
          where: {
            id: input.challengeId,
            workspaceId: input.workspaceId,
          },
        });
        if (
          !row ||
          row.clientId !== input.clientId ||
          row.consumedAt !== null
        ) {
          return false;
        }
        const updated =
          await tx.workBuddyMutationChallenge.updateMany({
            where: {
              id: input.challengeId,
              workspaceId: input.workspaceId,
              clientId: input.clientId,
              consumedAt: null,
              proofHash: null,
            },
            data: {
              consumedAt: new Date(input.consumedAt),
              proofHash: input.proofHash,
            },
          });
        return updated.count === 1;
      });
    },
  });
}

export function createPrismaGovernedMutationResultStore(): GovernedMutationResultStore {
  return Object.freeze({
    async get(
      input: Parameters<GovernedMutationResultStore["get"]>[0],
    ) {
      const row = await db.workBuddyMutationReceipt.findUnique({
        where: {
          workspaceId_actionKind_idempotencyKey: {
            workspaceId: input.workspaceId,
            actionKind: input.actionKind,
            idempotencyKey: input.idempotencyKey,
          },
        },
        include: { challenge: true },
      });
      return row ? parseStoredReceipt(row) : null;
    },

    async record(rawReceipt: GovernedMutationSubmissionReceipt) {
      const receipt = freezeReceipt(
        governedMutationSubmissionReceiptSchema.parse(rawReceipt),
      );
      return transaction(async (tx) => {
        await lockWorkspace(tx, receipt.workspaceId);
        const existing =
          await tx.workBuddyMutationReceipt.findUnique({
            where: {
              workspaceId_actionKind_idempotencyKey: {
                workspaceId: receipt.workspaceId,
                actionKind: receipt.actionKind,
                idempotencyKey: receipt.idempotencyKey,
              },
            },
            include: { challenge: true },
          });
        if (existing) {
          const parsed = parseStoredReceipt(existing);
          if (!sameValue(parsed, receipt)) {
            throw new WorkBuddyCollaborationError(
              "VERSION_CONFLICT",
              "The idempotency key already has another mutation receipt.",
            );
          }
          return Object.freeze({
            receipt: parsed,
            outcome: "replayed" as const,
          });
        }
        const challengeRow =
          await tx.workBuddyMutationChallenge.findFirst({
            where: {
              id: receipt.challengeId,
              workspaceId: receipt.workspaceId,
            },
          });
        if (!challengeRow) {
          throw new WorkBuddyCollaborationError(
            "VERSION_CONFLICT",
            "The mutation receipt challenge no longer exists.",
          );
        }
        const challenge = parseStoredChallenge(challengeRow);
        const bindingHash =
          computeWorkBuddyMutationBindingHash(receipt);
        if (
          challengeRow.bindingHash !== bindingHash ||
          challengeRow.consumedAt === null ||
          challengeRow.proofHash === null ||
          receipt.recordedAt !==
            challengeRow.consumedAt.toISOString() ||
          challenge.actionKind !== receipt.actionKind ||
          challenge.idempotencyKey !== receipt.idempotencyKey ||
          challenge.expectedVersion !== receipt.expectedVersion ||
          challenge.summaryHash !== receipt.summaryHash ||
          !sameValue(challenge.target, receipt.target)
        ) {
          throw new WorkBuddyCollaborationError(
            "VERSION_CONFLICT",
            "The mutation receipt does not match its consumed challenge.",
          );
        }
        const receiptJson = canonicalJson(receipt);
        await tx.workBuddyMutationReceipt.create({
          data: {
            id: receipt.receiptRef,
            workspaceId: receipt.workspaceId,
            challengeId: receipt.challengeId,
            actionKind: receipt.actionKind,
            idempotencyKey: receipt.idempotencyKey,
            targetObjectKind: receipt.target.objectKind,
            targetObjectId: receipt.target.objectId,
            expectedVersion: receipt.expectedVersion,
            summaryHash: receipt.summaryHash,
            bindingHash,
            canonicalReceiptRef: receipt.canonicalReceiptRef,
            receiptJson,
            contentHash: sha256(receiptJson),
            authorityEffect: receipt.authorityEffect,
            recordedAt: new Date(receipt.recordedAt),
          },
        });
        return Object.freeze({
          receipt,
          outcome: "created" as const,
        });
      });
    },
  });
}
