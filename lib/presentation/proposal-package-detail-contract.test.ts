import { describe, expect, it } from "vitest";
import {
  createPackagePageDetailReportingContract,
  createProposalPageDetailReportingContract,
  proposalPackageEvidenceGroupIds,
  toPackagePageReportingProtocol,
  toProposalPageReportingProtocol,
} from "@/lib/presentation/proposal-package-detail-contract";

const baseEvidenceGroups = proposalPackageEvidenceGroupIds.map((groupId) => ({
  groupId,
  label: groupId,
  items: [`${groupId} item`],
}));

describe("proposal / package detail reporting contract", () => {
  it("keeps proposal detail contract aligned with the shared reporting protocol", () => {
    const contract = createProposalPageDetailReportingContract({
      proposalPageJudgement: "当前 proposal 只适合 internal review",
      proposalPageJudgementReason: "blocker 和 commitment 仍未收口。",
      proposalPageActionSummary: ["Helm 已整理 briefing 和 blocker 上下文。"],
      proposalPageDecisionRequest: ["确认这版 framing 是继续内评还是转入 customer-safe review。"],
      proposalPageBoundarySummary: ["当前 recommendation 仍不等于 commitment。"],
      proposalPageEvidenceSummary: ["evidence drawer 已收住 replay / audit / memory。"],
      proposalPageWorkerSummary: ["sales worker 已准备下一版 framing。"],
      proposalPageNextAction: [{ label: "打开机会详情", href: "/opportunities?opportunityId=test" }],
      proposalPageRiskSignal: "caution",
      proposalPageAudienceMode: "internal_review",
      proposalPageEvidenceGroups: baseEvidenceGroups,
      pageWhyItMatters: ["当前窗口已形成。", "边界仍需人工确认。"],
    });

    const protocol = toProposalPageReportingProtocol(contract);
    expect(protocol.pageJudgement).toContain("proposal");
    expect(protocol.pageBoundarySummary[0]).toContain("commitment");
    expect(protocol.pageNextAction).toHaveLength(1);
  });

  it("requires the full evidence grouping on package detail pages", () => {
    expect(() =>
      createPackagePageDetailReportingContract({
        packagePageJudgement: "当前 package 需要 sales / delivery 共看",
        packagePageJudgementReason: "scope 和 dependency 还没完全确认。",
        packagePageActionSummary: ["Helm 已经整理 scope 和 delivery risk note。"],
        packagePageDecisionRequest: ["确认这版 package 是否能进入 customer-safe 版本。"],
        packagePageBoundarySummary: ["最终 package wording 仍不能直接变成外部承诺。"],
        packagePageEvidenceSummary: ["evidence drawer 已挂好 boundary trace。"],
        packagePageWorkerSummary: ["delivery worker 已把 dependency note 挂出来。"],
        packagePageNextAction: [{ label: "打开 package 页面", href: "/packages/test" }],
        packagePageRiskSignal: "watch",
        packagePageAudienceMode: "non_commitment_window",
        packagePageEvidenceGroups: baseEvidenceGroups.slice(0, 5),
        packagePageCollaborationMode: "helm_prepares_human_decides",
        packagePageCollaborationSummary: "这版 package 需要共同 review。",
        packagePageCollaborationRequest: "先确认 scope 和 trust boundary。",
        packagePageCollaborationNextStep: ["确认是否继续外部推进。"],
        packagePageCollaborationOwner: "Sales owner + delivery review",
        pageWhyItMatters: ["节奏窗口已经出现。", "边界还没收口。"],
      }),
    ).toThrow("evidence group historical_changes must stay present");
  });

  it("maps package detail contract into the shared reporting protocol", () => {
    const contract = createPackagePageDetailReportingContract({
      packagePageJudgement: "当前 package 可以继续整理，但仍需人工拍板",
      packagePageJudgementReason: "Helm 已准备范围和依赖摘要，但 customer-facing promise 还不能固化。",
      packagePageActionSummary: ["Helm 已收住 blocker、commitment 和 approval 线索。"],
      packagePageDecisionRequest: ["决定是继续内评、先开 review，还是保持 non-commitment。"],
      packagePageBoundarySummary: ["任何 customer-facing 承诺都仍需人工确认。"],
      packagePageEvidenceSummary: ["Evidence drawer 默认折叠，证据不会打断主叙事。"],
      packagePageWorkerSummary: ["sales / delivery worker 已整理同一套协作上下文。"],
      packagePageNextAction: [{ label: "打开 package 页面", href: "/packages/test" }],
      packagePageRiskSignal: "high",
      packagePageAudienceMode: "customer_safe_review",
      packagePageEvidenceGroups: baseEvidenceGroups,
      packagePageCollaborationMode: "helm_drives_human_supervises",
      packagePageCollaborationSummary: "这版 package 进入 sales / delivery 协作窗口。",
      packagePageCollaborationRequest: "先一起 review scope、dependency 和 wording。",
      packagePageCollaborationNextStep: ["决定能否 customer-safe 化。"],
      packagePageCollaborationOwner: "周玥 + 交付评审",
      pageWhyItMatters: ["这条机会正在变热。", "如果拖延会影响信任和节奏。"],
    });

    const protocol = toPackagePageReportingProtocol(contract);
    expect(protocol.pagePrioritySignal).toBe("高风险");
    expect(protocol.pageEvidenceSummary[0]).toContain("Evidence drawer");
  });
});
