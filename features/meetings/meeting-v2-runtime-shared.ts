export type MeetingV2RuntimeReviewMode = "confirm" | "edit_confirm" | "reject" | "keep_draft";

export type MeetingV2RuntimeReviewPayload = {
  mode: MeetingV2RuntimeReviewMode;
  factsJson: string;
  actionPackMarkdown: string;
  reviewNotes: string;
};

export type MeetingV2RuntimeContinuityRemediationAction =
  | "SAVE_RECOVERY_CHECKPOINT"
  | "RESUME_CHECKPOINT"
  | "REPRUNE_CONTEXT";

export type MeetingV2RuntimeContinuityRemediationPreview = {
  action: MeetingV2RuntimeContinuityRemediationAction;
  executionStatus: "APPLIED" | "REVIEW_REQUIRED" | "BLOCKED";
  rollbackAnchorLabel: string | null;
};

export function renderStatusVariant(status: string) {
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

export function renderRuntimeStatusLabel(status: string, english: boolean) {
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

export function formatContinuityPostureToast(input: {
  action: MeetingV2RuntimeContinuityRemediationAction;
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
