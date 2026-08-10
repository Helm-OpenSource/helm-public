"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type Stage1TerminalReceiptMode =
  | "business-outcome"
  | "closed-without-execution"
  | "unresolved";

export function getStage1TerminalReceiptMode(
  receiptOutcome: string | null | undefined,
  actionStatus?: string | null,
): Stage1TerminalReceiptMode {
  if (
    receiptOutcome === "SUCCESS" ||
    receiptOutcome === "PARTIAL_SUCCESS" ||
    receiptOutcome === "FAILURE"
  ) {
    return actionStatus === undefined || actionStatus === "EXECUTED"
      ? "business-outcome"
      : "unresolved";
  }
  if (receiptOutcome === "NOT_EXECUTED" || receiptOutcome === "REJECTED") {
    return actionStatus === undefined || actionStatus === "BLOCKED"
      ? "closed-without-execution"
      : "unresolved";
  }
  return "unresolved";
}

function receiptOutcomeLabel(receiptOutcome: string | null, english: boolean) {
  switch (receiptOutcome) {
    case "SUCCESS":
      return english ? "Execution succeeded" : "执行成功";
    case "PARTIAL_SUCCESS":
      return english ? "Execution partially succeeded" : "执行部分成功";
    case "FAILURE":
      return english ? "Execution failed" : "执行失败";
    case "NOT_EXECUTED":
      return english ? "Closed without execution" : "未执行即关闭";
    case "REJECTED":
      return english ? "Rejected before execution" : "执行前已拒绝";
    default:
      return english ? "Receipt outcome unresolved" : "回执结果待恢复";
  }
}

type Stage1TerminalResultControlProps = {
  receiptOutcome: string | null;
  actionStatus: string | null;
  english: boolean;
  pending: boolean;
  canFinalize: boolean;
  deniedMessage: string;
  businessResult: "" | "success" | "failure";
  outcomeRef: string;
  followedRecommendation: "unknown" | "yes" | "no";
  onBusinessResultChange: (value: "success" | "failure") => void;
  onOutcomeRefChange: (value: string) => void;
  onFollowedRecommendationChange: (value: "unknown" | "yes" | "no") => void;
  onVerify: () => void;
};

