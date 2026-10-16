// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/reports",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/providers/workspace-ui-provider", () => ({
  useWorkspaceUi: () => ({ locale: "zh-CN", demoMode: null }),
}));
vi.mock("@/features/reports/actions", () => ({
  generateWeeklyReportAction: vi.fn(),
}));

import { ReportsClient } from "@/features/reports/reports-client";

const weekStart = new Date(2026, 9, 5);
const weekEnd = new Date(2026, 9, 11);

function buildReport(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "report-1",
    weekStart,
    weekEnd,
    summaryText: "本周推进 3 个机会，2 条跟进逾期。",
    opportunitiesAdvancedCount: 3,
    overdueFollowupsCount: 1,
    aiSuggestionsCount: 5,
    approvalsApprovedCount: 2,
    openHighRiskCount: 1,
    createdAt: new Date(2026, 9, 11, 18, 0),
    payload: {
      meetingsCount: 4,
      newOpportunitiesCount: 1,
      rejectedActionsCount: 0,
      mostActiveUser: { name: "车栋", score: 12 },
      overdueItems: [
        { id: "opp-overdue", title: "Acme 续约", companyName: "Acme", dueDate: weekEnd },
      ],
      highRiskItems: [
        {
          id: "opp-risk",
          title: "Beacon 试点",
          companyName: "Beacon",
          riskLevel: "CRITICAL",
          nextAction: "周三前确认试点名单",
        },
      ],
      evolutionInsights: [
        { id: "insight-1", title: "会后 24 小时内回访", summary: "回访率更高", confidence: 0.8 },
      ],
    },
    ...overrides,
  };
}

const emptyGap = { totalOpen: 0, reviewRequired: 0, kindCounts: [], primaryGap: null };

describe("ReportsClient object-first layout", () => {
  it("puts the missed and high-risk lists first, each linking to its opportunity", () => {
    const { container } = render(
      <ReportsClient
        reports={[buildReport()]}
        insightGovernance={{ canManage: true, manageDeniedMessage: "" }}
        businessLoopGapSummary={emptyGap}
        engineeringDeliveryReview={null}
      />,
    );

    const lists = container.querySelector('[data-reports-risk-lists="true"]');
    expect(lists).not.toBeNull();
    const overdueLink = within(lists as HTMLElement).getByRole("link", { name: "Acme 续约" });
    expect(overdueLink).toHaveAttribute("href", "/opportunities?opportunityId=opp-overdue");
    const riskLink = within(lists as HTMLElement).getByRole("link", { name: "Beacon 试点" });
    expect(riskLink).toHaveAttribute("href", "/opportunities?opportunityId=opp-risk");
    expect(lists).toHaveTextContent("周三前确认试点名单");

    const judgement = container.querySelector("details[data-system-judgement]");
    expect(judgement).not.toBeNull();
    expect(judgement).not.toHaveAttribute("open");
    expect(container.querySelectorAll("[data-system-judgement]")).toHaveLength(1);
    // Lists and the report summary come before the closing judgement block.
    expect(
      (lists as HTMLElement).compareDocumentPosition(judgement as HTMLElement) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText("周报摘要")).toBeInTheDocument();
    expect(screen.getByText("本周经营推进参与")).toBeInTheDocument();
    expect(container).not.toHaveTextContent("当前压力");
    expect(container.querySelector('[data-customer-asset-focus="true"]')).toBeNull();

    // Patterns and self-checks live inside the judgement block only.
    expect(within(judgement as HTMLElement).getByText("本周出现的推进规律")).toBeInTheDocument();
    expect(within(judgement as HTMLElement).getByText("复核链路是否稳")).toBeInTheDocument();
  });

  it("renders no risk list section and no placeholder cards when both lists are empty", () => {
    const { container } = render(
      <ReportsClient
        reports={[buildReport({ payload: { overdueItems: [], highRiskItems: [] } })]}
        insightGovernance={{ canManage: true, manageDeniedMessage: "" }}
        businessLoopGapSummary={emptyGap}
        engineeringDeliveryReview={null}
      />,
    );

    expect(container.querySelector('[data-reports-risk-lists="true"]')).toBeNull();
    expect(container).not.toHaveTextContent("本周没有新的逾期跟进");
    expect(container).not.toHaveTextContent("本周没有新的高风险事项");
  });
});
