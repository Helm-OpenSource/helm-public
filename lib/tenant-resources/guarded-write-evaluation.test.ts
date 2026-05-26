import { WorkspaceClass, WorkspaceRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { WORKSPACE_CAPABILITIES } from "@/lib/auth/authorization";
import {
  buildTenantResourceGuardedWriteEvaluation,
} from "@/lib/tenant-resources/guarded-write-evaluation";
import { buildTenantResourceEvidenceDetail } from "@/lib/tenant-resources/evidence-detail";
import type { TenantExtensionResourceAdoptionReadout } from "@/lib/tenant-resources/extension-adoption";
import { buildTenantResourceGovernedLoop } from "@/lib/tenant-resources/governed-loop";
import { buildTenantResourcePolicyReadout } from "@/lib/tenant-resources/policy-readout";
import type {
  TenantResourceReadiness,
  TenantResourceReadinessSummary,
} from "@/lib/tenant-resources/readiness";

const now = new Date("2026-04-25T08:00:00.000Z");

function resource(
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
      boundaryNotes: [],
    },
    evidenceRefs: ["import_source:hubspot", "import_job:job-1"],
    updatedAt: "2026-04-25T07:35:00.000Z",
    ...overrides,
  };
}

function summary(resources: TenantResourceReadiness[]): TenantResourceReadinessSummary {
  const statusCounts = {
    registered: 0,
    configured: 0,
    connected: 0,
    readable: 0,
    mapped: 0,
    governed: 0,
    actionable: 0,
    write_intent_enabled: 0,
    paused: 0,
    error: 0,
    revoked: 0,
  };
  for (const item of resources) {
    statusCounts[item.status] += 1;
  }

  return {
    generatedAt: now.toISOString(),
    totalResources: resources.length,
    resources,
    statusCounts,
    actionableResourceKeys: resources
      .filter((item) => item.readiness.actionable)
      .map((item) => item.resourceKey),
    blockedResourceKeys: resources
      .filter((item) => ["error", "paused", "revoked"].includes(item.status))
      .map((item) => item.resourceKey),
    boundaryNotes: [],
  };
}

function evidenceDetail(resourceInput: TenantResourceReadiness) {
  const requiredCapability =
    resourceInput.source.sourceKind === "workspace_solution_extension"
      ? WORKSPACE_CAPABILITIES.REVIEW_GOVERNED_ACTIONS
      : WORKSPACE_CAPABILITIES.MANAGE_IMPORTS;
  const loop = buildTenantResourceGovernedLoop({
    now,
    actorUserId: "operator-1",
    activeWorkspaceId: "workspace-customer",
    workspaceClass: WorkspaceClass.CUSTOMER,
    membershipRole: WorkspaceRole.ADMIN,
    requiredCapability,
    resource: resourceInput,
    requestedEffectMode: "draft_only",
    signal: {
      signalId: "guarded-write-evaluation",
      title: "Guarded write evaluation",
      objectType: "TenantResource",
      objectRef: resourceInput.resourceKey,
      summary: "Evaluate whether a later guarded write design review may proceed.",
      evidenceRefs: resourceInput.evidenceRefs,
    },
  });

  return buildTenantResourceEvidenceDetail({ resource: resourceInput, loop });
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
      sourceRef: "extension-1",
    },
    connection: {
      readCapability: true,
      writeCapability: false,
      callbackCapability: false,
      lastSyncAt: "2026-04-25T07:30:00.000Z",
      lastHealthStatus: "active",
      tokenPosture: "not_required",
    },
    mapping: {
      mappedObjectTypes: ["CONTACT", "ACCOUNT"],
      mappingCompleteness: 100,
      conflictCount: 0,
      missingRequirements: [],
    },
    governance: {
      trustLevel: "declared",
      promotionEligibility: "eligible_for_action_pack",
      freshnessWindow: "manifest_declared",
      allowedEffectModes: ["read_only", "draft_only", "guarded_write_intent"],
      reviewRequirement: "none",
      customerFacingAllowed: false,
      writeBackAllowed: false,
      fallbackMode: "review_queue",
    },
    readiness: {
      actionable: true,
      primaryGap: null,
      reasonCodes: ["ready"],
      operatorNextMove:
        "Use the extension resource inside a governed loop before any guarded-write design review.",
      boundaryNotes: [],
    },
    evidenceRefs: ["workspace_solution_extension:extension-1", "extension_manifest:acme-seat-profile"],
    updatedAt: "2026-04-25T07:35:00.000Z",
    ...overrides,
  };
}

