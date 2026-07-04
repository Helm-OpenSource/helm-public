import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { runAiShelfTrustCenterContractCheck } from "./check-ai-shelf-trust-center-contract";

let repoRoot: string;

function writeJson(relativePath: string, value: unknown): void {
  const absolutePath = path.join(repoRoot, relativePath);
  mkdirSync(path.dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function packageJson(scripts: Record<string, string>): void {
  writeJson("package.json", { scripts });
}

function alignedFixture(): Record<string, unknown> {
  return {
    fixtureKind: "public_safe_ai_shelf_trust_center_contract",
    fixtureVersion: 1,
    publicSafety: {
      classification: "synthetic_public_safe",
      containsRealCustomer: false,
      containsRealPerson: false,
      containsPrivateDomain: false,
      containsCredential: false,
      containsProductionReceipt: false,
      containsDeploymentAuthorization: false,
      containsPrivatePartnerList: false,
      containsPricing: false,
      containsRevenueShare: false,
      containsResellerTerms: false,
    },
    salesProcessSignal: {
      signalId: "synthetic-sales-process-signal-001",
      sourceType: "synthetic_fixture",
      captureMode: "synthetic",
      consentPosture: "not_required_for_synthetic",
      dataShape: "alias_only",
      aliases: {
        seller: "seller_alias_01",
        buyer: "buyer_alias_01",
        workspace: "workspace_alias_public_demo",
      },
      rawPayloadIncluded: false,
      transcriptIncluded: false,
      audioIncluded: false,
      customerNameIncluded: false,
      personNameIncluded: false,
      privateDomainIncluded: false,
    },
    trustCenterEvidenceMap: {
      consentRef: "docs/product/HELM_TRUST_CENTER_REQUIREMENTS.md#authorization",
      noticeRef: "docs/product/HELM_TRUST_CENTER_REQUIREMENTS.md#notice",
      retentionRef: "docs/legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md",
      withdrawalRef: "docs/product/HELM_TRUST_CENTER_REQUIREMENTS.md#withdrawal",
      auditRef: "npm run check:public-release",
      certStatusRef: "docs/product/HELM_CERTIFIED_ECOSYSTEM_CHECKLIST.md",
      forbiddenActionsRef: "docs/product/HELM_TRUST_CENTER_REQUIREMENTS.md#forbidden-actions",
    },
    aiShelfListingCandidate: {
      listingId: "synthetic-sales-process-diagnostic-assistant",
      displayName: "Synthetic sales-process diagnostic assistant",
      capabilityCategory: "diagnostic_tool",
      problemFit: "Routes alias-only sales-process signals into a review packet.",
      notFor: [
        "reseller program",
        "marketplace listing",
        "pricing or revenue-share offer",
        "covert or unauthorized capture device",
      ],
      inputRequirements: {
        acceptedDataShape: "alias_only",
        minimumAuthorization: "synthetic_only",
      },
      permissionPosture: "synthetic_only",
      dataBoundary: {
        containsPersonalData: false,
        containsCustomerData: false,
        containsAudio: false,
        containsTranscript: false,
        containsCrmSnapshot: false,
        usesExternalApi: false,
      },
      integrationPath: "offline_fixture",
      evidenceRefs: [
        "docs/product/HELM_AI_SHELF_LISTING_CONTRACT.md",
        "docs/product/fixtures/ai-shelf-trust-center-contract.fixture.json",
      ],
      reviewOwner: "helm-core-reviewer",
      certificationStatus: "candidate",
      trustCenterRefs: {
        consentRef: "docs/product/HELM_TRUST_CENTER_REQUIREMENTS.md#authorization",
        noticeRef: "docs/product/HELM_TRUST_CENTER_REQUIREMENTS.md#notice",
        retentionRef: "docs/legal/HELM_PUBLIC_TRIAL_DATA_POLICY_V1.md",
        withdrawalRef: "docs/product/HELM_TRUST_CENTER_REQUIREMENTS.md#withdrawal",
        auditRef: "npm run check:public-release",
        certStatusRef: "docs/product/HELM_CERTIFIED_ECOSYSTEM_CHECKLIST.md",
      },
      rollbackPath: "Remove or hide listing, then route to private review.",
      customerVisibleClaim:
        "Synthetic public reference only; not legal advice, certification approval, reseller authorization, customer deployment readiness, or SLA.",
      commercialBoundary: {
        noReseller: true,
        noMarketplace: true,
        noPricing: true,
        noRevenueShare: true,
        noProcurementApproval: true,
        noSla: true,
      },
    },
    aiDiagnosticRouteRefs: [
      {
        routeId: "synthetic-sales-process-need",
        routeRef: "docs/product/HELM_DIAGNOSTIC_AUTOMATION_EVIDENCE_LAYER_REQUIREMENTS.md",
        status: "review_packet_candidate",
      },
    ],
    grayDeviceRedlines: {
      covertDevice: "blocked",
      disguisedDevice: "blocked",
      modifiedDevice: "blocked",
      remoteControlDevice: "blocked",
      cheatingDevice: "blocked",
      hiddenRecording: "blocked",
      hiddenCollection: "blocked",
      unauthorizedConnector: "blocked",
    },
    forbiddenFlags: {
      containsRealCustomer: false,
      containsRealPerson: false,
      containsPrivateDomain: false,
      containsCredential: false,
      containsProductionReceipt: false,
      containsDeploymentAuthorization: false,
      isReseller: false,
      isMarketplace: false,
      hasPricing: false,
      hasRevenueShare: false,
      hasResellerTerms: false,
      sellsGrayDevice: false,
      recommendsGrayDevice: false,
      sourcesGrayDevice: false,
      listsGrayDevice: false,
      adaptsGrayDevice: false,
      usesCovertRecording: false,
      usesUnauthorizedConnector: false,
      autoProcures: false,
      autoDeploys: false,
    },
  };
}

function seedAlignedRepo(fixture: Record<string, unknown> = alignedFixture()): void {
  writeJson("docs/product/fixtures/ai-shelf-trust-center-contract.fixture.json", fixture);
  packageJson({
    "check:ai-shelf-trust-center-contract":
      "node --import tsx scripts/check-ai-shelf-trust-center-contract.ts",
    "check:boundaries":
      "npm run public:smoke:static && npm run check:ai-shelf-trust-center-contract",
  });
}

describe("check-ai-shelf-trust-center-contract", () => {
  beforeEach(() => {
    repoRoot = mkdtempSync(path.join(os.tmpdir(), "helm-ai-shelf-trust-"));
  });

  afterEach(() => {
    rmSync(repoRoot, { recursive: true, force: true });
  });

  it("passes for a synthetic alias-only AI Shelf and Trust Center fixture", () => {
    seedAlignedRepo();
    expect(runAiShelfTrustCenterContractCheck(repoRoot)).toEqual({
      passed: true,
      fixturePath: "docs/product/fixtures/ai-shelf-trust-center-contract.fixture.json",
      violations: [],
    });
  });

  it("fails closed when a forbidden flag is true", () => {
    const fixture = alignedFixture();
    (fixture.forbiddenFlags as Record<string, boolean>).containsCredential = true;
    seedAlignedRepo(fixture);

    expect(runAiShelfTrustCenterContractCheck(repoRoot).violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: "forbidden-flag:true",
          path: "docs/product/fixtures/ai-shelf-trust-center-contract.fixture.json",
          detail: "forbiddenFlags.containsCredential",
        }),
      ]),
    );
  });

  it("fails when Trust Center evidence refs are incomplete", () => {
    const fixture = alignedFixture();
    delete (fixture.trustCenterEvidenceMap as Record<string, unknown>).certStatusRef;
    seedAlignedRepo(fixture);

    expect(runAiShelfTrustCenterContractCheck(repoRoot).violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: "trust-evidence:missing-ref",
          detail: "trustCenterEvidenceMap.certStatusRef",
        }),
      ]),
    );
  });

  it("fails when commercial boundary stops blocking revenue share", () => {
    const fixture = alignedFixture();
    ((fixture.aiShelfListingCandidate as Record<string, unknown>).commercialBoundary as Record<
      string,
      boolean
    >).noRevenueShare = false;
    seedAlignedRepo(fixture);

    expect(runAiShelfTrustCenterContractCheck(repoRoot).violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: "ai-shelf:commercial-boundary",
          detail: "aiShelfListingCandidate.commercialBoundary.noRevenueShare",
        }),
      ]),
    );
  });

  it("fails when gray-device redlines are not explicitly blocked", () => {
    const fixture = alignedFixture();
    delete (fixture.grayDeviceRedlines as Record<string, unknown>).hiddenRecording;
    seedAlignedRepo(fixture);

    expect(runAiShelfTrustCenterContractCheck(repoRoot).violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: "gray-device-redline:missing-or-open",
          detail: "grayDeviceRedlines.hiddenRecording",
        }),
      ]),
    );
  });

  it("fails when package.json no longer wires the guard into check:boundaries", () => {
    seedAlignedRepo();
    packageJson({
      "check:ai-shelf-trust-center-contract":
        "node --import tsx scripts/check-ai-shelf-trust-center-contract.ts",
      "check:boundaries": "npm run public:smoke:static",
    });

    expect(runAiShelfTrustCenterContractCheck(repoRoot).violations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          rule: "package-script:boundary-chain-missing",
          path: "package.json",
        }),
      ]),
    );
  });
});
