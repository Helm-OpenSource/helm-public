// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Stage1TerminalResultControl } from "./stage1-terminal-result-control";

const defaultProps = {
  english: true,
  actionStatus: "EXECUTED",
  pending: false,
  canFinalize: true,
  deniedMessage: "Owner capability required",
  businessResult: "" as const,
  outcomeRef: "",
  followedRecommendation: "unknown" as const,
  onBusinessResultChange: vi.fn(),
  onOutcomeRefChange: vi.fn(),
  onFollowedRecommendationChange: vi.fn(),
  onVerify: vi.fn(),
};

describe("Stage1TerminalResultControl", () => {
  it.each([
    ["SUCCESS", "Execution succeeded"],
    ["PARTIAL_SUCCESS", "Execution partially succeeded"],
    ["FAILURE", "Execution failed"],
  ])("keeps %s in the business-outcome path", (receiptOutcome, label) => {
    render(
      <Stage1TerminalResultControl
        {...defaultProps}
        receiptOutcome={receiptOutcome}
      />,
    );

    expect(screen.getByTestId("stage1-terminal-result-control")).toHaveAttribute(
      "data-terminal-mode",
      "business-outcome",
    );
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(
      screen.getByTestId("stage1-business-outcome-fields"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("stage1-no-execution-guidance"),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["NOT_EXECUTED", "Closed without execution"],
    ["REJECTED", "Rejected before execution"],
  ])(
    "shows %s as no-execution truth without a business ObservationRun form",
    (receiptOutcome, label) => {
      const onVerify = vi.fn();
      render(
        <Stage1TerminalResultControl
          {...defaultProps}
          receiptOutcome={receiptOutcome}
          actionStatus="BLOCKED"
          onVerify={onVerify}
        />,
      );

      expect(
        screen.getByTestId("stage1-terminal-result-control"),
      ).toHaveAttribute("data-terminal-mode", "closed-without-execution");
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(
        screen.getByText(/This is not a business failure/i),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/No business ObservationRun is required/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/owner review/i)).toBeInTheDocument();
      expect(screen.getByText(/open supervision/i)).toBeInTheDocument();
      expect(
        screen.queryByTestId("stage1-business-outcome-fields"),
      ).not.toBeInTheDocument();

      fireEvent.click(screen.getByTestId("stage1-terminal-submit"));
      expect(onVerify).toHaveBeenCalledTimes(1);
    },
  );

  it("fails closed for a missing or unknown canonical outcome and explains recovery", () => {
    render(
      <Stage1TerminalResultControl
        {...defaultProps}
        receiptOutcome={null}
        actionStatus="BLOCKED"
      />,
    );

    expect(screen.getByTestId("stage1-terminal-result-control")).toHaveAttribute(
      "data-terminal-mode",
      "unresolved",
    );
    expect(
      screen.getByText(/The receipt outcome is unavailable/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/repair or refresh/i)).toBeInTheDocument();
    expect(screen.getByTestId("stage1-terminal-submit")).toBeDisabled();
    expect(
      screen.queryByTestId("stage1-business-outcome-fields"),
    ).not.toBeInTheDocument();
  });

  it.each(["NOT_EXECUTED", "REJECTED"])(
    "fails closed when %s is paired with ActionItem.REJECTED",
    (receiptOutcome) => {
      render(
        <Stage1TerminalResultControl
          {...defaultProps}
          receiptOutcome={receiptOutcome}
          actionStatus="REJECTED"
        />,
      );

      expect(
        screen.getByTestId("stage1-terminal-result-control"),
      ).toHaveAttribute("data-terminal-mode", "unresolved");
      expect(
        screen.getByText(/inconsistent with the canonical action state/i),
      ).toBeInTheDocument();
      expect(screen.getByTestId("stage1-terminal-submit")).toBeDisabled();
      expect(
        screen.queryByTestId("stage1-business-outcome-fields"),
      ).not.toBeInTheDocument();
    },
  );

  it("preserves the existing Stage 1 permission gate", () => {
    render(
      <Stage1TerminalResultControl
        {...defaultProps}
        receiptOutcome="NOT_EXECUTED"
        actionStatus="BLOCKED"
        canFinalize={false}
      />,
    );

    expect(screen.getByText("Owner capability required")).toBeInTheDocument();
    expect(screen.getByTestId("stage1-terminal-submit")).toBeDisabled();
  });
});
