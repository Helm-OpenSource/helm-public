import { z } from "zod";

import { canonicalJson, sha256 } from "../expert-capability/hashing";
import type { ValidationResult } from "../expert-capability/validators";

export const LEGACY_WORLD_MODEL_AUDIT_INPUT_SCHEMA_VERSION =
  "helm.operating-harness.legacy-world-model-audit-input.v1" as const;
export const LEGACY_WORLD_MODEL_AUDIT_RECEIPT_SCHEMA_VERSION =
  "helm.operating-harness.legacy-world-model-audit.v1" as const;

export const LEGACY_WORLD_MODEL_AUDIT_FINDINGS = [
  "legacy_runtime_write_path_exists",
  "legacy_summary_present_private_boundary_required",
  "legacy_snapshot_json_present_private_boundary_required",
  "manual_migration_review_required",
] as const;

export type LegacyWorldModelAuditFinding =
  (typeof LEGACY_WORLD_MODEL_AUDIT_FINDINGS)[number];

export type LegacyWorldModelAuditMetadata = {
  schemaVersion: typeof LEGACY_WORLD_MODEL_AUDIT_INPUT_SCHEMA_VERSION;
  sourceModel: "Prisma.WorldModelSnapshot";
  workspaceAlias: string;
  recordAlias: string;
  observedAt: string;
  summaryPresent: boolean;
  snapshotJsonPresent: boolean;
  rawContentIncluded: false;
  identifiersIncluded: false;
};

export type LegacyWorldModelAuditReceipt = {
  schemaVersion: typeof LEGACY_WORLD_MODEL_AUDIT_RECEIPT_SCHEMA_VERSION;
  sourceModel: "Prisma.WorldModelSnapshot";
  auditOnly: true;
  disposition: "quarantine";
  contentIncluded: false;
  identifiersIncluded: false;
  canonicalImportAllowed: false;
  contextProjectionAllowed: false;
  writebackAllowed: false;
  actionAuthority: "none";
  metadataBindingHash: string;
  findings: LegacyWorldModelAuditFinding[];
  contentHash: string;
};

export type LegacyWorldModelAuditReceiptContent = Omit<
  LegacyWorldModelAuditReceipt,
  "contentHash"
>;

export type LegacyWorldModelAuditResult =
  | { status: "rejected"; errors: string[]; receipt: null }
  | { status: "audited"; errors: []; receipt: LegacyWorldModelAuditReceipt };

const SAFE_REF_PATTERN = /^[a-z0-9][a-z0-9._:/-]{0,255}$/i;
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;
const safeRefSchema = z.string().min(1).max(256).regex(SAFE_REF_PATTERN);
const timestampSchema = z.string().datetime({ offset: true });

const metadataSchema = z
  .object({
    schemaVersion: z.literal(LEGACY_WORLD_MODEL_AUDIT_INPUT_SCHEMA_VERSION),
    sourceModel: z.literal("Prisma.WorldModelSnapshot"),
    workspaceAlias: safeRefSchema,
    recordAlias: safeRefSchema,
    observedAt: timestampSchema,
    summaryPresent: z.boolean(),
    snapshotJsonPresent: z.boolean(),
    rawContentIncluded: z.literal(false),
    identifiersIncluded: z.literal(false),
  })
  .strict();

const auditInputSchema = z
  .object({ expectedWorkspaceAlias: safeRefSchema, metadata: metadataSchema })
  .strict();

const receiptSchema = z
  .object({
    schemaVersion: z.literal(LEGACY_WORLD_MODEL_AUDIT_RECEIPT_SCHEMA_VERSION),
    sourceModel: z.literal("Prisma.WorldModelSnapshot"),
    auditOnly: z.literal(true),
    disposition: z.literal("quarantine"),
    contentIncluded: z.literal(false),
    identifiersIncluded: z.literal(false),
    canonicalImportAllowed: z.literal(false),
    contextProjectionAllowed: z.literal(false),
    writebackAllowed: z.literal(false),
    actionAuthority: z.literal("none"),
    metadataBindingHash: z.string().regex(SHA256_PATTERN),
    findings: z.array(z.enum(LEGACY_WORLD_MODEL_AUDIT_FINDINGS)).min(2),
    contentHash: z.string().regex(SHA256_PATTERN),
  })
  .strict();

const RAW_FIELDS = new Set(["summary", "snapshotJson", "snapshotKey"]);
const IDENTIFIER_FIELDS = new Set([
  "id",
  "workspaceId",
  "runtimeSessionId",
  "meetingId",
  "opportunityId",
  "companyId",
  "customerId",
  "personId",
  "employeeId",
  "ownerId",
  "reviewerId",
]);

function result(errors: string[]): ValidationResult {
  return { ok: errors.length === 0, errors: [...new Set(errors)] };
}

function unsafeLegacyFieldErrors(input: unknown): string[] {
  if (typeof input !== "object" || input === null) return [];
  const errors: string[] = [];
  const seen = new WeakSet<object>();
  const stack: Array<{ value: unknown; depth: number }> = [
    { value: input, depth: 0 },
  ];
  let nodeCount = 0;
  while (stack.length > 0) {
    const entry = stack.pop();
    if (!entry) continue;
    const current = entry.value;
    if (entry.depth > 64) {
      errors.push("legacy_input_graph_too_deep");
      continue;
    }
    if (typeof current !== "object" || current === null) continue;
    if (seen.has(current)) {
      errors.push("legacy_input_graph_contains_reused_reference");
      continue;
    }
    seen.add(current);
    nodeCount += 1;
    if (nodeCount > 10_000) {
      errors.push("legacy_input_graph_too_large");
      break;
    }
    if (Array.isArray(current)) {
      if (current.length + nodeCount > 10_000) {
        errors.push("legacy_input_graph_too_large");
        break;
      }
      for (const value of current) {
        stack.push({ value, depth: entry.depth + 1 });
      }
      continue;
    }
    let fields: Array<[string, unknown]>;
    try {
      fields = Object.entries(current);
    } catch {
      errors.push("legacy_input_graph_not_plain_json");
      continue;
    }
    for (const [key, value] of fields) {
      if (RAW_FIELDS.has(key)) errors.push(`legacy_raw_field_forbidden:${key}`);
      if (IDENTIFIER_FIELDS.has(key)) {
        errors.push(`legacy_identifier_field_forbidden:${key}`);
      }
      stack.push({ value, depth: entry.depth + 1 });
    }
  }
  return [...new Set(errors)];
}

