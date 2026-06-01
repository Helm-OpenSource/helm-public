"use server";

import { ActionType, ActorType, OpportunityStage, SourceType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logEvent } from "@/lib/analytics";
import { writeAuditLog } from "@/lib/audit";
import { getCurrentWorkspace, getCurrentWorkspaceSession, requireCurrentUser } from "@/lib/auth/session";
import {
  canManageWorkspaceRecords,
  getWorkspaceAssignableOwnerDeniedMessage,
  getWorkspaceRecordManagementDeniedMessage,
  getWorkspaceScopedRecordUnavailableMessage,
  resolveWorkspaceAssignableOwnerId,
} from "@/lib/auth/workspace-data-governance";
import { db } from "@/lib/db";
import { recordOpportunityStageChangedDelta } from "@/lib/evolution/delta-event.service";
import { refreshEvolutionState } from "@/lib/evolution/pattern-detection.service";
import { createGovernedAction } from "@/lib/policies/engine";

const opportunitySchema = z.object({
  id: z.string().optional(),
  title: z.string().min(2),
  type: z.enum(["CLIENT", "RECRUITING", "PARTNERSHIP", "INTERNAL"]),
  stage: z.enum(["NEW", "CONTACTED", "ADVANCING", "WAITING_THEM", "INTERNAL_SYNC", "DONE", "LOST"]),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  nextAction: z.string().trim().optional().nullable(),
  dueDate: z.string().optional(),
  companyId: z.string().optional(),
  ownerId: z.string().optional(),
  lossReason: z.string().optional(),
});

export async function saveOpportunityAction(input: z.infer<typeof opportunitySchema>) {
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";

  if (!canManageWorkspaceRecords(membership.role)) {
    return { ok: false, error: getWorkspaceRecordManagementDeniedMessage(english) };
  }

  const parsed = opportunitySchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? (english ? "Opportunity input is incomplete" : "机会信息不完整") };
  }

  const payload = parsed.data;
  const normalizedNextAction = payload.nextAction?.trim() || null;
  const [existingOpportunity, company, ownerId] = await Promise.all([
    payload.id
      ? db.opportunity.findFirst({
          where: {
            id: payload.id,
            workspaceId: workspace.id,
          },
          select: { id: true, ownerId: true },
        })
      : Promise.resolve(null),
    payload.companyId
      ? db.company.findFirst({
          where: {
            id: payload.companyId,
            workspaceId: workspace.id,
          },
          select: { id: true },
        })
      : Promise.resolve(null),
    resolveWorkspaceAssignableOwnerId({
      workspaceId: workspace.id,
      requestedOwnerId: payload.ownerId,
      fallbackUserId: user.id,
    }),
  ]);

  if (payload.id && !existingOpportunity) {
    return { ok: false, error: getWorkspaceScopedRecordUnavailableMessage(english, "opportunity") };
  }

  if (payload.companyId && !company) {
    return { ok: false, error: getWorkspaceScopedRecordUnavailableMessage(english, "company") };
  }

  if (!ownerId) {
    return { ok: false, error: getWorkspaceAssignableOwnerDeniedMessage(english) };
  }

  const nextOwnerId =
    payload.id
      ? payload.ownerId === undefined
        ? existingOpportunity?.ownerId ?? null
        : ownerId
      : ownerId;

  const opportunity = payload.id
    ? await db.opportunity.update({
        where: { id: payload.id },
        data: {
          title: payload.title,
          type: payload.type,
          stage: payload.stage,
          riskLevel: payload.riskLevel,
          nextAction: normalizedNextAction,
          dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
          companyId: company?.id ?? null,
          ownerId: nextOwnerId,
          lossReason: payload.lossReason || null,
        },
      })
    : await db.opportunity.create({
        data: {
          workspaceId: workspace.id,
          title: payload.title,
          type: payload.type,
          stage: payload.stage,
          riskLevel: payload.riskLevel,
          nextAction: normalizedNextAction,
          dueDate: payload.dueDate ? new Date(payload.dueDate) : undefined,
          companyId: company?.id,
          ownerId: nextOwnerId,
          lossReason: payload.lossReason || undefined,
        },
      });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: payload.id ? "OPPORTUNITY_UPDATED" : "OPPORTUNITY_CREATED",
    targetType: "Opportunity",
    targetId: opportunity.id,
    summary: english ? `${payload.id ? "Updated" : "Created"} opportunity: ${opportunity.title}` : `${payload.id ? "更新" : "新建"}机会：${opportunity.title}`,
    payload,
  });

  revalidatePath("/opportunities");
  revalidatePath("/dashboard");
  revalidatePath("/search");

  return { ok: true, id: opportunity.id };
}

