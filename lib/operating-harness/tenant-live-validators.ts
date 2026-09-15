import { z } from "zod";

import type { ValidationResult } from "../expert-capability/validators";
import {
  collectUnsafeInputErrors,
  TENANT_SELF_OBSERVATION_ALLOWED_USES,
  validateOperatingSignalSourceEnvelope,
} from "../operating-signal-governance/source-governance";
import { computeHarnessManifestContentHash, HARNESS_COMPONENT_KINDS, HARNESS_MANIFEST_SCHEMA_VERSION } from "./harness-contracts";
import { componentBindingSchema } from "./harness-validators";
import type { SignalEvent } from "./contracts";
import {
  computeTenantObservationReceiptContentHash,
  TENANT_LIVE_HARNESS_SCOPE,
  TENANT_OBSERVATION_RECEIPT_SCHEMA_VERSION,
} from "./tenant-live-contracts";
import { validateJsonInputGraph } from "./validators";

const SAFE_REF_PATTERN = /^[a-z0-9][a-z0-9._:/-]{0,255}$/i;
const safeRefSchema = z.string().min(1).max(256).regex(SAFE_REF_PATTERN);
const sha256Schema = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const timestampSchema = z.string().datetime({ offset: true });

export const tenantLiveHarnessManifestSchema = z
  .object({
    schemaVersion: z.literal(HARNESS_MANIFEST_SCHEMA_VERSION),
    manifestId: safeRefSchema,
    scope: z.literal(TENANT_LIVE_HARNESS_SCOPE),
    canonicalChainRef: safeRefSchema,
    components: z.array(componentBindingSchema).min(1),
    allowedSourceClasses: z.tuple([z.literal("tenant_self_observation")]),
    intendedUses: z.array(z.enum(TENANT_SELF_OBSERVATION_ALLOWED_USES)).min(1),
    commitmentClass: z.literal("advice"),
    actionAuthority: z.literal("none"),
    humanReviewRequired: z.literal(true),
    automaticPromotionAllowed: z.literal(false),
    externalSendAllowed: z.literal(false),
    writebackAllowed: z.literal(false),
    memoryPromotionAllowed: z.literal(false),
    createdAt: timestampSchema,
    contentHash: sha256Schema,
  })
  .strict();

export const tenantObservationReceiptSchema = z
  .object({
    schemaVersion: z.literal(TENANT_OBSERVATION_RECEIPT_SCHEMA_VERSION),
    observationRunRef: safeRefSchema,
    runStatus: z.enum(["SUCCEEDED", "PARTIAL"]),
    windowStart: timestampSchema,
    windowEnd: timestampSchema,
    observedAt: timestampSchema,
    summaryHash: sha256Schema,
    catalogEntryRef: safeRefSchema,
    authorizationReceiptRef: safeRefSchema,
    connectionReceiptRef: safeRefSchema,
    evidenceRefs: z.array(safeRefSchema).min(1).max(1000),
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
  return parse.error.issues.map((issue) => `${prefix}:${issue.path.length > 0 ? issue.path.join(".") : "root"}:${issue.code}`);
}

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
}

export function validateTenantLiveHarnessManifest(input: unknown): ValidationResult {
  const graphErrors = validateJsonInputGraph(input);
  if (graphErrors.length > 0) return result(graphErrors);
  const errors = collectUnsafeInputErrors(input);
  if (!isRecord(input)) return result([...errors, "invalid_tenant_live_harness_manifest"]);

  const { contentHash, ...content } = input;
  if (typeof contentHash !== "string" || contentHash !== computeHarnessManifestContentHash(content as never)) {
    errors.push("tenant_live_harness_manifest_content_hash_mismatch");
  }
  const parsed = tenantLiveHarnessManifestSchema.safeParse(input);
  errors.push(...parseErrors(parsed, "invalid_tenant_live_harness_manifest"));
  if (!parsed.success) return result(errors);

  const kinds = parsed.data.components.map((component) => component.componentKind);
  for (const duplicate of duplicates(kinds)) errors.push(`duplicate_harness_component:${duplicate}`);
  for (const required of HARNESS_COMPONENT_KINDS) {
    if (!kinds.includes(required)) errors.push(`required_harness_component_missing:${required}`);
  }
  for (const duplicate of duplicates(parsed.data.intendedUses)) {
    errors.push(`duplicate_manifest_intended_use:${duplicate}`);
  }
  return result(errors);
}

export function validateTenantSelfObservationBinding(input: {
  source: unknown;
  observationReceipts: unknown;
  signal: Pick<SignalEvent, "signalId" | "observedAt" | "capturedAt" | "evidenceRefs">;
}): ValidationResult {
  const errors = [...validateOperatingSignalSourceEnvelope(input.source).errors];
  if (!isRecord(input.source)) return result([...errors, "tenant_source_invalid"]);
  if (input.source.sourceClass !== "tenant_self_observation") errors.push("tenant_source_class_required");
  if (input.source.signalId !== input.signal.signalId) errors.push("tenant_source_signal_mismatch");

  const receipts = z.array(z.unknown()).min(1).max(100).safeParse(input.observationReceipts);
  if (!receipts.success) return result([...errors, "tenant_observation_receipts_required"]);

  const covered = new Set<string>();
  const observedAt = Date.parse(input.signal.observedAt);
  const capturedAt = Date.parse(input.signal.capturedAt);
  receipts.data.forEach((raw, index) => {
    const graphErrors = validateJsonInputGraph(raw);
    if (graphErrors.length > 0) {
      errors.push(...graphErrors.map((error) => `tenant_observation_receipt:${index}:${error}`));
      return;
    }
    errors.push(...collectUnsafeInputErrors(raw).map((error) => `tenant_observation_receipt:${index}:${error}`));
    const parsed = tenantObservationReceiptSchema.safeParse(raw);
    errors.push(...parseErrors(parsed, `invalid_tenant_observation_receipt:${index}`));
    if (!parsed.success) return;
    const { contentHash, ...content } = parsed.data;
    if (contentHash !== computeTenantObservationReceiptContentHash(content)) {
      errors.push(`tenant_observation_receipt_content_hash_mismatch:${index}`);
    }
    if (Date.parse(parsed.data.windowStart) > Date.parse(parsed.data.windowEnd)) {
      errors.push(`tenant_observation_receipt_window_reversed:${index}`);
    }
    if (Date.parse(parsed.data.windowStart) > observedAt) {
      errors.push(`tenant_observation_receipt_after_signal:${index}`);
    }
    if (Date.parse(parsed.data.observedAt) > capturedAt) {
      errors.push(`tenant_observation_receipt_observed_after_capture:${index}`);
    }
    for (const ref of parsed.data.evidenceRefs) covered.add(ref);
  });
  for (const ref of input.signal.evidenceRefs) {
    if (!covered.has(ref)) errors.push(`tenant_observation_evidence_uncovered:${ref}`);
  }
  return result(errors);
}
