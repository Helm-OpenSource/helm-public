import { MembershipStatus, WorkspaceRole } from "@prisma/client";
import { describe, expect, it } from "vitest";

import { WORKSPACE_CAPABILITIES } from "@/lib/auth/authorization";
import {
  PERMISSION_DATA_CLASSIFICATION_DEFAULT_REDACTION,
  evaluatePermission,
  permissionEffectModeSchema,
  permissionFailureCodeSchema,
} from "@/lib/auth/permission-policy";
import { runtimePermissionProfileSchema } from "@/lib/llm/runtime-permission";

const baseSubject = {
  actorType: "user" as const,
  workspaceId: "workspace-1",
  userId: "user-1",
  membershipId: "membership-1",
  membershipStatus: MembershipStatus.ACTIVE,
  workspaceRole: WorkspaceRole.OWNER,
  policyVersion: "permission-policy/v1",
  auditSource: "session" as const,
};

const baseResource = {
  kind: "workspace_membership",
  workspaceId: "workspace-1",
  dataClassifications: ["workspace_internal" as const],
};

const basePolicy = {
  policyVersion: "permission-policy/v1",
  actions: {
    "workspace.manage_members": {
      effectMode: "review_required" as const,
      riskLevel: "medium" as const,
      requiredWorkspaceCapability: WORKSPACE_CAPABILITIES.MANAGE_MEMBERS,
      allowedDataClassifications: ["workspace_internal" as const],
      source: "workspace_role" as const,
      obligations: ["human_review_required"],
    },
    "case.read": {
      effectMode: "read_only" as const,
      riskLevel: "low" as const,
      allowedDataClassifications: ["public_safe_synthetic", "workspace_internal"] as const,
      source: "pack_manifest" as const,
    },
    execute_writeback: {
      effectMode: "blocked_side_effect" as const,
      riskLevel: "critical" as const,
      allowedDataClassifications: ["workspace_internal"] as const,
      source: "pack_manifest" as const,
    },
  },
};

describe("permission policy evaluator", () => {
  it("reuses the runtime permission profile schema instead of forking a fifth effect mode", () => {
    expect(permissionEffectModeSchema).toBe(runtimePermissionProfileSchema);
    expect(() => permissionEffectModeSchema.parse("auto_execute")).toThrow();
  });

  it("keeps failure codes as a closed enum for negative tests and audit aggregation", () => {
    expect(permissionFailureCodeSchema.parse("unknown_action")).toBe("unknown_action");
    expect(() => permissionFailureCodeSchema.parse("free_text_reason")).toThrow();
  });

  it("allows an active owner through the workspace capability fallback with review obligations", () => {
    const decision = evaluatePermission({
      subject: baseSubject,
      resource: baseResource,
      actionName: "workspace.manage_members",
      policy: basePolicy,
      traceId: "trace-allow",
    });

    expect(decision.effect).toBe("allow");
    expect(decision.failureCode).toBeUndefined();
    expect(decision.source).toBe("workspace_role");
    expect(decision.action.effectMode).toBe("review_required");
    expect(decision.obligations).toContain("human_review_required");
    expect(decision.traceId).toBe("trace-allow");
  });

  it("denies user actors without active membership", () => {
    const decision = evaluatePermission({
      subject: {
        ...baseSubject,
        membershipStatus: MembershipStatus.INVITED,
      },
      resource: baseResource,
      actionName: "workspace.manage_members",
      policy: basePolicy,
      traceId: "trace-inactive",
    });

    expect(decision.effect).toBe("deny");
    expect(decision.failureCode).toBe("inactive_membership");
    expect(decision.action.effectMode).toBe("blocked_side_effect");
  });

  it("denies service actors without explicit delegated scope", () => {
    const decision = evaluatePermission({
      subject: {
        actorType: "service",
        workspaceId: "workspace-1",
        serviceKey: "signal-collector",
        policyVersion: "permission-policy/v1",
        auditSource: "delegated_service",
      },
      resource: baseResource,
      actionName: "case.read",
      policy: basePolicy,
      traceId: "trace-service",
    });

    expect(decision.effect).toBe("deny");
    expect(decision.failureCode).toBe("missing_service_scope");
  });

  it("denies service actors when delegated scope does not include the action", () => {
    const decision = evaluatePermission({
      subject: {
        actorType: "service",
        workspaceId: "workspace-1",
        serviceKey: "signal-collector",
        serviceScopes: ["case.prepare_writeback"],
        policyVersion: "permission-policy/v1",
        auditSource: "delegated_service",
      },
      resource: baseResource,
      actionName: "case.read",
      policy: basePolicy,
      traceId: "trace-service-scope-denied",
    });

    expect(decision.effect).toBe("deny");
    expect(decision.failureCode).toBe("missing_service_scope");
  });

  it("allows service actors only when delegated scope includes the action", () => {
    const decision = evaluatePermission({
      subject: {
        actorType: "service",
        workspaceId: "workspace-1",
        serviceKey: "signal-collector",
        serviceScopes: ["case.read"],
        policyVersion: "permission-policy/v1",
        auditSource: "delegated_service",
      },
      resource: baseResource,
      actionName: "case.read",
      policy: basePolicy,
      traceId: "trace-service-scope-allow",
    });

    expect(decision.effect).toBe("allow");
    expect(decision.source).toBe("pack_manifest");
  });

  it("allows system actors only for explicit public-safe fixture scope", () => {
    const decision = evaluatePermission({
      subject: {
        actorType: "system",
        workspaceId: "workspace-1",
        policyVersion: "permission-policy/v1",
        auditSource: "synthetic_fixture",
      },
      resource: {
        kind: "case_fixture",
        workspaceId: "workspace-1",
        dataClassifications: ["public_safe_synthetic"],
      },
      actionName: "case.read",
      policy: basePolicy,
      traceId: "trace-system-fixture",
    });

    expect(decision.effect).toBe("allow");
    expect(decision.redactions).toContain("synthetic");
  });

  it("denies cross-workspace resource access before evaluating business policy", () => {
    const decision = evaluatePermission({
      subject: baseSubject,
      resource: {
        ...baseResource,
        workspaceId: "workspace-2",
      },
      actionName: "workspace.manage_members",
      policy: basePolicy,
      traceId: "trace-cross-workspace",
    });

    expect(decision.effect).toBe("deny");
    expect(decision.failureCode).toBe("cross_workspace");
  });

  it("fails closed for unknown actions with a blocked side-effect action shape", () => {
    const decision = evaluatePermission({
      subject: baseSubject,
      resource: baseResource,
      actionName: "case.delete_and_notify",
      policy: basePolicy,
      traceId: "trace-unknown",
    });

    expect(decision.effect).toBe("deny");
    expect(decision.failureCode).toBe("unknown_action");
    expect(decision.action).toEqual({
      name: "case.delete_and_notify",
      effectMode: "blocked_side_effect",
      riskLevel: "critical",
    });
  });

  it("blocks public Core side-effect execution even when the action is declared", () => {
    const decision = evaluatePermission({
      subject: baseSubject,
      resource: baseResource,
      actionName: "execute_writeback",
      policy: basePolicy,
      traceId: "trace-writeback",
    });

    expect(decision.effect).toBe("deny");
    expect(decision.failureCode).toBe("blocked_side_effect");
  });

  it("denies protected data classes unless the action explicitly allows them", () => {
    const decision = evaluatePermission({
      subject: baseSubject,
      resource: {
        ...baseResource,
        kind: "collection_case",
        dataClassifications: ["financial_data"],
      },
      actionName: "case.read",
      policy: basePolicy,
      traceId: "trace-financial",
    });

    expect(decision.effect).toBe("deny");
    expect(decision.failureCode).toBe("data_class_denied");
    expect(decision.redactions).toContain("raw_private_rejected");
  });

  it("maps permission data classes onto existing redaction vocabulary", () => {
    expect(PERMISSION_DATA_CLASSIFICATION_DEFAULT_REDACTION).toEqual({
      public_safe_synthetic: "synthetic",
      workspace_internal: "redacted",
      personal_contact: "alias_only",
      regulated_personal_data: "raw_private_rejected",
      financial_data: "raw_private_rejected",
      legal_sensitive: "raw_private_rejected",
      tenant_private_config: "raw_private_rejected",
    });
  });
});

