import Link from "next/link";
import type { ReactNode } from "react";
import {
  AgentOptionalSummarySection,
  AgentProgressTraceSection,
  AgentResurfaceSection,
  AgentStatusChips,
  ActionRail,
  BoundaryNote,
  DecisionRequestCard,
  EvidenceDrawer,
  EvidenceSummaryCard,
  ReviewSnapshotBlock,
  WhyItMattersBlock,
  WorkerSummary,
} from "@/components/shared/narrative-components";
import { PageHeader } from "@/components/shared/page-header";
import { UnifiedDetailNavigationPanel } from "@/components/shared/unified-detail-navigation-panel";
import type { AgentSurfaceSections } from "@/lib/presentation/agent-primitives";
import type { PageReportingProtocol } from "@/lib/presentation/reporting-protocol";
import type { UnifiedDetailNavigationModel } from "@/lib/presentation/unified-detail-navigation";
import { trimText } from "@/lib/utils";
import {
  formatRoleDetailDisplayItems,
  formatRoleDetailDisplayText,
} from "@/lib/presentation/role-detail-display-copy";

type EvidenceGroup = {
  groupId: string;
  label: string;
  items: string[];
};

type Chip = {
  label: string;
  tone: "sky" | "violet" | "amber" | "emerald";
};

type SecondarySummaryItem = {
  label: string;
  value: string;
};

type OperatingSummaryItem = {
  label: string;
  value: string;
};

type OperatingSummaryConnection = {
  label: string;
  value: string;
  description: string;
  href?: string;
};

function getRoleOperatingSummaryConnectionDescription(
  connection: OperatingSummaryConnection,
) {
  const description = connection.description.trim();

  return description && description !== connection.value.trim()
    ? description
    : null;
}

function getRoleOperatingSummaryConnectionAriaLabel(
  connection: OperatingSummaryConnection,
) {
  const compactValue = trimText(connection.value, 44);

  return [connection.label, compactValue]
    .filter(Boolean)
    .join("：");
}

export type RoleConversationDetailShellProps = AgentSurfaceSections & {
  rootDataAttributes: Record<string, string | undefined>;
  english: boolean;
  eyebrow: string;
  title: string;
  description: string;
  actions: ReactNode;
  briefingLabel: string;
  navigation: UnifiedDetailNavigationModel;
  protocol: PageReportingProtocol;
  chips: Chip[];
  operatingSummaryLabel?: string;
  operatingSummaryItems?: OperatingSummaryItem[];
  operatingSummaryConnectionsLabel?: string;
  operatingSummaryConnections?: OperatingSummaryConnection[];
  secondarySummaryItems: SecondarySummaryItem[];
  advisoryLabel?: string;
  advisoryItems?: string[];
  actionSummaryLabel?: string;
  decisionRequestLabel?: string;
  decisionLabel?: string;
  decisionItems?: string[];
  boundaryLabel: string;
  evidenceSummaryLabel?: string;
  firstScreenEvidenceItems?: string[];
  actionLabel: string;
  actionExecutionPanel?: ReactNode;
  draftsPanel?: ReactNode;
  evidenceLabel: string;
  evidenceCountLabel: string;
  evidenceGroups: EvidenceGroup[];
  stageBadge: string;
};

