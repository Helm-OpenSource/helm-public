import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const analytics = {
  logPageViewEvent: vi.fn(),
};

vi.mock("@/lib/analytics", () => ({
  logPageViewEvent: analytics.logPageViewEvent,
}));

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("reports extension page fail-open", () => {
  it("renders a degraded panel when the reports registry blows up", async () => {
    vi.doMock("./registry-contract", () => ({
      getRegisteredReportsExtensions: () => {
        throw new Error("registry unavailable");
      },
      getRegisteredAccountBindings: () => [],
      getRegisteredBiBoards: () => [],
      getRegisteredBiReportP0ProcessService: () => null,
      getRegisteredCatalog: () => [],
      getRegisteredImplementationConsole: () => null,
      getRegisteredIndustryDemoReadouts: () => [],
      getRegisteredSignalCollectionJobProviders: () => [],
      getRegisteredWorkspaceNavExtensions: () => [],
    }));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const { resolveReportsExtensions } = await import("./registry");
      const resolved = await resolveReportsExtensions({
        workspace: { id: "ws_1", slug: "sample-workspace", systemKey: "sample-workspace" },
        english: false,
        requestedTab: "bi-report",
      });
      expect(resolved.active).not.toBeNull();
      const html = renderToStaticMarkup(React.createElement(React.Fragment, null, resolved.active?.surface));
      expect(html).toContain('data-testid="reports-extension-degraded-panel"');
      expect(html).toContain("本扩展读板暂不可用");
      expect(consoleErrorSpy).toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("suppresses page-view logging failures", async () => {
    analytics.logPageViewEvent.mockRejectedValueOnce(new Error("analytics offline"));
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const { logReportsExtensionPageView } = await import("./registry");
      await expect(
        logReportsExtensionPageView({
          eventName: "bi_report_surface_viewed",
          sourcePage: "/reports?tab=bi-report",
          targetType: "Page",
          targetId: "/reports?tab=bi-report",
        }),
      ).resolves.toBeUndefined();
      expect(consoleErrorSpy).toHaveBeenCalled();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
