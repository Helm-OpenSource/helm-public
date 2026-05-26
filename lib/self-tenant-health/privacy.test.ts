import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WorkspaceClass, WorkspaceStatus } from "@prisma/client";
import {
  TenantHealthAccessDeniedError,
  TENANT_HEALTH_TELEMETRY_DENYLIST,
  assertTenantHealthAccess,
  assertTelemetryProjectionIsSafe,
  createTenantAlias,
  createTenantAliasHash,
  suppressSmallCount,
} from "@/lib/self-tenant-health/privacy";
import {
  HELM_RESERVED_WORKSPACE_SYSTEM_KEY,
} from "@/lib/workspace-identity";

describe("self-tenant health privacy guards", () => {
  it("allows only approved internal operating workspaces", () => {
    expect(() =>
      assertTenantHealthAccess(
        {
          workspaceClass: WorkspaceClass.HELM_RESERVED,
          systemKey: HELM_RESERVED_WORKSPACE_SYSTEM_KEY,
          status: WorkspaceStatus.ACTIVE,
        },
      ),
    ).not.toThrow();

    expect(() =>
      assertTenantHealthAccess(
        {
          workspaceClass: WorkspaceClass.CUSTOMER,
          slug: "example-customer",
          systemKey: "example-customer",
          status: WorkspaceStatus.ACTIVE,
        },
      ),
    ).toThrow(TenantHealthAccessDeniedError);

    expect(() =>
      assertTenantHealthAccess(
        {
          workspaceClass: WorkspaceClass.CUSTOMER,
          systemKey: null,
          status: WorkspaceStatus.ACTIVE,
        },
      ),
    ).toThrow(TenantHealthAccessDeniedError);
  });

  it("keeps tenant aliases deterministic only for the same salt", () => {
    expect(createTenantAlias("workspace_a", "salt_1")).toBe(
      createTenantAlias("workspace_a", "salt_1"),
    );
    expect(createTenantAliasHash("workspace_a", "salt_1")).not.toBe(
      createTenantAliasHash("workspace_a", "salt_2"),
    );
  });

  it("suppresses visible counts below five", () => {
    expect(suppressSmallCount(0)).toBe("0");
    expect(suppressSmallCount(1)).toBe("<5");
    expect(suppressSmallCount(4)).toBe("<5");
    expect(suppressSmallCount(5)).toBe("5");
  });

  it("rejects unsafe projection keys before cross-tenant rendering", () => {
    expect(() => assertTelemetryProjectionIsSafe({ tenantAlias: "tenant_1234" })).not.toThrow();
    expect(() =>
      assertTelemetryProjectionIsSafe({
        tenantAlias: "tenant_1234",
        inputSummary: "raw text",
      }),
    ).toThrow(/inputSummary/);
  });

  it("keeps the tenant health route and page free of forbidden raw fields", () => {
    const root = process.cwd();
    const guardedFiles = [
      "app/(workspace)/operating/tenant-health/page.tsx",
      "features/self-tenant-health/tenant-health-page.tsx",
      "lib/self-tenant-health/queries.ts",
    ];
    const staticForbiddenFields = TENANT_HEALTH_TELEMETRY_DENYLIST.filter(
      (field) => !["payload", "summary", "prompt", "email", "phone"].includes(field),
    );

    for (const relativePath of guardedFiles) {
      const content = readFileSync(join(root, relativePath), "utf8");
      for (const field of staticForbiddenFields) {
        expect(content, `${relativePath} should not mention ${field}`).not.toContain(field);
      }
    }
  });
});
