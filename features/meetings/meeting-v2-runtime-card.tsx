"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, RefreshCcw, ShieldAlert, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  acknowledgeMeetingRuntimeHumanInputCheckpointAction,
  acknowledgeMeetingRuntimeTakeoverAction,
  acceptReflectionCarryForwardAction,
  dismissReflectionCarryForwardAction,
  confirmMeetingRuntimeCloseoutAction,
  queueMeetingRuntimeConsolidationAction,
  queueMeetingRuntimeReflectionAction,
  recordMeetingRuntimeCloseoutResolutionAction,
  requestMeetingRuntimeCloseAction,
  requestMeetingRuntimeCloseoutResolutionFollowThroughAction,
  requestMeetingRuntimeHumanInputCheckpointAction,
  requestMeetingRuntimeCloseoutRefreshAction,
  requestMeetingRuntimeSettlementReviewAction,
  recordMeetingRuntimeSwarmReadOnlyWorkerAdoptionAction,
  recordMeetingRuntimeSwarmReadOnlyWorkerMaterializationAction,
  recordMeetingRuntimeSwarmReadOnlyWorkerPlaceholderAction,
  recordMeetingRuntimeSwarmReadOnlyWorkerExecutionAction,
  recordMeetingRuntimeSwarmReadOnlyWorkerIntentAction,
  recordMeetingRuntimeSwarmVerificationMergeLaneAction,
  requestMeetingRuntimeSwarmSpawnAction,
  requestMeetingRuntimeTakeoverFollowThroughAction,
  requestMeetingRuntimeTakeoverAction,
  releaseMeetingRuntimeTakeoverAction,
  resolveMeetingRuntimeCloseoutResolutionFollowThroughAction,
  resolveMeetingRuntimeSettlementReviewAction,
  resolveMeetingRuntimeTakeoverFollowThroughAction,
  reviewMeetingActionPackRuntimeAction,
  runMeetingActionPackRuntimeAction,
  runMeetingRuntimeContinuityRemediationAction,
  startMeetingRuntimeTakeoverAction,
  updateMeetingRuntimeConsolidationAction,
} from "@/features/meetings/actions";
import type { MeetingRuntimeSummary } from "@/lib/helm-v2/meeting-action-pack-runtime";
import { buildCloseSettlementHandoffReadout } from "@/lib/helm-v2/close-settlement-handoff-readout";
import { buildPersistedLifecycleTraceReadout } from "@/lib/helm-v2/persisted-lifecycle-trace-readout";
import { buildTakeoverRemediationHandoffReadout } from "@/lib/helm-v2/takeover-remediation-handoff-readout";
import { formatDateLabel } from "@/lib/utils";
import { formatMeetingDisplayText } from "@/features/meetings/display-copy";

type MeetingV2RuntimeCardProps = {
  meetingId: string;
  runtime: MeetingRuntimeSummary | null;
  canManageRuntime: boolean;
  canReviewRuntime: boolean;
};

type MeetingV2RuntimeReviewFormProps = {
  english: boolean;
  pending: boolean;
  defaultFactsJson: string;
  defaultActionPackMarkdown: string;
  defaultReviewNotes: string;
  onSubmit: (payload: {
    mode: "confirm" | "edit_confirm" | "reject" | "keep_draft";
    factsJson: string;
    actionPackMarkdown: string;
    reviewNotes: string;
  }) => void;
};

function renderStatusVariant(status: string) {
  if (status.includes("FAILED") || status.includes("REJECTED") || status.includes("BLOCKED")) return "danger" as const;
  if (
    status.includes("CONFIRMED") ||
    status.includes("COMPLETED") ||
    status.includes("PROMOTED") ||
    status.includes("PASSED") ||
    status.includes("RESOLVED") ||
    status.includes("EXECUTED") ||
    status.includes("SAFE")
  ) {
    return "success" as const;
  }
  if (
    status.includes("PENDING") ||
    status.includes("QUEUED") ||
    status.includes("RUNNING") ||
    status.includes("DEFERRED") ||
    status.includes("REVIEW") ||
    status.includes("WAITING") ||
    status.includes("READY") ||
    status.includes("OPEN") ||
    status.includes("WATCH") ||
    status.includes("PRUNE") ||
    status.includes("COMPACT")
  ) {
    return "approval" as const;
  }
  return "neutral" as const;
}

function renderRuntimeStatusLabel(status: string, english: boolean) {
  if (english) return status.replace(/_/g, " ").toLowerCase();

  const labels: Record<string, string> = {
    CONFIRMED: "已确认",
    COMPLETED: "已完成",
    PROMOTED: "已提升",
    PASSED: "已通过",
    RESOLVED: "已解决",
    EXECUTED: "已执行",
    SAFE: "正常",
    PENDING: "待处理",
    QUEUED: "已入队",
    RUNNING: "运行中",
    DEFERRED: "暂缓",
    REVIEW_REQUIRED: "需要复核",
    WAITING: "等待中",
    READY: "就绪",
    OPEN: "未完成",
    WATCH: "观察中",
    PRUNE: "已精简上下文",
    COMPACT: "已压缩上下文",
    AWAITING_REVIEW: "等待复核",
    PROTECTED_STATE_GAP: "受保护状态缺口",
    FAILED: "失败",
    REJECTED: "已拒绝",
    BLOCKED: "已阻断",
  };

  return labels[status] ?? status.replace(/_/g, " ");
}

