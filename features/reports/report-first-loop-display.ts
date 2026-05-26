import type {
  WorkspaceFirstLoopItem,
  WorkspaceFirstLoopModel,
  WorkspaceFirstLoopPrimaryAction,
  WorkspaceFirstLoopReturnReadback,
  WorkspaceFirstLoopStage,
} from "@/lib/operating-system/first-loop";
import { formatSeededBusinessCopy } from "@/lib/presentation/seeded-business-copy";

function sanitizeReportLoopText(text: string, english: boolean) {
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
    .replace(/\brecommendation\b/gi, english ? "suggestion" : "建议")
    .replace(/\bcommitment\b/gi, english ? "commitment" : "承诺")
    .replace(/\bworkspace\b/gi, english ? "workspace" : "工作区")
    .trim();

  if (english) {
    return cleaned;
  }

  const formatted = cleaned
    .replace(/\blive signal\b/gi, "实时信号")
    .replace(/\bsignal\b/gi, "信号")
    .replace(/\bmemory fact\b/gi, "记忆事实")
    .replace(/\bmemory\b/gi, "记忆")
    .replace(/\bfocus\b/gi, "重心")
    .replace(/\bsetup\b/gi, "设置")
    .replace(/\breview\b/gi, "复核")
    .replace(/\bdraft\b/gi, "草稿")
    .replace(/\bsummary\b/gi, "摘要")
    .replace(/\bgate\b/gi, "入口")
    .replace(/\s+复核区块/g, "复核区块");

  return formatSeededBusinessCopy(formatted, english);
}

function stripReviewPrefix(label: string, english: boolean) {
  const normalized = sanitizeReportLoopText(label, english)
    .replace(/^先\s*复核\s*/i, "")
    .replace(/^复核[:：]?\s*/i, "")
    .replace(/^review\s+/i, "")
    .trim();

  if (!normalized) {
    return english ? "current report action" : "当前周报动作";
  }

  return normalized;
}

function getReportStageLabel(stage: WorkspaceFirstLoopStage, english: boolean) {
  switch (stage) {
    case "setup":
      return english ? "Narrow the report" : "先收敛周报";
    case "signal":
      return english ? "Read signal" : "先看经营信号";
    case "review":
      return english ? "Review report" : "先做周报复核";
    case "follow-through":
      return english ? "Route next move" : "推进下一步";
    case "memory":
      return english ? "Write back" : "写回复盘";
    case "anchor":
      return english ? "Return point" : "回访点";
  }
}

function buildReportLoopItem(
  item: WorkspaceFirstLoopItem,
  english: boolean,
): WorkspaceFirstLoopItem {
  const label = sanitizeReportLoopText(item.label, english);

  if (item.id === "review") {
    const subject = stripReviewPrefix(item.label, english);
    return {
      ...item,
      label: english ? `Review ${subject}` : `复核：${subject}`,
      summary: english
        ? "Read why this action entered the report, whether the evidence is enough, and whether it should be approved, rewritten or handled manually."
        : "先看这条动作为什么进入周报、证据是否足够，以及应该通过、改写还是转人工。",
    };
  }

  if (item.id === "follow-through") {
    return {
      ...item,
      label,
      summary: english
        ? "Keep the next move narrow after the review decision, instead of widening the report into a general analytics surface."
        : "复核决定清楚后，再把下一步保持窄而明确，不把周报扩成泛分析面。",
    };
  }

  if (item.id === "anchor") {
    return {
      ...item,
      label: english ? "Return to current review block" : "回到当前复核区块",
      summary: english
        ? "Use this return point when you come back so the report does not need to be scanned from the top again."
        : "下次回来先从这里继续，不必重新从头扫完整份周报。",
    };
  }

  return {
    ...item,
    label,
    summary: sanitizeReportLoopText(item.summary, english),
  };
}

function buildReportPrimaryAction(
  action: WorkspaceFirstLoopPrimaryAction,
  english: boolean,
): WorkspaceFirstLoopPrimaryAction {
  if (action.stepId === "review") {
    const subject = stripReviewPrefix(action.label, english);
    return {
      ...action,
      label: english ? `Review ${subject}` : `复核：${subject}`,
      summary: english
        ? "This report is asking for one review decision. Check the evidence, risk and boundary before anything becomes execution."
        : "这份周报现在只要求做一次复核判断。先看证据、风险和边界，再决定是否进入执行。",
      ctaLabel: english ? "Open review panel" : "进入复核",
    };
  }

  if (action.stepId === "anchor") {
    return {
      ...action,
      label: english ? "Return to current review block" : "回到当前复核区块",
      summary: english
        ? "Resume from the saved report return point before opening the whole report again."
        : "先从保存的周报回访点继续，再决定是否展开整份周报。",
      ctaLabel: english ? "Open return point" : "打开回访点",
    };
  }

  return {
    ...action,
    label: sanitizeReportLoopText(action.label, english),
    summary: sanitizeReportLoopText(action.summary, english),
    ctaLabel: sanitizeReportLoopText(action.ctaLabel, english),
  };
}

function buildReportReturnReadback(
  readback: WorkspaceFirstLoopReturnReadback,
  model: WorkspaceFirstLoopModel,
  english: boolean,
): WorkspaceFirstLoopReturnReadback {
  const anchorLabel = stripReviewPrefix(model.nextAnchor.label, english);

  return {
    ...readback,
    label: english ? "Return point" : "回访点",
    summary: english
      ? `If you leave now, reopen "${anchorLabel}" first so the report does not become a full rescan.`
      : `如果现在离开，下次先打开“${anchorLabel}”，不要重新扫完整份周报。`,
    ctaLabel: english ? "Open return point" : "打开回访点",
  };
}

export function buildReportFirstLoopDisplayModel(
  model: WorkspaceFirstLoopModel,
  english: boolean,
): WorkspaceFirstLoopModel {
  const roleGoal = buildReportLoopItem(model.roleGoal, english);
  const firstSignal = buildReportLoopItem(model.firstSignal, english);
  const firstSuggestion = buildReportLoopItem(model.firstSuggestion, english);
  const reviewCheckpoint = buildReportLoopItem(model.reviewCheckpoint, english);
  const followThrough = buildReportLoopItem(model.followThrough, english);
  const memoryWriteBack = buildReportLoopItem(model.memoryWriteBack, english);
  const nextAnchor = buildReportLoopItem(model.nextAnchor, english);
  const itemsById = new Map(
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
    stageLabel: getReportStageLabel(model.stage, english),
    title: english
      ? "Compress the report into one review decision."
      : "先把周报压成一个复核判断。",
    summary: english
      ? "This block should show the current signal, the review action and the return point before the wider report explains everything else."
      : "这一块只负责告诉你当前该看哪条经营信号、该复核哪一个动作、下一次回来从哪里继续；完整解释放到后面。",
    progressLabel: english
      ? `${model.completedCount}/${model.totalCount} steps ready`
      : `${model.completedCount}/${model.totalCount} 个环节已就绪`,
    boundary: english
      ? "Reports expose review context, suggestions and return points. Suggestion is not commitment, and nothing is sent or executed before review."
      : "周报只给复盘、建议和回访点。建议不等于承诺，复核前不会外发或执行。",
    primaryAction: buildReportPrimaryAction(model.primaryAction, english),
    returnReadback: buildReportReturnReadback(
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
      (item) => itemsById.get(item.id) ?? buildReportLoopItem(item, english),
    ),
  };
}
