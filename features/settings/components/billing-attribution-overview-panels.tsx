"use client";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { revenueBeneficiaryLabels, revenueSourceLabels } from "@/features/settings/formatters/labels";
import { Info } from "./settings-display";

type BeneficiaryView = {
  id: string;
  kind: keyof typeof revenueBeneficiaryLabels;
  label: string;
  statusLabel: string;
  lineCount: number;
  attributedAmountCents: number;
  pendingAmountCents: number;
  payableAmountCents: number;
};

type AttributionSourceBreakdownItem = {
  sourceType: string;
  label: (typeof revenueSourceLabels)[keyof typeof revenueSourceLabels];
  lineCount: number;
  attributedAmountCents: number;
  pendingAmountCents: number;
};

type BillingAttributionOverviewPanelsProps = {
  attributionSourceBreakdown: AttributionSourceBreakdownItem[];
  beneficiaryViews: BeneficiaryView[];
  english: boolean;
  formatMoneyAmount: (cents: number) => string;
};

export function BillingAttributionOverviewPanels({
  attributionSourceBreakdown,
  beneficiaryViews,
  english,
  formatMoneyAmount,
}: BillingAttributionOverviewPanelsProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>{english ? "Beneficiary attribution view" : "受益方归因视图"}</CardTitle>
          <CardDescription>
            {english
              ? "Who's being credited, how much, what's still payable later."
              : "谁被归因、多少、还有多少待结算。"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {beneficiaryViews.length ? (
            beneficiaryViews.map((view) => (
              <div key={`${view.kind}-${view.id}`} className="theme-surface-panel rounded-2xl px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">{view.label}</p>
                  <Badge variant="approval">{revenueBeneficiaryLabels[view.kind][english ? "en" : "zh"]}</Badge>
                  <Badge variant="neutral">{view.statusLabel}</Badge>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Info label={english ? "Attributed lines" : "归因条数"} value={english ? `${view.lineCount}` : `${view.lineCount} 条`} />
                  <Info label={english ? "Attributed amount" : "归因金额"} value={formatMoneyAmount(view.attributedAmountCents)} />
                  <Info label={english ? "Pending payable" : "待结算金额"} value={formatMoneyAmount(view.pendingAmountCents)} />
                  <Info label={english ? "Total payable posture" : "总结算姿态"} value={formatMoneyAmount(view.payableAmountCents)} />
                </div>
              </div>
            ))
          ) : (
            <EmptyState
              title={english ? "No beneficiaries visible yet" : "当前还没有可见受益方"}
              description={english ? "Create publisher, referral or custom engagement records first." : "先创建发布方、转介绍或定制合作记录。"}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{english ? "Attribution source breakdown" : "归因来源拆分"}</CardTitle>
          <CardDescription>
            {english
              ? "Revenue source, recurring or one-time, reversal risk."
              : "收入来源、一次性或持续、是否可能冲回。"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {attributionSourceBreakdown.map((item) => (
            <div key={item.sourceType} className="theme-surface-panel-soft rounded-2xl px-4 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-[color:var(--foreground)]">{item.label[english ? "en" : "zh"]}</p>
                <Badge variant="info">{english ? `${item.lineCount} lines` : `${item.lineCount} 条`}</Badge>
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <Info label={english ? "Attributed amount" : "归因金额"} value={formatMoneyAmount(item.attributedAmountCents)} />
                <Info label={english ? "Pending payable" : "待结算金额"} value={formatMoneyAmount(item.pendingAmountCents)} />
                <Info label={english ? "Source type" : "来源类型"} value={item.label[english ? "en" : "zh"]} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
