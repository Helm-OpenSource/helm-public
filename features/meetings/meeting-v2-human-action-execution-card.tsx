"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock3, Hand, RefreshCcw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  acknowledgeMeetingHumanActionExecutionAction,
  runMeetingHumanActionExecutionRuntimeAction,
} from "@/features/meetings/actions";
import type {
  HumanActionExecutionAckMode,
  HumanActionExecutionRuntimeAction,
  HumanActionExecutionRuntimeSummary,
} from "@/lib/helm-v2/human-action-execution-runtime";
import { formatDateLabel } from "@/lib/utils";

type MeetingV2HumanActionExecutionCardProps = {
  meetingId: string;
  runtime: HumanActionExecutionRuntimeSummary | null;
};

function renderStatusVariant(status: string) {
  if (status.includes("BLOCKED") || status.includes("REJECTED")) return "danger" as const;
  if (status.includes("EXECUTED") || status.includes("ACKNOWLEDGED")) return "success" as const;
  if (status.includes("DEFERRED")) return "warning" as const;
  if (status.includes("PENDING") || status.includes("READY")) return "approval" as const;
  return "neutral" as const;
}

function primaryAcknowledgement(action: HumanActionExecutionRuntimeAction, english: boolean) {
  switch (action.actionType) {
    case "manual_email_send":
    case "manual_customer_followup":
      return {
        mode: "mark_sent_manually" as HumanActionExecutionAckMode,
        label: english ? "Mark sent manually" : "标记已人工发送",
      };
    case "manual_calendar_send":
      return {
        mode: "mark_scheduled_manually" as HumanActionExecutionAckMode,
        label: english ? "Mark scheduled manually" : "标记已人工约会",
      };
    case "manual_internal_collab":
    case "manual_exec_brief_share":
      return {
        mode: "mark_shared_internally" as HumanActionExecutionAckMode,
        label: english ? "Mark shared internally" : "标记已内部共享",
      };
    case "manual_crm_step":
      return {
        mode: "mark_crm_step_done" as HumanActionExecutionAckMode,
        label: english ? "Mark CRM step done" : "标记已人工完成 CRM step",
      };
    case "manual_handoff_delivery":
    case "manual_handoff_customer_success":
      return {
        mode: "mark_handoff_done" as HumanActionExecutionAckMode,
        label: english ? "Mark handoff done" : "标记已人工完成交接",
      };
  }
}

function acknowledgementSuccess(mode: HumanActionExecutionAckMode, english: boolean) {
  if (mode === "mark_blocked") return english ? "Execution marked blocked" : "已标记为受阻";
  if (mode === "mark_deferred") return english ? "Execution marked deferred" : "已标记为延后";
  return english ? "Execution proof recorded" : "执行证据已记录";
}

function ExecutionAcknowledgeForm({
  action,
  english,
  pending,
  onSubmit,
}: {
  action: HumanActionExecutionRuntimeAction;
  english: boolean;
  pending: boolean;
  onSubmit: (input: {
    executionId: string;
    mode: HumanActionExecutionAckMode;
    note: string;
    externalReference: string;
    whatWasNotDone: string;
    followThroughStatus: string;
  }) => void;
}) {
  const [note, setNote] = useState("");
  const [externalReference, setExternalReference] = useState("");
  const [whatWasNotDone, setWhatWasNotDone] = useState("");
  const [followThroughStatus, setFollowThroughStatus] = useState("");
  const primary = primaryAcknowledgement(action, english);

  const submit = (mode: HumanActionExecutionAckMode) => {
    onSubmit({
      executionId: action.id,
      mode,
      note,
      externalReference,
      whatWasNotDone,
      followThroughStatus,
    });
  };

  return (
    <div className="mt-4 space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
            {english ? "proof note" : "proof note"}
          </p>
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="mt-2 text-sm" />
        </div>
        <div>
          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
            {english ? "external reference (optional)" : "external reference（可选）"}
          </p>
          <Input value={externalReference} onChange={(event) => setExternalReference(event.target.value)} className="mt-2 text-sm" />
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
            {english ? "what was not done" : "what was not done"}
          </p>
          <Textarea
            value={whatWasNotDone}
            onChange={(event) => setWhatWasNotDone(event.target.value)}
            rows={3}
            className="mt-2 text-sm"
          />
        </div>
        <div>
          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
            {english ? "follow-through status" : "follow-through status"}
          </p>
          <Textarea
            value={followThroughStatus}
            onChange={(event) => setFollowThroughStatus(event.target.value)}
            rows={3}
            className="mt-2 text-sm"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => submit("mark_deferred")} disabled={pending}>
          <Clock3 className="h-4 w-4" />
          {english ? "Mark deferred" : "标记为延后"}
        </Button>
        <Button variant="secondary" onClick={() => submit("mark_blocked")} disabled={pending}>
          <ShieldAlert className="h-4 w-4" />
          {english ? "Mark blocked" : "标记受阻"}
        </Button>
        <Button onClick={() => submit(primary.mode)} disabled={pending}>
          <Hand className="h-4 w-4" />
          {primary.label}
        </Button>
      </div>
    </div>
  );
}

