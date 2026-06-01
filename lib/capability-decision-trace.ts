import { ActorType, WorkspaceClass, WorkspaceRole, WorkspaceStatus } from "@prisma/client";
import {
  WORKSPACE_CAPABILITIES,
  type WorkspaceCapability,
  workspaceRoleHasCapability,
} from "@/lib/auth/authorization";
import type {
  TenantResourceEffectMode,
  TenantResourceReadiness,
  TenantResourceReadinessReason,
} from "@/lib/tenant-resources/readiness";
import { isOperationalHelmReservedWorkspace } from "@/lib/workspace-reserved";

type CapabilityDecisionEffectMode =
  | "read_only"
  | "draft_only"
  | "internal_write"
  | "manual_execution"
  | "guarded_write_intent"
  | "customer_visible_send";

type CapabilityDecisionActorType = "user" | "operator" | "system" | "extension" | "monitor";
type CapabilityDecisionSourceStepName =
  | "workspace_truth"
  | "actor_posture"
  | "target_ownership"
  | "declaration_truth"
  | "resource_posture"
  | "hard_boundary"
  | "review_requirement";
type CapabilityDecisionSourceOutcome = "pass" | "warn" | "block";
type CapabilityDecisionResultValue =
  | "allow"
  | "allow_draft_only"
  | "route_to_review"
  | "ask_human"
  | "deny";
type CapabilityDecisionFallbackType =
  | "none"
  | "review_queue"
  | "human_ack"
  | "manual_execution"
  | "blocked";
type CapabilityDecisionReasonCode =
  | "allowed"
  | "workspace_missing"
  | "membership_missing"
  | "capability_not_granted"
  | "ownership_mismatch"
  | "reserved_only"
  | "capability_not_declared"
  | "effect_mode_exceeded"
  | "customer_facing_review_required"
  | "hard_boundary_blocked"
  | "manual_ack_required"
  | "resource_not_actionable"
  | "resource_freshness_unknown"
  | "resource_review_required"
  | "resource_effect_mode_exceeded"
  | "unsupported_runtime_posture";

type ReservedWorkspaceLike = {
  id?: string | null;
  status?: WorkspaceStatus | null;
  workspaceClass?: WorkspaceClass | null;
  systemKey?: string | null;
};

export type CapabilityDecisionSourceStep = {
  step: CapabilityDecisionSourceStepName;
  sourceType: string;
  sourceRef: string | null;
  outcome: CapabilityDecisionSourceOutcome;
  note: string;
};

export type CapabilityDecisionTrace = {
  traceId: string;
  decidedAt: string;
  actor: {
    actorIdentity: string;
    actorType: CapabilityDecisionActorType;
    activeWorkspaceId: string | null;
    workspaceClass: string | null;
    membershipPosture: string | null;
  };
  request: {
    requestedCapability: string;
    effectMode: CapabilityDecisionEffectMode;
    customerFacingIntent: boolean;
    requestSource: string;
    targetObjectType: string | null;
    targetObjectScope: string | null;
  };
  context: {
    bundleIdentity: string | null;
    workerIdentity: string | null;
    skillIdentity: string | null;
    resourceIdentity: string | null;
    targetOwnershipPosture: string | null;
    reservedOnly: boolean;
    reviewContext: string | null;
  };
  evaluation: {
    sourceChain: CapabilityDecisionSourceStep[];
    primaryReasonCode: CapabilityDecisionReasonCode;
    secondaryReasonCodes: CapabilityDecisionReasonCode[];
    downgraded: boolean;
    downgradePath: CapabilityDecisionResultValue[];
  };
  result: {
    decision: CapabilityDecisionResultValue;
    boundaryNotes: string[];
    nonCommitmentNotes: string[];
  };
  fallback: {
    required: boolean;
    fallbackType: CapabilityDecisionFallbackType;
    fallbackRef: string | null;
  };
  audit: {
    auditKey: string;
    emittedBy: "capability-engine";
    emittedAt: string;
    replaySafe: boolean;
  };
};

