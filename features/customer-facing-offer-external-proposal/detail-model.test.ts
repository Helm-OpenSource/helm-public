import { describe, expect, it } from "vitest";
import type { ProposalPackageCommercialDetail } from "@/features/proposal-package/proposal-package-detail-view";
import {
  buildCustomerFacingOfferPageContract,
  buildExternalProposalPageContract,
} from "./detail-model";

const chineseDateFragments = /[年月日今天明天昨天未设置前后]/;

function buildDetail(): ProposalPackageCommercialDetail {
  return {
    id: "opp_offer_external",
    title: "External offer wording",
    stageCode: "ADVANCING",
    stageLabel: "Advancing",
    riskLabel: "Medium",
    riskLevel: "MEDIUM",
    companyName: "Demo Account",
    contactNames: ["Demo Buyer"],
    ownerName: "Demo Owner",
    dueDate: new Date(2026, 0, 15, 9, 30),
    updatedAt: new Date(Date.now() - 45 * 60 * 1000),
    nextAction: "Review outward wording",
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
        summary: "External wording updated.",
        createdAt: new Date(Date.now() - 20 * 60 * 1000),
      },
    ],
    briefingSnapshot: null,
  };
}

describe("customer-facing offer external proposal bilingual dates", () => {
  it("keeps customer offer English evidence dates free of Chinese fragments", () => {
    const contract = buildCustomerFacingOfferPageContract({
      detail: buildDetail(),
      english: true,
    });
    const evidence = contract.customerOfferPageEvidenceGroups
      .filter(
        (group) =>
          group.groupId === "audit" || group.groupId === "historical_changes",
      )
      .flatMap((group) => group.items)
      .join(" ");

    expect(evidence).toContain("ago");
    expect(evidence).toContain("Current due date");
    expect(evidence).not.toMatch(chineseDateFragments);
  });

  it("keeps external proposal English evidence dates free of Chinese fragments", () => {
    const contract = buildExternalProposalPageContract({
      detail: buildDetail(),
      english: true,
    });
    const evidence = contract.externalProposalPageEvidenceGroups
      .filter(
        (group) =>
          group.groupId === "audit" || group.groupId === "historical_changes",
      )
      .flatMap((group) => group.items)
      .join(" ");

    expect(evidence).toContain("ago");
    expect(evidence).toContain("Current due date");
    expect(evidence).not.toMatch(chineseDateFragments);
  });

  it("keeps Chinese historical-change dates localized", () => {
    const contract = buildCustomerFacingOfferPageContract({
      detail: buildDetail(),
      english: false,
    });
    const history = contract.customerOfferPageEvidenceGroups
      .find((group) => group.groupId === "historical_changes")
      ?.items.join(" ");

    expect(history).toContain("最后更新于");
    expect(history).toMatch(chineseDateFragments);
  });
});
