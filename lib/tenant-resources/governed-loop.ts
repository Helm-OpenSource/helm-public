import {
  buildCapabilityDecisionOperatorReadout,
  buildTenantResourceCapabilityDecisionTrace,
  type CapabilityDecisionTrace,
  type CapabilityDecisionOperatorReadout,
} from "@/lib/capability-decision-trace";
import type { ActorType, WorkspaceClass, WorkspaceRole } from "@prisma/client";
import type { WorkspaceCapability } from "@/lib/auth/authorization";
import type {
  TenantResourceEffectMode,
  TenantResourceReadiness,
} from "@/lib/tenant-resources/readiness";

export type TenantResourceGovernedLoopStage =
  | "observe"
  | "judge"
  | "govern"
  | "act"
  | "verify"
  | "learn";

export type TenantResourceGovernedLoopStatus =
  | "ready_for_manual_proof"
  | "route_to_review"
  | "blocked"
  | "stale_or_failed";

export type TenantResourceGovernedLoopInput = {
  now?: Date;
  actorUserId?: string | null;
  actorType?: ActorType | null;
  activeWorkspaceId: string | null;
  workspaceClass?: WorkspaceClass | null;
  membershipRole?: WorkspaceRole | null;
  requiredCapability?: WorkspaceCapability | null;
  resource: TenantResourceReadiness;
  requestedEffectMode?: TenantResourceEffectMode;
  signal: {
    signalId: string;
    title: string;
    objectType: string;
    objectRef: string;
    summary: string;
    evidenceRefs?: string[];
  };
};

export type TenantResourceGovernedLoop = {
  loopKey: string;
  generatedAt: string;
  resourceIdentity: string;
  sourcePosture: {
    status: TenantResourceReadiness["status"];
    trustLevel: TenantResourceReadiness["governance"]["trustLevel"];
    primaryGap: TenantResourceReadiness["readiness"]["primaryGap"];
  };
  capabilityTrace: CapabilityDecisionTrace;
  capabilityReadout: CapabilityDecisionOperatorReadout;
  judgement: {
    title: string;
    summary: string;
    confidence: "low" | "medium" | "high";
    evidenceRefs: string[];
  };
  nextAction: {
    title: string;
    mode: "manual_execution_proof" | "draft_only" | "review_queue" | "blocked";
    effectMode: TenantResourceEffectMode;
    boundaryNotes: string[];
    evidenceRefs: string[];
  };
  followThrough: {
    status: TenantResourceGovernedLoopStatus;
    proofRequired: boolean;
    failureMode: string | null;
    nextOwner: "operator" | "reviewer" | "none";
  };
  summaries: {
    memory: string;
    report: string;
    handoff: string;
  };
  steps: Array<{
    stage: TenantResourceGovernedLoopStage;
    status: "ready" | "review" | "blocked";
    note: string;
  }>;
};

export function buildTenantResourceGovernedLoop(
  input: TenantResourceGovernedLoopInput,
): TenantResourceGovernedLoop {
  const generatedAt = (input.now ?? new Date()).toISOString();
  const requestedEffectMode =
    input.requestedEffectMode ??
    input.resource.governance.allowedEffectModes.at(-1) ??
    "read_only";
  const trace = buildTenantResourceCapabilityDecisionTrace({
    actorUserId: input.actorUserId,
    actorType: input.actorType,
    activeWorkspaceId: input.activeWorkspaceId,
    workspaceClass: input.workspaceClass,
    membershipRole: input.membershipRole,
    resource: input.resource,
    requestedEffectMode,
    requiredCapability: input.requiredCapability,
    requestSource: "lib/tenant-resources/governed-loop.ts",
    now: input.now,
  });
  const capabilityReadout = buildCapabilityDecisionOperatorReadout(trace);
  const evidenceRefs = uniqueStrings([
    ...input.resource.evidenceRefs,
    ...(input.signal.evidenceRefs ?? []),
  ]);
  const followThroughStatus = resolveFollowThroughStatus({
    resource: input.resource,
    decision: capabilityReadout.decision,
  });
  const nextActionMode = resolveNextActionMode({
    status: followThroughStatus,
    requestedEffectMode,
  });

  return {
    loopKey: buildStableKey(
      "tenant_resource_loop",
      `${input.resource.resourceKey}:${input.signal.signalId}:${requestedEffectMode}`,
    ),
    generatedAt,
    resourceIdentity: input.resource.resourceKey,
    sourcePosture: {
      status: input.resource.status,
      trustLevel: input.resource.governance.trustLevel,
      primaryGap: input.resource.readiness.primaryGap,
    },
    capabilityTrace: trace,
    capabilityReadout,
    judgement: {
      title: `Judge ${input.signal.title}`,
      summary: `${input.resource.resourceName} can support this judgement only through ${capabilityReadout.decision}. ${input.signal.summary}`,
      confidence: input.resource.readiness.actionable ? "high" : "medium",
      evidenceRefs,
    },
    nextAction: {
      title: buildNextActionTitle(input.signal.title, nextActionMode),
      mode: nextActionMode,
      effectMode: requestedEffectMode,
      boundaryNotes: [
        "governed loop stays review-first and does not write to the external resource",
        ...input.resource.readiness.boundaryNotes,
      ],
      evidenceRefs,
    },
    followThrough: {
      status: followThroughStatus,
      proofRequired: nextActionMode === "manual_execution_proof",
      failureMode:
        followThroughStatus === "stale_or_failed"
          ? input.resource.readiness.primaryGap ?? "resource_not_actionable"
          : followThroughStatus === "blocked"
            ? capabilityReadout.primaryReasonCode
            : null,
      nextOwner:
        followThroughStatus === "blocked"
          ? "none"
          : followThroughStatus === "route_to_review" || followThroughStatus === "stale_or_failed"
            ? "reviewer"
            : "operator",
    },
    summaries: {
      memory: `${input.signal.objectType}:${input.signal.objectRef} judged from ${input.resource.resourceName}; decision=${capabilityReadout.decision}; fallback=${capabilityReadout.fallbackType}.`,
      report: `${input.signal.title}: ${capabilityReadout.decision} via ${input.resource.provider}, evidence ${evidenceRefs.length}.`,
      handoff: `Next owner should ${describeNextOwnerAction(followThroughStatus)}; resource=${input.resource.resourceKey}; reason=${capabilityReadout.primaryReasonCode}.`,
    },
    steps: buildLoopSteps({
      resource: input.resource,
      capabilityReadout,
      followThroughStatus,
      nextActionMode,
    }),
  };
}

