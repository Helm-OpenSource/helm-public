import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  __resetPackRegistryForTest,
  registerPackContributions,
} from "./registry-contract";
import { resolveReportsExtensions } from "./registry";

const workspace = {
  id: "workspace-1",
  slug: "sample",
  systemKey: null,
  workspaceClass: "CUSTOMER",
} as const;

describe("reports extension surface context", () => {
  beforeEach(() => __resetPackRegistryForTest());
  afterEach(() => __resetPackRegistryForTest());

  it("passes the current workspace, user, and membership into the active surface", async () => {
    const renderSurface = vi.fn(({ workspace, user, membership }) =>
      React.createElement("div", {
        "data-testid": "sample-surface",
        "data-workspace-id": workspace.id,
        "data-user-id": user?.id ?? "missing",
        "data-membership-id": membership?.id ?? "missing",
      }),
    );

    registerPackContributions("sample-reports-extension", {
      reportsExtensions: [
        {
          id: "sample-reports-extension",
          getAccess: async () => ({ ok: true }),
          buildTabs: () => [
            {
              key: "sample",
              label: "Sample",
              href: "/reports?tab=sample",
            },
          ],
          matchTab: (requested) => (requested === "sample" ? "sample" : null),
          renderSurface,
          buildPageViewEvent: ({ matchedTab }) => ({
            eventName: "sample_surface_viewed",
            sourcePage: `/reports?tab=${matchedTab}`,
            targetType: "Page",
            targetId: `/reports?tab=${matchedTab}`,
          }),
        },
      ],
    });

    const resolved = await resolveReportsExtensions({
      workspace,
      english: false,
      requestedTab: "sample",
      user: {
        id: "user-1",
        name: "Operator",
        email: "operator@example.test",
      },
      membership: {
        id: "membership-1",
        workspaceId: workspace.id,
        role: "MEMBER",
        status: "ACTIVE",
        rolePresetKey: "GENERAL_OPERATOR",
        persona: "Operator",
      },
    });

    expect(renderSurface).toHaveBeenCalledWith({
      matchedTab: "sample",
      english: false,
      workspace,
      user: {
        id: "user-1",
        name: "Operator",
        email: "operator@example.test",
      },
      membership: {
        id: "membership-1",
        workspaceId: workspace.id,
        role: "MEMBER",
        status: "ACTIVE",
        rolePresetKey: "GENERAL_OPERATOR",
        persona: "Operator",
      },
    });
    expect(renderToStaticMarkup(resolved.active?.surface)).toContain(
      'data-user-id="user-1"',
    );
  });
});
