import { z } from "zod";

import {
  ACTION_DISPOSITION_PREFIXES,
  type ExpertOutput,
} from "../expert-capability/contracts";
import {
  type ValidationResult,
  validateJudgementPacket,
} from "../expert-capability/validators";
import { collectUnsafeInputErrors } from "../operating-signal-governance/source-governance";
import {
  BUSINESS_OBJECT_ALIAS_SCHEMA_VERSION,
  BUSINESS_OBJECT_PERSON_ATTRIBUTION_MODES,
  BUSINESS_OBJECT_RESOLUTION_METHODS,
  EVIDENCE_REF_SCHEMA_VERSION,
  EVIDENCE_SENSITIVITY_LEVELS,
  JUDGEMENT_CONFIDENCE_BANDS,
  JUDGEMENT_PACKET_SCHEMA_VERSION,
  PUBLIC_SAFE_REDACTION_STATUSES,
  SIGNAL_EVENT_SCHEMA_VERSION,
  computeBusinessObjectAliasContentHash,
  computeEvidenceRefContentHash,
  computeJudgementPacketContentHash,
  computeSignalEventContentHash,
  type BusinessObjectAlias,
  type BusinessObjectAliasContent,
  type EvidenceRef,
  type EvidenceRefContent,
  type JudgementPacket,
  type JudgementPacketContent,
  type SignalEvent,
  type SignalEventContent,
} from "./contracts";

const SAFE_REF_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,255}$/i;
const SAFE_TOKEN_PATTERN = /^[a-z][a-z0-9._-]{0,127}$/i;
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;
const MAX_INPUT_GRAPH_DEPTH = 64;
const MAX_INPUT_GRAPH_NODES = 10_000;

const safeRefSchema = z.string().min(1).max(256).regex(SAFE_REF_PATTERN);
const safeTokenSchema = z.string().min(1).max(128).regex(SAFE_TOKEN_PATTERN);
const sha256Schema = z.string().regex(SHA256_PATTERN);
const timestampSchema = z.string().datetime({ offset: true });

const LEGACY_SIGNAL_STATE_FIELDS = new Set([
  "transitionFrom",
  "transitionTo",
  "currentBlockerType",
  "blockerSince",
  "awaitingReceiptSince",
  "mergedIntoSignalKey",
  "supersededBySignalKey",
  "revocationReason",
]);

export const evidenceRefSchema = z
  .object({
    schemaVersion: z.literal(EVIDENCE_REF_SCHEMA_VERSION),
    evidenceRef: safeRefSchema,
    tenantScopeRef: safeRefSchema,
    sourceType: safeTokenSchema,
    sourceSnapshotHash: sha256Schema,
    capturedAt: timestampSchema,
    expiresAt: timestampSchema.nullable(),
    sensitivity: z.enum(EVIDENCE_SENSITIVITY_LEVELS),
    redactionStatus: z.enum(PUBLIC_SAFE_REDACTION_STATUSES),
    consentScopeRef: safeRefSchema.nullable(),
    contentIncluded: z.literal(false),
    contentHash: sha256Schema,
  })
  .strict();

export const businessObjectAliasSchema = z
  .object({
    schemaVersion: z.literal(BUSINESS_OBJECT_ALIAS_SCHEMA_VERSION),
    aliasRef: safeRefSchema,
    tenantScopeRef: safeRefSchema,
    objectKind: safeTokenSchema,
    sourceObjectAliasRefs: z.array(safeRefSchema).min(1),
    resolutionMethod: z.enum(BUSINESS_OBJECT_RESOLUTION_METHODS),
    crossTenantProjection: z.literal(false),
    personAttributionMode: z.enum(BUSINESS_OBJECT_PERSON_ATTRIBUTION_MODES),
    createdAt: timestampSchema,
    contentHash: sha256Schema,
  })
  .strict();

export const signalEventSchema = z
  .object({
    schemaVersion: z.literal(SIGNAL_EVENT_SCHEMA_VERSION),
    signalId: safeRefSchema,
    signalKey: safeRefSchema,
    tenantScopeRef: safeRefSchema,
    sourceEnvelopeRef: safeRefSchema,
    sourceRef: safeRefSchema,
    signalFamily: safeTokenSchema,
    observedAt: timestampSchema,
    capturedAt: timestampSchema,
    evidenceRefs: z.array(safeRefSchema),
    evidenceRootHash: sha256Schema,
    businessObjectAliasRef: safeRefSchema.nullable(),
    redactionStatus: z.enum(PUBLIC_SAFE_REDACTION_STATUSES),
    boundaryNote: z.string().min(1).max(1000),
    contentHash: sha256Schema,
  })
  .strict();

