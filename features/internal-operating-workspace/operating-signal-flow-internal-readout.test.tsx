/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OperatingSignalFlowInternalReadoutPanel } from "@/features/internal-operating-workspace/operating-signal-flow-internal-readout";
import {
  projectOperatingSignalFlowInternalShadowReadout,
  type OperatingSignalFlowInternalShadowDiagnostics,
  type OperatingSignalFlowInternalShadowResult,
} from "@/lib/operating-signal-flow/internal-shadow-readout";

const BASE_DIAGNOSTICS: OperatingSignalFlowInternalShadowDiagnostics = {
  actionCount: 15,
  approvalCount: 6,
  auditCount: 26,
  boundaryCounter: 0,
  pendingReviewCount: 2,
  tracePresenceCount: 15,
  workspaceCount: 1,
};

function shadowReady(
  overrides: Partial<OperatingSignalFlowInternalShadowDiagnostics> = {},
): OperatingSignalFlowInternalShadowResult {
  return {
    state: "shadow_ready",
    diagnostics: { ...BASE_DIAGNOSTICS, ...overrides },
    snapshot: {
      dataPosture: "current_window",
      window: "24h",
      generatedAt: "2026-05-21T08:00:00.000Z",
      aiWorkPosture: {
        deterministicCoveragePercent: 100,
        explanationCoveragePercent: 0,
        evidenceCoveragePercent: 72,
        boundaryStoppedCount: overrides.boundaryCounter ?? BASE_DIAGNOSTICS.boundaryCounter,
      },
      events: Array.from({ length: 47 }, (_, index) => ({ id: `raw-event-${index + 1}` })),
    },
  };
}

describe("OperatingSignalFlowInternalReadoutPanel", () => {
  it("renders a fixture-only Chinese internal readout without links or action buttons", () => {
    const readout = projectOperatingSignalFlowInternalShadowReadout({
      result: shadowReady(),
      reviewedAt: "2026-05-21T08:30:00.000Z",
      shadowGeneratedAt: "2026-05-21T08:00:00.000Z",
      maxShadowAgeMs: 60 * 60 * 1000,
    });
    const { container } = render(<OperatingSignalFlowInternalReadoutPanel locale="zh-CN" readout={readout} />);
    const panel = screen.getByTestId("operating-signal-flow-internal-readout");

    expect(panel).toHaveAttribute("data-internal-readout-only", "true");
    expect(panel).toHaveAttribute("data-fixture-contract", "internal-shadow-readout");
    expect(panel).toHaveAttribute("data-production-truth", "false");
    expect(panel).toHaveAttribute("data-route-page-adoption", "false");
    expect(screen.getByTestId("internal-readout-title")).toHaveTextContent("Shadow 读数可内部复核");
    expect(screen.getByTestId("internal-readout-decision")).toHaveAttribute("data-decision", "continue");
    expect(screen.getByTestId("internal-readout-decision")).toHaveTextContent("继续内部复核");
    expect(screen.getByTestId("internal-readout-metrics")).toHaveTextContent("事件数");
    expect(screen.getByTestId("internal-readout-metrics")).toHaveTextContent("47");
    expect(screen.getByTestId("internal-readout-metrics")).toHaveTextContent("边界计数");
    expect(screen.getByTestId("internal-readout-metrics")).toHaveTextContent("0");
    expect(screen.getByText(/不代表生产真值/)).toBeInTheDocument();
    expect(screen.getByText(/fixture banner/)).toBeInTheDocument();
    expect(container.querySelectorAll("a")).toHaveLength(0);
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  it("routes boundary-blocked readouts to stop with security and data protection visible", () => {
    const readout = projectOperatingSignalFlowInternalShadowReadout({
      result: shadowReady({ boundaryCounter: 1 }),
      reviewedAt: "2026-05-21T08:30:00.000Z",
    });
    render(<OperatingSignalFlowInternalReadoutPanel locale="en-US" readout={readout} />);

    expect(screen.getByTestId("internal-readout-title")).toHaveTextContent("Shadow is boundary-blocked");
    expect(screen.getByTestId("internal-readout-decision")).toHaveAttribute("data-decision", "stop");
    expect(screen.getByTestId("internal-readout-decision")).toHaveTextContent("Stop path");

    const routing = screen.getByTestId("internal-readout-owner-routing");
    expect(routing).toHaveTextContent("Security");
    expect(routing).toHaveTextContent("Data protection");
    expect(routing).toHaveTextContent("Founder");
  });

  it("does not echo raw shadow payload fragments from the helper input", () => {
    const result = shadowReady() as OperatingSignalFlowInternalShadowResult & {
      rawTraceId: string;
      requestId: string;
      actorEmail: string;
      sourcePage: string;
    };
    result.rawTraceId = "trace-raw-secret";
    result.requestId = "request-raw-secret";
    result.actorEmail = "person@example.com";
    result.sourcePage = "/internal/raw-source";

    const readout = projectOperatingSignalFlowInternalShadowReadout({
      result,
      reviewedAt: "2026-05-21T08:30:00.000Z",
    });
    const { container } = render(<OperatingSignalFlowInternalReadoutPanel locale="en-US" readout={readout} />);
    const serialized = container.textContent ?? "";

    expect(serialized).not.toContain("raw-event-");
    expect(serialized).not.toContain("trace-raw-secret");
    expect(serialized).not.toContain("request-raw-secret");
    expect(serialized).not.toContain("person@example.com");
    expect(serialized).not.toContain("/internal/raw-source");
  });

  it("keeps adoption guards visible as blocked paths", () => {
    const readout = projectOperatingSignalFlowInternalShadowReadout({
      result: shadowReady({ actionCount: 16 }),
      reviewedAt: "2026-05-21T08:30:00.000Z",
      previousDiagnostics: BASE_DIAGNOSTICS,
      driftExplanation: "Phase 3G component design readout receipt.",
    });
    render(<OperatingSignalFlowInternalReadoutPanel locale="en-US" readout={readout} />);

    const panel = screen.getByTestId("operating-signal-flow-internal-readout");
    expect(panel).toHaveTextContent("Shadow readout has count drift");
    expect(within(panel).getByText(/8 adoption paths blocked/)).toBeInTheDocument();
    expect(panel).toHaveTextContent("route/page posture unchanged");
  });
});
