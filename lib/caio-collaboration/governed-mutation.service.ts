import { z } from "zod";

import {
  requireWorkBuddyAuthorizationContext,
  WORKBUDDY_OWNER_MUTATION_CAPABILITY,
  type WorkBuddyAuthorizationContext,
} from "./authorization.service";
import {
  WorkBuddyCollaborationError,
  workBuddyClientIdentitySchema,
  workBuddyIdempotencyKeySchema,
  workBuddyInstantSchema,
  workBuddySafeRefSchema,
  type WorkBuddyClientIdentity,
} from "./contracts";
import {
  caioCanonicalObjectRefSchema,
  caioDeliveryHashSchema,
} from "./delivery-contracts";
import {
  ownerPresenceProofSchema,
  type OwnerPresenceProof,
} from "./tool-schemas";
import {
  assertWorkBuddyRequestActive,
} from "./request-cancellation";
import {
  canonicalJson,
  sha256,
} from "../expert-capability/hashing";

const MIN_CHALLENGE_TTL_MS = 30_000;
const MAX_CHALLENGE_TTL_MS = 5 * 60_000;

export const WORKBUDDY_GOVERNED_MUTATION_ACTIONS = [
  "prompt_response",
  "question_selection",
  "advice_decision",
] as const;

export const governedMutationActionKindSchema = z.enum(
  WORKBUDDY_GOVERNED_MUTATION_ACTIONS,
);
export type GovernedMutationActionKind = z.infer<
  typeof governedMutationActionKindSchema
>;

export const governedMutationTargetSchema = z.union([
  caioCanonicalObjectRefSchema,
  z
    .object({
      schemaVersion: z.literal("helm.caio-canonical-object-ref/v1"),
      objectKind: z.literal("operating_question_portfolio"),
      objectId: workBuddySafeRefSchema,
      objectVersion: z.number().int().positive(),
      objectHash: caioDeliveryHashSchema,
    })
    .strict(),
]);

export type GovernedMutationTarget = z.infer<
  typeof governedMutationTargetSchema
>;

export const governedMutationChallengeSchema = z
  .object({
    schemaVersion: z.literal(
      "helm.workbuddy-governed-mutation-challenge/v1",
    ),
    challengeId: workBuddySafeRefSchema,
    nonce: z.string().min(32).max(256),
    workspaceId: workBuddySafeRefSchema,
    clientId: workBuddySafeRefSchema,
    actorUserId: workBuddySafeRefSchema,
    ceoBindingRef: workBuddySafeRefSchema,
    mandateRef: workBuddySafeRefSchema,
    ceoRef: workBuddySafeRefSchema,
    actionKind: governedMutationActionKindSchema,
    target: governedMutationTargetSchema,
    expectedVersion: z.number().int().positive(),
    summaryHash: caioDeliveryHashSchema,
    idempotencyKey: workBuddyIdempotencyKeySchema,
    issuedAt: workBuddyInstantSchema,
    expiresAt: workBuddyInstantSchema,
    singleUseRequired: z.literal(true),
    replayProtectionRequired: z.literal(true),
    authorityEffect: z.literal("none"),
    canonicalMutationAuthorityGranted: z.literal(false),
    externalExecutionAllowed: z.literal(false),
  })
  .strict();

export type GovernedMutationChallenge = z.infer<
  typeof governedMutationChallengeSchema
>;

export type GovernedMutationAttestation = Readonly<{
  schemaVersion: "helm.workbuddy-governed-mutation-attestation/v1";
  challengeId: string;
  workspaceId: string;
  clientId: string;
  actorUserId: string;
  ceoBindingRef: string;
  mandateRef: string;
  ceoRef: string;
  actionKind: GovernedMutationActionKind;
  target: GovernedMutationTarget;
  expectedVersion: number;
  summaryHash: string;
  idempotencyKey: string;
  verifiedAt: string;
  authorityEffect: "none";
  canonicalMutationAuthorityGranted: false;
  externalExecutionAllowed: false;
}>;

