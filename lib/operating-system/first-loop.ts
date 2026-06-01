export type FirstLoopProgressStatus = "done" | "ready" | "watch" | "blocked";
export const FIRST_LOOP_RETURN_ANCHOR_ACTION = "FIRST_LOOP_RETURN_ANCHOR_SET";
export const FIRST_LOOP_SETUP_HANDOFF_ENTERED_ACTION =
  "FIRST_LOOP_SETUP_HANDOFF_ENTERED";
export const FIRST_LOOP_PRIMARY_ACTION_OPENED_ACTION =
  "FIRST_LOOP_PRIMARY_ACTION_OPENED";
export const FIRST_LOOP_ANCHOR_RESUMED_ACTION = "FIRST_LOOP_ANCHOR_RESUMED";
export const FIRST_LOOP_REVIEW_COMPLETED_PROXY_ACTION = "APPROVAL_APPROVED";
export const FIRST_LOOP_WRITE_BACK_COMPLETED_PROXY_ACTION =
  "MEMORY_FACT_CONFIRMED";
export const FIRST_LOOP_DIAGNOSTICS_ACTION_TYPES = [
  FIRST_LOOP_SETUP_HANDOFF_ENTERED_ACTION,
  FIRST_LOOP_PRIMARY_ACTION_OPENED_ACTION,
  FIRST_LOOP_RETURN_ANCHOR_ACTION,
  FIRST_LOOP_ANCHOR_RESUMED_ACTION,
  FIRST_LOOP_REVIEW_COMPLETED_PROXY_ACTION,
  FIRST_LOOP_WRITE_BACK_COMPLETED_PROXY_ACTION,
] as const;

export type WorkspaceFirstLoopStage =
  | "setup"
  | "signal"
  | "review"
  | "follow-through"
  | "memory"
  | "anchor";

export type WorkspaceFirstLoopCandidate = {
  label: string;
  summary: string;
  href: string;
};

export type WorkspaceFirstLoopItem = WorkspaceFirstLoopCandidate & {
  id:
    | "role-goal"
    | "signal"
    | "suggestion"
    | "review"
    | "follow-through"
    | "write-back"
    | "anchor";
  status: FirstLoopProgressStatus;
};

export type WorkspaceFirstLoopPrimaryAction = {
  stepId: WorkspaceFirstLoopItem["id"];
  label: string;
  summary: string;
  href: string;
  ctaLabel: string;
};

export type WorkspaceFirstLoopReturnReadback = {
  mode: "explicit" | "derived";
  label: string;
  summary: string;
  href: string;
  ctaLabel: string;
};

export type WorkspaceFirstLoopModel = {
  stage: WorkspaceFirstLoopStage;
  stageLabel: string;
  title: string;
  summary: string;
  progressLabel: string;
  boundary: string;
  hasExplicitAnchor: boolean;
  completedCount: number;
  totalCount: number;
  primaryAction: WorkspaceFirstLoopPrimaryAction;
  returnReadback: WorkspaceFirstLoopReturnReadback;
  roleGoal: WorkspaceFirstLoopItem;
  firstSignal: WorkspaceFirstLoopItem;
  firstSuggestion: WorkspaceFirstLoopItem;
  reviewCheckpoint: WorkspaceFirstLoopItem;
  followThrough: WorkspaceFirstLoopItem;
  memoryWriteBack: WorkspaceFirstLoopItem;
  nextAnchor: WorkspaceFirstLoopItem;
  steps: WorkspaceFirstLoopItem[];
};

type WorkspaceFirstLoopModelInput = {
  english: boolean;
  roleGoal: Omit<WorkspaceFirstLoopItem, "id">;
  firstSignal: Omit<WorkspaceFirstLoopItem, "id"> | null;
  firstSuggestion: Omit<WorkspaceFirstLoopItem, "id"> | null;
  reviewCheckpoint: Omit<WorkspaceFirstLoopItem, "id"> | null;
  followThrough: Omit<WorkspaceFirstLoopItem, "id"> | null;
  memoryWriteBack: Omit<WorkspaceFirstLoopItem, "id"> | null;
  nextAnchor: Omit<WorkspaceFirstLoopItem, "id"> | null;
  hasExplicitAnchor?: boolean;
};

function getStageLabel(stage: WorkspaceFirstLoopStage, english: boolean) {
  switch (stage) {
    case "setup":
      return english ? "Setup narrowing" : "初始化收窄";
    case "signal":
      return english ? "First signal" : "第一条信号";
    case "review":
      return english ? "Review first" : "先做复核";
    case "follow-through":
      return english ? "Follow-through" : "继续推进";
    case "memory":
      return english ? "Write-back" : "先做写回";
    case "anchor":
      return english ? "Next anchor" : "下一次回访点";
  }
}

