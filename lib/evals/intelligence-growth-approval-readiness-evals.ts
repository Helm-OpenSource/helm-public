import readinessFixtureData from "@/evals/intelligence-growth-approval-readiness/approval-readiness-cases.json";
import type { IntelligenceDimension } from "@/lib/intelligence-growth/types";

export type IntelligenceGrowthApprovalReadinessTier = "P0" | "P1" | "P2";

export type IntelligenceGrowthApprovalReadinessReviewerRole =
  | "engineering_reviewer"
  | "product_owner"
  | "security_reviewer"
  | "operations_reviewer"
  | "data_protection_reviewer";

export type IntelligenceGrowthApprovalReadinessApprovalStatus =
  | "pending"
  | "approved"
  | "blocked";

export type IntelligenceGrowthApprovalReadinessDpReviewStatus =
  | "pending"
  | "in_review"
  | "approved";

export type IntelligenceGrowthApprovalReadinessReviewerSignoff = {
  readonly role: IntelligenceGrowthApprovalReadinessReviewerRole;
  readonly signedBy: string;
  readonly signedAt: string;
  readonly signature: string;
};

export type IntelligenceGrowthApprovalReadinessFounderSignoff = {
  readonly signedBy: string;
  readonly signedAt: string;
  readonly signature: string;
};

export type IntelligenceGrowthApprovalReadinessReceipt = {
  readonly receiptId: string;
  readonly packetId: string;
  readonly status: IntelligenceGrowthApprovalReadinessApprovalStatus;
  readonly founderSignoff?: IntelligenceGrowthApprovalReadinessFounderSignoff;
  readonly reviewerSignoffs?: readonly IntelligenceGrowthApprovalReadinessReviewerSignoff[];
  readonly dataProtectionPreReviewReceiptId?: string;
};

export type IntelligenceGrowthApprovalReadinessPacket = {
  readonly packetId: string;
  readonly candidateId: string;
  readonly dimension: IntelligenceDimension;
  readonly transitionTier: IntelligenceGrowthApprovalReadinessTier;
  readonly tenantKey: string;
  readonly workspaceId: string;
  readonly founderApprovalRequired: boolean;
  readonly reviewerRoles: readonly IntelligenceGrowthApprovalReadinessReviewerRole[];
  readonly approvalStatus: IntelligenceGrowthApprovalReadinessApprovalStatus;
  readonly approvalReceiptId: string | null;
  readonly dataProtectionPreReviewLinked: boolean;
  readonly dataProtectionPreReviewStatus: IntelligenceGrowthApprovalReadinessDpReviewStatus;
  readonly dataProtectionPreReviewReceiptId: string | null;
  readonly evidenceRefs: readonly string[];
  readonly evidenceCapturedAt: string;
  readonly boundaryNote: string;
  readonly candidateOnly: boolean;
  readonly runtimeAllowed: boolean;
  readonly officialWriteAllowed: boolean;
  readonly autoExecutionAllowed: boolean;
  readonly canonicalMemoryWriteAllowed: boolean;
  readonly promptOrPolicyUpdateAllowed: boolean;
  readonly skillAutoPromotionAllowed: boolean;
  readonly liveCalibrationAllowed: boolean;
};

export type IntelligenceGrowthApprovalReadinessFixture = {
  readonly version: string;
  readonly status: string;
  readonly boundary: string;
  readonly tenantKey: string;
  readonly workspaceId: string;
  readonly cycleWindowKey: string;
  readonly evaluatedAt: string;
  readonly evidenceFreshnessWindowDays: number;
  readonly expectedPacketCount: number;
  readonly expectedDimensionCount: number;
  readonly requiredReviewerRoles: readonly IntelligenceGrowthApprovalReadinessReviewerRole[];
  readonly packets: readonly IntelligenceGrowthApprovalReadinessPacket[];
  readonly approvalReceipts: readonly IntelligenceGrowthApprovalReadinessReceipt[];
};

export type IntelligenceGrowthApprovalReadinessEvalOptions = {
  readonly fixture?: IntelligenceGrowthApprovalReadinessFixture;
};

