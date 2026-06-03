"use server";

import { ActionExecutionMode, ActionStatus, ActionType, ActorType, ApprovalStatus, UsageType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { generatePostMeetingActionSuggestions } from "@/lib/ai";
import { logEvent } from "@/lib/analytics";
import { createGovernedAction, executeActionItem } from "@/lib/policies/engine";
import { writeAuditLog } from "@/lib/audit";
import { ensureWorkspaceProcessingAllowed, recordUsageLedgerEntry } from "@/lib/billing/foundation";
import { getCurrentWorkspace, getCurrentWorkspaceSession, requireCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { reviewDraftCommsRuntime, runDraftCommsHandoffRuntime } from "@/lib/helm-v2/draft-comms-handoff-runtime";
import {
  acknowledgeHumanActionExecution,
  syncMeetingHumanActionExecutionRuntime,
  type HumanActionExecutionAckMode,
} from "@/lib/helm-v2/human-action-execution-runtime";
import {
  acknowledgeOfficialWriteIntent,
  attemptOfficialWriteIntent,
  reviewLimitedAutoIntent,
  reviewOfficialWriteIntent,
  syncMeetingOfficialFollowThroughRuntime,
  syncMeetingLimitedAutoIntents,
  syncMeetingOfficialWriteIntents,
  updateOfficialFollowThrough,
  type OfficialFollowThroughUpdateMode,
  type LimitedAutoReviewMode,
  type OfficialWriteAcknowledgementMode,
  type OfficialWriteReviewMode,
} from "@/lib/helm-v2/official-system-integration-runtime";
import { processMeetingMemory } from "@/lib/memory/meeting-memory-pipeline.service";
import { confirmMeetingFactsRuntime, ingestMeetingEndedRuntime } from "@/lib/helm-v2/meeting-action-pack-runtime";
import { reviewOpportunityJudgeRuntime, runOpportunityJudgeRuntime } from "@/lib/helm-v2/opportunity-judge-runtime";
import {
  canReviewWorkspaceRuntime,
  canManageWorkspaceRuntime,
  getRuntimeReviewDeniedMessage,
  getRuntimeManagementDeniedMessage,
} from "@/lib/auth/capture-runtime-governance";
import { resolveBilingualApiValidationIssueMessage } from "@/lib/i18n/api-message-locale";
import {
  acknowledgeRuntimeHumanInputCheckpointRequest,
  acknowledgeRuntimeOperatorTakeoverRequest,
  acceptReflectionCandidate,
  queueConsolidationJob,
  dismissReflectionCandidate,
  queueReflectionJob,
  confirmRuntimeRunThreadCloseout,
  requestRuntimeRunThreadClose,
  recordRuntimeRunThreadCloseoutResolution,
  requestRuntimeRunThreadCloseoutResolutionFollowThrough,
  requestRuntimeRunThreadCloseoutRefresh,
  releaseRuntimeOperatorTakeover,
  resumeRuntimeCheckpoint,
  requestRuntimeRunThreadSettlementReview,
  requestRuntimeSwarmSpawn,
  recordRuntimeSwarmReadOnlyWorkerIntent,
  recordRuntimeSwarmReadOnlyWorkerPlaceholder,
  recordRuntimeSwarmReadOnlyWorkerExecution,
  recordRuntimeSwarmReadOnlyWorkerMaterialization,
  recordRuntimeSwarmReadOnlyWorkerAdoption,
  recordRuntimeSwarmVerificationMergeLane,
  requestRuntimeOperatorTakeoverFollowThrough,
  requestRuntimeHumanInputCheckpoint,
  requestRuntimeOperatorTakeover,
  resolveRuntimeRunThreadCloseoutResolutionFollowThrough,
  resolveRuntimeRunThreadSettlementReview,
  resolveRuntimeOperatorTakeoverFollowThrough,
  runRuntimeContinuityRemediation,
  startRuntimeOperatorTakeover,
  updateConsolidationJobStatus,
} from "@/lib/helm-v2/runtime-upgrade";
import {
  canManageWorkspaceGovernedActions,
  canReviewWorkspaceGovernedActions,
  getGovernedActionManagementDeniedMessage,
  getGovernedActionReviewDeniedMessage,
} from "@/lib/auth/action-governance";
import {
  canManageWorkspaceMemory,
  getMemoryManagementDeniedMessage,
} from "@/lib/memory/permissions";
import {
  getWorkspaceAssignableOwnerDeniedMessage,
  resolveWorkspaceAssignableOwnerId,
} from "@/lib/auth/workspace-data-governance";
import {
  assertWorkspaceConsolidationJobOwnership,
  assertWorkspaceMemoryCandidateOwnership,
  assertWorkspaceMeetingOwnership,
  assertWorkspaceRuntimeSessionOwnership,
} from "@/lib/auth/tenant-ownership";

async function requireMeetingActionGovernanceSession(mode: "manage" | "review") {
  const session = await getCurrentWorkspaceSession();
  const english = session.workspace.defaultLocale === "en-US";
  const allowed =
    mode === "manage"
      ? canManageWorkspaceGovernedActions(session.membership.role)
      : canReviewWorkspaceGovernedActions(session.membership.role);

  if (!allowed) {
    return {
      ok: false as const,
      error:
        mode === "manage"
          ? getGovernedActionManagementDeniedMessage(english)
          : getGovernedActionReviewDeniedMessage(english),
    };
  }

  return {
    ok: true as const,
    english,
    ...session,
  };
}

async function getMeetingOwnershipError(workspaceId: string, meetingId: string, english: boolean) {
  try {
    await assertWorkspaceMeetingOwnership(workspaceId, meetingId);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : english ? "Meeting not found" : "会议不存在";
  }
}

async function getRuntimeSessionOwnershipError(workspaceId: string, sessionId: string, english: boolean) {
  try {
    await assertWorkspaceRuntimeSessionOwnership(workspaceId, sessionId);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : english ? "Runtime session not found" : "运行时 session 不存在";
  }
}

async function getConsolidationJobOwnershipError(workspaceId: string, jobId: string, english: boolean) {
  try {
    await assertWorkspaceConsolidationJobOwnership(workspaceId, jobId);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : english ? "Consolidation job not found" : "整合 job 不存在";
  }
}

async function getMemoryCandidateOwnershipError(workspaceId: string, candidateId: string, english: boolean) {
  try {
    await assertWorkspaceMemoryCandidateOwnership(workspaceId, candidateId);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : english ? "Memory candidate not found" : "经营记忆候选不存在";
  }
}

export async function sendMeetingSummaryAction(meetingId: string) {
  const session = await requireMeetingActionGovernanceSession("manage");
  if (!session.ok) {
    return { ok: false, error: session.error };
  }

  const { user, workspace, english } = session;
  const meeting = await db.meeting.findFirst({
    where: {
      id: meetingId,
      workspaceId: workspace.id,
    },
    include: { note: true, opportunity: true, contacts: true },
  });

  if (!meeting) return { ok: false, error: english ? "Meeting not found" : "会议不存在" };

  const result = await createGovernedAction({
    workspaceId: workspace.id,
    actorName: user.name,
    actorUserId: user.id,
    actorType: ActorType.USER,
    english,
    actionType: ActionType.SEND_MEETING_SUMMARY,
    title: english ? `${meeting.title} summary archived` : `${meeting.title} 纪要归档`,
    description: english ? "Archive the meeting summary into operating memory and align the key conclusions internally." : "把会议纪要归档进经营记忆，并在内部对齐重点结论",
    aiReason: english ? "Archiving the summary inside the first 24 hours after the meeting reduces information loss materially. This action stays internal — it does not send anything to external participants." : "会后 24 小时内归档纪要能显著减少信息丢失。这条动作仅在内部记忆里写入，不会向外部参会人发送任何内容。",
    draftContent: meeting.note?.summary ?? meeting.note?.confirmations ?? (english ? "The meeting summary has been prepared and archived for internal review." : "已整理本次会议纪要，已归档供内部复核。"),
    riskLevel: meeting.opportunity?.riskLevel ?? "LOW",
    meetingId: meeting.id,
    opportunityId: meeting.opportunityId ?? undefined,
    contactId: meeting.contacts[0]?.id,
    ownerId: meeting.ownerId ?? user.id,
  });

  return { ok: true, result };
}

export async function generateMeetingActionItemsAction(meetingId: string) {
  const session = await requireMeetingActionGovernanceSession("manage");
  if (!session.ok) {
    return { ok: false, error: session.error };
  }

  const { user, workspace, english } = session;
  await ensureWorkspaceProcessingAllowed({
    workspaceId: workspace.id,
    english,
    operation: "MEETING_ACTION_GENERATION",
  });
  const meeting = await db.meeting.findFirst({
    where: {
      id: meetingId,
      workspaceId: workspace.id,
    },
    include: {
      opportunity: true,
      contacts: true,
      note: true,
      actionItems: true,
    },
  });

  if (!meeting) {
    return { ok: false, error: english ? "Meeting not found" : "会议不存在" };
  }

  const suggestions = generatePostMeetingActionSuggestions({
    opportunity: meeting.opportunity
      ? {
          type: meeting.opportunity.type,
          stage: meeting.opportunity.stage,
          riskLevel: meeting.opportunity.riskLevel,
          nextAction: meeting.opportunity.nextAction,
        }
      : null,
    note: meeting.note,
  });

  const existingTitles = new Set(meeting.actionItems.map((item) => item.title));
  const createdResults = [];

  for (const suggestion of suggestions.slice(0, 3)) {
    const title = suggestion.length > 26 ? `${suggestion.slice(0, 26)}...` : suggestion;
    if (existingTitles.has(title)) continue;

    const result = await createGovernedAction({
      workspaceId: workspace.id,
      actorName: user.name,
      actorUserId: user.id,
      actorType: ActorType.USER,
      english,
      actionType: ActionType.CREATE_TASK,
      title,
      description: suggestion,
      aiReason: english ? "Post-meeting actions split automatically from the notes and surrounding context." : "基于会议纪要和上下文自动拆分出的后续动作。",
      riskLevel: meeting.opportunity?.riskLevel ?? "MEDIUM",
      meetingId: meeting.id,
      opportunityId: meeting.opportunityId ?? undefined,
      contactId: meeting.contacts[0]?.id,
      ownerId: meeting.ownerId ?? user.id,
      metadata: {
        generatedFrom: "meeting_post_actions",
      },
      resultPreview: english ? "The current policy will decide whether this action stays as a suggestion, enters approvals or auto-executes." : "动作会按当前策略决定是仅建议、进入审批还是自动执行。",
    });

    createdResults.push(result);
  }

  await logEvent({
    workspaceId: workspace.id,
    userId: user.id,
    eventName: "action_items_generated",
    eventCategory: "ai_action",
    targetType: "Meeting",
    targetId: meeting.id,
    metadata: {
      createdCount: createdResults.length,
      meetingId: meeting.id,
      opportunityId: meeting.opportunityId,
    },
    sourcePage: `/meetings/${meeting.id}`,
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "MEETING_ACTION_ITEMS_GENERATED",
    targetType: "Meeting",
    targetId: meeting.id,
    summary: english ? `Generated ${createdResults.length} post-meeting action items` : `生成会后 动作items：${createdResults.length} 条`,
    payload: {
      suggestions: suggestions.slice(0, 3),
    },
  });

  revalidatePath(`/meetings/${meeting.id}`);
  revalidatePath("/dashboard");
  revalidatePath("/approvals");
  await recordUsageLedgerEntry({
    workspaceId: workspace.id,
    userId: user.id,
    usageType: UsageType.MEETING_PROCESSING,
    sourcePage: `/meetings/${meeting.id}`,
    metadata: {
      meetingId: meeting.id,
      operation: "generate_action_items",
      createdCount: createdResults.length,
    },
  });

  return {
    ok: true,
    createdCount: createdResults.length,
  };
}

export async function createFollowUpMeetingAction(meetingId: string) {
  const session = await requireMeetingActionGovernanceSession("manage");
  if (!session.ok) {
    return { ok: false, error: session.error };
  }

  const { user, workspace, english } = session;
  const meeting = await db.meeting.findFirst({
    where: {
      id: meetingId,
      workspaceId: workspace.id,
    },
    include: { opportunity: true, contacts: true },
  });

  if (!meeting) return { ok: false, error: english ? "Meeting not found" : "会议不存在" };

  const result = await createGovernedAction({
    workspaceId: workspace.id,
    actorName: user.name,
    actorUserId: user.id,
    actorType: ActorType.USER,
    english,
    actionType: ActionType.CREATE_MEETING,
    title: english ? `${meeting.title} follow-up meeting` : `${meeting.title} 后续会议`,
    description: english ? "Create a follow-up meeting after this session." : "创建会后 follow-up 会议",
    aiReason: english ? "The current thread of work needs a follow-up meeting to close, instead of staying trapped in notes." : "当前事项需要通过下一次会议收口，而不是停留在纪要里。",
    riskLevel: meeting.opportunity?.riskLevel ?? "MEDIUM",
    meetingId: meeting.id,
    opportunityId: meeting.opportunityId ?? undefined,
    contactId: meeting.contacts[0]?.id,
    ownerId: meeting.ownerId ?? user.id,
    metadata: {
      createMeetingTitle: `${meeting.title} Follow-up`,
      agenda: english ? "Review the last conclusions and confirm the next step" : "复盘上次结论并确认下一步",
    },
  });

  return { ok: true, result };
}

export async function updateOpportunityFromMeetingAction(meetingId: string) {
  const session = await requireMeetingActionGovernanceSession("manage");
  if (!session.ok) {
    return { ok: false, error: session.error };
  }

  const { user, workspace, english } = session;
  const meeting = await db.meeting.findFirst({
    where: {
      id: meetingId,
      workspaceId: workspace.id,
    },
    include: { opportunity: true, contacts: true },
  });

  if (!meeting?.opportunity) {
    return { ok: false, error: english ? "This meeting is not linked to an opportunity" : "当前会议未关联机会" };
  }

  const result = await createGovernedAction({
    workspaceId: workspace.id,
    actorName: user.name,
    actorUserId: user.id,
    actorType: ActorType.USER,
    english,
    actionType: ActionType.UPDATE_OPPORTUNITY_STAGE,
    title: english ? `${meeting.opportunity.title} stage sync` : `${meeting.opportunity.title} 状态同步`,
    description: english ? "Sync the opportunity stage and next step from the meeting outcome." : "根据会议结论同步机会阶段和下一步",
    aiReason: english ? "The meeting outcome is clear enough that the opportunity board should be updated immediately to avoid stale information." : "会议结论已明确，机会面板应同步更新，避免信息滞后。",
    riskLevel: meeting.opportunity.riskLevel,
    meetingId: meeting.id,
    opportunityId: meeting.opportunity.id,
    contactId: meeting.contacts[0]?.id,
    ownerId: meeting.ownerId ?? user.id,
    metadata: {
      nextStage: meeting.opportunity.stage === "ADVANCING" ? "WAITING_THEM" : "ADVANCING",
      nextAction: meeting.opportunity.nextAction,
    },
  });

  return { ok: true, result };
}

export async function generateInterviewAction(meetingId: string) {
  const session = await requireMeetingActionGovernanceSession("manage");
  if (!session.ok) {
    return { ok: false, error: session.error };
  }

  const { user, workspace, english } = session;
  const meeting = await db.meeting.findFirst({
    where: {
      id: meetingId,
      workspaceId: workspace.id,
    },
    include: { opportunity: true, contacts: true, note: true },
  });

  if (!meeting?.opportunity) {
    return { ok: false, error: english ? "This meeting is not linked to a recruiting opportunity" : "当前会议未关联招聘机会" };
  }

  const candidate = meeting.contacts.find((contact) => contact.title === "候选人") ?? meeting.contacts[0];

  const result = await createGovernedAction({
    workspaceId: workspace.id,
    actorName: user.name,
    actorUserId: user.id,
    actorType: ActorType.USER,
    english,
    actionType: ActionType.SCHEDULE_INTERVIEW,
    title: english ? `Schedule follow-up interview for ${candidate?.name ?? "candidate"}` : `安排 ${candidate?.name ?? "候选人"} 后续面试`,
    description: english ? "Create a follow-up interview and send the panel briefing." : "创建后续面试并发送 panel 简报",
    aiReason:
      meeting.note?.summary ??
      (english ? "The meeting confirmed candidate intent and timing, so it should be turned into an executable interview action immediately." : "会中已确认候选人意愿和时间窗口，建议立即转化为可执行的面试安排动作。"),
    draftContent: english ? `${candidate?.name ?? "Candidate"} should ideally do the final interview next Wednesday at 15:00 with the Talent Lead and Hiring Manager.` : `${candidate?.name ?? "候选人"} 终面建议安排在下周三 15:00，panel 为 Talent Lead + Hiring 主管。`,
    riskLevel: "HIGH",
    meetingId: meeting.id,
    opportunityId: meeting.opportunity.id,
    contactId: candidate?.id,
    ownerId: meeting.ownerId ?? user.id,
    metadata: {
      createMeetingTitle: english ? `${candidate?.name ?? "Candidate"} final interview` : `${candidate?.name ?? "候选人"} 终面`,
      nextStage: "ADVANCING",
      agenda: english ? "Validate the final fit between candidate and role" : "验证候选人和岗位的最终匹配度",
    },
    resultPreview: english ? "After approval, a final interview placeholder will be created, the timeline will update and the opportunity stage will move forward." : "审批通过后将创建终面会议占位、写入时间线并更新机会阶段。",
  });

  return { ok: true, result };
}

export async function processMeetingMemoryAction(meetingId: string, force = true) {
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";

  if (!canManageWorkspaceMemory(membership.role)) {
    return { ok: false, error: getMemoryManagementDeniedMessage(english) };
  }

  await ensureWorkspaceProcessingAllowed({
    workspaceId: workspace.id,
    english,
    operation: "MEETING_MEMORY_PROCESSING",
  });

  try {
    const ownershipError = await getMeetingOwnershipError(workspace.id, meetingId, english);
    if (ownershipError) {
      return { ok: false, error: ownershipError };
    }

    const result = await processMeetingMemory({
      workspaceId: workspace.id,
      actorName: user.name,
      actorUserId: user.id,
      actorType: ActorType.USER,
      sourcePage: `/meetings/${meetingId}`,
      meetingId,
      force,
    });

    revalidatePath(`/meetings/${meetingId}`);
    revalidatePath("/memory");
    revalidatePath("/dashboard");
    revalidatePath("/opportunities");
    revalidatePath("/search");
    await recordUsageLedgerEntry({
      workspaceId: workspace.id,
      userId: user.id,
      usageType: UsageType.MEETING_PROCESSING,
      sourcePage: `/meetings/${meetingId}`,
      metadata: {
        meetingId,
        operation: "process_meeting_memory",
        force,
      },
    });

    return {
      ok: true,
      factCount: result.facts.length,
      commitmentCount: result.commitments.length,
      blockerCount: result.blockers.length,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : english ? "Meeting memory processing failed" : "处理会议记忆失败",
    };
  }
}

export async function runMeetingActionPackRuntimeAction(meetingId: string, force = true) {
  const session = await requireMeetingActionGovernanceSession("manage");
  if (!session.ok) {
    return { ok: false, error: session.error };
  }

  const { user, workspace, english } = session;

  try {
    const ownershipError = await getMeetingOwnershipError(workspace.id, meetingId, english);
    if (ownershipError) {
      return { ok: false, error: ownershipError };
    }

    const result = await ingestMeetingEndedRuntime({
      workspaceId: workspace.id,
      meetingId,
      actorName: user.name,
      actorUserId: user.id,
      sourcePage: `/meetings/${meetingId}`,
      force,
    });

    revalidatePath(`/meetings/${meetingId}`);
    revalidatePath("/dashboard");
    revalidatePath("/memory");
    revalidatePath("/opportunities");

    return {
      ok: true,
      reused: result.reused,
      runtimeEventId: result.runtimeEventId,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : english ? "Failed to start Helm v2 runtime" : "启动 Helm v2 运行时失败",
    };
  }
}

const reviewMeetingActionPackRuntimeSchema = z.object({
  meetingId: z.string().min(1),
  mode: z.enum(["confirm", "edit_confirm", "reject", "keep_draft"]),
  factsJson: z.string().optional(),
  actionPackMarkdown: z.string().optional(),
  reviewNotes: z.string().optional(),
});

export async function reviewMeetingActionPackRuntimeAction(input: {
  meetingId: string;
  mode: "confirm" | "edit_confirm" | "reject" | "keep_draft";
  factsJson?: string;
  actionPackMarkdown?: string;
  reviewNotes?: string;
}) {
  const payload = reviewMeetingActionPackRuntimeSchema.safeParse(input);
  if (!payload.success) {
    return {
      ok: false,
      error: resolveBilingualApiValidationIssueMessage(payload.error.issues[0]?.message),
    };
  }

  const reviewSession = await requireMeetingActionGovernanceSession("review");
  if (!reviewSession.ok) {
    return { ok: false, error: reviewSession.error };
  }

  const { user, workspace, english } = reviewSession;

  try {
    const ownershipError = await getMeetingOwnershipError(workspace.id, payload.data.meetingId, english);
    if (ownershipError) {
      return { ok: false, error: ownershipError };
    }

    const result = await confirmMeetingFactsRuntime({
      workspaceId: workspace.id,
      meetingId: payload.data.meetingId,
      reviewerId: user.id,
      reviewerName: user.name,
      mode: payload.data.mode,
      edits: {
        factsJson: payload.data.factsJson,
        actionPackMarkdown: payload.data.actionPackMarkdown,
        reviewNotes: payload.data.reviewNotes,
      },
      sourcePage: `/meetings/${payload.data.meetingId}`,
    });

    revalidatePath(`/meetings/${payload.data.meetingId}`);
    revalidatePath("/dashboard");
    revalidatePath("/memory");
    revalidatePath("/opportunities");
    revalidatePath("/approvals");

    if (result.reviewStatus === "CONFIRMED") {
      await runOpportunityJudgeRuntime({
        workspaceId: workspace.id,
        meetingId: payload.data.meetingId,
        actorName: user.name,
        actorUserId: user.id,
        sourcePage: `/meetings/${payload.data.meetingId}`,
        force: false,
      }).catch(() => null);

      await runDraftCommsHandoffRuntime({
        workspaceId: workspace.id,
        meetingId: payload.data.meetingId,
        actorName: user.name,
        actorUserId: user.id,
        sourcePage: `/meetings/${payload.data.meetingId}`,
        force: false,
      }).catch(() => null);

      revalidatePath(`/meetings/${payload.data.meetingId}`);
    }

    return {
      ok: true,
      reviewStatus: result.reviewStatus,
      opportunityJudgeTriggered: result.opportunityJudgeTriggered,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : english ? "Meeting runtime review failed" : "会议运行时复核失败",
    };
  }
}

export async function runMeetingDraftCommsRuntimeAction(meetingId: string, force = true) {
  const session = await requireMeetingActionGovernanceSession("manage");
  if (!session.ok) {
    return { ok: false, error: session.error };
  }

  const { user, workspace, english } = session;

  try {
    const ownershipError = await getMeetingOwnershipError(workspace.id, meetingId, english);
    if (ownershipError) {
      return { ok: false, error: ownershipError };
    }

    const result = await runDraftCommsHandoffRuntime({
      workspaceId: workspace.id,
      meetingId,
      actorName: user.name,
      actorUserId: user.id,
      sourcePage: `/meetings/${meetingId}`,
      force,
    });

    revalidatePath(`/meetings/${meetingId}`);
    revalidatePath("/dashboard");
    revalidatePath("/meetings");

    return {
      ok: true,
      reused: result.reused,
      runtimeEventId: result.runtimeEventId,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : english ? "Failed to start draft-only comms runtime" : "启动 draft-only comms 运行时失败",
    };
  }
}

const queueMeetingRuntimeConsolidationSchema = z.object({
  meetingId: z.string().min(1),
  sourcePage: z.string().min(1).optional(),
});

export async function queueMeetingRuntimeConsolidationAction(input: {
  meetingId: string;
  sourcePage?: string;
}) {
  const payload = queueMeetingRuntimeConsolidationSchema.safeParse(input);
  if (!payload.success) {
    return {
      ok: false,
      error: resolveBilingualApiValidationIssueMessage(payload.error.issues[0]?.message),
    };
  }

  const session = await getCurrentWorkspaceSession();
  const { user, workspace } = session;
  const english = workspace.defaultLocale === "en-US";

  try {
    const ownershipError = await getMeetingOwnershipError(
      workspace.id,
      payload.data.meetingId,
      english,
    );
    if (ownershipError) {
      return { ok: false, error: ownershipError };
    }

    const result = await queueConsolidationJob({
      workspaceId: workspace.id,
      meetingId: payload.data.meetingId,
      actorUserId: user.id,
      actorName: user.name,
      sourcePage: payload.data.sourcePage ?? `/meetings/${payload.data.meetingId}`,
    });

    revalidatePath(`/meetings/${payload.data.meetingId}`);
    revalidatePath("/operating");

    return {
      ok: true,
      jobId: result.id,
      status: result.status,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Failed to queue consolidation job"
            : "加入 整合 队列失败",
    };
  }
}

export async function queueMeetingRuntimeReflectionAction(meetingId: string) {
  await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const english = workspace.defaultLocale === "en-US";

  try {
    const ownershipError = await getMeetingOwnershipError(workspace.id, meetingId, english);
    if (ownershipError) {
      return { ok: false, error: ownershipError };
    }

    const result = await queueReflectionJob({
      workspaceId: workspace.id,
      meetingId,
    });

    revalidatePath(`/meetings/${meetingId}`);
    revalidatePath("/operating");

    return {
      ok: true,
      jobId: result.id,
      status: result.status,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Failed to queue reflection job"
            : "加入反思队列失败",
    };
  }
}

const dismissReflectionCarryForwardSchema = z.object({
  candidateId: z.string().min(1),
  sourcePage: z.string().min(1).default("/operating"),
});

export async function dismissReflectionCarryForwardAction(input: {
  candidateId: string;
  sourcePage?: string;
}) {
  const payload = dismissReflectionCarryForwardSchema.safeParse(input);
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";

  if (!payload.success) {
    return {
      ok: false,
      error: payload.error.issues[0]?.message ?? (english ? "Invalid reflection candidate input" : "反思候选参数错误"),
    };
  }

  if (!canManageWorkspaceRuntime(membership.role)) {
    return {
      ok: false,
      error: getRuntimeManagementDeniedMessage(english),
    };
  }

  try {
    const ownershipError = await getMemoryCandidateOwnershipError(
      workspace.id,
      payload.data.candidateId,
      english,
    );
    if (ownershipError) {
      return { ok: false, error: ownershipError };
    }

    const candidate = await dismissReflectionCandidate({
      workspaceId: workspace.id,
      candidateId: payload.data.candidateId,
      userId: user.id,
      actorName: user.name,
      sourcePage: payload.data.sourcePage,
    });

    revalidatePath("/operating");
    revalidatePath("/memory");
    if (candidate.runtimeSession.meetingId) {
      revalidatePath(`/meetings/${candidate.runtimeSession.meetingId}`);
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Failed to dismiss the reflection 延续 candidate"
            : "忽略反思 延续 候选失败",
    };
  }
}

const acceptReflectionCarryForwardSchema = z.object({
  candidateId: z.string().min(1),
  sourcePage: z.string().min(1).default("/operating"),
});

export async function acceptReflectionCarryForwardAction(input: {
  candidateId: string;
  sourcePage?: string;
}) {
  const payload = acceptReflectionCarryForwardSchema.safeParse(input);
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";

  if (!payload.success) {
    return {
      ok: false,
      error: payload.error.issues[0]?.message ?? (english ? "Invalid reflection candidate input" : "反思候选参数错误"),
    };
  }

  if (!canReviewWorkspaceRuntime(membership.role)) {
    return {
      ok: false,
      error: getRuntimeReviewDeniedMessage(english),
    };
  }

  try {
    const ownershipError = await getMemoryCandidateOwnershipError(
      workspace.id,
      payload.data.candidateId,
      english,
    );
    if (ownershipError) {
      return { ok: false, error: ownershipError };
    }

    const candidate = await acceptReflectionCandidate({
      workspaceId: workspace.id,
      candidateId: payload.data.candidateId,
      userId: user.id,
      actorName: user.name,
      sourcePage: payload.data.sourcePage,
    });

    revalidatePath("/operating");
    revalidatePath("/memory");
    if (candidate.runtimeSession.meetingId) {
      revalidatePath(`/meetings/${candidate.runtimeSession.meetingId}`);
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Failed to accept the reflection 延续 candidate"
            : "接受反思 延续 候选失败",
    };
  }
}

const updateMeetingRuntimeConsolidationSchema = z.object({
  meetingId: z.string().min(1),
  jobId: z.string().min(1),
  mode: z.enum(["pause", "resume"]),
  sourcePage: z.string().min(1).optional(),
});

export async function updateMeetingRuntimeConsolidationAction(input: {
  meetingId: string;
  jobId: string;
  mode: "pause" | "resume";
  sourcePage?: string;
}) {
  const payload = updateMeetingRuntimeConsolidationSchema.safeParse(input);
  if (!payload.success) {
    return {
      ok: false,
      error: resolveBilingualApiValidationIssueMessage(payload.error.issues[0]?.message),
    };
  }

  const session = await getCurrentWorkspaceSession();
  const { user, workspace } = session;
  const english = workspace.defaultLocale === "en-US";

  try {
    const meetingOwnershipError = await getMeetingOwnershipError(
      workspace.id,
      payload.data.meetingId,
      english,
    );
    if (meetingOwnershipError) {
      return { ok: false, error: meetingOwnershipError };
    }
    const jobOwnershipError = await getConsolidationJobOwnershipError(
      workspace.id,
      payload.data.jobId,
      english,
    );
    if (jobOwnershipError) {
      return { ok: false, error: jobOwnershipError };
    }

    const result = await updateConsolidationJobStatus({
      workspaceId: workspace.id,
      jobId: payload.data.jobId,
      mode: payload.data.mode,
      actorUserId: user.id,
      actorName: user.name,
      sourcePage: payload.data.sourcePage ?? `/meetings/${payload.data.meetingId}`,
    });

    revalidatePath(`/meetings/${payload.data.meetingId}`);
    revalidatePath("/operating");

    return {
      ok: true,
      jobId: result.id,
      status: result.status,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Failed to update consolidation job"
            : "更新 整合 job 失败",
    };
  }
}

const runMeetingRuntimeContinuityRemediationSchema = z.object({
  meetingId: z.string().min(1),
  sessionId: z.string().min(1),
  action: z.enum(["SAVE_RECOVERY_CHECKPOINT", "RESUME_CHECKPOINT", "REPRUNE_CONTEXT"]),
});

export async function runMeetingRuntimeContinuityRemediationAction(input: {
  meetingId: string;
  sessionId: string;
  action: "SAVE_RECOVERY_CHECKPOINT" | "RESUME_CHECKPOINT" | "REPRUNE_CONTEXT";
}) {
  const payload = runMeetingRuntimeContinuityRemediationSchema.safeParse(input);
  if (!payload.success) {
    return {
      ok: false,
      error: resolveBilingualApiValidationIssueMessage(payload.error.issues[0]?.message),
    };
  }

  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const english = workspace.defaultLocale === "en-US";

  try {
    const meetingOwnershipError = await getMeetingOwnershipError(
      workspace.id,
      payload.data.meetingId,
      english,
    );
    if (meetingOwnershipError) {
      return { ok: false, error: meetingOwnershipError };
    }
    const sessionOwnershipError = await getRuntimeSessionOwnershipError(
      workspace.id,
      payload.data.sessionId,
      english,
    );
    if (sessionOwnershipError) {
      return { ok: false, error: sessionOwnershipError };
    }

    const result = await runRuntimeContinuityRemediation({
      workspaceId: workspace.id,
      sessionId: payload.data.sessionId,
      action: payload.data.action,
      actorName: user.name,
      actorUserId: user.id,
      sourcePage: `/meetings/${payload.data.meetingId}`,
    });

    revalidatePath(`/meetings/${payload.data.meetingId}`);
    revalidatePath("/operating");
    revalidatePath("/dashboard");

    return {
      ok: true,
      executionStatus: result.executionStatus,
      rollbackAnchorLabel: result.rollbackAnchor
        ? `${result.rollbackAnchor.checkpointLabel} · ${result.rollbackAnchor.checkpointStatus}`
        : null,
      summary: result.summary,
      beforePosture: result.beforePosture,
      afterPosture: result.afterPosture,
      afterRecoveryState: result.after.recoveryState,
      afterFailureTaxonomy: result.after.failureTaxonomy,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Continuity remediation failed"
            : "连续性 remediation 失败",
    };
  }
}

const requestMeetingRuntimeTakeoverSchema = z.object({
  meetingId: z.string().min(1),
  sessionId: z.string().min(1),
  sourcePage: z.string().min(1).optional(),
});

export async function requestMeetingRuntimeTakeoverAction(input: {
  meetingId: string;
  sessionId: string;
  sourcePage?: string;
}) {
  const payload = requestMeetingRuntimeTakeoverSchema.safeParse(input);
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";

  if (!payload.success) {
    return {
      ok: false,
      error: payload.error.issues[0]?.message ?? (english ? "Invalid takeover request input" : "接管请求 参数错误"),
    };
  }

  if (!canManageWorkspaceRuntime(membership.role)) {
    return {
      ok: false,
      error: getRuntimeManagementDeniedMessage(english),
    };
  }

  try {
    const meetingOwnershipError = await getMeetingOwnershipError(
      workspace.id,
      payload.data.meetingId,
      english,
    );
    if (meetingOwnershipError) {
      return { ok: false, error: meetingOwnershipError };
    }
    const sessionOwnershipError = await getRuntimeSessionOwnershipError(
      workspace.id,
      payload.data.sessionId,
      english,
    );
    if (sessionOwnershipError) {
      return { ok: false, error: sessionOwnershipError };
    }

    const result = await requestRuntimeOperatorTakeover({
      workspaceId: workspace.id,
      sessionId: payload.data.sessionId,
      actorName: user.name,
      actorUserId: user.id,
      sourcePage: payload.data.sourcePage ?? `/meetings/${payload.data.meetingId}`,
    });

    revalidatePath(`/meetings/${payload.data.meetingId}`);
    revalidatePath("/operating");

    return {
      ok: true,
      reused: result.reused,
      requestEventId: result.requestEventId,
      action: result.action,
      checkpointKey: result.checkpointKey,
      summary: result.summary,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Failed to request operator takeover"
            : "请求 操作员接管 失败",
    };
  }
}

const requestMeetingRuntimeHumanInputCheckpointSchema = z.object({
  meetingId: z.string().min(1),
  sessionId: z.string().min(1),
  sourcePage: z.string().min(1).optional(),
});

const requestMeetingRuntimeSwarmSpawnSchema = z.object({
  meetingId: z.string().min(1),
  sessionId: z.string().min(1),
  sourcePage: z.string().min(1).optional(),
});

const recordMeetingRuntimeSwarmReadOnlyWorkerIntentSchema = z.object({
  meetingId: z.string().min(1),
  sessionId: z.string().min(1),
  workerKind: z.enum(["search", "grep", "evidence_mining"]),
  sourcePage: z.string().min(1).optional(),
});

const recordMeetingRuntimeSwarmReadOnlyWorkerPlaceholderSchema = z.object({
  meetingId: z.string().min(1),
  sessionId: z.string().min(1),
  sourcePage: z.string().min(1).optional(),
});

const recordMeetingRuntimeSwarmReadOnlyWorkerExecutionSchema = z.object({
  meetingId: z.string().min(1),
  sessionId: z.string().min(1),
  sourcePage: z.string().min(1).optional(),
});

const recordMeetingRuntimeSwarmReadOnlyWorkerMaterializationSchema = z.object({
  meetingId: z.string().min(1),
  sessionId: z.string().min(1),
  sourcePage: z.string().min(1).optional(),
});

const recordMeetingRuntimeSwarmReadOnlyWorkerAdoptionSchema = z.object({
  meetingId: z.string().min(1),
  sessionId: z.string().min(1),
  sourcePage: z.string().min(1).optional(),
});

const recordMeetingRuntimeSwarmVerificationMergeLaneSchema = z.object({
  meetingId: z.string().min(1),
  sessionId: z.string().min(1),
  sourcePage: z.string().min(1).optional(),
});

export async function requestMeetingRuntimeSwarmSpawnAction(input: {
  meetingId: string;
  sessionId: string;
  sourcePage?: string;
}) {
  const payload = requestMeetingRuntimeSwarmSpawnSchema.safeParse(input);
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";

  if (!payload.success) {
    return {
      ok: false,
      error:
        payload.error.issues[0]?.message ??
        (english ? "Invalid swarm spawn request input" : "多代理派生请求参数错误"),
    };
  }

  if (!canManageWorkspaceRuntime(membership.role)) {
    return {
      ok: false,
      error: getRuntimeManagementDeniedMessage(english),
    };
  }

  try {
    const meetingOwnershipError = await getMeetingOwnershipError(
      workspace.id,
      payload.data.meetingId,
      english,
    );
    if (meetingOwnershipError) {
      return { ok: false, error: meetingOwnershipError };
    }
    const sessionOwnershipError = await getRuntimeSessionOwnershipError(
      workspace.id,
      payload.data.sessionId,
      english,
    );
    if (sessionOwnershipError) {
      return { ok: false, error: sessionOwnershipError };
    }

    const result = await requestRuntimeSwarmSpawn({
      workspaceId: workspace.id,
      sessionId: payload.data.sessionId,
      actorName: user.name,
      actorUserId: user.id,
      sourcePage: payload.data.sourcePage ?? `/meetings/${payload.data.meetingId}`,
    });

    revalidatePath(`/meetings/${payload.data.meetingId}`);
    revalidatePath("/operating");

    return {
      ok: true,
      reused: result.reused,
      requestEventId: result.requestEventId,
      taskClass: result.taskClass,
      checkpointKey: result.checkpointKey,
      summary: result.summary,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Failed to request swarm spawn"
            : "请求多代理派生失败",
    };
  }
}

export async function recordMeetingRuntimeSwarmReadOnlyWorkerIntentAction(input: {
  meetingId: string;
  sessionId: string;
  workerKind: "search" | "grep" | "evidence_mining";
  sourcePage?: string;
}) {
  const payload = recordMeetingRuntimeSwarmReadOnlyWorkerIntentSchema.safeParse(input);
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";

  if (!payload.success) {
    return {
      ok: false,
      error:
        payload.error.issues[0]?.message ??
        (english ? "Invalid swarm worker intent input" : "只读子代理意图参数错误"),
    };
  }

  if (!canManageWorkspaceRuntime(membership.role)) {
    return {
      ok: false,
      error: getRuntimeManagementDeniedMessage(english),
    };
  }

  try {
    const meetingOwnershipError = await getMeetingOwnershipError(
      workspace.id,
      payload.data.meetingId,
      english,
    );
    if (meetingOwnershipError) {
      return { ok: false, error: meetingOwnershipError };
    }
    const sessionOwnershipError = await getRuntimeSessionOwnershipError(
      workspace.id,
      payload.data.sessionId,
      english,
    );
    if (sessionOwnershipError) {
      return { ok: false, error: sessionOwnershipError };
    }

    const result = await recordRuntimeSwarmReadOnlyWorkerIntent({
      workspaceId: workspace.id,
      sessionId: payload.data.sessionId,
      workerKind: payload.data.workerKind,
      actorName: user.name,
      actorUserId: user.id,
      sourcePage: payload.data.sourcePage ?? `/meetings/${payload.data.meetingId}`,
    });

    revalidatePath(`/meetings/${payload.data.meetingId}`);
    revalidatePath("/operating");

    return {
      ok: true,
      reused: result.reused,
      intentEventId: result.intentEventId,
      workerKind: result.workerKind,
      packetKey: result.packetKey,
      checkpointKey: result.checkpointKey,
      summary: result.summary,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Failed to record swarm worker intent"
            : "记录只读子代理意图失败",
    };
  }
}

export async function recordMeetingRuntimeSwarmReadOnlyWorkerPlaceholderAction(input: {
  meetingId: string;
  sessionId: string;
  sourcePage?: string;
}) {
  const payload = recordMeetingRuntimeSwarmReadOnlyWorkerPlaceholderSchema.safeParse(input);
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";

  if (!payload.success) {
    return {
      ok: false,
      error:
        payload.error.issues[0]?.message ??
        (english ? "Invalid swarm placeholder input" : "只读子代理占位记录参数错误"),
    };
  }

  if (!canManageWorkspaceRuntime(membership.role)) {
    return {
      ok: false,
      error: getRuntimeManagementDeniedMessage(english),
    };
  }

  try {
    const meetingOwnershipError = await getMeetingOwnershipError(
      workspace.id,
      payload.data.meetingId,
      english,
    );
    if (meetingOwnershipError) {
      return { ok: false, error: meetingOwnershipError };
    }
    const sessionOwnershipError = await getRuntimeSessionOwnershipError(
      workspace.id,
      payload.data.sessionId,
      english,
    );
    if (sessionOwnershipError) {
      return { ok: false, error: sessionOwnershipError };
    }

    const result = await recordRuntimeSwarmReadOnlyWorkerPlaceholder({
      workspaceId: workspace.id,
      sessionId: payload.data.sessionId,
      actorName: user.name,
      actorUserId: user.id,
      sourcePage: payload.data.sourcePage ?? `/meetings/${payload.data.meetingId}`,
    });

    revalidatePath(`/meetings/${payload.data.meetingId}`);
    revalidatePath("/operating");

    return {
      ok: true,
      reused: result.reused,
      placeholderRecordEventId: result.placeholderRecordEventId,
      workerKind: result.workerKind,
      packetKey: result.packetKey,
      placeholderBundleKey: result.placeholderBundleKey,
      checkpointKey: result.checkpointKey,
      summary: result.summary,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Failed to record swarm placeholder"
            : "记录只读子代理占位失败",
    };
  }
}

export async function recordMeetingRuntimeSwarmReadOnlyWorkerExecutionAction(input: {
  meetingId: string;
  sessionId: string;
  sourcePage?: string;
}) {
  const payload = recordMeetingRuntimeSwarmReadOnlyWorkerExecutionSchema.safeParse(input);
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";

  if (!payload.success) {
    return {
      ok: false,
      error:
        payload.error.issues[0]?.message ??
        (english ? "Invalid swarm execution input" : "只读子代理执行切片参数错误"),
    };
  }

  if (!canManageWorkspaceRuntime(membership.role)) {
    return {
      ok: false,
      error: getRuntimeManagementDeniedMessage(english),
    };
  }

  try {
    const meetingOwnershipError = await getMeetingOwnershipError(
      workspace.id,
      payload.data.meetingId,
      english,
    );
    if (meetingOwnershipError) {
      return { ok: false, error: meetingOwnershipError };
    }
    const sessionOwnershipError = await getRuntimeSessionOwnershipError(
      workspace.id,
      payload.data.sessionId,
      english,
    );
    if (sessionOwnershipError) {
      return { ok: false, error: sessionOwnershipError };
    }

    const result = await recordRuntimeSwarmReadOnlyWorkerExecution({
      workspaceId: workspace.id,
      sessionId: payload.data.sessionId,
      actorName: user.name,
      actorUserId: user.id,
      sourcePage: payload.data.sourcePage ?? `/meetings/${payload.data.meetingId}`,
    });

    revalidatePath(`/meetings/${payload.data.meetingId}`);
    revalidatePath("/operating");

    return {
      ok: true,
      reused: result.reused,
      executionEventId: result.executionEventId,
      workerKind: result.workerKind,
      packetKey: result.packetKey,
      placeholderBundleKey: result.placeholderBundleKey,
      checkpointKey: result.checkpointKey,
      summary: result.summary,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Failed to record swarm execution admission"
            : "记录只读子代理执行切片失败",
    };
  }
}

export async function recordMeetingRuntimeSwarmReadOnlyWorkerMaterializationAction(input: {
  meetingId: string;
  sessionId: string;
  sourcePage?: string;
}) {
  const payload = recordMeetingRuntimeSwarmReadOnlyWorkerMaterializationSchema.safeParse(input);
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";

  if (!payload.success) {
    return {
      ok: false,
      error:
        payload.error.issues[0]?.message ??
        (english ? "Invalid swarm materialization input" : "只读子代理物化切片参数错误"),
    };
  }

  if (!canManageWorkspaceRuntime(membership.role)) {
    return {
      ok: false,
      error: getRuntimeManagementDeniedMessage(english),
    };
  }

  try {
    const meetingOwnershipError = await getMeetingOwnershipError(
      workspace.id,
      payload.data.meetingId,
      english,
    );
    if (meetingOwnershipError) {
      return { ok: false, error: meetingOwnershipError };
    }
    const sessionOwnershipError = await getRuntimeSessionOwnershipError(
      workspace.id,
      payload.data.sessionId,
      english,
    );
    if (sessionOwnershipError) {
      return { ok: false, error: sessionOwnershipError };
    }

    const result = await recordRuntimeSwarmReadOnlyWorkerMaterialization({
      workspaceId: workspace.id,
      sessionId: payload.data.sessionId,
      actorName: user.name,
      actorUserId: user.id,
      sourcePage: payload.data.sourcePage ?? `/meetings/${payload.data.meetingId}`,
    });

    revalidatePath(`/meetings/${payload.data.meetingId}`);
    revalidatePath("/operating");

    return {
      ok: true,
      reused: result.reused,
      artifactMaterializationEventId: result.artifactMaterializationEventId,
      workerKind: result.workerKind,
      packetKey: result.packetKey,
      materializationBundleKey: result.materializationBundleKey,
      checkpointKey: result.checkpointKey,
      summary: result.summary,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Failed to record swarm materialization"
            : "记录只读子代理物化切片失败",
    };
  }
}

export async function recordMeetingRuntimeSwarmReadOnlyWorkerAdoptionAction(input: {
  meetingId: string;
  sessionId: string;
  sourcePage?: string;
}) {
  const payload = recordMeetingRuntimeSwarmReadOnlyWorkerAdoptionSchema.safeParse(input);
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";

  if (!payload.success) {
    return {
      ok: false,
      error:
        payload.error.issues[0]?.message ??
        (english ? "Invalid swarm adoption input" : "只读子代理采纳切片参数错误"),
    };
  }

  if (!canManageWorkspaceRuntime(membership.role)) {
    return {
      ok: false,
      error: getRuntimeManagementDeniedMessage(english),
    };
  }

  try {
    const meetingOwnershipError = await getMeetingOwnershipError(
      workspace.id,
      payload.data.meetingId,
      english,
    );
    if (meetingOwnershipError) {
      return { ok: false, error: meetingOwnershipError };
    }
    const sessionOwnershipError = await getRuntimeSessionOwnershipError(
      workspace.id,
      payload.data.sessionId,
      english,
    );
    if (sessionOwnershipError) {
      return { ok: false, error: sessionOwnershipError };
    }

    const result = await recordRuntimeSwarmReadOnlyWorkerAdoption({
      workspaceId: workspace.id,
      sessionId: payload.data.sessionId,
      actorName: user.name,
      actorUserId: user.id,
      sourcePage: payload.data.sourcePage ?? `/meetings/${payload.data.meetingId}`,
    });

    revalidatePath(`/meetings/${payload.data.meetingId}`);
    revalidatePath("/operating");

    return {
      ok: true,
      reused: result.reused,
      outputAdoptionEventId: result.outputAdoptionEventId,
      workerKind: result.workerKind,
      packetKey: result.packetKey,
      outputBundleKey: result.outputBundleKey,
      checkpointKey: result.checkpointKey,
      summary: result.summary,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Failed to record swarm output adoption seam"
            : "记录只读子代理采纳切片失败",
    };
  }
}

export async function recordMeetingRuntimeSwarmVerificationMergeLaneAction(input: {
  meetingId: string;
  sessionId: string;
  sourcePage?: string;
}) {
  const payload = recordMeetingRuntimeSwarmVerificationMergeLaneSchema.safeParse(input);
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";

  if (!payload.success) {
    return {
      ok: false,
      error:
        payload.error.issues[0]?.message ??
        (english ? "Invalid swarm verification merge lane input" : "多代理验证合流参数错误"),
    };
  }

  if (!canManageWorkspaceRuntime(membership.role)) {
    return {
      ok: false,
      error: getRuntimeManagementDeniedMessage(english),
    };
  }

  try {
    const meetingOwnershipError = await getMeetingOwnershipError(
      workspace.id,
      payload.data.meetingId,
      english,
    );
    if (meetingOwnershipError) {
      return { ok: false, error: meetingOwnershipError };
    }
    const sessionOwnershipError = await getRuntimeSessionOwnershipError(
      workspace.id,
      payload.data.sessionId,
      english,
    );
    if (sessionOwnershipError) {
      return { ok: false, error: sessionOwnershipError };
    }

    const result = await recordRuntimeSwarmVerificationMergeLane({
      workspaceId: workspace.id,
      sessionId: payload.data.sessionId,
      actorName: user.name,
      actorUserId: user.id,
      sourcePage: payload.data.sourcePage ?? `/meetings/${payload.data.meetingId}`,
    });

    revalidatePath(`/meetings/${payload.data.meetingId}`);
    revalidatePath("/operating");

    return {
      ok: true,
      reused: result.reused,
      recordEventId: result.recordEventId,
      mergeLaneTruth: result.mergeLaneTruth,
      checkpointKey: result.checkpointKey,
      summary: result.summary,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Failed to record swarm verification merge lane"
            : "记录多代理验证合流失败",
    };
  }
}

export async function requestMeetingRuntimeHumanInputCheckpointAction(input: {
  meetingId: string;
  sessionId: string;
  sourcePage?: string;
}) {
  const payload = requestMeetingRuntimeHumanInputCheckpointSchema.safeParse(input);
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";

  if (!payload.success) {
    return {
      ok: false,
      error:
        payload.error.issues[0]?.message ??
        (english ? "Invalid human input checkpoint request input" : "human input 检查点 request 参数错误"),
    };
  }

  if (!canManageWorkspaceRuntime(membership.role)) {
    return {
      ok: false,
      error: getRuntimeManagementDeniedMessage(english),
    };
  }

  try {
    const meetingOwnershipError = await getMeetingOwnershipError(
      workspace.id,
      payload.data.meetingId,
      english,
    );
    if (meetingOwnershipError) {
      return { ok: false, error: meetingOwnershipError };
    }
    const sessionOwnershipError = await getRuntimeSessionOwnershipError(
      workspace.id,
      payload.data.sessionId,
      english,
    );
    if (sessionOwnershipError) {
      return { ok: false, error: sessionOwnershipError };
    }

    const result = await requestRuntimeHumanInputCheckpoint({
      workspaceId: workspace.id,
      sessionId: payload.data.sessionId,
      actorName: user.name,
      actorUserId: user.id,
      sourcePage: payload.data.sourcePage ?? `/meetings/${payload.data.meetingId}`,
    });

    revalidatePath(`/meetings/${payload.data.meetingId}`);
    revalidatePath("/operating");

    return {
      ok: true,
      reused: result.reused,
      requestEventId: result.requestEventId,
      checkpointKey: result.checkpointKey,
      summary: result.summary,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Failed to request human input checkpoint"
            : "请求 human input 检查点失败",
    };
  }
}

const acknowledgeMeetingRuntimeTakeoverSchema = z.object({
  meetingId: z.string().min(1),
  sessionId: z.string().min(1),
});

export async function acknowledgeMeetingRuntimeTakeoverAction(input: {
  meetingId: string;
  sessionId: string;
}) {
  const payload = acknowledgeMeetingRuntimeTakeoverSchema.safeParse(input);
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";

  if (!payload.success) {
    return {
      ok: false,
      error:
        payload.error.issues[0]?.message ?? (english ? "Invalid takeover 已确认 input" : "接管确认 参数错误"),
    };
  }

  if (!canManageWorkspaceRuntime(membership.role)) {
    return {
      ok: false,
      error: getRuntimeManagementDeniedMessage(english),
    };
  }

  try {
    const meetingOwnershipError = await getMeetingOwnershipError(workspace.id, payload.data.meetingId, english);
    if (meetingOwnershipError) {
      return { ok: false, error: meetingOwnershipError };
    }
    const sessionOwnershipError = await getRuntimeSessionOwnershipError(workspace.id, payload.data.sessionId, english);
    if (sessionOwnershipError) {
      return { ok: false, error: sessionOwnershipError };
    }

    const result = await acknowledgeRuntimeOperatorTakeoverRequest({
      workspaceId: workspace.id,
      sessionId: payload.data.sessionId,
      actorName: user.name,
      actorUserId: user.id,
      sourcePage: `/meetings/${payload.data.meetingId}`,
    });

    revalidatePath(`/meetings/${payload.data.meetingId}`);
    revalidatePath("/operating");

    return {
      ok: true,
      reused: result.reused,
      requestEventId: result.requestEventId,
      acknowledgementEventId: result.acknowledgementEventId,
      action: result.action,
      checkpointKey: result.checkpointKey,
      summary: result.summary,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Failed to acknowledge operator takeover request"
            : "确认 操作员接管请求 失败",
    };
  }
}

const startMeetingRuntimeTakeoverSchema = z.object({
  meetingId: z.string().min(1),
  sessionId: z.string().min(1),
  sourcePage: z.string().min(1).optional(),
});

export async function startMeetingRuntimeTakeoverAction(input: {
  meetingId: string;
  sessionId: string;
  sourcePage?: string;
}) {
  const payload = startMeetingRuntimeTakeoverSchema.safeParse(input);
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";

  if (!payload.success) {
    return {
      ok: false,
      error:
        payload.error.issues[0]?.message ?? (english ? "Invalid takeover start input" : "接管启动 参数错误"),
    };
  }

  if (!canManageWorkspaceRuntime(membership.role)) {
    return {
      ok: false,
      error: getRuntimeManagementDeniedMessage(english),
    };
  }

  try {
    const meetingOwnershipError = await getMeetingOwnershipError(workspace.id, payload.data.meetingId, english);
    if (meetingOwnershipError) {
      return { ok: false, error: meetingOwnershipError };
    }
    const sessionOwnershipError = await getRuntimeSessionOwnershipError(workspace.id, payload.data.sessionId, english);
    if (sessionOwnershipError) {
      return { ok: false, error: sessionOwnershipError };
    }

    const result = await startRuntimeOperatorTakeover({
      workspaceId: workspace.id,
      sessionId: payload.data.sessionId,
      actorName: user.name,
      actorUserId: user.id,
      sourcePage: payload.data.sourcePage ?? `/meetings/${payload.data.meetingId}`,
    });

    revalidatePath(`/meetings/${payload.data.meetingId}`);
    revalidatePath("/operating");

    return {
      ok: true,
      reused: result.reused,
      requestEventId: result.requestEventId,
      acknowledgementEventId: result.acknowledgementEventId,
      startEventId: result.startEventId,
      action: result.action,
      checkpointKey: result.checkpointKey,
      summary: result.summary,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Failed to start operator takeover"
            : "启动 操作员接管 失败",
    };
  }
}

const releaseMeetingRuntimeTakeoverSchema = z.object({
  meetingId: z.string().min(1),
  sessionId: z.string().min(1),
  sourcePage: z.string().min(1).optional(),
});

export async function releaseMeetingRuntimeTakeoverAction(input: {
  meetingId: string;
  sessionId: string;
  sourcePage?: string;
}) {
  const payload = releaseMeetingRuntimeTakeoverSchema.safeParse(input);
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";

  if (!payload.success) {
    return {
      ok: false,
      error:
        payload.error.issues[0]?.message ?? (english ? "Invalid takeover release input" : "接管释放 参数错误"),
    };
  }

  if (!canManageWorkspaceRuntime(membership.role)) {
    return {
      ok: false,
      error: getRuntimeManagementDeniedMessage(english),
    };
  }

  try {
    const meetingOwnershipError = await getMeetingOwnershipError(workspace.id, payload.data.meetingId, english);
    if (meetingOwnershipError) {
      return { ok: false, error: meetingOwnershipError };
    }
    const sessionOwnershipError = await getRuntimeSessionOwnershipError(workspace.id, payload.data.sessionId, english);
    if (sessionOwnershipError) {
      return { ok: false, error: sessionOwnershipError };
    }

    const result = await releaseRuntimeOperatorTakeover({
      workspaceId: workspace.id,
      sessionId: payload.data.sessionId,
      actorName: user.name,
      actorUserId: user.id,
      sourcePage: payload.data.sourcePage ?? `/meetings/${payload.data.meetingId}`,
    });

    revalidatePath(`/meetings/${payload.data.meetingId}`);
    revalidatePath("/operating");

    return {
      ok: true,
      reused: result.reused,
      requestEventId: result.requestEventId,
      acknowledgementEventId: result.acknowledgementEventId,
      startEventId: result.startEventId,
      releaseEventId: result.releaseEventId,
      action: result.action,
      checkpointKey: result.checkpointKey,
      summary: result.summary,
      releaseReason: result.releaseReason,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Failed to release operator takeover"
            : "释放 操作员接管 失败",
    };
  }
}

const requestMeetingRuntimeTakeoverFollowThroughSchema = z.object({
  meetingId: z.string().min(1),
  sessionId: z.string().min(1),
});

export async function requestMeetingRuntimeTakeoverFollowThroughAction(input: {
  meetingId: string;
  sessionId: string;
}) {
  const payload = requestMeetingRuntimeTakeoverFollowThroughSchema.safeParse(input);
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";

  if (!payload.success) {
    return {
      ok: false,
      error:
        payload.error.issues[0]?.message ??
        (english ? "Invalid takeover follow-through request input" : "接管跟进闭环 request 参数错误"),
    };
  }

  if (!canManageWorkspaceRuntime(membership.role)) {
    return {
      ok: false,
      error: getRuntimeManagementDeniedMessage(english),
    };
  }

  try {
    const meetingOwnershipError = await getMeetingOwnershipError(workspace.id, payload.data.meetingId, english);
    if (meetingOwnershipError) {
      return { ok: false, error: meetingOwnershipError };
    }
    const sessionOwnershipError = await getRuntimeSessionOwnershipError(workspace.id, payload.data.sessionId, english);
    if (sessionOwnershipError) {
      return { ok: false, error: sessionOwnershipError };
    }

    const result = await requestRuntimeOperatorTakeoverFollowThrough({
      workspaceId: workspace.id,
      sessionId: payload.data.sessionId,
      actorName: user.name,
      actorUserId: user.id,
      sourcePage: `/meetings/${payload.data.meetingId}`,
    });

    revalidatePath(`/meetings/${payload.data.meetingId}`);
    revalidatePath("/operating");

    return {
      ok: true,
      reused: result.reused,
      requestEventId: result.requestEventId,
      resolutionEventId: result.resolutionEventId,
      action: result.action,
      checkpointKey: result.checkpointKey,
      summary: result.summary,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Failed to request operator takeover follow-through"
            : "请求 操作员接管 follow-through 失败",
    };
  }
}

const resolveMeetingRuntimeTakeoverFollowThroughSchema = z.object({
  meetingId: z.string().min(1),
  sessionId: z.string().min(1),
});

export async function resolveMeetingRuntimeTakeoverFollowThroughAction(input: {
  meetingId: string;
  sessionId: string;
}) {
  const payload = resolveMeetingRuntimeTakeoverFollowThroughSchema.safeParse(input);
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";

  if (!payload.success) {
    return {
      ok: false,
      error:
        payload.error.issues[0]?.message ??
        (english ? "Invalid takeover follow-through resolve input" : "接管跟进闭环 resolve 参数错误"),
    };
  }

  if (!canManageWorkspaceRuntime(membership.role)) {
    return {
      ok: false,
      error: getRuntimeManagementDeniedMessage(english),
    };
  }

  try {
    const meetingOwnershipError = await getMeetingOwnershipError(workspace.id, payload.data.meetingId, english);
    if (meetingOwnershipError) {
      return { ok: false, error: meetingOwnershipError };
    }
    const sessionOwnershipError = await getRuntimeSessionOwnershipError(workspace.id, payload.data.sessionId, english);
    if (sessionOwnershipError) {
      return { ok: false, error: sessionOwnershipError };
    }

    const result = await resolveRuntimeOperatorTakeoverFollowThrough({
      workspaceId: workspace.id,
      sessionId: payload.data.sessionId,
      actorName: user.name,
      actorUserId: user.id,
      sourcePage: `/meetings/${payload.data.meetingId}`,
    });

    revalidatePath(`/meetings/${payload.data.meetingId}`);
    revalidatePath("/operating");

    return {
      ok: true,
      reused: result.reused,
      requestEventId: result.requestEventId,
      resolutionEventId: result.resolutionEventId,
      action: result.action,
      checkpointKey: result.checkpointKey,
      summary: result.summary,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Failed to resolve operator takeover follow-through"
            : "解决 操作员接管 follow-through 失败",
    };
  }
}

const requestMeetingRuntimeSettlementReviewSchema = z.object({
  meetingId: z.string().min(1),
  sessionId: z.string().min(1),
});

export async function requestMeetingRuntimeSettlementReviewAction(input: {
  meetingId: string;
  sessionId: string;
}) {
  const payload = requestMeetingRuntimeSettlementReviewSchema.safeParse(input);
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";

  if (!payload.success) {
    return {
      ok: false,
      error:
        payload.error.issues[0]?.message ??
        (english ? "Invalid settlement review request input" : "结算复核请求参数错误"),
    };
  }

  if (!canManageWorkspaceRuntime(membership.role)) {
    return {
      ok: false,
      error: getRuntimeManagementDeniedMessage(english),
    };
  }

  try {
    const meetingOwnershipError = await getMeetingOwnershipError(workspace.id, payload.data.meetingId, english);
    if (meetingOwnershipError) {
      return { ok: false, error: meetingOwnershipError };
    }
    const sessionOwnershipError = await getRuntimeSessionOwnershipError(workspace.id, payload.data.sessionId, english);
    if (sessionOwnershipError) {
      return { ok: false, error: sessionOwnershipError };
    }

    const result = await requestRuntimeRunThreadSettlementReview({
      workspaceId: workspace.id,
      sessionId: payload.data.sessionId,
      actorName: user.name,
      actorUserId: user.id,
      sourcePage: `/meetings/${payload.data.meetingId}`,
    });

    revalidatePath(`/meetings/${payload.data.meetingId}`);
    revalidatePath("/operating");

    return {
      ok: true,
      reused: result.reused,
      requestEventId: result.requestEventId,
      resolutionEventId: result.resolutionEventId,
      checkpointKey: result.checkpointKey,
      summary: result.summary,
      state: result.state,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Failed to request settlement review"
            : "请求结算复核失败",
    };
  }
}

const resolveMeetingRuntimeSettlementReviewSchema = z.object({
  meetingId: z.string().min(1),
  sessionId: z.string().min(1),
});

export async function resolveMeetingRuntimeSettlementReviewAction(input: {
  meetingId: string;
  sessionId: string;
}) {
  const payload = resolveMeetingRuntimeSettlementReviewSchema.safeParse(input);
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";

  if (!payload.success) {
    return {
      ok: false,
      error:
        payload.error.issues[0]?.message ??
        (english ? "Invalid settlement review resolve input" : "结算复核 resolve 参数错误"),
    };
  }

  if (!canManageWorkspaceRuntime(membership.role)) {
    return {
      ok: false,
      error: getRuntimeManagementDeniedMessage(english),
    };
  }

  try {
    const meetingOwnershipError = await getMeetingOwnershipError(workspace.id, payload.data.meetingId, english);
    if (meetingOwnershipError) {
      return { ok: false, error: meetingOwnershipError };
    }
    const sessionOwnershipError = await getRuntimeSessionOwnershipError(workspace.id, payload.data.sessionId, english);
    if (sessionOwnershipError) {
      return { ok: false, error: sessionOwnershipError };
    }

    const result = await resolveRuntimeRunThreadSettlementReview({
      workspaceId: workspace.id,
      sessionId: payload.data.sessionId,
      actorName: user.name,
      actorUserId: user.id,
      sourcePage: `/meetings/${payload.data.meetingId}`,
    });

    revalidatePath(`/meetings/${payload.data.meetingId}`);
    revalidatePath("/operating");

    return {
      ok: true,
      reused: result.reused,
      requestEventId: result.requestEventId,
      resolutionEventId: result.resolutionEventId,
      checkpointKey: result.checkpointKey,
      summary: result.summary,
      state: result.state,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Failed to resolve settlement review"
            : "解决结算复核失败",
    };
  }
}

const confirmMeetingRuntimeCloseoutSchema = z.object({
  meetingId: z.string().min(1),
  sessionId: z.string().min(1),
});

export async function confirmMeetingRuntimeCloseoutAction(input: {
  meetingId: string;
  sessionId: string;
}) {
  const payload = confirmMeetingRuntimeCloseoutSchema.safeParse(input);
  if (!payload.success) {
    return {
      ok: false,
      error: resolveBilingualApiValidationIssueMessage(payload.error.issues[0]?.message),
    };
  }

  const session = await getCurrentWorkspaceSession();
  const english = session.workspace.defaultLocale === "en-US";
  if (!canManageWorkspaceRuntime(session.membership.role)) {
    return {
      ok: false,
      error: getRuntimeManagementDeniedMessage(english),
    };
  }

  const ownershipError = await getRuntimeSessionOwnershipError(
    session.workspace.id,
    payload.data.sessionId,
    english,
  );
  if (ownershipError) {
    return { ok: false, error: ownershipError };
  }

  try {
    const result = await confirmRuntimeRunThreadCloseout({
      workspaceId: session.workspace.id,
      sessionId: payload.data.sessionId,
      actorName: session.user.name,
      actorUserId: session.user.id,
      sourcePage: `/meetings/${payload.data.meetingId}`,
    });
    revalidatePath(`/meetings/${payload.data.meetingId}`);
    revalidatePath("/operating");
    return { ok: true, result };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Closeout confirmation failed."
            : "closeout confirmation 失败。",
    };
  }
}

const requestMeetingRuntimeCloseoutRefreshSchema = z.object({
  meetingId: z.string().min(1),
  sessionId: z.string().min(1),
});

export async function requestMeetingRuntimeCloseoutRefreshAction(input: {
  meetingId: string;
  sessionId: string;
}) {
  const payload = requestMeetingRuntimeCloseoutRefreshSchema.safeParse(input);
  if (!payload.success) {
    return {
      ok: false,
      error: resolveBilingualApiValidationIssueMessage(payload.error.issues[0]?.message),
    };
  }

  const session = await getCurrentWorkspaceSession();
  const english = session.workspace.defaultLocale === "en-US";
  if (!canManageWorkspaceRuntime(session.membership.role)) {
    return {
      ok: false,
      error: getRuntimeManagementDeniedMessage(english),
    };
  }

  const ownershipError = await getRuntimeSessionOwnershipError(
    session.workspace.id,
    payload.data.sessionId,
    english,
  );
  if (ownershipError) {
    return { ok: false, error: ownershipError };
  }

  try {
    const result = await requestRuntimeRunThreadCloseoutRefresh({
      workspaceId: session.workspace.id,
      sessionId: payload.data.sessionId,
      actorName: session.user.name,
      actorUserId: session.user.id,
      sourcePage: `/meetings/${payload.data.meetingId}`,
    });
    revalidatePath(`/meetings/${payload.data.meetingId}`);
    revalidatePath("/operating");
    return { ok: true, result };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Closeout refresh request failed."
            : "closeout refresh 请求失败。",
    };
  }
}

