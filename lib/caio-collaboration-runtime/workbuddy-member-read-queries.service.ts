import "server-only";

import type {
  WorkBuddyMemberReadQueries,
} from "@/lib/caio-collaboration/member-readonly-tools";
import { db } from "@/lib/db";

type MembershipLookup = Readonly<{
  membership: Readonly<{
    findUnique(input: {
      where: {
        workspaceId_userId: {
          workspaceId: string;
          userId: string;
        };
      };
      select: { status: true; role: true };
    }): Promise<Readonly<{
      status: "ACTIVE" | "INVITED" | "INACTIVE";
      role:
        | "OWNER"
        | "ADMIN"
        | "BILLING_ADMIN"
        | "OPERATOR"
        | "REVIEWER"
        | "MEMBER";
    }> | null>;
  }>;
}>;

export function createWorkBuddyMemberReadQueries(input?: {
  database: MembershipLookup;
}): WorkBuddyMemberReadQueries {
  const database = input?.database ?? db;
  return Object.freeze({
    async loadMembership(
      query: Parameters<
        WorkBuddyMemberReadQueries["loadMembership"]
      >[0],
    ) {
      return database.membership.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId: query.workspaceId,
            userId: query.actorUserId,
          },
        },
        select: { status: true, role: true },
      });
    },
  });
}
