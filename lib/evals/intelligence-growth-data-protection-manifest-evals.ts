import manifestData from "@/evals/intelligence-growth-data-protection/redaction-manifest.json";
import receiptData from "@/evals/intelligence-growth-data-protection/reviewer-signoff-receipts.json";
import actionOutcomeCases from "@/evals/intelligence-growth/action-outcome/action-outcome-cases.json";
import contextCases from "@/evals/intelligence-growth/context/context-growth-cases.json";
import costModelToolCases from "@/evals/intelligence-growth/cost-model-tool/cost-model-tool-cases.json";
import evalReplayCases from "@/evals/intelligence-growth/eval-replay/eval-replay-growth-cases.json";
import memoryCases from "@/evals/intelligence-growth/memory/memory-growth-cases.json";
import objectSignalCases from "@/evals/intelligence-growth/object-signal/object-signal-growth-cases.json";
import promptPolicyCases from "@/evals/intelligence-growth/prompt-policy/prompt-policy-growth-cases.json";
import routingCases from "@/evals/intelligence-growth/routing/routing-growth-cases.json";
import tenantPersonalizationCases from "@/evals/intelligence-growth/tenant-personalization/tenant-personalization-cases.json";
import workerSkillCases from "@/evals/intelligence-growth/worker-skill/worker-skill-growth-cases.json";
import budgetGateCases from "@/evals/intelligence-growth-budget/budget-gate-cases.json";
import decisionOutcomeCases from "@/evals/intelligence-growth-decision-outcomes/decision-outcome-cases.json";
import evalReplaySnapshotCases from "@/evals/intelligence-growth-eval-replay-snapshots/eval-replay-snapshot-cases.json";
import failureTaxonomyCoverageMapping from "@/evals/intelligence-growth-failure-taxonomy/failure-taxonomy-coverage-mapping.json";
import learningRequeueCases from "@/evals/intelligence-growth-learning-requeue/learning-requeue-cases.json";
import liveCalibrationPreflightCases from "@/evals/intelligence-growth-live-calibration-preflight/live-calibration-preflight-cases.json";
import schemaDriftBaseline from "@/evals/intelligence-growth-schema-drift/schema-drift-baseline.json";
import tenantSignalCases from "@/evals/intelligence-growth-tenant-signals/tenant-signal-cases.json";
import type { IntelligenceDimension } from "@/lib/intelligence-growth/types";

type JsonValue = string | number | boolean | null | JsonValue[] | { readonly [key: string]: JsonValue };

type DataProtectionDataClass =
  | "aggregate_metric"
  | "business_signal_alias"
  | "evidence_alias"
  | "forbidden"
  | "judgement_metadata"
  | "safety_flag"
  | "schema_metadata"
  | "structural"
  | "system_alias"
  | "taxonomy_metadata"
  | "tenant_alias";

type DataProtectionRedactionMethod = "alias" | "drop" | "hash" | "none";
type DataProtectionLawfulBasis = "controlled_trial_operations" | "product_safety_evaluation";
type DataProtectionReviewStatus = "approved" | "pending";

export type IntelligenceGrowthDataProtectionManifestRule = {
  readonly id: string;
  readonly pathPattern: string;
  readonly dataClass: DataProtectionDataClass;
  readonly redactionMethod: DataProtectionRedactionMethod;
  readonly retentionWindowDays: number;
  readonly lawfulBasis: DataProtectionLawfulBasis;
  readonly dpReviewStatus: DataProtectionReviewStatus;
  readonly requiredReviewerRoles: readonly string[];
  readonly receiptId?: string;
};

export type IntelligenceGrowthDataProtectionManifest = {
  readonly manifestVersion: string;
  readonly expectedDimensionCount: number;
  readonly expectedScannedFixtureFileCount: number;
  readonly allowedTenantKeys: readonly string[];
  readonly fieldRules: readonly IntelligenceGrowthDataProtectionManifestRule[];
};

export type IntelligenceGrowthDataProtectionReceipt = {
  readonly receiptId?: string;
  readonly status: DataProtectionReviewStatus;
  readonly fieldRuleIds?: readonly string[];
  readonly signedBy?: string;
  readonly signedAt?: string;
  readonly signature?: string;
};

