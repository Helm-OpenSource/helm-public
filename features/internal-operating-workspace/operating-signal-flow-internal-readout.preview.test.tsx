/**
 * @vitest-environment jsdom
 */
import "@testing-library/jest-dom/vitest";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { OperatingSignalFlowInternalReadoutPanel } from "@/features/internal-operating-workspace/operating-signal-flow-internal-readout";
import {
  projectOperatingSignalFlowInternalShadowReadout,
  type OperatingSignalFlowInternalShadowDiagnostics,
  type OperatingSignalFlowInternalShadowResult,
} from "@/lib/operating-signal-flow/internal-shadow-readout";
import type { UiLocale } from "@/lib/i18n/config";

const BASE_DIAGNOSTICS: OperatingSignalFlowInternalShadowDiagnostics = {
  actionCount: 17,
  approvalCount: 7,
  auditCount: 31,
  boundaryCounter: 0,
  pendingReviewCount: 3,
  tracePresenceCount: 17,
  workspaceCount: 1,
};

function readyShadow(
  overrides: Partial<OperatingSignalFlowInternalShadowDiagnostics> = {},
): OperatingSignalFlowInternalShadowResult {
  return {
    state: "shadow_ready",
    diagnostics: { ...BASE_DIAGNOSTICS, ...overrides },
    snapshot: {
      dataPosture: "current_window",
      window: "24h",
      generatedAt: "2026-05-21T09:00:00.000Z",
      aiWorkPosture: {
        deterministicCoveragePercent: 100,
        explanationCoveragePercent: 0,
        evidenceCoveragePercent: 76,
        boundaryStoppedCount: overrides.boundaryCounter ?? BASE_DIAGNOSTICS.boundaryCounter,
      },
      events: Array.from({ length: 55 }, (_, index) => ({ id: `raw-preview-event-${index + 1}` })),
    },
  };
}

function renderPreviewEvidence({
  locale,
  result = readyShadow(),
}: {
  readonly locale: UiLocale;
  readonly result?: OperatingSignalFlowInternalShadowResult;
}) {
  const readout = projectOperatingSignalFlowInternalShadowReadout({
    result,
    reviewedAt: "2026-05-21T09:30:00.000Z",
    shadowGeneratedAt: "2026-05-21T09:00:00.000Z",
    maxShadowAgeMs: 60 * 60 * 1000,
  });
  const rendered = render(<OperatingSignalFlowInternalReadoutPanel locale={locale} readout={readout} />);
  const panel = rendered.getByTestId("operating-signal-flow-internal-readout");
  return {
    ...rendered,
    panel,
    serializedDom: rendered.container.textContent ?? "",
    interactiveControlCount: rendered.container.querySelectorAll("a, button, form, input, textarea, select").length,
  };
}

describe("OperatingSignalFlowInternalReadoutPanel preview evidence harness", () => {
  it("collects Chinese and English DOM evidence while keeping route and production truth guards false", () => {
    const zh = renderPreviewEvidence({ locale: "zh-CN" });
    expect(zh.panel).toHaveAttribute("data-internal-readout-only", "true");
    expect(zh.panel).toHaveAttribute("data-fixture-contract", "internal-shadow-readout");
    expect(zh.panel).toHaveAttribute("data-production-truth", "false");
    expect(zh.panel).toHaveAttribute("data-route-page-adoption", "false");
    expect(zh.serializedDom).toContain("Shadow 读数可内部复核");
    expect(zh.serializedDom).toContain("继续内部复核");
    expect(zh.interactiveControlCount).toBe(0);
    zh.unmount();

    const en = renderPreviewEvidence({ locale: "en-US" });
    expect(en.panel).toHaveAttribute("data-internal-readout-only", "true");
    expect(en.panel).toHaveAttribute("data-production-truth", "false");
    expect(en.panel).toHaveAttribute("data-route-page-adoption", "false");
    expect(en.serializedDom).toContain("Shadow readout is ready for internal review");
    expect(en.serializedDom).toContain("Continue internal review");
    expect(en.interactiveControlCount).toBe(0);
    en.unmount();
  });

  it("keeps boundary-blocked preview evidence stopped and routed to required reviewers", () => {
    const preview = renderPreviewEvidence({
      locale: "en-US",
      result: readyShadow({ boundaryCounter: 2 }),
    });

    expect(preview.getByTestId("internal-readout-decision")).toHaveAttribute("data-decision", "stop");
    expect(preview.serializedDom).toContain("Shadow is boundary-blocked");
    expect(preview.serializedDom).toContain("Stop path");
    expect(preview.serializedDom).toContain("Security");
    expect(preview.serializedDom).toContain("Data protection");
    expect(preview.serializedDom).toContain("Founder");
    expect(preview.interactiveControlCount).toBe(0);
  });

  it("keeps serialized preview evidence free of raw shadow identifiers and source details", () => {
    const result = readyShadow() as OperatingSignalFlowInternalShadowResult & {
      rawTraceId: string;
      requestId: string;
      actorEmail: string;
      sourcePage: string;
    };
    result.rawTraceId = "raw-preview-trace";
    result.requestId = "raw-preview-request";
    result.actorEmail = "reviewer@example.com";
    result.sourcePage = "/internal/preview-source";

    const preview = renderPreviewEvidence({ locale: "en-US", result });

    expect(preview.serializedDom).not.toContain("raw-preview-event-");
    expect(preview.serializedDom).not.toContain("raw-preview-trace");
    expect(preview.serializedDom).not.toContain("raw-preview-request");
    expect(preview.serializedDom).not.toContain("reviewer@example.com");
    expect(preview.serializedDom).not.toContain("/internal/preview-source");
    expect(preview.interactiveControlCount).toBe(0);
  });
});
