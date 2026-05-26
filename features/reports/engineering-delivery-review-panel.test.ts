import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EngineeringDeliveryReviewPanel } from "@/features/reports/engineering-delivery-review-panel";
import type { EngineeringDeliveryReview } from "@/lib/reports/engineering-delivery-review";

describe("EngineeringDeliveryReviewPanel", () => {
  it("keeps contributor evidence behind disclosure in the Chinese review path", () => {
    const review = buildReview();
    const html = renderToStaticMarkup(
      createElement(EngineeringDeliveryReviewPanel, { review, english: false }),
    );
    const contributorStart = html.indexOf("Alice");
    const firstDisclosure = html.indexOf("<details", contributorStart);
    const emailPosition = html.indexOf("alice@example.com");

    expect(html).toContain("先看方向、闭环和下一步动作。");
    expect(html).toContain("查看证据明细");
    expect(html).toContain("贡献者标识");
    expect(html).toContain("数据更新时间");
    expect(html).toContain("高优先级");
    expect(html).not.toContain(">HIGH<");
    expect(firstDisclosure).toBeGreaterThan(contributorStart);
    expect(emailPosition).toBeGreaterThan(firstDisclosure);
    expect(html).not.toContain("<details open");
  });
});

function buildReview(): EngineeringDeliveryReview {
  return {
    availability: "READY",
    repoLabel: "helm",
    windowLabel: "最近 28 天",
    headline: "工程交付应该先显示方向、闭环和协同，而不是只看提交数。",
    summary: "当前仓库复盘覆盖 1 位活跃贡献者。",
    sourceNote: "数据源：当前仓库 Git 历史。",
    boundaryNote: "这只是内部管理判断层。",
    snapshot: {
      objectState: "1 位贡献者",
      blocker: "职责压力需要保持可见。",
      pendingDecision: "给主力路径补复核人。",
      nextAction: "先明确下一条关键切片的复核责任。",
    },
    connections: [
      {
        label: "职责压力",
        value: "中心化",
        description: "主力作者在当前窗口承接了大部分提交。",
      },
    ],
    contributors: [
      {
        name: "Alice",
        email: "alice@example.com",
        commits: 12,
        activeDays: 5,
        filesTouched: 24,
        changedLines: 1200,
        commitShare: 1,
        changedLineShare: 1,
        docsCommitRate: 0.5,
        testsCommitRate: 0.25,
        guardrailCommitRate: 0.25,
        closureCommitRate: 0.5,
        largeCommitRate: 0.25,
        repeatedFileRate: 0.35,
        overlapFileCount: 3,
        focusLabels: ["周报复核面", "综合支撑"],
        latestSubject: "新增或强化：周报复核面",
        contentSummary: "最近的工作主要集中在 周报复核面、综合支撑。",
        quantityJudgement: "当前窗口里的主力交付通道。",
        qualityJudgement: "质量信号已经可见，但还不足以过度乐观。",
        directionJudgement: "工作方向与当前主线优先级基本对齐。",
        deliveryJudgement: "对一个窄切片来说，交付相对完整。",
        workingStyle: "承担清晰切片，但已经进入共享路径重叠区。",
        suggestion: "在下一批提交落下前，先把共享文件上的复核责任说清楚。",
        badgeTone: "success",
        metricCards: [
          {
            label: "数量",
            value: "12 提交 · 24 文件",
            detail: "5 个活跃日 · 1200 行改动",
          },
        ],
      },
    ],
    collaboration: {
      summary: "判断贡献者输出是否方向对齐、闭环足够。",
      hotspots: ["Alice 共同触达了 3 个文件，主要集中在 周报复核面。"],
      risks: ["职责归属和复核边界要继续显式。"],
      overlapPairs: [],
    },
    suggestions: [
      {
        title: "给主力交付路径补第二负责人",
        body: "下一条关键切片应明确补第二负责人和复核人。",
        priority: "HIGH",
      },
    ],
    freshness: {
      mode: "SNAPSHOT",
      generatedAt: "2026-04-23T06:00:00.000Z",
      sourceRevision: "abc123",
      stale: false,
      note: "今日已按计划刷新为最新每日快照。",
    },
  };
}
