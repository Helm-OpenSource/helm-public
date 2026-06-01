import { describe, expect, it } from "vitest";
import {
  DEFAULT_DATA_PROTECTION_FIXTURE_FILES,
  DEFAULT_DATA_PROTECTION_MANIFEST,
  DEFAULT_DATA_PROTECTION_RECEIPTS,
  runIntelligenceGrowthDataProtectionManifestEval,
  type IntelligenceGrowthDataProtectionFixtureFile,
  type IntelligenceGrowthDataProtectionManifest,
  type IntelligenceGrowthDataProtectionReceipts,
} from "@/lib/evals/intelligence-growth-data-protection-manifest-evals";

function cloneManifest(): IntelligenceGrowthDataProtectionManifest {
  return JSON.parse(JSON.stringify(DEFAULT_DATA_PROTECTION_MANIFEST));
}

function cloneReceipts(): IntelligenceGrowthDataProtectionReceipts {
  return JSON.parse(JSON.stringify(DEFAULT_DATA_PROTECTION_RECEIPTS));
}

function withFixture(
  fixture: IntelligenceGrowthDataProtectionFixtureFile,
): readonly IntelligenceGrowthDataProtectionFixtureFile[] {
  return [fixture, ...DEFAULT_DATA_PROTECTION_FIXTURE_FILES.slice(1)];
}

