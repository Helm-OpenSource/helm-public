import { WorkspaceClass, WorkspaceRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { buildTenantResourceOperatingImpactReadout } from "@/lib/tenant-resources/operating-impact";
import type { TenantExtensionResourceAdoptionReadout } from "@/lib/tenant-resources/extension-adoption";
import type {
  TenantResourceReadiness,
  TenantResourceReadinessSummary,
} from "@/lib/tenant-resources/readiness";

const generatedAt = "2026-04-25T08:00:00.000Z";

function crmResource(
  overrides: Partial<TenantResourceReadiness> = {},
): TenantResourceReadiness {
  return {
    resourceKey: "import_source:hubspot",
    resourceName: "HubSpot CRM",
    workspaceId: "workspace-customer",
    resourceType: "crm",
    provider: "HUBSPOT",
    status: "actionable",
    source: {
      sourceKind: "import_source",
      sourceRef: "hubspot",
    },
    connection: {
      readCapability: true,
      writeCapability: false,
      callbackCapability: false,
      lastSyncAt: "2026-04-25T07:30:00.000Z",
      lastHealthStatus: "completed",
      tokenPosture: "healthy",
    },
    mapping: {
      mappedObjectTypes: ["CONTACT", "COMPANY", "OPPORTUNITY"],
      mappingCompleteness: 96,
      conflictCount: 0,
      missingRequirements: [],
    },
    governance: {
      trustLevel: "human_confirmed",
      promotionEligibility: "eligible_for_action_pack",
      freshnessWindow: "24h",
      allowedEffectModes: ["read_only", "draft_only", "manual_execution"],
      reviewRequirement: "none",
      customerFacingAllowed: false,
      writeBackAllowed: false,
      fallbackMode: "manual_execution",
    },
    readiness: {
      actionable: true,
      primaryGap: null,
      reasonCodes: ["ready"],
      operatorNextMove: "Use this resource for judgement and next-action drafts with evidence attached.",
      boundaryNotes: [
        "official write remains disabled; CRM updates require separate guarded-write evaluation",
      ],
    },
    evidenceRefs: ["import_source:hubspot", "import_job:job-1"],
    updatedAt: "2026-04-25T07:35:00.000Z",
    ...overrides,
  };
}

function readinessSummary(
  resources: TenantResourceReadiness[],
): TenantResourceReadinessSummary {
  return {
    generatedAt,
    totalResources: resources.length,
    resources,
    statusCounts: {
      registered: 0,
      configured: 0,
      connected: 0,
      readable: 0,
      mapped: resources.filter((resource) => resource.status === "mapped").length,
      governed: 0,
      actionable: resources.filter((resource) => resource.status === "actionable").length,
      write_intent_enabled: 0,
      paused: 0,
      error: 0,
      revoked: 0,
    },
    actionableResourceKeys: resources
      .filter((resource) => resource.readiness.actionable)
      .map((resource) => resource.resourceKey),
    blockedResourceKeys: [],
    boundaryNotes: ["resource readiness remains read-only"],
  };
}

function extensionResource(
  overrides: Partial<TenantResourceReadiness> = {},
): TenantResourceReadiness {
  return {
    resourceKey: "extension:acme-seat-profile",
    resourceName: "Acme seat profile",
    workspaceId: "workspace-customer",
    resourceType: "tenant_extension",
    provider: "acme-seat-profile",
    status: "governed",
    source: {
      sourceKind: "workspace_solution_extension",
      sourceRef: "acme-seat-profile",
    },
    connection: {
      readCapability: true,
      writeCapability: false,
      callbackCapability: false,
      lastSyncAt: "2026-04-25T07:30:00.000Z",
      lastHealthStatus: "completed",
      tokenPosture: "healthy",
    },
    mapping: {
      mappedObjectTypes: ["SEAT_PROFILE", "SEAT_PROFILE_JOB"],
      mappingCompleteness: 92,
      conflictCount: 0,
      missingRequirements: [],
    },
    governance: {
      trustLevel: "declared",
      promotionEligibility: "review_required",
      freshnessWindow: "manifest_declared",
      allowedEffectModes: ["read_only"],
      reviewRequirement: "required",
      customerFacingAllowed: false,
      writeBackAllowed: false,
      fallbackMode: "review_queue",
    },
    readiness: {
      actionable: false,
      primaryGap: "review_required",
      reasonCodes: ["review_required"],
      operatorNextMove:
        "Review dependency mapping and evidence posture before using this resource for a governed loop.",
      boundaryNotes: [
        "tenant custom extension stays review-first and does not become shared core truth",
      ],
    },
    evidenceRefs: ["extension:acme-seat-profile"],
    updatedAt: "2026-04-25T07:35:00.000Z",
    ...overrides,
  };
}

function extensionAdoptionReadout(): TenantExtensionResourceAdoptionReadout {
  return {
    resourceKey: "extension:acme-seat-profile",
    extensionKey: "acme-seat-profile",
    extensionDisplayName: "Acme seat profile",
    overallStatus: "adopted_for_governed_loop",
    dependencyCount: 1,
    summary:
      "Acme seat profile has 1 extension dependency declaration bound into the existing governed loop without expanding execution authority.",
    boundaryNotes: [
      "extension adoption is read-first and does not grant external write authority",
    ],
    dependencies: [
      {
        resourceKey: "extension:acme-seat-profile",
        extensionKey: "acme-seat-profile",
        extensionDisplayName: "Acme seat profile",
        resourceDependencyKey: "acme-seat-profile:case-system",
        provider: "CASE_SYSTEM",
        declaredCapabilityModes: ["read_only"],
        objectBindings: ["SEAT_PROFILE", "SEAT_PROFILE_JOB"],
        policyHint: "review-first / tenant-local-readout",
        validationStatus: "validated",
        adoptionStatus: "adopted_for_governed_loop",
        governedLoopBindingStatus: "bound",
        blockingReasons: [],
        nextReviewStep:
          "Keep the dependency review-first inside the existing governed loop; do not expand execution authority.",
        boundaryNotes: [
          "extension dependency adoption remains read-only and review-first",
        ],
      },
    ],
  };
}

describe("tenant resource operating impact readout", () => {
  it("turns actionable resources into manual proof impact without external write authority", () => {
    const readout = buildTenantResourceOperatingImpactReadout({
      english: true,
      readiness: readinessSummary([crmResource()]),
      actorUserId: "operator-1",
      activeWorkspaceId: "workspace-customer",
      workspaceClass: WorkspaceClass.CUSTOMER,
      membershipRole: WorkspaceRole.ADMIN,
    });

    expect(readout).toMatchObject({
      totalResources: 1,
      actionableResourceCount: 1,
      manualProofResourceCount: 1,
      reviewQueueResourceCount: 0,
      blockedResourceCount: 0,
    });
    expect(readout.primaryImpact).toMatchObject({
      resourceKey: "import_source:hubspot",
      severity: "low",
      decision: "allow",
      nextActionMode: "manual_execution_proof",
      proofRequired: true,
    });
    expect(readout.dashboardSummary).toContain("manual execution proof");
    expect(readout.boundaryNotes.join("\n")).toContain("does not create external write authority");
  });

  it("keeps Chinese operating summaries out of raw proof and guarded-write wording", () => {
    const readout = buildTenantResourceOperatingImpactReadout({
      english: false,
      readiness: readinessSummary([crmResource()]),
      actorUserId: "operator-1",
      activeWorkspaceId: "workspace-customer",
      workspaceClass: WorkspaceClass.CUSTOMER,
      membershipRole: WorkspaceRole.ADMIN,
    });
    const rendered = [readout.dashboardSummary, readout.operatingSummary, ...readout.boundaryNotes].join(" ");

    expect(rendered).toContain("人工凭证");
    expect(rendered).toContain("受控写回评估");
    expect(rendered).not.toMatch(/人工 proof|guarded-write/);
  });

  it("prioritizes stale resources as review impact on dashboard and operating surfaces", () => {
    const readout = buildTenantResourceOperatingImpactReadout({
      english: true,
      readiness: readinessSummary([
        crmResource({
          status: "mapped",
          governance: {
            trustLevel: "medium",
            promotionEligibility: "review_required",
            freshnessWindow: "24h",
            allowedEffectModes: ["read_only", "draft_only", "manual_execution"],
            reviewRequirement: "recommended",
            customerFacingAllowed: false,
            writeBackAllowed: false,
            fallbackMode: "review_queue",
          },
          readiness: {
            actionable: false,
            primaryGap: "freshness_unknown",
            reasonCodes: ["freshness_unknown"],
            operatorNextMove: "Refresh the resource before using it for current Helm judgement.",
            boundaryNotes: [],
          },
        }),
      ]),
      actorUserId: "operator-1",
      activeWorkspaceId: "workspace-customer",
      workspaceClass: WorkspaceClass.CUSTOMER,
      membershipRole: WorkspaceRole.ADMIN,
    });

    expect(readout.reviewQueueResourceCount).toBe(1);
    expect(readout.primaryImpact).toMatchObject({
      severity: "high",
      primaryGap: "freshness_unknown",
      primaryReasonCode: "resource_freshness_unknown",
      nextActionMode: "review_queue",
      followThroughStatus: "stale_or_failed",
    });
    expect(readout.primaryImpact?.summary).toContain("Needs freshness review");
    expect(readout.primaryImpact?.summary).not.toMatch(
      /stale_or_failed|route_to_review|resource_freshness_unknown/,
    );
    expect(readout.operatingSummary).toContain("Refresh stale resource evidence");
  });

  it("blocks resource-backed operating impact when actor capability is missing", () => {
    const readout = buildTenantResourceOperatingImpactReadout({
      english: true,
      readiness: readinessSummary([crmResource()]),
      actorUserId: "member-1",
      activeWorkspaceId: "workspace-customer",
      workspaceClass: WorkspaceClass.CUSTOMER,
      membershipRole: WorkspaceRole.MEMBER,
    });

    expect(readout.blockedResourceCount).toBe(1);
    expect(readout.primaryImpact).toMatchObject({
      severity: "critical",
      primaryReasonCode: "capability_not_granted",
      nextActionMode: "blocked",
    });
    expect(readout.dashboardSummary).toContain("blocking resource-backed judgement");
  });

  it("returns an empty impact readout when no resources exist", () => {
    const readout = buildTenantResourceOperatingImpactReadout({
      english: false,
      readiness: readinessSummary([]),
      actorUserId: "operator-1",
      activeWorkspaceId: "workspace-customer",
      workspaceClass: WorkspaceClass.CUSTOMER,
      membershipRole: WorkspaceRole.ADMIN,
    });

    expect(readout.totalResources).toBe(0);
    expect(readout.primaryImpact).toBeNull();
    expect(readout.impactItems).toEqual([]);
    expect(readout.dashboardSummary).toContain("还没有可影响今日经营判断");
  });

  it("projects extension adoption into operating evidence detail without expanding authority", () => {
    const readout = buildTenantResourceOperatingImpactReadout({
      english: true,
      readiness: readinessSummary([extensionResource()]),
      extensionAdoptionReadouts: [extensionAdoptionReadout()],
      actorUserId: "operator-1",
      activeWorkspaceId: "workspace-customer",
      workspaceClass: WorkspaceClass.CUSTOMER,
      membershipRole: WorkspaceRole.ADMIN,
    });

    expect(readout.primaryImpact).toMatchObject({
      resourceKey: "extension:acme-seat-profile",
      nextActionMode: "review_queue",
    });
    expect(readout.primaryImpact?.evidenceDetail.extensionAdoption).toMatchObject({
      overallStatus: "adopted_for_governed_loop",
      dependencyCount: 1,
    });
    expect(readout.primaryImpact?.evidenceDetail.boundaryNotes.join("\n")).toContain(
      "extension adoption is read-first and does not grant external write authority",
    );
  });
});
