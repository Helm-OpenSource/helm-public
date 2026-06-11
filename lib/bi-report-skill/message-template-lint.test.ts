import { describe, expect, it } from "vitest";

import { lintBiReportMessageTemplate } from "@/lib/bi-report-skill/message-template-lint";
import type { BiReportSkillPack } from "@/lib/bi-report-skill/types";

function buildSkillPack(template: string): BiReportSkillPack {
  return {
    baseDir: "/tmp/skill",
    manifest: {
      skillKey: "test_skill",
      name: "Test Skill",
      version: "v1",
      sourceType: "ODPS",
      analysisMode: "metric_rule_only",
      defaultSchedule: "0 9 * * *",
      timezone: "Asia/Shanghai",
      supportedDeliveryChannels: [],
      parameters: [],
      silencePolicy: "warn_and_above",
      boundaries: [],
    },
    querySql: "select 1",
    schema: { version: "v1", parameters: [], columns: [] },
    metrics: {
      version: "v1",
      aggregations: [
        { key: "new_work_orders", label: "New", type: "sum", field: "new_work_orders", format: "integer" },
      ],
      displayOrder: ["new_work_orders"],
    },
    resultCriteria: {
      version: "v1",
      severityOrder: ["CLEAR", "WATCH", "WARN", "ALERT"],
      summaryMetricKeys: ["new_work_orders"],
      rules: [],
      silenceThreshold: "WARN",
      maxFindings: 3,
    },
    promptTemplate: "",
    messageTemplate: template,
  } as unknown as BiReportSkillPack;
}

describe("lintBiReportMessageTemplate", () => {
  it("accepts known roots and declared metric keys", () => {
    const warnings = lintBiReportMessageTemplate(
      buildSkillPack("{{skill.name}} {{result.severityLabel}} {{run.windowLabel}} {{metrics.new_work_orders}}"),
    );
    expect(warnings).toEqual([]);
  });

  it("warns on unknown metric keys", () => {
    const warnings = lintBiReportMessageTemplate(
      buildSkillPack("{{metrics.new_orders}}"),
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("new_orders");
    expect(warnings[0]).toContain("new_work_orders");
  });

  it("warns on unknown context roots", () => {
    const warnings = lintBiReportMessageTemplate(buildSkillPack("{{board_date}}"));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('"board_date"');
  });

  it("stays quiet for loop-scoped item fields", () => {
    const warnings = lintBiReportMessageTemplate(
      buildSkillPack("{{#analysis.findings}}{{title}}{{/analysis.findings}}"),
    );
    expect(warnings).toEqual([]);
  });
});