export async function moveOpportunityStageAction(opportunityId: string, stage: OpportunityStage, lossReason?: string) {
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";

  if (!canManageWorkspaceRecords(membership.role)) {
    return { ok: false, error: getWorkspaceRecordManagementDeniedMessage(english) };
  }

  const current = await db.opportunity.findFirst({
    where: { id: opportunityId, workspaceId: workspace.id },
  });

  if (!current) {
    return { ok: false, error: getWorkspaceScopedRecordUnavailableMessage(english, "opportunity") };
  }

  const updated = await db.opportunity.update({
    where: { id: opportunityId },
    data: {
      stage,
      lossReason: stage === OpportunityStage.LOST ? lossReason ?? (english ? "Not recorded" : "未记录") : null,
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "OPPORTUNITY_STAGE_CHANGED",
    targetType: "Opportunity",
    targetId: updated.id,
    summary: english ? `Opportunity stage updated to ${stage}` : `机会阶段更新为 ${stage}`,
    payload: { stage, lossReason },
  });

  await logEvent({
    workspaceId: workspace.id,
    userId: user.id,
    eventName: "opportunity_stage_changed",
    eventCategory: "opportunity",
    targetType: "Opportunity",
    targetId: updated.id,
    metadata: {
      from: current?.stage ?? null,
      to: stage,
      lossReason: stage === OpportunityStage.LOST ? lossReason ?? null : null,
    },
    sourcePage: "/opportunities",
  });

  try {
    await recordOpportunityStageChangedDelta({
      workspaceId: workspace.id,
      actorId: user.id,
      actorType: ActorType.USER,
      sourcePage: "/opportunities",
      opportunityId: updated.id,
      fromStage: current?.stage ?? null,
      toStage: stage,
      lossReason: stage === OpportunityStage.LOST ? lossReason ?? null : null,
    });

    await refreshEvolutionState({
      workspaceId: workspace.id,
      actorId: user.id,
      actorType: ActorType.USER,
      sourcePage: "/opportunities",
      trigger: "opportunity_stage_changed",
    });
  } catch (error) {
    console.error("opportunity evolution refresh failed", error);
  }

  revalidatePath("/opportunities");
  revalidatePath("/dashboard");
  revalidatePath("/search");

  return { ok: true as const };
}

export async function generateOpportunityFollowUpAction(opportunityId: string) {
  const user = await requireCurrentUser();
  const workspace = await getCurrentWorkspace();
  const english = workspace.defaultLocale === "en-US";
  const opportunity = await db.opportunity.findFirst({
    where: { id: opportunityId, workspaceId: workspace.id },
    include: { contacts: true, company: true },
  });

  if (!opportunity) {
    return { ok: false, error: english ? "Opportunity not found" : "机会不存在" };
  }

  const contact = opportunity.contacts[0];
  const result = await createGovernedAction({
    workspaceId: workspace.id,
    actorName: user.name,
    actorUserId: user.id,
    actorType: ActorType.USER,
    english,
    actionType: ActionType.DRAFT_EXTERNAL_EMAIL,
    title: english ? `Follow up ${opportunity.title}` : `跟进 ${opportunity.title}`,
    description: english ? `Send a follow-up draft to ${contact?.name ?? opportunity.company?.name ?? "the linked party"}` : `向 ${contact?.name ?? opportunity.company?.name ?? "相关对象"} 发送跟进草稿`,
    aiReason: english ? `The current stage is ${opportunity.stage}, so a structured follow-up is the cleanest way to close the next step.` : `当前阶段为 ${opportunity.stage}，建议用一封结构化 follow-up 收口下一步。`,
    draftContent: english ? `${contact?.name ?? "Hi"}, based on the latest progress, I organized the suggested next step and the items that still need confirmation...` : `${contact?.name ?? "你好"}，基于最近进展，我整理了下一步推进建议与需要确认的事项……`,
    riskLevel: opportunity.riskLevel,
    dueDate: opportunity.dueDate ?? undefined,
    opportunityId: opportunity.id,
    contactId: contact?.id,
    ownerId: opportunity.ownerId ?? user.id,
    metadata: {
      nextStage: opportunity.stage === OpportunityStage.ADVANCING ? OpportunityStage.WAITING_THEM : opportunity.stage,
    },
    resultPreview: english ? "After approval, the follow-up record will be created and both contact and opportunity timelines will update." : "审批通过后会生成跟进记录，并同步联系人与机会时间线。",
  });

  return { ok: true, result };
}

export async function createActionFromDingTalkSignalAction(opportunityId: string) {
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";

  if (!canManageWorkspaceRecords(membership.role)) {
    return { ok: false, error: getWorkspaceRecordManagementDeniedMessage(english) };
  }

  const [opportunity, signal] = await Promise.all([
    db.opportunity.findFirst({
      where: { id: opportunityId, workspaceId: workspace.id },
      include: { company: true, contacts: true },
    }),
    db.connectorIngestionRecord.findFirst({
      where: {
        workspaceId: workspace.id,
        opportunityId,
        sourceScope: { startsWith: "OBJECT:" },
      },
      orderBy: { createdAt: "desc" },
      select: {
        sourceId: true,
        sourceScope: true,
        sourceType: true,
        sourceSummary: true,
        draftPayload: true,
      },
    }),
  ]);

  if (!opportunity) {
    return { ok: false, error: getWorkspaceScopedRecordUnavailableMessage(english, "opportunity") };
  }

  if (!signal) {
    return {
      ok: false,
      error: english
        ? "No DingTalk signal is linked to this opportunity yet."
        : "当前机会还没有可转换的钉钉信号。",
    };
  }

  const scope = signal.sourceScope.split(":")[1] ?? "UNKNOWN";
  const result = await createGovernedAction({
    workspaceId: workspace.id,
    actorName: user.name,
    actorUserId: user.id,
    actorType: ActorType.USER,
    english,
    actionType: ActionType.CREATE_TASK,
    title: english
      ? `DingTalk follow-through · ${opportunity.title}`
      : `钉钉信号跟进 · ${opportunity.title}`,
    description: signal.sourceSummary,
    aiReason: english
      ? `Converted from DingTalk ${scope} signal and routed through governed action flow.`
      : `由钉钉 ${scope} 信号转换，并进入受治理动作链。`,
    draftContent: signal.sourceSummary,
    riskLevel: "HIGH",
    opportunityId: opportunity.id,
    contactId: opportunity.contacts[0]?.id,
    ownerId: opportunity.ownerId ?? user.id,
    sourceType: SourceType.SYSTEM_INFERENCE,
    sourceId: `dingtalk-mcp:manual:${scope}:${signal.sourceType}:${signal.sourceId}`,
    metadata: {
      sourceProvider: "DINGTALK_MCP",
      sourceScope: scope,
      sourceType: signal.sourceType,
      sourceId: signal.sourceId,
      bridgeMode: "manual_from_opportunity_surface",
    },
    resultPreview: english
      ? "This converted action remains review-first and may require approval based on policy."
      : "该转换动作保持复核优先，并按策略决定是否进入审批。",
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "DINGTALK_SIGNAL_CONVERTED_TO_ACTION",
    targetType: "ActionItem",
    targetId: result.actionItemId,
    relatedObjectType: "Opportunity",
    relatedObjectId: opportunity.id,
    sourcePage: "/opportunities",
    summary: english
      ? "Converted DingTalk signal to governed action from opportunity surface."
      : "已从机会页面将钉钉信号转换为受治理动作。",
    payload: {
      sourceId: signal.sourceId,
      sourceScope: signal.sourceScope,
      sourceType: signal.sourceType,
      result,
    },
  });

  revalidatePath("/opportunities");
  revalidatePath("/approvals");
  revalidatePath("/dashboard");

  return { ok: true, result };
}

export async function updateOpportunityNextActionAction(opportunityId: string, nextAction: string) {
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";

  if (!canManageWorkspaceRecords(membership.role)) {
    return { ok: false, error: getWorkspaceRecordManagementDeniedMessage(english) };
  }

  const existingOpportunity = await db.opportunity.findFirst({
    where: { id: opportunityId, workspaceId: workspace.id },
    select: { id: true },
  });

  if (!existingOpportunity) {
    return { ok: false, error: getWorkspaceScopedRecordUnavailableMessage(english, "opportunity") };
  }

  const updated = await db.opportunity.update({
    where: { id: opportunityId },
    data: { nextAction },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "OPPORTUNITY_NEXT_ACTION_UPDATED",
    targetType: "Opportunity",
    targetId: updated.id,
    summary: english ? "Updated the opportunity next step" : "更新了机会下一步动作",
    payload: { nextAction },
  });

  revalidatePath("/opportunities");
  revalidatePath("/search");

  return { ok: true };
}

export async function assignOpportunityOwnerAction(opportunityId: string, ownerId: string) {
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";

  if (!canManageWorkspaceRecords(membership.role)) {
    return { ok: false, error: getWorkspaceRecordManagementDeniedMessage(english) };
  }

  const [existingOpportunity, resolvedOwnerId] = await Promise.all([
    db.opportunity.findFirst({
      where: { id: opportunityId, workspaceId: workspace.id },
      select: { id: true },
    }),
    resolveWorkspaceAssignableOwnerId({
      workspaceId: workspace.id,
      requestedOwnerId: ownerId,
      fallbackUserId: user.id,
    }),
  ]);

  if (!existingOpportunity) {
    return { ok: false, error: getWorkspaceScopedRecordUnavailableMessage(english, "opportunity") };
  }

  if (!resolvedOwnerId || resolvedOwnerId !== ownerId) {
    return { ok: false, error: getWorkspaceAssignableOwnerDeniedMessage(english) };
  }

  await db.opportunity.update({
    where: { id: opportunityId },
    data: { ownerId: resolvedOwnerId },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "OPPORTUNITY_OWNER_CHANGED",
    targetType: "Opportunity",
    targetId: opportunityId,
    summary: english ? "Changed opportunity owner" : "已调整机会负责人",
    payload: { ownerId },
  });

  revalidatePath("/opportunities");
  return { ok: true };
}

const bulkOpportunitySchema = z.object({
  ids: z.array(z.string()).min(1),
  stage: z.enum(["NEW", "CONTACTED", "ADVANCING", "WAITING_THEM", "INTERNAL_SYNC", "DONE", "LOST"]).optional(),
  ownerId: z.string().optional(),
  dueDate: z.string().optional(),
});

export async function bulkUpdateOpportunitiesAction(input: z.infer<typeof bulkOpportunitySchema>) {
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const parsed = bulkOpportunitySchema.safeParse(input);
  const english = workspace.defaultLocale === "en-US";

  if (!canManageWorkspaceRecords(membership.role)) {
    return { ok: false, error: getWorkspaceRecordManagementDeniedMessage(english) };
  }

  if (!parsed.success) {
    return { ok: false, error: english ? "Invalid bulk-update input" : "批量更新参数错误" };
  }

  const payload = parsed.data;
  const [matchedCount, resolvedOwnerId] = await Promise.all([
    db.opportunity.count({
      where: {
        workspaceId: workspace.id,
        id: {
          in: payload.ids,
        },
      },
    }),
    payload.ownerId
      ? resolveWorkspaceAssignableOwnerId({
          workspaceId: workspace.id,
          requestedOwnerId: payload.ownerId,
          fallbackUserId: user.id,
        })
      : Promise.resolve(undefined),
  ]);

  if (matchedCount !== payload.ids.length) {
    return { ok: false, error: getWorkspaceScopedRecordUnavailableMessage(english, "opportunity") };
  }

  if (payload.ownerId && resolvedOwnerId !== payload.ownerId) {
    return { ok: false, error: getWorkspaceAssignableOwnerDeniedMessage(english) };
  }

  await db.opportunity.updateMany({
    where: {
      workspaceId: workspace.id,
      id: {
        in: payload.ids,
      },
    },
    data: {
      stage: payload.stage,
      ownerId: resolvedOwnerId,
      dueDate: payload.dueDate ? new Date(payload.dueDate) : undefined,
    },
  });

  await Promise.all(
    payload.ids.map((opportunityId) =>
      writeAuditLog({
        workspaceId: workspace.id,
        userId: user.id,
        actor: user.name,
        actorType: ActorType.USER,
        actionType: "OPPORTUNITY_BULK_UPDATED",
        targetType: "Opportunity",
        targetId: opportunityId,
        summary: workspace.defaultLocale === "en-US" ? "Bulk-updated opportunities" : "批量更新了机会",
        payload,
      }),
    ),
  );

  revalidatePath("/dashboard");
  revalidatePath("/opportunities");
  revalidatePath("/search");

  return { ok: true };
}
