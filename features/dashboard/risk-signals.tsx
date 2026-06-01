import { Badge } from "@/components/ui/badge";
import type { DashboardPageData } from "@/features/dashboard/page-loader";
import { formatDateLabel, formatRelative, trimText } from "@/lib/utils";

export type DashboardRiskSignal = {
  id: string;
  href: string;
  title: string;
  body: string;
  meta: string;
  tone: "danger" | "warning";
  badge: React.ReactElement;
};

export function buildRiskSignals(
  todayFocus: DashboardPageData["todayFocus"],
  data: DashboardPageData["data"],
  english: boolean,
): DashboardRiskSignal[] {
  const commitmentSignals = todayFocus.overdueCommitments
    .slice(0, 2)
    .map<DashboardRiskSignal>((item) => ({
      id: `commitment-${item.id}`,
      href: item.relatedOpportunityId
        ? `/opportunities?opportunityId=${item.relatedOpportunityId}`
        : item.relatedContactId
          ? `/contacts/${item.relatedContactId}`
          : item.relatedMeetingId
            ? `/meetings/${item.relatedMeetingId}`
            : "/memory",
      title: english
        ? `Overdue commitment: ${item.title}`
        : `逾期承诺：${item.title}`,
      body: trimText(item.commitmentText, 92),
      meta: english
        ? `Due ${formatDateLabel(item.dueDate)}`
        : `截止 ${formatDateLabel(item.dueDate)}`,
      tone: "danger",
      badge: (
        <Badge variant="danger">
          {english ? "Overdue commitment" : "逾期承诺"}
        </Badge>
      ),
    }));

  const stalledSignals = todayFocus.stalledOpportunities
    .slice(0, 2)
    .map<DashboardRiskSignal>((item) => ({
      id: `stalled-${item.id}`,
      href: `/opportunities?opportunityId=${item.id}`,
      title: english
        ? `Stalled too long: ${item.title}`
        : `长时间未推进：${item.title}`,
      body: trimText(item.nextAction),
      meta: english
        ? `Last moved ${formatRelative(item.lastProgressAt ?? item.updatedAt)}`
        : `最近推进 ${formatRelative(item.lastProgressAt ?? item.updatedAt)}`,
      tone: "warning",
      badge: (
        <Badge variant="warning">
          {english ? "Slipping opportunity" : "掉速机会"}
        </Badge>
      ),
    }));

  const relationshipSignals = data.followUpContacts
    .slice(0, 1)
    .map<DashboardRiskSignal>((item) => ({
      id: `contact-${item.id}`,
      href: `/contacts/${item.id}`,
      title: english
        ? `Cooling relationship: ${item.name}`
        : `快掉温关系：${item.name}`,
      body: english
        ? `${item.company?.name ?? "Independent contact"} has lacked a substantive push recently, so the system recommends restoring our side of the pace first.`
        : `${item.company?.name ?? "独立联系人"} 近期缺少实质推进，系统建议优先恢复我方节奏。`,
      meta: english
        ? `Last interaction ${formatRelative(item.lastInteractionAt)}`
        : `最近互动 ${formatRelative(item.lastInteractionAt)}`,
      tone: "warning",
      badge: (
        <Badge variant="warning">
          {english ? "Cooling relationship" : "关系降温"}
        </Badge>
      ),
    }));

  const blockerSignals = data.highRiskOpportunities
    .filter((item) => item.blockers[0]?.severity >= 75)
    .slice(0, 1)
    .map<DashboardRiskSignal>((item) => ({
      id: `blocker-${item.id}`,
      href: `/opportunities?opportunityId=${item.id}`,
      title: english
        ? `High-severity blocker: ${item.blockers[0]!.title}`
        : `高严重度阻塞：${item.blockers[0]!.title}`,
      body: trimText(item.blockers[0]!.blockerText, 92),
      meta: english
        ? `${item.title} · Active for ${formatRelative(item.blockers[0]!.updatedAt)}`
        : `${item.title} · 已持续 ${formatRelative(item.blockers[0]!.updatedAt)}`,
      tone: "danger",
      badge: (
        <Badge variant="danger">
          {english ? "Severe blocker" : "严重阻塞"}
        </Badge>
      ),
    }));

  return [
    ...commitmentSignals,
    ...blockerSignals,
    ...stalledSignals,
    ...relationshipSignals,
  ].slice(0, 4);
}
