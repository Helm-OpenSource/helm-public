import { WorkspaceClass, WorkspaceStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  buildHelmReservedWorkspaceBackfillApplyAuditPayload,
  buildHelmReservedWorkspaceBackfillApplySummary,
  buildHelmReservedWorkspaceBackfillAssessment,
  type HelmReservedWorkspaceBackfillCounts,
  type HelmReservedWorkspaceBackfillWorkspaceInventory,
  type HelmReservedWorkspaceBackfillReviewOnlyCounts,
} from "@/lib/workspace-reserved-backfill";

function buildCounts(
  overrides: Partial<HelmReservedWorkspaceBackfillCounts> = {},
): HelmReservedWorkspaceBackfillCounts {
  return {
    workerPublisherProfile: 0,
    salesReferral: 0,
    customEngagement: 0,
    revenueRule: 0,
    revenueAttributionLedger: 0,
    payoutLedger: 0,
    beneficiaryPayoutProfile: 0,
    participantPortalAccess: 0,
    partnerProgram: 0,
    programTermsVersion: 0,
    programApplication: 0,
    settlementBatch: 0,
    settlementBatchLine: 0,
    ...overrides,
  };
}

function buildReviewOnlyCounts(
  overrides: Partial<HelmReservedWorkspaceBackfillReviewOnlyCounts> = {},
): HelmReservedWorkspaceBackfillReviewOnlyCounts {
  return {
    capabilityCatalogEntry: 0,
    formalSkillReviewSignal: 0,
    ...overrides,
  };
}

describe("workspace reserved backfill assessment", () => {
  it("allows apply only when migratable records exist and preflight is clean", () => {
    const assessment = buildHelmReservedWorkspaceBackfillAssessment({
      migratableCounts: buildCounts({
        partnerProgram: 1,
        programTermsVersion: 2,
        programApplication: 3,
      }),
      reviewOnlyCounts: buildReviewOnlyCounts(),
      conflicts: [],
      integrityIssues: [],
    });

    expect(assessment.totalMigratableRecords).toBe(6);
    expect(assessment.totalReviewOnlySignals).toBe(0);
    expect(assessment.canApply).toBe(true);
    expect(assessment.applyBlockedReasons).toEqual([]);
  });

  it("blocks apply when no migratable records exist even if review-only signals do", () => {
    const assessment = buildHelmReservedWorkspaceBackfillAssessment({
      migratableCounts: buildCounts(),
      reviewOnlyCounts: buildReviewOnlyCounts({
        capabilityCatalogEntry: 2,
        formalSkillReviewSignal: 1,
      }),
      conflicts: [],
      integrityIssues: [],
    });

    expect(assessment.totalMigratableRecords).toBe(0);
    expect(assessment.totalReviewOnlySignals).toBe(3);
    expect(assessment.canApply).toBe(false);
    expect(assessment.applyBlockedReasons).toContain(
      "No migratable commercial / program / portal / settlement records were found in the source workspace.",
    );
  });

  it("blocks apply when target-key collisions are present", () => {
    const assessment = buildHelmReservedWorkspaceBackfillAssessment({
      migratableCounts: buildCounts({
        partnerProgram: 1,
      }),
      reviewOnlyCounts: buildReviewOnlyCounts(),
      conflicts: [
        {
          model: "partnerProgram",
          keyLabel: "slug",
          keyValue: "worker-publisher-program",
          targetRecordId: "program-1",
        },
      ],
      integrityIssues: [],
    });

    expect(assessment.canApply).toBe(false);
    expect(assessment.applyBlockedReasons).toContain(
      "Preflight found 1 target-key collision(s) in the Helm reserved workspace.",
    );
  });

  it("blocks apply when cross-workspace integrity issues are present", () => {
    const assessment = buildHelmReservedWorkspaceBackfillAssessment({
      migratableCounts: buildCounts({
        revenueRule: 2,
      }),
      reviewOnlyCounts: buildReviewOnlyCounts(),
      conflicts: [],
      integrityIssues: [
        {
          model: "revenueRule",
          count: 2,
          summary:
            "Revenue rules reference contributor or engagement records outside the source workspace.",
        },
      ],
    });

    expect(assessment.canApply).toBe(false);
    expect(assessment.applyBlockedReasons).toContain(
      "Preflight found 1 cross-workspace integrity issue group(s).",
    );
  });
});

describe("workspace reserved backfill audit payload", () => {
  it("captures source, target and updated-count context for apply audit", () => {
    const inventory: HelmReservedWorkspaceBackfillWorkspaceInventory = {
      sourceWorkspace: {
        id: "workspace-source",
        name: "Sales Demo",
        slug: "helm-sales-demo",
        status: WorkspaceStatus.ACTIVE,
        defaultLocale: "zh-CN",
        workspaceClass: WorkspaceClass.CUSTOMER,
        systemKey: null,
      },
      migratableCounts: buildCounts({
        revenueRule: 2,
        participantPortalAccess: 1,
      }),
      reviewOnlyCounts: buildReviewOnlyCounts({
        formalSkillReviewSignal: 1,
      }),
      totalMigratableRecords: 3,
      totalReviewOnlySignals: 1,
      conflicts: [],
      integrityIssues: [],
      canApply: true,
      applyBlockedReasons: [],
    };

    const payload = buildHelmReservedWorkspaceBackfillApplyAuditPayload({
      sourceWorkspace: inventory.sourceWorkspace,
      reservedWorkspace: {
        id: "workspace-reserved",
        name: "Founder Demo",
        slug: "helm-founder-demo",
        status: WorkspaceStatus.ACTIVE,
        defaultLocale: "zh-CN",
        workspaceClass: WorkspaceClass.HELM_RESERVED,
        systemKey: "helm_reserved_primary",
      },
      inventory,
      updatedCounts: buildCounts({
        revenueRule: 2,
        participantPortalAccess: 1,
      }),
      totalUpdatedRecords: 3,
    });

    expect(payload.sourceWorkspace.slug).toBe("helm-sales-demo");
    expect(payload.targetWorkspace.systemKey).toBe("helm_reserved_primary");
    expect(payload.preflight.totalMigratableRecords).toBe(3);
    expect(payload.updatedCounts.participantPortalAccess).toBe(1);
    expect(payload.totalUpdatedRecords).toBe(3);
  });

  it("builds a concise apply summary line", () => {
    const summary = buildHelmReservedWorkspaceBackfillApplySummary({
      sourceWorkspace: {
        id: "workspace-source",
        name: "Sales Demo",
        slug: "helm-sales-demo",
        status: WorkspaceStatus.ACTIVE,
        defaultLocale: "zh-CN",
        workspaceClass: WorkspaceClass.CUSTOMER,
        systemKey: null,
      },
      reservedWorkspace: {
        id: "workspace-reserved",
        name: "Founder Demo",
        slug: "helm-founder-demo",
        status: WorkspaceStatus.ACTIVE,
        defaultLocale: "zh-CN",
        workspaceClass: WorkspaceClass.HELM_RESERVED,
        systemKey: "helm_reserved_primary",
      },
      totalUpdatedRecords: 9,
    });

    expect(summary).toContain("Migrated 9 Helm first-party commercial/program/portal/settlement record(s)");
    expect(summary).toContain("helm-sales-demo");
    expect(summary).toContain("helm-founder-demo");
  });
});