function getStatusCopy(status: FirstLoopProgressStatus, english: boolean) {
  switch (status) {
    case "done":
      return english ? "Done" : "已成立";
    case "ready":
      return english ? "Do now" : "现在就做";
    case "watch":
      return english ? "Next" : "下一步";
    case "blocked":
      return english ? "Blocked" : "未就绪";
  }
}

function buildFallbackRoleGoal(
  english: boolean,
): Omit<WorkspaceFirstLoopItem, "id"> {
  return {
    label: english ? "Narrow role and focus" : "先收窄角色与目标",
    summary: english
      ? "Pick one role posture and one or two focus areas before widening the workspace."
      : "先选定角色姿态，再收窄到一两个重点领域，不要先把工作区越配越散。",
    href: "/setup",
    status: "ready",
  };
}

function buildFallbackSignal(
  english: boolean,
): Omit<WorkspaceFirstLoopItem, "id"> {
  return {
    label: english
      ? "Use the first real meeting or follow-up as the signal"
      : "从第一条真实会议或跟进开始",
    summary: english
      ? "Do not wait for a full CRM. Start from a live meeting, follow-up thread, or hot opportunity."
      : "不要等完整客户系统。先用一场真实会议、一条跟进线程或一个高优先机会作为第一条信号。",
    href: "/meetings",
    status: "ready",
  };
}

function buildFallbackSuggestion(
  english: boolean,
  href: string,
): Omit<WorkspaceFirstLoopItem, "id"> {
  return {
    label: english
      ? "Make the first next step explicit"
      : "把第一条下一步说清楚",
    summary: english
      ? "Once the signal is open, keep the suggestion narrow enough to review before it becomes any commitment."
      : "一旦打开信号，就把建议收窄到足够可复核，不要让它直接滑成承诺。",
    href,
    status: "watch",
  };
}

function buildFallbackReview(
  english: boolean,
): Omit<WorkspaceFirstLoopItem, "id"> {
  return {
    label: english
      ? "Keep the first move reviewable"
      : "让第一条动作保持可复核",
    summary: english
      ? "Review-before-commitment must show up in the first session, not only after the product already feels risky."
      : "承诺前复核必须在第一次使用时就出现，而不是等产品已经显得冒险后才补上。",
    href: "/approvals",
    status: "watch",
  };
}

function buildFallbackFollowThrough(
  english: boolean,
  href: string,
): Omit<WorkspaceFirstLoopItem, "id"> {
  return {
    label: english ? "Close one concrete next move" : "收掉一条明确下一步",
    summary: english
      ? "After review, route one next move and stop there before widening into workflow setup."
      : "复核之后先收掉一条明确下一步，不要立刻扩成流程配置。",
    href,
    status: "watch",
  };
}

function buildFallbackWriteBack(
  english: boolean,
): Omit<WorkspaceFirstLoopItem, "id"> {
  return {
    label: english ? "Write the result back into memory" : "把结果写回记忆",
    summary: english
      ? "Leave a decision trace and boundary trace before you leave the workspace."
      : "离开工作区前，至少留下决策痕迹和边界痕迹。",
    href: "/memory",
    status: "blocked",
  };
}

function buildFallbackAnchor(
  english: boolean,
  href: string,
): Omit<WorkspaceFirstLoopItem, "id"> {
  return {
    label: english ? "Leave a clear return anchor" : "留下清楚的回访点",
    summary: english
      ? "Next visit should reopen the same signal or review block, not restart from scanning the whole workspace."
      : "下一次回来应该直接重开同一条信号或复核 block，而不是重新扫全场。",
    href,
    status: "watch",
  };
}

function resolveStage(items: {
  roleGoal: WorkspaceFirstLoopItem;
  firstSignal: WorkspaceFirstLoopItem;
  firstSuggestion: WorkspaceFirstLoopItem;
  reviewCheckpoint: WorkspaceFirstLoopItem;
  followThrough: WorkspaceFirstLoopItem;
  memoryWriteBack: WorkspaceFirstLoopItem;
  nextAnchor: WorkspaceFirstLoopItem;
}): WorkspaceFirstLoopStage {
  if (items.roleGoal.status !== "done") {
    return "setup";
  }

  if (items.firstSignal.status !== "done") {
    return "signal";
  }

  if (items.reviewCheckpoint.status === "ready") {
    return "review";
  }

  if (items.firstSuggestion.status !== "done") {
    return "signal";
  }

  if (items.followThrough.status !== "done") {
    return "follow-through";
  }

  if (items.memoryWriteBack.status !== "done") {
    return "memory";
  }

  return "anchor";
}

