/**
 * LLM Intelligence v2 — public-safe contracts.
 *
 * v2 is boundary-first, not an agent platform. These contracts add safer
 * context selection (`SelectedContextStub`), an audit-only selection receipt
 * (`LLMContextSelectionReceipt`), and the Counterfactual Reviewer output
 * (`CounterfactualReviewerOutput`) which may only downgrade or require review.
 *
 * Hard rules encoded here:
 *   - `SelectedContextStub` is the long-term minimal reviewer input. The full
 *     selector receipt is audit/replay only and must never enter an LLM prompt.
 *   - Counterfactual reviewer output cannot upgrade to commitment, approve,
 *     execute, hold a connector reference, or write memory — those fields do
 *     not exist in the schema, and the workflow + guard enforce the rest.
 */

import { z } from "zod";

import { redactLLMEgressValue } from "@/lib/llm/intelligence-contracts";

export const PRIVACY_CLASSES = [
  "public_safe_synthetic",
  "redacted_review",
  "private_runtime",
  "blocked",
] as const;
export const privacyClassSchema = z.enum(PRIVACY_CLASSES);
export type PrivacyClass = z.infer<typeof privacyClassSchema>;

const objectRefSchema = z.object({
  objectType: z.string().min(1),
  objectId: z.string().min(1),
  label: z.string().min(1).optional(),
});

const tokenBudgetSchema = z.object({
  maxInputTokens: z.number().int().positive(),
  maxOutputTokens: z.number().int().positive().optional(),
});

const missingSignalNoteSchema = z
  .object({
    gapId: z.string().min(1),
    missingSignalNote: z.string().min(1),
  })
  .strict();

/**
 * SelectedContextStub — the long-term minimal input contract for the
 * Counterfactual Reviewer. Minimal fields only: no raw selector rationale, no
 * full candidate pool, no scores. The full receipt stays in audit/replay.
 */
export const selectedContextStubSchema = z
  .object({
    objectRef: objectRefSchema,
    selectedEvidenceRefs: z.array(z.string().min(1)).default([]),
    missingEvidence: z.array(missingSignalNoteSchema).default([]),
    policySnapshotHash: z.string().min(1),
    privacyClass: privacyClassSchema,
    tokenBudget: tokenBudgetSchema,
  })
  // Strict: extra keys (e.g. a leaked selector-receipt field) fail closed
  // rather than being silently stripped into the minimal stub.
  .strict();
export type SelectedContextStub = z.infer<typeof selectedContextStubSchema>;

export function parseSelectedContextStub(input: unknown): SelectedContextStub {
  return selectedContextStubSchema.parse(input);
}

/**
 * LLMContextSelectionReceipt — A-lite context selection receipt. Audit / replay
 * only. It records the fuller selection decision (selected + rejected refs,
 * rationale, source receipts) for later inspection. It MUST NOT be passed into
 * an LLM prompt; only its projection to `SelectedContextStub` may be.
 */
export const llmContextSelectionReceiptSchema = z.object({
  receiptId: z.string().min(1),
  objectRef: objectRefSchema,
  selectedEvidenceRefs: z.array(z.string().min(1)).default([]),
  rejectedEvidenceRefs: z.array(z.string().min(1)).default([]),
  selectionRationale: z.array(z.string().min(1)).default([]),
  missingEvidence: z.array(missingSignalNoteSchema).default([]),
  policySnapshotHash: z.string().min(1),
  sourceReceiptRefs: z.array(z.string().min(1)).default([]),
  privacyClass: privacyClassSchema,
  /** Audit-only marker. The reviewer must consume the stub, never this receipt. */
  auditOnly: z.literal(true).default(true),
});
export type LLMContextSelectionReceipt = z.infer<typeof llmContextSelectionReceiptSchema>;

export function parseLLMContextSelectionReceipt(input: unknown): LLMContextSelectionReceipt {
  return llmContextSelectionReceiptSchema.parse(input);
}

/**
 * Project the audit-only receipt down to the minimal reviewer stub. This is the
 * only sanctioned bridge from selector receipt to LLM-facing input.
 */
export function projectSelectedContextStub(
  receipt: LLMContextSelectionReceipt,
  tokenBudget: z.infer<typeof tokenBudgetSchema>,
): SelectedContextStub {
  return parseSelectedContextStub({
    objectRef: receipt.objectRef,
    selectedEvidenceRefs: receipt.selectedEvidenceRefs,
    missingEvidence: receipt.missingEvidence,
    policySnapshotHash: receipt.policySnapshotHash,
    privacyClass: receipt.privacyClass,
    tokenBudget,
  });
}

export interface CounterfactualEgressPolicy {
  providerMode?: "local" | "remote";
  consentGranted?: boolean;
  promptPreviewAccepted?: boolean;
  auditRef?: string;
}

export interface CounterfactualEgressResult {
  ok: boolean;
  providerMode: "local" | "remote";
  safeStub: SelectedContextStub | null;
  safeJudgementSummary: string | null;
  audit: {
    redacted: boolean;
    consentGranted: boolean;
    promptPreviewAccepted: boolean;
    auditRef?: string;
    blockedReason?: string;
  };
}

/**
 * Egress gate for the Counterfactual Reviewer, mirroring the v1 packet egress
 * ceremony. A non-`public_safe_synthetic` stub defaults to remote-risk; a remote
 * provider path requires consent + prompt preview, otherwise it fails closed
 * BEFORE any provider dispatch. On the allowed path both the stub and the
 * free-text judgement summary are redacted before they can reach a provider.
 */
