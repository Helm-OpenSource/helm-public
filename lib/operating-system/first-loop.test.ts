import { describe, expect, it } from "vitest";
import {
  buildWorkspaceFirstLoopModel,
  type FirstLoopProgressStatus,
} from "@/lib/operating-system/first-loop";

function buildItem(
  label: string,
  status: FirstLoopProgressStatus,
  href = "/dashboard",
) {
  return {
    label,
    summary: `${label} summary`,
    href,
    status,
  };
}

describe("workspace first loop model", () => {
  it("stays in setup when role and focus are not yet narrowed", () => {
    const model = buildWorkspaceFirstLoopModel({
      english: false,
      roleGoal: buildItem("先收窄角色", "ready", "/setup"),
      firstSignal: buildItem("第一条 signal", "blocked", "/meetings"),
      firstSuggestion: null,
      reviewCheckpoint: null,
      followThrough: null,
      memoryWriteBack: null,
      nextAnchor: null,
    });

    expect(model.stage).toBe("setup");
    expect(model.stageLabel).toBe("初始化收窄");
    expect(model.progressLabel).toContain("已完成 0/7");
  });

  it("keeps the first move inside review before commitment", () => {
    const model = buildWorkspaceFirstLoopModel({
      english: true,
      roleGoal: buildItem("Founder posture narrowed", "done", "/setup"),
      firstSignal: buildItem("QBR follow-up signal", "done", "/meetings/1"),
      firstSuggestion: buildItem(
        "Draft the next customer reply",
        "done",
        "/meetings/1",
      ),
      reviewCheckpoint: buildItem(
        "Review the first draft",
        "ready",
        "/approvals",
      ),
      followThrough: buildItem(
        "Route the approved draft",
        "watch",
        "/approvals",
      ),
      memoryWriteBack: buildItem(
        "Write the decision trace back",
        "blocked",
        "/memory",
      ),
      nextAnchor: buildItem(
        "Return to the same review block",
        "watch",
        "/approvals",
      ),
    });

    expect(model.stage).toBe("review");
    expect(model.title).toContain("review");
    expect(model.boundary).toContain("review-before-commitment");
    expect(model.primaryAction.stepId).toBe("review");
    expect(model.primaryAction.ctaLabel).toBe("Open review gate");
    expect(model.returnReadback.mode).toBe("derived");
  });

  it("lands on anchor only after follow-through and write-back are visible", () => {
    const model = buildWorkspaceFirstLoopModel({
      english: true,
      roleGoal: buildItem("Founder posture narrowed", "done", "/setup"),
      firstSignal: buildItem(
        "Customer renewal risk",
        "done",
        "/opportunities/1",
      ),
      firstSuggestion: buildItem(
        "Prepare the renewal recovery note",
        "done",
        "/approvals",
      ),
      reviewCheckpoint: buildItem(
        "First review gate completed",
        "done",
        "/approvals",
      ),
      followThrough: buildItem(
        "Recovery note sent manually",
        "done",
        "/approvals",
      ),
      memoryWriteBack: buildItem(
        "Decision trace written back",
        "done",
        "/memory",
      ),
      nextAnchor: buildItem(
        "Return to the same chain tomorrow",
        "ready",
        "/dashboard",
      ),
      hasExplicitAnchor: true,
    });

    expect(model.stage).toBe("anchor");
    expect(model.completedCount).toBe(6);
    expect(model.progressLabel).toBe("6/7 first-loop checkpoints complete");
    expect(model.summary).toContain("Return to the same chain tomorrow");
    expect(model.hasExplicitAnchor).toBe(true);
    expect(model.primaryAction.stepId).toBe("anchor");
    expect(model.primaryAction.ctaLabel).toBe("Resume saved anchor");
    expect(model.returnReadback.mode).toBe("explicit");
  });

  it("prioritizes the saved return anchor on the second visit", () => {
    const model = buildWorkspaceFirstLoopModel({
      english: false,
      roleGoal: buildItem("角色与目标已收窄", "done", "/setup"),
      firstSignal: buildItem("本周续约风险会议", "done", "/meetings/1"),
      firstSuggestion: buildItem("收窄成第一条客户回复", "done", "/approvals"),
      reviewCheckpoint: buildItem(
        "先 review 第一条回复",
        "ready",
        "/approvals",
      ),
      followThrough: buildItem("review 后推进客户回复", "watch", "/approvals"),
      memoryWriteBack: buildItem(
        "把 decision trace 写回去",
        "blocked",
        "/memory",
      ),
      nextAnchor: buildItem("回到当前 review 区块", "done", "/approvals"),
      hasExplicitAnchor: true,
    });

    expect(model.stage).toBe("review");
    expect(model.primaryAction.stepId).toBe("anchor");
    expect(model.primaryAction.label).toContain("回访点");
    expect(model.returnReadback.label).toBe("已保存回访点");
  });
});
