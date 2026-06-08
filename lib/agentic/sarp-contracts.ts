/**
 * Helm Structured Adversarial Review Protocol (SARP) v0.1.
 *
 * Public Core contract only: deterministic receipt over an AgentRunCapsule.
 * It grants no approval authority and exposes no execution handle.
 */

import { z } from "zod";

export const SARP_REVIEW_VERSION = "0.1" as const;

export const sarpCheckIdSchema = z.enum([
  "self_cert_check",
  "counterfactual_presence",
  "scope_seal_check",
  "validation_chain_check",
  "permission_boundary_check",
]);
export type SarpCheckId = z.infer<typeof sarpCheckIdSchema>;

export const sarpVerdictCodeSchema = z.enum(["pass", "advisory", "block", "escalate"]);
export type SarpVerdictCode = z.infer<typeof sarpVerdictCodeSchema>;

export const sarpFindingCodeSchema = z.enum([
  "green_check_overclaim",
  "candidate_autopromotion",
  "counterfactual_missing",
  "scope_not_sealed",
  "validation_chain_missing",
  "boundary_authority_leak",
  "permission_boundary_violation",
  "redaction_leak",
]);
export type SarpFindingCode = z.infer<typeof sarpFindingCodeSchema>;

export const sarpCheckResultSchema = z
  .object({
    checkId: sarpCheckIdSchema,
    passed: z.boolean(),
    finding: sarpFindingCodeSchema.optional(),
    evidenceField: z.string().min(1).optional(),
  })
  .strict()
  .refine((result) => (result.passed ? result.finding === undefined : result.finding !== undefined), {
    message: "failed SARP checks must carry a closed-set finding; passed checks must not",
  });
export type SarpCheckResult = z.infer<typeof sarpCheckResultSchema>;

export const sarpReviewReceiptSchema = z
  .object({
    sarpVersion: z.literal(SARP_REVIEW_VERSION),
    capsuleRunId: z.string().min(1),
    reviewedAt: z.string().min(1),
    verdict: sarpVerdictCodeSchema,
    checks: z.array(sarpCheckResultSchema).length(5),
    humanReviewRequired: z.boolean(),
  })
  .strict();
export type SarpReviewReceipt = z.infer<typeof sarpReviewReceiptSchema>;
