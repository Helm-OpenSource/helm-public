import { ActorType, ActionExecutionMode, ActionStatus, ActionType, ApprovalStatus, SourceType } from "@prisma/client";
import {
  buildBiReportDirectSignalActionItemMetadata,
  mapBiReportSeverityToRiskLevel,
  mergeBiReportActionItemMetadata,
} from "@/lib/bi-report-skill/action-item-closure";
import { materializeAcceptedBiReportHandoff } from "@/lib/bi-report-skill/handoff-action";
import { createBiReportBusinessHandoffDecision } from "@/lib/bi-report-skill/handoff-decision";
import { writeAuditLog } from "@/lib/audit";
import { db } from "@/lib/db";
import type {
  BiReportBusinessSignalRecord,
  BiReportSignalRoutingApproverMapping,
  BiReportSignalRoutingConfig,
  BiReportSeverity,
} from "@/lib/bi-report-skill/types";

const BI_SIGNAL_KERNEL_BOUNDARY_NOTE =
  "BI signal operating closure kernel keeps a review-first chain. It does not auto-commit external high-risk actions.";

const DEFAULT_OWNER_PRESET_KEYS = ["OPERATIONS_FINANCE", "GENERAL_OPERATOR", "CUSTOMER_SUCCESS"] as const;
const DEFAULT_APPROVER_PRESET_KEYS = ["FOUNDER_CEO", "DELIVERY_LEAD", "SALES_LEAD"] as const;

type MembershipWithUserLite = {
  userId: string;
  role: string;
  rolePresetKey: string | null;
  user: {
    id: string;
    name: string;
    email: string;
  };
};

type ClosureKernelSummary = {
  signalEventUpserted: boolean;
  actionItemUpserted: boolean;
  approvalTaskUpserted: boolean;
  recommendationUpserted: boolean;
  guardBlocked: boolean;
  guardReasons: string[];
};

