import { afterEach, describe, expect, it } from "vitest";
import { getHelmImplementationConsoleAccess } from "@/extensions/helm-implementation-console/lib/reports-extension";

describe("Helm implementation console access", () => {
  const originalSlugs = process.env.HELM_IMPLEMENTATION_CONSOLE_WORKSPACE_SLUGS;

  afterEach(() => {
    if (originalSlugs == null) {
      delete process.env.HELM_IMPLEMENTATION_CONSOLE_WORKSPACE_SLUGS;
    } else {
      process.env.HELM_IMPLEMENTATION_CONSOLE_WORKSPACE_SLUGS = originalSlugs;
    }
  });

  it("allows the production Helm reserved workspace by identity instead of slug", async () => {
    await expect(
      getHelmImplementationConsoleAccess({
        id: "workspace-helm-platform",
        slug: "helm平台",
        workspaceClass: "HELM_RESERVED",
        systemKey: "helm_reserved_primary",
      }),
    ).resolves.toEqual({ ok: true });
  });

  it("keeps the seeded dogfood workspace allowlist for local demos", async () => {
    await expect(
      getHelmImplementationConsoleAccess({
        id: "workspace-sales-demo",
        slug: "helm-sales-demo",
        workspaceClass: "CUSTOMER",
        systemKey: null,
      }),
    ).resolves.toEqual({ ok: true });
  });

  it("allows explicitly configured rollout slugs without making all customer workspaces eligible", async () => {
    process.env.HELM_IMPLEMENTATION_CONSOLE_WORKSPACE_SLUGS =
      "helm-staging-console,helm-internal-pilot";

    await expect(
      getHelmImplementationConsoleAccess({
        id: "workspace-staging",
        slug: "helm-staging-console",
        workspaceClass: "CUSTOMER",
        systemKey: null,
      }),
    ).resolves.toEqual({ ok: true });

    await expect(
      getHelmImplementationConsoleAccess({
        id: "workspace-customer",
        slug: "customer-tenant",
        workspaceClass: "CUSTOMER",
        systemKey: null,
      }),
    ).resolves.toEqual({ ok: false });
  });
});
