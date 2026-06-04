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
  CommitmentReinforcementPageDetailReportingContract,
  CommitmentReinforcementSendabilityEvidenceGroup,
  CommitmentReinforcementSendabilityRiskSignal,
  CommitmentReinforcementStrengthMode,
  SendabilityPageDetailReportingContract,
  SendabilityPageMode,
} from "@/lib/presentation/commitment-reinforcement-sendability-detail-contract";
import {
  toCommitmentReinforcementPageReportingProtocol,
  toSendabilityPageReportingProtocol,
} from "@/lib/presentation/commitment-reinforcement-sendability-detail-contract";
import { createUnifiedDetailNavigationModel } from "@/lib/presentation/unified-detail-navigation";
import type { ProposalPackageCommercialDetail } from "@/features/proposal-package/proposal-package-detail-view";
import {
  formatRoleDetailDisplayText,
  formatRoleDetailEvidenceGroups,
  formatRoleDetailPageProtocol,
} from "@/lib/presentation/role-detail-display-copy";
import { formatDateLabel } from "@/lib/utils";

type ReinforcementPageProps = {
  mode: "reinforcement";
  detail: ProposalPackageCommercialDetail;
  english: boolean;
  contract: CommitmentReinforcementPageDetailReportingContract;
};

type SendabilityPageProps = {
  mode: "sendability";
  detail: ProposalPackageCommercialDetail;
  english: boolean;
  contract: SendabilityPageDetailReportingContract;
};

