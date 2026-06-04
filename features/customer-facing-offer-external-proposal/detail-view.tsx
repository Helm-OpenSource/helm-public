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
  CustomerFacingOfferExternalProposalEvidenceGroup,
  CustomerFacingOfferExternalProposalRiskSignal,
  CustomerFacingOfferExternalProposalSendabilityMode,
  CustomerFacingOfferPageDetailReportingContract,
  ExternalProposalPageDetailReportingContract,
} from "@/lib/presentation/customer-facing-offer-external-proposal-detail-contract";
import {
  toCustomerFacingOfferPageReportingProtocol,
  toExternalProposalPageReportingProtocol,
} from "@/lib/presentation/customer-facing-offer-external-proposal-detail-contract";
import { createUnifiedDetailNavigationModel } from "@/lib/presentation/unified-detail-navigation";
import type { ProposalPackageCommercialDetail } from "@/features/proposal-package/proposal-package-detail-view";
import { formatDateLabel } from "@/lib/utils";

type CustomerOfferPageProps = {
  mode: "customer-offer";
  detail: ProposalPackageCommercialDetail;
  english: boolean;
  contract: CustomerFacingOfferPageDetailReportingContract;
};

type ExternalProposalPageProps = {
  mode: "external-proposal";
  detail: ProposalPackageCommercialDetail;
  english: boolean;
  contract: ExternalProposalPageDetailReportingContract;
};

