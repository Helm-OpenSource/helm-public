import { ActorType, WorkspaceClass, WorkspaceRole, WorkspaceStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  buildCapabilityDecisionOperatorReadout,
  buildManualSettlementCapabilityDecisionTrace,
  buildParticipantPortalCapabilityDecisionTrace,
  buildProgramApplicationCapabilityDecisionTrace,
  buildTenantResourceCapabilityDecisionTrace,
} from "@/lib/capability-decision-trace";
import { WORKSPACE_CAPABILITIES } from "@/lib/auth/authorization";
import type { TenantResourceReadiness } from "@/lib/tenant-resources/readiness";

const now = new Date("2026-04-24T00:00:00.000Z");

const helmReservedWorkspace = {
  id: "workspace-reserved",
  status: WorkspaceStatus.ACTIVE,
  workspaceClass: WorkspaceClass.HELM_RESERVED,
  systemKey: "helm_reserved_primary",
};

const customerWorkspace = {
  id: "workspace-customer",
  status: WorkspaceStatus.ACTIVE,
  workspaceClass: WorkspaceClass.CUSTOMER,
  systemKey: "customer_workspace",
};

function tenantResource(
  overrides: Partial<TenantResourceReadiness>,
): TenantResourceReadiness {
  return {
    resourceKey: "import_source:crm-1",
    resourceName: "HubSpot CRM",
    workspaceId: "workspace-customer",
    resourceType: "crm",
    provider: "HUBSPOT",
    status: "actionable",
    source: {
      sourceKind: "import_source",
      sourceRef: "crm-1",
    },
    connection: {
      readCapability: true,
      writeCapability: false,
      callbackCapability: false,
      lastSyncAt: "2026-04-24T00:00:00.000Z",
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
      operatorNextMove: "Use this resource.",
      boundaryNotes: [],
    },
    evidenceRefs: ["import_source:crm-1"],
    updatedAt: "2026-04-24T00:00:00.000Z",
    ...overrides,
  };
}

