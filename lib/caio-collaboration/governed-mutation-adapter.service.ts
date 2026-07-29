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
import { caioDeliveryHashSchema } from "./delivery-contracts";
import {
  authorizeGovernedMutationSubmission,
  prepareGovernedMutation,
  governedMutationActionKindSchema,
  governedMutationChallengeSchema,
  governedMutationTargetSchema,
  type GovernedMutationActionKind,
  type GovernedMutationChallenge,
  type GovernedMutationChallengeStore,
  type GovernedMutationProofVerifier,
  type GovernedMutationTarget,
} from "./governed-mutation.service";
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

export type GovernedMutationCommand = Readonly<
  Record<string, unknown>
>;

export type GovernedMutationPreview = Readonly<{
  actionKind: GovernedMutationActionKind;
  target: GovernedMutationTarget;
  expectedVersion: number;
  command: GovernedMutationCommand;
  summaryHash: string;
  authorityEffect: "none";
  externalExecutionAllowed: false;
}>;

export const governedMutationSubmissionReceiptSchema = z
  .object({
    schemaVersion: z.literal(
      "helm.workbuddy-governed-mutation-submission-receipt/v1",
    ),
    receiptRef: workBuddySafeRefSchema,
    challengeId: workBuddySafeRefSchema,
    workspaceId: workBuddySafeRefSchema,
    actionKind: governedMutationActionKindSchema,
    target: governedMutationTargetSchema,
    expectedVersion: z.number().int().positive(),
    summaryHash: caioDeliveryHashSchema,
    idempotencyKey: workBuddyIdempotencyKeySchema,
    canonicalReceiptRef: workBuddySafeRefSchema,
    recordedAt: workBuddyInstantSchema,
    authorityEffect: z.literal("none"),
    canonicalMutationAuthorityGranted: z.literal(false),
    canonicalMutationRecorded: z.literal(true),
    externalExecutionAllowed: z.literal(false),
  })
  .strict();

export type GovernedMutationSubmissionReceipt = z.infer<
  typeof governedMutationSubmissionReceiptSchema
>;

export interface GovernedMutationResultStore {
  get(input: {
    workspaceId: string;
    actionKind: GovernedMutationActionKind;
    idempotencyKey: string;
    signal?: AbortSignal;
  }): Promise<GovernedMutationSubmissionReceipt | null>;
  record(
    receipt: GovernedMutationSubmissionReceipt,
    options?: Readonly<{ signal?: AbortSignal }>,
  ): Promise<
    Readonly<{
      receipt: GovernedMutationSubmissionReceipt;
      outcome: "created" | "replayed";
    }>
  >;
}

export interface CanonicalMutationPort {
  apply(input: {
    workspaceId: string;
    clientId: string;
    actorUserId: string;
    ceoRef: string;
    ceoBindingRef: string;
    mandateRef: string;
    target: GovernedMutationTarget;
    expectedVersion: number;
    command: GovernedMutationCommand;
    idempotencyKey: string;
    signal?: AbortSignal;
  }): Promise<Readonly<{ canonicalReceiptRef: string }>>;
}

export interface IdempotentCanonicalMutationPort {
  idempotencyGuarantee: "payload_bound";
  apply: CanonicalMutationPort["apply"];
}

function sameValue(left: unknown, right: unknown): boolean {
  return canonicalJson(left) === canonicalJson(right);
}

function freezeCommand(
  command: GovernedMutationCommand,
): GovernedMutationCommand {
  return Object.freeze({ ...command });
}

function freezeSubmissionReceipt(
  receipt: GovernedMutationSubmissionReceipt,
): GovernedMutationSubmissionReceipt {
  return Object.freeze({
    ...receipt,
    target: Object.freeze({ ...receipt.target }),
  });
}

export function createGovernedMutationSubmissionReceiptRef(input: {
  workspaceId: string;
  actionKind: GovernedMutationActionKind;
  idempotencyKey: string;
}): string {
  const digest = sha256(
    canonicalJson({
      schemaVersion:
        "helm.workbuddy-governed-mutation-submission-receipt-ref/v1",
      workspaceId: input.workspaceId,
      actionKind: input.actionKind,
      idempotencyKey: input.idempotencyKey,
    }),
  ).slice("sha256:".length);
  return `workbuddy-mutation-receipt:${digest}`;
}

export function computeGovernedMutationSummaryHash(input: {
  actionKind: GovernedMutationActionKind;
  target: GovernedMutationTarget;
  expectedVersion: number;
  command: GovernedMutationCommand;
}): string {
  return sha256(
    canonicalJson({
      actionKind: input.actionKind,
      target: input.target,
      expectedVersion: input.expectedVersion,
      command: input.command,
    }),
  );
}