describe("runIntelligenceGrowthDataProtectionManifestEval", () => {
  it("passes with checked-in pending DP pre-review manifest", () => {
    const summary = runIntelligenceGrowthDataProtectionManifestEval();

    expect(summary.passed).toBe(true);
    expect(summary.manifestVersion).toBe("intelligence-growth-data-protection-manifest-v1");
    expect(summary.dimensionCount).toBe(10);
    expect(summary.expectedDimensionCount).toBe(10);
    expect(summary.scannedFixtureFileCount).toBe(18);
    expect(summary.expectedScannedFixtureFileCount).toBe(18);
    expect(summary.scannedFieldCount).toBe(3591);
    expect(summary.scannedFieldCount).toBeGreaterThan(0);
    expect(summary.manifestCoveragePercent).toBe(100);
    expect(summary.unmanifestedFieldCount).toBe(0);
    expect(summary.rawPIIIncidentCount).toBe(0);
    expect(summary.rawCredentialIncidentCount).toBe(0);
    expect(summary.rdsHostnameLeakCount).toBe(0);
    expect(summary.dpReviewStatusApprovedWithoutReceiptCount).toBe(0);
    expect(summary.signoffReceiptForgeryCount).toBe(0);
    expect(summary.crossTenantLeakCount).toBe(0);
    expect(summary.unauthorizedFlagCount).toBe(0);
    expect(summary.failureCount).toBe(0);
  });

  it("keeps the DP manifest gate candidate-only and non-executing", () => {
    const summary = runIntelligenceGrowthDataProtectionManifestEval();

    expect(summary.candidateOnly).toBe(true);
    expect(summary.runtimeAllowed).toBe(false);
    expect(summary.officialWriteAllowed).toBe(false);
    expect(summary.autoExecutionAllowed).toBe(false);
    expect(summary.canonicalMemoryWriteAllowed).toBe(false);
    expect(summary.promptOrPolicyUpdateAllowed).toBe(false);
    expect(summary.skillAutoPromotionAllowed).toBe(false);
  });

  it("fails when a fixture field is not covered by the manifest", () => {
    const fixture = {
      filePath: "evals/intelligence-growth/context/context-growth-cases.json",
      content: [{ id: "ctx-x", dimension: "context", unapprovedRawField: "alias-only" }],
    };

    const summary = runIntelligenceGrowthDataProtectionManifestEval({
      fixtureFiles: withFixture(fixture),
    });

    expect(summary.passed).toBe(false);
    expect(summary.unmanifestedFieldCount).toBeGreaterThan(0);
    expect(summary.failures.some((failure) => failure.reason === "unmanifested_field")).toBe(true);
  });

  it("fails on raw email, phone, credential, and RDS hostname values", () => {
    const fixture = {
      filePath: "evals/intelligence-growth/context/context-growth-cases.json",
      content: [{
        id: "ctx-x",
        dimension: "context",
        description: "Contact tom@example.com or 13800138000 with credential-test-keyvalue-1234567890 at fixture.rds.amazonaws.com",
      }],
    };

    const summary = runIntelligenceGrowthDataProtectionManifestEval({
      fixtureFiles: withFixture(fixture),
    });

    expect(summary.passed).toBe(false);
    expect(summary.rawPIIIncidentCount).toBeGreaterThanOrEqual(2);
    expect(summary.rawCredentialIncidentCount).toBe(1);
    expect(summary.rdsHostnameLeakCount).toBe(1);
  });

  it("fails when a manifest rule is approved without a valid signed receipt", () => {
    const manifest = cloneManifest();
    const [firstRule, ...restRules] = manifest.fieldRules;
    const changed = {
      ...manifest,
      fieldRules: [{ ...firstRule, dpReviewStatus: "approved" as const, receiptId: "receipt-1" }, ...restRules],
    };

    const summary = runIntelligenceGrowthDataProtectionManifestEval({ manifest: changed });

    expect(summary.passed).toBe(false);
    expect(summary.dpReviewStatusApprovedWithoutReceiptCount).toBe(1);
    expect(summary.failures.some((failure) => failure.reason === "approved_without_valid_receipt")).toBe(true);
  });

  it("fails when a pending receipt carries forged approval material", () => {
    const receipts = {
      ...cloneReceipts(),
      receipts: [{
        receiptId: "receipt-1",
        status: "pending" as const,
        fieldRuleIds: ["fixture_metadata"],
        signedBy: "dpo",
        signedAt: "2026-05-02T00:00:00.000Z",
        signature: "not-allowed-in-pending-fixture",
      }],
    };

    const summary = runIntelligenceGrowthDataProtectionManifestEval({ receipts });

    expect(summary.passed).toBe(false);
    expect(summary.signoffReceiptForgeryCount).toBe(1);
    expect(summary.failures.some((failure) => failure.reason === "signoff_receipt_forgery:1")).toBe(true);
  });

  it("fails on a cross-tenant alias outside the allowlist", () => {
    const fixture = {
      filePath: "evals/intelligence-growth/context/context-growth-cases.json",
      content: [{ id: "ctx-x", dimension: "context", input: { workspaceId: "tenant-rogue" } }],
    };

    const summary = runIntelligenceGrowthDataProtectionManifestEval({
      fixtureFiles: withFixture(fixture),
    });

    expect(summary.passed).toBe(false);
    expect(summary.crossTenantLeakCount).toBeGreaterThan(0);
    expect(summary.aliasConsistencyMismatchCount).toBeGreaterThan(0);
  });

  it("fails when a fixture tries to turn on forbidden authority flags", () => {
    const fixture = {
      filePath: "evals/intelligence-growth-budget/budget-gate-cases.json",
      content: {
        version: "test",
        status: "fixture",
        tenantKey: "helm-business-development",
        workspaceId: "workspace_helm_business_development",
        records: [{
          candidateId: "candidate-x",
          dimension: "context",
          runtimeAllowed: true,
          canonicalMemoryWriteAllowed: true,
          skillAutoPromotionAllowed: true,
        }],
      },
    };

    const summary = runIntelligenceGrowthDataProtectionManifestEval({
      fixtureFiles: [...DEFAULT_DATA_PROTECTION_FIXTURE_FILES.slice(0, 13), fixture],
    });

    expect(summary.passed).toBe(false);
    expect(summary.unauthorizedFlagCount).toBe(3);
    expect(summary.runtimeAuthorityFlagCount).toBe(1);
    expect(summary.canonicalMemoryWriteFlagCount).toBe(1);
    expect(summary.skillPromotionFlagCount).toBe(1);
  });
});