const recordMeetingRuntimeCloseoutResolutionSchema = z.object({
  meetingId: z.string().min(1),
  sessionId: z.string().min(1),
  decision: z.enum(["close_thread", "keep_open"]),
});

export async function recordMeetingRuntimeCloseoutResolutionAction(input: {
  meetingId: string;
  sessionId: string;
  decision: "close_thread" | "keep_open";
}) {
  const payload = recordMeetingRuntimeCloseoutResolutionSchema.safeParse(input);
  if (!payload.success) {
    return {
      ok: false,
      error: resolveBilingualApiValidationIssueMessage(payload.error.issues[0]?.message),
    };
  }

  const session = await getCurrentWorkspaceSession();
  const english = session.workspace.defaultLocale === "en-US";
  if (!canManageWorkspaceRuntime(session.membership.role)) {
    return {
      ok: false,
      error: getRuntimeManagementDeniedMessage(english),
    };
  }

  const ownershipError = await getRuntimeSessionOwnershipError(
    session.workspace.id,
    payload.data.sessionId,
    english,
  );
  if (ownershipError) {
    return { ok: false, error: ownershipError };
  }

  try {
    const result = await recordRuntimeRunThreadCloseoutResolution({
      workspaceId: session.workspace.id,
      sessionId: payload.data.sessionId,
      actorName: session.user.name,
      actorUserId: session.user.id,
      sourcePage: `/meetings/${payload.data.meetingId}`,
      decision: payload.data.decision,
    });
    revalidatePath(`/meetings/${payload.data.meetingId}`);
    revalidatePath("/operating");
    return { ok: true, result };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Closeout resolution failed."
            : "closeout resolution 失败。",
    };
  }
}

