import { describe, expect, it } from "vitest";
import { buildSuccessCheckDetailPageModel } from "./detail-model";

const chineseDateFragments = /[年月日今天明天昨天未设置]/;

function buildModel(english: boolean) {
  return buildSuccessCheckDetailPageModel({
    detail: {
      id: "opp_success_check",
      title: "Renewal readiness",
      riskLevel: "MEDIUM",
      nextAction: "Confirm next bounded move",
      dueDate: null,
      updatedAt: new Date(2026, 0, 16, 10, 0),
      company: { id: "company_demo", name: "Demo Account" },
      contacts: [{ id: "contact_demo", name: "Demo Buyer" }],
      owner: { id: "owner_demo", name: "Demo Owner" },
      actionItems: [],
      meetings: [],
      emailThreads: [],
      memoryFacts: [],
      commitments: [],
      blockers: [],
      briefingSnapshot: null,
      auditLogs: [],
    },
    company: {
      id: "company_demo",
      name: "Demo Account",
      industry: null,
      contacts: [{ id: "contact_demo", name: "Demo Buyer" }],
      meetings: [],
      opportunities: [],
      memoryEntries: [],
      briefingSnapshot: null,
    },
    reviewTasks: [
      {
        id: "review_demo",
        status: "EXECUTED",
        createdAt: new Date(2026, 0, 15, 8, 30),
        updatedAt: new Date(2026, 0, 15, 9, 30),
        reviewedAt: new Date(2026, 0, 15, 9, 30),
        reviewedBy: { id: "reviewer_demo", name: "Demo Reviewer" },
        approver: { name: "Demo Approver" },
        actionItem: {
          id: "action_demo",
          title: "Review readiness",
          actionType: "REVIEW",
          description: null,
        },
      },
    ],
    stageLabel: english ? "Success review" : "成功复核",
    currentUserId: "reviewer_demo",
    english,
  });
}

describe("success check detail bilingual dates", () => {
  it("keeps English review touch and recent-change dates free of Chinese fragments", () => {
    const model = buildModel(true);
    const lastTouch = model.secondarySummaryItems.find(
      (item) => item.label === "Last explicit user touch",
    )?.value;
    const recentChanges = model.recentChangesItems.join(" ");

    expect(lastTouch).toContain("Demo Reviewer reviewed this on");
    expect(lastTouch).not.toMatch(chineseDateFragments);
    expect(recentChanges).toContain("Since");
    expect(recentChanges).not.toMatch(chineseDateFragments);
  });

  it("keeps Chinese review touch and recent-change dates localized", () => {
    const model = buildModel(false);
    const lastTouch = model.secondarySummaryItems.find(
      (item) => item.label === "最近一次显式用户触点",
    )?.value;
    const recentChanges = model.recentChangesItems.join(" ");

    expect(lastTouch).toContain("复核了这条成功检查");
    expect(lastTouch).toMatch(chineseDateFragments);
    expect(recentChanges).toContain("自");
    expect(recentChanges).toMatch(chineseDateFragments);
  });
});