function buildStageCopy(input: {
  stage: WorkspaceFirstLoopStage;
  english: boolean;
  reviewLabel: string;
  signalLabel: string;
  anchorLabel: string;
}) {
  switch (input.stage) {
    case "setup":
      return {
        title: input.english
          ? "Do not stop the first loop at setup."
          : "不要把第一次闭环停在初始化。",
        summary: input.english
          ? "Setup should only narrow role and focus. The first session still needs to land on a real signal inside 10-20 minutes."
          : "初始化的职责只是收窄角色和重点。第一次使用仍然要在 10-20 分钟内落到一条真实信号上。",
      };
    case "signal":
      return {
        title: input.english
          ? "Land on the first real signal now."
          : "现在就落到第一条真实信号上。",
        summary: input.english
          ? `The workspace still needs one live signal. Start from "${input.signalLabel}" or the nearest real meeting / follow-up instead of adding more setup.`
          : `当前工作区还需要一条真实信号。先从“${input.signalLabel}”或最近那条真实会议 / 跟进开始，而不是继续加配置。`,
      };
    case "review":
      return {
        title: input.english
          ? "Keep the first suggestion inside review."
          : "把第一条建议留在复核里面。",
        summary: input.english
          ? `A first move is already visible. Review "${input.reviewLabel}" before it becomes any commitment or outward motion.`
          : `第一条动作已经可见。先复核“${input.reviewLabel}”，再决定它是否应该越过边界，变成真实承诺或对外动作。`,
      };
    case "follow-through":
      return {
        title: input.english
          ? "Close one narrow follow-through."
          : "先收掉一条窄的后续推进。",
        summary: input.english
          ? "The review posture is already visible. Now route one concrete next move instead of widening into a larger workflow."
          : "复核姿态已经显形。现在该先路由一条具体下一步，而不是立刻扩成更大的流程。",
      };
    case "memory":
      return {
        title: input.english
          ? "Write the result back before you leave."
          : "离开前先把结果写回去。",
        summary: input.english
          ? "One move is already in motion. Leave memory, decision trace and boundary trace explicit before the session ends."
          : "至少已有一条动作开始进入真实推进。结束本次使用前，把记忆、决策痕迹和边界痕迹留清楚。",
      };
    case "anchor":
      return {
        title: input.english
          ? "The first loop is readable now."
          : "这条第一次闭环现在已经可读。",
        summary: input.english
          ? `Keep "${input.anchorLabel}" as the explicit next-return anchor so the second visit can start from context.`
          : `把“${input.anchorLabel}”留成显式的下次回访点，让第二次进入能直接从上下文接着走。`,
      };
  }
}

function getPrimaryActionCta(
  stepId: WorkspaceFirstLoopItem["id"],
  english: boolean,
) {
  switch (stepId) {
    case "role-goal":
      return english ? "Finish setup narrowing" : "完成初始化收窄";
    case "signal":
      return english ? "Open first signal" : "打开第一条信号";
    case "suggestion":
      return english ? "Open first suggestion" : "打开第一条建议";
    case "review":
      return english ? "Open review gate" : "打开复核入口";
    case "follow-through":
      return english ? "Open follow-through" : "打开后续推进";
    case "write-back":
      return english ? "Write back now" : "现在写回";
    case "anchor":
      return english ? "Resume saved anchor" : "继续回访点";
  }
}

function buildPrimaryAction(input: {
  english: boolean;
  steps: WorkspaceFirstLoopItem[];
  nextAnchor: WorkspaceFirstLoopItem;
  hasExplicitAnchor: boolean;
}): WorkspaceFirstLoopPrimaryAction {
  if (input.hasExplicitAnchor) {
    return {
      stepId: "anchor",
      label: input.english
        ? "Resume the saved return anchor"
        : "从已保存回访点继续",
      summary: input.english
        ? `You already saved "${input.nextAnchor.label}" as the restart point. Reopen it before scanning the rest of the workspace.`
        : `你已经把“${input.nextAnchor.label}”保存成回访起点。先重开它，再决定是否要重新扫整个工作区。`,
      href: input.nextAnchor.href,
      ctaLabel: getPrimaryActionCta("anchor", input.english),
    };
  }

  const currentStep =
    input.steps.find((item) => item.status === "ready") ??
    input.steps.find((item) => item.status === "watch") ??
    input.nextAnchor;

  return {
    stepId: currentStep.id,
    label: currentStep.label,
    summary: currentStep.summary,
    href: currentStep.href,
    ctaLabel: getPrimaryActionCta(currentStep.id, input.english),
  };
}

