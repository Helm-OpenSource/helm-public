import { describe, expect, it } from "vitest";
import { buildTenantResourceReadiness } from "@/lib/tenant-resources/readiness";

const now = new Date("2026-04-25T08:00:00.000Z");

describe("tenant resource readiness read model", () => {
  it("promotes a connected CRM import source with a completed job into mapped and actionable readiness", () => {
    const summary = buildTenantResourceReadiness({
      now,
      importSources: [
        {
          id: "source-hubspot",
          workspaceId: "workspace-1",
          sourceType: "HUBSPOT",
          sourceName: "HubSpot CRM",
          status: "CONNECTED",
          lastSyncedAt: "2026-04-25T07:30:00.000Z",
          updatedAt: "2026-04-25T07:35:00.000Z",
        },
      ],
      importJobs: [
        {
          id: "job-1",
          sourceId: "source-hubspot",
          status: "COMPLETED",
          totalRecords: 100,
          successRecords: 96,
          failedRecords: 0,
          warningRecords: 4,
          finishedAt: "2026-04-25T07:32:00.000Z",
        },
      ],
    });

    expect(summary.resources).toHaveLength(1);
    expect(summary.resources[0]).toMatchObject({
      resourceKey: "import_source:source-hubspot",
      resourceName: "HubSpot CRM",
      resourceType: "crm",
      provider: "HUBSPOT",
      source: {
        sourceKind: "import_source",
        sourceRef: "source-hubspot",
      },
      status: "actionable",
      readiness: {
        actionable: true,
        primaryGap: null,
        operatorNextMove: "Use this resource for judgement and next-action drafts with evidence attached.",
      },
      mapping: {
        mappedObjectTypes: ["CONTACT", "COMPANY", "OPPORTUNITY"],
        mappingCompleteness: 96,
        conflictCount: 4,
      },
      governance: {
        allowedEffectModes: ["read_only", "draft_only", "manual_execution"],
        writeBackAllowed: false,
        fallbackMode: "manual_execution",
      },
    });
    expect(summary.boundaryNotes.join("\n")).toContain("resource readiness is read-only");
  });

  it("downgrades errored or stale connectors without granting write authority", () => {
    const summary = buildTenantResourceReadiness({
      now,
      connectors: [
        {
          id: "connector-mail",
          workspaceId: "workspace-1",
          provider: "GMAIL",
          status: "ERROR",
          externalAccountEmail: "ops@example.com",
          manualSendEnabled: true,
          lastSyncedAt: "2026-04-23T08:00:00.000Z",
          lastSyncStatus: "failed",
          lastSyncMessage: "token expired",
          updatedAt: "2026-04-25T07:55:00.000Z",
        },
      ],
    });

    expect(summary.resources[0]).toMatchObject({
      resourceKey: "connector:connector-mail",
      resourceType: "collaboration",
      provider: "GMAIL",
      status: "error",
      connection: {
        lastHealthStatus: "failed",
        tokenPosture: "review_required",
      },
      readiness: {
        actionable: false,
        primaryGap: "connector_error",
        operatorNextMove: "Repair or reconnect the resource before using it for Helm judgement.",
      },
      governance: {
        allowedEffectModes: ["read_only", "draft_only"],
        customerFacingAllowed: false,
        writeBackAllowed: false,
      },
    });
  });

  it("keeps tenant custom extensions governed without turning resource dependencies into authority", () => {
    const summary = buildTenantResourceReadiness({
      now,
      extensions: [
        {
          id: "extension-seat-profile",
          workspaceId: "workspace-1",
          extensionKey: "acme-seat-profile",
          kind: "TENANT_CUSTOM",
          status: "ACTIVE",
          version: "1.0.0",
          updatedAt: "2026-04-25T07:45:00.000Z",
        },
      ],
      extensionManifests: [
        {
          extensionKey: "acme-seat-profile",
          displayName: "Acme seat profile",
          dependencyConnectors: ["case-system"],
          resourceDependencies: [
            {
              resourceDependencyKey: "acme-seat-profile:case-system",
              provider: "CASE_SYSTEM",
              declaredCapabilityModes: ["read_only"],
              objectBindings: ["SEAT_PROFILE", "SEAT_PROFILE_JOB"],
              policyHints: ["review-first", "tenant-local-readout"],
            },
          ],
          capabilityDeclarations: ["seat_profile.read"],
          maxEffectMode: "read_only",
          requiresReviewByDefault: true,
        },
      ],
    });

    expect(summary.resources[0]).toMatchObject({
      resourceKey: "extension:acme-seat-profile",
      resourceType: "tenant_extension",
      provider: "acme-seat-profile",
      status: "governed",
      governance: {
        trustLevel: "declared",
        promotionEligibility: "review_required",
        allowedEffectModes: ["read_only"],
        reviewRequirement: "required",
        writeBackAllowed: false,
      },
      mapping: {
        mappedObjectTypes: ["SEAT_PROFILE", "SEAT_PROFILE_JOB"],
      },
      readiness: {
        actionable: false,
        primaryGap: "review_required",
        operatorNextMove: "Review dependency mapping and evidence posture before using this resource for a governed loop.",
      },
    });
    expect(summary.resources[0]?.readiness.boundaryNotes.join("\n")).toContain(
      "resource dependency does not grant execution authority",
    );
  });

  it("downgrades stale CRM imports even when the last job completed", () => {
    const summary = buildTenantResourceReadiness({
      now,
      importSources: [
        {
          id: "source-stale-salesforce",
          workspaceId: "workspace-1",
          sourceType: "SALESFORCE",
          sourceName: "Salesforce CRM",
          status: "CONNECTED",
          lastSyncedAt: "2026-04-22T07:30:00.000Z",
          updatedAt: "2026-04-22T07:35:00.000Z",
        },
      ],
      importJobs: [
        {
          id: "job-stale",
          sourceId: "source-stale-salesforce",
          status: "COMPLETED",
          totalRecords: 100,
          successRecords: 98,
          failedRecords: 0,
          warningRecords: 0,
          finishedAt: "2026-04-22T07:32:00.000Z",
        },
      ],
    });

    expect(summary.resources[0]).toMatchObject({
      status: "mapped",
      readiness: {
        actionable: false,
        primaryGap: "freshness_unknown",
        operatorNextMove: "Refresh the resource before using it for current Helm judgement.",
      },
      governance: {
        trustLevel: "medium",
        promotionEligibility: "review_required",
        fallbackMode: "review_queue",
      },
    });
  });

  it("flags tenant extension manifests that do not declare resource dependencies", () => {
    const summary = buildTenantResourceReadiness({
      now,
      extensions: [
        {
          id: "extension-no-dependency",
          workspaceId: "workspace-1",
          extensionKey: "tenant-system-bridge",
          kind: "TENANT_CUSTOM",
          status: "ACTIVE",
          version: "1.0.0",
          updatedAt: "2026-04-25T07:45:00.000Z",
        },
      ],
      extensionManifests: [
        {
          extensionKey: "tenant-system-bridge",
          displayName: "Tenant system bridge",
          dependencyConnectors: [],
          resourceDependencies: [
            {
              resourceDependencyKey: "tenant-system-bridge:crm",
              provider: "CRM",
              declaredCapabilityModes: ["read_only"],
              objectBindings: [],
              policyHints: [],
            },
          ],
          capabilityDeclarations: [],
          maxEffectMode: "read_only",
          requiresReviewByDefault: false,
        },
      ],
    });

    expect(summary.resources[0]).toMatchObject({
      status: "governed",
      mapping: {
        mappingCompleteness: 50,
        missingRequirements: [
          "capability_declaration",
          "object_binding",
          "policy_hint",
        ],
      },
      readiness: {
        actionable: false,
        primaryGap: "mapping_incomplete",
        operatorNextMove:
          "Declare resource dependencies and capability evidence before using this extension for Helm judgement.",
      },
      governance: {
        promotionEligibility: "review_required",
        reviewRequirement: "required",
        fallbackMode: "review_queue",
      },
    });
  });
});