describe("governed / AI automated actors (Tier 3.8)", () => {
  const governedWorker = {
    actorType: "governed_worker" as const,
    workspaceId: "workspace-1",
    workerId: "case-work-queue-driver",
    workerVersion: "v1",
    autonomyClearanceRef: "clr:assign:full_auto",
    policyVersion: "permission-policy/v1",
    auditSource: "governed_execution" as const,
  };
  const caseResource = {
    kind: "case",
    workspaceId: "workspace-1",
    dataClassifications: ["workspace_internal" as const],
  };

  it("allows a fully-credentialed governed_worker on a capability-free action", () => {
    const decision = evaluatePermission({
      subject: governedWorker,
      resource: caseResource,
      actionName: "case.read",
      policy: basePolicy,
      traceId: "trace-gw-allow",
    });
    expect(decision.effect).toBe("allow");
    expect(decision.actor?.actorType).toBe("governed_worker");
  });

  it("treats an ai actor as a first-class principal too", () => {
    const decision = evaluatePermission({
      subject: { ...governedWorker, actorType: "ai" as const },
      resource: caseResource,
      actionName: "case.read",
      policy: basePolicy,
      traceId: "trace-ai-allow",
    });
    expect(decision.effect).toBe("allow");
  });

  it("fail-closed: missing autonomyClearanceRef → missing_worker_clearance", () => {
    const decision = evaluatePermission({
      subject: { ...governedWorker, autonomyClearanceRef: undefined },
      resource: caseResource,
      actionName: "case.read",
      policy: basePolicy,
      traceId: "trace-gw-noclr",
    });
    expect(decision.effect).toBe("deny");
    expect(decision.failureCode).toBe("missing_worker_clearance");
  });

  it("fail-closed: wrong audit source → missing_worker_clearance", () => {
    const decision = evaluatePermission({
      subject: { ...governedWorker, auditSource: "session" as const },
      resource: caseResource,
      actionName: "case.read",
      policy: basePolicy,
      traceId: "trace-gw-badaudit",
    });
    expect(decision.effect).toBe("deny");
    expect(decision.failureCode).toBe("missing_worker_clearance");
  });

  it("a governed_worker is still bound by Core's blocked_side_effect", () => {
    const decision = evaluatePermission({
      subject: governedWorker,
      resource: caseResource,
      actionName: "execute_writeback",
      policy: basePolicy,
      traceId: "trace-gw-blocked",
    });
    expect(decision.effect).toBe("deny");
    expect(decision.failureCode).toBe("blocked_side_effect");
  });

  it("missing_worker_clearance is a closed-enum failure code", () => {
    expect(permissionFailureCodeSchema.parse("missing_worker_clearance")).toBe("missing_worker_clearance");
  });
});
