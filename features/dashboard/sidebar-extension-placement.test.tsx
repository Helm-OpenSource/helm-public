// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { WorkspaceNavExtensionCluster } from "@/lib/extensions/registry";
import type { MemberRoleHomeWorkstation } from "@/lib/shell/member-role-home";

const uiState = vi.hoisted(() => ({ controlTowerHome: false }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/components/providers/workspace-ui-provider", async () => {
  const { getUiMessages } = await import("@/lib/i18n/messages");
  const { defaultWorkspaceFeatureFlags } = await import("@/lib/workspace-ops");
  return {
    useWorkspaceUi: () => ({
      locale: "zh-CN",
      messages: getUiMessages("zh-CN"),
      pilotMode: false,
      featureFlags: {
        ...defaultWorkspaceFeatureFlags,
        controlTowerHome: uiState.controlTowerHome,
      },
      demoMode: null,
      canAccessTenantHealth: false,
      isHelmReserved: false,
    }),
  };
});

import {
  getSidebarExtensionPlacement,
  Sidebar,
} from "@/components/layout/sidebar";

const customerAssetsCluster: WorkspaceNavExtensionCluster = {
  placement: "customer-assets",
  extensionKey: "case-management-sample",
  label: "Case Management",
  items: [
    {
      key: "case-board",
      href: "/cases",
      label: "案件台",
      iconKey: "shield-check",
      statusBadge: { label: "未启用", tone: "planned" },
    },
    {
      key: "case-live",
      href: "/cases/live",
      label: "在办案件",
      iconKey: "boxes",
      statusBadge: { label: "已上线", tone: "live" },
    },
    {
      key: "case-blocked",
      href: "/cases/blocked",
      label: "受阻案件",
      iconKey: "users",
      statusBadge: { label: "已阻断", tone: "blocked" },
    },
    {
      key: "case-archive",
      href: "/cases/archive",
      label: "案件归档",
      iconKey: "compass",
      statusBadge: { label: "只读", tone: "muted" },
    },
  ],
};

const legacyCluster: WorkspaceNavExtensionCluster = {
  extensionKey: "reports-sample",
  label: "Reports sample",
  items: [
    {
      key: "sample-board",
      href: "/sample-board",
      label: "样例看板",
      iconKey: "chart",
      statusBadge: { label: "试运行", tone: "live" },
    },
  ],
};

// Href shares the Core review prefix ("/approvals") on purpose: Core's
// review-capability filter must not hide a pack-authorized extension link.
const approvalsArchiveItem: WorkspaceNavExtensionCluster["items"][number] = {
  key: "approvals-archive",
  href: "/approvals-archive",
  label: "审批归档",
  iconKey: "boxes",
  statusBadge: { label: "已上线", tone: "live" },
};

const boundWorkstation: MemberRoleHomeWorkstation = {
  key: "sample-seat",
  href: "/sample/seat-desk",
  label: "样例工位",
};

const CORE_CUSTOMER_ASSET_HREFS = ["/opportunities", "/meetings", "/inbox"];

function renderSidebar(input: {
  controlTowerHome: boolean;
  clusters: ReadonlyArray<WorkspaceNavExtensionCluster>;
  workstation?: MemberRoleHomeWorkstation | null;
  canReviewGovernedActions?: boolean;
}) {
  uiState.controlTowerHome = input.controlTowerHome;
  return render(
    <Sidebar
      workspaceName="Sample workspace"
      pendingApprovals={0}
      navExtensionClusters={input.clusters}
      showCaioPrimaryNavigation={false}
      canReviewGovernedActions={input.canReviewGovernedActions ?? false}
      workstationHomeEntry={input.workstation ?? null}
    />,
  );
}

function customerAssetsSection() {
  const heading = screen.getByText("客户资产");
  const section = heading.parentElement;
  if (!section) throw new Error("customer assets section not rendered");
  return section;
}

function linkHrefs(container: HTMLElement) {
  return Array.from(container.querySelectorAll("a")).map((link) =>
    link.getAttribute("href"),
  );
}

function extensionHrefs(cluster: WorkspaceNavExtensionCluster) {
  return cluster.items.map((item) => item.href);
}

afterEach(() => {
  cleanup();
  uiState.controlTowerHome = false;
});

describe("getSidebarExtensionPlacement", () => {
  const clusters = [customerAssetsCluster, legacyCluster];

  it("injects customer-assets clusters into Core sections and keeps others in Extensions", () => {
    expect(
      getSidebarExtensionPlacement({
        clusters,
        catalogActive: false,
        showExtensionClusters: true,
      }),
    ).toEqual({
      customerAssetsItems: customerAssetsCluster.items,
      extensionClusters: [legacyCluster],
    });
  });

  it("falls back to the Extensions area when a destination catalog drives navigation", () => {
    expect(
      getSidebarExtensionPlacement({
        clusters,
        catalogActive: true,
        showExtensionClusters: true,
      }),
    ).toEqual({
      customerAssetsItems: [],
      extensionClusters: clusters,
    });
  });

  it.each([false, true])(
    "hides every placement when extension clusters are hidden (catalogActive=%s)",
    (catalogActive) => {
      expect(
        getSidebarExtensionPlacement({
          clusters,
          catalogActive,
          showExtensionClusters: false,
        }),
      ).toEqual({ customerAssetsItems: [], extensionClusters: [] });
    },
  );

  it("keeps clusters without placement where they were", () => {
    expect(
      getSidebarExtensionPlacement({
        clusters: [legacyCluster],
        catalogActive: false,
        showExtensionClusters: true,
      }),
    ).toEqual({ customerAssetsItems: [], extensionClusters: [legacyCluster] });
  });
});

