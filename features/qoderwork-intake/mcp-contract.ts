import { z } from "zod";

export const QODERWORK_MCP_SCHEMA_VERSION = "1.0" as const;

export const QODERWORK_MCP_READ_TOOLS = [
  "get_context_pack",
  "list_decision_objects",
  "get_work_packet",
  "get_supervision_summary",
] as const;

export const QODERWORK_MCP_PROPOSAL_TOOLS = [
  "propose_evidence_manifest",
  "propose_draft_artifact",
  "propose_receipt_candidate",
] as const;

export const QODERWORK_MCP_FORBIDDEN_TOOLS = [
  "approve",
  "send",
  "execute",
  "write_crm",
  "promote_memory",
  "change_policy",
  "activate_automation",
] as const;

export const QODERWORK_MCP_ERROR_CODES = [
  "UNAUTHENTICATED",
  "SCOPE_VIOLATION",
  "DATA_CLASSIFICATION_BLOCKED",
  "MALFORMED_REQUEST",
  "EXPIRED",
  "DUPLICATE",
  "CONFLICT",
  "RATE_LIMITED",
  "REVIEW_REQUIRED",
  "SAFE_INTERNAL_ERROR",
] as const;

export type QoderWorkMcpErrorCode = (typeof QODERWORK_MCP_ERROR_CODES)[number];
export type QoderWorkMcpToolName =
  | (typeof QODERWORK_MCP_READ_TOOLS)[number]
  | (typeof QODERWORK_MCP_PROPOSAL_TOOLS)[number];

export type QoderWorkMcpStatus =
  | "accepted"
  | "review_required"
  | "quarantined"
  | "rejected";

export interface QoderWorkMcpResponse {
  readonly status: QoderWorkMcpStatus;
  readonly requestRef: string;
  readonly correlationRef: string;
  readonly acceptedArtifactRefs: readonly string[];
  readonly receiptRef: string;
  readonly warnings: readonly string[];
  readonly nextAllowedSurface:
    | "/dashboard"
    | "/approvals"
    | "/memory"
    | "/settings"
    | "none";
  readonly data?: unknown;
}

export interface QoderWorkMcpToolDefinition {
  readonly name: QoderWorkMcpToolName;
  readonly description: string;
  readonly requiredScope: QoderWorkConnectionScope;
  readonly effect: "read" | "proposal_only";
  readonly inputSchema: Readonly<Record<string, unknown>>;
}

export const QODERWORK_CONNECTION_SCOPES = [
  "context:read",
  "decision:read",
  "work-packet:read",
  "supervision:read",
  "evidence:propose",
  "draft:propose",
  "receipt:propose",
] as const;

export type QoderWorkConnectionScope = (typeof QODERWORK_CONNECTION_SCOPES)[number];

const REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:._-]{2,190}$/;
const HASH_PATTERN = /^sha256:[a-fA-F0-9]{64}$/;
const OPAQUE_SOURCE_PATTERN = /^opaque:[A-Za-z0-9:._-]{4,180}$/;
const RESTRICTED_METADATA_ONLY_SUMMARY = "restricted-metadata-only";
const SENSITIVE_SUMMARY_PATTERNS = [
  /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
  /(?:^|\D)1[3-9]\d{9}(?:\D|$)/,
  /(?:^|\D)\d{17}[\dXx](?:\D|$)/,
  /\bBearer\s+[A-Za-z0-9._~+/-]{12,}/i,
  /\bsk-[A-Za-z0-9_-]{16,}\b/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /(?:^|[\s('"`])\/(?:Users|home|Volumes|private|etc)\//,
  /[A-Za-z]:\\(?:Users|Documents|Desktop)\\/i,
] as const;

const envelopeSchema = z
  .object({
    schemaVersion: z.literal(QODERWORK_MCP_SCHEMA_VERSION),
    correlationRef: z.string().min(3).max(191).regex(REF_PATTERN),
    idempotencyKey: z.string().min(8).max(191).regex(REF_PATTERN),
  })
  .strict();

const objectRefSchema = z
  .object({
    type: z.enum(["opportunity", "meeting", "company", "contact", "commitment", "resource"]),
    id: z.string().min(3).max(191).regex(REF_PATTERN),
  })
  .strict();

const objectReadSchema = envelopeSchema.extend({ objectRef: objectRefSchema }).strict();

const workPacketReadSchema = envelopeSchema
  .extend({
    workPacketRef: z.string().min(3).max(191).regex(REF_PATTERN),
    objectRef: objectRefSchema,
  })
  .strict();

const listDecisionObjectsSchema = envelopeSchema
  .extend({
    objectRef: objectRefSchema,
    statuses: z
      .array(z.enum([
        "DRAFT",
        "EVIDENCE_READY",
        "REVIEW_REQUIRED",
        "OWNER_CONFIRMED",
        "DISPATCHED",
        "REJECTED",
        "DEFERRED",
        "EVIDENCE_REQUESTED",
        "EVALUATED",
        "EXPIRED",
        "SUPERSEDED",
      ]))
      .max(11)
      .optional(),
    limit: z.number().int().min(1).max(50).default(20),
  })
  .strict();

const supervisionReadSchema = envelopeSchema
  .extend({
    objectRef: objectRefSchema,
    limit: z.number().int().min(1).max(50).default(20),
  })
  .strict();

const evidenceManifestSchema = envelopeSchema
  .extend({
    sourceProgramRef: z.string().min(3).max(191).regex(REF_PATTERN),
    observationSourceRef: z.string().min(3).max(191).regex(REF_PATTERN),
    sourceRef: z.string().min(12).max(191).regex(OPAQUE_SOURCE_PATTERN),
    sourceKind: z.enum(["meeting_note", "authorized_directory"]),
    objectRef: objectRefSchema,
    observedAt: z.string().datetime({ offset: true }),
    expiresAt: z.string().datetime({ offset: true }).optional(),
    dataClassification: z.enum(["public", "internal", "confidential", "restricted"]),
    redactionStatus: z.enum(["redacted", "alias_only", "unknown"]),
    approvedModelProfileRef: z.string().min(3).max(191).regex(REF_PATTERN).optional(),
    metadataOnly: z.boolean().optional(),
    summary: z.string().min(1).max(4_000),
    evidenceRefs: z.array(z.string().min(3).max(191).regex(REF_PATTERN)).min(1).max(50),
    contentHash: z.string().regex(HASH_PATTERN),
  })
  .strict();

const draftArtifactSchema = envelopeSchema
  .extend({
    workPacketRef: z.string().min(3).max(191).regex(REF_PATTERN),
    objectRef: objectRefSchema,
    draftKind: z.enum(["customer_follow_up", "internal_follow_up", "information_request"]),
    summary: z.string().min(1).max(4_000),
    evidenceRefs: z.array(z.string().min(3).max(191).regex(REF_PATTERN)).min(1).max(50),
    contentHash: z.string().regex(HASH_PATTERN),
    redactionStatus: z.enum(["redacted", "alias_only"]),
  })
  .strict();

const receiptCandidateSchema = envelopeSchema
  .extend({
    workPacketRef: z.string().min(3).max(191).regex(REF_PATTERN),
    objectRef: objectRefSchema,
    outcome: z.enum(["completed_claimed", "partially_completed_claimed", "blocked", "not_executed"]),
    observedAt: z.string().datetime({ offset: true }),
    summary: z.string().min(1).max(4_000),
    evidenceRefs: z.array(z.string().min(3).max(191).regex(REF_PATTERN)).min(1).max(50),
    contentHash: z.string().regex(HASH_PATTERN),
    redactionStatus: z.enum(["redacted", "alias_only"]),
  })
  .strict();

const TOOL_SCHEMAS: Readonly<Record<QoderWorkMcpToolName, z.ZodType>> = {
  get_context_pack: objectReadSchema,
  list_decision_objects: listDecisionObjectsSchema,
  get_work_packet: workPacketReadSchema,
  get_supervision_summary: supervisionReadSchema,
  propose_evidence_manifest: evidenceManifestSchema,
  propose_draft_artifact: draftArtifactSchema,
  propose_receipt_candidate: receiptCandidateSchema,
};

export const QODERWORK_MCP_TOOLS: readonly QoderWorkMcpToolDefinition[] = [
  tool("get_context_pack", "Read a governed, time-bounded operating context pack.", "context:read", "read"),
  tool("list_decision_objects", "List decision objects visible to this connection.", "decision:read", "read"),
  tool("get_work_packet", "Read an owner-confirmed Work Packet.", "work-packet:read", "read"),
  tool("get_supervision_summary", "Read governed supervision summaries.", "supervision:read", "read"),
  tool("propose_evidence_manifest", "Propose redacted evidence metadata for Helm review.", "evidence:propose", "proposal_only"),
  tool("propose_draft_artifact", "Propose a draft bound to a confirmed Work Packet.", "draft:propose", "proposal_only"),
  tool("propose_receipt_candidate", "Propose an unverified execution receipt candidate.", "receipt:propose", "proposal_only"),
] as const;

function tool(
  name: QoderWorkMcpToolName,
  description: string,
  requiredScope: QoderWorkConnectionScope,
  effect: "read" | "proposal_only",
): QoderWorkMcpToolDefinition {
  return {
    name,
    description,
    requiredScope,
    effect,
    inputSchema: z.toJSONSchema(TOOL_SCHEMAS[name]) as Readonly<Record<string, unknown>>,
  };
}

export type QoderWorkToolCallParseResult =
  | { readonly success: true; readonly toolName: QoderWorkMcpToolName; readonly data: unknown }
  | {
      readonly success: false;
      readonly errorCode: QoderWorkMcpErrorCode;
      readonly safeMessage: string;
    };

export function isQoderWorkMcpToolName(name: string): name is QoderWorkMcpToolName {
  return Object.hasOwn(TOOL_SCHEMAS, name);
}

export function parseQoderWorkToolCall(
  toolName: string,
  input: unknown,
): QoderWorkToolCallParseResult {
  if (!isQoderWorkMcpToolName(toolName)) {
    return {
      success: false,
      errorCode: "SCOPE_VIOLATION",
      safeMessage: "The requested tool is not available to this external agent.",
    };
  }

  if (toolName === "propose_evidence_manifest" && hasAbsoluteSourcePath(input)) {
    return {
      success: false,
      errorCode: "DATA_CLASSIFICATION_BLOCKED",
      safeMessage: "Local absolute paths cannot be submitted; use an opaque source reference.",
    };
  }

  const parsed = TOOL_SCHEMAS[toolName].safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      errorCode: "MALFORMED_REQUEST",
      safeMessage: "The request does not match the closed QoderWork MCP contract.",
    };
  }

  if (hasSensitiveSummary(parsed.data)) {
    return {
      success: false,
      errorCode: "DATA_CLASSIFICATION_BLOCKED",
      safeMessage: "The proposal summary contains sensitive content that must be removed or redacted locally.",
    };
  }

  if (toolName === "propose_evidence_manifest") {
    const proposal = parsed.data as z.infer<typeof evidenceManifestSchema>;
    if (
      proposal.dataClassification === "confidential" &&
      (!proposal.approvedModelProfileRef || proposal.redactionStatus === "unknown")
    ) {
      return {
        success: false,
        errorCode: "DATA_CLASSIFICATION_BLOCKED",
        safeMessage: "Confidential evidence requires an approved model profile and redaction.",
      };
    }
    if (
      proposal.dataClassification === "restricted" &&
      (proposal.metadataOnly !== true || proposal.summary !== RESTRICTED_METADATA_ONLY_SUMMARY)
    ) {
      return {
        success: false,
        errorCode: "DATA_CLASSIFICATION_BLOCKED",
        safeMessage: "Restricted evidence is accepted only as the fixed metadata-only sentinel and a content hash.",
      };
    }
  }

  return { success: true, toolName, data: parsed.data };
}

function hasSensitiveSummary(input: unknown) {
  if (!input || typeof input !== "object") return false;
  const summary = (input as { summary?: unknown }).summary;
  return typeof summary === "string" && SENSITIVE_SUMMARY_PATTERNS.some((pattern) => pattern.test(summary));
}

function hasAbsoluteSourcePath(input: unknown): boolean {
  if (!input || typeof input !== "object") return false;
  const sourceRef = (input as { sourceRef?: unknown }).sourceRef;
  if (typeof sourceRef !== "string") return false;
  return (
    sourceRef.startsWith("/") ||
    sourceRef.startsWith("file://") ||
    /^[A-Za-z]:[\\/]/.test(sourceRef) ||
    sourceRef.startsWith("\\\\")
  );
}