export type IntelligenceGrowthDataProtectionReceipts = {
  readonly version: string;
  readonly receiptStatus: DataProtectionReviewStatus;
  readonly receipts: readonly IntelligenceGrowthDataProtectionReceipt[];
};

export type IntelligenceGrowthDataProtectionFixtureFile = {
  readonly filePath: string;
  readonly content: JsonValue;
};

export type IntelligenceGrowthDataProtectionManifestEvalOptions = {
  readonly manifest?: IntelligenceGrowthDataProtectionManifest;
  readonly receipts?: IntelligenceGrowthDataProtectionReceipts;
  readonly fixtureFiles?: readonly IntelligenceGrowthDataProtectionFixtureFile[];
};

export type IntelligenceGrowthDataProtectionManifestFailure = {
  readonly source: string;
  readonly reason: string;
};

export type IntelligenceGrowthDataProtectionManifestSummary = {
  readonly passed: boolean;
  readonly manifestVersion: string;
  readonly dimensionCount: number;
  readonly expectedDimensionCount: number;
  readonly scannedFixtureFileCount: number;
  readonly expectedScannedFixtureFileCount: number;
  readonly scannedFieldCount: number;
  readonly manifestCoveragePercent: number;
  readonly unmanifestedFieldCount: number;
  readonly unauthorizedFieldCount: number;
  readonly rawPIIIncidentCount: number;
  readonly rawCredentialIncidentCount: number;
  readonly rdsHostnameLeakCount: number;
  readonly aliasConsistencyMismatchCount: number;
  readonly retentionWindowMissingCount: number;
  readonly lawfulBasisMissingCount: number;
  readonly redactionMethodMissingCount: number;
  readonly dpReviewStatusApprovedWithoutReceiptCount: number;
  readonly signoffReceiptForgeryCount: number;
  readonly crossTenantLeakCount: number;
  readonly runtimeAuthorityFlagCount: number;
  readonly canonicalMemoryWriteFlagCount: number;
  readonly skillPromotionFlagCount: number;
  readonly unauthorizedFlagCount: number;
  readonly candidateOnly: true;
  readonly runtimeAllowed: false;
  readonly officialWriteAllowed: false;
  readonly autoExecutionAllowed: false;
  readonly canonicalMemoryWriteAllowed: false;
  readonly promptOrPolicyUpdateAllowed: false;
  readonly skillAutoPromotionAllowed: false;
  readonly failureCount: number;
  readonly failures: readonly IntelligenceGrowthDataProtectionManifestFailure[];
};

export const DEFAULT_DATA_PROTECTION_MANIFEST =
  manifestData as IntelligenceGrowthDataProtectionManifest;

export const DEFAULT_DATA_PROTECTION_RECEIPTS =
  receiptData as IntelligenceGrowthDataProtectionReceipts;

