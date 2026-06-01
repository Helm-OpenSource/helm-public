import { describe, expect, it } from "vitest";
import {
  DEFAULT_APPROVAL_READINESS_FIXTURE,
  runIntelligenceGrowthApprovalReadinessEval,
  type IntelligenceGrowthApprovalReadinessFixture,
  type IntelligenceGrowthApprovalReadinessPacket,
  type IntelligenceGrowthApprovalReadinessReceipt,
} from "@/lib/evals/intelligence-growth-approval-readiness-evals";

function cloneFixture(): IntelligenceGrowthApprovalReadinessFixture {
  return JSON.parse(JSON.stringify(DEFAULT_APPROVAL_READINESS_FIXTURE));
}

function withPacket(
  fixture: IntelligenceGrowthApprovalReadinessFixture,
  index: number,
  patch: Partial<IntelligenceGrowthApprovalReadinessPacket>,
): IntelligenceGrowthApprovalReadinessFixture {
  const packets = fixture.packets.map((packet, idx) =>
    idx === index ? { ...packet, ...patch } : packet,
  );
  return { ...fixture, packets };
}

function approvedReceipt(
  packet: IntelligenceGrowthApprovalReadinessPacket,
  override: Partial<IntelligenceGrowthApprovalReadinessReceipt> = {},
): IntelligenceGrowthApprovalReadinessReceipt {
  return {
    receiptId: `${packet.packetId}#receipt-1`,
    packetId: packet.packetId,
    status: "approved",
    founderSignoff: {
      signedBy: "founder-alias",
      signedAt: "2026-05-02T10:00:00.000Z",
      signature: "founder-signature-fixture",
    },
    reviewerSignoffs: [
      {
        role: "engineering_reviewer",
        signedBy: "eng-reviewer-alias",
        signedAt: "2026-05-02T10:01:00.000Z",
        signature: "eng-signature-fixture",
      },
      {
        role: "product_owner",
        signedBy: "product-owner-alias",
        signedAt: "2026-05-02T10:02:00.000Z",
        signature: "product-signature-fixture",
      },
      {
        role: "security_reviewer",
        signedBy: "security-reviewer-alias",
        signedAt: "2026-05-02T10:03:00.000Z",
        signature: "security-signature-fixture",
      },
      {
        role: "operations_reviewer",
        signedBy: "operations-reviewer-alias",
        signedAt: "2026-05-02T10:04:00.000Z",
        signature: "operations-signature-fixture",
      },
      {
        role: "data_protection_reviewer",
        signedBy: "dp-reviewer-alias",
        signedAt: "2026-05-02T10:05:00.000Z",
        signature: "dp-signature-fixture",
      },
    ],
    ...override,
  };
}

