import { describe, expect, it } from "vitest";
import { buildReportFirstLoopDisplayModel } from "@/features/reports/report-first-loop-display";
import type {
  WorkspaceFirstLoopItem,
  WorkspaceFirstLoopModel,
  WorkspaceFirstLoopPrimaryAction,
  WorkspaceFirstLoopReturnReadback,
} from "@/lib/operating-system/first-loop";

function buildLoopItem(
  id: WorkspaceFirstLoopItem["id"],
  label: string,
  status: WorkspaceFirstLoopItem["status"],
  href: string,
  summary = `${label} summary`,
): WorkspaceFirstLoopItem {
  return { id, label, status, href, summary };
}

function buildReviewPrimaryAction(
  input?: Partial<WorkspaceFirstLoopPrimaryAction>,
): WorkspaceFirstLoopPrimaryAction {
  return {
    stepId: "review",
    label: "先 review 发送 Atlas 合作 brief",
    summary: "这里就是这条 first loop 的显式 review-before-commitment gate。",
    href: "/approvals?approvalId=1#approval-preview",
    ctaLabel: "打开 review gate",
    ...input,
  };
}

function buildReturnReadback(
  input?: Partial<WorkspaceFirstLoopReturnReadback>,
): WorkspaceFirstLoopReturnReadback {
  return {
    mode: "derived",
    label: "当前推导锚点",
    summary: "如果现在离开，下次回来大概率应该先重开“回到当前 review 区块”。",
    href: "/approvals?approvalId=1#approval-preview",
    ctaLabel: "打开回访点",
    ...input,
  };
}

function buildFirstLoopModel(
  input?: Partial<WorkspaceFirstLoopModel>,
): WorkspaceFirstLoopModel {
  const roleGoal = buildLoopItem(
    "role-goal",
    "组织所有者 姿态已经收窄",
    "done",
    "/setup",
  );
  const firstSignal = buildLoopItem(
    "signal",
    "发送 Atlas 合作 brief",
    "done",
    "/approvals?approvalId=1",
  );
  const firstSuggestion = buildLoopItem(
    "suggestion",
    "发送 Atlas 合作 brief",
    "done",
    "/approvals?approvalId=1",
  );
  const reviewCheckpoint = buildLoopItem(
    "review",
    "先 review 发送 Atlas 合作 brief",
    "ready",
    "/approvals?approvalId=1#approval-preview",
    "这里就是这条 first loop 的显式 review-before-commitment gate。",
  );
  const followThrough = buildLoopItem(
    "follow-through",
    "review 后推进 发送 Atlas 合作 brief",
    "ready",
    "/approvals?approvalId=1",
  );
  const memoryWriteBack = buildLoopItem(
    "write-back",
    "系统曾建议优先推进 Delta",
    "done",
    "/memory",
  );
  const nextAnchor = buildLoopItem(
    "anchor",
    "回到当前 review 区块",
    "done",
    "/approvals?approvalId=1#approval-preview",
  );

  return {
    stage: "review",
    stageLabel: "先进入 review",
    title: "把第一条建议留在 review 里面。",
    summary: "第一条动作已经可见。先 review，再决定它是否应该越过边界。",
    progressLabel: "已完成 6/7 个 first-loop checkpoint",
    boundary: "recommendation 仍不等于 commitment。",
    hasExplicitAnchor: false,
    completedCount: 6,
    totalCount: 7,
    primaryAction: buildReviewPrimaryAction(),
    returnReadback: buildReturnReadback(),
    roleGoal,
    firstSignal,
    firstSuggestion,
    reviewCheckpoint,
    followThrough,
    memoryWriteBack,
    nextAnchor,
    steps: [
      roleGoal,
      firstSignal,
      firstSuggestion,
      reviewCheckpoint,
      followThrough,
      memoryWriteBack,
      nextAnchor,
    ],
    ...input,
  };
}

describe("report first loop display model", () => {
  it("turns raw first-loop copy into report review copy", () => {
    const display = buildReportFirstLoopDisplayModel(
      buildFirstLoopModel(),
      false,
    );
    const serialized = JSON.stringify(display);

    expect(display.stageLabel).toBe("先做周报复核");
    expect(display.progressLabel).toBe("6/7 个环节已就绪");
    expect(display.title).toContain("周报");
    expect(display.primaryAction.label).toBe("复核：发送 Atlas 合作摘要");
    expect(display.primaryAction.summary).toContain(
      "这份周报现在只要求做一次复核判断",
    );
    expect(display.primaryAction.ctaLabel).toBe("进入复核");
    expect(display.reviewCheckpoint.summary).toContain("为什么进入周报");
    expect(display.returnReadback.label).toBe("回访点");
    expect(display.returnReadback.summary).toContain("回到当前复核区块");
    expect(display.returnReadback.summary).toContain("不要重新扫完整份周报");
    expect(display.boundary).toContain("建议不等于承诺");
    expect(serialized).not.toMatch(
      /first-loop|first loop|first-loop checkpoint/i,
    );
    expect(serialized).not.toMatch(
      /review-before-commitment gate|review gate/i,
    );
    expect(serialized).not.toMatch(/\brecommendation\b|\bcommitment\b/i);
    expect(serialized).not.toMatch(/\bbrief\b|\bbriefing\b/i);
  });

  it("keeps the English review action clear without the old gate wording", () => {
    const display = buildReportFirstLoopDisplayModel(
      buildFirstLoopModel({
        primaryAction: buildReviewPrimaryAction({
          label: "Review Send Atlas partnership brief",
        }),
      }),
      true,
    );

    expect(display.stageLabel).toBe("Review report");
    expect(display.progressLabel).toBe("6/7 steps ready");
    expect(display.primaryAction.label).toBe(
      "Review Send Atlas partnership brief",
    );
    expect(display.primaryAction.ctaLabel).toBe("Open review panel");
    expect(display.primaryAction.summary).toContain("one review decision");
    expect(JSON.stringify(display)).not.toMatch(
      /first-loop checkpoint|review gate/i,
    );
  });
});