const requestMeetingRuntimeCloseoutResolutionFollowThroughSchema = z.object({
  meetingId: z.string().min(1),
  sessionId: z.string().min(1),
});

export async function requestMeetingRuntimeCloseoutResolutionFollowThroughAction(input: {
  meetingId: string;
  sessionId: string;
}) {
  const payload = requestMeetingRuntimeCloseoutResolutionFollowThroughSchema.safeParse(input);
  if (!payload.success) {
    return {
      ok: false,
      error: resolveBilingualApiValidationIssueMessage(payload.error.issues[0]?.message),
    };
  }

  const session = await getCurrentWorkspaceSession();
  const english = session.workspace.defaultLocale === "en-US";
  if (!canManageWorkspaceRuntime(session.membership.role)) {
    return {
      ok: false,
      error: getRuntimeManagementDeniedMessage(english),
    };
  }

  const ownershipError = await getRuntimeSessionOwnershipError(
    session.workspace.id,
    payload.data.sessionId,
    english,
  );
  if (ownershipError) {
    return { ok: false, error: ownershipError };
  }

  try {
    const result = await requestRuntimeRunThreadCloseoutResolutionFollowThrough({
      workspaceId: session.workspace.id,
      sessionId: payload.data.sessionId,
      actorName: session.user.name,
      actorUserId: session.user.id,
      sourcePage: `/meetings/${payload.data.meetingId}`,
    });
    revalidatePath(`/meetings/${payload.data.meetingId}`);
    revalidatePath("/operating");
    return { ok: true, result };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Closeout resolution follow-through request failed."
            : "closeout resolution follow-through 请求失败。",
    };
  }
}

