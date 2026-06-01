import { describe, expect, it } from "vitest";
import {
  commitmentReinforcementSendabilityEvidenceGroupIds,
  createCommitmentReinforcementPageDetailReportingContract,
  createSendabilityPageDetailReportingContract,
  toCommitmentReinforcementPageReportingProtocol,
  toSendabilityPageReportingProtocol,
} from "@/lib/presentation/commitment-reinforcement-sendability-detail-contract";

const baseEvidenceGroups =
  commitmentReinforcementSendabilityEvidenceGroupIds.map((groupId) => ({
    groupId,
    label: groupId,
    items: [`${groupId} item`],
  }));

describe("commitment reinforcement / sendability detail reporting contract", () => {
  it("keeps reinforcement detail contract aligned with the shared reporting protocol", () => {
    const contract = createCommitmentReinforcementPageDetailReportingContract({
      reinforcementPageJudgement:
        "当前只允许 boundary-only reinforcement，不允许把 recommendation 说成 commitment。",
      reinforcementPageJudgementReason:
        "open commitment 和 trust pressure 仍在影响强化边界。",
      reinforcementPageActionSummary: [
        "Helm 已整理 reinforcement 候选、边界和 internal-only review note。",
      ],
      reinforcementPageDecisionRequest: [
        "确认这版是否继续 boundary-only reinforcement。",
      ],
      reinforcementPageBoundarySummary: [
        "recommendation、discussion-only 和 boundary-only reinforcement 仍然不等于 commitment。",
      ],
      reinforcementPageEvidenceSummary: [
        "evidence drawer 已收住 replay / audit / reinforcement trace。",
      ],
      reinforcementPageWorkerSummary: [
        "sales worker 已准备下一版可审阅的 strengthening cue。",
      ],
      reinforcementPageNextAction: [
        { label: "打开 sendability 页面", href: "/sendability/test" },
      ],
      reinforcementPageRiskSignal: "caution",
      reinforcementPageStrengthMode: "boundary-only-reinforcement",
      reinforcementPageSendabilityMode: "safe-with-boundary",
      reinforcementPageEvidenceGroups: baseEvidenceGroups,
      reinforcementPageCustomerVisibleCue:
        "当前只允许带边界的 customer-visible strengthening。",
      reinforcementPageInternalOnlyCue:
        "scope tension 和 trust-sensitive objection 仍只适合 internal-only。",
      reinforcementPageNonCommitmentCue:
        "这版强化仍属于 non-commitment wording。",
      pageWhyItMatters: ["当前窗口已经出现。", "reinforcement 仍需人工确认。"],
    });

    const protocol = toCommitmentReinforcementPageReportingProtocol(contract);
    expect(protocol.pageJudgement).toContain("reinforcement");
    expect(protocol.pageBoundarySummary[0]).toContain("commitment");
    expect(protocol.pageNextAction).toHaveLength(1);
  });

  it("requires the full evidence grouping on sendability detail pages", () => {
    expect(() =>
      createSendabilityPageDetailReportingContract({
        sendabilityPageJudgement:
          "当前 sendability 仍是 review-before-send。",
        sendabilityPageJudgementReason:
          "approval-sensitive 动作仍未收口。",
        sendabilityPageActionSummary: [
          "Helm 已整理 send gate、boundary 和 review note。",
        ],
        sendabilityPageDecisionRequest: [
          "确认这版是否继续 review-before-send。",
        ],
        sendabilityPageBoundarySummary: [
          "review-before-send 仍优先于任何想要暗示 commitment 的 wording。",
        ],
        sendabilityPageEvidenceSummary: [
          "Evidence drawer 已挂好 sendability trace。",
        ],
        sendabilityPageWorkerSummary: [
          "sales worker 已整理 next outward-safe move。",
        ],
        sendabilityPageNextAction: [
          { label: "打开审批中心", href: "/approvals" },
        ],
        sendabilityPageRiskSignal: "high",
        sendabilityPageMode: "review-before-send",
        sendabilityPageStrengthMode: "reinforcement-after-review",
        sendabilityPageEvidenceGroups: baseEvidenceGroups.slice(0, 7),
        sendabilityPageCustomerVisibleCue:
          "当前没有任何 wording 能绕过 send gate。",
        sendabilityPageInternalOnlyCue:
          "review note 仍只适合 internal-only。",
        sendabilityPageNonCommitmentCue:
          "discussion-only 和 review-before-send 仍不等于 commitment。",
        pageWhyItMatters: ["当前 trust pressure 在上升。", "send gate 不能被绕过。"],
      }),
    ).toThrow("evidence group historical_changes must stay present");
  });

  it("maps sendability detail contract into the shared reporting protocol", () => {
    const contract = createSendabilityPageDetailReportingContract({
      sendabilityPageJudgement:
        "当前 sendability 已经进入 safe-with-boundary，但 send-safe 仍不等于 commitment-safe。",
      sendabilityPageJudgementReason:
        "Helm 已整理 boundary trace、review note 和当前 strengthening 压力。",
      sendabilityPageActionSummary: [
        "Helm 已收住 blocker、boundary 和 sendability gate。",
      ],
      sendabilityPageDecisionRequest: [
        "决定是继续 safe-with-boundary，还是先退回 review-before-send。",
      ],
      sendabilityPageBoundarySummary: [
        "discussion-only、review-before-send 和 not-safe-to-send 仍优先于任何想要暗示 commitment 的表达。",
      ],
      sendabilityPageEvidenceSummary: [
        "Evidence drawer 默认折叠，sendability trace 不会打断主叙事。",
      ],
      sendabilityPageWorkerSummary: [
        "sales / founder review 已整理同一套 sendability 上下文。",
      ],
      sendabilityPageNextAction: [
        { label: "打开 reinforcement 页面", href: "/reinforcements/test" },
      ],
      sendabilityPageRiskSignal: "caution",
      sendabilityPageMode: "safe-with-boundary",
      sendabilityPageStrengthMode: "boundary-only-reinforcement",
      sendabilityPageEvidenceGroups: baseEvidenceGroups,
      sendabilityPageCustomerVisibleCue:
        "当前可以带边界地对外表达价值和下一步。",
      sendabilityPageInternalOnlyCue:
        "scope tension 和 dependency repair note 仍留在内部。",
      sendabilityPageNonCommitmentCue:
        "safe-to-send 仍不等于 commitment-safe。",
      pageWhyItMatters: ["这条机会正在升温。", "sendability 已经会影响信任。"],
    });

    const protocol = toSendabilityPageReportingProtocol(contract);
    expect(protocol.pagePrioritySignal).toBe("谨慎强化");
    expect(protocol.pageEvidenceSummary[0]).toContain("Evidence drawer");
  });
});
