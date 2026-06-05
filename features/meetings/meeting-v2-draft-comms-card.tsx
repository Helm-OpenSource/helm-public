"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Mail, RefreshCcw, ShieldAlert, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  reviewMeetingDraftCommsRuntimeAction,
  runMeetingDraftCommsRuntimeAction,
} from "@/features/meetings/actions";
import { formatMeetingDraftCommsDateLabel } from "@/features/meetings/meeting-v2-draft-comms-date-labels";
import { formatMeetingDisplayText } from "@/features/meetings/display-copy";
import type { DraftCommsRuntimeSummary } from "@/lib/helm-v2/draft-comms-handoff-runtime";
import { formatDateLabel } from "@/lib/utils";

type MeetingV2DraftCommsCardProps = {
  meetingId: string;
  runtime: DraftCommsRuntimeSummary | null;
};

type ReviewMode =
  | "approve"
  | "edit_approve"
  | "reject"
  | "keep_draft"
  | "block_boundary"
  | "fallback_non_commitment";

function renderStatusVariant(status: string) {
  if (status.includes("FAILED") || status.includes("REJECTED") || status.includes("blocked")) return "danger" as const;
  if (status.includes("CONFIRMED") || status.includes("COMPLETED") || status.includes("APPROVED")) return "success" as const;
  if (status.includes("PENDING") || status.includes("QUEUED") || status.includes("RUNNING")) return "approval" as const;
  return "neutral" as const;
}

function formatDraftCommsDate(value: Date | string | null | undefined, english: boolean) {
  return formatMeetingDraftCommsDateLabel(value, english, formatDateLabel);
}

function reviewSuccessMessage(mode: ReviewMode, english: boolean, approvedForNextStepHandoff: boolean, blockedByBoundary: boolean) {
  if (blockedByBoundary || mode === "block_boundary") {
    return english ? "Draft marked as boundary-blocked" : "草稿已标记为边界阻断";
  }
  if (mode === "reject") {
    return english ? "Draft comms rejected" : "沟通草稿已驳回";
  }
  if (mode === "keep_draft") {
    return english ? "Draft kept for later review" : "已保留为草稿，稍后再复核";
  }
  if (mode === "fallback_non_commitment") {
    return english ? "Fallback wording approved for manual handoff" : "非承诺兜底措辞已允许进入人工交接";
  }
  if (approvedForNextStepHandoff) {
    return english ? "Draft approved for next-step manual handoff" : "草稿已允许进入下一步人工交接";
  }
  return english ? "Draft comms review updated" : "沟通草稿复核已更新";
}

function DraftCommsReviewForm({
  english,
  pending,
  defaultMarkdown,
  defaultReviewNotes,
  onSubmit,
}: {
  english: boolean;
  pending: boolean;
  defaultMarkdown: string;
  defaultReviewNotes: string;
  onSubmit: (input: { mode: ReviewMode; sanitizedMarkdown: string; reviewNotes: string }) => void;
}) {
  const [sanitizedMarkdown, setSanitizedMarkdown] = useState(defaultMarkdown);
  const [reviewNotes, setReviewNotes] = useState(defaultReviewNotes);

  const submit = (mode: ReviewMode) => {
    onSubmit({
      mode,
      sanitizedMarkdown,
      reviewNotes,
    });
  };

  return (
    <div className="mt-4 space-y-4">
      <div>
        <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
          {english ? "sanitized customer-facing draft" : "已清理的客户草稿"}
        </p>
        <Textarea
          value={sanitizedMarkdown}
          onChange={(event) => setSanitizedMarkdown(event.target.value)}
          rows={14}
          className="mt-2 font-mono text-xs"
        />
      </div>
      <div>
        <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "review notes" : "复核说明"}</p>
        <Textarea value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} rows={4} className="mt-2 text-sm" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => submit("keep_draft")} disabled={pending}>
          {english ? "Keep as draft" : "保留为草稿"}
        </Button>
        <Button variant="secondary" onClick={() => submit("reject")} disabled={pending}>
          {english ? "Reject" : "驳回"}
        </Button>
        <Button variant="secondary" onClick={() => submit("block_boundary")} disabled={pending}>
          <ShieldAlert className="h-4 w-4" />
          {english ? "block by boundary" : "标记边界阻断"}
        </Button>
        <Button variant="secondary" onClick={() => submit("fallback_non_commitment")} disabled={pending}>
          <Sparkles className="h-4 w-4" />
          {english ? "Fallback wording" : "切到非承诺兜底措辞"}
        </Button>
        <Button variant="secondary" onClick={() => submit("edit_approve")} disabled={pending}>
          <Mail className="h-4 w-4" />
          {english ? "Edit then approve" : "编辑后允许下一步"}
        </Button>
        <Button onClick={() => submit("approve")} disabled={pending}>
          <CheckCircle2 className="h-4 w-4" />
          {english ? "approve for next-step handoff" : "允许进入下一步交接"}
        </Button>
      </div>
    </div>
  );
}

