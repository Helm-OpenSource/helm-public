import { describe, expect, it } from "vitest";
import { MembershipStatus, WorkspaceRole } from "@prisma/client";
import {
  validateMembershipStatusTransition,
  validateMembershipRoleTransition,
  validateOwnershipTransfer,
} from "@/lib/auth/membership-lifecycle";

describe("validateMembershipStatusTransition", () => {
  it("blocks deactivating the last active owner", () => {
    expect(
      validateMembershipStatusTransition({
        currentStatus: MembershipStatus.ACTIVE,
        nextStatus: MembershipStatus.INACTIVE,
        targetRole: WorkspaceRole.OWNER,
        activeOwnerCount: 1,
      }),
    ).toEqual({ ok: false, code: "LAST_OWNER_GUARD" });
  });

  it("keeps invited posture narrow instead of silently promoting or downgrading owner state", () => {
    expect(
      validateMembershipStatusTransition({
        currentStatus: MembershipStatus.ACTIVE,
        nextStatus: MembershipStatus.INVITED,
        targetRole: WorkspaceRole.ADMIN,
        activeOwnerCount: 2,
      }),
    ).toEqual({ ok: false, code: "ACTIVE_TO_INVITED_NOT_ALLOWED" });

    expect(
      validateMembershipStatusTransition({
        currentStatus: MembershipStatus.INACTIVE,
        nextStatus: MembershipStatus.INVITED,
        targetRole: WorkspaceRole.OWNER,
        activeOwnerCount: 2,
      }),
    ).toEqual({ ok: false, code: "OWNER_CANNOT_RETURN_TO_INVITED" });
  });

  it("allows the narrow supported lifecycle transitions", () => {
    expect(
      validateMembershipStatusTransition({
        currentStatus: MembershipStatus.ACTIVE,
        nextStatus: MembershipStatus.INACTIVE,
        targetRole: WorkspaceRole.ADMIN,
        activeOwnerCount: 2,
      }),
    ).toEqual({ ok: true });

    expect(
      validateMembershipStatusTransition({
        currentStatus: MembershipStatus.INACTIVE,
        nextStatus: MembershipStatus.ACTIVE,
        targetRole: WorkspaceRole.ADMIN,
        activeOwnerCount: 1,
      }),
    ).toEqual({ ok: true });

    expect(
      validateMembershipStatusTransition({
        currentStatus: MembershipStatus.INACTIVE,
        nextStatus: MembershipStatus.INVITED,
        targetRole: WorkspaceRole.ADMIN,
        activeOwnerCount: 1,
      }),
    ).toEqual({ ok: true });
  });
});

describe("validateOwnershipTransfer", () => {
  it("requires the current actor to be the owner", () => {
    expect(
      validateOwnershipTransfer({
        actorRole: WorkspaceRole.ADMIN,
        actorUserId: "actor-1",
        targetUserId: "target-1",
        targetRole: WorkspaceRole.ADMIN,
        targetStatus: MembershipStatus.ACTIVE,
      }),
    ).toEqual({ ok: false, code: "OWNER_REQUIRED" });
  });

  it("requires an active non-owner target", () => {
    expect(
      validateOwnershipTransfer({
        actorRole: WorkspaceRole.OWNER,
        actorUserId: "actor-1",
        targetUserId: "actor-1",
        targetRole: WorkspaceRole.ADMIN,
        targetStatus: MembershipStatus.ACTIVE,
      }),
    ).toEqual({ ok: false, code: "SELF_TRANSFER_NOT_ALLOWED" });

    expect(
      validateOwnershipTransfer({
        actorRole: WorkspaceRole.OWNER,
        actorUserId: "actor-1",
        targetUserId: "target-1",
        targetRole: WorkspaceRole.OWNER,
        targetStatus: MembershipStatus.ACTIVE,
      }),
    ).toEqual({ ok: false, code: "TARGET_ALREADY_OWNER" });

    expect(
      validateOwnershipTransfer({
        actorRole: WorkspaceRole.OWNER,
        actorUserId: "actor-1",
        targetUserId: "target-1",
        targetRole: WorkspaceRole.ADMIN,
        targetStatus: MembershipStatus.INVITED,
      }),
    ).toEqual({ ok: false, code: "TARGET_MUST_BE_ACTIVE" });
  });

  it("allows a real ownership transfer target", () => {
    expect(
      validateOwnershipTransfer({
        actorRole: WorkspaceRole.OWNER,
        actorUserId: "actor-1",
        targetUserId: "target-1",
        targetRole: WorkspaceRole.ADMIN,
        targetStatus: MembershipStatus.ACTIVE,
      }),
    ).toEqual({ ok: true });
  });
});

describe("validateMembershipRoleTransition", () => {
  it("does not allow direct owner assignment through the generic role-change path", () => {
    expect(
      validateMembershipRoleTransition({
        currentRole: WorkspaceRole.ADMIN,
        nextRole: WorkspaceRole.OWNER,
        currentStatus: MembershipStatus.ACTIVE,
        activeOwnerCount: 1,
      }),
    ).toEqual({ ok: false, code: "DIRECT_OWNER_ASSIGNMENT_NOT_ALLOWED" });
  });

  it("blocks demoting the last active owner", () => {
    expect(
      validateMembershipRoleTransition({
        currentRole: WorkspaceRole.OWNER,
        nextRole: WorkspaceRole.ADMIN,
        currentStatus: MembershipStatus.ACTIVE,
        activeOwnerCount: 1,
      }),
    ).toEqual({ ok: false, code: "LAST_OWNER_ROLE_CHANGE_GUARD" });
  });

  it("allows non-owner role changes and owner demotion when another active owner remains", () => {
    expect(
      validateMembershipRoleTransition({
        currentRole: WorkspaceRole.MEMBER,
        nextRole: WorkspaceRole.REVIEWER,
        currentStatus: MembershipStatus.ACTIVE,
        activeOwnerCount: 1,
      }),
    ).toEqual({ ok: true });

    expect(
      validateMembershipRoleTransition({
        currentRole: WorkspaceRole.OWNER,
        nextRole: WorkspaceRole.ADMIN,
        currentStatus: MembershipStatus.ACTIVE,
        activeOwnerCount: 2,
      }),
    ).toEqual({ ok: true });
  });
});
