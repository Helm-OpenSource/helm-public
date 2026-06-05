import Link from "next/link";
import { CalendarDays, Clock3, FileText, Sparkles } from "lucide-react";
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
  CardDescription,
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
  const meetingLoopHeadline = primaryMeeting
    ? english
      ? `Open this one first — pick what to send out, what to review, what to drop.`
      : `先打开这一场——挑哪些发出去、哪些进复核、哪些先放一放。`
    : english
      ? "No meetings yet. Connect one and the next move will land here."
      : "还没有会议。接入一个，下一步动作会落到这里。";
  const meetingLoopPreparedLine = primaryFollowThroughMeeting
    ? english
      ? `${primaryFollowThroughMeeting.actionItems.length} active actions, ${primaryFollowThroughMeeting.commitments.length} open commitments, ${primaryFollowThroughMeeting.blockers.length} blockers.`
      : `${primaryFollowThroughMeeting.actionItems.length} 条动作、${primaryFollowThroughMeeting.commitments.length} 条承诺、${primaryFollowThroughMeeting.blockers.length} 条阻塞。`
    : english
      ? "Bring in real meeting objects first."
      : "先接入真实会议对象。";
  const meetingLoopBoundaryLine = primaryFollowThroughMeeting
    ? describeMeetingBoundary(primaryFollowThroughMeeting, english)
    : english
      ? "No live meeting boundary posture is visible yet."
      : "当前还没有可见的会议边界状态。";
  const meetingEntryRoleLine = english
    ? "Open the one that matters most."
    : "打开现在最重要的那场。";
  const meetingLoopTitle = primaryFollowThroughMeeting
    ? english
      ? `${primaryFollowThroughMeeting.title}: ${meetingLoopPreparedLine}`
      : `${primaryFollowThroughMeeting.title}：${meetingLoopPreparedLine}`
    : english
      ? "No meeting follow-through pressure is visible yet."
      : "当前还没有可见的会后推进压力。";
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
        title={
          english
            ? "Today's meetings — and which one is going to need you to chase"
            : "今天的会议清单——和哪一场会后还得你追"
        }
        description={pageStory.description}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label={english ? "All meetings" : "全部会议"}
          value={meetings.summary.total}
          detail={english ? "Meetings you can reopen" : "当前可回看的会议"}
        />
        <StatCard
          label={english ? "Today" : "今日会议"}
          value={meetings.summary.today}
          detail={
            english
              ? "Needs live preparation or same-day follow-up"
              : "需要会前准备或当天跟进"
          }
        />
        <StatCard
          label={english ? "Upcoming" : "待开会议"}
          value={meetings.summary.upcoming}
          detail={
            english ? "Upcoming scheduled sessions" : "接下来排期中的会议"
          }
        />
        <StatCard
          label={english ? "With notes" : "已有纪要"}
          value={meetings.summary.withNote}
          detail={english ? "Already has note or summary" : "已有纪要或总结"}
        />
        <StatCard
          label={english ? "Follow-up pressure" : "会后推进压力"}
          value={meetings.summary.withOpenFollowUp}
          detail={
            english
              ? "Still has actions, commitments or blockers"
              : "仍有动作、承诺或阻塞待推进"
          }
        />
      </div>

      {meetings.workspaceDingTalkWorkProgress?.length ? (
        <Card className="workspace-panel-muted">
          <CardHeader>
            <CardTitle>
              {english
                ? "Work Progress (DingTalk getReportList)"
                : "工作进度（钉钉只读汇报）"}
            </CardTitle>
            <CardDescription>
              {english
                ? "Live read-only work reports with reporter and department context."
                : "实时只读工作汇报，包含汇报人和部门信息。"}
            </CardDescription>
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

      <Card className="workspace-panel-muted">
        <CardContent className="grid gap-4 py-5 xl:grid-cols-[1.2fr_repeat(3,minmax(0,0.8fr))]">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="approval">
                {formatMeetingDisplayText("Meeting OS wedge", english)}
              </Badge>
              {primaryFollowThroughMeeting ? (
                <Badge
                  variant={
                    primaryFollowThroughMeeting.blockers.some(
                      (item) => item.severity >= 75,
                    )
                      ? "danger"
                      : hasMeetingApprovalPressure(primaryFollowThroughMeeting)
                        ? "warning"
                        : "success"
                  }
                >
                  {primaryFollowThroughMeeting.blockers.some(
                    (item) => item.severity >= 75,
                  )
                    ? english
                      ? "Review pressure visible"
                      : "复核压力可见"
                    : hasMeetingApprovalPressure(primaryFollowThroughMeeting)
                      ? english
                        ? "Needs human check"
                        : "需人工确认"
                      : english
                        ? "Loop readable"
                        : "主回路可读"}
                </Badge>
              ) : null}
            </div>
            <p className="text-lg font-semibold text-[color:var(--foreground)]">
              {meetingLoopTitle}
            </p>
            <p className="text-sm leading-6 text-[color:var(--muted)]">
              {meetingLoopHeadline}
            </p>
            <details className="rounded-lg border border-[color:var(--border)] bg-[color:var(--background-elevated)] px-3 py-2 text-xs leading-6 text-[color:var(--muted)]">
              <summary className="cursor-pointer list-none font-semibold marker:content-none [&::-webkit-details-marker]:hidden">
                {english ? "Meeting facts" : "会议事实"}
              </summary>
              <p className="mt-2">{meetingLoopPreparedLine}</p>
              <p>{meetingLoopBoundaryLine}</p>
              <p>{meetingEntryRoleLine}</p>
            </details>
            <div className="flex flex-wrap gap-2">
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
            </div>
          </div>
          <MeetingLoopSummaryCard
            label={english ? "Open first" : "先打开"}
            title={
              primaryMeeting?.title ??
              (english ? "No meeting entry yet" : "还没有会议入口")
            }
            summary={
              primaryMeeting
                ? describeMeetingNextMove(primaryMeeting, english)
                : english
                  ? "Bring in real meeting objects first so this page can rank them."
                  : "先把真实会议对象带进来，这一页才能开始排序。"
            }
          />
          <MeetingLoopSummaryCard
            label={english ? "Close next" : "下一步先收什么"}
            title={
              primaryFollowThroughMeeting?.title ??
              (english ? "No follow-through yet" : "还没有会后动作压力")
            }
            summary={
              primaryFollowThroughMeeting
                ? describeMeetingNextMove(primaryFollowThroughMeeting, english)
                : english
                  ? "Once commitments, blockers or actions appear, this slot should point to the next follow-through."
                  : "等承诺、阻塞或动作长出来后，这里应该直接指向下一步会后收口。"
            }
          />
          <MeetingLoopSummaryCard
            label={english ? "Human check" : "人工确认"}
            title={
              primaryFollowThroughMeeting
                ? hasMeetingApprovalPressure(primaryFollowThroughMeeting)
                  ? english
                    ? "Needs confirmation"
                    : "需要确认"
                  : english
                    ? "Can stay inside the loop"
                    : "可以留在主回路内处理"
                : english
                  ? "Not visible yet"
                  : "当前不可见"
            }
            summary={meetingLoopPreparedLine}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{english ? "Today's meetings" : "今日会议"}</CardTitle>
            <CardDescription>
              {english
                ? "Open the meeting you need to prepare for right now, then continue into briefing, memory and approval."
                : "优先打开你现在就要准备的会议，再继续进入会前简报、记忆和审批。"}
            </CardDescription>
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
            <CardDescription>
              {english
                ? "Use this section to spot the next conversation that deserves pre-meeting preparation."
                : "从这里快速找到下一场值得提前准备的会议。"}
            </CardDescription>
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
            <CardDescription>
              {english
                ? "Look back at conversations that are still shaping blockers, commitments and opportunity momentum."
                : "回看那些仍在影响阻塞、承诺和机会势能的对话。"}
            </CardDescription>
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
          {!compact && meeting.agenda ? (
            <p className="text-sm leading-6 text-[color:var(--muted)]">
              {formatMeetingDisplayText(meeting.agenda, english)}
            </p>
          ) : null}
        </div>
        <div className="text-right text-xs text-[color:var(--muted-foreground)]">
          <p>{formatMeetingPageDate(meeting.startsAt, english)}</p>
          <p className="mt-1">
            {meeting.location ?? (english ? "No location" : "未填写地点")}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
        <Badge variant="neutral">
          {english
            ? `${meeting.contacts.length} contacts`
            : `${meeting.contacts.length} 位参与联系人`}
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

      {!compact ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="theme-surface-panel-soft rounded-2xl px-4 py-3">
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
              {english ? "Next move now" : "当前下一步"}
            </p>
            <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--foreground)]">
              {describeMeetingNextMove(meeting, english)}
            </p>
          </div>
          <div className="theme-surface-panel-soft rounded-2xl px-4 py-3">
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
              {english ? "Boundary posture" : "边界状态"}
            </p>
            <p className="mt-2 text-sm font-medium leading-6 text-[color:var(--foreground)]">
              {describeMeetingBoundary(meeting, english)}
            </p>
          </div>
        </div>
      ) : null}

      {!compact && hasOpenFollowUp ? (
        <div className="workspace-panel-muted mt-4 rounded-2xl px-4 py-3 text-sm text-[color:var(--muted)]">
          <div className="flex items-center gap-2 font-medium text-[color:var(--foreground)]">
            <Sparkles className="h-4 w-4 text-[var(--accent)]" />
            {english ? "What still needs attention" : "当前还没收口的地方"}
          </div>
          <p className="mt-2 leading-6">
            {meeting.blockers.length > 0
              ? english
                ? "This meeting still has active blockers, so opening it now will immediately show the current constraints and the next move."
                : "这场会议仍有关联阻塞，打开后会直接看到当前约束和下一步动作。"
              : meeting.commitments.length > 0
                ? english
                  ? "This meeting left open commitments behind, so it is still affecting follow-up pressure."
                  : "这场会议留下了未完成承诺，因此仍在影响后续推进压力。"
                : english
                  ? "This meeting still has suggested or pending actions waiting for execution."
                  : "这场会议仍有建议动作或待执行动作没有收口。"}
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

function hasMeetingApprovalPressure(meeting: MeetingOverviewItem) {
  return (
    meeting.actionItems.some(
      (item) =>
        item.status === "PENDING_APPROVAL" ||
        item.executionMode === "REQUIRES_APPROVAL",
    ) || meeting.blockers.some((item) => item.severity >= 75)
  );
}

function describeMeetingNextMove(
  meeting: MeetingOverviewItem,
  english: boolean,
) {
  if (meeting.blockers.length > 0) {
    return english
      ? "Open the meeting and clear the blocker-driven constraint before adding more follow-through."
      : "先打开会议，把阻塞带来的约束讲清，再决定要不要继续堆会后动作。";
  }

  if (meeting.actionItems.length > 0) {
    return english
      ? "Turn the post-meeting action list into the next concrete move instead of leaving it inside notes."
      : "把会后动作列表转成下一步具体行动。";
  }

  if (meeting.commitments.length > 0) {
    return english
      ? "Close the open commitment left by this meeting before pushing the object state further."
      : "先把这场会议留下的未完成承诺收口，再继续往前推对象状态。";
  }

  if (meeting.note) {
    return english
      ? "Use the meeting note as the base, then decide whether it should become follow-through, approval or memory."
      : "先把会议纪要当成底稿，再决定它该变成会后动作、审批还是记忆沉淀。";
  }

  return english
    ? "Open the meeting first and make sure the briefing, participants and goal are aligned."
    : "先打开会议，把会前简报、参与对象和本次目标对齐。";
}

function describeMeetingBoundary(
  meeting: MeetingOverviewItem,
  english: boolean,
) {
  if (meeting.blockers.some((item) => item.severity >= 75)) {
    return english
      ? "High-severity blocker is visible, so review pressure should stay explicit before anything leaves the loop."
      : "当前有高严重度阻塞，复核压力必须保持显性，不能让动作直接离开这条主回路。";
  }

  if (
    meeting.actionItems.some(
      (item) =>
        item.status === "PENDING_APPROVAL" ||
        item.executionMode === "REQUIRES_APPROVAL",
    )
  ) {
    return english
      ? "This meeting already created actions that need review, so approval posture is part of the loop now."
      : "这场会议已经长出了需要复核的动作，审批状态已经进入这条主回路。";
  }

  if (meeting.commitments.some((item) => item.overdueFlag)) {
    return english
      ? "The main pressure is overdue follow-through rather than authority, so keep the loop focused on closing the commitment."
      : "当前最大压力是逾期承诺，而不是权限动作，所以主回路应先聚焦收口承诺。";
  }

  return english
    ? "Current meeting signals can still stay inside briefing, memory and next-step preparation before a stronger review gate appears."
    : "当前会议信号还可以留在会前简报、记忆和下一步准备里处理，暂时不需要更重的复核闸门。";
}

function MeetingLoopSummaryCard({
  label,
  title,
  summary,
}: {
  label: string;
  title: string;
  summary: string;
}) {
  return (
    <div className="theme-surface-panel rounded-2xl px-4 py-4">
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-[color:var(--foreground)]">{title}</p>
      <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{summary}</p>
    </div>
  );
}
