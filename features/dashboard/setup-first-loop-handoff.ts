import type { WorkspaceFirstLoopModel } from "@/lib/operating-system";

export type DashboardSetupFirstLoopHandoffModel = {
  title: string;
  summary: string;
  primaryAction: WorkspaceFirstLoopModel["primaryAction"];
  signal: {
    label: string;
    summary: string;
    href: string;
    ctaLabel: string;
  };
  returnReadback: WorkspaceFirstLoopModel["returnReadback"];
  showSeparateSignalAction: boolean;
};

type BuildDashboardSetupFirstLoopHandoffInput = {
  entry: string | null | undefined;
  english: boolean;
  firstLoopModel: WorkspaceFirstLoopModel;
};

function buildTitle(input: {
  english: boolean;
  firstLoopModel: WorkspaceFirstLoopModel;
}) {
  if (input.firstLoopModel.primaryAction.stepId === "anchor") {
    return input.english
      ? "Setup is complete. Resume the saved anchor."
      : "setup 已完成，先从保存的锚点继续。";
  }

  if (input.firstLoopModel.primaryAction.stepId === "review") {
    return input.english
      ? "Setup is complete. Open the first review."
      : "setup 已完成，现在就打开第一道复核。";
  }

  if (input.firstLoopModel.primaryAction.stepId === "write-back") {
    return input.english
      ? "Setup is complete. Write back the first result."
      : "setup 已完成，先把第一条结果写回去。";
  }

  return input.english
    ? "Setup is complete. Open the first live signal."
    : "setup 已完成，直接进入第一条实时信号。";
}

function buildSummary(input: {
  english: boolean;
  firstLoopModel: WorkspaceFirstLoopModel;
}) {
  if (input.firstLoopModel.primaryAction.stepId === "anchor") {
    return input.english
      ? `Reopen the saved return point first. ${input.firstLoopModel.returnReadback.summary}`
      : `先重开保存的回访起点。${input.firstLoopModel.returnReadback.summary}`;
  }

  return input.english
    ? `The first live signal is "${input.firstLoopModel.firstSignal.label}". Move into one bounded next action now and keep review-before-commitment visible from the start.`
    : `第一条实时信号是“${input.firstLoopModel.firstSignal.label}”。现在先进入一条有边界的下一步，并从第一轮开始就把承诺前复核 放到前台。`;
}

export function buildDashboardSetupFirstLoopHandoff(
  input: BuildDashboardSetupFirstLoopHandoffInput,
): DashboardSetupFirstLoopHandoffModel | null {
  if (input.entry !== "setup-first-loop") {
    return null;
  }

  return {
    title: buildTitle(input),
    summary: buildSummary(input),
    primaryAction: input.firstLoopModel.primaryAction,
    signal: {
      label: input.firstLoopModel.firstSignal.label,
      summary: input.firstLoopModel.firstSignal.summary,
      href: input.firstLoopModel.firstSignal.href,
      ctaLabel: input.english ? "Open first signal" : "打开第一条信号",
    },
    returnReadback: input.firstLoopModel.returnReadback,
    showSeparateSignalAction:
      ["signal", "suggestion"].includes(input.firstLoopModel.primaryAction.stepId) &&
      input.firstLoopModel.firstSignal.href !==
      input.firstLoopModel.primaryAction.href,
  };
}
