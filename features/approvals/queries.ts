import { db } from "@/lib/db";
import { safeParseJson } from "@/lib/utils";
import { buildBiReportSourceDetailHref } from "@/features/approvals/approval-object-detail-link";
import { buildInboxThreadWhere } from "@/features/inbox/queries";

/**
 * The email thread an action was created from, when the action records one:
 * `metadata.threadId` (written by the inbox reply-draft flow) or an
 * `EMAIL_THREAD` source. Returns null when the action names no thread.
 */
export function resolveApprovalOriginThreadId(actionItem: {
  metadata: string | null;
  sourceType: string | null;
  sourceId: string | null;
}) {
  const metadata = normalizeActionItemMetadata(actionItem.metadata);
  const metadataThreadId =
    typeof metadata?.threadId === "string" ? metadata.threadId.trim() : "";
  if (metadataThreadId) {
    return metadataThreadId;
  }
  if (actionItem.sourceType === "EMAIL_THREAD" && actionItem.sourceId?.trim()) {
    return actionItem.sourceId.trim();
  }
  return null;
}

export async function getApprovalTasksData(
  workspaceId: string,
  english = false,
  options?: {
    /**
     * The viewer's connected mailbox address. Origin-thread links follow the
     * inbox visibility rule, so without it only non-mailbox threads resolve.
     */
    viewerEmail?: string | null;
  },
) {
  const tasks = await db.approvalTask.findMany({
    where: { workspaceId },
    include: {
      approver: true,
      reviewedBy: true,
      actionItem: {
        include: {
          opportunity: {
            include: { company: true },
          },
          contact: true,
          meeting: true,
          owner: true,
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          recommendationLog: true,
          decisionWorkPacketClaim: {
            select: { decisionRecordId: true },
          },
          executionReceipt: {
            select: { outcome: true },
          },
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  const supportingFactIds = tasks.flatMap((task) =>
    safeParseJson<string[]>(task.actionItem.recommendationLog?.supportingFactIds, []),
  );
  const blockerIds = tasks.flatMap((task) =>
    safeParseJson<string[]>(task.actionItem.recommendationLog?.blockerIds, []),
  );
  const commitmentIds = tasks.flatMap((task) =>
    safeParseJson<string[]>(task.actionItem.recommendationLog?.commitmentIds, []),
  );

  const originThreadIds = Array.from(
    new Set(
      tasks
        .map((task) => resolveApprovalOriginThreadId(task.actionItem))
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const [facts, blockers, commitments, originThreads] = await Promise.all([
    supportingFactIds.length
      ? db.memoryFact.findMany({
          where: {
            workspaceId,
            id: { in: Array.from(new Set(supportingFactIds)) },
          },
          orderBy: [{ importance: "desc" }, { updatedAt: "desc" }],
        })
      : Promise.resolve([]),
    blockerIds.length
      ? db.blocker.findMany({
          where: {
            workspaceId,
            id: { in: Array.from(new Set(blockerIds)) },
          },
          include: {
            relatedContact: true,
            relatedCompany: true,
            relatedOpportunity: true,
            relatedMeeting: true,
          },
        })
      : Promise.resolve([]),
    commitmentIds.length
      ? db.commitment.findMany({
          where: {
            workspaceId,
            id: { in: Array.from(new Set(commitmentIds)) },
          },
          include: {
            relatedContact: true,
            relatedCompany: true,
            relatedOpportunity: true,
            relatedMeeting: true,
            ownerUser: true,
          },
        })
      : Promise.resolve([]),
    // One batched read: only threads that exist in this workspace and that
    // the viewer may open under the inbox rule become links.
    originThreadIds.length
      ? db.emailThread.findMany({
          where: {
            AND: [
              buildInboxThreadWhere(workspaceId, options?.viewerEmail),
              { id: { in: originThreadIds } },
            ],
          },
          select: { id: true, subject: true },
        })
      : Promise.resolve([] as Array<{ id: string; subject: string }>),
  ]);
  const originThreadById = new Map(
    originThreads.map((thread) => [thread.id, thread]),
  );

  return tasks.map((task) => ({
    ...task,
    originThread: (() => {
      const threadId = resolveApprovalOriginThreadId(task.actionItem);
      return threadId ? (originThreadById.get(threadId) ?? null) : null;
    })(),
    biSource: (() => {
      const metadata = normalizeActionItemMetadata(task.actionItem.metadata);
      const sourceId = task.actionItem.sourceId;
      const isBiHandoff =
        typeof sourceId === "string" && sourceId.startsWith("bi-report-handoff:");
      if (!isBiHandoff) {
        return null;
      }
      const skillKey =
        typeof metadata?.biReportSkillKey === "string"
          ? metadata.biReportSkillKey
          : null;
      const signalId =
        typeof metadata?.biReportSignalId === "string"
          ? metadata.biReportSignalId
          : null;
      const signalKey =
        typeof metadata?.biReportSignalKey === "string"
          ? metadata.biReportSignalKey
          : null;
      const handoffTargetType =
        typeof metadata?.handoffTargetType === "string"
          ? metadata.handoffTargetType
          : null;
      const decisionId =
        typeof sourceId === "string" && sourceId.startsWith("bi-report-handoff:")
          ? sourceId.slice("bi-report-handoff:".length) || null
          : null;

      return {
        decisionId,
        signalId,
        signalKey,
        skillKey,
        skillLabel: getBiSkillLabel(skillKey, english),
        handoffTargetType,
        detailHref: buildBiReportSourceDetailHref({ skillKey, signalId }),
      };
    })(),
    dingtalkSource: (() => {
      const metadata = safeParseJson<Record<string, unknown> | null>(
        task.actionItem.metadata,
        null,
      );
      if (!metadata || metadata.sourceProvider !== "DINGTALK_MCP") {
        return null;
      }
      return {
        scope:
          typeof metadata.sourceScope === "string"
            ? metadata.sourceScope
            : null,
        sourceId:
          typeof metadata.sourceId === "string"
            ? metadata.sourceId
            : null,
        sourceType:
          typeof metadata.sourceType === "string"
            ? metadata.sourceType
            : null,
      };
    })(),
    recommendationFacts: facts.filter((fact) =>
      safeParseJson<string[]>(task.actionItem.recommendationLog?.supportingFactIds, []).includes(fact.id),
    ),
    recommendationBlockers: blockers.filter((blocker) =>
      safeParseJson<string[]>(task.actionItem.recommendationLog?.blockerIds, []).includes(blocker.id),
    ),
    recommendationCommitments: commitments.filter((commitment) =>
      safeParseJson<string[]>(task.actionItem.recommendationLog?.commitmentIds, []).includes(commitment.id),
    ),
  }));
}

export function normalizeActionItemMetadata(
  metadataInput: string | Record<string, unknown> | null | undefined,
) {
  if (metadataInput == null) {
    return null;
  }

  if (typeof metadataInput === "string") {
    return safeParseJson<Record<string, unknown> | null>(metadataInput, null);
  }

  if (typeof metadataInput === "object") {
    return metadataInput as Record<string, unknown>;
  }

  return null;
}

export function getBiSkillLabel(skillKey: string | null, english = false): string {
  switch (skillKey) {
    case "bi_business_income_expense_monthly":
      return english ? "Business income and expense monthly report" : "业务收支月报";
    case "bi_repay_daily":
      return english ? "Repayment daily report" : "回款日报";
    case "bi_mtype_repay_monthly":
      return english ? "Aging repayment monthly report" : "账龄回款月报";
    case "bi_revenue_daily":
      return english ? "Revenue daily report (compatibility)" : "营收日报（兼容）";
    default:
      return english ? "BI operating signal" : "BI经营信号";
  }
}
