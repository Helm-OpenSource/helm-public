import Link from "next/link";
import {
  ActionRail,
  BoundaryNote,
  DecisionRequestCard,
  EvidenceChip,
  EvidenceDrawer,
  ReviewSnapshotBlock,
  WhyItMattersBlock,
  WorkerSummary,
} from "@/components/shared/narrative-components";
import {
  buildObjectContextDetailOperatingSummaryItems,
  DetailOperatingSummaryCard,
} from "@/components/shared/detail-operating-summary-card";
import { PageHeader } from "@/components/shared/page-header";
import { UnifiedDetailNavigationPanel } from "@/components/shared/unified-detail-navigation-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  ConversationDetailAudienceMode,
  ConversationDetailIntent,
  ConversationDetailMode,
  ConversationDetailReportingContract,
  ConversationDetailRiskSignal,
  ConversationDetailSendabilityMode,
} from "@/lib/presentation/conversation-detail-contract";
import {
  toConversationDetailPageReportingProtocol,
} from "@/lib/presentation/conversation-detail-contract";
import { createUnifiedDetailNavigationModel } from "@/lib/presentation/unified-detail-navigation";
import type { ProposalPackageCommercialDetail } from "@/features/proposal-package/proposal-package-detail-view";
import {
  formatRoleDetailDisplayText,
  formatRoleDetailEvidenceGroups,
  formatRoleDetailPageProtocol,
} from "@/lib/presentation/role-detail-display-copy";
import { formatDateLabel } from "@/lib/utils";

type Props = {
  detail: ProposalPackageCommercialDetail;
  english: boolean;
  contract: ConversationDetailReportingContract;
};

