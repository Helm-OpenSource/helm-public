import Link from "next/link";
import {
  ActionRail,
  BoundaryNote,
  CollaborationRequestCard,
  DecisionRequestCard,
  EvidenceChip,
  EvidenceDrawer,
  ReviewSnapshotBlock,
  WhyItMattersBlock,
  WorkerSummary,
} from "@/components/shared/narrative-components";
import {
  buildDetailOperatingSummaryConnections,
  buildObjectContextDetailOperatingSummaryItems,
  DetailOperatingSummaryCard,
} from "@/components/shared/detail-operating-summary-card";
import { PageHeader } from "@/components/shared/page-header";
import { UnifiedDetailNavigationPanel } from "@/components/shared/unified-detail-navigation-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  formatRoleDetailDisplayText,
  formatRoleDetailEvidenceGroups,
  formatRoleDetailPageProtocol,
} from "@/lib/presentation/role-detail-display-copy";
import type {
  PackagePageDetailReportingContract,
  ProposalPageDetailReportingContract,
  ProposalPackageAudienceMode,
  ProposalPackageEvidenceGroup,
  ProposalPackageRiskSignal,
} from "@/lib/presentation/proposal-package-detail-contract";
import {
  toPackagePageReportingProtocol,
  toProposalPageReportingProtocol,
} from "@/lib/presentation/proposal-package-detail-contract";
import { createUnifiedDetailNavigationModel } from "@/lib/presentation/unified-detail-navigation";
import { formatDateLabel } from "@/lib/utils";

export type ProposalPackageCommercialDetail = {
  id: string;
  title: string;
  stageCode: string;
  stageLabel: string;
  riskLabel: string;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  companyName: string | null;
  contactNames: string[];
  ownerName: string | null;
  dueDate: Date | null;
  updatedAt: Date;
  nextAction: string | null;
  memoryFacts: Array<{ id: string; title: string; content: string; updatedAt: Date }>;
  memoryEntries: Array<{ id: string; title: string; content: string; createdAt: Date }>;
  commitments: Array<{ id: string; title: string; commitmentText: string; overdueFlag: boolean; status: string; dueDate: Date | null }>;
  blockers: Array<{ id: string; title: string; blockerText: string; severity: number; status: string; updatedAt: Date }>;
  actionItems: Array<{ id: string; title: string; status: string; dueDate: Date | null; approvalTask: { id: string; status: string } | null }>;
  auditLogs: Array<{ id: string; actor: string; summary: string; createdAt: Date }>;
  briefingSnapshot: { payload: { summary?: string; recommendedNextSteps?: string[] } } | null;
};

type ProposalPageProps = {
  mode: "proposal";
  detail: ProposalPackageCommercialDetail;
  english: boolean;
  contract: ProposalPageDetailReportingContract;
};

type PackagePageProps = {
  mode: "package";
  detail: ProposalPackageCommercialDetail;
  english: boolean;
  contract: PackagePageDetailReportingContract;
};