export const judgementPacketSchema = z
  .object({
    schemaVersion: z.literal(JUDGEMENT_PACKET_SCHEMA_VERSION),
    packetId: safeRefSchema,
    inputSnapshotRef: sha256Schema,
    expertRevisionId: safeRefSchema,
    signalEventRefs: z.array(safeRefSchema).min(1),
    businessObjectAliasRef: safeRefSchema,
    disposition: safeTokenSchema,
    evidenceRefs: z.array(safeRefSchema).min(1),
    commitmentClass: z.literal("advice"),
    boundaryNote: z.string().min(1).max(1000),
    humanReviewerRequired: z.literal(true),
    forbiddenActionRefs: z.array(safeRefSchema).length(0),
    confidence: z
      .object({
        band: z.enum(JUDGEMENT_CONFIDENCE_BANDS),
        score: z.number().min(0).max(1).nullable(),
        method: z.enum(["deterministic", "model_assisted"]),
        calibrationRef: safeRefSchema.nullable(),
      })
      .strict(),
    createdAt: timestampSchema,
    contentHash: sha256Schema,
  })
  .strict();

function result(errors: string[]): ValidationResult {
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseErrors(parse: z.ZodSafeParseResult<unknown>, prefix: string): string[] {
  if (parse.success) return [];
  return parse.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "root";
    return `${prefix}:${path}:${issue.code}`;
  });
}

function hasValidSha256(value: unknown): value is string {
  return typeof value === "string" && SHA256_PATTERN.test(value);
}

export function validateJsonInputGraph(input: unknown): string[] {
  try {
    const seen = new WeakSet<object>();
    const stack: Array<{ value: unknown; depth: number }> = [{ value: input, depth: 0 }];
    let nodeCount = 0;

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || typeof current.value !== "object" || current.value === null) continue;
      if (current.depth > MAX_INPUT_GRAPH_DEPTH) return ["input_graph_too_deep"];
      if (seen.has(current.value)) return ["input_graph_contains_reused_reference"];
      seen.add(current.value);
      nodeCount += 1;
      if (nodeCount > MAX_INPUT_GRAPH_NODES) return ["input_graph_too_large"];

      const children = Array.isArray(current.value)
        ? current.value
        : Object.values(current.value as Record<string, unknown>);
      if (children.length + nodeCount > MAX_INPUT_GRAPH_NODES) {
        return ["input_graph_too_large"];
      }
      for (const child of children) {
        stack.push({ value: child, depth: current.depth + 1 });
      }
    }
    return [];
  } catch {
    return ["input_graph_not_plain_json"];
  }
}

export function validateEvidenceRef(input: unknown): ValidationResult {
  const graphErrors = validateJsonInputGraph(input);
  if (graphErrors.length > 0) return result(graphErrors);
  const errors = collectUnsafeInputErrors(input);
  if (!isRecord(input)) return result([...errors, "invalid_evidence_ref"]);

  if (!hasValidSha256(input.sourceSnapshotHash)) errors.push("invalid_source_snapshot_hash");
  if (!PUBLIC_SAFE_REDACTION_STATUSES.includes(input.redactionStatus as never)) {
    errors.push("raw_or_private_evidence_forbidden");
  }
  if (input.contentIncluded !== false) errors.push("evidence_content_must_not_be_included");

  const parsed = evidenceRefSchema.safeParse(input);
  errors.push(...parseErrors(parsed, "invalid_evidence_ref"));
  if (parsed.success) {
    const { contentHash, ...content } = parsed.data;
    if (contentHash !== computeEvidenceRefContentHash(content as EvidenceRefContent)) {
      errors.push("evidence_ref_content_hash_mismatch");
    }
  }
  return result(errors);
}

