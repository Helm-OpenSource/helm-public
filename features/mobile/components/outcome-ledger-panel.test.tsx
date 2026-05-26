/**
 * Tests for mobile Outcome Ledger panel.
 *
 * @vitest-environment jsdom
 */

import { describe, expect, it } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { OutcomeLedgerPanel } from "./outcome-ledger-panel";
import type { MustPushOutcomeLedgerSummary } from "../types";

function ledger(
  overrides: Partial<MustPushOutcomeLedgerSummary> = {},
): MustPushOutcomeLedgerSummary {
  return {
    items: [
      {
        id: "outcome::a",
        mustPushId: "a",
        title: "复核星河回复",
        type: "customer_waiting",
        severity: "high",
        checkpointStatus: "not_collected",
        posture: "collect_signal",
        dueHint: "24 小时内回看",
        expectedSignal: "客户回复状态",
        reviewHref: "/approvals?source=mobile&itemId=a&posture=outcome_review",
        boundaryNote: "只回收结果信号，不自动写回外部系统。",
      },
    ],
    dueCount: 1,
    reviewPendingCount: 0,
    blockedCount: 0,
    nextReviewHref: "/approvals?source=mobile&itemId=a&posture=outcome_review",
    reviewCue: {
      mustPushId: "a",
      question: "预期的结果信号是否已经出现？",
      evidenceToCheck: ["时间要求：24 小时内回看", "预期信号：客户回复状态"],
      allowedDecisions: ["继续回收信号", "进入人工复核", "降级或标记阻塞"],
      boundaryNote: "这个提示只准备人工复核，不自动关闭事项或确认外部成功。",
    },
    summary: "1 项结果待回收",
    boundaryNote: "只读结果台账，不自动确认结果。",
    ...overrides,
  };
}

describe("OutcomeLedgerPanel", () => {
  it("renders the next outcome checkpoint without claiming execution", () => {
    render(<OutcomeLedgerPanel ledger={ledger()} />);

    expect(screen.getByText("结果回收台账")).toBeInTheDocument();
    expect(screen.getByText("1 项结果待回收")).toBeInTheDocument();
    expect(screen.getByText("复核星河回复")).toBeInTheDocument();
    expect(screen.getByText("24 小时内回看")).toBeInTheDocument();
    expect(screen.getByText("客户回复状态")).toBeInTheDocument();
    expect(screen.getByText("复核提示")).toBeInTheDocument();
    expect(screen.getByText("预期的结果信号是否已经出现？")).toBeInTheDocument();
    expect(screen.getByText("继续回收信号")).toBeInTheDocument();
    expect(screen.getByText("这个提示只准备人工复核，不自动关闭事项或确认外部成功。")).toBeInTheDocument();
    expect(screen.getByText("只读结果台账，不自动确认结果。")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "进入结果复核" })).toHaveAttribute(
      "href",
      "/approvals?source=mobile&itemId=a&posture=outcome_review",
    );
  });

  it("renders English copy", () => {
    render(
      <OutcomeLedgerPanel
        english
        ledger={ledger({
          summary: "1 outcome check pending",
          boundaryNote: "Outcome ledger is review-only.",
          reviewCue: {
            mustPushId: "a",
            question: "Has the expected outcome signal appeared yet?",
            evidenceToCheck: ["Timing: Check again within 24h"],
            allowedDecisions: ["Keep collecting signal"],
            boundaryNote: "This cue prepares a human review only.",
          },
        })}
      />,
    );

    expect(screen.getByText("Outcome ledger")).toBeInTheDocument();
    expect(screen.getByText("1 outcome check pending")).toBeInTheDocument();
    expect(screen.getByText("Review cue")).toBeInTheDocument();
    expect(screen.getByText("Has the expected outcome signal appeared yet?")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Review outcome" })).toBeInTheDocument();
  });

  it("does not render a review link when the href was stripped", () => {
    render(
      <OutcomeLedgerPanel
        ledger={ledger({
          nextReviewHref: null,
          items: [
            {
              ...ledger().items[0]!,
              reviewHref: null,
            },
          ],
        })}
      />,
    );

    expect(screen.queryByRole("link", { name: "进入结果复核" })).not.toBeInTheDocument();
  });

  it("renders nothing for an empty ledger", () => {
    const { container } = render(
      <OutcomeLedgerPanel
        ledger={ledger({
          items: [],
          dueCount: 0,
          nextReviewHref: null,
          reviewCue: null,
          summary: "今天没有结果回收项",
        })}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
