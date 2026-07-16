import { MembershipStatus, WorkspaceRole } from "@prisma/client";
import { z } from "zod";

import {
  WORKSPACE_CAPABILITIES,
  type WorkspaceCapability,
  workspaceRoleHasCapability,
} from "@/lib/auth/authorization";
import {
  runtimePermissionProfileSchema,
  type RuntimePermissionProfile,
} from "@/lib/llm/runtime-permission";
import {
  redactionStatusSchema,
  type RedactionStatus,
} from "@/lib/diagnostics/doctor-packet";

export const permissionEffectModeSchema = runtimePermissionProfileSchema;
export type PermissionEffectMode = RuntimePermissionProfile;

export const permissionRiskLevelSchema = z.enum(["low", "medium", "high", "critical"]);
export type PermissionRiskLevel = z.infer<typeof permissionRiskLevelSchema>;

// "governed_worker" / "ai" make automated actors first-class principals (AgentOS review
// P-H) so packs no longer maintain a parallel actor model off to the side. Additive —
// existing user/service/system paths are unchanged.
export const permissionActorTypeSchema = z.enum(["user", "service", "system", "governed_worker", "ai"]);
export type PermissionActorType = z.infer<typeof permissionActorTypeSchema>;

export const permissionAuditSourceSchema = z.enum([
  "session",
  "delegated_service",
  "system_guard",
  "synthetic_fixture",
  "governed_execution",
]);
export type PermissionAuditSource = z.infer<typeof permissionAuditSourceSchema>;

export const permissionPolicySourceSchema = z.enum([
  "core_default",
  "workspace_role",
  "pack_manifest",
  "overlay_binding",
  "control_plane_entitlement",
]);
export type PermissionPolicySource = z.infer<typeof permissionPolicySourceSchema>;

export const permissionDataClassificationSchema = z.enum([
  "public_safe_synthetic",
  "workspace_internal",
  "personal_contact",
  "regulated_personal_data",
  "financial_data",
  "legal_sensitive",
  "tenant_private_config",
]);
export type PermissionDataClassification = z.infer<typeof permissionDataClassificationSchema>;

export const permissionFailureCodeSchema = z.enum([
  "no_session",
  "inactive_membership",
  "cross_workspace",
  "missing_policy_version",
  "policy_version_mismatch",
  "unknown_action",
  "missing_service_scope",
  "workspace_capability_denied",
  "data_class_denied",
  "blocked_side_effect",
  "no_policy_match",
  "missing_worker_clearance",
]);
export type PermissionFailureCode = z.infer<typeof permissionFailureCodeSchema>;

export const PERMISSION_DATA_CLASSIFICATION_DEFAULT_REDACTION = {
  public_safe_synthetic: "synthetic",
  workspace_internal: "redacted",
  personal_contact: "alias_only",
  regulated_personal_data: "raw_private_rejected",
  financial_data: "raw_private_rejected",
  legal_sensitive: "raw_private_rejected",
  tenant_private_config: "raw_private_rejected",
} as const satisfies Record<PermissionDataClassification, RedactionStatus>;

export type PermissionSubject = {
  readonly actorType: PermissionActorType;
  readonly workspaceId: string;
  readonly userId?: string;
  readonly membershipId?: string;
  readonly membershipStatus?: MembershipStatus;
  readonly workspaceRole?: WorkspaceRole;
  readonly rolePresetKey?: string | null;
  readonly persona?: string | null;
  readonly title?: string | null;
  readonly serviceKey?: string;
  readonly serviceScopes?: readonly string[];
  readonly policyVersion?: string;
  readonly auditSource?: PermissionAuditSource;
  // Automated-actor identity (actorType "governed_worker" / "ai"): the worker principal
  // + its autonomy clearance receipt. Lets governed/AI actors be evaluated by the same
  // central PEP instead of a parallel actor model in the packs (AgentOS review P-H).
  readonly workerId?: string;
  readonly workerVersion?: string;
  readonly autonomyClearanceRef?: string;
};

export type PermissionResource = {
  readonly kind: string;
  readonly workspaceId: string;
  readonly resourceId?: string;
  readonly extensionKey?: string;
  readonly packKey?: string;
  readonly dataClassifications?: readonly PermissionDataClassification[];
  readonly scope?: Readonly<Record<string, string | readonly string[]>>;
};

