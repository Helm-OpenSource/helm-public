import preflightFixtureData from "@/evals/intelligence-growth-live-calibration-preflight/live-calibration-preflight-cases.json";
import { INTELLIGENCE_GROWTH_DIMENSION_DESCRIPTORS } from "@/lib/intelligence-growth/contracts";
import type { IntelligenceDimension } from "@/lib/intelligence-growth/types";

export type IntelligenceGrowthLiveCalibrationPreflightRedactionMethod =
  | "alias"
  | "drop"
  | "hash";

export type IntelligenceGrowthLiveCalibrationPreflightRedactionProof = {
  readonly manifestVersion: string;
  readonly redactionMethod: IntelligenceGrowthLiveCalibrationPreflightRedactionMethod;
  readonly redactedFieldCount: number;
  readonly proofRef: string;
  readonly rawDataIncluded: boolean;
};

export type IntelligenceGrowthLiveCalibrationPreflightCalibrationWindow = {
  readonly startsAt: string;
  readonly endsAt: string;
};

export type IntelligenceGrowthLiveCalibrationPreflightPackage = {
  readonly packageId: string;
  readonly candidateId: string;
  readonly dimension: IntelligenceDimension;
  readonly tenantKey: string;
  readonly workspaceId: string;
  readonly redactionProof: IntelligenceGrowthLiveCalibrationPreflightRedactionProof;
  readonly sourceRefs: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly dataProtectionRefs: readonly string[];
  readonly calibrationWindow: IntelligenceGrowthLiveCalibrationPreflightCalibrationWindow;
  readonly ownerAlias: string;
  readonly reviewerAliases: readonly string[];
  readonly ownerReviewerLinkRef: string;
  readonly evidenceCapturedAt: string;
  readonly boundaryNote: string;
  readonly candidateOnly: boolean;
  readonly runtimeAllowed: boolean;
  readonly officialWriteAllowed: boolean;
  readonly autoExecutionAllowed: boolean;
  readonly canonicalMemoryWriteAllowed: boolean;
  readonly promptOrPolicyUpdateAllowed: boolean;
  readonly skillAutoPromotionAllowed: boolean;
  readonly liveCalibrationAuthorityAllowed: boolean;
};

export type IntelligenceGrowthLiveCalibrationPreflightFixture = {
  readonly version: string;
  readonly status: string;
  readonly boundary: string;
  readonly tenantKey: string;
  readonly workspaceId: string;
  readonly cycleWindowKey: string;
  readonly evaluatedAt: string;
  readonly evidenceFreshnessWindowDays: number;
  readonly calibrationWindowMaxDays: number;
  readonly expectedPackageCount: number;
  readonly expectedDimensionCount: number;
  readonly minSourceRefs: number;
  readonly minEvidenceRefs: number;
  readonly minDataProtectionRefs: number;
  readonly minReviewerAliases: number;
  readonly redactionManifestVersion: string;
  readonly packages: readonly IntelligenceGrowthLiveCalibrationPreflightPackage[];
};

export type IntelligenceGrowthLiveCalibrationPreflightEvalOptions = {
  readonly fixture?: IntelligenceGrowthLiveCalibrationPreflightFixture;
};

export type IntelligenceGrowthLiveCalibrationPreflightFailure = {
  readonly source: string;
  readonly reason: string;
};

