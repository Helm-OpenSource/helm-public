import { describe, expect, it } from "vitest";
import { formatReportDisplayText } from "@/features/reports/display-copy";

describe("report display copy", () => {
  it("keeps the Chinese report summary in manager-facing action language", () => {
    const formatted = formatReportDisplayText(
      "过去一周系统识别出 2 次机会推进动作。AI 共生成 11 条 AI 建议，AI 建议质量稳定。系统观察显示没有系统想到什么。HubSpot 导入已经让首页、blocker 和 recommendation 都长出了真实内容。数据来源包括事件埋点、deals、notes 和 today focus。",
      false,
    );

    expect(formatted).toContain("过去一周识别出 2 次机会推进动作");
    expect(formatted).toContain("本周生成 11 条建议动作");
    expect(formatted).toContain("建议质量稳定");
    expect(formatted).toContain("推进规律显示");
    expect(formatted).toContain("首页、阻塞和判断建议");
    expect(formatted).toContain("使用信号、机会、记录和今日重点");
    expect(formatted).not.toMatch(
      /AI 共生成|AI 建议|AI 执行|AI 参与|系统观察|系统想到什么|blocker|recommendation|事件埋点|today focus|deals|notes/i,
    );
  });

  it("does not rewrite English report text", () => {
    const text = "AI suggestions reached execution this week.";

    expect(formatReportDisplayText(text, true)).toBe(text);
  });

  it("localizes historical seed action names in Chinese reports", () => {
    const formatted = formatReportDisplayText(
      "复核：发送 Atlas 合作 brief，并确认 joint launch brief 和 panel briefing。",
      false,
    );

    expect(formatted).toContain("发送 Atlas 合作摘要");
    expect(formatted).toContain("联合发布摘要");
    expect(formatted).toContain("面试简报");
    expect(formatted).not.toMatch(/brief|briefing|joint launch|panel/i);
  });
});