export function CustomerFacingOfferExternalProposalDetailView(
  props: CustomerOfferPageProps | ExternalProposalPageProps,
) {
  const { detail, english, mode } = props;
  const sourceProtocol =
    mode === "customer-offer"
      ? toCustomerFacingOfferPageReportingProtocol(props.contract, english)
      : toExternalProposalPageReportingProtocol(props.contract, english);
  const text = (value: string) => formatRoleDetailDisplayText(value, english);
  const protocol = formatRoleDetailPageProtocol(sourceProtocol, english);
  const title =
    mode === "customer-offer"
      ? english
        ? `${detail.title} customer-facing offer detail`
        : `${detail.title} 客户可见提案详情页`
      : english
        ? `${detail.title} external proposal detail`
        : `${detail.title} 外部提案详情页`;

  const sendabilityMode =
    mode === "customer-offer"
      ? props.contract.customerOfferPageSendabilityMode
      : props.contract.externalProposalPageSendabilityMode;
  const riskSignal =
    mode === "customer-offer"
      ? props.contract.customerOfferPageRiskSignal
      : props.contract.externalProposalPageRiskSignal;
  const displaySendabilityMode = text(formatSendabilityMode(sendabilityMode, english));
  const navigation = buildUnifiedNavigation({
    mode,
    detail,
    english,
    protocol,
    sendabilityMode,
    riskSignal,
  });
  const operatingSummaryItems = buildObjectContextDetailOperatingSummaryItems({
    english,
    protocol,
    objectStateLine: `${detail.stageLabel} · ${detail.riskLabel} · ${formatSendabilityMode(
      sendabilityMode,
      english,
    )}`,
  }).map((item) => ({
    ...item,
    label: text(item.label),
    value: text(item.value),
  }));
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
      data-customer-facing-offer-external-proposal-page="true"
      data-customer-facing-offer-page={mode === "customer-offer" ? "true" : undefined}
      data-external-proposal-page={mode === "external-proposal" ? "true" : undefined}
      className="space-y-6"
    >
      <PageHeader
        eyebrow={
          text(
            mode === "customer-offer"
              ? english
                ? "External expression / Customer-facing offer"
                : "对外表达 / 客户面向报价"
              : english
                ? "External expression / External proposal"
                : "对外表达 / 外部提案",
          )
        }
        title={text(title)}
        description={
          text(
            english
              ? `${detail.companyName ?? "No linked company"} · ${detail.contactNames[0] ?? "No linked contact"} · ${formatSendabilityMode(
                  sendabilityMode,
                  english,
                )}`
              : `${detail.companyName ?? "未关联公司"} · ${detail.contactNames[0] ?? "未关联联系人"} · ${formatSendabilityMode(
                  sendabilityMode,
                  english,
                )}`,
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
                  mode === "customer-offer"
                    ? `/conversations/${detail.id}`
                    : `/external-narratives/${detail.id}`
                }
              >
                {mode === "customer-offer"
                  ? english
                    ? "Open conversation page"
                    : text("打开对话页面")
                  : english
                    ? "Open external narrative page"
                    : text("打开对外叙事页面")}
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link
                href={
                  mode === "customer-offer"
                    ? `/packages/${detail.id}`
                    : `/offers/${detail.id}`
                }
              >
                {mode === "customer-offer"
                  ? english
                    ? "Open package page"
                    : text("打开方案包页面")
                  : english
                    ? "Open customer offer page"
                    : text("打开客户可见提案页面")}
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link
                href={
                  mode === "customer-offer"
                    ? `/reinforcements/${detail.id}`
                    : `/sendability/${detail.id}`
                }
              >
                {mode === "customer-offer"
                  ? english
                    ? "Open reinforcement page"
                    : text("打开加固页面")
                  : english
                    ? "Open sendability page"
                    : text("打开发送评估页面")}
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
            mode === "customer-offer"
              ? english
                ? "Customer-facing offer judgement"
                : text("客户面向报价判断")
              : english
                ? "External proposal judgement"
                : text("外部提案判断"),
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
                label={displaySendabilityMode}
                tone={toneForSendability(sendabilityMode)}
              />
              <EvidenceChip
                label={formatRiskSignal(riskSignal, english)}
                tone={riskSignal === "high" ? "amber" : "violet"}
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
                label={
                  text(english ? "Boundary and sendability" : "边界与发送评估")
                }
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
                  label: text(english ? "Sendability" : "当前发送评估"),
                  value: displaySendabilityMode,
                },
                {
                  label: text(english ? "Customer-facing wording" : "可对外措辞"),
                  value: text(
                    mode === "customer-offer"
                      ? props.contract.customerOfferPageCustomerFacingCue
                      : props.contract.externalProposalPageCustomerFacingCue,
                  ),
                },
                {
                  label: text(english ? "Internal-only wording" : "仅内部措辞"),
                  value: text(
                    mode === "customer-offer"
                      ? props.contract.customerOfferPageInternalOnlyCue
                      : props.contract.externalProposalPageInternalOnlyCue,
                  ),
                },
                {
                  label: text(english ? "Non-commitment" : "非承诺说明"),
                  value: text(
                    mode === "customer-offer"
                      ? props.contract.customerOfferPageNonCommitmentCue
                      : props.contract.externalProposalPageNonCommitmentCue,
                  ),
                },
                {
                  label: text(english ? "Current owner" : "当前负责人"),
                  value: text(
                    mode === "external-proposal"
                      ? props.contract.externalProposalPageCollaborationOwner
                      : detail.ownerName ?? (english ? "Unassigned" : "未分配"),
                  ),
                },
                {
                  label: english ? "Due date" : "当前截止时间",
                  value: formatDateLabel(detail.dueDate),
                },
              ]}
            />

            {mode === "external-proposal" ? (
              <CollaborationRequestCard
                label={english ? "Coordination handoff" : "协作分工"}
                mode={props.contract.externalProposalPageCollaborationMode}
                summary={text(props.contract.externalProposalPageCollaborationSummary)}
                request={text(props.contract.externalProposalPageCollaborationRequest)}
                decisionRequest={protocol.pageDecisionRequest[0]}
                nextSteps={props.contract.externalProposalPageCollaborationNextStep.map(text)}
                english={english}
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
                      data-customer-facing-offer-external-proposal-evidence-group={
                        group.groupId
                      }
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
  sendabilityMode,
  riskSignal,
}: {
  mode: "customer-offer" | "external-proposal";
  detail: ProposalPackageCommercialDetail;
  english: boolean;
  protocol: ReturnType<
    | typeof toCustomerFacingOfferPageReportingProtocol
    | typeof toExternalProposalPageReportingProtocol
  >;
  sendabilityMode: CustomerFacingOfferExternalProposalSendabilityMode;
  riskSignal: CustomerFacingOfferExternalProposalRiskSignal;
}) {
  return createUnifiedDetailNavigationModel({
    currentNode: {
      detailNodeType:
        mode === "customer-offer"
          ? "customer-facing-offer"
          : "external-proposal",
      detailNodeSummary: protocol.pageJudgement,
      detailNodeStage: detail.stageLabel,
      detailNodeBoundary: protocol.pageBoundarySummary[0],
      detailNodeAudienceMode:
        mode === "customer-offer"
          ? english
            ? "customer-facing"
            : "可对外表达"
          : english
            ? "customer-facing with internal review"
            : "对外表达 + 内部复核",
      detailNodeSendabilityMode: formatSendabilityMode(sendabilityMode, english),
      detailNodeStrengthMode: null,
      detailNodePrev:
        mode === "customer-offer"
          ? {
              type: "package",
              href: `/packages/${detail.id}`,
              label: english ? "Package detail" : "方案包详情",
              summary: english
                ? "Return to package shaping if the commercial framing still needs work before external wording."
                : "如果对外措辞前还要重收商业措辞，就回到方案包详情面。",
            }
          : {
              type: "customer-facing-offer",
              href: `/offers/${detail.id}`,
              label: english
                ? "Customer-facing offer detail"
                : "客户面向报价详情",
              summary: english
                ? "Return to the lighter customer offer if the external proposal still needs a safer surface."
                : "如果外部提案仍需要更安全的表达表面，就回到更轻的客户提案。",
            },
      detailNodeNext:
        mode === "customer-offer"
          ? {
              type: "external-proposal",
              href: `/external-proposals/${detail.id}`,
              label: english
                ? "External proposal detail"
                : "外部提案详情",
              summary: english
                ? "Move into a more structured external proposal once the offer can carry a fuller narrative."
                : "当当前提案已能承载更完整的外部叙事时，切到更结构化的外部提案。",
            }
          : {
              type: "reinforcement",
              href: `/reinforcements/${detail.id}`,
              label: english
                ? "Reinforcement detail"
                : "加固详情",
              summary: english
                ? "Move here when the proposal is stable enough to judge how far wording may be strengthened without becoming commitment."
                : "当提案已经够稳定，需要判断措辞能强化到哪里且不被误读成承诺时，切到这里。",
            },
      detailNodeCurrentReason: protocol.pageJudgementReason,
      detailNodePriority: priorityForRisk(riskSignal),
      detailNodeNavigationHint:
        mode === "customer-offer"
          ? english
            ? "Use this detail when the customer-visible offer still needs sendability plus boundary cues tightly attached."
            : "当客户可见提案仍需要把发送评估与边界线索紧贴主叙事放置时，停在这里。"
          : english
            ? "Use this detail when the work is already in the structured external proposal phase and the next question is reinforcement, not more raw offer drafting."
            : "当工作已经进入结构化的外部提案阶段，下一步问题变成加固而不是继续起草原始提案时，停在这里。",
    },
    handoffs:
      mode === "customer-offer"
        ? [
            {
              handoffSource: "package",
              handoffTarget: "customer-facing-offer",
              handoffReason: english
                ? "The package is mature enough to become customer-visible wording, but the handoff still needs sendability and boundary context attached."
                : "当前方案包已经成熟到可以转成客户可见措辞，但交接时仍必须附带发送评估与边界上下文。",
              handoffBoundary: protocol.pageBoundarySummary[0],
              handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
              handoffDependency: protocol.pageBoundarySummary[2] ?? null,
              handoffRisk: english
                ? `Current sendability posture: ${formatSendabilityMode(sendabilityMode, english)}.`
                : `当前发送评估状态：${formatSendabilityMode(sendabilityMode, english)}。`,
              handoffDecisionRequest: protocol.pageDecisionRequest[0],
              handoffNextAction:
                protocol.pageNextAction[0]?.label ??
                (english ? "Open customer-facing offer detail" : "打开客户可见提案详情"),
              handoffWorkerSummary: protocol.pageWorkerSummary,
              handoffEvidenceSummary: protocol.pageEvidenceSummary,
              handoffVisibilityMode:
                sendabilityMode === "safe_to_send"
                  ? "customer-facing"
                  : "customer-facing-with-boundary",
              handoffHref: `/offers/${detail.id}`,
            },
            {
              handoffSource: "customer-facing-offer",
              handoffTarget: "conversation",
              handoffReason: english
                ? "The customer-facing offer is coherent enough that the next useful move is scene-specific talk-track guidance, not another round of lighter copy edits."
                : "当前客户可见提案已经足够连贯，下一步真正有价值的是场景化话术指引，而不是继续改更轻的文案。",
              handoffBoundary: protocol.pageBoundarySummary[0],
              handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
              handoffDependency: protocol.pageBoundarySummary[2] ?? null,
              handoffRisk: english
                ? "Spoken wording can still overstate certainty, so sendability and non-commitment cues must stay visible."
                : "口头表达仍可能过度夸大确定性，因此发送评估与非承诺线索必须继续可见。",
              handoffDecisionRequest: protocol.pageDecisionRequest[0],
              handoffNextAction: english
                ? "Open conversation detail"
                : "打开对话详情",
              handoffWorkerSummary: protocol.pageWorkerSummary,
              handoffEvidenceSummary: protocol.pageEvidenceSummary,
              handoffVisibilityMode:
                sendabilityMode === "safe_to_send"
                  ? "customer-facing-with-boundary"
                  : "review-before-send",
              handoffHref: `/conversations/${detail.id}`,
            },
          ]
        : [
            {
              handoffSource: "customer-facing-offer",
              handoffTarget: "external-proposal",
              handoffReason: english
                ? "A more structured external proposal layer is needed now, not another round of fragmented offer bullets."
                : "当前需要的是更结构化的外部提案层，而不是继续堆零散的报价要点。",
              handoffBoundary: protocol.pageBoundarySummary[0],
              handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
              handoffDependency: protocol.pageBoundarySummary[2] ?? null,
              handoffRisk: english
                ? "This step can widen customer expectations, so review and boundary notes must remain visible."
                : "这一步会放大客户预期表面，因此复核与边界备注必须继续可见。",
              handoffDecisionRequest: protocol.pageDecisionRequest[0],
              handoffNextAction:
                protocol.pageNextAction[0]?.label ??
                (english ? "Open external proposal detail" : "打开外部提案详情"),
              handoffWorkerSummary: protocol.pageWorkerSummary,
              handoffEvidenceSummary: protocol.pageEvidenceSummary,
              handoffVisibilityMode:
                sendabilityMode === "review_before_send" ||
                sendabilityMode === "not_safe_to_send"
                  ? "review-before-send"
                  : "customer-facing-with-boundary",
              handoffHref: `/external-proposals/${detail.id}`,
            },
            {
              handoffSource: "external-proposal",
              handoffTarget: "reinforcement",
              handoffReason: english
                ? "The proposal wording is coherent enough that the next useful question is reinforcement strength, not more raw proposal drafting."
                : "当前提案措辞已经足够连贯，下一步真正有价值的问题是加固强度，而不是继续写原始提案文本。",
              handoffBoundary: protocol.pageBoundarySummary[0],
              handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
              handoffDependency: protocol.pageBoundarySummary[2] ?? null,
              handoffRisk: english
                ? "Reinforcement can still be misread as commitment, so non-commitment fallback must stay explicit."
                : "加固仍可能被误读成承诺，因此非承诺兜底必须保持显式。",
              handoffDecisionRequest: protocol.pageDecisionRequest[0],
              handoffNextAction: english
                ? "Open reinforcement detail"
                : "打开加固详情",
              handoffWorkerSummary: protocol.pageWorkerSummary,
              handoffEvidenceSummary: protocol.pageEvidenceSummary,
              handoffVisibilityMode: "internal-only",
              handoffHref: `/reinforcements/${detail.id}`,
            },
            {
              handoffSource: "external-proposal",
              handoffTarget: "external-narrative",
              handoffReason: english
                ? "The external proposal is now coherent enough to turn into a reusable outward narrative layer instead of keeping everything trapped inside proposal structure."
                : "当前外部提案已经足够连贯，可以整理成可复用的对外叙事层，而不是继续把所有表达都困在提案结构里。",
              handoffBoundary: protocol.pageBoundarySummary[0],
              handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
              handoffDependency: protocol.pageBoundarySummary[2] ?? null,
              handoffRisk: english
                ? "If the narrative outruns boundary or review gates, it can still be misread as commitment."
                : "如果叙事跑在边界或复核闸口前面，仍可能被误读成承诺。",
              handoffDecisionRequest: protocol.pageDecisionRequest[0],
              handoffNextAction: english
                ? "Open external narrative detail"
                : "打开对外叙事详情面",
              handoffWorkerSummary: protocol.pageWorkerSummary,
              handoffEvidenceSummary: protocol.pageEvidenceSummary,
              handoffVisibilityMode:
                sendabilityMode === "review_before_send" ||
                sendabilityMode === "not_safe_to_send"
                  ? "review-before-send"
                  : "customer-facing-with-boundary",
              handoffHref: `/external-narratives/${detail.id}`,
            },
          ],
  });
}