const resolveMeetingRuntimeCloseoutResolutionFollowThroughSchema = z.object({
  meetingId: z.string().min(1),
  sessionId: z.string().min(1),
});

export async function resolveMeetingRuntimeCloseoutResolutionFollowThroughAction(input: {
  meetingId: string;
  sessionId: string;
}) {
  const payload = resolveMeetingRuntimeCloseoutResolutionFollowThroughSchema.safeParse(input);
  if (!payload.success) {
    return {
      ok: false,
      error: resolveBilingualApiValidationIssueMessage(payload.error.issues[0]?.message),
    };
  }

  const session = await getCurrentWorkspaceSession();
  const english = session.workspace.defaultLocale === "en-US";
  if (!canManageWorkspaceRuntime(session.membership.role)) {
    return {
      ok: false,
      error: getRuntimeManagementDeniedMessage(english),
    };
  }

  const ownershipError = await getRuntimeSessionOwnershipError(
    session.workspace.id,
    payload.data.sessionId,
    english,
  );
  if (ownershipError) {
    return { ok: false, error: ownershipError };
  }

  try {
    const result = await resolveRuntimeRunThreadCloseoutResolutionFollowThrough({
      workspaceId: session.workspace.id,
      sessionId: payload.data.sessionId,
      actorName: session.user.name,
      actorUserId: session.user.id,
      sourcePage: `/meetings/${payload.data.meetingId}`,
    });
    revalidatePath(`/meetings/${payload.data.meetingId}`);
    revalidatePath("/operating");
    return { ok: true, result };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Closeout resolution follow-through resolve failed."
            : "closeout resolution follow-through 解决失败。",
    };
  }
}

