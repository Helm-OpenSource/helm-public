import { z } from "zod";

import { detectPIIInOutput } from "@/lib/llm/output-pii-scrubber";

export const JUDGEMENT_REVIEW_STATES = [
  "candidate",
  "needs_review",
  "rejected_by_guard",
] as const;

export const LLM_CRITIC_ISSUE_CODES = [
  "SPECULATION_AS_FACT",
  "OUT_OF_EVIDENCE_SCOPE",
  "BOUNDARY_VIOLATION",
  "OVERSTRONG_ACTION",
  "MISSING_EVIDENCE",
  "PII_RISK",
  "AUTO_EXECUTION_RISK",
  "WRITEBACK_RISK",
  "EXTERNAL_SEND_RISK",
  "COMMITMENT_OVERCLAIM",
] as const;

const evidenceRefSchema = z.object({
  refId: z.string().min(1),
  sourceType: z.string().min(1),
  label: z.string().min(1).optional(),
  summary: z.string().min(1).optional(),
});

const timelineEntrySchema = z.object({
  occurredAt: z.string().min(1),
  eventType: z.string().min(1),
  summary: z.string().min(1),
  evidenceRefIds: z.array(z.string().min(1)).default([]),
});

const signalSchema = z.object({
  signalId: z.string().min(1),
  family: z.string().min(1),
  summary: z.string().min(1),
  strength: z.number().min(0).max(100).optional(),
  evidenceRefIds: z.array(z.string().min(1)).default([]),
});

const commitmentSchema = z.object({
  commitmentId: z.string().min(1),
  summary: z.string().min(1),
  ownerRef: z.string().min(1).optional(),
  dueAt: z.string().min(1).optional(),
  evidenceRefIds: z.array(z.string().min(1)).default([]),
});

const blockerSchema = z.object({
  blockerId: z.string().min(1),
  summary: z.string().min(1),
  severity: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  evidenceRefIds: z.array(z.string().min(1)).default([]),
});

const missingEvidenceSchema = z.object({
  gapId: z.string().min(1),
  summary: z.string().min(1),
  neededFor: z.string().min(1),
  severity: z.enum(["low", "medium", "high"]).default("medium"),
});

export const llmContextPacketSchema = z.object({
  packetId: z.string().min(1),
  workspaceId: z.string().min(1),
  objectRef: z.object({
    objectType: z.string().min(1),
    objectId: z.string().min(1),
    label: z.string().min(1).optional(),
  }),
  timeline: z.array(timelineEntrySchema).default([]),
  evidenceRefs: z.array(evidenceRefSchema).default([]),
  signals: z.array(signalSchema).default([]),
  commitments: z.array(commitmentSchema).default([]),
  blockers: z.array(blockerSchema).default([]),
  policySnapshot: z.record(z.string(), z.unknown()).default({}),
  permissions: z.object({
    allowedUses: z.array(z.string().min(1)).default([]),
    forbiddenUses: z.array(z.string().min(1)).default([]),
    requiredHumanReview: z.boolean().default(true),
  }),
  privacyClass: z.enum([
    "public_safe_synthetic",
    "redacted_review",
    "private_runtime",
    "blocked",
  ]),
  tokenBudget: z.object({
    maxInputTokens: z.number().int().positive(),
    maxOutputTokens: z.number().int().positive().optional(),
  }),
  missingEvidence: z.array(missingEvidenceSchema).default([]),
  boundaryNotes: z.array(z.string().min(1)).default([]),
});

export type LLMContextPacket = z.infer<typeof llmContextPacketSchema>;

export const judgementReviewStateSchema = z.enum(JUDGEMENT_REVIEW_STATES);

export const judgementCandidateSchema = z.object({
  candidateId: z.string().min(1),
  packetId: z.string().min(1),
  workspaceId: z.string().min(1),
  targetObjectRef: z.object({
    objectType: z.string().min(1),
    objectId: z.string().min(1),
  }),
  judgementType: z.enum([
    "business_signal",
    "recommendation_critic",
    "evidence_gap",
    "counterargument",
    "boundary_review",
  ]),
  reviewState: judgementReviewStateSchema,
  confidence: z.number().min(0).max(100),
  summary: z.string().min(1),
  rationale: z.array(z.string().min(1)).default([]),
  evidenceRefIds: z.array(z.string().min(1)).default([]),
  missingEvidenceIds: z.array(z.string().min(1)).default([]),
  boundaryNotes: z.array(z.string().min(1)).default([]),
});

export type JudgementCandidate = z.infer<typeof judgementCandidateSchema>;

export const llmCriticIssueCodeSchema = z.enum(LLM_CRITIC_ISSUE_CODES);

export const llmCriticResultSchema = z.object({
  resultId: z.string().min(1),
  candidateId: z.string().min(1),
  packetId: z.string().min(1),
  reviewState: judgementReviewStateSchema,
  requiredHumanReview: z.boolean(),
  // Clean enough to show to a human reviewer; never an execution authorization.
  approvedForReview: z.boolean(),
  issueCodes: z.array(llmCriticIssueCodeSchema).default([]),
  issueNotes: z.array(z.string().min(1)).default([]),
  missingEvidenceIds: z.array(z.string().min(1)).default([]),
  counterarguments: z.array(z.string().min(1)).default([]),
  boundaryDecision: z.enum(["advisory_only", "fail_closed", "guard_rejected"]),
  fallbackReason: z.string().min(1).optional(),
});

export type LLMCriticIssueCode = z.infer<typeof llmCriticIssueCodeSchema>;
export type LLMCriticResult = z.infer<typeof llmCriticResultSchema>;