export const DEFAULT_DATA_PROTECTION_FIXTURE_FILES: readonly IntelligenceGrowthDataProtectionFixtureFile[] = [
  {
    filePath: "evals/intelligence-growth/context/context-growth-cases.json",
    content: contextCases as JsonValue,
  },
  {
    filePath: "evals/intelligence-growth/object-signal/object-signal-growth-cases.json",
    content: objectSignalCases as JsonValue,
  },
  {
    filePath: "evals/intelligence-growth/memory/memory-growth-cases.json",
    content: memoryCases as JsonValue,
  },
  {
    filePath: "evals/intelligence-growth/routing/routing-growth-cases.json",
    content: routingCases as JsonValue,
  },
  {
    filePath: "evals/intelligence-growth/action-outcome/action-outcome-cases.json",
    content: actionOutcomeCases as JsonValue,
  },
  {
    filePath: "evals/intelligence-growth/worker-skill/worker-skill-growth-cases.json",
    content: workerSkillCases as JsonValue,
  },
  {
    filePath: "evals/intelligence-growth/prompt-policy/prompt-policy-growth-cases.json",
    content: promptPolicyCases as JsonValue,
  },
  {
    filePath: "evals/intelligence-growth/eval-replay/eval-replay-growth-cases.json",
    content: evalReplayCases as JsonValue,
  },
  {
    filePath: "evals/intelligence-growth/tenant-personalization/tenant-personalization-cases.json",
    content: tenantPersonalizationCases as JsonValue,
  },
  {
    filePath: "evals/intelligence-growth/cost-model-tool/cost-model-tool-cases.json",
    content: costModelToolCases as JsonValue,
  },
  {
    filePath: "evals/intelligence-growth-tenant-signals/tenant-signal-cases.json",
    content: tenantSignalCases as JsonValue,
  },
  {
    filePath: "evals/intelligence-growth-decision-outcomes/decision-outcome-cases.json",
    content: decisionOutcomeCases as JsonValue,
  },
  {
    filePath: "evals/intelligence-growth-learning-requeue/learning-requeue-cases.json",
    content: learningRequeueCases as JsonValue,
  },
  {
    filePath: "evals/intelligence-growth-budget/budget-gate-cases.json",
    content: budgetGateCases as JsonValue,
  },
  {
    filePath: "evals/intelligence-growth-eval-replay-snapshots/eval-replay-snapshot-cases.json",
    content: evalReplaySnapshotCases as unknown as JsonValue,
  },
  {
    filePath: "evals/intelligence-growth-schema-drift/schema-drift-baseline.json",
    content: schemaDriftBaseline as JsonValue,
  },
  {
    filePath: "evals/intelligence-growth-failure-taxonomy/failure-taxonomy-coverage-mapping.json",
    content: failureTaxonomyCoverageMapping as JsonValue,
  },
  {
    filePath: "evals/intelligence-growth-live-calibration-preflight/live-calibration-preflight-cases.json",
    content: liveCalibrationPreflightCases as unknown as JsonValue,
  },
];

const VALID_REDACTION_METHODS: ReadonlySet<DataProtectionRedactionMethod> = new Set([
  "alias",
  "drop",
  "hash",
  "none",
]);

const VALID_LAWFUL_BASES: ReadonlySet<DataProtectionLawfulBasis> = new Set([
  "controlled_trial_operations",
  "product_safety_evaluation",
]);

const TENANT_ALIAS_PATTERN = /\btenant-[a-z]+\b/g;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const CN_MOBILE_PATTERN = /\b1[3-9]\d{9}\b/;
const CN_ID_CARD_PATTERN = /\b\d{17}[\dXx]\b/;
const CREDENTIAL_PATTERN = new RegExp(`\\b(?:${[
  "credential-test-[a-z0-9-]{12,}",
  `${["s", "k"].join("")}-[A-Za-z0-9_-]{12,}`,
  `${["A", "K", "I", "A"].join("")}[0-9A-Z]{12,}`,
  `${["x", "o", "x"].join("")}[baprs]-[A-Za-z0-9-]{12,}`,
].join("|")})\\b`);
const RDS_HOST_PATTERN = /\b[a-z0-9.-]+\.(?:mysql\.rds\.aliyuncs|rds\.amazonaws)\.com\b/i;

const UNSAFE_TRUE_FLAG_NAMES: ReadonlySet<string> = new Set([
  "autoExecutionAllowed",
  "autoExecutionRequested",
  "canonicalMemoryWriteAllowed",
  "canonicalMemoryWriteRequested",
  "officialWriteAllowed",
  "officialWriteRequested",
  "liveCalibrationAuthorityAllowed",
  "productionChangeRequested",
  "promptOrPolicyUpdateAllowed",
  "promptOrPolicyUpdateRequested",
  "rawDataIncluded",
  "rawCustomerDataIncluded",
  "runtimeAllowed",
  "skillAutoPromotionAllowed",
  "skillAutoPromotionRequested",
]);

const CORE_DIMENSIONS: readonly IntelligenceDimension[] = [
  "context",
  "object_signal",
  "memory",
  "routing",
  "action_outcome",
  "worker_skill",
  "prompt_policy",
  "eval_replay",
  "tenant_personalization",
  "cost_model_tool",
];