export type IntelligenceGrowthLiveCalibrationPreflightSummary = {
  readonly passed: boolean;
  readonly version: string;
  readonly tenantKey: string;
  readonly workspaceId: string;
  readonly cycleWindowKey: string;
  readonly evaluatedAt: string;
  readonly totalPackages: number;
  readonly expectedPackageCount: number;
  readonly dimensionCount: number;
  readonly expectedDimensionCount: number;
  readonly duplicatePackageCount: number;
  readonly duplicateDimensionCount: number;
  readonly unknownDimensionCount: number;
  readonly missingRedactionProofCount: number;
  readonly rawDataIndicatorCount: number;
  readonly rawPIIIncidentCount: number;
  readonly rawCredentialIncidentCount: number;
  readonly rdsHostnameLeakCount: number;
  readonly missingSourceRefCount: number;
  readonly missingEvidenceRefCount: number;
  readonly staleEvidenceCount: number;
  readonly missingDataProtectionRefCount: number;
  readonly invalidCalibrationWindowCount: number;
  readonly missingOwnerLinkCount: number;
  readonly missingReviewerLinkCount: number;
  readonly crossTenantScopeCount: number;
  readonly customerTenantUpgradeAttemptCount: number;
  readonly liveCalibrationAuthorityFlagCount: number;
  readonly runtimeAuthorityFlagCount: number;
  readonly officialWriteFlagCount: number;
  readonly autoExecutionFlagCount: number;
  readonly canonicalMemoryWriteFlagCount: number;
  readonly promptOrPolicyUpdateFlagCount: number;
  readonly skillAutoPromotionFlagCount: number;
  readonly candidateOnly: true;
  readonly runtimeAllowed: false;
  readonly officialWriteAllowed: false;
  readonly autoExecutionAllowed: false;
  readonly canonicalMemoryWriteAllowed: false;
  readonly promptOrPolicyUpdateAllowed: false;
  readonly skillAutoPromotionAllowed: false;
  readonly liveCalibrationAuthorityAllowed: false;
  readonly liveCalibrationApprovalImplied: false;
  readonly runtimeAdoptionImplied: false;
  readonly failureCount: number;
  readonly failures: readonly IntelligenceGrowthLiveCalibrationPreflightFailure[];
};

export const DEFAULT_LIVE_CALIBRATION_PREFLIGHT_FIXTURE =
  preflightFixtureData as IntelligenceGrowthLiveCalibrationPreflightFixture;

const HELM_CORE_TENANT_KEY = "helm-business-development";
const HELM_CORE_WORKSPACE_ID = "workspace_helm_business_development";
const EXPECTED_DIMENSIONS: ReadonlySet<IntelligenceDimension> = new Set(
  INTELLIGENCE_GROWTH_DIMENSION_DESCRIPTORS.map((descriptor) => descriptor.id),
);
const VALID_REDACTION_METHODS: ReadonlySet<IntelligenceGrowthLiveCalibrationPreflightRedactionMethod> =
  new Set(["alias", "drop", "hash"]);
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const CN_MOBILE_PATTERN = /\b1[3-9]\d{9}\b/;
const CN_ID_CARD_PATTERN = /\b\d{17}[\dXx]\b/;
const CREDENTIAL_PATTERN = new RegExp(
  `\\b(?:${[
    "credential-test-[a-z0-9-]{12,}",
    `${["s", "k"].join("")}-[A-Za-z0-9_-]{12,}`,
    `${["A", "K", "I", "A"].join("")}[0-9A-Z]{12,}`,
    `${["x", "o", "x"].join("")}[baprs]-[A-Za-z0-9-]{12,}`,
  ].join("|")})\\b`,
);
const RDS_HOST_PATTERN = /\b[a-z0-9.-]+\.(?:mysql\.rds\.aliyuncs|rds\.amazonaws)\.com\b/i;
const MS_PER_DAY = 86_400_000;

