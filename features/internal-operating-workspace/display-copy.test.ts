import { describe, expect, it } from "vitest";
import { formatOperatingDisplayText } from "@/features/internal-operating-workspace/display-copy";

describe("operating display copy", () => {
  it("keeps English operating surfaces from leaking seeded Chinese labels", () => {
    const rendered = formatOperatingDisplayText(
      "线索发现 / 内部支持人简报 / 客户成功共同接力 / 候选人管线 / 方案准备度 / 支付准备度 / 可发送边界",
      true,
    );

    expect(rendered).toContain("Lead discovery");
    expect(rendered).toContain("internal champion briefing");
    expect(rendered).toContain("customer success handoff");
    expect(rendered).toContain("candidate pipeline");
    expect(rendered).toContain("proposal readiness");
    expect(rendered).toContain("payment readiness");
    expect(rendered).toContain("sendability boundary");
    expect(rendered).not.toMatch(/[\u4e00-\u9fff]/);
  });

  it("keeps Chinese operating surfaces from exposing internal mixed-language labels", () => {
    const rendered = formatOperatingDisplayText(
      "Founder review-before-send lane with Leads, customer success, candidate pipeline, issue follow-through, expansion pressure and proposal readiness.",
      false,
    );

    expect(rendered).toContain("创始人");
    expect(rendered).toContain("发送前复核");
    expect(rendered).toContain("线索");
    expect(rendered).toContain("客户成功");
    expect(rendered).toContain("候选人管线");
    expect(rendered).toContain("问题推进");
    expect(rendered).toContain("扩张压力");
    expect(rendered).toContain("方案准备度");
    expect(formatOperatingDisplayText("Lead 发现 / 内部 champion brief", false)).toBe(
      "线索发现 / 内部支持人简报",
    );
    expect(formatOperatingDisplayText("重新给出试点范围和内部 champion 方案", false)).toBe(
      "重新给出试点范围和内部支持人方案",
    );
    expect(formatOperatingDisplayText("candidate briefing / panel briefing", false)).toBe(
      "候选人简报 / 面试小组简报",
    );
    expect(
      formatOperatingDisplayText(
	        "Helm v2 ingested 安域云科内部交付对齐会 into the meeting-to-action runtime.",
        false,
      ),
    ).toBe("会议推进链路已接入：安域云科内部交付对齐会。");
    expect(
      formatOperatingDisplayText(
	        "Helm v2 ingested 安域云科内部交付对齐会 into…",
        false,
      ),
    ).toBe("会议推进链路已接入：安域云科内部交付对齐会。");
    expect(formatOperatingDisplayText("RECOMMENDATION_GENERATED", false)).toBe(
      "已生成下一步建议",
    );
    expect(rendered).not.toMatch(/Founder|review-before-send|Leads|customer success|candidate pipeline|issue follow-through|expansion pressure|proposal readiness/);
  });
});
