import { z } from "zod";

import {
  MULTI_PASS_ROLES,
  modelProviderModeSchema,
} from "@/lib/llm/intelligence-contracts-v3";
import { reasoningBudgetDecisionSchema } from "@/lib/llm/reasoning-budget";

export const multiPassRoleCallReceiptSchema = z
  .object({
    role: z.enum(MULTI_PASS_ROLES),
    success: z.boolean(),
    fallbackReason: z.string().min(1).nullable(),
    promptKey: z.string().min(1),
    promptVersion: z.string().min(1),
  })
  .strict();
export type MultiPassRoleCallReceipt = z.infer<
  typeof multiPassRoleCallReceiptSchema
>;

export const multiPassBoundaryReceiptSchema = z
  .object({
    receiptId: z.string().min(1),
    traceId: z.string().min(1).nullable(),
    createdAt: z.string().datetime(),
    profileKey: z.string().min(1),
    providerMode: modelProviderModeSchema,
    promptKey: z.literal("multi-pass-review"),
    promptVersion: z.string().min(1),
    budgetDecision: reasoningBudgetDecisionSchema,
    egress: z
      .object({
        redacted: z.boolean(),
        consentGranted: z.boolean(),
        promptPreviewAccepted: z.boolean(),
        auditRef: z.string().min(1).nullable(),
        blockedReason: z.string().min(1).nullable(),
      })
      .strict(),
    roleCalls: z.array(multiPassRoleCallReceiptSchema).default([]),
    boundaryDecision: z.enum([
      "allow_candidate",
      "review_required",
      "reject",
      "quarantine",
    ]),
    requiredHumanReview: z.boolean(),
    reason: z.enum([
      "provider_failure",
      "parse_failure",
      "schema_failure",
      "egress_failure",
      "profile_mismatch",
      "role_conflict",
      "guard_rejected",
      "candidate_consensus",
      "budget_review_required",
    ]),
    rawPromptIncluded: z.literal(false),
    rawCustomerDataIncluded: z.literal(false),
    tenantUrlIncluded: z.literal(false),
    productionReceiptIncluded: z.literal(false),
  })
  .strict();
export type MultiPassBoundaryReceipt = z.infer<
  typeof multiPassBoundaryReceiptSchema
>;
