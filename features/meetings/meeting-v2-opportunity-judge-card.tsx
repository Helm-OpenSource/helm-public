"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, RefreshCcw, ShieldAlert, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  reviewMeetingOpportunityJudgeRuntimeAction,
  runMeetingOpportunityJudgeRuntimeAction,
} from "@/features/meetings/actions";
import type { OpportunityJudgeRuntimeSummary } from "@/lib/helm-v2/opportunity-judge-runtime";
import { formatDateLabel } from "@/lib/utils";

type MeetingV2OpportunityJudgeCardProps = {
  meetingId: string;
  runtime: OpportunityJudgeRuntimeSummary | null;
};

type ReviewMode =
  | "confirm"
  | "edit_confirm"
  | "reject"
  | "keep_draft"
  | "block_boundary"
  | "insufficient_evidence";

function renderStatusVariant(status: string) {
  if (status.includes("FAILED") || status.includes("REJECTED") || status.includes("blocked")) return "danger" as const;
  if (status.includes("CONFIRMED") || status.includes("COMPLETED") || status.includes("APPROVED") || status.includes("consumed")) {
    return "success" as const;
  }
  if (status.includes("PENDING") || status.includes("QUEUED") || status.includes("RUNNING")) return "approval" as const;
  return "neutral" as const;
}

function reviewSuccessMessage(mode: ReviewMode, english: boolean, shadowConsumed: boolean, blockedByBoundary: boolean, insufficientEvidence: boolean) {
  if (blockedByBoundary || mode === "block_boundary") {
    return english ? "Judgement blocked by boundary" : "判断已被边界阻断";
  }
  if (insufficientEvidence || mode === "insufficient_evidence") {
    return english ? "Judgement kept draft due to insufficient evidence" : "依据不足，判断已保留为草稿";
  }
  if (mode === "reject") {
    return english ? "Opportunity judgement rejected" : "机会判断已驳回";
  }
  if (mode === "keep_draft") {
    return english ? "Opportunity judgement kept as draft" : "机会判断已保留为草稿";
  }
  if (shadowConsumed) {
    return english ? "Shadow judgement confirmed and consumed" : "阴影判断已确认并写入阴影摘要";
  }
  return english ? "Opportunity judgement review updated" : "机会判断复核已更新";
}

function OpportunityJudgeReviewForm({
  english,
  pending,
  defaultDeltaJson,
  defaultNextStepBriefMarkdown,
  defaultReviewNotes,
  onSubmit,
}: {
  english: boolean;
  pending: boolean;
  defaultDeltaJson: string;
  defaultNextStepBriefMarkdown: string;
  defaultReviewNotes: string;
  onSubmit: (input: { mode: ReviewMode; deltaJson: string; nextStepBriefMarkdown: string; reviewNotes: string }) => void;
}) {
  const [deltaJson, setDeltaJson] = useState(defaultDeltaJson);
  const [nextStepBriefMarkdown, setNextStepBriefMarkdown] = useState(defaultNextStepBriefMarkdown);
  const [reviewNotes, setReviewNotes] = useState(defaultReviewNotes);

  const submit = (mode: ReviewMode) => {
    onSubmit({
      mode,
      deltaJson,
      nextStepBriefMarkdown,
      reviewNotes,
    });
  };

  return (
    <div className="mt-4 space-y-4">
      <div>
        <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "opportunity delta json" : "机会差异 JSON"}</p>
        <Textarea value={deltaJson} onChange={(event) => setDeltaJson(event.target.value)} rows={12} className="mt-2 font-mono text-xs" />
      </div>
      <div>
        <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "next-step brief markdown" : "下一步摘要 Markdown"}</p>
        <Textarea
          value={nextStepBriefMarkdown}
          onChange={(event) => setNextStepBriefMarkdown(event.target.value)}
          rows={12}
          className="mt-2 font-mono text-xs"
        />
      </div>
      <div>
        <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "review notes" : "复核备注"}</p>
        <Textarea value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} rows={4} className="mt-2 text-sm" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => submit("keep_draft")} disabled={pending}>
          {english ? "Keep as draft" : "保留为草稿"}
        </Button>
        <Button variant="secondary" onClick={() => submit("reject")} disabled={pending}>
          {english ? "Reject" : "驳回"}
        </Button>
        <Button variant="secondary" onClick={() => submit("insufficient_evidence")} disabled={pending}>
          <AlertTriangle className="h-4 w-4" />
          {english ? "Insufficient evidence" : "标记依据不足"}
        </Button>
        <Button variant="secondary" onClick={() => submit("block_boundary")} disabled={pending}>
          <ShieldAlert className="h-4 w-4" />
          {english ? "Block by boundary" : "按边界阻断"}
        </Button>
        <Button variant="secondary" onClick={() => submit("edit_confirm")} disabled={pending}>
          <Sparkles className="h-4 w-4" />
          {english ? "Edit then confirm" : "编辑后确认"}
        </Button>
        <Button onClick={() => submit("confirm")} disabled={pending}>
          <CheckCircle2 className="h-4 w-4" />
          {english ? "Confirm shadow consume" : "确认写入阴影摘要"}
        </Button>
      </div>
    </div>
  );
}