export async function prepareGovernedMutationCommand(input: {
  authorization: WorkBuddyAuthorizationContext;
  actionKind: GovernedMutationActionKind;
  target: GovernedMutationTarget;
  expectedVersion: number;
  command: GovernedMutationCommand;
  idempotencyKey: string;
  challengeId: string;
  nonce: string;
  issuedAt: string;
  ttlMs: number;
  challengeStore: GovernedMutationChallengeStore;
  signal?: AbortSignal;
}): Promise<
  Readonly<{
    challenge: GovernedMutationChallenge;
    preview: GovernedMutationPreview;
  }>
> {
  assertWorkBuddyRequestActive(input.signal);
  const command = freezeCommand(input.command);
  const summaryHash = computeGovernedMutationSummaryHash({
    actionKind: input.actionKind,
    target: input.target,
    expectedVersion: input.expectedVersion,
    command,
  });
  const challenge = await prepareGovernedMutation({
    authorization: input.authorization,
    actionKind: input.actionKind,
    target: input.target,
    expectedVersion: input.expectedVersion,
    summaryHash,
    idempotencyKey: input.idempotencyKey,
    challengeId: input.challengeId,
    nonce: input.nonce,
    issuedAt: input.issuedAt,
    ttlMs: input.ttlMs,
    store: input.challengeStore,
    signal: input.signal,
  });
  assertWorkBuddyRequestActive(input.signal);
  return Object.freeze({
    challenge,
    preview: Object.freeze({
      actionKind: challenge.actionKind,
      target: Object.freeze({ ...challenge.target }),
      expectedVersion: challenge.expectedVersion,
      command,
      summaryHash,
      authorityEffect: "none",
      externalExecutionAllowed: false,
    }),
  });
}

function assertReceiptMatches(input: {
  receipt: GovernedMutationSubmissionReceipt;
  challenge: GovernedMutationChallenge;
  summaryHash: string;
}): void {
  if (
    input.receipt.workspaceId !== input.challenge.workspaceId ||
    input.receipt.challengeId !== input.challenge.challengeId ||
    input.receipt.actionKind !== input.challenge.actionKind ||
    input.receipt.idempotencyKey !== input.challenge.idempotencyKey ||
    input.receipt.expectedVersion !== input.challenge.expectedVersion ||
    input.receipt.summaryHash !== input.summaryHash ||
    !sameValue(input.receipt.target, input.challenge.target)
  ) {
    throw new WorkBuddyCollaborationError(
      "VERSION_CONFLICT",
      "The idempotency key is already bound to another mutation.",
    );
  }
}

function assertRecoveryAuthorization(input: {
  identity: WorkBuddyClientIdentity;
  authorization: WorkBuddyAuthorizationContext;
  challenge: GovernedMutationChallenge;
  checkedAt: string;
}): void {
  const identity = workBuddyClientIdentitySchema.parse(input.identity);
  const authorization = requireWorkBuddyAuthorizationContext({
    authorization: input.authorization,
    requiredScope: "caio:canonical:mutate",
    requiredCapability: WORKBUDDY_OWNER_MUTATION_CAPABILITY,
  });
  if (
    authorization.checkedAt !== input.checkedAt ||
    identity.workspaceId !== input.challenge.workspaceId ||
    identity.clientId !== input.challenge.clientId ||
    identity.actorUserId !== input.challenge.actorUserId ||
    authorization.workspaceId !== input.challenge.workspaceId ||
    authorization.clientId !== input.challenge.clientId ||
    authorization.actorUserId !== input.challenge.actorUserId ||
    authorization.ceoBindingRef !==
      input.challenge.ceoBindingRef ||
    authorization.mandateRef !== input.challenge.mandateRef ||
    authorization.ceoRef !== input.challenge.ceoRef
  ) {
    throw new WorkBuddyCollaborationError(
      "SCOPE_DENIED",
      "The current identity cannot recover this mutation receipt.",
    );
  }
}

export async function submitGovernedMutationCommand(input: {
  challenge: GovernedMutationChallenge;
  actionKind: GovernedMutationActionKind;
  target: GovernedMutationTarget;
  expectedVersion: number;
  command: GovernedMutationCommand;
  idempotencyKey: string;
  proof: OwnerPresenceProof;
  identity: WorkBuddyClientIdentity;
  freshAuthorization: WorkBuddyAuthorizationContext;
  verifiedAt: string;
  verifier: GovernedMutationProofVerifier;
  challengeStore: GovernedMutationChallengeStore;
  resultStore: GovernedMutationResultStore;
  apply: IdempotentCanonicalMutationPort["apply"];
  signal?: AbortSignal;
}): Promise<
  Readonly<{
    outcome: "submitted" | "replayed";
    receipt: GovernedMutationSubmissionReceipt;
  }>
