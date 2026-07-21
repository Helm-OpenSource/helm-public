import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  CircleAlert,
  Clock3,
  Lightbulb,
  ListChecks,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Target,
} from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { FirstLoopTrackedActionButton } from "@/components/shared/first-loop-tracked-action-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import type {
  DashboardHomeWorkEntryCard,
  DashboardHomeWorkEntryModel,
} from "@/features/dashboard/home-work-entry";

function getStateBadgeVariant(state: DashboardHomeWorkEntryModel["state"]) {
  switch (state) {
    case "empty-new":
      return "warning" as const;
    case "first-loop":
      return "info" as const;
    case "returning-active":
      return "success" as const;
    case "review-heavy":
      return "danger" as const;
  }
}

function getStateLabel(
  state: DashboardHomeWorkEntryModel["state"],
  english: boolean,
) {
  switch (state) {
    case "empty-new":
      return english ? "Waiting on your first call" : "等你开始第一笔";
    case "first-loop":
      return english ? "Closing the first loop" : "正在收的第一条闭环";
    case "returning-active":
      return english ? "Back in the push" : "继续当前推进";
    case "review-heavy":
      return english ? "Pending your call" : "等你拍板";
  }
}

function WorkCard({
  item,
  ctaVariant = "secondary",
  actionKind = "candidate",
}: {
  item: DashboardHomeWorkEntryCard;
  ctaVariant?: "default" | "secondary";
  actionKind?: "candidate" | "formal";
}) {
  const isFormal = actionKind === "formal";
  const buttonVariant: "default" | "secondary" = isFormal ? "default" : ctaVariant;
  const ActionIcon = isFormal ? Shield : Lightbulb;
  return (
    <div className="theme-surface-panel rounded-2xl px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-[color:var(--foreground)]">{item.title}</p>
        <Badge variant="info">{item.statusLabel}</Badge>
      </div>
      <p className="mt-2 text-xs font-medium text-[color:var(--muted-foreground)]">
        {item.subject}
      </p>
      <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">{item.nextStep}</p>
      {item.boundary ? (
        <div className="mt-3 flex gap-2 border-l-2 border-[color:var(--accent)] pl-3 text-sm leading-6 text-[color:var(--muted-foreground)]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--accent)]" />
          <p>{item.boundary}</p>
        </div>
      ) : null}
      <div className="mt-4">
        {item.tracking ? (
          <FirstLoopTrackedActionButton
            href={item.href}
            label={item.title}
            summary={item.nextStep}
            ctaLabel={item.ctaLabel}
            ariaLabel={`${item.ctaLabel}: ${item.title}`}
            sourceArea={item.tracking.sourceArea}
            eventKind={item.tracking.eventKind}
            stepId={item.tracking.stepId}
            variant={buttonVariant}
          />
        ) : (
          <Button asChild size="sm" variant={buttonVariant}>
            <Link
              href={item.href}
              aria-label={`${item.ctaLabel}: ${item.title}`}
            >
              <ActionIcon className="h-3.5 w-3.5" aria-hidden />
              {item.ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

function ActionRailItem({
  label,
  title,
  body,
  href,
  ctaLabel,
  icon,
  tracking,
  ctaVariant = "secondary",
}: {
  label: string;
  title: string;
  body: string;
  href: string;
  ctaLabel: string;
  icon: ReactNode;
  tracking?: DashboardHomeWorkEntryCard["tracking"];
  ctaVariant?: "default" | "secondary";
}) {
  return (
    <div className="theme-surface-panel flex min-h-[154px] flex-col justify-between rounded-[18px] px-3.5 py-3.5">
      <div className="min-w-0 space-y-3">
        <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
          {icon}
          <span>{label}</span>
        </div>
        <div className="min-w-0 space-y-2">
          <p className="break-words text-sm font-semibold leading-6 text-[color:var(--foreground)]">
            {title}
          </p>
          <p className="break-words text-sm leading-6 text-[color:var(--muted)]">
            {body}
          </p>
        </div>
      </div>
      <div className="mt-4">
        {tracking ? (
          <FirstLoopTrackedActionButton
            href={href}
            label={title}
            summary={body}
            ctaLabel={ctaLabel}
            ariaLabel={`${ctaLabel}: ${title}`}
            sourceArea={tracking.sourceArea}
            eventKind={tracking.eventKind}
            stepId={tracking.stepId}
            variant={ctaVariant}
          />
        ) : (
          <Button asChild size="sm" variant={ctaVariant}>
            <Link href={href} aria-label={`${ctaLabel}: ${title}`}>
              {ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

function WorkEntryActionRail({
  model,
  english,
}: {
  model: DashboardHomeWorkEntryModel;
  english: boolean;
}) {
  const primary = model.topWorkItems[0] ?? model.resumeItem;
  const review = model.reviewItems[0] ?? null;
  const reviewQueueHref = review ? "/approvals#approval-queue" : "/approvals";

  return (
    <nav
      aria-label={english ? "Current work quick actions" : "当前工作快速动作"}
      className={`grid gap-2.5 md:grid-cols-2 ${
        model.canReviewGovernedActions ? "xl:grid-cols-5" : "xl:grid-cols-4"
      }`}
      data-dashboard-work-entry-action-rail="true"
    >
      <ActionRailItem
        label={english ? "Move" : "推进"}
        title={primary.title}
        body={primary.nextStep}
        href={primary.href}
        ctaLabel={primary.ctaLabel}
        icon={<Target className="h-3.5 w-3.5" />}
        tracking={primary.tracking}
        ctaVariant="default"
      />
      {model.canReviewGovernedActions ? (
        <ActionRailItem
          label={english ? "Review" : "拍板"}
          title={
            review
              ? english
                ? `${model.reviewItems.length} actions waiting`
                : `${model.reviewItems.length} 个动作待审批`
              : english
                ? "Review queue is clear"
                : "复核队列已清"
          }
          body={
            review
              ? english
                ? `Start with ${review.title}.`
                : `先看：${review.title}。`
              : english
                ? "New customer-visible work will reappear here."
                : "新的客户可见动作会重新出现在这里。"
          }
          href={reviewQueueHref}
          ctaLabel={english ? "Open queue" : "查看队列"}
          icon={<ShieldAlert className="h-3.5 w-3.5" />}
        />
      ) : null}
      <ActionRailItem
        label={english ? "Signal" : "信号"}
        title={english ? "Add the work signal" : "上报信号"}
        body={
          english
            ? "When real work changes, add it from Ask Helm before the system guesses."
            : "真实工作里出现新情况时，从 Ask Helm 补进系统。"
        }
        href="/search?mode=ask#ask-helm-signal-intake"
        ctaLabel={english ? "Open Ask Helm" : "打开 Ask Helm"}
        icon={<CircleAlert className="h-3.5 w-3.5" />}
      />
      <ActionRailItem
        label={english ? "Source" : "来源"}
        title={english ? "Check source coverage" : "检查数据源状态"}
        body={
          english
            ? "If the answer is thin, check imports and connector state first."
            : "如果答案明显偏薄，先看导入和连接状态。"
        }
        href="/settings?tab=connectors"
        ctaLabel={english ? "Open sources" : "查看数据源"}
        icon={<ShieldCheck className="h-3.5 w-3.5" />}
      />
      <ActionRailItem
        label={english ? "Resume" : "继续入口"}
        title={model.resumeItem.title}
        body={model.resumeItem.nextStep}
        href={model.resumeItem.href}
        ctaLabel={model.resumeItem.ctaLabel}
        icon={<Clock3 className="h-3.5 w-3.5" />}
        tracking={model.resumeItem.tracking}
      />
    </nav>
  );
}

function ReviewQueueSummary({
  items,
  english,
}: {
  items: DashboardHomeWorkEntryCard[];
  english: boolean;
}) {
  const firstItem = items[0];

  return (
    <Card
      className="workspace-panel border-[color:var(--mode-card-border)]"
      data-dashboard-review-queue-summary="true"
    >
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
          <ListChecks className="h-3.5 w-3.5" />
          {english ? "Review queue" : "复核队列"}
        </div>
        <CardDescription>
          {english
            ? "Waiting on your review — clear the top one to unblock."
            : "在等你复核——处理掉最上面那条就能继续。"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="theme-surface-panel rounded-2xl px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="danger">
              {english ? `${items.length} waiting` : `${items.length} 个待复核`}
            </Badge>
            <Badge variant="warning">
              {english ? "Held at boundary" : "停在边界后"}
            </Badge>
          </div>
          <p className="mt-3 text-sm font-semibold leading-6 text-[color:var(--foreground)]">
            {firstItem
              ? english
                ? `Start with ${firstItem.title}`
                : `先处理：${firstItem.title}`
              : english
                ? "Review queue is clear"
                : "复核队列已清"}
          </p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
            {firstItem
              ? (firstItem.boundary ??
                (english
                  ? "Keep this work behind explicit review before it moves."
                  : "这类工作必须先留在明确复核之后再推进。"))
              : english
                ? "When review pressure returns, the queue summary will point back into approvals."
                : "当复核压力回来时，这里会重新指向审批工作面。"}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild size="sm" variant="secondary">
              <Link href={firstItem?.href ?? "/approvals"}>
                {english ? "Open first review" : "打开第一条复核"}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link href="/approvals">
                {english ? "Open approvals" : "打开复核与边界"}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>

        {items.slice(0, 3).map((item) => (
          <div
            key={`summary-${item.id}`}
            className="flex items-start justify-between gap-3 rounded-2xl border border-[color:var(--border)] bg-[color:var(--background-elevated)] px-4 py-3"
          >
            <div className="min-w-0">
              <p className="break-words text-sm font-medium leading-6 text-[color:var(--foreground)]">
                {item.title}
              </p>
              <p className="mt-1 break-words text-xs leading-5 text-[color:var(--muted-foreground)]">
                {item.subject}
              </p>
            </div>
            <Badge variant="info">{item.statusLabel}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function Block({
  title,
  description,
  icon,
  items,
  emptyTitle,
  emptyDescription,
  ctaVariant = "secondary",
  actionKind = "candidate",
}: {
  title: string;
  description: string;
  icon: ReactNode;
  items: DashboardHomeWorkEntryCard[];
  emptyTitle: string;
  emptyDescription: string;
  ctaVariant?: "default" | "secondary";
  actionKind?: "candidate" | "formal";
}) {
  return (
    <Card className="workspace-panel border-[color:var(--mode-card-border)]">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 text-xs font-medium text-[color:var(--mode-link)]">
          {icon}
          {title}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length ? (
          items.map((item, index) => (
            <WorkCard
              key={item.id}
              item={item}
              ctaVariant={index === 0 ? ctaVariant : "secondary"}
              actionKind={actionKind}
            />
          ))
        ) : (
          <EmptyState title={emptyTitle} description={emptyDescription} />
        )}
      </CardContent>
    </Card>
  );
}

export function DashboardHomeWorkEntrySurface({
  model,
  english,
}: {
  model: DashboardHomeWorkEntryModel;
  english: boolean;
}) {
  return (
    <Card
      className="workspace-shell-panel border-[color:var(--border-strong)]"
      data-dashboard-work-entry="true"
    >
      <CardContent className="space-y-5 py-5">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="warning">
              {english ? "Current work" : "当前工作"}
            </Badge>
            <Badge variant={getStateBadgeVariant(model.state)}>
              {getStateLabel(model.state, english)}
            </Badge>
          </div>
          <div className="space-y-2">
            <p className="text-lg font-semibold tracking-tight text-[color:var(--foreground)]">
              {model.title}
            </p>
            <p className="text-sm leading-7 text-[color:var(--muted)]">{model.summary}</p>
          </div>
        </div>

        <WorkEntryActionRail model={model} english={english} />

        <details
          className="group rounded-[24px] border border-[color:var(--border)] bg-[color:var(--background-elevated)]"
          data-dashboard-work-entry-supporting-context="true"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-[color:var(--foreground)]">
            <span>
              {english ? "Open ranked candidates and proof" : "展开候选项与依据"}
            </span>
            <span className="rounded-full border border-[color:var(--border)] px-2.5 py-1 text-xs text-[color:var(--muted-foreground)] transition group-open:bg-[color:var(--surface-subtle)]">
              {english ? "Details" : "详情"}
            </span>
          </summary>
          <div className="grid gap-4 px-3 pb-3 xl:grid-cols-[minmax(0,1.18fr)_minmax(0,0.82fr)]">
            <div className="space-y-4">
              <Block
                title={english ? "Top 1-3 work items" : "当前前三项工作"}
                description={
                  english
                    ? "Only keep the one to three items that should really get attention now."
                    : "先看现在最需要注意力的 1-3 件事。"
                }
                icon={<Target className="h-3.5 w-3.5" />}
                items={model.topWorkItems}
                emptyTitle={
                  english
                    ? "No ranked work item yet"
                    : "当前还没有排好序的工作事项"
                }
                emptyDescription={
                  english
                    ? "Once the workspace narrows role, signal and priority, the next work item will appear here."
                    : "当工作区把角色、信号和优先级收窄后，下一条工作事项会出现在这里。"
                }
                ctaVariant="default"
              />
              {!model.canReviewGovernedActions ? null : model.reviewItemsArePrimary ? (
                <ReviewQueueSummary items={model.reviewItems} english={english} />
              ) : (
                <Block
                  title={english ? "Needs your review" : "待你复核"}
                  description={
                    english
                      ? "Keep trust-sensitive and decision-heavy work visible on the home surface."
                      : "需要拍板或影响客户的事项先放在你眼前。"
                  }
                  icon={<ShieldAlert className="h-3.5 w-3.5" />}
                  items={model.reviewItems}
                  emptyTitle={
                    english ? "Review queue is clear" : "当前没有待你复核的事项"
                  }
                  emptyDescription={
                    english
                      ? "New customer-visible work will reappear here once review pressure returns."
                      : "新的客户可见动作一旦出现，会重新回到这里。"
                  }
                  ctaVariant="default"
                  actionKind="formal"
                />
              )}
            </div>

            <div className="space-y-4">
              {model.assignmentItems.length ? (
                <div id="employee-assignment-actions">
                  <Block
                    title={english ? "My pending action items" : "我的待推进事项"}
                    description={
                      english
                        ? "This batch's assignment summary is now condensed into your next-step candidates."
                        : "本批分案汇总已经收成你自己的下一步候选。"
                    }
                    icon={<ListChecks className="h-3.5 w-3.5" />}
                    items={model.assignmentItems}
                    emptyTitle={english ? "No pending action item" : "当前没有待推进事项"}
                    emptyDescription={
                      english
                        ? "Once external case-assignment summaries map to your account, they will appear here."
                        : "当外部分案汇总映射到你的账号后，会直接出现在这里。"
                    }
                  />
                </div>
              ) : null}
              <Block
                title={english ? "Resume / continue" : "继续推进"}
                description={
                  english
                    ? "Resume is for work recovery, not for feeds."
                    : "从上次停下的位置继续，不必重新浏览信息流。"
                }
                icon={<Clock3 className="h-3.5 w-3.5" />}
                items={[model.resumeItem]}
                emptyTitle={
                  english ? "No resume point yet" : "当前还没有恢复起点"
                }
                emptyDescription={
                  english
                    ? "Once a bounded next step or return anchor is visible, it will appear here."
                    : "一旦有边界的下一步或回访点成立，这里就会出现恢复入口。"
                }
              />
              <Block
                title={english ? "Light blocker summary" : "当前卡点"}
                description={
                  english
                    ? "Only keep blockers that change what the team should do next."
                    : "只显示会改变团队下一步动作的阻塞。"
                }
                icon={<CircleAlert className="h-3.5 w-3.5" />}
                items={model.blockerItems}
                emptyTitle={
                  english
                    ? "No blocker is outranking work now"
                    : "当前没有比主工作更高优先级的阻塞"
                }
                emptyDescription={
                  english
                    ? "If blocker pressure rises above the top work items, it will surface here."
                    : "如果阻塞压力超过当前主工作，它会出现在这里。"
                }
              />
            </div>
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