export function runIntelligenceGrowthLiveCalibrationPreflightEval(
  options: IntelligenceGrowthLiveCalibrationPreflightEvalOptions = {},
): IntelligenceGrowthLiveCalibrationPreflightSummary {
  const fixture = options.fixture ?? DEFAULT_LIVE_CALIBRATION_PREFLIGHT_FIXTURE;
  const failures: IntelligenceGrowthLiveCalibrationPreflightFailure[] = [];

  const evaluatedAtMs = Date.parse(fixture.evaluatedAt);
  if (Number.isNaN(evaluatedAtMs)) {
    failures.push({ source: "fixture", reason: "evaluated_at_unparseable" });
  }
  if (
    fixture.evidenceFreshnessWindowDays === undefined ||
    !Number.isFinite(fixture.evidenceFreshnessWindowDays) ||
    fixture.evidenceFreshnessWindowDays <= 0
  ) {
    failures.push({ source: "fixture", reason: "evidence_freshness_window_invalid" });
  }
  if (
    fixture.calibrationWindowMaxDays === undefined ||
    !Number.isFinite(fixture.calibrationWindowMaxDays) ||
    fixture.calibrationWindowMaxDays <= 0
  ) {
    failures.push({ source: "fixture", reason: "calibration_window_max_days_invalid" });
  }
  if (fixture.tenantKey !== HELM_CORE_TENANT_KEY) {
    failures.push({ source: "fixture", reason: "fixture_tenant_must_be_helm_core" });
  }
  if (fixture.workspaceId !== HELM_CORE_WORKSPACE_ID) {
    failures.push({ source: "fixture", reason: "fixture_workspace_must_be_helm_core" });
  }
  if (!isMeaningful(fixture.redactionManifestVersion)) {
    failures.push({ source: "fixture", reason: "redaction_manifest_version_missing" });
  }

  const seenPackageIds = new Set<string>();
  const dimensionsSeen = new Set<IntelligenceDimension>();

  let duplicatePackageCount = 0;
  let duplicateDimensionCount = 0;
  let unknownDimensionCount = 0;
  let missingRedactionProofCount = 0;
  let rawDataIndicatorCount = 0;
  let rawPIIIncidentCount = 0;
  let rawCredentialIncidentCount = 0;
  let rdsHostnameLeakCount = 0;
  let missingSourceRefCount = 0;
  let missingEvidenceRefCount = 0;
  let staleEvidenceCount = 0;
  let missingDataProtectionRefCount = 0;
  let invalidCalibrationWindowCount = 0;
  let missingOwnerLinkCount = 0;
  let missingReviewerLinkCount = 0;
  let crossTenantScopeCount = 0;
  let customerTenantUpgradeAttemptCount = 0;
  let liveCalibrationAuthorityFlagCount = 0;
  let runtimeAuthorityFlagCount = 0;
  let officialWriteFlagCount = 0;
  let autoExecutionFlagCount = 0;
  let canonicalMemoryWriteFlagCount = 0;
  let promptOrPolicyUpdateFlagCount = 0;
  let skillAutoPromotionFlagCount = 0;

  for (const pkg of fixture.packages) {
    if (seenPackageIds.has(pkg.packageId)) {
      duplicatePackageCount += 1;
      failures.push({ source: pkg.packageId, reason: "duplicate_package" });
    }
    seenPackageIds.add(pkg.packageId);
    if (!EXPECTED_DIMENSIONS.has(pkg.dimension)) {
      unknownDimensionCount += 1;
      failures.push({
        source: pkg.packageId,
        reason: `unknown_dimension:${String(pkg.dimension)}`,
      });
    } else if (dimensionsSeen.has(pkg.dimension)) {
      duplicateDimensionCount += 1;
      failures.push({ source: pkg.packageId, reason: `duplicate_dimension:${pkg.dimension}` });
    } else {
      dimensionsSeen.add(pkg.dimension);
    }

    if (pkg.tenantKey !== HELM_CORE_TENANT_KEY) {
      crossTenantScopeCount += 1;
      failures.push({ source: pkg.packageId, reason: "cross_tenant_scope" });
      customerTenantUpgradeAttemptCount += 1;
      failures.push({ source: pkg.packageId, reason: "customer_tenant_upgrade_attempt" });
    }
    if (pkg.workspaceId !== HELM_CORE_WORKSPACE_ID) {
      crossTenantScopeCount += 1;
      failures.push({ source: pkg.packageId, reason: "cross_workspace_scope" });
    }

    if (pkg.candidateOnly !== true) {
      failures.push({ source: pkg.packageId, reason: "candidate_only_must_be_true" });
    }
    if (pkg.runtimeAllowed === true) {
      runtimeAuthorityFlagCount += 1;
      failures.push({ source: pkg.packageId, reason: "runtime_authority_flag_true" });
    }
    if (pkg.liveCalibrationAuthorityAllowed === true) {
      liveCalibrationAuthorityFlagCount += 1;
      failures.push({
        source: pkg.packageId,
        reason: "live_calibration_authority_flag_true",
      });
    }
    if (pkg.officialWriteAllowed === true) {
      officialWriteFlagCount += 1;
      failures.push({ source: pkg.packageId, reason: "official_write_flag_true" });
    }
    if (pkg.autoExecutionAllowed === true) {
      autoExecutionFlagCount += 1;
      failures.push({ source: pkg.packageId, reason: "auto_execution_flag_true" });
    }
    if (pkg.canonicalMemoryWriteAllowed === true) {
      canonicalMemoryWriteFlagCount += 1;
      failures.push({ source: pkg.packageId, reason: "canonical_memory_write_flag_true" });
    }
    if (pkg.promptOrPolicyUpdateAllowed === true) {
      promptOrPolicyUpdateFlagCount += 1;
      failures.push({ source: pkg.packageId, reason: "prompt_or_policy_update_flag_true" });
    }
    if (pkg.skillAutoPromotionAllowed === true) {
      skillAutoPromotionFlagCount += 1;
      failures.push({ source: pkg.packageId, reason: "skill_auto_promotion_flag_true" });
    }

    const proof = pkg.redactionProof;
    if (!proof) {
      missingRedactionProofCount += 1;
      failures.push({ source: pkg.packageId, reason: "redaction_proof_missing" });
    } else {
      if (!isMeaningful(proof.manifestVersion)) {
        missingRedactionProofCount += 1;
        failures.push({
          source: pkg.packageId,
          reason: "redaction_proof_manifest_version_missing",
        });
      } else if (proof.manifestVersion !== fixture.redactionManifestVersion) {
        missingRedactionProofCount += 1;
        failures.push({
          source: pkg.packageId,
          reason: "redaction_proof_manifest_version_mismatch",
        });
      }
      if (!VALID_REDACTION_METHODS.has(proof.redactionMethod)) {
        missingRedactionProofCount += 1;
        failures.push({
          source: pkg.packageId,
          reason: `redaction_proof_method_invalid:${String(proof.redactionMethod)}`,
        });
      }
      if (!Number.isInteger(proof.redactedFieldCount) || proof.redactedFieldCount <= 0) {
        missingRedactionProofCount += 1;
        failures.push({
          source: pkg.packageId,
          reason: "redaction_proof_redacted_field_count_invalid",
        });
      }
      if (!isMeaningful(proof.proofRef)) {
        missingRedactionProofCount += 1;
        failures.push({ source: pkg.packageId, reason: "redaction_proof_ref_missing" });
      }
      if (proof.rawDataIncluded !== false) {
        rawDataIndicatorCount += 1;
        failures.push({ source: pkg.packageId, reason: "raw_data_indicator_true" });
      }
    }

    if (pkg.sourceRefs.length < fixture.minSourceRefs) {
      missingSourceRefCount += 1;
      failures.push({
        source: pkg.packageId,
        reason: `source_refs_insufficient:${pkg.sourceRefs.length}`,
      });
    }
    if (pkg.evidenceRefs.length < fixture.minEvidenceRefs) {
      missingEvidenceRefCount += 1;
      failures.push({
        source: pkg.packageId,
        reason: `evidence_refs_insufficient:${pkg.evidenceRefs.length}`,
      });
    }
    if (pkg.dataProtectionRefs.length < fixture.minDataProtectionRefs) {
      missingDataProtectionRefCount += 1;
      failures.push({
        source: pkg.packageId,
        reason: `data_protection_refs_insufficient:${pkg.dataProtectionRefs.length}`,
      });
    }

    if (!isMeaningful(pkg.evidenceCapturedAt)) {
      missingEvidenceRefCount += 1;
      failures.push({ source: pkg.packageId, reason: "evidence_captured_at_missing" });
    } else {
      const capturedMs = Date.parse(pkg.evidenceCapturedAt);
      if (Number.isNaN(capturedMs)) {
        missingEvidenceRefCount += 1;
        failures.push({
          source: pkg.packageId,
          reason: "evidence_captured_at_unparseable",
        });
      } else if (!Number.isNaN(evaluatedAtMs)) {
        const ageMs = evaluatedAtMs - capturedMs;
        const windowMs = fixture.evidenceFreshnessWindowDays * MS_PER_DAY;
        if (ageMs < 0) {
          staleEvidenceCount += 1;
          failures.push({ source: pkg.packageId, reason: "evidence_captured_in_future" });
        } else if (ageMs > windowMs) {
          staleEvidenceCount += 1;
          failures.push({
            source: pkg.packageId,
            reason: `evidence_stale:${Math.round(ageMs / MS_PER_DAY)}d`,
          });
        }
      }
    }

    const window = pkg.calibrationWindow;
    if (!window) {
      invalidCalibrationWindowCount += 1;
      failures.push({ source: pkg.packageId, reason: "calibration_window_missing" });
    } else {
      const startMs = Date.parse(window.startsAt);
      const endMs = Date.parse(window.endsAt);
      if (Number.isNaN(startMs) || Number.isNaN(endMs)) {
        invalidCalibrationWindowCount += 1;
        failures.push({ source: pkg.packageId, reason: "calibration_window_unparseable" });
      } else if (endMs <= startMs) {
        invalidCalibrationWindowCount += 1;
        failures.push({
          source: pkg.packageId,
          reason: "calibration_window_end_not_after_start",
        });
      } else {
        const spanMs = endMs - startMs;
        const maxSpanMs = fixture.calibrationWindowMaxDays * MS_PER_DAY;
        if (spanMs > maxSpanMs) {
          invalidCalibrationWindowCount += 1;
          failures.push({
            source: pkg.packageId,
            reason: `calibration_window_too_long:${Math.round(spanMs / MS_PER_DAY)}d`,
          });
        }
        if (!Number.isNaN(evaluatedAtMs) && endMs > evaluatedAtMs) {
          invalidCalibrationWindowCount += 1;
          failures.push({
            source: pkg.packageId,
            reason: "calibration_window_end_in_future",
          });
        }
      }
    }

    if (!isMeaningful(pkg.ownerAlias)) {
      missingOwnerLinkCount += 1;
      failures.push({ source: pkg.packageId, reason: "owner_alias_missing" });
    }
    if (!isMeaningful(pkg.ownerReviewerLinkRef)) {
      missingOwnerLinkCount += 1;
      failures.push({ source: pkg.packageId, reason: "owner_reviewer_link_ref_missing" });
    }
    if (pkg.reviewerAliases.length < fixture.minReviewerAliases) {
      missingReviewerLinkCount += 1;
      failures.push({
        source: pkg.packageId,
        reason: `reviewer_aliases_insufficient:${pkg.reviewerAliases.length}`,
      });
    }
    for (const reviewer of pkg.reviewerAliases) {
      if (!isMeaningful(reviewer)) {
        missingReviewerLinkCount += 1;
        failures.push({ source: pkg.packageId, reason: "reviewer_alias_blank" });
      }
    }

    const rawArtifactSummary = pushRawArtifactFailures(pkg, failures);
    rawPIIIncidentCount += rawArtifactSummary.rawPIIIncidentCount;
    rawCredentialIncidentCount += rawArtifactSummary.rawCredentialIncidentCount;
    rdsHostnameLeakCount += rawArtifactSummary.rdsHostnameLeakCount;
  }

  if (fixture.packages.length !== fixture.expectedPackageCount) {
    failures.push({
      source: "fixture",
      reason: `package_count_mismatch:${fixture.packages.length}`,
    });
  }
  if (dimensionsSeen.size !== fixture.expectedDimensionCount) {
    failures.push({
      source: "fixture",
      reason: `dimension_count_mismatch:${dimensionsSeen.size}`,
    });
  }
  for (const expectedDimension of EXPECTED_DIMENSIONS) {
    if (!dimensionsSeen.has(expectedDimension)) {
      failures.push({
        source: "fixture",
        reason: `missing_dimension:${expectedDimension}`,
      });
    }
  }

  const uniqueFailures = deduplicateFailures(failures);

  return {
    passed: uniqueFailures.length === 0,
    version: fixture.version,
    tenantKey: fixture.tenantKey,
    workspaceId: fixture.workspaceId,
    cycleWindowKey: fixture.cycleWindowKey,
    evaluatedAt: fixture.evaluatedAt,
    totalPackages: fixture.packages.length,
    expectedPackageCount: fixture.expectedPackageCount,
    dimensionCount: dimensionsSeen.size,
    expectedDimensionCount: fixture.expectedDimensionCount,
    duplicatePackageCount,
    duplicateDimensionCount,
    unknownDimensionCount,
    missingRedactionProofCount,
    rawDataIndicatorCount,
    rawPIIIncidentCount,
    rawCredentialIncidentCount,
    rdsHostnameLeakCount,
    missingSourceRefCount,
    missingEvidenceRefCount,
    staleEvidenceCount,
    missingDataProtectionRefCount,
    invalidCalibrationWindowCount,
    missingOwnerLinkCount,
    missingReviewerLinkCount,
    crossTenantScopeCount,
    customerTenantUpgradeAttemptCount,
    liveCalibrationAuthorityFlagCount,
    runtimeAuthorityFlagCount,
    officialWriteFlagCount,
    autoExecutionFlagCount,
    canonicalMemoryWriteFlagCount,
    promptOrPolicyUpdateFlagCount,
    skillAutoPromotionFlagCount,
    candidateOnly: true,
    runtimeAllowed: false,
    officialWriteAllowed: false,
    autoExecutionAllowed: false,
    canonicalMemoryWriteAllowed: false,
    promptOrPolicyUpdateAllowed: false,
    skillAutoPromotionAllowed: false,
    liveCalibrationAuthorityAllowed: false,
    liveCalibrationApprovalImplied: false,
    runtimeAdoptionImplied: false,
    failureCount: uniqueFailures.length,
    failures: uniqueFailures,
  };
}