export const governedMutationChallengeConsumptionSchema = z
  .object({
    schemaVersion: z.literal(
      "helm.workbuddy-governed-mutation-consumption/v1",
    ),
    challengeId: workBuddySafeRefSchema,
    workspaceId: workBuddySafeRefSchema,
    clientId: workBuddySafeRefSchema,
    proofHash: caioDeliveryHashSchema,
    consumedAt: workBuddyInstantSchema,
  })
  .strict();

export type GovernedMutationChallengeConsumption = z.infer<
  typeof governedMutationChallengeConsumptionSchema
>;

export interface GovernedMutationChallengeStore {
  register(
    challenge: GovernedMutationChallenge,
    options?: Readonly<{ signal?: AbortSignal }>,
  ): Promise<GovernedMutationChallenge>;
  get(
    challengeId: string,
    options?: Readonly<{ signal?: AbortSignal }>,
  ): Promise<GovernedMutationChallenge | null>;
  getConsumption(
    challengeId: string,
    options?: Readonly<{ signal?: AbortSignal }>,
  ): Promise<GovernedMutationChallengeConsumption | null>;
  consume(input: {
    challengeId: string;
    workspaceId: string;
    clientId: string;
    proofHash: string;
    consumedAt: string;
    signal?: AbortSignal;
  }): Promise<boolean>;
}

export interface InMemoryGovernedMutationChallengeStore
  extends GovernedMutationChallengeStore {
  isConsumed(challengeId: string): Promise<boolean>;
}

export interface GovernedMutationProofVerifier {
  verify(input: {
    challenge: GovernedMutationChallenge;
    proof: OwnerPresenceProof;
    identity: WorkBuddyClientIdentity;
    signal?: AbortSignal;
  }): Promise<boolean>;
}

