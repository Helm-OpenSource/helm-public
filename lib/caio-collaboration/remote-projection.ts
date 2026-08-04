import { z } from "zod";

import {
  WorkBuddyCollaborationError,
  workBuddyInstantSchema,
  workBuddySafeRefSchema,
} from "./contracts";
import type { CaioDeliveryEnvelope } from "./delivery-contracts";

const processingDispositionSchema = z.enum([
  "prohibited",
  "local_only",
  "remote_projected",
]);

const canonicalStatusSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_-]*$/);

const sourceQuestionSchema = z
  .object({
    questionRef: workBuddySafeRefSchema,
    rank: z.number().int().positive(),
    title: z.string().min(1).max(500),
    question: z.string().min(1).max(4_000),
    businessDomain: z.string().min(1).max(120),
    evidenceCount: z.number().int().nonnegative(),
    processingDisposition: processingDispositionSchema,
    contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  })
  .passthrough();

const sourceLifecycleRefSchema = z
  .object({
    ref: workBuddySafeRefSchema,
    status: canonicalStatusSchema,
  })
  .passthrough();

const p1cProjectionSourceSchema = z
  .object({
    workspaceId: workBuddySafeRefSchema,
    portfolio: z
      .object({
        portfolioRef: workBuddySafeRefSchema,
        sequence: z.number().int().positive(),
        generatedAt: workBuddyInstantSchema,
        questions: z.array(sourceQuestionSchema).max(10),
      })
      .passthrough(),
    selection: z
      .object({
        selectionReceiptRef: workBuddySafeRefSchema,
        sequence: z.number().int().positive(),
        selectedQuestionRefs: z
          .array(workBuddySafeRefSchema)
          .max(3),
      })
      .passthrough()
      .nullable()
      .optional(),
    followThrough: z
      .array(
        z
          .object({
            questionRef: workBuddySafeRefSchema,
            decisionRecord: sourceLifecycleRefSchema
              .extend({
                validUntil: workBuddyInstantSchema.nullable(),
              })
              .nullable(),
            actionItem: sourceLifecycleRefSchema
              .extend({
                riskLevel: canonicalStatusSchema,
              })
              .nullable(),
            approvalTask: sourceLifecycleRefSchema
              .extend({
                autoExecute: z.literal(false),
              })
              .nullable(),
            executionReceipt: sourceLifecycleRefSchema.nullable(),
          })
          .passthrough(),
      )
      .default([]),
  })
  .passthrough();

const projectionLifecycleRefSchema = z
  .object({
    ref: workBuddySafeRefSchema,
    status: canonicalStatusSchema,
  })
  .strict();

export const p1cRemoteProjectionSchema = z
  .object({
    schemaVersion: z.literal("helm.workbuddy-p1c-projection/v1"),
    workspaceRef: workBuddySafeRefSchema,
    portfolio: z
      .object({
        ref: workBuddySafeRefSchema,
        sequence: z.number().int().positive(),
        generatedAt: workBuddyInstantSchema,
      })
      .strict(),
    selection: z
      .object({
        receiptRef: workBuddySafeRefSchema,
        sequence: z.number().int().positive(),
        selectedQuestionRefs: z.array(workBuddySafeRefSchema).max(3),
      })
      .strict()
      .nullable(),
    questions: z.array(
      z
        .object({
          questionRef: workBuddySafeRefSchema,
          rank: z.number().int().positive(),
          businessDomain: z.string().min(1).max(120),
          evidenceCount: z.number().int().nonnegative(),
          selected: z.boolean(),
          content: z
            .object({
              title: z.string().min(1).max(500),
              question: z.string().min(1).max(4_000),
            })
            .strict()
            .nullable(),
          localViewRequired: z.boolean(),
        })
        .strict(),
    ),
    followThrough: z.array(
      z
        .object({
          questionRef: workBuddySafeRefSchema,
          decisionRecord: projectionLifecycleRefSchema
            .extend({
              validUntil: workBuddyInstantSchema.nullable(),
            })
            .nullable(),
          actionItem: projectionLifecycleRefSchema
            .extend({ riskLevel: canonicalStatusSchema })
            .nullable(),
          approvalTask: projectionLifecycleRefSchema
            .extend({ autoExecute: z.literal(false) })
            .nullable(),
          executionReceipt: projectionLifecycleRefSchema.nullable(),
        })
        .strict(),
    ),
    boundary: z
      .object({
        authorityEffect: z.literal("none"),
        canonicalMutationAuthorityGranted: z.literal(false),
        rawContentIncluded: z.literal(false),
        sourcePayloadCopied: z.literal(false),
      })
      .strict(),
  })
  .strict();

export type P1cRemoteProjection = z.infer<
  typeof p1cRemoteProjectionSchema
>;

const FORBIDDEN_REMOTE_KEYS = new Set([
  "evidenceRefs",
  "localOnly",
  "localPath",
  "path",
  "rawEvidence",
  "sourcePath",
  "transcript",
  "transcriptRef",
]);

