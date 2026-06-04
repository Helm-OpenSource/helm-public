import { describe, expect, it } from "vitest";
import {
  conversationDetailEvidenceGroupIds,
  createConversationDetailReportingContract,
  toConversationDetailPageReportingProtocol,
} from "@/lib/presentation/conversation-detail-contract";

const baseEvidenceGroups = conversationDetailEvidenceGroupIds.map((groupId) => ({
  groupId,
  label: groupId,
  items: [`${groupId} item`],
}));

describe("conversation detail reporting contract", () => {
  it("keeps conversation detail aligned with the shared reporting protocol", () => {
    const contract = createConversationDetailReportingContract({
      conversationDetailJudgement:
        "当前 conversation 应停在 founder-demo，并保持 safe-with-boundary，而不是把下一句说成 commitment。",
      conversationDetailJudgementReason:
        "当前 trust pressure 仍要求 founder scene、boundary line 和 next ask 一起出现。",
      conversationDetailActionSummary: [
        "Helm 已先把 founder、sales 和 delivery 可用话术收在同一页 conversation detail 里。",
      ],
      conversationDetailDecisionRequest: [
        "确认当前是继续 founder-demo，还是先退回 review-before-send。",
      ],
      conversationDetailBoundarySummary: [
        "conversation guidance 可以改变重点、节奏和场景适配，但它仍然不能悄悄把 discussion-safe wording 变成 commitment。",
      ],
      conversationDetailEvidenceSummary: [
        "evidence drawer 已收住 replay / audit / memory / conversation trace。",
      ],
      conversationDetailWorkerSummary: [
        "sales worker 已整理下一轮 founder demo cue。",
      ],
      conversationDetailNextAction: [
        { label: "打开 conversation 页面", href: "/conversations/test" },
      ],
      conversationDetailRiskSignal: "caution",
      conversationDetailAudienceMode: "founder-led",
      conversationDetailIntent: "warm-up-context",
      conversationDetailMode: "founder-demo",
      conversationDetailSendabilityMode: "safe-with-boundary",
      conversationDetailEvidenceGroups: baseEvidenceGroups,
      conversationDetailFounderCue:
        "Founder 先讲 operating judgement 和 reversible confidence，不提前说成承诺。",
      conversationDetailSalesCue:
        "Sales 只复用 boundary-safe wording，不替 founder 说实 outcome。",
      conversationDetailDeliveryCue:
        "Delivery 在 scope / dependency 触发时补 caveat。",
      pageWhyItMatters: ["当前窗口已经出现。", "边界仍需显式可见。"],
    });

    const protocol = toConversationDetailPageReportingProtocol(contract);
    expect(protocol.pageJudgement).toContain("founder-demo");
    expect(protocol.pageBoundarySummary[0]).toContain("commitment");
    expect(protocol.pageNextAction).toHaveLength(1);
    expect(
      toConversationDetailPageReportingProtocol(contract, true)
        .pagePrioritySignal,
    ).toBe("Communicate with caution");
  });

  it("requires the full evidence grouping on conversation pages", () => {
    expect(() =>
      createConversationDetailReportingContract({
        conversationDetailJudgement: "当前 conversation 仍需 review-before-send。",
        conversationDetailJudgementReason: "当前 approval pressure 还没收口。",
        conversationDetailActionSummary: [
          "Helm 已先把 scene、boundary 和 next ask 收到同一页里。",
        ],
        conversationDetailDecisionRequest: [
          "确认是否先停在 internal-prep-only。",
        ],
        conversationDetailBoundarySummary: [
          "review-before-send 的 conversation 不能被讲成 customer-visible 承诺。",
        ],
        conversationDetailEvidenceSummary: [
          "evidence drawer 已挂好 conversation trace。",
        ],
        conversationDetailWorkerSummary: ["sales worker 已整理 review note。"],
        conversationDetailNextAction: [
          { label: "打开 package 页面", href: "/packages/test" },
        ],
        conversationDetailRiskSignal: "high",
        conversationDetailAudienceMode: "shared-review",
        conversationDetailIntent: "protect-non-commitment",
        conversationDetailMode: "review-before-send",
        conversationDetailSendabilityMode: "review-before-send",
        conversationDetailEvidenceGroups: baseEvidenceGroups.slice(0, 8),
        conversationDetailFounderCue: "Founder 暂不把这句话往外说。",
        conversationDetailSalesCue: "Sales 先停在 discussion-only。",
        conversationDetailDeliveryCue: "Delivery 保留 dependency note。",
        pageWhyItMatters: ["当前 approval pressure 在上升。", "边界不能被埋掉。"],
      }),
    ).toThrow("evidence group historical_changes must stay present");
  });
});
