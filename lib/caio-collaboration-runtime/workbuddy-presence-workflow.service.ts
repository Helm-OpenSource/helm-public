import "server-only";

import { randomBytes } from "node:crypto";

import {
  Prisma,
  type WorkBuddyPresenceChallenge as StoredPresenceChallenge,
} from "@prisma/client";

import {
  requireWorkBuddyAuthorizationContext,
  requireWorkBuddyOwnerCeoSnapshot,
  WORKBUDDY_OWNER_READ_CAPABILITY,
  workBuddyAuthorizationContextSchema,
  type WorkBuddyAuthorizationContext,
} from "@/lib/caio-collaboration/authorization.service";
import {
  WorkBuddyCollaborationError,
  workBuddyClientIdentitySchema,
  type WorkBuddyClientIdentity,
} from "@/lib/caio-collaboration/contracts";
import {
  createOwnerPresenceChallenge,
  ownerPresenceAttestationSchema,
  ownerPresenceChallengeSchema,
  verifyOwnerPresenceChallenge,
  type OwnerPresenceAttestation,
  type OwnerPresenceChallenge,
  type OwnerPresenceSignatureVerifier,
} from "@/lib/caio-collaboration/presence.service";
import type { WorkBuddyOwnerPresenceWorkflow } from "@/lib/caio-collaboration/readonly-handlers";
import {
  ownerPresenceProofSchema,
  type OwnerPresenceProof,
} from "@/lib/caio-collaboration/tool-schemas";
import { db } from "@/lib/db";
import { runWithWriteConflictRetry } from "@/lib/db/conflict-aware-write";
import {
  canonicalJson,
  sha256,
} from "@/lib/expert-capability/hashing";

import {
  loadPrismaWorkBuddyAuthorizationSnapshot,
} from "./workbuddy-authorization-queries.service";

type Tx = Prisma.TransactionClient;

const TRANSACTION_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  maxWait: 10_000,
  timeout: 30_000,
} as const;

const WRITE_RETRY_OPTIONS = {
  maxAttempts: 8,
  retryDelayMs: 50,
} as const;

function contentRef(
  kind: "challenge" | "attestation",
  input: Readonly<Record<string, unknown>>,
): string {
  const digest = sha256(canonicalJson(input)).slice("sha256:".length);
  return `workbuddy-presence-${kind}:${digest}`;
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
      "A stored WorkBuddy presence record is not valid JSON.",
    );
  }
  const parsed = parser(raw);
  if (sha256(canonicalJson(parsed)) !== expectedHash) {
    throw new WorkBuddyCollaborationError(
      "INTERNAL_ERROR",
      "A stored WorkBuddy presence record failed its content hash.",
    );
  }
  return parsed;
}

function freezeChallenge(
  challenge: OwnerPresenceChallenge,
): OwnerPresenceChallenge {
  return Object.freeze({ ...challenge });
}

function freezeAttestation(
  attestation: OwnerPresenceAttestation,
): OwnerPresenceAttestation {
  return Object.freeze({ ...attestation });
}

function parseStoredChallenge(
  row: StoredPresenceChallenge,
): OwnerPresenceChallenge {
  const challenge = parseJson(
    row.challengeJson,
    (value) => ownerPresenceChallengeSchema.parse(value),
    row.challengeHash,
  );
  if (
    challenge.challengeId !== row.id ||
    challenge.workspaceId !== row.workspaceId ||
    challenge.clientId !== row.clientId ||
    challenge.actorUserId !== row.actorUserId ||
    challenge.ceoBindingRef !== row.ceoBindingRef ||
    challenge.mandateRef !== row.mandateRef ||
    challenge.ceoRef !== row.ceoRef ||
    sha256(challenge.nonce) !== row.nonceHash ||
    challenge.issuedAt !== row.issuedAt.toISOString() ||
    challenge.expiresAt !== row.expiresAt.toISOString()
  ) {
    throw new WorkBuddyCollaborationError(
      "INTERNAL_ERROR",
      "A stored WorkBuddy presence challenge has inconsistent indexed fields.",
    );
  }
  return freezeChallenge(challenge);
}

