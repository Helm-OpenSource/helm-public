import type { ReactNode } from "react";
import Link from "next/link";
import {
  AgentQueueCardCopyBlock,
  AgentQueueCardProgressSummary,
  AgentQueueCardResurfaceSummary,
  AgentQueueCardView,
} from "@/components/shared/agent-queue-card";
import {
  ActionRail,
  BoundaryNote,
  DecisionRequestCard,
  EvidenceChip,
  EvidenceDrawer,
  EvidenceSummaryCard,
  ReviewSnapshotBlock,
  WhyItMattersBlock,
  WorkerSummary,
} from "@/components/shared/narrative-components";
import {
  DetailOperatingSummaryCard,
  type DetailOperatingSummaryConnection,
} from "@/components/shared/detail-operating-summary-card";
import { EmptyState } from "@/components/shared/empty-state";
import { LazyDisclosure } from "@/components/shared/lazy-disclosure";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { buildBusinessLoopGapReadout } from "@/lib/presentation/business-loop-gap-readout";
import { getBusinessFirstSummaryLabels } from "@/lib/presentation/business-first-surface-contract";
import type { BusinessLoopGapSummary } from "@/lib/operating-system/operating-gap";
import { formatCustomerSuccessDisplayText } from "@/features/customer-success-handoff/display-copy";
import type {
  CustomerSuccessInboxSurfaceItem,
  CustomerSuccessQueueSurfaceItem,
  CustomerSuccessQueueSurfaceModel,
} from "@/features/customer-success-handoff/queue-model";
import type { PageNextAction, PageWorkerAssignment } from "@/lib/presentation/reporting-protocol";

const isDefined = <T,>(value: T | undefined): value is T => value !== undefined;

function displayText(value: string, english: boolean) {
  return formatCustomerSuccessDisplayText(value, english);
}

function displayItems(items: string[], english: boolean) {
  return items.map((item) => displayText(item, english));
}

function displayActions(actions: PageNextAction[], english: boolean) {
  return actions.map((action) => ({
    ...action,
    label: displayText(action.label, english),
  }));
}

function displayWorkerAssignments(
  assignments: PageWorkerAssignment[] | undefined,
  english: boolean,
) {
  return assignments?.map((assignment) => ({
    ...assignment,
    title: displayText(assignment.title, english),
    summary: displayText(assignment.summary, english),
    items: displayItems(assignment.items, english),
    chips: assignment.chips?.map((chip) => displayText(chip, english)),
  }));
}

