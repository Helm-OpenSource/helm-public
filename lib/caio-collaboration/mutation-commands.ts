import { z } from "zod";

import {
  CAIO_ADVICE_DECISION_OUTCOMES,
} from "@/lib/caio-governance/advice";
import {
  caioQuestionSelectionItemSchema,
} from "@/lib/stage1-owner-loop/caio-question-selection";

import {
  workBuddyInstantSchema,
  workBuddySafeRefSchema,
} from "./contracts";
import { caioDeliveryHashSchema } from "./delivery-contracts";

export const promptResponseCommandSchema = z.discriminatedUnion(
  "responseKind",
  [
    z
      .object({
        responseKind: z.literal("answer"),
        deliveryObjectId: workBuddySafeRefSchema,
        answer: z.string().trim().min(1).max(4_000),
      })
      .strict(),
    z
      .object({
        responseKind: z.literal("provide_evidence"),
        deliveryObjectId: workBuddySafeRefSchema,
        evidenceRefs: z
          .array(workBuddySafeRefSchema)
          .min(1)
          .max(20)
          .refine(
            (values) => new Set(values).size === values.length,
            "evidence refs must be unique",
          ),
      })
      .strict(),
    z
      .object({
        responseKind: z.literal("snooze"),
        deliveryObjectId: workBuddySafeRefSchema,
        snoozedUntil: workBuddyInstantSchema,
      })
      .strict(),
    z
      .object({
        responseKind: z.literal("decline"),
        deliveryObjectId: workBuddySafeRefSchema,
        reason: z.string().trim().min(1).max(1_000),
      })
      .strict(),
  ],
);

export type PromptResponseCommand = z.infer<
  typeof promptResponseCommandSchema
>;

export const questionSelectionCommandSchema = z
  .object({
    portfolioHash: caioDeliveryHashSchema,
    selections: z
      .array(caioQuestionSelectionItemSchema)
      .max(3),
    reasonCodes: z
      .array(z.string().trim().min(1).max(120))
      .max(20),
    evidenceRefs: z
      .array(workBuddySafeRefSchema)
      .min(1)
      .max(100),
  })
  .strict();

export type QuestionSelectionCommand = z.infer<
  typeof questionSelectionCommandSchema
>;

export const adviceDecisionCommandSchema = z
  .object({
    outcome: z.enum(CAIO_ADVICE_DECISION_OUTCOMES),
    reason: z.string().trim().min(1).max(2_000),
  })
  .strict();

export type AdviceDecisionCommand = z.infer<
  typeof adviceDecisionCommandSchema
>;