export function validateBusinessObjectAlias(input: unknown): ValidationResult {
  const graphErrors = validateJsonInputGraph(input);
  if (graphErrors.length > 0) return result(graphErrors);
  const errors = collectUnsafeInputErrors(input);
  if (!isRecord(input)) return result([...errors, "invalid_business_object_alias"]);

  if (input.crossTenantProjection !== false) {
    errors.push("cross_tenant_business_object_alias_forbidden");
  }
  if (input.personAttributionMode === "person_level") {
    errors.push("person_level_business_object_alias_forbidden");
  }

  const parsed = businessObjectAliasSchema.safeParse(input);
  errors.push(...parseErrors(parsed, "invalid_business_object_alias"));
  if (parsed.success) {
    const { contentHash, ...content } = parsed.data;
    if (
      contentHash !==
      computeBusinessObjectAliasContentHash(content as BusinessObjectAliasContent)
    ) {
      errors.push("business_object_alias_content_hash_mismatch");
    }
  }
  return result(errors);
}

export function validateSignalEvent(input: unknown): ValidationResult {
  const graphErrors = validateJsonInputGraph(input);
  if (graphErrors.length > 0) return result(graphErrors);
  const errors = collectUnsafeInputErrors(input);
  if (!isRecord(input)) return result([...errors, "invalid_signal_event"]);

  if (Object.keys(input).some((key) => LEGACY_SIGNAL_STATE_FIELDS.has(key))) {
    errors.push("signal_event_contains_authoritative_state");
  }
  if (
    Array.isArray(input.evidenceRefs) &&
    input.evidenceRefs.every((ref): ref is string => typeof ref === "string") &&
    new Set(input.evidenceRefs).size !== input.evidenceRefs.length
  ) {
    errors.push("duplicate_signal_evidence_ref");
  }

  const parsed = signalEventSchema.safeParse(input);
  errors.push(...parseErrors(parsed, "invalid_signal_event"));
  if (parsed.success) {
    const { contentHash, ...content } = parsed.data;
    if (contentHash !== computeSignalEventContentHash(content as SignalEventContent)) {
      errors.push("signal_event_content_hash_mismatch");
    }
  }
  return result(errors);
}

export function validateOperatingHarnessJudgementPacket(input: unknown): ValidationResult {
  const graphErrors = validateJsonInputGraph(input);
  if (graphErrors.length > 0) return result(graphErrors);
  const errors = collectUnsafeInputErrors(input);
  if (!isRecord(input)) return result([...errors, "invalid_judgement_packet"]);

  const { contentHash, ...content } = input;
  if (
    !hasValidSha256(contentHash) ||
    contentHash !== computeJudgementPacketContentHash(content as JudgementPacketContent)
  ) {
    errors.push("judgement_packet_content_hash_mismatch");
  }

  const expertProjection: ExpertOutput = {
    expertRevisionId: String(input.expertRevisionId ?? ""),
    disposition: String(input.disposition ?? ""),
    evidenceRefs: Array.isArray(input.evidenceRefs)
      ? input.evidenceRefs.filter((value): value is string => typeof value === "string")
      : [],
    commitmentClass: input.commitmentClass === "advice" ? "advice" : "commitment",
    boundaryNote: typeof input.boundaryNote === "string" ? input.boundaryNote : null,
    humanReviewerRequired: input.humanReviewerRequired === true,
    forbiddenActionRefs: Array.isArray(input.forbiddenActionRefs)
      ? input.forbiddenActionRefs.filter((value): value is string => typeof value === "string")
      : [],
  };
  errors.push(...validateJudgementPacket(expertProjection).errors);
  const disposition = typeof input.disposition === "string" ? input.disposition : "";
  if (ACTION_DISPOSITION_PREFIXES.some((prefix) => disposition.startsWith(prefix))) {
    errors.push("action_disposition_present");
  }

  const parsed = judgementPacketSchema.safeParse(input);
  errors.push(...parseErrors(parsed, "invalid_judgement_packet"));
  return result(errors);
}

export function assertValidEvidenceRef(input: unknown): asserts input is EvidenceRef {
  const validation = validateEvidenceRef(input);
  if (!validation.ok) throw new Error(validation.errors.join(","));
}

export function assertValidBusinessObjectAlias(
  input: unknown,
): asserts input is BusinessObjectAlias {
  const validation = validateBusinessObjectAlias(input);
  if (!validation.ok) throw new Error(validation.errors.join(","));
}

export function assertValidSignalEvent(input: unknown): asserts input is SignalEvent {
  const validation = validateSignalEvent(input);
  if (!validation.ok) throw new Error(validation.errors.join(","));
}

export function assertValidOperatingHarnessJudgementPacket(
  input: unknown,
): asserts input is JudgementPacket {
  const validation = validateOperatingHarnessJudgementPacket(input);
  if (!validation.ok) throw new Error(validation.errors.join(","));
}