function parseStoredAttestation(
  row: StoredPresenceChallenge,
): OwnerPresenceAttestation | null {
  if (
    row.attestationJson === null ||
    row.attestationHash === null
  ) {
    if (
      row.attestationJson !== null ||
      row.attestationHash !== null ||
      row.completionIdempotencyKey !== null ||
      row.proofHash !== null
    ) {
      throw new WorkBuddyCollaborationError(
        "INTERNAL_ERROR",
        "A stored WorkBuddy presence completion is incomplete.",
      );
    }
    return null;
  }
  const attestation = parseJson(
    row.attestationJson,
    (value) => ownerPresenceAttestationSchema.parse(value),
    row.attestationHash,
  );
  if (
    row.consumedAt === null ||
    row.completionIdempotencyKey === null ||
    row.proofHash === null ||
    attestation.challengeId !== row.id ||
    attestation.workspaceId !== row.workspaceId ||
    attestation.clientId !== row.clientId ||
    attestation.actorUserId !== row.actorUserId ||
    attestation.ceoBindingRef !== row.ceoBindingRef ||
    attestation.mandateRef !== row.mandateRef ||
    attestation.ceoRef !== row.ceoRef ||
    attestation.verifiedAt !== row.consumedAt.toISOString()
  ) {
    throw new WorkBuddyCollaborationError(
      "INTERNAL_ERROR",
      "A stored WorkBuddy presence attestation has inconsistent indexed fields.",
    );
  }
  return freezeAttestation(attestation);
}

function requireFreshAuthorization(input: {
  authorization: WorkBuddyAuthorizationContext;
  identity: WorkBuddyClientIdentity;
  checkedAt: string;
}): WorkBuddyAuthorizationContext {
  const identity = workBuddyClientIdentitySchema.parse(input.identity);
  const authorization = requireWorkBuddyAuthorizationContext({
    authorization: input.authorization,
    requiredScope: "caio:presence:challenge",
    requiredCapability: WORKBUDDY_OWNER_READ_CAPABILITY,
  });
  if (
    authorization.checkedAt !== input.checkedAt ||
    authorization.workspaceId !== identity.workspaceId ||
    authorization.actorUserId !== identity.actorUserId ||
    authorization.clientId !== identity.clientId
  ) {
    throw new WorkBuddyCollaborationError(
      "AUTH_EXPIRED",
      "Presence authorization must match the current authenticated client.",
    );
  }
  return authorization;
}

async function refreshAuthorizationAfterLock(input: {
  tx: Tx;
  authorization: WorkBuddyAuthorizationContext;
  identity: WorkBuddyClientIdentity;
  checkedAt: string;
}): Promise<WorkBuddyAuthorizationContext> {
  const identity = workBuddyClientIdentitySchema.parse(
    input.identity,
  );
  const authorization = requireFreshAuthorization({
    authorization: input.authorization,
    identity,
    checkedAt: input.authorization.checkedAt,
  });
  const checkedAtMs = Date.parse(input.checkedAt);
  if (
    !Number.isFinite(checkedAtMs) ||
    checkedAtMs < Date.parse(identity.authenticatedAt) ||
    checkedAtMs < Date.parse(authorization.checkedAt)
  ) {
    throw new WorkBuddyCollaborationError(
      "AUTH_EXPIRED",
      "Presence authorization must be refreshed after acquiring the workspace lock.",
    );
  }
  const snapshot = await loadPrismaWorkBuddyAuthorizationSnapshot(
    input.tx,
    {
      workspaceId: identity.workspaceId,
      actorUserId: identity.actorUserId,
      capability: WORKBUDDY_OWNER_READ_CAPABILITY,
      checkedAt: input.checkedAt,
    },
  );
  const { mandate, binding } = requireWorkBuddyOwnerCeoSnapshot({
    snapshot,
    actorUserId: identity.actorUserId,
  });
  if (
    authorization.workspaceId !== identity.workspaceId ||
    authorization.actorUserId !== identity.actorUserId ||
    authorization.clientId !== identity.clientId ||
    authorization.ceoBindingRef !== binding.bindingRef ||
    authorization.mandateRef !== mandate.mandateRef ||
    authorization.ceoRef !== mandate.ceoRef
  ) {
    throw new WorkBuddyCollaborationError(
      "AUTH_EXPIRED",
      "Presence authorization changed while the operation waited for the workspace lock.",
    );
  }
  return Object.freeze(
    workBuddyAuthorizationContextSchema.parse({
      ...authorization,
      checkedAt: input.checkedAt,
    }),
  );
}

function assertChallengeBinding(input: {
  challenge: OwnerPresenceChallenge;
  authorization: WorkBuddyAuthorizationContext;
  identity: WorkBuddyClientIdentity;
}): void {
  const identity = workBuddyClientIdentitySchema.parse(input.identity);
  if (
    input.challenge.workspaceId !== identity.workspaceId ||
    input.challenge.clientId !== identity.clientId ||
    input.challenge.actorUserId !== identity.actorUserId ||
    input.challenge.workspaceId !== input.authorization.workspaceId ||
    input.challenge.clientId !== input.authorization.clientId ||
    input.challenge.actorUserId !== input.authorization.actorUserId ||
    input.challenge.ceoBindingRef !==
      input.authorization.ceoBindingRef ||
    input.challenge.mandateRef !== input.authorization.mandateRef ||
    input.challenge.ceoRef !== input.authorization.ceoRef
  ) {
    throw new WorkBuddyCollaborationError(
      "PRESENCE_BINDING_MISMATCH",
      "The presence challenge no longer matches the authenticated owner and mandate.",
    );
  }
}