export async function syncBiReportSignalToOperatingClosure(input: {
  signal: BiReportBusinessSignalRecord;
  extensionKey?: string | null;
  signalRouting?: BiReportSignalRoutingConfig;
}): Promise<ClosureKernelSummary> {
  const summary: ClosureKernelSummary = {
    signalEventUpserted: false,
    actionItemUpserted: false,
    approvalTaskUpserted: false,
    recommendationUpserted: false,
    guardBlocked: false,
    guardReasons: [],
  };

  const signal = input.signal;
  if (signal.status === "resolved" || signal.status === "dismissed") {
    return summary;
  }

  const runtimeSession = await ensureKernelRuntimeSession({
    workspaceId: signal.workspaceId,
    extensionKey: input.extensionKey,
  });
  await upsertSignalEvent({
    runtimeSessionId: runtimeSession.id,
    signal,
  });
  summary.signalEventUpserted = true;

  const activeMemberships = await listActiveMembershipsWithUsers(signal.workspaceId);
  const routingConfig = normalizeRoutingConfig(input.signalRouting);

  const owner = resolveOwnerMembership({
    signal,
    memberships: activeMemberships,
  });
  const approver = resolveApproverMembership({
    routing: routingConfig,
    memberships: activeMemberships,
  });
  const notificationTarget = signal.ownerUserEmail?.trim() || owner?.user.email?.trim() || null;

  const guardReasons = collectGuardReasons({
    severity: signal.severity,
    routing: routingConfig,
    owner,
    approver,
    notificationTarget,
  });
  if (guardReasons.length > 0) {
    summary.guardBlocked = true;
    summary.guardReasons = guardReasons;
    await persistGuardBlocks({
      workspaceId: signal.workspaceId,
      signal,
      reasons: guardReasons,
    });
    return summary;
  }

  if (!signal.ownerUserId && owner) {
    await db.biReportBusinessSignal.update({
      where: { id: signal.id },
      data: {
        ownerUserId: owner.user.id,
        ownerUserName: owner.user.name,
        ownerUserEmail: owner.user.email,
      },
    });
  }

  // Hard dedupe: once a signal has entered the canonical BI handoff approval path,
  // we stop generating the legacy direct "[BI信号]" action/approval to avoid duplicates.
  // Canonical materialization (bi-report-handoff:<decisionId>) will produce the actionItem
  // + approval task and is the only path we want visible in /approvals.
  const requiresApproval = signal.severity === "CRITICAL" || signal.severity === "ALERT";
  if (requiresApproval) {
    const acceptedApprovalDecision = await db.biReportBusinessHandoffDecision.findFirst({
      where: {
        workspaceId: signal.workspaceId,
        signalId: signal.id,
        targetType: "approval",
        status: "accepted",
      },
      select: { id: true },
    });
    if (acceptedApprovalDecision) {
      return summary;
    }
  }

  // Outsourcing (HP) signals can be extremely high volume at row level. To keep
  // /approvals usable, only the roll-up manager intervention signal should
  // materialize an approval task. Row-level signals should not create approvals.
  if (
    signal.skillKey === "bi_outsourcing_operating_signal_daily" &&
    signal.signalType !== "hp.manager_intervention_required"
  ) {
    return summary;
  }

  // Outsourcing manager roll-up should always go through canonical BI handoff
  // so /approvals shows "经营审批：" (not the legacy BI closure kernel panel).
  if (
    signal.skillKey === "bi_outsourcing_operating_signal_daily" &&
    signal.signalType === "hp.manager_intervention_required" &&
    requiresApproval
  ) {
    const decision = await createBiReportBusinessHandoffDecision({
      workspaceId: signal.workspaceId,
      signalId: signal.id,
      targetType: "approval",
      status: "accepted",
      reviewedByUserId: null,
      reviewComment: "system: auto-route outsourcing manager roll-up to 经营审批",
    });

    if (decision) {
      const materialized = await materializeAcceptedBiReportHandoff({
        workspaceId: signal.workspaceId,
        actorUserId: null,
        actorType: ActorType.SYSTEM,
        actorName: "系统",
        signal,
        decision,
      });
      if (materialized?.approvalTaskId) {
        return { ...summary, actionItemUpserted: true, approvalTaskUpserted: true };
      }
    }
  }

  const actionItem = await upsertActionItem({
    signal,
    ownerUserId: owner?.user.id ?? signal.ownerUserId ?? null,
  });
  summary.actionItemUpserted = true;

  const recommendation = await upsertRecommendationLog({
    signal,
    actionItemId: actionItem.id,
    ownerUserId: owner?.user.id ?? signal.ownerUserId ?? null,
  });
  summary.recommendationUpserted = true;

  if (actionItem.recommendationLogId !== recommendation.id) {
    await db.actionItem.update({
      where: { id: actionItem.id },
      data: { recommendationLogId: recommendation.id },
    });
  }

  if (actionItem.requiresApproval) {
    await upsertApprovalTask({
      workspaceId: signal.workspaceId,
      actionItemId: actionItem.id,
      approverUserId: approver?.user.id ?? null,
      signal,
    });
    summary.approvalTaskUpserted = true;
  }

  return summary;
}

async function ensureKernelRuntimeSession(input: {
  workspaceId: string;
  extensionKey?: string | null;
}) {
  const scope = input.extensionKey?.trim() || "default";
  const sessionKey = `${input.workspaceId}:bi-operating-closure:${scope}`;
  return db.runtimeSession.upsert({
    where: { sessionKey },
    update: {
      status: "ACTIVE",
      currentStage: "bi_signal_closure",
      sourcePage: "/reports?tab=bi-report",
      boundaryNote: BI_SIGNAL_KERNEL_BOUNDARY_NOTE,
    },
    create: {
      workspaceId: input.workspaceId,
      sessionKey,
      label: "BI operating closure kernel",
      status: "ACTIVE",
      currentStage: "bi_signal_closure",
      sourcePage: "/reports?tab=bi-report",
      boundaryNote: BI_SIGNAL_KERNEL_BOUNDARY_NOTE,
      budgetTokenLimit: 2000,
      replayableEventLog: JSON.stringify([
        {
          stage: "bi_signal_closure",
          at: new Date().toISOString(),
        },
      ]),
    },
  });
}

