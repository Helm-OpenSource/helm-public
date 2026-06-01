import { describe, expect, it } from "vitest";
import {
  DEFAULT_LIVE_CALIBRATION_PREFLIGHT_FIXTURE,
  runIntelligenceGrowthLiveCalibrationPreflightEval,
  type IntelligenceGrowthLiveCalibrationPreflightFixture,
  type IntelligenceGrowthLiveCalibrationPreflightPackage,
} from "@/lib/evals/intelligence-growth-live-calibration-preflight-evals";

function cloneFixture(): IntelligenceGrowthLiveCalibrationPreflightFixture {
  return JSON.parse(JSON.stringify(DEFAULT_LIVE_CALIBRATION_PREFLIGHT_FIXTURE));
}

function withPackage(
  fixture: IntelligenceGrowthLiveCalibrationPreflightFixture,
  index: number,
  patch: Partial<IntelligenceGrowthLiveCalibrationPreflightPackage>,
): IntelligenceGrowthLiveCalibrationPreflightFixture {
  const packages = fixture.packages.map((pkg, idx) =>
    idx === index ? { ...pkg, ...patch } : pkg,
  );
  return { ...fixture, packages };
}

describe("runIntelligenceGrowthLiveCalibrationPreflightEval", () => {
  it("passes the checked-in candidate-only redacted preflight fixture", () => {
    const summary = runIntelligenceGrowthLiveCalibrationPreflightEval();

    expect(summary.passed).toBe(true);
    expect(summary.version).toBe("intelligence-growth-live-calibration-preflight-v1");
    expect(summary.tenantKey).toBe("helm-business-development");
    expect(summary.workspaceId).toBe("workspace_helm_business_development");
    expect(summary.totalPackages).toBe(10);
    expect(summary.expectedPackageCount).toBe(10);
    expect(summary.dimensionCount).toBe(10);
    expect(summary.expectedDimensionCount).toBe(10);
    expect(summary.duplicatePackageCount).toBe(0);
    expect(summary.duplicateDimensionCount).toBe(0);
    expect(summary.unknownDimensionCount).toBe(0);
    expect(summary.rawPIIIncidentCount).toBe(0);
    expect(summary.rawCredentialIncidentCount).toBe(0);
    expect(summary.rdsHostnameLeakCount).toBe(0);
    expect(summary.failureCount).toBe(0);
  });

  it("keeps gate green from implying live calibration approval or runtime adoption", () => {
    const summary = runIntelligenceGrowthLiveCalibrationPreflightEval();

    expect(summary.candidateOnly).toBe(true);
    expect(summary.runtimeAllowed).toBe(false);
    expect(summary.officialWriteAllowed).toBe(false);
    expect(summary.autoExecutionAllowed).toBe(false);
    expect(summary.canonicalMemoryWriteAllowed).toBe(false);
    expect(summary.promptOrPolicyUpdateAllowed).toBe(false);
    expect(summary.skillAutoPromotionAllowed).toBe(false);
    expect(summary.liveCalibrationAuthorityAllowed).toBe(false);
    expect(summary.liveCalibrationApprovalImplied).toBe(false);
    expect(summary.runtimeAdoptionImplied).toBe(false);
  });

  it("fails when redaction proof is missing required fields", () => {
    const fixture = withPackage(cloneFixture(), 0, {
      redactionProof: {
        manifestVersion: "",
        redactionMethod: "alias",
        redactedFieldCount: 0,
        proofRef: "",
        rawDataIncluded: false,
      },
    });

    const summary = runIntelligenceGrowthLiveCalibrationPreflightEval({ fixture });

    expect(summary.passed).toBe(false);
    expect(summary.missingRedactionProofCount).toBeGreaterThan(0);
    expect(
      summary.failures.some((failure) =>
        failure.reason === "redaction_proof_manifest_version_missing",
      ),
    ).toBe(true);
    expect(
      summary.failures.some((failure) => failure.reason === "redaction_proof_ref_missing"),
    ).toBe(true);
    expect(
      summary.failures.some((failure) =>
        failure.reason === "redaction_proof_redacted_field_count_invalid",
      ),
    ).toBe(true);
  });

  it("fails when a package flips the raw-data indicator on", () => {
    const base = cloneFixture();
    const fixture = withPackage(base, 1, {
      redactionProof: {
        ...base.packages[1].redactionProof,
        rawDataIncluded: true,
      },
    });

    const summary = runIntelligenceGrowthLiveCalibrationPreflightEval({ fixture });

    expect(summary.passed).toBe(false);
    expect(summary.rawDataIndicatorCount).toBe(1);
    expect(
      summary.failures.some((failure) => failure.reason === "raw_data_indicator_true"),
    ).toBe(true);
  });

  it("fails on stale evidence outside the freshness window", () => {
    const fixture = withPackage(cloneFixture(), 2, {
      evidenceCapturedAt: "2026-01-01T00:00:00.000Z",
    });

    const summary = runIntelligenceGrowthLiveCalibrationPreflightEval({ fixture });

    expect(summary.passed).toBe(false);
    expect(summary.staleEvidenceCount).toBe(1);
    expect(
      summary.failures.some((failure) => failure.reason.startsWith("evidence_stale:")),
    ).toBe(true);
  });

  it("fails when owner or reviewer linkage is missing", () => {
    const noOwner = withPackage(cloneFixture(), 3, {
      ownerAlias: "",
      ownerReviewerLinkRef: "",
    });
    const noReviewers = withPackage(cloneFixture(), 4, { reviewerAliases: [] });

    const noOwnerSummary = runIntelligenceGrowthLiveCalibrationPreflightEval({
      fixture: noOwner,
    });
    const noReviewersSummary = runIntelligenceGrowthLiveCalibrationPreflightEval({
      fixture: noReviewers,
    });

    expect(noOwnerSummary.passed).toBe(false);
    expect(noOwnerSummary.missingOwnerLinkCount).toBeGreaterThan(0);
    expect(
      noOwnerSummary.failures.some((failure) => failure.reason === "owner_alias_missing"),
    ).toBe(true);
    expect(
      noOwnerSummary.failures.some((failure) =>
        failure.reason === "owner_reviewer_link_ref_missing",
      ),
    ).toBe(true);

    expect(noReviewersSummary.passed).toBe(false);
    expect(noReviewersSummary.missingReviewerLinkCount).toBe(1);
    expect(
      noReviewersSummary.failures.some((failure) =>
        failure.reason === "reviewer_aliases_insufficient:0",
      ),
    ).toBe(true);
  });

  it("fails when a customer tenant tries to ride a preflight package to upgrade Helm core", () => {
    const fixture = withPackage(cloneFixture(), 5, {
      tenantKey: "tenant-customer-001",
      workspaceId: "workspace_tenant_customer_001",
    });

    const summary = runIntelligenceGrowthLiveCalibrationPreflightEval({ fixture });

    expect(summary.passed).toBe(false);
    expect(summary.crossTenantScopeCount).toBeGreaterThan(0);
    expect(summary.customerTenantUpgradeAttemptCount).toBe(1);
    expect(
      summary.failures.some((failure) => failure.reason === "customer_tenant_upgrade_attempt"),
    ).toBe(true);
    expect(
      summary.failures.some((failure) => failure.reason === "cross_tenant_scope"),
    ).toBe(true);
  });

  it("fails when a package flips runtime, write, or live calibration authority flags true", () => {
    const fixture = withPackage(cloneFixture(), 6, {
      runtimeAllowed: true,
      liveCalibrationAuthorityAllowed: true,
      officialWriteAllowed: true,
      autoExecutionAllowed: true,
      canonicalMemoryWriteAllowed: true,
      promptOrPolicyUpdateAllowed: true,
      skillAutoPromotionAllowed: true,
    });

    const summary = runIntelligenceGrowthLiveCalibrationPreflightEval({ fixture });

    expect(summary.passed).toBe(false);
    expect(summary.runtimeAuthorityFlagCount).toBe(1);
    expect(summary.liveCalibrationAuthorityFlagCount).toBe(1);
    expect(summary.officialWriteFlagCount).toBe(1);
    expect(summary.autoExecutionFlagCount).toBe(1);
    expect(summary.canonicalMemoryWriteFlagCount).toBe(1);
    expect(summary.promptOrPolicyUpdateFlagCount).toBe(1);
    expect(summary.skillAutoPromotionFlagCount).toBe(1);
    expect(
      summary.failures.some((failure) =>
        failure.reason === "live_calibration_authority_flag_true",
      ),
    ).toBe(true);
    expect(
      summary.failures.some((failure) => failure.reason === "runtime_authority_flag_true"),
    ).toBe(true);
  });

  it("fails when raw PII or credentials leak into a package field", () => {
    const fixture = withPackage(cloneFixture(), 7, {
      ownerAlias: "person@example.com",
    });

    const summary = runIntelligenceGrowthLiveCalibrationPreflightEval({ fixture });

    expect(summary.passed).toBe(false);
    expect(summary.rawPIIIncidentCount).toBe(1);
    expect(
      summary.failures.some((failure) => failure.reason === "raw_email_incident"),
    ).toBe(true);
  });

  it("fails when a package uses an unknown dimension", () => {
    const fixture = withPackage(cloneFixture(), 0, {
      dimension: "unknown_dimension" as IntelligenceGrowthLiveCalibrationPreflightPackage["dimension"],
    });

    const summary = runIntelligenceGrowthLiveCalibrationPreflightEval({ fixture });

    expect(summary.passed).toBe(false);
    expect(summary.unknownDimensionCount).toBe(1);
    expect(summary.dimensionCount).toBe(9);
    expect(
      summary.failures.some((failure) =>
        failure.reason === "unknown_dimension:unknown_dimension",
      ),
    ).toBe(true);
    expect(
      summary.failures.some((failure) => failure.reason === "missing_dimension:context"),
    ).toBe(true);
  });

  it("fails when the calibration window is invalid or in the future", () => {
    const inverted = withPackage(cloneFixture(), 8, {
      calibrationWindow: {
        startsAt: "2026-05-02T00:00:00.000Z",
        endsAt: "2026-04-22T00:00:00.000Z",
      },
    });
    const future = withPackage(cloneFixture(), 9, {
      calibrationWindow: {
        startsAt: "2026-04-22T00:00:00.000Z",
        endsAt: "2027-04-22T00:00:00.000Z",
      },
    });

    const invertedSummary = runIntelligenceGrowthLiveCalibrationPreflightEval({
      fixture: inverted,
    });
    const futureSummary = runIntelligenceGrowthLiveCalibrationPreflightEval({
      fixture: future,
    });

    expect(invertedSummary.passed).toBe(false);
    expect(invertedSummary.invalidCalibrationWindowCount).toBeGreaterThan(0);
    expect(
      invertedSummary.failures.some((failure) =>
        failure.reason === "calibration_window_end_not_after_start",
      ),
    ).toBe(true);

    expect(futureSummary.passed).toBe(false);
    expect(futureSummary.invalidCalibrationWindowCount).toBeGreaterThan(0);
    expect(
      futureSummary.failures.some((failure) =>
        failure.reason.startsWith("calibration_window_too_long:"),
      ),
    ).toBe(true);
  });
});