function resolveFollowThroughStatus(input: {
  resource: TenantResourceReadiness;
  decision: CapabilityDecisionOperatorReadout["decision"];
}): TenantResourceGovernedLoopStatus {
  if (input.decision === "deny") return "blocked";
  if (input.resource.readiness.primaryGap === "freshness_unknown") return "stale_or_failed";
  if (input.decision === "route_to_review" || input.decision === "ask_human") {
    return "route_to_review";
  }
  return "ready_for_manual_proof";
}

function resolveNextActionMode(input: {
  status: TenantResourceGovernedLoopStatus;
  requestedEffectMode: TenantResourceEffectMode;
}): TenantResourceGovernedLoop["nextAction"]["mode"] {
  if (input.status === "blocked") return "blocked";
  if (input.status === "route_to_review" || input.status === "stale_or_failed") {
    return "review_queue";
  }
  if (input.requestedEffectMode === "manual_execution") return "manual_execution_proof";
  return "draft_only";
}

function buildNextActionTitle(
  signalTitle: string,
  mode: TenantResourceGovernedLoop["nextAction"]["mode"],
) {
  if (mode === "manual_execution_proof") {
    return `Prepare manual execution proof for ${signalTitle}`;
  }
  if (mode === "review_queue") {
    return `Route ${signalTitle} through resource review`;
  }
  if (mode === "blocked") {
    return `Do not act on ${signalTitle}`;
  }
  return `Draft next action for ${signalTitle}`;
}

function describeNextOwnerAction(status: TenantResourceGovernedLoopStatus) {
  if (status === "ready_for_manual_proof") {
    return "execute manually and attach proof before learning";
  }
  if (status === "stale_or_failed") {
    return "refresh or repair the resource before judgement";
  }
  if (status === "route_to_review") {
    return "review the resource posture before action";
  }
  return "stop because the capability trace is blocked";
}

function buildLoopSteps(input: {
  resource: TenantResourceReadiness;
  capabilityReadout: CapabilityDecisionOperatorReadout;
  followThroughStatus: TenantResourceGovernedLoopStatus;
  nextActionMode: TenantResourceGovernedLoop["nextAction"]["mode"];
}): TenantResourceGovernedLoop["steps"] {
  const blocked = input.followThroughStatus === "blocked";
  const needsReview =
    input.followThroughStatus === "route_to_review" ||
    input.followThroughStatus === "stale_or_failed";

  return [
    {
      stage: "observe",
      status: input.resource.connection.readCapability ? "ready" : "blocked",
      note: `Observed ${input.resource.resourceKey} with status ${input.resource.status}.`,
    },
    {
      stage: "judge",
      status: input.resource.readiness.actionable ? "ready" : "review",
      note: input.resource.readiness.operatorNextMove,
    },
    {
      stage: "govern",
      status: blocked ? "blocked" : needsReview ? "review" : "ready",
      note: `Capability decision ${input.capabilityReadout.decision} for ${input.capabilityReadout.effectMode}.`,
    },
    {
      stage: "act",
      status: blocked ? "blocked" : needsReview ? "review" : "ready",
      note: `Next action mode ${input.nextActionMode}; no external write is performed by this loop.`,
    },
    {
      stage: "verify",
      status: blocked ? "blocked" : "review",
      note: "Manual proof or review result must be attached before closure.",
    },
    {
      stage: "learn",
      status: blocked ? "blocked" : "review",
      note: "Memory/report/handoff receive a summary candidate, not an automatic canonical write.",
    },
  ];
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
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