const requestMeetingRuntimeCloseSchema = z.object({
  meetingId: z.string().min(1),
  sessionId: z.string().min(1),
  sourcePage: z.string().min(1).optional(),
});

export async function requestMeetingRuntimeCloseAction(input: {
  meetingId: string;
  sessionId: string;
  sourcePage?: string;
}) {
  const payload = requestMeetingRuntimeCloseSchema.safeParse(input);
  if (!payload.success) {
    return {
      ok: false,
      error: resolveBilingualApiValidationIssueMessage(payload.error.issues[0]?.message),
    };
  }

  const session = await getCurrentWorkspaceSession();
  const english = session.workspace.defaultLocale === "en-US";
  if (!canManageWorkspaceRuntime(session.membership.role)) {
    return {
      ok: false,
      error: getRuntimeManagementDeniedMessage(english),
    };
  }

  const ownershipError = await getRuntimeSessionOwnershipError(
    session.workspace.id,
    payload.data.sessionId,
    english,
  );
  if (ownershipError) {
    return { ok: false, error: ownershipError };
  }

  try {
    const result = await requestRuntimeRunThreadClose({
      workspaceId: session.workspace.id,
      sessionId: payload.data.sessionId,
      actorName: session.user.name,
      actorUserId: session.user.id,
      sourcePage: payload.data.sourcePage ?? `/meetings/${payload.data.meetingId}`,
    });
    revalidatePath(`/meetings/${payload.data.meetingId}`);
    revalidatePath("/operating");
    return { ok: true, result };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Runtime close request failed."
            : "运行时 close 请求失败。",
    };
  }
}

