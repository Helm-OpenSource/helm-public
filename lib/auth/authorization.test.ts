import { describe, expect, it } from "vitest";
import { WorkspaceRole } from "@prisma/client";
import {
  WORKSPACE_CAPABILITIES,
  getWorkspaceRoleCapabilities,
  workspaceRoleHasCapability,
} from "@/lib/auth/authorization";

describe("workspace capability matrix", () => {
  it("keeps billing capabilities narrower than the general admin surface", () => {
    expect(
      workspaceRoleHasCapability(WorkspaceRole.BILLING_ADMIN, WORKSPACE_CAPABILITIES.MANAGE_BILLING),
    ).toBe(true);
    expect(
      workspaceRoleHasCapability(WorkspaceRole.ADMIN, WORKSPACE_CAPABILITIES.MANAGE_BILLING),
    ).toBe(false);
    expect(
      workspaceRoleHasCapability(WorkspaceRole.BILLING_ADMIN, WORKSPACE_CAPABILITIES.MANAGE_POLICIES),
    ).toBe(false);
    expect(
      workspaceRoleHasCapability(WorkspaceRole.BILLING_ADMIN, WORKSPACE_CAPABILITIES.MANAGE_MEMORY_FACTS),
    ).toBe(false);
  });

  it("allows admin-class roles to manage member and registry surfaces", () => {
    for (const role of [WorkspaceRole.OWNER, WorkspaceRole.BILLING_ADMIN, WorkspaceRole.ADMIN]) {
      expect(
        workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.MANAGE_MEMBERS),
      ).toBe(true);
      expect(
        workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.MANAGE_CONTRIBUTION_REGISTRY),
      ).toBe(true);
      expect(
        workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.MANAGE_PARTICIPANT_PORTAL),
      ).toBe(true);
      expect(
        workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.MANAGE_PROGRAM_APPLICATIONS),
      ).toBe(true);
      expect(
        workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.EXPORT_ADMIN_SUPPORT_PACK),
      ).toBe(true);
    }
  });

  it("lets owners and admins manage workspace governance controls", () => {
    for (const role of [WorkspaceRole.OWNER, WorkspaceRole.ADMIN]) {
      expect(
        workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.MANAGE_POLICIES),
      ).toBe(true);
      expect(
        workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.MANAGE_WORKSPACE_SETUP),
      ).toBe(true);
      expect(
        workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.MANAGE_OPERATIONAL_CONTROLS),
      ).toBe(true);
    }
  });

  it("keeps connector and import management on the admin and operator ingress surface", () => {
    for (const role of [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR]) {
      expect(
        workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.MANAGE_CONNECTORS),
      ).toBe(true);
      expect(
        workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.MANAGE_IMPORTS),
      ).toBe(true);
    }

    for (const role of [WorkspaceRole.BILLING_ADMIN, WorkspaceRole.REVIEWER, WorkspaceRole.MEMBER]) {
      expect(
        workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.MANAGE_CONNECTORS),
      ).toBe(false);
      expect(
        workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.MANAGE_IMPORTS),
      ).toBe(false);
    }
  });

  it("keeps workspace record and internal action governance on the operator-class surface", () => {
    for (const role of [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR]) {
      expect(
        workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.MANAGE_WORKSPACE_RECORDS),
      ).toBe(true);
      expect(
        workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.MANAGE_INTERNAL_ACTIONS),
      ).toBe(true);
    }

    for (const role of [WorkspaceRole.BILLING_ADMIN, WorkspaceRole.REVIEWER, WorkspaceRole.MEMBER]) {
      expect(
        workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.MANAGE_WORKSPACE_RECORDS),
      ).toBe(false);
      expect(
        workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.MANAGE_INTERNAL_ACTIONS),
      ).toBe(false);
    }
  });

  it("keeps governed action creation narrower than governed action review", () => {
    for (const role of [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR]) {
      expect(
        workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.MANAGE_GOVERNED_ACTIONS),
      ).toBe(true);
      expect(
        workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.REVIEW_GOVERNED_ACTIONS),
      ).toBe(true);
    }

    expect(
      workspaceRoleHasCapability(WorkspaceRole.REVIEWER, WORKSPACE_CAPABILITIES.MANAGE_GOVERNED_ACTIONS),
    ).toBe(false);
    expect(
      workspaceRoleHasCapability(WorkspaceRole.REVIEWER, WORKSPACE_CAPABILITIES.REVIEW_GOVERNED_ACTIONS),
    ).toBe(true);
    expect(
      workspaceRoleHasCapability(WorkspaceRole.BILLING_ADMIN, WORKSPACE_CAPABILITIES.REVIEW_GOVERNED_ACTIONS),
    ).toBe(false);
    expect(
      workspaceRoleHasCapability(WorkspaceRole.MEMBER, WORKSPACE_CAPABILITIES.REVIEW_GOVERNED_ACTIONS),
    ).toBe(false);
  });

  it("keeps insight governance on the operator-class surface", () => {
    for (const role of [WorkspaceRole.OWNER, WorkspaceRole.ADMIN, WorkspaceRole.OPERATOR]) {
      expect(
        workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.MANAGE_INSIGHTS),
      ).toBe(true);
    }

    for (const role of [WorkspaceRole.BILLING_ADMIN, WorkspaceRole.REVIEWER, WorkspaceRole.MEMBER]) {
      expect(
        workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.MANAGE_INSIGHTS),
      ).toBe(false);
    }
  });

  it("keeps import conflict resolution on the review-capable surface", () => {
    for (const role of [
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
      WorkspaceRole.OPERATOR,
      WorkspaceRole.REVIEWER,
    ]) {
      expect(
        workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.RESOLVE_IMPORT_CONFLICTS),
      ).toBe(true);
    }

    for (const role of [WorkspaceRole.BILLING_ADMIN, WorkspaceRole.MEMBER]) {
      expect(
        workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.RESOLVE_IMPORT_CONFLICTS),
      ).toBe(false);
    }
  });

  it("keeps memory export and fact management on the operational review surface", () => {
    for (const role of [
      WorkspaceRole.OWNER,
      WorkspaceRole.ADMIN,
      WorkspaceRole.OPERATOR,
      WorkspaceRole.REVIEWER,
    ]) {
      expect(
        workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.EXPORT_MEMORY),
      ).toBe(true);
      expect(
        workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.MANAGE_MEMORY_FACTS),
      ).toBe(true);
    }

    for (const role of [WorkspaceRole.BILLING_ADMIN, WorkspaceRole.MEMBER]) {
      expect(
        workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.EXPORT_MEMORY),
      ).toBe(false);
      expect(
        workspaceRoleHasCapability(role, WORKSPACE_CAPABILITIES.MANAGE_MEMORY_FACTS),
      ).toBe(false);
    }
  });

  it("keeps member role outside the high-risk settings surface", () => {
    for (const role of [WorkspaceRole.MEMBER]) {
      expect(getWorkspaceRoleCapabilities(role)).toEqual([]);
    }
  });
});