export type CapabilityDecisionOperatorReadout = {
  requestedBy: string;
  requestedCapability: string;
  effectMode: CapabilityDecisionEffectMode;
  decision: CapabilityDecisionResultValue;
  primaryReasonCode: CapabilityDecisionReasonCode;
  downgradePath: CapabilityDecisionResultValue[];
  fallbackType: CapabilityDecisionFallbackType;
  fallbackRef: string | null;
  primarySourceStep: CapabilityDecisionSourceStepName;
};

export type BuildCapabilityDecisionTraceInput = {
  traceSeed: string;
  now?: Date;
  actor: {
    actorIdentity?: string | null;
    actorType?: ActorType | null;
    activeWorkspaceId?: string | null;
    workspaceClass?: WorkspaceClass | null;
    membershipRole?: WorkspaceRole | null;
  };
  request: CapabilityDecisionTrace["request"];
  context?: Partial<CapabilityDecisionTrace["context"]>;
  governance: {
    workspace?: ReservedWorkspaceLike | null;
    requiredCapability?: WorkspaceCapability | null;
    enforceUserCapability?: boolean;
    reservedOnly?: boolean;
    declarationRequired?: boolean;
    capabilityDeclared?: boolean;
    reviewRequired?: boolean;
    manualAckRequired?: boolean;
    manualAckSatisfied?: boolean;
    hardBoundaryBlocked?: boolean;
    hardBoundaryNote?: string | null;
    fallbackRef?: string | null;
    resourcePosture?: {
      resourceIdentity: string;
      effectModeAllowed: boolean;
      actionable: boolean;
      primaryGap: TenantResourceReadinessReason | null;
      reviewRequired: boolean;
    };
  };
  boundaryNotes?: string[];
  nonCommitmentNotes?: string[];
};