async function upsertSignalEvent(input: {
  runtimeSessionId: string;
  signal: BiReportBusinessSignalRecord;
}) {
  const signalEventKey = `bi_signal:${input.signal.workspaceId}:${input.signal.signalKey}`;
  const payload = JSON.stringify({
    sourceRunId: input.signal.sourceRunId,
    skillKey: input.signal.skillKey,
    severity: input.signal.severity,
    continuityStatus: input.signal.continuityStatus,
    dimensions: input.signal.dimensions,
    metrics: input.signal.metrics,
    evidence: input.signal.evidence,
    recommendedActions: input.signal.recommendedActions,
  });
  await db.signalEvent.upsert({
    where: { signalKey: signalEventKey },
    update: {
      signalSummary: input.signal.summary,
      sourceType: "BI_REPORT_BUSINESS_SIGNAL",
      normalizedPayload: payload,
      truthWeight: mapSeverityToTruthWeight(input.signal.severity),
    },
    create: {
      workspaceId: input.signal.workspaceId,
      runtimeSessionId: input.runtimeSessionId,
      signalKey: signalEventKey,
      signalType: input.signal.signalType,
      sourceType: "BI_REPORT_BUSINESS_SIGNAL",
      signalSummary: input.signal.summary,
      normalizedPayload: payload,
      truthWeight: mapSeverityToTruthWeight(input.signal.severity),
    },
  });
}

function mapSeverityToTruthWeight(severity: BiReportSeverity) {
  if (severity === "CRITICAL") return 90;
  if (severity === "ALERT") return 75;
  if (severity === "WARN") return 60;
  if (severity === "WATCH") return 40;
  return 20;
}

