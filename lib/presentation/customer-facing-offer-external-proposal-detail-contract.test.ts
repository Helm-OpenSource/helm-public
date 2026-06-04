import { describe, expect, it } from "vitest";
import {
  createCustomerFacingOfferPageDetailReportingContract,
  createExternalProposalPageDetailReportingContract,
  customerFacingOfferExternalProposalEvidenceGroupIds,
  toCustomerFacingOfferPageReportingProtocol,
  toExternalProposalPageReportingProtocol,
} from "@/lib/presentation/customer-facing-offer-external-proposal-detail-contract";

const baseEvidenceGroups =
  customerFacingOfferExternalProposalEvidenceGroupIds.map((groupId) => ({
    groupId,
    label: groupId,
    items: [`${groupId} item`],
  }));

describe("customer-facing offer / external proposal detail reporting contract", () => {
  it("keeps customer-facing offer detail contract aligned with the shared reporting protocol", () => {
    const contract = createCustomerFacingOfferPageDetailReportingContract({
      customerOfferPageJudgement:
        "当前 customer-facing offer 仍需带着 boundary note 一起出现。",
      customerOfferPageJudgementReason:
        "open commitment 仍在影响 trust boundary。",
      customerOfferPageActionSummary: [
        "Helm 已整理对外表达版本和当前边界说明。",
      ],
      customerOfferPageDecisionRequest: [
        "确认这版是否继续 safe-with-boundary，还是先退回 internal review。",
      ],
      customerOfferPageBoundarySummary: [
        "recommendation 仍不等于 commitment。",
      ],
      customerOfferPageEvidenceSummary: [
        "evidence drawer 已收住 replay / audit / sendability trace。",
      ],
      customerOfferPageWorkerSummary: [
        "sales worker 已准备下一版 outward-safe wording。",
      ],
      customerOfferPageNextAction: [
        { label: "打开 external proposal 页面", href: "/external-proposals/test" },
      ],
      customerOfferPageRiskSignal: "caution",
      customerOfferPageSendabilityMode: "safe_with_boundary",
      customerOfferPageEvidenceGroups: baseEvidenceGroups,
      customerOfferPageCustomerFacingCue:
        "只允许外发价值 framing，不允许说实 scope 和承诺。",
      customerOfferPageInternalOnlyCue:
        "scope negotiation note 和 dependency cleanup 仍只适合 internal-only。",
      customerOfferPageNonCommitmentCue:
        "这版 offer 仍属于 non-commitment wording。",
      pageWhyItMatters: ["当前窗口已经出现。", "sendability 仍需人工确认。"],
    });

    const protocol = toCustomerFacingOfferPageReportingProtocol(contract);
    expect(protocol.pageJudgement).toContain("offer");
    expect(protocol.pageBoundarySummary[0]).toContain("commitment");
    expect(protocol.pageNextAction).toHaveLength(1);
    expect(protocol.pagePrioritySignal).toBe("谨慎外发");
  });

  it("requires the full evidence grouping on external proposal detail pages", () => {
    expect(() =>
      createExternalProposalPageDetailReportingContract({
        externalProposalPageJudgement:
          "当前 external proposal 仍需 review-before-send。",
        externalProposalPageJudgementReason:
          "blocker 和 approval 仍未收口。",
        externalProposalPageActionSummary: [
          "Helm 已整理 external-safe wording 和 boundary notes。",
        ],
        externalProposalPageDecisionRequest: [
          "确认这版是否继续 discussion-only。",
        ],
        externalProposalPageBoundarySummary: [
          "discussion-only 不等于 commitment。",
        ],
        externalProposalPageEvidenceSummary: [
          "Evidence drawer 已挂好 boundary trace。",
        ],
        externalProposalPageWorkerSummary: [
          "sales worker 已整理 next-step call-to-action。",
        ],
        externalProposalPageNextAction: [
          { label: "打开审批中心", href: "/approvals" },
        ],
        externalProposalPageRiskSignal: "high",
        externalProposalPageSendabilityMode: "review_before_send",
        externalProposalPageEvidenceGroups: baseEvidenceGroups.slice(0, 6),
        externalProposalPageCustomerFacingCue:
          "当前只允许 external-safe wording 对外。",
        externalProposalPageInternalOnlyCue:
          "review note 仍只适合 internal-only。",
        externalProposalPageNonCommitmentCue:
          "proposal reinforcement 仍不等于 commitment。",
        externalProposalPageCollaborationMode: "helm_reminds_human_leads",
        externalProposalPageCollaborationSummary:
          "这版 proposal 还需要联合 review。",
        externalProposalPageCollaborationRequest:
          "先确认 sendability 和 review ownership。",
        externalProposalPageCollaborationNextStep: ["确认是否继续 review。"],
        externalProposalPageCollaborationOwner: "Sales owner + founder review",
        pageWhyItMatters: ["当前 trust pressure 在上升。", "对外措辞不能过早说实。"],
      }),
    ).toThrow("evidence group historical_changes must stay present");
  });

  it("maps external proposal detail contract into the shared reporting protocol", () => {
    const contract = createExternalProposalPageDetailReportingContract({
      externalProposalPageJudgement:
        "当前 external proposal 可以进入 send-ready review，但仍要把 non-commitment 明写在前台。",
      externalProposalPageJudgementReason:
        "Helm 已经整理 package framing、trust pressure 和当前 sendability。",
      externalProposalPageActionSummary: [
        "Helm 已收住 blocker、commitment 和 external-safe wording。"],
      externalProposalPageDecisionRequest: [
        "决定是继续 safe-with-boundary，还是先 review-before-send。",
      ],
      externalProposalPageBoundarySummary: [
        "discussion-only、boundary note 和 proposal reinforcement 仍不等于 commitment。",
      ],
      externalProposalPageEvidenceSummary: [
        "Evidence drawer 默认折叠，证据不会打断主叙事。",
      ],
      externalProposalPageWorkerSummary: [
        "sales / delivery / founder review 已整理同一套对外表达上下文。",
      ],
      externalProposalPageNextAction: [
        { label: "打开 customer-facing offer 页面", href: "/offers/test" },
      ],
      externalProposalPageRiskSignal: "caution",
      externalProposalPageSendabilityMode: "safe_with_boundary",
      externalProposalPageEvidenceGroups: baseEvidenceGroups,
      externalProposalPageCustomerFacingCue:
        "当前可以带边界地对外表达价值和下一步。",
      externalProposalPageInternalOnlyCue:
        "scope tension 和 dependency repair note 仍留在内部。",
      externalProposalPageNonCommitmentCue:
        "这版 external proposal 仍属于 non-commitment。",
      externalProposalPageCollaborationMode: "helm_prepares_human_decides",
      externalProposalPageCollaborationSummary:
        "这版 external proposal 已进入 send-ready review。",
      externalProposalPageCollaborationRequest:
        "先确认 sendability、review owner 和 reinforcement 强度。",
      externalProposalPageCollaborationNextStep: ["决定是否继续外发准备。"],
      externalProposalPageCollaborationOwner: "周玥 + founder review",
      pageWhyItMatters: ["这条机会正在升温。", "对外表达已经会影响信任。"],
    });

    const protocol = toExternalProposalPageReportingProtocol(contract);
    expect(protocol.pagePrioritySignal).toBe("谨慎外发");
    expect(protocol.pageEvidenceSummary[0]).toContain("Evidence drawer");
  });

  it("localizes priority signals for English offer and proposal detail protocols", () => {
    const customerOfferContract =
      createCustomerFacingOfferPageDetailReportingContract({
        customerOfferPageJudgement:
          "This customer-facing offer still needs boundary wording.",
        customerOfferPageJudgementReason:
          "Open commitment pressure is still visible.",
        customerOfferPageActionSummary: [
          "Helm prepared the outward-safe wording and current boundary notes.",
        ],
        customerOfferPageDecisionRequest: [
          "Confirm whether this remains safe-with-boundary.",
        ],
        customerOfferPageBoundarySummary: [
          "Recommendation still does not equal commitment.",
        ],
        customerOfferPageEvidenceSummary: [
          "The evidence drawer keeps replay, audit and sendability trace visible.",
        ],
        customerOfferPageWorkerSummary: [
          "Sales worker prepared the next outward-safe wording.",
        ],
        customerOfferPageNextAction: [
          { label: "Open external proposal page", href: "/external-proposals/test" },
        ],
        customerOfferPageRiskSignal: "high",
        customerOfferPageSendabilityMode: "review_before_send",
        customerOfferPageEvidenceGroups: baseEvidenceGroups,
        customerOfferPageCustomerFacingCue:
          "Use customer-facing value framing only.",
        customerOfferPageInternalOnlyCue:
          "Scope negotiation notes stay internal-only.",
        customerOfferPageNonCommitmentCue:
          "This offer remains non-commitment wording.",
        pageWhyItMatters: [
          "The current window is trust-sensitive.",
          "Sendability still needs human confirmation.",
        ],
      });
    const externalProposalContract =
      createExternalProposalPageDetailReportingContract({
        externalProposalPageJudgement:
          "This external proposal can move only with visible boundary wording.",
        externalProposalPageJudgementReason:
          "The proposal still has dependency pressure.",
        externalProposalPageActionSummary: [
          "Helm prepared external-safe wording and boundary notes.",
        ],
        externalProposalPageDecisionRequest: [
          "Decide whether this remains safe-with-boundary.",
        ],
        externalProposalPageBoundarySummary: [
          "Proposal reinforcement still does not equal commitment.",
        ],
        externalProposalPageEvidenceSummary: [
          "The evidence drawer keeps boundary trace visible.",
        ],
        externalProposalPageWorkerSummary: [
          "Sales and delivery review prepared the next expression.",
        ],
        externalProposalPageNextAction: [
          { label: "Open customer offer page", href: "/offers/test" },
        ],
        externalProposalPageRiskSignal: "watch",
        externalProposalPageSendabilityMode: "safe_with_boundary",
        externalProposalPageEvidenceGroups: baseEvidenceGroups,
        externalProposalPageCustomerFacingCue:
          "Use external-safe proposal wording only.",
        externalProposalPageInternalOnlyCue:
          "Scope tension and dependency repair notes stay internal-only.",
        externalProposalPageNonCommitmentCue:
          "This proposal remains non-commitment wording.",
        externalProposalPageCollaborationMode: "helm_prepares_human_decides",
        externalProposalPageCollaborationSummary:
          "The sendability review surface is prepared.",
        externalProposalPageCollaborationRequest:
          "Decide sendability before anything customer-visible leaves the system.",
        externalProposalPageCollaborationNextStep: [
          "Confirm whether founder, sales or delivery must co-sign.",
        ],
        externalProposalPageCollaborationOwner:
          "Sales owner + founder review",
        pageWhyItMatters: [
          "The current opportunity is warming.",
          "External expression can now affect trust.",
        ],
      });

    expect(
      toCustomerFacingOfferPageReportingProtocol(customerOfferContract, true)
        .pagePrioritySignal,
    ).toBe("High risk");
    expect(
      toExternalProposalPageReportingProtocol(externalProposalContract, true)
        .pagePrioritySignal,
    ).toBe("Keep watching");
  });
});