export function buildCapabilityDecisionTrace(
  input: BuildCapabilityDecisionTraceInput,
): CapabilityDecisionTrace {
  const decidedAt = (input.now ?? new Date()).toISOString();
  const actorType = resolveDecisionActorType(input.actor.actorType);
  const activeWorkspaceId = input.actor.activeWorkspaceId ?? input.governance.workspace?.id ?? null;
  const workspaceClass =
    input.actor.workspaceClass ?? input.governance.workspace?.workspaceClass ?? null;
  const membershipRole = input.actor.membershipRole ?? null;
  const enforceUserCapability =
    input.governance.enforceUserCapability ??
    (actorType === "user" && Boolean(input.governance.requiredCapability));
  const reservedOnly = input.governance.reservedOnly ?? false;
  const capabilityDeclared = input.governance.capabilityDeclared ?? true;
  const declarationRequired = input.governance.declarationRequired ?? false;
  const manualAckRequired = input.governance.manualAckRequired ?? false;
  const manualAckSatisfied = input.governance.manualAckSatisfied ?? !manualAckRequired;
  const reviewRequired = input.governance.reviewRequired ?? manualAckRequired;
  const boundaryNotes = [
    "read-only capability decision trace; existing guard remains the enforcement source",
    ...(input.boundaryNotes ?? []),
  ];

  const sourceChain: CapabilityDecisionSourceStep[] = [
    buildWorkspaceTruthStep(activeWorkspaceId),
    buildActorPostureStep({
      enforceUserCapability,
      membershipRole,
      requiredCapability: input.governance.requiredCapability ?? null,
    }),
  ];

  if (reservedOnly) {
    sourceChain.push(
      buildReservedOwnershipStep({
        workspace: input.governance.workspace ?? null,
        reservedOnly,
      }),
    );
  }

  if (declarationRequired) {
    sourceChain.push(
      capabilityDeclared
        ? {
            step: "declaration_truth",
            sourceType: "capability_manifest",
            sourceRef: input.request.requestedCapability,
            outcome: "pass",
            note: "Requested capability is declared for this read-only trace path.",
          }
        : {
            step: "declaration_truth",
            sourceType: "capability_manifest",
            sourceRef: input.request.requestedCapability,
            outcome: "block",
            note: "Requested capability is not declared for this trace path.",
          },
    );
  }

  if (input.governance.resourcePosture) {
    sourceChain.push(buildResourcePostureStep(input.governance.resourcePosture));
  }

  sourceChain.push(
    input.governance.hardBoundaryBlocked
      ? {
          step: "hard_boundary",
          sourceType: "policy",
          sourceRef: "hard_boundary",
          outcome: "block",
          note: input.governance.hardBoundaryNote ?? "The request exceeds a hard boundary.",
        }
      : {
          step: "hard_boundary",
          sourceType: "policy",
          sourceRef: "review-first",
          outcome: "pass",
          note: "No hard boundary is exceeded in the read-only trace.",
        },
  );

  if (reviewRequired || manualAckRequired) {
    sourceChain.push(
      buildReviewRequirementStep({
        manualAckRequired,
        manualAckSatisfied,
        customerFacingIntent: input.request.customerFacingIntent,
      }),
    );
  }

  const decision = resolveCapabilityDecision({
    activeWorkspaceId,
    enforceUserCapability,
    membershipRole,
    requiredCapability: input.governance.requiredCapability ?? null,
    reservedOnly,
    reservedAllowed: !reservedOnly || isOperationalHelmReservedWorkspace(input.governance.workspace),
    declarationRequired,
    capabilityDeclared,
    resourcePosture: input.governance.resourcePosture ?? null,
    hardBoundaryBlocked: input.governance.hardBoundaryBlocked ?? false,
    reviewRequired,
    manualAckRequired,
    manualAckSatisfied,
    customerFacingIntent: input.request.customerFacingIntent,
  });

  return {
    traceId: buildStableKey("cap_trace", input.traceSeed),
    decidedAt,
    actor: {
      actorIdentity: input.actor.actorIdentity ?? "unknown_actor",
      actorType,
      activeWorkspaceId,
      workspaceClass,
      membershipPosture: membershipRole?.toLowerCase() ?? (enforceUserCapability ? "missing" : "not_enforced"),
    },
    request: input.request,
    context: {
      bundleIdentity: input.context?.bundleIdentity ?? null,
      workerIdentity: input.context?.workerIdentity ?? null,
      skillIdentity: input.context?.skillIdentity ?? null,
      resourceIdentity: input.context?.resourceIdentity ?? null,
      targetOwnershipPosture:
        input.context?.targetOwnershipPosture ??
        (reservedOnly ? "helm_reserved_workspace_owned" : null),
      reservedOnly,
      reviewContext: input.context?.reviewContext ?? null,
    },
    evaluation: {
      sourceChain,
      primaryReasonCode: decision.primaryReasonCode,
      secondaryReasonCodes: decision.secondaryReasonCodes,
      downgraded: decision.decision !== "allow",
      downgradePath: decision.downgradePath,
    },
    result: {
      decision: decision.decision,
      boundaryNotes,
      nonCommitmentNotes: input.nonCommitmentNotes ?? [],
    },
    fallback: {
      required: decision.decision !== "allow",
      fallbackType: decision.fallbackType,
      fallbackRef: decision.decision === "allow" ? null : input.governance.fallbackRef ?? decision.fallbackType,
    },
    audit: {
      auditKey: buildStableKey("cap_audit", input.traceSeed),
      emittedBy: "capability-engine",
      emittedAt: decidedAt,
      replaySafe: true,
    },
  };
}

