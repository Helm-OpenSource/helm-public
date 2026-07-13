import { createHash } from "node:crypto";
import { z } from "zod";

import { WORKSPACE_CAPABILITIES } from "@/lib/auth/authorization";
import { serializeCandidateCanonicalJson } from "@/lib/llm/candidate-canonical-json";
import { v3ReviewStateSchema } from "@/lib/llm/intelligence-contracts-v3";

export const GOVERNED_EXTERNAL_SEND_DRAFT_SCHEMA_VERSION =
  "helm.governed-external-send-draft/v1" as const;
export const GOVERNED_CONNECTOR_SCOPE_SCHEMA_VERSION =
  "helm.governed-connector-scope-candidate/v1" as const;
export const GOVERNED_MEMORY_PROJECTION_SCHEMA_VERSION =
  "helm.governed-memory-candidate-projection/v1" as const;

const safeRefSchema = z.string().trim().min(1).max(512);
const safeTextSchema = z.string().trim().min(1).max(4_000);
const sha256Schema = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const timestampSchema = z.string().datetime();

function canonicalHash(value: unknown): `sha256:${string}` {
  return `sha256:${createHash("sha256")
    .update(serializeCandidateCanonicalJson(value), "utf8")
    .digest("hex")}`;
}

export const externalSendDlpReceiptSchema = z
  .object({
    receiptRef: safeRefSchema,
    recipientHash: sha256Schema,
    messageContentHash: sha256Schema,
    decision: z.literal("passed"),
    rulesetVersion: safeRefSchema,
    scannedAt: timestampSchema,
    rawContentStored: z.literal(false),
  })
  .strict();

export const externalSendRateLimitReceiptSchema = z
  .object({
    receiptRef: safeRefSchema,
    recipientHash: sha256Schema,
    decision: z.literal("allowed"),
    checkedAt: timestampSchema,
    expiresAt: timestampSchema,
  })
  .strict()
  .superRefine((receipt, ctx) => {
    if (Date.parse(receipt.expiresAt) <= Date.parse(receipt.checkedAt)) {
      ctx.addIssue({
        code: "custom",
        path: ["expiresAt"],
        message: "rate-limit receipt expiry must be after its check time",
      });
    }
  });

export const externalSendDedupeReceiptSchema = z
  .object({
    receiptRef: safeRefSchema,
    dedupeKey: safeRefSchema,
    recipientHash: sha256Schema,
    messageContentHash: sha256Schema,
    decision: z.literal("clear"),
    checkedAt: timestampSchema,
  })
  .strict();

export function deriveGovernedExternalSendDedupeKey(input: {
  meetingId: string;
  recipientHash: string;
  messageContentHash: string;
}) {
  return `send-dedupe:${canonicalHash({
    meetingId: input.meetingId,
    recipientHash: input.recipientHash,
    messageContentHash: input.messageContentHash,
  }).slice("sha256:".length)}`;
}

const governedExternalSendDraftHashInputSchema = z
  .object({
    schemaVersion: z.literal(GOVERNED_EXTERNAL_SEND_DRAFT_SCHEMA_VERSION),
    sourceArtifactBundleId: safeRefSchema,
    sourceArtifactReviewId: safeRefSchema,
    meetingId: safeRefSchema,
    reviewState: v3ReviewStateSchema,
    recipientRef: safeRefSchema,
    recipientHash: sha256Schema,
    messageContentRef: safeRefSchema,
    messageContentHash: sha256Schema,
    dlpReceipt: externalSendDlpReceiptSchema,
    rateLimitReceipt: externalSendRateLimitReceiptSchema,
    dedupeReceipt: externalSendDedupeReceiptSchema,
    requiredHumanClick: z.literal(true),
    automaticSendAllowed: z.literal(false),
    sendPerformed: z.literal(false),
  })
  .strict();