function formatContinuityPostureToast(input: {
  action: "SAVE_RECOVERY_CHECKPOINT" | "RESUME_CHECKPOINT" | "REPRUNE_CONTEXT";
  posture?: {
    interruptReason: {
      code: string;
    };
    resumeAsk: {
      mode: string;
    };
    handoffPayload: {
      state: string;
      toAgent: string | null;
    };
  } | null;
  rollbackAnchorLabel?: string | null;
  english: boolean;
}) {
  const actionLabel =
    input.action === "SAVE_RECOVERY_CHECKPOINT"
      ? input.english
        ? "save recovery checkpoint"
        : "保存恢复点"
      : input.action === "RESUME_CHECKPOINT"
        ? input.english
          ? "resume checkpoint"
          : "回到恢复点"
        : input.english
          ? "re-prune context"
          : "重新整理上下文";
  const posture = input.posture;
  if (!posture) {
    return input.rollbackAnchorLabel
      ? `${actionLabel} · ${input.english ? "rollback" : "回退点"} ${input.rollbackAnchorLabel}`
      : actionLabel;
  }
  if (!input.english) {
    const interruptLabel =
      posture.interruptReason.code === "none" ? "没有中断" : `中断原因 ${posture.interruptReason.code}`;
    const handoffLabel =
      posture.handoffPayload.state === "ready"
        ? `交接给 ${posture.handoffPayload.toAgent ?? "待接手角色"}`
        : "无需交接";

    return [
      actionLabel,
      interruptLabel,
      `恢复方式 ${posture.resumeAsk.mode}`,
      handoffLabel,
      input.rollbackAnchorLabel ? `回退点 ${input.rollbackAnchorLabel}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  const parts = [
    actionLabel,
    posture.interruptReason.code === "none"
      ? "interrupt clear"
      : `interrupt ${posture.interruptReason.code}`,
    `resume ${posture.resumeAsk.mode}`,
    posture.handoffPayload.state === "ready"
      ? `handoff ${posture.handoffPayload.toAgent ?? "ready"}`
      : "handoff none",
    input.rollbackAnchorLabel ? `rollback ${input.rollbackAnchorLabel}` : null,
  ];

  return parts.filter(Boolean).join(" · ");
}

function MeetingV2RuntimeReviewForm({
  english,
  pending,
  defaultFactsJson,
  defaultActionPackMarkdown,
  defaultReviewNotes,
  onSubmit,
}: MeetingV2RuntimeReviewFormProps) {
  const [factsJson, setFactsJson] = useState(defaultFactsJson);
  const [actionPackMarkdown, setActionPackMarkdown] = useState(defaultActionPackMarkdown);
  const [reviewNotes, setReviewNotes] = useState(defaultReviewNotes);

  const submit = (mode: "confirm" | "edit_confirm" | "reject" | "keep_draft") => {
    onSubmit({
      mode,
      factsJson,
      actionPackMarkdown,
      reviewNotes,
    });
  };

  return (
    <div className="mt-4 space-y-4">
      <div>
        <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "confirmed facts json" : "已确认事实 JSON"}</p>
        <Textarea value={factsJson} onChange={(event) => setFactsJson(event.target.value)} rows={12} className="mt-2 font-mono text-xs" />
      </div>
      <div>
        <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "action pack markdown" : "行动包 Markdown"}</p>
        <Textarea
          value={actionPackMarkdown}
          onChange={(event) => setActionPackMarkdown(event.target.value)}
          rows={14}
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
          <ShieldAlert className="h-4 w-4" />
          {english ? "Reject" : "驳回"}
        </Button>
        <Button variant="secondary" onClick={() => submit("edit_confirm")} disabled={pending}>
          <Sparkles className="h-4 w-4" />
          {english ? "Edit then confirm" : "编辑后确认"}
        </Button>
        <Button onClick={() => submit("confirm")} disabled={pending}>
          <CheckCircle2 className="h-4 w-4" />
          {english ? "Confirm" : "确认"}
        </Button>
      </div>
    </div>
  );
}

export function MeetingV2RuntimeCard({
  meetingId,
  runtime,
  canManageRuntime,
  canReviewRuntime,
}: MeetingV2RuntimeCardProps) {
  const router = useRouter();
  const { locale } = useWorkspaceUi();
  const english = locale === "en-US";
  const text = (value: string) => formatMeetingDisplayText(value, english);
  const [pending, startTransition] = useTransition();
  const persistedLifecycleTraceReadout = runtime?.v21
    ? buildPersistedLifecycleTraceReadout(runtime.v21.debugger.persistedLifecycleTrace)
    : null;
  const takeoverRemediationHandoffReadout = runtime?.v21
    ? buildTakeoverRemediationHandoffReadout({
        takeoverAssistance: runtime.v21.debugger.takeoverAssistance,
        takeoverRequest: runtime.v21.debugger.takeoverRequest,
        takeoverActivation: runtime.v21.debugger.takeoverActivation,
        takeoverFollowThrough: runtime.v21.debugger.takeoverFollowThrough,
        recoveryLifecycleContract: runtime.v21.debugger.recoveryLifecycleContract,
        latestRemediation: runtime.v21.continuity.remediationTrace[0] ?? null,
      })
    : null;
  const closeSettlementHandoffReadout = runtime?.v21
    ? buildCloseSettlementHandoffReadout({
        settlementFlow: runtime.v21.runThread.settlementFlow,
        settlementReview: runtime.v21.runThread.settlementReview,
        closeoutConfirmation: runtime.v21.runThread.closeoutConfirmation,
        closeoutRefresh: runtime.v21.runThread.closeoutRefresh,
        closeRequest: runtime.v21.runThread.closeRequest,
      })
    : null;
  const runtimeSessionId = runtime?.v21?.session.id ?? null;
  const debuggerView = runtime?.v21?.debugger ?? null;
  const runThreadView = runtime?.v21?.runThread ?? null;
  const [takeoverRequestStateOverride, setTakeoverRequestStateOverride] = useState<string | null>(null);
  const [takeoverActivationStateOverride, setTakeoverActivationStateOverride] = useState<string | null>(null);
  const [takeoverActivationSummaryOverride, setTakeoverActivationSummaryOverride] = useState<string | null>(null);
  const [takeoverPendingAction, setTakeoverPendingAction] = useState<
    "request" | "acknowledge" | "start" | "release" | null
  >(null);
  const [humanInputRequestStateOverride, setHumanInputRequestStateOverride] = useState<string | null>(null);
  const [requestPostureSummaryOverride, setRequestPostureSummaryOverride] = useState<string | null>(null);
  const [requestPostureTakeoverStateOverride, setRequestPostureTakeoverStateOverride] = useState<string | null>(null);
  const [requestPostureHumanInputStateOverride, setRequestPostureHumanInputStateOverride] = useState<string | null>(null);
  const [continuityRemediationPreview, setContinuityRemediationPreview] = useState<{
    action: "SAVE_RECOVERY_CHECKPOINT" | "RESUME_CHECKPOINT" | "REPRUNE_CONTEXT";
    executionStatus: "APPLIED" | "REVIEW_REQUIRED" | "BLOCKED";
    rollbackAnchorLabel: string | null;
  } | null>(null);
  const takeoverRequestState =
    takeoverRequestStateOverride ??
    (debuggerView?.takeoverRequest.state ?? runtime?.v21?.debugger.takeoverRequest.state ?? null);
  const takeoverActivationState =
    takeoverActivationStateOverride ??
    (debuggerView?.takeoverActivation.state ?? runtime?.v21?.debugger.takeoverActivation.state ?? null);
  const takeoverActivationSummary =
    takeoverActivationSummaryOverride ??
    (debuggerView?.takeoverActivation.summary ?? runtime?.v21?.debugger.takeoverActivation.summary ?? null);
  const humanInputRequestState =
    humanInputRequestStateOverride ??
    (runtime?.v21?.debugger.humanInputRequest.state ?? null);
  const requestPostureSummary =
    requestPostureSummaryOverride ??
    (runThreadView?.requestPosture.summary ?? runtime?.v21?.runThread.requestPosture.summary ?? null);
  const requestPostureTakeoverState =
    requestPostureTakeoverStateOverride ??
    (runThreadView?.requestPosture.takeoverState ?? runtime?.v21?.runThread.requestPosture.takeoverState ?? null);
  const requestPostureHumanInputState =
    requestPostureHumanInputStateOverride ??
    (runThreadView?.requestPosture.humanInputState ?? runtime?.v21?.runThread.requestPosture.humanInputState ?? null);

  const runRuntime = (force = true) => {
    startTransition(async () => {
      const result = await runMeetingActionPackRuntimeAction(meetingId, force);
      if (!result.ok) {
        toast.error(result.error ?? (english ? "Runtime start failed" : "运行时启动失败"));
        return;
      }
      toast.success(result.reused ? (english ? "Existing runtime reused" : "已复用现有运行时") : (english ? "Helm v2 runtime started" : "Helm v2 运行时已启动"));
      router.refresh();
    });
  };

  const submitReview = ({
    mode,
    factsJson,
    actionPackMarkdown,
    reviewNotes,
  }: {
    mode: "confirm" | "edit_confirm" | "reject" | "keep_draft";
    factsJson: string;
    actionPackMarkdown: string;
    reviewNotes: string;
  }) => {
    startTransition(async () => {
      const result = await reviewMeetingActionPackRuntimeAction({
        meetingId,
        mode,
        factsJson,
        actionPackMarkdown,
        reviewNotes,
      });

      if (!result.ok) {
        toast.error(result.error ?? (english ? "Review failed" : "复核失败"));
        return;
      }

      const successMessage =
        mode === "reject"
          ? english
            ? "Meeting facts rejected"
            : "会议事实已驳回"
          : mode === "keep_draft"
            ? english
              ? "Meeting facts kept as draft"
              : "会议事实已保留为草稿"
            : result.opportunityJudgeTriggered
              ? english
                ? "Meeting facts confirmed and opportunity judgement started"
                : "会议事实已确认，并已启动机会判断"
              : english
                ? "Meeting facts confirmed"
                : "会议事实已确认";

      toast.success(successMessage);
      router.refresh();
    });
  };

  const queueConsolidation = () => {
    startTransition(async () => {
      const result = await queueMeetingRuntimeConsolidationAction({
        meetingId,
        sourcePage: `/meetings/${meetingId}`,
      });
      if (!result.ok) {
        toast.error(result.error ?? (english ? "Consolidation queue failed" : "整合入队失败"));
        return;
      }
      toast.success(english ? "Consolidation job queued" : "整合作业已加入队列");
      router.refresh();
    });
  };

  const queueReflection = () => {
    startTransition(async () => {
      const result = await queueMeetingRuntimeReflectionAction(meetingId);
      if (!result.ok) {
        toast.error(result.error ?? (english ? "Reflection queue failed" : "反思入队失败"));
        return;
      }
      toast.success(english ? "Reflection job queued" : "反思作业已加入队列");
      router.refresh();
    });
  };

  const acceptReflectionCandidate = (candidateId: string) => {
    startTransition(async () => {
      const result = await acceptReflectionCarryForwardAction({
        candidateId,
        sourcePage: `/meetings/${meetingId}`,
      });
      if (!result.ok) {
        toast.error(result.error ?? (english ? "Reflection candidate accept failed" : "接受反思候选失败"));
        return;
      }
      toast.success(english ? "Reflection carry-forward candidate accepted" : "已接受反思延续候选");
      router.refresh();
    });
  };

  const dismissReflectionCandidate = (candidateId: string) => {
    startTransition(async () => {
      const result = await dismissReflectionCarryForwardAction({
        candidateId,
        sourcePage: `/meetings/${meetingId}`,
      });
      if (!result.ok) {
        toast.error(result.error ?? (english ? "Reflection candidate dismiss failed" : "忽略反思候选失败"));
        return;
      }
      toast.success(english ? "Reflection carry-forward candidate dismissed" : "已忽略反思延续候选");
      router.refresh();
    });
  };

  const updateConsolidation = (jobId: string, mode: "pause" | "resume") => {
    startTransition(async () => {
      const result = await updateMeetingRuntimeConsolidationAction({
        meetingId,
        jobId,
        mode,
        sourcePage: `/meetings/${meetingId}`,
      });
      if (!result.ok) {
        toast.error(result.error ?? (english ? "Consolidation update failed" : "整合更新失败"));
        return;
      }
      toast.success(
        mode === "pause"
          ? english
            ? "Consolidation job paused"
            : "整合作业已暂停"
          : english
            ? "Consolidation job resumed"
            : "整合作业已恢复排队",
      );
      router.refresh();
    });
  };

  const runContinuityRemediation = (
    action: "SAVE_RECOVERY_CHECKPOINT" | "RESUME_CHECKPOINT" | "REPRUNE_CONTEXT",
  ) => {
    const sessionId = runtime?.v21?.session.id;
    if (!sessionId) return;

    startTransition(async () => {
      const result = await runMeetingRuntimeContinuityRemediationAction({
        meetingId,
        sessionId,
        action,
      });

      if (!result.ok) {
        toast.error(result.error ?? (english ? "Continuity remediation failed" : "后台恢复动作失败"));
        return;
      }

      const toastMessage =
        formatContinuityPostureToast({
          action,
          posture: result.afterPosture ?? result.beforePosture,
          rollbackAnchorLabel: result.rollbackAnchorLabel,
          english,
        }) || result.summary;

      if (result.executionStatus === "APPLIED") {
        toast.success(toastMessage);
      } else {
        toast.error(toastMessage);
      }
      setContinuityRemediationPreview({
        action,
        executionStatus: result.executionStatus ?? "BLOCKED",
        rollbackAnchorLabel:
          action === "RESUME_CHECKPOINT"
            ? runtime?.v21?.continuity.recovery.rollbackAnchor?.checkpointLabel ?? result.rollbackAnchorLabel ?? null
            : result.rollbackAnchorLabel ?? null,
      });

      router.refresh();
    });
  };

  const requestOperatorTakeover = () => {
    if (!runtimeSessionId) return;

    setTakeoverPendingAction("request");
    startTransition(async () => {
      try {
        const result = await requestMeetingRuntimeTakeoverAction({
          meetingId,
          sessionId: runtimeSessionId,
        });

        if (!result.ok) {
          toast.error(result.error ?? (english ? "Operator takeover request failed" : "操作员接管请求失败"));
          return;
        }

        toast.success(
          result.reused
            ? english
              ? "Operator takeover request already recorded"
              : "操作员接管请求已存在"
            : english
              ? "Operator takeover request recorded"
              : "操作员接管请求已记录",
        );
        setTakeoverRequestStateOverride("requested");
        setRequestPostureTakeoverStateOverride("requested");
        setRequestPostureSummaryOverride("takeover requested");
        router.refresh();
      } finally {
        setTakeoverPendingAction(null);
      }
    });
  };

  const requestSwarmSpawn = () => {
    if (!runtimeSessionId || !debuggerView || !runThreadView) return;

    startTransition(async () => {
      const result = await requestMeetingRuntimeSwarmSpawnAction({
        meetingId,
        sessionId: runtimeSessionId,
        sourcePage: `/meetings/${meetingId}`,
      });

      if (!result.ok) {
        toast.error(result.error ?? (english ? "Swarm spawn request failed" : "多代理派生请求失败"));
        return;
      }

      toast.success(
        result.reused
          ? english
            ? "Swarm spawn request already recorded"
            : "多代理派生请求已存在"
          : english
            ? "Swarm spawn request recorded"
            : "多代理派生请求已记录",
      );
      router.refresh();
    });
  };

  const recordSwarmWorkerIntent = (
    workerKind: "search" | "grep" | "evidence_mining",
  ) => {
    if (!runtimeSessionId || !debuggerView || !runThreadView) return;

    startTransition(async () => {
      const result = await recordMeetingRuntimeSwarmReadOnlyWorkerIntentAction({
        meetingId,
        sessionId: runtimeSessionId,
        workerKind,
        sourcePage: `/meetings/${meetingId}`,
      });

      if (!result.ok) {
        toast.error(result.error ?? (english ? "Swarm worker intent failed" : "只读子代理意图记录失败"));
        return;
      }

      toast.success(
        result.reused
          ? english
            ? "Swarm worker intent already recorded"
            : "只读子代理意图已存在"
          : english
            ? "Swarm worker intent recorded"
            : "只读子代理意图已记录",
      );
      router.refresh();
    });
  };

  const recordSwarmPlaceholder = () => {
    if (!runtimeSessionId || !debuggerView || !runThreadView) return;

    startTransition(async () => {
      const result = await recordMeetingRuntimeSwarmReadOnlyWorkerPlaceholderAction({
        meetingId,
        sessionId: runtimeSessionId,
        sourcePage: `/meetings/${meetingId}`,
      });

      if (!result.ok) {
        toast.error(
          result.error ?? (english ? "Swarm placeholder record failed" : "只读子代理占位记录失败"),
        );
        return;
      }

      toast.success(
        result.reused
          ? english
            ? "Swarm placeholder already recorded"
            : "只读子代理占位已存在"
          : english
            ? "Swarm placeholder recorded"
            : "只读子代理占位已记录",
      );
      router.refresh();
    });
  };

  const recordSwarmExecution = () => {
    if (!runtimeSessionId || !debuggerView || !runThreadView) return;

    startTransition(async () => {
      const result = await recordMeetingRuntimeSwarmReadOnlyWorkerExecutionAction({
        meetingId,
        sessionId: runtimeSessionId,
        sourcePage: `/meetings/${meetingId}`,
      });

      if (!result.ok) {
        toast.error(
          result.error ??
            (english ? "Swarm execution admission record failed" : "只读子代理执行切片记录失败"),
        );
        return;
      }

      toast.success(
        result.reused
          ? english
            ? "Swarm execution admission already recorded"
            : "只读子代理执行切片已存在"
          : english
            ? "Swarm execution admission recorded"
            : "只读子代理执行切片已记录",
      );
      router.refresh();
    });
  };

  const recordSwarmMaterialization = () => {
    if (!runtimeSessionId || !debuggerView || !runThreadView) return;

    startTransition(async () => {
      const result = await recordMeetingRuntimeSwarmReadOnlyWorkerMaterializationAction({
        meetingId,
        sessionId: runtimeSessionId,
        sourcePage: `/meetings/${meetingId}`,
      });

      if (!result.ok) {
        toast.error(
          result.error ??
            (english ? "Swarm materialization record failed" : "只读子代理物化切片记录失败"),
        );
        return;
      }

      toast.success(
        result.reused
          ? english
            ? "Swarm materialization already recorded"
            : "只读子代理物化切片已存在"
          : english
            ? "Swarm materialization recorded"
            : "只读子代理物化切片已记录",
      );
      router.refresh();
    });
  };

  const recordSwarmAdoption = () => {
    if (!runtimeSessionId || !debuggerView || !runThreadView) return;

    startTransition(async () => {
      const result = await recordMeetingRuntimeSwarmReadOnlyWorkerAdoptionAction({
        meetingId,
        sessionId: runtimeSessionId,
        sourcePage: `/meetings/${meetingId}`,
      });

      if (!result.ok) {
        toast.error(
          result.error ??
            (english ? "Swarm output adoption record failed" : "只读子代理采纳切片记录失败"),
        );
        return;
      }

      toast.success(
        result.reused
          ? english
            ? "Swarm output adoption already recorded"
            : "只读子代理采纳切片已存在"
          : english
            ? "Swarm output adoption recorded"
            : "只读子代理采纳切片已记录",
      );
      router.refresh();
    });
  };

  const recordSwarmVerificationMergeLane = () => {
    if (!runtimeSessionId || !debuggerView || !runThreadView) return;

    startTransition(async () => {
      const result = await recordMeetingRuntimeSwarmVerificationMergeLaneAction({
        meetingId,
        sessionId: runtimeSessionId,
        sourcePage: `/meetings/${meetingId}`,
      });

      if (!result.ok) {
        toast.error(
          result.error ??
            (english ? "Swarm verification merge lane record failed" : "多代理验证合流记录失败"),
        );
        return;
      }

      toast.success(
        result.reused
          ? english
            ? "Swarm verification merge lane already recorded"
            : "多代理验证合流已存在"
          : english
            ? "Swarm verification merge lane recorded"
            : "多代理验证合流已记录",
      );
      router.refresh();
    });
  };

  const requestHumanInputCheckpoint = () => {
    const sessionId = runtime?.v21?.session.id;
    if (!sessionId) return;

    startTransition(async () => {
      const result = await requestMeetingRuntimeHumanInputCheckpointAction({
        meetingId,
        sessionId,
      });

      if (!result.ok) {
        toast.error(
          result.error ??
            (english ? "Human input checkpoint request failed" : "human input 检查点请求失败"),
        );
        return;
      }

      toast.success(
        result.reused
          ? english
            ? "Human input checkpoint request already recorded"
            : "human input 检查点 request 已存在"
          : english
            ? "Human input checkpoint request recorded"
            : "human input 检查点 request 已记录",
      );
      setHumanInputRequestStateOverride("requested");
      setRequestPostureHumanInputStateOverride("requested");
      setRequestPostureSummaryOverride("human input requested");
      router.refresh();
    });
  };

  const acknowledgeOperatorTakeover = () => {
    if (!runtimeSessionId) return;

    setTakeoverPendingAction("acknowledge");
    startTransition(async () => {
      try {
        const result = await acknowledgeMeetingRuntimeTakeoverAction({
          meetingId,
          sessionId: runtimeSessionId,
        });

        if (!result.ok) {
          toast.error(
            result.error ?? (english ? "Operator takeover 已确认 failed" : "操作员接管确认失败"),
          );
          return;
        }

        toast.success(
          result.reused
            ? english
              ? "Operator takeover 已确认 already recorded"
              : "操作员接管 已确认 已存在"
            : english
              ? "Operator takeover 已确认 recorded"
              : "操作员接管 已确认 已记录",
        );
        setTakeoverRequestStateOverride("acknowledged");
        setRequestPostureTakeoverStateOverride("acknowledged");
        setRequestPostureSummaryOverride("takeover acknowledged");
        router.refresh();
      } finally {
        setTakeoverPendingAction(null);
      }
    });
  };

  const startOperatorTakeover = () => {
    if (!runtimeSessionId) return;

    setTakeoverPendingAction("start");
    startTransition(async () => {
      try {
        const result = await startMeetingRuntimeTakeoverAction({
          meetingId,
          sessionId: runtimeSessionId,
        });

        if (!result.ok) {
          toast.error(result.error ?? (english ? "Operator takeover start failed" : "操作员接管 启动失败"));
          return;
        }

        toast.success(
          result.reused
            ? english
              ? "Operator takeover already active"
              : "操作员接管 已经 active"
            : english
              ? "Operator takeover started"
              : "操作员接管 已启动",
        );
        setTakeoverActivationStateOverride("active");
        setTakeoverActivationSummaryOverride(result.summary ?? null);
        router.refresh();
      } finally {
        setTakeoverPendingAction(null);
      }
    });
  };

  const releaseOperatorTakeover = () => {
    if (!runtimeSessionId) return;

    setTakeoverPendingAction("release");
    startTransition(async () => {
      try {
        const result = await releaseMeetingRuntimeTakeoverAction({
          meetingId,
          sessionId: runtimeSessionId,
        });

        if (!result.ok) {
          toast.error(result.error ?? (english ? "Operator takeover release failed" : "操作员接管 释放失败"));
          return;
        }

        toast.success(
          result.reused
            ? english
              ? "Operator takeover already released"
              : "操作员接管 已释放"
            : english
              ? "Operator takeover released"
              : "操作员接管 已释放",
        );
        setTakeoverActivationStateOverride("released");
        setTakeoverActivationSummaryOverride(result.summary ?? "Bounded operator control is released after review handoff.");
        router.refresh();
      } finally {
        setTakeoverPendingAction(null);
      }
    });
  };

  const requestOperatorTakeoverFollowThrough = () => {
    const sessionId = runtime?.v21?.session.id;
    if (!sessionId) return;

    startTransition(async () => {
      const result = await requestMeetingRuntimeTakeoverFollowThroughAction({
        meetingId,
        sessionId,
      });

      if (!result.ok) {
        toast.error(
          result.error ??
            (english
              ? "Operator takeover follow-through request failed"
              : "操作员接管 跟进闭环请求失败"),
        );
        return;
      }

      toast.success(
        result.reused
          ? english
            ? "Operator takeover follow-through already recorded"
            : "操作员接管 跟进闭环已存在"
          : english
            ? "Operator takeover follow-through recorded"
            : "操作员接管 跟进闭环已记录",
      );
      router.refresh();
    });
  };

  const resolveOperatorTakeoverFollowThrough = () => {
    const sessionId = runtime?.v21?.session.id;
    if (!sessionId) return;

    startTransition(async () => {
      const result = await resolveMeetingRuntimeTakeoverFollowThroughAction({
        meetingId,
        sessionId,
      });

      if (!result.ok) {
        toast.error(
          result.error ??
            (english
              ? "Operator takeover follow-through resolve failed"
              : "操作员接管 跟进闭环解决失败"),
        );
        return;
      }

      toast.success(
        result.reused
          ? english
            ? "Operator takeover follow-through already resolved"
            : "操作员接管 跟进闭环已解决"
          : english
            ? "Operator takeover follow-through resolved"
            : "操作员接管 跟进闭环已解决",
      );
      router.refresh();
    });
  };

  const requestSettlementReview = () => {
    const sessionId = runtime?.v21?.session.id;
    if (!sessionId) return;

    startTransition(async () => {
      const result = await requestMeetingRuntimeSettlementReviewAction({
        meetingId,
        sessionId,
      });

      if (!result.ok) {
        toast.error(
          result.error ??
            (english ? "Settlement review request failed" : "settlement 复核请求失败"),
        );
        return;
      }

      toast.success(
        result.reused
          ? english
            ? "Settlement review already recorded"
            : "settlement 复核已存在"
          : english
            ? "Settlement review recorded"
            : "settlement 复核已记录",
      );
      router.refresh();
    });
  };

  const resolveSettlementReview = () => {
    const sessionId = runtime?.v21?.session.id;
    if (!sessionId) return;

    startTransition(async () => {
      const result = await resolveMeetingRuntimeSettlementReviewAction({
        meetingId,
        sessionId,
      });

      if (!result.ok) {
        toast.error(
          result.error ??
            (english ? "Settlement review resolve failed" : "settlement 复核解决失败"),
        );
        return;
      }

      toast.success(
        result.reused
          ? english
            ? "Settlement review already resolved"
            : "settlement 复核已解决"
          : english
            ? "Settlement review resolved"
            : "settlement 复核已解决",
      );
      router.refresh();
    });
  };

  const confirmCloseout = () => {
    const sessionId = runtime?.v21?.session.id;
    if (!sessionId) return;

    startTransition(async () => {
      const result = await confirmMeetingRuntimeCloseoutAction({
        meetingId,
        sessionId,
      });

      if (!result.ok || !result.result) {
        toast.error(
          result.error ??
            (english ? "Closeout confirmation failed" : "closeout confirmation 失败"),
        );
        return;
      }

      const confirmation = result.result;

      toast.success(
        confirmation.reused
          ? english
            ? "Closeout truth already confirmed"
            : "closeout truth 已确认"
          : english
            ? "Closeout truth confirmed"
            : "closeout truth 已确认",
      );
      router.refresh();
    });
  };

  const requestCloseoutRefresh = () => {
    const sessionId = runtime?.v21?.session.id;
    if (!sessionId) return;

    startTransition(async () => {
      const result = await requestMeetingRuntimeCloseoutRefreshAction({
        meetingId,
        sessionId,
      });

      if (!result.ok || !result.result) {
        toast.error(
          result.error ??
            (english ? "Closeout refresh request failed" : "closeout refresh 请求失败"),
        );
        return;
      }

      const refresh = result.result;
      toast.success(
        refresh.reused
          ? english
            ? "Closeout refresh already open"
            : "closeout refresh 已存在"
          : english
            ? "Closeout refresh requested"
            : "closeout refresh 已请求",
      );
      router.refresh();
    });
  };

  const recordCloseoutResolution = (decision: "close_thread" | "keep_open") => {
    const sessionId = runtime?.v21?.session.id;
    if (!sessionId) return;

    startTransition(async () => {
      const result = await recordMeetingRuntimeCloseoutResolutionAction({
        meetingId,
        sessionId,
        decision,
      });

      if (!result.ok || !result.result) {
        toast.error(
          result.error ??
            (english ? "Closeout resolution failed" : "closeout resolution 失败"),
        );
        return;
      }

      const resolution = result.result;
      toast.success(
        resolution.reused
          ? english
            ? decision === "close_thread"
              ? "Close decision already recorded"
              : "Keep-open decision already recorded"
            : decision === "close_thread"
              ? "close 决议已存在"
              : "keep-open 决议已存在"
          : english
            ? decision === "close_thread"
              ? "Close decision recorded"
              : "Keep-open decision recorded"
            : decision === "close_thread"
              ? "close 决议已记录"
              : "keep-open 决议已记录",
      );
      router.refresh();
    });
  };

  const requestCloseoutResolutionFollowThrough = () => {
    const sessionId = runtime?.v21?.session.id;
    if (!sessionId) return;

    startTransition(async () => {
      const result = await requestMeetingRuntimeCloseoutResolutionFollowThroughAction({
        meetingId,
        sessionId,
      });

      if (!result.ok || !result.result) {
        toast.error(
          result.error ??
            (english
              ? "Closeout resolution follow-through request failed"
              : "closeout resolution 跟进闭环请求失败"),
        );
        return;
      }

      const followThrough = result.result;
      toast.success(
        followThrough.reused
          ? english
            ? "Closeout resolution follow-through already recorded"
            : "closeout resolution 跟进闭环已存在"
          : english
            ? "Closeout resolution follow-through requested"
            : "closeout resolution 跟进闭环已请求",
      );
      router.refresh();
    });
  };

  const resolveCloseoutResolutionFollowThrough = () => {
    const sessionId = runtime?.v21?.session.id;
    if (!sessionId) return;

    startTransition(async () => {
      const result = await resolveMeetingRuntimeCloseoutResolutionFollowThroughAction({
        meetingId,
        sessionId,
      });

      if (!result.ok || !result.result) {
        toast.error(
          result.error ??
            (english
              ? "Closeout resolution follow-through resolve failed"
              : "closeout resolution 跟进闭环解决失败"),
        );
        return;
      }

      const followThrough = result.result;
      toast.success(
        followThrough.reused
          ? english
            ? "Closeout resolution follow-through already resolved"
            : "closeout resolution 跟进闭环已解决"
          : english
            ? "Closeout resolution follow-through resolved"
            : "closeout resolution 跟进闭环已解决",
      );
      router.refresh();
    });
  };

  const requestRuntimeClose = () => {
    const sessionId = runtime?.v21?.session.id;
    if (!sessionId) return;

    startTransition(async () => {
      const result = await requestMeetingRuntimeCloseAction({
        meetingId,
        sessionId,
      });

      if (!result.ok || !result.result) {
        toast.error(
          result.error ??
            (english ? "Runtime close request failed" : "运行时 close 请求失败"),
        );
        return;
      }

      const closeRequest = result.result;
      toast.success(
        closeRequest.reused
          ? english
            ? "Runtime close request already recorded"
            : "运行时 close 请求已存在"
          : english
            ? "Runtime close request recorded"
            : "运行时 close 请求已记录",
      );
      router.refresh();
    });
  };

  const acknowledgeHumanInputCheckpoint = () => {
    const sessionId = runtime?.v21?.session.id;
    if (!sessionId) return;

    startTransition(async () => {
      const result = await acknowledgeMeetingRuntimeHumanInputCheckpointAction({
        meetingId,
        sessionId,
      });

      if (!result.ok) {
        toast.error(
          result.error ??
            (english ? "Human input checkpoint 已确认 failed" : "人工输入检查点确认失败"),
        );
        return;
      }

      toast.success(
        result.reused
          ? english
            ? "Human input checkpoint 已确认 already recorded"
            : "human input 检查点 已确认 已存在"
          : english
            ? "Human input checkpoint 已确认 recorded"
            : "human input 检查点 已确认 已记录",
      );
      setHumanInputRequestStateOverride("acknowledged");
      setRequestPostureHumanInputStateOverride("acknowledged");
      setRequestPostureSummaryOverride("human input acknowledged");
      router.refresh();
    });
  };

  const canReview =
    runtime?.artifactReview &&
    runtime.artifactReview.status !== "CONFIRMED" &&
    runtime.artifactReview.status !== "REJECTED";

  return (
    <Card className="workspace-panel" data-helm-v2-meeting-runtime="true">
      <CardHeader className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="info">{english ? "Helm v2 · runtime" : "Helm v2 · 运行链"}</Badge>
          <Badge variant="neutral">{english ? "meeting → action pack runtime" : "会议到行动包运行链"}</Badge>
          {runtime?.latestMeetingEndedEvent ? (
	            <Badge variant={renderStatusVariant(runtime.latestMeetingEndedEvent.status)}>
	              {renderRuntimeStatusLabel(runtime.latestMeetingEndedEvent.status, english)}
	            </Badge>
          ) : null}
          {runtime?.artifactReview ? (
	            <Badge variant={renderStatusVariant(runtime.artifactReview.status)}>
	              {english ? "review" : "复核"} · {renderRuntimeStatusLabel(runtime.artifactReview.status, english)}
	            </Badge>
          ) : null}
          {runtime?.latestMeetingFactsEvent ? (
	            <Badge variant="success">
	              {english ? "facts confirmed" : "事实已确认"} · {renderRuntimeStatusLabel(runtime.latestMeetingFactsEvent.status, english)}
	            </Badge>
          ) : null}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <CardTitle>{english ? "Helm v2 meeting-to-action pack runtime" : "Helm v2 会议到行动包运行链"}</CardTitle>
            <CardDescription>
              {runtime
                ? english
                  ? "Running. Selective context, checkpoint trace, verification, problem-space output."
                  : "运行中。选择性上下文、检查点、验证、问题空间。"
                : english
                  ? "Start one to turn this meeting into facts, memory and a reviewable action pack."
                  : "启动后把会议变成事实、记忆和可复核的行动包。"}
            </CardDescription>
          </div>
          <Button variant="secondary" onClick={() => runRuntime(true)} disabled={pending}>
            <RefreshCcw className="h-4 w-4" />
	            {english ? "Run / rerun runtime" : "运行 / 重跑运行链"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {runtime ? (
          <>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="theme-surface-panel rounded-2xl px-4 py-4">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "facts" : "事实"}</p>
                <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">{runtime.factsArtifact?.facts.length ?? 0}</p>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{english ? "confirmed-object candidates" : "可确认对象事实候选"}</p>
              </div>
              <div className="theme-surface-panel rounded-2xl px-4 py-4">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "inferred" : "推断项"}</p>
                <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">{runtime.factsArtifact?.inferred.length ?? 0}</p>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{english ? "still draft-only" : "仍保持仅草稿"}</p>
              </div>
              <div className="theme-surface-panel rounded-2xl px-4 py-4">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "promoted memory" : "已提升记忆"}</p>
                <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">{runtime.promotedMemory.length}</p>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{english ? "human-confirmed only" : "仅人工确认后提升"}</p>
              </div>
              <div className="theme-surface-panel rounded-2xl px-4 py-4">
                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "downstream handoff" : "下游交接"}</p>
                <p className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">
                  {runtime.latestMeetingFactsEvent?.status ?? (english ? "pending review" : "待复核")}
                </p>
                <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                  {english ? "confirmed facts can now trigger downstream judgement only" : "已确认事实现在只会继续触发下游判断"}
                </p>
              </div>
            </div>

            {runtime.v21 ? (
              <div className="grid gap-3 md:grid-cols-4">
                <div className="theme-surface-panel rounded-2xl px-4 py-4">
	                  <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "session budget" : "上下文预算"}</p>
	                  <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">
	                    {renderRuntimeStatusLabel(runtime.v21.continuity.budgetPosture.state, english)} · {runtime.v21.session.budgetTokenUsed}/{runtime.v21.session.budgetTokenLimit}
	                  </p>
                  <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
                    {runtime.v21.continuity.budgetPosture.summary}
                  </p>
                </div>
                <div className="theme-surface-panel rounded-2xl px-4 py-4">
	                  <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "verification" : "验证"}</p>
                  <p className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">
	                    {runtime.v21.verification ? `${renderRuntimeStatusLabel(runtime.v21.verification.status.toUpperCase(), english)} · ${runtime.v21.verification.truthScore}` : "-"}
                  </p>
                  <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
	                    {english ? "source-grounded runtime review" : "带来源依据的运行复核"}
                  </p>
                </div>
                <div className="theme-surface-panel rounded-2xl px-4 py-4">
	                  <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "problem spaces" : "问题空间"}</p>
                  <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">{runtime.v21.problemSpaces.length}</p>
                  <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
	                    {english ? "owner + next step surfaces" : "问题、负责人和下一步"}
                  </p>
                </div>
                <div className="theme-surface-panel rounded-2xl px-4 py-4">
	                  <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "cache health" : "缓存健康度"}</p>
                  <p className="mt-2 text-2xl font-semibold text-[color:var(--foreground)]">{runtime.v21.cacheHealth.hitRate}%</p>
                  <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
	                    {english ? "hit rate / saved tokens" : "命中率 / 节省上下文"}
                  </p>
                </div>
              </div>
            ) : null}

            <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]">
              <div className="min-w-0 space-y-4">
                <div className="theme-surface-panel min-w-0 max-w-full overflow-hidden rounded-2xl px-4 py-4">
                  <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 text-sm font-semibold text-[color:var(--foreground)]">{english ? "Action pack preview" : "行动包预览"}</p>
                    {runtime.latestMeetingEndedEvent ? (
                      <p className="min-w-0 break-words text-xs text-[color:var(--muted-foreground)]">
                        {english ? "latest run" : "最近运行"} · {formatDateLabel(runtime.latestMeetingEndedEvent.createdAt)}
                      </p>
                    ) : null}
                  </div>
                  <pre className="mt-3 max-w-full whitespace-pre-wrap break-words text-sm leading-6 text-[color:var(--foreground)]">
                    {text(runtime.actionPack?.markdown ?? (english ? "No action pack yet." : "当前还没有行动包。"))}
                  </pre>
                </div>

                <div className="theme-surface-panel min-w-0 max-w-full overflow-hidden rounded-2xl px-4 py-4">
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Evidence, open questions, and shadow write boundary" : "依据、待确认问题与影子写入边界"}</p>
                  <div className="mt-3 grid min-w-0 gap-4 md:grid-cols-3">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "evidence refs" : "依据引用"}</p>
                      <ul className="mt-2 space-y-1 text-sm text-[color:var(--muted)]">
                        {(runtime.analystRun?.evidenceRefs ?? []).map((item) => (
                          <li key={item} className="break-all">- {item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "open questions" : "待确认问题"}</p>
                      <ul className="mt-2 space-y-1 text-sm text-[color:var(--muted)]">
                        {(runtime.actionPack?.openQuestions ?? []).map((item) => (
                          <li key={item} className="break-words">- {text(item)}</li>
                        ))}
                        {!runtime.actionPack?.openQuestions.length ? <li>- {english ? "No open questions." : "当前无额外待确认问题。"}</li> : null}
                      </ul>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "shadow boundary" : "影子写入边界"}</p>
                      <ul className="mt-2 space-y-1 text-sm text-[color:var(--muted)]">
                        <li>- {english ? "Shadow stage / risk / next action only." : "只更新影子阶段、风险和下一步。"}</li>
                        <li>- {english ? "No official CRM state writeback happens here." : "这里不会写入正式 CRM 状态。"}</li>
                        <li>- {english ? "No external send or commitment is created." : "这里不会生成外发或正式承诺。"}</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {runtime.opportunityShadow ? (
                  <div className="theme-surface-panel min-w-0 max-w-full overflow-hidden rounded-2xl px-4 py-4">
                    <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Latest shadow update" : "最近的影子更新"}</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "stage / risk" : "阶段 / 风险"}</p>
                        <p className="mt-2 text-sm text-[color:var(--foreground)]">
                          {runtime.opportunityShadow.stage ?? "-"} / {runtime.opportunityShadow.riskLevel ?? "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "manager attention" : "管理者关注"}</p>
                        <p className="mt-2 text-sm text-[color:var(--foreground)]">{runtime.opportunityShadow.managerAttentionFlag ? (english ? "yes" : "是") : (english ? "no" : "否")}</p>
                      </div>
                      <div className="md:col-span-2">
                        <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "next action / blockers" : "下一步 / 阻塞"}</p>
                        <p className="mt-2 text-sm text-[color:var(--foreground)]">{runtime.opportunityShadow.nextAction ? text(runtime.opportunityShadow.nextAction) : "-"}</p>
                        <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">{runtime.opportunityShadow.blockersSummary ? text(runtime.opportunityShadow.blockersSummary) : "-"}</p>
                      </div>
                    </div>
                  </div>
                ) : null}

                {runtime.v21 ? (
                  <details open className="theme-surface-panel rounded-2xl px-4 py-4">
                    <summary className="cursor-pointer text-sm font-semibold text-[color:var(--foreground)]">
                      {english ? "Background continuity readout" : "后台运行摘要"}
                    </summary>
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-xs font-semibold text-[color:var(--muted-foreground)]">{english ? "Current state" : "当前状态"}</p>
                        {runtime.v21.continuity.notebookState ? (
                          <>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">{text(runtime.v21.continuity.notebookState.objective)}</p>
                            <div className="mt-2 space-y-1 text-sm text-[color:var(--muted-foreground)]">
                              <p>{english ? "Review state" : "复核状态"} · {renderRuntimeStatusLabel(runtime.v21.continuity.notebookState.reviewState.toUpperCase(), english)}</p>
                              {runtime.v21.continuity.notebookState.confirmedFacts.length ? (
                                <p>{english ? "Confirmed" : "已确认"} · {runtime.v21.continuity.notebookState.confirmedFacts.slice(0, 2).map(text).join(" / ")}</p>
                              ) : null}
                            </div>
                          </>
                        ) : (
                          <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{english ? "No background note yet." : "当前还没有后台记录。"}</p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[color:var(--muted-foreground)]">{english ? "Saved state" : "保存状态"}</p>
                        <p className="mt-2 text-sm text-[color:var(--muted)]">
                          {runtime.v21.latestCheckpoint
                            ? `${text(runtime.v21.latestCheckpoint.label)} · ${renderRuntimeStatusLabel(runtime.v21.latestCheckpoint.status.toUpperCase(), english)}`
                            : english
                              ? "No saved point yet."
                              : "当前没有恢复点。"}
                        </p>
                        <div className="mt-2 space-y-1 text-sm text-[color:var(--muted-foreground)]">
                          <p>{text(runtime.v21.continuity.budgetPosture.reason)}</p>
                          <p>{text(runtime.v21.continuity.budgetPosture.savingsSummary)}</p>
                          <p>
                            {english
                              ? `${runtime.v21.payloads.items.filter((item) => item.activeInContext).length} active / ${runtime.v21.payloads.total} saved context items`
                              : `当前使用 ${runtime.v21.payloads.items.filter((item) => item.activeInContext).length} 条 / 已保存资料 ${runtime.v21.payloads.total} 条`}
                          </p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[color:var(--muted-foreground)]">{english ? "Evidence and blockers" : "依据与阻塞"}</p>
                        <ul className="mt-2 space-y-1 text-sm text-[color:var(--muted)]">
                          {runtime.v21.continuity.notebookState?.blockers.slice(0, 2).map((item, index) => (
                            <li key={`blocker-${index}`}>- {text(item)}</li>
                          ))}
                          {runtime.v21.continuity.notebookState?.openQuestions.slice(0, 2).map((item, index) => (
                            <li key={`question-${index}`}>- {text(item)}</li>
                          ))}
                          {runtime.v21.truthConflicts.slice(0, 2).map((item) => (
                            <li key={item.id}>- {text(item.summary)}</li>
                          ))}
                          {!runtime.v21.continuity.notebookState?.blockers.length &&
                          !runtime.v21.continuity.notebookState?.openQuestions.length &&
                          !runtime.v21.truthConflicts.length ? (
                            <li>- {english ? "No open blocker currently needs attention." : "当前没有需要处理的阻塞。"}</li>
                          ) : null}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[color:var(--muted-foreground)]">{english ? "Next move" : "下一步动作"}</p>
                        <ul className="mt-2 space-y-1 text-sm text-[color:var(--muted)]">
                          {runtime.v21.continuity.notebookState?.nextActions.slice(0, 3).map((item, index) => (
                            <li key={`next-${index}`}>- {text(item)}</li>
                          ))}
                          {!runtime.v21.continuity.notebookState?.nextActions.length ? (
                            <li>- {english ? "Keep the meeting in review until a concrete next step appears." : "保持复核，等明确动作后再推进。"}</li>
                          ) : null}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[color:var(--muted-foreground)]">{english ? "Recovery control" : "恢复控制"}</p>
                        <p className="mt-2 text-sm font-semibold text-[color:var(--foreground)]" data-testid="continuity-recovery-state">
                          {runtime.v21.continuity.recovery.state} · {runtime.v21.continuity.recovery.failureTaxonomy}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{runtime.v21.continuity.recovery.summary}</p>
                        <div className="mt-2 space-y-1 text-sm text-[color:var(--muted-foreground)]">
                          <p>{runtime.v21.continuity.recovery.operatorAction}</p>
                          {runtime.v21.continuity.recovery.reviewReasons.length ? (
                            <p>
                              {english ? "review reasons" : "复核原因"} · {runtime.v21.continuity.recovery.reviewReasons.join(" / ")}
                            </p>
                          ) : null}
                          {runtime.v21.continuity.recovery.blockedReasons.length ? (
                            <p>
                              {english ? "blocked reasons" : "阻断原因"} · {runtime.v21.continuity.recovery.blockedReasons.join(" / ")}
                            </p>
                          ) : null}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {runtime.v21.continuity.recovery.allowedActions.map((action) => (
                            <Button
                              key={action}
                              variant="secondary"
                              className="relative z-10 scroll-mt-32"
                              data-testid={`continuity-remediation-${action.toLowerCase()}`}
                              onClick={() => runContinuityRemediation(action)}
                            >
                              {action === "SAVE_RECOVERY_CHECKPOINT"
                                ? english
                                  ? "Save recovery point"
                                  : "保存恢复点"
                                : action === "RESUME_CHECKPOINT"
                                  ? english
                                    ? "Restore recovery point"
                                    : "回到恢复点"
                                  : english
                                    ? "Refresh context"
                                    : "重新整理上下文"}
                            </Button>
                          ))}
                          {!runtime.v21.continuity.recovery.allowedActions.length ? (
                            <p className="text-xs leading-6 text-[color:var(--muted-foreground)]">
                              {english
                                ? "No bounded remediation action is available here."
                                : "当前没有可用的有界修复动作。"}
                            </p>
                          ) : null}
                          {continuityRemediationPreview ? (
                            <div className="w-full rounded-xl border border-[color:var(--border)]/80 bg-[color:var(--surface-subtle)]/70 px-3 py-2 text-xs leading-5 text-[color:var(--muted)]">
                              <p>{`${continuityRemediationPreview.executionStatus} · ${continuityRemediationPreview.action}`}</p>
                              {continuityRemediationPreview.rollbackAnchorLabel ? (
                                <p>
                                  {`rollback anchor · ${continuityRemediationPreview.rollbackAnchorLabel}${
                                    continuityRemediationPreview.action === "RESUME_CHECKPOINT" ? " · RESUMED" : ""
                                  }`}
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-[color:var(--muted-foreground)]">{english ? "Operating guidance" : "操作指引"}</p>
                        <p className="mt-2 text-sm font-semibold text-[color:var(--foreground)]">{text(runtime.v21.continuity.sop.title)}</p>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{text(runtime.v21.continuity.sop.summary)}</p>
                        <ul className="mt-2 space-y-1 text-sm text-[color:var(--muted-foreground)]">
                          {runtime.v21.continuity.sop.evidenceChecklist.slice(0, 3).map((item, index) => (
                            <li key={`${item}-${index}`}>- {text(item)}</li>
                          ))}
                          <li>- {text(runtime.v21.continuity.sop.escalationRule)}</li>
                        </ul>
                        <p className="mt-2 text-xs leading-6 text-[color:var(--muted-foreground)]">{text(runtime.v21.continuity.sop.boundaryNote)}</p>
                      </div>
                      <div data-testid="continuity-remediation-analytics">
                        <p className="text-xs font-semibold text-[color:var(--muted-foreground)]">{english ? "Remediation analytics" : "修复分析"}</p>
                        <p className="mt-2 text-sm font-semibold text-[color:var(--foreground)]">{runtime.v21.continuity.analytics.repeatPattern.status}</p>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{text(runtime.v21.continuity.analytics.repeatPattern.summary)}</p>
                        <p className="mt-2 text-xs leading-6 text-[color:var(--muted-foreground)]">
                          {english ? "attempts" : "尝试"} {runtime.v21.continuity.analytics.totalAttempts} · {english ? "applied" : "已应用"} {runtime.v21.continuity.analytics.appliedCount} · {english ? "review" : "需复核"} {runtime.v21.continuity.analytics.reviewRequiredCount} · {english ? "blocked" : "已阻断"} {runtime.v21.continuity.analytics.blockedCount}
                        </p>
                      </div>
                      <div data-testid="continuity-remediation-effectiveness">
                        <p className="text-xs font-semibold text-[color:var(--muted-foreground)]">{english ? "Remediation effectiveness" : "修复有效性"}</p>
                        <p className="mt-2 text-sm font-semibold text-[color:var(--foreground)]">{runtime.v21.continuity.effectiveness.latestOutcome}</p>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{text(runtime.v21.continuity.effectiveness.latestSummary)}</p>
                        <p className="mt-2 text-xs leading-6 text-[color:var(--muted-foreground)]">
                          {english ? "effective" : "有效"} {runtime.v21.continuity.effectiveness.effectiveCount} · {english ? "partial" : "部分有效"} {runtime.v21.continuity.effectiveness.partialCount} · {english ? "ineffective" : "无效"} {runtime.v21.continuity.effectiveness.ineffectiveCount} · {english ? "no signal" : "无信号"} {runtime.v21.continuity.effectiveness.noSignalCount}
                        </p>
                      </div>
                      <div data-testid="continuity-recovery-calibration">
                        <p className="text-xs font-semibold text-[color:var(--muted-foreground)]">{english ? "Recovery calibration" : "恢复校准"}</p>
                        <p className="mt-2 text-sm font-semibold text-[color:var(--foreground)]">
                          {runtime.v21.continuity.calibration.rawState} -&gt; {runtime.v21.continuity.calibration.calibratedState} · {runtime.v21.continuity.calibration.confidence}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{text(runtime.v21.continuity.calibration.summary)}</p>
                        <p className="mt-2 text-xs leading-6 text-[color:var(--muted-foreground)]">{runtime.v21.continuity.calibration.reasons.map(text).join(" / ")}</p>
                      </div>
                      <div data-testid="continuity-evidence-surface">
                        <p className="text-xs font-semibold text-[color:var(--muted-foreground)]">{english ? "Evidence surface" : "证据面"}</p>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                          {english ? "Repeat pattern" : "重复模式"} · {runtime.v21.continuity.analytics.repeatPattern.summary}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                          {english ? "Blocked because" : "阻断原因"} · {runtime.v21.continuity.recovery.blockedReasons.length ? runtime.v21.continuity.recovery.blockedReasons.join(" / ") : runtime.v21.continuity.recovery.operatorAction}
                        </p>
                        <ul className="mt-2 space-y-1 text-xs leading-5 text-[color:var(--muted-foreground)]">
                          {runtime.v21.continuity.evidence.items.slice(0, 4).map((item, index) => (
                            <li key={`continuity-evidence-${index}`}>- {item}</li>
                          ))}
                          {!runtime.v21.continuity.evidence.items.length ? (
                            <li>- {runtime.v21.continuity.evidence.summary}</li>
                          ) : null}
                        </ul>
                      </div>
                      <div data-testid="continuity-sop">
                        <p className="text-xs font-semibold text-[color:var(--muted-foreground)]">{english ? "SOP" : "标准操作流程"}</p>
                        <p className="mt-2 text-sm font-semibold text-[color:var(--foreground)]">{runtime.v21.continuity.sop.title}</p>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{runtime.v21.continuity.sop.summary}</p>
                        <p className="mt-2 text-xs leading-6 text-[color:var(--muted-foreground)]">
                          {english ? "evidence collection" : "证据收集"} · {runtime.v21.continuity.sop.evidenceChecklist.join(" / ")}
                        </p>
                      </div>
                      <div data-testid="continuity-runbook">
                        <p className="text-xs font-semibold text-[color:var(--muted-foreground)]">{english ? "Runbook" : "运行手册"}</p>
                        <p className="mt-2 text-sm font-semibold text-[color:var(--foreground)]">{runtime.v21.continuity.runbook.title}</p>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{runtime.v21.continuity.runbook.summary}</p>
                        <ul className="mt-2 space-y-1 text-xs leading-5 text-[color:var(--muted-foreground)]">
                          {runtime.v21.continuity.runbook.steps.map((item, index) => (
                            <li key={`continuity-runbook-${index}`}>- {item}</li>
                          ))}
                          <li>- {runtime.v21.continuity.runbook.boundaryNote}</li>
                        </ul>
                      </div>
                      <div className="md:col-span-2" data-testid="continuity-pilot-review">
                        <p className="text-xs font-semibold text-[color:var(--muted-foreground)]">{english ? "Pilot review" : "试点复核"}</p>
                        <p className="mt-2 text-sm font-semibold text-[color:var(--foreground)]">
                          {runtime.v21.continuity.pilotReview.failureTaxonomy} · {english ? "threshold" : "阈值"} {runtime.v21.continuity.pilotReview.recommendedIneffectiveThreshold} · {english ? "risk" : "风险"} {runtime.v21.continuity.pilotReview.riskBand}
                        </p>
                        <div className="mt-2 grid gap-2 text-xs leading-5 text-[color:var(--muted-foreground)] md:grid-cols-2">
                          <p>{english ? "pilot workspace" : "试点工作区"} {runtime.v21.continuity.pilotReview.workspaceSizeBand} · {english ? "session density" : "会话密度"} {runtime.v21.continuity.pilotReview.sessionDensityBand}</p>
                          <p>{english ? "meeting cadence" : "会议节奏"} {runtime.v21.continuity.pilotReview.meetingFrequencyBand} · {english ? "failure history" : "失败历史"} {runtime.v21.continuity.pilotReview.failureHistoryBand}</p>
                          <p>{english ? "participants" : "参与方"} {runtime.v21.continuity.pilotReview.participantRolePosture} · {english ? "sample" : "样本"} {runtime.v21.continuity.pilotReview.sampleCoverageBand}</p>
                          <p>{english ? "stability" : "稳定性"} {runtime.v21.continuity.pilotReview.stabilityBand} · {english ? "stability confidence" : "稳定性置信度"} {runtime.v21.continuity.pilotReview.stabilityConfidenceBand}</p>
                          <p>{english ? "scale-up" : "放大评估"} {text(runtime.v21.continuity.pilotReview.stabilityScaleUpSummary)}</p>
                          <p>{english ? "scale-up recheck" : "放大复查"} {text(runtime.v21.continuity.pilotReview.stabilityScaleUpRecheckSummary)}</p>
                          <p>{english ? "subgroup stability drift review" : "子组稳定性漂移复核"} {text(runtime.v21.continuity.pilotReview.subgroupStabilityDriftSummary)}</p>
                          <p>{english ? "cohort aging comparison" : "队列老化对比"} {text(runtime.v21.continuity.pilotReview.subgroupCohortAgingSummary)}</p>
                          <p>{english ? "cohort aging scale-up review" : "队列老化放大复核"} {text(runtime.v21.continuity.pilotReview.subgroupDriftAgingScaleUpSummary)}</p>
                          <p>{english ? "subgroup drift long-term cohort aging review" : "子组漂移长期队列老化复核"} {text(runtime.v21.continuity.pilotReview.subgroupDriftLongTermCohortAgingSummary)}</p>
                          <p>{english ? "subgroup drift long-term sample expansion review" : "子组漂移长期样本扩展复核"} {text(runtime.v21.continuity.pilotReview.subgroupDriftLongTermSampleExpansionSummary)}</p>
                          <p>{english ? "sample expansion refinement review" : "样本扩展细化复核"} {text(runtime.v21.continuity.pilotReview.subgroupDriftLongTermSampleExpansionRefinementSummary)}</p>
                          <p>{english ? "interval" : "区间"} {runtime.v21.continuity.pilotReview.confidenceInterval} {english ? "confidence interval" : "置信区间"} · {text(runtime.v21.continuity.pilotReview.intervalWordingSummary)}</p>
                          <p>{english ? "wording drift audit" : "措辞漂移审计"} {text(runtime.v21.continuity.pilotReview.intervalWordingDriftSummary)}</p>
                          <p>{english ? "wording drift tracking" : "措辞漂移跟踪"} {text(runtime.v21.continuity.pilotReview.wordingDriftTrackingSummary)}</p>
                          <p>{english ? "interval consistency guidance" : "区间一致性指引"} {text(runtime.v21.continuity.pilotReview.intervalConsistencyGuidanceSummary)}</p>
                          <p>{english ? "interval wording aging audit" : "区间措辞老化审计"} {text(runtime.v21.continuity.pilotReview.intervalWordingAgingSummary)}</p>
                          <p>{english ? "cross-surface interval wording regression review" : "跨界面区间措辞回归复核"} {text(runtime.v21.continuity.pilotReview.intervalWordingRegressionSummary)}</p>
                          <p>{english ? "cross-surface interval wording consistency audit" : "跨界面区间措辞一致性审计"} {text(runtime.v21.continuity.pilotReview.intervalWordingConsistencyAuditSummary)}</p>
                          <p>{english ? "cross-surface interval wording regression audit" : "跨界面区间措辞回归审计"} {text(runtime.v21.continuity.pilotReview.intervalWordingRegressionAuditSummary)}</p>
                          <p>{english ? "cross-readout interval wording regression audit" : "跨读面区间措辞回归审计"} {text(runtime.v21.continuity.pilotReview.intervalWordingCrossReadoutAuditSummary)}</p>
                          <p>{english ? "cross-readout interval wording regression refinement" : "跨读面区间措辞回归细化"} {text(runtime.v21.continuity.pilotReview.intervalWordingCrossReadoutRegressionRefinementSummary)}</p>
                          <p>{english ? "outcome" : "结果"} {runtime.v21.continuity.pilotReview.outcomeCorrelationBand} · {english ? "horizon drift" : "周期漂移"} {text(runtime.v21.continuity.pilotReview.longHorizonSummary)}</p>
                          <p>{english ? "long-term SOP" : "长期 SOP"} {text(runtime.v21.continuity.pilotReview.longTermSopImpactSummary)}</p>
                          <p>{english ? "material impact" : "实质影响"} {runtime.v21.continuity.pilotReview.longTermMaterialImpactBand} · {english ? "material impact on long-term outcomes" : "对长期结果的实质影响"} {text(runtime.v21.continuity.pilotReview.longTermMaterialImpactSummary)}</p>
                          <p>{english ? "material impact review" : "实质影响复核"} {text(runtime.v21.continuity.pilotReview.longTermMaterialImpactReviewSummary)}</p>
                          <p>{english ? "material impact audit" : "实质影响审计"} {text(runtime.v21.continuity.pilotReview.longTermMaterialImpactAuditSummary)}</p>
                          <p>{english ? "material impact pattern aging review" : "实质影响模式老化复核"} {text(runtime.v21.continuity.pilotReview.materialImpactPatternAgingSummary)}</p>
                          <p>{english ? "material impact sampling review" : "实质影响采样复核"} {text(runtime.v21.continuity.pilotReview.materialImpactSamplingSummary)}</p>
                          <p>{english ? "material impact sampling aging review" : "实质影响采样老化复核"} {text(runtime.v21.continuity.pilotReview.materialImpactSamplingAgingSummary)}</p>
                          <p>{english ? "material impact sampling aging refinement" : "实质影响采样老化细化"} {text(runtime.v21.continuity.pilotReview.materialImpactAgingRefinementSummary)}</p>
                          <p>{english ? "material impact sampling aging audit" : "实质影响采样老化审计"} {text(runtime.v21.continuity.pilotReview.materialImpactSamplingAgingAuditSummary)}</p>
                          <p>{english ? "material impact sampling aging refinement audit" : "实质影响采样老化细化审计"} {text(runtime.v21.continuity.pilotReview.materialImpactSamplingAgingRefinementAuditSummary)}</p>
                          <p>{english ? "guidance" : "指引"} {text(runtime.v21.continuity.pilotReview.guidanceRefinementSummary)}</p>
                          <p>{english ? "operator handling" : "操作处理"} {text(runtime.v21.continuity.pilotReview.operatorHandlingSummary)}</p>
                          <p>{english ? "variance" : "方差"} {text(runtime.v21.continuity.pilotReview.varianceSummary)}</p>
                          <p>{english ? "runbook evidence collection" : "运行手册证据收集"} {text(runtime.v21.continuity.runbook.summary)}</p>
                        </div>
                      </div>
                    </div>
                  </details>
                ) : null}
              </div>

              <div className="min-w-0 space-y-4">
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
                        {english ? "judge" : "判断"} · {runtime.judgeRun.status}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-3 break-words text-sm leading-6 text-[color:var(--muted)]">
                    {runtime.approvalRequest?.requestedReason
                      ? text(runtime.approvalRequest.requestedReason)
                      :
                      (english
                        ? "Meeting facts must stay draft until a human confirms them."
                        : "会议事实在人工确认前必须保持草稿。")}
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
                      onSubmit={submitReview}
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
                            : "这条运行时已被拒绝。证据仍然保留，但没有提升，也没有写入阴影状态。"
                          : english
                            ? "This runtime is not waiting on human confirmation right now."
                            : "当前这条运行链暂时不在等待人工确认。"}
                    </p>
                  </div>
                )}

                <div className="theme-surface-panel rounded-2xl px-4 py-4">
                  <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Memory promotion posture" : "记忆提升状态"}</p>
                  <ul className="mt-3 space-y-2 text-sm text-[color:var(--muted)]">
                    {runtime.promotedMemory.map((item) => (
                      <li key={item.id}>- {item.summary}</li>
                    ))}
                    {!runtime.promotedMemory.length ? <li>- {english ? "No promoted memory yet." : "当前还没有已提升记忆。"}</li> : null}
                  </ul>
                  <p className="mt-3 text-sm leading-6 text-[color:var(--muted-foreground)]">
                    {english
                      ? "Promoted items are only human-confirmed object facts and checkpoint memory. Inferred items remain draft unless a human turns them into facts."
                      : "当前只会提升人工确认的对象事实和检查点记忆。推断项仍保持草稿，除非人工把它改成事实。"}
                  </p>
                </div>

                {runtime.v21 ? (
                  <>
                    <div className="theme-surface-panel rounded-2xl px-4 py-4">
                      <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Verification and promotion queue" : "验证与提升队列"}</p>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                        {runtime.v21.verification?.summary ??
                          (english
                            ? "Verification has not run yet."
                            : "当前验证还没有跑起来。")}
                      </p>
                      <p className="mt-3 text-sm text-[color:var(--muted-foreground)]">
                        {english
                          ? `${runtime.v21.promotionQueue.candidates} candidates, ${runtime.v21.promotionQueue.promoted} promoted, ${runtime.v21.promotionQueue.deferred} deferred, ${runtime.v21.promotionQueue.rejected} rejected`
                          : `${runtime.v21.promotionQueue.candidates} 个候选，${runtime.v21.promotionQueue.promoted} 个已提升，${runtime.v21.promotionQueue.deferred} 个已延后，${runtime.v21.promotionQueue.rejected} 个已拒绝`}
                      </p>
                      {runtime.v21.verification?.blockedReasons.length ? (
                        <ul className="mt-3 space-y-1 text-sm text-[color:var(--muted)]">
                          {runtime.v21.verification.blockedReasons.map((item) => (
                            <li key={item}>- {item}</li>
                          ))}
                        </ul>
                      ) : null}
                      {runtime.v21.promotionDecisions.length ? (
                        <ul className="mt-4 space-y-3">
                          {runtime.v21.promotionDecisions.map((item) => (
                            <li key={item.id} className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={renderStatusVariant(item.disposition)}>{item.disposition}</Badge>
                                {item.verificationStatus ? (
                                  <Badge variant={renderStatusVariant(item.verificationStatus)}>{item.verificationStatus}</Badge>
                                ) : null}
                                {item.truthConflictStatus !== "NONE" ? (
                                  <Badge variant={item.truthConflictStatus === "OPEN" ? "danger" : "neutral"}>
                                    {item.truthConflictStatus}
                                  </Badge>
                                ) : null}
                              </div>
                              <p className="mt-2 text-sm font-medium text-[color:var(--foreground)]">{item.summary}</p>
                              <p className="mt-1 text-sm leading-6 text-[color:var(--muted)]">{item.rationale}</p>
                              <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                                {[
                                  item.sourceClasses.length
                                    ? `${english ? "sources" : "来源"}: ${item.sourceClasses.join(" / ")}`
                                    : null,
                                  item.confidence !== null ? `${english ? "confidence" : "置信度"}: ${item.confidence}` : null,
                                  item.evidenceRefs.length ? `${english ? "evidence" : "证据"}: ${item.evidenceRefs.join(" / ")}` : null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                              {item.truthConflictSummary ? (
                                <p className="mt-2 text-xs leading-5 text-[color:var(--status-warning-text)]">
                                  {english ? "Conflict" : "冲突"}: {item.truthConflictSummary}
                                </p>
                              ) : null}
                              {item.blockedReasons.length ? (
                                <p className="mt-1 text-xs leading-5 text-[color:var(--muted-foreground)]">
                                  {item.blockedReasons.join(" ")}
                                </p>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>

                    <div className="theme-surface-panel rounded-2xl px-4 py-4">
                      <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Problem spaces and edge briefs" : "问题空间与边缘简报"}</p>
                      <div className="mt-3 space-y-3">
                        {runtime.v21.problemSpaces.map((item) => (
                          <div key={item.id} className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium text-[color:var(--foreground)]">{item.title}</p>
                              <Badge variant={renderStatusVariant(item.status)}>{item.status}</Badge>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{item.summary}</p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {english ? "Next step" : "下一步"}: {item.nextStep}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-[color:var(--muted-foreground)]">{item.groundingSummary}</p>
                            {item.driSummary ? <p className="mt-1 text-xs leading-5 text-[color:var(--muted-foreground)]">{item.driSummary}</p> : null}
                            {item.conflictSummary ? <p className="mt-1 text-xs leading-5 text-[color:var(--status-warning-text)]">{item.conflictSummary}</p> : null}
                          </div>
                        ))}
                        {!runtime.v21.problemSpaces.length ? (
                          <p className="text-sm text-[color:var(--muted-foreground)]">{english ? "No problem space yet." : "当前还没有问题空间。"}</p>
                        ) : null}
                      </div>
                      <div className="mt-4 space-y-2">
                        {runtime.v21.edgeBriefs.slice(0, 3).map((item) => (
                          <div key={item.id} className="rounded-2xl border border-[color:var(--border)]/80 px-3 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="neutral">{item.audience}</Badge>
                              <p className="text-sm font-medium text-[color:var(--foreground)]">{item.title}</p>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{item.summary}</p>
                            <p className="mt-1 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {[item.problemSpaceTitle, item.truthPosture].filter(Boolean).join(" · ")}
                            </p>
                          </div>
                        ))}
                        {!runtime.v21.edgeBriefs.length ? (
                          <p className="text-sm text-[color:var(--muted-foreground)]">{english ? "No edge brief yet." : "当前还没有边缘简报。"}</p>
                        ) : null}
                      </div>
                    </div>

                    <div className="theme-surface-panel rounded-2xl px-4 py-4">
                      <p className="text-sm font-semibold text-[color:var(--foreground)]">
                        {english ? "Coordination to follow-through trace" : "协同到跟进闭环的轨迹"}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                        {runtime.v21.coordinationTrace.summary}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">{runtime.v21.coordinationTrace.boundaryNote}</p>
                      <div className="mt-4 grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "traced items" : "已追踪项"}</p>
                          <p className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">{runtime.v21.coordinationTrace.items.length}</p>
                        </div>
                        <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "human execution" : "人工执行"}</p>
                          <p className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">{runtime.v21.coordinationTrace.humanExecution.total}</p>
                          <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                            {english
                              ? `${runtime.v21.coordinationTrace.humanExecution.executed} executed · ${runtime.v21.coordinationTrace.humanExecution.blocked} blocked`
                              : `${runtime.v21.coordinationTrace.humanExecution.executed} 已执行 · ${runtime.v21.coordinationTrace.humanExecution.blocked} 已阻断`}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                            {english ? "official follow-through" : "正式跟进闭环"}
                          </p>
                          <p className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">{runtime.v21.coordinationTrace.officialFollowThrough.total}</p>
                          <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                            {english
                              ? `${runtime.v21.coordinationTrace.officialFollowThrough.open} open · ${runtime.v21.coordinationTrace.officialFollowThrough.resolved} resolved`
                              : `${runtime.v21.coordinationTrace.officialFollowThrough.open} 未完成 · ${runtime.v21.coordinationTrace.officialFollowThrough.resolved} 已解决`}
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 space-y-3">
                        {runtime.v21.coordinationTrace.items.map((item) => (
                          <div key={item.id} className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium text-[color:var(--foreground)]">{item.title}</p>
                              <Badge variant={renderStatusVariant(item.posture)}>{item.posture}</Badge>
                            </div>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{item.summary}</p>
                            {item.driSummary ? <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">{item.driSummary}</p> : null}
                            {item.humanExecutionSummary ? (
                              <p className="mt-1 text-xs leading-5 text-[color:var(--muted-foreground)]">{item.humanExecutionSummary}</p>
                            ) : null}
                            {item.officialFollowThroughSummary ? (
                              <p className="mt-1 text-xs leading-5 text-[color:var(--muted-foreground)]">{item.officialFollowThroughSummary}</p>
                            ) : null}
                            <p className="mt-1 text-xs leading-5 text-[color:var(--status-warning-text)]">{item.linkageSummary}</p>
                          </div>
                        ))}
                        {!runtime.v21.coordinationTrace.items.length ? (
                          <p className="text-sm text-[color:var(--muted-foreground)]">
                            {english
                              ? "No coordination trace bridge is visible yet."
                              : "当前还没有可见的协同轨迹 bridge。"}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="theme-surface-panel rounded-2xl px-4 py-4">
                      <p className="text-sm font-semibold text-[color:var(--foreground)]">
                        {english ? "Signals, world model, and artifact lineage" : "信号、世界模型与产物脉络"}
                      </p>
                      <div className="mt-3 grid gap-4 md:grid-cols-2">
                        <div>
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "signals" : "信号"}</p>
                          <ul className="mt-2 space-y-2 text-sm text-[color:var(--muted)]">
                            {runtime.v21.signals.map((item) => (
                              <li key={item.id}>- {item.signalType} · {item.truthWeight} · {item.signalSummary}</li>
                            ))}
                            {!runtime.v21.signals.length ? <li>- {english ? "No signal event yet." : "当前还没有信号事件。"}</li> : null}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "world model" : "世界模型"}</p>
                          <ul className="mt-2 space-y-2 text-sm text-[color:var(--muted)]">
                            {runtime.v21.worldModels.map((item) => (
                              <li key={item.id}>- {item.summary}</li>
                            ))}
                            {!runtime.v21.worldModels.length ? <li>- {english ? "No world model snapshot yet." : "当前还没有世界模型快照。"}</li> : null}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "artifact versions" : "产物版本"}</p>
                          <ul className="mt-2 space-y-2 text-sm text-[color:var(--muted)]">
                            {runtime.v21.artifactVersions.map((item) => (
                              <li key={item.id}>- {item.artifactType} · v{item.versionNumber}</li>
                            ))}
                            {!runtime.v21.artifactVersions.length ? <li>- {english ? "No artifact version yet." : "当前还没有产物版本。"}</li> : null}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "capabilities" : "能力目录"}</p>
                          <ul className="mt-2 space-y-2 text-sm text-[color:var(--muted)]">
                            {runtime.v21.capabilities.map((item) => (
                              <li key={item.id}>- {item.stage} · {item.name}</li>
                            ))}
                            {!runtime.v21.capabilities.length ? <li>- {english ? "No capability catalog entry yet." : "当前还没有能力目录条目。"}</li> : null}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                            {english ? "project skill library" : "项目技能库"}
                          </p>
                          <ul className="mt-2 space-y-2 text-sm text-[color:var(--muted)]">
                            {runtime.v21.projectSkillLibrary.skillEntries.map((item) => (
                              <li key={item.skillId}>
                                - {text(item.skillName)} · {text(item.environmentSummary)} ·{" "}
                                {item.requiresApproval
                                  ? english
                                    ? "approval gated"
                                    : "审批后可用"
                                  : item.requiresReview
                                    ? english
                                      ? "review first"
                                      : "先复核"
                                    : text(item.effectMode)}
                              </li>
                            ))}
                            {!runtime.v21.projectSkillLibrary.skillEntries.length ? (
                              <li>- {english ? "No project skill entry yet." : "当前还没有项目技能条目。"}</li>
                            ) : null}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                            {english ? "environment seams" : "环境边界"}
                          </p>
                          <ul className="mt-2 space-y-2 text-sm text-[color:var(--muted)]">
                            {runtime.v21.environmentContract.seams.map((item) => (
                              <li key={item.seamId}>
                                - {text(item.seamKind.replaceAll("_", " "))} · {text(item.runtimePosture)} ·{" "}
                                {item.providers.length
                                  ? item.providers.map((provider) => provider.label).join(", ")
                                  : english
                                    ? "boundary only"
                                    : "仅边界定义"}
                              </li>
                            ))}
                            {!runtime.v21.environmentContract.seams.length ? (
                              <li>- {english ? "No environment seam yet." : "当前还没有环境边界。"}</li>
                            ) : null}
                          </ul>
                          <div className="mt-3 rounded-2xl border border-[color:var(--border)]/80 bg-[color:var(--surface-subtle)]/70 px-3 py-3">
                            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                              {english ? "operator progress summary" : "操作进度摘要"}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                              {text(runtime.v21.operatorProgressSummary.summary)}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {[
                                runtime.v21.operatorProgressSummary.state,
                                runtime.v21.operatorProgressSummary.driver,
                                runtime.v21.operatorProgressSummary.requestTakeoverState,
                                runtime.v21.operatorProgressSummary.requestHumanInputState,
                                runtime.v21.operatorProgressSummary.takeoverActivationState,
                                runtime.v21.operatorProgressSummary.operatorControlState,
                                runtime.v21.operatorProgressSummary.closePostureState,
                                runtime.v21.operatorProgressSummary.latestUpdatedAt
                                  ? formatDateLabel(runtime.v21.operatorProgressSummary.latestUpdatedAt)
                                  : null,
                              ]
                                .filter(Boolean)
                                .map((item) => text(String(item)))
                                .join(" · ")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {[
                                english ? `${runtime.v21.operatorProgressSummary.counts.activeRequests} active request` : `${runtime.v21.operatorProgressSummary.counts.activeRequests} 个处理中请求`,
                                english ? `${runtime.v21.operatorProgressSummary.counts.pendingExecutionWrites} pending execution` : `${runtime.v21.operatorProgressSummary.counts.pendingExecutionWrites} 个待执行写入`,
                                english ? `${runtime.v21.operatorProgressSummary.counts.openExecutionFollowThrough} execution follow-through open` : `${runtime.v21.operatorProgressSummary.counts.openExecutionFollowThrough} 个未完成执行跟进`,
                                english ? `${runtime.v21.operatorProgressSummary.counts.benchmarkPendingRequests} benchmark request` : `${runtime.v21.operatorProgressSummary.counts.benchmarkPendingRequests} 个待基准检查请求`,
                                english ? `${runtime.v21.operatorProgressSummary.counts.forwardAttention} forward attention` : `${runtime.v21.operatorProgressSummary.counts.forwardAttention} 个需前置关注`,
                                english ? `${runtime.v21.operatorProgressSummary.counts.openCloseout} open closeout` : `${runtime.v21.operatorProgressSummary.counts.openCloseout} 个未收口事项`,
                              ].join(" · ")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.operatorProgressSummary.nextAction
                                ? text(runtime.v21.operatorProgressSummary.nextAction)
                                : english
                                  ? "No explicit operator progress action is attached to this runtime yet."
                                  : "当前运行还没有明确的操作进度动作。"}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {text(runtime.v21.operatorProgressSummary.boundaryNote)}
                            </p>
                          </div>
                          <div className="mt-3 rounded-2xl border border-[color:var(--border)]/80 bg-[color:var(--surface-subtle)]/70 px-3 py-3">
                            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                              {english ? "operator action summary" : "操作动作摘要"}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                              {text(runtime.v21.operatorActionSummary.summary)}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {[
                                runtime.v21.operatorActionSummary.state,
                                runtime.v21.operatorActionSummary.driver,
                                runtime.v21.operatorActionSummary.progressState,
                                runtime.v21.operatorActionSummary.requestTakeoverState,
                                runtime.v21.operatorActionSummary.requestHumanInputState,
                                runtime.v21.operatorActionSummary.takeoverActivationState,
                                runtime.v21.operatorActionSummary.operatorControlState,
                                runtime.v21.operatorActionSummary.closePostureState,
                                runtime.v21.operatorActionSummary.checkpointKey,
                                runtime.v21.operatorActionSummary.currentOwner,
                                runtime.v21.operatorActionSummary.latestUpdatedAt
                                  ? formatDateLabel(runtime.v21.operatorActionSummary.latestUpdatedAt)
                                  : null,
                              ]
                                .filter(Boolean)
                                .map((item) => text(String(item)))
                                .join(" · ")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.operatorActionSummary.nextAction
                                ? text(runtime.v21.operatorActionSummary.nextAction)
                                : english
                                  ? "No explicit bounded operator action is attached to this runtime yet."
                                  : "当前运行还没有明确的有边界操作动作。"}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {text(runtime.v21.operatorActionSummary.boundaryNote)}
                            </p>
                          </div>
                          <div className="mt-3 rounded-2xl border border-[color:var(--border)]/80 bg-[color:var(--surface-subtle)]/70 px-3 py-3">
                            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                              {english ? "operator control summary" : "操作控制摘要"}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                              {text(runtime.v21.operatorControlSummary.summary)}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {[
                                runtime.v21.operatorControlSummary.state,
                                runtime.v21.operatorControlSummary.driver,
                                runtime.v21.operatorControlSummary.authorityPosture,
                                runtime.v21.operatorControlSummary.executionSeamPosture,
                                runtime.v21.operatorControlSummary.benchmarkWorkflowState,
                                runtime.v21.operatorControlSummary.benchmarkFollowThroughState,
                                runtime.v21.operatorControlSummary.latestUpdatedAt
                                  ? formatDateLabel(runtime.v21.operatorControlSummary.latestUpdatedAt)
                                  : null,
                              ]
                                .filter(Boolean)
                                .map((item) => text(String(item)))
                                .join(" · ")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {[
                                english ? `${runtime.v21.operatorControlSummary.counts.pendingExecutionWrites} pending execution` : `${runtime.v21.operatorControlSummary.counts.pendingExecutionWrites} 个待执行写入`,
                                english ? `${runtime.v21.operatorControlSummary.counts.openExecutionFollowThrough} execution follow-through open` : `${runtime.v21.operatorControlSummary.counts.openExecutionFollowThrough} 个未完成执行跟进`,
                                english ? `${runtime.v21.operatorControlSummary.counts.benchmarkPendingRequests} benchmark request` : `${runtime.v21.operatorControlSummary.counts.benchmarkPendingRequests} 个待基准检查请求`,
                                english ? `${runtime.v21.operatorControlSummary.counts.benchmarkRecordedGates} recorded gate` : `${runtime.v21.operatorControlSummary.counts.benchmarkRecordedGates} 个已记录关口`,
                                english ? `${runtime.v21.operatorControlSummary.counts.benchmarkWarningGates} warning` : `${runtime.v21.operatorControlSummary.counts.benchmarkWarningGates} 个预警`,
                                english ? `${runtime.v21.operatorControlSummary.counts.benchmarkFailingGates} fail` : `${runtime.v21.operatorControlSummary.counts.benchmarkFailingGates} 个失败项`,
                              ].join(" · ")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.operatorControlSummary.nextAction
                                ? text(runtime.v21.operatorControlSummary.nextAction)
                                : english
                                  ? "No explicit operator control action is attached to this runtime yet."
                                  : "当前运行还没有明确的操作控制动作。"}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {text(runtime.v21.operatorControlSummary.boundaryNote)}
                            </p>
                          </div>
                          <div className="mt-3 rounded-2xl border border-[color:var(--border)]/80 bg-[color:var(--surface-subtle)]/70 px-3 py-3">
                            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                              {english ? "environment execution seam" : "环境执行边界"}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                              {text(runtime.v21.environmentContract.executionSeam.summary)}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {[
                                runtime.v21.environmentContract.executionSeam.posture,
                                runtime.v21.environmentContract.executionSeam.latestSource,
                                runtime.v21.environmentContract.executionSeam.latestUpdatedAt
                                  ? formatDateLabel(runtime.v21.environmentContract.executionSeam.latestUpdatedAt)
                                  : null,
                              ]
                                .filter(Boolean)
                                .map((item) => text(String(item)))
                                .join(" · ")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {[
                                english ? `${runtime.v21.environmentContract.executionSeam.counts.officialWritesPending} pending` : `${runtime.v21.environmentContract.executionSeam.counts.officialWritesPending} 个待确认`,
                                english ? `${runtime.v21.environmentContract.executionSeam.counts.officialWritesAcknowledged} acknowledged` : `${runtime.v21.environmentContract.executionSeam.counts.officialWritesAcknowledged} 个已确认`,
                                english ? `${runtime.v21.environmentContract.executionSeam.counts.officialWritesFailed} failed` : `${runtime.v21.environmentContract.executionSeam.counts.officialWritesFailed} 个失败`,
                                english ? `${runtime.v21.environmentContract.executionSeam.counts.officialWritesDeferred} deferred` : `${runtime.v21.environmentContract.executionSeam.counts.officialWritesDeferred} 个暂缓`,
                                english ? `${runtime.v21.environmentContract.executionSeam.counts.followThroughOpen} follow-through open` : `${runtime.v21.environmentContract.executionSeam.counts.followThroughOpen} 个未完成跟进`,
                                english ? `${runtime.v21.environmentContract.executionSeam.counts.followThroughResolved} follow-through resolved` : `${runtime.v21.environmentContract.executionSeam.counts.followThroughResolved} 个已解决跟进`,
                              ].join(" · ")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {text(runtime.v21.environmentContract.executionSeam.boundaryNote)}
                            </p>
                          </div>
                          <div
                            className="mt-3 rounded-2xl border border-[color:var(--border)]/80 bg-[color:var(--surface-subtle)]/70 px-3 py-3"
                            data-testid="environment-execution-authority"
                          >
                            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                              {english ? "environment execution authority" : "环境执行边界"}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                              {text(runtime.v21.environmentContract.executionAuthority.summary)}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {[
                                text(runtime.v21.environmentContract.executionAuthority.posture),
                                english
                                  ? `${runtime.v21.environmentContract.executionAuthority.counts.guardedWriteReviewGated} guarded`
                                  : `${runtime.v21.environmentContract.executionAuthority.counts.guardedWriteReviewGated} 条需复核写入`,
                                english
                                  ? `${runtime.v21.environmentContract.executionAuthority.counts.limitedAutoEligible} narrow-auto`
                                  : `${runtime.v21.environmentContract.executionAuthority.counts.limitedAutoEligible} 条窄自动候选`,
                                english
                                  ? `${runtime.v21.environmentContract.executionAuthority.counts.limitedAutoManualOnly} manual-only`
                                  : `${runtime.v21.environmentContract.executionAuthority.counts.limitedAutoManualOnly} 条仅人工`,
                                english
                                  ? `${runtime.v21.environmentContract.executionAuthority.counts.limitedAutoBlocked} blocked`
                                  : `${runtime.v21.environmentContract.executionAuthority.counts.limitedAutoBlocked} 条已阻断`,
                                english
                                  ? `${runtime.v21.environmentContract.executionAuthority.counts.limitedAutoDeferred} deferred`
                                  : `${runtime.v21.environmentContract.executionAuthority.counts.limitedAutoDeferred} 条暂缓`,
                              ].join(" · ")}
                            </p>
                            <ul className="mt-2 space-y-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.environmentContract.executionAuthority.sourceEntries.map((item) => (
                                <li key={item.source}>
                                  - {text(item.source.replaceAll("_", " "))} · {text(item.posture)} · {item.liveReferenceCount} · {text(item.summary)}
                                </li>
                              ))}
                            </ul>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {text(runtime.v21.environmentContract.executionAuthority.boundaryNote)}
                            </p>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                            {english ? "benchmark matrix" : "基准矩阵"}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                            {runtime.v21.benchmarkMatrix.workflow.summary}
                          </p>
                          <ul className="mt-2 space-y-2 text-sm text-[color:var(--muted)]">
                            <li>
                              - {english ? "workflow" : "工作流"} · {runtime.v21.benchmarkMatrix.workflow.state} ·{" "}
                              {runtime.v21.benchmarkMatrix.workflow.pendingRequestCount}{" "}
                              {english ? "pending request(s)" : "待处理请求"} ·{" "}
                              {runtime.v21.benchmarkMatrix.workflow.acknowledgedRunCount}{" "}
                              {english ? "acknowledged run(s)" : "已确认运行"}
                            </li>
                            <li>
                              - {english ? "request" : "请求"} · {runtime.v21.benchmarkMatrix.workflow.request.state} ·{" "}
                              {runtime.v21.benchmarkMatrix.workflow.request.requestKey ?? (english ? "none" : "暂无")}
                              {runtime.v21.benchmarkMatrix.workflow.request.requestedAt
                                ? ` · ${formatDateLabel(runtime.v21.benchmarkMatrix.workflow.request.requestedAt)}`
                                : ""}
                            </li>
                            <li>
                              - {english ? "latest run" : "最近运行"} · {runtime.v21.benchmarkMatrix.workflow.latestRun.state} ·{" "}
                              {runtime.v21.benchmarkMatrix.workflow.latestRun.runLabel ??
                                runtime.v21.benchmarkMatrix.workflow.latestRun.benchmarkRunId ??
                                (english ? "none" : "暂无")}
                              {runtime.v21.benchmarkMatrix.workflow.latestRun.recordedAt
                                ? ` · ${formatDateLabel(runtime.v21.benchmarkMatrix.workflow.latestRun.recordedAt)}`
                                : ""}
                            </li>
                            <li>
                              - 已确认 · {runtime.v21.benchmarkMatrix.workflow.acknowledgement.state} ·{" "}
                              {runtime.v21.benchmarkMatrix.workflow.acknowledgement.acknowledgedBy ?? (english ? "none" : "暂无")}
                              {runtime.v21.benchmarkMatrix.workflow.acknowledgement.acknowledgedAt
                                ? ` · ${formatDateLabel(runtime.v21.benchmarkMatrix.workflow.acknowledgement.acknowledgedAt)}`
                                : ""}
                            </li>
                            <li>
                              - {english ? "follow-through" : "跟进闭环"} · {runtime.v21.benchmarkMatrix.workflow.followThrough.state} ·{" "}
                              {runtime.v21.benchmarkMatrix.workflow.followThrough.nextAction ??
                                runtime.v21.benchmarkMatrix.workflow.followThrough.resolvedBy ??
                                (english ? "none" : "暂无")}
                              {(runtime.v21.benchmarkMatrix.workflow.followThrough.resolvedAt ??
                                runtime.v21.benchmarkMatrix.workflow.followThrough.requestedAt)
                                ? ` · ${formatDateLabel(
                                    runtime.v21.benchmarkMatrix.workflow.followThrough.resolvedAt ??
                                      runtime.v21.benchmarkMatrix.workflow.followThrough.requestedAt,
                                  )}`
                                : ""}
                            </li>
                            {runtime.v21.benchmarkMatrix.layers.map((item) => (
                              <li key={item.layerId}>
                                - {item.label} · {item.outcomeStatus} · {item.recordedGateCount}/{item.gates.length}{" "}
                                {english ? "gate(s)" : "个闸口"}
                                {item.latestRecordedAt ? ` · ${formatDateLabel(item.latestRecordedAt)}` : ""}
                              </li>
                            ))}
                            {!runtime.v21.benchmarkMatrix.layers.length ? (
                              <li>- {english ? "No benchmark gate yet." : "当前还没有基准闸口。"}</li>
                            ) : null}
                          </ul>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {runtime.v21.benchmarkMatrix.workflow.boundaryNote}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="theme-surface-panel rounded-2xl px-4 py-4">
                      <p className="text-sm font-semibold text-[color:var(--foreground)]">
                        {english ? "Handoff and coordination telemetry" : "交接与协同遥测"}
                      </p>
                      <div className="mt-3 grid gap-4 md:grid-cols-2">
                        <div>
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "handoff packets" : "交接包"}</p>
                          <ul className="mt-2 space-y-2 text-sm text-[color:var(--muted)]">
                            {runtime.v21.handoffPackets.map((item) => (
                              <li key={item.id}>- {item.fromAgent} {"->"} {item.toAgent} · {item.goal}</li>
                            ))}
                            {!runtime.v21.handoffPackets.length ? <li>- {english ? "No handoff packet yet." : "当前还没有交接包。"}</li> : null}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "initiative runs" : "主动运行"}</p>
                          <ul className="mt-2 space-y-2 text-sm text-[color:var(--muted)]">
                            {runtime.v21.initiativeRuns.map((item) => (
                              <li key={item.id}>- {item.status} · {item.title} · {item.targetOutcome}</li>
                            ))}
                            {!runtime.v21.initiativeRuns.length ? <li>- {english ? "No initiative run yet." : "当前还没有主动运行。"}</li> : null}
                          </ul>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-5">
                        <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "action ready" : "动作就绪"}</p>
                          <p className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">{runtime.v21.coordinationMetrics.actionReady}</p>
                        </div>
                        <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "review needed" : "需要复核"}</p>
                          <p className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">{runtime.v21.coordinationMetrics.reviewNeeded}</p>
                        </div>
                        <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "waiting on signal" : "等待信号"}</p>
                          <p className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">{runtime.v21.coordinationMetrics.waitingOnSignal}</p>
                        </div>
                        <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "waiting on authority" : "等待权限"}</p>
                          <p className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">{runtime.v21.coordinationMetrics.waitingOnAuthority}</p>
                        </div>
                        <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "capability gap" : "能力缺口"}</p>
                          <p className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">{runtime.v21.coordinationMetrics.capabilityGap}</p>
                        </div>
                      </div>
                    </div>

                    <div className="theme-surface-panel rounded-2xl px-4 py-4">
                      <p className="text-sm font-semibold text-[color:var(--foreground)]">
                        {english ? "Operator debugger spine" : "操作员调试主线"}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{runtime.v21.debugger.summary}</p>
                      <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">{runtime.v21.debugger.boundaryNote}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge variant="neutral">{runtime.v21.runThread.runStatus}</Badge>
                        <Badge variant="neutral">{runtime.v21.runThread.lifecycle}</Badge>
                        <Badge variant="neutral">{runtime.v21.runThread.resume.state}</Badge>
                        <Badge variant="neutral">{runtime.v21.runThread.resultAcknowledgement.state}</Badge>
                        <Badge variant="neutral">{runtime.v21.runThread.forwardFlow.state}</Badge>
                        <Badge variant="neutral">{runtime.v21.runThread.replayRequest.mode}</Badge>
                        <Badge variant="neutral">{runtime.v21.debugger.interruptReason.state}</Badge>
                        <Badge variant="neutral">{runtime.v21.debugger.resumeAsk.mode}</Badge>
                        <Badge variant="neutral">{runtime.v21.debugger.handoffPayload.state}</Badge>
                        <Badge variant="neutral">{runtime.v21.environmentContract.executionSeam.posture}</Badge>
                        <Badge variant="neutral">{runtime.v21.debugger.traceContract.state}</Badge>
                        <Badge variant="neutral">{runtime.v21.debugger.writeContract.state}</Badge>
                        <Badge variant="neutral">{runtime.v21.debugger.swarmSpawnContract.state}</Badge>
                        <Badge variant="neutral">{runtime.v21.debugger.recoveryActionContract.state}</Badge>
                        <Badge variant="neutral">{runtime.v21.debugger.recoveryLifecycleContract.state}</Badge>
                        <Badge variant="neutral">
                          {runtime.v21.debugger.recoveryStateMachineContract.transitionState}
                        </Badge>
                        <Badge variant="neutral">{runtime.v21.debugger.replayAssistance.fidelity}</Badge>
                        <Badge variant="neutral">{runtime.v21.debugger.persistedLifecycleTrace.state}</Badge>
                        <Badge variant="neutral">{runtime.v21.debugger.takeoverAssistance.posture}</Badge>
                        <Badge variant="neutral">{runtime.v21.debugger.takeoverRequest.state}</Badge>
                        <Badge variant="neutral">{runtime.v21.debugger.takeoverActivation.state}</Badge>
                        <Badge variant="neutral">{runtime.v21.debugger.takeoverFollowThrough.state}</Badge>
                        <Badge variant="neutral">{runtime.v21.debugger.humanInputCheckpoint.state}</Badge>
                        <Badge variant="neutral">{runtime.v21.debugger.humanInputRequest.state}</Badge>
                      </div>
                      <p className={english ? "mt-3 text-xs leading-5 text-[color:var(--muted-foreground)]" : "hidden"}>
                        {`thread ${runtime.v21.runThread.threadId} · checkpoint ${runtime.v21.runThread.latestCheckpoint?.checkpointKey ?? "none"} · replay ${runtime.v21.runThread.replay.eventLogEntries} · resume token ${runtime.v21.debugger.replayAssistance.resumeToken ?? "none"} · debugger trace ${runtime.v21.debugger.traceContract.state}/${runtime.v21.debugger.traceContract.driver}/${runtime.v21.debugger.traceContract.anchor}/${runtime.v21.debugger.traceContract.checkpointKey ?? "none"} · debugger write ${runtime.v21.debugger.writeContract.state}/${runtime.v21.debugger.writeContract.driver}/${runtime.v21.debugger.writeContract.writeAnchor}/${runtime.v21.debugger.writeContract.checkpointKey ?? "none"} · debugger swarm ${runtime.v21.debugger.swarmSpawnContract.state}/${runtime.v21.debugger.swarmSpawnContract.driver}/${runtime.v21.debugger.swarmSpawnContract.workspaceFlagState}/${runtime.v21.debugger.swarmSpawnContract.budgetPosture}/${runtime.v21.debugger.swarmSpawnContract.denyReason ?? "none"} · debugger recovery ${runtime.v21.debugger.recoveryActionContract.state}/${runtime.v21.debugger.recoveryActionContract.driver}/${runtime.v21.debugger.recoveryActionContract.action ?? "none"}/${runtime.v21.debugger.recoveryActionContract.checkpointKey ?? "none"} · debugger recovery lifecycle ${runtime.v21.debugger.recoveryLifecycleContract.state}/${runtime.v21.debugger.recoveryLifecycleContract.driver}/${runtime.v21.debugger.recoveryLifecycleContract.anchor}/${runtime.v21.debugger.recoveryLifecycleContract.nextTransition} · debugger recovery transition ${runtime.v21.debugger.recoveryTransitionContract.state}/${runtime.v21.debugger.recoveryTransitionContract.driver}/${runtime.v21.debugger.recoveryTransitionContract.anchor}/${runtime.v21.debugger.recoveryTransitionContract.transition} · debugger recovery state machine ${runtime.v21.debugger.recoveryStateMachineContract.phase}/${runtime.v21.debugger.recoveryStateMachineContract.transitionState}/${runtime.v21.debugger.recoveryStateMachineContract.currentTransition} · debugger recovery execution ${runtime.v21.debugger.recoveryExecutionContract.state}/${runtime.v21.debugger.recoveryExecutionContract.currentTransition}/${runtime.v21.debugger.recoveryExecutionContract.canExecute ? "execute" : "hold"} · persisted lifecycle ${runtime.v21.runThread.persistedControlPlaneLifecycle.state}/${runtime.v21.runThread.persistedControlPlaneLifecycle.guardPolicy.state}/${runtime.v21.runThread.persistedControlPlaneLifecycle.compactionPolicy.state}/${runtime.v21.runThread.persistedControlPlaneLifecycle.reconciliationPolicy.state}/${runtime.v21.runThread.persistedControlPlaneLifecycle.repairPolicy.state}/${runtime.v21.runThread.persistedControlPlaneLifecycle.writeSide.state}/${runtime.v21.runThread.persistedControlPlaneLifecycle.writeSide.refreshReason ?? "none"} · persisted trace ${runtime.v21.debugger.persistedLifecycleTrace.state}/${runtime.v21.debugger.persistedLifecycleTrace.anchor}/${runtime.v21.debugger.persistedLifecycleTrace.resumeState}/${runtime.v21.debugger.persistedLifecycleTrace.replayRequestMode}/${runtime.v21.debugger.persistedLifecycleTrace.humanInputCheckpointState}/${runtime.v21.debugger.persistedLifecycleTrace.writeSideState}/${runtime.v21.debugger.persistedLifecycleTrace.refreshReason ?? "none"} · result ack ${runtime.v21.runThread.resultAcknowledgement.state} · result flow ${runtime.v21.runThread.resultFlow.requiresOperatorAttentionCount}/${runtime.v21.runThread.resultFlow.resolvedCount} · closeout flow ${runtime.v21.runThread.closeoutFlow.state}/${runtime.v21.runThread.closeoutFlow.openCount} · closeout summary ${runtime.v21.runThread.closeoutSummary.state}/${runtime.v21.runThread.closeoutSummary.driver} · closeout resolution ${runtime.v21.runThread.closeoutResolution.state}${runtime.v21.runThread.closeoutResolution.decision ? `/${runtime.v21.runThread.closeoutResolution.decision}` : ""} · closeout resolution follow-through ${runtime.v21.runThread.closeoutResolutionFollowThrough.state}${runtime.v21.runThread.closeoutResolutionFollowThrough.decision ? `/${runtime.v21.runThread.closeoutResolutionFollowThrough.decision}` : ""} · closeout outcome ${runtime.v21.runThread.closeoutOutcome.state}${runtime.v21.runThread.closeoutOutcome.decision ? `/${runtime.v21.runThread.closeoutOutcome.decision}` : ""} · close request ${runtime.v21.runThread.closeRequest.state} · close lifecycle ${runtime.v21.runThread.closeLifecycle.state}/${runtime.v21.runThread.closeLifecycle.driver} · close control ${runtime.v21.runThread.closeControl.state}/${runtime.v21.runThread.closeControl.driver} · close control flow ${runtime.v21.runThread.closeControlFlow.state}/${runtime.v21.runThread.closeControlFlow.driver} · close decision flow ${runtime.v21.runThread.closeDecisionFlow.state}/${runtime.v21.runThread.closeDecisionFlow.driver} · close decision control ${runtime.v21.runThread.closeDecisionControlSummary.state}/${runtime.v21.runThread.closeDecisionControlSummary.driver} · close resolution ${runtime.v21.runThread.closeResolutionSummary.state}/${runtime.v21.runThread.closeResolutionSummary.driver} · close resolution forward ${runtime.v21.runThread.closeResolutionForwardSummary.state}/${runtime.v21.runThread.closeResolutionForwardSummary.driver} · close resolution control ${runtime.v21.runThread.closeResolutionControlSummary.state}/${runtime.v21.runThread.closeResolutionControlSummary.driver} · close posture ${runtime.v21.runThread.closePostureSummary.state}/${runtime.v21.runThread.closePostureSummary.driver} · close posture forward ${runtime.v21.runThread.closePostureForwardSummary.state}/${runtime.v21.runThread.closePostureForwardSummary.driver} · settlement review ${runtime.v21.runThread.settlementReview.state} · closeout confirmation ${runtime.v21.runThread.closeoutConfirmation.state} · closeout refresh ${runtime.v21.runThread.closeoutRefresh.state} · settlement flow ${runtime.v21.runThread.settlementFlow.state}/${runtime.v21.runThread.settlementFlow.openCloseoutCount} · forward flow ${runtime.v21.runThread.forwardFlow.state}/${runtime.v21.runThread.forwardFlow.attentionCount} · request posture ${runtime.v21.runThread.requestPosture.takeoverState}/${runtime.v21.runThread.requestPosture.humanInputState} · operator action ${runtime.v21.operatorActionSummary.state}/${runtime.v21.operatorActionSummary.driver} · control summary ${runtime.v21.operatorControlSummary.state}/${runtime.v21.operatorControlSummary.driver} · execution seam ${runtime.v21.environmentContract.executionSeam.posture} · execution authority ${runtime.v21.environmentContract.executionAuthority.posture} · benchmark workflow ${runtime.v21.benchmarkMatrix.workflow.state} · benchmark follow-through ${runtime.v21.benchmarkMatrix.workflow.followThrough.state} · takeover request ${runtime.v21.debugger.takeoverRequest.state} · takeover active ${runtime.v21.debugger.takeoverActivation.state} · takeover follow-through ${runtime.v21.debugger.takeoverFollowThrough.state} · human input request ${runtime.v21.debugger.humanInputRequest.state} · lifecycle ${runtime.v21.runThread.lifecycleLog[0]?.kind ?? "none"}`}
                      </p>
                      {!english ? (
                        <p className="mt-3 text-xs leading-5 text-[color:var(--muted-foreground)]">
                          {`运行线索：线程 ${runtime.v21.runThread.threadId}，检查点 ${runtime.v21.runThread.latestCheckpoint?.checkpointKey ?? "无"}，回放记录 ${runtime.v21.runThread.replay.eventLogEntries} 条；接管状态 ${text(runtime.v21.debugger.takeoverActivation.state)}，人工输入 ${text(runtime.v21.debugger.humanInputRequest.state)}，收口状态 ${text(runtime.v21.runThread.closeoutFlow.state)}。`}
                        </p>
                      ) : null}
                      <div className="mt-4 grid gap-4 xl:grid-cols-3">
                        <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3" data-testid="operator-debugger-trace-contract">
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                            {english ? "trace / replay / checkpoint contract" : "追踪 / 回放 / 检查点记录"}
                          </p>
                          <p className="mt-3 text-sm leading-6 text-[color:var(--foreground)]">{text(runtime.v21.debugger.traceContract.summary)}</p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {text(runtime.v21.debugger.traceContract.boundaryNote)}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {[
                              runtime.v21.debugger.traceContract.state,
                              runtime.v21.debugger.traceContract.driver,
                              runtime.v21.debugger.traceContract.anchor,
                              runtime.v21.debugger.traceContract.checkpointKey,
                              `${runtime.v21.debugger.traceContract.checkpointLineageDepth} checkpoint anchor(s)`,
                              runtime.v21.debugger.traceContract.replayRequestMode,
                              runtime.v21.debugger.traceContract.replayFidelity,
                              runtime.v21.debugger.traceContract.humanInputCheckpointState,
                              runtime.v21.debugger.traceContract.humanInputRequestState,
                              runtime.v21.debugger.traceContract.persistedTraceState,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          {runtime.v21.debugger.traceContract.nextAction ? (
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.debugger.traceContract.nextAction}
                            </p>
                          ) : null}
                        </div>
                        <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3" data-testid="operator-debugger-replay-assistance">
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                            {english ? "replay + resume assistance" : "回放 + 恢复辅助"}
                          </p>
                          <p className="mt-3 text-sm leading-6 text-[color:var(--foreground)]">{runtime.v21.debugger.replayAssistance.summary}</p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">{runtime.v21.debugger.replayAssistance.boundaryNote}</p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {[
                              runtime.v21.debugger.replayAssistance.fidelity,
                              runtime.v21.debugger.replayAssistance.checkpointKey,
                              runtime.v21.debugger.replayAssistance.resumeToken,
                              `${runtime.v21.debugger.replayAssistance.eventLogEntries} replay event(s)`,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3" data-testid="operator-debugger-persisted-lifecycle-trace">
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                            {english ? "persisted lifecycle trace" : "已持久化生命周期轨迹"}
                          </p>
                          <p className="mt-3 text-sm leading-6 text-[color:var(--foreground)]">
                            {runtime.v21.debugger.persistedLifecycleTrace.summary}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {runtime.v21.debugger.persistedLifecycleTrace.boundaryNote}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {[
                              persistedLifecycleTraceReadout?.compactSummary ?? null,
                              persistedLifecycleTraceReadout?.integritySummary ?? null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          {runtime.v21.debugger.persistedLifecycleTrace.nextAction ? (
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.debugger.persistedLifecycleTrace.nextAction}
                            </p>
                          ) : null}
                        </div>
                        <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3" data-testid="operator-debugger-write-contract">
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                            {english ? "replay / recovery write contract" : "回放 / 恢复写入契约"}
                          </p>
                          <p className="mt-3 text-sm leading-6 text-[color:var(--foreground)]">{runtime.v21.debugger.writeContract.summary}</p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {runtime.v21.debugger.writeContract.boundaryNote}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {[
                              runtime.v21.debugger.writeContract.state,
                              runtime.v21.debugger.writeContract.driver,
                              runtime.v21.debugger.writeContract.writeAnchor,
                              runtime.v21.debugger.writeContract.checkpointKey,
                              runtime.v21.debugger.writeContract.persistedWriteSideState,
                              runtime.v21.debugger.writeContract.refreshReason,
                              runtime.v21.debugger.writeContract.traceContractState,
                              runtime.v21.debugger.writeContract.traceContractDriver,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          {runtime.v21.debugger.writeContract.nextAction ? (
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.debugger.writeContract.nextAction}
                            </p>
                          ) : null}
                        </div>
                        <div
                          className="rounded-2xl border border-[color:var(--border)] px-3 py-3"
                          data-testid="operator-debugger-swarm-spawn-contract"
                        >
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                            {english ? "swarm spawn contract" : "多代理派生契约"}
                          </p>
                          <p className="mt-3 text-sm leading-6 text-[color:var(--foreground)]">
                            {runtime.v21.debugger.swarmSpawnContract.summary}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {runtime.v21.debugger.swarmSpawnContract.boundaryNote}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {[
                              runtime.v21.debugger.swarmSpawnContract.state,
                              runtime.v21.debugger.swarmSpawnContract.requestRecordState,
                              runtime.v21.debugger.swarmSpawnContract.driver,
                              runtime.v21.debugger.swarmSpawnContract.workspaceFlagState,
                              runtime.v21.debugger.swarmSpawnContract.lifecycleState,
                              runtime.v21.debugger.swarmSpawnContract.budgetPosture,
                              runtime.v21.debugger.swarmSpawnContract.budgetEnvelopeState,
                              runtime.v21.debugger.swarmSpawnContract.denyReason ?? "none",
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {english
                              ? `Read-only workers ${runtime.v21.debugger.swarmReadOnlyWorkerContract.allowlistedWorkers.join(" / ")} · artifact-first · no transcript merge · ${runtime.v21.debugger.swarmReadOnlyWorkerContract.state}`
                              : `只读子代理：${runtime.v21.debugger.swarmReadOnlyWorkerContract.allowlistedWorkers
                                  .map((item) =>
                                    item === "search"
                                      ? "搜索"
                                      : item === "grep"
                                        ? "检索"
                                        : "证据挖掘",
                                  )
                                  .join(" / ")} · 产物优先 · 不回灌长对话记录 · ${
                                  runtime.v21.debugger.swarmReadOnlyWorkerContract.state ===
                                  "blocked"
                                    ? "阻断"
                                    : runtime.v21.debugger.swarmReadOnlyWorkerContract.state ===
                                        "requested"
                                      ? "已记录请求"
                                      : "就绪"
                                }`}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {runtime.v21.debugger.swarmReadOnlyWorkerContract.requestLifecycleSummary}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {runtime.v21.debugger.swarmReadOnlyWorkerContract.handoffPreviewSummary}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {runtime.v21.debugger.swarmReadOnlyWorkerContract.packetConsumptionIntentSummary}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {runtime.v21.debugger.swarmReadOnlyWorkerContract.artifactBundlePlaceholderSummary}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {runtime.v21.debugger.swarmReadOnlyWorkerContract.handoffConsumptionSummary}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {
                              runtime.v21.debugger.swarmReadOnlyWorkerContract
                                .artifactBundlePlaceholderRecordSummary
                            }
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {
                              runtime.v21.debugger.swarmReadOnlyWorkerContract
                                .handoffConsumptionRecordSummary
                            }
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {
                              runtime.v21.debugger.swarmReadOnlyWorkerContract
                                .executionPreflightSummary
                            }
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {
                              runtime.v21.debugger.swarmReadOnlyWorkerContract.executionGuardContract
                                .summary
                            }
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {english
                              ? `Execution lifecycle ${runtime.v21.debugger.swarmReadOnlyWorkerContract.executionLifecycleContract.state} · ${runtime.v21.debugger.swarmReadOnlyWorkerContract.executionLifecycleContract.driver}`
                              : `执行生命周期 ${
                                  runtime.v21.debugger.swarmReadOnlyWorkerContract
                                    .executionLifecycleContract.state === "blocked"
                                    ? "阻断"
                                    : runtime.v21.debugger.swarmReadOnlyWorkerContract
                                          .executionLifecycleContract.state === "request_required"
                                      ? "待记录请求"
                                      : runtime.v21.debugger.swarmReadOnlyWorkerContract
                                            .executionLifecycleContract.state ===
                                          "selection_required"
                                        ? "待选择通道"
                                        : runtime.v21.debugger.swarmReadOnlyWorkerContract
                                              .executionLifecycleContract.state ===
                                            "placeholder_record_required"
                                          ? "待记录占位"
                                          : runtime.v21.debugger.swarmReadOnlyWorkerContract
                                                .executionLifecycleContract.state === "recordable"
                                            ? "可记录执行"
                                            : "已记录执行"
                                }`}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {english
                              ? `Execution candidate ${runtime.v21.debugger.swarmReadOnlyWorkerContract.executionCandidateContract.state} · materialization ${runtime.v21.debugger.swarmReadOnlyWorkerContract.executionCandidateContract.artifactMaterializationState}`
                              : `执行候选 ${
                                  runtime.v21.debugger.swarmReadOnlyWorkerContract
                                    .executionCandidateContract.state === "candidate_ready"
                                    ? "候选已就绪"
                                    : "未就绪"
                                } · 产物物化 ${
                                  runtime.v21.debugger.swarmReadOnlyWorkerContract
                                    .executionCandidateContract.artifactMaterializationState ===
                                  "intent_ready"
                                    ? "意图已就绪"
                                    : "未就绪"
                                }`}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {english
                              ? `Materialization guard ${runtime.v21.debugger.swarmReadOnlyWorkerContract.artifactMaterializationGuardContract.state}`
                              : `物化门禁 ${
                                  runtime.v21.debugger.swarmReadOnlyWorkerContract
                                    .artifactMaterializationGuardContract.state === "allowed"
                                    ? "允许"
                                    : "阻断"
                                }`}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {
                              runtime.v21.debugger.swarmReadOnlyWorkerContract.executionRecordSummary
                            }
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {
                              runtime.v21.debugger.swarmReadOnlyWorkerContract
                                .artifactMaterializationGuardContract.summary
                            }
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {
                              runtime.v21.debugger.swarmReadOnlyWorkerContract
                                .artifactMaterializationRecordSummary
                            }
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {english
                              ? `Materialization lifecycle ${runtime.v21.debugger.swarmReadOnlyWorkerContract.artifactMaterializationLifecycleContract.state} · ${runtime.v21.debugger.swarmReadOnlyWorkerContract.artifactMaterializationLifecycleContract.driver}`
                              : `物化生命周期 ${
                                  runtime.v21.debugger.swarmReadOnlyWorkerContract
                                    .artifactMaterializationLifecycleContract.state === "blocked"
                                    ? "阻断"
                                    : runtime.v21.debugger.swarmReadOnlyWorkerContract
                                          .artifactMaterializationLifecycleContract.state ===
                                        "recordable"
                                        ? "可记录物化"
                                      : "已记录物化"
                                }`}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {english
                              ? `Result-side output ${runtime.v21.debugger.swarmReadOnlyWorkerContract.resultSideOutputContract.state} · ${runtime.v21.debugger.swarmReadOnlyWorkerContract.resultSideOutputContract.driver}`
                              : `结果侧输出 ${
                                  runtime.v21.debugger.swarmReadOnlyWorkerContract
                                    .resultSideOutputContract.state === "output_ready"
                                    ? "输出已就绪"
                                    : "未就绪"
                                }`}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {
                              runtime.v21.debugger.swarmReadOnlyWorkerContract
                                .resultSideOutputContract.summary
                            }
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {english
                              ? `Output guard ${runtime.v21.debugger.swarmReadOnlyWorkerContract.resultSideOutputGuardContract.state}`
                              : `输出门禁 ${
                                  runtime.v21.debugger.swarmReadOnlyWorkerContract
                                    .resultSideOutputGuardContract.state === "allowed"
                                    ? "允许"
                                    : "阻断"
                                }`}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {
                              runtime.v21.debugger.swarmReadOnlyWorkerContract
                                .resultSideOutputGuardContract.summary
                            }
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {english
                              ? `Output lifecycle ${runtime.v21.debugger.swarmReadOnlyWorkerContract.resultSideOutputLifecycleContract.state} · ${runtime.v21.debugger.swarmReadOnlyWorkerContract.resultSideOutputLifecycleContract.driver}`
                              : `输出生命周期 ${
                                  runtime.v21.debugger.swarmReadOnlyWorkerContract
                                    .resultSideOutputLifecycleContract.state === "consumable"
                                    ? "可消费"
                                    : "阻断"
                                }`}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {
                              runtime.v21.debugger.swarmReadOnlyWorkerContract
                                .resultSideOutputLifecycleContract.summary
                            }
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {english
                              ? `Output consumption ${runtime.v21.debugger.swarmReadOnlyWorkerContract.outputConsumptionContract.state} · ${runtime.v21.debugger.swarmReadOnlyWorkerContract.outputConsumptionContract.driver}`
                              : `输出消费 ${
                                  runtime.v21.debugger.swarmReadOnlyWorkerContract
                                    .outputConsumptionContract.state === "consumable"
                                    ? "可消费"
                                    : "未就绪"
                                }`}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {
                              runtime.v21.debugger.swarmReadOnlyWorkerContract
                                .outputConsumptionContract.summary
                            }
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {english
                              ? `Result adoption ${runtime.v21.debugger.swarmReadOnlyWorkerContract.resultAdoptionContract.state} · ${runtime.v21.debugger.swarmReadOnlyWorkerContract.resultAdoptionContract.driver}`
                              : `结果采纳 ${
                                  runtime.v21.debugger.swarmReadOnlyWorkerContract
                                    .resultAdoptionContract.state === "adoption_ready"
                                    ? "可采纳"
                                    : "未就绪"
                                }`}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {
                              runtime.v21.debugger.swarmReadOnlyWorkerContract
                                .resultAdoptionContract.summary
                            }
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {english
                              ? `Adoption guard ${runtime.v21.debugger.swarmReadOnlyWorkerContract.outputAdoptionGuardContract.state}`
                              : `采纳门禁 ${
                                  runtime.v21.debugger.swarmReadOnlyWorkerContract
                                    .outputAdoptionGuardContract.state === "allowed"
                                    ? "允许"
                                    : "阻断"
                                }`}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {
                              runtime.v21.debugger.swarmReadOnlyWorkerContract
                                .outputAdoptionGuardContract.summary
                            }
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {english
                              ? `Adoption record ${runtime.v21.debugger.swarmReadOnlyWorkerContract.outputAdoptionRecordState}`
                              : `采纳记录 ${
                                  runtime.v21.debugger.swarmReadOnlyWorkerContract
                                    .outputAdoptionRecordState === "recorded"
                                    ? "已记录"
                                    : runtime.v21.debugger.swarmReadOnlyWorkerContract
                                          .outputAdoptionRecordState === "recordable"
                                      ? "可记录"
                                      : "未就绪"
                                }`}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {
                              runtime.v21.debugger.swarmReadOnlyWorkerContract
                                .outputAdoptionRecordSummary
                            }
                          </p>
                          {runtime.v21.debugger.swarmReadOnlyWorkerContract.outputAdoptedBy ? (
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {english
                                ? `Adoption recorded by ${runtime.v21.debugger.swarmReadOnlyWorkerContract.outputAdoptedBy}${runtime.v21.debugger.swarmReadOnlyWorkerContract.outputAdoptionSourcePage ? ` · ${runtime.v21.debugger.swarmReadOnlyWorkerContract.outputAdoptionSourcePage}` : ""}`
                                : `采纳记录人 ${runtime.v21.debugger.swarmReadOnlyWorkerContract.outputAdoptedBy}${runtime.v21.debugger.swarmReadOnlyWorkerContract.outputAdoptionSourcePage ? ` · ${runtime.v21.debugger.swarmReadOnlyWorkerContract.outputAdoptionSourcePage}` : ""}`}
                            </p>
                          ) : null}
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {english
                              ? `Adoption lifecycle ${runtime.v21.debugger.swarmReadOnlyWorkerContract.outputAdoptionLifecycleContract.state} · ${runtime.v21.debugger.swarmReadOnlyWorkerContract.outputAdoptionLifecycleContract.driver}`
                              : `采纳生命周期 ${
                                  runtime.v21.debugger.swarmReadOnlyWorkerContract
                                    .outputAdoptionLifecycleContract.state === "recorded"
                                    ? "已记录"
                                    : runtime.v21.debugger.swarmReadOnlyWorkerContract
                                          .outputAdoptionLifecycleContract.state === "recordable"
                                      ? "可记录"
                                    : "阻断"
                                }`}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {
                              runtime.v21.debugger.swarmReadOnlyWorkerContract
                                .outputAdoptionLifecycleContract.summary
                            }
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {english
                              ? `Adoption result-side ${runtime.v21.debugger.swarmReadOnlyWorkerContract.resultAdoptionResultSideContract.state} · ${runtime.v21.debugger.swarmReadOnlyWorkerContract.resultAdoptionResultSideContract.driver}`
                              : `采纳结果侧 ${
                                  runtime.v21.debugger.swarmReadOnlyWorkerContract
                                    .resultAdoptionResultSideContract.state === "output_ready"
                                    ? "输出已就绪"
                                    : "未就绪"
                                }`}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {
                              runtime.v21.debugger.swarmReadOnlyWorkerContract
                                .resultAdoptionResultSideContract.summary
                            }
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {english
                              ? `Verification merge lane ${runtime.v21.debugger.swarmVerificationMergeLaneContract.state} · ${runtime.v21.debugger.swarmVerificationMergeLaneContract.driver} · ${runtime.v21.debugger.swarmVerificationMergeLaneContract.mergeLaneTruth ?? "no-truth"}`
                              : `验证合流 ${
                                  runtime.v21.debugger.swarmVerificationMergeLaneContract.state ===
                                  "recorded"
                                    ? "已记录"
                                    : runtime.v21.debugger.swarmVerificationMergeLaneContract.state ===
                                        "recordable"
                                      ? "可记录"
                                      : "未就绪"
                                } · ${
                                  runtime.v21.debugger.swarmVerificationMergeLaneContract
                                    .mergeLaneTruth === "mergeable"
                                    ? "可合流"
                                    : runtime.v21.debugger.swarmVerificationMergeLaneContract
                                          .mergeLaneTruth === "rework_required"
                                      ? "需返工"
                                      : runtime.v21.debugger.swarmVerificationMergeLaneContract
                                            .mergeLaneTruth === "human_review_required"
                                        ? "需人工复核"
                                        : "暂无结论"
                                }`}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {runtime.v21.debugger.swarmVerificationMergeLaneContract.summary}
                          </p>
                          {runtime.v21.debugger.swarmVerificationMergeLaneContract.disagreementSummary ? (
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.debugger.swarmVerificationMergeLaneContract.disagreementSummary}
                            </p>
                          ) : null}
                          <ul className="mt-2 space-y-1 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {runtime.v21.debugger.swarmReadOnlyWorkerContract.lanePreviews.map((item) => (
                              <li key={item.packetKey}>
                                -{" "}
                                {english
                                  ? item.workerKind === "search"
                                    ? "search lane"
                                    : item.workerKind === "grep"
                                      ? "grep lane"
                                      : "evidence-mining lane"
                                  : item.workerKind === "search"
                                    ? "搜索通道"
                                    : item.workerKind === "grep"
                                      ? "检索通道"
                                      : "证据挖掘通道"}{" "}
                                · {item.packetKey} · {item.artifactTypes.join(" / ")}
                              </li>
                            ))}
                          </ul>
                          {runtime.v21.debugger.swarmReadOnlyWorkerContract.packetConsumptionIntentState ===
                          "intent_recorded" ? (
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {english
                                ? `Selected lane ${runtime.v21.debugger.swarmReadOnlyWorkerContract.selectedWorkerKind ?? "none"} · ${runtime.v21.debugger.swarmReadOnlyWorkerContract.selectedPacketKey ?? "no-packet"}`
                                : `已选通道 ${
                                    runtime.v21.debugger.swarmReadOnlyWorkerContract.selectedWorkerKind ===
                                    "search"
                                      ? "搜索"
                                      : runtime.v21.debugger.swarmReadOnlyWorkerContract.selectedWorkerKind ===
                                          "grep"
                                        ? "检索"
                                        : runtime.v21.debugger.swarmReadOnlyWorkerContract.selectedWorkerKind ===
                                            "evidence_mining"
                                          ? "证据挖掘"
                                          : "未选择"
                                  } · ${runtime.v21.debugger.swarmReadOnlyWorkerContract.selectedPacketKey ?? "无预览包"}`}
                            </p>
                          ) : null}
                          {runtime.v21.debugger.swarmReadOnlyWorkerContract.placeholderBundleKey ? (
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {english
                                ? `Placeholder bundle ${runtime.v21.debugger.swarmReadOnlyWorkerContract.placeholderBundleKey} · ${runtime.v21.debugger.swarmReadOnlyWorkerContract.placeholderArtifactTypes.join(" / ")}`
                                : `占位产物包 ${runtime.v21.debugger.swarmReadOnlyWorkerContract.placeholderBundleKey} · ${runtime.v21.debugger.swarmReadOnlyWorkerContract.placeholderArtifactTypes.join(" / ")}`}
                            </p>
                          ) : null}
                          {runtime.v21.debugger.swarmReadOnlyWorkerContract.placeholderRecordedBy ? (
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {english
                                ? `Placeholder recorded by ${runtime.v21.debugger.swarmReadOnlyWorkerContract.placeholderRecordedBy}${runtime.v21.debugger.swarmReadOnlyWorkerContract.placeholderRecordSourcePage ? ` · ${runtime.v21.debugger.swarmReadOnlyWorkerContract.placeholderRecordSourcePage}` : ""}`
                                : `占位记录人 ${runtime.v21.debugger.swarmReadOnlyWorkerContract.placeholderRecordedBy}${runtime.v21.debugger.swarmReadOnlyWorkerContract.placeholderRecordSourcePage ? ` · ${runtime.v21.debugger.swarmReadOnlyWorkerContract.placeholderRecordSourcePage}` : ""}`}
                            </p>
                          ) : null}
                          {runtime.v21.debugger.swarmReadOnlyWorkerContract.executionCandidateContract
                            .materializationBundleKey ? (
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {english
                                ? `Materialization anchor ${runtime.v21.debugger.swarmReadOnlyWorkerContract.executionCandidateContract.materializationBundleKey} · ${runtime.v21.debugger.swarmReadOnlyWorkerContract.executionCandidateContract.materializationArtifactTypes.join(" / ")}`
                                : `物化锚点 ${runtime.v21.debugger.swarmReadOnlyWorkerContract.executionCandidateContract.materializationBundleKey} · ${runtime.v21.debugger.swarmReadOnlyWorkerContract.executionCandidateContract.materializationArtifactTypes.join(" / ")}`}
                            </p>
                          ) : null}
                          {runtime.v21.debugger.swarmReadOnlyWorkerContract.artifactMaterializedBy ? (
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {english
                                ? `Materialization recorded by ${runtime.v21.debugger.swarmReadOnlyWorkerContract.artifactMaterializedBy}${runtime.v21.debugger.swarmReadOnlyWorkerContract.artifactMaterializationSourcePage ? ` · ${runtime.v21.debugger.swarmReadOnlyWorkerContract.artifactMaterializationSourcePage}` : ""}`
                                : `物化记录人 ${runtime.v21.debugger.swarmReadOnlyWorkerContract.artifactMaterializedBy}${runtime.v21.debugger.swarmReadOnlyWorkerContract.artifactMaterializationSourcePage ? ` · ${runtime.v21.debugger.swarmReadOnlyWorkerContract.artifactMaterializationSourcePage}` : ""}`}
                            </p>
                          ) : null}
                          {runtime.v21.debugger.swarmSpawnContract.denySummary ? (
                            <p className="mt-2 text-xs leading-5 text-[color:var(--status-warning-text)]">
                              {runtime.v21.debugger.swarmSpawnContract.denySummary}
                            </p>
                          ) : null}
                          {runtime.v21.debugger.swarmSpawnContract.nextAction ? (
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.debugger.swarmSpawnContract.nextAction}
                            </p>
                          ) : null}
                          {runtime.v21.debugger.swarmSpawnContract.requestedBy ? (
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.debugger.swarmSpawnContract.requestedBy +
                                (runtime.v21.debugger.swarmSpawnContract.sourcePage
                                  ? ` · ${runtime.v21.debugger.swarmSpawnContract.sourcePage}`
                                  : "")}
                            </p>
                          ) : null}
                          {canManageRuntime &&
                          runtime.v21.debugger.swarmSpawnContract.state === "requestable" &&
                          runtime.v21.debugger.swarmSpawnContract.requestRecordState === "not_requested" ? (
                            <Button
                              variant="secondary"
                              className="mt-3"
                              data-testid="operator-debugger-request-swarm-spawn"
                              onClick={requestSwarmSpawn}
                              disabled={pending}
                            >
                              {english ? "Record swarm request" : "记录多代理派生请求"}
                            </Button>
                          ) : canManageRuntime &&
                            runtime.v21.debugger.swarmReadOnlyWorkerContract.packetConsumptionIntentState ===
                              "selection_required" ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {runtime.v21.debugger.swarmReadOnlyWorkerContract.allowlistedWorkers.map(
                                (workerKind) => (
                                  <Button
                                    key={workerKind}
                                    variant="secondary"
                                    onClick={() => recordSwarmWorkerIntent(workerKind)}
                                    disabled={pending}
                                  >
                                    {english
                                      ? `Select ${workerKind === "evidence_mining" ? "evidence" : workerKind}`
                                      : `选择${
                                          workerKind === "search"
                                            ? "搜索"
                                            : workerKind === "grep"
                                              ? "检索"
                                              : "证据挖掘"
                                        }通道`}
                                  </Button>
                                ),
                              )}
                            </div>
                          ) : canManageRuntime &&
                            runtime.v21.debugger.swarmVerificationMergeLaneContract.state ===
                              "recordable" ? (
                            <Button
                              variant="secondary"
                              className="mt-3"
                              onClick={recordSwarmVerificationMergeLane}
                              disabled={pending}
                            >
                              {english ? "Record verification merge lane" : "记录验证合流"}
                            </Button>
                          ) : canManageRuntime &&
                            runtime.v21.debugger.swarmReadOnlyWorkerContract.outputAdoptionRecordState ===
                              "recordable" ? (
                            <Button
                              variant="secondary"
                              className="mt-3"
                              onClick={recordSwarmAdoption}
                              disabled={pending}
                            >
                              {english ? "Record adoption slice" : "记录采纳切片"}
                            </Button>
                          ) : canManageRuntime &&
                            runtime.v21.debugger.swarmReadOnlyWorkerContract
                              .artifactMaterializationRecordState === "recordable" ? (
                            <Button
                              variant="secondary"
                              className="mt-3"
                              onClick={recordSwarmMaterialization}
                              disabled={pending}
                            >
                              {english ? "Record materialization slice" : "记录物化切片"}
                            </Button>
                          ) : canManageRuntime &&
                            runtime.v21.debugger.swarmReadOnlyWorkerContract.executionGuardContract
                              .state === "allowed" ? (
                            <Button
                              variant="secondary"
                              className="mt-3"
                              onClick={recordSwarmExecution}
                              disabled={pending}
                            >
                              {english ? "Record execution slice" : "记录执行切片"}
                            </Button>
                          ) : canManageRuntime &&
                            runtime.v21.debugger.swarmReadOnlyWorkerContract
                              .artifactBundlePlaceholderRecordState === "recordable" ? (
                            <Button
                              variant="secondary"
                              className="mt-3"
                              onClick={recordSwarmPlaceholder}
                              disabled={pending}
                            >
                              {english ? "Record placeholder bundle" : "记录占位产物包"}
                            </Button>
                          ) : null}
                        </div>
                        <div
                          className="rounded-2xl border border-[color:var(--border)] px-3 py-3"
                          data-testid="operator-debugger-recovery-action-contract"
                        >
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                            {english ? "recovery action lifecycle" : "恢复动作生命周期"}
                          </p>
                          <p className="mt-3 text-sm leading-6 text-[color:var(--foreground)]">
                            {runtime.v21.debugger.recoveryActionContract.summary}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {runtime.v21.debugger.recoveryActionContract.boundaryNote}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {[
                              runtime.v21.debugger.recoveryActionContract.state,
                              runtime.v21.debugger.recoveryActionContract.driver,
                              runtime.v21.debugger.recoveryActionContract.action,
                              runtime.v21.debugger.recoveryActionContract.checkpointKey,
                              runtime.v21.debugger.recoveryActionContract.latestRemediationExecutionStatus,
                              runtime.v21.debugger.recoveryActionContract.traceContractState,
                              runtime.v21.debugger.recoveryActionContract.writeContractState,
                              runtime.v21.debugger.recoveryActionContract.takeoverRequestState,
                              runtime.v21.debugger.recoveryActionContract.takeoverActivationState,
                              runtime.v21.debugger.recoveryActionContract.takeoverFollowThroughState,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          {runtime.v21.debugger.recoveryActionContract.nextAction ? (
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.debugger.recoveryActionContract.nextAction}
                            </p>
                          ) : null}
                        </div>
                        <div
                          className="rounded-2xl border border-[color:var(--border)] px-3 py-3"
                          data-testid="operator-debugger-recovery-lifecycle-contract"
                        >
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                            {english ? "recovery lifecycle lane" : "恢复生命周期泳道"}
                          </p>
                          <p className="mt-3 text-sm leading-6 text-[color:var(--foreground)]">
                            {runtime.v21.debugger.recoveryLifecycleContract.summary}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {runtime.v21.debugger.recoveryLifecycleContract.boundaryNote}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {[
                              runtime.v21.debugger.recoveryLifecycleContract.state,
                              runtime.v21.debugger.recoveryLifecycleContract.driver,
                              runtime.v21.debugger.recoveryLifecycleContract.anchor,
                              runtime.v21.debugger.recoveryLifecycleContract.action,
                              runtime.v21.debugger.recoveryLifecycleContract.checkpointKey,
                              runtime.v21.debugger.recoveryLifecycleContract.nextTransition,
                              runtime.v21.debugger.recoveryLifecycleContract.traceContractState,
                              runtime.v21.debugger.recoveryLifecycleContract.writeContractState,
                              runtime.v21.debugger.recoveryLifecycleContract.recoveryActionState,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          {runtime.v21.debugger.recoveryLifecycleContract.nextAction ? (
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.debugger.recoveryLifecycleContract.nextAction}
                            </p>
                          ) : null}
                        </div>
                        <div
                          className="rounded-2xl border border-[color:var(--border)] px-3 py-3"
                          data-testid="operator-debugger-recovery-transition-contract"
                        >
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                            {english ? "recovery transition contract" : "恢复流转契约"}
                          </p>
                          <p className="mt-3 text-sm leading-6 text-[color:var(--foreground)]">
                            {runtime.v21.debugger.recoveryTransitionContract.summary}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {runtime.v21.debugger.recoveryTransitionContract.boundaryNote}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {[
                              runtime.v21.debugger.recoveryTransitionContract.state,
                              runtime.v21.debugger.recoveryTransitionContract.driver,
                              runtime.v21.debugger.recoveryTransitionContract.anchor,
                              runtime.v21.debugger.recoveryTransitionContract.action,
                              runtime.v21.debugger.recoveryTransitionContract.checkpointKey,
                              runtime.v21.debugger.recoveryTransitionContract.transition,
                              runtime.v21.debugger.recoveryTransitionContract.recoveryLifecycleState,
                              runtime.v21.debugger.recoveryTransitionContract.recoveryActionState,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          {runtime.v21.debugger.recoveryTransitionContract.nextAction ? (
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.debugger.recoveryTransitionContract.nextAction}
                            </p>
                          ) : null}
                        </div>
                        <div
                          className="rounded-2xl border border-[color:var(--border)] px-3 py-3"
                          data-testid="operator-debugger-recovery-state-machine-contract"
                        >
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                            {english ? "recovery state machine" : "恢复状态机"}
                          </p>
                          <p className="mt-3 text-sm leading-6 text-[color:var(--foreground)]">
                            {runtime.v21.debugger.recoveryStateMachineContract.summary}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {runtime.v21.debugger.recoveryStateMachineContract.boundaryNote}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {[
                              runtime.v21.debugger.recoveryStateMachineContract.phase,
                              runtime.v21.debugger.recoveryStateMachineContract.transitionState,
                              runtime.v21.debugger.recoveryStateMachineContract.currentTransition,
                              runtime.v21.debugger.recoveryStateMachineContract.anchor,
                              runtime.v21.debugger.recoveryStateMachineContract.action,
                              runtime.v21.debugger.recoveryStateMachineContract.checkpointKey,
                              `allowed ${runtime.v21.debugger.recoveryStateMachineContract.allowedTransitions.join("/") || "none"}`,
                              `completed ${runtime.v21.debugger.recoveryStateMachineContract.completedTransitions.join("/") || "none"}`,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          {runtime.v21.debugger.recoveryStateMachineContract.nextAction ? (
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.debugger.recoveryStateMachineContract.nextAction}
                            </p>
                          ) : null}
                        </div>
                        <div
                          className="rounded-2xl border border-[color:var(--border)] px-3 py-3"
                          data-testid="operator-debugger-recovery-execution-contract"
                        >
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                            {english ? "recovery execution contract" : "恢复执行契约"}
                          </p>
                          <p className="mt-3 text-sm leading-6 text-[color:var(--foreground)]">
                            {runtime.v21.debugger.recoveryExecutionContract.summary}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {runtime.v21.debugger.recoveryExecutionContract.boundaryNote}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {[
                              runtime.v21.debugger.recoveryExecutionContract.state,
                              runtime.v21.debugger.recoveryExecutionContract.phase,
                              runtime.v21.debugger.recoveryExecutionContract.driver,
                              runtime.v21.debugger.recoveryExecutionContract.anchor,
                              runtime.v21.debugger.recoveryExecutionContract.action,
                              runtime.v21.debugger.recoveryExecutionContract.currentTransition,
                              runtime.v21.debugger.recoveryExecutionContract.transitionState,
                              runtime.v21.debugger.recoveryExecutionContract.checkpointKey,
                              runtime.v21.debugger.recoveryExecutionContract.resumeToken,
                              runtime.v21.debugger.recoveryExecutionContract.latestRemediationExecutionStatus,
                              `execute ${runtime.v21.debugger.recoveryExecutionContract.canExecute ? "yes" : "no"}`,
                              `review ${runtime.v21.debugger.recoveryExecutionContract.requiresReview ? "yes" : "no"}`,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          <ul className="mt-2 space-y-1 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {runtime.v21.debugger.recoveryExecutionContract.prerequisites.map((item, index) => (
                              <li key={`recovery-execution-prerequisite-${index}`}>- {item}</li>
                            ))}
                            {runtime.v21.debugger.recoveryExecutionContract.completionCriteria.map((item, index) => (
                              <li key={`recovery-execution-completion-${index}`}>- {item}</li>
                            ))}
                          </ul>
                          {runtime.v21.debugger.recoveryExecutionContract.nextAction ? (
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.debugger.recoveryExecutionContract.nextAction}
                            </p>
                          ) : null}
                        </div>
                        <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3" data-testid="operator-debugger-takeover-assistance">
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                            {english ? "operator takeover assistance" : "操作员接管辅助"}
                          </p>
                          <p className="mt-3 text-sm leading-6 text-[color:var(--foreground)]">{runtime.v21.debugger.takeoverAssistance.summary}</p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {runtime.v21.debugger.takeoverAssistance.boundaryNote}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {english ? "recommended action" : "推荐动作"} ·{" "}
                            {runtime.v21.debugger.takeoverAssistance.recommendedAction ?? "none"}
                          </p>
                          {takeoverRemediationHandoffReadout ? (
                            <div className="mt-2 space-y-1 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              <p>{takeoverRemediationHandoffReadout.compactSummary}</p>
                              <p>{takeoverRemediationHandoffReadout.lifecycleSummary}</p>
                              {takeoverRemediationHandoffReadout.remediationSummary ? (
                                <p>{takeoverRemediationHandoffReadout.remediationSummary}</p>
                              ) : null}
                              {takeoverRemediationHandoffReadout.provenanceSummary ? (
                                <p>{takeoverRemediationHandoffReadout.provenanceSummary}</p>
                              ) : null}
                            </div>
                          ) : null}
                          <div className="mt-3 rounded-2xl border border-[color:var(--border)]/80 bg-[color:var(--surface-subtle)]/70 px-3 py-3" data-testid="operator-debugger-takeover-request">
                            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                              {english ? "takeover request" : "接管请求"}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">{debuggerView?.takeoverRequest.summary ?? runtime.v21.debugger.takeoverRequest.summary}</p>
                              <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                                {[
                                takeoverRequestState,
                                debuggerView?.takeoverRequest.action ?? runtime.v21.debugger.takeoverRequest.action,
                                debuggerView?.takeoverRequest.checkpointKey ?? runtime.v21.debugger.takeoverRequest.checkpointKey,
                                (debuggerView?.takeoverRequest.acknowledgedAt ?? runtime.v21.debugger.takeoverRequest.acknowledgedAt)
                                  ? formatDateLabel(debuggerView?.takeoverRequest.acknowledgedAt ?? runtime.v21.debugger.takeoverRequest.acknowledgedAt)
                                  : null,
                                (debuggerView?.takeoverRequest.requestedAt ?? runtime.v21.debugger.takeoverRequest.requestedAt)
                                  ? formatDateLabel(debuggerView?.takeoverRequest.requestedAt ?? runtime.v21.debugger.takeoverRequest.requestedAt)
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">{debuggerView?.takeoverRequest.boundaryNote ?? runtime.v21.debugger.takeoverRequest.boundaryNote}</p>
                            <div
                              className="mt-3 rounded-2xl border border-[color:var(--border)]/80 bg-white px-3 py-3"
                              data-testid="operator-debugger-takeover-activation"
                            >
                              <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                                {english ? "takeover activation" : "接管激活"}
                              </p>
                              <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                                {takeoverActivationSummary}
                              </p>
                              <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                                {[
                                  takeoverActivationState,
                                  debuggerView?.takeoverActivation.latestEventKind ?? runtime.v21.debugger.takeoverActivation.latestEventKind,
                                  debuggerView?.takeoverActivation.action ?? runtime.v21.debugger.takeoverActivation.action,
                                  debuggerView?.takeoverActivation.checkpointKey ?? runtime.v21.debugger.takeoverActivation.checkpointKey,
                                  debuggerView?.takeoverActivation.currentOwner ?? runtime.v21.debugger.takeoverActivation.currentOwner,
                                  (debuggerView?.takeoverActivation.releasedAt ?? runtime.v21.debugger.takeoverActivation.releasedAt)
                                    ? formatDateLabel(debuggerView?.takeoverActivation.releasedAt ?? runtime.v21.debugger.takeoverActivation.releasedAt)
                                    : (debuggerView?.takeoverActivation.startedAt ?? runtime.v21.debugger.takeoverActivation.startedAt)
                                      ? formatDateLabel(debuggerView?.takeoverActivation.startedAt ?? runtime.v21.debugger.takeoverActivation.startedAt)
                                      : null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                              <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                                {debuggerView?.takeoverActivation.boundaryNote ?? runtime.v21.debugger.takeoverActivation.boundaryNote}
                              </p>
                              {runtime.v21.debugger.takeoverActivation.releaseReason ? (
                                <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                                  {english ? "release reason" : "释放原因"} ·{" "}
                                  {runtime.v21.debugger.takeoverActivation.releaseReason}
                                </p>
                              ) : null}
                              {runtime.v21.debugger.takeoverActivation.releasedBy ? (
                                <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                                  {[
                                    runtime.v21.debugger.takeoverActivation.releasedBy,
                                    runtime.v21.debugger.takeoverActivation.sourcePage,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                  </p>
                              ) : null}
                              <div
                                className="mt-3 rounded-2xl border border-[color:var(--border)]/80 bg-[color:var(--surface-subtle)]/70 px-3 py-3"
                                data-testid="operator-debugger-takeover-followthrough"
                              >
                                <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                                  {english ? "takeover follow-through" : "接管跟进闭环"}
                                </p>
                                <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                                  {runtime.v21.debugger.takeoverFollowThrough.summary}
                                </p>
                                <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                                  {[
                                    runtime.v21.debugger.takeoverFollowThrough.state,
                                    runtime.v21.debugger.takeoverFollowThrough.action,
                                    runtime.v21.debugger.takeoverFollowThrough.checkpointKey,
                                    runtime.v21.debugger.takeoverFollowThrough.resolvedAt
                                      ? formatDateLabel(runtime.v21.debugger.takeoverFollowThrough.resolvedAt)
                                      : runtime.v21.debugger.takeoverFollowThrough.requestedAt
                                        ? formatDateLabel(runtime.v21.debugger.takeoverFollowThrough.requestedAt)
                                        : null,
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </p>
                                {runtime.v21.debugger.takeoverFollowThrough.nextAction ? (
                                  <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                                    {english ? "next action" : "下一动作"} ·{" "}
                                    {runtime.v21.debugger.takeoverFollowThrough.nextAction}
                                  </p>
                                ) : null}
                                <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                                  {runtime.v21.debugger.takeoverFollowThrough.boundaryNote}
                                </p>
                                {(runtime.v21.debugger.takeoverFollowThrough.resolvedBy ??
                                  runtime.v21.debugger.takeoverFollowThrough.requestedBy) ? (
                                  <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                                    {[
                                      runtime.v21.debugger.takeoverFollowThrough.resolvedBy ??
                                        runtime.v21.debugger.takeoverFollowThrough.requestedBy,
                                      runtime.v21.debugger.takeoverFollowThrough.sourcePage,
                                    ]
                                      .filter(Boolean)
                                      .join(" · ")}
                                  </p>
                                ) : null}
                                {canManageRuntime &&
                                runtime.v21.debugger.takeoverFollowThrough.state === "requestable" ? (
                                  <Button
                                    variant="secondary"
                                    className="mt-3"
                                    data-testid="operator-debugger-request-takeover-followthrough"
                                    onClick={requestOperatorTakeoverFollowThrough}
                                  >
                                    {english
                                      ? "Request closeout"
                                      : "请求 closeout"}
                                  </Button>
                                ) : null}
                                {canManageRuntime &&
                                runtime.v21.debugger.takeoverFollowThrough.state === "open" ? (
                                  <Button
                                    variant="secondary"
                                    className="mt-3"
                                    data-testid="operator-debugger-resolve-takeover-followthrough"
                                    onClick={resolveOperatorTakeoverFollowThrough}
                                  >
                                    {english
                                      ? "Resolve closeout"
                                      : "解决 closeout"}
                                  </Button>
                                ) : null}
                              </div>
                            </div>
                            {(debuggerView?.takeoverRequest.requestedBy ?? runtime.v21.debugger.takeoverRequest.requestedBy) ? (
                              <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                                {((debuggerView?.takeoverRequest.acknowledgedBy ??
                                  debuggerView?.takeoverRequest.requestedBy ??
                                  runtime.v21.debugger.takeoverRequest.acknowledgedBy ??
                                  runtime.v21.debugger.takeoverRequest.requestedBy) ?? "") +
                                  ((debuggerView?.takeoverRequest.sourcePage ??
                                    runtime.v21.debugger.takeoverRequest.sourcePage)
                                  ? ` · ${debuggerView?.takeoverRequest.sourcePage ?? runtime.v21.debugger.takeoverRequest.sourcePage}`
                                  : "")}
                              </p>
                            ) : null}
                            {canManageRuntime &&
                            (takeoverRequestState === "requestable" ||
                              takeoverPendingAction === "request") ? (
                              <Button
                                variant="secondary"
                                className="mt-3"
                                data-testid="operator-debugger-request-takeover"
                                onClick={requestOperatorTakeover}
                                disabled={pending && takeoverPendingAction === "request"}
                              >
                                {english ? "Request takeover" : "请求接管"}
                              </Button>
                            ) : null}
                            {canManageRuntime &&
                            (takeoverRequestState === "requested" ||
                              takeoverPendingAction === "acknowledge") ? (
                              <Button
                                variant="secondary"
                                className="mt-3"
                                data-testid="operator-debugger-acknowledge-takeover"
                                onClick={acknowledgeOperatorTakeover}
                                disabled={pending && takeoverPendingAction === "acknowledge"}
                              >
                                {english ? "Acknowledge takeover" : "确认接管"}
                              </Button>
                            ) : null}
                            {canManageRuntime &&
                            ((takeoverRequestState === "acknowledged" &&
                              takeoverActivationState === "inactive") ||
                              takeoverPendingAction === "start") ? (
                              <Button
                                variant="secondary"
                                className="mt-3"
                                data-testid="operator-debugger-start-takeover"
                                onClick={startOperatorTakeover}
                                disabled={pending && takeoverPendingAction === "start"}
                              >
                                {english ? "Start takeover" : "启动接管"}
                              </Button>
                            ) : null}
                            {canManageRuntime &&
                            (takeoverActivationState === "active" ||
                              takeoverPendingAction === "release") ? (
                              <Button
                                variant="secondary"
                                className="mt-3"
                                data-testid="operator-debugger-release-takeover"
                                onClick={releaseOperatorTakeover}
                                disabled={pending && takeoverPendingAction === "release"}
                              >
                                {english ? "Release takeover" : "释放接管"}
                              </Button>
                            ) : null}
                          </div>
                          <ul className="mt-3 space-y-2 text-sm text-[color:var(--muted)]">
                            {runtime.v21.debugger.takeoverAssistance.checklist.map((item) => (
                              <li key={item}>- {item}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3" data-testid="operator-debugger-interrupt-reason">
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                            {english ? "interrupt reason" : "中断原因"}
                          </p>
                          <p className="mt-3 text-sm leading-6 text-[color:var(--foreground)]">{runtime.v21.debugger.interruptReason.summary}</p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {[
                              runtime.v21.debugger.interruptReason.state,
                              runtime.v21.debugger.interruptReason.code,
                              runtime.v21.debugger.interruptReason.source,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">{runtime.v21.debugger.interruptReason.boundaryNote}</p>
                        </div>
                        <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3" data-testid="operator-debugger-resume-ask">
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                            {english ? "resume ask" : "恢复请求"}
                          </p>
                          <p className="mt-3 text-sm leading-6 text-[color:var(--foreground)]">{runtime.v21.debugger.resumeAsk.prompt}</p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {[
                              runtime.v21.debugger.resumeAsk.mode,
                              runtime.v21.debugger.resumeAsk.checkpointKey,
                              runtime.v21.debugger.resumeAsk.resumeToken,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">{runtime.v21.debugger.resumeAsk.boundaryNote}</p>
                        </div>
                        <div
                          className="rounded-2xl border border-[color:var(--border)] px-3 py-3"
                          data-testid="run-thread-settlement-flow"
                        >
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                            {english ? "variable snapshot" : "变量快照"}
                          </p>
                          <ul className="mt-3 space-y-2 text-sm text-[color:var(--muted)]">
                            {runtime.v21.debugger.variableSnapshot.map((item) => (
                              <li key={item.key}>
                                - <span className="font-medium text-[color:var(--foreground)]">{item.key}</span> · {item.value}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                            {english ? "request posture" : "请求姿态"}
                          </p>
                          <p
                            className="mt-3 text-sm leading-6 text-[color:var(--foreground)]"
                            data-testid="run-thread-request-posture"
                          >
                            {requestPostureSummary}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {[
                              english ? `takeover ${requestPostureTakeoverState}` : `接管 ${requestPostureTakeoverState}`,
                              english ? `human input ${requestPostureHumanInputState}` : `人工输入 ${requestPostureHumanInputState}`,
                              english
                                ? `${runThreadView?.requestPosture.activeRequestCount ?? runtime.v21.runThread.requestPosture.activeRequestCount} active`
                                : `${runThreadView?.requestPosture.activeRequestCount ?? runtime.v21.runThread.requestPosture.activeRequestCount} 个活跃请求`,
                              english
                                ? `${runThreadView?.requestPosture.acknowledgedRequestCount ?? runtime.v21.runThread.requestPosture.acknowledgedRequestCount} acknowledged`
                                : `${runThreadView?.requestPosture.acknowledgedRequestCount ?? runtime.v21.runThread.requestPosture.acknowledgedRequestCount} 个已确认请求`,
                              runThreadView?.requestPosture.latestLifecycleKind ?? runtime.v21.runThread.requestPosture.latestLifecycleKind,
                              (runThreadView?.requestPosture.latestAcknowledgedAt ?? runtime.v21.runThread.requestPosture.latestAcknowledgedAt)
                                ? formatDateLabel(runThreadView?.requestPosture.latestAcknowledgedAt ?? runtime.v21.runThread.requestPosture.latestAcknowledgedAt)
                                : (runThreadView?.requestPosture.latestRequestedAt ?? runtime.v21.runThread.requestPosture.latestRequestedAt)
                                  ? formatDateLabel(runThreadView?.requestPosture.latestRequestedAt ?? runtime.v21.runThread.requestPosture.latestRequestedAt)
                                  : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {runThreadView?.requestPosture.boundaryNote ?? runtime.v21.runThread.requestPosture.boundaryNote}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                            {english ? "result acknowledgement" : "结果确认"}
                          </p>
                          <p className="mt-3 text-sm leading-6 text-[color:var(--foreground)]">
                            {runtime.v21.runThread.resultAcknowledgement.summary}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {[
                              runtime.v21.runThread.resultAcknowledgement.state,
                              runtime.v21.runThread.resultAcknowledgement.source,
                              runtime.v21.runThread.resultAcknowledgement.referenceId,
                              runtime.v21.runThread.resultAcknowledgement.updatedAt
                                ? formatDateLabel(runtime.v21.runThread.resultAcknowledgement.updatedAt)
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {runtime.v21.runThread.resultAcknowledgement.boundaryNote}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                            {english ? "result flow" : "结果流"}
                          </p>
                          <p
                            className="mt-3 text-sm leading-6 text-[color:var(--foreground)]"
                            data-testid="run-thread-result-flow"
                          >
                            {runtime.v21.runThread.resultFlow.summary}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {[
                              english
                                ? `${runtime.v21.runThread.resultFlow.trackedSourceCount} tracked`
                                : `${runtime.v21.runThread.resultFlow.trackedSourceCount} 个已追踪源头`,
                              english
                                ? `${runtime.v21.runThread.resultFlow.requiresOperatorAttentionCount} attention`
                                : `${runtime.v21.runThread.resultFlow.requiresOperatorAttentionCount} 个需要关注`,
                              english
                                ? `${runtime.v21.runThread.resultFlow.resolvedCount} resolved`
                                : `${runtime.v21.runThread.resultFlow.resolvedCount} 个已解决`,
                              runtime.v21.runThread.resultFlow.latestSource,
                              runtime.v21.runThread.resultFlow.latestState,
                              runtime.v21.runThread.resultFlow.latestUpdatedAt
                                ? formatDateLabel(runtime.v21.runThread.resultFlow.latestUpdatedAt)
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {[
                              english
                                ? `${runtime.v21.runThread.resultFlow.counts.pending} pending`
                                : `${runtime.v21.runThread.resultFlow.counts.pending} 待处理`,
                              english
                                ? `${runtime.v21.runThread.resultFlow.counts.acknowledged} acknowledged`
                                : `${runtime.v21.runThread.resultFlow.counts.acknowledged} 已确认`,
                              english
                                ? `${runtime.v21.runThread.resultFlow.counts.failed} failed`
                                : `${runtime.v21.runThread.resultFlow.counts.failed} 失败`,
                              english
                                ? `${runtime.v21.runThread.resultFlow.counts.blocked} blocked`
                                : `${runtime.v21.runThread.resultFlow.counts.blocked} 已阻断`,
                              english
                                ? `${runtime.v21.runThread.resultFlow.counts.deferred} deferred`
                                : `${runtime.v21.runThread.resultFlow.counts.deferred} 已延后`,
                              english
                                ? `${runtime.v21.runThread.resultFlow.counts.followThroughOpen} follow-through open`
                                : `${runtime.v21.runThread.resultFlow.counts.followThroughOpen} 跟进未完成`,
                              english
                                ? `${runtime.v21.runThread.resultFlow.counts.followThroughResolved} follow-through resolved`
                                : `${runtime.v21.runThread.resultFlow.counts.followThroughResolved} 跟进已解决`,
                            ].join(" · ")}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {runtime.v21.runThread.resultFlow.boundaryNote}
                          </p>
                          <ul className="mt-3 space-y-2 text-sm text-[color:var(--muted)]">
                            {runtime.v21.runThread.resultFlow.sourceEntries.map((item) => (
                              <li key={item.referenceId}>
                                <p className="font-medium text-[color:var(--foreground)]">
                                  {item.source} · {item.state}
                                </p>
                                <p className="mt-1 leading-6">{item.summary}</p>
                                <p className="mt-1 text-xs leading-5 text-[color:var(--muted-foreground)]">
                                  {[item.referenceId, formatDateLabel(item.updatedAt)].join(" · ")}
                                </p>
                              </li>
                            ))}
                            {!runtime.v21.runThread.resultFlow.sourceEntries.length ? (
                              <li>
                                -{" "}
                                {english
                                  ? "No downstream result flow is visible on this thread yet."
                                  : "当前这条线程还没有可见的下游结果流。"}
                              </li>
                            ) : null}
                          </ul>
                        </div>
                        <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                            {english ? "forward flow" : "推进流"}
                          </p>
                          <p className="mt-3 text-sm leading-6 text-[color:var(--foreground)]">
                            {runtime.v21.runThread.forwardFlow.summary}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {[
                              runtime.v21.runThread.forwardFlow.state,
                              english
                                ? `${runtime.v21.runThread.forwardFlow.attentionCount} attention`
                                : `${runtime.v21.runThread.forwardFlow.attentionCount} 个关注项`,
                              runtime.v21.runThread.forwardFlow.currentOwner,
                              runtime.v21.runThread.forwardFlow.checkpointKey,
                              runtime.v21.runThread.forwardFlow.latestLifecycleKind,
                              runtime.v21.runThread.forwardFlow.latestUpdatedAt
                                ? formatDateLabel(runtime.v21.runThread.forwardFlow.latestUpdatedAt)
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {runtime.v21.runThread.forwardFlow.nextAction ??
                              (english ? "No open next action." : "当前没有未完成的下一动作。")}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {runtime.v21.runThread.forwardFlow.boundaryNote}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                            {english ? "closeout flow" : "收口流"}
                          </p>
                          <p className="mt-3 text-sm leading-6 text-[color:var(--foreground)]">
                            {runtime.v21.runThread.closeoutFlow.summary}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {[
                              runtime.v21.runThread.closeoutFlow.state,
                              english
                                ? `${runtime.v21.runThread.closeoutFlow.openCount} open`
                                : `${runtime.v21.runThread.closeoutFlow.openCount} 未完成`,
                              english
                                ? `${runtime.v21.runThread.closeoutFlow.resolvedCount} resolved`
                                : `${runtime.v21.runThread.closeoutFlow.resolvedCount} 已解决`,
                              runtime.v21.runThread.closeoutFlow.latestSource,
                              runtime.v21.runThread.closeoutFlow.currentOwner,
                              runtime.v21.runThread.closeoutFlow.checkpointKey,
                              runtime.v21.runThread.closeoutFlow.latestUpdatedAt
                                ? formatDateLabel(runtime.v21.runThread.closeoutFlow.latestUpdatedAt)
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {runtime.v21.runThread.closeoutFlow.nextAction ??
                              (english ? "No open closeout action." : "当前没有未完成的收口动作。")}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {runtime.v21.runThread.closeoutFlow.boundaryNote}
                          </p>
                          <ul className="mt-3 space-y-2 text-sm text-[color:var(--muted)]">
                            {runtime.v21.runThread.closeoutFlow.sourceEntries.map((item) => (
                              <li key={item.referenceId}>
                                <p className="font-medium text-[color:var(--foreground)]">
                                  {item.source} · {item.state}
                                </p>
                                <p className="mt-1 leading-6">{item.summary}</p>
                                <p className="mt-1 text-xs leading-5 text-[color:var(--muted-foreground)]">
                                  {[
                                    item.actorName,
                                    item.checkpointKey,
                                    item.referenceId,
                                    formatDateLabel(item.updatedAt),
                                  ]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </p>
                              </li>
                            ))}
                            {!runtime.v21.runThread.closeoutFlow.sourceEntries.length ? (
                              <li>
                                -{" "}
                                {english
                                  ? "No thread-level closeout source is visible on this thread yet."
                                  : "当前这条线程还没有可见的线程级收口源头。"}
                              </li>
                            ) : null}
                          </ul>
                        </div>
                        <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                            {english ? "settlement flow" : "结算流"}
                          </p>
                          <p className="mt-3 text-sm leading-6 text-[color:var(--foreground)]">
                            {runtime.v21.runThread.settlementFlow.summary}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {[
                              runtime.v21.runThread.settlementFlow.state,
                              runtime.v21.runThread.settlementFlow.driver,
                              english
                                ? `${runtime.v21.runThread.settlementFlow.forwardAttentionCount} forward attention`
                                : `${runtime.v21.runThread.settlementFlow.forwardAttentionCount} 个推进关注项`,
                              english
                                ? `${runtime.v21.runThread.settlementFlow.openCloseoutCount} closeout open`
                                : `${runtime.v21.runThread.settlementFlow.openCloseoutCount} 个收口未完成`,
                              english
                                ? `${runtime.v21.runThread.settlementFlow.resolvedCloseoutCount} closeout resolved`
                                : `${runtime.v21.runThread.settlementFlow.resolvedCloseoutCount} 个收口已解决`,
                              runtime.v21.runThread.settlementFlow.currentOwner,
                              runtime.v21.runThread.settlementFlow.checkpointKey,
                              runtime.v21.runThread.settlementFlow.latestUpdatedAt
                                ? formatDateLabel(runtime.v21.runThread.settlementFlow.latestUpdatedAt)
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {runtime.v21.runThread.settlementFlow.nextAction ??
                              (english ? "No open settlement action." : "当前没有未完成的结算动作。")}
                          </p>
                          {closeSettlementHandoffReadout ? (
                            <div
                              className="mt-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3"
                              data-testid="run-thread-close-settlement-handoff"
                            >
                              <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                                {english
                                  ? "close / settlement handoff"
	                                  : "收口 / 结算交接"}
                              </p>
                              <div className="mt-2 space-y-1 text-xs leading-5 text-[color:var(--muted-foreground)]">
                                <p>{closeSettlementHandoffReadout.compactSummary}</p>
                                <p>{closeSettlementHandoffReadout.settlementSummary}</p>
                                <p>{closeSettlementHandoffReadout.closeoutSummary}</p>
                                <p>{closeSettlementHandoffReadout.closeRequestSummary}</p>
                                {closeSettlementHandoffReadout.provenanceSummary ? (
                                  <p>{closeSettlementHandoffReadout.provenanceSummary}</p>
                                ) : null}
                              </div>
                            </div>
                          ) : null}
                          <div
                            className="mt-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3"
                            data-testid="run-thread-closeout-summary"
                          >
                            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
	                              {english ? "closeout summary" : "收口摘要"}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                              {runtime.v21.runThread.closeoutSummary.summary}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {[
                                runtime.v21.runThread.closeoutSummary.state,
                                runtime.v21.runThread.closeoutSummary.driver,
                                runtime.v21.runThread.closeoutSummary.checkpointKey,
                                runtime.v21.runThread.closeoutSummary.currentOwner,
                                runtime.v21.runThread.closeoutSummary.latestUpdatedAt
                                  ? formatDateLabel(runtime.v21.runThread.closeoutSummary.latestUpdatedAt)
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.runThread.closeoutSummary.nextAction ??
	                                (english ? "No explicit closeout summary action is attached to this thread yet." : "当前这条线程还没有明确的收口摘要动作。")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.runThread.closeoutSummary.boundaryNote}
                            </p>
                          </div>
                          <div
                            className="mt-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3"
                            data-testid="run-thread-closeout-resolution"
                          >
                            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
	                              {english ? "closeout resolution" : "收口解决"}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                              {runtime.v21.runThread.closeoutResolution.summary}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {[
                                runtime.v21.runThread.closeoutResolution.state,
                                runtime.v21.runThread.closeoutResolution.decision,
                                runtime.v21.runThread.closeoutResolution.checkpointKey,
                                runtime.v21.runThread.closeoutResolution.resolvedBy,
                                runtime.v21.runThread.closeoutResolution.resolvedAt
                                  ? formatDateLabel(runtime.v21.runThread.closeoutResolution.resolvedAt)
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.runThread.closeoutResolution.nextAction ??
	                                (english ? "No explicit closeout resolution is attached to this thread yet." : "当前这条线程还没有明确的收口解决记录。")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.runThread.closeoutResolution.boundaryNote}
                            </p>
                            {canManageRuntime &&
                            runtime.v21.runThread.closeoutResolution.state ===
                              "decision_required" ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={pending}
                                  data-testid="run-thread-record-closeout-close"
                                  onClick={() => recordCloseoutResolution("close_thread")}
                                >
	                                  {english ? "Record close decision" : "记录关闭决议"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={pending}
                                  data-testid="run-thread-record-closeout-keep-open"
                                  onClick={() => recordCloseoutResolution("keep_open")}
                                >
	                                  {english ? "Record keep-open decision" : "记录保持开启决议"}
                                </Button>
                              </div>
                            ) : null}
                          </div>
                          <div
                            className="mt-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3"
                            data-testid="run-thread-closeout-resolution-followthrough"
                          >
                            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                              {english
                                ? "closeout resolution follow-through"
	                                : "收口解决跟进闭环"}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                              {runtime.v21.runThread.closeoutResolutionFollowThrough.summary}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {[
                                runtime.v21.runThread.closeoutResolutionFollowThrough.state,
                                runtime.v21.runThread.closeoutResolutionFollowThrough.decision,
                                runtime.v21.runThread.closeoutResolutionFollowThrough.checkpointKey,
                                runtime.v21.runThread.closeoutResolutionFollowThrough.resolvedBy ??
                                  runtime.v21.runThread.closeoutResolutionFollowThrough.requestedBy,
                                runtime.v21.runThread.closeoutResolutionFollowThrough.resolvedAt
                                  ? formatDateLabel(
                                      runtime.v21.runThread.closeoutResolutionFollowThrough.resolvedAt,
                                    )
                                  : runtime.v21.runThread.closeoutResolutionFollowThrough.requestedAt
                                    ? formatDateLabel(
                                        runtime.v21.runThread.closeoutResolutionFollowThrough.requestedAt,
                                      )
                                    : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.runThread.closeoutResolutionFollowThrough.nextAction ??
                                "No explicit closeout resolution follow-through is attached to this thread yet."}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.runThread.closeoutResolutionFollowThrough.boundaryNote}
                            </p>
                            {canManageRuntime &&
                            (runtime.v21.runThread.closeoutResolutionFollowThrough.state ===
                              "requestable" ||
                              (runtime.v21.runThread.closeoutResolutionFollowThrough.state ===
                                "stale" &&
                                (runtime.v21.runThread.closeoutResolution.state ===
                                  "close_recorded" ||
                                  runtime.v21.runThread.closeoutResolution.state ===
                                    "keep_open_recorded"))) ? (
                              <Button
                                className="mt-3"
                                size="sm"
                                variant="secondary"
                                disabled={pending}
                                data-testid="run-thread-request-closeout-resolution-followthrough"
                                onClick={() => requestCloseoutResolutionFollowThrough()}
                              >
                                {runtime.v21.runThread.closeoutResolutionFollowThrough.state ===
                                "stale"
                                  ? english
                                    ? "Re-request closeout follow-through"
                                    : "重新请求 closeout 跟进闭环"
                                  : english
                                    ? "Request closeout follow-through"
                                    : "请求 closeout 跟进闭环"}
                              </Button>
                            ) : null}
                            {canManageRuntime &&
                            runtime.v21.runThread.closeoutResolutionFollowThrough.state ===
                              "open" ? (
                              <Button
                                className="mt-3"
                                size="sm"
                                variant="secondary"
                                disabled={pending}
                                data-testid="run-thread-resolve-closeout-resolution-followthrough"
                                onClick={() => resolveCloseoutResolutionFollowThrough()}
                              >
                                {english
                                  ? "Resolve closeout follow-through"
                                  : "解决 closeout 跟进闭环"}
                              </Button>
                            ) : null}
                          </div>
                          <div
                            className="mt-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3"
                            data-testid="run-thread-closeout-outcome"
                          >
                            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
	                              {english ? "closeout outcome" : "收口结果"}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                              {runtime.v21.runThread.closeoutOutcome.summary}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {[
                                runtime.v21.runThread.closeoutOutcome.state,
                                runtime.v21.runThread.closeoutOutcome.decision,
                                runtime.v21.runThread.closeoutOutcome.checkpointKey,
                                runtime.v21.runThread.closeoutOutcome.currentOwner,
                                runtime.v21.runThread.closeoutOutcome.latestUpdatedAt
                                  ? formatDateLabel(runtime.v21.runThread.closeoutOutcome.latestUpdatedAt)
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.runThread.closeoutOutcome.nextAction ??
	                                (english ? "No explicit closeout outcome is attached to this thread yet." : "当前这条线程还没有明确的收口结果。")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.runThread.closeoutOutcome.boundaryNote}
                            </p>
                          </div>
                          <div
                            className="mt-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3"
                            data-testid="run-thread-close-request"
                            id="run-thread-close-request"
                          >
                            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
	                              {english ? "close request" : "关闭请求"}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                              {runtime.v21.runThread.closeRequest.summary}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {[
                                runtime.v21.runThread.closeRequest.state,
                                runtime.v21.runThread.closeRequest.checkpointKey,
                                runtime.v21.runThread.closeRequest.requestedBy,
                                runtime.v21.runThread.closeRequest.resolvedAt
                                  ? formatDateLabel(runtime.v21.runThread.closeRequest.resolvedAt)
                                  : runtime.v21.runThread.closeRequest.requestedAt
                                    ? formatDateLabel(runtime.v21.runThread.closeRequest.requestedAt)
                                    : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.runThread.closeRequest.nextAction ??
	                                (english ? "No explicit close request is attached to this thread yet." : "当前这条线程还没有明确的关闭请求。")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.runThread.closeRequest.boundaryNote}
                            </p>
                            {canManageRuntime &&
                            (runtime.v21.runThread.closeRequest.state === "requestable" ||
                              runtime.v21.runThread.closeRequest.state === "stale") ? (
                              <Button
                                className="mt-3"
                                size="sm"
                                variant="secondary"
                                disabled={pending}
                                data-testid="run-thread-request-close"
                                onClick={() => requestRuntimeClose()}
                              >
                                {runtime.v21.runThread.closeRequest.state === "stale"
                                  ? english
                                    ? "Re-request thread close"
	                                    : "重新请求关闭线程"
                                  : english
                                    ? "Request thread close"
	                                    : "请求关闭线程"}
                              </Button>
                            ) : null}
                          </div>
                          <div
                            className="mt-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3"
                            data-testid="run-thread-close-lifecycle"
                          >
                            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
	                              {english ? "close lifecycle" : "关闭生命周期"}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                              {runtime.v21.runThread.closeLifecycle.summary}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {[
                                runtime.v21.runThread.closeLifecycle.state,
                                runtime.v21.runThread.closeLifecycle.driver,
                                runtime.v21.runThread.closeLifecycle.decision,
                                runtime.v21.runThread.closeLifecycle.checkpointKey,
                                runtime.v21.runThread.closeLifecycle.currentOwner,
                                runtime.v21.runThread.closeLifecycle.latestUpdatedAt
                                  ? formatDateLabel(runtime.v21.runThread.closeLifecycle.latestUpdatedAt)
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.runThread.closeLifecycle.nextAction ??
	                                (english ? "No explicit close lifecycle summary is attached to this thread yet." : "当前这条线程还没有明确的关闭生命周期摘要。")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.runThread.closeLifecycle.boundaryNote}
                            </p>
                          </div>
                          <div
                            className="mt-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3"
                            data-testid="run-thread-close-control"
                          >
                            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
	                              {english ? "close control" : "关闭控制"}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                              {runtime.v21.runThread.closeControl.summary}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {[
                                runtime.v21.runThread.closeControl.state,
                                runtime.v21.runThread.closeControl.driver,
                                runtime.v21.runThread.closeControl.decision,
                                runtime.v21.runThread.closeControl.checkpointKey,
                                runtime.v21.runThread.closeControl.currentOwner,
                                runtime.v21.runThread.closeControl.latestUpdatedAt
                                  ? formatDateLabel(runtime.v21.runThread.closeControl.latestUpdatedAt)
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.runThread.closeControl.nextAction ??
	                                (english ? "No explicit close control summary is attached to this thread yet." : "当前这条线程还没有明确的关闭控制摘要。")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.runThread.closeControl.boundaryNote}
                            </p>
                          </div>
                          <div
                            className="mt-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3"
                            data-testid="run-thread-close-control-flow"
                          >
                            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
	                              {english ? "close control flow" : "关闭控制流"}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                              {runtime.v21.runThread.closeControlFlow.summary}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {[
                                runtime.v21.runThread.closeControlFlow.state,
                                runtime.v21.runThread.closeControlFlow.driver,
                                runtime.v21.runThread.closeControlFlow.decision,
                                runtime.v21.runThread.closeControlFlow.forwardState,
                                runtime.v21.runThread.closeControlFlow.settlementState,
                                runtime.v21.runThread.closeControlFlow.checkpointKey,
                                runtime.v21.runThread.closeControlFlow.currentOwner,
                                runtime.v21.runThread.closeControlFlow.latestUpdatedAt
                                  ? formatDateLabel(runtime.v21.runThread.closeControlFlow.latestUpdatedAt)
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
	                              {english
	                                ? `${runtime.v21.runThread.closeControlFlow.forwardAttentionCount} forward attention · ${runtime.v21.runThread.closeControlFlow.openCloseoutCount} closeout open`
	                                : `${runtime.v21.runThread.closeControlFlow.forwardAttentionCount} 个推进关注项 · ${runtime.v21.runThread.closeControlFlow.openCloseoutCount} 个收口未完成`}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.runThread.closeControlFlow.nextAction ??
	                                (english ? "No explicit close control flow summary is attached to this thread yet." : "当前这条线程还没有明确的关闭控制流摘要。")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.runThread.closeControlFlow.boundaryNote}
                            </p>
                          </div>
                          <div
                            className="mt-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3"
                            data-testid="run-thread-close-decision-flow"
                          >
                            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
	                              {english ? "close decision flow" : "关闭决策流"}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                              {runtime.v21.runThread.closeDecisionFlow.summary}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {[
                                runtime.v21.runThread.closeDecisionFlow.state,
                                runtime.v21.runThread.closeDecisionFlow.driver,
                                runtime.v21.runThread.closeDecisionFlow.decision,
                                runtime.v21.runThread.closeDecisionFlow.controlState,
                                runtime.v21.runThread.closeDecisionFlow.outcomeState,
                                runtime.v21.runThread.closeDecisionFlow.closeRequestState,
                                runtime.v21.runThread.closeDecisionFlow.checkpointKey,
                                runtime.v21.runThread.closeDecisionFlow.currentOwner,
                                runtime.v21.runThread.closeDecisionFlow.latestUpdatedAt
                                  ? formatDateLabel(runtime.v21.runThread.closeDecisionFlow.latestUpdatedAt)
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.runThread.closeDecisionFlow.nextAction ??
	                                (english ? "No explicit close decision flow summary is attached to this thread yet." : "当前这条线程还没有明确的关闭决策流摘要。")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.runThread.closeDecisionFlow.boundaryNote}
                            </p>
                          </div>
                          <div
                            className="mt-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3"
                            data-testid="run-thread-close-decision-control-summary"
                          >
                            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                              {english
                                ? "close decision control"
	                                : "关闭决策控制"}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                              {runtime.v21.runThread.closeDecisionControlSummary.summary}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {[
                                runtime.v21.runThread.closeDecisionControlSummary.state,
                                runtime.v21.runThread.closeDecisionControlSummary.driver,
                                runtime.v21.runThread.closeDecisionControlSummary.decision,
                                runtime.v21.runThread.closeDecisionControlSummary.decisionState,
                                runtime.v21.runThread.closeDecisionControlSummary.controlState,
                                runtime.v21.runThread.closeDecisionControlSummary.lifecycleState,
                                runtime.v21.runThread.closeDecisionControlSummary.forwardState,
                                runtime.v21.runThread.closeDecisionControlSummary.settlementState,
                                runtime.v21.runThread.closeDecisionControlSummary.checkpointKey,
                                runtime.v21.runThread.closeDecisionControlSummary.currentOwner,
                                runtime.v21.runThread.closeDecisionControlSummary.latestUpdatedAt
                                  ? formatDateLabel(
                                      runtime.v21.runThread.closeDecisionControlSummary
                                        .latestUpdatedAt,
                                    )
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.runThread.closeDecisionControlSummary.nextAction ??
	                                (english ? "No explicit close decision control summary is attached to this thread yet." : "当前这条线程还没有明确的关闭决策控制摘要。")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.runThread.closeDecisionControlSummary.boundaryNote}
                            </p>
                          </div>
                          <div
                            className="mt-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3"
                            data-testid="run-thread-close-resolution-summary"
                          >
                            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
	                              {english ? "close resolution" : "关闭解决"}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                              {runtime.v21.runThread.closeResolutionSummary.summary}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {[
                                runtime.v21.runThread.closeResolutionSummary.state,
                                runtime.v21.runThread.closeResolutionSummary.driver,
                                runtime.v21.runThread.closeResolutionSummary.decision,
                                runtime.v21.runThread.closeResolutionSummary.decisionControlState,
                                runtime.v21.runThread.closeResolutionSummary.lifecycleState,
                                runtime.v21.runThread.closeResolutionSummary.closeRequestState,
                                runtime.v21.runThread.closeResolutionSummary.checkpointKey,
                                runtime.v21.runThread.closeResolutionSummary.currentOwner,
                                runtime.v21.runThread.closeResolutionSummary.latestUpdatedAt
                                  ? formatDateLabel(
                                      runtime.v21.runThread.closeResolutionSummary.latestUpdatedAt,
                                    )
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.runThread.closeResolutionSummary.nextAction ??
	                                (english ? "No explicit close resolution summary is attached to this thread yet." : "当前这条线程还没有明确的关闭解决摘要。")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.runThread.closeResolutionSummary.boundaryNote}
                            </p>
                          </div>
                          <div
                            className="mt-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3"
                            data-testid="run-thread-close-resolution-forward-summary"
                          >
                            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                              {english
                                ? "close resolution forward"
	                                : "关闭解决推进"}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                              {runtime.v21.runThread.closeResolutionForwardSummary.summary}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {[
                                runtime.v21.runThread.closeResolutionForwardSummary.state,
                                runtime.v21.runThread.closeResolutionForwardSummary.driver,
                                runtime.v21.runThread.closeResolutionForwardSummary.decision,
                                runtime.v21.runThread.closeResolutionForwardSummary.resolutionState,
                                runtime.v21.runThread.closeResolutionForwardSummary.decisionControlState,
                                runtime.v21.runThread.closeResolutionForwardSummary.settlementState,
                                runtime.v21.runThread.closeResolutionForwardSummary.forwardState,
                                runtime.v21.runThread.closeResolutionForwardSummary.checkpointKey,
                                runtime.v21.runThread.closeResolutionForwardSummary.currentOwner,
                                runtime.v21.runThread.closeResolutionForwardSummary.latestUpdatedAt
                                  ? formatDateLabel(
                                      runtime.v21.runThread.closeResolutionForwardSummary
                                        .latestUpdatedAt,
                                    )
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
	                              {english
	                                ? `${runtime.v21.runThread.closeResolutionForwardSummary.forwardAttentionCount} forward attention · ${runtime.v21.runThread.closeResolutionForwardSummary.openCloseoutCount} closeout open`
	                                : `${runtime.v21.runThread.closeResolutionForwardSummary.forwardAttentionCount} 个推进关注项 · ${runtime.v21.runThread.closeResolutionForwardSummary.openCloseoutCount} 个收口未完成`}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.runThread.closeResolutionForwardSummary.nextAction ??
	                                (english ? "No explicit close resolution forward summary is attached to this thread yet." : "当前这条线程还没有明确的关闭解决推进摘要。")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.runThread.closeResolutionForwardSummary.boundaryNote}
                            </p>
                          </div>
                          <div
                            className="mt-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3"
                            data-testid="run-thread-close-resolution-control-summary"
                          >
                            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                              {english
                                ? "close resolution control"
	                                : "关闭解决控制"}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                              {runtime.v21.runThread.closeResolutionControlSummary.summary}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {[
                                runtime.v21.runThread.closeResolutionControlSummary.state,
                                runtime.v21.runThread.closeResolutionControlSummary.driver,
                                runtime.v21.runThread.closeResolutionControlSummary.decision,
                                runtime.v21.runThread.closeResolutionControlSummary.resolutionState,
                                runtime.v21.runThread.closeResolutionControlSummary.forwardState,
                                runtime.v21.runThread.closeResolutionControlSummary.lifecycleState,
                                runtime.v21.runThread.closeResolutionControlSummary.closeRequestState,
                                runtime.v21.runThread.closeResolutionControlSummary.checkpointKey,
                                runtime.v21.runThread.closeResolutionControlSummary.currentOwner,
                                runtime.v21.runThread.closeResolutionControlSummary.latestUpdatedAt
                                  ? formatDateLabel(
                                      runtime.v21.runThread.closeResolutionControlSummary
                                        .latestUpdatedAt,
                                    )
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.runThread.closeResolutionControlSummary.nextAction ??
	                                (english ? "No explicit close resolution control summary is attached to this thread yet." : "当前这条线程还没有明确的关闭解决控制摘要。")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.runThread.closeResolutionControlSummary.boundaryNote}
                            </p>
                          </div>
                          <div
                            className="mt-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3"
                            data-testid="run-thread-close-posture-summary"
                          >
                            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
	                              {english ? "close posture" : "关闭姿态"}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                              {runtime.v21.runThread.closePostureSummary.summary}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {[
                                runtime.v21.runThread.closePostureSummary.state,
                                runtime.v21.runThread.closePostureSummary.driver,
                                runtime.v21.runThread.closePostureSummary.decision,
                                runtime.v21.runThread.closePostureSummary.resolutionControlState,
                                runtime.v21.runThread.closePostureSummary.resolutionForwardState,
                                runtime.v21.runThread.closePostureSummary.lifecycleState,
                                runtime.v21.runThread.closePostureSummary.closeRequestState,
                                runtime.v21.runThread.closePostureSummary.checkpointKey,
                                runtime.v21.runThread.closePostureSummary.currentOwner,
                                runtime.v21.runThread.closePostureSummary.latestUpdatedAt
                                  ? formatDateLabel(
                                      runtime.v21.runThread.closePostureSummary.latestUpdatedAt,
                                    )
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.runThread.closePostureSummary.nextAction ??
	                                (english ? "No explicit close posture summary is attached to this thread yet." : "当前这条线程还没有明确的关闭姿态摘要。")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.runThread.closePostureSummary.boundaryNote}
                            </p>
                          </div>
                          <div
                            className="mt-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3"
                            data-testid="run-thread-close-posture-forward-summary"
                          >
                            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
	                              {english ? "close posture forward" : "关闭姿态推进"}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                              {runtime.v21.runThread.closePostureForwardSummary.summary}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {[
                                runtime.v21.runThread.closePostureForwardSummary.state,
                                runtime.v21.runThread.closePostureForwardSummary.driver,
                                runtime.v21.runThread.closePostureForwardSummary.decision,
                                runtime.v21.runThread.closePostureForwardSummary.postureState,
                                runtime.v21.runThread.closePostureForwardSummary.resolutionForwardState,
                                runtime.v21.runThread.closePostureForwardSummary.settlementState,
                                runtime.v21.runThread.closePostureForwardSummary.forwardState,
                                runtime.v21.runThread.closePostureForwardSummary.closeRequestState,
                                runtime.v21.runThread.closePostureForwardSummary.checkpointKey,
                                runtime.v21.runThread.closePostureForwardSummary.currentOwner,
                                runtime.v21.runThread.closePostureForwardSummary.latestUpdatedAt
                                  ? formatDateLabel(
                                      runtime.v21.runThread.closePostureForwardSummary
                                        .latestUpdatedAt,
                                    )
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
	                              {english
	                                ? `${runtime.v21.runThread.closePostureForwardSummary.forwardAttentionCount} forward attention · ${runtime.v21.runThread.closePostureForwardSummary.openCloseoutCount} closeout open`
	                                : `${runtime.v21.runThread.closePostureForwardSummary.forwardAttentionCount} 个推进关注项 · ${runtime.v21.runThread.closePostureForwardSummary.openCloseoutCount} 个收口未完成`}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.runThread.closePostureForwardSummary.nextAction ??
	                                (english ? "No explicit close posture forward summary is attached to this thread yet." : "当前这条线程还没有明确的关闭姿态推进摘要。")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.runThread.closePostureForwardSummary.boundaryNote}
                            </p>
                          </div>
                          <div
                            className="mt-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3"
                            data-testid="run-thread-settlement-review"
                            id="run-thread-settlement-review"
                          >
                            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
	                              {english ? "settlement review" : "结算复核"}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                              {runtime.v21.runThread.settlementReview.summary}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {[
                                runtime.v21.runThread.settlementReview.state,
                                runtime.v21.runThread.settlementReview.checkpointKey,
                                runtime.v21.runThread.settlementReview.requestedBy,
                                runtime.v21.runThread.settlementReview.resolvedBy,
                                runtime.v21.runThread.settlementReview.resolvedAt
                                  ? formatDateLabel(runtime.v21.runThread.settlementReview.resolvedAt)
                                  : runtime.v21.runThread.settlementReview.requestedAt
                                    ? formatDateLabel(runtime.v21.runThread.settlementReview.requestedAt)
                                    : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.runThread.settlementReview.nextAction ??
	                                (english ? "No explicit settlement review is attached to this thread yet." : "当前这条线程还没有明确的结算复核。")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.runThread.settlementReview.boundaryNote}
                            </p>
                            {canManageRuntime &&
                            runtime.v21.runThread.settlementReview.state === "requestable" ? (
                              <Button
                                className="mt-3"
                                size="sm"
                                variant="secondary"
                                disabled={pending}
                                data-testid="run-thread-request-settlement-review"
                                onClick={() => requestSettlementReview()}
                              >
	                                {english ? "Request settlement review" : "请求结算复核"}
                              </Button>
                            ) : null}
                            {canManageRuntime &&
                            runtime.v21.runThread.settlementReview.state === "requested" ? (
                              <Button
                                className="mt-3"
                                size="sm"
                                variant="secondary"
                                disabled={pending}
                                data-testid="run-thread-resolve-settlement-review"
                                onClick={() => resolveSettlementReview()}
                              >
	                                {english ? "Resolve settlement review" : "解决结算复核"}
                              </Button>
                            ) : null}
                          </div>
                          <div
                            className="mt-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3"
                            data-testid="run-thread-closeout-confirmation"
                            id="run-thread-closeout-confirmation"
                          >
                            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
	                              {english ? "closeout confirmation" : "收口确认"}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                              {runtime.v21.runThread.closeoutConfirmation.summary}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {[
                                runtime.v21.runThread.closeoutConfirmation.state,
                                runtime.v21.runThread.closeoutConfirmation.checkpointKey,
                                runtime.v21.runThread.closeoutConfirmation.confirmedBy,
                                runtime.v21.runThread.closeoutConfirmation.confirmedAt
                                  ? formatDateLabel(runtime.v21.runThread.closeoutConfirmation.confirmedAt)
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.runThread.closeoutConfirmation.nextAction ??
	                                (english ? "No explicit closeout confirmation is attached to this thread yet." : "当前这条线程还没有明确的收口确认。")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.runThread.closeoutConfirmation.boundaryNote}
                            </p>
                            {canManageRuntime &&
                            (runtime.v21.runThread.closeoutConfirmation.state === "confirmable" ||
                              runtime.v21.runThread.closeoutConfirmation.state === "stale") ? (
                              <Button
                                className="mt-3"
                                size="sm"
                                variant="secondary"
                                disabled={pending}
                                data-testid="run-thread-confirm-closeout"
                                onClick={() => confirmCloseout()}
                              >
                                {runtime.v21.runThread.closeoutConfirmation.state === "stale"
                                  ? english
                                    ? "Reconfirm closeout"
	                                    : "重新确认收口"
                                  : english
                                    ? "Confirm closeout"
	                                    : "确认收口"}
                              </Button>
                            ) : null}
                          </div>
                          <div
                            className="mt-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3"
                            data-testid="run-thread-closeout-refresh"
                            id="run-thread-closeout-refresh"
                          >
                            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
	                              {english ? "closeout refresh" : "收口刷新"}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                              {runtime.v21.runThread.closeoutRefresh.summary}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {[
                                runtime.v21.runThread.closeoutRefresh.state,
                                runtime.v21.runThread.closeoutRefresh.checkpointKey,
                                runtime.v21.runThread.closeoutRefresh.requestedBy,
                                runtime.v21.runThread.closeoutRefresh.requestedAt
                                  ? formatDateLabel(runtime.v21.runThread.closeoutRefresh.requestedAt)
                                  : runtime.v21.runThread.closeoutRefresh.resolvedAt
                                    ? formatDateLabel(runtime.v21.runThread.closeoutRefresh.resolvedAt)
                                    : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.runThread.closeoutRefresh.nextAction ??
	                                (english ? "No explicit closeout refresh is attached to this thread yet." : "当前这条线程还没有明确的收口刷新。")}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.runThread.closeoutRefresh.boundaryNote}
                            </p>
                            {canManageRuntime &&
                            runtime.v21.runThread.closeoutRefresh.state === "requestable" ? (
                              <Button
                                className="mt-3"
                                size="sm"
                                variant="secondary"
                                disabled={pending}
                                data-testid="run-thread-request-closeout-refresh"
                                onClick={() => requestCloseoutRefresh()}
                              >
	                                {english ? "Request closeout refresh" : "请求收口刷新"}
                              </Button>
                            ) : null}
                          </div>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {runtime.v21.runThread.settlementFlow.boundaryNote}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                            {english ? "run thread lifecycle" : "运行线程生命周期"}
                          </p>
                          <ul className="mt-3 space-y-3 text-sm text-[color:var(--muted)]">
                            {runtime.v21.runThread.lifecycleLog.map((item) => (
                              <li key={item.id}>
                                <p className="font-medium text-[color:var(--foreground)]">{item.label}</p>
                                <p className="mt-1 leading-6">{item.summary}</p>
                                <p className="mt-1 text-xs leading-5 text-[color:var(--muted-foreground)]">
                                  {[item.kind, item.source, item.checkpointKey, formatDateLabel(item.timestamp)]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </p>
                              </li>
                            ))}
                            {!runtime.v21.runThread.lifecycleLog.length ? (
                              <li>- {english ? "No run thread lifecycle note yet." : "当前还没有运行线程生命周期备注。"}</li>
                            ) : null}
                          </ul>
                        </div>
                        <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                            {english ? "trace history" : "追踪历史"}
                          </p>
                          <ul className="mt-3 space-y-3 text-sm text-[color:var(--muted)]">
                            {runtime.v21.debugger.history.map((item) => (
                              <li key={item.id}>
                                <p className="font-medium text-[color:var(--foreground)]">{item.label}</p>
                                <p className="mt-1 leading-6">{item.summary}</p>
                                <p className="mt-1 text-xs leading-5 text-[color:var(--muted-foreground)]">
                                  {[item.kind, item.source, item.checkpointKey, formatDateLabel(item.timestamp)]
                                    .filter(Boolean)
                                    .join(" · ")}
                                </p>
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3" data-testid="operator-debugger-handoff-payload">
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                            {english ? "handoff payload" : "交接载荷"}
                          </p>
                          <p className="mt-3 text-sm leading-6 text-[color:var(--foreground)]">{runtime.v21.debugger.handoffPayload.summary}</p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {[
                              runtime.v21.debugger.handoffPayload.state,
                              runtime.v21.debugger.handoffPayload.fromAgent,
                              runtime.v21.debugger.handoffPayload.toAgent,
                              runtime.v21.debugger.handoffPayload.checkpointKey,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">{runtime.v21.debugger.handoffPayload.boundaryNote}</p>
                        </div>
                      </div>
                      <div className="mt-3 rounded-2xl border border-[color:var(--border)]/80 px-3 py-3" data-testid="operator-debugger-human-input-checkpoint">
                        <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                          {english ? "human input checkpoint" : "人工输入检查点"}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">{runtime.v21.debugger.humanInputCheckpoint.summary}</p>
                        <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                          {[
                            runtime.v21.debugger.humanInputCheckpoint.state,
                            runtime.v21.debugger.humanInputCheckpoint.checkpointKey,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">{runtime.v21.debugger.humanInputCheckpoint.boundaryNote}</p>
                        <div className="mt-3 rounded-2xl border border-[color:var(--border)]/80 bg-[color:var(--surface-subtle)]/70 px-3 py-3" data-testid="operator-debugger-human-input-request">
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                            {english ? "human input request" : "人工输入请求"}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">{runtime.v21.debugger.humanInputRequest.summary}</p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {[
                              humanInputRequestState,
                              runtime.v21.debugger.humanInputRequest.checkpointKey,
                              runtime.v21.debugger.humanInputRequest.acknowledgedAt
                                ? formatDateLabel(runtime.v21.debugger.humanInputRequest.acknowledgedAt)
                                : null,
                              runtime.v21.debugger.humanInputRequest.requestedAt
                                ? formatDateLabel(runtime.v21.debugger.humanInputRequest.requestedAt)
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">{runtime.v21.debugger.humanInputRequest.prompt}</p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">{runtime.v21.debugger.humanInputRequest.boundaryNote}</p>
                          {runtime.v21.debugger.humanInputRequest.requestedBy ? (
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {(runtime.v21.debugger.humanInputRequest.acknowledgedBy ??
                                runtime.v21.debugger.humanInputRequest.requestedBy) +
                                (runtime.v21.debugger.humanInputRequest.sourcePage
                                ? ` · ${runtime.v21.debugger.humanInputRequest.sourcePage}`
                                : "")}
                            </p>
                          ) : null}
                          {canManageRuntime && humanInputRequestState === "requestable" ? (
                            <Button
                              variant="secondary"
                              className="mt-3"
                              data-testid="operator-debugger-request-human-input"
                              onClick={requestHumanInputCheckpoint}
                            >
	                              {english ? "Request human input" : "请求人工输入"}
                            </Button>
                          ) : null}
                          {canManageRuntime && humanInputRequestState === "requested" ? (
                            <Button
                              variant="secondary"
                              className="mt-3"
                              data-testid="operator-debugger-acknowledge-human-input"
                              onClick={acknowledgeHumanInputCheckpoint}
                            >
	                              {english ? "Acknowledge human input" : "确认人工输入"}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="theme-surface-panel rounded-2xl px-4 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Reflection queue" : "反思队列"}</p>
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
                          ? `${runtime.v21.reflection.activeJobs} active reflection jobs in this session`
	                          : `当前会话有 ${runtime.v21.reflection.activeJobs} 个活跃反思作业`}
                      </p>
                      <div className="mt-3 space-y-3">
                        {runtime.v21.reflection.recentJobs.map((job) => (
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
                        {!runtime.v21.reflection.recentJobs.length ? (
                          <p className="text-sm text-[color:var(--muted-foreground)]">
                            {english ? "No reflection job yet." : "当前还没有反思 job。"}
                          </p>
                        ) : null}
                      </div>
                      <div className="mt-4 space-y-3">
                        <p className="text-sm font-semibold text-[color:var(--foreground)]">
	                          {english ? "Reflection carry-forward" : "反思延续"}
                        </p>
                        {runtime.v21.reflection.recentCandidates.map((candidate) => (
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
                        {!runtime.v21.reflection.recentCandidates.length ? (
                          <p className="text-sm text-[color:var(--muted-foreground)]">
                            {english
	                              ? "No reflection carry-forward candidate yet."
	                              : "当前还没有反思 延续 候选。"}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="theme-surface-panel rounded-2xl px-4 py-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Consolidation queue" : "整合队列"}</p>
                        {canManageRuntime ? (
                          <Button variant="secondary" onClick={queueConsolidation} disabled={pending}>
                            {english ? "Queue manual consolidation" : "加入人工整合队列"}
                          </Button>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">
                        {runtime.v21.consolidation.auditSummary.summary}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-[color:var(--muted-foreground)]">
                        {runtime.v21.consolidation.auditSummary.rollbackSummary}
                      </p>
                      <p className="mt-3 text-sm text-[color:var(--muted-foreground)]">
                        {english
                          ? `${runtime.v21.consolidation.activeJobs} active jobs in this session`
	                          : `当前会话有 ${runtime.v21.consolidation.activeJobs} 个活跃作业`}
                      </p>
                      <div className="mt-3 space-y-3">
                        {runtime.v21.consolidation.recentJobs.map((job) => (
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
                            {runtime.v21 ? (
                              <p className="mt-2 text-xs leading-6 text-[color:var(--muted-foreground)]">
                                {runtime.v21.consolidation.auditSummary.boundaryNote}
                              </p>
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
                        {!runtime.v21.consolidation.recentJobs.length ? (
                          <p className="text-sm text-[color:var(--muted-foreground)]">
                            {english ? "No consolidation job yet." : "当前还没有 整合 job。"}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </>
        ) : (
          <div className="theme-surface-panel rounded-2xl px-4 py-5 text-sm leading-6 text-[color:var(--muted)]">
            {english
              ? "This meeting has not entered the Helm v2 runtime yet. Starting the runtime will create RuntimeEvent, WorkerRun, ArtifactBundle, MemoryItem, ApprovalRequest and ArtifactReview records."
              : "当前会议还没有进入 Helm v2 运行时。启动后会创建 RuntimeEvent、WorkerRun、ArtifactBundle、MemoryItem、ApprovalRequest 和 Artifact复核 记录。"}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
