import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function read(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), "utf8");
}

describe("Helm CAIO CEO-owner primary navigation", () => {
  it("threads a server-derived navigation decision through desktop and mobile shells", () => {
    const layout = read("app/(workspace)/layout.tsx");
    const appShell = read("components/layout/app-shell.tsx");
    const sidebar = read("components/layout/sidebar.tsx");
    const topbar = read("components/layout/topbar.tsx");

    expect(layout).toContain("shouldShowCaioPrimaryNavigation");
    expect(layout).toContain("showCaioPrimaryNavigation:");
    expect(
      appShell.match(
        /showCaioPrimaryNavigation=\{showCaioPrimaryNavigation\}/g,
      ),
    ).toHaveLength(3);
    expect(sidebar).toContain('"caio-primary-navigation"');
    expect(sidebar).toContain("CEO 直属 AI");
    expect(sidebar).toContain("CEO-direct AI");
    expect(topbar).toContain('"mobile-caio-primary-navigation"');
  });

  it("keeps the dedicated route OWNER-only and read-only", () => {
    const page = read("app/(workspace)/caio/page.tsx");

    expect(page).toContain(
      "session.membership.role !== WorkspaceRole.OWNER",
    );
    expect(page).toContain("notFound()");
    expect(page).toContain("getWorkspaceStage1OwnerLoopReadout");
    expect(page).toContain("<Stage1OwnerLoopConsole");
    expect(page).toContain("只读、复核优先");
    expect(page).toContain("does not execute, send, or create commitments");
    expect(page).not.toMatch(/\.(?:create|update|upsert|delete)\(/u);
    expect(page).not.toContain("server action");
  });
});