export function CommitmentReinforcementSendabilityDetailView(
  props: ReinforcementPageProps | SendabilityPageProps,
) {
  const { detail, english, mode } = props;
  const sourceProtocol =
    mode === "reinforcement"
      ? toCommitmentReinforcementPageReportingProtocol(props.contract, english)
      : toSendabilityPageReportingProtocol(props.contract, english);
  const text = (value: string | null | undefined) =>
    formatRoleDetailDisplayText(value, english);
  const protocol = formatRoleDetailPageProtocol(sourceProtocol, english);
  const sourceEvidenceGroups = evidenceGroups(mode, props);
  const displayEvidenceGroups = formatRoleDetailEvidenceGroups(
    sourceEvidenceGroups,
    english,
  );
  const strengthMode =
    mode === "reinforcement"
      ? props.contract.reinforcementPageStrengthMode
      : props.contract.sendabilityPageStrengthMode;
  const sendabilityMode =
    mode === "reinforcement"
      ? props.contract.reinforcementPageSendabilityMode
      : props.contract.sendabilityPageMode;
  const riskSignal =
    mode === "reinforcement"
      ? props.contract.reinforcementPageRiskSignal
      : props.contract.sendabilityPageRiskSignal;
  const title =
    mode === "reinforcement"
      ? english
        ? `${detail.title} commitment reinforcement detail`
        : `${detail.title} 承诺强化详情页`
      : english
        ? `${detail.title} sendability detail`
        : `${detail.title} 发送边界详情页`;
  const navigation = buildUnifiedNavigation({
    mode,
    detail,
    english,
    protocol,
    sendabilityMode,
    strengthMode,
    riskSignal,
  });
  const operatingSummaryItems = buildObjectContextDetailOperatingSummaryItems({
    english,
    protocol,
    objectStateLine: text(`${detail.stageLabel} · ${detail.riskLabel} · ${formatStrengthMode(
      strengthMode,
      english,
    )}`),
  });

  return (
    <div
      data-commitment-reinforcement-sendability-page="true"
      data-commitment-reinforcement-page={
        mode === "reinforcement" ? "true" : undefined
      }
      data-sendability-page={mode === "sendability" ? "true" : undefined}
      className="space-y-6"
    >
      <PageHeader
        eyebrow={
          mode === "reinforcement"
            ? english
              ? "External expression / Commitment reinforcement"
              : text("对外表达 / 承诺加固")
            : english
              ? "External expression / Sendability"
              : text("对外表达 / 发送评估")
        }
        title={text(title)}
        description={
          english
            ? `${detail.companyName ?? "No linked company"} · ${detail.contactNames[0] ?? "No linked contact"} · ${formatStrengthMode(strengthMode, english)}`
            : text(`${detail.companyName ?? "未关联公司"} · ${detail.contactNames[0] ?? "未关联联系人"} · ${formatStrengthMode(strengthMode, english)}`)
        }
        actions={
          <>
            <Button asChild>
              <Link href={`/opportunities?opportunityId=${detail.id}`}>
                {english ? "Open opportunity" : "打开机会页"}
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link
                href={
                  mode === "reinforcement"
                    ? `/sendability/${detail.id}`
                    : `/reinforcements/${detail.id}`
                }
              >
                {mode === "reinforcement"
                  ? english
                    ? "Open sendability page"
                    : text("打开发送评估页面")
                  : english
                    ? "Open reinforcement page"
                    : text("打开加固页面")}
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href={`/external-proposals/${detail.id}`}>
                {english ? "Open external proposal page" : text("打开外部提案页面")}
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href={`/external-narratives/${detail.id}`}>
                {english ? "Open external narrative page" : text("打开对外叙事页面")}
              </Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href={`/reinforcement-variants/${detail.id}`}>
                {english
                  ? "Open reinforcement variants page"
                  : text("打开加固变体页面")}
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
            mode === "reinforcement"
              ? english
                ? "Commitment reinforcement judgement"
                : text("承诺加固判断")
              : english
                ? "Sendability judgement"
                : text("发送评估判断"),
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
                label={text(formatStrengthMode(strengthMode, english))}
                tone={toneForStrengthMode(strengthMode)}
              />
              <EvidenceChip
                label={text(formatSendabilityMode(sendabilityMode, english))}
                tone={toneForSendability(sendabilityMode)}
              />
              <EvidenceChip
                label={text(formatRiskSignal(riskSignal, english))}
                tone={riskSignal === "high" ? "amber" : "violet"}
              />
              {protocol.pagePrioritySignal ? (
                <EvidenceChip label={protocol.pagePrioritySignal} tone="amber" />
              ) : null}
              <Badge variant="neutral">
                {`${detail.stageLabel} · ${detail.riskLabel}`}
              </Badge>
            </div>

            <div data-frontstage-block="current-summary">
              <DetailOperatingSummaryCard
                label={english ? "Current operating summary" : "当前操作摘要"}
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
                    ? "Boundary, reinforcement and sendability"
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
                  label: english ? "Reinforcement level" : text("当前加固"),
                  value: text(formatStrengthMode(strengthMode, english)),
                },
                {
                  label: english ? "Sendability" : "当前发送边界",
                  value: text(formatSendabilityMode(sendabilityMode, english)),
                },
                {
                  label: english
                    ? "Customer-visible strengthening"
                    : text("客户可见加固"),
                  value:
                    mode === "reinforcement"
                      ? text(props.contract.reinforcementPageCustomerVisibleCue)
                      : text(props.contract.sendabilityPageCustomerVisibleCue),
                },
                {
                  label: english ? "Internal-only wording" : text("仅内部话术"),
                  value:
                    mode === "reinforcement"
                      ? text(props.contract.reinforcementPageInternalOnlyCue)
                      : text(props.contract.sendabilityPageInternalOnlyCue),
                },
                {
                  label: english ? "Non-commitment" : text("非承诺说明"),
                  value:
                    mode === "reinforcement"
                      ? text(props.contract.reinforcementPageNonCommitmentCue)
                      : text(props.contract.sendabilityPageNonCommitmentCue),
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
                    ? `${displayEvidenceGroups.length} grouped tracks`
                    : `${displayEvidenceGroups.length} 组依据`
                }
                leadingChip={english ? "Appendix" : "附注层"}
              >
                <div className="grid gap-3">
                  {displayEvidenceGroups.map((group) => (
                    <div
                      key={group.groupId}
                      data-commitment-reinforcement-sendability-evidence-group={
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
  strengthMode,
  riskSignal,
}: {
  mode: "reinforcement" | "sendability";
  detail: ProposalPackageCommercialDetail;
  english: boolean;
  protocol: ReturnType<
    | typeof toCommitmentReinforcementPageReportingProtocol
    | typeof toSendabilityPageReportingProtocol
  >;
  sendabilityMode: SendabilityPageMode;
  strengthMode: CommitmentReinforcementStrengthMode;
  riskSignal: CommitmentReinforcementSendabilityRiskSignal;
}) {
  return createUnifiedDetailNavigationModel({
    currentNode: {
      detailNodeType: mode,
      detailNodeSummary: protocol.pageJudgement,
      detailNodeStage: detail.stageLabel,
      detailNodeBoundary: protocol.pageBoundarySummary[0],
      detailNodeAudienceMode:
        mode === "reinforcement"
          ? english
            ? "internal strengthening"
            : "内部强化"
          : english
            ? "sendability gate"
            : "发送关口",
      detailNodeSendabilityMode: formatSendabilityMode(sendabilityMode, english),
      detailNodeStrengthMode: formatStrengthMode(strengthMode, english),
      detailNodePrev:
        mode === "reinforcement"
          ? {
              type: "external-proposal",
              href: `/external-proposals/${detail.id}`,
              label: english
                ? "External proposal detail"
                : "外部提案详情",
              summary: english
                ? "Return to the external proposal when the issue is still overall wording structure, not reinforcement strength."
                : "如果问题仍是整体措辞结构，而不是加固强度，就回到外部提案 detail。",
            }
          : {
              type: "reinforcement",
              href: `/reinforcements/${detail.id}`,
              label: english ? "Reinforcement detail" : "承诺强化详情",
              summary: english
                ? "Return to reinforcement when the strengthening level itself still needs work before final sendability judgement."
                : "如果强化程度本身还没收稳、还不能定发送边界判断，就回到承诺强化详情。",
            },
      detailNodeNext:
        mode === "reinforcement"
          ? {
              type: "sendability",
              href: `/sendability/${detail.id}`,
              label: english ? "Sendability detail" : "发送边界详情",
              summary: english
                ? "Move here once reinforcement has been framed and the next question is whether anything may be sent."
                : "当强化表达已经收住、下一步问题变成能不能发时，切到发送边界详情。",
            }
          : null,
      detailNodeCurrentReason: protocol.pageJudgementReason,
      detailNodePriority: priorityForRisk(riskSignal),
      detailNodeNavigationHint:
        mode === "reinforcement"
          ? english
            ? "Use this detail when the team is deciding how far wording may be strengthened without crossing into commitment."
            : "当团队正在判断措辞能强化到多远、又不跨进承诺时，停在承诺强化详情。"
          : english
            ? "Use this detail when reinforcement has already been shaped and the remaining question is whether anything is safe to send."
            : "当强化表达已经收住、剩下的问题是有没有内容真正可安全外发时，停在发送边界详情。",
    },
    handoffs:
      mode === "reinforcement"
        ? [
            {
              handoffSource: "external-proposal",
              handoffTarget: "reinforcement",
              handoffReason: english
                ? "The external proposal is stable enough that the next useful decision is reinforcement strength, not more structural drafting."
                : "当前对外方案已足够稳定，下一步最有价值的决定是强化强度，而不是继续改结构。",
              handoffBoundary: protocol.pageBoundarySummary[0],
              handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
              handoffDependency: protocol.pageBoundarySummary[2] ?? null,
              handoffRisk: english
                ? "Any stronger wording can still be misread as commitment unless boundary and non-commitment cues stay explicit."
                : "更强措辞仍可能被误读成承诺，因此边界与非承诺提示必须持续显式。",
              handoffDecisionRequest: protocol.pageDecisionRequest[0],
              handoffNextAction:
                protocol.pageNextAction[0]?.label ??
                (english ? "Open reinforcement detail" : "打开承诺强化详情"),
              handoffWorkerSummary: protocol.pageWorkerSummary,
              handoffEvidenceSummary: protocol.pageEvidenceSummary,
              handoffVisibilityMode: "internal-only",
              handoffHref: `/reinforcements/${detail.id}`,
            },
            {
              handoffSource: "reinforcement",
              handoffTarget: "external-narrative",
              handoffReason: english
                ? "Before any stronger sendability move, step back into the outward narrative layer and decide what the story can safely carry."
                : "在继续判断更强发送动作之前，应先退回对外叙事层，判断当前故事到底能安全承载什么。",
              handoffBoundary: protocol.pageBoundarySummary[0],
              handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
              handoffDependency: protocol.pageBoundarySummary[2] ?? null,
              handoffRisk: english
                ? "If reinforcement outruns the narrative layer, it can still read like commitment."
                : "如果强化表达跑在对外叙事层前面，仍可能被读成承诺。",
              handoffDecisionRequest: protocol.pageDecisionRequest[0],
              handoffNextAction: english
                ? "Open external narrative detail"
                : "打开 对外叙事详情面",
              handoffWorkerSummary: protocol.pageWorkerSummary,
              handoffEvidenceSummary: protocol.pageEvidenceSummary,
              handoffVisibilityMode: "internal-only",
              handoffHref: `/external-narratives/${detail.id}`,
            },
          ]
        : [
            {
              handoffSource: "reinforcement",
              handoffTarget: "sendability",
              handoffReason: english
                ? "Reinforcement framing is now clear enough to judge sendability directly instead of staying in abstract strengthening talk."
                : "当前强化表达已经足够清楚，可以直接判断发送边界，而不必继续停留在抽象的强化讨论里。",
              handoffBoundary: protocol.pageBoundarySummary[0],
              handoffPrerequisite: protocol.pageBoundarySummary[1] ?? null,
              handoffDependency: protocol.pageBoundarySummary[2] ?? null,
              handoffRisk: english
                ? `Current sendability gate: ${formatSendabilityMode(sendabilityMode, english)}.`
                : `当前发送关口：${formatSendabilityMode(sendabilityMode, english)}。`,
              handoffDecisionRequest: protocol.pageDecisionRequest[0],
              handoffNextAction:
                protocol.pageNextAction[0]?.label ??
                (english ? "Use the next-step decision rail" : "使用下一步动作区"),
              handoffWorkerSummary: protocol.pageWorkerSummary,
              handoffEvidenceSummary: protocol.pageEvidenceSummary,
              handoffVisibilityMode:
                sendabilityMode === "safe-to-send"
                  ? "customer-facing-with-boundary"
                  : sendabilityMode === "review-before-send" ||
                      sendabilityMode === "not-safe-to-send"
                    ? "review-before-send"
                    : "internal-only",
              handoffHref: `/sendability/${detail.id}`,
            },
          ],
  });
}

function priorityForRisk(
  signal: CommitmentReinforcementSendabilityRiskSignal,
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

function formatStrengthMode(
  mode: CommitmentReinforcementStrengthMode,
  english: boolean,
) {
  switch (mode) {
    case "no-reinforcement":
      return english ? "No reinforcement" : "暂不强化";
    case "internal-reinforcement-only":
      return english ? "Internal reinforcement only" : "只允许内部强化";
    case "customer-visible-reinforcement":
      return english ? "Customer-visible reinforcement" : "允许客户可见强化";
    case "reinforcement-after-review":
      return english ? "Reinforcement after review" : "复核后再强化";
    case "reinforcement-after-risk-reduction":
      return english
        ? "Reinforcement after risk reduction"
        : "先降风险，再强化";
    case "reinforcement-blocked":
      return english ? "Reinforcement blocked" : "当前强化被阻断";
    case "reinforcement-deferred":
      return english ? "Reinforcement deferred" : "当前强化被延后";
    default:
      return english ? "Boundary-only reinforcement" : "仅允许带边界强化";
  }
}

function formatSendabilityMode(mode: SendabilityPageMode, english: boolean) {
  switch (mode) {
    case "safe-to-send":
      return english ? "Safe to send" : "可安全外发";
    case "safe-with-boundary":
      return english ? "Safe with boundary" : "可外发，但必须带边界";
    case "safe-with-prerequisite":
      return english
        ? "Safe with prerequisite"
        : "先补前置条件，再考虑外发";
    case "safe-with-dependency":
      return english ? "Safe with dependency" : "必须带依赖才能外发";
    case "safe-with-risk-note":
      return english ? "Safe with risk note" : "必须带风险备注才能外发";
    case "discussion-only":
      return english ? "Discussion only" : "只适合讨论";
    case "review-before-send":
      return english ? "Review before send" : "先复核，再决定是否外发";
    case "internal-only":
      return english ? "Internal only" : "仅限内部";
    default:
      return english ? "Not safe to send" : "当前不能外发";
  }
}

function toneForStrengthMode(
  mode: CommitmentReinforcementStrengthMode,
): "sky" | "amber" | "violet" | "emerald" {
  if (mode === "customer-visible-reinforcement") return "emerald";
  if (mode === "boundary-only-reinforcement") return "sky";
  if (mode === "internal-reinforcement-only") return "violet";
  if (mode === "reinforcement-after-review" || mode === "reinforcement-deferred") {
    return "amber";
  }
  if (mode === "reinforcement-after-risk-reduction" || mode === "reinforcement-blocked") {
    return "amber";
  }
  return "violet";
}

function toneForSendability(
  mode: SendabilityPageMode,
): "sky" | "amber" | "violet" | "emerald" {
  if (mode === "safe-to-send") return "emerald";
  if (mode === "safe-with-boundary") return "sky";
  if (
    mode === "safe-with-prerequisite" ||
    mode === "safe-with-dependency" ||
    mode === "safe-with-risk-note"
  ) {
    return "amber";
  }
  if (mode === "discussion-only" || mode === "internal-only") return "violet";
  return "amber";
}

function formatRiskSignal(
  signal: CommitmentReinforcementSendabilityRiskSignal,
  english: boolean,
) {
  if (signal === "high") return english ? "High risk" : "高风险";
  if (signal === "caution") return english ? "Move carefully" : "谨慎推进";
  return english ? "Watch closely" : "继续观察";
}

function evidenceGroups(
  mode: "reinforcement" | "sendability",
  props: ReinforcementPageProps | SendabilityPageProps,
): CommitmentReinforcementSendabilityEvidenceGroup[] {
  if (mode === "reinforcement" && props.mode === "reinforcement") {
    return props.contract.reinforcementPageEvidenceGroups;
  }

  if (mode === "sendability" && props.mode === "sendability") {
    return props.contract.sendabilityPageEvidenceGroups;
  }

  throw new Error(
    "commitment reinforcement / sendability evidence groups must stay aligned to mode",
  );
}
