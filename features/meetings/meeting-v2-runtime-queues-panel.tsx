import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MeetingRuntimeSummary } from "@/lib/helm-v2/meeting-action-pack-runtime";
import { formatDateLabel } from "@/lib/utils";
import { renderStatusVariant } from "@/features/meetings/meeting-v2-runtime-shared";

type MeetingV2RuntimeQueuesPanelProps = {
  runtime: MeetingRuntimeSummary;
  english: boolean;
  pending: boolean;
  canManageRuntime: boolean;
  canReviewRuntime: boolean;
  queueReflection: () => void;
  queueConsolidation: () => void;
  updateConsolidation: (jobId: string, mode: "pause" | "resume") => void;
  acceptReflectionCandidate: (candidateId: string) => void;
  dismissReflectionCandidate: (candidateId: string) => void;
};

export function MeetingV2RuntimeQueuesPanel({
  runtime,
  english,
  pending,
  canManageRuntime,
  canReviewRuntime,
  queueReflection,
  queueConsolidation,
  updateConsolidation,
  acceptReflectionCandidate,
  dismissReflectionCandidate,
}: MeetingV2RuntimeQueuesPanelProps) {
  const v21 = runtime.v21;
  if (!v21) return null;

  return (
    <>
      <div className="theme-surface-panel rounded-2xl px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Reflection queue" : "reflection queue"}</p>
          {canManageRuntime ? (
            <Button variant="secondary" onClick={queueReflection} disabled={pending}>
              {english ? "Queue reflection" : "加入反思队列"}
            </Button>
          ) : null}
        </div>
        <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
          {english
            ? "Reflection only compacts trusted runtime state into a reviewable 延续 summary. It does not auto-promote memory or rewrite canonical truth."
            : "反思只会把 可信运行时状态 收成可复核的 续传摘要，不会自动 晋升 经营记忆，也不会改写 权威事实。"}
        </p>
        <p className="mt-3 text-sm text-[color:var(--muted-foreground)]">
          {english
            ? `${v21.reflection.activeJobs} active reflection jobs in this session`
            : `当前 session 有 ${v21.reflection.activeJobs} 个 active 反思 jobs`}
        </p>
        <div className="mt-3 space-y-3">
          {v21.reflection.recentJobs.map((job) => (
            <div key={job.id} className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={renderStatusVariant(job.status)}>{job.status}</Badge>
                  <span className="text-xs font-medium text-[color:var(--muted-foreground)]">{job.jobType}</span>
                </div>
                <span className="text-xs text-[color:var(--muted-foreground)]">{formatDateLabel(job.createdAt)}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">{job.inputSummary}</p>
              {job.outputSummary ? (
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">{job.outputSummary}</p>
              ) : null}
              {canManageRuntime ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {job.status !== "PAUSED" ? (
                    <Button
                      variant="secondary"
                      onClick={() => updateConsolidation(job.id, "pause")}
                      disabled={pending}
                    >
                      {english ? "Pause" : "暂停"}
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={() => updateConsolidation(job.id, "resume")}
                      disabled={pending}
                    >
                      {english ? "Resume" : "恢复"}
                    </Button>
                  )}
                </div>
              ) : null}
            </div>
          ))}
          {!v21.reflection.recentJobs.length ? (
            <p className="text-sm text-[color:var(--muted-foreground)]">
              {english ? "No reflection job yet." : "当前还没有反思 job。"}
            </p>
          ) : null}
        </div>
        <div className="mt-4 space-y-3">
          <p className="text-sm font-semibold text-[color:var(--foreground)]">
            {english ? "Reflection 延续" : "reflection 延续"}
          </p>
          {v21.reflection.recentCandidates.map((candidate) => (
            <div key={candidate.id} className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={renderStatusVariant(candidate.status)}>{candidate.status}</Badge>
                    <span className="text-xs font-medium text-[color:var(--muted-foreground)]">
                      {candidate.sessionLabel}
                    </span>
                  </div>
                  <p className="text-sm leading-6 text-[color:var(--foreground)]">{candidate.summary}</p>
                  <p className="text-xs leading-6 text-[color:var(--muted-foreground)]">{candidate.reviewPosture}</p>
                  <p className="text-xs leading-6 text-[color:var(--muted-foreground)]">{candidate.evidenceSummary}</p>
                </div>
                {candidate.status === "VERIFIED" ? (
                  <div className="flex flex-wrap gap-2">
                    {canReviewRuntime ? (
                      <Button
                        data-reflection-carry-forward-action="accept"
                        onClick={() => acceptReflectionCandidate(candidate.id)}
                        disabled={pending}
                      >
                        {english ? "Accept" : "接受"}
                      </Button>
                    ) : null}
                    {canManageRuntime ? (
                      <Button
                        data-reflection-carry-forward-action="dismiss"
                        variant="ghost"
                        onClick={() => dismissReflectionCandidate(candidate.id)}
                        disabled={pending}
                      >
                        {english ? "Dismiss" : "忽略"}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {candidate.sourceClasses.map((sourceClass) => (
                  <Badge key={`${candidate.id}-${sourceClass}`} variant="neutral">
                    {sourceClass}
                  </Badge>
                ))}
                <span className="text-xs text-[color:var(--muted-foreground)]">
                  {formatDateLabel(candidate.createdAt)}
                </span>
              </div>
            </div>
          ))}
          {!v21.reflection.recentCandidates.length ? (
            <p className="text-sm text-[color:var(--muted-foreground)]">
              {english ? "No reflection 延续 candidate yet." : "当前还没有反思 延续 候选。"}
            </p>
          ) : null}
        </div>
      </div>

      <div className="theme-surface-panel rounded-2xl px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Consolidation queue" : "consolidation queue"}</p>
          {canManageRuntime ? (
            <Button variant="secondary" onClick={queueConsolidation} disabled={pending}>
              {english ? "Queue manual consolidation" : "加入人工整合队列"}
            </Button>
          ) : null}
        </div>
        <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
          {v21.consolidation.auditSummary.summary}
        </p>
        <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
          {v21.consolidation.auditSummary.rollbackSummary}
        </p>
        <p className="mt-3 text-sm text-[color:var(--muted-foreground)]">
          {english
            ? `${v21.consolidation.activeJobs} active jobs in this session`
            : `当前 session 有 ${v21.consolidation.activeJobs} 个 active jobs`}
        </p>
        <div className="mt-3 space-y-3">
          {v21.consolidation.recentJobs.map((job) => (
            <div key={job.id} className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={renderStatusVariant(job.status)}>{job.status}</Badge>
                  <span className="text-xs font-medium text-[color:var(--muted-foreground)]">{job.jobType}</span>
                </div>
                <span className="text-xs text-[color:var(--muted-foreground)]">{formatDateLabel(job.createdAt)}</span>
              </div>
              <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">{job.inputSummary}</p>
              {job.outputSummary ? (
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">{job.outputSummary}</p>
              ) : null}
              <p className="mt-2 text-xs leading-6 text-[color:var(--muted-foreground)]">
                {v21.consolidation.auditSummary.boundaryNote}
              </p>
              {canManageRuntime ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {job.status !== "PAUSED" ? (
                    <Button
                      variant="secondary"
                      onClick={() => updateConsolidation(job.id, "pause")}
                      disabled={pending}
                    >
                      {english ? "Pause" : "暂停"}
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      onClick={() => updateConsolidation(job.id, "resume")}
                      disabled={pending}
                    >
                      {english ? "Resume" : "恢复"}
                    </Button>
                  )}
                </div>
              ) : null}
            </div>
          ))}
          {!v21.consolidation.recentJobs.length ? (
            <p className="text-sm text-[color:var(--muted-foreground)]">
              {english ? "No consolidation job yet." : "当前还没有 整合 job。"}
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}
