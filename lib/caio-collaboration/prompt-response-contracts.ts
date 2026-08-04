import { z } from "zod";

import {
  workBuddyIdempotencyKeySchema,
  workBuddyInstantSchema,
  workBuddySafeRefSchema,
} from "./contracts";
import {
  caioCanonicalObjectRefSchema,
  caioDeliveryHashSchema,
} from "./delivery-contracts";
import {
  promptResponseCommandSchema,
  type PromptResponseCommand,
} from "./mutation-commands";
import {
  canonicalJson,
  sha256,
} from "../expert-capability/hashing";

export const promptResponseResultingStatusSchema = z.enum([
  "answered",
  "snoozed",
  "declined",
]);

export const workBuddyPromptResponseReceiptSchema = z
  .object({
    schemaVersion: z.literal(
      "helm.workbuddy-prompt-response-receipt/v1",
    ),
    receiptRef: workBuddySafeRefSchema,
    workspaceId: workBuddySafeRefSchema,
    deliveryObjectId: workBuddySafeRefSchema,
    deliveryClaimId: workBuddySafeRefSchema,
    deliveryClaimHash: caioDeliveryHashSchema,
    clientId: workBuddySafeRefSchema,
    actorUserId: workBuddySafeRefSchema,
    ceoBindingRef: workBuddySafeRefSchema,
    mandateRef: workBuddySafeRefSchema,
    ceoRef: workBuddySafeRefSchema,
    source: caioCanonicalObjectRefSchema,
    response: promptResponseCommandSchema,
    resultingDeliveryStatus: promptResponseResultingStatusSchema,
    idempotencyKey: workBuddyIdempotencyKeySchema,
    requestHash: caioDeliveryHashSchema,
    recordedAt: workBuddyInstantSchema,
    authorityEffect: z.literal("none"),
    canonicalMutationAuthorityGranted: z.literal(false),
    sourceObjectMutationRecorded: z.literal(false),
    deliveryTransitionRecorded: z.literal(true),
    externalExecutionAllowed: z.literal(false),
  })
  .strict();

export type WorkBuddyPromptResponseReceipt = z.infer<
  typeof workBuddyPromptResponseReceiptSchema
>;

export function promptResponseResultingStatus(
  command: PromptResponseCommand,
): z.infer<typeof promptResponseResultingStatusSchema> {
  if (command.responseKind === "snooze") return "snoozed";
  if (command.responseKind === "decline") return "declined";
  return "answered";
}

export function createWorkBuddyPromptResponseReceiptRef(input: {
  workspaceId: string;
  idempotencyKey: string;
}): string {
  const digest = sha256(
    canonicalJson({
      schemaVersion:
        "helm.workbuddy-prompt-response-receipt-ref/v1",
      ...input,
    }),
  ).slice("sha256:".length);
  return `workbuddy-prompt-response:${digest}`;
}

export function computeWorkBuddyPromptResponseRequestHash(
  input: Readonly<Record<string, unknown>>,
): string {
  return sha256(
    canonicalJson({
      schemaVersion:
        "helm.workbuddy-prompt-response-request/v1",
      ...input,
    }),
  );
}