export function buildCapabilityDecisionOperatorReadout(
  trace: CapabilityDecisionTrace,
): CapabilityDecisionOperatorReadout {
  const primaryStep =
    trace.evaluation.sourceChain.find((step) => step.outcome !== "pass") ??
    trace.evaluation.sourceChain[0];

  return {
    requestedBy: trace.actor.actorIdentity,
    requestedCapability: trace.request.requestedCapability,
    effectMode: trace.request.effectMode,
    decision: trace.result.decision,
    primaryReasonCode: trace.evaluation.primaryReasonCode,
    downgradePath: trace.evaluation.downgradePath,
    fallbackType: trace.fallback.fallbackType,
    fallbackRef: trace.fallback.fallbackRef,
    primarySourceStep: primaryStep?.step ?? "workspace_truth",
  };
}

export function buildProgramApplicationCapabilityDecisionTrace(input: {
  actorUserId: string | null;
  workspace: ReservedWorkspaceLike | null;
  membershipRole: WorkspaceRole | null;
  action: "review_application" | "issue_invite";
  manualAckSatisfied?: boolean;
  now?: Date;
}) {
  return buildCapabilityDecisionTrace({
    traceSeed: `program_applications:${input.action}:${input.actorUserId ?? "unknown"}:${input.workspace?.id ?? "missing"}`,
    now: input.now,
    actor: {
      actorIdentity: input.actorUserId,
      actorType: ActorType.USER,
      activeWorkspaceId: input.workspace?.id,
      workspaceClass: input.workspace?.workspaceClass,
      membershipRole: input.membershipRole,
    },
    request: {
      requestedCapability: WORKSPACE_CAPABILITIES.MANAGE_PROGRAM_APPLICATIONS,
      effectMode: "internal_write",
      customerFacingIntent: false,
      requestSource: "features/programs/actions.ts",
      targetObjectType: "ProgramApplication",
      targetObjectScope: "workspace",
    },
    context: {
      bundleIdentity: "helm-reserved-commercial-programs",
      targetOwnershipPosture: "helm_reserved_workspace_owned",
      reviewContext:
        input.action === "review_application"
          ? "program_application_review_queue"
          : "program_application_invite_issuance",
    },
    governance: {
      workspace: input.workspace,
      requiredCapability: WORKSPACE_CAPABILITIES.MANAGE_PROGRAM_APPLICATIONS,
      reservedOnly: true,
      reviewRequired: true,
      manualAckRequired: true,
      manualAckSatisfied: input.manualAckSatisfied ?? true,
      fallbackRef: "program_application_review_queue",
    },
    boundaryNotes: [
      "program application review and invite issuance stay reserved for the Helm internal operating workspace",
      "trace does not create new program execution authority",
    ],
  });
}

export function buildParticipantPortalCapabilityDecisionTrace(input: {
  actorUserId: string | null;
  workspace: ReservedWorkspaceLike | null;
  membershipRole: WorkspaceRole | null;
  action: "issue_access" | "update_access_status";
  manualAckSatisfied?: boolean;
  now?: Date;
}) {
  return buildCapabilityDecisionTrace({
    traceSeed: `participant_portal:${input.action}:${input.actorUserId ?? "unknown"}:${input.workspace?.id ?? "missing"}`,
    now: input.now,
    actor: {
      actorIdentity: input.actorUserId,
      actorType: ActorType.USER,
      activeWorkspaceId: input.workspace?.id,
      workspaceClass: input.workspace?.workspaceClass,
      membershipRole: input.membershipRole,
    },
    request: {
      requestedCapability: WORKSPACE_CAPABILITIES.MANAGE_PARTICIPANT_PORTAL,
      effectMode: "internal_write",
      customerFacingIntent: false,
      requestSource: "features/participant-portal/actions.ts",
      targetObjectType: "ParticipantPortalAccess",
      targetObjectScope: "workspace",
    },
    context: {
      bundleIdentity: "helm-reserved-participant-portal",
      targetOwnershipPosture: "helm_reserved_workspace_owned",
      reviewContext:
        input.action === "issue_access"
          ? "participant_portal_invite_issuance"
          : "participant_portal_access_status_review",
    },
    governance: {
      workspace: input.workspace,
      requiredCapability: WORKSPACE_CAPABILITIES.MANAGE_PARTICIPANT_PORTAL,
      reservedOnly: true,
      reviewRequired: true,
      manualAckRequired: true,
      manualAckSatisfied: input.manualAckSatisfied ?? true,
      fallbackRef: "participant_portal_operator_review",
    },
    boundaryNotes: [
      "participant portal access stays anchored to the Helm reserved host workspace",
      "trace does not expose registry, settlement, payout execution, or public discovery authority",
    ],
  });
}

