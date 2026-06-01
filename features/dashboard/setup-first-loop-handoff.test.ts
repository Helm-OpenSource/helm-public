import { describe, expect, it } from "vitest";
import { buildWorkspaceFirstLoopModel } from "@/lib/operating-system/first-loop";
import { buildDashboardSetupFirstLoopHandoff } from "@/features/dashboard/setup-first-loop-handoff";

function buildItem(label: string, status: "done" | "ready" | "watch" | "blocked", href: string) {
  return {
    label,
    summary: `${label} summary`,
    href,
    status,
  };
}

describe("dashboard setup first-loop handoff", () => {
  it("returns null when dashboard was not opened from setup handoff", () => {
    const firstLoopModel = buildWorkspaceFirstLoopModel({
      english: true,
      roleGoal: buildItem("Founder posture narrowed", "done", "/setup"),
      firstSignal: buildItem("QBR follow-up signal", "done", "/meetings/1"),
      firstSuggestion: buildItem("Draft the first follow-up", "done", "/meetings/1"),
      reviewCheckpoint: buildItem("Review the first draft", "ready", "/approvals"),
      followThrough: buildItem("Route the approved move", "watch", "/approvals"),
      memoryWriteBack: buildItem("Write decision trace", "blocked", "/memory"),
      nextAnchor: buildItem("Return to the review block", "watch", "/approvals"),
    });

    expect(
      buildDashboardSetupFirstLoopHandoff({
        entry: null,
        english: true,
        firstLoopModel,
      }),
    ).toBeNull();
  });

  it("builds a signal-first handoff when setup just finished", () => {
    const firstLoopModel = buildWorkspaceFirstLoopModel({
      english: true,
      roleGoal: buildItem("Founder posture narrowed", "done", "/setup"),
      firstSignal: buildItem("QBR follow-up signal", "done", "/meetings/1"),
      firstSuggestion: buildItem("Draft the first follow-up", "done", "/meetings/1"),
      reviewCheckpoint: buildItem("Review the first draft", "ready", "/approvals"),
      followThrough: buildItem("Route the approved move", "watch", "/approvals"),
      memoryWriteBack: buildItem("Write decision trace", "blocked", "/memory"),
      nextAnchor: buildItem("Return to the review block", "watch", "/approvals"),
    });

    const model = buildDashboardSetupFirstLoopHandoff({
      entry: "setup-first-loop",
      english: true,
      firstLoopModel,
    });

    expect(model).not.toBeNull();
    expect(model?.title).toContain("Open the first review");
    expect(model?.primaryAction.ctaLabel).toBe("Open review gate");
    expect(model?.signal.label).toBe("QBR follow-up signal");
    expect(model?.showSeparateSignalAction).toBe(false);
  });

  it("prioritizes the saved anchor when setup hands off into a second visit", () => {
    const firstLoopModel = buildWorkspaceFirstLoopModel({
      english: false,
      roleGoal: buildItem("角色与目标已收窄", "done", "/setup"),
      firstSignal: buildItem("本周续约风险会议", "done", "/meetings/1"),
      firstSuggestion: buildItem("收窄成第一条客户回复", "done", "/approvals"),
      reviewCheckpoint: buildItem("先 review 第一条回复", "ready", "/approvals"),
      followThrough: buildItem("review 后推进客户回复", "watch", "/approvals"),
      memoryWriteBack: buildItem("把 decision trace 写回去", "blocked", "/memory"),
      nextAnchor: buildItem("回到当前 review 区块", "done", "/approvals"),
      hasExplicitAnchor: true,
    });

    const model = buildDashboardSetupFirstLoopHandoff({
      entry: "setup-first-loop",
      english: false,
      firstLoopModel,
    });

    expect(model).not.toBeNull();
    expect(model?.title).toContain("锚点");
    expect(model?.primaryAction.stepId).toBe("anchor");
    expect(model?.returnReadback.mode).toBe("explicit");
    expect(model?.showSeparateSignalAction).toBe(false);
  });
});
