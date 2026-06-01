"use server";

import {
  ActionExecutionMode,
  ActionStatus,
  ActionType,
  ActorType,
  type RiskLevel,
  SourceType,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  getApprovalTasksData,
  getCompanyDetailData,
  getOpportunityCommercialDetailData,
} from "@/data/queries";
import { writeAuditLog } from "@/lib/audit";
import { getCurrentWorkspace, getCurrentWorkspaceSession } from "@/lib/auth/session";
import {
  canManageWorkspaceInternalActions,
  getWorkspaceInternalActionDeniedMessage,
} from "@/lib/auth/workspace-data-governance";
import { db } from "@/lib/db";
import { executeActionItem } from "@/lib/policies/engine";
import { jsonStringify } from "@/lib/utils";
import { buildCustomerSuccessHandoffPageModel } from "@/features/customer-success-handoff/detail-model";
import {
  buildCustomerSuccessInternalActionSpecs,
  customerSuccessInternalActionKeys,
  parseCustomerSuccessInternalActionMetadata,
  type CustomerSuccessInternalActionKey,
  type CustomerSuccessInternalActionMetadata,
} from "@/features/customer-success-handoff/internal-actions";

const internalActionSchema = z.object({
  opportunityId: z.string().min(1),
  actionKey: z.enum(customerSuccessInternalActionKeys),
});

const executeInternalActionSchema = z.object({
  opportunityId: z.string().min(1),
  actionItemId: z.string().min(1),
});

export async function approveCustomerSuccessInternalAction(
  input: z.infer<typeof internalActionSchema>,
) {
  const parsed = internalActionSchema.safeParse(input);
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";

  if (!parsed.success) {
    return { ok: false, error: english ? "Invalid internal action" : "内部动作参数无效" };
  }

  if (!canManageWorkspaceInternalActions(membership.role)) {
    return { ok: false, error: getWorkspaceInternalActionDeniedMessage(english) };
  }

  const modelContext = await loadCustomerSuccessActionContext(
    parsed.data.opportunityId,
    user.id,
    english,
  );

  if (!modelContext) {
    return {
      ok: false,
      error: english ? "Customer success handoff not found" : "客户 success 交接不存在",
    };
  }

  const spec = modelContext.specs.find((item) => item.key === parsed.data.actionKey);
  if (!spec) {
    return {
      ok: false,
      error: english ? "Unsupported internal action" : "当前不支持该内部动作",
    };
  }

  const existingAction = await findExistingInternalAction({
    workspaceId: workspace.id,
    opportunityId: parsed.data.opportunityId,
    actionKey: spec.key,
  });

  const metadata: CustomerSuccessInternalActionMetadata = {
    customerSuccessInternalActionKey: spec.key,
    customerSuccessInternalActionKind: spec.kind,
    approvedById: user.id,
    approvedByName: user.name,
    approvedAt: new Date().toISOString(),
    resultSummary: spec.resultSummary,
  };

  const approvedReason = english
    ? "Approved for internal execution from the customer success handoff."
    : "已从客户 success 交接批准内部执行。";

  const actionData = {
    workspaceId: workspace.id,
    opportunityId: parsed.data.opportunityId,
    ownerId: modelContext.detail.owner?.id ?? user.id,
    actionType: spec.actionType,
    title: spec.title,
    description: spec.description,
    aiReason: spec.summary,
    draftContent: spec.draftContent,
    metadata: jsonStringify(metadata),
    sourceType: SourceType.SYSTEM_INFERENCE,
    sourceId: `customer-success:${parsed.data.opportunityId}:${spec.key}`,
    riskLevel: toInternalActionRiskLevel(modelContext.detail.riskLevel),
    executionMode: ActionExecutionMode.REQUIRES_APPROVAL,
    requiresApproval: false,
    status: ActionStatus.APPROVED,
    executionStatus: "approved_to_execute",
    statusReason: approvedReason,
  } as const;

  const actionItem = existingAction
    ? await db.actionItem.update({
        where: { id: existingAction.id },
        data: actionData,
      })
    : await db.actionItem.create({
        data: actionData,
      });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "CUSTOMER_SUCCESS_INTERNAL_ACTION_APPROVED",
    targetType: "ActionItem",
    targetId: actionItem.id,
    relatedObjectType: "Opportunity",
    relatedObjectId: parsed.data.opportunityId,
    sourcePage: `/customer-success/${parsed.data.opportunityId}`,
    summary: english
      ? `Approved internal action: ${spec.title}`
      : `已批准内部动作：${spec.title}`,
    payload: {
      customerSuccessInternalActionKey: spec.key,
      customerSuccessInternalActionKind: spec.kind,
      internalOnly: true,
      nonCommitment: true,
    },
  });

  revalidateCustomerSuccessPaths(parsed.data.opportunityId);

  return {
    ok: true,
    actionItemId: actionItem.id,
    state: "user-approved-to-execute" as const,
  };
}