function assertNoForbiddenRemoteKeys(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) assertNoForbiddenRemoteKeys(item);
    return;
  }
  if (value === null || typeof value !== "object") return;

  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_REMOTE_KEYS.has(key)) {
      throw new WorkBuddyCollaborationError(
        "PROJECTION_BLOCKED",
        "The remote projection contains a forbidden field.",
      );
    }
    assertNoForbiddenRemoteKeys(nested);
  }
}

export function projectP1cForWorkBuddy(
  source: unknown,
): P1cRemoteProjection {
  const parsed = p1cProjectionSourceSchema.parse(source);
  const selectedQuestionRefs = new Set(
    parsed.selection?.selectedQuestionRefs ?? [],
  );

  const projection = {
    schemaVersion: "helm.workbuddy-p1c-projection/v1" as const,
    workspaceRef: parsed.workspaceId,
    portfolio: {
      ref: parsed.portfolio.portfolioRef,
      sequence: parsed.portfolio.sequence,
      generatedAt: parsed.portfolio.generatedAt,
    },
    selection: parsed.selection
      ? {
          receiptRef: parsed.selection.selectionReceiptRef,
          sequence: parsed.selection.sequence,
          selectedQuestionRefs: parsed.selection.selectedQuestionRefs,
        }
      : null,
    questions: parsed.portfolio.questions.map((question) => {
      const remoteProjected =
        question.processingDisposition === "remote_projected";
      return {
        questionRef: question.questionRef,
        rank: question.rank,
        businessDomain: question.businessDomain,
        evidenceCount: question.evidenceCount,
        selected: selectedQuestionRefs.has(question.questionRef),
        content: remoteProjected
          ? {
              title: question.title,
              question: question.question,
            }
          : null,
        localViewRequired: !remoteProjected,
      };
    }),
    followThrough: parsed.followThrough.map((item) => ({
      questionRef: item.questionRef,
      decisionRecord: item.decisionRecord
        ? {
            ref: item.decisionRecord.ref,
            status: item.decisionRecord.status,
            validUntil: item.decisionRecord.validUntil,
          }
        : null,
      actionItem: item.actionItem
        ? {
            ref: item.actionItem.ref,
            status: item.actionItem.status,
            riskLevel: item.actionItem.riskLevel,
          }
        : null,
      approvalTask: item.approvalTask
        ? {
            ref: item.approvalTask.ref,
            status: item.approvalTask.status,
            autoExecute: false as const,
          }
        : null,
      executionReceipt: item.executionReceipt
        ? {
            ref: item.executionReceipt.ref,
            status: item.executionReceipt.status,
          }
        : null,
    })),
    boundary: {
      authorityEffect: "none" as const,
      canonicalMutationAuthorityGranted: false as const,
      rawContentIncluded: false as const,
      sourcePayloadCopied: false as const,
    },
  };

  assertNoForbiddenRemoteKeys(projection);
  return p1cRemoteProjectionSchema.parse(projection);
}

export function projectP1cDeliveryPromptForWorkBuddy(input: {
  source: unknown;
  envelope: CaioDeliveryEnvelope;
}) {
  const parsed = p1cProjectionSourceSchema.parse(input.source);
  if (
    input.envelope.source.objectKind !==
      "operating_question_candidate" ||
    parsed.workspaceId !== input.envelope.workspaceId ||
    parsed.portfolio.sequence !==
      input.envelope.source.objectVersion
  ) {
    throw new WorkBuddyCollaborationError(
      "VERSION_CONFLICT",
      "The P1C prompt projection does not match the delivery source.",
    );
  }
  const sourceQuestion = parsed.portfolio.questions.find(
    (question) =>
      question.questionRef === input.envelope.source.objectId,
  );
  if (
    !sourceQuestion ||
    sourceQuestion.contentHash !==
      input.envelope.source.objectHash
  ) {
    throw new WorkBuddyCollaborationError(
      "VERSION_CONFLICT",
      "The operating question changed after delivery.",
    );
  }

  const projection = projectP1cForWorkBuddy(parsed);
  const question = projection.questions.find(
    (candidate) =>
      candidate.questionRef === input.envelope.source.objectId,
  );
  if (!question) {
    throw new WorkBuddyCollaborationError(
      "PROJECTION_BLOCKED",
      "The delivered operating question is not projectable.",
    );
  }

  return Object.freeze({
    schemaVersion: "helm.workbuddy-prompt-projection/v1",
    available: question.content !== null,
    localViewRequired: question.localViewRequired,
    source: Object.freeze({ ...input.envelope.source }),
    portfolio: projection.portfolio,
    question,
    followThrough:
      projection.followThrough.find(
        (item) => item.questionRef === question.questionRef,
      ) ?? null,
    boundary: Object.freeze({
      authorityEffect: "none" as const,
      canonicalMutationAuthorityGranted: false as const,
      rawContentIncluded: false as const,
      sourcePayloadCopied: false as const,
      externalExecutionAllowed: false as const,
    }),
  });
}