export function MeetingV2HumanActionExecutionCard({ meetingId, runtime }: MeetingV2HumanActionExecutionCardProps) {
  const router = useRouter();
  const { locale } = useWorkspaceUi();
  const english = locale === "en-US";
  const [pending, startTransition] = useTransition();

  const runRuntime = (force = true) => {
    startTransition(async () => {
      const result = await runMeetingHumanActionExecutionRuntimeAction(meetingId, force);
      if (!result.ok) {
        toast.error(result.error ?? (english ? "Human execution surface failed" : "human execution surface 失败"));
        return;
      }
      const actionCount = result.actionCount ?? 0;
      toast.success(
        actionCount > 0
          ? english
            ? "Human execution surface refreshed"
            : "人工执行面已刷新"
          : english
            ? "No approved sources are ready for manual execution yet"
            : "当前还没有已批准的源头可进入人工执行",
      );
      router.refresh();
    });
  };

  const acknowledge = (input: {
    executionId: string;
    mode: HumanActionExecutionAckMode;
    note: string;
    externalReference: string;
    whatWasNotDone: string;
    followThroughStatus: string;
  }) => {
    startTransition(async () => {
      const result = await acknowledgeMeetingHumanActionExecutionAction({
        meetingId,
        executionId: input.executionId,
        mode: input.mode,
        note: input.note,
        externalReference: input.externalReference,
        whatWasNotDone: input.whatWasNotDone,
        followThroughStatus: input.followThroughStatus,
      });

      if (!result.ok) {
        toast.error(result.error ?? (english ? "Execution acknowledgement failed" : "执行确认失败"));
        return;
      }

      toast.success(acknowledgementSuccess(input.mode, english));
      router.refresh();
    });
  };

  return (
    <Card className="workspace-panel" data-helm-v2-human-action-execution="true">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">{english ? "Helm v2 · execution" : "Helm v2 · 执行"}</Badge>
          <Badge variant="neutral">
            {english ? "approved draft → manual execution" : "已通过草稿 → 人工执行"}
          </Badge>
          {runtime?.bundle ? (
            <Badge variant="neutral">
              {english ? `${runtime.bundle.readyCount} ready` : `${runtime.bundle.readyCount} 条待执行`}
            </Badge>
          ) : null}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>{english ? "Helm v2 human action execution path" : "Helm v2 人工执行链路"}</CardTitle>
            <CardDescription>
              {runtime
                ? english
                  ? "Manual execution + proof + writeback. Helm doesn't get send authority or CRM write."
                  : "人工执行 + 证据 + 回写。Helm 不获得发送权限或 CRM 写入。"
                : english
                  ? "Waiting for an approved draft or confirmed shadow judgement."
                  : "等已通过的草稿或已确认的阴影判断。"}
            </CardDescription>
          </div>
          <Button variant="secondary" onClick={() => runRuntime(true)} disabled={pending}>
            <RefreshCcw className="h-4 w-4" />
            {english ? "Run / refresh execution surface" : "运行 / 刷新执行面"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {runtime ? (
          <>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="theme-surface-panel rounded-2xl px-4 py-4">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "ready actions" : "ready actions"}</p>
                <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">{runtime.bundle?.readyCount ?? 0}</p>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{english ? "approved still means manual next step only" : "已通过仍只表示人工下一步"}</p>
              </div>
              <div className="theme-surface-panel rounded-2xl px-4 py-4">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "executed proofs" : "executed proofs"}</p>
                <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">{runtime.bundle?.executedCount ?? 0}</p>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{english ? "proof still does not mean external outcome" : "proof 仍不等于外部结果"}</p>
              </div>
              <div className="theme-surface-panel rounded-2xl px-4 py-4">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "blocked / deferred" : "blocked / deferred"}</p>
                <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
                  {(runtime.bundle?.blockedCount ?? 0) + (runtime.bundle?.deferredCount ?? 0)}
                </p>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{english ? "boundary and dependency posture stays visible" : "边界和依赖姿态 继续可见"}</p>
              </div>
              <div className="theme-surface-panel rounded-2xl px-4 py-4">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "approved sources" : "approved sources"}</p>
                <p className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">
                  {[
                    runtime.approvedSources.draftCommsApproved ? "draft" : null,
                    runtime.approvedSources.opportunityJudgementApproved ? "shadow" : null,
                    runtime.approvedSources.handoffArtifactsAvailable > 0 ? "handoff" : null,
                  ]
                    .filter(Boolean)
                    .join(" / ") || (english ? "none" : "暂无")}
                </p>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{english ? "manual execution only" : "仅人工执行"}</p>
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.06fr_0.94fr]">
              <div className="space-y-4">
                {runtime.actions.map((action) => {
                  const canAcknowledge = action.executionAcknowledgementStatus === "PENDING";
                  return (
                    <div key={action.id} className="theme-surface-panel rounded-2xl px-4 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="neutral">{action.actionType}</Badge>
                        <Badge variant="neutral">{action.audience}</Badge>
                        <Badge variant={renderStatusVariant(action.status)}>{action.status}</Badge>
                        <Badge variant={renderStatusVariant(action.executionAcknowledgementStatus)}>
                          {action.executionAcknowledgementStatus}
                        </Badge>
                      </div>

                      <div className="mt-3 space-y-2">
                        <p className="text-sm font-semibold text-[color:var(--foreground)]">{action.sourceArtifactTitle}</p>
                        <p className="text-sm leading-6 text-[color:var(--foreground)]">{action.sourceArtifactSummary}</p>
                        <p className="text-sm text-[color:var(--foreground)]">
                          <span className="font-medium text-[color:var(--foreground)]">{english ? "Why now" : "Why now"}:</span>{" "}
                          {action.executionIntent}
                        </p>
                        <p className="text-sm text-[color:var(--foreground)]">
                          <span className="font-medium text-[color:var(--foreground)]">{english ? "Boundary" : "Boundary"}:</span>{" "}
                          {action.executionBoundary}
                        </p>
                        <p className="text-sm text-[color:var(--foreground)]">
                          <span className="font-medium text-[color:var(--foreground)]">{english ? "Approval context" : "Approval context"}:</span>{" "}
                          {action.approvalContext}
                        </p>
                        {action.executionPrerequisite ? (
                          <p className="text-sm text-[color:var(--foreground)]">
                            <span className="font-medium text-[color:var(--foreground)]">{english ? "Prerequisite" : "Prerequisite"}:</span>{" "}
                            {action.executionPrerequisite}
                          </p>
                        ) : null}
                        {action.executionDependency ? (
                          <p className="text-sm text-[color:var(--foreground)]">
                            <span className="font-medium text-[color:var(--foreground)]">{english ? "Dependency" : "Dependency"}:</span>{" "}
                            {action.executionDependency}
                          </p>
                        ) : null}
                        {action.riskReviewSummary ? (
                          <p className="text-sm text-[color:var(--foreground)]">
                            <span className="font-medium text-[color:var(--foreground)]">{english ? "Risk review" : "Risk review"}:</span>{" "}
                            {action.riskReviewSummary}
                          </p>
                        ) : null}
                      </div>

                      {canAcknowledge ? (
                        <ExecutionAcknowledgeForm action={action} english={english} pending={pending} onSubmit={acknowledge} />
                      ) : (
                        <div className="mt-4 space-y-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)]/80 p-4 text-sm text-[color:var(--foreground)]">
                          <p className="font-medium text-[color:var(--foreground)]">
                            {english ? "Execution proof recorded" : "执行证据已记录"}
                          </p>
                          {action.executedByName || action.executedAt ? (
                            <p>
                              {action.executedByName ?? (english ? "Unknown" : "未知执行人")}
                              {action.executedAt ? ` · ${formatDateLabel(action.executedAt)}` : ""}
                            </p>
                          ) : null}
                          {action.proofNote ? <p>{action.proofNote}</p> : null}
                          {action.writebackSummary ? <p>{action.writebackSummary}</p> : null}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="space-y-4">
                <div className="theme-surface-panel rounded-2xl px-4 py-4">
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Execution boundary" : "Execution boundary"}</p>
                  <div className="mt-3 space-y-2 text-sm leading-6 text-[color:var(--foreground)]">
                    <p>{runtime.bundle?.humanOnly ?? (english ? "This surface is for human execution only." : "这是一层人工执行面。")}</p>
                    <p>{runtime.bundle?.approvedMeans ?? (english ? "Approved means only manual next step." : "已通过只表示允许人工下一步。")}</p>
                    <p>{runtime.bundle?.approvedDoesNotMean ?? (english ? "Approved does not mean sent or written back officially." : "已批准不代表已外发或已正式回写。")}</p>
                    <p>{runtime.bundle?.proofDoesNotMean ?? (english ? "Execution proof does not equal external outcome truth." : "执行证据不等于外部结果真值。")}</p>
                  </div>
                </div>

                <div className="theme-surface-panel rounded-2xl px-4 py-4">
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Current write-back" : "Current write-back"}</p>
                  <div className="mt-3 space-y-3 text-sm leading-6 text-[color:var(--foreground)]">
                    <div>
                      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "meeting summary" : "meeting summary"}</p>
                      <pre className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[color:var(--foreground)]">
                        {runtime.latestWriteback.meetingPostMeetingSummary ?? (english ? "No execution write-back yet." : "当前还没有 execution write-back。")}
                      </pre>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "opportunity summary" : "opportunity summary"}</p>
                      <pre className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[color:var(--foreground)]">
                        {runtime.latestWriteback.opportunityNextStepSummary ?? (english ? "No opportunity write-back yet." : "当前还没有机会 write-back。")}
                      </pre>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "latest checkpoint" : "latest checkpoint"}</p>
                      <p className="mt-2 text-sm text-[color:var(--foreground)]">
                        {runtime.latestWriteback.latestCheckpoint
                          ? `${runtime.latestWriteback.latestCheckpoint.kind} · ${runtime.latestWriteback.latestCheckpoint.summary}`
                          : english
                            ? "No checkpoint memory yet."
                            : "当前还没有检查点经营记忆。"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="theme-surface-panel rounded-2xl px-4 py-4">
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "What this does not do" : "What this does not do"}</p>
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-[color:var(--foreground)]">
                    <li>{english ? "It does not send email automatically." : "它不会自动发邮件。"}</li>
                    <li>{english ? "It does not book external calendars automatically." : "它不会自动预约外部日程。"}</li>
                    <li>{english ? "It does not write official CRM state automatically." : "它不会自动写 正式 CRM state。"}</li>
                    <li>{english ? "It does not treat approved as committed or executed." : "它不会把已通过混成已提交或已执行。"}</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-[color:var(--border-strong)] bg-[color:var(--surface-subtle)]/80 px-6 py-8 text-sm leading-7 text-[color:var(--muted)]">
            {english
              ? "Not started yet. Once a draft or shadow judgement is approved, execution steps land here."
              : "还没启动。草稿或阴影判断获批后，执行步骤会出现在这里。"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
