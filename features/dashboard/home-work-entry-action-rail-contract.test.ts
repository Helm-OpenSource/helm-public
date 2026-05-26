import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  "features/dashboard/home-work-entry-surface.tsx",
  "utf8",
);

describe("dashboard home work entry action rail contract", () => {
  it("routes returning users to work, review, signal intake and source checks from the first screen", () => {
    expect(source).toContain('data-dashboard-work-entry-action-rail="true"');
    expect(source).toContain("先处理");
    expect(source).toContain("复核压力");
    expect(source).toContain("上报信号");
    expect(source).toContain("数据源");
    expect(source).toContain("继续入口");
    expect(source).toContain("当前卡点");
  });

  it("keeps signal intake and source inspection as reviewable navigation, not auto execution", () => {
    expect(source).toContain('href="/search?mode=ask#ask-helm-signal-intake"');
    expect(source).toContain('href="/settings?tab=connectors"');
    expect(source).toContain("真实工作里出现新情况时，从 Ask Helm 补进系统。");
    expect(source).toContain("如果答案明显偏薄，先看导入和连接状态。");
    expect(source).not.toContain("自动上报");
    expect(source).not.toContain("自动接入");
  });
});