export type IntelligenceGrowthApprovalReadinessFailure = {
  readonly source: string;
  readonly reason: string;
};

export type IntelligenceGrowthApprovalReadinessSummary = {
  readonly passed: boolean;
  readonly version: string;
  readonly tenantKey: string;
  readonly workspaceId: string;
  readonly cycleWindowKey: string;
  readonly evaluatedAt: string;
  readonly totalPackets: number;
  readonly expectedPacketCount: number;
  readonly dimensionCount: number;
  readonly expectedDimensionCount: number;
  readonly p1OrAbovePacketCount: number;
  readonly pendingPacketCount: number;
  readonly approvedPacketCount: number;
  readonly blockedPacketCount: number;
  readonly missingFounderApprovalCount: number;
  readonly missingReviewerRoleCount: number;
  readonly missingDataProtectionLinkCount: number;
  readonly approvedWithoutReceiptCount: number;
  readonly receiptForgeryCount: number;
  readonly staleEvidenceCount: number;
  readonly missingEvidenceCount: number;
  readonly crossTenantScopeCount: number;
  readonly customerTenantUpgradeAttemptCount: number;
  readonly liveCalibrationFlagCount: number;
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
  readonly liveCalibrationAllowed: false;
  readonly founderOrReviewerApprovalImplied: false;
  readonly failureCount: number;
  readonly failures: readonly IntelligenceGrowthApprovalReadinessFailure[];
};

export const DEFAULT_APPROVAL_READINESS_FIXTURE =
  readinessFixtureData as IntelligenceGrowthApprovalReadinessFixture;

const HELM_CORE_TENANT_KEY = "helm-business-development";
const HELM_CORE_WORKSPACE_ID = "workspace_helm_business_development";
const REQUIRED_REVIEWER_ROLES: readonly IntelligenceGrowthApprovalReadinessReviewerRole[] = [
  "engineering_reviewer",
  "product_owner",
  "security_reviewer",
  "operations_reviewer",
  "data_protection_reviewer",
];
const MIN_EVIDENCE_REFS = 2;
const MIN_REVIEWER_SIGNOFF_DETAIL_LENGTH = 1;
const MS_PER_DAY = 86_400_000;

