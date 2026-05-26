import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: {
    membership: {
      findMany: vi.fn(),
    },
    user: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/db", () => ({
  db: mocks.db,
}));

import {
  findFirstMembershipWithExistingUser,
  findMembershipsWithExistingUsers,
} from "@/lib/auth/membership-with-user";

describe("findMembershipsWithExistingUsers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns memberships joined with existing users and drops orphan memberships", async () => {
    mocks.db.membership.findMany.mockResolvedValue([
      {
        id: "m-1",
        workspaceId: "w-1",
        userId: "u-1",
        role: "OWNER",
        status: "ACTIVE",
        createdAt: new Date("2026-05-07T00:00:00.000Z"),
        updatedAt: new Date("2026-05-07T00:00:00.000Z"),
        joinedAt: null,
        invitedAt: null,
      },
      {
        id: "m-2",
        workspaceId: "w-1",
        userId: "u-missing",
        role: "MEMBER",
        status: "INVITED",
        createdAt: new Date("2026-05-07T00:00:01.000Z"),
        updatedAt: new Date("2026-05-07T00:00:01.000Z"),
        joinedAt: null,
        invitedAt: null,
      },
    ]);

    mocks.db.user.findMany.mockResolvedValue([
      {
        id: "u-1",
        name: "Owner",
        email: "owner@example.com",
      },
    ]);

    const result = await findMembershipsWithExistingUsers({
      where: { workspaceId: "w-1" },
      orderBy: { createdAt: "asc" },
    });

    expect(mocks.db.user.findMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: ["u-1", "u-missing"],
        },
      },
    });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("m-1");
    expect(result[0]?.user.id).toBe("u-1");
  });

  it("short-circuits when there are no memberships", async () => {
    mocks.db.membership.findMany.mockResolvedValue([]);

    const result = await findMembershipsWithExistingUsers({
      where: { workspaceId: "w-empty" },
    });

    expect(result).toEqual([]);
    expect(mocks.db.user.findMany).not.toHaveBeenCalled();
  });
});

describe("findFirstMembershipWithExistingUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no membership has a matching user", async () => {
    mocks.db.membership.findMany.mockResolvedValue([
      {
        id: "m-1",
        workspaceId: "w-1",
        userId: "u-missing",
        role: "MEMBER",
        status: "INVITED",
        createdAt: new Date("2026-05-07T00:00:00.000Z"),
        updatedAt: new Date("2026-05-07T00:00:00.000Z"),
        joinedAt: null,
        invitedAt: null,
      },
    ]);
    mocks.db.user.findMany.mockResolvedValue([]);

    const result = await findFirstMembershipWithExistingUser({
      where: { workspaceId: "w-1", id: "m-1" },
    });

    expect(result).toBeNull();
  });

  it("returns the first membership that has an existing user", async () => {
    mocks.db.membership.findMany.mockResolvedValue([
      {
        id: "m-1",
        workspaceId: "w-1",
        userId: "u-1",
        role: "OWNER",
        status: "ACTIVE",
        createdAt: new Date("2026-05-07T00:00:00.000Z"),
        updatedAt: new Date("2026-05-07T00:00:00.000Z"),
        joinedAt: null,
        invitedAt: null,
      },
    ]);
    mocks.db.user.findMany.mockResolvedValue([
      {
        id: "u-1",
        name: "Owner",
        email: "owner@example.com",
      },
    ]);

    const result = await findFirstMembershipWithExistingUser({
      where: { workspaceId: "w-1", id: "m-1" },
    });

    expect(result?.id).toBe("m-1");
    expect(result?.user.id).toBe("u-1");
  });
});
