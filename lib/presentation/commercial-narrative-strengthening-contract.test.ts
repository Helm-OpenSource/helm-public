import { describe, expect, it } from "vitest";
import {
  commercialNarrativeStrengtheningEvidenceGroupIds,
  createCommercialNarrativeStrengtheningDetailReportingContract,
  toCommercialNarrativeStrengtheningPageReportingProtocol,
} from "@/lib/presentation/commercial-narrative-strengthening-contract";

const baseEvidenceGroups = commercialNarrativeStrengtheningEvidenceGroupIds.map(
  (groupId) => ({
    groupId,
    label: groupId,
    items: [`${groupId} item`],
  }),
);

describe("commercial narrative strengthening detail reporting contract", () => {
  it("keeps strengthening contract aligned with the shared reporting protocol", () => {
    const contract = createCommercialNarrativeStrengtheningDetailReportingContract({
      strengtheningJudgement:
        "当前商业叙事应停在 pilot-strengthening，而不是越过边界直接说成 commitment。",
      strengtheningJudgementReason:
        "trust pressure 和 review gate 仍在限制 strengthening 的上限。",
      strengtheningActionSummary: [
        "Helm 已先把 recommendation-only、pilot-strengthening、review-before-send 和 non-commitment fallback 收到同一页里。",
      ],
      strengtheningDecisionRequest: [
        "确认下一版 strengthening 是保持 pilot-strengthening，还是退回 non-commitment fallback。",
      ],
      strengtheningBoundarySummary: [
        "exploratory、discussion-only、boundary-only 和 review-before-send wording 仍然不等于 commitment。",
      ],
      strengtheningEvidenceSummary: [
        "evidence drawer 已收住 replay / audit / memory / strengthening trace。",
      ],
      strengtheningWorkerSummary: [
        "sales worker 已准备下一版 strengthening cue 和 boundary note。",
      ],
      strengtheningNextAction: [
        {
          label: "打开 commercial strengthening 页面",
          href: "/commercial-strengthening/test",
        },
      ],
      strengtheningRiskSignal: "caution",
      strengtheningLevel: "pilot-strengthening",
      strengtheningIntent: "advance-pilot-story",
      strengtheningAudienceMode: "shared-review",
      strengtheningFallbackMode: "no-fallback",
      strengtheningSendabilityMode: "safe-with-boundary",
      strengtheningEvidenceGroups: baseEvidenceGroups,
      strengtheningCustomerVisibleCue:
        "当前可以对外强化清晰度，但不能暗示确定承诺。",
      strengtheningInternalOnlyCue:
        "trust-sensitive objection 和 send gate repair 仍留在内部。",
      strengtheningFallbackCue:
        "一旦 review 不通过，必须退回 non-commitment fallback。",
      pageWhyItMatters: ["当前窗口已经升温。", "strengthening 仍需人工拍板。"],
    });

    const protocol = toCommercialNarrativeStrengtheningPageReportingProtocol(contract);
    expect(protocol.pageJudgement).toContain("pilot-strengthening");
    expect(protocol.pageBoundarySummary[0]).toContain("commitment");
    expect(protocol.pageNextAction).toHaveLength(1);
    expect(
      toCommercialNarrativeStrengtheningPageReportingProtocol(contract, true)
        .pagePrioritySignal,
    ).toBe("Strengthen with caution");
  });

  it("requires the full evidence grouping on commercial strengthening pages", () => {
    expect(() =>
      createCommercialNarrativeStrengtheningDetailReportingContract({
        strengtheningJudgement:
          "当前 strengthening 仍 blocked-strengthening。",
        strengtheningJudgementReason:
          "risk mitigation 还没收口。",
        strengtheningActionSummary: [
          "Helm 已先把 blocked strengthening 和 fallback cue 收清。",
        ],
        strengtheningDecisionRequest: [
          "确认是否先退回 recommendation-only。",
        ],
        strengtheningBoundarySummary: [
          "blocked strengthening 不能被包装成 customer-visible reinforcement。",
        ],
        strengtheningEvidenceSummary: [
          "Evidence drawer 已挂好 strengthening trace。",
        ],
        strengtheningWorkerSummary: ["sales worker 已整理 risk note。"],
        strengtheningNextAction: [
          { label: "打开 sendability 页面", href: "/sendability/test" },
        ],
        strengtheningRiskSignal: "high",
        strengtheningLevel: "blocked-strengthening",
        strengtheningIntent: "hold-review-line",
        strengtheningAudienceMode: "internal-only",
        strengtheningFallbackMode: "blocked",
        strengtheningSendabilityMode: "not-safe-to-send",
        strengtheningEvidenceGroups: baseEvidenceGroups.slice(0, 8),
        strengtheningCustomerVisibleCue:
          "当前没有任何 strengthening 可以安全对外。",
        strengtheningInternalOnlyCue:
          "blocked note 仍只适合 internal-only。",
        strengtheningFallbackCue:
          "当前必须退回 non-commitment fallback。",
        pageWhyItMatters: ["当前风险在上升。", "强说只会伤害 trust。"],
      }),
    ).toThrow("evidence group historical_changes must stay present");
  });
});
