import { describe, expect, it } from "vitest";
import type { ProposalPackageCommercialDetail } from "@/features/proposal-package/proposal-package-detail-view";
import { buildExternalNarrativeDetailPageContract } from "./detail-model";

const chineseDateFragments = /[年月日今天明天昨天未设置前后]/;

function buildDetail(): ProposalPackageCommercialDetail {
  return {
    id: "opp_external_narrative",
    title: "External narrative",
    stageCode: "ADVANCING",
    stageLabel: "Advancing",
    riskLabel: "Medium",
    riskLevel: "MEDIUM",
    companyName: "Demo Account",
    contactNames: ["Demo Buyer"],
    ownerName: "Demo Owner",
    dueDate: new Date(2026, 0, 15, 9, 30),
    updatedAt: new Date(Date.now() - 45 * 60 * 1000),
    nextAction: "Review narrative",
    memoryFacts: [],
    memoryEntries: [],
    commitments: [
      {
        id: "commitment_demo",
        title: "Keep dependency explicit",
        commitmentText: "Keep the delivery dependency visible.",
        overdueFlag: false,
        status: "OPEN",
        dueDate: null,
      },
    ],
    blockers: [],
    actionItems: [],
    auditLogs: [],
    briefingSnapshot: null,
  };
}

describe("external narrative detail model bilingual dates", () => {
  it("keeps English historical-change dates free of Chinese fragments", () => {
    const contract = buildExternalNarrativeDetailPageContract({
      detail: buildDetail(),
      english: true,
    });
    const history = contract.externalNarrativeDetailEvidenceGroups
      .find((group) => group.groupId === "historical_changes")
      ?.items.join(" ");

    expect(history).toContain("updated");
    expect(history).toContain("ago");
    expect(history).not.toMatch(chineseDateFragments);
  });

  it("keeps Chinese historical-change dates localized", () => {
    const contract = buildExternalNarrativeDetailPageContract({
      detail: buildDetail(),
      english: false,
    });
    const history = contract.externalNarrativeDetailEvidenceGroups
      .find((group) => group.groupId === "historical_changes")
      ?.items.join(" ");

    expect(history).toContain("最近更新于");
    expect(history).toMatch(chineseDateFragments);
  });
});