export function runIntelligenceGrowthApprovalReadinessEval(
  options: IntelligenceGrowthApprovalReadinessEvalOptions = {},
): IntelligenceGrowthApprovalReadinessSummary {
  const fixture = options.fixture ?? DEFAULT_APPROVAL_READINESS_FIXTURE;
  const failures: IntelligenceGrowthApprovalReadinessFailure[] = [];

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
  if (fixture.tenantKey !== HELM_CORE_TENANT_KEY) {
    failures.push({
      source: "fixture",
      reason: "fixture_tenant_must_be_helm_core",
    });
  }
  if (fixture.workspaceId !== HELM_CORE_WORKSPACE_ID) {
    failures.push({
      source: "fixture",
      reason: "fixture_workspace_must_be_helm_core",
    });
  }
  const requiredRoles = new Set<IntelligenceGrowthApprovalReadinessReviewerRole>(
    REQUIRED_REVIEWER_ROLES,
  );
  const fixtureRequiredRoles = new Set<IntelligenceGrowthApprovalReadinessReviewerRole>(
    fixture.requiredReviewerRoles,
  );
  for (const requiredRole of REQUIRED_REVIEWER_ROLES) {
    if (!fixtureRequiredRoles.has(requiredRole)) {
      failures.push({
        source: "fixture",
        reason: `fixture_missing_required_reviewer_role:${requiredRole}`,
      });
    }
  }
  for (const fixtureRole of fixture.requiredReviewerRoles) {
    if (!requiredRoles.has(fixtureRole)) {
      failures.push({
        source: "fixture",
        reason: `fixture_unknown_required_reviewer_role:${fixtureRole}`,
      });
    }
  }
  const seenPacketIds = new Set<string>();
  const dimensionsSeen = new Set<IntelligenceDimension>();

  let p1OrAbovePacketCount = 0;
  let pendingPacketCount = 0;
  let approvedPacketCount = 0;
  let blockedPacketCount = 0;
  let missingFounderApprovalCount = 0;
  let missingReviewerRoleCount = 0;
  let missingDataProtectionLinkCount = 0;
  let approvedWithoutReceiptCount = 0;
  let receiptForgeryCount = 0;
  let staleEvidenceCount = 0;
  let missingEvidenceCount = 0;
  let crossTenantScopeCount = 0;
  let customerTenantUpgradeAttemptCount = 0;
  let liveCalibrationFlagCount = 0;
  let runtimeAuthorityFlagCount = 0;
  let officialWriteFlagCount = 0;
  let autoExecutionFlagCount = 0;
  let canonicalMemoryWriteFlagCount = 0;
  let promptOrPolicyUpdateFlagCount = 0;
  let skillAutoPromotionFlagCount = 0;

  for (const packet of fixture.packets) {
    if (seenPacketIds.has(packet.packetId)) {
      failures.push({ source: packet.packetId, reason: "duplicate_packet" });
    }
    seenPacketIds.add(packet.packetId);
    dimensionsSeen.add(packet.dimension);

    switch (packet.approvalStatus) {
      case "pending":
        pendingPacketCount += 1;
        break;
      case "approved":
        approvedPacketCount += 1;
        break;
      case "blocked":
        blockedPacketCount += 1;
        break;
    }

    const isP1OrAbove = packet.transitionTier === "P1" || packet.transitionTier === "P2";
    if (isP1OrAbove) {
      p1OrAbovePacketCount += 1;
    }

    if (packet.tenantKey !== HELM_CORE_TENANT_KEY) {
      crossTenantScopeCount += 1;
      failures.push({ source: packet.packetId, reason: "cross_tenant_scope" });
      if (packet.transitionTier === "P1" || packet.transitionTier === "P2") {
        customerTenantUpgradeAttemptCount += 1;
        failures.push({
          source: packet.packetId,
          reason: "customer_tenant_upgrade_attempt",
        });
      }
    }
    if (packet.workspaceId !== HELM_CORE_WORKSPACE_ID) {
      crossTenantScopeCount += 1;
      failures.push({ source: packet.packetId, reason: "cross_workspace_scope" });
    }

    if (packet.runtimeAllowed === true) {
      runtimeAuthorityFlagCount += 1;
      failures.push({ source: packet.packetId, reason: "runtime_authority_flag_true" });
    }
    if (packet.liveCalibrationAllowed === true) {
      liveCalibrationFlagCount += 1;
      failures.push({ source: packet.packetId, reason: "live_calibration_flag_true" });
    }
    if (packet.officialWriteAllowed === true) {
      officialWriteFlagCount += 1;
      failures.push({ source: packet.packetId, reason: "official_write_flag_true" });
    }
    if (packet.autoExecutionAllowed === true) {
      autoExecutionFlagCount += 1;
      failures.push({ source: packet.packetId, reason: "auto_execution_flag_true" });
    }
    if (packet.canonicalMemoryWriteAllowed === true) {
      canonicalMemoryWriteFlagCount += 1;
      failures.push({
        source: packet.packetId,
        reason: "canonical_memory_write_flag_true",
      });
    }
    if (packet.promptOrPolicyUpdateAllowed === true) {
      promptOrPolicyUpdateFlagCount += 1;
      failures.push({
        source: packet.packetId,
        reason: "prompt_or_policy_update_flag_true",
      });
    }
    if (packet.skillAutoPromotionAllowed === true) {
      skillAutoPromotionFlagCount += 1;
      failures.push({ source: packet.packetId, reason: "skill_auto_promotion_flag_true" });
    }
    if (packet.candidateOnly !== true) {
      failures.push({ source: packet.packetId, reason: "candidate_only_must_be_true" });
    }

    if (isP1OrAbove) {
      if (packet.founderApprovalRequired !== true) {
        missingFounderApprovalCount += 1;
        failures.push({
          source: packet.packetId,
          reason: "founder_approval_not_required_for_p1_plus",
        });
      }
      const roleSet = new Set<IntelligenceGrowthApprovalReadinessReviewerRole>(
        packet.reviewerRoles,
      );
      for (const requiredRole of requiredRoles) {
        if (!roleSet.has(requiredRole)) {
          missingReviewerRoleCount += 1;
          failures.push({
            source: packet.packetId,
            reason: `missing_reviewer_role:${requiredRole}`,
          });
        }
      }
      if (packet.dataProtectionPreReviewLinked !== true) {
        missingDataProtectionLinkCount += 1;
        failures.push({
          source: packet.packetId,
          reason: "data_protection_pre_review_not_linked",
        });
      }
      if (
        packet.dataProtectionPreReviewStatus === "approved" &&
        !packet.dataProtectionPreReviewReceiptId
      ) {
        missingDataProtectionLinkCount += 1;
        failures.push({
          source: packet.packetId,
          reason: "data_protection_approved_without_receipt",
        });
      }
    }

    if (packet.evidenceRefs.length === 0) {
      missingEvidenceCount += 1;
      failures.push({ source: packet.packetId, reason: "evidence_refs_missing" });
    } else if (packet.evidenceRefs.length < MIN_EVIDENCE_REFS) {
      missingEvidenceCount += 1;
      failures.push({
        source: packet.packetId,
        reason: `evidence_refs_insufficient:${packet.evidenceRefs.length}`,
      });
    }
    if (packet.evidenceCapturedAt.length === 0) {
      missingEvidenceCount += 1;
      failures.push({ source: packet.packetId, reason: "evidence_captured_at_missing" });
    } else {
      const capturedMs = Date.parse(packet.evidenceCapturedAt);
      if (Number.isNaN(capturedMs)) {
        missingEvidenceCount += 1;
        failures.push({
          source: packet.packetId,
          reason: "evidence_captured_at_unparseable",
        });
      } else if (!Number.isNaN(evaluatedAtMs)) {
        const ageMs = evaluatedAtMs - capturedMs;
        const windowMs = fixture.evidenceFreshnessWindowDays * MS_PER_DAY;
        if (ageMs < 0) {
          staleEvidenceCount += 1;
          failures.push({ source: packet.packetId, reason: "evidence_captured_in_future" });
        } else if (ageMs > windowMs) {
          staleEvidenceCount += 1;
          failures.push({
            source: packet.packetId,
            reason: `evidence_stale:${Math.round(ageMs / MS_PER_DAY)}d`,
          });
        }
      }
    }

    if (packet.approvalStatus === "approved") {
      const receiptCheck = findValidReceiptForPacket(fixture, packet, requiredRoles);
      if (!receiptCheck.ok) {
        approvedWithoutReceiptCount += 1;
        failures.push({
          source: packet.packetId,
          reason: receiptCheck.reason ?? "approved_without_valid_receipt",
        });
      }
    }
  }

  for (const receipt of fixture.approvalReceipts) {
    if (isForgedPendingReceipt(receipt)) {
      receiptForgeryCount += 1;
      failures.push({ source: receipt.receiptId, reason: "pending_receipt_forged" });
    }
  }

  if (fixture.packets.length !== fixture.expectedPacketCount) {
    failures.push({
      source: "fixture",
      reason: `packet_count_mismatch:${fixture.packets.length}`,
    });
  }
  if (dimensionsSeen.size !== fixture.expectedDimensionCount) {
    failures.push({
      source: "fixture",
      reason: `dimension_count_mismatch:${dimensionsSeen.size}`,
    });
  }

  const uniqueFailures = deduplicateFailures(failures);

  return {
    passed: uniqueFailures.length === 0,
    version: fixture.version,
    tenantKey: fixture.tenantKey,
    workspaceId: fixture.workspaceId,
    cycleWindowKey: fixture.cycleWindowKey,
    evaluatedAt: fixture.evaluatedAt,
    totalPackets: fixture.packets.length,
    expectedPacketCount: fixture.expectedPacketCount,
    dimensionCount: dimensionsSeen.size,
    expectedDimensionCount: fixture.expectedDimensionCount,
    p1OrAbovePacketCount,
    pendingPacketCount,
    approvedPacketCount,
    blockedPacketCount,
    missingFounderApprovalCount,
    missingReviewerRoleCount,
    missingDataProtectionLinkCount,
    approvedWithoutReceiptCount,
    receiptForgeryCount,
    staleEvidenceCount,
    missingEvidenceCount,
    crossTenantScopeCount,
    customerTenantUpgradeAttemptCount,
    liveCalibrationFlagCount,
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
    liveCalibrationAllowed: false,
    founderOrReviewerApprovalImplied: false,
    failureCount: uniqueFailures.length,
    failures: uniqueFailures,
  };
}

