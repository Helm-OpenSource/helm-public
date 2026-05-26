import { WorkspaceClass, WorkspaceRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { WORKSPACE_CAPABILITIES } from "@/lib/auth/authorization";
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

const signal = {
  signalId: "signal-renewal-risk",
  title: "Renewal risk follow-up",
  objectType: "Opportunity",
  objectRef: "opp-1",
  summary: "Customer has a renewal risk and needs a follow-up draft.",
  evidenceRefs: ["opportunity:opp-1"],
};

describe("tenant resource governed loop", () => {
  it("builds a manual execution proof loop for an actionable CRM import resource", () => {
    const loop = buildTenantResourceGovernedLoop({
      now,
      actorUserId: "operator-1",
      activeWorkspaceId: "workspace-customer",
      workspaceClass: WorkspaceClass.CUSTOMER,
      membershipRole: WorkspaceRole.ADMIN,
      requiredCapability: WORKSPACE_CAPABILITIES.MANAGE_IMPORTS,
      resource: crmResource(),
      requestedEffectMode: "manual_execution",
      signal,
    });

    expect(loop.followThrough).toMatchObject({
      status: "ready_for_manual_proof",
      proofRequired: true,
      nextOwner: "operator",
    });
    expect(loop.capabilityReadout).toMatchObject({
      decision: "allow",
      effectMode: "manual_execution",
      fallbackType: "none",
    });
    expect(loop.nextAction).toMatchObject({
      mode: "manual_execution_proof",
      effectMode: "manual_execution",
    });
    expect(loop.nextAction.boundaryNotes.join("\n")).toContain("does not write to the external resource");
    expect(loop.judgement.evidenceRefs).toEqual([
      "import_source:hubspot",
      "import_job:job-1",
      "opportunity:opp-1",
    ]);
    expect(loop.summaries.memory).toContain("decision=allow");
    expect(loop.summaries.handoff).toContain("execute manually and attach proof");
  });

  it("routes stale CRM resource loops to review instead of manual execution", () => {
    const loop = buildTenantResourceGovernedLoop({
      now,
      actorUserId: "operator-1",
      activeWorkspaceId: "workspace-customer",
      workspaceClass: WorkspaceClass.CUSTOMER,
      membershipRole: WorkspaceRole.ADMIN,
      requiredCapability: WORKSPACE_CAPABILITIES.MANAGE_IMPORTS,
      resource: crmResource({
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
      requestedEffectMode: "manual_execution",
      signal,
    });

    expect(loop.followThrough).toMatchObject({
      status: "stale_or_failed",
      proofRequired: false,
      failureMode: "freshness_unknown",
      nextOwner: "reviewer",
    });
    expect(loop.capabilityReadout.primaryReasonCode).toBe("resource_freshness_unknown");
    expect(loop.nextAction.mode).toBe("review_queue");
    expect(loop.steps.find((step) => step.stage === "act")).toMatchObject({
      status: "review",
    });
  });

  it("blocks governed loops when the actor cannot use the resource capability", () => {
    const loop = buildTenantResourceGovernedLoop({
      now,
      actorUserId: "member-1",
      activeWorkspaceId: "workspace-customer",
      workspaceClass: WorkspaceClass.CUSTOMER,
      membershipRole: WorkspaceRole.MEMBER,
      requiredCapability: WORKSPACE_CAPABILITIES.MANAGE_IMPORTS,
      resource: crmResource(),
      requestedEffectMode: "manual_execution",
      signal,
    });

    expect(loop.followThrough).toMatchObject({
      status: "blocked",
      proofRequired: false,
      failureMode: "capability_not_granted",
      nextOwner: "none",
    });
    expect(loop.nextAction.mode).toBe("blocked");
    expect(loop.steps.map((step) => [step.stage, step.status])).toContainEqual([
      "govern",
      "blocked",
    ]);
  });
});
