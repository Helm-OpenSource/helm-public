import { describe, expect, it } from "vitest";
import type { ProposalPackageCommercialDetail } from "@/features/proposal-package/proposal-package-detail-view";
import {
  buildPackagePageContract,
  buildProposalPageContract,
} from "./detail-model";

const chineseDateFragments = /[年月日今天明天昨天前后未设置]/;

function buildDetail(): ProposalPackageCommercialDetail {
  return {
    id: "opp_demo",
    title: "Pilot proposal",
    stageCode: "PROPOSAL",
    stageLabel: "Proposal review",
    riskLabel: "Medium",
    riskLevel: "MEDIUM",
    companyName: "Demo Account",
    contactNames: ["Demo Buyer"],
    ownerName: "Demo Owner",
    dueDate: new Date(2026, 0, 15, 9, 30),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    nextAction: "Review package boundary",
    memoryFacts: [],
    memoryEntries: [],
    commitments: [],
    blockers: [],
    actionItems: [],
    auditLogs: [
      {
        id: "audit_demo",
        actor: "Demo Owner",
        summary: "Updated proposal scope",
        createdAt: new Date(Date.now() - 30 * 60 * 1000),
      },
    ],
    briefingSnapshot: null,
  };
}

function historicalItems(contract: ReturnType<typeof buildProposalPageContract>) {
  return contract.proposalPageEvidenceGroups.find(
    (group) => group.groupId === "historical_changes",
  )?.items;
}

describe("proposal/package detail model bilingual dates", () => {
  it("keeps proposal English evidence date labels free of Chinese fragments", () => {
    const contract = buildProposalPageContract({
      detail: buildDetail(),
      english: true,
    });

    const auditItem = contract.proposalPageEvidenceGroups.find(
      (group) => group.groupId === "audit",
    )?.items[0];
    const history = historicalItems(contract)?.join(" ");

    expect(auditItem).toContain("ago");
    expect(auditItem).not.toMatch(chineseDateFragments);
    expect(history).toContain("Last updated");
    expect(history).toContain("Current due date:");
    expect(history).not.toMatch(chineseDateFragments);
  });

  it("keeps package English evidence date labels free of Chinese fragments", () => {
    const contract = buildPackagePageContract({
      detail: buildDetail(),
      english: true,
    });
    const history = contract.packagePageEvidenceGroups
      .find((group) => group.groupId === "historical_changes")
      ?.items.join(" ");

    expect(history).toContain("Last updated");
    expect(history).toContain("Current due date:");
    expect(history).not.toMatch(chineseDateFragments);
  });

  it("keeps Chinese proposal evidence date labels localized", () => {
    const contract = buildProposalPageContract({
      detail: buildDetail(),
      english: false,
    });
    const history = historicalItems(contract)?.join(" ");

    expect(history).toMatch(chineseDateFragments);
    expect(history).toContain("当前截止时间");
  });
});
