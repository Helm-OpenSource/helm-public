"use client";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usageTypeLabels } from "@/features/settings/formatters/labels";
import type { SettingsClientProps } from "@/features/settings/types/settings-client-props";
import { Info } from "./settings-display";

type BillingMetricsData = Pick<
  SettingsClientProps["data"],
  "internalUsageOverview" | "seatSummary" | "usageSummary"
>;

type BillingMetricsPanelsProps = {
  data: BillingMetricsData;
  english: boolean;
  seatSummaryNarrative: string;
  usageSummaryNarrative: string;
};

export function BillingMetricsPanels({
  data,
  english,
  seatSummaryNarrative,
  usageSummaryNarrative,
}: BillingMetricsPanelsProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>{english ? "Seat summary" : "席位摘要"}</CardTitle>
          <CardDescription>
            {english
              ? "Active vs. invited vs. inactive, plus trial collaborator seats."
              : "活跃、已邀请、非活跃；外加试用协作席位。"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Info
              label={english ? "Active seats now" : "当前活跃席位"}
              value={english ? `${data.seatSummary.activeSeatCount}` : `${data.seatSummary.activeSeatCount} 个`}
            />
            <Info
              label={english ? "Invited, not counted" : "已邀请但未计费"}
              value={
                english ? `${data.seatSummary.invitedSeatCount}` : `${data.seatSummary.invitedSeatCount} 位`
              }
            />
            <Info
              label={english ? "Inactive, not counted" : "非活跃，未计入"}
              value={
                english ? `${data.seatSummary.inactiveSeatCount}` : `${data.seatSummary.inactiveSeatCount} 位`
              }
            />
            <Info
              label={english ? "Paid additional seat posture" : "付费额外席位姿态"}
              value={
                english
                  ? `${data.seatSummary.additionalBillableSeats}`
                  : `${data.seatSummary.additionalBillableSeats} 个`
              }
            />
            <Info
              label={english ? "Included paid seats" : "已包含付费席位"}
              value={
                english ? `${data.seatSummary.paidIncludedSeatCount}` : `${data.seatSummary.paidIncludedSeatCount} 个`
              }
            />
            <Info
              label={english ? "Used included paid seats" : "已使用包含的付费席位"}
              value={
                english ? `${data.seatSummary.paidIncludedSeatUsage}` : `${data.seatSummary.paidIncludedSeatUsage} 个`
              }
            />
            <Info
              label={english ? "Trial collaborator seats used" : "已用试用协作席位"}
              value={
                english
                  ? `${data.seatSummary.trialCollaboratorSeatsUsed}`
                  : `${data.seatSummary.trialCollaboratorSeatsUsed} 个`
              }
            />
            <Info
              label={english ? "Trial collaborator seats remaining" : "剩余试用协作席位"}
              value={
                english
                  ? `${data.seatSummary.trialCollaboratorSeatsRemaining}`
                  : `${data.seatSummary.trialCollaboratorSeatsRemaining} 个`
              }
            />
          </div>
          <div className="theme-surface-panel-soft rounded-2xl px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
            {seatSummaryNarrative}
            <div className="mt-2 space-y-2 text-xs text-[color:var(--muted-foreground)]">
              <p>
                {english
                  ? "Helm v1 charges by organization base fee + active seat + future add-on workers. Token, storage and retrieval stay internal only."
                  : "Helm v1 只按组织基础费 + 活跃席位 + 未来增值能力收费。令牌、存储和检索只做内部记账。"}
              </p>
              <p>
                {english
                  ? "Invited and inactive members stay visible for operations, but they do not become customer-visible usage billing."
                  : "已邀请和非活跃成员会保留运营可见性，但不会被写成客户可见的用量计费。"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{english ? "Internal usage summary" : "内部用量摘要"}</CardTitle>
          <CardDescription>
            {english
              ? "Shown in product-safe operating terms only. Raw token and storage billing lines stay internal."
              : "这里只展示产品语义的运营读数，不对外暴露原始令牌或存储计费项。"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Info
              label={english ? "High-cost processing" : "高成本处理"}
              value={
                english
                  ? `${data.internalUsageOverview.highCostProcessingCount}`
                  : `${data.internalUsageOverview.highCostProcessingCount} 次`
              }
            />
            <Info
              label={english ? "Exports" : "导出"}
              value={english ? `${data.internalUsageOverview.exportCount}` : `${data.internalUsageOverview.exportCount} 次`}
            />
            <Info
              label={english ? "Sync operations" : "同步操作"}
              value={english ? `${data.internalUsageOverview.syncCount}` : `${data.internalUsageOverview.syncCount} 次`}
            />
            <Info
              label={english ? "Premium worker usage" : "增值能力调用"}
              value={
                english
                  ? `${data.internalUsageOverview.premiumWorkerCount}`
                  : `${data.internalUsageOverview.premiumWorkerCount} 次`
              }
            />
          </div>
          <div className="theme-surface-panel-soft rounded-2xl px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
            {usageSummaryNarrative}
          </div>
          {data.usageSummary.length ? (
            data.usageSummary.map((row) => (
              <div key={row.usageType} className="theme-surface-panel rounded-2xl px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-medium text-[color:var(--foreground)]">
                    {usageTypeLabels[row.usageType]?.[english ? "en" : "zh"] ?? row.usageType}
                  </p>
                  <Badge variant="neutral">{english ? `${row.quantity}` : `${row.quantity} 次`}</Badge>
                </div>
              </div>
            ))
          ) : (
            <EmptyState
              title={english ? "No internal usage yet" : "当前还没有内部用量记录"}
              description={
                english
                  ? "Once people run meeting processing, exports, imports or recommendation refresh, usage will accumulate here in product-safe terms."
                  : "当团队开始运行会议处理、导出、导入或建议刷新后，这里会以产品可读语言累积内部用量。"
              }
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
