"use client";

import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buildPaidWithoutExportOperatorReadout } from "@/features/settings/formatters/billing-readout-narratives";
import { formatSettingsCommercialText } from "@/features/settings/display-copy";
import {
  payoutRailPilotChecklistLabels,
  payoutRailPilotCohortStatusLabels,
  payoutRailPilotNextMoveLabels,
  payoutRailReadinessBlockerLabels,
  payoutRailReadinessStatusLabels,
  payoutRailReadinessWatchpointLabels,
  revenueBeneficiaryLabels,
  settlementOpsNextMoveLabels,
} from "@/features/settings/formatters/labels";
import type { SettingsClientProps } from "@/features/settings/types/settings-client-props";
import { Info } from "./settings-display";

type BillingPayoutReadinessData = Pick<
  SettingsClientProps["data"],
  "payoutRailPilotCohort" | "payoutRailReadiness" | "settlementOpsProofPack"
>;

type BillingPayoutReadinessPanelsProps = {
  data: BillingPayoutReadinessData;
  english: boolean;
  payoutRailPilotCohortNarrative: string;
  payoutRailPilotCohortVariant: ComponentProps<typeof Badge>["variant"];
  payoutRailReadinessNarrative: string;
  payoutRailReadinessVariant: ComponentProps<typeof Badge>["variant"];
  settlementOpsProofNarrative: string;
};

function formatPayoutRailPilotExportField(field: string, english: boolean) {
  if (english) return field;

  const labels: Record<string, string> = {
    beneficiary: "受益方",
    "beneficiary type": "受益方类型",
    "source type": "来源类型",
    amount: "金额",
    status: "状态",
    "notes/reference": "备注 / 引用",
  };

  return labels[field] ?? formatSettingsCommercialText(field, english);
}

function formatPayoutRailPilotNoGoTrigger(item: string, english: boolean) {
  if (english) return item;

  const labels: Record<string, string> = {
    "profile mismatch against exported lines": "结算资料与已导出条目不一致",
    "beneficiary scope confusion across classes": "受益方范围跨类型混淆",
    "exports that cannot be reconciled back into settlement posture":
      "导出结果无法回到结算状态复核",
    "reversal ambiguity that can no longer be handled manually":
      "冲回边界已经无法由人工清楚处理",
  };

  return labels[item] ?? formatSettingsCommercialText(item, english);
}