export function runIntelligenceGrowthDataProtectionManifestEval(
  options: IntelligenceGrowthDataProtectionManifestEvalOptions = {},
): IntelligenceGrowthDataProtectionManifestSummary {
  const manifest = options.manifest ?? DEFAULT_DATA_PROTECTION_MANIFEST;
  const receipts = options.receipts ?? DEFAULT_DATA_PROTECTION_RECEIPTS;
  const fixtureFiles = options.fixtureFiles ?? DEFAULT_DATA_PROTECTION_FIXTURE_FILES;
  const failures: IntelligenceGrowthDataProtectionManifestFailure[] = [];
  const compiledRules = manifest.fieldRules.map((rule) => ({
    rule,
    regex: compilePathPattern(rule, failures),
  }));
  const allowedTenants = new Set(manifest.allowedTenantKeys);
  const fields = fixtureFiles.flatMap((file) => collectLeafFields(file.content, file.filePath, "$"));
  const dimensions = collectDimensions(fixtureFiles);

  let unauthorizedFieldCount = 0;
  let rawPIIIncidentCount = 0;
  let rawCredentialIncidentCount = 0;
  let rdsHostnameLeakCount = 0;
  let aliasConsistencyMismatchCount = 0;
  let crossTenantLeakCount = 0;
  let runtimeAuthorityFlagCount = 0;
  let canonicalMemoryWriteFlagCount = 0;
  let skillPromotionFlagCount = 0;
  let unauthorizedFlagCount = 0;
  let coveredFieldCount = 0;

  for (const field of fields) {
    const matchedRules = compiledRules
      .filter((entry) => entry.regex && entry.regex.test(field.path))
      .map((entry) => entry.rule);
    if (matchedRules.length === 0) {
      failures.push({ source: field.source, reason: "unmanifested_field" });
    } else {
      coveredFieldCount += 1;
    }
    if (matchedRules.some((rule) => rule.dataClass === "forbidden")) {
      unauthorizedFieldCount += 1;
      failures.push({ source: field.source, reason: "forbidden_field_manifested" });
    }
    if (typeof field.value === "string") {
      rawPIIIncidentCount += pushRawPiiFailures(field.source, field.value, failures);
      rawCredentialIncidentCount += pushPatternFailure(
        field.source,
        field.value,
        CREDENTIAL_PATTERN,
        "raw_credential_incident",
        failures,
      );
      rdsHostnameLeakCount += pushPatternFailure(
        field.source,
        field.value,
        RDS_HOST_PATTERN,
        "rds_hostname_leak",
        failures,
      );
      if (isTenantAliasPath(field.path) && !allowedTenants.has(field.value)) {
        aliasConsistencyMismatchCount += 1;
        failures.push({ source: field.source, reason: "alias_consistency_mismatch" });
      }
      if (isTenantAliasPath(field.path)) {
        crossTenantLeakCount += pushTenantLeakFailures(field.source, field.value, allowedTenants, failures);
      }
    }
    if (field.value === true && UNSAFE_TRUE_FLAG_NAMES.has(lastPathSegment(field.path))) {
      unauthorizedFlagCount += 1;
      failures.push({ source: field.source, reason: "unsafe_authority_flag_true" });
      if (field.path.endsWith(".runtimeAllowed")) {
        runtimeAuthorityFlagCount += 1;
      }
      if (
        field.path.endsWith(".canonicalMemoryWriteAllowed") ||
        field.path.endsWith(".canonicalMemoryWriteRequested")
      ) {
        canonicalMemoryWriteFlagCount += 1;
      }
      if (
        field.path.endsWith(".skillAutoPromotionAllowed") ||
        field.path.endsWith(".skillAutoPromotionRequested")
      ) {
        skillPromotionFlagCount += 1;
      }
    }
  }

  const retentionWindowMissingCount = manifest.fieldRules.filter((rule) =>
    !Number.isInteger(rule.retentionWindowDays) || rule.retentionWindowDays <= 0,
  ).length;
  const lawfulBasisMissingCount = manifest.fieldRules.filter((rule) =>
    !VALID_LAWFUL_BASES.has(rule.lawfulBasis),
  ).length;
  const redactionMethodMissingCount = manifest.fieldRules.filter((rule) =>
    !VALID_REDACTION_METHODS.has(rule.redactionMethod),
  ).length;
  pushManifestRuleFailures(manifest, failures);
  pushCountFailures("retention_window_missing", retentionWindowMissingCount, failures);
  pushCountFailures("lawful_basis_missing", lawfulBasisMissingCount, failures);
  pushCountFailures("redaction_method_missing", redactionMethodMissingCount, failures);

  const signoffReceiptForgeryCount = receipts.receipts.filter(isForgedPendingReceipt).length;
  pushCountFailures("signoff_receipt_forgery", signoffReceiptForgeryCount, failures);
  const dpReviewStatusApprovedWithoutReceiptCount =
    countApprovedRulesWithoutValidReceipt(manifest, receipts, failures);

  if (fixtureFiles.length !== manifest.expectedScannedFixtureFileCount) {
    failures.push({
      source: "fixture_files",
      reason: `fixture_file_count_mismatch:${fixtureFiles.length}`,
    });
  }
  if (dimensions.size !== manifest.expectedDimensionCount) {
    failures.push({
      source: "dimensions",
      reason: `dimension_count_mismatch:${dimensions.size}`,
    });
  }

  const uniqueFailures = deduplicateFailures(failures);
  const unmanifestedFieldCount = fields.length - coveredFieldCount;

  return {
    passed: uniqueFailures.length === 0,
    manifestVersion: manifest.manifestVersion,
    dimensionCount: dimensions.size,
    expectedDimensionCount: manifest.expectedDimensionCount,
    scannedFixtureFileCount: fixtureFiles.length,
    expectedScannedFixtureFileCount: manifest.expectedScannedFixtureFileCount,
    scannedFieldCount: fields.length,
    manifestCoveragePercent: percent(coveredFieldCount, fields.length),
    unmanifestedFieldCount,
    unauthorizedFieldCount,
    rawPIIIncidentCount,
    rawCredentialIncidentCount,
    rdsHostnameLeakCount,
    aliasConsistencyMismatchCount,
    retentionWindowMissingCount,
    lawfulBasisMissingCount,
    redactionMethodMissingCount,
    dpReviewStatusApprovedWithoutReceiptCount,
    signoffReceiptForgeryCount,
    crossTenantLeakCount,
    runtimeAuthorityFlagCount,
    canonicalMemoryWriteFlagCount,
    skillPromotionFlagCount,
    unauthorizedFlagCount,
    candidateOnly: true,
    runtimeAllowed: false,
    officialWriteAllowed: false,
    autoExecutionAllowed: false,
    canonicalMemoryWriteAllowed: false,
    promptOrPolicyUpdateAllowed: false,
    skillAutoPromotionAllowed: false,
    failureCount: uniqueFailures.length,
    failures: uniqueFailures,
  };
}

