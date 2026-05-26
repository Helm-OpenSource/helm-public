import {
  createBiReportHandoffExecutionLog,
  listBiReportHandoffExecutionLogs,
} from "@/lib/bi-report-skill/handoff-execution-log";
import { db } from "@/lib/db";
import { safeParseJson } from "@/lib/utils";

type BiReportHandoffActionContext = {
  signalId: string;
  decisionId: string;
  handoffTargetType: string | null;
};

export async function writeBiReportHandoffApprovalReceipt(input: {
  workspaceId: string;
  actionItemId: string;
  approvalTaskId: string;
  actionTitle: string;
  actionMetadata: string | null;
  actionSourceId: string | null;
  authorUserId: string | null;
  decisionReason: string | null;
  editedContent?: string | null;
}) {
  const context = await resolveBiReportHandoffActionContext({
    workspaceId: input.workspaceId,
    metadata: input.actionMetadata,
    sourceId: input.actionSourceId,
  });
  if (!context) {
    return null;
  }

  const priorLogs = await listBiReportHandoffExecutionLogs({
    workspaceId: input.workspaceId,
    signalId: context.signalId,
    decisionId: context.decisionId,
    take: 20,
  });
  const existingPlanLog = priorLogs.find(
    (log) => log.stage === "plan" && log.approvalTaskId === input.approvalTaskId,
  );
  if (existingPlanLog) {
    return existingPlanLog;
  }

  return createBiReportHandoffExecutionLog({
    workspaceId: input.workspaceId,
    signalId: context.signalId,
    decisionId: context.decisionId,
    actionItemId: input.actionItemId,
    approvalTaskId: input.approvalTaskId,
    stage: "plan",
    authorUserId: input.authorUserId ?? "system",
    summary: `高风险经营承接已审批通过，等待执行：${input.actionTitle}`,
    details: {
      source: "approval_task_approved",
      decisionReason: input.decisionReason,
      handoffTargetType: context.handoffTargetType,
      editedContentApplied: Boolean(input.editedContent?.trim()),
    },
    followUpNeeded: true,
  });
}

export async function writeBiReportHandoffExecutionReceipt(input: {
  workspaceId: string;
  actionItemId: string;
  approvalTaskId: string;
  actionTitle: string;
  actionMetadata: string | null;
  actionSourceId: string | null;
  authorUserId: string | null;
  decisionReason: string | null;
  editedContent?: string | null;
}) {
  const context = await resolveBiReportHandoffActionContext({
    workspaceId: input.workspaceId,
    metadata: input.actionMetadata,
    sourceId: input.actionSourceId,
  });
  if (!context) {
    return null;
  }

  const priorLogs = await listBiReportHandoffExecutionLogs({
    workspaceId: input.workspaceId,
    signalId: context.signalId,
    decisionId: context.decisionId,
    take: 20,
  });
  const hasPlanLog = priorLogs.some((log) => log.stage === "plan");
  if (!hasPlanLog) {
    await createBiReportHandoffExecutionLog({
      workspaceId: input.workspaceId,
      signalId: context.signalId,
      decisionId: context.decisionId,
      actionItemId: input.actionItemId,
      approvalTaskId: input.approvalTaskId,
      stage: "plan",
      authorUserId: input.authorUserId ?? "system",
      summary: `高风险经营承接已进入执行闭环：${input.actionTitle}`,
      details: {
        source: "approval_task_execution_backfill",
        decisionReason: input.decisionReason,
        handoffTargetType: context.handoffTargetType,
      },
      followUpNeeded: true,
    });
  }

  const existingResultLog = priorLogs.find(
    (log) => log.stage === "result" && log.approvalTaskId === input.approvalTaskId,
  );
  if (existingResultLog) {
    return existingResultLog;
  }

  return createBiReportHandoffExecutionLog({
    workspaceId: input.workspaceId,
    signalId: context.signalId,
    decisionId: context.decisionId,
    actionItemId: input.actionItemId,
    approvalTaskId: input.approvalTaskId,
    stage: "result",
    authorUserId: input.authorUserId ?? "system",
    summary: `高风险经营承接已执行：${input.actionTitle}`,
    details: {
      source: "approval_task_executed",
      decisionReason: input.decisionReason,
      handoffTargetType: context.handoffTargetType,
      editedContentApplied: Boolean(input.editedContent?.trim()),
      outcome: "approved_action_executed",
    },
    isEffective: null,
    followUpNeeded: true,
  });
}

