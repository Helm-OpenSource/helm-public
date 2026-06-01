"use client";

import { settlementBatchStatusLabels } from "@/features/settings/formatters/labels";
import { formatSettlementBatchReference } from "@/features/settings/formatters/settlement-formatters";
import type { SettingsClientProps } from "@/features/settings/types/settings-client-props";
import { Info } from "./settings-display";

type BillingSettlementOverviewData = Pick<
  SettingsClientProps["data"],
  "currentSettlementBatch" | "settlementSummary"
>;

type BillingSettlementOverviewPanelsProps = {
  data: BillingSettlementOverviewData;
  english: boolean;
};

export function BillingSettlementOverviewPanels({
  data,
  english,
}: BillingSettlementOverviewPanelsProps) {
  const currentSettlementBatch = data.currentSettlementBatch;

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <Info
          label={english ? "Current lines" : "当前条目"}
          value={english ? `${data.settlementSummary.totalLineCount}` : `${data.settlementSummary.totalLineCount} 条`}
        />
        <Info
          label={english ? "Pending" : "待结算"}
          value={english ? `${data.settlementSummary.pendingCount}` : `${data.settlementSummary.pendingCount} 条`}
        />
        <Info
          label={english ? "Approved" : "已批准"}
          value={english ? `${data.settlementSummary.approvedCount}` : `${data.settlementSummary.approvedCount} 条`}
        />
        <Info
          label={english ? "Exported" : "已导出"}
          value={english ? `${data.settlementSummary.exportedCount}` : `${data.settlementSummary.exportedCount} 条`}
        />
        <Info
          label={english ? "Paid" : "已支付"}
          value={english ? `${data.settlementSummary.paidCount}` : `${data.settlementSummary.paidCount} 条`}
        />
        <Info
          label={english ? "Missing profiles" : "缺少资料"}
          value={english ? `${data.settlementSummary.missingProfileCount}` : `${data.settlementSummary.missingProfileCount} 条`}
        />
      </div>

      <div className="theme-surface-panel-soft rounded-2xl px-4 py-4 text-sm leading-6 text-[color:var(--muted)]">
        {english
          ? currentSettlementBatch
            ? `${formatSettlementBatchReference(currentSettlementBatch.batchKey, currentSettlementBatch.periodLabel, english)} is in ${settlementBatchStatusLabels[currentSettlementBatch.status].en.toLowerCase()} posture. It keeps ${data.settlementSummary.beneficiaryCount} beneficiaries and ${data.settlementSummary.sourceTypeCount} source types readable before any off-platform payment happens.`
            : "No settlement batch exists yet. Create a monthly batch once payable-later lines are ready, then review it internally, export CSV, and update paid / reversed posture manually."
          : currentSettlementBatch
            ? `${formatSettlementBatchReference(currentSettlementBatch.batchKey, currentSettlementBatch.periodLabel, english)} 处于 ${settlementBatchStatusLabels[currentSettlementBatch.status].zh} 姿态，覆盖 ${data.settlementSummary.beneficiaryCount} 个受益方和 ${data.settlementSummary.sourceTypeCount} 类来源，方便在站外付款前先做内部复核。`
            : "当前还没有结算批次。等待后续结算条目进入可结算姿态后，再创建月度批次、做内部复核、导出 CSV，并手动更新已支付 / 已冲回状态。"}
      </div>
    </>
  );
}
