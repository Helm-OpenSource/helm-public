import { describe, expect, it } from "vitest";
import { parseDingTalkWorkProgressRecord } from "@/lib/connectors/dingtalk-work-progress";

describe("dingtalk work progress parser", () => {
  it("extracts section text when content value is nested object", () => {
    const parsed = parseDingTalkWorkProgressRecord({
      id: "row-1",
      sourceId: "report-1",
      sourceScope: "WORKSPACE:WORK",
      sourceType: "work_report",
      sourceSummary: "fallback summary",
      createdAt: new Date("2026-04-13T08:30:00.000Z"),
      draftPayload: JSON.stringify({
        payload: {
          report_id: "report-1",
          creator_name: "王丽珍",
          dept_name: "资产运营部",
          contents: [
            {
              key: "本周完成工作",
              value: {
                text: "4月目标还款金额预测",
              },
            },
            {
              key: "本周工作总结",
              value: {
                markdown: "内机机构薪资结算",
              },
            },
          ],
        },
      }),
    });

    expect(parsed).not.toBeNull();
    expect(parsed?.completedWork).toContain("4月目标还款金额预测");
    expect(parsed?.weeklySummary).toContain("内机机构薪资结算");
    expect(parsed?.previewText).toContain("内机机构薪资结算");
  });
});