export function RoleConversationDetailShell({
  rootDataAttributes,
  english,
  eyebrow,
  title,
  description,
  actions,
  briefingLabel,
  navigation,
  protocol,
  chips,
  operatingSummaryLabel,
  operatingSummaryItems,
  operatingSummaryConnectionsLabel,
  operatingSummaryConnections,
  secondarySummaryItems,
  recentChangesLabel,
  recentChangesItems,
  resurfaceReasonLabel,
  resurfaceReasonItems,
  advisoryLabel,
  advisoryItems,
  policyLabel,
  policyItems,
  actionSummaryLabel,
  decisionRequestLabel,
  decisionLabel,
  decisionItems,
  boundaryLabel,
  evidenceSummaryLabel,
  firstScreenEvidenceItems,
  actionLabel,
  actionExecutionPanel,
  draftsPanel,
  progressTraceLabel,
  progressTraceItems,
  evidenceLabel,
  evidenceCountLabel,
  evidenceGroups,
  stageBadge,
}: RoleConversationDetailShellProps) {
  const text = (value: string | null | undefined) =>
    formatRoleDetailDisplayText(value, english);
  const textItems = (values: string[]) =>
    formatRoleDetailDisplayItems(values, english);
  const displayProtocol: PageReportingProtocol = {
    ...protocol,
    pageJudgement: text(protocol.pageJudgement),
    pageJudgementReason: text(protocol.pageJudgementReason),
    pageActionSummary: textItems(protocol.pageActionSummary),
    pageDecisionRequest: textItems(protocol.pageDecisionRequest),
    pageBoundarySummary: textItems(protocol.pageBoundarySummary),
    pageEvidenceSummary: textItems(protocol.pageEvidenceSummary),
    pageWorkerSummary: textItems(protocol.pageWorkerSummary),
    pageWhyItMatters: textItems(protocol.pageWhyItMatters),
    pageEscalationHint: protocol.pageEscalationHint
      ? text(protocol.pageEscalationHint)
      : protocol.pageEscalationHint,
    pagePrioritySignal: protocol.pagePrioritySignal
      ? text(protocol.pagePrioritySignal)
      : protocol.pagePrioritySignal,
    pageNextAction: protocol.pageNextAction.map((action) => ({
      ...action,
      label: text(action.label),
    })),
    pageEvidenceLinks: protocol.pageEvidenceLinks?.map((link) => ({
      ...link,
      label: text(link.label),
    })),
  };
  const displayChips = dedupeChips(
    displayProtocol.pagePrioritySignal
      ? [...chips, { label: displayProtocol.pagePrioritySignal, tone: "amber" as const }]
      : chips,
  ).map((chip) => ({ ...chip, label: text(chip.label) }));
  const displaySecondarySummaryItems = secondarySummaryItems.map((item) => ({
    label: text(item.label),
    value: text(item.value),
  }));
  const displayEvidenceGroups = evidenceGroups.map((group) => ({
    ...group,
    label: text(group.label),
    items: textItems(group.items),
  }));
  const displayOperatingSummaryItems =
    operatingSummaryItems?.length
      ? operatingSummaryItems.map((item) => ({
          label: text(item.label),
          value: text(item.value),
        }))
      : buildOperatingSummaryItems(english, {
          pageJudgement: displayProtocol.pageJudgement,
          pageJudgementReason: displayProtocol.pageJudgementReason,
          pageActionSummary: displayProtocol.pageActionSummary,
          pageNextAction: displayProtocol.pageNextAction,
          pageDecisionRequest: displayProtocol.pageDecisionRequest,
          pageBoundarySummary: displayProtocol.pageBoundarySummary,
          pageEvidenceSummary: displayProtocol.pageEvidenceSummary,
          pageWorkerSummary: displayProtocol.pageWorkerSummary,
        });
  const sourceOperatingSummaryConnections =
    operatingSummaryConnections?.length
      ? operatingSummaryConnections
      : buildOperatingSummaryConnections(english, navigation, {
          pageNextAction: displayProtocol.pageNextAction,
          pageEvidenceSummary: displayProtocol.pageEvidenceSummary,
          pageEvidenceLinks: displayProtocol.pageEvidenceLinks,
          pageJudgementReason: displayProtocol.pageJudgementReason,
        });
  const displayOperatingSummaryConnections = sourceOperatingSummaryConnections.map(
    (connection) => ({
      ...connection,
      label: text(connection.label),
      value: text(connection.value),
      description: text(connection.description),
    }),
  );

  return (
    <div {...rootDataAttributes} className="space-y-6">
      <PageHeader
        eyebrow={text(eyebrow)}
        title={text(title)}
        description={text(description)}
        actions={actions}
        briefing={{
          label: text(briefingLabel),
          headline: displayProtocol.pageJudgement,
          summary: displayProtocol.pageJudgementReason,
        }}
      />

      <UnifiedDetailNavigationPanel navigation={navigation} english={english} />

      <section className="theme-detail-shell overflow-hidden rounded-[30px]">
        <div className="grid gap-6 px-5 py-5 xl:grid-cols-[minmax(0,1.18fr)_320px] xl:px-6 xl:py-6">
          <div data-page-layer="frontstage" className="space-y-5">
            <AgentStatusChips chips={displayChips} stageBadge={text(stageBadge)} />

            {displayOperatingSummaryItems.length ? (
              <div data-frontstage-block="current-summary">
                <OperatingSummaryCard
                  label={
                    text(operatingSummaryLabel) ||
                    (english ? "Current operating summary" : "当前局面摘要")
                  }
                  items={displayOperatingSummaryItems}
                  connectionsLabel={
                    text(operatingSummaryConnectionsLabel) ||
                    (english ? "Connected context" : "相关上下文")
                  }
                  connections={displayOperatingSummaryConnections}
                />
              </div>
            ) : null}

            <div data-frontstage-block="decision-request">
              <DecisionRequestCard
                label={
                  text(decisionRequestLabel) ||
                  (english ? "Pending decision" : "待决策")
                }
                items={displayProtocol.pageDecisionRequest}
              />
            </div>

            <div data-frontstage-block="next-action" className="space-y-5">
              <ActionRail label={text(actionLabel)} actions={displayProtocol.pageNextAction} />

              {actionExecutionPanel}

              {draftsPanel}
            </div>

            <div data-frontstage-block="boundary">
              <BoundaryNote
                label={text(boundaryLabel)}
                items={displayProtocol.pageBoundarySummary}
                escalationHint={displayProtocol.pageEscalationHint}
              />
            </div>
          </div>

          <div data-page-layer="midstage" className="space-y-4">
            <SecondarySummaryCard
              label={english ? "Secondary summary" : "补充信息"}
              items={displaySecondarySummaryItems}
            />

            <AgentResurfaceSection
              english={english}
              recentChangesLabel={recentChangesLabel ? text(recentChangesLabel) : recentChangesLabel}
              recentChangesItems={recentChangesItems ? textItems(recentChangesItems) : recentChangesItems}
              resurfaceReasonLabel={resurfaceReasonLabel ? text(resurfaceReasonLabel) : resurfaceReasonLabel}
              resurfaceReasonItems={resurfaceReasonItems ? textItems(resurfaceReasonItems) : resurfaceReasonItems}
            />

            <AgentOptionalSummarySection
              label={
                (advisoryLabel ? text(advisoryLabel) : advisoryLabel) ??
                (english ? "Current considerations" : "当前补充判断")
              }
              items={advisoryItems ? textItems(advisoryItems) : advisoryItems}
            />

            <AgentOptionalSummarySection
              label={
                (policyLabel ? text(policyLabel) : policyLabel) ??
                (english ? "Current handling posture" : "当前处理口径")
              }
              items={policyItems ? textItems(policyItems) : policyItems}
            />

            <AgentOptionalSummarySection
              label={
                (decisionLabel ? text(decisionLabel) : decisionLabel) ??
                (english ? "Secondary decision framing" : "次级判断框架")
              }
              items={decisionItems ? textItems(decisionItems) : decisionItems}
            />

            <ReviewSnapshotBlock
              label={
                (actionSummaryLabel ? text(actionSummaryLabel) : actionSummaryLabel) ??
                (english ? "Review snapshot" : "待复核结果")
              }
              items={displayProtocol.pageActionSummary}
              english={english}
              reviewState={displayProtocol.pageReviewState}
            />
          </div>
        </div>

        <div className="theme-detail-shell-footer px-5 py-5 xl:px-6">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
            <div data-page-layer="backstage">
              <div className="space-y-5">
                <WhyItMattersBlock
                  label={english ? "Why this needs attention" : "为什么现在要注意"}
                  reasons={displayProtocol.pageWhyItMatters}
                />

                {firstScreenEvidenceItems?.length ? (
                  <EvidenceSummaryCard
                    label={
                      (evidenceSummaryLabel ? text(evidenceSummaryLabel) : evidenceSummaryLabel) ??
                      (english ? "Evidence summary" : "证据摘要")
                    }
                    items={textItems(firstScreenEvidenceItems)}
                  />
                ) : null}

                <WorkerSummary
                  label={english ? "Coordination handoff" : "协作分工"}
                  items={displayProtocol.pageWorkerSummary}
                />

                <AgentProgressTraceSection
                  english={english}
                  label={progressTraceLabel ? text(progressTraceLabel) : progressTraceLabel}
                  items={progressTraceItems ? textItems(progressTraceItems) : progressTraceItems}
                />
              </div>
            </div>

            <div data-page-layer="evidence">
              <EvidenceDrawer
                marker="page"
                label={text(evidenceLabel)}
                summaryItems={displayProtocol.pageEvidenceSummary}
                hideSummaryItems={Boolean(firstScreenEvidenceItems?.length)}
                links={displayProtocol.pageEvidenceLinks}
                countLabel={text(evidenceCountLabel)}
                leadingChip={english ? "Appendix" : "附注层"}
              >
                <div className="grid gap-3">
                  {displayEvidenceGroups.map((group) => (
                    <div
                      key={group.groupId}
                      data-role-conversation-evidence-group={group.groupId}
                      className="theme-detail-shell-tile rounded-[20px] px-4 py-4"
                    >
                      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                        {group.label}
                      </p>
                      <div className="mt-3 space-y-2">
                        {group.items.map((item) => (
                          <p
                            key={`${group.groupId}-${item}`}
                            className="text-sm leading-7 text-[color:var(--dark-inset-foreground)]"
                          >
                            {item}
                          </p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </EvidenceDrawer>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function dedupeChips(chips: Chip[]) {
  const seen = new Set<string>();
  const result: Chip[] = [];

  for (const chip of chips) {
    const token = `${chip.label}::${chip.tone}`;
    if (seen.has(token)) {
      continue;
    }
    seen.add(token);
    result.push(chip);
  }

  return result;
}

function SecondarySummaryCard({
  label,
  items,
}: {
  label: string;
  items: SecondarySummaryItem[];
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
              {item.label}
            </p>
            <p className="mt-2 text-sm leading-7 text-[color:var(--dark-inset-foreground)]">
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function OperatingSummaryCard({
  label,
  items,
  connectionsLabel,
  connections,
}: {
  label: string;
  items: OperatingSummaryItem[];
  connectionsLabel?: string;
  connections?: OperatingSummaryConnection[];
}) {
  return (
    <section
      data-role-conversation-operating-summary="true"
      className="theme-detail-shell-card space-y-3 rounded-[26px] px-4 py-4"
    >
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
        {label}
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((item) => (
          <div
            key={`${item.label}-${item.value}`}
            className="theme-detail-shell-tile rounded-[18px] px-3 py-3"
          >
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
              {item.label}
            </p>
            <p className="mt-2 text-sm leading-7 text-[color:var(--dark-inset-foreground)]">{item.value}</p>
          </div>
        ))}
      </div>
      {connections?.length ? (
        <div className="space-y-3">
          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
            {connectionsLabel}
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            {connections.map((connection) => {
              const connectionDescription =
                getRoleOperatingSummaryConnectionDescription(connection);
              const content = (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                    {connection.label}
                  </p>
                  <p className="text-sm font-medium leading-7 text-[color:var(--dark-inset-foreground)]">
                    {connection.value}
                  </p>
                  {connectionDescription ? (
                    <p className="text-xs leading-6 text-[color:var(--muted-foreground)]">
                      {connectionDescription}
                    </p>
                  ) : null}
                </div>
              );

              if (connection.href) {
                return (
                  <Link
                    key={`${connection.label}-${connection.value}`}
                    href={connection.href}
                    aria-label={getRoleOperatingSummaryConnectionAriaLabel(
                      connection,
                    )}
                    className="theme-detail-shell-tile rounded-[18px] px-3 py-3 transition hover:border-[color:rgba(148,163,184,0.34)] hover:bg-[color:rgba(15,23,42,0.86)]"
                  >
                    {content}
                  </Link>
                );
              }

              return (
                <div
                  key={`${connection.label}-${connection.value}`}
                  className="theme-detail-shell-tile rounded-[18px] px-3 py-3"
                >
                  {content}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function buildOperatingSummaryItems(
  english: boolean,
  protocol: Pick<
    PageReportingProtocol,
    | "pageJudgement"
    | "pageJudgementReason"
    | "pageActionSummary"
    | "pageNextAction"
    | "pageDecisionRequest"
    | "pageBoundarySummary"
    | "pageEvidenceSummary"
    | "pageWorkerSummary"
  >,
): OperatingSummaryItem[] {
  const {
    pageActionSummary,
    pageJudgement,
    pageJudgementReason,
    pageNextAction,
    pageDecisionRequest,
    pageBoundarySummary,
    pageEvidenceSummary,
    pageWorkerSummary,
  } = protocol;

  return [
    {
      label: english ? "Current focus" : "当前处理焦点",
      value: trimText(pageActionSummary[0] ?? pageJudgementReason, 110),
    },
    {
      label: english ? "Single next step" : "最重要下一步",
      value: trimText(
        pageNextAction[0]?.label ?? pageDecisionRequest[0] ?? pageJudgement,
        96,
      ),
    },
    {
      label: english ? "Current boundary" : "当前边界",
      value: trimText(pageBoundarySummary[0] ?? pageJudgementReason, 110),
    },
    {
      label: english ? "Source context" : "支撑依据",
      value: trimText(
        pageEvidenceSummary[0] ??
          pageWorkerSummary[0] ??
          pageJudgementReason,
        110,
      ),
    },
  ];
}

function buildOperatingSummaryConnections(
  english: boolean,
  navigation: UnifiedDetailNavigationModel,
  protocol: Pick<
    PageReportingProtocol,
    "pageNextAction" | "pageEvidenceSummary" | "pageEvidenceLinks" | "pageJudgementReason"
  >,
): OperatingSummaryConnection[] {
  const { pageEvidenceLinks, pageEvidenceSummary, pageJudgementReason, pageNextAction } =
    protocol;
  const previousDetail = navigation.currentNode.detailNodePrev;
  const nextDetail = navigation.currentNode.detailNodeNext;
  const handoff = navigation.handoffs[0];
  const evidenceLink = pageEvidenceLinks?.[0];
  const primaryNextAction = pageNextAction[0];
  const nextActionDescription =
    handoff?.handoffNextAction?.trim() &&
    handoff.handoffNextAction.trim() !== primaryNextAction?.label.trim()
      ? handoff.handoffNextAction
      : pageJudgementReason;

  const connections: Array<OperatingSummaryConnection | undefined> = [
    previousDetail
      ? {
          label: english ? "Previous context" : "上一步上下文",
          value: previousDetail.label,
          description: trimText(previousDetail.summary, 88),
          href: previousDetail.href,
        }
      : undefined,
    handoff
      ? {
          label: english ? "Current handoff" : "当前交接说明",
          value: trimText(handoff.handoffDecisionRequest, 72),
          description: trimText(
            `${handoff.handoffReason} ${handoff.handoffBoundary}`,
            110,
          ),
          href: handoff.handoffHref,
        }
      : nextDetail
        ? {
            label: english ? "Next context" : "下一步上下文",
            value: nextDetail.label,
            description: trimText(nextDetail.summary, 88),
            href: nextDetail.href,
          }
        : undefined,
    primaryNextAction
      ? {
          label: english ? "Next action" : "下一步动作",
          value: primaryNextAction.label,
          description: trimText(nextActionDescription, 96),
          href: primaryNextAction.href,
        }
      : undefined,
    evidenceLink
      ? {
          label: english ? "Open supporting context" : "查看依据",
          value: evidenceLink.label,
          description: trimText(pageEvidenceSummary[0] ?? pageJudgementReason, 96),
          href: evidenceLink.href,
        }
      : undefined,
  ];

  return connections.filter(
    (item): item is OperatingSummaryConnection => Boolean(item),
  );
}
