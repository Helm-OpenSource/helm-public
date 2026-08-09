// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Stage1OwnerLoopConsole } from "./stage1-owner-loop-console";
import { buildStage1OwnerLoopReadout } from "./stage1-owner-loop-readout";

describe("Stage1OwnerLoopConsole supervision status", () => {
  it("shows whether each visible signal is unresolved or resolved", () => {
    const readout = buildStage1OwnerLoopReadout({
      now: new Date("2026-08-10T00:00:00.000Z"),
      programs: [],
      sources: [],
      decisions: [],
      decisionStatusCounts: [],
      supervisionSignals: [
        {
          id: "signal-open",
          signalKey: "signal:open",
          observedFact: "Owner attention is still required.",
          severity: "critical",
          status: "open",
          recommendedRoute: "owner_review",
          deadlineOrSla: null,
          createdAt: new Date("2026-08-09T20:00:00.000Z"),
        },
        {
          id: "signal-resolved",
          signalKey: "signal:resolved",
          observedFact: "The governed result has been observed.",
          severity: "info",
          status: "resolved",
          recommendedRoute: "watch",
          deadlineOrSla: null,
          createdAt: new Date("2026-08-09T21:00:00.000Z"),
        },
      ],
      supervisionCounts: [
        { status: "open", severity: "critical", _count: { _all: 1 } },
        { status: "resolved", severity: "info", _count: { _all: 1 } },
      ],
      workPacketReceipts: [],
      currentG0Context: null,
      operatingQuestionHead: null,
      questionSelectionHead: null,
    });

    render(<Stage1OwnerLoopConsole readout={readout} english />);

    expect(
      screen.getByText(/Suggested route: owner_review/).textContent,
    ).toContain("Status: open");
    expect(screen.getByText(/Suggested route: watch/).textContent).toContain(
      "Status: resolved",
    );
  });
});
