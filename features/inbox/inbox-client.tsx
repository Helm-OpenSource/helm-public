"use client";

import Link from "next/link";
import {
  type ReactNode,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import { RecordSource } from "@prisma/client";
import {
  AlarmClock,
  ArrowRight,
  CalendarPlus,
  ClipboardList,
  MailPlus,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";
import { BusinessLoopGapReadoutLines } from "@/components/shared/business-loop-gap-readout-lines";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { RiskBadge } from "@/components/shared/risk-badge";
import { ThreadStatusBadge } from "@/components/shared/status-badges";
import {
  SystemJudgementSummary,
  systemJudgementDetailsClassName,
} from "@/components/shared/system-judgement-summary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useConsoleStore } from "@/hooks/use-console-store";
import { generateThreadAnalysis } from "@/lib/ai";
import type { BusinessLoopGapSummary } from "@/lib/operating-system/operating-gap";
import { buildBusinessLoopGapReadout } from "@/lib/presentation/business-loop-gap-readout";
import { formatSeededBusinessCopy } from "@/lib/presentation/seeded-business-copy";
import { formatDateLabel } from "@/lib/utils";
import { formatInboxDateLabel } from "@/features/inbox/inbox-date-labels";
import {
  EmailThreadLatestState,
  EmailThreadTranscript,
  summarizeEmailThreadLatest,
} from "@/features/inbox/email-thread-transcript";
import { parseThreadParticipants } from "@/features/inbox/thread-participants";
import { syncGmailConnectorAction } from "@/features/connectors/actions";
import {
  addThreadToOpportunityAction,
  createTodoFromThreadAction,
  generateReplyDraftAction,
  scheduleMeetingFromThreadAction,
  setReminderFromThreadAction,
  upgradeThreadToOpportunityAction,
} from "@/features/inbox/actions";
import {
  buildCustomerAssetHref,
  buildOpportunityAssetHref,
} from "@/features/business-assets/hrefs";

type InboxClientProps = {
  threads: Array<{
    id: string;
    subject: string;
    counterpart: string;
    participants: string | null;
    source: RecordSource;
    status: "OPEN" | "WAITING_US" | "WAITING_THEM" | "CLOSED";
    waitingOn: string | null;
    shouldReply: boolean;
    updatedAt: Date;
    summary: string | null;
    contact: {
      id: string;
      name: string;
      email: string | null;
      phone: string | null;
    } | null;
    company: { id: string; name: string } | null;
    opportunity: {
      id: string;
      title: string;
      type: string;
      riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
      stage:
        | "NEW"
        | "CONTACTED"
        | "ADVANCING"
        | "WAITING_THEM"
        | "INTERNAL_SYNC"
        | "DONE"
        | "LOST";
      nextAction: string | null;
    } | null;
    /** Every message of the thread in send order (the list query takes no slice). */
    messages: Array<{
      id: string;
      sender: string;
      senderEmail: string;
      body: string;
      isInbound: boolean;
      sentAt: Date;
    }>;
  }>;
  selected: InboxClientProps["threads"][number] | null;
  opportunities: Array<{ id: string; title: string }>;
  connector: {
    id: string;
    status: "PENDING" | "CONNECTED" | "DISCONNECTED" | "ERROR";
    externalAccountEmail: string | null;
    lastSyncedAt: Date | null;
    lastSyncStatus: string | null;
    lastSyncMessage: string | null;
  } | null;
  businessLoopGapSummary: BusinessLoopGapSummary;
  initialStatusFilter?:
    | "all"
    | "OPEN"
    | "WAITING_US"
    | "WAITING_THEM"
    | "CLOSED";
  initialRelationshipFilter?: "all" | "attached" | "unattached" | "upgrade";
};

const reminderOptionsByLocale = {
  "zh-CN": ["2 小时后", "今天下班前", "明天上午", "2 天后"],
  "en-US": ["In 2 hours", "Before end of day", "Tomorrow morning", "In 2 days"],
} as const;

const factLinkClassName =
  "text-[color:var(--accent)] underline-offset-4 hover:underline";

function formatInboxDate(value: Date | string | null | undefined, english: boolean) {
  return formatInboxDateLabel(value, english, formatDateLabel);
}

export function InboxClient({
  threads,
  selected,
  opportunities,
  connector,
  businessLoopGapSummary,
  initialStatusFilter = "all",
  initialRelationshipFilter = "all",
}: InboxClientProps) {
  const router = useRouter();
  const { locale } = useWorkspaceUi();
  const english = locale === "en-US";
  const displayText = (value: string | null | undefined) =>
    formatSeededBusinessCopy(value ?? "", english);
  const [, startTransition] = useTransition();
  const { selectedThreadId, setSelectedThreadId } = useConsoleStore();
  const [search, setSearch] = useState("");
  const [opportunityId, setOpportunityId] = useState(opportunities[0]?.id);
  const [statusFilter, setStatusFilter] = useState<
    "all" | InboxClientProps["threads"][number]["status"]
  >(initialStatusFilter);
  const [relationshipFilter, setRelationshipFilter] = useState<
    "all" | "attached" | "unattached" | "upgrade"
  >(initialRelationshipFilter);
  const reminderOptions = reminderOptionsByLocale[locale];
  const [reminder, setReminder] = useState(reminderOptionsByLocale[locale][1]);

  useEffect(() => {
    if (selected) setSelectedThreadId(selected.id);
  }, [selected, setSelectedThreadId]);

  const activeThread =
    threads.find((thread) => thread.id === selectedThreadId) ?? selected;
  const visibleThreads = useMemo(
    () =>
      threads.filter((thread) => {
        const matchSearch =
          !search ||
          thread.subject.toLowerCase().includes(search.toLowerCase()) ||
          thread.counterpart.toLowerCase().includes(search.toLowerCase()) ||
          thread.summary?.toLowerCase().includes(search.toLowerCase());
        const matchStatus =
          statusFilter === "all" || thread.status === statusFilter;
        const matchRelationship =
          relationshipFilter === "all"
            ? true
            : relationshipFilter === "attached"
              ? Boolean(thread.opportunity)
              : relationshipFilter === "unattached"
                ? !thread.opportunity
                : !thread.opportunity && thread.shouldReply;
        return matchSearch && matchStatus && matchRelationship;
      }),
    [relationshipFilter, search, statusFilter, threads],
  );

  const connectedThreads = threads.filter(
    (thread) =>
      thread.source === RecordSource.GMAIL ||
      thread.source === RecordSource.IMPORT ||
      thread.source === RecordSource.HUBSPOT ||
      thread.source === RecordSource.SALESFORCE,
  );
  const unboundConnectedThreads = connectedThreads.filter(
    (thread) => !thread.opportunity || !thread.contact || !thread.company,
  );
  const waitingOnUsCount = threads.filter(
    (thread) => thread.status === "WAITING_US",
  ).length;
  const activeParticipants = parseThreadParticipants(activeThread?.participants);

  // System judgement for the selected thread; it renders only inside the
  // closing system judgement block at the end of the page.
  const analysis = activeThread
    ? generateThreadAnalysis({
        thread: {
          subject: activeThread.subject,
          status: activeThread.status,
          waitingOn: activeThread.waitingOn,
          opportunityId: activeThread.opportunity?.id ?? null,
        },
        messages: activeThread.messages.map((message) => ({
          body: message.body,
          isInbound: message.isInbound,
        })),
        opportunity: activeThread.opportunity
          ? {
              type: activeThread.opportunity.type as
                | "CLIENT"
                | "RECRUITING"
                | "PARTNERSHIP"
                | "INTERNAL",
              stage: activeThread.opportunity.stage,
              riskLevel: activeThread.opportunity.riskLevel,
              nextAction: activeThread.opportunity.nextAction,
            }
          : null,
      })
    : null;
  const businessLoopGapReadout = buildBusinessLoopGapReadout({
    english,
    businessLoopGapSummary,
  });

  const runAction = (
    fn: () => Promise<{ ok: boolean; error?: string; opportunityId?: string }>,
    success: string,
    pushTo?: string,
  ) => {
    startTransition(async () => {
      const result = await fn();
      if (!result.ok) {
        toast.error(result.error ?? (english ? "Action failed" : "操作失败"));
        return;
      }
      toast.success(success);
      if (pushTo) router.push(pushTo);
      router.refresh();
    });
  };

  const sourceCounts = [
    {
      key: "waiting-us",
      label: english ? "Waiting on us" : "待我方回复",
      value: waitingOnUsCount,
      active: statusFilter === "WAITING_US" && relationshipFilter === "all",
      onClick: () => {
        setStatusFilter("WAITING_US");
        setRelationshipFilter("all");
      },
    },
    {
      key: "connected",
      label: english ? "Customer threads" : "客户线程",
      value: connectedThreads.length,
      active: statusFilter === "all" && relationshipFilter === "all",
      onClick: () => {
        setStatusFilter("all");
        setRelationshipFilter("all");
      },
    },
    {
      key: "unbound",
      label: english ? "Unbound leads" : "待绑定线索",
      value: unboundConnectedThreads.length,
      active: relationshipFilter === "unattached",
      onClick: () => {
        setStatusFilter("all");
        setRelationshipFilter("unattached");
      },
    },
  ].filter((item) => item.value > 0);

  return (
    <div className="workspace-surface-stack">
      <PageHeader
        eyebrow={english ? "Inbox" : "收件箱"}
        title={english ? "Threads waiting on you" : "等你处理的线程"}
      />

      <div
        data-inbox-source-status="true"
        className="workspace-panel-muted flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3 text-sm"
      >
        <span className="text-[color:var(--muted-foreground)]">
          {connector?.status === "CONNECTED"
            ? english
              ? `Connected: ${connector.externalAccountEmail ?? "Aliyun Mail"} · synced ${formatInboxDate(connector.lastSyncedAt, english)}`
              : `已接入：${connector.externalAccountEmail ?? "阿里邮箱"} · 最近同步 ${formatInboxDate(connector.lastSyncedAt, english)}`
            : english
              ? "No mailbox connected"
              : "未接入邮箱"}
        </span>
        {connector?.status === "CONNECTED" ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              runAction(
                () => syncGmailConnectorAction(),
                english ? "Inbox sync completed" : "收件箱已完成同步",
              )
            }
          >
            {english ? "Sync Aliyun Mail now" : "立即同步阿里邮箱"}
          </Button>
        ) : (
          <Button variant="secondary" size="sm" asChild>
            <Link href="/settings?tab=connectors">
              {english ? "Connect mailbox" : "接入邮箱"}
            </Link>
          </Button>
        )}
        {sourceCounts.length ? (
          <div className="flex flex-wrap gap-2 xl:ml-auto">
            {sourceCounts.map((item) => (
              <InboxMetric
                key={item.key}
                label={item.label}
                value={item.value}
                active={item.active}
                onClick={item.onClick}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[320px_1fr_340px]">
        <Card className="min-h-[760px]">
          <CardHeader>
            <CardTitle>{english ? "Thread list" : "线程列表"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={
                english ? "Search subject or counterpart" : "搜索主题或对方"
              }
            />
            <Select
              value={statusFilter}
              onValueChange={(value) =>
                setStatusFilter(value as typeof statusFilter)
              }
            >
              <SelectTrigger
                aria-label={english ? "Thread status filter" : "线程状态筛选"}
              >
                <SelectValue
                  placeholder={english ? "Status filter" : "筛选状态"}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {english ? "All threads" : "全部线程"}
                </SelectItem>
                <SelectItem value="WAITING_US">
                  {english ? "Waiting on us" : "待我方回复"}
                </SelectItem>
                <SelectItem value="WAITING_THEM">
                  {english ? "Waiting on them" : "待对方回复"}
                </SelectItem>
                <SelectItem value="OPEN">
                  {english ? "Open" : "开放"}
                </SelectItem>
                <SelectItem value="CLOSED">
                  {english ? "Closed" : "已关闭"}
                </SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={relationshipFilter}
              onValueChange={(value) =>
                setRelationshipFilter(value as typeof relationshipFilter)
              }
            >
              <SelectTrigger
                aria-label={english ? "Relationship filter" : "关系筛选"}
              >
                <SelectValue
                  placeholder={english ? "Relationship filter" : "关系筛选"}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {english ? "All threads" : "全部线程"}
                </SelectItem>
                <SelectItem value="attached">
                  {english ? "Attached to opportunity" : "已归属机会"}
                </SelectItem>
                <SelectItem value="unattached">
                  {english ? "No opportunity linked" : "未归属机会"}
                </SelectItem>
                <SelectItem value="upgrade">
                  {english ? "Should upgrade to opportunity" : "建议升级为机会"}
                </SelectItem>
              </SelectContent>
            </Select>
            <div className="space-y-2">
              {visibleThreads.length ? (
                visibleThreads.map((thread) => {
                  const { latest } = summarizeEmailThreadLatest(thread.messages);
                  return (
                    <button
                      key={thread.id}
                      type="button"
                      aria-label={
                        english
                          ? `Open thread: ${thread.subject}`
                          : `打开线程：${displayText(thread.subject)}`
                      }
                      onClick={() => {
                        setSelectedThreadId(thread.id);
                        if (typeof window !== "undefined") {
                          const params = new URLSearchParams(window.location.search);
                          params.set("threadId", thread.id);
                          window.history.replaceState(
                            window.history.state,
                            "",
                            `/inbox?${params.toString()}`,
                          );
                        }
                      }}
                      className={`w-full rounded-2xl border p-4 text-left transition ${activeThread?.id === thread.id ? "border-[color:var(--border-strong)] bg-[color:color-mix(in_oklab,var(--surface-subtle)_78%,var(--accent-soft)_22%)]" : "border-[color:var(--border)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--surface-subtle)]"}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="line-clamp-1 font-medium text-[color:var(--foreground)]">
                          {displayText(thread.subject)}
                        </p>
                        <ThreadStatusBadge status={thread.status} />
                      </div>
                      <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                        {thread.counterpart}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[color:var(--muted-foreground)]">
                        <span>{sourceLabel(thread.source, english)}</span>
                        <span>·</span>
                        <span>
                          {thread.opportunity?.title
                            ? displayText(thread.opportunity.title)
                            : english
                              ? "No opportunity linked"
                              : "未归属机会"}
                        </span>
                      </div>
                      <p
                        data-inbox-thread-latest={
                          latest ? (latest.isInbound ? "inbound" : "outbound") : "none"
                        }
                        className="mt-2 text-xs text-[color:var(--muted-foreground)]"
                      >
                        {latest
                          ? latest.isInbound
                            ? english
                              ? `Last from ${latest.sender} · ${formatInboxDate(latest.sentAt, english)} · not answered`
                              : `最新来自 ${latest.sender} · ${formatInboxDate(latest.sentAt, english)} · 我方未回复`
                            : english
                              ? `Last is our reply · ${formatInboxDate(latest.sentAt, english)}`
                              : `最新是我方回复 · ${formatInboxDate(latest.sentAt, english)}`
                          : english
                            ? `No messages · updated ${formatInboxDate(thread.updatedAt, english)}`
                            : `暂无邮件 · 更新于 ${formatInboxDate(thread.updatedAt, english)}`}
                      </p>
                    </button>
                  );
                })
              ) : (
                <EmptyState
                  title={english ? "No matching thread" : "没有匹配的线程"}
                  description={
                    english
                      ? "Change the filters or search again."
                      : "换一个筛选条件或重新搜索。"
                  }
                />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="min-h-[760px]">
          <CardHeader>
            <CardTitle>
              {activeThread?.subject
                ? displayText(activeThread.subject)
                : english
                  ? "Select a thread"
                  : "选择一个线程"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {activeThread ? (
              <>
                <div data-inbox-thread-facts="true" className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <ThreadStatusBadge status={activeThread.status} />
                    <Badge
                      variant={
                        activeThread.source === RecordSource.GMAIL
                          ? "info"
                          : activeThread.source === RecordSource.IMPORT ||
                              activeThread.source === RecordSource.HUBSPOT ||
                              activeThread.source === RecordSource.SALESFORCE
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {sourceLabel(activeThread.source, english)}
                    </Badge>
                    {activeThread.opportunity ? null : (
                      <Badge variant="neutral">
                        {english ? "No opportunity linked" : "未归属机会"}
                      </Badge>
                    )}
                  </div>
                  <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                    <ThreadFact label={english ? "Counterpart" : "对方"}>
                      {activeThread.counterpart}
                    </ThreadFact>
                    {activeThread.contact ? (
                      <ThreadFact label={english ? "Contact" : "联系人"}>
                        <Link
                          href={`/contacts/${activeThread.contact.id}`}
                          className={factLinkClassName}
                        >
                          {activeThread.contact.name}
                        </Link>
                        {activeThread.contact.phone ? (
                          <span className="ml-2 text-[color:var(--muted-foreground)]">
                            {activeThread.contact.phone}
                          </span>
                        ) : null}
                        {activeThread.contact.email ? (
                          <span className="ml-2 break-all text-[color:var(--muted-foreground)]">
                            {activeThread.contact.email}
                          </span>
                        ) : null}
                      </ThreadFact>
                    ) : null}
                    {activeThread.company ? (
                      <ThreadFact label={english ? "Company" : "公司"}>
                        <Link
                          href={buildCustomerAssetHref(
                            activeThread.company.id,
                            "inbox-thread",
                          )}
                          className={factLinkClassName}
                        >
                          {activeThread.company.name}
                        </Link>
                      </ThreadFact>
                    ) : null}
                    {activeThread.opportunity ? (
                      <ThreadFact label={english ? "Opportunity" : "机会"}>
                        <Link
                          href={buildOpportunityAssetHref(
                            activeThread.opportunity.id,
                            "inbox-thread",
                          )}
                          className={factLinkClassName}
                        >
                          {displayText(activeThread.opportunity.title)}
                        </Link>
                      </ThreadFact>
                    ) : null}
                  </dl>
                  {activeParticipants.length ? (
                    <p className="break-words text-sm text-[color:var(--muted-foreground)]">
                      {english ? "Participants: " : "参与人："}
                      {activeParticipants.join(english ? ", " : "、")}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2">
                    <EmailThreadLatestState thread={activeThread} english={english} />
                    <Link
                      href={`/inbox/${activeThread.id}`}
                      className="inline-flex min-h-7 items-center rounded-lg px-1.5 text-xs font-medium text-[color:var(--accent)] underline-offset-4 hover:bg-[color:var(--surface-subtle)] hover:underline"
                    >
                      {english ? "View full thread detail" : "查看完整线程详情"}
                    </Link>
                  </div>
                </div>
                {activeThread.messages.length ? (
                  <EmailThreadTranscript thread={activeThread} english={english} />
                ) : (
                  <p className="text-sm text-[color:var(--muted-foreground)]">
                    {english ? "This thread has no messages." : "这个线程没有邮件。"}
                  </p>
                )}
              </>
            ) : (
              <EmptyState
                title={
                  english
                    ? "Select a thread to view content"
                    : "选择一个线程查看内容"
                }
                description={
                  english
                    ? "Pick one on the left and the content lands here."
                    : "在左边挑一条，内容就会出现在这里。"
                }
              />
            )}
          </CardContent>
        </Card>

        {activeThread ? (
          <Card data-inbox-thread-actions="true" className="self-start">
            <CardHeader>
              <CardTitle>{english ? "Thread actions" : "线程动作"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeThread.opportunity ? (
                <div className="theme-surface-panel rounded-2xl p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-[color:var(--foreground)]">
                        {displayText(activeThread.opportunity.title)}
                      </p>
                      {activeThread.opportunity.nextAction ? (
                        <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                          {displayText(activeThread.opportunity.nextAction)}
                        </p>
                      ) : null}
                    </div>
                    <RiskBadge risk={activeThread.opportunity.riskLevel} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="secondary">
                      <Link
                        href={buildOpportunityAssetHref(
                          activeThread.opportunity.id,
                          "inbox-thread",
                        )}
                      >
                        {english ? "Open opportunity asset" : "打开机会资产"}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                    {activeThread.company ? (
                      <Button asChild size="sm" variant="ghost">
                        <Link
                          href={buildCustomerAssetHref(
                            activeThread.company.id,
                            "inbox-thread",
                          )}
                        >
                          {english ? "Customer asset" : "客户资产"}
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <Button
                  className="w-full justify-start"
                  onClick={() =>
                    runAction(
                      () => upgradeThreadToOpportunityAction(activeThread.id),
                      english
                        ? "Thread upgraded into an opportunity"
                        : "线程已升级为机会",
                      "/opportunities",
                    )
                  }
                >
                  <Sparkles className="h-4 w-4" />
                  {english ? "Upgrade to opportunity" : "升级为机会"}
                </Button>
              )}

              <Button
                className="w-full justify-start"
                onClick={() =>
                  runAction(
                    () => generateReplyDraftAction(activeThread.id),
                    english
                      ? "Reply draft created and sent to approvals"
                      : "已生成回复草稿并送审",
                    "/approvals",
                  )
                }
              >
                <MailPlus className="h-4 w-4" />
                {english
                  ? "Generate reply draft and send to approvals"
                  : "生成回复草稿并送审"}
              </Button>
              <div className="theme-surface-panel space-y-2 rounded-2xl p-4">
                <p className="text-sm font-medium text-[color:var(--foreground)]">
                  {english ? "Add to an existing opportunity" : "加入已有机会"}
                </p>
                <Select value={opportunityId} onValueChange={setOpportunityId}>
                  <SelectTrigger
                    aria-label={
                      english
                        ? "Existing opportunity for this thread"
                        : "选择要加入的已有机会"
                    }
                  >
                    <SelectValue
                      placeholder={english ? "Select opportunity" : "选择机会"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {opportunities.map((opportunity) => (
                      <SelectItem key={opportunity.id} value={opportunity.id}>
                        {displayText(opportunity.title)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  className="w-full justify-start"
                  variant="secondary"
                  disabled={!opportunityId}
                  onClick={() =>
                    runAction(
                      () =>
                        addThreadToOpportunityAction(
                          activeThread.id,
                          opportunityId,
                        ),
                      english ? "Thread attached to opportunity" : "线程已加入机会",
                    )
                  }
                >
                  <Sparkles className="h-4 w-4" />
                  {english ? "Attach to opportunity" : "加入机会"}
                </Button>
              </div>
              <Button
                className="w-full justify-start"
                variant="secondary"
                onClick={() =>
                  runAction(
                    () => createTodoFromThreadAction(activeThread.id),
                    english ? "Task created from thread" : "已从线程创建待办",
                    "/approvals",
                  )
                }
              >
                <ClipboardList className="h-4 w-4" />
                {english ? "Create task" : "创建待办"}
              </Button>
              <Button
                className="w-full justify-start"
                variant="secondary"
                onClick={() =>
                  runAction(
                    () => scheduleMeetingFromThreadAction(activeThread.id),
                    english ? "Meeting action created" : "已生成会议动作",
                    "/approvals",
                  )
                }
              >
                <CalendarPlus className="h-4 w-4" />
                {english ? "Schedule meeting" : "预约会议"}
              </Button>
              <div className="theme-surface-panel space-y-2 rounded-2xl p-4">
                <p className="text-sm font-medium text-[color:var(--foreground)]">
                  {english ? "Reminder time" : "提醒时间"}
                </p>
                <Select
                  value={reminder}
                  onValueChange={(value) => setReminder(value as typeof reminder)}
                >
                  <SelectTrigger aria-label={english ? "Reminder time" : "提醒时间"}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {reminderOptions.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  className="w-full justify-start"
                  variant="ghost"
                  onClick={() =>
                    runAction(
                      () => setReminderFromThreadAction(activeThread.id, reminder),
                      english ? "Thread reminder created" : "已设置线程提醒",
                    )
                  }
                >
                  <AlarmClock className="h-4 w-4" />
                  {english ? "Set reminder" : "设置提醒"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <details className={systemJudgementDetailsClassName} data-system-judgement>
        <SystemJudgementSummary english={english} />
        <div className="space-y-4 px-5 pb-5">
          {activeThread && analysis ? (
            <section className="space-y-3" data-inbox-thread-judgement="true">
              <p className="text-sm font-medium text-[color:var(--foreground)]">
                {english ? "Thread judgement" : "线程判断"}
              </p>
              {activeThread.summary ? (
                <AiLine
                  label={english ? "Thread summary" : "线程摘要"}
                  value={displayText(activeThread.summary)}
                />
              ) : null}
              <AiLine
                label={english ? "Current thread judgement" : "当前线程状态判断"}
                value={displayText(analysis.status)}
              />
              <AiLine
                label={english ? "Who is waiting on whom" : "谁在等谁"}
                value={displayText(analysis.waitingOn)}
              />
              <AiLine
                label={english ? "Recommended next move" : "推荐下一步动作"}
                value={displayText(analysis.recommendedAction)}
              />
              <AiLine
                label={english ? "Reply guidance" : "回复建议"}
                value={displayText(analysis.draftGuide)}
              />
              <AiLine
                label={
                  english
                    ? "Should this become a real opportunity"
                    : "是否升级为正式机会"
                }
                value={
                  analysis.shouldUpgrade
                    ? english
                      ? "Recommended"
                      : "建议升级"
                    : english
                      ? "Not yet"
                      : "暂不需要"
                }
              />
            </section>
          ) : null}
          <BusinessLoopGapReadoutLines readout={businessLoopGapReadout} english={english} />
        </div>
      </details>
    </div>
  );
}

function ThreadFact({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-[color:var(--muted-foreground)]">{label}</dt>
      <dd className="mt-0.5 break-words font-medium text-[color:var(--foreground)]">
        {children}
      </dd>
    </div>
  );
}

function AiLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="workspace-panel-muted rounded-2xl px-4 py-3">
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
        {value}
      </p>
    </div>
  );
}

function sourceLabel(source: RecordSource, english = false) {
  switch (source) {
    case RecordSource.GMAIL:
      return english ? "Real email data" : "真实邮件数据";
    case RecordSource.IMPORT:
      return english ? "Imported data" : "导入数据";
    case RecordSource.HUBSPOT:
      return english ? "HubSpot import" : "HubSpot 导入";
    case RecordSource.SALESFORCE:
      return english ? "Salesforce import" : "Salesforce 导入";
    default:
      return english ? "Demo data" : "演示数据";
  }
}

function InboxMetric({
  label,
  value,
  active = false,
  onClick,
}: {
  label: string;
  value: number;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`${label} ${value}`}
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-8 items-center gap-2 rounded-full border px-3 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_oklab,var(--accent)_28%,transparent)] ${active ? "border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)] text-[color:var(--foreground)]" : "border-[color:var(--border)] text-[color:var(--muted-foreground)] hover:border-[color:var(--border-strong)]"}`}
    >
      <span>{label}</span>
      <span className="text-sm font-semibold text-[color:var(--foreground)]">{value}</span>
    </button>
  );
}
