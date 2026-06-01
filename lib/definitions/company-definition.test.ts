import { describe, expect, it } from "vitest";
import { buildCompanyDefinitionSuggestion } from "@/lib/definitions/company-definition";

describe("company definition suggestion", () => {
  it("builds a bounded suggestion from public and internal signals", () => {
    const suggestion = buildCompanyDefinitionSuggestion({
      locale: "zh-CN",
      company: {
        name: "Acme Robotics",
        website: "https://acme.example",
        industry: "机器人",
        description: "为制造企业提供自动化机器人与部署服务。",
        cooperationMaturity: null,
        recommendedPath: "先确认采购 owner，再推进方案评估。",
      },
      operatingSignals: {
        contactCount: 3,
        opportunityCount: 2,
        opportunityTypes: ["CLIENT", "CLIENT"],
        meetingCount: 2,
        memoryFactTitles: ["采购团队已进入技术评估"],
        topCommitmentTitle: "补齐试点范围说明",
        topBlockerTitle: "采购 owner 未确认",
      },
      websiteScan: {
        sourceUrl: "https://acme.example",
        pageTitle: "Acme Robotics",
        metaDescription: "Acme Robotics helps manufacturers automate repetitive workflows.",
        heading: "Industrial automation for modern factories",
        fetched: true,
        error: null,
      },
    });

    expect(suggestion.posture).toBe("SUGGESTION");
    expect(suggestion.customerType).toContain("客户");
    expect(suggestion.operatingConstraints).toContain("采购 owner 未确认");
    expect(suggestion.boundaryNote).toContain("suggestion");
    expect(suggestion.evidenceRefs.length).toBeGreaterThan(2);
  });
});
