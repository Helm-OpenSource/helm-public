import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/components/providers/workspace-ui-provider", () => ({
  useWorkspaceUi: () => ({ locale: "zh-CN" }),
}));
vi.mock("@/features/member-signal-candidates/actions", () => ({
  promoteMemberSignalCandidateToTaskAction: vi.fn(),
  reviewMemberSignalCandidateAction: vi.fn(),
}));

import { MemberSignalCandidateReviewPanel } from "@/features/member-signal-candidates/member-signal-candidate-review-panel";
import type { MemberSignalCandidateReviewListItem } from "@/lib/member-gateway/signal-candidate-review.service";

function candidateItem(
  overrides: Partial<MemberSignalCandidateReviewListItem> = {},
): MemberSignalCandidateReviewListItem {
  return {
    artifactBundleId: "member-signal-artifact:synthetic-1",
    reviewStatus: "PENDING",
    bundleStatus: "DRAFT",
    kind: "opportunity_note",
    taint: "member_upstream",
    projectedSummary: "跟进节奏可能需要调整 [link-evidence:1]",
    memberRef: "member:synthetic-1",
    submittedAt: "2026-07-12T08:00:00.000Z",
    createdAt: "2026-07-12T08:00:00.000Z",
    corrupt: false,
    ...overrides,
  };
}

const reviewGovernance = {
  canReview: true,
  canPromote: false,
  reviewDeniedMessage: "无复核权限",
  promotionDeniedMessage: "只有组织负责人、管理员或运营角色可以晋级。",
};

describe("MemberSignalCandidateReviewPanel", () => {
  it("renders a compact empty state without implying runtime readiness", () => {
    const html = renderToStaticMarkup(
      <MemberSignalCandidateReviewPanel
        items={[]}
        governance={reviewGovernance}
      />,
    );

    expect(html).toContain("当前没有待复核的成员信号候选");
    expect(html).toContain("成员上行输入未受信，无自动批准");
  });

  it("renders the taint marker first-class, outside any collapsed disclosure", () => {
    const html = renderToStaticMarkup(
      <MemberSignalCandidateReviewPanel
        items={[candidateItem()]}
        governance={reviewGovernance}
      />,
    );

    expect(html).toContain("未信任 · 成员上行");
    expect(html).not.toContain("<details");
    // The taint badge must appear before the row title in document order.
    expect(html.indexOf("未信任 · 成员上行")).toBeLessThan(
      html.indexOf("跟进节奏可能需要调整"),
    );
    // link-evidence tokens render verbatim, never linkified.
    expect(html).toContain("[link-evidence:1]");
    expect(html).not.toContain("<a href");
  });

  it("shows confirm and reject commands for a pending review candidate", () => {
    const html = renderToStaticMarkup(
      <MemberSignalCandidateReviewPanel
        items={[candidateItem()]}
        governance={reviewGovernance}
      />,
    );

    expect(html).toContain("确认候选");
    expect(html).toContain("拒绝");
    expect(html).not.toContain("晋级为内部任务");
  });

  it("disables review commands and shows the denied message without review permission", () => {
    const html = renderToStaticMarkup(
      <MemberSignalCandidateReviewPanel
        items={[candidateItem()]}
        governance={{ ...reviewGovernance, canReview: false }}
      />,
    );

    expect(html).toContain("确认候选");
    expect(html).toContain("无复核权限");
    expect(html).toMatch(/<button[^>]*disabled/);
  });

  it("shows the promotion form disabled for reviewer-only access", () => {
    const html = renderToStaticMarkup(
      <MemberSignalCandidateReviewPanel
        items={[
          candidateItem({
            bundleStatus: "CONFIRMED",
            reviewStatus: "CONFIRMED",
          }),
        ]}
        governance={reviewGovernance}
      />,
    );

    expect(html).toContain("晋级为内部任务");
    expect(html).toContain("只有组织负责人、管理员或运营角色可以晋级");
    expect(html).toMatch(/<button[^>]*disabled/);
  });

  it("shows a promoted chip once the bundle has been consumed", () => {
    const html = renderToStaticMarkup(
      <MemberSignalCandidateReviewPanel
        items={[
          candidateItem({
            bundleStatus: "CONSUMED",
            reviewStatus: "CONFIRMED",
          }),
        ]}
        governance={reviewGovernance}
      />,
    );

    expect(html).toContain("已晋升");
    expect(html).not.toContain("确认候选");
    expect(html).not.toContain("晋级为内部任务");
  });

  it("renders corrupt candidates without any review or promotion command", () => {
    const html = renderToStaticMarkup(
      <MemberSignalCandidateReviewPanel
        items={[
          candidateItem({
            corrupt: true,
          }),
        ]}
        governance={reviewGovernance}
      />,
    );

    expect(html).toContain("候选产物已阻断");
    expect(html).toContain('data-member-signal-candidate-contract="corrupt"');
    expect(html).not.toContain("<button");
    expect(html).not.toContain("未信任 · 成员上行");
  });
});
