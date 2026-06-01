import { describe, expect, it } from "vitest";
import type {
  WorkspaceFirstLoopItem,
  WorkspaceFirstLoopModel,
  WorkspaceFirstLoopPrimaryAction,
  WorkspaceFirstLoopReturnReadback,
} from "@/lib/operating-system/first-loop";
import {
  buildDiagnosticsFirstLoopDisplayModel,
  formatDiagnosticsFeatureFlagLabel,
  formatDiagnosticsTechnicalKey,
  formatDiagnosticsVisibleText,
} from "@/features/diagnostics/display-copy";

function buildLoopItem(
  id: WorkspaceFirstLoopItem["id"],
  label: string,
  summary: string,
): WorkspaceFirstLoopItem {
  return { id, label, summary, status: "done", href: `/${id}` };
}

function buildDiagnosticsLoopModel(): WorkspaceFirstLoopModel {
  const roleGoal = buildLoopItem(
    "role-goal",
    "Founder focus has setup context",
    "Current focus should not add more setup.",
  );
  const firstSignal = buildLoopItem(
    "signal",
    "First live signal",
    "The first loop should anchor on one live signal.",
  );
  const firstSuggestion = buildLoopItem(
    "suggestion",
    "Review first-loop suggestion",
    "This first loop still needs review-before-commitment.",
  );
  const reviewCheckpoint = buildLoopItem(
    "review",
    "first loop checkpoint",
    "Review the checkpoint before commitment.",
  );
  const followThrough = buildLoopItem(
    "follow-through",
    "Follow-through",
    "Route the next move after review.",
  );
  const memoryWriteBack = buildLoopItem(
    "write-back",
    "Memory write-back",
    "Write the result into memory.",
  );
  const nextAnchor = buildLoopItem(
    "anchor",
    "Return to the live signal",
    "Resume the same live signal.",
  );
  const primaryAction: WorkspaceFirstLoopPrimaryAction = {
    stepId: "review",
    label: "Review first loop",
    summary: "Current single next action is a review-before-commitment gate.",
    href: "/approvals",
    ctaLabel: "Open review",
  };
  const returnReadback: WorkspaceFirstLoopReturnReadback = {
    mode: "explicit",
    label: "Resume first loop",
    summary: "Resume the live signal instead of adding setup.",
    href: "/dashboard",
    ctaLabel: "Resume now",
  };

  return {
    stage: "review",
    stageLabel: "first loop checkpoint",
    title: "First loop title",
    summary: "The first loop uses one live signal after setup.",
    progressLabel: "6/7 first-loop checkpoints complete",
    boundary: "Recommendation still does not equal commitment.",
    hasExplicitAnchor: true,
    completedCount: 6,
    totalCount: 7,
    primaryAction,
    returnReadback,
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
  };
}

describe("diagnostics display copy", () => {
  it("keeps English diagnostics text unchanged", () => {
    expect(
      formatDiagnosticsVisibleText(
        "Recommendation workflow needs operator queue review.",
        true,
      ),
    ).toBe("Recommendation workflow needs operator queue review.");
  });

  it("maps system-facing words into Chinese operating language", () => {
    expect(
      formatDiagnosticsVisibleText(
        "Recommendation workflow needs operator queue review and follow-through.",
        false,
      ),
    ).toBe("判断建议 工作回路 需要 操作人 待处理队列 复核 和 后续动作.");
  });

  it("keeps diagnostics raw runtime terms out of Chinese-facing copy", () => {
    expect(
      formatDiagnosticsVisibleText(
        "fact hit 100%, action creation is still weak, not scale-ready.",
        false,
      ),
    ).toBe("事实 命中 100%, 动作生成 是 仍然 偏弱, 未 具备放量条件.");
    expect(
      formatDiagnosticsTechnicalKey("openai:gpt-4.1-mini/NEXT STEP", false),
    ).toBe("智能服务 默认模型 下一步");
  });

  it("maps retry and owner states to readable Chinese labels", () => {
    expect(
      formatDiagnosticsTechnicalKey("operator_review_required", false),
    ).toBe("需要人工复核");
    expect(formatDiagnosticsTechnicalKey("owner_missing", false)).toBe(
      "缺负责人",
    );
    expect(
      formatDiagnosticsTechnicalKey("blocked_missing_idempotency_lock", false),
    ).toBe("阻断：缺幂等锁");
  });

  it("turns memory write boundary notes into Chinese operating text", () => {
    expect(
      formatDiagnosticsVisibleText(
        "Memory write retry contract is bounded, receipt-oriented, idempotency-keyed, and never retrying automatically.",
        false,
      ),
    ).toBe(
      "记忆写入重试 约束 是 有界, 凭证导向, 幂等键约束, 并且绝不自动重试.",
    );
  });

  it("turns long technical keys into wrapped business text", () => {
    expect(
      formatDiagnosticsTechnicalKey(
        "MEETING:meeting_detail_sample/fallback_trace",
        false,
      ),
    ).toBe("会议 会议 详情 样本 备用路径 轨迹");
    expect(
      formatDiagnosticsTechnicalKey("actionCreationRate/RISK_SIGNAL", false),
    ).toBe("动作生成率 风险信号");
  });

  it("maps workspace feature flags before they reach the diagnostics surface", () => {
    expect(formatDiagnosticsFeatureFlagLabel("captureAudio", false)).toBe(
      "现场采集",
    );
    expect(formatDiagnosticsFeatureFlagLabel("llmEnhancement", false)).toBe(
      "智能增强",
    );
    expect(
      formatDiagnosticsFeatureFlagLabel("swarmReadOnlyWorkers", false),
    ).toBe("只读协作者");
    expect(formatDiagnosticsFeatureFlagLabel("captureAudio", true)).toBe(
      "Capture audio",
    );
  });

  it("wraps the diagnostics first-loop model before rendering shared summary cards", () => {
    const model = buildDiagnosticsFirstLoopDisplayModel(
      buildDiagnosticsLoopModel(),
      false,
    );
    const visibleText = [
      model.stageLabel,
      model.title,
      model.summary,
      model.progressLabel,
      model.boundary,
      model.primaryAction.label,
      model.primaryAction.summary,
      model.primaryAction.ctaLabel,
      model.returnReadback.label,
      model.returnReadback.summary,
      model.returnReadback.ctaLabel,
      ...model.steps.flatMap((item) => [item.label, item.summary]),
    ].join("\n");

    expect(visibleText).toContain("首轮闭环");
    expect(visibleText).toContain("实时信号");
    expect(visibleText).toContain("设置");
    expect(visibleText).not.toMatch(
      /first loop|first-loop|live signal|review-before|setup/i,
    );
  });
});