const resumeMeetingRuntimeCheckpointSchema = z.object({
  meetingId: z.string().min(1),
  sessionId: z.string().min(1),
  checkpointId: z.string().min(1),
  sourcePage: z.string().min(1).default("/operating"),
});

export async function resumeMeetingRuntimeCheckpointAction(input: {
  meetingId: string;
  sessionId: string;
  checkpointId: string;
  sourcePage?: string;
}) {
  const payload = resumeMeetingRuntimeCheckpointSchema.safeParse(input);
  const session = await getCurrentWorkspaceSession();
  const english = session.workspace.defaultLocale === "en-US";

  if (!payload.success) {
    return {
      ok: false,
      error:
        payload.error.issues[0]?.message ??
        (english ? "Invalid runtime resume input" : "运行时续传参数错误"),
    };
  }

  if (!canManageWorkspaceRuntime(session.membership.role)) {
    return {
      ok: false,
      error: getRuntimeManagementDeniedMessage(english),
    };
  }

  const meetingOwnershipError = await getMeetingOwnershipError(
    session.workspace.id,
    payload.data.meetingId,
    english,
  );
  if (meetingOwnershipError) {
    return { ok: false, error: meetingOwnershipError };
  }

  const sessionOwnershipError = await getRuntimeSessionOwnershipError(
    session.workspace.id,
    payload.data.sessionId,
    english,
  );
  if (sessionOwnershipError) {
    return { ok: false, error: sessionOwnershipError };
  }

  try {
    const result = await resumeRuntimeCheckpoint({
      workspaceId: session.workspace.id,
      sessionId: payload.data.sessionId,
      checkpointId: payload.data.checkpointId,
      sourcePage: payload.data.sourcePage,
    });

    revalidatePath(`/meetings/${payload.data.meetingId}`);
    revalidatePath("/operating");

    return {
      ok: true,
      checkpointId: result.checkpointId,
      checkpointKey: result.checkpointKey,
      runtimeSessionId: payload.data.sessionId,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Runtime checkpoint resume failed."
            : "运行时检查点恢复失败。",
    };
  }
}

const acknowledgeMeetingRuntimeHumanInputCheckpointSchema = z.object({
  meetingId: z.string().min(1),
  sessionId: z.string().min(1),
});

export async function acknowledgeMeetingRuntimeHumanInputCheckpointAction(input: {
  meetingId: string;
  sessionId: string;
}) {
  const payload = acknowledgeMeetingRuntimeHumanInputCheckpointSchema.safeParse(input);
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";

  if (!payload.success) {
    return {
      ok: false,
      error:
        payload.error.issues[0]?.message ??
        (english
          ? "Invalid human input checkpoint 已确认 input"
          : "human input 检查点 已确认 参数错误"),
    };
  }

  if (!canManageWorkspaceRuntime(membership.role)) {
    return {
      ok: false,
      error: getRuntimeManagementDeniedMessage(english),
    };
  }

  try {
    const meetingOwnershipError = await getMeetingOwnershipError(workspace.id, payload.data.meetingId, english);
    if (meetingOwnershipError) {
      return { ok: false, error: meetingOwnershipError };
    }
    const sessionOwnershipError = await getRuntimeSessionOwnershipError(workspace.id, payload.data.sessionId, english);
    if (sessionOwnershipError) {
      return { ok: false, error: sessionOwnershipError };
    }

    const result = await acknowledgeRuntimeHumanInputCheckpointRequest({
      workspaceId: workspace.id,
      sessionId: payload.data.sessionId,
      actorName: user.name,
      actorUserId: user.id,
      sourcePage: `/meetings/${payload.data.meetingId}`,
    });

    revalidatePath(`/meetings/${payload.data.meetingId}`);
    revalidatePath("/operating");

    return {
      ok: true,
      reused: result.reused,
      requestEventId: result.requestEventId,
      acknowledgementEventId: result.acknowledgementEventId,
      checkpointKey: result.checkpointKey,
      summary: result.summary,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Failed to acknowledge human input checkpoint request"
            : "确认 human input 检查点 request 失败",
    };
  }
}

export async function runMeetingOpportunityJudgeRuntimeAction(meetingId: string, force = true) {
  const session = await requireMeetingActionGovernanceSession("manage");
  if (!session.ok) {
    return { ok: false, error: session.error };
  }

  const { user, workspace, english } = session;

  try {
    const ownershipError = await getMeetingOwnershipError(workspace.id, meetingId, english);
    if (ownershipError) {
      return { ok: false, error: ownershipError };
    }

    const result = await runOpportunityJudgeRuntime({
      workspaceId: workspace.id,
      meetingId,
      actorName: user.name,
      actorUserId: user.id,
      sourcePage: `/meetings/${meetingId}`,
      force,
    });

    revalidatePath(`/meetings/${meetingId}`);
    revalidatePath("/dashboard");
    revalidatePath("/meetings");
    revalidatePath("/opportunities");

    return {
      ok: true,
      reused: result.reused,
      runtimeEventId: result.runtimeEventId,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : english ? "Failed to start opportunity judge runtime" : "启动机会判断运行时失败",
    };
  }
}

const reviewMeetingOpportunityJudgeRuntimeSchema = z.object({
  meetingId: z.string().min(1),
  mode: z.enum(["confirm", "edit_confirm", "reject", "keep_draft", "block_boundary", "insufficient_evidence"]),
  deltaJson: z.string().optional(),
  nextStepBriefMarkdown: z.string().optional(),
  reviewNotes: z.string().optional(),
});

export async function reviewMeetingOpportunityJudgeRuntimeAction(input: {
  meetingId: string;
  mode: "confirm" | "edit_confirm" | "reject" | "keep_draft" | "block_boundary" | "insufficient_evidence";
  deltaJson?: string;
  nextStepBriefMarkdown?: string;
  reviewNotes?: string;
}) {
  const payload = reviewMeetingOpportunityJudgeRuntimeSchema.safeParse(input);
  if (!payload.success) {
    return {
      ok: false,
      error: resolveBilingualApiValidationIssueMessage(payload.error.issues[0]?.message),
    };
  }

  const reviewSession = await requireMeetingActionGovernanceSession("review");
  if (!reviewSession.ok) {
    return { ok: false, error: reviewSession.error };
  }

  const { user, workspace, english } = reviewSession;

  try {
    const ownershipError = await getMeetingOwnershipError(workspace.id, payload.data.meetingId, english);
    if (ownershipError) {
      return { ok: false, error: ownershipError };
    }

    const result = await reviewOpportunityJudgeRuntime({
      workspaceId: workspace.id,
      meetingId: payload.data.meetingId,
      reviewerId: user.id,
      reviewerName: user.name,
      mode: payload.data.mode,
      edits: {
        deltaJson: payload.data.deltaJson,
        nextStepBriefMarkdown: payload.data.nextStepBriefMarkdown,
        reviewNotes: payload.data.reviewNotes,
      },
      sourcePage: `/meetings/${payload.data.meetingId}`,
    });

    revalidatePath(`/meetings/${payload.data.meetingId}`);
    revalidatePath("/dashboard");
    revalidatePath("/meetings");
    revalidatePath("/opportunities");
    revalidatePath("/memory");
    revalidatePath("/approvals");

    if (result.shadowConsumed) {
      await syncMeetingHumanActionExecutionRuntime({
        workspaceId: workspace.id,
        meetingId: payload.data.meetingId,
        actorName: user.name,
        actorUserId: user.id,
        sourcePage: `/meetings/${payload.data.meetingId}`,
        force: false,
      }).catch(() => null);

      await syncMeetingOfficialWriteIntents({
        workspaceId: workspace.id,
        meetingId: payload.data.meetingId,
        actorName: user.name,
        actorUserId: user.id,
        sourcePage: `/meetings/${payload.data.meetingId}`,
        force: false,
      }).catch(() => null);

      revalidatePath(`/meetings/${payload.data.meetingId}`);
    }

    return {
      ok: true,
      reviewStatus: result.reviewStatus,
      approvalStatus: result.approvalStatus,
      shadowConsumed: result.shadowConsumed,
      blockedByBoundary: result.blockedByBoundary,
      insufficientEvidence: result.insufficientEvidence,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : english ? "Opportunity judgement review failed" : "机会判断复核失败",
    };
  }
}