export function BillingPayoutReadinessPanels({
  data,
  english,
  payoutRailPilotCohortNarrative,
  payoutRailPilotCohortVariant,
  payoutRailReadinessNarrative,
  payoutRailReadinessVariant,
  settlementOpsProofNarrative,
}: BillingPayoutReadinessPanelsProps) {
  const proofAuditReadout =
    data.settlementOpsProofPack.paidWithoutExportCount > 0
      ? buildPaidWithoutExportOperatorReadout({
          english,
          paidWithoutExportCount:
            data.settlementOpsProofPack.paidWithoutExportCount,
          scope: "proof",
        })
      : null;
  const readinessAuditReadout =
    data.payoutRailReadiness.paidWithoutExportCount > 0
      ? buildPaidWithoutExportOperatorReadout({
          english,
          paidWithoutExportCount:
            data.payoutRailReadiness.paidWithoutExportCount,
          scope: "readiness",
        })
      : null;

  return (
    <>
      <Card data-settlement-ops-proof-pack="true">
        <CardHeader>
          <CardTitle>
            {english ? "Settlement operations proof pack" : "结算运营证据包"}
          </CardTitle>
          <CardDescription>
            {english
              ? "Coverage, history, audit pressure, next manual steps — for operator review."
              : "资料覆盖、历史、审计压力、下一步手工动作——供运营复核。"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
            <Info
              label={english ? "Beneficiaries in scope" : "范围内受益方"}
              value={
                english
                  ? `${data.settlementOpsProofPack.requiredBeneficiaryCount}`
                  : `${data.settlementOpsProofPack.requiredBeneficiaryCount} 个`
              }
            />
            <Info
              label={english ? "Profile covered" : "资料已覆盖"}
              value={
                english
                  ? `${data.settlementOpsProofPack.coveredByActivePayoutProfileCount}`
                  : `${data.settlementOpsProofPack.coveredByActivePayoutProfileCount} 个`
              }
            />
            <Info
              label={english ? "Profile missing" : "缺少资料"}
              value={
                english
                  ? `${data.settlementOpsProofPack.missingPayoutProfileCount}`
                  : `${data.settlementOpsProofPack.missingPayoutProfileCount} 个`
              }
            />
            <Info
              label={english ? "Participant covered" : "参与方已覆盖"}
              value={
                english
                  ? `${data.settlementOpsProofPack.coveredByParticipantAccessCount}`
                  : `${data.settlementOpsProofPack.coveredByParticipantAccessCount} 个`
              }
            />
            <Info
              label={english ? "Participant missing" : "缺少参与方访问"}
              value={
                english
                  ? `${data.settlementOpsProofPack.missingParticipantAccessCount}`
                  : `${data.settlementOpsProofPack.missingParticipantAccessCount} 个`
              }
            />
            <Info
              label={
                english
                  ? "Export-backed completion lines"
                  : "带导出证据的完成条目"
              }
              value={
                english
                  ? `${data.settlementOpsProofPack.manualCompletionCount}`
                  : `${data.settlementOpsProofPack.manualCompletionCount} 条`
              }
            />
            <Info
              label={english ? "Paid without export" : "已支付但缺导出证据"}
              value={
                english
                  ? `${data.settlementOpsProofPack.paidWithoutExportCount}`
                  : `${data.settlementOpsProofPack.paidWithoutExportCount} 条`
              }
            />
          </div>

          <div className="theme-surface-panel-soft rounded-2xl px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
            {settlementOpsProofNarrative}
          </div>

          {proofAuditReadout ? (
            <div className="theme-surface-panel-soft rounded-2xl px-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="warning">
                  {english ? "Audit before proof" : "先审计再算证明"}
                </Badge>
                <p className="text-sm font-medium text-[color:var(--foreground)]">
                  {english
                    ? "Paid-without-export lines are still open"
                    : "仍有已支付但缺导出证据的条目"}
                </p>
              </div>
              <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                {proofAuditReadout}
              </p>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="theme-surface-panel rounded-2xl px-4 py-4">
              <p className="text-sm font-semibold text-[color:var(--foreground)]">
                {english
                  ? "Missing payout profile coverage"
                  : "缺少结算资料覆盖"}
              </p>
              <div className="mt-3 space-y-2 text-sm leading-6 text-[color:var(--muted)]">
                {data.settlementOpsProofPack.missingPayoutProfileBeneficiaries
                  .length ? (
                  data.settlementOpsProofPack.missingPayoutProfileBeneficiaries.map(
                    (item) => (
                      <p key={item.key}>
                        {item.beneficiaryLabel} ·{" "}
                        {
                          revenueBeneficiaryLabels[item.beneficiaryType][
                            english ? "en" : "zh"
                          ]
                        }
                      </p>
                    ),
                  )
                ) : (
                  <p>
                    {english
                      ? "All beneficiary scopes currently in settlement posture already have an active payout profile."
                      : "当前进入结算姿态的受益方范围都已经有生效中的结算资料。"}
                  </p>
                )}
              </div>
            </div>

            <div className="theme-surface-panel rounded-2xl px-4 py-4">
              <p className="text-sm font-semibold text-[color:var(--foreground)]">
                {english
                  ? "Missing participant coverage"
                  : "缺少参与方访问覆盖"}
              </p>
              <div className="mt-3 space-y-2 text-sm leading-6 text-[color:var(--muted)]">
                {data.settlementOpsProofPack
                  .missingParticipantAccessBeneficiaries.length ? (
                  data.settlementOpsProofPack.missingParticipantAccessBeneficiaries.map(
                    (item) => (
                      <p key={item.key}>
                        {item.beneficiaryLabel} ·{" "}
                        {
                          revenueBeneficiaryLabels[item.beneficiaryType][
                            english ? "en" : "zh"
                          ]
                        }
                      </p>
                    ),
                  )
                ) : (
                  <p>
                    {english
                      ? "All beneficiary scopes currently in settlement posture already have invited or active participant access."
                      : "当前进入结算姿态的受益方范围都已经有已邀请或已激活的参与方访问权限。"}
                  </p>
                )}
              </div>
            </div>

            <div className="theme-surface-panel rounded-2xl px-4 py-4">
              <p className="text-sm font-semibold text-[color:var(--foreground)]">
                {english ? "Next proof moves" : "下一步证明动作"}
              </p>
              <div className="mt-3 space-y-2 text-sm leading-6 text-[color:var(--muted)]">
                {data.settlementOpsProofPack.nextMoves.length ? (
                  data.settlementOpsProofPack.nextMoves.map((move) => (
                    <p key={move}>
                      {settlementOpsNextMoveLabels[move][english ? "en" : "zh"]}
                    </p>
                  ))
                ) : (
                  <p>
                    {english
                      ? "The current proof pack already covers the main operational gaps. Keep running manual settlement honestly before touching payout rails."
                      : "当前证据包已经覆盖主要运营缺口。继续诚实跑手工结算，再决定是否接支付通道。"}
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card data-payout-rails-readiness-gate="true">
        <CardHeader>
          <CardTitle>
            {english ? "Payout rails readiness gate" : "支付通道准备度闸口"}
          </CardTitle>
          <CardDescription>
            {english
              ? "Internal-only go/no-go lens for a future narrow payout-rail PR. It explains whether payout profile coverage, settlement practice, participant posture, and paid-without-export watchpoints are mature enough, while staying separate from payout execution, public portals, and marketplace behavior."
              : "这是内部可读的放行 / 暂不放行判断层，用来回答未来是否值得接一条窄的支付通道变更。它只根据结算资料覆盖、手工结算实操、参与方姿态以及已支付但缺导出证据的观察点做判断，并继续和支付执行、公开门户、能力市场分离。"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={payoutRailReadinessVariant}>
              {
                payoutRailReadinessStatusLabels[
                  data.payoutRailReadiness.status
                ][english ? "en" : "zh"]
              }
            </Badge>
            <span className="text-sm leading-6 text-[color:var(--muted)]">
              {english
                ? "This is not payout execution, a partner portal, or marketplace readiness."
                : "这不是支付执行、伙伴门户或能力市场就绪度。"}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
            <Info
              label={english ? "Active profiles" : "生效资料数"}
              value={
                english
                  ? `${data.payoutRailReadiness.activePayoutProfileCount}`
                  : `${data.payoutRailReadiness.activePayoutProfileCount} 个`
              }
            />
            <Info
              label={english ? "Settlement batches" : "结算批次"}
              value={
                english
                  ? `${data.payoutRailReadiness.settlementBatchCount}`
                  : `${data.payoutRailReadiness.settlementBatchCount} 个`
              }
            />
            <Info
              label={
                english ? "Exported / closed batches" : "已导出 / 已关闭批次"
              }
              value={
                english
                  ? `${data.payoutRailReadiness.exportedOrClosedBatchCount}`
                  : `${data.payoutRailReadiness.exportedOrClosedBatchCount} 个`
              }
            />
            <Info
              label={
                english
                  ? "Export-backed completion lines"
                  : "带导出证据的完成条目"
              }
              value={
                english
                  ? `${data.payoutRailReadiness.manualCompletionCount}`
                  : `${data.payoutRailReadiness.manualCompletionCount} 条`
              }
            />
            <Info
              label={english ? "Paid without export" : "已支付但缺导出证据"}
              value={
                english
                  ? `${data.payoutRailReadiness.paidWithoutExportCount}`
                  : `${data.payoutRailReadiness.paidWithoutExportCount} 条`
              }
            />
            <Info
              label={
                english
                  ? "Invited / active participants"
                  : "已邀请 / 已激活参与方"
              }
              value={
                english
                  ? `${data.payoutRailReadiness.invitedOrActiveParticipantCount}`
                  : `${data.payoutRailReadiness.invitedOrActiveParticipantCount} 个`
              }
            />
            <Info
              label={english ? "Current missing profiles" : "当前缺少资料"}
              value={
                english
                  ? `${data.payoutRailReadiness.currentBatchMissingProfileCount}`
                  : `${data.payoutRailReadiness.currentBatchMissingProfileCount} 条`
              }
            />
          </div>

          <div className="theme-surface-panel-soft rounded-2xl px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
            {payoutRailReadinessNarrative}
          </div>

          {readinessAuditReadout ? (
            <div className="theme-surface-panel-soft rounded-2xl px-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="warning">
                  {english ? "Clear this watchpoint first" : "先清掉这个观察点"}
                </Badge>
                <p className="text-sm font-medium text-[color:var(--foreground)]">
                  {english
                    ? "Paid-without-export still weakens the gate"
                    : "已支付但缺导出证据仍在削弱闸口判断"}
                </p>
              </div>
              <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                {readinessAuditReadout}
              </p>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="theme-surface-panel rounded-2xl px-4 py-4">
              <p className="text-sm font-semibold text-[color:var(--foreground)]">
                {english ? "Readiness blockers" : "准备度阻塞"}
              </p>
              <div className="mt-3 space-y-2 text-sm leading-6 text-[color:var(--muted)]">
                {data.payoutRailReadiness.blockers.length ? (
                  data.payoutRailReadiness.blockers.map((blocker) => (
                    <p key={blocker}>
                      {
                        payoutRailReadinessBlockerLabels[blocker][
                          english ? "en" : "zh"
                        ]
                      }
                    </p>
                  ))
                ) : (
                  <p>
                    {english
                      ? "No blocking signal is open. The gate can now be judged by operating proof rather than missing foundations."
                      : "当前没有阻断信号打开，后续判断可以更多看运营证据，而不是基础缺口。"}
                  </p>
                )}
              </div>
            </div>

            <div className="theme-surface-panel rounded-2xl px-4 py-4">
              <p className="text-sm font-semibold text-[color:var(--foreground)]">
                {english ? "Watchpoints before rails" : "接入前观察点"}
              </p>
              <div className="mt-3 space-y-2 text-sm leading-6 text-[color:var(--muted)]">
                {data.payoutRailReadiness.watchpoints.length ? (
                  data.payoutRailReadiness.watchpoints.map((watchpoint) => (
                    <p key={watchpoint}>
                      {
                        payoutRailReadinessWatchpointLabels[watchpoint][
                          english ? "en" : "zh"
                        ]
                      }
                    </p>
                  ))
                ) : (
                  <p>
                    {english
                      ? "The current evidence set is strong enough for a narrow pilot discussion. Keep scope tight and preserve manual fallback."
                      : "当前证据集已经足够支持窄试点讨论，但后续仍应保持范围收紧，并保留手工回退。"}
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card data-payout-rail-pilot-cohort="true">
        <CardHeader>
          <CardTitle>
            {english
              ? "Payout rail pilot cohort / operator pack"
              : "支付通道试点人群 / 运营包"}
          </CardTitle>
          <CardDescription>
            {english
              ? "Internal-only operator pack for choosing one narrow pilot cohort and rehearsing an off-platform dry run. It does not start payout execution, a public portal, or marketplace behavior."
              : "这是内部运营包，用来先选定一条足够窄的试点人群，并演练一次站外试跑。它不会启动支付执行、公开门户或能力市场行为。"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant={payoutRailPilotCohortVariant}>
              {
                payoutRailPilotCohortStatusLabels[
                  data.payoutRailPilotCohort.status
                ][english ? "en" : "zh"]
              }
            </Badge>
            <span className="text-sm leading-6 text-[color:var(--muted)]">
              {english
                ? "This pack only helps operators choose a narrow pilot cohort and rehearse a dry run. It does not start payout execution."
                : "这层只帮助运营侧选择一条窄试点人群并演练试跑，不会启动支付执行。"}
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Info
              label={english ? "Eligible cohorts" : "可评估人群"}
              value={
                english
                  ? `${data.payoutRailPilotCohort.eligibleCohortCount}`
                  : `${data.payoutRailPilotCohort.eligibleCohortCount} 条`
              }
            />
            <Info
              label={english ? "Ready cohorts" : "已就绪人群"}
              value={
                english
                  ? `${data.payoutRailPilotCohort.readyCohortCount}`
                  : `${data.payoutRailPilotCohort.readyCohortCount} 条`
              }
            />
            <Info
              label={english ? "Recommended class" : "推荐受益方类别"}
              value={
                data.payoutRailPilotCohort.recommendedBeneficiaryType
                  ? revenueBeneficiaryLabels[
                      data.payoutRailPilotCohort.recommendedBeneficiaryType
                    ][english ? "en" : "zh"]
                  : english
                    ? "Not yet"
                    : "尚未形成"
              }
            />
            <Info
              label={english ? "Recommended currency" : "推荐币种"}
              value={
                data.payoutRailPilotCohort.recommendedCurrency ??
                (english ? "Not yet" : "尚未形成")
              }
            />
            <Info
              label={english ? "Recommended payout method" : "推荐结算方式"}
              value={
                data.payoutRailPilotCohort.recommendedPayoutMethodLabel
                  ? formatSettingsCommercialText(
                      data.payoutRailPilotCohort.recommendedPayoutMethodLabel,
                      english,
                    )
                  : english
                    ? "Not yet"
                    : "尚未形成"
              }
            />
          </div>

          <div className="theme-surface-panel-soft rounded-2xl px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
            {payoutRailPilotCohortNarrative}
            <div className="mt-2 space-y-2 text-xs text-[color:var(--muted-foreground)]">
              <p>
                {english
                  ? "Current pilot envelope stays at one country, one currency, one beneficiary class, and one payout method label."
                  : "当前试点边界仍应锁在单一国家、单一币种、单一受益方类别和单一结算方式说明。"}
              </p>
              <p>
                {english
                  ? "manual settlement remains the fallback source of truth."
                  : "手工结算仍然是回退时的真实依据。"}
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="theme-surface-panel rounded-2xl px-4 py-4">
              <p className="text-sm font-semibold text-[color:var(--foreground)]">
                {english ? "Operator checklist" : "运营清单"}
              </p>
              <div className="mt-3 space-y-2 text-sm leading-6 text-[color:var(--muted)]">
                {data.payoutRailPilotCohort.checklist.map((item) => (
                  <p key={item.key}>
                    {item.passed ? "✓ " : "• "}
                    {
                      payoutRailPilotChecklistLabels[item.key][
                        english ? "en" : "zh"
                      ]
                    }
                  </p>
                ))}
              </div>
            </div>

            <div className="theme-surface-panel rounded-2xl px-4 py-4">
              <p className="text-sm font-semibold text-[color:var(--foreground)]">
                {english ? "Next operator moves" : "下一步运营动作"}
              </p>
              <div className="mt-3 space-y-2 text-sm leading-6 text-[color:var(--muted)]">
                {data.payoutRailPilotCohort.nextMoves.length ? (
                  data.payoutRailPilotCohort.nextMoves.map((move) => (
                    <p key={move}>
                      {
                        payoutRailPilotNextMoveLabels[move][
                          english ? "en" : "zh"
                        ]
                      }
                    </p>
                  ))
                ) : (
                  <p>
                    {english
                      ? "No extra operator move is open right now beyond keeping the pilot envelope narrow and manual-first."
                      : "当前除了继续保持试点边界足够窄、并保留手工优先之外，没有额外运营动作打开。"}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            {data.payoutRailPilotCohort.candidateCohorts.length ? (
              data.payoutRailPilotCohort.candidateCohorts.map((cohort) => (
                <div
                  key={cohort.beneficiaryType}
                  className="theme-surface-panel rounded-2xl px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[color:var(--foreground)]">
                      {
                        revenueBeneficiaryLabels[cohort.beneficiaryType][
                          english ? "en" : "zh"
                        ]
                      }
                    </p>
                    <Badge
                      variant={
                        cohort.qualifiesForDryRun ? "success" : "neutral"
                      }
                    >
                      {cohort.qualifiesForDryRun
                        ? english
                          ? "Dry-run candidate"
                          : "可做试跑"
                        : english
                          ? "Needs more proof"
                          : "仍需补证据"}
                    </Badge>
                  </div>
                  <div className="mt-3 space-y-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                    <p>
                      {english
                        ? `Beneficiaries: ${cohort.beneficiaryCount}`
                        : `受益方：${cohort.beneficiaryCount} 个`}
                    </p>
                    <p>
                      {english
                        ? `Payout entries: ${cohort.payoutEntryCount}`
                        : `结算条目：${cohort.payoutEntryCount} 条`}
                    </p>
                    <p>
                      {english
                        ? `Profiles covered: ${cohort.coveredByActivePayoutProfileCount}/${cohort.beneficiaryCount}`
                        : `资料覆盖：${cohort.coveredByActivePayoutProfileCount}/${cohort.beneficiaryCount}`}
                    </p>
                    <p>
                      {english
                        ? `Participant access covered: ${cohort.coveredByParticipantAccessCount}/${cohort.beneficiaryCount}`
                        : `参与方访问覆盖：${cohort.coveredByParticipantAccessCount}/${cohort.beneficiaryCount}`}
                    </p>
                    <p>
                      {english
                        ? `Settlement cycles: ${cohort.exportedOrClosedBatchCount} · completions: ${cohort.manualCompletionCount} · reversals: ${cohort.reversalCount}`
                        : `结算周期：${cohort.exportedOrClosedBatchCount} · 完成：${cohort.manualCompletionCount} · 冲回：${cohort.reversalCount}`}
                    </p>
                    <p>
                      {english
                        ? `Methods: ${cohort.payoutMethodLabels.join(", ") || "none yet"}`
                        : `方式：${cohort.payoutMethodLabels.map((label) => formatSettingsCommercialText(label, english)).join("、") || "尚未形成"}`}
                    </p>
                    <p>
                      {english
                        ? `Currencies: ${cohort.currencyLabels.join(", ") || "none yet"}`
                        : `币种：${cohort.currencyLabels.join("、") || "尚未形成"}`}
                    </p>
                    <p>
                      {english
                        ? `Open exceptions: ${cohort.openExceptionCount}`
                        : `开放异常：${cohort.openExceptionCount} 条`}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="theme-surface-panel rounded-2xl px-4 py-4 text-sm leading-6 text-[color:var(--muted)] xl:col-span-3">
                {english
                  ? "No eligible external beneficiary cohort is visible yet. Keep manual settlement and contribution registry truth in place until one cohort becomes real."
                  : "当前还没有可评估的外部受益方人群。继续保持手工结算和贡献方登记真实状态，直到第一条人群真正形成。"}
              </div>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="theme-surface-panel rounded-2xl px-4 py-4">
              <p className="text-sm font-semibold text-[color:var(--foreground)]">
                {english ? "Dry-run export contract" : "试跑导出契约"}
              </p>
              <div className="mt-3 space-y-2 text-sm leading-6 text-[color:var(--muted)]">
                {data.payoutRailPilotCohort.dryRunExportFields.map((field) => (
                  <p key={field}>
                    {formatPayoutRailPilotExportField(field, english)}
                  </p>
                ))}
              </div>
            </div>

            <div className="theme-surface-panel rounded-2xl px-4 py-4">
              <p className="text-sm font-semibold text-[color:var(--foreground)]">
                {english
                  ? "No-go / rollback triggers"
                  : "禁止放行 / 回滚触发条件"}
              </p>
              <div className="mt-3 space-y-2 text-sm leading-6 text-[color:var(--muted)]">
                {data.payoutRailPilotCohort.noGoTriggers.map((item) => (
                  <p key={item}>
                    {formatPayoutRailPilotNoGoTrigger(item, english)}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
