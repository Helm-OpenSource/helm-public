import { describe, expect, it } from "vitest";
import { WorkspaceRole } from "@prisma/client";
import {
  canManageProgramApplications,
  getProgramApplicationManagementDeniedMessage,
} from "@/lib/auth/program-applications";

describe("program application permissions", () => {
  it("keeps review and invite actions on admin-class roles", () => {
    for (const role of [WorkspaceRole.OWNER, WorkspaceRole.BILLING_ADMIN, WorkspaceRole.ADMIN]) {
      expect(canManageProgramApplications(role)).toBe(true);
    }

    for (const role of [WorkspaceRole.OPERATOR, WorkspaceRole.REVIEWER, WorkspaceRole.MEMBER]) {
      expect(canManageProgramApplications(role)).toBe(false);
    }
  });

  it("returns a localized denial message", () => {
    expect(getProgramApplicationManagementDeniedMessage(true)).toContain("Only owner");
    expect(getProgramApplicationManagementDeniedMessage(false)).toContain("只有组织负责人");
  });
});
