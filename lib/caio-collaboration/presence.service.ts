import { z } from "zod";

import {
  requireWorkBuddyAuthorizationContext,
  WORKBUDDY_OWNER_READ_CAPABILITY,
  type WorkBuddyAuthorizationContext,
} from "./authorization.service";
import {
  WorkBuddyCollaborationError,
  workBuddyClientIdentitySchema,
  workBuddyInstantSchema,
  workBuddySafeRefSchema,
  type WorkBuddyClientIdentity,
} from "./contracts";
import {
  ownerPresenceProofSchema,
  type OwnerPresenceProof,
} from "./tool-schemas";

const MIN_CHALLENGE_TTL_MS = 30_000;
const MAX_CHALLENGE_TTL_MS = 5 * 60_000;
const DEFAULT_ATTESTATION_TTL_MS = 5 * 60_000;

export const ownerPresenceChallengeSchema = z
  .object({
    schemaVersion: z.literal("helm.owner-presence-challenge/v1"),
    challengeId: workBuddySafeRefSchema,
    nonce: z.string().min(32).max(256),
    clientId: workBuddySafeRefSchema,
    workspaceId: workBuddySafeRefSchema,
    actorUserId: workBuddySafeRefSchema,
    ceoBindingRef: workBuddySafeRefSchema,
    mandateRef: workBuddySafeRefSchema,
    ceoRef: workBuddySafeRefSchema,
    issuedAt: workBuddyInstantSchema,
    expiresAt: workBuddyInstantSchema,
    singleUseRequired: z.literal(true),
    replayProtectionRequired: z.literal(true),
    authorityEffect: z.literal("none"),
    canonicalMutationAuthorityGranted: z.literal(false),
  })
  .strict();

export type OwnerPresenceChallenge = z.infer<
  typeof ownerPresenceChallengeSchema
>;

export const ownerPresenceAttestationSchema = z
  .object({
    schemaVersion: z.literal("helm.owner-presence-attestation/v1"),
    presenceRef: workBuddySafeRefSchema,
    challengeId: workBuddySafeRefSchema,
    clientId: workBuddySafeRefSchema,
    workspaceId: workBuddySafeRefSchema,
    actorUserId: workBuddySafeRefSchema,
    ceoBindingRef: workBuddySafeRefSchema,
    mandateRef: workBuddySafeRefSchema,
    ceoRef: workBuddySafeRefSchema,
    verified: z.literal(true),
    verifiedAt: workBuddyInstantSchema,
    expiresAt: workBuddyInstantSchema,
    authorityEffect: z.literal("none"),
    canonicalMutationAuthorityGranted: z.literal(false),
    externalExecutionAllowed: z.literal(false),
  })
  .strict();

export type OwnerPresenceAttestation = z.infer<
  typeof ownerPresenceAttestationSchema
>;

export interface OwnerPresenceSignatureVerifier {
  verify(input: {
    challenge: OwnerPresenceChallenge;
    proof: OwnerPresenceProof;
    identity: WorkBuddyClientIdentity;
  }): Promise<boolean>;
}

export interface OwnerPresenceProofVerifier
  extends OwnerPresenceSignatureVerifier {
  consumeChallenge(input: {
    challengeId: string;
    clientId: string;
    workspaceId: string;
    consumedAt: string;
  }): Promise<boolean>;
}

function parseInstant(value: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new WorkBuddyCollaborationError(
      "INVALID_TOOL_INPUT",
      "An ISO-8601 instant is required.",
    );
  }
  return parsed;
}

function requirePresenceAuthorization(input: {
  authorization: WorkBuddyAuthorizationContext;
  checkedAt: string;
}): WorkBuddyAuthorizationContext {
  const authorization = requireWorkBuddyAuthorizationContext({
    authorization: input.authorization,
    requiredScope: "caio:presence:challenge",
    requiredCapability: WORKBUDDY_OWNER_READ_CAPABILITY,
  });
  if (authorization.checkedAt !== input.checkedAt) {
    throw new WorkBuddyCollaborationError(
      "AUTH_EXPIRED",
      "Presence authorization must be checked at the operation instant.",
    );
  }
  return authorization;
}

function challengeWindow(challenge: OwnerPresenceChallenge): Readonly<{
  issuedAtMs: number;
  expiresAtMs: number;
}> {
  const issuedAtMs = parseInstant(challenge.issuedAt);
  const expiresAtMs = parseInstant(challenge.expiresAt);
  if (
    expiresAtMs <= issuedAtMs ||
    expiresAtMs - issuedAtMs > MAX_CHALLENGE_TTL_MS
  ) {
    throw new WorkBuddyCollaborationError(
      "INVALID_TOOL_INPUT",
      "The presence challenge has an invalid validity window.",
    );
  }
  return { issuedAtMs, expiresAtMs };
}