export async function writeBiReportHandoffRejectionReceipt(input: {
  workspaceId: string;
  actionItemId: string;
  approvalTaskId: string;
  actionTitle: string;
  actionMetadata: string | null;
  actionSourceId: string | null;
  authorUserId: string | null;
  decisionReason: string | null;
}) {
  if (!input.authorUserId) {
    return null;
  }

  const context = await resolveBiReportHandoffActionContext({
    workspaceId: input.workspaceId,
    metadata: input.actionMetadata,
    sourceId: input.actionSourceId,
  });
  if (!context) {
    return null;
  }

  const priorLogs = await listBiReportHandoffExecutionLogs({
    workspaceId: input.workspaceId,
    signalId: context.signalId,
    decisionId: context.decisionId,
    take: 20,
  });
  const existingResultLog = priorLogs.find(
    (log) =>
      log.stage === "result" &&
      log.approvalTaskId === input.approvalTaskId &&
      log.details?.source === "approval_task_rejected",
  );
  if (existingResultLog) {
    return existingResultLog;
  }

  const hasPlanLog = priorLogs.some((log) => log.stage === "plan");
  if (!hasPlanLog) {
    await createBiReportHandoffExecutionLog({
      workspaceId: input.workspaceId,
      signalId: context.signalId,
      decisionId: context.decisionId,
      actionItemId: input.actionItemId,
      approvalTaskId: input.approvalTaskId,
      stage: "plan",
      authorUserId: input.authorUserId,
      summary: `高风险经营承接已进入拒绝复核，等待重写或重新分派：${input.actionTitle}`,
      details: {
        source: "approval_task_rejection_backfill",
        decisionReason: input.decisionReason,
        handoffTargetType: context.handoffTargetType,
      },
      followUpNeeded: true,
    });
  }

  return createBiReportHandoffExecutionLog({
    workspaceId: input.workspaceId,
    signalId: context.signalId,
    decisionId: context.decisionId,
    actionItemId: input.actionItemId,
    approvalTaskId: input.approvalTaskId,
    stage: "result",
    authorUserId: input.authorUserId,
    summary: `高风险经营承接已被拒绝，等待重写或重新分派：${input.actionTitle}`,
    details: {
      source: "approval_task_rejected",
      decisionReason: input.decisionReason,
      handoffTargetType: context.handoffTargetType,
      outcome: "rejected_action_not_executed",
    },
    isEffective: false,
    followUpNeeded: true,
  });
}

async function resolveBiReportHandoffActionContext(input: {
  workspaceId: string;
  metadata: string | null;
  sourceId: string | null;
}): Promise<BiReportHandoffActionContext | null> {
  if (!input.sourceId?.startsWith("bi-report-handoff:")) {
    return null;
  }

  const metadata = safeParseJson<Record<string, unknown> | null>(input.metadata, null);
  const sourceDecisionId = input.sourceId.slice("bi-report-handoff:".length) || null;
  const signalId = typeof metadata?.biReportSignalId === "string" ? metadata.biReportSignalId : null;
  const decisionId =
    typeof metadata?.handoffDecisionId === "string"
      ? metadata.handoffDecisionId
      : sourceDecisionId;
  const handoffTargetType =
    typeof metadata?.handoffTargetType === "string" ? metadata.handoffTargetType : null;

  if (signalId && decisionId) {
    return {
      signalId,
      decisionId,
      handoffTargetType,
    };
  }

  if (!decisionId) {
    return null;
  }

  try {
    const decision = await db.biReportBusinessHandoffDecision.findFirst({
      where: {
        id: decisionId,
        workspaceId: input.workspaceId,
      },
      select: {
        id: true,
        signalId: true,
        targetType: true,
      },
    });

    if (!decision) {
      return null;
    }

    return {
      signalId: decision.signalId,
      decisionId: decision.id,
      handoffTargetType: handoffTargetType ?? decision.targetType,
    };
  } catch {
    return null;
  }
}
