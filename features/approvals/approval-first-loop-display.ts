import type {
  WorkspaceFirstLoopModel,
  WorkspaceFirstLoopPrimaryAction,
  WorkspaceFirstLoopReturnReadback,
  WorkspaceFirstLoopStage,
} from "@/lib/operating-system/first-loop";

function stripReviewPrefix(label: string, english: boolean) {
  const normalized = label
    .replace(/^先\s*review\s*/i, "")
    .replace(/^review\s+/i, "")
    .replace(/^复核[:：]?\s*/i, "")
    .trim();

  if (!normalized) {
    return english ? "current draft" : "当前草稿";
  }

  if (english) {
    return normalized;
  }

  return normalized
    .replace(/review\s*区块/gi, "复核区块")
    .replace(/review\s*block/gi, "复核区块")
    .replace(/\breview\b/gi, "复核")
    .replace(/\bworkspace\b/gi, "工作区")
    .replace(/\bdraft\b/gi, "草稿")
    .replace(/\s+复核区块/g, "复核区块");
}

function getApprovalStageLabel(
  stage: WorkspaceFirstLoopStage,
  english: boolean,
) {
  switch (stage) {
    case "setup":
      return english ? "Narrow first" : "先收窄目标";
    case "signal":
      return english ? "Read signal" : "先看信号";
    case "review":
      return english ? "Review now" : "先做复核";
    case "follow-through":
      return english ? "Route next move" : "推进下一步";
    case "memory":
      return english ? "Write back" : "写回记忆";
    case "anchor":
      return english ? "Return anchor" : "回访点";
  }
}

function buildApprovalPrimaryAction(
  action: WorkspaceFirstLoopPrimaryAction,
  english: boolean,
): WorkspaceFirstLoopPrimaryAction {
  if (action.stepId !== "review") {
    return {
      ...action,
      ctaLabel:
        action.stepId === "anchor"
          ? english
            ? "Open return point"
            : "打开回访点"
          : action.ctaLabel,
    };
  }

  const draftLabel = stripReviewPrefix(action.label, english);

  return {
    ...action,
    label: english ? `Review ${draftLabel}` : `复核：${draftLabel}`,
    summary: english
      ? "This draft cannot leave the boundary yet. Read the draft, evidence and impact, then approve, rewrite, reject or convert it to manual handling."
      : "这条草稿还不能直接放行。先读草稿、证据和影响，再决定通过、改写、拒绝或转人工。",
    ctaLabel: english ? "Open review panel" : "进入复核面板",
  };
}

function buildApprovalReturnReadback(
  readback: WorkspaceFirstLoopReturnReadback,
  model: WorkspaceFirstLoopModel,
  english: boolean,
): WorkspaceFirstLoopReturnReadback {
  const anchorLabel = stripReviewPrefix(model.nextAnchor.label, english);

  return {
    ...readback,
    label: english ? "Return point" : "回访点",
    summary: english
      ? `If you leave now, reopen "${anchorLabel}" first so you do not rescan the whole workspace.`
      : `如果现在离开，下次先打开“${anchorLabel}”，不要重新扫全工作区。`,
    ctaLabel: english ? "Open return point" : "打开回访点",
  };
}

export function buildApprovalFirstLoopDisplayModel(
  model: WorkspaceFirstLoopModel,
  english: boolean,
): WorkspaceFirstLoopModel {
  return {
    ...model,
    stageLabel: getApprovalStageLabel(model.stage, english),
    title: english
      ? "One review decision is the next move."
      : "下一步就是做一次复核判断。",
    summary: english
      ? "Keep the decision on the draft, evidence and boundary. Wider loop context can wait until the review decision is clear."
      : "先围绕草稿、证据和边界做判断。更宽的回路解释，可以等复核决定清楚之后再看。",
    progressLabel: english
      ? `${model.completedCount}/${model.totalCount} steps ready`
      : `${model.completedCount}/${model.totalCount} 环节已就绪`,
    boundary: english
      ? "Recommendation is still not commitment. Review, evidence trace and return point must remain visible before the draft becomes execution."
      : "建议仍不等于承诺。草稿变成执行前，复核、证据痕迹和回访点必须保持可见。",
    primaryAction: buildApprovalPrimaryAction(model.primaryAction, english),
    returnReadback: buildApprovalReturnReadback(
      model.returnReadback,
      model,
      english,
    ),
  };
}
