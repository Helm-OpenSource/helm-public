"use client";

import type { ComponentProps, Dispatch, SetStateAction } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SettingsClientProps } from "@/features/settings/types/settings-client-props";
import { BillingSettlementBatchPanels } from "./billing-settlement-batch-panels";
import { BillingSettlementLinePanels } from "./billing-settlement-line-panels";
import { BillingSettlementOverviewPanels } from "./billing-settlement-overview-panels";
import { BillingSettlementSummaryPanels } from "./billing-settlement-summary-panels";

type BillingManualSettlementWorkflowData = Pick<
  SettingsClientProps["data"],
  "currentSettlementBatch" | "settlementBatches" | "settlementSummary"
>;

type SettlementBatchDraft = {
  periodLabel: string;
  notes: string;
};

type SettlementLineNotes = Record<string, string>;
type SettlementLineReverseReasons = Record<string, string>;

type BillingManualSettlementWorkflowProps = {
  approveCurrentSettlementBatch: (batchId: string) => void;
  canManageManualSettlement: boolean;
  closeCurrentSettlementBatch: (batchId: string) => void;
  createSettlementBatch: () => void;
  data: BillingManualSettlementWorkflowData;
  english: boolean;
  exportCurrentSettlementBatch: (batchId: string) => void;
  formatDateLabel: (value: Date | string | null | undefined) => string;
  formatMoneyAmount: (cents: number, currency?: string | undefined) => string;
  markSettlementLinePaid: (lineId: string) => void;
  pending: boolean;
  reverseSettlementLine: (lineId: string) => void;
  setSettlementBatchDraft: Dispatch<SetStateAction<SettlementBatchDraft>>;
  setSettlementLineNotes: Dispatch<SetStateAction<SettlementLineNotes>>;
  setSettlementLineReverseReasons: Dispatch<SetStateAction<SettlementLineReverseReasons>>;
  settlementBatchDraft: SettlementBatchDraft;
  settlementBeneficiaryTotals: ComponentProps<
    typeof BillingSettlementSummaryPanels
  >["settlementBeneficiaryTotals"];
  settlementLineNotes: SettlementLineNotes;
  settlementLineReverseReasons: SettlementLineReverseReasons;
  settlementProfileWarnings: ComponentProps<
    typeof BillingSettlementSummaryPanels
  >["settlementProfileWarnings"];
  settlementSourceTotals: ComponentProps<
    typeof BillingSettlementSummaryPanels
  >["settlementSourceTotals"];
};

export function BillingManualSettlementWorkflow({
  approveCurrentSettlementBatch,
  canManageManualSettlement,
  closeCurrentSettlementBatch,
  createSettlementBatch,
  data,
  english,
  exportCurrentSettlementBatch,
  formatDateLabel,
  formatMoneyAmount,
  markSettlementLinePaid,
  pending,
  reverseSettlementLine,
  setSettlementBatchDraft,
  setSettlementLineNotes,
  setSettlementLineReverseReasons,
  settlementBatchDraft,
  settlementBeneficiaryTotals,
  settlementLineNotes,
  settlementLineReverseReasons,
  settlementProfileWarnings,
  settlementSourceTotals,
}: BillingManualSettlementWorkflowProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{english ? "Manual settlement workflow" : "手工结算工作流"}</CardTitle>
        <CardDescription>
          {english
            ? "Monthly settlement batches with CSV/manual export. Not a payout rail."
            : "月度结算批次，可 CSV 或手工导出。不打款。"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <BillingSettlementOverviewPanels data={data} english={english} />

        <div className="grid gap-6 xl:grid-cols-[1fr_1.6fr]">
          <BillingSettlementBatchPanels
            approveCurrentSettlementBatch={approveCurrentSettlementBatch}
            canManageManualSettlement={canManageManualSettlement}
            closeCurrentSettlementBatch={closeCurrentSettlementBatch}
            createSettlementBatch={createSettlementBatch}
            data={data}
            english={english}
            exportCurrentSettlementBatch={exportCurrentSettlementBatch}
            formatDateLabel={formatDateLabel}
            formatMoneyAmount={formatMoneyAmount}
            pending={pending}
            setSettlementBatchDraft={setSettlementBatchDraft}
            settlementBatchDraft={settlementBatchDraft}
          />

          <div className="space-y-4">
            <BillingSettlementSummaryPanels
              english={english}
              formatMoneyAmount={formatMoneyAmount}
              settlementBeneficiaryTotals={settlementBeneficiaryTotals}
              settlementProfileWarnings={settlementProfileWarnings}
              settlementSourceTotals={settlementSourceTotals}
            />
            <BillingSettlementLinePanels
              canManageManualSettlement={canManageManualSettlement}
              data={data}
              english={english}
              formatDateLabel={formatDateLabel}
              formatMoneyAmount={formatMoneyAmount}
              markSettlementLinePaid={markSettlementLinePaid}
              pending={pending}
              reverseSettlementLine={reverseSettlementLine}
              setSettlementLineNotes={setSettlementLineNotes}
              setSettlementLineReverseReasons={setSettlementLineReverseReasons}
              settlementLineNotes={settlementLineNotes}
              settlementLineReverseReasons={settlementLineReverseReasons}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
