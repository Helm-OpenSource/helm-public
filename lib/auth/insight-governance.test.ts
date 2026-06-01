import { describe, expect, it } from "vitest";
import { WorkspaceRole } from "@prisma/client";
import {
  canManageWorkspaceInsights,
  getInsightGovernanceDeniedMessage,
} from "@/lib/auth/insight-governance";

describe("insight governance helper", () => {
  it("keeps insight management on the operator-class surface", () => {
    for (const role of [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR]) {
      expect(canManageWorkspaceInsights(role)).toBe(true);
    }

    for (const role of [WorkspaceRole.BILLING_ADMIN, WorkspaceRole.REVIEWER, WorkspaceRole.MEMBER]) {
      expect(canManageWorkspaceInsights(role)).toBe(false);
    }
  });

  it("returns a stable deny message", () => {
    expect(getInsightGovernanceDeniedMessage(true)).toContain("Only owner, admin, or operator");
    expect(getInsightGovernanceDeniedMessage(false)).toContain("只有组织负责人、管理员或运营角色");
  });
});
