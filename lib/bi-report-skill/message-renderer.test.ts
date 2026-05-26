import { describe, expect, it } from "vitest";
import { renderBiReportMessage } from "@/lib/bi-report-skill/message-renderer";

describe("bi report message renderer", () => {
  it("renders nested values and list blocks", () => {
    const rendered = renderBiReportMessage(
      [
        "# {{skill.name}} | {{result.severityLabel}}",
        "{{#analysis.findings}}",
        "- {{.}}",
        "{{/analysis.findings}}",
      ].join("\n"),
      {
        skill: { name: "日报" },
        result: { severityLabel: "告警" },
        analysis: {
          findings: ["第一条", "第二条"],
        },
      },
    );

    expect(rendered).toContain("# 日报 | 告警");
    expect(rendered).toContain("- 第一条");
    expect(rendered).toContain("- 第二条");
  });
});
