"use client";

import type { Dispatch, SetStateAction } from "react";
import {
  canApproveSettlementBatch,
  canCloseSettlementBatch,
  canExportSettlementBatch,
} from "@/lib/billing/settlement-posture";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { settlementBatchStatusLabels } from "@/features/settings/formatters/labels";
import { formatSettlementBatchReference } from "@/features/settings/formatters/settlement-formatters";
import type { SettingsClientProps } from "@/features/settings/types/settings-client-props";
import { Info } from "./settings-display";

type BillingSettlementBatchData = Pick<
  SettingsClientProps["data"],
  "currentSettlementBatch" | "settlementBatches"
>;

type SettlementBatchDraft = {
  periodLabel: string;
  notes: string;
};

type BillingSettlementBatchPanelsProps = {
  approveCurrentSettlementBatch: (batchId: string) => void;
  canManageManualSettlement: boolean;
  closeCurrentSettlementBatch: (batchId: string) => void;
  createSettlementBatch: () => void;
  data: BillingSettlementBatchData;
  english: boolean;
  exportCurrentSettlementBatch: (batchId: string) => void;
  formatDateLabel: (value: Date | string | null | undefined) => string;
  formatMoneyAmount: (cents: number, currency?: string | undefined) => string;
  pending: boolean;
  setSettlementBatchDraft: Dispatch<SetStateAction<SettlementBatchDraft>>;
  settlementBatchDraft: SettlementBatchDraft;
};

function formatSettlementBatchNote(note: string, english: boolean) {
  if (english) return note;

  return note
    .replace(
      /Seeded proof batch with exported \/ paid \/ reversed evidence\./gi,
      "已放入带导出、已支付和已冲回依据的演示批次。",
    )
    .replace(
      /Seeded open batch for current settlement review posture\./gi,
      "当前结算复核批次已准备好。",
    )
    .replace(/proof batch/gi, "证明批次")
    .replace(/review posture/gi, "复核状态")
    .replace(/\bposture\b/gi, "状态");
}