export function buildManualSettlementCapabilityDecisionTrace(input: {
  actorUserId?: string | null;
  actorType?: ActorType | null;
  workspace: ReservedWorkspaceLike | null;
  membershipRole?: WorkspaceRole | null;
  operation:
    | "create_batch"
    | "approve_batch"
    | "export_batch"
    | "mark_line_paid"
    | "reverse_line"
    | "close_batch";
  manualAckSatisfied?: boolean;
  now?: Date;
}) {
  return buildCapabilityDecisionTrace({
    traceSeed: `manual_settlement:${input.operation}:${input.actorUserId ?? "service"}:${input.workspace?.id ?? "missing"}`,
    now: input.now,
    actor: {
      actorIdentity: input.actorUserId ?? "service_actor",
      actorType: input.actorType ?? (input.actorUserId ? ActorType.USER : ActorType.SYSTEM),
      activeWorkspaceId: input.workspace?.id,
      workspaceClass: input.workspace?.workspaceClass,
      membershipRole: input.membershipRole ?? null,
    },
    request: {
      requestedCapability: WORKSPACE_CAPABILITIES.MANAGE_MANUAL_SETTLEMENT,
      effectMode: "internal_write",
      customerFacingIntent: false,
      requestSource: "lib/billing/manual-settlement.ts",
      targetObjectType:
        input.operation === "mark_line_paid" || input.operation === "reverse_line"
          ? "SettlementBatchLine"
          : "SettlementBatch",
      targetObjectScope: "workspace",
    },
    context: {
      bundleIdentity: "helm-reserved-manual-settlement",
      resourceIdentity: "manual_settlement_workflow",
      targetOwnershipPosture: "helm_reserved_workspace_owned",
      reviewContext: `manual_settlement_${input.operation}`,
    },
    governance: {
      workspace: input.workspace,
      requiredCapability: WORKSPACE_CAPABILITIES.MANAGE_MANUAL_SETTLEMENT,
      reservedOnly: true,
      reviewRequired: true,
      manualAckRequired: true,
      manualAckSatisfied: input.manualAckSatisfied ?? true,
      fallbackRef: "manual_settlement_workflow",
    },
    boundaryNotes: [
      "manual settlement remains internal-only manual execution",
      "trace does not create payout rail, marketplace, or customer-visible send authority",
    ],
  });
}