export const governedExternalSendDraftCandidateSchema =
  governedExternalSendDraftHashInputSchema
    .extend({
      candidateId: safeRefSchema,
      contractHash: sha256Schema,
    })
    .strict()
    .superRefine((candidate, ctx) => {
      const expectedDedupeKey = deriveGovernedExternalSendDedupeKey(candidate);
      if (
        candidate.dlpReceipt.recipientHash !== candidate.recipientHash ||
        candidate.rateLimitReceipt.recipientHash !== candidate.recipientHash ||
        candidate.dedupeReceipt.recipientHash !== candidate.recipientHash ||
        candidate.dlpReceipt.messageContentHash !==
          candidate.messageContentHash ||
        candidate.dedupeReceipt.messageContentHash !==
          candidate.messageContentHash ||
        candidate.dedupeReceipt.dedupeKey !== expectedDedupeKey
      ) {
        ctx.addIssue({
          code: "custom",
          message:
            "external-send receipts must bind the same fixed recipient, content, and dedupe key",
        });
      }

      const { candidateId: _candidateId, contractHash: _contractHash, ...hashInput } =
        candidate;
      const expectedHash = canonicalHash(hashInput);
      if (
        candidate.contractHash !== expectedHash ||
        candidate.candidateId !==
          `governed-send-draft:${expectedHash.slice(-24)}`
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["contractHash"],
          message: "external-send candidate identity must match canonical content",
        });
      }
    });
export type GovernedExternalSendDraftCandidate = z.infer<
  typeof governedExternalSendDraftCandidateSchema
>;

export function buildGovernedExternalSendDraftCandidate(
  input: Omit<
    z.input<typeof governedExternalSendDraftHashInputSchema>,
    | "schemaVersion"
    | "requiredHumanClick"
    | "automaticSendAllowed"
    | "sendPerformed"
    | "dedupeReceipt"
  > & {
    dedupeReceipt: Omit<
      z.input<typeof externalSendDedupeReceiptSchema>,
      "dedupeKey"
    >;
  },
): GovernedExternalSendDraftCandidate {
  const hashInput = governedExternalSendDraftHashInputSchema.parse({
    schemaVersion: GOVERNED_EXTERNAL_SEND_DRAFT_SCHEMA_VERSION,
    ...input,
    dedupeReceipt: {
      ...input.dedupeReceipt,
      dedupeKey: deriveGovernedExternalSendDedupeKey(input),
    },
    requiredHumanClick: true,
    automaticSendAllowed: false,
    sendPerformed: false,
  });
  const contractHash = canonicalHash(hashInput);
  return governedExternalSendDraftCandidateSchema.parse({
    ...hashInput,
    candidateId: `governed-send-draft:${contractHash.slice(-24)}`,
    contractHash,
  });
}

const connectorScopeSchema = z
  .string()
  .trim()
  .min(1)
  .max(191)
  .regex(/^[a-z][a-z0-9._:-]*$/);

const governedConnectorScopeHashInputSchema = z
  .object({
    schemaVersion: z.literal(GOVERNED_CONNECTOR_SCOPE_SCHEMA_VERSION),
    sourceArtifactBundleId: safeRefSchema,
    sourceArtifactReviewId: safeRefSchema,
    reviewState: v3ReviewStateSchema,
    providerRef: safeRefSchema,
    connectorClass: z.enum([
      "crm",
      "messaging",
      "calendar",
      "knowledge",
      "custom_api",
    ]),
    requestedScopes: z.array(connectorScopeSchema).min(1).max(50),
    riskClass: z.enum(["low", "medium", "high", "critical"]),
    rationale: z.array(safeTextSchema).min(1).max(20),
    evidenceRefs: z.array(safeRefSchema).max(100),
    missingEvidence: z.array(safeTextSchema).max(20),
    requiredHumanCapability: z.literal(
      WORKSPACE_CAPABILITIES.MANAGE_CONNECTORS,
    ),
    oauthCompletionAllowed: z.literal(false),
    credentialEntryAllowed: z.literal(false),
    activationAllowed: z.literal(false),
    connectedStateTransitionAllowed: z.literal(false),
  })
  .strict()
  .superRefine((candidate, ctx) => {
    if (new Set(candidate.requestedScopes).size !== candidate.requestedScopes.length) {
      ctx.addIssue({
        code: "custom",
        path: ["requestedScopes"],
        message: "connector scopes must be unique",
      });
    }
    if (new Set(candidate.evidenceRefs).size !== candidate.evidenceRefs.length) {
      ctx.addIssue({
        code: "custom",
        path: ["evidenceRefs"],
        message: "connector evidence refs must be unique",
      });
    }
  });