export type PermissionAction = {
  readonly name: string;
  readonly effectMode: PermissionEffectMode;
  readonly riskLevel: PermissionRiskLevel;
};

export type PermissionActionPolicy = {
  readonly effectMode: PermissionEffectMode;
  readonly riskLevel: PermissionRiskLevel;
  readonly requiredWorkspaceCapability?: WorkspaceCapability;
  readonly allowedDataClassifications?: readonly PermissionDataClassification[];
  readonly source?: PermissionPolicySource;
  readonly obligations?: readonly string[];
};

export type PermissionPolicy = {
  readonly policyVersion: string;
  readonly actions: Readonly<Record<string, PermissionActionPolicy>>;
};

export type PermissionDecision = {
  readonly effect: "allow" | "deny";
  readonly reason: string;
  readonly policyVersion: string;
  readonly traceId: string;
  readonly source: PermissionPolicySource;
  readonly actor: PermissionSubject | null;
  readonly resource: PermissionResource;
  readonly action: PermissionAction;
  readonly failureCode?: PermissionFailureCode;
  readonly obligations?: readonly string[];
  readonly redactions?: readonly RedactionStatus[];
};

export type PermissionEvaluationInput = {
  readonly subject: PermissionSubject | null | undefined;
  readonly resource: PermissionResource;
  readonly actionName: string;
  readonly policy: PermissionPolicy | null | undefined;
  readonly traceId: string;
};

function blockedAction(name: string): PermissionAction {
  return {
    name,
    effectMode: "blocked_side_effect",
    riskLevel: "critical",
  };
}

function decisionPolicyVersion(input: PermissionEvaluationInput): string {
  return input.policy?.policyVersion || input.subject?.policyVersion || "missing";
}

function uniqueRedactions(
  dataClassifications: readonly PermissionDataClassification[] | undefined,
): RedactionStatus[] {
  const redactions = new Set<RedactionStatus>();
  for (const dataClassification of dataClassifications ?? []) {
    const redaction = PERMISSION_DATA_CLASSIFICATION_DEFAULT_REDACTION[dataClassification];
    redactionStatusSchema.parse(redaction);
    redactions.add(redaction);
  }
  return [...redactions];
}

function deny(
  input: PermissionEvaluationInput,
  failureCode: PermissionFailureCode,
  reason: string,
  action: PermissionAction = blockedAction(input.actionName),
  redactions: readonly RedactionStatus[] = uniqueRedactions(
    input.resource.dataClassifications,
  ),
): PermissionDecision {
  return {
    effect: "deny",
    reason,
    policyVersion: decisionPolicyVersion(input),
    traceId: input.traceId,
    source: "core_default",
    actor: input.subject ?? null,
    resource: input.resource,
    action,
    failureCode,
    redactions,
  };
}

function validateSubject(input: PermissionEvaluationInput): PermissionDecision | null {
  const subject = input.subject;
  if (!subject) {
    return deny(input, "no_session", "No permission subject was provided.");
  }

  if (subject.actorType === "user") {
    if (!subject.userId || !subject.membershipId) {
      return deny(input, "no_session", "User actor requires a user and membership.");
    }
    if (subject.membershipStatus !== MembershipStatus.ACTIVE) {
      return deny(input, "inactive_membership", "User actor requires ACTIVE membership.");
    }
    return null;
  }

  if (subject.actorType === "service") {
    if (
      !subject.serviceKey ||
      !subject.policyVersion ||
      subject.auditSource !== "delegated_service" ||
      !subject.serviceScopes ||
      subject.serviceScopes.length === 0
    ) {
      return deny(
        input,
        "missing_service_scope",
        "Service actor requires service key, scope, policy version, and delegated audit source.",
      );
    }
    return null;
  }

  if (subject.actorType === "governed_worker" || subject.actorType === "ai") {
    // Automated actors carry a worker identity + an autonomy clearance receipt + a
    // deterministic policy version, audited as governed_execution. fail-closed otherwise.
    if (
      !subject.workerId ||
      !subject.autonomyClearanceRef ||
      !subject.policyVersion ||
      subject.auditSource !== "governed_execution"
    ) {
      return deny(
        input,
        "missing_worker_clearance",
        "Governed/AI actor requires workerId, autonomyClearanceRef, policyVersion, and governed_execution audit source.",
      );
    }
    return null;
  }

  if (
    !subject.policyVersion ||
    (subject.auditSource !== "system_guard" && subject.auditSource !== "synthetic_fixture")
  ) {
    return deny(
      input,
      "missing_service_scope",
      "System actor requires policy version and system or synthetic audit source.",
    );
  }

  return null;
}