export async function executeCustomerSuccessInternalAction(
  input: z.infer<typeof executeInternalActionSchema>,
) {
  const parsed = executeInternalActionSchema.safeParse(input);
  const session = await getCurrentWorkspaceSession();
  const { user, membership, workspace } = session;
  const english = workspace.defaultLocale === "en-US";

  if (!parsed.success) {
    return { ok: false, error: english ? "Invalid execution request" : "执行请求无效" };
  }

  if (!canManageWorkspaceInternalActions(membership.role)) {
    return { ok: false, error: getWorkspaceInternalActionDeniedMessage(english) };
  }

  const actionItem = await db.actionItem.findFirst({
    where: {
      id: parsed.data.actionItemId,
      workspaceId: workspace.id,
      opportunityId: parsed.data.opportunityId,
    },
  });

  if (!actionItem) {
    return {
      ok: false,
      error: english ? "Internal action not found" : "内部动作不存在",
    };
  }

  const metadata = parseCustomerSuccessInternalActionMetadata(actionItem.metadata);
  if (
    !metadata ||
    (actionItem.actionType !== ActionType.DRAFT_INTERNAL_NOTE &&
      actionItem.actionType !== ActionType.CREATE_TASK)
  ) {
    return {
      ok: false,
      error: english ? "Unsupported internal execution target" : "当前动作不支持内部执行",
    };
  }

  if (actionItem.status === ActionStatus.EXECUTED) {
    return {
      ok: true,
      actionItemId: actionItem.id,
      state: "executed-internally" as const,
      resultSummary:
        metadata.resultSummary ??
        (english ? "Already executed internally." : "该动作已经完成内部执行。"),
    };
  }

  const executionReason = english
    ? "Executed internally by Helm AI after explicit user approval."
    : "已在显式用户批准后由 Helm AI 完成内部执行。";

  await executeActionItem(actionItem.id, {
    actorName: "Helm AI",
    actorType: ActorType.AI,
    actorUserId: user.id,
    english,
    decisionReason: executionReason,
  });

  const resultSummary =
    metadata.resultSummary ??
    (actionItem.actionType === ActionType.CREATE_TASK
      ? english
        ? "Internal reminder artifact recorded for customer success visibility."
        : "已记录内部提醒 制品，用于客户 success 可见性。"
      : english
        ? "Internal note recorded for the current customer success line."
        : "已为当前客户 success 线路记录内部备注。");

  await db.actionItem.update({
    where: { id: actionItem.id },
    data: {
      metadata: jsonStringify({
        ...metadata,
        executedByName: "Helm AI",
        executedTriggerUserId: user.id,
        executedTriggerUserName: user.name,
        executedAt: new Date().toISOString(),
        resultSummary,
      }),
    },
  });

  await writeAuditLog({
    workspaceId: workspace.id,
    userId: user.id,
    actor: user.name,
    actorType: ActorType.USER,
    actionType: "CUSTOMER_SUCCESS_INTERNAL_ACTION_EXECUTED",
    targetType: "ActionItem",
    targetId: actionItem.id,
    relatedObjectType: "Opportunity",
    relatedObjectId: parsed.data.opportunityId,
    sourcePage: `/customer-success/${parsed.data.opportunityId}`,
    summary: english
      ? `Executed internal action: ${actionItem.title}`
      : `已执行内部动作：${actionItem.title}`,
    payload: {
      customerSuccessInternalActionKey: metadata.customerSuccessInternalActionKey,
      customerSuccessInternalActionKind: metadata.customerSuccessInternalActionKind,
      internalOnly: true,
      nonCommitment: true,
      executedByName: "Helm AI",
      executedTriggerUserId: user.id,
      executedTriggerUserName: user.name,
    },
  });

  revalidateCustomerSuccessPaths(parsed.data.opportunityId);

  return {
    ok: true,
    actionItemId: actionItem.id,
    state: "executed-internally" as const,
    resultSummary,
  };
}