export function MeetingV2DraftCommsCard({ meetingId, runtime }: MeetingV2DraftCommsCardProps) {
  const router = useRouter();
  const { locale } = useWorkspaceUi();
  const english = locale === "en-US";
  const [pending, startTransition] = useTransition();
  const text = (value: string) => formatMeetingDisplayText(value, english);

  const runRuntime = (force = true) => {
    startTransition(async () => {
      const result = await runMeetingDraftCommsRuntimeAction(meetingId, force);
      if (!result.ok) {
        toast.error(result.error ?? (english ? "Draft-only comms runtime failed" : "沟通草稿链路失败"));
        return;
      }
      toast.success(result.reused ? (english ? "Existing draft-only comms runtime reused" : "已复用现有沟通草稿链路") : (english ? "Draft-only comms runtime started" : "沟通草稿链路已启动"));
      router.refresh();
    });
  };

  const submitReview = (input: { mode: ReviewMode; sanitizedMarkdown: string; reviewNotes: string }) => {
    startTransition(async () => {
      const result = await reviewMeetingDraftCommsRuntimeAction({
        meetingId,
        mode: input.mode,
        sanitizedMarkdown: input.sanitizedMarkdown,
        reviewNotes: input.reviewNotes,
      });

      if (!result.ok) {
        toast.error(result.error ?? (english ? "Draft-only comms review failed" : "沟通草稿复核失败"));
        return;
      }

      toast.success(
        reviewSuccessMessage(input.mode, english, Boolean(result.approvedForNextStepHandoff), Boolean(result.blockedByBoundary)),
      );
      router.refresh();
    });
  };

  const canReview =
    runtime?.artifactReview &&
    runtime.artifactReview.status !== "CONFIRMED" &&
    runtime.artifactReview.status !== "REJECTED";

  return (
    <Card className="workspace-panel" data-helm-v2-draft-comms-runtime="true">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">{english ? "Helm v2 · draft comms" : "Helm v2 · 沟通草稿"}</Badge>
          <Badge variant="neutral">{english ? "action pack → draft-only comms" : "行动包 → 沟通草稿"}</Badge>
          {runtime?.latestFollowupRequestedEvent ? (
            <Badge variant={renderStatusVariant(runtime.latestFollowupRequestedEvent.status)}>{runtime.latestFollowupRequestedEvent.status}</Badge>
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
            <CardTitle>{english ? "Helm v2 draft-only comms handoff runtime" : "会后沟通草稿交接链路"}</CardTitle>
            <CardDescription>
              {runtime
                ? english
                  ? "Confirmed meeting facts are now flowing into customer follow-up drafts, internal briefs, calendar suggestions, risk guard, and review-before-send."
                  : "已确认会议事实现在会继续进入客户跟进草稿、内部简报、日程建议、风险检查和发送前复核。"
                : english
                  ? "Waiting for the action pack to be confirmed."
                  : "等行动包被人工确认后启动。"}
            </CardDescription>
          </div>
          <Button variant="secondary" onClick={() => runRuntime(true)} disabled={pending}>
            <RefreshCcw className="h-4 w-4" />
            {english ? "Run / rerun draft runtime" : "运行 / 重跑草稿链路"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {runtime ? (
          <>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="theme-surface-panel rounded-2xl px-4 py-4">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "customer artifacts" : "客户表达物"}</p>
                <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
                  {runtime.bundle?.artifactList.filter((item) => item.audience === "customer").length ?? 0}
                </p>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{english ? "draft-only, review required" : "仅草稿，必须复核"}</p>
              </div>
              <div className="theme-surface-panel rounded-2xl px-4 py-4">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "guard posture" : "风险检查状态"}</p>
                <p className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">{runtime.riskReview?.riskLevel ?? (english ? "pending" : "待检查")}</p>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{english ? "risk guard is mandatory" : "必须经过风险检查"}</p>
              </div>
              <div className="theme-surface-panel rounded-2xl px-4 py-4">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "open questions" : "待确认问题"}</p>
                <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">{runtime.bundle?.openQuestions.length ?? 0}</p>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{english ? "still waiting on explicit confirmation" : "仍待显式确认"}</p>
              </div>
              <div className="theme-surface-panel rounded-2xl px-4 py-4">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "handoff posture" : "交接状态"}</p>
                <p className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">
                  {runtime.handoffPosture?.approvedForNextStepHandoff ? (english ? "Approved" : "允许下一步") : runtime.handoffPosture?.blockedByBoundary ? (english ? "Blocked" : "已阻断") : (english ? "Pending review" : "待复核")}
                </p>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{english ? "approved still does not mean sent" : "已允许仍不等于已发送"}</p>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.06fr_0.94fr]">
              <div className="space-y-4">
                <div className="theme-surface-panel rounded-2xl px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Current customer-facing handoff draft" : "当前客户跟进交接草稿"}</p>
                    {runtime.latestFollowupRequestedEvent ? (
                      <p className="text-xs text-[color:var(--muted-foreground)]">
                        {english ? "latest run" : "最近运行"} · {formatDraftCommsDate(runtime.latestFollowupRequestedEvent.createdAt, english)}
                      </p>
                    ) : null}
                  </div>
                  <pre className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[color:var(--foreground)]">
                    {text(runtime.sanitizedArtifact?.markdown ?? runtime.customerFollowupDraft?.markdown ?? (english ? "No draft-only handoff artifact yet." : "当前还没有沟通交接草稿。"))}
                  </pre>
                </div>

                <div className="theme-surface-panel rounded-2xl px-4 py-4">
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Email draft and message variants" : "邮件草稿与消息版本"}</p>
                  <div className="mt-3 space-y-4">
                    <div>
                      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "email draft" : "邮件草稿"}</p>
                      <pre className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[color:var(--foreground)]">
                        {text(runtime.emailDraft?.body ?? (english ? "No email draft yet." : "当前还没有邮件草稿。"))}
                      </pre>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "message variants" : "消息版本"}</p>
                      <pre className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[color:var(--foreground)]">
                        {text(runtime.messageVariants?.markdown ?? (english ? "No message variants yet." : "当前还没有消息版本。"))}
                      </pre>
                    </div>
                  </div>
                </div>

                {runtime.calendarOptions?.options?.length ? (
                  <div className="theme-surface-panel rounded-2xl px-4 py-4">
                    <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Calendar suggestions" : "日程建议"}</p>
                    <ul className="mt-3 space-y-2 text-sm text-[color:var(--muted)]">
                      {runtime.calendarOptions.options.map((option) => (
                        <li key={option.label}>
                          - {option.label}: {option.startsAt} → {option.endsAt}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-sm leading-6 text-[color:var(--muted-foreground)]">
                      {english
                        ? "Suggestions only — no auto-booking."
                        : "只是建议——不会自动预约。"}
                    </p>
                  </div>
                ) : null}
              </div>

              <div className="space-y-4">
                <div className="theme-surface-panel rounded-2xl px-4 py-4">
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Audience-specific briefs" : "分受众表达物"}</p>
                  <div className="mt-3 space-y-4">
                    <div>
                      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "internal collab brief" : "内部协同简报"}</p>
                      <pre className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[color:var(--foreground)]">
                        {text(runtime.internalCollabBrief?.markdown ?? (english ? "No internal brief yet." : "当前还没有内部简报。"))}
                      </pre>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "exec brief" : "管理层简报"}</p>
                      <pre className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[color:var(--foreground)]">
                        {text(runtime.execBrief?.markdown ?? (english ? "No exec brief yet." : "当前还没有管理层简报。"))}
                      </pre>
                    </div>
                  </div>
                </div>

                <div className="theme-surface-panel rounded-2xl px-4 py-4">
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Risk guard and boundary posture" : "风险检查与边界状态"}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {runtime.riskReview ? <Badge variant={renderStatusVariant(runtime.riskReview.riskLevel)}>{runtime.riskReview.riskLevel}</Badge> : null}
                    {runtime.approvalRequest ? <Badge variant={renderStatusVariant(runtime.approvalRequest.status)}>{runtime.approvalRequest.status}</Badge> : null}
                    {runtime.artifactReview ? <Badge variant={renderStatusVariant(runtime.artifactReview.status)}>{runtime.artifactReview.status}</Badge> : null}
                  </div>
                  <ul className="mt-3 space-y-2 text-sm text-[color:var(--muted)]">
                    {(runtime.riskReview?.checks ?? []).map((item) => (
                      <li key={item.key}>
                        - {item.key}: {item.status} · {item.detail}
                      </li>
                    ))}
                    {!(runtime.riskReview?.checks?.length) ? <li>- {english ? "Risk guard has not produced checks yet." : "风险检查当前还没有产出检查项。"}</li> : null}
                  </ul>
                  <div className="mt-4 space-y-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                    <p>{text(runtime.handoffPosture?.boundaryNote ?? (english ? "Draft-only comms remains within review-before-send." : "沟通草稿当前仍停在发送前复核。"))}</p>
                    <p>{text(runtime.bundle?.approvedMeans ?? (english ? "Approved means manual next-step handoff only." : "已允许只表示可以人工进入下一步交接。"))}</p>
                    <p>{text(runtime.bundle?.approvedDoesNotMean ?? (english ? "Approved does not mean sent." : "已允许不代表已发送。"))}</p>
                  </div>
                </div>

                <div className="theme-surface-panel rounded-2xl px-4 py-4">
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Evidence and next action" : "依据与下一步动作"}</p>
                  <div className="mt-3 grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "evidence refs" : "依据引用"}</p>
                      <ul className="mt-2 space-y-1 text-sm text-[color:var(--muted)]">
                        {(runtime.bundle?.evidenceRefs ?? []).map((item) => (
                          <li key={item}>- {item}</li>
                        ))}
                        {!(runtime.bundle?.evidenceRefs.length) ? <li>- {english ? "No evidence refs yet." : "当前还没有依据引用。"}</li> : null}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "recommended next action" : "建议下一步动作"}</p>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                        {text(runtime.bundle?.recommendedNextAction ?? (english ? "No recommended next action yet." : "当前还没有建议下一步动作。"))}
                      </p>
                    </div>
                  </div>
                </div>

                {canReview ? (
                  <div className="theme-surface-panel rounded-2xl px-4 py-4">
                    <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Review before send" : "发送前复核"}</p>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                      {english
                        ? "You can review, edit-then-approve, fallback to non-commitment wording, reject, keep as draft, or block this draft by boundary. Approved still means only manual next-step handoff."
                        : "你可以复核、编辑后允许下一步、切换到非承诺兜底措辞、驳回、保留为草稿，或者直接边界阻断。已允许仍然只表示可以进入下一步人工交接。"}
                    </p>
                    <DraftCommsReviewForm
                      key={runtime.artifactReview?.id ?? runtime.latestFollowupRequestedEvent?.id ?? meetingId}
                      english={english}
                      pending={pending}
                      defaultMarkdown={runtime.editorDraft?.sanitizedMarkdown ?? runtime.sanitizedArtifact?.markdown ?? ""}
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
                          ? "This draft bundle has been approved for next-step manual handoff, but it still has no send authority."
                          : "这组草稿包已允许进入下一步人工交接，但仍然没有发送权限。"
                        : runtime.artifactReview?.status === "REJECTED"
                          ? english
                            ? "This draft bundle has been rejected or boundary-blocked. Evidence remains visible, but nothing is sent."
                            : "这组草稿包已被驳回或边界阻断。依据仍可见，但不会有任何发送动作。"
                          : runtime.artifactReview?.status === "KEPT_DRAFT"
                            ? english
                              ? "This draft bundle is intentionally kept as draft for a later review pass."
                              : "这组草稿包当前被明确保留为草稿，等待下一轮复核。"
                            : english
                              ? "This draft bundle is not waiting on review right now."
                              : "当前这组草稿包暂时不在等待复核。"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="theme-surface-panel rounded-2xl px-4 py-5 text-sm leading-6 text-[color:var(--muted)]">
            {english
              ? "Not started yet. Once the action pack is confirmed, drafts, briefs and calendar options will land here for review-before-send."
              : "还没启动。行动包确认后，这里会出现客户草稿、内部简报、日程建议——发送前等你复核。"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