function extensionAdoption(
  overallStatus: TenantExtensionResourceAdoptionReadout["overallStatus"],
): TenantExtensionResourceAdoptionReadout {
  return {
    resourceKey: "extension:acme-seat-profile",
    extensionKey: "acme-seat-profile",
    extensionDisplayName: "Acme seat profile",
    overallStatus,
    dependencyCount: 1,
    summary:
      overallStatus === "adopted_for_governed_loop"
        ? "Extension dependency is already bound into the governed loop."
        : "Extension dependency still needs more adoption review before it can shape guarded-write evaluation.",
    boundaryNotes: [
      "extension adoption is read-first and does not grant external write authority",
    ],
    dependencies: [
      {
        resourceKey: "extension:acme-seat-profile",
        extensionKey: "acme-seat-profile",
        extensionDisplayName: "Acme seat profile",
        resourceDependencyKey: "acme-seat-profile-case-readout",
        provider: "CASE_SYSTEM",
        declaredCapabilityModes: ["read_only"],
        objectBindings: ["CONTACT", "ACCOUNT"],
        policyHint: "review-first / tenant-local-readout",
        validationStatus:
          overallStatus === "adopted_for_governed_loop" ? "validated" : "declared",
        adoptionStatus: overallStatus,
        governedLoopBindingStatus:
          overallStatus === "adopted_for_governed_loop" ? "bound" : "not_bound",
        blockingReasons:
          overallStatus === "blocked" || overallStatus === "superseded"
            ? ["dependency_mapping_incomplete"]
            : [],
        nextReviewStep:
          overallStatus === "adopted_for_governed_loop"
            ? "Keep the dependency review-first inside the existing governed loop; do not expand execution authority."
            : "Review adoption scope and bind the dependency to an extension-owned governed loop.",
        boundaryNotes: [
          "extension dependency adoption remains read-only and review-first",
        ],
      },
    ],
  };
}

