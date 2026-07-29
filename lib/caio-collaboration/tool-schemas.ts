import { z } from "zod";

import {
  workBuddyIdempotencyKeySchema,
  workBuddyInstantSchema,
  workBuddySafeRefSchema,
} from "./contracts";
import {
  caioDeliveryCursorSchema,
  caioDeliverySeveritySchema,
} from "./delivery-contracts";

export const ownerPresenceProofSchema = z
  .object({
    schemaVersion: z.literal("helm.owner-presence-proof/v1"),
    challengeId: workBuddySafeRefSchema,
    algorithm: z.literal("device-bound-signature"),
    signature: z.string().min(16).max(8_192),
    assertedAt: workBuddyInstantSchema,
  })
  .strict();

export type OwnerPresenceProof = z.infer<
  typeof ownerPresenceProofSchema
>;

export const beginOwnerPresenceChallengeInputSchema = z
  .object({
    workspaceId: workBuddySafeRefSchema,
    idempotencyKey: workBuddyIdempotencyKeySchema,
  })
  .strict();

export const completeOwnerPresenceChallengeInputSchema = z
  .object({
    challengeId: workBuddySafeRefSchema,
    proof: ownerPresenceProofSchema,
    idempotencyKey: workBuddyIdempotencyKeySchema,
  })
  .strict();

export const getP1cReadProjectionInputSchema = z
  .object({
    workspaceId: workBuddySafeRefSchema,
    portfolioRef: workBuddySafeRefSchema.optional(),
  })
  .strict();

export const pollCeoPromptsInputSchema = z
  .object({
    workspaceId: workBuddySafeRefSchema,
    severity: caioDeliverySeveritySchema,
    cursor: caioDeliveryCursorSchema,
    limit: z.number().int().min(1).max(100),
  })
  .strict();

export const listPendingCeoPromptsInputSchema = z
  .object({
    workspaceId: workBuddySafeRefSchema,
    severity: caioDeliverySeveritySchema.optional(),
  })
  .strict();

export const getCeoPromptInputSchema = z
  .object({
    workspaceId: workBuddySafeRefSchema,
    deliveryObjectId: workBuddySafeRefSchema,
  })
  .strict();

export const WORKBUDDY_READ_TOOL_NAMES = [
  "begin_owner_presence_challenge",
  "complete_owner_presence_challenge",
  "get_p1c_read_projection",
] as const;

export const WORKBUDDY_DELIVERY_TOOL_NAMES = [
  "poll_ceo_prompts",
  "list_pending_ceo_prompts",
  "get_ceo_prompt",
] as const;

export const WORKBUDDY_MUTATION_TOOL_NAMES = [
  "prepare_prompt_response",
  "submit_prompt_response",
  "get_prompt_response_receipt",
  "prepare_question_selection",
  "submit_question_selection",
  "get_question_selection_receipt",
  "prepare_advice_decision",
  "submit_advice_decision",
  "get_advice_decision_receipt",
] as const;

export type WorkBuddyJsonSchema = Readonly<{
  type: "object";
  additionalProperties: false;
  properties: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  required: readonly string[];
}>;

export const WORKBUDDY_TOOL_INPUT_JSON_SCHEMAS = Object.freeze({
  begin_owner_presence_challenge: {
    type: "object",
    additionalProperties: false,
    properties: {
      workspaceId: { type: "string" },
      idempotencyKey: { type: "string" },
    },
    required: ["workspaceId", "idempotencyKey"],
  },
  complete_owner_presence_challenge: {
    type: "object",
    additionalProperties: false,
    properties: {
      challengeId: { type: "string" },
      proof: { type: "object" },
      idempotencyKey: { type: "string" },
    },
    required: ["challengeId", "proof", "idempotencyKey"],
  },
  get_p1c_read_projection: {
    type: "object",
    additionalProperties: false,
    properties: {
      workspaceId: { type: "string" },
      portfolioRef: { type: "string" },
    },
    required: ["workspaceId"],
  },
  poll_ceo_prompts: {
    type: "object",
    additionalProperties: false,
    properties: {
      workspaceId: { type: "string" },
      severity: {
        type: "string",
        enum: ["critical", "normal"],
      },
      cursor: { type: "object" },
      limit: { type: "integer", minimum: 1, maximum: 100 },
    },
    required: ["workspaceId", "severity", "cursor", "limit"],
  },
  list_pending_ceo_prompts: {
    type: "object",
    additionalProperties: false,
    properties: {
      workspaceId: { type: "string" },
      severity: {
        type: "string",
        enum: ["critical", "normal"],
      },
    },
    required: ["workspaceId"],
  },
  get_ceo_prompt: {
    type: "object",
    additionalProperties: false,
    properties: {
      workspaceId: { type: "string" },
      deliveryObjectId: { type: "string" },
    },
    required: ["workspaceId", "deliveryObjectId"],
  },
} satisfies Record<
  | (typeof WORKBUDDY_READ_TOOL_NAMES)[number]
  | (typeof WORKBUDDY_DELIVERY_TOOL_NAMES)[number],
  WorkBuddyJsonSchema
>);
