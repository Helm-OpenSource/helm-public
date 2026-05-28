"use client";

import { useState, useTransition } from "react";
import { RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useWorkspaceUi } from "@/components/providers/workspace-ui-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { MeetingV2RuntimeActionPackPanel } from "@/features/meetings/meeting-v2-runtime-action-pack-panel";
import { MeetingV2RuntimeContinuityReadout } from "@/features/meetings/meeting-v2-runtime-continuity-readout";
import { formatMeetingDisplayText } from "@/features/meetings/display-copy";
import { MeetingV2RuntimePromotionPanel } from "@/features/meetings/meeting-v2-runtime-promotion-panel";
import { MeetingV2RuntimeQueuesPanel } from "@/features/meetings/meeting-v2-runtime-queues-panel";
import { MeetingV2RuntimeReviewPanel } from "@/features/meetings/meeting-v2-runtime-review-panel";
import {
  formatContinuityPostureToast,
  renderRuntimeStatusLabel,
  renderStatusVariant,
  type MeetingV2RuntimeContinuityRemediationAction,
  type MeetingV2RuntimeContinuityRemediationPreview,
  type MeetingV2RuntimeReviewPayload,
} from "@/features/meetings/meeting-v2-runtime-shared";

type MeetingV2RuntimeCardProps = {
  meetingId: string;
  runtime: MeetingRuntimeSummary | null;
  canManageRuntime: boolean;
  canReviewRuntime: boolean;
};

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
  const [continuityRemediationPreview, setContinuityRemediationPreview] =
    useState<MeetingV2RuntimeContinuityRemediationPreview | null>(null);
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
  }: MeetingV2RuntimeReviewPayload) => {
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
              : "会议事实已保留为 draft"
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
        toast.error(result.error ?? (english ? "Consolidation queue failed" : "整合 入队失败"));
        return;
      }
      toast.success(english ? "Consolidation job queued" : "整合 job 已加入队列");
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
      toast.success(english ? "Reflection job queued" : "反思 job 已加入队列");
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
      toast.success(english ? "Reflection 延续 candidate accepted" : "已接受反思延续候选");
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
      toast.success(english ? "Reflection 延续 candidate dismissed" : "已忽略反思延续候选");
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
        toast.error(result.error ?? (english ? "Consolidation update failed" : "整合 更新失败"));
        return;
      }
      toast.success(
        mode === "pause"
          ? english
            ? "Consolidation job paused"
            : "整合 job 已暂停"
          : english
            ? "Consolidation job resumed"
            : "整合 job 已恢复排队",
      );
      router.refresh();
    });
  };

  const runContinuityRemediation = (action: MeetingV2RuntimeContinuityRemediationAction) => {
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
          toast.error(result.error ?? (english ? "Operator takeover request failed" : "操作员接管 请求失败"));
          return;
        }

        toast.success(
          result.reused
            ? english
              ? "Operator takeover request already recorded"
              : "操作员接管请求 已存在"
            : english
              ? "Operator takeover request recorded"
              : "操作员接管请求 已记录",
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
                <MeetingV2RuntimeActionPackPanel runtime={runtime} english={english} text={text} />

                {runtime.v21 ? (
                  <MeetingV2RuntimeContinuityReadout
                    runtime={runtime}
                    english={english}
                    text={text}
                    continuityRemediationPreview={continuityRemediationPreview}
                    onRunContinuityRemediation={runContinuityRemediation}
                  />
                ) : null}
              </div>

              <div className="min-w-0 space-y-4">
                <MeetingV2RuntimeReviewPanel
                  meetingId={meetingId}
                  runtime={runtime}
                  english={english}
                  pending={pending}
                  canReview={Boolean(canReview)}
                  text={text}
                  onSubmit={submitReview}
                />

                <MeetingV2RuntimePromotionPanel runtime={runtime} english={english} />

                {runtime.v21 ? (
                  <>
                    <div className="theme-surface-panel rounded-2xl px-4 py-4">
                      <p className="text-sm font-semibold text-[color:var(--foreground)]">{english ? "Problem spaces and edge briefs" : "问题空间s 与 edge摘要s"}</p>
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
                          <p className="text-sm text-[color:var(--muted-foreground)]">{english ? "No problem space yet." : "当前还没有 问题空间。"}</p>
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
                          <p className="text-sm text-[color:var(--muted-foreground)]">{english ? "No edge brief yet." : "当前还没有 edge摘要。"}</p>
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
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "traced items" : "traced items"}</p>
                          <p className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">{runtime.v21.coordinationTrace.items.length}</p>
                        </div>
                        <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "human execution" : "human execution"}</p>
                          <p className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">{runtime.v21.coordinationTrace.humanExecution.total}</p>
                          <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                            {english
                              ? `${runtime.v21.coordinationTrace.humanExecution.executed} executed · ${runtime.v21.coordinationTrace.humanExecution.blocked} blocked`
                              : `${runtime.v21.coordinationTrace.humanExecution.executed} executed · ${runtime.v21.coordinationTrace.humanExecution.blocked} blocked`}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                            {english ? "official follow-through" : "official follow-through"}
                          </p>
                          <p className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">{runtime.v21.coordinationTrace.officialFollowThrough.total}</p>
                          <p className="mt-1 text-xs text-[color:var(--muted-foreground)]">
                            {english
                              ? `${runtime.v21.coordinationTrace.officialFollowThrough.open} open · ${runtime.v21.coordinationTrace.officialFollowThrough.resolved} resolved`
                              : `${runtime.v21.coordinationTrace.officialFollowThrough.open} open · ${runtime.v21.coordinationTrace.officialFollowThrough.resolved} resolved`}
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
                            {english ? "benchmark matrix" : "benchmark matrix"}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-[color:var(--foreground)]">
                            {runtime.v21.benchmarkMatrix.workflow.summary}
                          </p>
                          <ul className="mt-2 space-y-2 text-sm text-[color:var(--muted)]">
                            <li>
                              - workflow · {runtime.v21.benchmarkMatrix.workflow.state} ·{" "}
                              {runtime.v21.benchmarkMatrix.workflow.pendingRequestCount}{" "}
                              {english ? "pending request(s)" : "pending request(s)"} ·{" "}
                              {runtime.v21.benchmarkMatrix.workflow.acknowledgedRunCount}{" "}
                              {english ? "acknowledged run(s)" : "acknowledged run(s)"}
                            </li>
                            <li>
                              - request · {runtime.v21.benchmarkMatrix.workflow.request.state} ·{" "}
                              {runtime.v21.benchmarkMatrix.workflow.request.requestKey ?? "none"}
                              {runtime.v21.benchmarkMatrix.workflow.request.requestedAt
                                ? ` · ${formatDateLabel(runtime.v21.benchmarkMatrix.workflow.request.requestedAt)}`
                                : ""}
                            </li>
                            <li>
                              - latest run · {runtime.v21.benchmarkMatrix.workflow.latestRun.state} ·{" "}
                              {runtime.v21.benchmarkMatrix.workflow.latestRun.runLabel ??
                                runtime.v21.benchmarkMatrix.workflow.latestRun.benchmarkRunId ??
                                "none"}
                              {runtime.v21.benchmarkMatrix.workflow.latestRun.recordedAt
                                ? ` · ${formatDateLabel(runtime.v21.benchmarkMatrix.workflow.latestRun.recordedAt)}`
                                : ""}
                            </li>
                            <li>
                              - 已确认 · {runtime.v21.benchmarkMatrix.workflow.acknowledgement.state} ·{" "}
                              {runtime.v21.benchmarkMatrix.workflow.acknowledgement.acknowledgedBy ?? "none"}
                              {runtime.v21.benchmarkMatrix.workflow.acknowledgement.acknowledgedAt
                                ? ` · ${formatDateLabel(runtime.v21.benchmarkMatrix.workflow.acknowledgement.acknowledgedAt)}`
                                : ""}
                            </li>
                            <li>
                              - follow-through · {runtime.v21.benchmarkMatrix.workflow.followThrough.state} ·{" "}
                              {runtime.v21.benchmarkMatrix.workflow.followThrough.nextAction ??
                                runtime.v21.benchmarkMatrix.workflow.followThrough.resolvedBy ??
                                "none"}
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
                                {english ? "gate(s)" : "gate(s)"}
                                {item.latestRecordedAt ? ` · ${formatDateLabel(item.latestRecordedAt)}` : ""}
                              </li>
                            ))}
                            {!runtime.v21.benchmarkMatrix.layers.length ? (
                              <li>- {english ? "No benchmark gate yet." : "当前还没有 benchmark闸口。"}</li>
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
                        {english ? "Handoff and coordination telemetry" : "交接与协同 telemetry"}
                      </p>
                      <div className="mt-3 grid gap-4 md:grid-cols-2">
                        <div>
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "handoff packets" : "handoff packets"}</p>
                          <ul className="mt-2 space-y-2 text-sm text-[color:var(--muted)]">
                            {runtime.v21.handoffPackets.map((item) => (
                              <li key={item.id}>- {item.fromAgent} {"->"} {item.toAgent} · {item.goal}</li>
                            ))}
                            {!runtime.v21.handoffPackets.length ? <li>- {english ? "No handoff packet yet." : "当前还没有交接 资料et。"}</li> : null}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "initiative runs" : "initiative runs"}</p>
                          <ul className="mt-2 space-y-2 text-sm text-[color:var(--muted)]">
                            {runtime.v21.initiativeRuns.map((item) => (
                              <li key={item.id}>- {item.status} · {item.title} · {item.targetOutcome}</li>
                            ))}
                            {!runtime.v21.initiativeRuns.length ? <li>- {english ? "No initiative run yet." : "当前还没有 主动跑动。"}</li> : null}
                          </ul>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3 md:grid-cols-5">
                        <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "action ready" : "action ready"}</p>
                          <p className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">{runtime.v21.coordinationMetrics.actionReady}</p>
                        </div>
                        <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "review needed" : "review needed"}</p>
                          <p className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">{runtime.v21.coordinationMetrics.reviewNeeded}</p>
                        </div>
                        <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "waiting on signal" : "waiting on signal"}</p>
                          <p className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">{runtime.v21.coordinationMetrics.waitingOnSignal}</p>
                        </div>
                        <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "waiting on authority" : "waiting on authority"}</p>
                          <p className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">{runtime.v21.coordinationMetrics.waitingOnAuthority}</p>
                        </div>
                        <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">{english ? "capability gap" : "capability gap"}</p>
                          <p className="mt-2 text-lg font-semibold text-[color:var(--foreground)]">{runtime.v21.coordinationMetrics.capabilityGap}</p>
                        </div>
                      </div>
                    </div>

                    <div className="theme-surface-panel rounded-2xl px-4 py-4">
                      <p className="text-sm font-semibold text-[color:var(--foreground)]">
                        {english ? "Operator debugger spine" : "operator debugger spine"}
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
                            {english ? "replay + resume assistance" : "replay + resume assistance"}
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
                            {english ? "persisted lifecycle trace" : "persisted lifecycle trace"}
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
                            {english ? "replay / recovery write contract" : "replay / recovery write contract"}
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
                            {english ? "recovery action lifecycle" : "recovery action lifecycle"}
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
                            {english ? "recovery lifecycle lane" : "recovery lifecycle lane"}
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
                            {english ? "recovery transition contract" : "recovery transition contract"}
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
                            {english ? "recovery state machine" : "recovery state machine"}
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
                            {english ? "recovery execution contract" : "recovery execution contract"}
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
                            {english ? "operator takeover assistance" : "operator takeover assistance"}
                          </p>
                          <p className="mt-3 text-sm leading-6 text-[color:var(--foreground)]">{runtime.v21.debugger.takeoverAssistance.summary}</p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {runtime.v21.debugger.takeoverAssistance.boundaryNote}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {english ? "recommended action" : "recommended action"} ·{" "}
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
                              {english ? "takeover request" : "takeover request"}
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
                                {english ? "takeover activation" : "takeover activation"}
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
                                  {english ? "release reason" : "release reason"} ·{" "}
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
                                  {english ? "takeover follow-through" : "takeover follow-through"}
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
                                    {english ? "next action" : "next action"} ·{" "}
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
                            {english ? "interrupt reason" : "interrupt reason"}
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
                            {english ? "resume ask" : "resume ask"}
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
                            {english ? "variable snapshot" : "variable snapshot"}
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
                            {english ? "request posture" : "request posture"}
                          </p>
                          <p
                            className="mt-3 text-sm leading-6 text-[color:var(--foreground)]"
                            data-testid="run-thread-request-posture"
                          >
                            {requestPostureSummary}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {[
                              `takeover ${requestPostureTakeoverState}`,
                              `human input ${requestPostureHumanInputState}`,
                              `${runThreadView?.requestPosture.activeRequestCount ?? runtime.v21.runThread.requestPosture.activeRequestCount} active`,
                              `${runThreadView?.requestPosture.acknowledgedRequestCount ?? runtime.v21.runThread.requestPosture.acknowledgedRequestCount} acknowledged`,
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
                            {english ? "result 已确认" : "result 已确认"}
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
                            {english ? "result flow" : "result flow"}
                          </p>
                          <p
                            className="mt-3 text-sm leading-6 text-[color:var(--foreground)]"
                            data-testid="run-thread-result-flow"
                          >
                            {runtime.v21.runThread.resultFlow.summary}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {[
                              `${runtime.v21.runThread.resultFlow.trackedSourceCount} tracked`,
                              `${runtime.v21.runThread.resultFlow.requiresOperatorAttentionCount} attention`,
                              `${runtime.v21.runThread.resultFlow.resolvedCount} resolved`,
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
                              `${runtime.v21.runThread.resultFlow.counts.pending} pending`,
                              `${runtime.v21.runThread.resultFlow.counts.acknowledged} acknowledged`,
                              `${runtime.v21.runThread.resultFlow.counts.failed} failed`,
                              `${runtime.v21.runThread.resultFlow.counts.blocked} blocked`,
                              `${runtime.v21.runThread.resultFlow.counts.deferred} deferred`,
                              `${runtime.v21.runThread.resultFlow.counts.followThroughOpen} follow-through open`,
                              `${runtime.v21.runThread.resultFlow.counts.followThroughResolved} follow-through resolved`,
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
                                  : "当前这条线程还没有可见的 downstream result flow。"}
                              </li>
                            ) : null}
                          </ul>
                        </div>
                        <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                            {english ? "forward flow" : "forward flow"}
                          </p>
                          <p className="mt-3 text-sm leading-6 text-[color:var(--foreground)]">
                            {runtime.v21.runThread.forwardFlow.summary}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {[
                              runtime.v21.runThread.forwardFlow.state,
                              `${runtime.v21.runThread.forwardFlow.attentionCount} attention`,
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
                            {runtime.v21.runThread.forwardFlow.nextAction ?? "No open next action."}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {runtime.v21.runThread.forwardFlow.boundaryNote}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                            {english ? "closeout flow" : "closeout flow"}
                          </p>
                          <p className="mt-3 text-sm leading-6 text-[color:var(--foreground)]">
                            {runtime.v21.runThread.closeoutFlow.summary}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {[
                              runtime.v21.runThread.closeoutFlow.state,
                              `${runtime.v21.runThread.closeoutFlow.openCount} open`,
                              `${runtime.v21.runThread.closeoutFlow.resolvedCount} resolved`,
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
                            {runtime.v21.runThread.closeoutFlow.nextAction ?? "No open closeout action."}
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
                                  : "当前这条线程还没有可见的线程-level closeout 源头。"}
                              </li>
                            ) : null}
                          </ul>
                        </div>
                        <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                            {english ? "settlement flow" : "settlement flow"}
                          </p>
                          <p className="mt-3 text-sm leading-6 text-[color:var(--foreground)]">
                            {runtime.v21.runThread.settlementFlow.summary}
                          </p>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {[
                              runtime.v21.runThread.settlementFlow.state,
                              runtime.v21.runThread.settlementFlow.driver,
                              `${runtime.v21.runThread.settlementFlow.forwardAttentionCount} forward attention`,
                              `${runtime.v21.runThread.settlementFlow.openCloseoutCount} closeout open`,
                              `${runtime.v21.runThread.settlementFlow.resolvedCloseoutCount} closeout resolved`,
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
                              "No open settlement action."}
                          </p>
                          {closeSettlementHandoffReadout ? (
                            <div
                              className="mt-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3"
                              data-testid="run-thread-close-settlement-handoff"
                            >
                              <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                                {english
                                  ? "close / settlement handoff"
                                  : "close / settlement handoff"}
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
                              {english ? "closeout summary" : "closeout summary"}
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
                                "No explicit closeout summary action is attached to this thread yet."}
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
                              {english ? "closeout resolution" : "closeout resolution"}
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
                                "No explicit closeout resolution is attached to this thread yet."}
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
                                  {english ? "Record close decision" : "记录 close 决议"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={pending}
                                  data-testid="run-thread-record-closeout-keep-open"
                                  onClick={() => recordCloseoutResolution("keep_open")}
                                >
                                  {english ? "Record keep-open decision" : "记录 keep-open 决议"}
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
                                : "closeout resolution follow-through"}
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
                              {english ? "closeout outcome" : "closeout outcome"}
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
                                "No explicit closeout outcome is attached to this thread yet."}
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
                              {english ? "close request" : "close request"}
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
                                "No explicit close request is attached to this thread yet."}
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
                                    : "重新请求线程 close"
                                  : english
                                    ? "Request thread close"
                                    : "请求线程 close"}
                              </Button>
                            ) : null}
                          </div>
                          <div
                            className="mt-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3"
                            data-testid="run-thread-close-lifecycle"
                          >
                            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                              {english ? "close lifecycle" : "close lifecycle"}
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
                                "No explicit close lifecycle summary is attached to this thread yet."}
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
                              {english ? "close control" : "close control"}
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
                                "No explicit close control summary is attached to this thread yet."}
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
                              {english ? "close control flow" : "close control flow"}
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
                              {`${runtime.v21.runThread.closeControlFlow.forwardAttentionCount} forward attention · ${runtime.v21.runThread.closeControlFlow.openCloseoutCount} closeout open`}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.runThread.closeControlFlow.nextAction ??
                                "No explicit close control flow summary is attached to this thread yet."}
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
                              {english ? "close decision flow" : "close decision flow"}
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
                                "No explicit close decision flow summary is attached to this thread yet."}
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
                                : "close decision control"}
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
                                "No explicit close decision control summary is attached to this thread yet."}
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
                              {english ? "close resolution" : "close resolution"}
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
                                "No explicit close resolution summary is attached to this thread yet."}
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
                                : "close resolution forward"}
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
                              {`${runtime.v21.runThread.closeResolutionForwardSummary.forwardAttentionCount} forward attention · ${runtime.v21.runThread.closeResolutionForwardSummary.openCloseoutCount} closeout open`}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.runThread.closeResolutionForwardSummary.nextAction ??
                                "No explicit close resolution forward summary is attached to this thread yet."}
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
                                : "close resolution control"}
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
                                "No explicit close resolution control summary is attached to this thread yet."}
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
                              {english ? "close posture" : "close posture"}
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
                                "No explicit close posture summary is attached to this thread yet."}
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
                              {english ? "close posture forward" : "close posture forward"}
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
                              {`${runtime.v21.runThread.closePostureForwardSummary.forwardAttentionCount} forward attention · ${runtime.v21.runThread.closePostureForwardSummary.openCloseoutCount} closeout open`}
                            </p>
                            <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                              {runtime.v21.runThread.closePostureForwardSummary.nextAction ??
                                "No explicit close posture forward summary is attached to this thread yet."}
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
                              {english ? "settlement review" : "settlement review"}
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
                                "No explicit settlement review is attached to this thread yet."}
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
                                {english ? "Request settlement review" : "请求 settlement 复核"}
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
                                {english ? "Resolve settlement review" : "解决 settlement 复核"}
                              </Button>
                            ) : null}
                          </div>
                          <div
                            className="mt-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3"
                            data-testid="run-thread-closeout-confirmation"
                            id="run-thread-closeout-confirmation"
                          >
                            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                              {english ? "closeout confirmation" : "closeout confirmation"}
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
                                "No explicit closeout confirmation is attached to this thread yet."}
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
                                    : "重新确认 closeout"
                                  : english
                                    ? "Confirm closeout"
                                    : "确认 closeout"}
                              </Button>
                            ) : null}
                          </div>
                          <div
                            className="mt-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-subtle)] px-3 py-3"
                            data-testid="run-thread-closeout-refresh"
                            id="run-thread-closeout-refresh"
                          >
                            <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                              {english ? "closeout refresh" : "closeout refresh"}
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
                                "No explicit closeout refresh is attached to this thread yet."}
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
                                {english ? "Request closeout refresh" : "请求 closeout refresh"}
                              </Button>
                            ) : null}
                          </div>
                          <p className="mt-2 text-xs leading-5 text-[color:var(--muted-foreground)]">
                            {runtime.v21.runThread.settlementFlow.boundaryNote}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                            {english ? "run thread lifecycle" : "run thread lifecycle"}
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
                              <li>- {english ? "No run thread lifecycle note yet." : "当前还没有 run 线程 生命周期 备注。"}</li>
                            ) : null}
                          </ul>
                        </div>
                        <div className="rounded-2xl border border-[color:var(--border)] px-3 py-3">
                          <p className="text-xs font-medium text-[color:var(--muted-foreground)]">
                            {english ? "trace history" : "trace history"}
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
                            {english ? "handoff payload" : "handoff payload"}
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
                          {english ? "human input checkpoint" : "human input checkpoint"}
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
                            {english ? "human input request" : "human input request"}
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
                              {english ? "Request human input" : "请求 human input"}
                            </Button>
                          ) : null}
                          {canManageRuntime && humanInputRequestState === "requested" ? (
                            <Button
                              variant="secondary"
                              className="mt-3"
                              data-testid="operator-debugger-acknowledge-human-input"
                              onClick={acknowledgeHumanInputCheckpoint}
                            >
                              {english ? "Acknowledge human input" : "确认 human input"}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <MeetingV2RuntimeQueuesPanel
                      runtime={runtime}
                      english={english}
                      pending={pending}
                      canManageRuntime={canManageRuntime}
                      canReviewRuntime={canReviewRuntime}
                      queueReflection={queueReflection}
                      queueConsolidation={queueConsolidation}
                      updateConsolidation={updateConsolidation}
                      acceptReflectionCandidate={acceptReflectionCandidate}
                      dismissReflectionCandidate={dismissReflectionCandidate}
                    />
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
