import { describe, expect, it } from "vitest";
import { WorkspaceRole } from "@prisma/client";
import {
  canManageWorkspaceGovernedActions,
  canReviewWorkspaceGovernedActions,
  getGovernedActionManagementDeniedMessage,
  getGovernedActionReviewDeniedMessage,
} from "@/lib/auth/action-governance";

describe("action governance", () => {
  it("keeps governed-action creation on owner/admin/operator", () => {
    for (const role of [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR]) {
      expect(canManageWorkspaceGovernedActions(role)).toBe(true);
    }

    for (const role of [WorkspaceRole.BILLING_ADMIN, WorkspaceRole.REVIEWER, WorkspaceRole.MEMBER]) {
      expect(canManageWorkspaceGovernedActions(role)).toBe(false);
    }
  });

  it("keeps governed-action review on the review-capable surface", () => {
    for (const role of [
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
      WorkspaceRole.OPERATOR,
      WorkspaceRole.REVIEWER,
    ]) {
      expect(canReviewWorkspaceGovernedActions(role)).toBe(true);
    }

    for (const role of [WorkspaceRole.BILLING_ADMIN, WorkspaceRole.MEMBER]) {
      expect(canReviewWorkspaceGovernedActions(role)).toBe(false);
    }
  });

  it("returns explicit deny wording", () => {
    expect(getGovernedActionManagementDeniedMessage(true)).toContain("governed workspace actions");
    expect(getGovernedActionManagementDeniedMessage(false)).toContain("受治理的工作区动作");
    expect(getGovernedActionReviewDeniedMessage(true)).toContain("review governed workspace actions");
    expect(getGovernedActionReviewDeniedMessage(false)).toContain("复核受治理的工作区动作");
  });
});
