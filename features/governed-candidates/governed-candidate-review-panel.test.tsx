import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/components/providers/workspace-ui-provider", () => ({
  useWorkspaceUi: () => ({ locale: "zh-CN" }),
}));
vi.mock("@/features/governed-candidates/actions", () => ({
  promoteGovernedCandidateToTaskAction: vi.fn(),
  reviewGovernedCandidateAction: vi.fn(),
}));

import { GovernedCandidateReviewPanel } from "@/features/governed-candidates/governed-candidate-review-panel";
import type { GovernedCandidateReviewListItem } from "@/lib/governed-intelligence/governed-candidate-review";

function candidateItem(
  overrides: Partial<GovernedCandidateReviewListItem> = {},
): GovernedCandidateReviewListItem {
  return {
    artifactBundleId: "governed-artifact:synthetic-1",
    artifactReviewId: "review-1",
    bundleStatus: "DRAFT",
    reviewStatus: "PENDING",
    createdAt: "2026-07-12T08:00:00.000Z",
    contractStatus: "valid",
    canReview: true,
    canPromote: false,
    candidate: {
      candidateId: "governed-candidate:synthetic-1",
      objectType: "opportunity",
      objectId: "object:synthetic-1",
      confidence: 82,
      reviewState: "candidate",
      boundaryDecision: "allow_candidate",
      evidenceRefs: ["evidence:synthetic:1"],
      missingEvidence: [
        {
          gapId: "gap:synthetic:1",
          missingSignalNote: "仍需核对最新交付状态。",
        },
      ],
      counterEvidenceNeeded: ["检查当前阻塞是否已经解除。"],
      nextSafeActions: ["创建内部跟进任务"],
    },
    promotion: null,
    ...overrides,
  };
}

const reviewGovernance = {
  canReview: true,
  canPromote: false,
  reviewDeniedMessage: "无复核权限",
  promotionDeniedMessage: "只有组织负责人、管理员或运营角色可以晋级。",
};

describe("GovernedCandidateReviewPanel", () => {
  it("renders a compact empty state without implying runtime readiness", () => {
    const html = renderToStaticMarkup(
      <GovernedCandidateReviewPanel items={[]} governance={reviewGovernance} />,
    );

    expect(html).toContain("当前没有待复核的受治理判断候选");
    expect(html).toContain("无自动批准，无外部副作用");
  });

  it("shows evidence gaps before candidate review commands", () => {
    const html = renderToStaticMarkup(
      <GovernedCandidateReviewPanel
        items={[candidateItem()]}
        governance={reviewGovernance}
      />,
    );

    expect(html).toContain("创建内部跟进任务");
    expect(html).toContain("仍需核对最新交付状态");
    expect(html).toContain("确认候选");
    expect(html).toContain("拒绝");
    expect(html).not.toContain("晋级为内部任务");
  });

  it("shows promotion as disabled for reviewer-only access", () => {
    const html = renderToStaticMarkup(
      <GovernedCandidateReviewPanel
        items={[
          candidateItem({
            bundleStatus: "CONFIRMED",
            reviewStatus: "CONFIRMED",
            canReview: false,
            canPromote: true,
          }),
        ]}
        governance={reviewGovernance}
      />,
    );

    expect(html).toContain("晋级为内部任务");
    expect(html).toContain("只有组织负责人、管理员或运营角色可以晋级");
    expect(html).toMatch(/<button[^>]*disabled/);
  });

  it("renders invalid contracts without candidate content or commands", () => {
    const html = renderToStaticMarkup(
      <GovernedCandidateReviewPanel
        items={[
          candidateItem({
            contractStatus: "invalid",
            candidate: null,
            canReview: false,
            canPromote: false,
          }),
        ]}
        governance={reviewGovernance}
      />,
    );

    expect(html).toContain("候选契约已阻断");
    expect(html).not.toContain("创建内部跟进任务");
    expect(html).not.toContain("确认候选");
    expect(html).not.toContain("晋级为内部任务");
  });
});