describe("runIntelligenceGrowthApprovalReadinessEval", () => {
  it("passes the checked-in candidate-only readiness fixture", () => {
    const summary = runIntelligenceGrowthApprovalReadinessEval();

    expect(summary.passed).toBe(true);
    expect(summary.version).toBe("intelligence-growth-approval-readiness-v1");
    expect(summary.tenantKey).toBe("helm-business-development");
    expect(summary.workspaceId).toBe("workspace_helm_business_development");
    expect(summary.totalPackets).toBe(10);
    expect(summary.expectedPacketCount).toBe(10);
    expect(summary.dimensionCount).toBe(10);
    expect(summary.expectedDimensionCount).toBe(10);
    expect(summary.p1OrAbovePacketCount).toBe(10);
    expect(summary.pendingPacketCount).toBe(10);
    expect(summary.approvedPacketCount).toBe(0);
    expect(summary.blockedPacketCount).toBe(0);
    expect(summary.failureCount).toBe(0);
  });

  it("keeps gate green from implying founder or reviewer approval", () => {
    const summary = runIntelligenceGrowthApprovalReadinessEval();

    expect(summary.candidateOnly).toBe(true);
    expect(summary.runtimeAllowed).toBe(false);
    expect(summary.officialWriteAllowed).toBe(false);
    expect(summary.autoExecutionAllowed).toBe(false);
    expect(summary.canonicalMemoryWriteAllowed).toBe(false);
    expect(summary.promptOrPolicyUpdateAllowed).toBe(false);
    expect(summary.skillAutoPromotionAllowed).toBe(false);
    expect(summary.liveCalibrationAllowed).toBe(false);
    expect(summary.founderOrReviewerApprovalImplied).toBe(false);
  });

  it("fails when a P1 packet drops a required reviewer role", () => {
    const fixture = withPacket(cloneFixture(), 0, {
      reviewerRoles: [
        "engineering_reviewer",
        "product_owner",
        "operations_reviewer",
        "data_protection_reviewer",
      ],
    });

    const summary = runIntelligenceGrowthApprovalReadinessEval({ fixture });

    expect(summary.passed).toBe(false);
    expect(summary.missingReviewerRoleCount).toBeGreaterThan(0);
    expect(
      summary.failures.some((failure) =>
        failure.reason === "missing_reviewer_role:security_reviewer",
      ),
    ).toBe(true);
  });

  it("fails when the fixture-level required reviewer role set is downgraded", () => {
    const fixture: IntelligenceGrowthApprovalReadinessFixture = {
      ...cloneFixture(),
      requiredReviewerRoles: [
        "engineering_reviewer",
        "product_owner",
        "operations_reviewer",
        "data_protection_reviewer",
      ],
    };

    const summary = runIntelligenceGrowthApprovalReadinessEval({ fixture });

    expect(summary.passed).toBe(false);
    expect(
      summary.failures.some((failure) =>
        failure.reason === "fixture_missing_required_reviewer_role:security_reviewer",
      ),
    ).toBe(true);
  });

  it("fails when a P1 packet drops the founder approval requirement", () => {
    const fixture = withPacket(cloneFixture(), 1, { founderApprovalRequired: false });

    const summary = runIntelligenceGrowthApprovalReadinessEval({ fixture });

    expect(summary.passed).toBe(false);
    expect(summary.missingFounderApprovalCount).toBe(1);
    expect(
      summary.failures.some((failure) =>
        failure.reason === "founder_approval_not_required_for_p1_plus",
      ),
    ).toBe(true);
  });

  it("fails when the data-protection pre-review link is missing on a P1 packet", () => {
    const fixture = withPacket(cloneFixture(), 2, {
      dataProtectionPreReviewLinked: false,
    });

    const summary = runIntelligenceGrowthApprovalReadinessEval({ fixture });

    expect(summary.passed).toBe(false);
    expect(summary.missingDataProtectionLinkCount).toBe(1);
    expect(
      summary.failures.some((failure) =>
        failure.reason === "data_protection_pre_review_not_linked",
      ),
    ).toBe(true);
  });

  it("fails when data-protection pre-review is marked approved without a receipt", () => {
    const fixture = withPacket(cloneFixture(), 2, {
      dataProtectionPreReviewStatus: "approved",
      dataProtectionPreReviewReceiptId: null,
    });

    const summary = runIntelligenceGrowthApprovalReadinessEval({ fixture });

    expect(summary.passed).toBe(false);
    expect(summary.missingDataProtectionLinkCount).toBe(1);
    expect(
      summary.failures.some((failure) =>
        failure.reason === "data_protection_approved_without_receipt",
      ),
    ).toBe(true);
  });

  it("fails when a packet flips runtimeAllowed, liveCalibrationAllowed, or write flags true", () => {
    const fixture = withPacket(cloneFixture(), 3, {
      runtimeAllowed: true,
      liveCalibrationAllowed: true,
      officialWriteAllowed: true,
      canonicalMemoryWriteAllowed: true,
      skillAutoPromotionAllowed: true,
    });

    const summary = runIntelligenceGrowthApprovalReadinessEval({ fixture });

    expect(summary.passed).toBe(false);
    expect(summary.runtimeAuthorityFlagCount).toBe(1);
    expect(summary.liveCalibrationFlagCount).toBe(1);
    expect(summary.officialWriteFlagCount).toBe(1);
    expect(summary.canonicalMemoryWriteFlagCount).toBe(1);
    expect(summary.skillAutoPromotionFlagCount).toBe(1);
  });

  it("fails on stale or missing evidence", () => {
    const stale = withPacket(cloneFixture(), 4, {
      evidenceCapturedAt: "2026-01-01T00:00:00.000Z",
    });
    const missing = withPacket(cloneFixture(), 5, { evidenceRefs: [] });

    const staleSummary = runIntelligenceGrowthApprovalReadinessEval({ fixture: stale });
    const missingSummary = runIntelligenceGrowthApprovalReadinessEval({ fixture: missing });

    expect(staleSummary.passed).toBe(false);
    expect(staleSummary.staleEvidenceCount).toBe(1);
    expect(staleSummary.failures.some((failure) => failure.reason.startsWith("evidence_stale:"))).toBe(
      true,
    );

    expect(missingSummary.passed).toBe(false);
    expect(missingSummary.missingEvidenceCount).toBe(1);
    expect(missingSummary.failures.some((failure) => failure.reason === "evidence_refs_missing")).toBe(
      true,
    );
  });

  it("fails when a customer tenant tries to ride a P1 packet to upgrade Helm core", () => {
    const fixture = withPacket(cloneFixture(), 6, {
      tenantKey: "tenant-customer-001",
      workspaceId: "workspace_tenant_customer_001",
    });

    const summary = runIntelligenceGrowthApprovalReadinessEval({ fixture });

    expect(summary.passed).toBe(false);
    expect(summary.crossTenantScopeCount).toBeGreaterThan(0);
    expect(summary.customerTenantUpgradeAttemptCount).toBe(1);
    expect(
      summary.failures.some((failure) => failure.reason === "customer_tenant_upgrade_attempt"),
    ).toBe(true);
  });

  it("fails when a packet is approved but no signed receipt exists", () => {
    const fixture = withPacket(cloneFixture(), 7, {
      approvalStatus: "approved",
      approvalReceiptId: null,
    });

    const summary = runIntelligenceGrowthApprovalReadinessEval({ fixture });

    expect(summary.passed).toBe(false);
    expect(summary.approvedWithoutReceiptCount).toBe(1);
    expect(
      summary.failures.some((failure) => failure.reason === "approved_without_receipt_id"),
    ).toBe(true);
  });

  it("fails when an approved receipt is missing a required reviewer signoff", () => {
    const base = cloneFixture();
    const targetPacket = base.packets[8];
    const receipt = approvedReceipt(targetPacket, {
      reviewerSignoffs: [
        {
          role: "engineering_reviewer",
          signedBy: "eng-reviewer-alias",
          signedAt: "2026-05-02T10:01:00.000Z",
          signature: "eng-signature-fixture",
        },
        {
          role: "product_owner",
          signedBy: "product-owner-alias",
          signedAt: "2026-05-02T10:02:00.000Z",
          signature: "product-signature-fixture",
        },
        {
          role: "security_reviewer",
          signedBy: "security-reviewer-alias",
          signedAt: "2026-05-02T10:03:00.000Z",
          signature: "security-signature-fixture",
        },
        {
          role: "operations_reviewer",
          signedBy: "operations-reviewer-alias",
          signedAt: "2026-05-02T10:04:00.000Z",
          signature: "operations-signature-fixture",
        },
      ],
    });
    const fixture: IntelligenceGrowthApprovalReadinessFixture = {
      ...base,
      packets: base.packets.map((packet, idx) =>
        idx === 8
          ? { ...packet, approvalStatus: "approved", approvalReceiptId: receipt.receiptId }
          : packet,
      ),
      approvalReceipts: [receipt],
    };

    const summary = runIntelligenceGrowthApprovalReadinessEval({ fixture });

    expect(summary.passed).toBe(false);
    expect(summary.approvedWithoutReceiptCount).toBe(1);
    expect(
      summary.failures.some((failure) =>
        failure.reason === "reviewer_signoff_missing:data_protection_reviewer",
      ),
    ).toBe(true);
  });

  it("passes for an approved packet only when a fully-signed receipt covers every required reviewer", () => {
    const base = cloneFixture();
    const targetPacket = base.packets[9];
    const receipt = approvedReceipt(targetPacket);
    const fixture: IntelligenceGrowthApprovalReadinessFixture = {
      ...base,
      packets: base.packets.map((packet, idx) =>
        idx === 9
          ? { ...packet, approvalStatus: "approved", approvalReceiptId: receipt.receiptId }
          : packet,
      ),
      approvalReceipts: [receipt],
    };

    const summary = runIntelligenceGrowthApprovalReadinessEval({ fixture });

    expect(summary.passed).toBe(true);
    expect(summary.approvedPacketCount).toBe(1);
    expect(summary.pendingPacketCount).toBe(9);
    expect(summary.approvedWithoutReceiptCount).toBe(0);
    expect(summary.candidateOnly).toBe(true);
    expect(summary.founderOrReviewerApprovalImplied).toBe(false);
  });

  it("fails when a pending receipt carries forged signoff material", () => {
    const base = cloneFixture();
    const targetPacket = base.packets[0];
    const forged: IntelligenceGrowthApprovalReadinessReceipt = {
      receiptId: `${targetPacket.packetId}#receipt-pending-forged`,
      packetId: targetPacket.packetId,
      status: "pending",
      founderSignoff: {
        signedBy: "founder-alias",
        signedAt: "2026-05-02T10:00:00.000Z",
        signature: "should-not-be-here-on-pending",
      },
    };
    const fixture: IntelligenceGrowthApprovalReadinessFixture = {
      ...base,
      approvalReceipts: [forged],
    };

    const summary = runIntelligenceGrowthApprovalReadinessEval({ fixture });

    expect(summary.passed).toBe(false);
    expect(summary.receiptForgeryCount).toBe(1);
    expect(
      summary.failures.some((failure) => failure.reason === "pending_receipt_forged"),
    ).toBe(true);
  });
});
