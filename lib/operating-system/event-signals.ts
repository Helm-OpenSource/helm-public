import type { OperatingEventSignal, OperatingSkillId } from "@/lib/operating-system/types";

function createSignal(input: {
  id: string;
  kind: OperatingEventSignal["kind"];
  title: string;
  summary: string;
  severity: OperatingEventSignal["severity"];
  suggestedSkillIds: OperatingSkillId[];
}): OperatingEventSignal {
  return input;
}

export function buildWorkspaceEventSignals(
  input: {
    pendingApprovals: number;
    followUpDueCount: number;
    highRiskCount: number;
    meetingsToday: number;
    waitingOnUsThreadCount: number;
    importedSignalCount: number;
    recentCorrectionsCount?: number;
  },
  english = false,
) {
  const signals: OperatingEventSignal[] = [];

  if (input.pendingApprovals > 0) {
    signals.push(
      createSignal({
        id: "approval-backlog",
        kind: "approval-backlog",
        title: english ? "Approval backlog is live" : "审批积压仍在前台",
        summary: english
          ? `${input.pendingApprovals} risky or trust-sensitive actions are already waiting for review.`
          : `当前有 ${input.pendingApprovals} 条高风险或信任敏感动作正在等待复核。`,
        severity: input.pendingApprovals >= 5 ? "high" : "medium",
        suggestedSkillIds: ["approval-review"],
      }),
    );
  }

  if (input.followUpDueCount > 0) {
    signals.push(
      createSignal({
        id: "overdue-commitment",
        kind: "overdue-commitment",
        title: english ? "Follow-up pressure is building" : "逾期承诺正在抬头",
        summary: english
          ? `${input.followUpDueCount} opportunity objects are already in a follow-up due window.`
          : `当前有 ${input.followUpDueCount} 条机会对象已经进入待跟进窗口。`,
        severity: input.followUpDueCount >= 4 ? "high" : "medium",
        suggestedSkillIds: ["opportunity-push", "relationship-revival"],
      }),
    );
  }

  if (input.highRiskCount > 0) {
    signals.push(
      createSignal({
        id: "high-risk-opportunity",
        kind: "high-risk-opportunity",
        title: english ? "High-risk momentum needs arbitration" : "高风险推进需要仲裁",
        summary: english
          ? `${input.highRiskCount} live items are already carrying elevated risk signals.`
          : `当前有 ${input.highRiskCount} 条实时事项已经挂上了高风险信号。`,
        severity: "high",
        suggestedSkillIds: ["opportunity-push", "approval-review"],
      }),
    );
  }

  if (input.meetingsToday > 0) {
    signals.push(
      createSignal({
        id: "meeting-follow-through",
        kind: "meeting-follow-through",
        title: english ? "Meeting follow-through is active" : "会后推进链已经启动",
        summary: english
          ? `${input.meetingsToday} meetings today mean decisions should quickly become follow-through.`
          : `今天有 ${input.meetingsToday} 场会议，说明判断必须尽快落成 follow-through。`,
        severity: input.meetingsToday >= 4 ? "medium" : "low",
        suggestedSkillIds: ["meeting-briefing", "meeting-follow-through"],
      }),
    );
  }

  if (input.waitingOnUsThreadCount > 0) {
    signals.push(
      createSignal({
        id: "thread-waiting-on-us",
        kind: "thread-waiting-on-us",
        title: english ? "Threads are waiting on us" : "已有线程在等我方回应",
        summary: english
          ? `${input.waitingOnUsThreadCount} external threads are currently waiting on our side.`
          : `当前有 ${input.waitingOnUsThreadCount} 条外部线程正在等待我方动作。`,
        severity: input.waitingOnUsThreadCount >= 5 ? "high" : "medium",
        suggestedSkillIds: ["relationship-revival", "external-followup-draft"],
      }),
    );
  }

  if (input.importedSignalCount > 0) {
    signals.push(
      createSignal({
        id: "import-ingress-ready",
        kind: "import-ingress-ready",
        title: english ? "Imported signals are feeding the workspace" : "导入信号已经开始入场",
        summary: english
          ? `${input.importedSignalCount} imported work signals are already ready to be judged, not just stored.`
          : `当前已有 ${input.importedSignalCount} 条导入工作信号准备进入判断，而不只是被存下来。`,
        severity: "low",
        suggestedSkillIds: ["pilot-readiness-diagnostics", "opportunity-push"],
      }),
    );
  }

  if ((input.recentCorrectionsCount ?? 0) > 0) {
    signals.push(
      createSignal({
        id: "memory-correction-burst",
        kind: "memory-correction-burst",
        title: english ? "Memory is still being corrected" : "记忆仍在持续修正中",
        summary: english
          ? `${input.recentCorrectionsCount} recent corrections mean the system is still hardening its context.`
          : `最近有 ${input.recentCorrectionsCount} 条修正，说明系统上下文还在继续收稳。`,
        severity: "medium",
        suggestedSkillIds: ["memory-correction"],
      }),
    );
  }

  return signals;
}