function assertCompletionReplay(input: {
  row: StoredPresenceChallenge;
  idempotencyKey: string;
  proofHash: string;
}): OwnerPresenceAttestation {
  const attestation = parseStoredAttestation(input.row);
  if (
    attestation === null ||
    input.row.completionIdempotencyKey !== input.idempotencyKey ||
    input.row.proofHash !== input.proofHash
  ) {
    throw new WorkBuddyCollaborationError(
      "PRESENCE_REPLAYED",
      "The presence challenge is already bound to another completion.",
    );
  }
  return attestation;
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

function proofHash(proof: OwnerPresenceProof): string {
  return sha256(canonicalJson(ownerPresenceProofSchema.parse(proof)));
}

export function createPrismaWorkBuddyOwnerPresenceWorkflow(input: {
  signatureVerifier: OwnerPresenceSignatureVerifier;
  generateNonce?: () => string;
  now?: () => string;
  challengeTtlMs?: number;
  attestationTtlMs?: number;
}): WorkBuddyOwnerPresenceWorkflow {
  const generateNonce =
    input.generateNonce ??
    (() => randomBytes(32).toString("base64url"));
  const now = input.now ?? (() => new Date().toISOString());
  const challengeTtlMs = input.challengeTtlMs ?? 2 * 60_000;

  return Object.freeze({
    async begin(
      request: Parameters<WorkBuddyOwnerPresenceWorkflow["begin"]>[0],
    ) {
      const identity = workBuddyClientIdentitySchema.parse(
        request.identity,
      );
      const preliminaryAuthorization = requireFreshAuthorization({
        authorization: request.authorization,
        identity,
        checkedAt: request.issuedAt,
      });
      return transaction(async (tx) => {
        await lockWorkspace(
          tx,
          preliminaryAuthorization.workspaceId,
        );
        const issuedAt = now();
        const authorization = await refreshAuthorizationAfterLock({
          tx,
          authorization: preliminaryAuthorization,
          identity,
          checkedAt: issuedAt,
        });
        const existing =
          await tx.workBuddyPresenceChallenge.findUnique({
            where: {
              workspaceId_clientId_beginIdempotencyKey: {
                workspaceId: authorization.workspaceId,
                clientId: authorization.clientId,
                beginIdempotencyKey: request.idempotencyKey,
              },
            },
          });
        if (existing) {
          const challenge = parseStoredChallenge(existing);
          assertChallengeBinding({
            challenge,
            authorization,
            identity,
          });
          return challenge;
        }

        const challengeId = contentRef("challenge", {
          schemaVersion:
            "helm.workbuddy-owner-presence-challenge-ref/v1",
          workspaceId: authorization.workspaceId,
          clientId: authorization.clientId,
          beginIdempotencyKey: request.idempotencyKey,
        });
        const challenge = createOwnerPresenceChallenge({
          authorization,
          challengeId,
          nonce: generateNonce(),
          issuedAt,
          ttlMs: challengeTtlMs,
        });
        const nonceHash = sha256(challenge.nonce);
        const nonceOwner =
          await tx.workBuddyPresenceChallenge.findUnique({
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
            "The presence challenge nonce is already bound to another challenge.",
          );
        }
        const challengeJson = canonicalJson(challenge);
        await tx.workBuddyPresenceChallenge.create({
          data: {
            id: challenge.challengeId,
            workspaceId: challenge.workspaceId,
            clientId: challenge.clientId,
            actorUserId: challenge.actorUserId,
            ceoBindingRef: challenge.ceoBindingRef,
            mandateRef: challenge.mandateRef,
            ceoRef: challenge.ceoRef,
            beginIdempotencyKey: request.idempotencyKey,
            issuedAt: new Date(challenge.issuedAt),
            expiresAt: new Date(challenge.expiresAt),
            challengeJson,
            challengeHash: sha256(challengeJson),
            nonceHash,
          },
        });
        return freezeChallenge(challenge);
      });
    },

    async complete(
      request: Parameters<WorkBuddyOwnerPresenceWorkflow["complete"]>[0],
    ) {
      const identity = workBuddyClientIdentitySchema.parse(
        request.identity,
      );
      const preliminaryAuthorization = requireFreshAuthorization({
        authorization: request.authorization,
        identity,
        checkedAt: request.verifiedAt,
      });
      const proof = ownerPresenceProofSchema.parse(request.proof);
      const requestProofHash = proofHash(proof);
      const initial =
        await db.workBuddyPresenceChallenge.findUnique({
          where: { id: request.challengeId },
        });
      if (!initial) {
        throw new WorkBuddyCollaborationError(
          "PRESENCE_REPLAYED",
          "The presence challenge is missing or already consumed.",
        );
      }
      const challenge = parseStoredChallenge(initial);
      assertChallengeBinding({
        challenge,
        authorization: preliminaryAuthorization,
        identity,
      });
      if (initial.attestationJson !== null) {
        return assertCompletionReplay({
          row: initial,
          idempotencyKey: request.idempotencyKey,
          proofHash: requestProofHash,
        });
      }
      if (initial.consumedAt !== null) {
        throw new WorkBuddyCollaborationError(
          "PRESENCE_REPLAYED",
          "The presence challenge is already consumed.",
        );
      }

      const presenceRef = contentRef("attestation", {
        schemaVersion:
          "helm.workbuddy-owner-presence-attestation-ref/v1",
        challengeId: challenge.challengeId,
        completionIdempotencyKey: request.idempotencyKey,
        proofHash: requestProofHash,
      });
      const attestation = await verifyOwnerPresenceChallenge({
        challenge,
        proof,
        identity,
        freshAuthorization: preliminaryAuthorization,
        verifiedAt: request.verifiedAt,
        presenceRef,
        verifier: input.signatureVerifier,
        attestationTtlMs: input.attestationTtlMs,
      });
      const attestationJson = canonicalJson(attestation);

      return transaction(async (tx) => {
        await lockWorkspace(
          tx,
          preliminaryAuthorization.workspaceId,
        );
        const persistedAt = now();
        const authorization = await refreshAuthorizationAfterLock({
          tx,
          authorization: preliminaryAuthorization,
          identity,
          checkedAt: persistedAt,
        });
        const current =
          await tx.workBuddyPresenceChallenge.findFirst({
            where: {
              id: challenge.challengeId,
              workspaceId: authorization.workspaceId,
            },
          });
        if (!current) {
          throw new WorkBuddyCollaborationError(
            "PRESENCE_REPLAYED",
            "The presence challenge no longer exists.",
          );
        }
        const currentChallenge = parseStoredChallenge(current);
        assertChallengeBinding({
          challenge: currentChallenge,
          authorization,
          identity,
        });
        if (current.attestationJson !== null) {
          return assertCompletionReplay({
            row: current,
            idempotencyKey: request.idempotencyKey,
            proofHash: requestProofHash,
          });
        }
        if (current.consumedAt !== null) {
          throw new WorkBuddyCollaborationError(
            "PRESENCE_REPLAYED",
            "The presence challenge is already consumed.",
          );
        }
        if (
          Date.parse(persistedAt) >
          Date.parse(currentChallenge.expiresAt)
        ) {
          throw new WorkBuddyCollaborationError(
            "PRESENCE_EXPIRED",
            "The owner presence challenge expired while waiting for the workspace lock.",
          );
        }
        const conflictingCompletion =
          await tx.workBuddyPresenceChallenge.findFirst({
            where: {
              workspaceId: authorization.workspaceId,
              clientId: authorization.clientId,
              completionIdempotencyKey: request.idempotencyKey,
              NOT: { id: challenge.challengeId },
            },
          });
        if (conflictingCompletion) {
          throw new WorkBuddyCollaborationError(
            "REPLAY_REJECTED",
            "The completion idempotency key is bound to another presence challenge.",
          );
        }

        const updated =
          await tx.workBuddyPresenceChallenge.updateMany({
            where: {
              id: challenge.challengeId,
              workspaceId: authorization.workspaceId,
              consumedAt: null,
              completionIdempotencyKey: null,
            },
            data: {
              completionIdempotencyKey: request.idempotencyKey,
              consumedAt: new Date(attestation.verifiedAt),
              proofHash: requestProofHash,
              attestationJson,
              attestationHash: sha256(attestationJson),
            },
          });
        if (updated.count !== 1) {
          throw new WorkBuddyCollaborationError(
            "PRESENCE_REPLAYED",
            "The presence challenge was consumed concurrently.",
          );
        }
        const stored =
          await tx.workBuddyPresenceChallenge.findUniqueOrThrow({
            where: { id: challenge.challengeId },
          });
        return assertCompletionReplay({
          row: stored,
          idempotencyKey: request.idempotencyKey,
          proofHash: requestProofHash,
        });
      });
    },
  });
}
