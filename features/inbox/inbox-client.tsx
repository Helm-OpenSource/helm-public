"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
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
import { CustomerAssetFocusStrip } from "@/components/shared/customer-asset-focus-strip";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { RiskBadge } from "@/components/shared/risk-badge";
import { ThreadStatusBadge } from "@/components/shared/status-badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { formatDateLabel, trimText } from "@/lib/utils";
import { formatInboxMessageBody } from "@/features/inbox/message-formatting";
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

type InboxOperatingConnection = {
  label: string;
  value: string;
  description: string;
  href?: string;
};

type InboxClientProps = {
  threads: Array<{
    id: string;
    subject: string;
    counterpart: string;
    source: RecordSource;
    status: "OPEN" | "WAITING_US" | "WAITING_THEM" | "CLOSED";
    waitingOn: string | null;
    shouldReply: boolean;
    updatedAt: Date;
    summary: string | null;
    contact: { id: string; name: string } | null;
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
  const replyCriticalThreads = connectedThreads.filter(
    (thread) => thread.status === "WAITING_US" || thread.shouldReply,
  );
  const coldStartLine =
    connector?.status === "CONNECTED"
      ? connector.lastSyncMessage
        ? english
          ? `${connector.lastSyncMessage} Start with the ${replyCriticalThreads.length} threads waiting on us, then bind the ${unboundConnectedThreads.length} leads that are still partially unlinked.`
          : `${connector.lastSyncMessage} 当前最值得先看的是 ${replyCriticalThreads.length} 条待我方动作线程，以及 ${unboundConnectedThreads.length} 条还没完全绑定的线索。`
        : english
          ? `Real Aliyun Mail is connected. Prioritize the ${replyCriticalThreads.length} threads waiting on us, then bind the ${unboundConnectedThreads.length} unbound leads to contacts, companies or opportunities.`
          : `真实阿里邮箱已接入。优先处理 ${replyCriticalThreads.length} 条待我方动作线程，再把 ${unboundConnectedThreads.length} 条未绑定线索归到联系人、公司或机会。`
      : connectedThreads.length
        ? english
          ? `${connectedThreads.length} customer threads are ready. Clean up object binding first and the recommendation panel on the right will become useful much faster.`
          : `当前已有 ${connectedThreads.length} 条客户线程。先把未绑定对象归属清楚，右侧判断会更快变准。`
        : english
          ? "Once Aliyun Mail or imported history is connected, this area will be the first place where reply, upgrade and binding decisions appear."
          : "接入阿里邮箱或导入历史线程后，这里会最先长出待回复、待升级和待绑定判断。";
  const priorityThread =
    activeThread ??
    replyCriticalThreads[0] ??
    unboundConnectedThreads[0] ??
    visibleThreads[0] ??
    threads[0] ??
    null;
  const businessLoopGapReadout = buildBusinessLoopGapReadout({
    english,
    businessLoopGapSummary,
  });
  const inboxOperatingTitle = priorityThread
    ? english
      ? `"${priorityThread.subject}" is the clearest thread to judge first right now`
      : `“${displayText(priorityThread.subject)}”是当前最值得先判断的线程`
    : english
      ? "The inbox still needs a real thread before it can become a trustworthy work entry"
      : "收件箱还需要先有真实线程对象，才能变成可信的工作入口";
  const inboxOperatingSummary = priorityThread
    ? priorityThread.shouldReply || priorityThread.status === "WAITING_US"
      ? english
        ? "This thread is already waiting on us, so the inbox should decide whether it needs a reply, a meeting, an upgrade or a deliberate hold."
        : "这条线程已经进入待我方动作窗口，所以收件箱现在就该判断：要回复、要约会、要升级，还是要明确按住。"
      : !priorityThread.opportunity ||
          !priorityThread.contact ||
          !priorityThread.company
        ? english
          ? "The thread already matters, but object binding is still incomplete, so the context should be made trustworthy first."
          : "这条线程已经值得处理，但对象绑定还不完整，需要先把上下文补可信。"
        : english
          ? "The thread is already connected to a real business object, so the inbox should now explain whether it should feed follow-through or formal review."
          : "这条线程已经挂到真实业务对象上，所以收件箱现在要说明它该进入后续跟进还是正式复核。"
    : coldStartLine;
  const inboxOperatingSnapshot = {
    objectState: priorityThread
      ? `${formatThreadStatus(priorityThread.status, english)} · ${
          priorityThread.opportunity?.title
            ? displayText(priorityThread.opportunity.title)
            : english
              ? "Unbound opportunity"
              : "未绑定机会"
        } · ${priorityThread.counterpart}`
      : english
        ? "No visible thread yet"
        : "当前还没有可见线程",
    blocker: businessLoopGapReadout.blocker
      ? businessLoopGapReadout.blocker
      : priorityThread
        ? priorityThread.shouldReply || priorityThread.status === "WAITING_US"
          ? english
            ? "The thread is already waiting on us and cannot keep sitting in the queue."
            : "这条线程已经在等我方动作，不能继续挂着不处理。"
          : !priorityThread.opportunity ||
              !priorityThread.contact ||
              !priorityThread.company
            ? english
              ? "Object binding is still incomplete, so downstream judgement is not trustworthy yet."
              : "对象绑定还不完整，下游判断暂时还不可信。"
            : english
              ? "No dominant blocker is visible beyond review posture."
              : "当前除了复核姿态之外，没有更强的阻塞。"
        : english
          ? "The inbox still needs its first live thread."
          : "收件箱还缺第一条真实线程。",
    pendingDecision:
      businessLoopGapReadout.pendingDecision ??
      (priorityThread
        ? priorityThread.shouldReply || priorityThread.status === "WAITING_US"
          ? english
            ? "Decide whether this thread becomes a reply, a meeting, or a deliberate hold."
            : "判断这条线程是进入回复、会议，还是明确按住。"
          : !priorityThread.opportunity ||
              !priorityThread.contact ||
              !priorityThread.company
            ? english
              ? "Decide which object should own this thread before widening any follow-through."
              : "先决定这条线程该归哪个对象，再扩大后续动作。"
            : english
              ? "Decide whether the next move belongs in follow-up, approvals, or opportunity upgrade."
              : "判断下一步该进后续动作、审批，还是升级成机会。"
        : english
          ? "Decide whether to import history or connect Aliyun Mail first."
          : "先决定是导入历史线程，还是先连接阿里邮箱。"),
    nextAction:
      businessLoopGapReadout.nextAction ??
      (priorityThread
        ? priorityThread.shouldReply || priorityThread.status === "WAITING_US"
          ? english
            ? "Open the thread and draft the next move now."
            : "现在就打开线程，起草下一步动作。"
          : !priorityThread.opportunity ||
              !priorityThread.contact ||
              !priorityThread.company
            ? english
              ? "Finish object binding before trusting the rest of the page."
              : "先补齐对象绑定，再信任后面的判断。"
            : english
              ? "Use the linked thread to trigger the next review-aware move."
              : "基于已绑定线程，触发下一步复核感知动作。"
        : english
          ? "Import or sync the first live thread."
          : "先导入或同步第一条真实线程。"),
  };
  const _inboxOperatingConnections: InboxOperatingConnection[] = (
    priorityThread
      ? [
          businessLoopGapReadout.connection,
          priorityThread.contact
            ? {
                label: english ? "Linked contact" : "关联联系人",
                value: priorityThread.contact.name,
                description: english
                  ? "Relationship continuity on this person is the fastest way to judge whether the thread should push or pause."
                  : "这位联系人的关系连续性，决定了这条线程下一步到底该推还是该按住。",
                href: `/contacts/${priorityThread.contact.id}`,
              }
            : {
                label: english ? "Contact binding" : "联系人绑定",
                value: english ? "Still missing" : "当前缺失",
                description: english
                  ? "Bind a contact — this thread is orphaned right now."
                  : "把联系人绑定上——现在这条线程没人对接。",
              },
          priorityThread.company
            ? {
                label: english ? "Linked company" : "关联公司",
                value: priorityThread.company.name,
                description: english
                  ? "Open the account page to confirm whether the thread fits the wider account push."
                  : "打开公司页，确认这条线程是否还符合更大的账户推进方向。",
                href: buildCustomerAssetHref(
                  priorityThread.company.id,
                  "inbox-priority",
                ),
              }
            : {
                label: english ? "Account binding" : "公司绑定",
                value: english ? "Still missing" : "当前缺失",
                description: english
                  ? "Company context is still incomplete, so downstream judgement should stay conservative."
                  : "公司上下文还没补齐，下游判断就应该继续保持保守。",
              },
          priorityThread.opportunity
            ? {
                label: english ? "Active opportunity" : "活跃机会",
                value: displayText(priorityThread.opportunity.title),
                description: english
                  ? "Use the thread together with the linked opportunity before deciding whether to escalate or hold."
                  : "把线程和这条机会放在一起看，再决定是升级处理还是继续按住。",
                href: buildOpportunityAssetHref(
                  priorityThread.opportunity.id,
                  "inbox-priority",
                ),
              }
            : {
                label: english ? "Opportunity binding" : "机会绑定",
                value: english ? "Not linked yet" : "尚未绑定",
                description: english
                  ? "Without an opportunity, thread pressure is visible but still harder to judge inside the business loop."
                  : "没有挂到机会上，线程压力虽然可见，但在经营主回路里仍然更难判断。",
              },
          priorityThread.shouldReply || priorityThread.status === "WAITING_US"
            ? {
                label: english ? "Review handoff" : "复核去向",
                value: english
                  ? "Reply pressure is visible and should stay review-aware."
                  : "回复压力已经可见，下一步仍应保持复核感知。",
                description: english
                  ? "Use approvals or a deliberate task path before treating the thread like an external commitment."
                  : "先经过审批区或明确任务路径，再把它当成真正对外动作。",
                href: "/approvals",
              }
            : {
                label: english ? "Thread source" : "线程来源",
                value: sourceLabel(priorityThread.source, english),
                description: english
                  ? "The current judgement still starts from a read-only source, not an execution console."
                  : "当前判断仍然从只读来源开始，而不是执行控制台。",
              },
        ]
      : []
  ).filter((item): item is InboxOperatingConnection => Boolean(item));
  const _inboxGuidanceRecommendations = [
    priorityThread?.shouldReply || priorityThread?.status === "WAITING_US"
      ? {
          title: english ? "Decide the reply path now" : "先决定回复路径",
          body: english
            ? "This thread is already waiting on us. Decide whether it needs a draft, a meeting or a deliberate hold before reading lower-pressure threads."
            : "这条线程已经进入待我方动作窗口。先决定是起草回复、约会，还是明确按住，再去看更低压力的线程。",
          meta: english ? "Reply pressure" : "回复压力",
        }
      : undefined,
    priorityThread &&
    (!priorityThread.opportunity ||
      !priorityThread.contact ||
      !priorityThread.company)
      ? {
          title: english ? "Finish object binding first" : "先补齐对象绑定",
          body: english
            ? "The thread already matters, but downstream judgement is still weak until contact, company and opportunity context are complete."
            : "这条线程已经值得处理，但在联系人、公司和机会上下文补齐之前，下游判断都还不够稳。",
          meta: english ? "Binding gap" : "绑定缺口",
        }
      : undefined,
    connector?.status === "CONNECTED"
      ? {
          title: english
            ? "Keep real inbox data current"
            : "保持真实收件箱数据更新",
          body: english
            ? `Connected account ${connector.externalAccountEmail ?? "Aliyun Mail"} should stay in sync before you treat missing threads as signal.`
            : `当前已接入账号 ${connector.externalAccountEmail ?? "阿里邮箱"}，先保持同步，再把“没有新线程”读成真正信号。`,
          meta: english ? "Connector posture" : "连接器姿态",
        }
      : undefined,
  ].filter(
    (
      item,
    ): item is {
      title: string;
      body: string;
      meta: string;
    } => Boolean(item),
  );
  const _inboxGuidanceReminders = [
    {
      title: english ? "Current inbox judgement" : "当前收件箱判断",
      body: inboxOperatingSummary,
      meta: english ? "Operating summary" : "操作摘要",
    },
    priorityThread?.summary
      ? {
          title: english ? "Live thread summary" : "线程摘要",
          body: trimText(displayText(priorityThread.summary), 112),
          meta: english ? "Selected thread" : "当前线程",
        }
      : undefined,
    {
      title: english ? "Connector context" : "连接上下文",
      body: coldStartLine,
      meta: english ? "Data posture" : "数据姿态",
    },
  ].filter(
    (
      item,
    ): item is {
      title: string;
      body: string;
      meta: string;
    } => Boolean(item),
  );
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

  return (
    <div className="workspace-surface-stack">
      <PageHeader
        eyebrow={english ? "Inbox" : "收件箱"}
        title={
          english
            ? "Threads waiting on you"
            : "等你处理的线程"
        }
        description={
          english
            ? "Reply, turn into an opportunity, or schedule a meeting — pick one for each."
            : "回复、升级成机会，或建会——每条挑一个。"
        }
      />

      <CustomerAssetFocusStrip
        eyebrow={english ? "Customer thread" : "客户线程"}
        title={inboxOperatingTitle}
        summary={inboxOperatingSummary}
        primaryAction={
          priorityThread
            ? {
                label: english ? "Open thread" : "打开线程",
                href: `/inbox?threadId=${priorityThread.id}`,
              }
            : {
                label: english ? "Connect source" : "接入来源",
                href: "/settings?tab=connectors",
              }
        }
        secondaryAction={
          priorityThread?.opportunity
            ? {
                label: english ? "Open opportunity" : "打开机会",
                href: buildOpportunityAssetHref(priorityThread.opportunity.id),
              }
            : {
                label: english ? "Unbound only" : "只看待绑定",
                href: "/inbox?relationship=unattached",
              }
        }
        items={[
          {
            label: english ? "Thread state" : "线程状态",
            value: inboxOperatingSnapshot.objectState,
            tone: "info",
          },
          {
            label: english ? "Pressure" : "当前压力",
            value: inboxOperatingSnapshot.blocker,
            tone:
              priorityThread?.shouldReply ||
              priorityThread?.status === "WAITING_US"
                ? "warning"
                : "default",
          },
          {
            label: english ? "Next decision" : "下一步判断",
            value: inboxOperatingSnapshot.pendingDecision,
            detail: inboxOperatingSnapshot.nextAction,
            href: priorityThread ? `/inbox?threadId=${priorityThread.id}` : null,
            tone: "success",
          },
        ]}
      />

      <Card className="workspace-panel-muted">
        <CardContent className="grid gap-4 py-5 xl:grid-cols-[1.2fr_repeat(3,minmax(0,0.9fr))]">
          <div className="space-y-2">
            <Badge variant="info">
              {english ? "Source state" : "来源状态"}
            </Badge>
            <p className="text-sm text-[color:var(--muted-foreground)]">
              {connector?.status === "CONNECTED"
                ? english
                  ? `Connected: ${connector.externalAccountEmail ?? "Aliyun Mail account"} · synced ${formatDateLabel(connector.lastSyncedAt)}.`
                  : `已接入：${connector.externalAccountEmail ?? "阿里邮箱"} · 最近同步 ${formatDateLabel(connector.lastSyncedAt)}。`
                : english
                  ? "No mail account connected yet. Use the current threads to review the reply and binding path."
                  : "还没接入邮箱。先用当前线程检查回复和对象绑定路径。"}
            </p>
          </div>
          <InboxMetric
            label={english ? "Waiting on us" : "待我方回复"}
            value={
              threads.filter((thread) => thread.status === "WAITING_US").length
            }
            active={
              statusFilter === "WAITING_US" && relationshipFilter === "all"
            }
            onClick={() => {
              setStatusFilter("WAITING_US");
              setRelationshipFilter("all");
            }}
          />
          <InboxMetric
            label={english ? "Customer threads" : "客户线程"}
            value={connectedThreads.length}
            active={statusFilter === "all" && relationshipFilter === "all"}
            onClick={() => {
              setStatusFilter("all");
              setRelationshipFilter("all");
            }}
          />
          <InboxMetric
            label={english ? "Unbound leads" : "待绑定线索"}
            value={unboundConnectedThreads.length}
            active={relationshipFilter === "unattached"}
            onClick={() => {
              setStatusFilter("all");
              setRelationshipFilter("unattached");
            }}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[320px_1fr_380px]">
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
            <Button
              variant="secondary"
              className="w-full justify-start"
              disabled={!connector || connector.status !== "CONNECTED"}
              onClick={() =>
                runAction(
                  () => syncGmailConnectorAction(),
                  english ? "Inbox sync completed" : "收件箱已完成同步",
                )
              }
            >
              {english ? "Sync Aliyun Mail now" : "立即同步阿里邮箱"}
            </Button>
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
                visibleThreads.map((thread) => (
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
                      <span>·</span>
                      <span>
                        {thread.shouldReply
                          ? english
                            ? "Reply needed"
                            : "待回复"
                          : english
                            ? "No immediate reply needed"
                            : "无需立即回复"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
                      {english
                        ? `Updated ${formatDateLabel(thread.updatedAt)}`
                        : `更新于 ${formatDateLabel(thread.updatedAt)}`}
                    </p>
                  </button>
                ))
              ) : (
                <EmptyState
                  title={english ? "No matching thread" : "没有匹配的线程"}
                  description={
                    english
                      ? "Change the filters or relocate the thread from search."
                      : "可以换一个筛选条件，或从搜索中重新定位线程。"
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
                <div className="flex flex-wrap gap-2">
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
                  {activeThread.opportunity ? (
                    <Badge variant="info">
                      {english ? "Linked to opportunity" : "已归属机会"}
                    </Badge>
                  ) : (
                    <Badge variant="warning">
                      {english
                        ? "Decide whether to upgrade"
                        : "待判断是否升级为机会"}
                    </Badge>
                  )}
                  {activeThread.company ? (
                    <Link
                      href={buildCustomerAssetHref(
                        activeThread.company.id,
                        "inbox-thread",
                      )}
                      className="rounded-full bg-[color:color-mix(in_oklab,var(--surface-subtle)_88%,var(--background)_12%)] px-2.5 py-1 text-xs font-medium text-[color:var(--foreground)] ring-1 ring-[color:var(--border)]"
                    >
                      {activeThread.company.name}
                    </Link>
                  ) : null}
                  {activeThread.contact ? (
                    <Link
                      href={`/contacts/${activeThread.contact.id}`}
                      className="rounded-full bg-[color:color-mix(in_oklab,var(--surface-subtle)_88%,var(--background)_12%)] px-2.5 py-1 text-xs font-medium text-[color:var(--foreground)] ring-1 ring-[color:var(--border)]"
                    >
                      {activeThread.contact.name}
                    </Link>
                  ) : null}
                </div>
                <div className="workspace-panel-muted rounded-2xl p-4">
                  <p className="text-sm text-[color:var(--muted)]">
                    {activeThread.summary
                      ? displayText(activeThread.summary)
                      : english
                        ? "No thread summary yet"
                        : "暂无线程摘要"}
                  </p>
                  <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
                    {activeThread.source === "GMAIL"
                      ? english
                        ? "Read-only: the current Aliyun Mail connection will not send or write back email."
                        : "当前只读：阿里邮箱不会回写或发送邮件。"
                      : english
                        ? "This thread is available for review and object binding."
                        : "当前线程可用于复核和对象绑定。"}
                  </p>
                  <Link
                    href={`/inbox/${activeThread.id}`}
                    className="mt-3 inline-flex min-h-7 items-center rounded-lg px-1.5 text-xs font-medium text-[color:var(--accent)] underline-offset-4 hover:bg-[color:var(--surface-subtle)] hover:underline"
                  >
                    {english ? "View full thread detail" : "查看完整线程详情"}
                  </Link>
                </div>
                <div className="space-y-3">
                  {activeThread.messages.map((message) => (
                    <div
                      key={message.id}
                      className={`rounded-2xl px-4 py-4 ${message.isInbound ? "border border-[color:var(--border)] bg-[color:color-mix(in_oklab,var(--surface)_92%,white_8%)]" : "bg-[color:var(--accent)] text-[color:var(--accent-foreground)]"}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p
                          className={`text-sm font-medium ${message.isInbound ? "text-[color:var(--foreground)]" : "text-[color:var(--accent-foreground)]"}`}
                        >
                          {message.sender}
                        </p>
                        <p
                          className={`text-xs ${message.isInbound ? "text-[color:var(--muted-foreground)]" : "text-[color:color-mix(in_oklab,var(--accent-foreground)_72%,transparent)]"}`}
                        >
                          {formatDateLabel(message.sentAt)}
                        </p>
                      </div>
                      <p
                        className={`mt-3 whitespace-pre-wrap break-words text-sm leading-7 ${message.isInbound ? "text-[color:var(--muted)]" : "text-[color:color-mix(in_oklab,var(--accent-foreground)_84%,transparent)]"}`}
                      >
                        {trimText(
                          displayText(formatInboxMessageBody(message.body)),
                          320,
                        )}
                      </p>
                      <Link
                        href={`/inbox/${activeThread.id}`}
                        className={`mt-3 inline-flex min-h-7 items-center rounded-lg px-1.5 text-xs font-medium underline-offset-4 hover:underline ${message.isInbound ? "text-[color:var(--accent)] hover:bg-[color:var(--surface-subtle)]" : "text-[color:var(--accent-foreground)] hover:bg-white/10"}`}
                      >
                        {english ? "Read full content" : "查看完整内容"}
                      </Link>
                    </div>
                  ))}
                </div>
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

        <div className="space-y-6">
          <Card className="workspace-accent-card">
            <CardHeader>
              <CardTitle className="workspace-accent-card-value">
                {english ? "Thread judgement" : "线程判断"}
              </CardTitle>
              <CardDescription className="workspace-accent-card-detail">
                {english
                  ? "Where this thread is blocked, the next move, and what happens if no one acts."
                  : "线程当前卡在哪、下一步动作、不动的代价。"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {analysis ? (
                <>
                  <AiLine
                    label={
                      english ? "Current thread judgement" : "当前线程状态判断"
                    }
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
                    label={english ? "Current blocker" : "当前卡点"}
                    value={
                      displayText(activeThread?.opportunity?.nextAction) ||
                      (analysis.waitingOn.includes("我方")
                        ? english
                          ? "The main blocker is that our side still has not given a clear reply or next step."
                          : "当前主要卡点是我方还没有明确回应或下一步。"
                        : english
                          ? "The main blocker is that the other side has not given a clear next-step signal yet."
                          : "当前主要卡点是对方尚未明确给出下一步信号。")
                    }
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
                  <AiLine
                    label={
                      english ? "If we keep not replying" : "如果继续不回复"
                    }
                    value={
                      analysis.shouldUpgrade ||
                      activeThread?.status === "WAITING_US"
                        ? english
                          ? "The thread will remain in waiting-on-us state and the other side’s perception of momentum will worsen."
                          : "线程会继续留在等待我方状态，对方对推进节奏的感知会变差。"
                        : english
                          ? "It is not urgent yet, but continued delay will make object judgement rely more and more on stale information."
                          : "当前还不急，但继续拖延会让对象判断越来越依赖旧信息。"
                    }
                  />
                </>
              ) : (
                <EmptyState
                  title={
                    english ? "Waiting for thread context" : "等待线程上下文"
                  }
                  description={
                    english
                      ? "Pick a thread on the left."
                      : "在左边挑一条线程。"
                  }
                />
              )}
            </CardContent>
          </Card>

          {activeThread ? (
            <Card>
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
                        <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">
                          {trimText(
                            displayText(activeThread.opportunity.nextAction),
                            64,
                          )}
                        </p>
                      </div>
                      <RiskBadge risk={activeThread.opportunity.riskLevel} />
                    </div>
	                    <p className="mt-3 text-xs text-[color:var(--muted-foreground)]">
	                      {english
	                        ? "This thread is already part of the opportunity asset and should be read with the next move."
	                        : "这条线程已经进入机会资产，应和下一步一起看。"}
	                    </p>
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
                    {english
                      ? "Add to an existing opportunity"
                      : "加入已有机会"}
                  </p>
                  <Select
                    value={opportunityId}
                    onValueChange={setOpportunityId}
                  >
                    <SelectTrigger
                      aria-label={
                        english
                          ? "Existing opportunity for this thread"
                          : "选择要加入的已有机会"
                      }
                    >
                      <SelectValue
                        placeholder={
                          english ? "Select opportunity" : "选择机会"
                        }
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
                        english
                          ? "Thread attached to opportunity"
                          : "线程已加入机会",
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
                    onValueChange={(value) =>
                      setReminder(value as typeof reminder)
                    }
                  >
                    <SelectTrigger
                      aria-label={english ? "Reminder time" : "提醒时间"}
                    >
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
                        () =>
                          setReminderFromThreadAction(
                            activeThread.id,
                            reminder,
                          ),
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
      </div>
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

function formatThreadStatus(
  status: InboxClientProps["threads"][number]["status"],
  english: boolean,
) {
  switch (status) {
    case "WAITING_US":
      return english ? "Waiting on us" : "待我方回复";
    case "WAITING_THEM":
      return english ? "Waiting on them" : "待对方回复";
    case "CLOSED":
      return english ? "Closed" : "已关闭";
    default:
      return english ? "Open" : "开放中";
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
      aria-label={label}
      onClick={onClick}
      className={`workspace-panel rounded-[24px] px-4 py-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:color-mix(in_oklab,var(--accent)_28%,transparent)] ${active ? "border-[color:var(--border-strong)] shadow-[0_18px_32px_-28px_rgba(25,70,80,0.45)]" : "hover:-translate-y-0.5 hover:border-[color:var(--border-strong)] hover:shadow-[0_18px_32px_-28px_rgba(15,23,42,0.3)]"}`}
    >
      <p className="text-sm text-[color:var(--muted-foreground)]">{label}</p>
      <p className="mt-3 text-3xl font-semibold text-[color:var(--foreground)]">{value}</p>
    </button>
  );
}
