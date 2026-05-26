"use client";

import { EvidenceChip } from "@/components/shared/narrative-components";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CustomerSuccessExternalDraftViewModel } from "@/features/customer-success-handoff/detail-model";

export function CustomerSuccessExternalDraftsPanel({
  label,
  drafts,
  english,
}: {
  label: string;
  drafts: CustomerSuccessExternalDraftViewModel[];
  english: boolean;
}) {
  if (!drafts.length) return null;

  return (
    <details
      data-customer-success-external-drafts="true"
      className="theme-detail-shell-card rounded-[26px]"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
            {label}
          </p>
          <p className="text-sm leading-7 text-[color:var(--dark-inset-muted)]">
            {english
              ? "Open only when you need to review customer-facing wording."
              : "只有需要复核对外表达时再展开。"}
          </p>
        </div>
        <EvidenceChip
          label={english ? `${drafts.length} drafts` : `${drafts.length} 条草稿`}
          tone="violet"
        />
      </summary>
      <div className="grid gap-3 border-t border-[color:var(--border)] px-4 py-4">
        {drafts.map((draft) => (
          <Card
            key={draft.kind}
            data-customer-success-external-draft={draft.kind}
            className="theme-detail-shell-tile"
          >
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <CardTitle className="text-base">{draft.title}</CardTitle>
                  <p className="text-sm text-[color:var(--muted-foreground)]">{draft.summary}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <EvidenceChip label={draft.kindLabel} tone="sky" />
                  {draft.policyCueLabels.map((policyLabel) => (
                    <EvidenceChip
                      key={`${draft.kind}-${policyLabel.label}`}
                      label={policyLabel.label}
                      tone={policyLabel.tone}
                    />
                  ))}
                  {draft.reviewOutcome.cueLabels.map((cueLabel) => (
                    <EvidenceChip
                      key={`${draft.kind}-${cueLabel.label}`}
                      label={cueLabel.label}
                      tone={cueLabel.tone}
                    />
                  ))}
                  {draft.postSendOutcome?.cueLabels.map((cueLabel) => (
                    <EvidenceChip
                      key={`${draft.kind}-${cueLabel.label}-post-send`}
                      label={cueLabel.label}
                      tone={cueLabel.tone}
                    />
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm leading-7 text-[color:var(--dark-inset-muted)]">
              <CopyBlock
                label={english ? "Draft intent" : "草稿意图"}
                value={draft.intent}
              />
              <CopyBlock
                label={
                  english
                    ? "Why this draft fits now"
                    : "为什么现在适合这条草稿"
                }
                value={draft.whyNow}
              />
              <CopyBlock
                label={english ? "Review posture" : "复核状态"}
                value={draft.reviewStateLabel}
              />
              <CopyBlock
                label={english ? "Review outcome" : "复核结果"}
                value={draft.reviewOutcome.reviewPosture}
              />
              {draft.reviewOutcome.reviewerIdentity ? (
                <CopyBlock
                  label={english ? "Reviewer provenance" : "复核来源"}
                  value={draft.reviewOutcome.reviewerIdentity}
                />
              ) : null}
              {draft.reviewOutcome.revisionRequest ? (
                <CopyBlock
                  label={english ? "Revision requested" : "已要求修改"}
                  value={draft.reviewOutcome.revisionRequest}
                />
              ) : null}
              {draft.reviewOutcome.sendHandoff ? (
                <CopyBlock
                  label={english ? "Send handoff" : "发送交接"}
                  value={draft.reviewOutcome.sendHandoff}
                />
              ) : null}
              {draft.reviewOutcome.manualSendRecorded ? (
                <CopyBlock
                  label={english ? "Manual send record" : "手动发送记录"}
                  value={draft.reviewOutcome.manualSendRecorded}
                />
              ) : null}
              {draft.postSendOutcome ? (
                <>
                  <CopyBlock
                      label={
                        english
                          ? "What happened after send handoff"
                          : "发送交接后的结果"
                      }
                    value={draft.postSendOutcome.currentPosture}
                  />
                  {draft.postSendOutcome.firstOutcomeSummary ? (
                    <CopyBlock
                      label={
                        english
                          ? "First meaningful external outcome"
                          : "第一条有效外部结果"
                      }
                      value={draft.postSendOutcome.firstOutcomeSummary}
                    />
                  ) : null}
                  <CopyBlock
                    label={english ? "What changed now" : "当前发生了什么变化"}
                    value={draft.postSendOutcome.whatChanged}
                  />
                  <CopyBlock
                    label={
                      english
                        ? "What remains unresolved"
                        : "当前仍未解决的事项"
                    }
                    value={draft.postSendOutcome.unresolved}
                  />
                  <CopyBlock
                    label={
                      english
                        ? "What would still overstate certainty now"
                        : "此刻仍会夸大确定性的事情"
                    }
                    value={draft.postSendOutcome.overstateRisk}
                  />
                </>
              ) : null}
              {!draft.postSendOutcome ? (
                <CopyBlock
                  label={
                    english
                      ? "What remains unresolved before any send could even be reviewed"
                      : "在任何发送进入复核前，当前仍未解决的事项"
                  }
                  value={draft.unresolved}
                />
              ) : null}
              {!draft.postSendOutcome ? (
                <CopyBlock
                  label={
                    english
                      ? "What would overstate certainty if sent now"
                      : "如果现在发送会夸大什么"
                  }
                  value={draft.overstateRisk}
                />
              ) : null}
              <CopyBlock
                label={
                  english
                    ? "External send still stays disabled"
                    : "当前仍禁止外部发送"
                }
                value={draft.reviewOutcome.helmBoundaryReminder}
              />
            </CardContent>
          </Card>
        ))}
      </div>
    </details>
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