function buildReturnReadback(input: {
  english: boolean;
  nextAnchor: WorkspaceFirstLoopItem;
  hasExplicitAnchor: boolean;
}): WorkspaceFirstLoopReturnReadback {
  if (input.hasExplicitAnchor) {
    return {
      mode: "explicit",
      label: input.english ? "Saved return point" : "已保存回访点",
      summary: input.english
        ? `The second visit should reopen "${input.nextAnchor.label}" instead of starting from a fresh workspace scan.`
        : `第二次进入时，先重开“${input.nextAnchor.label}”，而不是重新从工作区全量扫描开始。`,
      href: input.nextAnchor.href,
      ctaLabel: input.english ? "Resume saved point" : "继续处理",
    };
  }

  return {
    mode: "derived",
    label: input.english ? "Current return point" : "回到事项",
    summary: input.english
      ? `If you leave now, the next visit can reopen "${input.nextAnchor.label}" before scanning the rest of the workspace.`
      : `如果现在离开，下次回来可以先回到“${input.nextAnchor.label}”，不用重新扫整个工作区。`,
    href: input.nextAnchor.href,
    ctaLabel: input.english ? "Open return point" : "打开回到事项",
  };
}

export function buildWorkspaceFirstLoopModel(
  input: WorkspaceFirstLoopModelInput,
): WorkspaceFirstLoopModel {
  const roleGoal: WorkspaceFirstLoopItem = {
    id: "role-goal",
    ...(input.roleGoal ?? buildFallbackRoleGoal(input.english)),
  };
  const firstSignal: WorkspaceFirstLoopItem = {
    id: "signal",
    ...(input.firstSignal ?? buildFallbackSignal(input.english)),
  };
  const firstSuggestion: WorkspaceFirstLoopItem = {
    id: "suggestion",
    ...(input.firstSuggestion ??
      buildFallbackSuggestion(input.english, firstSignal.href)),
  };
  const reviewCheckpoint: WorkspaceFirstLoopItem = {
    id: "review",
    ...(input.reviewCheckpoint ?? buildFallbackReview(input.english)),
  };
  const followThrough: WorkspaceFirstLoopItem = {
    id: "follow-through",
    ...(input.followThrough ??
      buildFallbackFollowThrough(input.english, reviewCheckpoint.href)),
  };
  const memoryWriteBack: WorkspaceFirstLoopItem = {
    id: "write-back",
    ...(input.memoryWriteBack ?? buildFallbackWriteBack(input.english)),
  };
  const nextAnchor: WorkspaceFirstLoopItem = {
    id: "anchor",
    ...(input.nextAnchor ??
      buildFallbackAnchor(input.english, firstSignal.href)),
  };

  const steps = [
    roleGoal,
    firstSignal,
    firstSuggestion,
    reviewCheckpoint,
    followThrough,
    memoryWriteBack,
    nextAnchor,
  ];
  const completedCount = steps.filter((item) => item.status === "done").length;
  const stage = resolveStage({
    roleGoal,
    firstSignal,
    firstSuggestion,
    reviewCheckpoint,
    followThrough,
    memoryWriteBack,
    nextAnchor,
  });
  const stageCopy = buildStageCopy({
    stage,
    english: input.english,
    reviewLabel: reviewCheckpoint.label,
    signalLabel: firstSignal.label,
    anchorLabel: nextAnchor.label,
  });
  const hasExplicitAnchor = input.hasExplicitAnchor ?? false;
  const primaryAction = buildPrimaryAction({
    english: input.english,
    steps,
    nextAnchor,
    hasExplicitAnchor,
  });
  const returnReadback = buildReturnReadback({
    english: input.english,
    nextAnchor,
    hasExplicitAnchor,
  });

  return {
    stage,
    stageLabel: getStageLabel(stage, input.english),
    title: stageCopy.title,
    summary: stageCopy.summary,
    progressLabel: input.english
      ? `${completedCount}/${steps.length} first-loop checkpoints complete`
      : `已完成 ${completedCount}/${steps.length} 个复核环节`,
    boundary: input.english
      ? "Recommendation still does not equal commitment. The first loop must make review-before-commitment, memory trace, and the next return anchor explicit."
      : "建议仍不等于承诺。第一次闭环必须把承诺前复核、记忆痕迹和下次回访点都放到前台。",
    hasExplicitAnchor,
    completedCount,
    totalCount: steps.length,
    primaryAction,
    returnReadback,
    roleGoal,
    firstSignal,
    firstSuggestion,
    reviewCheckpoint,
    followThrough,
    memoryWriteBack,
    nextAnchor,
    steps,
  };
}

export function getFirstLoopStatusLabel(
  status: FirstLoopProgressStatus,
  english: boolean,
) {
  return getStatusCopy(status, english);
}