export function ProposalPackageDetailView(
  props: ProposalPageProps | PackagePageProps,
) {
  const { detail, english, mode } = props;
  const sourceProtocol =
    mode === "proposal"
      ? toProposalPageReportingProtocol(props.contract)
      : toPackagePageReportingProtocol(props.contract);
  const text = (value: string) => formatRoleDetailDisplayText(value, english);
  const protocol = formatRoleDetailPageProtocol(sourceProtocol, english);
  const title =
    mode === "proposal"
      ? english
        ? `${detail.title} proposal detail`
        : `${detail.title} 提案详情页`
      : english
        ? `${detail.title} package detail`
        : `${detail.title} 方案包详情页`;
  const audienceMode = formatAudienceMode(
    mode === "proposal"
      ? props.contract.proposalPageAudienceMode
      : props.contract.packagePageAudienceMode,
    english,
  );
  const displayAudienceMode = text(audienceMode);
  const riskSignal =
    mode === "proposal"
      ? props.contract.proposalPageRiskSignal
      : props.contract.packagePageRiskSignal;
  const navigation = buildUnifiedNavigation({
    mode,
    detail,
    english,
    protocol,
    audienceMode: displayAudienceMode,
    riskSignal,
  });
  const operatingSummaryItems = buildObjectContextDetailOperatingSummaryItems({
    english,
    protocol,
    objectStateLine: text(`${detail.stageLabel} · ${detail.riskLabel} · ${displayAudienceMode}`),
  });
  const operatingSummaryConnections = buildDetailOperatingSummaryConnections({
    english,
    navigation,
    protocol,
  }).map((connection) => ({
    ...connection,
    label: text(connection.label),
    value: text(connection.value),
    description: text(connection.description),
  }));
  const groups = formatRoleDetailEvidenceGroups(evidenceGroups(mode, props), english);

  return (
    <div
      data-proposal-package-page="true"
      data-proposal-page={mode === "proposal" ? "true" : undefined}
      data-package-page={mode === "package" ? "true" : undefined}
      className="space-y-6"
    >
      <PageHeader
        eyebrow={
          text(
            mode === "proposal"
              ? english
                ? "Commercial / Proposal detail"
                : "商业推进 / 提案详情"
              : english
                ? "Commercial / Package detail"
                : "商业推进 / 方案包详情",
          )
        }
        title={text(title)}
        description={
          text(
            english
              ? `${detail.companyName ?? "No linked company"} · ${detail.contactNames[0] ?? "No linked contact"} · ${displayAudienceMode}`
              : `${detail.companyName ?? "未关联公司"} · ${detail.contactNames[0] ?? "未关联联系人"} · ${displayAudienceMode}`,
          )
        }
        actions={
          <>
            <Button asChild>
              <Link href={`/opportunities?opportunityId=${detail.id}`}>
                {text(english ? "Open opportunity" : "打开机会页")}
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link
                href={
                  mode === "proposal"
                    ? `/offers/${detail.id}`
                    : `/external-proposals/${detail.id}`
                }
              >
                {mode === "proposal"
                  ? english
                    ? "Open customer offer page"
                    : text("打开客户面向报价页面")
                  : english
                    ? "Open external proposal page"
                    : text("打开对外提案页面")}
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href={`/package-variants/${detail.id}`}>
                {text(
                  english
                    ? "Open package variants page"
                    : "打开方案包变体页面",
                )}
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href={`/package-stage-variants/${detail.id}`}>
                {text(
                  english
                    ? "Open package stage page"
                    : "打开方案阶段页面",
                )}
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href={`/conversations/${detail.id}`}>
                {text(english ? "Open conversation page" : "打开对话页面")}
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href="/approvals">
                {text(english ? "Open approvals" : "打开审批中心")}
              </Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href={`/memory?objectType=OPPORTUNITY&objectId=${detail.id}`}>
                {text(english ? "Open evidence" : "查看依据")}
              </Link>
            </Button>
          </>
        }
        briefing={{
          label:
            mode === "proposal"
              ? english
                ? "Proposal judgement"
                : text("提案判断")
              : english
                ? "Package judgement"
                : text("方案包判断"),
          headline: protocol.pageJudgement,
          summary: protocol.pageJudgementReason,
        }}
      />

      <UnifiedDetailNavigationPanel
        navigation={navigation}
        english={english}
      />

      <section className="theme-detail-shell overflow-hidden rounded-[30px]">
        <div className="grid gap-6 px-5 py-5 xl:grid-cols-[minmax(0,1.18fr)_320px] xl:px-6 xl:py-6">
          <div data-page-layer="frontstage" className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <EvidenceChip
                label={displayAudienceMode}
                tone="sky"
              />
              <EvidenceChip
                label={formatRiskSignal(
                  mode === "proposal"
                    ? props.contract.proposalPageRiskSignal
                    : props.contract.packagePageRiskSignal,
                  english,
                )}
                tone={
                  (mode === "proposal"
                    ? props.contract.proposalPageRiskSignal
                    : props.contract.packagePageRiskSignal) === "high"
                    ? "amber"
                    : "violet"
                }
              />
              {protocol.pagePrioritySignal ? (
                <EvidenceChip label={protocol.pagePrioritySignal} tone="amber" />
              ) : null}
              <Badge variant="neutral">
                {english
                  ? `${detail.stageLabel} · ${detail.riskLabel}`
                  : `${detail.stageLabel} · ${detail.riskLabel}`}
              </Badge>
            </div>

            <div data-frontstage-block="current-summary">
              <DetailOperatingSummaryCard
                label={english ? "Current operating summary" : "当前操作摘要"}
                items={operatingSummaryItems}
                connectionsLabel={english ? "Connected loop" : "关联对象与回路"}
                connections={operatingSummaryConnections}
              />
            </div>

            <div data-frontstage-block="decision-request">
              <DecisionRequestCard
                label={english ? "Pending decision" : "待决策"}
                items={protocol.pageDecisionRequest}
              />
            </div>

            <div data-frontstage-block="next-action">
              <ActionRail
                label={english ? "Next action" : "下一步动作"}
                actions={protocol.pageNextAction}
              />
            </div>

            <div data-frontstage-block="boundary">
              <BoundaryNote
                label={english ? "Boundary summary" : "边界摘要"}
                items={protocol.pageBoundarySummary}
                escalationHint={protocol.pageEscalationHint}
              />
            </div>
          </div>

          <div data-page-layer="midstage" className="space-y-4">
            <SecondarySummaryCard
              label={english ? "Secondary summary" : "次级摘要"}
              items={[
                {
                  label: english ? "Current stage" : "当前阶段",
                  value: text(detail.stageLabel),
                },
                {
                  label: text(english ? "Current owner" : "当前负责人"),
                  value: text(detail.ownerName ?? (english ? "Unassigned" : "未分配")),
                },
                {
                  label: english ? "Customer mode" : "当前模式",
                  value: displayAudienceMode,
                },
                {
                  label: english ? "Due date" : "当前截止时间",
                  value: formatDateLabel(detail.dueDate),
                },
                ...(mode === "package"
                  ? [
                      {
                        label: text(english ? "Collaboration owner" : "当前协作负责人"),
                        value: text(props.contract.packagePageCollaborationOwner),
                      },
                    ]
                  : []),
              ]}
            />

            {mode === "package" ? (
              <CollaborationRequestCard
                label={
                  english ? "Coordination handoff" : "协作分工"
                }
                mode={props.contract.packagePageCollaborationMode}
                summary={text(props.contract.packagePageCollaborationSummary)}
                request={text(props.contract.packagePageCollaborationRequest)}
                decisionRequest={protocol.pageDecisionRequest[0]}
                nextSteps={props.contract.packagePageCollaborationNextStep.map(text)}
              />
            ) : null}

            <ReviewSnapshotBlock
              label={english ? "Review snapshot" : "待复核结果"}
              items={protocol.pageActionSummary}
              english={english}
              reviewState={protocol.pageReviewState}
            />
          </div>
        </div>

        <div className="theme-detail-shell-footer px-5 py-5 xl:px-6">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,460px)]">
            <div data-page-layer="backstage" className="space-y-5">
              <WhyItMattersBlock
                label={english ? "Why this needs attention" : "为什么现在要注意"}
                reasons={protocol.pageWhyItMatters}
              />

              <WorkerSummary
                label={english ? "Coordination handoff" : "协作分工"}
                items={protocol.pageWorkerSummary}
              />
            </div>

            <div data-page-layer="evidence">
              <EvidenceDrawer
                marker="page"
                label={english ? "Evidence drawer" : "证据抽屉"}
                summaryItems={protocol.pageEvidenceSummary}
                links={protocol.pageEvidenceLinks}
                countLabel={
                  english
                    ? `${groups.length} grouped tracks`
                    : `${groups.length} 组依据`
                }
                leadingChip={english ? "Appendix" : "附注层"}
              >
                <div className="grid gap-3">
                  {groups.map((group) => (
                    <div
                      key={group.groupId}
                      data-proposal-package-evidence-group={group.groupId}
                      className="theme-detail-shell-tile rounded-[20px] px-4 py-4"
                    >
                      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                        {group.label}
                      </p>
                      <div className="mt-3 space-y-2">
                        {group.items.map((item) => (
                          <p
                            key={item}
                            className="text-sm leading-7 text-[color:var(--dark-inset-muted)]"
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

function buildUnifiedNavigation({
  mode,
  detail,
  english,
  protocol,
  audienceMode,
  riskSignal,
}: {
  mode: "proposal" | "package";
  detail: ProposalPackageCommercialDetail;
  english: boolean;
  protocol: ReturnType<
    | typeof toProposalPageReportingProtocol
    | typeof toPackagePageReportingProtocol
  >;
  audienceMode: string;
  riskSignal: ProposalPackageRiskSignal;
}) {
  return createUnifiedDetailNavigationModel({
    currentNode: {
      detailNodeType: mode,
      detailNodeSummary: protocol.pageJudgement,
      detailNodeStage: detail.stageLabel,
      detailNodeBoundary: protocol.pageBoundarySummary[0],
      detailNodeAudienceMode: audienceMode,
      detailNodeSendabilityMode: null,
      detailNodeStrengthMode: null,
      detailNodePrev:
        mode === "package"
          ? {
              type: "proposal",
              href: `/proposals/${detail.id}`,
              label: english ? "Proposal detail" : "提案详情",
              summary: english
                ? "Return to the internal proposal judgement before reshaping the package."
                : "回到提案判断页，先确认内部提案措辞。",
            }
          : null,
      detailNodeNext:
        mode === "proposal"
          ? {
              type: "package",
              href: `/packages/${detail.id}`,
              label: english ? "Package detail" : "方案包详情",
              summary: english
                ? "Move from proposal framing to package shaping once the proposal direction is stable."
                : "当提案方向稳定后，继续切到方案包构形。",
            }
          : {
              type: "customer-facing-offer",
              href: `/offers/${detail.id}`,
              label: english
                ? "Customer-facing offer detail"
                : "客户面向报价详情",
              summary: english
                ? "Once the package is stable, switch to the customer-facing offer detail."
                : "当方案包收稳后，切到客户面向报价详情。",
            },
      detailNodeCurrentReason: protocol.pageJudgementReason,
      detailNodePriority: priorityForCommercialRisk(riskSignal),
      detailNodeNavigationHint:
        mode === "proposal"
          ? english
            ? "Use this detail when the commercial argument and internal framing still need to align before package shaping."
            : "当 Helm 仍在整理商业论证和内部措辞、还没切到方案包构形时，先停在这里。"
          : english
            ? "Use this detail when proposal framing is already coherent and the work now needs package shaping plus a clear path to external wording."
            : "当提案措辞已经成形、当前工作进入方案包构形并准备过渡到对外措辞时，停在这里。",
    },
    handoffs:
      mode === "proposal"
        ? [
            {
              handoffSource: "proposal",
              handoffTarget: "package",
              handoffReason: english
                ? "The proposal judgement is already shaped. The next useful detail is package shaping, not more raw opportunity browsing."
                : "当前提案判断已经收清，下一步该切到方案包构形，而不是回到原始对象浏览。",
              handoffBoundary: protocol.pageBoundarySummary[0],
              handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
              handoffDependency: protocol.pageBoundarySummary[2] ?? null,
              handoffRisk: english
                ? `Current commercial risk: ${formatRiskSignal(riskSignal, english)}.`
                : `当前商业风险：${formatRiskSignal(riskSignal, english)}。`,
              handoffDecisionRequest: protocol.pageDecisionRequest[0],
              handoffNextAction:
                protocol.pageNextAction[0]?.label ??
                (english ? "Open package detail" : "打开方案包详情"),
              handoffWorkerSummary: protocol.pageWorkerSummary,
              handoffEvidenceSummary: protocol.pageEvidenceSummary,
              handoffVisibilityMode: "internal-only",
              handoffHref: `/packages/${detail.id}`,
            },
          ]
        : [
            {
              handoffSource: "package",
              handoffTarget: "customer-facing-offer",
              handoffReason: english
                ? "Package shaping is strong enough to justify a customer-facing offer draft, but only with the current boundary still attached."
                : "当前方案包构形已经足以切到客户面向报价草稿，但必须连同当前边界一起保留。",
              handoffBoundary: protocol.pageBoundarySummary[0],
              handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
              handoffDependency: protocol.pageBoundarySummary[2] ?? null,
              handoffRisk: english
                ? "Crossing into customer-facing wording can still change the expectation surface, so boundary cues must stay visible."
                : "切到客户可见措辞会改变预期表面，因此边界线索必须继续可见。",
              handoffDecisionRequest: protocol.pageDecisionRequest[0],
              handoffNextAction:
                protocol.pageNextAction[0]?.label ??
                (english
                  ? "Open customer-facing offer detail"
                  : "打开客户面向报价详情"),
              handoffWorkerSummary: protocol.pageWorkerSummary,
              handoffEvidenceSummary: protocol.pageEvidenceSummary,
              handoffVisibilityMode: "customer-facing-with-boundary",
              handoffHref: `/offers/${detail.id}`,
            },
            {
              handoffSource: "package",
              handoffTarget: "conversation",
              handoffReason: english
                ? "Package framing is now stable enough that the next useful move is a role-safe conversation layer, not more raw package browsing."
                : "当前方案包措辞已经足够稳定，下一步最有价值的是角色安全的对话层，而不是继续翻方案包原始内容。",
              handoffBoundary: protocol.pageBoundarySummary[0],
              handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
              handoffDependency: protocol.pageBoundarySummary[2] ?? null,
              handoffRisk: english
                ? "Conversation wording can still overstate certainty, so package boundary and non-commitment cues must stay attached."
                : "对话措辞仍可能过度夸大确定性，所以方案包边界和非承诺线索必须一起带过去。",
              handoffDecisionRequest: protocol.pageDecisionRequest[0],
              handoffNextAction: english
                ? "Open conversation detail"
                : "打开对话详情",
              handoffWorkerSummary: protocol.pageWorkerSummary,
              handoffEvidenceSummary: protocol.pageEvidenceSummary,
              handoffVisibilityMode: "internal-only",
              handoffHref: `/conversations/${detail.id}`,
            },
          ],
  });
}

function priorityForCommercialRisk(signal: ProposalPackageRiskSignal) {
  if (signal === "high") return "urgent";
  if (signal === "watch") return "watch";
  return "important";
}

function SecondarySummaryCard({
  label,
  items,
}: {
  label: string;
  items: Array<{ label: string; value: string }>;
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

function formatAudienceMode(
  mode: ProposalPackageAudienceMode,
  english: boolean,
) {
  if (mode === "internal_review") {
    return english ? "Internal review only" : "仅内部复核";
  }
  if (mode === "customer_safe_review") {
    return english ? "Customer-safe review" : "可进入客户安全复核";
  }
  return english ? "Non-commitment window" : "仍处于非承诺窗口";
}

function formatRiskSignal(
  signal: ProposalPackageRiskSignal,
  english: boolean,
) {
  if (signal === "high") return english ? "High risk" : "高风险";
  if (signal === "caution") return english ? "Move carefully" : "谨慎推进";
  return english ? "Watch closely" : "继续观察";
}

function evidenceGroups(
  mode: "proposal" | "package",
  props: ProposalPageProps | PackagePageProps,
): ProposalPackageEvidenceGroup[] {
  if (mode === "proposal" && props.mode === "proposal") {
    return props.contract.proposalPageEvidenceGroups;
  }

  if (mode === "package" && props.mode === "package") {
    return props.contract.packagePageEvidenceGroups;
  }

  throw new Error("proposal/package evidence groups must stay aligned to mode");
}
