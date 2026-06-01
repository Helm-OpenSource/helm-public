import { describe, expect, it } from "vitest";
import {
  createFollowupDetailReportingContract,
  createInboxDetailReportingContract,
  createReviewRequestDetailReportingContract,
  inboxFollowupReviewRequestEvidenceGroupIds,
  toFollowupDetailPageReportingProtocol,
  toInboxDetailPageReportingProtocol,
  toReviewRequestDetailPageReportingProtocol,
} from "@/lib/presentation/inbox-followup-review-request-detail-contract";

const baseEvidenceGroups = inboxFollowupReviewRequestEvidenceGroupIds.map(
  (groupId) => ({
    groupId,
    label: groupId,
    items: [`${groupId} item`],
  }),
);

describe("inbox / follow-up / review request detail reporting contract", () => {
  it("keeps inbox detail aligned with the shared reporting protocol", () => {
    const contract = createInboxDetailReportingContract({
      inboxDetailJudgement:
        "当前 inbox detail 应先停在线程判断层，再决定是否进入 follow-up 或 review。",
      inboxDetailJudgementReason:
        "当前线程仍在等待我方动作，不能跳过 boundary 直接生成 customer-facing 回复。",
      inboxDetailActionSummary: [
        "Helm 已先把线程、角色、边界和下一步动作收在同一页里。",
      ],
      inboxDetailDecisionRequest: ["确认现在是进入 follow-up，还是先停在 internal review。"],
      inboxDetailBoundarySummary: [
        "线程回复建议不能被误讲成对外 commitment。",
      ],
      inboxDetailEvidenceSummary: ["evidence drawer 已收住 replay / audit / handoff trace。"],
      inboxDetailWorkerSummary: ["worker 已整理线程摘要与 handoff cue。"],
      inboxDetailNextAction: [{ label: "打开 inbox detail", href: "/inbox/test" }],
      inboxDetailRiskSignal: "caution",
      inboxDetailAudienceMode: "shared-review",
      inboxDetailScene: "inbox-customer-thread",
      inboxDetailSendabilityMode: "review-before-send",
      inboxDetailEvidenceGroups: baseEvidenceGroups,
      pageWhyItMatters: ["当前线程正在等待我方动作。", "边界不能先消失。"],
    });

    const protocol = toInboxDetailPageReportingProtocol(contract);
    expect(protocol.pageJudgement).toContain("inbox detail");
    expect(protocol.pageBoundarySummary[0]).toContain("commitment");
  });

  it("keeps follow-up detail aligned with the shared reporting protocol", () => {
    const contract = createFollowupDetailReportingContract({
      followupDetailJudgement:
        "当前 follow-up 应停在 ready-to-review，而不是直接发出 customer-facing 承诺。",
      followupDetailJudgementReason:
        "当前 still needs review-before-send 才能继续往外走。",
      followupDetailActionSummary: ["Helm 已整理好 draft、boundary 和 next ask。"],
      followupDetailDecisionRequest: ["确认是继续 review，还是退回 conversation。"],
      followupDetailBoundarySummary: ["follow-up wording 仍不能被误读成 commitment。"],
      followupDetailEvidenceSummary: ["evidence drawer 已挂好 draft trace。"],
      followupDetailWorkerSummary: ["sales worker 已整理 follow-up cue。"],
      followupDetailNextAction: [
        { label: "打开 follow-up detail", href: "/follow-ups/test" },
      ],
      followupDetailRiskSignal: "watch",
      followupDetailAudienceMode: "customer-visible",
      followupDetailScene: "followup-ready-to-review",
      followupDetailSendabilityMode: "safe-with-boundary",
      followupDetailEvidenceGroups: baseEvidenceGroups,
      pageWhyItMatters: ["跟进窗口已经出现。", "当前仍需边界。"],
    });

    const protocol = toFollowupDetailPageReportingProtocol(contract);
    expect(protocol.pageJudgement).toContain("follow-up");
    expect(protocol.pageNextAction).toHaveLength(1);
  });

  it("requires the full evidence grouping on review request pages", () => {
    expect(() =>
      createReviewRequestDetailReportingContract({
        reviewRequestDetailJudgement:
          "当前 review request 仍需 escalated review。",
        reviewRequestDetailJudgementReason:
          "当前 high-risk request 还不能直接下放执行。",
        reviewRequestDetailActionSummary: ["Helm 已整理审批原因和下一步。"],
        reviewRequestDetailDecisionRequest: ["确认由谁接手 review。"],
        reviewRequestDetailBoundarySummary: [
          "review request detail 不能被写成已批准的 commitment。",
        ],
        reviewRequestDetailEvidenceSummary: ["evidence drawer 已挂好 review trace。"],
        reviewRequestDetailWorkerSummary: ["worker 已整理 review request cue。"],
        reviewRequestDetailNextAction: [
          {
            label: "打开 review request detail",
            href: "/review-requests/test",
          },
        ],
        reviewRequestDetailRiskSignal: "high",
        reviewRequestDetailAudienceMode: "shared-review",
        reviewRequestDetailScene: "review-request-escalated",
        reviewRequestDetailSendabilityMode: "internal-only",
        reviewRequestDetailEvidenceGroups: baseEvidenceGroups.slice(0, 7),
        pageWhyItMatters: ["当前 review pressure 在上升。", "边界不能被埋掉。"],
      }),
    ).toThrow("evidence group historical_changes must stay present");
  });

  it("keeps review request detail aligned with the shared reporting protocol", () => {
    const contract = createReviewRequestDetailReportingContract({
      reviewRequestDetailJudgement:
        "当前 review request 应停在 escalated review，再决定 founder / sales / delivery 谁接手。",
      reviewRequestDetailJudgementReason:
        "当前 approval-sensitive wording 仍需 review-before-send。",
      reviewRequestDetailActionSummary: ["Helm 已整理审批上下文、边界和接手人。"],
      reviewRequestDetailDecisionRequest: ["确认当前 review owner。"],
      reviewRequestDetailBoundarySummary: [
        "approval request 不等于已经执行，也不等于对外 commitment。",
      ],
      reviewRequestDetailEvidenceSummary: ["evidence drawer 已收住 review trace。"],
      reviewRequestDetailWorkerSummary: ["worker 已整理 approval evidence。"],
      reviewRequestDetailNextAction: [
        {
          label: "打开 review request detail",
          href: "/review-requests/test",
        },
      ],
      reviewRequestDetailRiskSignal: "high",
      reviewRequestDetailAudienceMode: "shared-review",
      reviewRequestDetailScene: "review-request-pending",
      reviewRequestDetailSendabilityMode: "review-before-send",
      reviewRequestDetailEvidenceGroups: baseEvidenceGroups,
      pageWhyItMatters: ["当前审批请求已进入窗口。", "接手人还需要明确。"],
    });

    const protocol = toReviewRequestDetailPageReportingProtocol(contract);
    expect(protocol.pageJudgement).toContain("review request");
    expect(protocol.pageBoundarySummary[0]).toContain("commitment");
  });
});