async function loadCustomerSuccessActionContext(
  opportunityId: string,
  currentUserId: string,
  english: boolean,
) {
  const workspace = await getCurrentWorkspace();
  const [detail, approvalTasks] = await Promise.all([
    getOpportunityCommercialDetailData(workspace.id, opportunityId),
    getApprovalTasksData(workspace.id),
  ]);

  if (!detail) return null;

  const company = detail.company
    ? await getCompanyDetailData(workspace.id, detail.company.id)
    : null;
  const reviewTasks = approvalTasks.filter(
    (task) => task.actionItem.opportunity?.id === detail.id,
  );

  const model = buildCustomerSuccessHandoffPageModel({
    detail,
    company,
    reviewTasks,
    stageLabel: detail.stage,
    currentUserId,
    english,
  });

  const specs = buildCustomerSuccessInternalActionSpecs({
    title: detail.title,
    stageKey: model.stageKey,
    authorityState: model.authorityState,
    attentionState: model.attentionState,
    sendabilityMode: model.sendabilityMode,
    fallbackMode: model.fallbackMode,
    riskLevel: detail.riskLevel,
    judgement: model.protocol.pageJudgement,
    reason: model.protocol.pageJudgementReason,
    decisionRequest: model.protocol.pageDecisionRequest[0] ?? model.protocol.pageJudgement,
    nextAction:
      model.protocol.pageNextAction[0]?.label ?? model.protocol.pageJudgementReason,
    boundarySummary:
      model.protocol.pageBoundarySummary[0] ?? model.protocol.pageJudgementReason,
    english,
  });

  return { detail, model, specs };
}

async function findExistingInternalAction({
  workspaceId,
  opportunityId,
  actionKey,
}: {
  workspaceId: string;
  opportunityId: string;
  actionKey: CustomerSuccessInternalActionKey;
}) {
  const actionItems = await db.actionItem.findMany({
    where: {
      workspaceId,
      opportunityId,
      actionType: {
        in: [ActionType.DRAFT_INTERNAL_NOTE, ActionType.CREATE_TASK],
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    actionItems.find((actionItem) => {
      const metadata = parseCustomerSuccessInternalActionMetadata(actionItem.metadata);
      return metadata?.customerSuccessInternalActionKey === actionKey;
    }) ?? null
  );
}

function revalidateCustomerSuccessPaths(opportunityId: string) {
  revalidatePath("/customer-success");
  revalidatePath(`/customer-success/${opportunityId}`);
  revalidatePath(`/success-checks/${opportunityId}`);
  revalidatePath(`/expansion-reviews/${opportunityId}`);
}

function toInternalActionRiskLevel(riskLevel: RiskLevel): RiskLevel {
  return riskLevel === "CRITICAL" ? "HIGH" : riskLevel === "HIGH" ? "MEDIUM" : "LOW";
}