export const promptRevisionCandidateSchema = z.object({
  revisionId: z.string().min(1),
  promptKey: z.string().min(1),
  taskType: z.string().min(1),
  promotionState: z.enum([
    "candidate",
    "needs_review",
    "rejected_by_guard",
    "held_out_eval_candidate",
    "held_out_eval_passed",
  ]),
  proposedBy: z.enum(["human", "llm", "system"]),
  rationale: z.array(z.string().min(1)).default([]),
  requiredEvalIds: z.array(z.string().min(1)).default([]),
  boundaryNotes: z.array(z.string().min(1)).default([]),
});

export type PromptRevisionCandidate = z.infer<typeof promptRevisionCandidateSchema>;

export function parseLLMContextPacket(input: unknown): LLMContextPacket {
  return llmContextPacketSchema.parse(input);
}

export function parseJudgementCandidate(input: unknown): JudgementCandidate {
  return judgementCandidateSchema.parse(input);
}

export function parseLLMCriticResult(input: unknown): LLMCriticResult {
  return llmCriticResultSchema.parse(input);
}

export function redactLLMEgressValue(value: unknown): { value: unknown; redacted: boolean } {
  return redactPacketValue(value);
}

export function buildFailClosedLLMCriticResult(input: {
  resultId: string;
  candidateId: string;
  packetId: string;
  fallbackReason: string;
  issueNotes?: string[];
  missingEvidenceIds?: string[];
}): LLMCriticResult {
  return llmCriticResultSchema.parse({
    resultId: input.resultId,
    candidateId: input.candidateId,
    packetId: input.packetId,
    reviewState: "needs_review",
    requiredHumanReview: true,
    approvedForReview: false,
    issueCodes: ["BOUNDARY_VIOLATION", "MISSING_EVIDENCE"],
    issueNotes:
      input.issueNotes && input.issueNotes.length > 0
        ? input.issueNotes
        : ["Boundary reviewer did not produce a valid advisory result."],
    missingEvidenceIds: input.missingEvidenceIds ?? [],
    counterarguments: [],
    boundaryDecision: "fail_closed",
    fallbackReason: input.fallbackReason,
  });
}

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const CN_MOBILE_PATTERN = /(?<!\d)(?:\+?86[-\s]?)?1[3-9]\d{9}(?!\d)/g;
const CN_ID_CARD_PATTERN = /(?<!\d)\d{17}[\dXx](?!\d)/g;
const LONG_TOKEN_PATTERN = /\b[A-Za-z0-9_-]{32,}\b/g;

function redactText(value: string): { value: string; redacted: boolean } {
  const detected = detectPIIInOutput(value);
  const next = value
    .replace(EMAIL_PATTERN, "[redacted-email]")
    .replace(CN_MOBILE_PATTERN, "[redacted-mobile]")
    .replace(CN_ID_CARD_PATTERN, "[redacted-id]")
    .replace(LONG_TOKEN_PATTERN, "[redacted-token]");

  return {
    value: next,
    redacted: detected.detected || next !== value,
  };
}

function redactPacketValue(value: unknown): { value: unknown; redacted: boolean } {
  if (typeof value === "string") {
    return redactText(value);
  }

  if (Array.isArray(value)) {
    let redacted = false;
    const next = value.map((item) => {
      const result = redactPacketValue(item);
      redacted ||= result.redacted;
      return result.value;
    });
    return { value: next, redacted };
  }

  if (value && typeof value === "object") {
    let redacted = false;
    const next: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      if (
        /^(authorization|credential|credentials|password|secret|api[_-]?key|access[_-]?token|refresh[_-]?token|bearer[_-]?token)$/i.test(
          key,
        )
      ) {
        next[key] = "[redacted-sensitive-key]";
        redacted = true;
        continue;
      }

      const result = redactPacketValue(item);
      next[key] = result.value;
      redacted ||= result.redacted;
    }
    return { value: next, redacted };
  }

  return { value, redacted: false };
}

export function prepareLLMContextPacketForRemoteProvider(
  packet: LLMContextPacket,
  options: {
    providerMode: "local" | "remote";
    consentGranted?: boolean;
    promptPreviewAccepted?: boolean;
    auditRef?: string;
  },
): {
  ok: boolean;
  safePacket: LLMContextPacket | null;
  audit: {
    redacted: boolean;
    consentGranted: boolean;
    promptPreviewAccepted: boolean;
    auditRef?: string;
    blockedReason?: string;
  };
} {
  if (
    options.providerMode === "remote" &&
    (!options.consentGranted || !options.promptPreviewAccepted)
  ) {
    return {
      ok: false,
      safePacket: null,
      audit: {
        redacted: false,
        consentGranted: options.consentGranted === true,
        promptPreviewAccepted: options.promptPreviewAccepted === true,
        auditRef: options.auditRef,
        blockedReason: "remote_llm_packet_requires_consent_and_prompt_preview",
      },
    };
  }

  const redacted = redactPacketValue(packet);
  const redactedPacket =
    redacted.value && typeof redacted.value === "object" && !Array.isArray(redacted.value)
      ? {
          ...(redacted.value as Record<string, unknown>),
          privacyClass:
            packet.privacyClass === "public_safe_synthetic"
              ? packet.privacyClass
              : "redacted_review",
        }
      : redacted.value;
  const safePacket = parseLLMContextPacket(redactedPacket);

  return {
    ok: true,
    safePacket,
    audit: {
      redacted: redacted.redacted,
      consentGranted: options.consentGranted === true,
      promptPreviewAccepted: options.promptPreviewAccepted === true,
      auditRef: options.auditRef,
    },
  };
}