export function buildTenantResourceCapabilityDecisionTrace(input: {
  actorUserId?: string | null;
  actorType?: ActorType | null;
  activeWorkspaceId: string | null;
  membershipRole?: WorkspaceRole | null;
  workspaceClass?: WorkspaceClass | null;
  resource: TenantResourceReadiness;
  requestedEffectMode?: TenantResourceEffectMode;
  requiredCapability?: WorkspaceCapability | null;
  requestSource?: string;
  manualAckSatisfied?: boolean;
  now?: Date;
}) {
  const requestedEffectMode =
    input.requestedEffectMode ??
    input.resource.governance.allowedEffectModes.at(-1) ??
    "read_only";
  const effectModeAllowed = input.resource.governance.allowedEffectModes.includes(requestedEffectMode);
  const reviewRequired = input.resource.governance.reviewRequirement === "required";

  return buildCapabilityDecisionTrace({
    traceSeed: `tenant_resource:${input.resource.resourceKey}:${requestedEffectMode}:${input.actorUserId ?? "unknown"}:${input.activeWorkspaceId ?? "missing"}`,
    now: input.now,
    actor: {
      actorIdentity: input.actorUserId ?? null,
      actorType: input.actorType ?? ActorType.USER,
      activeWorkspaceId: input.activeWorkspaceId,
      workspaceClass: input.workspaceClass ?? null,
      membershipRole: input.membershipRole ?? null,
    },
    request: {
      requestedCapability: input.requiredCapability ?? "tenant_resource.use_for_judgement",
      effectMode: requestedEffectMode,
      customerFacingIntent: input.resource.governance.customerFacingAllowed,
      requestSource: input.requestSource ?? "lib/tenant-resources/capability-trace",
      targetObjectType: "TenantResourceReadiness",
      targetObjectScope: input.resource.workspaceId,
    },
    context: {
      resourceIdentity: input.resource.resourceKey,
      targetOwnershipPosture: "workspace_resource_owned",
      reviewContext: input.resource.readiness.primaryGap ?? "tenant_resource_readiness",
    },
    governance: {
      requiredCapability: input.requiredCapability ?? null,
      enforceUserCapability: Boolean(input.requiredCapability),
      declarationRequired: true,
      capabilityDeclared: input.resource.governance.allowedEffectModes.length > 0,
      reviewRequired,
      manualAckRequired: reviewRequired,
      manualAckSatisfied: input.manualAckSatisfied ?? !reviewRequired,
      fallbackRef: input.resource.governance.fallbackMode,
      resourcePosture: {
        resourceIdentity: input.resource.resourceKey,
        effectModeAllowed,
        actionable: input.resource.readiness.actionable,
        primaryGap: input.resource.readiness.primaryGap,
        reviewRequired,
      },
    },
    boundaryNotes: [
      "tenant resource capability trace is read-only and does not change existing connector, import, extension, or action guards",
      "resource readiness does not grant external write, customer-visible send, or execution authority",
    ],
  });
}

function buildWorkspaceTruthStep(activeWorkspaceId: string | null): CapabilityDecisionSourceStep {
  if (!activeWorkspaceId) {
    return {
      step: "workspace_truth",
      sourceType: "session",
      sourceRef: "activeWorkspaceId",
      outcome: "block",
      note: "No active workspace is available for this request.",
    };
  }

  return {
    step: "workspace_truth",
    sourceType: "session",
    sourceRef: activeWorkspaceId,
    outcome: "pass",
    note: "Active workspace is resolved for this request.",
  };
}

function buildActorPostureStep(input: {
  enforceUserCapability: boolean;
  membershipRole: WorkspaceRole | null;
  requiredCapability: WorkspaceCapability | null;
}): CapabilityDecisionSourceStep {
  if (!input.enforceUserCapability || !input.requiredCapability) {
    return {
      step: "actor_posture",
      sourceType: "service_governance",
      sourceRef: null,
      outcome: "pass",
      note: "User capability enforcement is not required for this actor posture.",
    };
  }

  if (!input.membershipRole) {
    return {
      step: "actor_posture",
      sourceType: "membership",
      sourceRef: input.requiredCapability,
      outcome: "block",
      note: "No workspace membership role is available for this user actor.",
    };
  }

  if (!workspaceRoleHasCapability(input.membershipRole, input.requiredCapability)) {
    return {
      step: "actor_posture",
      sourceType: "membership",
      sourceRef: input.requiredCapability,
      outcome: "block",
      note: `${input.membershipRole.toLowerCase()} does not include ${input.requiredCapability}.`,
    };
  }

  return {
    step: "actor_posture",
    sourceType: "membership",
    sourceRef: input.requiredCapability,
    outcome: "pass",
    note: `${input.membershipRole.toLowerCase()} includes ${input.requiredCapability}.`,
  };
}

