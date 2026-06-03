import type {
  WorkspaceFirstLoopItem,
  WorkspaceFirstLoopModel,
  WorkspaceFirstLoopPrimaryAction,
  WorkspaceFirstLoopReturnReadback,
  WorkspaceFirstLoopStage,
} from "@/lib/operating-system/first-loop";
import { formatSeededBusinessCopy } from "@/lib/presentation/seeded-business-copy";

function sanitizeApprovalLoopText(text: string, english: boolean) {
  const cleaned = text
    .replace(
      /review-before-commitment\s+gate/gi,
      english ? "review boundary" : "复核边界",
    )
    .replace(
      /review-before-commitment/gi,
      english ? "review before commitment" : "先复核再承诺",
    )
    .replace(
      /review-before-send/gi,
      english ? "review before send" : "先复核再外发",
    )
    .replace(/first-loop\s+checkpoint/gi, english ? "review step" : "复核环节")
    .replace(/first loop\s+checkpoint/gi, english ? "review step" : "复核环节")
    .replace(/\bfirst-loop\b/gi, english ? "first review" : "首轮复核")
    .replace(/\bfirst loop\b/gi, english ? "first review" : "首轮复核")
    .replace(/review\s*gate/gi, english ? "review panel" : "复核入口")
    .replace(/review\s*区块/gi, english ? "review block" : "复核区块")
    .replace(/review\s*block/gi, english ? "review block" : "复核区块")
    .replace(/\brecommendation\b/gi, english ? "recommendation" : "建议")
    .replace(/\bcommitment\b/gi, english ? "commitment" : "承诺")
    .replace(/\bworkspace\b/gi, english ? "workspace" : "工作区")
    .replace(/\breview\b/gi, english ? "review" : "复核")
    .replace(/\bdraft\b/gi, english ? "draft" : "草稿")
    .trim();

  return formatSeededBusinessCopy(cleaned, english);
}

function stripReviewPrefix(label: string, english: boolean) {
  const normalized = sanitizeApprovalLoopText(label, english)
    .replace(/^先\s*复核\s*/i, "")
    .replace(/^review\s+/i, "")
    .replace(/^复核[:：]?\s*/i, "")
    .trim();

  if (!normalized) {
    return english ? "current draft" : "当前草稿";
  }

  if (english) {
    return normalized;
  }

  return normalized.replace(/\s+复核区块/g, "复核区块");
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

function buildApprovalLoopItem(
  item: WorkspaceFirstLoopItem,
  english: boolean,
): WorkspaceFirstLoopItem {
  if (item.id === "review") {
    const subject = stripReviewPrefix(item.label, english);
    return {
      ...item,
      label: english ? `Review ${subject}` : `复核：${subject}`,
      summary: sanitizeApprovalLoopText(item.summary, english),
    };
  }

  return {
    ...item,
    label: sanitizeApprovalLoopText(item.label, english).replace(
      /复核\s+后/g,
      "复核后",
    ).replace(/推进\s+发送/g, "推进发送"),
    summary: sanitizeApprovalLoopText(item.summary, english),
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
  const roleGoal = buildApprovalLoopItem(model.roleGoal, english);
  const firstSignal = buildApprovalLoopItem(model.firstSignal, english);
  const firstSuggestion = buildApprovalLoopItem(model.firstSuggestion, english);
  const reviewCheckpoint = buildApprovalLoopItem(
    model.reviewCheckpoint,
    english,
  );
  const followThrough = buildApprovalLoopItem(model.followThrough, english);
  const memoryWriteBack = buildApprovalLoopItem(model.memoryWriteBack, english);
  const nextAnchor = buildApprovalLoopItem(model.nextAnchor, english);
  const itemById = new Map(
    [
      roleGoal,
      firstSignal,
      firstSuggestion,
      reviewCheckpoint,
      followThrough,
      memoryWriteBack,
      nextAnchor,
    ].map((item) => [item.id, item]),
  );

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
    roleGoal,
    firstSignal,
    firstSuggestion,
    reviewCheckpoint,
    followThrough,
    memoryWriteBack,
    nextAnchor,
    steps: model.steps.map(
      (item) => itemById.get(item.id) ?? buildApprovalLoopItem(item, english),
    ),
  };
}
