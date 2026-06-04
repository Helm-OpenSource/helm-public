"use client";

import type { RevenueBeneficiaryType, RevenueSourceType } from "@prisma/client";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  revenueBeneficiaryLabels,
  revenueSourceLabels,
} from "@/features/settings/formatters/labels";
import { Info } from "./settings-display";

type SettlementBeneficiaryTotal = {
  beneficiaryType: RevenueBeneficiaryType;
  beneficiaryLabel: string;
  totalAmountCents: number;
  lineCount: number;
  missingProfileCount: number;
};

type SettlementSourceTotal = {
  sourceType: string;
  label: { zh: string; en: string };
  lineCount: number;
  totalAmountCents: number;
};

type SettlementProfileWarning = {
  id: string;
  beneficiaryLabel: string;
  sourceType: RevenueSourceType;
};

type BillingSettlementSummaryPanelsProps = {
  english: boolean;
  formatMoneyAmount: (cents: number, currency?: string | undefined) => string;
  settlementBeneficiaryTotals: SettlementBeneficiaryTotal[];
  settlementProfileWarnings: SettlementProfileWarning[];
  settlementSourceTotals: SettlementSourceTotal[];
};

export function BillingSettlementSummaryPanels({
  english,
  formatMoneyAmount,
  settlementBeneficiaryTotals,
  settlementProfileWarnings,
  settlementSourceTotals,
}: BillingSettlementSummaryPanelsProps) {
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="theme-surface-panel rounded-2xl px-4 py-4">
          <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Beneficiary totals" : "受益方汇总"}</p>
          <div className="mt-3 space-y-3">
            {settlementBeneficiaryTotals.length ? (
              settlementBeneficiaryTotals.map((item) => (
                <div key={`${item.beneficiaryType}-${item.beneficiaryLabel}`} className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-[color:var(--foreground)]">{item.beneficiaryLabel}</p>
                    <Badge variant="approval">{revenueBeneficiaryLabels[item.beneficiaryType][english ? "en" : "zh"]}</Badge>
                  </div>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    <Info label={english ? "Total" : "总金额"} value={formatMoneyAmount(item.totalAmountCents)} />
                    <Info label={english ? "Lines" : "条数"} value={english ? `${item.lineCount}` : `${item.lineCount} 条`} />
                    <Info label={english ? "Missing profiles" : "缺少资料"} value={english ? `${item.missingProfileCount}` : `${item.missingProfileCount} 条`} />
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title={english ? "No beneficiary totals yet" : "当前还没有受益方汇总"}
                description={english ? "The current batch will group lines by beneficiary here." : "当前批次会在这里按受益方聚合条目。"}
              />
            )}
          </div>
        </div>

        <div className="theme-surface-panel rounded-2xl px-4 py-4">
          <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Source-type totals" : "来源类型汇总"}</p>
          <div className="mt-3 space-y-3">
            {settlementSourceTotals.length ? (
              settlementSourceTotals.filter((item) => item.lineCount > 0).map((item) => (
                <div key={item.sourceType} className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-[color:var(--foreground)]">{item.label[english ? "en" : "zh"]}</p>
                  </div>
                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                    <Info label={english ? "Total" : "总金额"} value={formatMoneyAmount(item.totalAmountCents)} />
                    <Info label={english ? "Lines" : "条数"} value={english ? `${item.lineCount}` : `${item.lineCount} 条`} />
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title={english ? "No source totals yet" : "当前还没有来源汇总"}
                description={english ? "The current batch will group lines by source type here." : "当前批次会在这里按来源类型聚合条目。"}
              />
            )}
          </div>
        </div>
      </div>

      {settlementProfileWarnings.length ? (
        <div className="theme-surface-panel-soft rounded-2xl px-4 py-4">
          <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Missing payout profiles" : "缺少结算资料提醒"}</p>
          <div className="mt-3 space-y-2 text-sm leading-6 text-[color:var(--muted)]">
            {settlementProfileWarnings.map((line) => (
              <p key={line.id}>
                {line.beneficiaryLabel} · {revenueSourceLabels[line.sourceType][english ? "en" : "zh"]}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