function buildReservedOwnershipStep(input: {
  workspace: ReservedWorkspaceLike | null;
  reservedOnly: boolean;
}): CapabilityDecisionSourceStep {
  if (!input.reservedOnly) {
    return {
      step: "target_ownership",
      sourceType: "workspace",
      sourceRef: input.workspace?.id ?? null,
      outcome: "pass",
      note: "This request does not require Helm reserved workspace ownership.",
    };
  }

  if (!isOperationalHelmReservedWorkspace(input.workspace)) {
    return {
      step: "target_ownership",
      sourceType: "reserved_workspace",
      sourceRef: input.workspace?.id ?? null,
      outcome: "block",
      note: "Target operation requires the operational Helm reserved workspace.",
    };
  }

  return {
    step: "target_ownership",
    sourceType: "reserved_workspace",
    sourceRef: input.workspace?.id ?? null,
    outcome: "pass",
    note: "Target operation is anchored to the operational Helm reserved workspace.",
  };
}

function buildReviewRequirementStep(input: {
  manualAckRequired: boolean;
  manualAckSatisfied: boolean;
  customerFacingIntent: boolean;
}): CapabilityDecisionSourceStep {
  if (input.manualAckRequired && !input.manualAckSatisfied) {
    return {
      step: "review_requirement",
      sourceType: "review-first",
      sourceRef: input.customerFacingIntent ? "customer_facing_review" : "manual_ack",
      outcome: "warn",
      note: input.customerFacingIntent
        ? "Customer-facing intent must route through review before proceeding."
        : "Manual acknowledgement is required before proceeding.",
    };
  }

  return {
    step: "review_requirement",
    sourceType: "review-first",
    sourceRef: input.customerFacingIntent ? "customer_facing_review" : "manual_ack",
    outcome: "pass",
    note: input.manualAckRequired
      ? "Manual acknowledgement is satisfied by the operator action."
      : "Review posture is visible for operator diagnostics.",
  };
}

function buildResourcePostureStep(input: {
  resourceIdentity: string;
  effectModeAllowed: boolean;
  actionable: boolean;
  primaryGap: TenantResourceReadinessReason | null;
  reviewRequired: boolean;
}): CapabilityDecisionSourceStep {
  if (!input.effectModeAllowed) {
    return {
      step: "resource_posture",
      sourceType: "tenant_resource_readiness",
      sourceRef: input.resourceIdentity,
      outcome: "block",
      note: "Requested effect mode exceeds this resource readiness posture.",
    };
  }

  if (!input.actionable) {
    return {
      step: "resource_posture",
      sourceType: "tenant_resource_readiness",
      sourceRef: input.resourceIdentity,
      outcome: "warn",
      note: input.primaryGap
        ? `Resource requires review before use: ${input.primaryGap}.`
        : "Resource is not currently actionable.",
    };
  }

  if (input.reviewRequired) {
    return {
      step: "resource_posture",
      sourceType: "tenant_resource_readiness",
      sourceRef: input.resourceIdentity,
      outcome: "warn",
      note: "Resource is actionable but still requires explicit review.",
    };
  }

  return {
    step: "resource_posture",
    sourceType: "tenant_resource_readiness",
    sourceRef: input.resourceIdentity,
    outcome: "pass",
    note: "Resource readiness allows this read-only trace posture.",
  };
}