type LeafField = {
  readonly filePath: string;
  readonly path: string;
  readonly source: string;
  readonly value: string | number | boolean | null;
};

function collectLeafFields(value: JsonValue, filePath: string, path: string): readonly LeafField[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectLeafFields(item, filePath, `${path}[]`));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) =>
      collectLeafFields(item, filePath, `${path}.${key}`),
    );
  }
  return [{ filePath, path, source: `${filePath}:${path}`, value }];
}

function compilePathPattern(
  rule: IntelligenceGrowthDataProtectionManifestRule,
  failures: IntelligenceGrowthDataProtectionManifestFailure[],
): RegExp | null {
  try {
    return new RegExp(rule.pathPattern);
  } catch {
    failures.push({ source: rule.id, reason: "invalid_path_pattern" });
    return null;
  }
}

function collectDimensions(
  fixtureFiles: readonly IntelligenceGrowthDataProtectionFixtureFile[],
): ReadonlySet<string> {
  const dimensions = new Set<string>();
  for (const file of fixtureFiles) {
    if (!file.filePath.startsWith("evals/intelligence-growth/")) continue;
    if (!file.filePath.endsWith("-cases.json")) continue;
    for (const field of collectLeafFields(file.content, file.filePath, "$")) {
      if (field.path.endsWith(".dimension") && typeof field.value === "string") {
        dimensions.add(field.value);
      }
    }
  }
  return new Set(CORE_DIMENSIONS.filter((dimension) => dimensions.has(dimension)));
}