export function CustomerSuccessQueueSurfaceView({
  model,
  english,
  businessLoopGapSummary,
}: {
  model: CustomerSuccessQueueSurfaceModel;
  english: boolean;
  businessLoopGapSummary: BusinessLoopGapSummary;
}) {
  const pageJudgement = model.protocol.pageJudgement;
  const pageJudgementReason = model.protocol.pageJudgementReason;
  const businessFirstLabels = getBusinessFirstSummaryLabels(english);
  const topQueueItem = model.queueItems[0];
  const topInboxItem = model.inboxItems[0];
  const businessLoopGapReadout = buildBusinessLoopGapReadout({
    english,
    businessLoopGapSummary,
    fallbackHref: "/operating",
  });
  const operatingSummaryItems = [
    {
      label: businessFirstLabels.objectState,
      value:
        topQueueItem?.title ??
        topInboxItem?.subject ??
        (model.protocol.pageEvidenceSummary[0] ?? pageJudgement),
    },
    {
      label: businessFirstLabels.blocker,
      value:
        businessLoopGapReadout.blocker ??
          topQueueItem?.stillBlockedLabel ??
            topQueueItem?.stillWaitingLabel ??
            topInboxItem?.stillBlockedLabel ??
            topInboxItem?.stillWaitingLabel ??
            pageJudgementReason,
    },
    {
      label: businessFirstLabels.pendingDecision,
      value: businessLoopGapReadout.pendingDecision ??
        model.protocol.pageDecisionRequest[0] ??
          topQueueItem?.decisionLabel ??
          pageJudgement,
    },
    {
      label: businessFirstLabels.nextAction,
      value:
        businessLoopGapReadout.nextAction ??
          model.protocol.pageNextAction[0]?.label ??
            topQueueItem?.nextActionLabel ??
            pageJudgement,
    },
  ].map((item) => ({
    ...item,
    value: displayText(item.value, english),
  }));
  const primaryHandoff =
    topQueueItem?.successCheckHref ??
    topQueueItem?.expansionReviewHref ??
    topInboxItem?.customerSuccessHref;
  const operatingSummaryConnectionCandidates: Array<
    DetailOperatingSummaryConnection | undefined
  > = [
    businessLoopGapReadout.connection,
    topQueueItem
      ? {
          label: english ? "Top queue object" : "当前队列对象",
          value: topQueueItem.title,
          description: `${topQueueItem.companyLabel} · ${topQueueItem.nextActionLabel}`,
          href: topQueueItem.href,
        }
      : undefined,
    primaryHandoff && topQueueItem
      ? {
          label: english ? "Review handoff" : "当前复核交接",
          value: topQueueItem.decisionLabel,
          description: `${topQueueItem.boundaryLabel} · ${topQueueItem.evidenceLabel}`,
          href: primaryHandoff,
        }
      : undefined,
    (topQueueItem?.inboxHref ?? topInboxItem?.href)
      ? {
          label: english ? "Inbox pressure" : "当前收件箱压力",
          value:
            topInboxItem?.subject ??
            (english ? "Open related inbox thread" : "打开相关收件箱线程"),
          description:
            topInboxItem?.judgementLabel ??
            topQueueItem?.stillWaitingLabel ??
            topQueueItem?.variantSummary ??
            pageJudgementReason,
          href: topQueueItem?.inboxHref ?? topInboxItem?.href ?? undefined,
        }
      : undefined,
    model.protocol.pageEvidenceLinks?.[0]
      ? {
          label: english ? "Source drilldown" : "来源下钻",
          value: model.protocol.pageEvidenceLinks[0].label,
          description:
            model.protocol.pageEvidenceSummary[0] ?? pageJudgementReason,
          href: model.protocol.pageEvidenceLinks[0].href,
        }
      : undefined,
  ];
  const operatingSummaryConnections =
    operatingSummaryConnectionCandidates.filter(isDefined).map((connection) => ({
      ...connection,
      label: displayText(connection.label, english),
      value: displayText(connection.value, english),
      description: displayText(connection.description, english),
    }));
  const displayChips = model.protocol.pagePrioritySignal
    ? [...model.chips, { label: model.protocol.pagePrioritySignal, tone: "amber" as const }]
    : model.chips;
  const visibleChips = displayChips.map((chip) => ({
    ...chip,
    label: displayText(chip.label, english),
  }));

  return (
    <div {...model.rootDataAttributes} className="space-y-6">
      <PageHeader
        eyebrow={displayText(model.eyebrow, english)}
        title={displayText(model.title, english)}
        description={displayText(model.description, english)}
      />

      <section className="theme-detail-shell overflow-hidden rounded-[30px]">
        <div className="px-5 py-5 xl:px-6 xl:py-6">
          <div data-page-layer="frontstage" className="space-y-5">
            <div data-frontstage-block="current-summary" className="space-y-5">
              <div className="flex flex-wrap gap-2">
                {visibleChips.map((chip) => (
                  <EvidenceChip
                    key={`${chip.label}-${chip.tone}`}
                    label={chip.label}
                    tone={chip.tone}
                  />
                ))}
              </div>

              <CustomerSuccessFrontSummary
                english={english}
                objectLabel={operatingSummaryItems[0]?.value ?? pageJudgement}
                blockerLabel={operatingSummaryItems[1]?.value ?? pageJudgementReason}
                decisionItems={displayItems(model.protocol.pageDecisionRequest, english)}
                actions={displayActions(model.protocol.pageNextAction, english)}
                companyLabel={
                  topQueueItem?.companyLabel ??
                  topInboxItem?.companyLabel ??
                  (english ? "Current account" : "当前客户")
                }
              />

              <details
                data-customer-success-supporting-context="true"
                className="rounded-[22px] border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-[color:var(--muted-foreground)]">
                  <span>{english ? "Connected objects and evidence" : "关联对象与依据"}</span>
                  <span className="text-lg leading-none">&quot;</span>
                </summary>
                <div className="mt-4">
                  <DetailOperatingSummaryCard
                    label={english ? "Current picture" : "当前局面摘要"}
                    items={operatingSummaryItems}
                    connectionsLabel={english ? "Connected chain" : "关联对象与推进链"}
                    connections={operatingSummaryConnections}
                  />
                </div>
              </details>
            </div>

            <div data-frontstage-block="decision-request">
              <details className="rounded-[22px] border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-[color:var(--muted-foreground)]">
                  <span>{english ? "All decision requests" : "全部待拍板项"}</span>
                  <span className="text-lg leading-none">&quot;</span>
                </summary>
                <div className="mt-4">
                  <DecisionRequestCard
                    label={english ? "Decision request" : "待拍板事项"}
                    items={displayItems(model.protocol.pageDecisionRequest, english)}
                  />
                </div>
              </details>
            </div>

            <div data-frontstage-block="next-action" className="space-y-5">
              <details className="rounded-[22px] border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-[color:var(--muted-foreground)]">
                  <span>{displayText(model.actionLabel, english)}</span>
                  <span className="text-lg leading-none">&quot;</span>
                </summary>
                <div className="mt-4">
                  <ActionRail
                    label={displayText(model.actionLabel, english)}
                    actions={displayActions(model.protocol.pageNextAction, english)}
                  />
                </div>
              </details>

              <QueueSection
                label={english ? "Customer success work queue" : "客户成功待处理事项"}
                items={model.queueItems}
                english={english}
              />

              <InboxSection
                label={english ? "Customer success related inbox" : "客户成功相关收件箱"}
                items={model.inboxItems}
                english={english}
              />

              <FastPathGrid
                english={english}
                immediateActions={model.immediateActions}
                decisionsWaiting={model.decisionsWaiting}
                blockersToClear={model.blockersToClear}
                actionTemplates={model.actionTemplates}
                retroFeedback={model.retroFeedback}
              />
            </div>

            <div data-frontstage-block="boundary">
              <BoundaryNote
                label={english ? "Boundary" : "边界"}
                items={displayItems(model.protocol.pageBoundarySummary, english)}
                escalationHint={
                  model.protocol.pageEscalationHint
                    ? displayText(model.protocol.pageEscalationHint, english)
                    : undefined
                }
              />
            </div>
          </div>
        </div>

        <div className="theme-detail-shell-footer px-5 py-5 xl:px-6">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
            <div data-page-layer="midstage" className="space-y-4">
              <SecondarySummaryCard
                label={english ? "Secondary summary" : "次级摘要"}
                items={model.secondarySummaryItems}
                english={english}
              />

              <ReviewSnapshotBlock
                label={english ? "Review snapshot" : "待复核结果快照"}
                items={displayItems(model.protocol.pageActionSummary, english)}
                english={english}
                reviewState={model.protocol.pageReviewState}
              />

              <WorkerSummary
                label={english ? "Coordination handoff" : "协作分工"}
                items={displayItems(model.protocol.pageWorkerSummary, english)}
                assignments={displayWorkerAssignments(model.protocol.pageWorkerAssignments, english)}
              />
            </div>

            <div data-page-layer="backstage" className="space-y-4">
              <WhyItMattersBlock
                label={english ? "Why this matters now" : "为什么现在需要处理"}
                reasons={displayItems(model.protocol.pageWhyItMatters, english)}
              />

              <EvidenceSummaryCard
                label={english ? "Evidence summary" : "证据摘要"}
                items={displayItems(model.protocol.pageEvidenceSummary, english)}
              />
            </div>
          </div>
        </div>

        <div className="border-t border-[color:var(--border)] px-5 py-5 xl:px-6">
          <div data-page-layer="evidence">
            <EvidenceDrawer
              marker="page"
              label={displayText(model.evidenceLabel, english)}
              summaryItems={displayItems(model.protocol.pageEvidenceSummary, english)}
              hideSummaryItems
              links={model.protocol.pageEvidenceLinks?.map((link) => ({
                ...link,
                label: displayText(link.label, english),
              }))}
              countLabel={displayText(model.evidenceCountLabel, english)}
              leadingChip={english ? "Appendix" : "附注层"}
            >
              <div className="grid gap-3">
                {model.evidenceGroups.map((group) => (
                  <div
                    key={group.groupId}
                    data-customer-success-queue-evidence-group={group.groupId}
                    className="theme-detail-shell-tile rounded-[20px] px-4 py-4"
                  >
                    <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                      {displayText(group.label, english)}
                    </p>
                    <div className="mt-3 space-y-2">
                      {group.items.map((item) => (
                        <p
                          key={`${group.groupId}-${item}`}
                          className="text-sm leading-7 text-[color:var(--dark-inset-foreground)]"
                        >
                          {displayText(item, english)}
                        </p>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </EvidenceDrawer>
          </div>
        </div>
      </section>
    </div>
  );
}

function CustomerSuccessFrontSummary({
  english,
  objectLabel,
  blockerLabel,
  decisionItems,
  actions,
  companyLabel,
}: {
  english: boolean;
  objectLabel: string;
  blockerLabel: string;
  decisionItems: string[];
  actions: PageNextAction[];
  companyLabel: string;
}) {
  const topDecision = decisionItems[0] ?? (english ? "Choose the next handoff owner." : "先判断谁接手。");
  const visibleActions = actions.slice(0, 3);

  return (
    <section
      className="rounded-[28px] border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-[0_18px_60px_-48px_rgba(15,23,42,0.45)]"
      data-customer-success-front-summary="true"
    >
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)_minmax(260px,0.78fr)]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--mode-link)]">
            {english ? "Now" : "现在接手"}
          </p>
          <h2 className="mt-3 text-2xl font-semibold leading-tight text-[color:var(--foreground)]">
            {objectLabel}
          </h2>
          <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
            {companyLabel}
          </p>
        </div>

        <div className="grid gap-3">
          <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3">
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
              {english ? "Blocked by" : "当前卡点"}
            </p>
            <p className="mt-2 text-sm font-semibold leading-6 text-[color:var(--foreground)]">
              {blockerLabel}
            </p>
          </div>
          <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3">
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
              {english ? "Decision" : "要你判断"}
            </p>
            <p className="mt-2 text-sm font-semibold leading-6 text-[color:var(--foreground)]">
              {topDecision}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3">
          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
            {english ? "Next" : "下一步"}
          </p>
          <div className="mt-3 grid gap-2">
            {visibleActions.map((action, index) => (
              <Link
                key={`${action.href}-${action.label}-${index}`}
                href={action.href}
                className={
                  index === 0
                    ? "theme-primary-action inline-flex min-h-10 items-center justify-center rounded-xl bg-[color:var(--accent)] px-3 text-sm font-semibold text-[color:var(--accent-foreground)]"
                    : "inline-flex min-h-10 items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-3 text-sm font-semibold text-[color:var(--foreground)]"
                }
              >
                {action.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FastPathGrid({
  english,
  immediateActions,
  decisionsWaiting,
  blockersToClear,
  actionTemplates,
  retroFeedback,
}: {
  english: boolean;
  immediateActions: Array<{ label: string; hint: string; href: string }>;
  decisionsWaiting: Array<{ label: string; hint: string; href: string }>;
  blockersToClear: Array<{ label: string; hint: string; href: string }>;
  actionTemplates: Array<{ label: string; hint: string; href: string }>;
  retroFeedback: Array<{ label: string; hint: string; href: string }>;
}) {
  const sections = [
    {
      label: english ? "Immediate actions" : "现在就能推进的动作",
      items: immediateActions,
    },
    {
      label: english ? "Decisions waiting" : "当前待拍板事项",
      items: decisionsWaiting,
    },
    {
      label: english ? "Blockers to clear" : "当前最该清掉的阻塞",
      items: blockersToClear,
    },
    {
      label: english ? "Common action templates" : "常用动作模板",
      items: actionTemplates,
    },
    {
      label: english
        ? "Write-back from review and follow-through"
        : "复盘与推进结果回写",
      items: retroFeedback,
    },
  ].filter((section) => section.items.length > 0);

  return (
    <section className="grid gap-3 xl:grid-cols-2">
      {sections.map((section) => (
        <div
          key={section.label}
          className="theme-detail-shell-tile rounded-[24px] px-4 py-4"
        >
          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
            {displayText(section.label, english)}
          </p>
          <div className="mt-3 space-y-3">
            {section.items.map((item, index) => (
              <Link
                key={`${section.label}-${item.href}-${item.label}-${index}`}
                href={item.href}
                aria-label={`${displayText(section.label, english)} ${index + 1}`}
                className="block rounded-[18px] border border-[color:var(--dark-inset-border)]/80 px-3 py-3 transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--dark-inset-bg)]/40"
              >
                <p className="text-sm font-medium text-[color:var(--muted-foreground)]">
                  {displayText(item.label, english)}
                </p>
                <p className="mt-1 text-xs leading-6 text-[color:var(--muted-foreground)]">
                  {displayText(item.hint, english)}
                </p>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function QueueSection({
  label,
  items,
  english,
}: {
  label: string;
  items: CustomerSuccessQueueSurfaceItem[];
  english: boolean;
}) {
  const visibleItems = items.slice(0, 3);
  const hiddenItems = items.slice(3);

  return (
    <section data-customer-success-queue-section="true" className="space-y-3">
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
        {label}
      </p>
      {items.length ? (
        <div className="grid gap-3">
          {visibleItems.map((item) => (
            <QueueItemCard key={item.id} item={item} english={english} />
          ))}
          {hiddenItems.length ? (
            <LazyDisclosure
              title={
                english
                  ? `Show ${hiddenItems.length} more customer lines`
                  : `展开余下 ${hiddenItems.length} 条客户线`
              }
            >
              <div className="grid gap-3">
                {hiddenItems.map((item) => (
                  <QueueItemCard key={item.id} item={item} english={english} />
                ))}
              </div>
            </LazyDisclosure>
          ) : null}
        </div>
      ) : (
        <EmptyState
          title={
            english
              ? "No active customer success queue items"
              : "当前没有需要客户成功接手的事项"
          }
          description={
            english
              ? "The derived queue stays empty until an opportunity, review request or follow-through route actually needs dedicated customer success ownership."
              : "只有当机会、复核请求或后续推进真的需要客户成功接手时，这里才会出现内容。"
          }
        />
      )}
    </section>
  );
}

function InboxSection({
  label,
  items,
  english,
}: {
  label: string;
  items: CustomerSuccessInboxSurfaceItem[];
  english: boolean;
}) {
  const visibleItems = items.slice(0, 3);
  const hiddenItems = items.slice(3);

  return (
    <section data-customer-success-inbox-section="true" className="space-y-3">
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
        {label}
      </p>
      {items.length ? (
        <div className="grid gap-3">
          {visibleItems.map((item) => (
            <InboxItemCard key={item.id} item={item} english={english} />
          ))}
          {hiddenItems.length ? (
            <LazyDisclosure
              title={
                english
                  ? `Show ${hiddenItems.length} more customer messages`
                  : `展开余下 ${hiddenItems.length} 条客户消息`
              }
            >
              <div className="grid gap-3">
                {hiddenItems.map((item) => (
                  <InboxItemCard key={item.id} item={item} english={english} />
                ))}
              </div>
            </LazyDisclosure>
          ) : null}
        </div>
      ) : (
        <EmptyState
          title={
            english
              ? "No linked success inbox threads"
              : "当前没有需要客户成功跟进的收件箱线程"
          }
          description={
            english
              ? "The derived success inbox stays empty until a linked thread actually needs customer success follow-through."
              : "只有当关联线程真的需要客户成功跟进时，这里才会出现内容。"
          }
        />
      )}
    </section>
  );
}

function QueueItemCard({
  item,
  english,
}: {
  item: CustomerSuccessQueueSurfaceItem;
  english: boolean;
}) {
  return (
    <CustomerSuccessOperationalCard
      item={item}
      english={english}
      title={item.title}
      subtitle={item.companyLabel}
      wrapperDataAttributes={{
        "data-customer-success-queue-item": item.id,
      }}
      footer={
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={item.href} aria-label={english ? "Open handoff" : "打开接手页"}>
              {english ? "Open handoff" : "打开接手页"}
            </Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href={item.successCheckHref} aria-label={english ? "Open success review" : "打开成功复盘"}>
              {english ? "Open success review" : "打开成功复盘"}
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href={item.expansionReviewHref} aria-label={english ? "Open expansion review" : "打开扩展机会复盘"}>
              {english ? "Open expansion review" : "打开扩展机会复盘"}
            </Link>
          </Button>
          {item.inboxHref ? (
            <Button variant="ghost" asChild>
              <Link href={item.inboxHref} aria-label={english ? "Open related inbox" : "打开相关收件箱"}>
                {english ? "Open related inbox" : "打开相关收件箱"}
              </Link>
            </Button>
          ) : null}
        </div>
      }
    />
  );
}

function InboxItemCard({
  item,
  english,
}: {
  item: CustomerSuccessInboxSurfaceItem;
  english: boolean;
}) {
  return (
    <CustomerSuccessOperationalCard
      item={item}
      english={english}
      title={item.subject}
      subtitle={`${item.counterpart} · ${item.companyLabel}`}
      wrapperDataAttributes={{
        "data-customer-success-inbox-item": item.id,
      }}
      footer={
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={item.href} aria-label={english ? "Open thread detail" : "打开线程详情"}>
              {english ? "Open thread detail" : "打开线程详情"}
            </Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href={item.customerSuccessHref} aria-label={english ? "Open customer success handoff" : "打开客户成功接手页"}>
              {english
                ? "Open customer success handoff"
                : "打开客户成功接手页"}
            </Link>
          </Button>
        </div>
      }
    />
  );
}

type OperationalSurfaceItem =
  | CustomerSuccessQueueSurfaceItem
  | CustomerSuccessInboxSurfaceItem;

function CustomerSuccessOperationalCard({
  item,
  english,
  title,
  subtitle,
  wrapperDataAttributes,
  footer,
}: {
  item: OperationalSurfaceItem;
  english: boolean;
  title: string;
  subtitle: string;
  wrapperDataAttributes: Record<string, string>;
  footer: ReactNode;
}) {
  return (
    <AgentQueueCardView
      wrapperDataAttributes={wrapperDataAttributes}
      title={displayText(title, english)}
      subtitle={displayText(subtitle, english)}
      stageBadge={displayText(item.stageLabel, english)}
      chips={buildOperationalStatusChips(item, english)}
      sections={
        <>
          <AgentQueueCardCopyBlock
            label={english ? "Current judgement" : "当前判断"}
            value={displayText(item.judgementLabel, english)}
          />
          {(item.stillBlockedLabel ?? item.policyBlockedLabel) ? (
            <AgentQueueCardCopyBlock
              label={english ? "What remains blocked" : "当前还被什么卡住"}
              value={displayText(
                item.stillBlockedLabel ?? item.policyBlockedLabel,
                english,
              )}
            />
          ) : null}
          <AgentQueueCardCopyBlock
            label={english ? "Next action" : "下一步"}
            value={displayText(item.nextActionLabel, english)}
          />
          <AgentQueueCardCopyBlock
            label={english ? "Boundary" : "边界"}
            value={displayText(item.boundaryLabel, english)}
          />
          <details
            data-customer-success-governance-evidence-disclosure="true"
            className="group rounded-[20px] border border-[color:var(--dark-inset-border)]/80 bg-[color:var(--dark-inset-bg)]/20 px-3 py-3"
          >
            <summary className="cursor-pointer text-sm font-medium text-[color:var(--dark-inset-foreground)] outline-none transition hover:text-white">
              {english ? "Governance evidence" : "治理证据"}
            </summary>
            <div className="mt-4 hidden space-y-3 group-open:block">
              <AgentQueueCardCopyBlock
                label={english ? "Authority" : "授权边界"}
                value={displayText(item.authorityLabel, english)}
              />
              <AgentQueueCardCopyBlock
                label={english ? "Attention" : "注意事项"}
                value={displayText(item.attentionLabel, english)}
              />
              <AgentQueueCardCopyBlock
                label={english ? "Variant cue" : "变体提示"}
                value={displayText(item.variantSummary, english)}
              />
              {item.subvariantSummary ? (
                <AgentQueueCardCopyBlock
                  label={english ? "Sub-variant cue" : "子变体提示"}
                  value={displayText(item.subvariantSummary, english)}
                />
              ) : null}
              <AgentQueueCardCopyBlock
                label={english ? "Advisory cue" : "建议提示"}
                value={displayText(item.advisoryPatternLabel, english)}
              />
              <AgentQueueCardCopyBlock
                label={english ? "Safe playbook" : "安全处理方式"}
                value={displayText(item.advisoryPlaybookLabel, english)}
              />
              <AgentQueueCardCopyBlock
                label={english ? "What stays available now" : "当前仍可做什么"}
                value={displayText(item.policySummaryLabel, english)}
              />
              <AgentQueueCardCopyBlock
                label={english ? "What remains blocked" : "当前还被什么卡住"}
                value={displayText(item.policyBlockedLabel, english)}
              />
              {item.externalDraftSummaryLabel ? (
                <AgentQueueCardCopyBlock
                  label={english ? "Prepared external draft" : "已准备对外草稿"}
                  value={displayText(item.externalDraftSummaryLabel, english)}
                />
              ) : null}
              {item.externalDraftPolicyLabel ? (
                <AgentQueueCardCopyBlock
                  label={english ? "Draft policy" : "草稿治理边界"}
                  value={displayText(item.externalDraftPolicyLabel, english)}
                />
              ) : null}
              {item.externalDraftBlockedLabel ? (
                <AgentQueueCardCopyBlock
                  label={english ? "Draft remains blocked by" : "草稿仍被什么卡住"}
                  value={displayText(item.externalDraftBlockedLabel, english)}
                />
              ) : null}
              {item.draftReviewSummaryLabel ? (
                <AgentQueueCardCopyBlock
                  label={english ? "Review outcome" : "复核结果"}
                  value={displayText(item.draftReviewSummaryLabel, english)}
                />
              ) : null}
              {item.draftSendHandoffLabel ? (
                <AgentQueueCardCopyBlock
                  label={english ? "Send handoff" : "发送交接"}
                  value={displayText(item.draftSendHandoffLabel, english)}
                />
              ) : null}
              {item.postSendOutcomeSummaryLabel ? (
                <AgentQueueCardCopyBlock
                  label={
                    english
                      ? "What happened after send handoff"
                      : "发送交接之后发生了什么"
                  }
                  value={displayText(item.postSendOutcomeSummaryLabel, english)}
                />
              ) : null}
              {item.postSendOutcomeBlockedLabel ? (
                <AgentQueueCardCopyBlock
                  label={english ? "What still remains unresolved" : "当前仍未解决的事项"}
                  value={displayText(item.postSendOutcomeBlockedLabel, english)}
                />
              ) : null}
              <AgentQueueCardResurfaceSummary
                sinceLastSeenLabel={english ? "Since last seen" : "自上次查看以来"}
                sinceLastSeenValue={displayText(item.sinceLastSeenLabel, english)}
                resurfacedBecauseLabel={
                  english ? "Why this is back now" : "为什么这条线又回到这里"
                }
                resurfacedBecauseValue={displayText(item.resurfacedBecauseLabel, english)}
                stillWaitingLabel={english ? "Still waiting on" : "仍在等待"}
                stillWaitingValue={
                  item.stillWaitingLabel
                    ? displayText(item.stillWaitingLabel, english)
                    : item.stillWaitingLabel
                }
                stillBlockedLabel={english ? "Still blocked by" : "仍被什么卡住"}
                stillBlockedValue={
                  item.stillBlockedLabel
                    ? displayText(item.stillBlockedLabel, english)
                    : item.stillBlockedLabel
                }
              />
              <AgentQueueCardCopyBlock
                label={english ? "Decision posture" : "拍板姿态"}
                value={displayText(item.decisionPostureLabel, english)}
              />
              <AgentQueueCardCopyBlock
                label={english ? "Decision request" : "待拍板事项"}
                value={displayText(item.decisionLabel, english)}
              />
              <AgentQueueCardCopyBlock
                label={english ? "Policy" : "治理边界"}
                value={displayText(
                  `${item.internalOnlyLabel} · ${item.externalSendDisabledLabel} · ${item.commitmentDisabledLabel}`,
                  english,
                )}
              />
              <AgentQueueCardCopyBlock
                label={english ? "Evidence summary" : "证据摘要"}
                value={displayText(item.evidenceLabel, english)}
              />
              <AgentQueueCardProgressSummary
                items={buildOperationalProgressItems(item, english)}
              />
            </div>
          </details>
        </>
      }
      metaItems={[
        {
          label: english ? "Owner" : "接手负责人",
          value: displayText(item.ownerLabel, english),
        },
        {
          label: english ? "Ownership pressure" : "接手压力",
          value: displayText(item.ownershipPressureLabel, english),
        },
        {
          label: english ? "Risk" : "风险",
          value: displayText(item.riskLabel, english),
        },
      ]}
      footer={footer}
    />
  );
}

function SecondarySummaryCard({
  label,
  items,
  english,
}: {
  label: string;
  items: Array<{ label: string; value: string }>;
  english: boolean;
}) {
  return (
    <section className="theme-detail-shell-card space-y-3 rounded-[26px] px-4 py-4">
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
        {label}
      </p>
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={`${item.label}-${item.value}`}
            className="theme-detail-shell-tile rounded-[18px] px-3 py-3"
          >
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
            {displayText(item.label, english)}
            </p>
            <p className="mt-2 text-sm leading-7 text-[color:var(--dark-inset-foreground)]">
              {displayText(item.value, english)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function buildOperationalStatusChips(
  item: OperationalSurfaceItem,
  english: boolean,
) {
  return (
    [
      {
        label: displayText(item.authorityLabel, english),
        tone:
          item.authorityState === "user-backed"
            ? "emerald"
            : item.authorityState === "user-reviewed"
              ? "violet"
              : "sky",
      },
      {
        label: displayText(item.attentionLabel, english),
        tone:
          item.attentionState === "blocked" ||
          item.attentionState === "review-before-send"
            ? "amber"
            : item.attentionState === "pushing"
              ? "emerald"
              : item.attentionState === "waiting"
                ? "violet"
                : "sky",
      },
      {
        label:
          item.variant === "escalation"
            ? english
              ? "Escalation"
              : "升级处理"
            : item.variant === "issue"
              ? english
                ? "Issue"
                : "问题"
              : english
                ? "Follow-through"
                : "后续推进",
        tone:
          item.variant === "escalation"
            ? "amber"
            : item.variant === "issue"
              ? "violet"
              : "emerald",
      },
      {
        label: displayText(item.readinessLabel, english),
        tone: item.readinessTone,
      },
      {
        label: displayText(item.advisoryCategoryLabel, english),
        tone:
          item.variant === "escalation"
            ? "amber"
            : item.attentionState === "review-before-send"
              ? "violet"
              : item.attentionState === "blocked"
                ? "amber"
                : "sky",
      },
      {
        label: displayText(item.policyModeLabel, english),
        tone: item.policyModeTone,
      },
      ...(item.approvalRequiredLabel
        ? [
            {
              label: displayText(item.approvalRequiredLabel, english),
              tone: "amber" as const,
            },
          ]
        : []),
      ...(item.internalActionStatusLabel && item.internalActionStatusTone
        ? [
            {
              label: displayText(item.internalActionStatusLabel, english),
              tone: item.internalActionStatusTone,
            },
          ]
        : []),
      ...(item.externalDraftStatusLabel && item.externalDraftStatusTone
        ? [
            {
              label: displayText(item.externalDraftStatusLabel, english),
              tone: item.externalDraftStatusTone,
            },
          ]
        : []),
      ...(item.draftReviewStatusLabel && item.draftReviewStatusTone
        ? [
            {
              label: displayText(item.draftReviewStatusLabel, english),
              tone: item.draftReviewStatusTone,
            },
          ]
        : []),
      ...(item.postSendOutcomeStatusLabel && item.postSendOutcomeStatusTone
        ? [
            {
              label: displayText(item.postSendOutcomeStatusLabel, english),
              tone: item.postSendOutcomeStatusTone,
            },
          ]
        : []),
    ] as Array<{
      label: string;
      tone: "sky" | "amber" | "violet" | "emerald";
    }>
  );
}

function buildOperationalProgressItems(
  item: OperationalSurfaceItem,
  english: boolean,
) {
  return [
    {
      label: english ? "Progress trace" : "进度轨迹",
      value: displayText(item.progressLabel, english),
    },
    ...(item.internalActionStatusLabel
      ? [
          {
            label: english ? "Internal action" : "内部动作",
            value: displayText(item.internalActionStatusLabel, english),
          },
        ]
      : []),
    ...(item.internalActionResultLabel
      ? [
          {
            label: english ? "Last internal result" : "最近一次内部结果",
            value: displayText(item.internalActionResultLabel, english),
          },
        ]
      : []),
  ];
}
