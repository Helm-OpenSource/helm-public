import { describe, expect, it } from "vitest";
import { WorkspaceRole } from "@prisma/client";
import {
  canManageWorkspaceBilling,
  getBillingManagementDeniedMessage,
} from "@/lib/auth/billing-governance";

describe("billing governance helpers", () => {
  it("keeps billing management on owner and billing admin", () => {
    expect(canManageWorkspaceBilling(WorkspaceRole.OWNER)).toBe(true);
    expect(canManageWorkspaceBilling(WorkspaceRole.BILLING_ADMIN)).toBe(true);
    expect(canManageWorkspaceBilling(WorkspaceRole.ADMIN)).toBe(false);
    expect(canManageWorkspaceBilling(WorkspaceRole.MEMBER)).toBe(false);
  });

  it("returns scope-specific denied messages", () => {
    expect(getBillingManagementDeniedMessage(true, "checkout")).toContain("checkout");
    expect(getBillingManagementDeniedMessage(true, "portal")).toContain("billing portal");
    expect(getBillingManagementDeniedMessage(true, "refresh")).toContain("refresh");
    expect(getBillingManagementDeniedMessage(false, "billing")).toContain("计费管理员");
  });
});
