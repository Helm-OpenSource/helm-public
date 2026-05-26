import { describe, expect, it } from "vitest";
import { buildTenantResourcePolicyReadout } from "@/lib/tenant-resources/policy-readout";
import type {
  TenantResourceReadiness,
  TenantResourceReadinessSummary,
} from "@/lib/tenant-resources/readiness";

const generatedAt = "2026-04-25T08:00:00.000Z";

function summary(resources: TenantResourceReadiness[]): TenantResourceReadinessSummary {
  return {
    generatedAt,
    totalResources: resources.length,
    resources,
    statusCounts: {
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
      ...Object.fromEntries(resources.map((resource) => [resource.status, 1])),
    },
    actionableResourceKeys: resources
      .filter((resource) => resource.readiness.actionable)
      .map((resource) => resource.resourceKey),
    blockedResourceKeys: resources
      .filter((resource) => ["error", "paused", "revoked"].includes(resource.status))
      .map((resource) => resource.resourceKey),
    boundaryNotes: [],
  };
}

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

describe("tenant resource policy readout", () => {
  it("shows owner-visible read, draft, review and never-write posture", () => {
    const readout = buildTenantResourcePolicyReadout({
      readiness: summary([
        resource(),
        resource({
          resourceKey: "connector:gmail",
          resourceName: "Gmail",
          source: {
            sourceKind: "connector",
            sourceRef: "gmail",
          },
          provider: "GMAIL",
          status: "readable",
          governance: {
            trustLevel: "medium",
            promotionEligibility: "eligible_read_only",
            freshnessWindow: "24h",
            allowedEffectModes: ["read_only", "draft_only"],
            reviewRequirement: "recommended",
            customerFacingAllowed: false,
            writeBackAllowed: false,
            fallbackMode: "draft_only",
          },
          readiness: {
            actionable: false,
            primaryGap: "mapping_incomplete",
            reasonCodes: ["mapping_incomplete"],
            operatorNextMove: "Map this connector before using it for governed recommendations.",
            boundaryNotes: [],
          },
        }),
      ]),
    });

    expect(readout.readOnlyResourceKeys).toEqual(["import_source:hubspot", "connector:gmail"]);
    expect(readout.draftCapableResourceKeys).toEqual(["import_source:hubspot", "connector:gmail"]);
    expect(readout.manualReviewResourceKeys).toEqual(["connector:gmail"]);
    expect(readout.neverExternalWriteResourceKeys).toEqual([
      "import_source:hubspot",
      "connector:gmail",
    ]);
    expect(readout.items[0].ownerVisibleSummary).toBe(
      "read:available · draft:allowed · review:not_required · external_write:never_allowed",
    );
  });

  it("marks unavailable or errored resources as review-only and non-draft", () => {
    const readout = buildTenantResourcePolicyReadout({
      readiness: summary([
        resource({
          status: "error",
          connection: {
            readCapability: false,
            writeCapability: false,
            callbackCapability: false,
            lastSyncAt: null,
            lastHealthStatus: "failed",
            tokenPosture: "review_required",
          },
          governance: {
            trustLevel: "unknown",
            promotionEligibility: "not_eligible",
            freshnessWindow: "24h",
            allowedEffectModes: ["read_only", "draft_only"],
            reviewRequirement: "required",
            customerFacingAllowed: false,
            writeBackAllowed: false,
            fallbackMode: "blocked",
          },
          readiness: {
            actionable: false,
            primaryGap: "connector_error",
            reasonCodes: ["connector_error"],
            operatorNextMove: "Repair this resource before use.",
            boundaryNotes: [],
          },
        }),
      ]),
    });

    expect(readout.items[0]).toMatchObject({
      readAccess: "unavailable",
      draftGeneration: "not_allowed",
      manualReview: "required",
      externalWriteBack: "never_allowed",
    });
  });

  it("does not treat guarded write intent as available without later evaluation", () => {
    const readout = buildTenantResourcePolicyReadout({
      readiness: summary([
        resource({
          status: "write_intent_enabled",
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
        }),
      ]),
    });

    expect(readout.items[0]).toMatchObject({
      externalWriteBack: "separate_guarded_evaluation_required",
      manualReview: "required",
    });
    expect(readout.neverExternalWriteResourceKeys).toEqual([]);
    expect(readout.boundaryNotes.join("\n")).toContain("does not enforce policy");
  });
});
