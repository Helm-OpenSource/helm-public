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
  CommercialNarrativeStrengtheningAudienceMode,
  CommercialNarrativeStrengtheningDetailReportingContract,
  CommercialNarrativeStrengtheningFallbackMode,
  CommercialNarrativeStrengtheningIntent,
  CommercialNarrativeStrengtheningLevel,
  CommercialNarrativeStrengtheningRiskSignal,
  CommercialNarrativeStrengtheningSendabilityMode,
} from "@/lib/presentation/commercial-narrative-strengthening-contract";
import {
  toCommercialNarrativeStrengtheningPageReportingProtocol,
} from "@/lib/presentation/commercial-narrative-strengthening-contract";
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
  contract: CommercialNarrativeStrengtheningDetailReportingContract;
};

export function CommercialNarrativeStrengtheningDetailView({
  detail,
  english,
  contract,
}: Props) {
  const sourceProtocol =
    toCommercialNarrativeStrengtheningPageReportingProtocol(contract);
  const text = (value: string | null | undefined) =>
    formatRoleDetailDisplayText(value, english);
  const protocol = formatRoleDetailPageProtocol(sourceProtocol, english);
  const evidenceGroups = formatRoleDetailEvidenceGroups(
    contract.strengtheningEvidenceGroups,
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
    objectStateLine: text(`${detail.stageLabel} · ${detail.riskLabel} · ${formatStrengtheningLevel(
      contract.strengtheningLevel,
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
    <div
      data-commercial-narrative-strengthening-page="true"
      className="space-y-6"
    >
      <PageHeader
        eyebrow={
          english
            ? "Commercial expression / Narrative strengthening"
            : text("商业表达 / 叙事加固")
        }
        title={
          english
            ? `${detail.title} commercial strengthening detail`
            : text(`${detail.title} commercial 加固详情页`)
        }
        description={
          english
            ? `${detail.companyName ?? "No linked company"} · ${detail.contactNames[0] ?? "No linked contact"} · ${formatStrengtheningLevel(
                contract.strengtheningLevel,
                english,
              )}`
            : text(`${detail.companyName ?? "未关联公司"} · ${detail.contactNames[0] ?? "未关联联系人"} · ${formatStrengtheningLevel(
                contract.strengtheningLevel,
                english,
              )}`)
        }
        actions={
          <>
            <Button asChild>
              <Link href={`/reinforcement-variants/${detail.id}`}>
                {english
                  ? "Open reinforcement variants page"
                  : text("打开加固变体s 页面")}
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href={`/sendability/${detail.id}`}>
                {english ? "Open sendability page" : text("打开发送评估页面")}
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
              <Link href={`/external-narratives/${detail.id}`}>
                {english
                  ? "Open external narrative page"
                  : text("打开对外叙事页面")}
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
            english
              ? "Commercial narrative strengthening judgement"
              : text("Commercial 叙事加固判断"),
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
                label={text(formatStrengtheningLevel(contract.strengtheningLevel, english))}
                tone={toneForStrengtheningLevel(contract.strengtheningLevel)}
              />
              <EvidenceChip
                label={text(formatSendabilityMode(
                  contract.strengtheningSendabilityMode,
                  english,
                ))}
                tone={toneForSendability(contract.strengtheningSendabilityMode)}
              />
              <EvidenceChip
                label={text(formatRiskSignal(contract.strengtheningRiskSignal, english))}
                tone={contract.strengtheningRiskSignal === "high" ? "amber" : "violet"}
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
                    ? "Boundary, strengthening and sendability"
                    : text("边界、加固与发送评估")
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
                  label: english ? "Strengthening level" : text("当前加固"),
                  value: text(formatStrengtheningLevel(contract.strengtheningLevel, english)),
                },
                {
                  label: english ? "Intent" : text("当前意图"),
                  value: text(formatIntent(contract.strengtheningIntent, english)),
                },
                {
                  label: english ? "Audience mode" : text("当前受众模式"),
                  value: text(formatAudienceMode(contract.strengtheningAudienceMode, english)),
                },
                {
                  label: english ? "Sendability" : text("当前发送评估"),
                  value: text(formatSendabilityMode(
                    contract.strengtheningSendabilityMode,
                    english,
                  )),
                },
                {
                  label: english ? "Fallback" : text("当前兜底"),
                  value: text(formatFallbackMode(contract.strengtheningFallbackMode, english)),
                },
                {
                  label: english ? "Customer-visible cue" : text("customer-visible cue"),
                  value: text(contract.strengtheningCustomerVisibleCue),
                },
                {
                  label: english ? "Internal-only cue" : text("internal-only cue"),
                  value: text(contract.strengtheningInternalOnlyCue),
                },
                {
                  label: english ? "Fallback cue" : text("兜底说明"),
                  value: text(contract.strengtheningFallbackCue),
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
                      data-commercial-strengthening-evidence-group={group.groupId}
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
  detail,
  english,
  contract,
  protocol,
}: {
  detail: ProposalPackageCommercialDetail;
  english: boolean;
  contract: CommercialNarrativeStrengtheningDetailReportingContract;
  protocol: ReturnType<typeof toCommercialNarrativeStrengtheningPageReportingProtocol>;
}) {
  return createUnifiedDetailNavigationModel({
    currentNode: {
      detailNodeType: "commercial-strengthening",
      detailNodeSummary: protocol.pageJudgement,
      detailNodeStage: formatStrengtheningLevel(contract.strengtheningLevel, english),
      detailNodeBoundary: protocol.pageBoundarySummary[0],
      detailNodeAudienceMode: formatAudienceMode(
        contract.strengtheningAudienceMode,
        english,
      ),
      detailNodeSendabilityMode: formatSendabilityMode(
        contract.strengtheningSendabilityMode,
        english,
      ),
      detailNodeStrengthMode: formatStrengtheningLevel(
        contract.strengtheningLevel,
        english,
      ),
      detailNodePrev: {
        type: "reinforcement-variants",
        href: `/reinforcement-variants/${detail.id}`,
        label: english
          ? "Reinforcement variants detail"
          : "加固变体详情",
        summary: english
          ? "Return to reinforcement variants before deciding which strengthening layer should carry the narrative."
          : "回到加固变体s，再确认当前到底由哪一层加固承载商业叙事。",
      },
      detailNodeNext: {
        type: "sendability",
        href: `/sendability/${detail.id}`,
        label: english ? "Sendability detail" : "发送评估详情",
        summary: english
          ? "Once the strengthening layer is explicit, switch to sendability to confirm what may actually move outward now."
          : "当加固层已经说清楚后，再切到发送评估去确认现在到底什么可以向外移动。",
      },
      detailNodeCurrentReason: protocol.pageJudgementReason,
      detailNodePriority:
        contract.strengtheningRiskSignal === "high"
          ? "urgent"
          : contract.strengtheningRiskSignal === "caution"
            ? "important"
            : "watch",
      detailNodeNavigationHint: english
        ? "Use this detail when the team needs to explain how strong the commercial narrative should get before sendability becomes the next useful detail."
        : "当 Helm 需要先解释商业叙事到底该强化到哪一层，再决定发送评估时，就先停在这里。",
    },
    handoffs: [
      {
        handoffSource: "reinforcement-variants",
        handoffTarget: "commercial-strengthening",
        handoffReason: english
          ? "The reinforcement options are already visible. The next useful detail is deciding which strengthening layer the commercial story should stop at."
          : "当前加固选项已经可见，下一步真正有价值的是决定商业叙事到底该停在哪一层加固。",
        handoffBoundary: protocol.pageBoundarySummary[0],
        handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
        handoffDependency: protocol.pageBoundarySummary[2] ?? null,
        handoffRisk: english
          ? `Current strengthening risk: ${formatRiskSignal(contract.strengtheningRiskSignal, english)}.`
          : `当前加固风险：${formatRiskSignal(contract.strengtheningRiskSignal, english)}。`,
        handoffDecisionRequest: protocol.pageDecisionRequest[0],
        handoffNextAction:
          protocol.pageNextAction[0]?.label ??
          (english
            ? "Open commercial strengthening detail"
            : "打开商业加固详情"),
        handoffWorkerSummary: protocol.pageWorkerSummary,
        handoffEvidenceSummary: protocol.pageEvidenceSummary,
        handoffVisibilityMode:
          contract.strengtheningAudienceMode === "customer-visible"
            ? "customer-facing-with-boundary"
            : "internal-only",
        handoffHref: `/commercial-strengthening/${detail.id}`,
      },
      {
        handoffSource: "commercial-strengthening",
        handoffTarget: "sendability",
        handoffReason: english
          ? "Once the strengthening layer is stable, the next useful detail is sendability, not more restating of the story."
          : "当加固层已经稳定后，下一步真正有价值的是发送评估，而不是继续重复叙事本身。",
        handoffBoundary: protocol.pageBoundarySummary[0],
        handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
        handoffDependency: protocol.pageBoundarySummary[2] ?? null,
        handoffRisk: english
          ? "Switching into sendability changes what may actually move outward, so boundary and fallback cues must stay attached."
          : "切到发送评估会改变到底哪些内容真的可以向外移动，所以边界和兜底线索必须继续一起带过去。",
        handoffDecisionRequest: protocol.pageDecisionRequest[0],
        handoffNextAction:
          protocol.pageNextAction[0]?.label ??
          (english ? "Open sendability detail" : "打开发送评估详情"),
        handoffWorkerSummary: protocol.pageWorkerSummary,
        handoffEvidenceSummary: protocol.pageEvidenceSummary,
        handoffVisibilityMode:
          contract.strengtheningSendabilityMode === "review-before-send"
            ? "review-before-send"
            : contract.strengtheningAudienceMode === "customer-visible"
              ? "customer-facing-with-boundary"
              : "internal-only",
        handoffHref: `/sendability/${detail.id}`,
      },
    ],
  });
}

function SecondarySummaryCard({
  label,
  items,
}: {
  label: string;
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <div className="theme-detail-shell-card rounded-[22px] px-4 py-4">
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
        {label}
      </p>
      <div className="mt-3 grid gap-3">
        {items.map((item) => (
          <div
            key={`${item.label}-${item.value}`}
            className="theme-detail-shell-tile rounded-[16px] px-3 py-3"
          >
            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
              {item.label}
            </p>
            <p className="mt-2 text-sm leading-7 text-[color:var(--dark-inset-foreground)]">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function toneForStrengtheningLevel(level: CommercialNarrativeStrengtheningLevel) {
  if (level.includes("customer-visible")) return "emerald";
  if (level.includes("pilot")) return "amber";
  if (
    level === "review-before-send" ||
    level === "risk-reduction-required" ||
    level === "blocked-strengthening"
  ) {
    return "violet";
  }
  return "sky";
}

function toneForSendability(mode: CommercialNarrativeStrengtheningSendabilityMode) {
  switch (mode) {
    case "safe-to-send":
      return "emerald";
    case "safe-with-boundary":
      return "sky";
    case "review-before-send":
      return "amber";
    default:
      return "violet";
  }
}

function formatStrengtheningLevel(
  level: CommercialNarrativeStrengtheningLevel,
  english: boolean,
) {
  switch (level) {
    case "recommendation-only":
      return english ? "Recommendation only" : "仅 recommendation";
    case "exploratory-strengthening":
      return english ? "Exploratory strengthening" : "Exploratory 强化";
    case "pilot-strengthening":
      return english ? "Pilot strengthening" : "Pilot 强化";
    case "customer-visible-light":
      return english ? "Customer-visible light" : "轻量客户可见";
    case "customer-visible-structured":
      return english ? "Customer-visible structured" : "结构化客户可见";
    case "review-before-send":
      return english ? "Review before send" : "发送前复核";
    case "risk-reduction-required":
      return english ? "Risk reduction required" : "先降风险";
    case "boundary-only":
      return english ? "Boundary only" : "仅边界";
    case "non-commitment-fallback":
      return english ? "Non-commitment fallback" : "非承诺回退";
    default:
      return english ? "Blocked strengthening" : "强化阻塞";
  }
}

function formatIntent(
  intent: CommercialNarrativeStrengtheningIntent,
  english: boolean,
) {
  switch (intent) {
    case "clarify-fit":
      return english ? "Clarify fit" : "澄清匹配";
    case "warm-up-trust":
      return english ? "Warm up trust" : "升温信任";
    case "advance-pilot-story":
      return english ? "Advance pilot story" : "推进 pilot 叙事";
    case "build-customer-confidence":
      return english ? "Build customer confidence" : "建立客户信心";
    case "hold-review-line":
      return english ? "Hold review line" : "守住复核线";
    case "fallback-to-boundary":
      return english ? "Fallback to boundary" : "回退到边界";
    default:
      return english ? "Reduce risk" : "降低风险";
  }
}

function formatAudienceMode(
  mode: CommercialNarrativeStrengtheningAudienceMode,
  english: boolean,
) {
  switch (mode) {
    case "customer-visible":
      return english ? "Customer-visible" : "可对外";
    case "shared-review":
      return english ? "Shared review" : "共享复核";
    default:
      return english ? "Internal only" : "仅内部";
  }
}

function formatSendabilityMode(
  mode: CommercialNarrativeStrengtheningSendabilityMode,
  english: boolean,
) {
  switch (mode) {
    case "safe-to-send":
      return english ? "Safe to send" : "可发送";
    case "safe-with-boundary":
      return english ? "Safe with boundary" : "带边界可发送";
    case "discussion-only":
      return english ? "Discussion only" : "仅讨论";
    case "review-before-send":
      return english ? "Review before send" : "发送前复核";
    case "not-safe-to-send":
      return english ? "Not safe to send" : "不可发送";
    case "internal-only":
      return english ? "Internal only" : "仅内部";
    default:
      return english ? "Non-commitment fallback" : "非承诺回退";
  }
}

function formatFallbackMode(
  mode: CommercialNarrativeStrengtheningFallbackMode,
  english: boolean,
) {
  switch (mode) {
    case "no-fallback":
      return english ? "No fallback" : "无需回退";
    case "boundary-only":
      return english ? "Boundary only" : "仅边界";
    case "non-commitment-fallback":
      return english ? "Non-commitment fallback" : "非承诺回退";
    case "review-hold":
      return english ? "Review hold" : "复核暂停";
    default:
      return english ? "Blocked" : "阻塞";
  }
}

function formatRiskSignal(
  signal: CommercialNarrativeStrengtheningRiskSignal,
  english: boolean,
) {
  if (signal === "high") return english ? "High risk" : "高风险";
  if (signal === "caution") return english ? "Caution" : "谨慎强化";
  return english ? "Watch" : "继续观察";
}