describe("tenant resource guarded write evaluation", () => {
  it("blocks current resources when policy says external write is never allowed", () => {
    const currentResource = resource();
    const readiness = summary([currentResource]);
    const evaluation = buildTenantResourceGuardedWriteEvaluation({
      readiness,
      evidenceDetails: [evidenceDetail(currentResource)],
      policyReadout: buildTenantResourcePolicyReadout({ readiness }),
    });

    expect(evaluation.items[0]).toMatchObject({
      status: "blocked",
      canProceedToDesignReview: false,
      blockers: expect.arrayContaining([
        "policy_external_write_never_allowed",
        "write_intent_not_declared",
      ]),
    });
    expect(evaluation.boundaryNotes.join("\n")).toContain("does not create a write route");
  });

  it("allows only design-review eligibility when all prerequisite readouts are clean", () => {
    const writeIntentResource = resource({
      status: "write_intent_enabled",
      governance: {
        trustLevel: "system_of_record",
        promotionEligibility: "eligible_for_action_pack",
        freshnessWindow: "24h",
        allowedEffectModes: ["read_only", "draft_only", "guarded_write_intent"],
        reviewRequirement: "none",
        customerFacingAllowed: false,
        writeBackAllowed: true,
        fallbackMode: "review_queue",
      },
    });
    const readiness = summary([writeIntentResource]);
    const evaluation = buildTenantResourceGuardedWriteEvaluation({
      readiness,
      evidenceDetails: [evidenceDetail(writeIntentResource)],
      policyReadout: buildTenantResourcePolicyReadout({ readiness }),
    });

    expect(evaluation.items[0]).toMatchObject({
      status: "eligible_for_design_review",
      canProceedToDesignReview: true,
      blockers: [],
      policyExternalWriteBack: "separate_guarded_evaluation_required",
    });
    expect(evaluation.eligibleForDesignReviewResourceKeys).toEqual([
      "import_source:hubspot",
    ]);
  });

  it("blocks design review when field mapping gaps downgrade judgement", () => {
    const mappedButIncomplete = resource({
      status: "write_intent_enabled",
      mapping: {
        mappedObjectTypes: ["CONTACT", "COMPANY"],
        mappingCompleteness: 55,
        conflictCount: 0,
        missingRequirements: ["mapping_review"],
      },
      governance: {
        trustLevel: "system_of_record",
        promotionEligibility: "eligible_for_action_pack",
        freshnessWindow: "24h",
        allowedEffectModes: ["read_only", "draft_only", "guarded_write_intent"],
        reviewRequirement: "required",
        customerFacingAllowed: false,
        writeBackAllowed: true,
        fallbackMode: "review_queue",
      },
      readiness: {
        actionable: false,
        primaryGap: "mapping_incomplete",
        reasonCodes: ["mapping_incomplete"],
        operatorNextMove: "Complete field mapping before using this resource.",
        boundaryNotes: [],
      },
    });
    const readiness = summary([mappedButIncomplete]);
    const evaluation = buildTenantResourceGuardedWriteEvaluation({
      readiness,
      evidenceDetails: [evidenceDetail(mappedButIncomplete)],
      policyReadout: buildTenantResourcePolicyReadout({ readiness }),
    });

    expect(evaluation.items[0]).toMatchObject({
      status: "blocked",
      blockers: expect.arrayContaining(["field_mapping_gap_blocks_write_evaluation"]),
      fieldGapSummaryStatus: "downgraded",
    });
  });

  it("requires extension adoption to reach governed-loop posture before extension write evaluation may proceed", () => {
    const currentResource = extensionResource();
    const readiness = summary([currentResource]);
    const evaluation = buildTenantResourceGuardedWriteEvaluation({
      readiness,
      evidenceDetails: [
        buildTenantResourceEvidenceDetail({
          resource: currentResource,
          loop: buildTenantResourceGovernedLoop({
            now,
            actorUserId: "operator-1",
            activeWorkspaceId: "workspace-customer",
            workspaceClass: WorkspaceClass.CUSTOMER,
            membershipRole: WorkspaceRole.ADMIN,
            requiredCapability: WORKSPACE_CAPABILITIES.REVIEW_GOVERNED_ACTIONS,
            resource: currentResource,
            requestedEffectMode: "draft_only",
            signal: {
              signalId: "guarded-write-evaluation-extension",
              title: "Guarded write evaluation",
              objectType: "TenantResource",
              objectRef: currentResource.resourceKey,
              summary: "Evaluate whether a later guarded write design review may proceed.",
              evidenceRefs: currentResource.evidenceRefs,
            },
          }),
          extensionAdoptionReadout: extensionAdoption("adopted_for_read"),
        }),
      ],
      policyReadout: buildTenantResourcePolicyReadout({ readiness }),
    });

    expect(evaluation.items[0]).toMatchObject({
      status: "requires_review",
      extensionAdoptionStatus: "adopted_for_read",
      extensionDependencyCount: 1,
      blockers: expect.arrayContaining(["extension_adoption_incomplete"]),
    });
    expect(evaluation.items[0]?.nextReviewStep).toContain(
      "Complete extension adoption review",
    );
  });

  it("keeps extension guarded write blocked when extension adoption is blocked", () => {
    const currentResource = extensionResource();
    const readiness = summary([currentResource]);
    const evaluation = buildTenantResourceGuardedWriteEvaluation({
      readiness,
      evidenceDetails: [
        buildTenantResourceEvidenceDetail({
          resource: currentResource,
          loop: buildTenantResourceGovernedLoop({
            now,
            actorUserId: "operator-1",
            activeWorkspaceId: "workspace-customer",
            workspaceClass: WorkspaceClass.CUSTOMER,
            membershipRole: WorkspaceRole.ADMIN,
            requiredCapability: WORKSPACE_CAPABILITIES.REVIEW_GOVERNED_ACTIONS,
            resource: currentResource,
            requestedEffectMode: "draft_only",
            signal: {
              signalId: "guarded-write-evaluation-extension-blocked",
              title: "Guarded write evaluation",
              objectType: "TenantResource",
              objectRef: currentResource.resourceKey,
              summary: "Evaluate whether a later guarded write design review may proceed.",
              evidenceRefs: currentResource.evidenceRefs,
            },
          }),
          extensionAdoptionReadout: extensionAdoption("blocked"),
        }),
      ],
      policyReadout: buildTenantResourcePolicyReadout({ readiness }),
    });

    expect(evaluation.items[0]).toMatchObject({
      status: "blocked",
      extensionAdoptionStatus: "blocked",
      blockers: expect.arrayContaining(["extension_adoption_blocked"]),
    });
  });

  it("allows extension design-review eligibility only after phase 4 adoption is governed-loop ready", () => {
    const currentResource = extensionResource();
    const readiness = summary([currentResource]);
    const evaluation = buildTenantResourceGuardedWriteEvaluation({
      readiness,
      evidenceDetails: [
        buildTenantResourceEvidenceDetail({
          resource: currentResource,
          loop: buildTenantResourceGovernedLoop({
            now,
            actorUserId: "operator-1",
            activeWorkspaceId: "workspace-customer",
            workspaceClass: WorkspaceClass.CUSTOMER,
            membershipRole: WorkspaceRole.ADMIN,
            requiredCapability: WORKSPACE_CAPABILITIES.REVIEW_GOVERNED_ACTIONS,
            resource: currentResource,
            requestedEffectMode: "draft_only",
            signal: {
              signalId: "guarded-write-evaluation-extension-eligible",
              title: "Guarded write evaluation",
              objectType: "TenantResource",
              objectRef: currentResource.resourceKey,
              summary: "Evaluate whether a later guarded write design review may proceed.",
              evidenceRefs: currentResource.evidenceRefs,
            },
          }),
          extensionAdoptionReadout: extensionAdoption("adopted_for_governed_loop"),
        }),
      ],
      policyReadout: buildTenantResourcePolicyReadout({ readiness }),
    });

    expect(evaluation.items[0]).toMatchObject({
      status: "eligible_for_design_review",
      canProceedToDesignReview: true,
      extensionAdoptionStatus: "adopted_for_governed_loop",
      blockers: [],
      policyExternalWriteBack: "separate_guarded_evaluation_required",
    });
  });
});
