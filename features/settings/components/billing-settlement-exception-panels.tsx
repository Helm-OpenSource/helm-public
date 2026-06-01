"use client";

import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildPaidWithoutExportOperatorReadout } from "@/features/settings/formatters/billing-readout-narratives";
import {
  revenueBeneficiaryLabels,
  revenueSourceLabels,
  settlementExceptionNextMoveLabels,
  settlementExceptionTypeLabels,
} from "@/features/settings/formatters/labels";
import { formatSettlementBatchReference } from "@/features/settings/formatters/settlement-formatters";
import { formatSettingsCommercialText } from "@/features/settings/display-copy";
import type { SettingsClientProps } from "@/features/settings/types/settings-client-props";
import { Info } from "./settings-display";

type BillingSettlementExceptionData = Pick<SettingsClientProps["data"], "settlementExceptionSummary">;

type BillingSettlementExceptionPanelsProps = {
  data: BillingSettlementExceptionData;
  english: boolean;
  settlementExceptionNarrative: string;
};

export function BillingSettlementExceptionPanels({
  data,
  english,
  settlementExceptionNarrative,
}: BillingSettlementExceptionPanelsProps) {
  const exceptionAuditReadout =
    data.settlementExceptionSummary.paidWithoutExportCount > 0
      ? buildPaidWithoutExportOperatorReadout({
          english,
          paidWithoutExportCount: data.settlementExceptionSummary.paidWithoutExportCount,
          scope: "exception",
        })
      : null;

  return (
    <Card data-settlement-exception-handling="true">
      <CardHeader>
        <CardTitle>{english ? "Settlement exceptions / reversals" : "结算例外 / 冲回视图"}</CardTitle>
        <CardDescription>
          {english
            ? "Exported-but-unsettled, paid-without-export, blocked beneficiaries, reversals."
            : "已导出未结清、已付款无证据、受益方被卡住、冲回。"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <Info
            label={english ? "Open exceptions" : "开放例外"}
            value={english ? `${data.settlementExceptionSummary.openExceptionCount}` : `${data.settlementExceptionSummary.openExceptionCount} 条`}
          />
          <Info
            label={english ? "Profile exceptions" : "资料例外"}
            value={english ? `${data.settlementExceptionSummary.payoutProfileExceptionCount}` : `${data.settlementExceptionSummary.payoutProfileExceptionCount} 条`}
          />
          <Info
            label={english ? "Participant exceptions" : "参与方例外"}
            value={english ? `${data.settlementExceptionSummary.participantAccessExceptionCount}` : `${data.settlementExceptionSummary.participantAccessExceptionCount} 条`}
          />
          <Info
            label={english ? "Exported unsettled" : "已导出未结清"}
            value={english ? `${data.settlementExceptionSummary.exportedUnsettledCount}` : `${data.settlementExceptionSummary.exportedUnsettledCount} 条`}
          />
          <Info
            label={english ? "Paid without export" : "已支付缺少导出"}
            value={english ? `${data.settlementExceptionSummary.paidWithoutExportCount}` : `${data.settlementExceptionSummary.paidWithoutExportCount} 条`}
          />
          <Info
            label={english ? "Reversal evidence" : "冲回证据"}
            value={english ? `${data.settlementExceptionSummary.reversalCount}` : `${data.settlementExceptionSummary.reversalCount} 条`}
          />
        </div>

        <div className="theme-surface-panel-soft rounded-2xl px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
          {settlementExceptionNarrative}
        </div>

        {exceptionAuditReadout ? (
          <div className="theme-surface-panel-soft rounded-2xl px-4 py-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="warning">{english ? "Resolve this drift first" : "先消除这类漂移"}</Badge>
              <p className="text-sm font-medium text-[color:var(--foreground)]">
                {english ? "Paid-without-export anomalies are still open" : "已支付但缺导出证据的异常仍未处理"}
              </p>
            </div>
            <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{exceptionAuditReadout}</p>
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="theme-surface-panel rounded-2xl px-4 py-4">
            <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Open settlement exceptions" : "当前结算例外"}</p>
            <div className="mt-3 space-y-3">
              {data.settlementExceptionSummary.openExceptions.length ? (
                data.settlementExceptionSummary.openExceptions.map((item) => (
                  <div key={item.key} className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-[color:var(--foreground)]">{item.beneficiaryLabel}</p>
                      <Badge variant="danger">{settlementExceptionTypeLabels[item.type][english ? "en" : "zh"]}</Badge>
                      <Badge variant="approval">{revenueBeneficiaryLabels[item.beneficiaryType][english ? "en" : "zh"]}</Badge>
                      {item.sourceType ? (
                        <Badge variant="info">{revenueSourceLabels[item.sourceType][english ? "en" : "zh"]}</Badge>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs leading-6 text-[color:var(--muted-foreground)]">
                      {item.batchKey
                        ? `${formatSettlementBatchReference(item.batchKey, null, english)} · `
                        : ""}
                      {item.detail}
                      {item.daysOpen !== null
                        ? english
                          ? ` Open for ${item.daysOpen} day(s).`
                          : ` 已持续 ${item.daysOpen} 天。`
                        : ""}
                    </p>
                  </div>
                ))
              ) : (
                <EmptyState
                  title={english ? "No open settlement exceptions" : "当前没有开放的结算例外"}
                  description={
                    english
                      ? "Current settlement posture is clear right now. Keep using manual export, paid, and reversed updates explicitly."
                      : "当前结算姿态是清楚的。继续显式使用手工导出、已支付和已冲回更新即可。"
                  }
                />
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="theme-surface-panel rounded-2xl px-4 py-4">
              <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Next operator moves" : "下一步运营动作"}</p>
              <div className="mt-3 space-y-2 text-sm leading-6 text-[color:var(--muted)]">
                {data.settlementExceptionSummary.nextMoves.length ? (
                  data.settlementExceptionSummary.nextMoves.map((move) => (
                    <p key={move}>{settlementExceptionNextMoveLabels[move][english ? "en" : "zh"]}</p>
                  ))
                ) : (
                  <p>
                    {english
                      ? "No extra exception move is open right now. Keep reversals explicit and settlement transitions manual."
                      : "当前没有额外的异常动作待做。继续保持冲回显式、结算流转手工即可。"}
                  </p>
                )}
              </div>
            </div>

            <div className="theme-surface-panel rounded-2xl px-4 py-4">
              <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Recent reversals" : "最近的冲回记录"}</p>
              <div className="mt-3 space-y-3">
                {data.settlementExceptionSummary.recentReversals.length ? (
                  data.settlementExceptionSummary.recentReversals.slice(0, 5).map((item) => (
                    <div key={item.key} className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-[color:var(--foreground)]">{item.beneficiaryLabel}</p>
                        <Badge variant="danger">{english ? "Reversed" : "已冲回"}</Badge>
                        <Badge variant="info">{revenueSourceLabels[item.sourceType][english ? "en" : "zh"]}</Badge>
                      </div>
                      <p className="mt-2 text-xs leading-6 text-[color:var(--muted-foreground)]">
                        {item.batchKey
                          ? `${formatSettlementBatchReference(item.batchKey, null, english)} · `
                          : ""}
                        {english ? "Reason:" : "原因："}{" "}
                        {formatSettingsCommercialText(
                          item.reversalReason ??
                            (english
                              ? "Manual reversal recorded."
                              : "已记录手工冲回。"),
                          english,
                        )}
                      </p>
                      {item.notes ? (
                        <p className="mt-1 text-xs leading-6 text-[color:var(--muted-foreground)]">
                          {formatSettingsCommercialText(item.notes, english)}
                        </p>
                      ) : null}
                    </div>
                  ))
                ) : (
                  <EmptyState
                    title={english ? "No reversals yet" : "当前还没有冲回记录"}
                    description={
                      english
                        ? "Once a line is reversed manually, the reason and batch posture will stay readable here."
                        : "一旦某条条目被手工冲回，原因和批次姿态会在这里保持可读。"
                    }
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