function resolveCapabilityDecision(input: {
  activeWorkspaceId: string | null;
  enforceUserCapability: boolean;
  membershipRole: WorkspaceRole | null;
  requiredCapability: WorkspaceCapability | null;
  reservedOnly: boolean;
  reservedAllowed: boolean;
  declarationRequired: boolean;
  capabilityDeclared: boolean;
  resourcePosture: BuildCapabilityDecisionTraceInput["governance"]["resourcePosture"] | null;
  hardBoundaryBlocked: boolean;
  reviewRequired: boolean;
  manualAckRequired: boolean;
  manualAckSatisfied: boolean;
  customerFacingIntent: boolean;
}): {
  decision: CapabilityDecisionResultValue;
  primaryReasonCode: CapabilityDecisionReasonCode;
  secondaryReasonCodes: CapabilityDecisionReasonCode[];
  downgradePath: CapabilityDecisionResultValue[];
  fallbackType: CapabilityDecisionFallbackType;
} {
  if (!input.activeWorkspaceId) {
    return deny("workspace_missing");
  }

  if (input.enforceUserCapability && !input.membershipRole) {
    return deny("membership_missing");
  }

  if (
    input.enforceUserCapability &&
    input.requiredCapability &&
    !workspaceRoleHasCapability(input.membershipRole, input.requiredCapability)
  ) {
    return deny("capability_not_granted");
  }

  if (input.reservedOnly && !input.reservedAllowed) {
    return deny("reserved_only", ["ownership_mismatch"]);
  }

  if (input.declarationRequired && !input.capabilityDeclared) {
    return deny("capability_not_declared");
  }

  if (input.resourcePosture && !input.resourcePosture.effectModeAllowed) {
    return routeToReview("resource_effect_mode_exceeded", ["effect_mode_exceeded"]);
  }

  if (input.resourcePosture && !input.resourcePosture.actionable) {
    return routeToReview(
      input.resourcePosture.primaryGap === "freshness_unknown"
        ? "resource_freshness_unknown"
        : "resource_not_actionable",
      input.resourcePosture.primaryGap ? ["resource_review_required"] : [],
    );
  }

  if (input.resourcePosture?.reviewRequired && !input.manualAckSatisfied) {
    return routeToReview("resource_review_required", ["manual_ack_required"]);
  }

  if (input.hardBoundaryBlocked) {
    return deny("hard_boundary_blocked");
  }

  if ((input.reviewRequired || input.manualAckRequired) && !input.manualAckSatisfied) {
    if (input.customerFacingIntent) {
      return {
        decision: "route_to_review",
        primaryReasonCode: "customer_facing_review_required",
        secondaryReasonCodes: input.manualAckRequired ? ["manual_ack_required"] : [],
        downgradePath: ["allow", "route_to_review"],
        fallbackType: "review_queue",
      };
    }

    return {
      decision: "ask_human",
      primaryReasonCode: "manual_ack_required",
      secondaryReasonCodes: [],
      downgradePath: ["allow", "route_to_review", "ask_human"],
      fallbackType: "human_ack",
    };
  }

  return {
    decision: "allow",
    primaryReasonCode: "allowed",
    secondaryReasonCodes: [],
    downgradePath: [],
    fallbackType: "none",
  };
}

function deny(
  primaryReasonCode: CapabilityDecisionReasonCode,
  secondaryReasonCodes: CapabilityDecisionReasonCode[] = [],
) {
  return {
    decision: "deny" as const,
    primaryReasonCode,
    secondaryReasonCodes,
    downgradePath: ["allow", "route_to_review", "ask_human", "deny"] as CapabilityDecisionResultValue[],
    fallbackType: "blocked" as const,
  };
}

function routeToReview(
  primaryReasonCode: CapabilityDecisionReasonCode,
  secondaryReasonCodes: CapabilityDecisionReasonCode[] = [],
) {
  return {
    decision: "route_to_review" as const,
    primaryReasonCode,
    secondaryReasonCodes,
    downgradePath: ["allow", "route_to_review"] as CapabilityDecisionResultValue[],
    fallbackType: "review_queue" as const,
  };
}

function resolveDecisionActorType(actorType: ActorType | null | undefined): CapabilityDecisionActorType {
  if (actorType === ActorType.SYSTEM) {
    return "system";
  }

  return "user";
}

function buildStableKey(prefix: string, seed: string) {
  const normalized =
    seed
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 96) || "unknown";

  return `${prefix}_${normalized}`;
}
