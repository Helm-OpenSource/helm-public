/**
 * Group scope resolution for the minimal two-level view (chain customers:
 * a store lead sees their own group's process, the owner sees everything).
 *
 * Rule: workspace owners / admins / billing admins, and any member WITHOUT a
 * groupTag, are unrestricted (null). A group-tagged non-admin member resolves
 * to the ACTIVE members sharing the same tag. Fallback is deliberately
 * fail-open to the full workspace view so untagged workspaces behave exactly
 * as before this feature existed.
 */

import { MembershipStatus, WorkspaceRole } from "@prisma/client";
import { db } from "@/lib/db";

const UNRESTRICTED_ROLES: readonly WorkspaceRole[] = [
  WorkspaceRole.OWNER,
  WorkspaceRole.ADMIN,
  WorkspaceRole.BILLING_ADMIN,
];

export function isGroupScopeUnrestricted(membership: {
  role: WorkspaceRole;
  groupTag: string | null;
}): boolean {
  return (
    UNRESTRICTED_ROLES.includes(membership.role) || !membership.groupTag?.trim()
  );
}

/**
 * Returns null when the member sees the whole workspace; otherwise the
 * userIds of ACTIVE members sharing the member's groupTag (always including
 * the member's own userId even if their membership row is mid-transition).
 */
export async function resolveGroupScopeUserIds(input: {
  workspaceId: string;
  membership: { userId: string; role: WorkspaceRole; groupTag: string | null };
}): Promise<string[] | null> {
  if (isGroupScopeUnrestricted(input.membership)) {
    return null;
  }
  const members = await db.membership.findMany({
    where: {
      workspaceId: input.workspaceId,
      groupTag: input.membership.groupTag,
      status: MembershipStatus.ACTIVE,
    },
    select: { userId: true },
  });
  const userIds = new Set(members.map((member) => member.userId));
  userIds.add(input.membership.userId);
  return [...userIds];
}