describe("capability decision trace", () => {
  it("keeps program application review as a read-only trace over existing allow posture", () => {
    const trace = buildProgramApplicationCapabilityDecisionTrace({
      actorUserId: "user-1",
      workspace: helmReservedWorkspace,
      membershipRole: WorkspaceRole.ADMIN,
      action: "review_application",
      now,
    });
    const readout = buildCapabilityDecisionOperatorReadout(trace);

    expect(trace.traceId).toBe("cap_trace_program_applications_review_application_user_1_workspace_reserved");
    expect(trace.result.decision).toBe("allow");
    expect(trace.evaluation.primaryReasonCode).toBe("allowed");
    expect(trace.context.reviewContext).toBe("program_application_review_queue");
    expect(trace.evaluation.sourceChain.map((step) => [step.step, step.outcome])).toEqual([
      ["workspace_truth", "pass"],
      ["actor_posture", "pass"],
      ["target_ownership", "pass"],
      ["hard_boundary", "pass"],
      ["review_requirement", "pass"],
    ]);
    expect(readout).toMatchObject({
      requestedBy: "user-1",
      requestedCapability: "workspace.manage_program_applications",
      decision: "allow",
      fallbackType: "none",
    });
  });

  it("explains participant portal capability denial without changing the existing guard source", () => {
    const trace = buildParticipantPortalCapabilityDecisionTrace({
      actorUserId: "member-1",
      workspace: helmReservedWorkspace,
      membershipRole: WorkspaceRole.MEMBER,
      action: "issue_access",
      now,
    });
    const actorPosture = trace.evaluation.sourceChain.find((step) => step.step === "actor_posture");

    expect(trace.result.decision).toBe("deny");
    expect(trace.evaluation.primaryReasonCode).toBe("capability_not_granted");
    expect(trace.fallback).toEqual({
      required: true,
      fallbackType: "blocked",
      fallbackRef: "participant_portal_operator_review",
    });
    expect(actorPosture).toMatchObject({
      outcome: "block",
      sourceRef: "workspace.manage_participant_portal",
    });
    expect(trace.result.boundaryNotes.join("\n")).toContain("existing guard remains the enforcement source");
  });

  it("keeps reserved workspace ownership visible as a separate blocking reason", () => {
    const trace = buildProgramApplicationCapabilityDecisionTrace({
      actorUserId: "admin-1",
      workspace: customerWorkspace,
      membershipRole: WorkspaceRole.ADMIN,
      action: "issue_invite",
      now,
    });
    const ownershipStep = trace.evaluation.sourceChain.find((step) => step.step === "target_ownership");

    expect(trace.result.decision).toBe("deny");
    expect(trace.evaluation.primaryReasonCode).toBe("reserved_only");
    expect(trace.evaluation.secondaryReasonCodes).toEqual(["ownership_mismatch"]);
    expect(ownershipStep).toMatchObject({
      outcome: "block",
      sourceType: "reserved_workspace",
    });
  });

  it("routes missing manual acknowledgement to human fallback without creating execution authority", () => {
    const trace = buildManualSettlementCapabilityDecisionTrace({
      actorUserId: "admin-1",
      actorType: ActorType.USER,
      workspace: helmReservedWorkspace,
      membershipRole: WorkspaceRole.ADMIN,
      operation: "export_batch",
      manualAckSatisfied: false,
      now,
    });

    expect(trace.result.decision).toBe("ask_human");
    expect(trace.evaluation.primaryReasonCode).toBe("manual_ack_required");
    expect(trace.evaluation.downgradePath).toEqual(["allow", "route_to_review", "ask_human"]);
    expect(trace.fallback).toEqual({
      required: true,
      fallbackType: "human_ack",
      fallbackRef: "manual_settlement_workflow",
    });
    expect(trace.result.boundaryNotes.join("\n")).toContain("does not create payout rail");
  });

  it("bypasses user capability for system actors but still enforces reserved ownership", () => {
    const trace = buildManualSettlementCapabilityDecisionTrace({
      actorUserId: null,
      actorType: ActorType.SYSTEM,
      workspace: customerWorkspace,
      membershipRole: null,
      operation: "create_batch",
      now,
    });
    const actorPosture = trace.evaluation.sourceChain.find((step) => step.step === "actor_posture");

    expect(actorPosture).toMatchObject({
      outcome: "pass",
      sourceType: "service_governance",
    });
    expect(trace.actor.actorType).toBe("system");
    expect(trace.actor.membershipPosture).toBe("not_enforced");
    expect(trace.result.decision).toBe("deny");
    expect(trace.evaluation.primaryReasonCode).toBe("reserved_only");
  });

  it("allows actionable tenant resources to expose resource identity, effect mode and fallback posture", () => {
    const trace = buildTenantResourceCapabilityDecisionTrace({
      actorUserId: "operator-1",
      activeWorkspaceId: "workspace-customer",
      membershipRole: WorkspaceRole.ADMIN,
      workspaceClass: WorkspaceClass.CUSTOMER,
      resource: tenantResource({}),
      requestedEffectMode: "manual_execution",
      requiredCapability: WORKSPACE_CAPABILITIES.MANAGE_IMPORTS,
      now,
    });
    const readout = buildCapabilityDecisionOperatorReadout(trace);

    expect(trace.result.decision).toBe("allow");
    expect(trace.context.resourceIdentity).toBe("import_source:crm-1");
    expect(trace.request.effectMode).toBe("manual_execution");
    expect(trace.fallback.fallbackType).toBe("none");
    expect(readout).toMatchObject({
      decision: "allow",
      requestedCapability: "workspace.manage_imports",
      effectMode: "manual_execution",
    });
  });

  it("routes stale tenant resources to review with freshness reason codes", () => {
    const trace = buildTenantResourceCapabilityDecisionTrace({
      actorUserId: "operator-1",
      activeWorkspaceId: "workspace-customer",
      membershipRole: WorkspaceRole.ADMIN,
      workspaceClass: WorkspaceClass.CUSTOMER,
      resource: tenantResource({
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
          operatorNextMove: "Refresh the resource.",
          boundaryNotes: [],
        },
      }),
      requestedEffectMode: "manual_execution",
      requiredCapability: WORKSPACE_CAPABILITIES.MANAGE_IMPORTS,
      now,
    });
    const resourceStep = trace.evaluation.sourceChain.find((step) => step.step === "resource_posture");

    expect(trace.result.decision).toBe("route_to_review");
    expect(trace.evaluation.primaryReasonCode).toBe("resource_freshness_unknown");
    expect(trace.fallback).toEqual({
      required: true,
      fallbackType: "review_queue",
      fallbackRef: "review_queue",
    });
    expect(resourceStep).toMatchObject({
      outcome: "warn",
      sourceRef: "import_source:crm-1",
    });
  });

  it("denies tenant resource traces before resource posture when actor capability is missing", () => {
    const trace = buildTenantResourceCapabilityDecisionTrace({
      actorUserId: "member-1",
      activeWorkspaceId: "workspace-customer",
      membershipRole: WorkspaceRole.MEMBER,
      workspaceClass: WorkspaceClass.CUSTOMER,
      resource: tenantResource({}),
      requestedEffectMode: "manual_execution",
      requiredCapability: WORKSPACE_CAPABILITIES.MANAGE_IMPORTS,
      now,
    });

    expect(trace.result.decision).toBe("deny");
    expect(trace.evaluation.primaryReasonCode).toBe("capability_not_granted");
    expect(trace.context.resourceIdentity).toBe("import_source:crm-1");
  });

  it("routes tenant resource effect mode overreach to review instead of granting write intent", () => {
    const trace = buildTenantResourceCapabilityDecisionTrace({
      actorUserId: "operator-1",
      activeWorkspaceId: "workspace-customer",
      membershipRole: WorkspaceRole.ADMIN,
      workspaceClass: WorkspaceClass.CUSTOMER,
      resource: tenantResource({
        resourceKey: "extension:tenant-system-bridge",
        resourceType: "tenant_extension",
        provider: "tenant-system-bridge",
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
      }),
      requestedEffectMode: "guarded_write_intent",
      now,
    });

    expect(trace.result.decision).toBe("route_to_review");
    expect(trace.evaluation.primaryReasonCode).toBe("resource_effect_mode_exceeded");
    expect(trace.evaluation.secondaryReasonCodes).toEqual(["effect_mode_exceeded"]);
    expect(trace.result.boundaryNotes.join("\n")).toContain("does not grant external write");
  });
});
