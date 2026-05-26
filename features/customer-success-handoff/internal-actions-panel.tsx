"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EvidenceChip } from "@/components/shared/narrative-components";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  approveCustomerSuccessInternalAction,
  executeCustomerSuccessInternalAction,
} from "@/features/customer-success-handoff/actions";
import type { CustomerSuccessInternalActionViewModel } from "@/features/customer-success-handoff/detail-model";

export function CustomerSuccessInternalActionsPanel({
  opportunityId,
  label,
  actions,
  english,
}: {
  opportunityId: string;
  label: string;
  actions: CustomerSuccessInternalActionViewModel[];
  english: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!actions.length) return null;

  const runAction = (
    action: () => Promise<{ ok: boolean; error?: string; resultSummary?: string | null }>,
    successMessage: string,
  ) => {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.error ?? (english ? "Action failed" : "动作执行失败"));
        return;
      }

      toast.success(result.resultSummary ?? successMessage);
      router.refresh();
    });
  };

  return (
    <section
      data-customer-success-internal-actions="true"
      className="theme-detail-shell-card space-y-3 rounded-[26px] px-4 py-4"
    >
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
        {label}
      </p>
      <div className="grid gap-3">
        {actions.map((action) => (
          <Card
            key={action.key}
            data-customer-success-internal-action={action.key}
            className="theme-detail-shell-tile"
          >
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <CardTitle className="text-base">{action.title}</CardTitle>
                  <p className="text-sm text-[color:var(--muted-foreground)]">{action.summary}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <EvidenceChip label={action.stateLabel} tone={action.stateTone} />
                  <EvidenceChip label={action.internalOnlyLabel} tone="violet" />
                  <EvidenceChip label={action.actionTypeLabel} tone="sky" />
                  {action.policyLabels.map((policyLabel) => (
                    <EvidenceChip
                      key={`${action.key}-${policyLabel.label}`}
                      label={policyLabel.label}
                      tone={policyLabel.tone}
                    />
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-7 text-[color:var(--dark-inset-muted)]">
              {action.approvalSummary ? (
                <CopyBlock
                  label={english ? "Approval trace" : "批准轨迹"}
                  value={action.approvalSummary}
                />
              ) : null}
              {action.executionSummary ? (
                <CopyBlock
                  label={english ? "Execution trace" : "执行轨迹"}
                  value={action.executionSummary}
                />
              ) : null}
              {action.resultSummary ? (
                <CopyBlock
                  label={english ? "Recorded result" : "记录结果"}
                  value={action.resultSummary}
                />
              ) : null}
              <div className="flex flex-wrap gap-2">
                {action.canApprove ? (
                  <Button
                    disabled={pending}
                    onClick={() =>
                      runAction(
                        () =>
                          approveCustomerSuccessInternalAction({
                            opportunityId,
                            actionKey: action.key,
                          }),
                        english
                          ? "Internal execution approved."
                          : "已批准内部执行。",
                      )
                    }
                  >
                    {pending
                      ? english
                        ? "Working..."
                        : "处理中..."
                      : english
                        ? "Approve internal execution"
                        : "批准内部执行"}
                  </Button>
                ) : null}
                {action.canExecute && action.actionItemId ? (
                  <Button
                    variant="secondary"
                    disabled={pending}
                    onClick={() =>
                      runAction(
                        () =>
                          executeCustomerSuccessInternalAction({
                            opportunityId,
                            actionItemId: action.actionItemId!,
                          }),
                        english
                          ? "Internal action executed."
                          : "已完成内部执行。",
                      )
                    }
                  >
                    {pending
                      ? english
                        ? "Working..."
                        : "处理中..."
                      : english
                        ? "Execute internally"
                        : "执行内部动作"}
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function CopyBlock({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
        {label}
      </p>
      <p>{value}</p>
    </div>
  );
}
