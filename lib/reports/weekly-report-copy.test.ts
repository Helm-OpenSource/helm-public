import { describe, expect, it } from "vitest";
import {
  buildWeeklyReportAuditSummary,
  buildWeeklyReportSummaryText,
} from "@/lib/reports";

describe("weekly report localized copy", () => {
  it("keeps generated weekly report summaries bilingual", () => {
    const zh = buildWeeklyReportSummaryText({
      opportunitiesAdvancedCount: 2,
      overdueFollowupsCount: 1,
      aiSuggestionsCount: 4,
      approvalsApprovedCount: 3,
      openHighRiskCount: 1,
    });
    const en = buildWeeklyReportSummaryText({
      opportunitiesAdvancedCount: 2,
      overdueFollowupsCount: 1,
      aiSuggestionsCount: 4,
      approvalsApprovedCount: 3,
      openHighRiskCount: 1,
      english: true,
    });

    expect(zh).toContain("过去一周识别出 2 次机会推进动作");
    expect(zh).toContain("3 条已被批准执行");
    expect(en).toContain("identified 2 opportunity movement action");
    expect(en).toContain("3 of them were approved for execution");
    expect(en).not.toContain("过去一周");
    expect(en).not.toContain("承诺");
  });

  it("keeps weekly report audit summaries bilingual", () => {
    const weekStart = new Date("2026-06-01T00:00:00.000Z");
    const weekEnd = new Date("2026-06-07T00:00:00.000Z");

    expect(
      buildWeeklyReportAuditSummary({ weekStart, weekEnd }),
    ).toContain("生成管理者周报：06月01日 - 06月07日");
    expect(
      buildWeeklyReportAuditSummary({ weekStart, weekEnd, english: true }),
    ).toContain("Generated manager weekly report: Jun 01 - Jun 07");
  });
});
