import { describe, expect, it } from "vitest";

import {
  createWorkBuddyMemberReadQueries,
} from "./workbuddy-member-read-queries.service";

describe("WorkBuddy member read queries", () => {
  it("loads only the membership for the resolved workspace and actor", async () => {
    const calls: unknown[] = [];
    const queries = createWorkBuddyMemberReadQueries({
      database: {
        membership: {
          async findUnique(input) {
            calls.push(input);
            return { status: "ACTIVE", role: "MEMBER" };
          },
        },
      },
    });

    await expect(
      queries.loadMembership({
        workspaceId: "workspace-real-id",
        actorUserId: "user:colleague-one",
      }),
    ).resolves.toEqual({ status: "ACTIVE", role: "MEMBER" });
    expect(calls).toEqual([
      {
        where: {
          workspaceId_userId: {
            workspaceId: "workspace-real-id",
            userId: "user:colleague-one",
          },
        },
        select: { status: true, role: true },
      },
    ]);
  });
});
