/**
 * Tests for Must Push Card Component
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MustPushCard } from "./must-push-card";
import type { MustPushItem } from "../types";

describe("MustPushCard", () => {
  const mockItem: MustPushItem = {
    id: "test-1",
    type: "overdue_commitment",
    title: "星河连锁恢复方案已逾期 5 天",
    reason: "承诺在 4 月 20 日前发送恢复方案，客户已两次催问进度。",
    primaryAction: {
      label: "打开机会",
      href: "/opportunities?id=xinghe",
      mode: "open_object",
    },
    boundaryNote: {
      type: "suggestion_not_commitment",
      message: "先复核，再对客户承诺。",
    },
    outcomeCheckpoint: {
      label: "结果回收",
      dueHint: "72 小时内回看",
      expectedSignal: "复核后的下一步姿态、客户回应或降级原因",
      reviewHref: "/approvals?source=mobile&itemId=test-1&posture=outcome_review",
      status: "not_collected",
    },
    severity: "critical",
    score: 95,
  };

  it("should render item title and reason", () => {
    render(<MustPushCard item={mockItem} />);

    expect(screen.getByText("星河连锁恢复方案已逾期 5 天")).toBeInTheDocument();
    expect(screen.getByText(/承诺在 4 月 20 日前/)).toBeInTheDocument();
  });

  it("should display type badge", () => {
    render(<MustPushCard item={mockItem} />);

    expect(screen.getByText("逾期")).toBeInTheDocument();
  });

  it("should display urgent indicator for critical severity", () => {
    render(<MustPushCard item={mockItem} />);

    expect(screen.getByText(/紧急/)).toBeInTheDocument();
  });

  it("should display boundary note when present", () => {
    render(<MustPushCard item={mockItem} />);

    expect(screen.getByText(/先复核，再对客户承诺/)).toBeInTheDocument();
  });

  it("should display outcome checkpoint when present", () => {
    render(<MustPushCard item={mockItem} />);

    expect(screen.getByTestId("mobile-must-push-outcome")).toBeInTheDocument();
    expect(screen.getByText("结果回收")).toBeInTheDocument();
    expect(screen.getByText("72 小时内回看")).toBeInTheDocument();
    expect(screen.getByText(/客户回应或降级原因/)).toBeInTheDocument();
  });

  it("should display english outcome checkpoint label when english=true", () => {
    render(<MustPushCard item={mockItem} english={true} />);

    expect(screen.getByText("Outcome check")).toBeInTheDocument();
  });

  it("should link to primary action href", () => {
    const { container } = render(<MustPushCard item={mockItem} />);

    const link = container.querySelector('a[href="/opportunities?id=xinghe"]');
    expect(link).toBeInTheDocument();
  });

  it("should display primary variant with larger text", () => {
    const { container } = render(<MustPushCard item={mockItem} variant="primary" />);
    const { container: container2 } = render(<MustPushCard item={mockItem} variant="supporting" />);

    const primaryTitle = container.querySelector("h3");
    const supportingTitle = container2.querySelector("h3");

    expect(primaryTitle).toHaveClass("text-lg");
    expect(supportingTitle).toHaveClass("text-base");
  });

  it("should display english type labels when english=true", () => {
    render(<MustPushCard item={mockItem} english={true} />);

    expect(screen.getByText("Overdue")).toBeInTheDocument();
  });

  it("should not display boundary note when absent", () => {
    const itemWithoutBoundary: MustPushItem = {
      ...mockItem,
      boundaryNote: undefined,
    };

    const { container } = render(<MustPushCard item={itemWithoutBoundary} />);

    expect(container.querySelector('.border-t')).toBeNull();
  });

  it("should display correct type labels for each type", () => {
    const types: MustPushItem["type"][] = [
      "overdue_commitment",
      "blocked_decision",
      "stalled_opportunity",
      "meeting_follow_up",
      "customer_waiting",
      "proof_or_review_required",
    ];

    const expectedLabels = ["逾期", "待复核", "停滞", "会待跟进", "客户等待", "待补凭证"];

    types.forEach((type, index) => {
      const item = { ...mockItem, type };
      render(<MustPushCard item={item} />);
      expect(screen.getByText(expectedLabels[index])).toBeInTheDocument();
    });
  });
});
