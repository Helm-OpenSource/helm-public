import { describe, expect, it } from "vitest";
import { buildSendabilityPageContract } from "@/features/commitment-reinforcement-sendability/detail-model";
import type { ProposalPackageCommercialDetail } from "@/features/proposal-package/proposal-package-detail-view";

function buildDetail(
  overrides: Partial<ProposalPackageCommercialDetail> = {},
): ProposalPackageCommercialDetail {
  return {
    id: "opp_discussion_only",
    title: "Renewal discussion",
    stageCode: "CONTACTED",
    stageLabel: "Contacted",
    riskLabel: "Low",
    riskLevel: "LOW",
    companyName: "Example Co",
    contactNames: ["Jordan Lee"],
    ownerName: "Casey",
    dueDate: null,
    updatedAt: new Date("2026-06-04T00:00:00.000Z"),
    nextAction: "Review the softer follow-up line",
    memoryFacts: [],
    memoryEntries: [],
    commitments: [
      {
        id: "commitment_1",
        title: "Draft timeline note",
        commitmentText: "Draft a softer timing note.",
        overdueFlag: false,
        status: "OPEN",
        dueDate: null,
      },
      {
        id: "commitment_2",
        title: "Confirm scope caveat",
        commitmentText: "Confirm the scope caveat remains visible.",
        overdueFlag: false,
        status: "OPEN",
        dueDate: null,
      },
    ],
    blockers: [],
    actionItems: [],
    auditLogs: [],
    briefingSnapshot: null,
    ...overrides,
  };
}

describe("commitment reinforcement / sendability detail model", () => {
  it("keeps English discussion-only sendability copy free of Chinese text", () => {
    const contract = buildSendabilityPageContract({
      detail: buildDetail(),
      english: true,
    });
    const rendered = JSON.stringify(contract);

    expect(contract.sendabilityPageMode).toBe("discussion-only");
    expect(contract.sendabilityPageJudgement).toContain("discussion-only");
    expect(contract.sendabilityPageJudgement).toContain("reinforcement");
    expect(rendered).not.toMatch(/[\u4e00-\u9fff]/);
  });
});