export function prepareCounterfactualEgress(input: {
  contextStub: SelectedContextStub;
  judgementSummary: string;
  policy?: CounterfactualEgressPolicy;
}): CounterfactualEgressResult {
  const providerMode =
    input.policy?.providerMode ??
    (input.contextStub.privacyClass === "public_safe_synthetic" ? "local" : "remote");
  const consentGranted = input.policy?.consentGranted === true;
  const promptPreviewAccepted = input.policy?.promptPreviewAccepted === true;

  if (providerMode === "remote" && (!consentGranted || !promptPreviewAccepted)) {
    return {
      ok: false,
      providerMode,
      safeStub: null,
      safeJudgementSummary: null,
      audit: {
        redacted: false,
        consentGranted,
        promptPreviewAccepted,
        auditRef: input.policy?.auditRef,
        blockedReason: "remote_counterfactual_requires_consent_and_prompt_preview",
      },
    };
  }

  const redactedStub = redactLLMEgressValue(input.contextStub);
  const safeStub = selectedContextStubSchema.parse(redactedStub.value);
  const redactedSummary = redactLLMEgressValue(input.judgementSummary);
  const safeJudgementSummary =
    typeof redactedSummary.value === "string"
      ? redactedSummary.value
      : String(redactedSummary.value ?? "");

  return {
    ok: true,
    providerMode,
    safeStub,
    safeJudgementSummary,
    audit: {
      redacted: redactedStub.redacted || redactedSummary.redacted,
      consentGranted,
      promptPreviewAccepted,
      auditRef: input.policy?.auditRef,
    },
  };
}

export const COUNTERFACTUAL_REVIEW_STATES = [
  "candidate",
  "needs_review",
  "rejected_by_guard",
] as const;
export const counterfactualReviewStateSchema = z.enum(COUNTERFACTUAL_REVIEW_STATES);
export type CounterfactualReviewState = z.infer<typeof counterfactualReviewStateSchema>;

export const DOWNGRADE_CONDITION_TYPES = [
  "evidence_gap",
  "contradicting_signal",
  "stale_evidence",
  "scope_overreach",
  "commitment_overclaim",
  "unverified_assumption",
] as const;
export const downgradeConditionTypeSchema = z.enum(DOWNGRADE_CONDITION_TYPES);
export type DowngradeConditionType = z.infer<typeof downgradeConditionTypeSchema>;

export const downgradeConditionSchema = z
  .object({
    type: downgradeConditionTypeSchema,
    note: z.string().min(1).optional(),
  })
  .strict();
export type DowngradeCondition = z.infer<typeof downgradeConditionSchema>;

export const COUNTERFACTUAL_FAIL_CLOSED_REASONS = [
  "timeout",
  "provider_failure",
  "parse_failure",
  "schema_failure",
  "empty_response",
  "missing_policy",
  "missing_permission",
  "unsafe_capability_request",
  "egress_blocked",
] as const;
export const counterfactualReasonSchema = z.enum(COUNTERFACTUAL_FAIL_CLOSED_REASONS);
export type CounterfactualFailClosedReason = z.infer<typeof counterfactualReasonSchema>;

/**
 * CounterfactualReviewerOutput — the reviewer may only surface alternative
 * hypotheses, disconfirming evidence to seek, downgrade conditions, and a
 * commitment-risk flag, then either keep the candidate in review or require
 * human review. There is intentionally no field for approval, execution,
 * commitment upgrade, a connector reference, or a memory write.
 */
export const counterfactualReviewerOutputSchema = z
  .object({
    alternativeHypotheses: z.array(z.string().min(1)).default([]),
    disconfirmingEvidenceNeeded: z.array(z.string().min(1)).default([]),
    downgradeConditions: z.array(downgradeConditionSchema).default([]),
    commitmentRiskUp: z.boolean(),
    downReason: z.string().min(1).nullable().default(null),
    reviewState: counterfactualReviewStateSchema,
    requiredHumanReview: z.boolean(),
    reason: z.string().min(1).nullable().default(null),
  })
  // Strict: an LLM that returns a valid body plus an unsafe extra key
  // (e.g. a commitment-upgrade, connector-handle, or memory-write field) must
  // trigger a schema failure — the workflow then fails closed — rather than
  // silently stripping the dangerous field and passing the rest through.
  .strict();
export type CounterfactualReviewerOutput = z.infer<typeof counterfactualReviewerOutputSchema>;

export function parseCounterfactualReviewerOutput(input: unknown): CounterfactualReviewerOutput {
  return counterfactualReviewerOutputSchema.parse(input);
}

/**
 * Build the fail-closed counterfactual result. Used on timeout, missing policy
 * / permission, unsafe capability request, provider / parse / schema failure,
 * or empty response. Always `needs_review` + requiredHumanReview, carrying the
 * fail-closed reason. Per owner decision, a timeout must not raise human-review
 * queue priority — this output carries no priority signal.
 */
export function buildFailClosedCounterfactualResult(
  reason: CounterfactualFailClosedReason,
  downReason?: string,
): CounterfactualReviewerOutput {
  return counterfactualReviewerOutputSchema.parse({
    alternativeHypotheses: [],
    disconfirmingEvidenceNeeded: [],
    downgradeConditions: [],
    commitmentRiskUp: true,
    downReason: downReason ?? `Counterfactual reviewer failed closed (${reason}).`,
    reviewState: "needs_review",
    requiredHumanReview: true,
    reason,
  });
}
