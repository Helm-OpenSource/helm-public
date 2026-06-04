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
  buildDetailOperatingSummaryConnections,
  buildObjectContextDetailOperatingSummaryItems,
  DetailOperatingSummaryCard,
} from "@/components/shared/detail-operating-summary-card";
import { PageHeader } from "@/components/shared/page-header";
import { UnifiedDetailNavigationPanel } from "@/components/shared/unified-detail-navigation-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type {
  ExternalNarrativeDetailAudienceMode,
  ExternalNarrativeDetailFallbackMode,
  ExternalNarrativeDetailIntent,
  ExternalNarrativeDetailLevel,
  ExternalNarrativeDetailReportingContract,
  ExternalNarrativeDetailRiskSignal,
  ExternalNarrativeDetailSendabilityMode,
} from "@/lib/presentation/external-narrative-detail-contract";
import {
  toExternalNarrativeDetailPageReportingProtocol,
} from "@/lib/presentation/external-narrative-detail-contract";
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
  contract: ExternalNarrativeDetailReportingContract;
};

export function ExternalNarrativeDetailView({
  detail,
  english,
  contract,
}: Props) {
  const sourceProtocol = toExternalNarrativeDetailPageReportingProtocol(contract);
  const text = (value: string | null | undefined) =>
    formatRoleDetailDisplayText(value, english);
  const protocol = formatRoleDetailPageProtocol(sourceProtocol, english);
  const evidenceGroups = formatRoleDetailEvidenceGroups(
    contract.externalNarrativeDetailEvidenceGroups,
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
    objectStateLine: text(`${detail.stageLabel} · ${detail.riskLabel} · ${formatLevel(
      contract.externalNarrativeDetailLevel,
      english,
    )}`),
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

  return (
    <div data-external-narrative-detail-page="true" className="space-y-6">
      <PageHeader
        eyebrow={
          english
            ? "Commercial communication / External narrative"
            : text("商业沟通 / 对外叙事")
        }
        title={
          english
            ? `${detail.title} external narrative detail`
            : text(`${detail.title} 对外叙事详情页`)
        }
        description={
          english
            ? `${detail.companyName ?? "No linked company"} · ${detail.contactNames[0] ?? "No linked contact"} · ${formatLevel(
                contract.externalNarrativeDetailLevel,
                english,
              )}`
            : text(`${detail.companyName ?? "未关联公司"} · ${detail.contactNames[0] ?? "未关联联系人"} · ${formatLevel(
                contract.externalNarrativeDetailLevel,
                english,
              )}`)
        }
        actions={
          <>
            <Button asChild>
              <Link href={`/reinforcements/${detail.id}`}>
                {english ? "Open reinforcement page" : text("打开加固页面")}
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href={`/conversations/${detail.id}`}>
                {english ? "Open conversation page" : text("打开对话页面")}
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href={`/external-proposals/${detail.id}`}>
                {english
                  ? "Open external proposal page"
                  : text("打开外部提案页面")}
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href={`/external-narrative-fallbacks/${detail.id}`}>
                {english
                  ? "Open narrative fallback page"
                  : text("打开叙事兜底页面")}
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
          label:
            english ? "External narrative judgement" : text("对外叙事判断"),
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
                label={text(formatLevel(contract.externalNarrativeDetailLevel, english))}
                tone={toneForLevel(contract.externalNarrativeDetailLevel)}
              />
              <EvidenceChip
                label={text(formatSendabilityMode(
                  contract.externalNarrativeDetailSendabilityMode,
                  english,
                ))}
                tone={toneForSendability(
                  contract.externalNarrativeDetailSendabilityMode,
                )}
              />
              <EvidenceChip
                label={text(formatRiskSignal(
                  contract.externalNarrativeDetailRiskSignal,
                  english,
                ))}
                tone={
                  contract.externalNarrativeDetailRiskSignal === "high"
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
                  english
                    ? "Boundary, narrative and sendability"
                    : text("边界、叙事与发送评估")
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
                  label: english ? "Narrative level" : text("当前叙事层级"),
                  value: text(formatLevel(contract.externalNarrativeDetailLevel, english)),
                },
                {
                  label: english ? "Intent" : text("当前意图"),
                  value: text(formatIntent(contract.externalNarrativeDetailIntent, english)),
                },
                {
                  label: english ? "Audience mode" : text("当前受众模式"),
                  value: text(formatAudienceMode(
                    contract.externalNarrativeDetailAudienceMode,
                    english,
                  )),
                },
                {
                  label: english ? "Sendability" : text("当前发送评估"),
                  value: text(formatSendabilityMode(
                    contract.externalNarrativeDetailSendabilityMode,
                    english,
                  )),
                },
                {
                  label: english ? "Fallback" : text("当前兜底"),
                  value: text(formatFallbackMode(
                    contract.externalNarrativeDetailFallbackMode,
                    english,
                  )),
                },
                {
                  label: english ? "Founder cue" : text("创始人提示"),
                  value: text(contract.externalNarrativeDetailFounderCue),
                },
                {
                  label: english ? "Sales cue" : text("销售提示"),
                  value: text(contract.externalNarrativeDetailSalesCue),
                },
                {
                  label: english ? "Delivery cue" : text("交付提示"),
                  value: text(contract.externalNarrativeDetailDeliveryCue),
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
                label={english ? "Evidence drawer" : "证据抽屉"}
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
                      data-external-narrative-evidence-group={group.groupId}
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
  contract: ExternalNarrativeDetailReportingContract;
  protocol: ReturnType<typeof toExternalNarrativeDetailPageReportingProtocol>;
}) {
  return createUnifiedDetailNavigationModel({
    currentNode: {
      detailNodeType: "external-narrative",
      detailNodeSummary: protocol.pageJudgement,
      detailNodeStage: detail.stageLabel,
      detailNodeBoundary: protocol.pageBoundarySummary[0],
      detailNodeAudienceMode: formatAudienceMode(
        contract.externalNarrativeDetailAudienceMode,
        english,
      ),
      detailNodeSendabilityMode: formatSendabilityMode(
        contract.externalNarrativeDetailSendabilityMode,
        english,
      ),
      detailNodeStrengthMode: formatLevel(
        contract.externalNarrativeDetailLevel,
        english,
      ),
      detailNodePrev: {
        type: "conversation",
        href: `/conversations/${detail.id}`,
        label: english ? "Conversation detail" : "对话详情",
        summary: english
          ? "Return to the scene-specific talk track if the story still needs role or scene adjustment before reuse."
          : "如果故事还需要按角色或场景继续调整，再回到按场景组织的对话详情。",
      },
      detailNodeNext: {
        type: "reinforcement",
        href: `/reinforcements/${detail.id}`,
        label: english ? "Reinforcement detail" : "加固详情",
        summary: english
          ? "Move here once the narrative layer is stable enough that the next useful question is reinforcement strength."
          : "当叙事层已经足够稳定、下一步真正有价值的问题变成加固强度时，切到这里。",
      },
      detailNodeCurrentReason: protocol.pageJudgementReason,
      detailNodePriority: priorityForRisk(contract.externalNarrativeDetailRiskSignal),
      detailNodeNavigationHint: english
        ? "Use this detail when the team is deciding how far the outward story may go, what fallback still applies, and which role should carry the next narrative pass."
        : "当团队正在判断对外故事能走到多远、当前兜底还在什么位置、以及下一轮叙事修订该由谁来接时，停在这里。",
    },
    handoffs: [
      {
        handoffSource: "external-proposal",
        handoffTarget: "external-narrative",
        handoffReason: english
          ? "The external proposal is coherent enough to shape a reusable narrative layer instead of reworking the same structured draft."
          : "当前外部提案已经足够连贯，可以进一步整理成可复用的叙事层，而不是继续重写同一版结构化草稿。",
        handoffBoundary: protocol.pageBoundarySummary[0],
        handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
        handoffDependency: protocol.pageBoundarySummary[2] ?? null,
        handoffRisk: english
          ? "If this story outruns sendability or fallback, it can be misread as commitment."
          : "如果这层故事跑在发送评估或兜底前面，就可能被误读成承诺。",
        handoffDecisionRequest: protocol.pageDecisionRequest[0],
        handoffNextAction:
          protocol.pageNextAction[0]?.label ??
          (english
            ? "Open external narrative detail"
            : "打开对外叙事详情面"),
        handoffWorkerSummary: protocol.pageWorkerSummary,
        handoffEvidenceSummary: protocol.pageEvidenceSummary,
        handoffVisibilityMode:
          contract.externalNarrativeDetailSendabilityMode === "review-before-send" ||
          contract.externalNarrativeDetailSendabilityMode === "not-safe-to-send"
            ? "review-before-send"
            : "customer-facing-with-boundary",
        handoffHref: `/external-narratives/${detail.id}`,
      },
      {
        handoffSource: "reinforcement",
        handoffTarget: "external-narrative",
        handoffReason: english
          ? "When reinforcement pressure rises, this should step back into a clearer outward narrative layer before any stronger sendability move is judged."
          : "当加固压力上升时，这里应先退回更清楚的对外叙事层，再判断下一步更强的发送评估动作。",
        handoffBoundary: protocol.pageBoundarySummary[0],
        handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
        handoffDependency: protocol.pageBoundarySummary[2] ?? null,
        handoffRisk: english
          ? "Reinforcement can still overrun trust and promise boundaries unless fallback remains explicit."
          : "如果兜底不够显式，加固仍可能越过信任和承诺边界。",
        handoffDecisionRequest: protocol.pageDecisionRequest[0],
        handoffNextAction:
          protocol.pageNextAction[0]?.label ??
          (english
            ? "Open external narrative detail"
            : "打开对外叙事详情面"),
        handoffWorkerSummary: protocol.pageWorkerSummary,
        handoffEvidenceSummary: protocol.pageEvidenceSummary,
        handoffVisibilityMode: "internal-only",
        handoffHref: `/external-narratives/${detail.id}`,
      },
      {
        handoffSource: "external-narrative",
        handoffTarget: "narrative-fallback",
        handoffReason: english
          ? "If the story is coherent but still too strong to travel safely, isolate the fallback line before the next conversation or sendability move."
          : "如果故事本身已经连贯，但强度仍超过当前可安全外发的边界，就应先把兜底话术单独拎出来，再决定下一次对话或发送评估动作。",
        handoffBoundary: protocol.pageBoundarySummary[0],
        handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
        handoffDependency: protocol.pageBoundarySummary[2] ?? null,
        handoffRisk: english
          ? "Fallback that stays implicit can still let narrative pressure outrun non-commitment boundaries."
          : "如果兜底继续隐形，叙事压力仍可能跑在非承诺边界前面。",
        handoffDecisionRequest: protocol.pageDecisionRequest[0],
        handoffNextAction: english
          ? "Open narrative fallback detail"
          : "打开叙事兜底详情",
        handoffWorkerSummary: protocol.pageWorkerSummary,
        handoffEvidenceSummary: protocol.pageEvidenceSummary,
        handoffVisibilityMode:
          contract.externalNarrativeDetailSendabilityMode === "safe-to-send"
            ? "customer-facing-with-boundary"
            : "review-before-send",
        handoffHref: `/external-narrative-fallbacks/${detail.id}`,
      },
      {
        handoffSource: "external-narrative",
        handoffTarget: "conversation",
        handoffReason: english
          ? "Once the narrative layer is clear, it still needs translation into the right founder / sales / delivery scene before the next live conversation."
          : "当叙事层已经清楚后，仍需要先把它翻成适合创始人 / 销售 / 交付的具体场景，再进入下一次实时对话。",
        handoffBoundary: protocol.pageBoundarySummary[0],
        handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
        handoffDependency: protocol.pageBoundarySummary[2] ?? null,
        handoffRisk: english
          ? "Scene-specific talk can still overstate certainty even when the narrative layer itself looks coherent."
          : "即使叙事层本身已经连贯，具体到场景化对话时仍可能过度夸大确定性。",
        handoffDecisionRequest: protocol.pageDecisionRequest[0],
        handoffNextAction: english
          ? "Open conversation detail"
          : "打开对话详情",
        handoffWorkerSummary: protocol.pageWorkerSummary,
        handoffEvidenceSummary: protocol.pageEvidenceSummary,
        handoffVisibilityMode:
          contract.externalNarrativeDetailSendabilityMode === "safe-to-send"
            ? "customer-facing-with-boundary"
            : "internal-only",
        handoffHref: `/conversations/${detail.id}`,
      },
    ],
  });
}

function priorityForRisk(signal: ExternalNarrativeDetailRiskSignal) {
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

function formatLevel(level: ExternalNarrativeDetailLevel, english: boolean) {
  switch (level) {
    case "internal-framing":
      return english ? "Internal framing" : "内部构形";
    case "customer-visible-light":
      return english ? "Customer-visible light" : "轻量客户可见";
    case "customer-visible-structured":
      return english ? "Customer-visible structured" : "结构化客户可见";
    case "exploratory-narrative":
      return english ? "Exploratory narrative" : "探索型叙事";
    case "proposal-supporting-narrative":
      return english ? "Proposal-supporting narrative" : "提案支撑叙事";
    case "strengthening-narrative":
      return english ? "Strengthening narrative" : "加固叙事";
    case "review-before-send":
      return english ? "Review before send" : "发送前复核";
    case "boundary-only":
      return english ? "Boundary only" : "仅边界";
    case "non-commitment-fallback":
      return english ? "Non-commitment fallback" : "非承诺兜底";
    default:
      return english ? "Blocked narrative" : "受阻叙事";
  }
}

function formatIntent(
  intent: ExternalNarrativeDetailIntent,
  english: boolean,
) {
  switch (intent) {
    case "frame-internally":
      return english ? "Frame internally" : "先做内部措辞";
    case "support-proposal":
      return english ? "Support proposal" : "支持提案表达";
    case "support-strengthening":
      return english ? "Support strengthening" : "支持加固";
    case "warm-up-trust":
      return english ? "Warm up trust" : "抬高信任温度";
    case "hold-review-line":
      return english ? "Hold the review line" : "守住复核线";
    case "fallback-to-boundary":
      return english ? "Fallback to boundary" : "退回边界";
    default:
      return english ? "Reduce risk" : "先降风险";
  }
}

function formatAudienceMode(
  mode: ExternalNarrativeDetailAudienceMode,
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
  mode: ExternalNarrativeDetailSendabilityMode,
  english: boolean,
) {
  switch (mode) {
    case "safe-to-send":
      return english ? "Safe to send" : "可安全外发";
    case "safe-with-boundary":
      return english ? "Safe with boundary" : "带边界可外发";
    case "discussion-only":
      return english ? "Discussion only" : "只适合讨论";
    case "review-before-send":
      return english ? "Review before send" : "发送前先复核";
    case "internal-only":
      return english ? "Internal only" : "仅内部";
    case "non-commitment-fallback":
      return english ? "Non-commitment fallback" : "非承诺兜底";
    default:
      return english ? "Not safe to send" : "当前不能外发";
  }
}

function formatFallbackMode(
  mode: ExternalNarrativeDetailFallbackMode,
  english: boolean,
) {
  switch (mode) {
    case "boundary-only":
      return english ? "Boundary only" : "仅边界";
    case "non-commitment-fallback":
      return english ? "Non-commitment fallback" : "非承诺兜底";
    case "review-hold":
      return english ? "Review hold" : "复核暂缓";
    case "blocked":
      return english ? "Blocked" : "受阻";
    default:
      return english ? "No fallback" : "无需兜底";
  }
}

function toneForLevel(
  level: ExternalNarrativeDetailLevel,
): "sky" | "amber" | "violet" | "emerald" {
  if (
    level === "customer-visible-light" ||
    level === "customer-visible-structured"
  ) {
    return "emerald";
  }
  if (level === "proposal-supporting-narrative" || level === "strengthening-narrative") {
    return "sky";
  }
  if (level === "review-before-send" || level === "boundary-only") {
    return "amber";
  }
  return "violet";
}

function toneForSendability(
  mode: ExternalNarrativeDetailSendabilityMode,
): "sky" | "amber" | "violet" | "emerald" {
  if (mode === "safe-to-send") return "emerald";
  if (mode === "safe-with-boundary") return "sky";
  if (mode === "discussion-only" || mode === "internal-only") return "violet";
  return "amber";
}

function formatRiskSignal(
  signal: ExternalNarrativeDetailRiskSignal,
  english: boolean,
) {
  if (signal === "high") return english ? "High risk" : "高风险";
  if (signal === "caution") return english ? "Move carefully" : "谨慎推进";
  return english ? "Watch closely" : "继续观察";
}