describe("Sidebar extension placement", () => {
  it("keeps Core navigation unchanged when no extension is registered", () => {
    renderSidebar({ controlTowerHome: false, clusters: [] });

    expect(linkHrefs(customerAssetsSection())).toEqual(
      CORE_CUSTOMER_ASSET_HREFS,
    );
    expect(screen.queryByTestId("workspace-nav-extensions")).toBeNull();
  });

  it("routes customer-assets links into Customer assets and keeps other clusters in Extensions", () => {
    renderSidebar({
      controlTowerHome: false,
      clusters: [customerAssetsCluster, legacyCluster],
    });

    const section = customerAssetsSection();
    expect(linkHrefs(section)).toEqual([
      ...CORE_CUSTOMER_ASSET_HREFS,
      ...extensionHrefs(customerAssetsCluster),
    ]);

    const extensions = screen.getByTestId("workspace-nav-extensions");
    expect(linkHrefs(extensions)).toEqual(extensionHrefs(legacyCluster));
    expect(within(extensions).getByText("试运行")).toBeInTheDocument();
  });

  it("keeps live, planned and blocked badges on links moved into Customer assets", () => {
    renderSidebar({ controlTowerHome: false, clusters: [customerAssetsCluster] });

    const section = customerAssetsSection();
    const linkFor = (label: string) =>
      within(section).getByText(label).closest("a") as HTMLElement;

    expect(within(linkFor("案件台")).getByText("未启用")).toHaveClass(
      "bg-[color:var(--status-warning-bg)]",
    );
    expect(within(linkFor("在办案件")).getByText("已上线")).toHaveClass(
      "bg-[color:var(--status-success-bg)]",
    );
    expect(within(linkFor("受阻案件")).getByText("已阻断")).toHaveClass(
      "bg-[color:var(--status-danger-bg)]",
    );

    const mutedLink = linkFor("案件归档");
    expect(within(mutedLink).queryByText("只读")).toBeNull();
    expect(mutedLink.querySelector(".ml-auto")).toBeNull();
  });

  it.each([false, true])(
    "keeps the extension's own access semantics for links sharing the Core review prefix (canReviewGovernedActions=%s)",
    (canReviewGovernedActions) => {
      renderSidebar({
        controlTowerHome: false,
        canReviewGovernedActions,
        clusters: [
          {
            placement: "customer-assets",
            extensionKey: "archive-sample",
            label: "Archive sample",
            items: [approvalsArchiveItem],
          },
        ],
      });

      const section = customerAssetsSection();
      expect(linkHrefs(section)).toEqual([
        ...CORE_CUSTOMER_ASSET_HREFS,
        approvalsArchiveItem.href,
      ]);
      expect(within(section).getByText("已上线")).toBeInTheDocument();
      // Core's own review entry still follows the review capability.
      expect(
        document.querySelector('a[href="/approvals"]') !== null,
      ).toBe(canReviewGovernedActions);
    },
  );

  it("shows the same review-prefixed link in the Extensions area without placement", () => {
    renderSidebar({
      controlTowerHome: false,
      canReviewGovernedActions: false,
      clusters: [
        {
          extensionKey: "archive-sample",
          label: "Archive sample",
          items: [approvalsArchiveItem],
        },
      ],
    });

    expect(
      linkHrefs(screen.getByTestId("workspace-nav-extensions")),
    ).toEqual([approvalsArchiveItem.href]);
    expect(linkHrefs(customerAssetsSection())).toEqual(
      CORE_CUSTOMER_ASSET_HREFS,
    );
    expect(document.querySelector('a[href="/approvals"]')).toBeNull();
  });

  it("hides customer-assets links when a dedicated workstation is bound and control tower home is off", () => {
    renderSidebar({
      controlTowerHome: false,
      clusters: [customerAssetsCluster, legacyCluster],
      workstation: boundWorkstation,
    });

    expect(linkHrefs(customerAssetsSection())).toEqual(
      CORE_CUSTOMER_ASSET_HREFS,
    );
    expect(screen.queryByTestId("workspace-nav-extensions")).toBeNull();
    for (const href of [
      ...extensionHrefs(customerAssetsCluster),
      ...extensionHrefs(legacyCluster),
    ]) {
      expect(document.querySelector(`a[href="${href}"]`)).toBeNull();
    }
  });

  it("falls back to the Extensions area with badges when control tower home is on", () => {
    renderSidebar({
      controlTowerHome: true,
      clusters: [customerAssetsCluster, legacyCluster],
    });

    expect(screen.queryByText("客户资产")).toBeNull();
    const extensions = screen.getByTestId("workspace-nav-extensions");
    expect(linkHrefs(extensions)).toEqual([
      ...extensionHrefs(customerAssetsCluster),
      ...extensionHrefs(legacyCluster),
    ]);
    expect(within(extensions).getByText("未启用")).toBeInTheDocument();
    expect(within(extensions).queryByText("只读")).toBeNull();
  });

  it("keeps extensions hidden when control tower home is on and a workstation is bound", () => {
    renderSidebar({
      controlTowerHome: true,
      clusters: [customerAssetsCluster, legacyCluster],
      workstation: boundWorkstation,
    });

    expect(screen.queryByTestId("workspace-nav-extensions")).toBeNull();
    expect(linkHrefs(document.body)).toContain(boundWorkstation.href);
    for (const href of [
      ...extensionHrefs(customerAssetsCluster),
      ...extensionHrefs(legacyCluster),
    ]) {
      expect(document.querySelector(`a[href="${href}"]`)).toBeNull();
    }
  });
});
