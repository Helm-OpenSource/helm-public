"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TrialApplicationStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  recordTrialDecisionAction,
  type TrialDecisionInput,
  type TrialDecisionResult,
} from "@/features/trial/actions";

type TrialDecisionFormProps = {
  applicationId: string;
  english: boolean;
  defaultStatus?: TrialApplicationStatus;
  defaultReason?: string | null;
};

const DECISION_OPTIONS: Array<{
  value: TrialDecisionInput["status"];
  zhLabel: string;
  enLabel: string;
}> = [
  { value: "CONTACTED", zhLabel: "已联系", enLabel: "Contacted" },
  { value: "APPROVED", zhLabel: "通过", enLabel: "Approved" },
  { value: "REJECTED", zhLabel: "拒绝", enLabel: "Rejected" },
];

export function TrialDecisionForm({
  applicationId,
  english,
  defaultStatus,
  defaultReason,
}: TrialDecisionFormProps) {
  const router = useRouter();
  const [status, setStatus] = useState<TrialDecisionInput["status"]>(
    defaultStatus && defaultStatus !== TrialApplicationStatus.PENDING
      ? (defaultStatus as TrialDecisionInput["status"])
      : "CONTACTED",
  );
  const [reason, setReason] = useState(defaultReason ?? "");
  const [result, setResult] = useState<TrialDecisionResult | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    startTransition(async () => {
      const response = await recordTrialDecisionAction({
        applicationId,
        status,
        decisionReason: reason.trim() ? reason.trim() : undefined,
      });
      setResult(response);
      if (response.ok) {
        router.refresh();
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-[var(--shadow-card)]"
      data-testid="trial-decision-form"
    >
      <div className="space-y-2">
        <p className="text-sm font-semibold text-[color:var(--foreground)]">
          {english ? "Decision" : "复核结论"}
        </p>
        <div
          role="radiogroup"
          aria-label={english ? "Decision" : "复核结论"}
          className="flex flex-wrap gap-2"
        >
          {DECISION_OPTIONS.map((option) => {
            const active = option.value === status;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setStatus(option.value)}
                className={
                  active
                    ? "rounded-full border border-[color:var(--accent)] bg-[color:var(--accent-soft)] px-3 py-1.5 text-sm font-semibold text-[color:var(--accent)]"
                    : "rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1.5 text-sm text-[color:var(--muted)] hover:border-[color:var(--accent)]"
                }
                data-testid={`trial-decision-${option.value.toLowerCase()}`}
              >
                {english ? option.enLabel : option.zhLabel}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="trial-decision-reason"
          className="text-sm font-medium text-[color:var(--foreground)]"
        >
          {english ? "Reason / next step (optional)" : "理由 / 下一步（可选）"}
        </label>
        <Textarea
          id="trial-decision-reason"
          rows={3}
          maxLength={800}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={
            english
              ? "Visible only inside Helm review trail. Notes here are not auto-sent to the applicant."
              : "仅 Helm 内部复核可见。这里的备注不会自动发送给申请人。"
          }
          data-testid="trial-decision-reason-input"
        />
      </div>

      {result && !result.ok && (
        <p className="text-sm text-[color:var(--accent-danger)]" data-testid="trial-decision-error">
          {result.error}
        </p>
      )}

      {result?.ok && (
        <p className="text-sm text-[color:var(--accent)]" data-testid="trial-decision-success">
          {english ? "Decision recorded." : "复核结论已记录。"}
        </p>
      )}

      <Button
        type="submit"
        variant="default"
        disabled={pending}
        data-testid="trial-decision-submit"
      >
        {pending
          ? english
            ? "Recording..."
            : "正在记录..."
          : english
            ? "Record decision"
            : "记录复核结论"}
      </Button>
    </form>
  );
}