function parseInstant(value: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new WorkBuddyCollaborationError(
      "INVALID_TOOL_INPUT",
      "A valid ISO-8601 instant is required.",
    );
  }
  return parsed;
}

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function mutationIdempotencyBinding(
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

function mutationIdempotencyIndexKey(
  challenge: GovernedMutationChallenge,
): string {
  return [
    challenge.workspaceId,
    challenge.actionKind,
    challenge.idempotencyKey,
  ].join("\u0000");
}

function freezeChallenge(
  challenge: GovernedMutationChallenge,
): GovernedMutationChallenge {
  return Object.freeze({
    ...challenge,
    target: Object.freeze({ ...challenge.target }),
  });
}

function requireMutationAuthorization(input: {
  authorization: WorkBuddyAuthorizationContext;
  checkedAt: string;
}): WorkBuddyAuthorizationContext {
  const authorization = requireWorkBuddyAuthorizationContext({
    authorization: input.authorization,
    requiredScope: "caio:canonical:mutate",
    requiredCapability: WORKBUDDY_OWNER_MUTATION_CAPABILITY,
  });
  if (authorization.checkedAt !== input.checkedAt) {
    throw new WorkBuddyCollaborationError(
      "AUTH_EXPIRED",
      "Canonical mutation authorization must be checked at the operation instant.",
    );
  }
  return authorization;
}

function challengeWindow(
  challenge: GovernedMutationChallenge,
): Readonly<{ issuedAtMs: number; expiresAtMs: number }> {
  const issuedAtMs = parseInstant(challenge.issuedAt);
  const expiresAtMs = parseInstant(challenge.expiresAt);
  if (
    expiresAtMs <= issuedAtMs ||
    expiresAtMs - issuedAtMs > MAX_CHALLENGE_TTL_MS
  ) {
    throw new WorkBuddyCollaborationError(
      "INVALID_TOOL_INPUT",
      "The mutation challenge has an invalid validity window.",
    );
  }
  return { issuedAtMs, expiresAtMs };
}

function createMutationAttestation(input: {
  challenge: GovernedMutationChallenge;
  verifiedAt: string;
}): GovernedMutationAttestation {
  return Object.freeze({
    schemaVersion:
      "helm.workbuddy-governed-mutation-attestation/v1",
    challengeId: input.challenge.challengeId,
    workspaceId: input.challenge.workspaceId,
    clientId: input.challenge.clientId,
    actorUserId: input.challenge.actorUserId,
    ceoBindingRef: input.challenge.ceoBindingRef,
    mandateRef: input.challenge.mandateRef,
    ceoRef: input.challenge.ceoRef,
    actionKind: input.challenge.actionKind,
    target: Object.freeze({ ...input.challenge.target }),
    expectedVersion: input.challenge.expectedVersion,
    summaryHash: input.challenge.summaryHash,
    idempotencyKey: input.challenge.idempotencyKey,
    verifiedAt: input.verifiedAt,
    authorityEffect: "none",
    canonicalMutationAuthorityGranted: false,
    externalExecutionAllowed: false,
  });
}

export async function prepareGovernedMutation(input: {
  authorization: WorkBuddyAuthorizationContext;
  actionKind: GovernedMutationActionKind;
  target: GovernedMutationTarget;
  expectedVersion: number;
  summaryHash: string;
  idempotencyKey: string;
  challengeId: string;
  nonce: string;
  issuedAt: string;
  ttlMs: number;
  store: GovernedMutationChallengeStore;
  signal?: AbortSignal;
}): Promise<GovernedMutationChallenge> {
  assertWorkBuddyRequestActive(input.signal);
  const authorization = requireMutationAuthorization({
    authorization: input.authorization,
    checkedAt: input.issuedAt,
  });
  if (
    !Number.isInteger(input.ttlMs) ||
    input.ttlMs < MIN_CHALLENGE_TTL_MS ||
    input.ttlMs > MAX_CHALLENGE_TTL_MS
  ) {
    throw new WorkBuddyCollaborationError(
      "INVALID_TOOL_INPUT",
      "Mutation challenge TTL is outside the allowed range.",
    );
  }
  if (input.expectedVersion !== input.target.objectVersion) {
    throw new WorkBuddyCollaborationError(
      "VERSION_CONFLICT",
      "Expected version must match the prepared canonical object version.",
    );
  }

  const issuedAtMs = parseInstant(input.issuedAt);
  const challenge = freezeChallenge(
    governedMutationChallengeSchema.parse({
      schemaVersion:
        "helm.workbuddy-governed-mutation-challenge/v1",
      challengeId: input.challengeId,
      nonce: input.nonce,
      workspaceId: authorization.workspaceId,
      clientId: authorization.clientId,
      actorUserId: authorization.actorUserId,
      ceoBindingRef: authorization.ceoBindingRef,
      mandateRef: authorization.mandateRef,
      ceoRef: authorization.ceoRef,
      actionKind: input.actionKind,
      target: input.target,
      expectedVersion: input.expectedVersion,
      summaryHash: input.summaryHash,
      idempotencyKey: input.idempotencyKey,
      issuedAt: input.issuedAt,
      expiresAt: new Date(issuedAtMs + input.ttlMs).toISOString(),
      singleUseRequired: true,
      replayProtectionRequired: true,
      authorityEffect: "none",
      canonicalMutationAuthorityGranted: false,
      externalExecutionAllowed: false,
    }),
  );
  assertWorkBuddyRequestActive(input.signal);
  const registered = await input.store.register(challenge, {
    signal: input.signal,
  });
  assertWorkBuddyRequestActive(input.signal);
  return registered;
}

export async function authorizeGovernedMutationSubmission(input: {
  challenge: GovernedMutationChallenge;
  actionKind: GovernedMutationActionKind;
  target: GovernedMutationTarget;
  expectedVersion: number;
  summaryHash: string;
  idempotencyKey: string;
  proof: OwnerPresenceProof;
  identity: WorkBuddyClientIdentity;
  freshAuthorization: WorkBuddyAuthorizationContext;
  verifiedAt: string;
  verifier: GovernedMutationProofVerifier;
  store: GovernedMutationChallengeStore;
  signal?: AbortSignal;
}): Promise<GovernedMutationAttestation> {
  assertWorkBuddyRequestActive(input.signal);
  const challenge = governedMutationChallengeSchema.parse(
    input.challenge,
  );
  const storedChallenge = await input.store.get(
    challenge.challengeId,
    { signal: input.signal },
  );
  assertWorkBuddyRequestActive(input.signal);
  if (!storedChallenge || !sameValue(storedChallenge, challenge)) {
    throw new WorkBuddyCollaborationError(
      "REPLAY_REJECTED",
      "The governed mutation challenge is missing or changed.",
    );
  }
  const proof = ownerPresenceProofSchema.parse(input.proof);
  const submittedProofHash = sha256(canonicalJson(proof));
  const identity = workBuddyClientIdentitySchema.parse(input.identity);
  const target = governedMutationTargetSchema.parse(input.target);
  const actionKind = governedMutationActionKindSchema.parse(
    input.actionKind,
  );
  const verifiedAtMs = parseInstant(input.verifiedAt);
  const proofAssertedAtMs = parseInstant(proof.assertedAt);
  const { issuedAtMs, expiresAtMs } = challengeWindow(challenge);

  const authorization = requireMutationAuthorization({
    authorization: input.freshAuthorization,
    checkedAt: input.verifiedAt,
  });
  const exactBinding =
    proof.challengeId === challenge.challengeId &&
    identity.clientId === challenge.clientId &&
    identity.workspaceId === challenge.workspaceId &&
    identity.actorUserId === challenge.actorUserId &&
    authorization.clientId === challenge.clientId &&
    authorization.workspaceId === challenge.workspaceId &&
    authorization.actorUserId === challenge.actorUserId &&
    authorization.ceoBindingRef === challenge.ceoBindingRef &&
    authorization.mandateRef === challenge.mandateRef &&
    authorization.ceoRef === challenge.ceoRef &&
    actionKind === challenge.actionKind &&
    input.expectedVersion === challenge.expectedVersion &&
    input.expectedVersion === target.objectVersion &&
    input.summaryHash === challenge.summaryHash &&
    input.idempotencyKey === challenge.idempotencyKey &&
    sameValue(target, challenge.target);
  if (!exactBinding) {
    throw new WorkBuddyCollaborationError(
      "PRESENCE_BINDING_MISMATCH",
      "The submitted mutation no longer matches the prepared challenge.",
    );
  }

  const priorConsumption = await input.store.getConsumption(
    challenge.challengeId,
    { signal: input.signal },
  );
  assertWorkBuddyRequestActive(input.signal);
  if (priorConsumption) {
    if (
      priorConsumption.workspaceId !== challenge.workspaceId ||
      priorConsumption.clientId !== challenge.clientId ||
      priorConsumption.proofHash !== submittedProofHash
    ) {
      throw new WorkBuddyCollaborationError(
        "REPLAY_REJECTED",
        "The challenge consumption binding or device proof is inconsistent.",
      );
    }
    return createMutationAttestation({
      challenge,
      verifiedAt: priorConsumption.consumedAt,
    });
  }

  if (
    verifiedAtMs > expiresAtMs ||
    proofAssertedAtMs > expiresAtMs
  ) {
    throw new WorkBuddyCollaborationError(
      "CHALLENGE_EXPIRED",
      "The governed mutation challenge has expired.",
    );
  }
  if (
    proofAssertedAtMs < issuedAtMs ||
    verifiedAtMs < proofAssertedAtMs
  ) {
    throw new WorkBuddyCollaborationError(
      "PRESENCE_BINDING_MISMATCH",
      "The mutation proof timestamps do not match the challenge window.",
    );
  }

  assertWorkBuddyRequestActive(input.signal);
  const verified = await input.verifier.verify({
    challenge,
    proof,
    identity,
    signal: input.signal,
  });
  assertWorkBuddyRequestActive(input.signal);
  if (!verified) {
    throw new WorkBuddyCollaborationError(
      "PRESENCE_PROOF_INVALID",
      "The device-bound mutation proof is invalid.",
    );
  }
  const consumed = await input.store.consume({
    challengeId: challenge.challengeId,
    workspaceId: challenge.workspaceId,
    clientId: challenge.clientId,
    proofHash: submittedProofHash,
    consumedAt: input.verifiedAt,
    signal: input.signal,
  });
  assertWorkBuddyRequestActive(input.signal);
  if (!consumed) {
    const concurrentConsumption = await input.store.getConsumption(
      challenge.challengeId,
      { signal: input.signal },
    );
    assertWorkBuddyRequestActive(input.signal);
    if (
      !concurrentConsumption ||
      concurrentConsumption.workspaceId !== challenge.workspaceId ||
      concurrentConsumption.clientId !== challenge.clientId ||
      concurrentConsumption.proofHash !== submittedProofHash
    ) {
      throw new WorkBuddyCollaborationError(
        "PRESENCE_REPLAYED",
        "The governed mutation challenge was already consumed.",
      );
    }
    return createMutationAttestation({
      challenge,
      verifiedAt: concurrentConsumption.consumedAt,
    });
  }

  return createMutationAttestation({
    challenge,
    verifiedAt: input.verifiedAt,
  });
}

export function createInMemoryGovernedMutationChallengeStore(): InMemoryGovernedMutationChallengeStore {
  const challenges = new Map<string, GovernedMutationChallenge>();
  const challengeByMutation = new Map<string, string>();
  const consumptions = new Map<
    string,
    GovernedMutationChallengeConsumption
  >();

  return Object.freeze({
    async register(challenge: GovernedMutationChallenge) {
      const parsed = freezeChallenge(
        governedMutationChallengeSchema.parse(challenge),
      );
      const existing = challenges.get(parsed.challengeId);
      if (existing) {
        if (!sameValue(existing, parsed)) {
          throw new WorkBuddyCollaborationError(
            "REPLAY_REJECTED",
            "The challenge id is already bound to another mutation.",
          );
        }
        return existing;
      }
      const mutationKey = mutationIdempotencyIndexKey(parsed);
      const existingMutationChallengeId =
        challengeByMutation.get(mutationKey);
      if (existingMutationChallengeId) {
        const existingMutation = challenges.get(
          existingMutationChallengeId,
        );
        if (!existingMutation) {
          throw new WorkBuddyCollaborationError(
            "INTERNAL_ERROR",
            "The mutation challenge idempotency index is inconsistent.",
          );
        }
        if (
          !sameValue(
            mutationIdempotencyBinding(existingMutation),
            mutationIdempotencyBinding(parsed),
          )
        ) {
          throw new WorkBuddyCollaborationError(
            "VERSION_CONFLICT",
            "The idempotency key is already bound to another mutation challenge.",
          );
        }
        return existingMutation;
      }
      challenges.set(parsed.challengeId, parsed);
      challengeByMutation.set(mutationKey, parsed.challengeId);
      return parsed;
    },

    async get(challengeId: string) {
      return challenges.get(challengeId) ?? null;
    },

    async getConsumption(challengeId: string) {
      return consumptions.get(challengeId) ?? null;
    },

    async consume(consumeInput: {
      challengeId: string;
      workspaceId: string;
      clientId: string;
      proofHash: string;
      consumedAt: string;
    }) {
      const challenge = challenges.get(consumeInput.challengeId);
      if (
        !challenge ||
        challenge.workspaceId !== consumeInput.workspaceId ||
        challenge.clientId !== consumeInput.clientId ||
        consumptions.has(consumeInput.challengeId)
      ) {
        return false;
      }
      consumptions.set(
        consumeInput.challengeId,
        Object.freeze(
          governedMutationChallengeConsumptionSchema.parse({
            schemaVersion:
              "helm.workbuddy-governed-mutation-consumption/v1",
            challengeId: consumeInput.challengeId,
            workspaceId: consumeInput.workspaceId,
            clientId: consumeInput.clientId,
            proofHash: consumeInput.proofHash,
            consumedAt: consumeInput.consumedAt,
          }),
        ),
      );
      return true;
    },

    async isConsumed(challengeId: string) {
      return consumptions.has(challengeId);
    },
  });
}
