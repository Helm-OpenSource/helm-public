import type { DashboardPageData } from "@/features/dashboard/page-loader";
import { formatDashboardEvidenceDateLabel } from "@/features/dashboard/evidence-date-labels";
import {
  buildDashboardMemoryHref,
  buildDashboardObjectHref,
  hasEvidenceTarget,
} from "@/features/dashboard/href-helpers";
import {
  APPROVAL_PAGE_ANCHORS,
  OPPORTUNITY_PAGE_ANCHORS,
  buildMemoryItemAnchor,
  buildSectionHref,
} from "@/lib/presentation/page-section-anchors";
import { createEvidencePayloadGroups } from "@/lib/worker-skill-resource/presentation";
import { formatDateLabel, trimText } from "@/lib/utils";

function formatDashboardEvidenceDate(value: Date | string | null | undefined, english: boolean) {
  return formatDashboardEvidenceDateLabel(value, english, formatDateLabel);
}

export function buildDashboardPayloadEvidenceGroups({
  data,
  english,
}: {
  data: DashboardPageData["data"];
  english: boolean;
}) {
  return createEvidencePayloadGroups({
    english,
    replayItems: [
      ...data.meetingSurfaceItems.slice(0, 2).map((meeting) => ({
        itemId: `meeting-replay-${meeting.id}`,
        label: english
          ? `Open replay: ${meeting.title}`
          : `查看回放：${meeting.title}`,
        href: `/meetings/${meeting.id}`,
        summary: english
          ? `Scheduled for ${formatDashboardEvidenceDate(meeting.startsAt, english)} and already connected to ${meeting.opportunity?.title ?? meeting.company?.name ?? "the current object"}.`
          : `已排在 ${formatDashboardEvidenceDate(meeting.startsAt, english)}，并且已经连到${meeting.opportunity?.title ?? meeting.company?.name ?? "当前对象"}。`,
      })),
      ...data.recentExecutedActions.slice(0, 2).map((action) => ({
        itemId: `action-replay-${action.id}`,
        label: english
          ? `Open execution replay: ${action.title}`
          : `查看执行回放：${action.title}`,
        href: buildDashboardObjectHref({
          opportunity: action.opportunity,
          contact: action.contact,
          meeting: action.meeting,
          opportunityAnchor: OPPORTUNITY_PAGE_ANCHORS.actionWorkspace,
        }),
        summary: english
          ? `Already ran and wrote back into ${action.opportunity?.title ?? action.contact?.name ?? action.meeting?.title ?? "the workspace timeline"}.`
          : `已经回写到${action.opportunity?.title ?? action.contact?.name ?? action.meeting?.title ?? "工作台时间线"}。`,
      })),
    ],
    auditItems: data.recentAuditLogs.map((event) => ({
      itemId: `audit-${event.id}`,
      label: english ? "Open audit detail" : "查看审计详情",
      href:
        event.sourcePage ??
        buildDashboardMemoryHref(
          event.relatedObjectType ?? event.targetType,
          event.relatedObjectId ?? event.targetId,
          buildMemoryItemAnchor("audit", event.id),
        ),
      summary: english
        ? `Audit event: ${trimText(event.summary, 96)}`
        : `Audit 事件：${trimText(event.summary, 96)}`,
    })),
    memoryItems: data.recentMemoryFacts.map((fact) => ({
      itemId: `memory-fact-${fact.id}`,
      label: english
        ? `Open memory fact: ${fact.title}`
        : `查看记忆事实：${fact.title}`,
      href: buildDashboardMemoryHref(
        fact.objectType,
        fact.objectId,
        buildMemoryItemAnchor("fact", fact.id),
      ),
      summary: english
        ? trimText(fact.content, 88)
        : trimText(fact.content, 88),
    })),
    handoffItems: [
      ...data.pendingApprovals
        .slice(0, 2)
        .flatMap((task) => [
          task.contextSnapshot
            ? {
                itemId: `approval-handoff-context-${task.id}`,
                label: english
                  ? `Open approval handoff: ${task.actionItem.title}`
                  : `查看审批交接：${task.actionItem.title}`,
                href: buildSectionHref(
                  `/approvals?approvalId=${task.id}`,
                  APPROVAL_PAGE_ANCHORS.sourceContext,
                ),
                summary: english
                  ? `Approval handoff context: ${trimText(task.contextSnapshot, 92)}`
                  : `审批交接上下文：${trimText(task.contextSnapshot, 92)}`,
              }
            : undefined,
          task.resultPreview
            ? {
                itemId: `approval-handoff-preview-${task.id}`,
                label: english
                  ? `Open approval result handoff`
                  : "查看审批结果交接",
                href: buildSectionHref(
                  `/approvals?approvalId=${task.id}`,
                  APPROVAL_PAGE_ANCHORS.resultPreview,
                ),
                summary: english
                  ? `Approval handoff preview: ${trimText(task.resultPreview, 92)}`
                  : `审批交接结果预览：${trimText(task.resultPreview, 92)}`,
              }
            : undefined,
        ])
        .filter(hasEvidenceTarget),
      ...data.postMeetingItems.slice(0, 2).map((item) => ({
        itemId: `post-meeting-handoff-${item.id}`,
        label: english
          ? `Open post-meeting handoff: ${item.title}`
          : `查看会后交接：${item.title}`,
        href: buildDashboardObjectHref({
          opportunity: item.opportunity,
          contact: item.contact,
          meeting: item.meeting,
          opportunityAnchor: OPPORTUNITY_PAGE_ANCHORS.actionWorkspace,
        }),
        summary: english
          ? "Waiting to leave the meeting layer and become a concrete next move."
          : "正在等待离开会议层，进入具体下一步。",
      })),
    ],
  });
}
