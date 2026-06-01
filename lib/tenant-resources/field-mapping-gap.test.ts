import { describe, expect, it } from "vitest";
import { buildTenantResourceFieldMappingGap } from "@/lib/tenant-resources/field-mapping-gap";
import type { TenantResourceReadiness } from "@/lib/tenant-resources/readiness";

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

describe("tenant resource field mapping gap", () => {
  it("keeps mapped CRM judgement fields available without creating a builder", () => {
    const readout = buildTenantResourceFieldMappingGap({
      resource: resource(),
      detailStatus: "usable_for_judgement",
    });

    expect(readout).toMatchObject({
      readoutKey: "tenant_resource_field_mapping_gap_import_source_hubspot",
      summaryStatus: "clear",
      judgementDowngrade: false,
      guardedWriteEvaluationBlocked: false,
      downgradeReason: null,
    });
    expect(fieldStatus(readout, "customer_status")).toBe("available");
    expect(fieldStatus(readout, "owner")).toBe("available");
    expect(fieldStatus(readout, "amount_or_stage")).toBe("available");
    expect(fieldStatus(readout, "case_status")).toBe("not_applicable");
    expect(readout.boundaryNotes.join("\n")).toContain("not a field mapping builder");
  });

  it("downgrades judgement when critical CRM fields are unmapped", () => {
    const readout = buildTenantResourceFieldMappingGap({
      resource: resource({
        status: "mapped",
        mapping: {
          mappedObjectTypes: ["CONTACT", "COMPANY"],
          mappingCompleteness: 55,
          conflictCount: 0,
          missingRequirements: ["mapping_review"],
        },
        readiness: {
          actionable: false,
          primaryGap: "mapping_incomplete",
          reasonCodes: ["mapping_incomplete"],
          operatorNextMove: "Review mapping completeness before using this resource.",
          boundaryNotes: [],
        },
      }),
      detailStatus: "needs_review",
    });

    expect(readout.summaryStatus).toBe("downgraded");
    expect(readout.judgementDowngrade).toBe(true);
    expect(readout.criticalFieldKeys).toEqual(
      expect.arrayContaining(["customer_status", "owner", "amount_or_stage", "next_step_time"]),
    );
    expect(fieldStatus(readout, "amount_or_stage")).toBe("missing");
    expect(readout.downgradeReason).toContain("Amount / stage");
  });

  it("marks mapped fields stale when freshness is unknown", () => {
    const readout = buildTenantResourceFieldMappingGap({
      resource: resource({
        readiness: {
          actionable: false,
          primaryGap: "freshness_unknown",
          reasonCodes: ["freshness_unknown"],
          operatorNextMove: "Refresh the resource before using it.",
          boundaryNotes: [],
        },
      }),
      detailStatus: "needs_review",
    });

    expect(readout.judgementDowngrade).toBe(true);
    expect(fieldStatus(readout, "customer_status")).toBe("stale");
    expect(field(readout, "customer_status").repairHint).toContain("Refresh");
  });

  it("keeps actionable conflict posture explain-only instead of widening authority", () => {
    const readout = buildTenantResourceFieldMappingGap({
      resource: resource({
        mapping: {
          mappedObjectTypes: ["CONTACT", "COMPANY", "OPPORTUNITY"],
          mappingCompleteness: 96,
          conflictCount: 1,
          missingRequirements: [],
        },
      }),
      detailStatus: "usable_for_judgement",
    });

    expect(readout.summaryStatus).toBe("has_explainable_gaps");
    expect(readout.judgementDowngrade).toBe(false);
    expect(field(readout, "owner")).toMatchObject({
      status: "ambiguous",
      judgementImpact: "explain_only",
      reasonCode: "mapping_conflict",
    });
  });
});

type FieldReadout = ReturnType<typeof buildTenantResourceFieldMappingGap>;

function field(readout: FieldReadout, fieldKey: string) {
  const item = readout.fields.find((candidate) => candidate.fieldKey === fieldKey);
  if (!item) throw new Error(`Missing field ${fieldKey}`);
  return item;
}

function fieldStatus(readout: FieldReadout, fieldKey: string) {
  return field(readout, fieldKey).status;
}
