import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  getSidebarReviewPresentation,
  getSidebarWorkstationPresentation,
} from "@/components/layout/sidebar";

function read(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("getSidebarReviewPresentation", () => {
  it("removes review navigation and the pending-review card without capability", () => {
    expect(getSidebarReviewPresentation(false)).toEqual({
      excludedHrefs: ["/approvals"],
      showPendingApprovals: false,
    });
  });

  it("keeps review navigation and the pending-review card for reviewers", () => {
    expect(getSidebarReviewPresentation(true)).toEqual({
      excludedHrefs: [],
      showPendingApprovals: true,
    });
  });

  it("threads the server-derived capability through the shell into both sidebar branches", () => {
    const layout = read("app/(workspace)/layout.tsx");
    const appShell = read("components/layout/app-shell.tsx");
    const sidebar = read("components/layout/sidebar.tsx");

    expect(layout).toContain(
      "canReviewGovernedActions: canReviewWorkspaceGovernedActions(",
    );
    expect(
      appShell.match(/canReviewGovernedActions=\{canReviewGovernedActions\}/g),
    ).toHaveLength(2);
    expect(sidebar).toMatch(
      /reviewPresentation\.showPendingApprovals\s*&&\s*workstationPresentation\.showUtilityPanel/,
    );
    expect(sidebar).toContain(
      ").filter((section) => section.items.length > 0)",
    );
  });
});

describe("getSidebarWorkstationPresentation", () => {
  it("keeps full Core navigation when no dedicated workstation is bound", () => {
    expect(getSidebarWorkstationPresentation(null)).toEqual({
      catalog: null,
      showExtensionClusters: true,
      showUtilityPanel: true,
    });
  });

  it("keeps full chrome but narrows navigation to the bound role workstation", () => {
    expect(
      getSidebarWorkstationPresentation({
        key: "collection-seat",
        href: "/anson/seat-desk",
        label: "催收坐席工位",
      }),
    ).toEqual({
      catalog: {
        primary: [
          {
            href: "/anson/seat-desk",
            labelZh: "催收坐席工位",
            labelEn: "催收坐席工位",
          },
        ],
        secondary: [],
        drawer: [],
      },
      showExtensionClusters: false,
      showUtilityPanel: false,
    });
  });
});
