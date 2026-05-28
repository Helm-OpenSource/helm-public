import { Badge } from "@/components/ui/badge";
import type { MeetingRuntimeSummary } from "@/lib/helm-v2/meeting-action-pack-runtime";
import { MeetingV2RuntimeReviewForm } from "@/features/meetings/meeting-v2-runtime-review-form";
import { renderStatusVariant, type MeetingV2RuntimeReviewPayload } from "@/features/meetings/meeting-v2-runtime-shared";

type MeetingV2RuntimeReviewPanelProps = {
  meetingId: string;
  runtime: MeetingRuntimeSummary;
  english: boolean;
  pending: boolean;
  canReview: boolean;
  text: (value: string) => string;
  onSubmit: (payload: MeetingV2RuntimeReviewPayload) => void;
};

export function MeetingV2RuntimeReviewPanel({
  meetingId,
  runtime,
  english,
  pending,
  canReview,
  text,
  onSubmit,
}: MeetingV2RuntimeReviewPanelProps) {
  return (
    <>
      <div className="theme-surface-panel min-w-0 max-w-full overflow-hidden rounded-2xl px-4 py-4">
        <p className="break-words text-sm font-semibold text-[color:var(--foreground)]">{english ? "Current review posture" : "当前复核状态"}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {runtime.approvalRequest ? (
            <Badge variant={renderStatusVariant(runtime.approvalRequest.status)}>
              {runtime.approvalRequest.approvalTier} · {runtime.approvalRequest.status}
            </Badge>
          ) : null}
          {runtime.artifactReview ? (
            <Badge variant={renderStatusVariant(runtime.artifactReview.status)}>{runtime.artifactReview.status}</Badge>
          ) : null}
          {runtime.judgeRun ? (
            <Badge variant={renderStatusVariant(runtime.judgeRun.status)}>
              {english ? "judge" : "judge"} · {runtime.judgeRun.status}
            </Badge>
          ) : null}
        </div>
        <p className="mt-3 break-words text-sm leading-6 text-[color:var(--muted)]">
          {runtime.approvalRequest?.requestedReason
            ? text(runtime.approvalRequest.requestedReason)
            : english
              ? "Meeting facts must stay draft until a human confirms them."
              : "会议事实在人工确认前必须保持草稿。"}
        </p>
        {runtime.artifactReview?.reviewNotes ? (
          <p className="mt-2 break-words text-sm leading-6 text-[color:var(--muted-foreground)]">{text(runtime.artifactReview.reviewNotes)}</p>
        ) : null}
      </div>

      {canReview ? (
        <div className="theme-surface-panel min-w-0 max-w-full overflow-hidden rounded-2xl px-4 py-4">
          <p className="break-words text-sm font-semibold text-[color:var(--foreground)]">{english ? "Human confirm" : "人工确认"}</p>
          <p className="mt-2 break-words text-sm leading-6 text-[color:var(--muted)]">
            {english
              ? "Confirm, edit-then-confirm, reject, or keep this draft. Only confirmed facts can promote memory and trigger downstream opportunity judgement."
              : "你可以确认、编辑后确认、驳回，或保留草稿。只有确认后的事实才能提升为记忆，并继续触发下游机会判断。"}
          </p>
          <MeetingV2RuntimeReviewForm
            key={runtime.artifactReview?.id ?? runtime.latestMeetingEndedEvent?.id ?? meetingId}
            english={english}
            pending={pending}
            defaultFactsJson={runtime.editorDraft?.factsJson ?? ""}
            defaultActionPackMarkdown={runtime.editorDraft?.actionPackMarkdown ?? ""}
            defaultReviewNotes={runtime.editorDraft?.reviewNotes ?? ""}
            onSubmit={onSubmit}
          />
        </div>
      ) : (
        <div className="theme-surface-panel rounded-2xl px-4 py-4">
          <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Current outcome" : "当前结果"}</p>
          <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
            {runtime.artifactReview?.status === "CONFIRMED"
              ? english
                ? "This meeting runtime has been confirmed. Promotable memory is visible below, and downstream judgement can now review any shadow consume separately."
                : "这条会议运行链已确认。可提升的记忆已在下方可见，后续影子消费需要再经过单独的下游判断复核。"
              : runtime.artifactReview?.status === "REJECTED"
                ? english
                  ? "This runtime was rejected. Evidence is retained, but nothing was promoted or written into shadow state."
                  : "这条运行时已被拒绝。evidence 仍然保留，但没有 晋升，也没有写入阴影状态。"
                : english
                  ? "This runtime is not waiting on human confirmation right now."
                  : "当前这条运行链暂时不在等待人工确认。"}
          </p>
        </div>
      )}
    </>
  );
}
