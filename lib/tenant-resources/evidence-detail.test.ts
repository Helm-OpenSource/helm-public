import { WorkspaceClass, WorkspaceRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { WORKSPACE_CAPABILITIES } from "@/lib/auth/authorization";
import {
  buildTenantResourceEvidenceAnchorId,
  buildTenantResourceEvidenceDetail,
} from "@/lib/tenant-resources/evidence-detail";
import type { TenantExtensionResourceAdoptionReadout } from "@/lib/tenant-resources/extension-adoption";
import { buildTenantResourceGovernedLoop } from "@/lib/tenant-resources/governed-loop";
import type { TenantResourceReadiness } from "@/lib/tenant-resources/readiness";

const now = new Date("2026-04-25T08:00:00.000Z");

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
      conflictCount: 1,
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

function buildLoop(resource: TenantResourceReadiness, role: WorkspaceRole = WorkspaceRole.ADMIN) {
  return buildTenantResourceGovernedLoop({
    now,
    actorUserId: role === WorkspaceRole.ADMIN ? "operator-1" : "member-1",
    activeWorkspaceId: "workspace-customer",
    workspaceClass: WorkspaceClass.CUSTOMER,
    membershipRole: role,
    requiredCapability: WORKSPACE_CAPABILITIES.MANAGE_IMPORTS,
    resource,
    requestedEffectMode: "manual_execution",
    signal: {
      signalId: "signal-renewal-risk",
      title: "Renewal risk follow-up",
      objectType: "Opportunity",
      objectRef: "opp-1",
      summary: "Customer has a renewal risk and needs a follow-up draft.",
      evidenceRefs: ["opportunity:opp-1"],
    },
  });
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

describe("tenant resource evidence detail", () => {
  it("opens the source, freshness, trust, mapping, conflict and allow decision behind a usable resource", () => {
    const resource = crmResource();
    const detail = buildTenantResourceEvidenceDetail({
      resource,
      loop: buildLoop(resource),
    });

    expect(detail).toMatchObject({
      detailKey: "tenant_resource_evidence_import_source_hubspot",
      status: "usable_for_judgement",
      sourceObject: {
        sourceObjectType: "ImportSource",
        sourceRef: "hubspot",
      },
      timing: {
        observedAt: "2026-04-25T07:30:00.000Z",
        freshnessPosture: "fresh",
      },
      trust: {
        trustLevel: "human_confirmed",
        writeBackAllowed: false,
      },
      mapping: {
        mappedObjectTypes: ["CONTACT", "COMPANY", "OPPORTUNITY"],
        mappingCompleteness: 96,
        fieldGaps: {
          summaryStatus: "has_explainable_gaps",
          judgementDowngrade: false,
        },
      },
      conflicts: {
        conflictCount: 1,
        conflictPosture: "review_required",
      },
      decision: {
        decision: "allow",
        primaryReasonCode: "allowed",
        fallbackType: "none",
      },
      manualProof: {
        required: true,
        lifecycleState: "required",
        nextOwner: "operator",
        lifecycle: {
          status: "awaiting_submission",
          followThrough: {
            result: "await_proof",
          },
        },
      },
    });
    expect(detail.decision.sourceChain.map((step) => step.step)).toContain("resource_posture");
    expect(detail.evidenceItems.map((item) => item.evidenceRef)).toEqual([
      "import_source:hubspot",
      "import_job:job-1",
      "opportunity:opp-1",
    ]);
    expect(detail.evidenceItems.every((item) => item.decisionUse === "supports_allow")).toBe(true);
    expect(detail.boundaryNotes.join("\n")).toContain("does not create connector");
    expect(detail.mapping.fieldGaps.fields.map((field) => field.fieldKey)).toContain(
      "customer_status",
    );
  });

  it("keeps stale resources review-only and explains the freshness reason", () => {
    const resource = crmResource({
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
    });
    const detail = buildTenantResourceEvidenceDetail({
      resource,
      loop: buildLoop(resource),
    });

    expect(detail.status).toBe("needs_review");
    expect(detail.timing.freshnessPosture).toBe("stale");
    expect(detail.mapping.fieldGaps).toMatchObject({
      summaryStatus: "downgraded",
      judgementDowngrade: true,
    });
    expect(detail.decision).toMatchObject({
      decision: "route_to_review",
      primaryReasonCode: "resource_freshness_unknown",
      fallbackType: "review_queue",
    });
    expect(detail.manualProof).toMatchObject({
      required: false,
      lifecycleState: "review_required",
      nextOwner: "reviewer",
      failureMode: "freshness_unknown",
      lifecycle: {
        status: "under_review",
        followThrough: {
          result: "review_proof",
        },
      },
    });
    expect(detail.decision.why).toContain("resource_freshness_unknown");
  });

  it("blocks evidence detail when actor capability fails before resource use", () => {
    const resource = crmResource();
    const detail = buildTenantResourceEvidenceDetail({
      resource,
      loop: buildLoop(resource, WorkspaceRole.MEMBER),
    });

    expect(detail.status).toBe("blocked");
    expect(detail.decision).toMatchObject({
      decision: "deny",
      primaryReasonCode: "capability_not_granted",
      fallbackType: "blocked",
      primarySourceStep: "actor_posture",
    });
    expect(detail.manualProof).toMatchObject({
      required: false,
      lifecycleState: "blocked",
      nextOwner: "none",
      failureMode: "capability_not_granted",
      lifecycle: {
        status: "blocked",
        followThrough: {
          result: "stop_blocked",
        },
      },
    });
    expect(detail.evidenceItems.every((item) => item.decisionUse === "blocked")).toBe(true);
  });

  it("builds stable settings anchors for resource evidence disclosures", () => {
    expect(buildTenantResourceEvidenceAnchorId("import_source:hubspot")).toBe(
      "tenant_resource_evidence_import_source_hubspot",
    );
  });

  it("carries extension adoption detail into the evidence disclosure without creating write authority", () => {
    const resource = extensionResource();
    const detail = buildTenantResourceEvidenceDetail({
      resource,
      loop: buildTenantResourceGovernedLoop({
        now,
        actorUserId: "operator-1",
        activeWorkspaceId: "workspace-customer",
        workspaceClass: WorkspaceClass.CUSTOMER,
        membershipRole: WorkspaceRole.ADMIN,
        requiredCapability: WORKSPACE_CAPABILITIES.REVIEW_GOVERNED_ACTIONS,
        resource,
        requestedEffectMode: "read_only",
        signal: {
          signalId: "signal-extension-readout",
          title: "Extension dependency adoption",
          objectType: "TenantResource",
          objectRef: resource.resourceKey,
          summary: resource.readiness.operatorNextMove,
          evidenceRefs: resource.evidenceRefs,
        },
      }),
      extensionAdoptionReadout: extensionAdoptionReadout(),
    });

    expect(detail.extensionAdoption).toMatchObject({
      overallStatus: "adopted_for_governed_loop",
      dependencyCount: 1,
      dependencies: [
        {
          provider: "CASE_SYSTEM",
          resourceDependencyKey: "acme-seat-profile:case-system",
        },
      ],
    });
    expect(detail.boundaryNotes.join("\n")).toContain(
      "extension adoption is read-first and does not grant external write authority",
    );
  });
});