export const governedConnectorScopeCandidateSchema =
  governedConnectorScopeHashInputSchema
    .extend({
      candidateId: safeRefSchema,
      contractHash: sha256Schema,
    })
    .strict()
    .superRefine((candidate, ctx) => {
      const { candidateId: _candidateId, contractHash: _contractHash, ...hashInput } =
        candidate;
      const expectedHash = canonicalHash(hashInput);
      if (
        candidate.contractHash !== expectedHash ||
        candidate.candidateId !==
          `governed-connector-scope:${expectedHash.slice(-24)}`
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["contractHash"],
          message: "connector candidate identity must match canonical content",
        });
      }
    });
export type GovernedConnectorScopeCandidate = z.infer<
  typeof governedConnectorScopeCandidateSchema
>;

export function buildGovernedConnectorScopeCandidate(
  input: Omit<
    z.input<typeof governedConnectorScopeHashInputSchema>,
    | "schemaVersion"
    | "requiredHumanCapability"
    | "oauthCompletionAllowed"
    | "credentialEntryAllowed"
    | "activationAllowed"
    | "connectedStateTransitionAllowed"
  >,
): GovernedConnectorScopeCandidate {
  const hashInput = governedConnectorScopeHashInputSchema.parse({
    schemaVersion: GOVERNED_CONNECTOR_SCOPE_SCHEMA_VERSION,
    ...input,
    requestedScopes: [...input.requestedScopes].sort(),
    evidenceRefs: [...input.evidenceRefs].sort(),
    requiredHumanCapability: WORKSPACE_CAPABILITIES.MANAGE_CONNECTORS,
    oauthCompletionAllowed: false,
    credentialEntryAllowed: false,
    activationAllowed: false,
    connectedStateTransitionAllowed: false,
  });
  const contractHash = canonicalHash(hashInput);
  return governedConnectorScopeCandidateSchema.parse({
    ...hashInput,
    candidateId: `governed-connector-scope:${contractHash.slice(-24)}`,
    contractHash,
  });
}

const governedMemoryProjectionHashInputSchema = z
  .object({
    schemaVersion: z.literal(GOVERNED_MEMORY_PROJECTION_SCHEMA_VERSION),
    receiptId: safeRefSchema,
    workspaceRef: safeRefSchema,
    sourceArtifactBundleId: safeRefSchema,
    sourceArtifactReviewId: safeRefSchema,
    runtimeSessionId: safeRefSchema,
    memoryCandidateId: safeRefSchema,
    memoryCandidateKey: safeRefSchema,
    candidateStatus: z.literal("pending_verification"),
    projectedAt: timestampSchema,
    memoryPromotionCreated: z.literal(false),
    canonicalMemoryWritten: z.literal(false),
  })
  .strict();

export const governedMemoryCandidateProjectionReceiptSchema =
  governedMemoryProjectionHashInputSchema
    .extend({ receiptHash: sha256Schema })
    .strict()
    .superRefine((receipt, ctx) => {
      const { receiptHash: _receiptHash, ...hashInput } = receipt;
      if (receipt.receiptHash !== canonicalHash(hashInput)) {
        ctx.addIssue({
          code: "custom",
          path: ["receiptHash"],
          message: "memory projection receipt hash must match canonical content",
        });
      }
    });
export type GovernedMemoryCandidateProjectionReceipt = z.infer<
  typeof governedMemoryCandidateProjectionReceiptSchema
>;

export function buildGovernedMemoryCandidateProjectionReceipt(
  input: Omit<
    z.input<typeof governedMemoryProjectionHashInputSchema>,
    "schemaVersion"
  >,
): GovernedMemoryCandidateProjectionReceipt {
  const hashInput = governedMemoryProjectionHashInputSchema.parse({
    schemaVersion: GOVERNED_MEMORY_PROJECTION_SCHEMA_VERSION,
    ...input,
  });
  return governedMemoryCandidateProjectionReceiptSchema.parse({
    ...hashInput,
    receiptHash: canonicalHash(hashInput),
  });
}
