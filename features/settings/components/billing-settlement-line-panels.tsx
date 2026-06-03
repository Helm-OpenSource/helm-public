"use client";

import type { Dispatch, SetStateAction } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { canMarkSettlementLinePaid, canReverseSettlementLine } from "@/lib/billing/settlement-posture";
import {
  revenueBeneficiaryLabels,
  revenueSourceLabels,
  settlementLineStatusLabels,
} from "@/features/settings/formatters/labels";
import { formatSettingsCommercialText } from "@/features/settings/display-copy";
import type { SettingsClientProps } from "@/features/settings/types/settings-client-props";
import { Info } from "./settings-display";

type BillingSettlementLineData = Pick<SettingsClientProps["data"], "currentSettlementBatch">;
type SettlementLineNotes = Record<string, string>;
type SettlementLineReverseReasons = Record<string, string>;

type BillingSettlementLinePanelsProps = {
  canManageManualSettlement: boolean;
  data: BillingSettlementLineData;
  english: boolean;
  formatDateLabel: (value: Date | string | null | undefined) => string;
  formatMoneyAmount: (cents: number, currency?: string | undefined) => string;
  markSettlementLinePaid: (lineId: string) => void;
  pending: boolean;
  reverseSettlementLine: (lineId: string) => void;
  setSettlementLineNotes: Dispatch<SetStateAction<SettlementLineNotes>>;
  setSettlementLineReverseReasons: Dispatch<SetStateAction<SettlementLineReverseReasons>>;
  settlementLineNotes: SettlementLineNotes;
  settlementLineReverseReasons: SettlementLineReverseReasons;
};

export function BillingSettlementLinePanels({
  canManageManualSettlement,
  data,
  english,
  formatDateLabel,
  formatMoneyAmount,
  markSettlementLinePaid,
  pending,
  reverseSettlementLine,
  setSettlementLineNotes,
  setSettlementLineReverseReasons,
  settlementLineNotes,
  settlementLineReverseReasons,
}: BillingSettlementLinePanelsProps) {
  const currentSettlementBatch = data.currentSettlementBatch;

  if (!currentSettlementBatch) {
    return (
      <EmptyState
        title={english ? "No current settlement batch" : "当前没有结算批次"}
        description={
          english
            ? "Create a batch first, then review, export and update line posture here."
            : "先创建批次，再在这里做复核、导出和条目状态更新。"
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {currentSettlementBatch.lines.map((line) => (
        <div key={line.id} className="theme-surface-panel rounded-2xl px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[color:var(--foreground)]">{line.beneficiaryLabel}</p>
            <Badge variant="approval">{revenueBeneficiaryLabels[line.beneficiaryType][english ? "en" : "zh"]}</Badge>
            <Badge variant="info">{revenueSourceLabels[line.sourceType][english ? "en" : "zh"]}</Badge>
            <Badge
              variant={
                line.status === "PAID"
                  ? "success"
                  : line.status === "REVERSED"
                    ? "danger"
                    : line.status === "EXPORTED"
                      ? "approval"
                      : line.status === "APPROVED"
                        ? "info"
                        : "neutral"
              }
            >
              {settlementLineStatusLabels[line.status][english ? "en" : "zh"]}
            </Badge>
            {line.payoutProfile ? (
              <Badge variant="success">
                {english ? `Profile: ${line.payoutProfile.displayName}` : `结算资料：${line.payoutProfile.displayName}`}
              </Badge>
            ) : line.payoutProfileRequired ? (
              <Badge variant="danger">{english ? "Missing profile" : "缺少结算资料"}</Badge>
            ) : null}
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Info label={english ? "Amount" : "金额"} value={formatMoneyAmount(line.amountCents, line.currency)} />
            <Info label={english ? "Approved at" : "批准时间"} value={formatDateLabel(line.approvedAt)} />
            <Info label={english ? "Exported at" : "导出时间"} value={formatDateLabel(line.exportedAt)} />
            <Info label={english ? "Paid at" : "支付时间"} value={formatDateLabel(line.paidAt)} />
          </div>
          {line.notes ? (
            <p className="mt-3 text-xs leading-6 text-[color:var(--muted-foreground)]">
              {formatSettingsCommercialText(line.notes, english)}
            </p>
          ) : null}
          {line.status === "APPROVED" ? (
            <p className="mt-3 text-xs leading-6 text-[color:var(--muted-foreground)]">
              {english
                ? "This line is approved but not exported yet. Export the batch before marking it paid or reversing it."
                : "这个条目已经批准，但还没有进入导出姿态。请先导出批次，再标记已支付或执行冲回。"}
            </p>
          ) : null}
          <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_1fr_auto_auto]">
            <Input
              value={settlementLineNotes[line.id] ?? ""}
              onChange={(event) =>
                setSettlementLineNotes((current) => ({ ...current, [line.id]: event.target.value }))
              }
              placeholder={english ? "Optional paid note" : "可选已支付备注"}
            />
            <Input
              value={settlementLineReverseReasons[line.id] ?? ""}
              onChange={(event) =>
                setSettlementLineReverseReasons((current) => ({ ...current, [line.id]: event.target.value }))
              }
              placeholder={english ? "Reversal reason" : "冲回原因"}
            />
            <Button
              variant="secondary"
              onClick={() => markSettlementLinePaid(line.id)}
              disabled={
                pending ||
                !canManageManualSettlement ||
                !canMarkSettlementLinePaid(line.status)
              }
            >
              {english ? "Mark paid" : "标记为已支付"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => reverseSettlementLine(line.id)}
              disabled={
                pending ||
                !canManageManualSettlement ||
                (settlementLineReverseReasons[line.id] ?? "").trim().length < 2 ||
                !canReverseSettlementLine(line.status)
              }
            >
              {english ? "Reverse line" : "冲回条目"}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
