import Link from "next/link";
import { CalendarDays, Clock3, FileText } from "lucide-react";
import { formatMeetingPageDateLabel } from "@/features/meetings/meeting-page-date-labels";
import { formatMeetingDisplayText } from "@/features/meetings/display-copy";
import { loadMeetingsPageData } from "@/features/meetings/page-loader";
import { formatDateLabel, trimText } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

function formatMeetingPageDate(value: Date | string | null | undefined, english: boolean) {
  return formatMeetingPageDateLabel(value, english, formatDateLabel);
}

export default async function MeetingsPage() {
  const meetingsRouteIdentity = { sourcePage: "/meetings" as const };
  const { english, meetings, pageStory } = await loadMeetingsPageData();
  const orderedMeetings = [
    ...meetings.todayMeetings,
    ...meetings.upcomingMeetings,
    ...meetings.pastMeetings,
  ];
  const primaryMeeting =
    meetings.todayMeetings[0] ??
    meetings.upcomingMeetings[0] ??
    meetings.pastMeetings[0] ??
    null;
  const primaryFollowThroughMeeting =
    orderedMeetings.find((meeting) => hasMeetingFollowThrough(meeting)) ??
    primaryMeeting;
  const dingtalkReporterCount = new Set(
    (meetings.workspaceDingTalkWorkProgress ?? [])
      .map((item) => item.reporterId ?? item.reporterName ?? null)
      .filter((item): item is string => Boolean(item)),
  ).size;

  return (
    <div
      className="space-y-6"
      data-source-page={meetingsRouteIdentity.sourcePage}
    >
      <PageHeader
        eyebrow={pageStory.eyebrow}
        title={english ? "Meeting list" : "会议清单"}
        actions={
          <>
            {primaryMeeting ? (
              <Button asChild size="sm">
                <Link href={`/meetings/${primaryMeeting.id}`}>
                  {english ? "Open first meeting" : "打开首场会议"}
                </Link>
              </Button>
            ) : null}
            <Button asChild size="sm" variant="secondary">
              <Link
                href={
                  primaryFollowThroughMeeting
                    ? `/memory?objectType=MEETING&objectId=${primaryFollowThroughMeeting.id}`
                    : "/memory?dimension=MEETING"
                }
              >
                {english ? "See meeting memory" : "查看会议记忆"}
              </Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href="/approvals">
                {english ? "Open pending checks" : "查看待确认动作"}
              </Link>
            </Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label={english ? "All meetings" : "全部会议"}
          value={meetings.summary.total}
        />
        <StatCard
          label={english ? "Today" : "今日会议"}
          value={meetings.summary.today}
        />
        <StatCard
          label={english ? "Upcoming" : "待开会议"}
          value={meetings.summary.upcoming}
        />
        <StatCard
          label={english ? "With notes" : "已有纪要"}
          value={meetings.summary.withNote}
        />
        <StatCard
          label={english ? "With open follow-ups" : "有未完成事项"}
          value={meetings.summary.withOpenFollowUp}
        />
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{english ? "Today's meetings" : "今日会议"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {meetings.todayMeetings.length ? (
              meetings.todayMeetings.map((meeting) => (
                <MeetingOverviewCard
                  key={meeting.id}
                  meeting={meeting}
                  english={english}
                  highlightToday
                />
              ))
            ) : (
              <EmptyState
                icon={CalendarDays}
                title={english ? "No meetings today" : "今天还没有会议"}
                description={
                  english
                    ? "Once meetings are imported or captured, they will show up here with preparation and follow-up context."
                    : "导入会议或开始记录后，这里会出现会议本身、会前准备和会后推进。"
                }
              />
            )}
          </CardContent>
        </Card>

      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              {english ? "Upcoming and waiting" : "近期待开会议"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {meetings.upcomingMeetings.length ? (
              meetings.upcomingMeetings.map((meeting) => (
                <MeetingOverviewCard
                  key={meeting.id}
                  meeting={meeting}
                  english={english}
                />
              ))
            ) : (
              <EmptyState
                icon={Clock3}
                title={english ? "No upcoming meetings" : "近期没有待开会议"}
                description={
                  english
                    ? "New meetings from CRM, imports or capture will appear here."
                    : "新的客户关系系统、导入或记录会议会出现在这里。"
                }
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              {english ? "Recent meeting replay" : "最近会议回放"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {meetings.pastMeetings.length ? (
              meetings.pastMeetings.map((meeting) => (
                <MeetingOverviewCard
                  key={meeting.id}
                  meeting={meeting}
                  english={english}
                  compact
                />
              ))
            ) : (
              <EmptyState
                icon={FileText}
                title={
                  english ? "No past meetings yet" : "还没有可回放的历史会议"
                }
                description={
                  english
                    ? "Completed meetings with notes and follow-up will gather here."
                    : "完成后的会议及其纪要、后续动作会沉淀在这里。"
                }
              />
            )}
          </CardContent>
        </Card>
      </div>

      {meetings.workspaceDingTalkWorkProgress?.length ? (
        <Card className="workspace-panel-muted">
          <CardHeader>
            <CardTitle>
              {english
                ? "Work Progress (DingTalk getReportList)"
                : "工作进度（钉钉只读汇报）"}
            </CardTitle>
            <p className="text-xs text-[color:var(--muted-foreground)]">
              {english
                ? `${dingtalkReporterCount} reporters · ${meetings.workspaceDingTalkWorkProgress.length} reports shown`
                : `当前展示 ${dingtalkReporterCount} 位汇报人 · ${meetings.workspaceDingTalkWorkProgress.length} 条汇报`}
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-[minmax(0,220px)_minmax(0,180px)_minmax(0,1fr)] gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2 text-xs font-medium text-[color:var(--muted)]">
              <p>{english ? "Reporter / Dept" : "汇报人 / 部门"}</p>
              <p>{english ? "Reported At" : "汇报时间"}</p>
              <p>{english ? "Summary" : "摘要"}</p>
            </div>
            {meetings.workspaceDingTalkWorkProgress.slice(0, 8).map((item) => (
              <div
                key={item.reportId}
                className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-3"
              >
                <div className="grid grid-cols-[minmax(0,220px)_minmax(0,180px)_minmax(0,1fr)] gap-3">
                  <p className="text-sm font-medium text-[color:var(--foreground)]">
                    {(item.reporterName ??
                      (english ? "Unknown reporter" : "未知汇报人")) +
                      " · " +
                      (item.departmentName ??
                        (english ? "Unknown dept" : "未知部门"))}
                  </p>
                  <p className="text-xs text-[color:var(--muted-foreground)]">
                    {(english ? "Reported at " : "汇报于 ") +
                      formatMeetingPageDate(item.createdAt, english)}
                  </p>
                  <p className="text-sm leading-6 text-[color:var(--muted)]">
                    {trimText(item.previewText, 140)}
                  </p>
                </div>
                {item.sections.length ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-[color:var(--muted-foreground)]">
                      {english ? "View details" : "查看详情"}
                    </summary>
                    <div className="mt-2 space-y-2">
                      {item.sections.map((section, index) => (
                        <div
                          key={`${item.reportId}-meeting-overview-section-${index}`}
                          className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-2 py-2"
                        >
                          <p className="text-xs font-medium text-[color:var(--foreground)]">
                            {section.key ?? (english ? "Section" : "分段")}
                          </p>
                          <pre className="mt-1 whitespace-pre-wrap text-xs leading-6 text-[color:var(--muted)]">
                            {section.value}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function MeetingOverviewCard({
  meeting,
  english,
  highlightToday = false,
  compact = false,
}: {
  meeting: MeetingOverviewItem;
  english: boolean;
  highlightToday?: boolean;
  compact?: boolean;
}) {
  const hasOpenFollowUp = hasMeetingFollowThrough(meeting);
  const severeBlocker = meeting.blockers.some((item) => item.severity >= 75);
  const nextDueItem = findNextDueItem(meeting);
  const hiddenContactCount = Math.max(
    meeting._count.contacts - meeting.contacts.length,
    0,
  );

  return (
    <Link
      href={`/meetings/${meeting.id}`}
      aria-label={
        english
          ? `Open meeting: ${meeting.title}`
          : `打开会议：${meeting.title}`
      }
      className="block rounded-[24px] border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_92%,white_8%)] px-5 py-5 transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-[color:var(--foreground)]">{meeting.title}</p>
            {highlightToday ? (
              <Badge variant="info">{english ? "Today" : "今天"}</Badge>
            ) : null}
            {meeting.note ? (
              <Badge variant="success">
                {english ? "Has note" : "已有纪要"}
              </Badge>
            ) : null}
            {meeting.dingtalkSignalCount > 0 ? (
              <Badge variant="info">
                {english
                  ? `DingTalk signals ${meeting.dingtalkSignalCount}`
                  : `钉钉信号 ${meeting.dingtalkSignalCount}`}
              </Badge>
            ) : null}
            {severeBlocker ? (
              <Badge variant="danger">
                {english ? "High blocker" : "高风险阻塞"}
              </Badge>
            ) : null}
            {hasOpenFollowUp ? (
              <Badge variant="warning">
                {english ? "Needs follow-up" : "待会后推进"}
              </Badge>
            ) : null}
          </div>
          <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
            {meeting.company?.name ??
              (english ? "No company linked" : "未关联公司")}
            {meeting.opportunity ? ` · ${meeting.opportunity.title}` : ""}
          </p>
          {meeting.contacts.length ? (
            <p className="text-sm leading-6 text-[color:var(--muted-foreground)]">
              {meeting.contacts.map((contact) => contact.name).join(english ? ", " : "、")}
              {hiddenContactCount > 0
                ? english
                  ? ` +${hiddenContactCount} more`
                  : ` 等另外 ${hiddenContactCount} 位`
                : ""}
            </p>
          ) : null}
          {!compact && meeting.agenda ? (
            <p className="text-sm leading-6 text-[color:var(--muted)]">
              {formatMeetingDisplayText(meeting.agenda, english)}
            </p>
          ) : null}
          {!compact && meeting.note?.summary ? (
            <p className="line-clamp-3 whitespace-pre-line text-sm leading-6 text-[color:var(--foreground)]">
              {meeting.note.summary}
            </p>
          ) : null}
        </div>
        <div className="text-right text-xs text-[color:var(--muted-foreground)]">
          <p>{formatMeetingPageDate(meeting.startsAt, english)}</p>
          <p className="mt-1">
            {meeting.location ?? (english ? "No location" : "未填写地点")}
          </p>
          {meeting.owner?.name ? (
            <p className="mt-1">
              {english
                ? `Owner ${meeting.owner.name}`
                : `负责人 ${meeting.owner.name}`}
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
        <Badge variant="neutral">
          {english
            ? `${meeting._count.contacts} contacts`
            : `${meeting._count.contacts} 位参与联系人`}
        </Badge>
        <Badge variant="neutral">
          {english
            ? `${meeting.actionItems.length} open actions`
            : `${meeting.actionItems.length} 条待推进动作`}
        </Badge>
        <Badge variant="neutral">
          {english
            ? `${meeting.commitments.length} commitments`
            : `${meeting.commitments.length} 条承诺`}
        </Badge>
        <Badge variant="neutral">
          {english
            ? `${meeting.blockers.length} blockers`
            : `${meeting.blockers.length} 个阻塞`}
        </Badge>
        {meeting.dingtalkSignalCount > 0 ? (
          <Badge variant="neutral">
            {english
              ? `${meeting.dingtalkSignalCount} DingTalk linked signals`
              : `${meeting.dingtalkSignalCount} 条钉钉关联信号`}
          </Badge>
        ) : null}
      </div>
      {meeting.dingtalkLatestWorkProgress ? (
        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-2 text-xs text-[color:var(--muted)]">
          <p className="font-medium text-[color:var(--foreground)]">
            {english ? "Work progress" : "工作进度"}：
            {(meeting.dingtalkLatestWorkProgress.reporterName ??
              (english ? "Unknown reporter" : "未知汇报人")) +
              " · " +
              (meeting.dingtalkLatestWorkProgress.departmentName ??
                (english ? "Unknown dept" : "未知部门"))}
          </p>
          <p className="mt-1">
            {(english ? "Reported at " : "汇报于 ") +
              formatMeetingPageDate(meeting.dingtalkLatestWorkProgress.createdAt, english)}
          </p>
          <p className="mt-1">
            {meeting.dingtalkLatestWorkProgress.nextWeekPlan
              ? trimText(meeting.dingtalkLatestWorkProgress.nextWeekPlan, 80)
              : trimText(meeting.dingtalkLatestWorkProgress.previewText, 80)}
          </p>
        </div>
      ) : null}

      {!compact && nextDueItem ? (
        <div className="theme-surface-panel-soft mt-4 rounded-2xl px-4 py-3">
          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
            {nextDueItem.kind === "commitment"
              ? english
                ? "Next commitment"
                : "下一条承诺"
              : english
                ? "Next action"
                : "下一条动作"}
          </p>
          <p className="mt-1 text-sm font-medium leading-6 text-[color:var(--foreground)]">
            {nextDueItem.title}
          </p>
          <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
            {nextDueItem.ownerName
              ? english
                ? `Owner ${nextDueItem.ownerName}`
                : `负责人 ${nextDueItem.ownerName}`
              : english
                ? "No owner assigned"
                : "未指派负责人"}
            {" · "}
            {nextDueItem.dueDate
              ? english
                ? `Due ${formatMeetingPageDate(nextDueItem.dueDate, english)}`
                : `截止 ${formatMeetingPageDate(nextDueItem.dueDate, english)}`
              : english
                ? "No due date"
                : "未设截止日期"}
          </p>
        </div>
      ) : null}
    </Link>
  );
}

type MeetingOverviewItem = Awaited<
  ReturnType<typeof loadMeetingsPageData>
>["meetings"]["todayMeetings"][number];

function hasMeetingFollowThrough(meeting: MeetingOverviewItem) {
  return (
    meeting.actionItems.length > 0 ||
    meeting.commitments.length > 0 ||
    meeting.blockers.length > 0
  );
}

type MeetingNextDueItem = {
  kind: "action" | "commitment";
  title: string;
  ownerName: string | null;
  dueDate: Date | null;
};

/** Earliest-due open action or commitment; undated items sort last. */
function findNextDueItem(meeting: MeetingOverviewItem): MeetingNextDueItem | null {
  const items: MeetingNextDueItem[] = [
    ...meeting.actionItems.map((item) => ({
      kind: "action" as const,
      title: item.title,
      ownerName: item.owner?.name ?? null,
      dueDate: item.dueDate,
    })),
    ...meeting.commitments.map((item) => ({
      kind: "commitment" as const,
      title: item.title,
      ownerName: item.ownerUser?.name ?? null,
      dueDate: item.dueDate,
    })),
  ];
  const dueTime = (item: MeetingNextDueItem) =>
    item.dueDate ? item.dueDate.getTime() : Number.POSITIVE_INFINITY;

  return items.sort((left, right) => dueTime(left) - dueTime(right))[0] ?? null;
}
