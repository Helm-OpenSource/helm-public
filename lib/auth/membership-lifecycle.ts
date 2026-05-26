import { MembershipStatus, WorkspaceRole } from "@prisma/client";

export type MembershipStatusTransitionGuardResult =
  | { ok: true }
  | {
      ok: false;
      code:
        | "LAST_OWNER_GUARD"
        | "OWNER_CANNOT_RETURN_TO_INVITED"
        | "ACTIVE_TO_INVITED_NOT_ALLOWED"
        | "INVITED_TO_ACTIVE_NOT_ALLOWED";
    };

export function validateMembershipStatusTransition(input: {
  currentStatus: MembershipStatus;
  nextStatus: MembershipStatus;
  targetRole: WorkspaceRole;
  activeOwnerCount: number;
}): MembershipStatusTransitionGuardResult {
  if (input.currentStatus === input.nextStatus) {
    return { ok: true };
  }

  if (
    input.nextStatus === MembershipStatus.INACTIVE &&
    input.targetRole === WorkspaceRole.OWNER &&
    input.currentStatus !== MembershipStatus.INACTIVE &&
    input.activeOwnerCount <= 1
  ) {
    return { ok: false, code: "LAST_OWNER_GUARD" };
  }

  if (input.nextStatus === MembershipStatus.INVITED) {
    if (input.targetRole === WorkspaceRole.OWNER) {
      return { ok: false, code: "OWNER_CANNOT_RETURN_TO_INVITED" };
    }

    if (input.currentStatus === MembershipStatus.ACTIVE) {
      return { ok: false, code: "ACTIVE_TO_INVITED_NOT_ALLOWED" };
    }
  }

  if (input.nextStatus === MembershipStatus.ACTIVE && input.currentStatus === MembershipStatus.INVITED) {
    return { ok: false, code: "INVITED_TO_ACTIVE_NOT_ALLOWED" };
  }

  return { ok: true };
}

export type OwnershipTransferGuardResult =
  | { ok: true }
  | {
      ok: false;
      code: "OWNER_REQUIRED" | "TARGET_ALREADY_OWNER" | "TARGET_MUST_BE_ACTIVE" | "SELF_TRANSFER_NOT_ALLOWED";
    };

export function validateOwnershipTransfer(input: {
  actorRole: WorkspaceRole;
  actorUserId: string;
  targetUserId: string;
  targetRole: WorkspaceRole;
  targetStatus: MembershipStatus;
}): OwnershipTransferGuardResult {
  if (input.actorRole !== WorkspaceRole.OWNER) {
    return { ok: false, code: "OWNER_REQUIRED" };
  }

  if (input.actorUserId === input.targetUserId) {
    return { ok: false, code: "SELF_TRANSFER_NOT_ALLOWED" };
  }

  if (input.targetRole === WorkspaceRole.OWNER) {
    return { ok: false, code: "TARGET_ALREADY_OWNER" };
  }

  if (input.targetStatus !== MembershipStatus.ACTIVE) {
    return { ok: false, code: "TARGET_MUST_BE_ACTIVE" };
  }

  return { ok: true };
}

export type MembershipRoleTransitionGuardResult =
  | { ok: true }
  | {
      ok: false;
      code: "DIRECT_OWNER_ASSIGNMENT_NOT_ALLOWED" | "LAST_OWNER_ROLE_CHANGE_GUARD";
    };

export function validateMembershipRoleTransition(input: {
  currentRole: WorkspaceRole;
  nextRole: WorkspaceRole;
  currentStatus: MembershipStatus;
  activeOwnerCount: number;
}): MembershipRoleTransitionGuardResult {
  if (input.currentRole === input.nextRole) {
    return { ok: true };
  }

  if (input.nextRole === WorkspaceRole.OWNER) {
    return { ok: false, code: "DIRECT_OWNER_ASSIGNMENT_NOT_ALLOWED" };
  }

  if (
    input.currentRole === WorkspaceRole.OWNER &&
    input.currentStatus !== MembershipStatus.INACTIVE &&
    input.activeOwnerCount <= 1
  ) {
    return { ok: false, code: "LAST_OWNER_ROLE_CHANGE_GUARD" };
  }

  return { ok: true };
}
