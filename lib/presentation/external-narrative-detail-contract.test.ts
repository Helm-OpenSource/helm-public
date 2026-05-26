import { describe, expect, it } from "vitest";
import {
  createExternalNarrativeDetailReportingContract,
  externalNarrativeDetailEvidenceGroupIds,
  toExternalNarrativeDetailPageReportingProtocol,
} from "@/lib/presentation/external-narrative-detail-contract";

const baseEvidenceGroups = externalNarrativeDetailEvidenceGroupIds.map(
  (groupId) => ({
    groupId,
    label: groupId,
    items: [`${groupId} item`],
  }),
);

describe("external narrative detail reporting contract", () => {
  it("keeps external narrative detail aligned with the shared reporting protocol", () => {
    const contract = createExternalNarrativeDetailReportingContract({
      externalNarrativeDetailJudgement:
        "当前 external narrative 应停在 proposal-supporting-narrative，并保持 discussion-only 与 no-fallback 显式可见。",
      externalNarrativeDetailJudgementReason:
        "当前 trust line 已经升温，但还不适合越过 proposal-supporting narrative 进入更强表达。",
      externalNarrativeDetailActionSummary: [
        "Helm 已先把 internal framing、proposal-supporting、customer-visible 和 fallback-safe narrative 收到同一页里。",
      ],
      externalNarrativeDetailDecisionRequest: [
        "确认当前是继续 proposal-supporting narrative，还是先退回 boundary-only。",
      ],
      externalNarrativeDetailBoundarySummary: [
        "external narrative 可以提高清晰度和信心，但它仍然不能悄悄把 recommendation 硬化成 commitment。",
      ],
      externalNarrativeDetailEvidenceSummary: [
        "evidence drawer 已收住 replay / audit / memory / narrative trace。",
      ],
      externalNarrativeDetailWorkerSummary: [
        "sales worker 已整理下一轮 proposal-supporting cue。",
      ],
      externalNarrativeDetailNextAction: [
        {
          label: "打开 external narrative 页面",
          href: "/external-narratives/test",
        },
      ],
      externalNarrativeDetailRiskSignal: "caution",
      externalNarrativeDetailAudienceMode: "shared-review",
      externalNarrativeDetailIntent: "support-proposal",
      externalNarrativeDetailLevel: "proposal-supporting-narrative",
      externalNarrativeDetailFallbackMode: "no-fallback",
      externalNarrativeDetailSendabilityMode: "discussion-only",
      externalNarrativeDetailEvidenceGroups: baseEvidenceGroups,
      externalNarrativeDetailFounderCue:
        "Founder 只在 trust line 需要更高层 framing 时介入。",
      externalNarrativeDetailSalesCue:
        "Sales 只把当前 narrative 说到 discussion-safe 的程度。",
      externalNarrativeDetailDeliveryCue:
        "Delivery 继续把 scope / dependency caveat 挂在前台。",
      pageWhyItMatters: ["当前窗口已经升温。", "fallback 仍需人工确认。"],
    });

    const protocol = toExternalNarrativeDetailPageReportingProtocol(contract);
    expect(protocol.pageJudgement).toContain("proposal-supporting");
    expect(protocol.pageBoundarySummary[0]).toContain("commitment");
    expect(protocol.pageNextAction).toHaveLength(1);
  });

  it("requires the full evidence grouping on external narrative pages", () => {
    expect(() =>
      createExternalNarrativeDetailReportingContract({
        externalNarrativeDetailJudgement:
          "当前 external narrative 仍 blocked-narrative。",
        externalNarrativeDetailJudgementReason:
          "当前 boundary pressure 和 fallback pressure 还没收口。",
        externalNarrativeDetailActionSummary: [
          "Helm 已先把 blocked narrative 与 fallback cue 收清。",
        ],
        externalNarrativeDetailDecisionRequest: [
          "确认是否先退回 non-commitment fallback。",
        ],
        externalNarrativeDetailBoundarySummary: [
          "blocked narrative 不能被包装成 customer-visible 承诺。",
        ],
        externalNarrativeDetailEvidenceSummary: [
          "Evidence drawer 已挂好 narrative trace。",
        ],
        externalNarrativeDetailWorkerSummary: [
          "sales worker 已整理 review hold note。",
        ],
        externalNarrativeDetailNextAction: [
          { label: "打开 conversation 页面", href: "/conversations/test" },
        ],
        externalNarrativeDetailRiskSignal: "high",
        externalNarrativeDetailAudienceMode: "internal-only",
        externalNarrativeDetailIntent: "reduce-risk",
        externalNarrativeDetailLevel: "blocked-narrative",
        externalNarrativeDetailFallbackMode: "blocked",
        externalNarrativeDetailSendabilityMode: "not-safe-to-send",
        externalNarrativeDetailEvidenceGroups: baseEvidenceGroups.slice(0, 8),
        externalNarrativeDetailFounderCue: "Founder 暂不把这层 story 往外说。",
        externalNarrativeDetailSalesCue: "Sales 先停在 boundary-only。",
        externalNarrativeDetailDeliveryCue: "Delivery 保留 blocked note。",
        pageWhyItMatters: ["当前 boundary 在拉响。", "不能把 blocked 讲成 promise。"],
      }),
    ).toThrow("evidence group historical_changes must stay present");
  });
});