> {
  assertWorkBuddyRequestActive(input.signal);
  const challenge = governedMutationChallengeSchema.parse(
    input.challenge,
  );
  const actionKind = governedMutationActionKindSchema.parse(
    input.actionKind,
  );
  const target = governedMutationTargetSchema.parse(input.target);
  const proof = ownerPresenceProofSchema.parse(input.proof);
  const summaryHash = computeGovernedMutationSummaryHash({
    actionKind,
    target,
    expectedVersion: input.expectedVersion,
    command: input.command,
  });

  assertRecoveryAuthorization({
    identity: input.identity,
    authorization: input.freshAuthorization,
    challenge,
    checkedAt: input.verifiedAt,
  });
  const existing = await input.resultStore.get({
    workspaceId: challenge.workspaceId,
    actionKind,
    idempotencyKey: input.idempotencyKey,
    signal: input.signal,
  });
  assertWorkBuddyRequestActive(input.signal);
  if (existing) {
    assertReceiptMatches({
      receipt: existing,
      challenge,
      summaryHash,
    });
    return Object.freeze({
      outcome: "replayed",
      receipt: existing,
    });
  }

  const attestation = await authorizeGovernedMutationSubmission({
    challenge,
    actionKind,
    target,
    expectedVersion: input.expectedVersion,
    summaryHash,
    idempotencyKey: input.idempotencyKey,
    proof,
    identity: input.identity,
    freshAuthorization: input.freshAuthorization,
    verifiedAt: input.verifiedAt,
    verifier: input.verifier,
    store: input.challengeStore,
    signal: input.signal,
  });
  assertWorkBuddyRequestActive(input.signal);
  const canonical = await input.apply({
    workspaceId: attestation.workspaceId,
    clientId: attestation.clientId,
    actorUserId: attestation.actorUserId,
    ceoRef: attestation.ceoRef,
    ceoBindingRef: attestation.ceoBindingRef,
    mandateRef: attestation.mandateRef,
    target: attestation.target,
    expectedVersion: attestation.expectedVersion,
    command: freezeCommand(input.command),
    idempotencyKey: attestation.idempotencyKey,
    signal: input.signal,
  });
  const receipt = freezeSubmissionReceipt(
    governedMutationSubmissionReceiptSchema.parse({
      schemaVersion:
        "helm.workbuddy-governed-mutation-submission-receipt/v1",
      receiptRef: createGovernedMutationSubmissionReceiptRef({
        workspaceId: attestation.workspaceId,
        actionKind: attestation.actionKind,
        idempotencyKey: attestation.idempotencyKey,
      }),
      challengeId: attestation.challengeId,
      workspaceId: attestation.workspaceId,
      actionKind: attestation.actionKind,
      target: attestation.target,
      expectedVersion: attestation.expectedVersion,
      summaryHash: attestation.summaryHash,
      idempotencyKey: attestation.idempotencyKey,
      canonicalReceiptRef: canonical.canonicalReceiptRef,
      recordedAt: attestation.verifiedAt,
      authorityEffect: "none",
      canonicalMutationAuthorityGranted: false,
      canonicalMutationRecorded: true,
      externalExecutionAllowed: false,
    }),
  );
  // A returned canonical receipt must always be indexed, even when the
  // transport deadline elapsed while the atomic canonical write was running.
  const recorded = await input.resultStore.record(receipt);
  assertReceiptMatches({
    receipt: recorded.receipt,
    challenge,
    summaryHash,
  });
  assertWorkBuddyRequestActive(input.signal);
  return Object.freeze({
    outcome:
      recorded.outcome === "created" ? "submitted" : "replayed",
    receipt: recorded.receipt,
  });
}

export function createInMemoryGovernedMutationResultStore(): GovernedMutationResultStore {
  const receipts = new Map<
    string,
    GovernedMutationSubmissionReceipt
  >();

  function resultKey(input: {
    workspaceId: string;
    actionKind: GovernedMutationActionKind;
    idempotencyKey: string;
  }): string {
    return [
      input.workspaceId,
      input.actionKind,
      input.idempotencyKey,
    ].join("\u0000");
  }

  return Object.freeze({
    async get(getInput: {
      workspaceId: string;
      actionKind: GovernedMutationActionKind;
      idempotencyKey: string;
    }) {
      return receipts.get(resultKey(getInput)) ?? null;
    },

    async record(receipt: GovernedMutationSubmissionReceipt) {
      const parsed = freezeSubmissionReceipt(
        governedMutationSubmissionReceiptSchema.parse(receipt),
      );
      const receiptKey = resultKey(parsed);
      const existing = receipts.get(receiptKey);
      if (existing) {
        if (!sameValue(existing, parsed)) {
          throw new WorkBuddyCollaborationError(
            "VERSION_CONFLICT",
            "The idempotency key already has another receipt.",
          );
        }
        return Object.freeze({
          receipt: existing,
          outcome: "replayed" as const,
        });
      }
      receipts.set(receiptKey, parsed);
      return Object.freeze({
        receipt: parsed,
        outcome: "created" as const,
      });
    },
  });
}