function pushRawArtifactFailures(
  pkg: IntelligenceGrowthLiveCalibrationPreflightPackage,
  failures: IntelligenceGrowthLiveCalibrationPreflightFailure[],
): {
  readonly rawPIIIncidentCount: number;
  readonly rawCredentialIncidentCount: number;
  readonly rdsHostnameLeakCount: number;
} {
  let rawPIIIncidentCount = 0;
  let rawCredentialIncidentCount = 0;
  let rdsHostnameLeakCount = 0;
  const candidates = [
    pkg.ownerAlias,
    pkg.ownerReviewerLinkRef,
    pkg.evidenceCapturedAt,
    pkg.boundaryNote,
    pkg.redactionProof?.proofRef ?? "",
    ...pkg.reviewerAliases,
    ...pkg.sourceRefs,
    ...pkg.evidenceRefs,
    ...pkg.dataProtectionRefs,
  ];
  for (const value of candidates) {
    if (typeof value !== "string" || value.length === 0) continue;
    if (EMAIL_PATTERN.test(value)) {
      rawPIIIncidentCount += 1;
      failures.push({ source: pkg.packageId, reason: "raw_email_incident" });
    }
    if (CN_MOBILE_PATTERN.test(value)) {
      rawPIIIncidentCount += 1;
      failures.push({ source: pkg.packageId, reason: "raw_phone_incident" });
    }
    if (CN_ID_CARD_PATTERN.test(value)) {
      rawPIIIncidentCount += 1;
      failures.push({ source: pkg.packageId, reason: "raw_identity_incident" });
    }
    if (CREDENTIAL_PATTERN.test(value)) {
      rawCredentialIncidentCount += 1;
      failures.push({ source: pkg.packageId, reason: "raw_credential_incident" });
    }
    if (RDS_HOST_PATTERN.test(value)) {
      rdsHostnameLeakCount += 1;
      failures.push({ source: pkg.packageId, reason: "rds_hostname_leak" });
    }
  }
  return { rawPIIIncidentCount, rawCredentialIncidentCount, rdsHostnameLeakCount };
}

function isMeaningful(value: string | undefined | null): boolean {
  if (!value) return false;
  return value.trim().length > 0;
}

function deduplicateFailures(
  failures: readonly IntelligenceGrowthLiveCalibrationPreflightFailure[],
): readonly IntelligenceGrowthLiveCalibrationPreflightFailure[] {
  const seen = new Set<string>();
  return failures.filter((failure) => {
    const key = `${failure.source}:${failure.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