const reviewMeetingDraftCommsRuntimeSchema = z.object({
  meetingId: z.string().min(1),
  mode: z.enum(["approve", "edit_approve", "reject", "keep_draft", "block_boundary", "fallback_non_commitment"]),
  sanitizedMarkdown: z.string().optional(),
  reviewNotes: z.string().optional(),
});

export async function reviewMeetingDraftCommsRuntimeAction(input: {
  meetingId: string;
  mode: "approve" | "edit_approve" | "reject" | "keep_draft" | "block_boundary" | "fallback_non_commitment";
  sanitizedMarkdown?: string;
  reviewNotes?: string;
}) {
  const payload = reviewMeetingDraftCommsRuntimeSchema.safeParse(input);
  if (!payload.success) {
    return {
      ok: false,
      error: resolveBilingualApiValidationIssueMessage(payload.error.issues[0]?.message),
    };
  }

  const reviewSession = await requireMeetingActionGovernanceSession("review");
  if (!reviewSession.ok) {
    return { ok: false, error: reviewSession.error };
  }

  const { user, workspace, english } = reviewSession;

  try {
    const ownershipError = await getMeetingOwnershipError(workspace.id, payload.data.meetingId, english);
    if (ownershipError) {
      return { ok: false, error: ownershipError };
    }

    const result = await reviewDraftCommsRuntime({
      workspaceId: workspace.id,
      meetingId: payload.data.meetingId,
      reviewerId: user.id,
      reviewerName: user.name,
      mode: payload.data.mode,
      edits: {
        sanitizedMarkdown: payload.data.sanitizedMarkdown,
        reviewNotes: payload.data.reviewNotes,
      },
      sourcePage: `/meetings/${payload.data.meetingId}`,
    });

    revalidatePath(`/meetings/${payload.data.meetingId}`);
    revalidatePath("/dashboard");
    revalidatePath("/meetings");
    revalidatePath("/memory");
    revalidatePath("/opportunities");
    revalidatePath("/approvals");

    if (result.approvedForNextStepHandoff) {
      await syncMeetingHumanActionExecutionRuntime({
        workspaceId: workspace.id,
        meetingId: payload.data.meetingId,
        actorName: user.name,
        actorUserId: user.id,
        sourcePage: `/meetings/${payload.data.meetingId}`,
        force: false,
      }).catch(() => null);

      revalidatePath(`/meetings/${payload.data.meetingId}`);
    }

    return {
      ok: true,
      reviewStatus: result.reviewStatus,
      approvalStatus: result.approvalStatus,
      blockedByBoundary: result.blockedByBoundary,
      approvedForNextStepHandoff: result.approvedForNextStepHandoff,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : english ? "Draft-only comms review failed" : "draft-only comms 复核失败",
    };
  }
}

export async function runMeetingHumanActionExecutionRuntimeAction(meetingId: string, force = true) {
  const session = await requireMeetingActionGovernanceSession("manage");
  if (!session.ok) {
    return { ok: false, error: session.error };
  }

  const { user, workspace, english } = session;

  try {
    const ownershipError = await getMeetingOwnershipError(workspace.id, meetingId, english);
    if (ownershipError) {
      return { ok: false, error: ownershipError };
    }

    const result = await syncMeetingHumanActionExecutionRuntime({
      workspaceId: workspace.id,
      meetingId,
      actorName: user.name,
      actorUserId: user.id,
      sourcePage: `/meetings/${meetingId}`,
      force,
    });

    revalidatePath(`/meetings/${meetingId}`);
    revalidatePath("/dashboard");
    revalidatePath("/meetings");
    revalidatePath("/memory");
    revalidatePath("/opportunities");
    revalidatePath("/approvals");

    return {
      ok: true,
      actionCount: result.actionCount,
      reused: result.reused,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Failed to build human execution surface"
            : "生成人工执行面失败",
    };
  }
}

const acknowledgeMeetingHumanActionExecutionSchema = z.object({
  meetingId: z.string().min(1),
  executionId: z.string().min(1),
  mode: z.enum([
    "mark_sent_manually",
    "mark_scheduled_manually",
    "mark_shared_internally",
    "mark_crm_step_done",
    "mark_handoff_done",
    "mark_blocked",
    "mark_deferred",
  ]),
  note: z.string().optional(),
  externalReference: z.string().optional(),
  whatWasNotDone: z.string().optional(),
  followThroughStatus: z.string().optional(),
});

export async function acknowledgeMeetingHumanActionExecutionAction(input: {
  meetingId: string;
  executionId: string;
  mode: HumanActionExecutionAckMode;
  note?: string;
  externalReference?: string;
  whatWasNotDone?: string;
  followThroughStatus?: string;
}) {
  const payload = acknowledgeMeetingHumanActionExecutionSchema.safeParse(input);
  if (!payload.success) {
    return {
      ok: false,
      error: resolveBilingualApiValidationIssueMessage(payload.error.issues[0]?.message),
    };
  }

  const reviewSession = await requireMeetingActionGovernanceSession("review");
  if (!reviewSession.ok) {
    return { ok: false, error: reviewSession.error };
  }

  const { user, workspace, english } = reviewSession;

  try {
    const ownershipError = await getMeetingOwnershipError(workspace.id, payload.data.meetingId, english);
    if (ownershipError) {
      return { ok: false, error: ownershipError };
    }

    const result = await acknowledgeHumanActionExecution({
      workspaceId: workspace.id,
      meetingId: payload.data.meetingId,
      executionId: payload.data.executionId,
      reviewerId: user.id,
      reviewerName: user.name,
      mode: payload.data.mode,
      note: payload.data.note,
      externalReference: payload.data.externalReference,
      whatWasNotDone: payload.data.whatWasNotDone,
      followThroughStatus: payload.data.followThroughStatus,
      sourcePage: `/meetings/${payload.data.meetingId}`,
    });

    revalidatePath(`/meetings/${payload.data.meetingId}`);
    revalidatePath("/dashboard");
    revalidatePath("/meetings");
    revalidatePath("/memory");
    revalidatePath("/opportunities");
    revalidatePath("/approvals");

    await syncMeetingOfficialWriteIntents({
      workspaceId: workspace.id,
      meetingId: payload.data.meetingId,
      actorName: user.name,
      actorUserId: user.id,
      sourcePage: `/meetings/${payload.data.meetingId}`,
      force: false,
    }).catch(() => null);

    revalidatePath(`/meetings/${payload.data.meetingId}`);

    return {
      ok: true,
      status: result.status,
      acknowledgementStatus: result.acknowledgementStatus,
      writebackSummary: result.writebackSummary,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Execution 已确认 failed"
            : "execution 已确认 失败",
    };
  }
}

export async function runMeetingOfficialWriteIntentRuntimeAction(meetingId: string, force = true) {
  const session = await requireMeetingActionGovernanceSession("manage");
  if (!session.ok) {
    return { ok: false, error: session.error };
  }

  const { user, workspace, english } = session;

  try {
    const ownershipError = await getMeetingOwnershipError(workspace.id, meetingId, english);
    if (ownershipError) {
      return { ok: false, error: ownershipError };
    }

    const result = await syncMeetingOfficialWriteIntents({
      workspaceId: workspace.id,
      meetingId,
      actorName: user.name,
      actorUserId: user.id,
      sourcePage: `/meetings/${meetingId}`,
      force,
    });

    revalidatePath(`/meetings/${meetingId}`);
    revalidatePath("/dashboard");
    revalidatePath("/meetings");
    revalidatePath("/memory");
    revalidatePath("/opportunities");
    revalidatePath("/approvals");

    return {
      ok: true,
      intentCount: result.intentCount,
      createdCount: result.createdCount ?? 0,
      reused: result.reused,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Failed to build guarded official write intents"
            : "生成 guarded 正式write intents 失败",
    };
  }
}

export async function runMeetingLimitedAutoRuntimeAction(meetingId: string, force = true) {
  const session = await requireMeetingActionGovernanceSession("manage");
  if (!session.ok) {
    return { ok: false, error: session.error };
  }

  const { user, workspace, english } = session;

  try {
    const ownershipError = await getMeetingOwnershipError(workspace.id, meetingId, english);
    if (ownershipError) {
      return { ok: false, error: ownershipError };
    }

    const result = await syncMeetingLimitedAutoIntents({
      workspaceId: workspace.id,
      meetingId,
      actorName: user.name,
      actorUserId: user.id,
      sourcePage: `/meetings/${meetingId}`,
      force,
    });

    revalidatePath(`/meetings/${meetingId}`);
    revalidatePath("/dashboard");
    revalidatePath("/meetings");
    revalidatePath("/memory");
    revalidatePath("/opportunities");
    revalidatePath("/approvals");

    return {
      ok: true,
      intentCount: result.intentCount,
      createdCount: result.createdCount ?? 0,
      reused: result.reused,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Failed to refresh limited auto runtime"
            : "刷新 limited auto 运行时失败",
    };
  }
}

export async function runMeetingOfficialFollowThroughRuntimeAction(meetingId: string, force = true) {
  const session = await requireMeetingActionGovernanceSession("manage");
  if (!session.ok) {
    return { ok: false, error: session.error };
  }

  const { user, workspace, english } = session;

  try {
    const ownershipError = await getMeetingOwnershipError(workspace.id, meetingId, english);
    if (ownershipError) {
      return { ok: false, error: ownershipError };
    }

    const result = await syncMeetingOfficialFollowThroughRuntime({
      workspaceId: workspace.id,
      meetingId,
      actorName: user.name,
      actorUserId: user.id,
      sourcePage: `/meetings/${meetingId}`,
      force,
    });

    revalidatePath(`/meetings/${meetingId}`);
    revalidatePath("/dashboard");
    revalidatePath("/meetings");
    revalidatePath("/memory");
    revalidatePath("/opportunities");
    revalidatePath("/approvals");

    return {
      ok: true,
      followThroughCount: result.followThroughCount,
      createdCount: result.createdCount ?? 0,
      reused: result.reused,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Failed to refresh official follow-through runtime"
            : "刷新 正式follow-through 运行时失败",
    };
  }
}

const reviewMeetingOfficialWriteIntentSchema = z.object({
  meetingId: z.string().min(1),
  intentId: z.string().min(1),
  mode: z.enum(["approve", "reject", "keep_pending", "block_boundary", "insufficient_evidence"]),
  reviewNotes: z.string().optional(),
});

export async function reviewMeetingOfficialWriteIntentAction(input: {
  meetingId: string;
  intentId: string;
  mode: OfficialWriteReviewMode;
  reviewNotes?: string;
}) {
  const payload = reviewMeetingOfficialWriteIntentSchema.safeParse(input);
  if (!payload.success) {
    return {
      ok: false,
      error: resolveBilingualApiValidationIssueMessage(payload.error.issues[0]?.message),
    };
  }

  const reviewSession = await requireMeetingActionGovernanceSession("review");
  if (!reviewSession.ok) {
    return { ok: false, error: reviewSession.error };
  }

  const { user, workspace, english } = reviewSession;

  try {
    const ownershipError = await getMeetingOwnershipError(workspace.id, payload.data.meetingId, english);
    if (ownershipError) {
      return { ok: false, error: ownershipError };
    }

    const result = await reviewOfficialWriteIntent({
      workspaceId: workspace.id,
      meetingId: payload.data.meetingId,
      intentId: payload.data.intentId,
      reviewerId: user.id,
      reviewerName: user.name,
      mode: payload.data.mode,
      reviewNotes: payload.data.reviewNotes,
      sourcePage: `/meetings/${payload.data.meetingId}`,
    });

    revalidatePath(`/meetings/${payload.data.meetingId}`);
    revalidatePath("/dashboard");
    revalidatePath("/meetings");
    revalidatePath("/memory");
    revalidatePath("/opportunities");
    revalidatePath("/approvals");

    return {
      ok: true,
      approvalStatus: result.approvalStatus,
      blockedByBoundary: result.blockedByBoundary,
      insufficientEvidence: result.insufficientEvidence,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Official write intent review failed"
            : "正式write 意图复核失败",
    };
  }
}

const attemptMeetingOfficialWriteIntentSchema = z.object({
  meetingId: z.string().min(1),
  intentId: z.string().min(1),
});

export async function attemptMeetingOfficialWriteIntentAction(input: {
  meetingId: string;
  intentId: string;
}) {
  const payload = attemptMeetingOfficialWriteIntentSchema.safeParse(input);
  if (!payload.success) {
    return {
      ok: false,
      error: resolveBilingualApiValidationIssueMessage(payload.error.issues[0]?.message),
    };
  }

  const session = await requireMeetingActionGovernanceSession("manage");
  if (!session.ok) {
    return { ok: false, error: session.error };
  }

  const { user, workspace, english } = session;

  try {
    const ownershipError = await getMeetingOwnershipError(workspace.id, payload.data.meetingId, english);
    if (ownershipError) {
      return { ok: false, error: ownershipError };
    }

    const result = await attemptOfficialWriteIntent({
      workspaceId: workspace.id,
      meetingId: payload.data.meetingId,
      intentId: payload.data.intentId,
      actorId: user.id,
      actorName: user.name,
      sourcePage: `/meetings/${payload.data.meetingId}`,
    });

    revalidatePath(`/meetings/${payload.data.meetingId}`);
    revalidatePath("/dashboard");
    revalidatePath("/meetings");
    revalidatePath("/memory");
    revalidatePath("/opportunities");
    revalidatePath("/approvals");

    return {
      ok: true,
      executionStatus: result.executionStatus,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Guarded official write attempt failed"
            : "guarded 正式write attempt 失败",
    };
  }
}