async function upsertActionItem(input: {
  signal: BiReportBusinessSignalRecord;
  ownerUserId: string | null;
}) {
  // If this signal already has an accepted canonical BI handoff approval decision,
  // prefer the handoff-materialized action item to avoid duplicating a direct
  // "[BI信号]" action/approval task (sourceId = signalId).
  const requiresApproval =
    input.signal.severity === "CRITICAL" || input.signal.severity === "ALERT";
  if (requiresApproval) {
    const acceptedApprovalDecision = await db.biReportBusinessHandoffDecision.findFirst({
      where: {
        workspaceId: input.signal.workspaceId,
        signalId: input.signal.id,
        targetType: "approval",
        status: "accepted",
      },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    });

    if (acceptedApprovalDecision) {
      const canonical = await db.actionItem.findFirst({
        where: {
          workspaceId: input.signal.workspaceId,
          sourceType: SourceType.SYSTEM_INFERENCE,
          sourceId: `bi-report-handoff:${acceptedApprovalDecision.id}`,
        },
      });
      if (canonical) {
        return canonical;
      }
    }
  }

  const existing = await db.actionItem.findFirst({
    where: {
      workspaceId: input.signal.workspaceId,
      sourceType: SourceType.SYSTEM_INFERENCE,
      sourceId: input.signal.id,
    },
  });

  const executionMode = requiresApproval
    ? ActionExecutionMode.REQUIRES_APPROVAL
    : ActionExecutionMode.SUGGEST_ONLY;
  const status = requiresApproval ? ActionStatus.PENDING_APPROVAL : ActionStatus.SUGGESTED;
  const description = buildActionDescription(input.signal);
  const riskLevel = mapBiReportSeverityToRiskLevel(input.signal.severity);
  const actionPrefix =
    input.signal.skillKey === "bi_outsourcing_operating_signal_daily" ? "[经营信号]" : "[BI信号]";
  const { dueDate, metadata } = buildBiReportDirectSignalActionItemMetadata({
    signal: input.signal,
    sourceId: input.signal.id,
  });
  let dueDateToPersist = dueDate;
  let metadataJson = JSON.stringify(metadata);

  if (existing) {
    // Avoid SLA drift on retries: keep the existing SLA/dueDate if the policy
    // hasn't changed. We still refresh source fields / ids.
    const existingClosure = (() => {
      if (!existing.metadata) return null;
      try {
        return JSON.parse(existing.metadata) as {
          operating_closure?: {
            sla?: { policyHours?: number; slaDueAt?: string };
          };
        };
      } catch {
        return null;
      }
    })();
    const existingPolicyHours = existingClosure?.operating_closure?.sla?.policyHours;
    const nextPolicyHours = metadata.operating_closure.sla.policyHours;
    if (typeof existingPolicyHours === "number" && existingPolicyHours === nextPolicyHours) {
      if (existing.dueDate) {
        dueDateToPersist = existing.dueDate;
      }
      metadataJson = mergeBiReportActionItemMetadata(existing.metadata, {
        operating_closure: { source: metadata.operating_closure.source },
        biReportSignalId: metadata.biReportSignalId,
        biReportSignalKey: metadata.biReportSignalKey,
        biReportSkillKey: metadata.biReportSkillKey,
        biReportSignalType: metadata.biReportSignalType,
      });
    }

    return db.actionItem.update({
      where: { id: existing.id },
      data: {
        title: `${actionPrefix} ${input.signal.title}`,
        description,
        aiReason: "generated_from_bi_signal",
        ownerId: input.ownerUserId ?? existing.ownerId,
        riskLevel,
        executionMode,
        requiresApproval,
        status,
        dueDate: dueDateToPersist,
        metadata: metadataJson,
      },
    });
  }

  return db.actionItem.create({
    data: {
      workspaceId: input.signal.workspaceId,
      ownerId: input.ownerUserId,
      actionType: ActionType.CREATE_TASK,
      title: `${actionPrefix} ${input.signal.title}`,
      description,
      aiReason: "generated_from_bi_signal",
      sourceType: SourceType.SYSTEM_INFERENCE,
      sourceId: input.signal.id,
      riskLevel,
      executionMode,
      requiresApproval,
      status,
      executionStatus: "pending",
      dueDate: dueDateToPersist,
      metadata: metadataJson,
    },
  });
}

