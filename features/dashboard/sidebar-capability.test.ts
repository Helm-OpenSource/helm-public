import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getSidebarReviewPresentation } from "@/components/layout/sidebar";

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
    expect(appShell.match(/canReviewGovernedActions=\{canReviewGovernedActions\}/g)).toHaveLength(
      2,
    );
    expect(sidebar).toContain(
      "reviewPresentation.showPendingApprovals ? (",
    );
    expect(sidebar).toContain(
      ").filter((section) => section.items.length > 0)",
    );
  });
});