export function createOwnerPresenceChallenge(input: {
  authorization: WorkBuddyAuthorizationContext;
  challengeId: string;
  nonce: string;
  issuedAt: string;
  ttlMs: number;
}): OwnerPresenceChallenge {
  const authorization = requirePresenceAuthorization({
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
      "Presence challenge TTL is outside the allowed range.",
    );
  }

  const issuedAtMs = parseInstant(input.issuedAt);
  return Object.freeze(
    ownerPresenceChallengeSchema.parse({
      schemaVersion: "helm.owner-presence-challenge/v1",
      challengeId: input.challengeId,
      nonce: input.nonce,
      clientId: authorization.clientId,
      workspaceId: authorization.workspaceId,
      actorUserId: authorization.actorUserId,
      ceoBindingRef: authorization.ceoBindingRef,
      mandateRef: authorization.mandateRef,
      ceoRef: authorization.ceoRef,
      issuedAt: input.issuedAt,
      expiresAt: new Date(issuedAtMs + input.ttlMs).toISOString(),
      singleUseRequired: true,
      replayProtectionRequired: true,
      authorityEffect: "none",
      canonicalMutationAuthorityGranted: false,
    }),
  );
}

export async function verifyOwnerPresenceChallenge(input: {
  challenge: OwnerPresenceChallenge;
  proof: OwnerPresenceProof;
  identity: WorkBuddyClientIdentity;
  freshAuthorization: WorkBuddyAuthorizationContext;
  verifiedAt: string;
  presenceRef: string;
  verifier: OwnerPresenceSignatureVerifier;
  attestationTtlMs?: number;
}): Promise<OwnerPresenceAttestation> {
  const challenge = ownerPresenceChallengeSchema.parse(input.challenge);
  const proof = ownerPresenceProofSchema.parse(input.proof);
  const identity = workBuddyClientIdentitySchema.parse(input.identity);
  const verifiedAtMs = parseInstant(input.verifiedAt);
  const proofAssertedAtMs = parseInstant(proof.assertedAt);
  const { issuedAtMs, expiresAtMs } = challengeWindow(challenge);

  if (
    verifiedAtMs > expiresAtMs ||
    proofAssertedAtMs > expiresAtMs
  ) {
    throw new WorkBuddyCollaborationError(
      "PRESENCE_EXPIRED",
      "The owner presence challenge has expired.",
    );
  }
  if (
    proofAssertedAtMs < issuedAtMs ||
    verifiedAtMs < proofAssertedAtMs
  ) {
    throw new WorkBuddyCollaborationError(
      "PRESENCE_BINDING_MISMATCH",
      "The presence proof timestamps do not match the challenge window.",
    );
  }

  const authorization = requirePresenceAuthorization({
    authorization: input.freshAuthorization,
    checkedAt: input.verifiedAt,
  });
  if (
    proof.challengeId !== challenge.challengeId ||
    identity.clientId !== challenge.clientId ||
    identity.workspaceId !== challenge.workspaceId ||
    identity.actorUserId !== challenge.actorUserId ||
    authorization.clientId !== challenge.clientId ||
    authorization.workspaceId !== challenge.workspaceId ||
    authorization.actorUserId !== challenge.actorUserId ||
    authorization.ceoBindingRef !== challenge.ceoBindingRef ||
    authorization.mandateRef !== challenge.mandateRef ||
    authorization.ceoRef !== challenge.ceoRef
  ) {
    throw new WorkBuddyCollaborationError(
      "PRESENCE_BINDING_MISMATCH",
      "The proof no longer matches the authenticated owner and mandate.",
    );
  }

  const verified = await input.verifier.verify({
    challenge,
    proof,
    identity,
  });
  if (!verified) {
    throw new WorkBuddyCollaborationError(
      "PRESENCE_PROOF_INVALID",
      "The device-bound presence proof is invalid.",
    );
  }

  const ttlMs =
    input.attestationTtlMs ?? DEFAULT_ATTESTATION_TTL_MS;
  if (!Number.isInteger(ttlMs) || ttlMs <= 0 || ttlMs > 10 * 60_000) {
    throw new WorkBuddyCollaborationError(
      "INVALID_TOOL_INPUT",
      "Presence attestation TTL is outside the allowed range.",
    );
  }

  return Object.freeze(
    ownerPresenceAttestationSchema.parse({
      schemaVersion: "helm.owner-presence-attestation/v1",
      presenceRef: input.presenceRef,
      challengeId: challenge.challengeId,
      clientId: challenge.clientId,
      workspaceId: challenge.workspaceId,
      actorUserId: challenge.actorUserId,
      ceoBindingRef: challenge.ceoBindingRef,
      mandateRef: challenge.mandateRef,
      ceoRef: challenge.ceoRef,
      verified: true,
      verifiedAt: input.verifiedAt,
      expiresAt: new Date(verifiedAtMs + ttlMs).toISOString(),
      authorityEffect: "none",
      canonicalMutationAuthorityGranted: false,
      externalExecutionAllowed: false,
    }),
  );
}

export async function completeOwnerPresenceChallenge(input: {
  challenge: OwnerPresenceChallenge;
  proof: OwnerPresenceProof;
  identity: WorkBuddyClientIdentity;
  freshAuthorization: WorkBuddyAuthorizationContext;
  verifiedAt: string;
  presenceRef: string;
  verifier: OwnerPresenceProofVerifier;
  attestationTtlMs?: number;
}): Promise<OwnerPresenceAttestation> {
  const attestation = await verifyOwnerPresenceChallenge(input);
  const consumed = await input.verifier.consumeChallenge({
    challengeId: attestation.challengeId,
    clientId: attestation.clientId,
    workspaceId: attestation.workspaceId,
    consumedAt: attestation.verifiedAt,
  });
  if (!consumed) {
    throw new WorkBuddyCollaborationError(
      "PRESENCE_REPLAYED",
      "The presence challenge is missing or already consumed.",
    );
  }
  return attestation;
}