async function upsertRecommendationLog(input: {
  signal: BiReportBusinessSignalRecord;
  actionItemId: string;
  ownerUserId: string | null;
}) {
  const existing = await db.recommendationLog.findFirst({
    where: {
      workspaceId: input.signal.workspaceId,
      objectType: "ACTION_ITEM",
      objectId: input.actionItemId,
      status: "ACTIVE",
    },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    return db.recommendationLog.update({
      where: { id: existing.id },
      data: {
        title: input.signal.title,
        description: input.signal.summary,
        recommendationPayload: JSON.stringify({
          signalId: input.signal.id,
          skillKey: input.signal.skillKey,
          recommendedActions: input.signal.recommendedActions,
        }),
        score: mapSeverityToTruthWeight(input.signal.severity),
        urgencyScore: mapSeverityToTruthWeight(input.signal.severity),
        impactScore: mapSeverityToTruthWeight(input.signal.severity),
        confidenceScore: mapSeverityToTruthWeight(input.signal.severity),
      },
    });
  }

  return db.recommendationLog.create({
    data: {
      workspaceId: input.signal.workspaceId,
      userId: input.ownerUserId,
      objectType: "ACTION_ITEM",
      objectId: input.actionItemId,
      actionType: ActionType.CREATE_TASK,
      title: input.signal.title,
      description: input.signal.summary,
      recommendationPayload: JSON.stringify({
        signalId: input.signal.id,
        skillKey: input.signal.skillKey,
        recommendedActions: input.signal.recommendedActions,
      }),
      score: mapSeverityToTruthWeight(input.signal.severity),
      urgencyScore: mapSeverityToTruthWeight(input.signal.severity),
      impactScore: mapSeverityToTruthWeight(input.signal.severity),
      confidenceScore: mapSeverityToTruthWeight(input.signal.severity),
      personalizationScore: 0,
      policyFitScore: 70,
      riskScore: mapSeverityToTruthWeight(input.signal.severity),
      policyResult: ActionExecutionMode.REQUIRES_APPROVAL,
      explanation: "BI signal closure kernel generated a review-first action recommendation.",
      status: "ACTIVE",
    },
  });
}

async function upsertApprovalTask(input: {
  workspaceId: string;
  actionItemId: string;
  approverUserId: string | null;
  signal: BiReportBusinessSignalRecord;
}) {
  const contextSnapshot = JSON.stringify({
    source: "bi_signal_closure_kernel",
    signalId: input.signal.id,
    signalKey: input.signal.signalKey,
    severity: input.signal.severity,
  });
  await db.approvalTask.upsert({
    where: { actionItemId: input.actionItemId },
    update: {
      approverId: input.approverUserId,
      status: ApprovalStatus.PENDING,
      channel: "bi_signal_approval",
      isHighRisk: input.signal.severity === "CRITICAL",
      autoExecute: false,
      contextSnapshot,
      reasoning: "BI signal closure kernel requires approver review before execution.",
    },
    create: {
      workspaceId: input.workspaceId,
      actionItemId: input.actionItemId,
      approverId: input.approverUserId,
      status: ApprovalStatus.PENDING,
      channel: "bi_signal_approval",
      isHighRisk: input.signal.severity === "CRITICAL",
      autoExecute: false,
      contextSnapshot,
      reasoning: "BI signal closure kernel requires approver review before execution.",
    },
  });
}

function buildActionDescription(signal: BiReportBusinessSignalRecord) {
  const recommended = signal.recommendedActions.length > 0
    ? signal.recommendedActions.map((item, index) => `${index + 1}. ${item}`).join("\n")
    : "1. 核对异常来源\n2. 指定责任人与完成时限\n3. 次日回写执行结果";
  return [
    signal.summary,
    "",
    "建议动作：",
    recommended,
  ].join("\n");
}

async function listActiveMembershipsWithUsers(workspaceId: string) {
  return db.membership.findMany({
    where: {
      workspaceId,
      status: "ACTIVE",
    },
    select: {
      userId: true,
      role: true,
      rolePresetKey: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      joinedAt: "asc",
    },
  }) as Promise<MembershipWithUserLite[]>;
}

function normalizeRoutingConfig(signalRouting?: BiReportSignalRoutingConfig | null) {
  return {
    requireOwnerForCritical: signalRouting?.requireOwnerForCritical ?? true,
    requireApproverForCritical: signalRouting?.requireApproverForCritical ?? true,
    requireNotificationTargetForCritical: signalRouting?.requireNotificationTargetForCritical ?? true,
    approverMappings: signalRouting?.approverMappings ?? [],
  };
}

function resolveOwnerMembership(input: {
  signal: BiReportBusinessSignalRecord;
  memberships: MembershipWithUserLite[];
}) {
  if (input.signal.ownerUserId) {
    const matched = input.memberships.find((membership) => membership.user.id === input.signal.ownerUserId);
    if (matched) {
      return matched;
    }
  }

  const byPreset = input.memberships.find((membership) =>
    membership.rolePresetKey != null &&
    DEFAULT_OWNER_PRESET_KEYS.includes(membership.rolePresetKey as (typeof DEFAULT_OWNER_PRESET_KEYS)[number]),
  );
  if (byPreset) {
    return byPreset;
  }

  return input.memberships.find((membership) =>
    membership.role === "OWNER" || membership.role === "ADMIN" || membership.role === "OPERATOR",
  ) ?? null;
}

function resolveApproverMembership(input: {
  routing: {
    approverMappings: BiReportSignalRoutingApproverMapping[];
  };
  memberships: MembershipWithUserLite[];
}) {
  for (const mapping of input.routing.approverMappings) {
    const helmUserId = mapping.helmUserId?.trim();
    if (helmUserId) {
      const matchedById = input.memberships.find((membership) => membership.user.id === helmUserId);
      if (matchedById) return matchedById;
    }

    const userEmail = mapping.userEmail?.trim().toLowerCase();
    if (userEmail) {
      const matchedByEmail = input.memberships.find(
        (membership) => membership.user.email.toLowerCase() === userEmail,
      );
      if (matchedByEmail) return matchedByEmail;
    }

    const rolePresetKey = mapping.rolePresetKey?.trim();
    if (rolePresetKey) {
      const matchedByPreset = input.memberships.find(
        (membership) => membership.rolePresetKey === rolePresetKey,
      );
      if (matchedByPreset) return matchedByPreset;
    }
  }

  const presetFallback = input.memberships.find((membership) =>
    membership.rolePresetKey != null &&
    DEFAULT_APPROVER_PRESET_KEYS.includes(membership.rolePresetKey as (typeof DEFAULT_APPROVER_PRESET_KEYS)[number]),
  );
  if (presetFallback) {
    return presetFallback;
  }

  return input.memberships.find((membership) =>
    membership.role === "OWNER" || membership.role === "BILLING_ADMIN" || membership.role === "ADMIN",
  ) ?? null;
}

function collectGuardReasons(input: {
  severity: BiReportSeverity;
  routing: {
    requireOwnerForCritical: boolean;
    requireApproverForCritical: boolean;
    requireNotificationTargetForCritical: boolean;
  };
  owner: MembershipWithUserLite | null;
  approver: MembershipWithUserLite | null;
  notificationTarget: string | null;
}) {
  const reasons: string[] = [];
  if (input.severity !== "CRITICAL") {
    return reasons;
  }

  if (input.routing.requireOwnerForCritical && !input.owner) {
    reasons.push("missing_owner_mapping");
  }
  if (input.routing.requireApproverForCritical && !input.approver) {
    reasons.push("missing_approver_mapping");
  }
  if (input.routing.requireNotificationTargetForCritical && !input.notificationTarget) {
    reasons.push("missing_notification_target");
  }
  return reasons;
}

async function persistGuardBlocks(input: {
  workspaceId: string;
  signal: BiReportBusinessSignalRecord;
  reasons: string[];
}) {
  for (const reason of input.reasons) {
    const targetType = `closure_guard_${reason}`;
    const existing = await db.biReportBusinessHandoffDecision.findFirst({
      where: {
        workspaceId: input.workspaceId,
        signalId: input.signal.id,
        targetType,
        status: "open",
      },
      select: { id: true },
    });
    if (!existing) {
      await db.biReportBusinessHandoffDecision.create({
        data: {
          id: crypto.randomUUID(),
          workspaceId: input.workspaceId,
          signalId: input.signal.id,
          targetType,
          status: "open",
          reviewComment: `Critical signal blocked by closure guard: ${reason}`,
        },
      });
    }
  }

  await writeAuditLog({
    workspaceId: input.workspaceId,
    actor: "BI signal closure kernel",
    actorType: ActorType.SYSTEM,
    actionType: "BI_SIGNAL_CLOSURE_GUARD_BLOCKED",
    targetType: "BiReportBusinessSignal",
    targetId: input.signal.id,
    summary: `Critical signal blocked by closure guard: ${input.reasons.join(", ")}`,
    payload: {
      signalKey: input.signal.signalKey,
      severity: input.signal.severity,
      reasons: input.reasons,
    },
    sourcePage: "/reports?tab=bi-report",
  });
}
