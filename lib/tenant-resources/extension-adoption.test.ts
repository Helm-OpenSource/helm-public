import { describe, expect, it } from "vitest";
import { buildTenantExtensionResourceAdoptionReadouts } from "@/lib/tenant-resources/extension-adoption";
import type {
  TenantExtensionManifestInput,
  TenantResourceReadiness,
  TenantResourceReadinessSummary,
} from "@/lib/tenant-resources/readiness";

function extensionResource(
  overrides: Partial<TenantResourceReadiness> = {},
): TenantResourceReadiness {
  return {
    resourceKey: "extension:acme-seat-profile",
    resourceName: "Acme Seat Profile",
    workspaceId: "workspace-1",
    resourceType: "tenant_extension",
    provider: "acme-seat-profile",
    status: "governed",
    source: {
      sourceKind: "workspace_solution_extension",
      sourceRef: "workspace-extension-1",
    },
    connection: {
      readCapability: true,
      writeCapability: false,
      callbackCapability: false,
      lastSyncAt: null,
      lastHealthStatus: "active",
      tokenPosture: "not_required",
    },
    mapping: {
      mappedObjectTypes: ["SEAT_PROFILE", "SEAT_PROFILE_JOB"],
      mappingCompleteness: 100,
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
      boundaryNotes: ["resource dependency does not grant execution authority"],
    },
    evidenceRefs: ["workspace_solution_extension:workspace-extension-1"],
    updatedAt: "2026-04-25T08:00:00.000Z",
    ...overrides,
  };
}

function readinessSummary(
  resources: TenantResourceReadiness[],
): TenantResourceReadinessSummary {
  return {
    generatedAt: "2026-04-25T08:00:00.000Z",
    totalResources: resources.length,
    resources,
    statusCounts: {
      registered: 0,
      configured: 0,
      connected: 0,
      readable: 0,
      mapped: 0,
      governed: resources.filter((resource) => resource.status === "governed").length,
      actionable: 0,
      write_intent_enabled: 0,
      paused: resources.filter((resource) => resource.status === "paused").length,
      error: 0,
      revoked: 0,
    },
    actionableResourceKeys: [],
    blockedResourceKeys: resources
      .filter((resource) => resource.status === "paused" || resource.status === "error")
      .map((resource) => resource.resourceKey),
    boundaryNotes: ["resource readiness remains read-only"],
  };
}

function manifest(
  overrides: Partial<TenantExtensionManifestInput> = {},
): TenantExtensionManifestInput {
  return {
    extensionKey: "acme-seat-profile",
    displayName: "Acme Seat Profile",
    dependencyConnectors: ["CASE_SYSTEM"],
    workspaceTruths: ["WorkspaceSolutionExtension", "tenant workspace"],
    policyTruths: ["review-first", "non-commitment"],
    capabilityDeclarations: ["seat_profile_readout"],
    maxEffectMode: "read_only",
    requiresReviewByDefault: true,
    resourceDependencies: [
      {
        resourceDependencyKey: "acme-seat-profile-case-readout",
        provider: "CASE_SYSTEM",
        declaredCapabilityModes: ["read_only"],
        objectBindings: ["SEAT_PROFILE", "SEAT_PROFILE_JOB"],
        policyHints: ["review-first", "non-commitment", "tenant-local-readout"],
      },
    ],
    ...overrides,
  };
}

describe("tenant extension dependency adoption readout", () => {
  it("marks a valid governed extension dependency as adopted for governed loop", () => {
    const [readout] = buildTenantExtensionResourceAdoptionReadouts({
      readiness: readinessSummary([extensionResource()]),
      extensionManifests: [manifest()],
    });

    expect(readout).toMatchObject({
      resourceKey: "extension:acme-seat-profile",
      overallStatus: "adopted_for_governed_loop",
      dependencyCount: 1,
    });
    expect(readout.dependencies[0]).toMatchObject({
      validationStatus: "validated",
      adoptionStatus: "adopted_for_governed_loop",
      governedLoopBindingStatus: "bound",
      objectBindings: ["SEAT_PROFILE", "SEAT_PROFILE_JOB"],
    });
    expect(readout.summary).toContain("bound into the existing governed loop");
  });

  it("blocks adoption when dependency mapping is incomplete", () => {
    const [readout] = buildTenantExtensionResourceAdoptionReadouts({
      readiness: readinessSummary([
        extensionResource({
          readiness: {
            actionable: false,
            primaryGap: "mapping_incomplete",
            reasonCodes: ["mapping_incomplete"],
            operatorNextMove: "Declare resource dependencies and capability evidence.",
            boundaryNotes: ["resource dependency does not grant execution authority"],
          },
          mapping: {
            mappedObjectTypes: [],
            mappingCompleteness: 50,
            conflictCount: 0,
            missingRequirements: ["resource_dependency"],
          },
        }),
      ]),
      extensionManifests: [manifest()],
    });

    expect(readout.overallStatus).toBe("blocked");
    expect(readout.dependencies[0]?.blockingReasons).toContain(
      "dependency_mapping_incomplete",
    );
  });

  it("marks duplicate dependency declarations as superseded", () => {
    const [readout] = buildTenantExtensionResourceAdoptionReadouts({
      readiness: readinessSummary([extensionResource()]),
      extensionManifests: [
        manifest({
          resourceDependencies: [
            {
              resourceDependencyKey: "duplicate-case-system",
              provider: "CASE_SYSTEM",
              declaredCapabilityModes: ["read_only"],
              objectBindings: ["SEAT_PROFILE"],
              policyHints: ["review-first"],
            },
            {
              resourceDependencyKey: "duplicate-case-system",
              provider: "CASE_SYSTEM",
              declaredCapabilityModes: ["read_only"],
              objectBindings: ["SEAT_PROFILE_JOB"],
              policyHints: ["review-first"],
            },
          ],
        }),
      ],
    });

    expect(readout.overallStatus).toBe("superseded");
    expect(
      readout.dependencies.every(
        (dependency) => dependency.adoptionStatus === "superseded",
      ),
    ).toBe(true);
  });
});