export function Stage1TerminalResultControl({
  receiptOutcome,
  actionStatus,
  english,
  pending,
  canFinalize,
  deniedMessage,
  businessResult,
  outcomeRef,
  followedRecommendation,
  onBusinessResultChange,
  onOutcomeRefChange,
  onFollowedRecommendationChange,
  onVerify,
}: Stage1TerminalResultControlProps) {
  const mode = getStage1TerminalReceiptMode(receiptOutcome, actionStatus);
  const businessResultReady =
    businessResult !== "" && outcomeRef.trim().length > 0;
  const submitDisabled =
    pending ||
    !canFinalize ||
    mode === "unresolved" ||
    (mode === "business-outcome" && !businessResultReady);

  return (
    <section
      className="grid min-w-0 gap-3 border-t border-[color:var(--border)] pt-4"
      data-terminal-mode={mode}
      data-testid="stage1-terminal-result-control"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-[color:var(--foreground)]">
          {english ? "Stage 1 terminal review" : "Stage 1 终态验收"}
        </h3>
        <Badge variant="neutral">
          {receiptOutcomeLabel(receiptOutcome, english)}
        </Badge>
      </div>

      {mode === "business-outcome" ? (
        <fieldset
          className="grid min-w-0 gap-3"
          data-testid="stage1-business-outcome-fields"
        >
          <legend className="sr-only">
            {english ? "Final business result" : "最终业务结果"}
          </legend>
          <p className="text-xs leading-6 text-[color:var(--muted-foreground)]">
            {english
              ? "This receipt records an executed business path. Confirm the observed result and bind its business ObservationRun evidence; the existing failure acceptance rules remain unchanged."
              : "该回执记录的是已执行业务路径。请确认观察到的结果并绑定业务 ObservationRun 证据；原有失败验收规则保持不变。"}
          </p>
          <div className="grid min-w-0 gap-3 md:grid-cols-3">
            <label className="grid min-w-0 gap-2 text-xs font-medium text-[color:var(--muted-foreground)]">
              {english ? "Observed business result" : "观察到的业务结果"}
              <Select
                value={businessResult}
                disabled={pending}
                onValueChange={(value) =>
                  onBusinessResultChange(value as "success" | "failure")
                }
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={english ? "Select" : "请选择"}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="success">
                    {english ? "Successful" : "成功"}
                  </SelectItem>
                  <SelectItem value="failure">
                    {english ? "Unsuccessful" : "未成功"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="grid min-w-0 gap-2 text-xs font-medium text-[color:var(--muted-foreground)]">
              {english ? "Outcome evidence ref" : "结果证据引用"}
              <Input
                value={outcomeRef}
                disabled={pending}
                onChange={(event) => onOutcomeRefChange(event.target.value)}
                placeholder="observation-run:..."
                autoComplete="off"
              />
            </label>
            <label className="grid min-w-0 gap-2 text-xs font-medium text-[color:var(--muted-foreground)]">
              {english ? "Followed recommendation" : "是否采纳判断建议"}
              <Select
                value={followedRecommendation}
                disabled={pending}
                onValueChange={(value) =>
                  onFollowedRecommendationChange(
                    value as "unknown" | "yes" | "no",
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unknown">
                    {english ? "Not established" : "尚未确认"}
                  </SelectItem>
                  <SelectItem value="yes">
                    {english ? "Yes" : "是"}
                  </SelectItem>
                  <SelectItem value="no">
                    {english ? "No" : "否"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </label>
          </div>
        </fieldset>
      ) : mode === "closed-without-execution" ? (
        <div
          className="workspace-note-card min-w-0 p-4 text-sm leading-7 text-[color:var(--foreground)]"
          data-testid="stage1-no-execution-guidance"
          data-tone="amber"
        >
          {english
            ? "This is not a business failure. No business ObservationRun is required. Verification uses the close-without-execution path and keeps owner review with an open supervision signal before any new work packet or correction."
            : "这不是业务失败，不要求业务 ObservationRun。验收将走未执行关闭路径；在提出新 Work Packet 或纠正动作前，仍需 owner review，并保持 open supervision 信号。"}
        </div>
      ) : (
        <div
          className="workspace-note-card min-w-0 p-4 text-sm leading-7 text-[color:var(--foreground)]"
          data-tone="amber"
        >
          {english
            ? "The receipt outcome is unavailable, unrecognized, or inconsistent with the canonical action state. Repair or refresh the governed state before verification; no business result may be inferred. Owner review remains required and terminal reconciliation stays closed."
            : "回执结果缺失、无法识别，或与规范动作状态不一致。请先修复或刷新治理状态，不得推断业务结果；仍需 owner review，终态 reconciliation 保持关闭。"}
        </div>
      )}

      {!canFinalize ? (
        <p className="text-xs leading-6 text-[color:var(--muted-foreground)]">
          {deniedMessage}
        </p>
      ) : null}

      <Button
        className="w-full sm:w-auto"
        data-testid="stage1-terminal-submit"
        disabled={submitDisabled}
        variant="secondary"
        onClick={onVerify}
      >
        {mode === "closed-without-execution"
          ? receiptOutcome === "REJECTED"
            ? english
              ? "Verify rejected closure"
              : "验收拒绝关闭"
            : english
              ? "Verify no-execution closure"
              : "验收未执行关闭"
          : mode === "business-outcome"
            ? english
              ? "Verify receipt and business result"
              : "验收回执与业务结果"
            : english
              ? "Receipt recovery required"
              : "需先恢复回执"}
      </Button>
    </section>
  );
}
