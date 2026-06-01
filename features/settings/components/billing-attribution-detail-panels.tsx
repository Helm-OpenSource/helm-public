"use client";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  revenueBeneficiaryLabels,
  revenueLedgerStatusLabels,
  revenueRuleCadenceLabels,
  revenueRuleValueLabels,
  revenueSourceLabels,
} from "@/features/settings/formatters/labels";
import { formatSettingsCommercialText } from "@/features/settings/display-copy";
import type { SettingsClientProps } from "@/features/settings/types/settings-client-props";
import { Info } from "./settings-display";

type BillingAttributionDetailData = Pick<
  SettingsClientProps["data"],
  | "customEngagements"
  | "payoutEntries"
  | "revenueAttributionEntries"
  | "revenueAttributionSummary"
  | "revenueRuleSummary"
  | "revenueRules"
  | "salesReferrals"
  | "workerPublisherProfiles"
>;

type BillingAttributionDetailPanelsProps = {
  data: BillingAttributionDetailData;
  english: boolean;
  formatDateLabel: (value: Date | string | null | undefined) => string;
  formatMoneyAmount: (cents: number, currency?: string | undefined) => string;
  revenueAttributionNarrative: string;
  revenueRuleNarrative: string;
};

export function BillingAttributionDetailPanels({
  data,
  english,
  formatDateLabel,
  formatMoneyAmount,
  revenueAttributionNarrative,
  revenueRuleNarrative,
}: BillingAttributionDetailPanelsProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>
            {english ? "Revenue rule summary" : "归因规则摘要"}
          </CardTitle>
          <CardDescription>
            {english
              ? "Internal split rules: platform, worker, custom, sales."
              : "内部拆分规则：平台、能力、定制、销售。"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <Info
              label={english ? "Visible rules" : "可见规则"}
              value={
                english
                  ? `${data.revenueRuleSummary.totalRuleCount}`
                  : `${data.revenueRuleSummary.totalRuleCount} 条`
              }
            />
            <Info
              label={english ? "Recurring rules" : "持续拆分规则"}
              value={
                english
                  ? `${data.revenueRuleSummary.recurringRuleCount}`
                  : `${data.revenueRuleSummary.recurringRuleCount} 条`
              }
            />
            <Info
              label={english ? "One-time rules" : "一次性拆分规则"}
              value={
                english
                  ? `${data.revenueRuleSummary.oneTimeRuleCount}`
                  : `${data.revenueRuleSummary.oneTimeRuleCount} 条`
              }
            />
            <Info
              label={english ? "Percent rules" : "固定比例规则"}
              value={
                english
                  ? `${data.revenueRuleSummary.percentRuleCount}`
                  : `${data.revenueRuleSummary.percentRuleCount} 条`
              }
            />
            <Info
              label={english ? "Fixed-amount rules" : "固定金额规则"}
              value={
                english
                  ? `${data.revenueRuleSummary.fixedAmountRuleCount}`
                  : `${data.revenueRuleSummary.fixedAmountRuleCount} 条`
              }
            />
            <Info
              label={english ? "Reversal-backed rules" : "支持冲回"}
              value={
                english
                  ? `${data.revenueRuleSummary.reversalBackedRuleCount}`
                  : `${data.revenueRuleSummary.reversalBackedRuleCount} 条`
              }
            />
          </div>
          <div className="theme-surface-panel-soft rounded-2xl px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
            {revenueRuleNarrative}
            <div className="mt-2 space-y-2 text-xs text-[color:var(--muted-foreground)]">
              <p>
                {english
                  ? `Publisher profiles: ${data.workerPublisherProfiles.length} · referrals: ${data.salesReferrals.length} · custom engagements: ${data.customEngagements.length}`
                  : `发布方资料：${data.workerPublisherProfiles.length} 个 · 转介绍：${data.salesReferrals.length} 条 · 定制合作：${data.customEngagements.length} 条`}
              </p>
              <p>
                {english
                  ? "Current-main explains who should be credited, what could become payable later, and what can enter the internal manual settlement path. It still does not expose payout rails, public portal discovery, or marketplace behavior."
                  : "当前主线会解释谁应该被归因、哪些金额未来可能进入待后续结算，以及哪些条目可以进入内部手工结算路径。它仍然不会暴露支付通道、公开门户发现或市场行为。"}
              </p>
            </div>
          </div>
          {data.revenueRules.length ? (
            data.revenueRules.map((rule) => (
              <div
                key={rule.id}
                className="theme-surface-panel rounded-2xl px-4 py-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">
                    {formatSettingsCommercialText(rule.name, english)}
                  </p>
                  <Badge variant="info">
                    {
                      revenueSourceLabels[rule.sourceType][
                        english ? "en" : "zh"
                      ]
                    }
                  </Badge>
                  <Badge variant="neutral">
                    {
                      revenueRuleCadenceLabels[rule.cadence][
                        english ? "en" : "zh"
                      ]
                    }
                  </Badge>
                  <Badge variant="approval">
                    {
                      revenueRuleValueLabels[rule.valueType][
                        english ? "en" : "zh"
                      ]
                    }
                  </Badge>
                  <Badge
                    variant={
                      rule.status === "ACTIVE"
                        ? "success"
                        : rule.status === "CANCELED"
                          ? "danger"
                          : "neutral"
                    }
                  >
                    {rule.status === "ACTIVE"
                      ? english
                        ? "Active"
                        : "生效中"
                      : rule.status === "CANCELED"
                        ? english
                          ? "Canceled"
                          : "已停用"
                        : english
                          ? "Inactive"
                          : "未生效"}
                  </Badge>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <Info
                    label={english ? "Beneficiary" : "归因对象"}
                    value={formatSettingsCommercialText(
                      rule.beneficiaryLabel,
                      english,
                    )}
                  />
                  <Info
                    label={english ? "Beneficiary type" : "归因类型"}
                    value={
                      revenueBeneficiaryLabels[rule.beneficiaryType][
                        english ? "en" : "zh"
                      ]
                    }
                  />
                  <Info
                    label={english ? "Split rule" : "拆分规则"}
                    value={
                      rule.valueType === "FIXED_PERCENT"
                        ? `${(rule.percentBps ?? 0) / 100}%`
                        : formatMoneyAmount(
                            rule.fixedAmountCents ?? 0,
                            rule.currency,
                          )
                    }
                  />
                  <Info
                    label={english ? "Worker key" : "能力键"}
                    value={
                      rule.workerKey
                        ? formatSettingsCommercialText(rule.workerKey, english)
                        : english
                          ? "Not scoped"
                          : "未绑定"
                    }
                  />
                  <Info
                    label={english ? "Registry reference" : "登记册引用"}
                    value={
                      rule.workerPublisherProfileId
                        ? english
                          ? "Worker publisher profile"
                          : "能力发布方"
                        : rule.salesReferralId
                          ? english
                            ? "Sales referral"
                            : "销售转介绍"
                          : rule.customEngagementId
                            ? english
                              ? "Custom engagement"
                              : "定制合作"
                            : english
                              ? "Platform direct"
                              : "平台直营"
                    }
                  />
                  <Info
                    label={english ? "Effective from" : "生效起点"}
                    value={formatDateLabel(rule.effectiveFrom)}
                  />
                </div>
                <p className="mt-3 text-xs leading-6 text-[color:var(--muted-foreground)]">
                  {formatSettingsCommercialText(
                    rule.notes ??
                      (english
                        ? "Internal attribution rule."
                        : "内部归因规则。"),
                    english,
                  )}{" "}
                  {rule.reverseOnCancel
                    ? english
                      ? "Refund / cancel reversal is enabled."
                      : "支持退款 / 取消冲回。"
                    : english
                      ? "No automatic reversal."
                      : "当前不自动冲回。"}
                </p>
              </div>
            ))
          ) : (
            <EmptyState
              title={
                english ? "No attribution rules yet" : "当前还没有归因规则"
              }
              description={
                english
                  ? "Once platform, worker, custom or referral paths are configured, the internal split rules will appear here."
                  : "后续接入平台、能力、定制或转介绍路径后，内部拆分规则会在这里出现。"
              }
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {english
              ? "Attribution ledger / payable later"
              : "归因台账 / 待后续结算"}
          </CardTitle>
          <CardDescription>
            {english
              ? "Source, beneficiary, split, payable-later status."
              : "来源、受益方、分成结果、待结算状态。"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <Info
              label={english ? "Pending lines" : "待结算条目"}
              value={
                english
                  ? `${data.revenueAttributionSummary.pendingCount}`
                  : `${data.revenueAttributionSummary.pendingCount} 条`
              }
            />
            <Info
              label={english ? "Approved lines" : "已批准条目"}
              value={
                english
                  ? `${data.revenueAttributionSummary.approvedCount}`
                  : `${data.revenueAttributionSummary.approvedCount} 条`
              }
            />
            <Info
              label={english ? "Paid lines" : "已支付条目"}
              value={
                english
                  ? `${data.revenueAttributionSummary.paidCount}`
                  : `${data.revenueAttributionSummary.paidCount} 条`
              }
            />
            <Info
              label={english ? "Reversed lines" : "已冲回条目"}
              value={
                english
                  ? `${data.revenueAttributionSummary.reversedCount}`
                  : `${data.revenueAttributionSummary.reversedCount} 条`
              }
            />
            <Info
              label={english ? "Pending payable" : "待结算金额"}
              value={formatMoneyAmount(
                data.revenueAttributionSummary.pendingPayableAmountCents,
              )}
            />
          </div>
          <div className="theme-surface-panel-soft rounded-2xl px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
            {revenueAttributionNarrative}
          </div>
          {data.revenueAttributionEntries.length ? (
            <div className="space-y-3">
              {data.revenueAttributionEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="theme-surface-panel rounded-2xl px-4 py-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[color:var(--foreground)]">
                      {formatSettingsCommercialText(entry.sourceLabel, english)}
                    </p>
                    <Badge variant="info">
                      {
                        revenueSourceLabels[entry.sourceType][
                          english ? "en" : "zh"
                        ]
                      }
                    </Badge>
                    <Badge variant="approval">
                      {
                        revenueBeneficiaryLabels[entry.beneficiaryType][
                          english ? "en" : "zh"
                        ]
                      }
                    </Badge>
                    <Badge
                      variant={
                        entry.status === "PAID"
                          ? "success"
                          : entry.status === "REVERSED"
                            ? "danger"
                            : entry.status === "APPROVED"
                              ? "info"
                              : "neutral"
                      }
                    >
                      {
                        revenueLedgerStatusLabels[entry.status][
                          english ? "en" : "zh"
                        ]
                      }
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <Info
                      label={english ? "Beneficiary" : "归因对象"}
                      value={formatSettingsCommercialText(
                        entry.beneficiaryLabel,
                        english,
                      )}
                    />
                    <Info
                      label={english ? "Gross line" : "原始金额"}
                      value={formatMoneyAmount(
                        entry.grossAmountCents,
                        entry.currency,
                      )}
                    />
                    <Info
                      label={english ? "Attributed amount" : "归因金额"}
                      value={formatMoneyAmount(
                        entry.attributedAmountCents,
                        entry.currency,
                      )}
                    />
                    <Info
                      label={english ? "Recognized at" : "入账时间"}
                      value={formatDateLabel(entry.recognizedAt)}
                    />
                    <Info
                      label={english ? "Rule applied" : "应用规则"}
                      value={
                        entry.ruleName
                          ? formatSettingsCommercialText(
                              entry.ruleName,
                              english,
                            )
                          : english
                            ? "No rule link"
                            : "未绑定规则"
                      }
                    />
                    <Info
                      label={english ? "Cadence" : "计费节奏"}
                      value={
                        entry.ruleCadence
                          ? revenueRuleCadenceLabels[entry.ruleCadence][
                              english ? "en" : "zh"
                            ]
                          : english
                            ? "Not set"
                            : "未设置"
                      }
                    />
                    <Info
                      label={english ? "Rule shape" : "规则形态"}
                      value={
                        entry.ruleValueType
                          ? revenueRuleValueLabels[entry.ruleValueType][
                              english ? "en" : "zh"
                            ]
                          : english
                            ? "Not set"
                            : "未设置"
                      }
                    />
                    <Info
                      label={english ? "Reversal posture" : "冲回姿态"}
                      value={
                        entry.ruleReverseOnCancel
                          ? english
                            ? "May reverse on cancel / refund"
                            : "取消 / 退款时可冲回"
                          : english
                            ? "No reversal rule"
                            : "当前没有冲回规则"
                      }
                    />
                  </div>
                  <p className="mt-3 text-xs leading-6 text-[color:var(--muted-foreground)]">
                    {english
                      ? `Why attributable: this line matched the current internal attribution rule and is tracked as ${revenueSourceLabels[entry.sourceType].en}.`
                      : `归因原因：这条收入条目匹配了当前内部归因规则，并按 ${revenueSourceLabels[entry.sourceType].zh} 归入台账。`}
                  </p>
                  {entry.reversalReason ? (
                    <p className="mt-2 text-xs leading-6 text-[color:var(--muted-foreground)]">
                      {english ? "Reversal reason:" : "冲回原因："}{" "}
                      {formatSettingsCommercialText(
                        entry.reversalReason,
                        english,
                      )}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title={
                english ? "No attributed revenue yet" : "当前还没有归因收入记录"
              }
              description={
                english
                  ? "Once base fee, seat, worker, custom or referral revenue lines are recorded, attribution entries will appear here."
                  : "后续有基础费、席位、能力、定制合作或转介绍收入条目被记录后，归因台账会在这里出现。"
              }
            />
          )}
          {data.payoutEntries.length ? (
            <div className="space-y-3">
              {data.payoutEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="theme-surface-panel-soft rounded-2xl px-4 py-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[color:var(--foreground)]">
                      {formatSettingsCommercialText(
                        entry.beneficiaryLabel,
                        english,
                      )}
                    </p>
                    <Badge variant="approval">
                      {
                        revenueBeneficiaryLabels[entry.beneficiaryType][
                          english ? "en" : "zh"
                        ]
                      }
                    </Badge>
                    <Badge
                      variant={
                        entry.status === "PAID"
                          ? "success"
                          : entry.status === "REVERSED"
                            ? "danger"
                            : entry.status === "APPROVED"
                              ? "info"
                              : "neutral"
                      }
                    >
                      {
                        revenueLedgerStatusLabels[entry.status][
                          english ? "en" : "zh"
                        ]
                      }
                    </Badge>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <Info
                      label={english ? "Payable later" : "可待结算金额"}
                      value={formatMoneyAmount(
                        entry.payableAmountCents,
                        entry.currency,
                      )}
                    />
                    <Info
                      label={english ? "Payable after" : "最早可结算"}
                      value={formatDateLabel(entry.payableAfter)}
                    />
                    <Info
                      label={english ? "Approved at" : "批准时间"}
                      value={formatDateLabel(entry.approvedAt)}
                    />
                    <Info
                      label={english ? "Paid at" : "支付时间"}
                      value={formatDateLabel(entry.paidAt)}
                    />
                    <Info
                      label={english ? "Source type" : "来源类型"}
                      value={
                        revenueSourceLabels[entry.sourceType][
                          english ? "en" : "zh"
                        ]
                      }
                    />
                    <Info
                      label={english ? "Rule cadence" : "规则节奏"}
                      value={
                        entry.ruleCadence
                          ? revenueRuleCadenceLabels[entry.ruleCadence][
                              english ? "en" : "zh"
                            ]
                          : english
                            ? "Not set"
                            : "未设置"
                      }
                    />
                    <Info
                      label={english ? "Rule reference" : "规则引用"}
                      value={
                        entry.ruleKey
                          ? english
                            ? "Rule linked"
                            : "已绑定规则"
                          : english
                            ? "No rule link"
                            : "未绑定规则"
                      }
                    />
                    <Info
                      label={english ? "Reversal may apply" : "是否可能冲回"}
                      value={
                        entry.ruleReverseOnCancel
                          ? english
                            ? "Yes"
                            : "是"
                          : english
                            ? "No"
                            : "否"
                      }
                    />
                  </div>
                  {entry.notes ? (
                    <p className="mt-3 text-xs leading-6 text-[color:var(--muted-foreground)]">
                      {formatSettingsCommercialText(entry.notes, english)}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
