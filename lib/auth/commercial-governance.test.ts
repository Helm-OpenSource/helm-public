import { describe, expect, it } from "vitest";
import { WorkspaceRole } from "@prisma/client";
import {
  canManageContributionRegistry,
  canManageManualSettlement,
  canManageParticipantPortal,
  canManageProgramApplications,
  canManageWorkspaceBilling,
  canReadContributionRegistry,
  getBillingManagementDeniedMessage,
  getContributionRegistryManagementDeniedMessage,
  getManualSettlementManagementDeniedMessage,
  getParticipantPortalManagementDeniedMessage,
  getProgramApplicationManagementDeniedMessage,
} from "@/lib/auth/commercial-governance";

describe("commercial governance helpers", () => {
  it("keeps commercial governance on the intended fixed-role bands", () => {
    expect(canManageWorkspaceBilling(WorkspaceRole.OWNER)).toBe(true);
    expect(canManageWorkspaceBilling(WorkspaceRole.BILLING_ADMIN)).toBe(true);
    expect(canManageWorkspaceBilling(WorkspaceRole.ADMIN)).toBe(false);

    for (const role of [WorkspaceRole.OWNER, WorkspaceRole.BILLING_ADMIN, WorkspaceRole.ADMIN]) {
      expect(canReadContributionRegistry(role)).toBe(true);
      expect(canManageContributionRegistry(role)).toBe(true);
      expect(canManageManualSettlement(role)).toBe(true);
      expect(canManageParticipantPortal(role)).toBe(true);
      expect(canManageProgramApplications(role)).toBe(true);
    }

    for (const role of [WorkspaceRole.OPERATOR, WorkspaceRole.REVIEWER, WorkspaceRole.MEMBER]) {
      expect(canReadContributionRegistry(role)).toBe(false);
      expect(canManageContributionRegistry(role)).toBe(false);
      expect(canManageManualSettlement(role)).toBe(false);
      expect(canManageParticipantPortal(role)).toBe(false);
      expect(canManageProgramApplications(role)).toBe(false);
    }
  });

  it("returns localized domain-specific denied messages", () => {
    expect(getBillingManagementDeniedMessage(true, "checkout")).toContain("checkout");
    expect(getContributionRegistryManagementDeniedMessage(true)).toContain("registry");
    expect(getManualSettlementManagementDeniedMessage(true, "registry")).toContain("settlement registry");
    expect(getParticipantPortalManagementDeniedMessage(false)).toContain("门户访问");
    expect(getProgramApplicationManagementDeniedMessage(false)).toContain("审核申请");
  });
});