export function ConversationDetailView({
  detail,
  english,
  contract,
}: Props) {
  const sourceProtocol = toConversationDetailPageReportingProtocol(contract);
  const text = (value: string | null | undefined) =>
    formatRoleDetailDisplayText(value, english);
  const protocol = formatRoleDetailPageProtocol(sourceProtocol, english);
  const evidenceGroups = formatRoleDetailEvidenceGroups(
    contract.conversationDetailEvidenceGroups,
    english,
  );
  const navigation = buildUnifiedNavigation({
    detail,
    english,
    contract,
    protocol,
  });
  const operatingSummaryItems = buildObjectContextDetailOperatingSummaryItems({
    english,
    protocol,
    objectStateLine: text(`${
      detail.stageLabel
    } · ${detail.riskLabel} · ${formatMode(contract.conversationDetailMode, english)}`),
  });

  return (
    <div data-conversation-detail-page="true" className="space-y-6">
      <PageHeader
        eyebrow={
          english
            ? "Commercial communication / Conversation detail"
            : "商业沟通 / 对话详情"
        }
        title={
          english
            ? `${detail.title} conversation detail`
            : text(`${detail.title} 对话详情`)
        }
        description={
          english
            ? `${detail.companyName ?? "No linked company"} · ${detail.contactNames[0] ?? "No linked contact"} · ${formatMode(
                contract.conversationDetailMode,
                english,
              )}`
            : text(`${detail.companyName ?? "未关联公司"} · ${detail.contactNames[0] ?? "未关联联系人"} · ${formatMode(
                contract.conversationDetailMode,
                english,
              )}`)
        }
        actions={
          <>
            <Button asChild>
              <Link href={`/external-narratives/${detail.id}`}>
                {english
                  ? "Open external narrative page"
                  : "打开对外表述页"}
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href={`/founder-conversations/${detail.id}`}>
                {english ? "Open founder conversation page" : "打开创始人版本"}
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href={`/sales-conversations/${detail.id}`}>
                {english ? "Open sales conversation page" : "打开销售版本"}
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href={`/delivery-conversations/${detail.id}`}>
                {english ? "Open delivery conversation page" : "打开交付版本"}
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href={`/packages/${detail.id}`}>
                {english ? "Open package page" : "打开方案页"}
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href={`/offers/${detail.id}`}>
                {english
                  ? "Open customer-facing offer page"
                  : "打开对客报价页"}
              </Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link href={`/memory?objectType=OPPORTUNITY&objectId=${detail.id}`}>
                {english ? "Open evidence" : "查看依据"}
              </Link>
            </Button>
          </>
        }
        briefing={{
          label: english ? "Conversation judgement" : "当前对话判断",
          headline: protocol.pageJudgement,
          summary: protocol.pageJudgementReason,
        }}
      />

      <UnifiedDetailNavigationPanel navigation={navigation} english={english} />

      <section className="theme-detail-shell overflow-hidden rounded-[30px]">
        <div className="grid gap-6 px-5 py-5 xl:grid-cols-[minmax(0,1.18fr)_320px] xl:px-6 xl:py-6">
          <div data-page-layer="frontstage" className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <EvidenceChip
                label={text(formatMode(contract.conversationDetailMode, english))}
                tone={toneForMode(contract.conversationDetailMode)}
              />
              <EvidenceChip
                label={text(formatSendabilityMode(
                  contract.conversationDetailSendabilityMode,
                  english,
                ))}
                tone={toneForSendability(
                  contract.conversationDetailSendabilityMode,
                )}
              />
              <EvidenceChip
                label={text(formatRiskSignal(contract.conversationDetailRiskSignal, english))}
                tone={
                  contract.conversationDetailRiskSignal === "high"
                    ? "amber"
                    : "violet"
                }
              />
              {protocol.pagePrioritySignal ? (
                <EvidenceChip label={protocol.pagePrioritySignal} tone="amber" />
              ) : null}
              <Badge variant="neutral">{`${detail.stageLabel} · ${detail.riskLabel}`}</Badge>
            </div>

            <div data-frontstage-block="current-summary">
              <DetailOperatingSummaryCard
                label={english ? "Current operating summary" : "当前局面摘要"}
                items={operatingSummaryItems}
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
                  english
                    ? "Boundary, scene and sendability"
                    : "边界、场景与外发限制"
                }
                items={protocol.pageBoundarySummary}
                escalationHint={protocol.pageEscalationHint}
              />
            </div>
          </div>

          <div data-page-layer="midstage" className="space-y-4">
            <SecondarySummaryCard
              label={english ? "Secondary summary" : "补充信息"}
              items={[
                {
                  label: english ? "Conversation mode" : "当前对话场景",
                  value: text(formatMode(contract.conversationDetailMode, english)),
                },
                {
                  label: english ? "Intent" : "当前意图",
                  value: text(formatIntent(contract.conversationDetailIntent, english)),
                },
                {
                  label: english ? "Audience mode" : "当前面向对象",
                  value: text(formatAudienceMode(
                    contract.conversationDetailAudienceMode,
                    english,
                  )),
                },
                {
                  label: english ? "Sendability" : "当前可发送状态",
                  value: text(formatSendabilityMode(
                    contract.conversationDetailSendabilityMode,
                    english,
                  )),
                },
                {
                  label: english ? "Founder cue" : "创始人说法提示",
                  value: text(contract.conversationDetailFounderCue),
                },
                {
                  label: english ? "Sales cue" : "销售说法提示",
                  value: text(contract.conversationDetailSalesCue),
                },
                {
                  label: english ? "Delivery cue" : "交付说法提示",
                  value: text(contract.conversationDetailDeliveryCue),
                },
                {
                  label: english ? "Current owner" : "当前负责人",
                  value: detail.ownerName ?? (english ? "Unassigned" : "未分配"),
                },
                {
                  label: english ? "Due date" : "当前截止时间",
                  value: formatDateLabel(detail.dueDate),
                },
              ]}
            />

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
                label={english ? "Evidence drawer" : "依据与来龙去脉"}
                summaryItems={protocol.pageEvidenceSummary}
                links={protocol.pageEvidenceLinks}
                countLabel={
                  english
                    ? `${evidenceGroups.length} grouped tracks`
                    : `${evidenceGroups.length} 组依据`
                }
                leadingChip={english ? "Appendix" : "附注层"}
              >
                <div className="grid gap-3">
                  {evidenceGroups.map((group) => (
                    <div
                      key={group.groupId}
                      data-conversation-evidence-group={group.groupId}
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

function buildUnifiedNavigation({
  detail,
  english,
  contract,
  protocol,
}: {
  detail: ProposalPackageCommercialDetail;
  english: boolean;
  contract: ConversationDetailReportingContract;
  protocol: ReturnType<typeof toConversationDetailPageReportingProtocol>;
}) {
  const customerFacing =
    contract.conversationDetailSendabilityMode === "customer-visible" ||
    contract.conversationDetailSendabilityMode === "safe-with-boundary";

  return createUnifiedDetailNavigationModel({
    currentNode: {
      detailNodeType: "conversation",
      detailNodeSummary: protocol.pageJudgement,
      detailNodeStage: detail.stageLabel,
      detailNodeBoundary: protocol.pageBoundarySummary[0],
      detailNodeAudienceMode: formatAudienceMode(
        contract.conversationDetailAudienceMode,
        english,
      ),
      detailNodeSendabilityMode: formatSendabilityMode(
        contract.conversationDetailSendabilityMode,
        english,
      ),
      detailNodeStrengthMode: null,
      detailNodePrev: customerFacing
        ? {
            type: "customer-facing-offer",
            href: `/offers/${detail.id}`,
            label: english
              ? "Customer-facing offer detail"
              : "客户面向报价详情",
            summary: english
              ? "Return to the customer-facing offer if the talk track still needs a lighter external-safe surface."
              : "如果当前话术还需要更轻一点的可对外表面，就回到客户可见报价。",
          }
        : {
            type: "package",
            href: `/packages/${detail.id}`,
            label: english ? "Package detail" : "方案包详情",
            summary: english
              ? "Return to package shaping if the conversation still needs cleaner package boundary and next-step framing."
              : "如果当前对话还需要更清楚的方案包边界和下一步措辞，就回到方案包详情。",
          },
      detailNodeNext: {
        type: "external-narrative",
        href: `/external-narratives/${detail.id}`,
        label: english ? "External narrative detail" : "对外叙事详情",
        summary: english
          ? "Move here once the conversation scene is clear and the next step needs a reusable outward narrative layer."
          : "当对话场景已经收住，且下一步需要一层可复用的对外叙事时，切到这里。",
      },
      detailNodeCurrentReason: protocol.pageJudgementReason,
      detailNodePriority: priorityForRisk(contract.conversationDetailRiskSignal),
      detailNodeNavigationHint: english
        ? "Use this detail when the team is deciding how to speak next, which role should speak, and how far the wording can travel without crossing into commitment."
        : "当团队正在判断下一句该怎么说、该由谁说、以及措辞能在不跨进承诺的前提下走多远时，停在这里。",
    },
    handoffs: [
      {
        handoffSource: "package",
        handoffTarget: "conversation",
        handoffReason: english
          ? "The package boundary is ready enough that the next useful move is scene-specific conversation guidance, not more raw package rows."
          : "当前方案包边界已经足够清楚，下一步最有价值的是场景化对话指引，而不是继续翻原始方案包行。",
        handoffBoundary: protocol.pageBoundarySummary[0],
        handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
        handoffDependency: protocol.pageBoundarySummary[2] ?? null,
        handoffRisk: english
          ? "This handoff can still change trust and expectation, so boundary and non-commitment cues must stay visible."
          : "这次切换仍会改变信任和预期，所以边界与非承诺线索必须继续可见。",
        handoffDecisionRequest: protocol.pageDecisionRequest[0],
        handoffNextAction:
          protocol.pageNextAction[0]?.label ??
          (english ? "Open conversation detail" : "打开对话详情"),
        handoffWorkerSummary: protocol.pageWorkerSummary,
        handoffEvidenceSummary: protocol.pageEvidenceSummary,
        handoffVisibilityMode: "internal-only",
        handoffHref: `/conversations/${detail.id}`,
      },
      {
        handoffSource: "customer-facing-offer",
        handoffTarget: "conversation",
        handoffReason: english
          ? "The offer wording is coherent enough to choose the right spoken scene instead of reworking the same external-safe copy."
          : "当前报价措辞已经够连贯，可以直接选择最合适的当面场景，而不是继续重写同一版可对外文案。",
        handoffBoundary: protocol.pageBoundarySummary[0],
        handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
        handoffDependency: protocol.pageBoundarySummary[2] ?? null,
        handoffRisk: english
          ? "Spoken wording can still overstate certainty, so sendability and non-commitment cues must remain explicit."
          : "口头表达仍可能过度夸大确定性，因此发送评估与非承诺线索必须保持显式。",
        handoffDecisionRequest: protocol.pageDecisionRequest[0],
        handoffNextAction:
          protocol.pageNextAction[0]?.label ??
          (english ? "Open conversation detail" : "打开对话详情"),
        handoffWorkerSummary: protocol.pageWorkerSummary,
        handoffEvidenceSummary: protocol.pageEvidenceSummary,
        handoffVisibilityMode: customerFacing
          ? "customer-facing-with-boundary"
          : "review-before-send",
        handoffHref: `/conversations/${detail.id}`,
      },
      {
        handoffSource: "conversation",
        handoffTarget: "external-narrative",
        handoffReason: english
          ? "The current talk track is stable enough to shape a reusable external narrative layer instead of staying in scene-only guidance."
          : "当前话术已经足够稳定，可以进一步整理成可复用的对外叙事层，而不必继续停留在场景层提示。",
        handoffBoundary: protocol.pageBoundarySummary[0],
        handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
        handoffDependency: protocol.pageBoundarySummary[2] ?? null,
        handoffRisk: english
          ? "If the narrative gets stronger than the scene supports, it can be misread as commitment."
          : "如果叙事强到超过当前场景能承载的边界，它就可能被误读成承诺。",
        handoffDecisionRequest: protocol.pageDecisionRequest[0],
        handoffNextAction:
          protocol.pageNextAction[0]?.label ??
          (english
            ? "Open external narrative detail"
            : "打开对外叙事详情面"),
        handoffWorkerSummary: protocol.pageWorkerSummary,
        handoffEvidenceSummary: protocol.pageEvidenceSummary,
        handoffVisibilityMode:
          contract.conversationDetailSendabilityMode === "review-before-send" ||
          contract.conversationDetailSendabilityMode === "not-ready-for-customer"
            ? "review-before-send"
            : customerFacing
              ? "customer-facing-with-boundary"
              : "internal-only",
        handoffHref: `/external-narratives/${detail.id}`,
      },
      {
        handoffSource: "conversation",
        handoffTarget: "founder-conversation",
        handoffReason: english
          ? "Use the founder role page when the next move needs founder-owned trust framing rather than one shared talk track."
          : "当下一步需要创始人亲自承接信任措辞，而不是继续停在共享话术时，切到创始人角色页面。",
        handoffBoundary: protocol.pageBoundarySummary[0],
        handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
        handoffDependency: protocol.pageBoundarySummary[2] ?? null,
        handoffRisk: english
          ? "Founder confidence can still be misread as commitment if boundary and non-commitment cues disappear."
          : "如果边界与非承诺线索消失，创始人信心仍可能被误读成承诺。",
        handoffDecisionRequest: protocol.pageDecisionRequest[0],
        handoffNextAction: english
          ? "Open founder conversation detail."
          : "打开创始人对话详情。",
        handoffWorkerSummary: protocol.pageWorkerSummary,
        handoffEvidenceSummary: protocol.pageEvidenceSummary,
        handoffVisibilityMode:
          contract.conversationDetailSendabilityMode === "review-before-send"
            ? "review-before-send"
            : "internal-only",
        handoffHref: `/founder-conversations/${detail.id}`,
      },
      {
        handoffSource: "conversation",
        handoffTarget: "sales-conversation",
        handoffReason: english
          ? "Use the sales role page when the next move needs sales-owned follow-up framing instead of one shared talk track."
          : "当下一步需要销售亲自承接跟进措辞，而不是继续停在共享话术时，切到销售角色页面。",
        handoffBoundary: protocol.pageBoundarySummary[0],
        handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
        handoffDependency: protocol.pageBoundarySummary[2] ?? null,
        handoffRisk: english
          ? "Sales follow-up can still overstate certainty if boundary and non-commitment cues disappear."
          : "如果边界与非承诺线索消失，销售跟进仍可能过度夸大确定性。",
        handoffDecisionRequest: protocol.pageDecisionRequest[0],
        handoffNextAction: english
          ? "Open sales conversation detail."
          : "打开销售对话详情。",
        handoffWorkerSummary: protocol.pageWorkerSummary,
        handoffEvidenceSummary: protocol.pageEvidenceSummary,
        handoffVisibilityMode: customerFacing
          ? "customer-facing-with-boundary"
          : "internal-only",
        handoffHref: `/sales-conversations/${detail.id}`,
      },
      {
        handoffSource: "conversation",
        handoffTarget: "delivery-conversation",
        handoffReason: english
          ? "Use the delivery role page when the next move needs scope, implementation or activation clarification rather than one shared talk track."
          : "当下一步需要范围、实施或激活澄清，而不是继续停在共享话术时，切到交付角色页面。",
        handoffBoundary: protocol.pageBoundarySummary[0],
        handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
        handoffDependency: protocol.pageBoundarySummary[2] ?? null,
        handoffRisk: english
          ? "Delivery explanation can still be misread as commitment if dependency and non-commitment cues disappear."
          : "如果依赖与非承诺线索消失，交付解释仍可能被误读成承诺。",
        handoffDecisionRequest: protocol.pageDecisionRequest[0],
        handoffNextAction: english
          ? "Open delivery conversation detail."
          : "打开交付对话详情。",
        handoffWorkerSummary: protocol.pageWorkerSummary,
        handoffEvidenceSummary: protocol.pageEvidenceSummary,
        handoffVisibilityMode:
          contract.conversationDetailSendabilityMode === "review-before-send" ||
          contract.conversationDetailSendabilityMode === "not-ready-for-customer"
            ? "review-before-send"
            : "internal-only",
        handoffHref: `/delivery-conversations/${detail.id}`,
      },
    ],
  });
}

function priorityForRisk(signal: ConversationDetailRiskSignal) {
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

function formatMode(mode: ConversationDetailMode, english: boolean) {
  switch (mode) {
    case "founder-meeting":
      return english ? "Founder meeting" : "创始人会议";
    case "founder-demo":
      return english ? "Founder demo" : "创始人演示";
    case "sales-first-contact":
      return english ? "Sales first contact" : "销售首次接触";
    case "sales-follow-up":
      return english ? "Sales follow-up" : "销售跟进";
    case "objection-handling":
      return english ? "Objection handling" : "异议处理";
    case "proposal-walkthrough":
      return english ? "Proposal walkthrough" : "方案走查";
    case "boundary-clarification":
      return english ? "Boundary clarification" : "边界澄清";
    case "prerequisite-clarification":
      return english ? "Prerequisite clarification" : "前置条件澄清";
    case "dependency-clarification":
      return english ? "Dependency clarification" : "依赖澄清";
    case "non-commitment-clarification":
      return english ? "Non-commitment clarification" : "非承诺澄清";
    case "review-before-send":
      return english ? "Review before send" : "发送前复核";
    default:
      return english ? "Internal prep only" : "仅内部准备";
  }
}

function formatIntent(intent: ConversationDetailIntent, english: boolean) {
  switch (intent) {
    case "warm-up-context":
      return english ? "Warm up the context" : "先把上下文升温";
    case "advance-follow-up":
      return english ? "Advance the follow-up" : "推进下一轮跟进";
    case "handle-objection":
      return english ? "Handle objections safely" : "安全处理异议";
    case "walkthrough-package":
      return english ? "Walk through the package" : "带着方案包过一遍";
    case "clarify-boundary":
      return english ? "Clarify the boundary" : "澄清当前边界";
    case "clarify-prerequisite":
      return english ? "Clarify the prerequisite" : "澄清前置条件";
    case "clarify-dependency":
      return english ? "Clarify the dependency" : "澄清依赖条件";
    default:
      return english ? "Protect non-commitment" : "保护非承诺";
  }
}

function formatAudienceMode(
  mode: ConversationDetailAudienceMode,
  english: boolean,
) {
  switch (mode) {
    case "founder-led":
      return english ? "Founder-led" : "创始人主导";
    case "sales-led":
      return english ? "Sales-led" : "销售主导";
    case "delivery-led":
      return english ? "Delivery-led" : "交付主导";
    case "customer-visible":
      return english ? "Customer-visible" : "客户可见";
    case "shared-review":
      return english ? "Shared review" : "联合复核";
    default:
      return english ? "Internal only" : "仅内部";
  }
}

function formatSendabilityMode(
  mode: ConversationDetailSendabilityMode,
  english: boolean,
) {
  switch (mode) {
    case "customer-visible":
      return english ? "Customer-visible" : "客户可见";
    case "safe-with-boundary":
      return english ? "Safe with boundary" : "带边界可说";
    case "safe-with-prerequisite":
      return english ? "Safe with prerequisite" : "先补前置再说";
    case "safe-with-dependency":
      return english ? "Safe with dependency" : "必须带依赖才能说";
    case "discussion-only":
      return english ? "Discussion only" : "只适合讨论";
    case "review-before-send":
      return english ? "Review before send" : "发送前先复核";
    case "internal-only":
      return english ? "Internal only" : "仅内部";
    default:
      return english ? "Not ready for customer" : "暂不适合对客户说";
  }
}

function toneForMode(
  mode: ConversationDetailMode,
): "sky" | "amber" | "violet" | "emerald" {
  if (mode === "founder-demo" || mode === "proposal-walkthrough") return "emerald";
  if (mode === "founder-meeting" || mode === "sales-follow-up") return "sky";
  if (mode === "review-before-send") return "amber";
  if (mode === "internal-prep-only") return "violet";
  return "violet";
}

function toneForSendability(
  mode: ConversationDetailSendabilityMode,
): "sky" | "amber" | "violet" | "emerald" {
  if (mode === "customer-visible") return "emerald";
  if (mode === "safe-with-boundary") return "sky";
  if (mode === "safe-with-prerequisite" || mode === "safe-with-dependency") {
    return "amber";
  }
  if (mode === "discussion-only" || mode === "internal-only") return "violet";
  return "amber";
}

function formatRiskSignal(signal: ConversationDetailRiskSignal, english: boolean) {
  if (signal === "high") return english ? "High risk" : "高风险";
  if (signal === "caution") return english ? "Move carefully" : "谨慎推进";
  return english ? "Watch closely" : "继续观察";
}
