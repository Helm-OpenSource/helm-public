import { describe, expect, it } from "vitest";
import type { ProposalPackageCommercialDetail } from "@/features/proposal-package/proposal-package-detail-view";
import { buildCommercialNarrativeStrengtheningPageContract } from "./detail-model";

const chineseDateFragments = /[年月日今天明天昨天未设置前后]/;

function buildDetail(): ProposalPackageCommercialDetail {
  return {
    id: "opp_commercial_narrative",
    title: "Narrative strengthening",
    stageCode: "ADVANCING",
    stageLabel: "Advancing",
    riskLabel: "Medium",
    riskLevel: "MEDIUM",
    companyName: "Demo Account",
    contactNames: ["Demo Buyer"],
    ownerName: "Demo Owner",
    dueDate: new Date(2026, 0, 15, 9, 30),
    updatedAt: new Date(Date.now() - 45 * 60 * 1000),
    nextAction: "Review narrative layer",
    memoryFacts: [],
    memoryEntries: [],
    commitments: [
      {
        id: "commitment_demo",
        title: "Keep scope caveat explicit",
        commitmentText: "Keep the caveat visible.",
        overdueFlag: false,
        status: "OPEN",
        dueDate: null,
      },
    ],
    blockers: [],
    actionItems: [],
    auditLogs: [
      {
        id: "audit_demo",
        actor: "Demo Owner",
        summary: "Narrative layer updated.",
        createdAt: new Date(Date.now() - 20 * 60 * 1000),
      },
    ],
    briefingSnapshot: null,
  };
}

describe("commercial narrative detail model bilingual dates", () => {
  it("keeps English historical-change dates free of Chinese fragments", () => {
    const contract = buildCommercialNarrativeStrengtheningPageContract({
      detail: buildDetail(),
      english: true,
    });
    const history = contract.strengtheningEvidenceGroups
      .find((group) => group.groupId === "historical_changes")
      ?.items.join(" ");

    expect(history).toContain("Last updated");
    expect(history).toContain("ago");
    expect(history).not.toMatch(chineseDateFragments);
  });

  it("keeps Chinese historical-change dates localized", () => {
    const contract = buildCommercialNarrativeStrengtheningPageContract({
      detail: buildDetail(),
      english: false,
    });
    const history = contract.strengtheningEvidenceGroups
      .find((group) => group.groupId === "historical_changes")
      ?.items.join(" ");

    expect(history).toContain("最近更新于");
    expect(history).toMatch(chineseDateFragments);
  });

  it("keeps English audit dates free of Chinese fragments", () => {
    const contract = buildCommercialNarrativeStrengtheningPageContract({
      detail: buildDetail(),
      english: true,
    });
    const audit = contract.strengtheningEvidenceGroups
      .find((group) => group.groupId === "audit")
      ?.items.join(" ");

    expect(audit).toContain("ago");
    expect(audit).not.toMatch(chineseDateFragments);
  });
});
