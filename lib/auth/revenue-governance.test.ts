import { describe, expect, it } from "vitest";
import { WorkspaceRole } from "@prisma/client";
import {
  canManageContributionRegistry,
  canManageManualSettlement,
  canManageParticipantPortal,
  canReadContributionRegistry,
  getContributionRegistryManagementDeniedMessage,
  getManualSettlementManagementDeniedMessage,
  getParticipantPortalManagementDeniedMessage,
} from "@/lib/auth/revenue-governance";

describe("revenue governance helpers", () => {
  it("keeps registry read and write on admin-class roles", () => {
    for (const role of [WorkspaceRole.OWNER, WorkspaceRole.BILLING_ADMIN, WorkspaceRole.ADMIN]) {
      expect(canReadContributionRegistry(role)).toBe(true);
      expect(canManageContributionRegistry(role)).toBe(true);
      expect(canManageManualSettlement(role)).toBe(true);
      expect(canManageParticipantPortal(role)).toBe(true);
    }

    for (const role of [WorkspaceRole.OPERATOR, WorkspaceRole.REVIEWER, WorkspaceRole.MEMBER]) {
      expect(canReadContributionRegistry(role)).toBe(false);
      expect(canManageContributionRegistry(role)).toBe(false);
      expect(canManageManualSettlement(role)).toBe(false);
      expect(canManageParticipantPortal(role)).toBe(false);
    }
  });

  it("returns domain-specific denied messages", () => {
    expect(getContributionRegistryManagementDeniedMessage(true)).toContain("registry");
    expect(getManualSettlementManagementDeniedMessage(true, "registry")).toContain("settlement registry");
    expect(getManualSettlementManagementDeniedMessage(true, "settlement")).toContain("manual settlement");
    expect(getParticipantPortalManagementDeniedMessage(false)).toContain("门户访问");
  });
});