type ReceiptCheckResult = { readonly ok: true } | { readonly ok: false; readonly reason: string };

function findValidReceiptForPacket(
  fixture: IntelligenceGrowthApprovalReadinessFixture,
  packet: IntelligenceGrowthApprovalReadinessPacket,
  requiredRoles: ReadonlySet<IntelligenceGrowthApprovalReadinessReviewerRole>,
): ReceiptCheckResult {
  if (!packet.approvalReceiptId) {
    return { ok: false, reason: "approved_without_receipt_id" };
  }
  const receipt = fixture.approvalReceipts.find(
    (item) => item.receiptId === packet.approvalReceiptId,
  );
  if (!receipt) {
    return { ok: false, reason: "approval_receipt_not_found" };
  }
  if (receipt.packetId !== packet.packetId) {
    return { ok: false, reason: "approval_receipt_packet_mismatch" };
  }
  if (receipt.status !== "approved") {
    return { ok: false, reason: "approval_receipt_status_not_approved" };
  }
  const founder = receipt.founderSignoff;
  if (
    !founder ||
    !isMeaningful(founder.signedBy) ||
    !isMeaningful(founder.signedAt) ||
    !isMeaningful(founder.signature)
  ) {
    return { ok: false, reason: "founder_signoff_incomplete" };
  }
  const signoffs = receipt.reviewerSignoffs ?? [];
  const seenRoles = new Set<IntelligenceGrowthApprovalReadinessReviewerRole>();
  for (const signoff of signoffs) {
    if (
      !isMeaningful(signoff.signedBy) ||
      !isMeaningful(signoff.signedAt) ||
      !isMeaningful(signoff.signature)
    ) {
      return { ok: false, reason: `reviewer_signoff_incomplete:${signoff.role}` };
    }
    seenRoles.add(signoff.role);
  }
  for (const requiredRole of requiredRoles) {
    if (!seenRoles.has(requiredRole)) {
      return { ok: false, reason: `reviewer_signoff_missing:${requiredRole}` };
    }
  }
  if (
    packet.dataProtectionPreReviewLinked &&
    packet.dataProtectionPreReviewReceiptId &&
    receipt.dataProtectionPreReviewReceiptId !== packet.dataProtectionPreReviewReceiptId
  ) {
    return { ok: false, reason: "data_protection_receipt_mismatch" };
  }
  return { ok: true };
}

function isForgedPendingReceipt(
  receipt: IntelligenceGrowthApprovalReadinessReceipt,
): boolean {
  if (receipt.status !== "pending") return false;
  if (receipt.founderSignoff) return true;
  if ((receipt.reviewerSignoffs ?? []).length > 0) return true;
  return false;
}

function isMeaningful(value: string | undefined): boolean {
  if (!value) return false;
  return value.trim().length >= MIN_REVIEWER_SIGNOFF_DETAIL_LENGTH;
}

function deduplicateFailures(
  failures: readonly IntelligenceGrowthApprovalReadinessFailure[],
): readonly IntelligenceGrowthApprovalReadinessFailure[] {
  const seen = new Set<string>();
  return failures.filter((failure) => {
    const key = `${failure.source}:${failure.reason}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