function actionFromPolicy(name: string, actionPolicy: PermissionActionPolicy): PermissionAction {
  return {
    name,
    effectMode: actionPolicy.effectMode,
    riskLevel: actionPolicy.riskLevel,
  };
}

function hasAllowedDataClassifications(
  resource: PermissionResource,
  actionPolicy: PermissionActionPolicy,
): boolean {
  const declaredDataClassifications = resource.dataClassifications ?? [];
  if (declaredDataClassifications.length === 0) return true;
  const allowed = new Set(actionPolicy.allowedDataClassifications ?? []);
  if (allowed.size === 0) return false;
  return declaredDataClassifications.every((dataClassification) =>
    allowed.has(dataClassification),
  );
}

function serviceScopeAllowsAction(
  scopes: readonly string[] | undefined,
  actionName: string,
): boolean {
  return (scopes ?? []).some((scope) => scope === actionName || scope === "*");
}

export function evaluatePermission(input: PermissionEvaluationInput): PermissionDecision {
  const subjectDecision = validateSubject(input);
  if (subjectDecision) return subjectDecision;

  const subject = input.subject;
  if (!subject || subject.workspaceId !== input.resource.workspaceId) {
    return deny(
      input,
      "cross_workspace",
      "Resource workspace does not match the actor workspace.",
    );
  }

  if (!input.policy?.policyVersion) {
    return deny(input, "missing_policy_version", "Permission policy version is missing.");
  }

  if (subject.policyVersion && subject.policyVersion !== input.policy.policyVersion) {
    return deny(
      input,
      "policy_version_mismatch",
      "Permission subject policy version does not match the policy version.",
    );
  }

  const actionPolicy = input.policy.actions[input.actionName];
  if (!actionPolicy) {
    return deny(input, "unknown_action", "Permission action is not declared.");
  }

  const action = actionFromPolicy(input.actionName, actionPolicy);
  if (
    subject.actorType === "service" &&
    !serviceScopeAllowsAction(subject.serviceScopes, input.actionName)
  ) {
    return deny(
      input,
      "missing_service_scope",
      "Service actor scope does not include this permission action.",
      action,
    );
  }

  if (action.effectMode === "blocked_side_effect") {
    return deny(
      input,
      "blocked_side_effect",
      "Public Core blocks side-effect execution.",
      action,
    );
  }

  if (!hasAllowedDataClassifications(input.resource, actionPolicy)) {
    return deny(
      input,
      "data_class_denied",
      "Resource data classification is not allowed by this action policy.",
      action,
    );
  }

  if (
    actionPolicy.requiredWorkspaceCapability &&
    !workspaceRoleHasCapability(subject.workspaceRole, actionPolicy.requiredWorkspaceCapability)
  ) {
    return deny(
      input,
      "workspace_capability_denied",
      "Workspace role does not grant the required Core capability.",
      action,
    );
  }

  const source =
    actionPolicy.source ??
    (actionPolicy.requiredWorkspaceCapability ? "workspace_role" : "pack_manifest");

  if (!permissionPolicySourceSchema.safeParse(source).success) {
    return deny(input, "no_policy_match", "Permission policy source is invalid.", action);
  }

  return {
    effect: "allow",
    reason: "Permission policy allowed the action.",
    policyVersion: input.policy.policyVersion,
    traceId: input.traceId,
    source,
    actor: subject,
    resource: input.resource,
    action,
    obligations: actionPolicy.obligations ?? [],
    redactions: uniqueRedactions(input.resource.dataClassifications),
  };
}

export { WORKSPACE_CAPABILITIES };