export function computeLegacyWorldModelAuditReceiptContentHash(
  content: LegacyWorldModelAuditReceiptContent,
): string {
  return sha256(canonicalJson(content));
}

export function computeLegacyWorldModelMetadataBindingHash(
  metadata: LegacyWorldModelAuditMetadata,
): string {
  return sha256(
    canonicalJson({
      sourceModel: metadata.sourceModel,
      workspaceAlias: metadata.workspaceAlias,
      recordAlias: metadata.recordAlias,
      observedAt: metadata.observedAt,
      summaryPresent: metadata.summaryPresent,
      snapshotJsonPresent: metadata.snapshotJsonPresent,
    }),
  );
}

export function validateLegacyWorldModelAuditReceipt(
  input: unknown,
): ValidationResult {
  const inputErrors = unsafeLegacyFieldErrors(input);
  if (inputErrors.some((error) => error.startsWith("legacy_input_graph_"))) {
    return result(inputErrors);
  }
  const parsed = receiptSchema.safeParse(input);
  if (!parsed.success) {
    return result([
      ...inputErrors,
      ...parsed.error.issues.map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "root";
        return `invalid_legacy_world_model_audit_receipt:${path}:${issue.code}`;
      }),
    ]);
  }
  const { contentHash, ...content } = parsed.data;
  const errors: string[] = [...inputErrors];
  if (contentHash !== computeLegacyWorldModelAuditReceiptContentHash(content)) {
    errors.push("legacy_world_model_audit_receipt_content_hash_mismatch");
  }
  if (new Set(parsed.data.findings).size !== parsed.data.findings.length) {
    errors.push("duplicate_legacy_world_model_audit_finding");
  }
  for (const required of [
    "legacy_runtime_write_path_exists",
    "manual_migration_review_required",
  ] as const) {
    if (!parsed.data.findings.includes(required)) {
      errors.push(`missing_legacy_world_model_audit_finding:${required}`);
    }
  }
  return result(errors);
}

export function auditLegacyWorldModelMetadata(
  input: unknown,
): LegacyWorldModelAuditResult {
  const errors = unsafeLegacyFieldErrors(input);
  if (errors.some((error) => error.startsWith("legacy_input_graph_"))) {
    return { status: "rejected", errors: [...new Set(errors)], receipt: null };
  }
  const parsed = auditInputSchema.safeParse(input);
  if (!parsed.success) {
    errors.push(
      ...parsed.error.issues.map((issue) => {
        const path = issue.path.length > 0 ? issue.path.join(".") : "root";
        return `invalid_legacy_world_model_audit_input:${path}:${issue.code}`;
      }),
    );
  }
  if (
    parsed.success &&
    parsed.data.expectedWorkspaceAlias !== parsed.data.metadata.workspaceAlias
  ) {
    errors.push("legacy_workspace_alias_mismatch");
  }
  if (errors.length > 0 || !parsed.success) {
    return { status: "rejected", errors: [...new Set(errors)], receipt: null };
  }

  const metadata = parsed.data.metadata;
  const findings: LegacyWorldModelAuditFinding[] = [
    "legacy_runtime_write_path_exists",
    ...(metadata.summaryPresent
      ? (["legacy_summary_present_private_boundary_required"] as const)
      : []),
    ...(metadata.snapshotJsonPresent
      ? (["legacy_snapshot_json_present_private_boundary_required"] as const)
      : []),
    "manual_migration_review_required",
  ];
  const content = {
    schemaVersion: LEGACY_WORLD_MODEL_AUDIT_RECEIPT_SCHEMA_VERSION,
    sourceModel: "Prisma.WorldModelSnapshot" as const,
    auditOnly: true as const,
    disposition: "quarantine" as const,
    contentIncluded: false as const,
    identifiersIncluded: false as const,
    canonicalImportAllowed: false as const,
    contextProjectionAllowed: false as const,
    writebackAllowed: false as const,
    actionAuthority: "none" as const,
    metadataBindingHash: computeLegacyWorldModelMetadataBindingHash(metadata),
    findings,
  };
  return {
    status: "audited",
    errors: [],
    receipt: {
      ...content,
      contentHash: computeLegacyWorldModelAuditReceiptContentHash(content),
    },
  };
}

export function validateLegacyWorldModelAuditReceiptBinding(input: {
  input: unknown;
  receipt: unknown;
}): ValidationResult {
  const receiptValidation = validateLegacyWorldModelAuditReceipt(input.receipt);
  if (!receiptValidation.ok) return receiptValidation;
  const audit = auditLegacyWorldModelMetadata(input.input);
  if (audit.status !== "audited") return result(audit.errors);
  try {
    return canonicalJson(audit.receipt) === canonicalJson(input.receipt)
      ? result([])
      : result(["legacy_world_model_audit_receipt_not_reproducible"]);
  } catch {
    return result(["legacy_world_model_audit_receipt_not_plain_json"]);
  }
}
