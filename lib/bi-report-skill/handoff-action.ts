import { ActionType, ActorType, RiskLevel, SourceType } from "@prisma/client";
import { buildBiReportBusinessHandoffDrafts } from "@/lib/bi-report-skill/business-handoff";
import { db } from "@/lib/db";
import type {
  BiReportBusinessHandoffMaterializationRecord,
  BiReportBusinessHandoffDecisionRecord,
  BiReportBusinessHandoffDraft,
  BiReportBusinessSignalRecord,
} from "@/lib/bi-report-skill/types";
import { createGovernedAction } from "@/lib/policies/engine";

export type BiReportHandoffActionResult = {
  actionItemId: string;
  approvalTaskId?: string;
  created: boolean;
  href: string;
};

export async function listBiReportHandoffMaterializations(input: {
  workspaceId: string;
  decisions: BiReportBusinessHandoffDecisionRecord[];
}): Promise<BiReportBusinessHandoffMaterializationRecord[]> {
  const acceptedDecisions = input.decisions.filter((decision) => decision.status === "accepted");
  if (acceptedDecisions.length === 0) {
    return [];
  }

  const sourceIdByDecisionId = new Map(
    acceptedDecisions.map((decision) => [decision.id, `bi-report-handoff:${decision.id}`]),
  );

  const rows = await db.actionItem.findMany({
    where: {
      workspaceId: input.workspaceId,
      sourceId: {
        in: Array.from(sourceIdByDecisionId.values()),
      },
    },
    include: {
      approvalTask: true,
      owner: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const materializations: BiReportBusinessHandoffMaterializationRecord[] = [];

  for (const row of rows) {
    const matchedDecision = acceptedDecisions.find(
      (decision) => sourceIdByDecisionId.get(decision.id) === row.sourceId,
    );
    if (!matchedDecision) {
      continue;
    }

    materializations.push({
      decisionId: matchedDecision.id,
      signalId: matchedDecision.signalId,
      actionItemId: row.id,
      actionItemTitle: row.title,
      actionStatus: row.status,
      approvalTaskId: row.approvalTask?.id ?? null,
      approvalStatus: row.approvalTask?.status ?? null,
      href: row.approvalTask ? `/approvals?approvalId=${row.approvalTask.id}` : "/dashboard",
      createdAt: row.createdAt.toISOString(),
      ownerUserName: row.owner?.name ?? null,
    });
  }

  return materializations;
}

export function resolveBiReportHandoffDraft(input: {
  signal: BiReportBusinessSignalRecord;
  targetType: string;
}): BiReportBusinessHandoffDraft | null {
  return (
    buildBiReportBusinessHandoffDrafts(input.signal).find(
      (draft) => draft.targetType === input.targetType,
    ) ?? null
  );
}

export async function materializeAcceptedBiReportHandoff(input: {
  workspaceId: string;
  actorUserId?: string | null;
  actorType?: ActorType;
  actorName: string;
  signal: BiReportBusinessSignalRecord;
  decision: BiReportBusinessHandoffDecisionRecord;
}): Promise<BiReportHandoffActionResult | null> {
  if (input.decision.status !== "accepted") {
    return null;
  }

  const draft = resolveBiReportHandoffDraft({
    signal: input.signal,
    targetType: input.decision.targetType,
  });
  if (!draft) {
    return null;
  }

  if (draft.targetType === "recommendation") {
    return null;
  }

  const sourceId = `bi-report-handoff:${input.decision.id}`;
  const existing = await db.actionItem.findFirst({
    where: {
      workspaceId: input.workspaceId,
      sourceId,
    },
    include: {
      approvalTask: true,
    },
  });

  if (existing) {
    return {
      actionItemId: existing.id,
      approvalTaskId: existing.approvalTask?.id ?? undefined,
      created: false,
      href: existing.approvalTask
        ? `/approvals?approvalId=${existing.approvalTask.id}`
        : `/dashboard`,
    };
  }

  const result = await createGovernedAction({
    workspaceId: input.workspaceId,
    actorUserId: input.actorUserId,
    actorType: input.actorType,
    actorName: input.actorName,
    actionType: ActionType.CREATE_TASK,
    title: draft.title,
    description: draft.summary,
    aiReason: `由 BI 经营信号 "${input.signal.title}" 经人工确认后生成。`,
    draftContent: draft.summary,
    riskLevel: mapDraftRiskLevel(draft),
    ownerId: input.signal.ownerUserId ?? undefined,
    approverId: draft.targetType === "approval" ? (input.signal.ownerUserId ?? undefined) : undefined,
    sourceType: SourceType.SYSTEM_INFERENCE,
    sourceId,
    metadata: {
      biReportSignalId: input.signal.id,
      biReportSignalKey: input.signal.signalKey,
      biReportSkillKey: input.signal.skillKey,
      handoffDecisionId: input.decision.id,
      handoffTargetType: draft.targetType,
    },
    resultPreview:
      draft.targetType === "approval"
        ? "审批通过后将进入经营动作执行。"
        : "已生成经营动作，等待负责人跟进。",
  });

  return {
    actionItemId: result.actionItemId,
    approvalTaskId: result.approvalTaskId,
    created: true,
    href: result.approvalTaskId ? `/approvals?approvalId=${result.approvalTaskId}` : `/dashboard`,
  };
}

function mapDraftRiskLevel(draft: BiReportBusinessHandoffDraft): RiskLevel {
  if (draft.targetType === "approval") return RiskLevel.CRITICAL;
  if (draft.priority === "high") return RiskLevel.HIGH;
  if (draft.priority === "medium") return RiskLevel.MEDIUM;
  return RiskLevel.LOW;
}