const acknowledgeMeetingOfficialWriteIntentSchema = z.object({
  meetingId: z.string().min(1),
  intentId: z.string().min(1),
  mode: z.enum([
    "ack_success",
    "ack_failure",
    "receipt_unknown",
    "receipt_partial_success",
    "receipt_stale",
    "reconciliation_note",
    "reconciliation_resolved",
    "deferred_retry",
  ]),
  note: z.string().optional(),
  externalSystemReference: z.string().optional(),
});

export async function acknowledgeMeetingOfficialWriteIntentAction(input: {
  meetingId: string;
  intentId: string;
  mode: OfficialWriteAcknowledgementMode;
  note?: string;
  externalSystemReference?: string;
}) {
  const payload = acknowledgeMeetingOfficialWriteIntentSchema.safeParse(input);
  if (!payload.success) {
    return {
      ok: false,
      error: resolveBilingualApiValidationIssueMessage(payload.error.issues[0]?.message),
    };
  }

  const reviewSession = await requireMeetingActionGovernanceSession("review");
  if (!reviewSession.ok) {
    return { ok: false, error: reviewSession.error };
  }

  const { user, workspace, english } = reviewSession;

  try {
    const ownershipError = await getMeetingOwnershipError(workspace.id, payload.data.meetingId, english);
    if (ownershipError) {
      return { ok: false, error: ownershipError };
    }

    const result = await acknowledgeOfficialWriteIntent({
      workspaceId: workspace.id,
      meetingId: payload.data.meetingId,
      intentId: payload.data.intentId,
      reviewerId: user.id,
      reviewerName: user.name,
      mode: payload.data.mode,
      note: payload.data.note,
      externalSystemReference: payload.data.externalSystemReference,
      sourcePage: `/meetings/${payload.data.meetingId}`,
    });

    revalidatePath(`/meetings/${payload.data.meetingId}`);
    revalidatePath("/dashboard");
    revalidatePath("/meetings");
    revalidatePath("/memory");
    revalidatePath("/opportunities");
    revalidatePath("/approvals");

    return {
      ok: true,
      executionStatus: result.executionStatus,
      acknowledgementStatus: result.acknowledgementStatus,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Official write 已确认 failed"
            : "正式write 已确认 失败",
    };
  }
}

const reviewMeetingLimitedAutoIntentSchema = z.object({
  meetingId: z.string().min(1),
  limitedAutoIntentId: z.string().min(1),
  mode: z.enum(["approve", "reject", "keep_pending", "block_boundary", "force_manual"]),
  reviewNotes: z.string().optional(),
});

export async function reviewMeetingLimitedAutoIntentAction(input: {
  meetingId: string;
  limitedAutoIntentId: string;
  mode: LimitedAutoReviewMode;
  reviewNotes?: string;
}) {
  const payload = reviewMeetingLimitedAutoIntentSchema.safeParse(input);
  if (!payload.success) {
    return {
      ok: false,
      error: resolveBilingualApiValidationIssueMessage(payload.error.issues[0]?.message),
    };
  }

  const reviewSession = await requireMeetingActionGovernanceSession("review");
  if (!reviewSession.ok) {
    return { ok: false, error: reviewSession.error };
  }

  const { user, workspace, english } = reviewSession;

  try {
    const ownershipError = await getMeetingOwnershipError(workspace.id, payload.data.meetingId, english);
    if (ownershipError) {
      return { ok: false, error: ownershipError };
    }

    const result = await reviewLimitedAutoIntent({
      workspaceId: workspace.id,
      meetingId: payload.data.meetingId,
      limitedAutoIntentId: payload.data.limitedAutoIntentId,
      reviewerId: user.id,
      reviewerName: user.name,
      mode: payload.data.mode,
      reviewNotes: payload.data.reviewNotes,
      sourcePage: `/meetings/${payload.data.meetingId}`,
    });

    revalidatePath(`/meetings/${payload.data.meetingId}`);
    revalidatePath("/dashboard");
    revalidatePath("/meetings");
    revalidatePath("/memory");
    revalidatePath("/opportunities");
    revalidatePath("/approvals");

    return {
      ok: true,
      approvalStatus: result.approvalStatus,
      executionStatus: result.executionStatus,
      ackStatus: result.ackStatus,
      failureStatus: "failureStatus" in result ? result.failureStatus : undefined,
      rollbackStatus: "rollbackStatus" in result ? result.rollbackStatus : undefined,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Limited auto review failed"
            : "limited auto 复核失败",
    };
  }
}

const updateMeetingOfficialFollowThroughSchema = z.object({
  meetingId: z.string().min(1),
  followThroughId: z.string().min(1),
  mode: z.enum([
    "assign_owner",
    "mark_next_action",
    "add_reconciliation_note",
    "mark_investigating",
    "mark_awaiting_external_receipt",
    "resolve",
    "close_no_change",
    "defer",
    "escalate_manager",
    "force_manual_fallback",
    "block_boundary",
  ]),
  ownerName: z.string().optional(),
  nextAction: z.string().optional(),
  note: z.string().optional(),
});

export async function updateMeetingOfficialFollowThroughAction(input: {
  meetingId: string;
  followThroughId: string;
  mode: OfficialFollowThroughUpdateMode;
  ownerName?: string;
  nextAction?: string;
  note?: string;
}) {
  const payload = updateMeetingOfficialFollowThroughSchema.safeParse(input);
  if (!payload.success) {
    return {
      ok: false,
      error: resolveBilingualApiValidationIssueMessage(payload.error.issues[0]?.message),
    };
  }

  const reviewSession = await requireMeetingActionGovernanceSession("review");
  if (!reviewSession.ok) {
    return { ok: false, error: reviewSession.error };
  }

  const { user, workspace, english } = reviewSession;

  try {
    const ownershipError = await getMeetingOwnershipError(workspace.id, payload.data.meetingId, english);
    if (ownershipError) {
      return { ok: false, error: ownershipError };
    }

    const result = await updateOfficialFollowThrough({
      workspaceId: workspace.id,
      meetingId: payload.data.meetingId,
      followThroughId: payload.data.followThroughId,
      actorId: user.id,
      actorName: user.name,
      mode: payload.data.mode,
      ownerName: payload.data.ownerName,
      nextAction: payload.data.nextAction,
      note: payload.data.note,
      sourcePage: `/meetings/${payload.data.meetingId}`,
    });

    revalidatePath(`/meetings/${payload.data.meetingId}`);
    revalidatePath("/dashboard");
    revalidatePath("/meetings");
    revalidatePath("/memory");
    revalidatePath("/opportunities");
    revalidatePath("/approvals");

    return {
      ok: true,
      followThroughStatus: result.followThroughStatus,
      reconciliationStatus: result.reconciliationStatus,
      resolutionStatus: result.resolutionStatus,
      checkpointId: result.checkpointId,
    };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : english
            ? "Official follow-through update failed"
            : "正式follow-through 更新失败",
    };
  }
}

const actionItemUpdateSchema = z.object({
  actionItemId: z.string(),
  title: z.string().min(2),
  description: z.string().min(2),
  dueDate: z.string().optional(),
  ownerId: z.string().optional(),
  executionMode: z.enum(["SUGGEST_ONLY", "REQUIRES_APPROVAL", "AUTO_WITHIN_THRESHOLD", "FORBIDDEN"]),
});

export async function updateMeetingActionItemAction(input: z.infer<typeof actionItemUpdateSchema>) {
  const session = await requireMeetingActionGovernanceSession("manage");
  if (!session.ok) {
    return { ok: false, error: session.error };
  }

  const { user, workspace, english } = session;
  const parsed = actionItemUpdateSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? (english ? "Action input is incomplete" : "动作信息不完整") };
  }

  const payload = parsed.data;
  const actionItem = await db.actionItem.findFirst({
    where: {
      id: payload.actionItemId,
      workspaceId: workspace.id,
    },
    include: {
      approvalTask: true,
      meeting: true,
    },
  });

  if (!actionItem) {
    return { ok: false, error: english ? "Action item not found" : "动作不存在" };
  }

  if (actionItem.status === ActionStatus.EXECUTED) {
    return { ok: false, error: english ? "Executed actions cannot be edited again" : "已执行动作不可再次编辑" };
  }

  const nextRequiresApproval = payload.executionMode === ActionExecutionMode.REQUIRES_APPROVAL;
  const isHighRisk = actionItem.riskLevel === "HIGH" || actionItem.riskLevel === "CRITICAL";

  if (isHighRisk && !nextRequiresApproval) {
    return { ok: false, error: english ? "High-risk actions must go through approval" : "高风险动作必须走审批" };
  }

  const resolvedOwnerId = payload.ownerId
    ? await resolveWorkspaceAssignableOwnerId({
        workspaceId: workspace.id,
        requestedOwnerId: payload.ownerId,
        fallbackUserId: user.id,
      })
    : null;

  if (payload.ownerId && !resolvedOwnerId) {
    return {
      ok: false,
      error: getWorkspaceAssignableOwnerDeniedMessage(english),
    };
  }

  const nextStatus =
    payload.executionMode === ActionExecutionMode.FORBIDDEN
      ? ActionStatus.BLOCKED
      : nextRequiresApproval
        ? ActionStatus.PENDING_APPROVAL
        : payload.executionMode === ActionExecutionMode.AUTO_WITHIN_THRESHOLD
          ? ActionStatus.APPROVED
          : ActionStatus.SUGGESTED;

  await db.actionItem.update({
    where: { id: actionItem.id },
    data: {
      title: payload.title,
      description: payload.description,
      dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
      ownerId: resolvedOwnerId,
      executionMode: payload.executionMode,
      requiresApproval: nextRequiresApproval,
      status: nextStatus,
      executionStatus:
        payload.executionMode === ActionExecutionMode.FORBIDDEN
          ? "blocked"
          : nextRequiresApproval
            ? "pending_approval"
            : payload.executionMode === ActionExecutionMode.AUTO_WITHIN_THRESHOLD
              ? "approved"
              : "suggested",
      statusReason:
        payload.executionMode === ActionExecutionMode.FORBIDDEN
          ? (english ? "This action has been set to forbidden" : "该动作已被设置为禁止执行")
          : nextRequiresApproval
            ? (english ? "This action now requires per-item approval" : "该动作已改为逐条审批")
            : payload.executionMode === ActionExecutionMode.AUTO_WITHIN_THRESHOLD
              ? (english ? "This action now auto-executes within threshold" : "该动作已改为自动执行")
              : (english ? "This action now stays as a suggestion only" : "该动作仅保留建议，不直接执行"),
    },
  });

  if (nextRequiresApproval) {
    if (!actionItem.approvalTask) {
      const createdTask = await db.approvalTask.create({
        data: {
          workspaceId: workspace.id,
          actionItemId: actionItem.id,
          status: ApprovalStatus.PENDING,
          isHighRisk,
          autoExecute: false,
          contextSnapshot: actionItem.description,
          reasoning: actionItem.aiReason,
          editableContent: payload.description,
          resultPreview: english ? "After approval, the action will execute and sync the meeting and related object timelines." : "审批通过后会执行该动作，并同步会议与相关对象时间线。",
          channel: actionItem.actionType === ActionType.DRAFT_EXTERNAL_EMAIL ? (english ? "External action" : "外发动作") : (english ? "Internal action" : "内部动作"),
        },
      });

      await logEvent({
        workspaceId: workspace.id,
        userId: user.id,
        eventName: "approval_submitted",
        eventCategory: "approval",
        targetType: "ApprovalTask",
        targetId: createdTask.id,
        metadata: {
          actionItemId: actionItem.id,
          actionType: actionItem.actionType,
          riskLevel: actionItem.riskLevel,
          source: "meeting_action_edit",
        },
        sourcePage: `/meetings/${actionItem.meetingId}`,
      });
    } else if (actionItem.approvalTask.status !== ApprovalStatus.PENDING) {
      await db.approvalTask.update({
        where: { id: actionItem.approvalTask.id },
        data: {
          status: ApprovalStatus.PENDING,
          editableContent: payload.description,
          reviewedAt: null,
          reviewedById: null,
          decisionReason: null,
        },
      });

      await logEvent({
        workspaceId: workspace.id,
        userId: user.id,
        eventName: "approval_submitted",
        eventCategory: "approval",
        targetType: "ApprovalTask",
        targetId: actionItem.approvalTask.id,
        metadata: {
          actionItemId: actionItem.id,
          actionType: actionItem.actionType,
          riskLevel: actionItem.riskLevel,
          source: "meeting_action_edit",
        },
        sourcePage: `/meetings/${actionItem.meetingId}`,
      });
    }
  } else if (actionItem.approvalTask && actionItem.approvalTask.status === ApprovalStatus.PENDING) {
    await db.approvalTask.update({
      where: { id: actionItem.approvalTask.id },
      data: {
        status: ApprovalStatus.WITHDRAWN,
        reviewedAt: new Date(),
        reviewedById: user.id,
        decisionReason: english ? "Approval withdrawn and changed to a non-approval mode" : "审批已撤回，改为非审批方式处理",
      },
    });
  }

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "MEETING_ACTION_ITEM_UPDATED",
    targetType: "ActionItem",
    targetId: actionItem.id,
    summary: english ? `Updated meeting action: ${payload.title}` : `更新会议动作：${payload.title}`,
    payload,
  });

  revalidatePath(`/meetings/${actionItem.meetingId}`);
  revalidatePath("/approvals");
  revalidatePath("/dashboard");
  revalidatePath("/memory");

  if (payload.executionMode === ActionExecutionMode.AUTO_WITHIN_THRESHOLD) {
    await executeActionItem(actionItem.id, {
      actorName: english ? "System" : "系统",
      actorType: ActorType.SYSTEM,
      actorUserId: user.id,
      english,
      decisionReason: english ? "Auto-executed immediately after editing from the meeting page" : "会议页编辑后按自动执行规则立即执行",
    });
  }

  return { ok: true };
}