function priorityForRisk(
  signal: CustomerFacingOfferExternalProposalRiskSignal,
) {
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

function formatSendabilityMode(
  mode: CustomerFacingOfferExternalProposalSendabilityMode,
  english: boolean,
) {
  if (mode === "safe_to_send") {
    return english ? "Safe to send" : "可安全外发";
  }
  if (mode === "safe_with_boundary") {
    return english ? "Safe with boundary" : "可外发，但必须带边界";
  }
  if (mode === "safe_with_prerequisite") {
    return english ? "Safe with prerequisite" : "先补前置条件，再考虑外发";
  }
  if (mode === "safe_with_dependency") {
    return english ? "Safe with dependency" : "必须带依赖才能外发";
  }
  if (mode === "discussion_only") {
    return english ? "Discussion only" : "只适合讨论";
  }
  if (mode === "review_before_send") {
    return english ? "Review before send" : "先复核，再决定是否外发";
  }
  return english ? "Not safe to send" : "当前不能外发";
}

function toneForSendability(
  mode: CustomerFacingOfferExternalProposalSendabilityMode,
): "sky" | "amber" | "violet" | "emerald" {
  if (mode === "safe_to_send") return "emerald";
  if (mode === "safe_with_boundary") return "sky";
  if (mode === "safe_with_prerequisite" || mode === "safe_with_dependency") {
    return "amber";
  }
  if (mode === "discussion_only") return "violet";
  return "amber";
}

function formatRiskSignal(
  signal: CustomerFacingOfferExternalProposalRiskSignal,
  english: boolean,
) {
  if (signal === "high") return english ? "High risk" : "高风险";
  if (signal === "caution") return english ? "Move carefully" : "谨慎推进";
  return english ? "Watch closely" : "继续观察";
}

function evidenceGroups(
  mode: "customer-offer" | "external-proposal",
  props: CustomerOfferPageProps | ExternalProposalPageProps,
): CustomerFacingOfferExternalProposalEvidenceGroup[] {
  if (mode === "customer-offer" && props.mode === "customer-offer") {
    return props.contract.customerOfferPageEvidenceGroups;
  }

  if (mode === "external-proposal" && props.mode === "external-proposal") {
    return props.contract.externalProposalPageEvidenceGroups;
  }

  throw new Error(
    "customer-facing offer / external proposal evidence groups must stay aligned to mode",
  );
}
