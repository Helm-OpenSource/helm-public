import { z } from "zod";

import {
  workBuddyIdempotencyKeySchema,
  workBuddySafeRefSchema,
} from "./contracts";
import {
  adviceDecisionCommandSchema,
  promptResponseCommandSchema,
  questionSelectionCommandSchema,
} from "./mutation-commands";
import {
  ownerPresenceProofSchema,
  type WorkBuddyJsonSchema,
} from "./tool-schemas";

const expectedVersionSchema = z.number().int().positive();

export const preparePromptResponseInputSchema = z
  .object({
    workspaceId: workBuddySafeRefSchema,
    expectedVersion: expectedVersionSchema,
    response: promptResponseCommandSchema,
    idempotencyKey: workBuddyIdempotencyKeySchema,
  })
  .strict();

export const submitPromptResponseInputSchema =
  preparePromptResponseInputSchema
    .extend({
      challengeId: workBuddySafeRefSchema,
      proof: ownerPresenceProofSchema,
    })
    .strict();

export const getPromptResponseReceiptInputSchema = z
  .object({
    workspaceId: workBuddySafeRefSchema,
    idempotencyKey: workBuddyIdempotencyKeySchema,
  })
  .strict();

export const prepareQuestionSelectionInputSchema = z
  .object({
    workspaceId: workBuddySafeRefSchema,
    portfolioRef: workBuddySafeRefSchema,
    expectedVersion: expectedVersionSchema,
    selection: questionSelectionCommandSchema,
    idempotencyKey: workBuddyIdempotencyKeySchema,
  })
  .strict();

export const submitQuestionSelectionInputSchema =
  prepareQuestionSelectionInputSchema
    .extend({
      challengeId: workBuddySafeRefSchema,
      proof: ownerPresenceProofSchema,
    })
    .strict();

export const getQuestionSelectionReceiptInputSchema = z
  .object({
    workspaceId: workBuddySafeRefSchema,
    idempotencyKey: workBuddyIdempotencyKeySchema,
  })
  .strict();

export const prepareAdviceDecisionInputSchema = z
  .object({
    workspaceId: workBuddySafeRefSchema,
    adviceRef: workBuddySafeRefSchema,
    expectedVersion: expectedVersionSchema,
    decision: adviceDecisionCommandSchema,
    idempotencyKey: workBuddyIdempotencyKeySchema,
  })
  .strict();

export const submitAdviceDecisionInputSchema =
  prepareAdviceDecisionInputSchema
    .extend({
      challengeId: workBuddySafeRefSchema,
      proof: ownerPresenceProofSchema,
    })
    .strict();

export const getAdviceDecisionReceiptInputSchema = z
  .object({
    workspaceId: workBuddySafeRefSchema,
    idempotencyKey: workBuddyIdempotencyKeySchema,
  })
  .strict();

export const WORKBUDDY_GOVERNED_MUTATION_TOOL_NAMES = [
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

const prepareProperties = {
  workspaceId: { type: "string" },
  expectedVersion: { type: "integer", minimum: 1 },
  idempotencyKey: { type: "string" },
} as const;

const proofProperties = {
  challengeId: { type: "string" },
  proof: { type: "object" },
} as const;

export const WORKBUDDY_GOVERNED_MUTATION_JSON_SCHEMAS =
  Object.freeze({
    prepare_prompt_response: {
      type: "object",
      additionalProperties: false,
      properties: {
        ...prepareProperties,
        response: { type: "object" },
      },
      required: [
        "workspaceId",
        "expectedVersion",
        "response",
        "idempotencyKey",
      ],
    },
    submit_prompt_response: {
      type: "object",
      additionalProperties: false,
      properties: {
        ...prepareProperties,
        ...proofProperties,
        response: { type: "object" },
      },
      required: [
        "workspaceId",
        "expectedVersion",
        "response",
        "idempotencyKey",
        "challengeId",
        "proof",
      ],
    },
    get_prompt_response_receipt: {
      type: "object",
      additionalProperties: false,
      properties: {
        workspaceId: { type: "string" },
        idempotencyKey: { type: "string" },
      },
      required: ["workspaceId", "idempotencyKey"],
    },
    prepare_question_selection: {
      type: "object",
      additionalProperties: false,
      properties: {
        ...prepareProperties,
        portfolioRef: { type: "string" },
        selection: { type: "object" },
      },
      required: [
        "workspaceId",
        "portfolioRef",
        "expectedVersion",
        "selection",
        "idempotencyKey",
      ],
    },
    submit_question_selection: {
      type: "object",
      additionalProperties: false,
      properties: {
        ...prepareProperties,
        ...proofProperties,
        portfolioRef: { type: "string" },
        selection: { type: "object" },
      },
      required: [
        "workspaceId",
        "portfolioRef",
        "expectedVersion",
        "selection",
        "idempotencyKey",
        "challengeId",
        "proof",
      ],
    },
    get_question_selection_receipt: {
      type: "object",
      additionalProperties: false,
      properties: {
        workspaceId: { type: "string" },
        idempotencyKey: { type: "string" },
      },
      required: ["workspaceId", "idempotencyKey"],
    },
    prepare_advice_decision: {
      type: "object",
      additionalProperties: false,
      properties: {
        ...prepareProperties,
        adviceRef: { type: "string" },
        decision: { type: "object" },
      },
      required: [
        "workspaceId",
        "adviceRef",
        "expectedVersion",
        "decision",
        "idempotencyKey",
      ],
    },
    submit_advice_decision: {
      type: "object",
      additionalProperties: false,
      properties: {
        ...prepareProperties,
        ...proofProperties,
        adviceRef: { type: "string" },
        decision: { type: "object" },
      },
      required: [
        "workspaceId",
        "adviceRef",
        "expectedVersion",
        "decision",
        "idempotencyKey",
        "challengeId",
        "proof",
      ],
    },
    get_advice_decision_receipt: {
      type: "object",
      additionalProperties: false,
      properties: {
        workspaceId: { type: "string" },
        idempotencyKey: { type: "string" },
      },
      required: ["workspaceId", "idempotencyKey"],
    },
  } satisfies Record<
    (typeof WORKBUDDY_GOVERNED_MUTATION_TOOL_NAMES)[number],
    WorkBuddyJsonSchema
  >);