function pushRawPiiFailures(
  source: string,
  value: string,
  failures: IntelligenceGrowthDataProtectionManifestFailure[],
): number {
  let count = 0;
  for (const [pattern, reason] of [
    [EMAIL_PATTERN, "raw_email_incident"],
    [CN_MOBILE_PATTERN, "raw_phone_incident"],
    [CN_ID_CARD_PATTERN, "raw_identity_incident"],
  ] as const) {
    count += pushPatternFailure(source, value, pattern, reason, failures);
  }
  return count;
}

function pushPatternFailure(
  source: string,
  value: string,
  pattern: RegExp,
  reason: string,
  failures: IntelligenceGrowthDataProtectionManifestFailure[],
): number {
  if (!pattern.test(value)) return 0;
  failures.push({ source, reason });
  return 1;
}

function pushTenantLeakFailures(
  source: string,
  value: string,
  allowedTenants: ReadonlySet<string>,
  failures: IntelligenceGrowthDataProtectionManifestFailure[],
): number {
  const matches = value.match(TENANT_ALIAS_PATTERN) ?? [];
  let count = 0;
  for (const alias of matches) {
    if (allowedTenants.has(alias)) continue;
    count += 1;
    failures.push({ source, reason: `cross_tenant_alias:${alias}` });
  }
  return count;
}

function isTenantAliasPath(path: string): boolean {
  return path.endsWith(".workspaceId") ||
    path.endsWith(".tenantKey") ||
    path.endsWith(".tenantAlias");
}

function lastPathSegment(path: string): string {
  return path.split(".").at(-1) ?? path;
}

function pushManifestRuleFailures(
  manifest: IntelligenceGrowthDataProtectionManifest,
  failures: IntelligenceGrowthDataProtectionManifestFailure[],
): void {
  const ruleIds = new Set<string>();
  for (const rule of manifest.fieldRules) {
    if (ruleIds.has(rule.id)) {
      failures.push({ source: rule.id, reason: "duplicate_manifest_rule" });
    }
    ruleIds.add(rule.id);
    if (rule.requiredReviewerRoles.length === 0) {
      failures.push({ source: rule.id, reason: "required_reviewer_missing" });
    }
  }
}

function pushCountFailures(
  reason: string,
  count: number,
  failures: IntelligenceGrowthDataProtectionManifestFailure[],
): void {
  if (count > 0) {
    failures.push({ source: "manifest", reason: `${reason}:${count}` });
  }
}

function isForgedPendingReceipt(receipt: IntelligenceGrowthDataProtectionReceipt): boolean {
  return receipt.status !== "pending" ||
    Boolean(receipt.signature) ||
    Boolean(receipt.signedAt) ||
    Boolean(receipt.signedBy);
}

function countApprovedRulesWithoutValidReceipt(
  manifest: IntelligenceGrowthDataProtectionManifest,
  receipts: IntelligenceGrowthDataProtectionReceipts,
  failures: IntelligenceGrowthDataProtectionManifestFailure[],
): number {
  let count = 0;
  for (const rule of manifest.fieldRules) {
    if (rule.dpReviewStatus !== "approved") continue;
    const receipt = receipts.receipts.find((item) =>
      item.receiptId === rule.receiptId &&
      item.status === "approved" &&
      Boolean(item.signedBy) &&
      Boolean(item.signedAt) &&
      Boolean(item.signature) &&
      (item.fieldRuleIds ?? []).includes(rule.id),
    );
    if (!receipt) {
      count += 1;
      failures.push({ source: rule.id, reason: "approved_without_valid_receipt" });
    }
  }
  return count;
}

function deduplicateFailures(
  failures: readonly IntelligenceGrowthDataProtectionManifestFailure[],
): readonly IntelligenceGrowthDataProtectionManifestFailure[] {
  const seen = new Set<string>();
  return failures.filter((failure) => {
    const key = `${failure.source}:${failure.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function percent(numerator: number, denominator: number): number {
  if (denominator === 0) return 100;
  return Math.round((numerator / denominator) * 100);
}
