import { WorkspaceClass } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  HELM_RESERVED_WORKSPACE_SYSTEM_KEY,
  canAccessTenantHealthWorkspace,
  canViewEngineeringDeliveryReview,
  isHelmReservedWorkspace,
} from "@/lib/workspace-identity";

describe("workspace identity", () => {
  it("keeps reserved workspace detection anchored to class + system key", () => {
    expect(
      isHelmReservedWorkspace({
        workspaceClass: WorkspaceClass.HELM_RESERVED,
        systemKey: HELM_RESERVED_WORKSPACE_SYSTEM_KEY,
      }),
    ).toBe(true);

    expect(
      isHelmReservedWorkspace({
        workspaceClass: WorkspaceClass.HELM_RESERVED,
        systemKey: "other",
      }),
    ).toBe(false);
  });

  it("allows engineering delivery review only for the Helm reserved workspace", () => {
    expect(
      canViewEngineeringDeliveryReview({
        workspaceClass: WorkspaceClass.HELM_RESERVED,
        systemKey: HELM_RESERVED_WORKSPACE_SYSTEM_KEY,
        slug: "anything",
      }),
    ).toBe(true);

    expect(
      canViewEngineeringDeliveryReview({
        workspaceClass: WorkspaceClass.CUSTOMER,
        systemKey: null,
        slug: "helm平台",
      }),
    ).toBe(false);

    expect(
      canViewEngineeringDeliveryReview({
        workspaceClass: WorkspaceClass.CUSTOMER,
        systemKey: null,
        slug: "some-other-workspace",
      }),
    ).toBe(false);
  });

  it("allows tenant health only for the Helm reserved workspace", () => {
    expect(
      canAccessTenantHealthWorkspace({
        workspaceClass: WorkspaceClass.HELM_RESERVED,
        systemKey: HELM_RESERVED_WORKSPACE_SYSTEM_KEY,
      }),
    ).toBe(true);

    expect(
      canAccessTenantHealthWorkspace({
        workspaceClass: WorkspaceClass.CUSTOMER,
        systemKey: "example-customer",
      }),
    ).toBe(false);

    expect(
      canAccessTenantHealthWorkspace({
        workspaceClass: WorkspaceClass.HELM_RESERVED,
        systemKey: "wrong-system-key",
      }),
    ).toBe(false);
  });
});