export function MeetingV2OpportunityJudgeCard({ meetingId, runtime }: MeetingV2OpportunityJudgeCardProps) {
  const router = useRouter();
  const { locale } = useWorkspaceUi();
  const english = locale === "en-US";
  const [pending, startTransition] = useTransition();

  const runRuntime = (force = true) => {
    startTransition(async () => {
      const result = await runMeetingOpportunityJudgeRuntimeAction(meetingId, force);
      if (!result.ok) {
        toast.error(result.error ?? (english ? "Opportunity judge runtime failed" : "机会判断运行时失败"));
        return;
      }
      toast.success(
        result.reused
          ? english
            ? "Existing opportunity judgement reused"
            : "已复用现有机会判断"
          : english
            ? "Opportunity Judge runtime started"
            : "机会判断运行时已启动",
      );
      router.refresh();
    });
  };

  const submitReview = (input: { mode: ReviewMode; deltaJson: string; nextStepBriefMarkdown: string; reviewNotes: string }) => {
    startTransition(async () => {
      const result = await reviewMeetingOpportunityJudgeRuntimeAction({
        meetingId,
        mode: input.mode,
        deltaJson: input.deltaJson,
        nextStepBriefMarkdown: input.nextStepBriefMarkdown,
        reviewNotes: input.reviewNotes,
      });

      if (!result.ok) {
        toast.error(result.error ?? (english ? "Opportunity judgement review failed" : "机会判断复核失败"));
        return;
      }

      toast.success(
        reviewSuccessMessage(
          input.mode,
          english,
          Boolean(result.shadowConsumed),
          Boolean(result.blockedByBoundary),
          Boolean(result.insufficientEvidence),
        ),
      );
      router.refresh();
    });
  };

  const canReview =
    runtime?.artifactReview &&
    runtime.artifactReview.status !== "CONFIRMED" &&
    runtime.artifactReview.status !== "REJECTED";

  return (
    <Card className="workspace-panel" data-helm-v2-opportunity-judge-runtime="true">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">{english ? "Helm v2 · opportunity" : "Helm v2 · 机会判断"}</Badge>
          <Badge variant="neutral">{english ? "confirmed facts → opportunity judgement" : "已确认事实 → 机会判断"}</Badge>
          {runtime?.latestOpportunityDeltaEvent ? (
            <Badge variant={renderStatusVariant(runtime.latestOpportunityDeltaEvent.status)}>{runtime.latestOpportunityDeltaEvent.status}</Badge>
          ) : null}
          {runtime?.approvalRequest ? (
            <Badge variant={renderStatusVariant(runtime.approvalRequest.status)}>
              {runtime.approvalRequest.approvalTier} · {runtime.approvalRequest.status}
            </Badge>
          ) : null}
          {runtime?.bundle ? <Badge variant={renderStatusVariant(runtime.bundle.reviewStatus)}>{runtime.bundle.reviewStatus}</Badge> : null}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>{english ? "Helm v2 opportunity judgement runtime" : "Helm v2 机会判断运行时"}</CardTitle>
            <CardDescription>
              {runtime
                ? english
                  ? "Confirmed facts flow into stage, attention, next-step, review. CRM stays unchanged."
                  : "确认的会议事实会进入阶段、关注、下一步、复核。正式 CRM 不变。"
                : english
                  ? "Waiting for confirmed meeting facts."
                  : "等会议事实被人工确认后启动。"}
            </CardDescription>
          </div>
          <Button variant="secondary" onClick={() => runRuntime(true)} disabled={pending}>
            <RefreshCcw className="h-4 w-4" />
            {english ? "Run / rerun judgement" : "运行 / 重跑判断"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {runtime ? (
          <>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="theme-surface-panel rounded-2xl px-4 py-4">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "proposed stage" : "建议阶段"}</p>
                <p className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">
                  {runtime.opportunityDelta ? `${runtime.opportunityDelta.stageShadowFrom} → ${runtime.opportunityDelta.stageShadowTo}` : english ? "pending" : "待生成"}
                </p>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{english ? "shadow only, review required" : "仅阴影，仍需复核"}</p>
              </div>
              <div className="theme-surface-panel rounded-2xl px-4 py-4">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "blockers" : "阻塞项"}</p>
                <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">{runtime.opportunityDelta?.blockers.length ?? 0}</p>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{english ? "fact-derived and inferred separated" : "事实派生 与 推导 已分层"}</p>
              </div>
              <div className="theme-surface-panel rounded-2xl px-4 py-4">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "manager attention" : "主管关注"}</p>
                <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">{runtime.managerAttentionFlags?.flags.length ?? 0}</p>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{english ? "attention only, not final decision" : "只是关注，不是最终判断"}</p>
              </div>
              <div className="theme-surface-panel rounded-2xl px-4 py-4">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "shadow posture" : "阴影状态"}</p>
                <p className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">{runtime.currentShadow?.stage ?? (english ? "not consumed" : "尚未写入")}</p>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{english ? "confirm still does not mean official writeback" : "确认仍不等于正式写回"}</p>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.06fr_0.94fr]">
              <div className="space-y-4">
                <div className="theme-surface-panel rounded-2xl px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Next-step brief" : "下一步摘要"}</p>
                    {runtime.latestOpportunityDeltaEvent ? (
                      <p className="text-xs text-[color:var(--muted-foreground)]">
                        {english ? "latest run" : "最近运行"} · {formatDateLabel(runtime.latestOpportunityDeltaEvent.createdAt)}
                      </p>
                    ) : null}
                  </div>
                  <pre className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[color:var(--foreground)]">
                    {runtime.nextStepBrief?.markdown ?? (english ? "No next-step brief yet." : "当前还没有下一步摘要。")}
                  </pre>
                </div>

                <div className="theme-surface-panel rounded-2xl px-4 py-4">
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Shadow delta" : "阴影差异"}</p>
                  <pre className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[color:var(--foreground)]">
                    {runtime.editorDraft?.deltaJson ??
                      (runtime.opportunityDelta ? JSON.stringify(runtime.opportunityDelta, null, 2) : english ? "No opportunity delta yet." : "当前还没有机会差异。")}
                  </pre>
                </div>
              </div>

              <div className="space-y-4">
                <div className="theme-surface-panel rounded-2xl px-4 py-4">
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Manager attention and evidence" : "主管关注与依据"}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {runtime.bundle ? <Badge variant={renderStatusVariant(runtime.bundle.reviewStatus)}>{runtime.bundle.reviewStatus}</Badge> : null}
                    {runtime.approvalRequest ? <Badge variant={renderStatusVariant(runtime.approvalRequest.status)}>{runtime.approvalRequest.status}</Badge> : null}
                    {runtime.currentShadow?.stage ? <Badge variant="success">{runtime.currentShadow.stage}</Badge> : null}
                  </div>
                  <ul className="mt-3 space-y-2 text-sm text-[color:var(--muted)]">
                    {(runtime.managerAttentionFlags?.flags ?? []).map((item) => (
                      <li key={item.key}>
                        - {item.key}: {item.detail}
                      </li>
                    ))}
                    {!(runtime.managerAttentionFlags?.flags?.length) ? (
                      <li>- {english ? "No manager attention flags yet." : "当前还没有主管关注标记。"}</li>
                    ) : null}
                  </ul>
                  <div className="mt-4 space-y-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                    <p>{runtime.bundle?.boundaryNotes[0] ?? (english ? "Shadow consume still requires explicit review." : "写入阴影摘要仍需显式复核。")}</p>
                    <p>{runtime.bundle?.approvedMeans ?? (english ? "Approved means shadow summary consume only." : "批准只表示允许写入阴影摘要。")}</p>
                    <p>{runtime.bundle?.approvedDoesNotMean ?? (english ? "Approved does not mean official CRM writeback." : "批准不代表正式 CRM 写回。")}</p>
                  </div>
                </div>

                <div className="theme-surface-panel rounded-2xl px-4 py-4">
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Current shadow summary" : "当前阴影摘要"}</p>
                  <ul className="mt-3 space-y-2 text-sm text-[color:var(--muted)]">
                    <li>- {english ? "stage" : "阶段"}: {runtime.currentShadow?.stage ?? (english ? "not consumed yet" : "尚未写入")}</li>
                    <li>- {english ? "next action" : "下一步动作"}: {runtime.currentShadow?.nextAction ?? (english ? "not consumed yet" : "尚未写入")}</li>
                    <li>- {english ? "blockers" : "阻塞项"}: {runtime.currentShadow?.blockersSummary ?? (english ? "not consumed yet" : "尚未写入")}</li>
                    <li>- {english ? "manager attention" : "主管关注"}: {runtime.currentShadow?.managerAttentionFlag ? (english ? "yes" : "是") : (english ? "no" : "否")}</li>
                    <li>- {english ? "next-step summary" : "下一步摘要"}: {runtime.currentShadow?.nextStepSummary ?? (english ? "not consumed yet" : "尚未写入")}</li>
                  </ul>
                </div>

                {canReview ? (
                  <div className="theme-surface-panel rounded-2xl px-4 py-4">
                    <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Review shadow judgement" : "复核阴影判断"}</p>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                      {english
                        ? "You can confirm shadow consume, edit then confirm, reject, keep as draft, mark insufficient evidence, or block this judgement by boundary. Confirm still does not mean official CRM writeback."
                        : "你可以确认写入阴影摘要、编辑后确认、驳回、保留为草稿、标记依据不足，或按边界阻断。确认仍不等于正式 CRM 写回。"}
                    </p>
                    <OpportunityJudgeReviewForm
                      key={runtime.artifactReview?.id ?? runtime.latestOpportunityDeltaEvent?.id ?? meetingId}
                      english={english}
                      pending={pending}
                      defaultDeltaJson={runtime.editorDraft?.deltaJson ?? ""}
                      defaultNextStepBriefMarkdown={runtime.editorDraft?.nextStepBriefMarkdown ?? runtime.nextStepBrief?.markdown ?? ""}
                      defaultReviewNotes={runtime.editorDraft?.reviewNotes ?? ""}
                      onSubmit={submitReview}
                    />
                  </div>
                ) : (
                  <div className="theme-surface-panel rounded-2xl px-4 py-4">
                    <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Current review outcome" : "当前复核结果"}</p>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                      {runtime.artifactReview?.status === "CONFIRMED"
                        ? english
                          ? "This judgement bundle has been confirmed for shadow consume only. Official CRM state still remains unchanged."
                          : "这组判断套件已被确认写入阴影摘要，但正式 CRM 状态仍保持不变。"
                        : runtime.artifactReview?.status === "REJECTED"
                          ? english
                            ? "This judgement bundle has been rejected or boundary-blocked. Evidence remains visible, but nothing writes official state."
                            : "这组判断套件已被驳回或按边界阻断。依据仍可见，但不会写入正式状态。"
                          : runtime.artifactReview?.status === "KEPT_DRAFT"
                            ? english
                              ? "This judgement bundle is intentionally kept as draft for a later review pass."
                              : "这组判断套件当前被明确保留为草稿，等待下一轮复核。"
                            : english
                              ? "This judgement bundle is not waiting on review right now."
                              : "当前这组判断套件暂时不在等待复核。"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="theme-surface-panel rounded-2xl px-4 py-5 text-sm leading-6 text-[color:var(--muted)]">
            {english
              ? "Not started yet. Once meeting facts are confirmed, you'll see an opportunity delta, attention flags and a next-step brief."
              : "还没启动。会议事实确认后，这里会出现机会差异、关注标记和下一步摘要。"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