export function BillingSettlementBatchPanels({
  approveCurrentSettlementBatch,
  canManageManualSettlement,
  closeCurrentSettlementBatch,
  createSettlementBatch,
  data,
  english,
  exportCurrentSettlementBatch,
  formatDateLabel,
  formatMoneyAmount,
  pending,
  setSettlementBatchDraft,
  settlementBatchDraft,
}: BillingSettlementBatchPanelsProps) {
  const currentSettlementBatch = data.currentSettlementBatch;
  const currentSettlementBatchCanApprove = currentSettlementBatch
    ? canApproveSettlementBatch(currentSettlementBatch.status)
    : false;
  const currentSettlementBatchCanExport = currentSettlementBatch
    ? canExportSettlementBatch(currentSettlementBatch.status)
    : false;
  const currentSettlementBatchCanClose = currentSettlementBatch
    ? canCloseSettlementBatch({
        status: currentSettlementBatch.status,
        lineStatuses: currentSettlementBatch.lines.map((line) => line.status),
      })
    : false;

  return (
    <div className="space-y-4">
      <div className="theme-surface-panel rounded-2xl px-4 py-4">
        <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Create monthly batch" : "创建月度结算批次"}</p>
        <div className="mt-3 space-y-3">
          <Input
            value={settlementBatchDraft.periodLabel}
            onChange={(event) => setSettlementBatchDraft((current) => ({ ...current, periodLabel: event.target.value }))}
            placeholder={english ? "YYYY-MM" : "YYYY-MM"}
          />
          <Input
            value={settlementBatchDraft.notes}
            onChange={(event) => setSettlementBatchDraft((current) => ({ ...current, notes: event.target.value }))}
            placeholder={english ? "Notes" : "备注"}
          />
          <Button
            onClick={createSettlementBatch}
            disabled={
              pending ||
              !canManageManualSettlement ||
              !/^\d{4}-\d{2}$/.test(settlementBatchDraft.periodLabel.trim())
            }
          >
            {english ? "Create settlement batch" : "创建结算批次"}
          </Button>
        </div>
      </div>

      {currentSettlementBatch ? (
        <div className="theme-surface-panel rounded-2xl px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[color:var(--foreground)]">
              {formatSettlementBatchReference(
                currentSettlementBatch.batchKey,
                currentSettlementBatch.periodLabel,
                english,
              )}
            </p>
            <Badge variant="approval">{settlementBatchStatusLabels[currentSettlementBatch.status][english ? "en" : "zh"]}</Badge>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <Info label={english ? "Period" : "结算周期"} value={currentSettlementBatch.periodLabel} />
            <Info label={english ? "Window" : "结算窗口"} value={`${formatDateLabel(currentSettlementBatch.periodStart)} - ${formatDateLabel(currentSettlementBatch.periodEnd)}`} />
            <Info label={english ? "Approved at" : "批准时间"} value={formatDateLabel(currentSettlementBatch.approvedAt)} />
            <Info label={english ? "Exported at" : "导出时间"} value={formatDateLabel(currentSettlementBatch.exportedAt)} />
          </div>
          {currentSettlementBatch.notes ? (
            <p className="mt-3 text-xs leading-6 text-[color:var(--muted-foreground)]">
              {formatSettlementBatchNote(currentSettlementBatch.notes, english)}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => approveCurrentSettlementBatch(currentSettlementBatch.id)}
              disabled={
                pending ||
                !canManageManualSettlement ||
                !currentSettlementBatchCanApprove
              }
            >
              {english ? "Approve batch" : "批准批次"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => exportCurrentSettlementBatch(currentSettlementBatch.id)}
              disabled={
                pending ||
                !canManageManualSettlement ||
                !currentSettlementBatchCanExport
              }
            >
              {english ? "Export CSV" : "导出 CSV"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => closeCurrentSettlementBatch(currentSettlementBatch.id)}
              disabled={pending || !canManageManualSettlement || !currentSettlementBatchCanClose}
            >
              {english ? "Close batch" : "关闭批次"}
            </Button>
          </div>
          {currentSettlementBatch.status === "EXPORTED" && !currentSettlementBatchCanClose ? (
            <p className="mt-3 text-xs leading-6 text-[color:var(--muted-foreground)]">
              {english
                ? "Only fully paid or reversed exported batches can move into closeout."
                : "只有全部条目都进入已支付或已冲回姿态后，已导出的批次才能进入 closeout。"}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="theme-surface-panel rounded-2xl px-4 py-4">
        <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Recent settlement batches" : "最近的结算批次"}</p>
        <div className="mt-3 space-y-3">
          {data.settlementBatches.length ? (
            data.settlementBatches.map((batch) => (
              <div key={batch.id} className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-[color:var(--foreground)]">
                    {formatSettlementBatchReference(batch.batchKey, batch.periodLabel, english)}
                  </p>
                  <Badge variant="neutral">{settlementBatchStatusLabels[batch.status][english ? "en" : "zh"]}</Badge>
                </div>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <Info label={english ? "Period" : "周期"} value={batch.periodLabel} />
                  <Info label={english ? "Line count" : "条目数"} value={english ? `${batch.lineCount}` : `${batch.lineCount} 条`} />
                  <Info label={english ? "Total" : "总金额"} value={formatMoneyAmount(batch.totalAmountCents, batch.currency)} />
                  <Info label={english ? "Closed at" : "关闭时间"} value={formatDateLabel(batch.closedAt)} />
                </div>
              </div>
            ))
          ) : (
            <EmptyState
              title={english ? "No settlement batches yet" : "当前还没有结算批次"}
              description={english ? "Create the first monthly batch when payable lines are ready." : "等待后续结算条目就绪后，再创建第一条月度批次。"}
            />
          )}
        </div>
      </div>
    </div>
  );
}
