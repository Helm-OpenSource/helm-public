import { beforeEach, describe, expect, it, vi } from "vitest";

const { dbMock } = vi.hoisted(() => ({
  dbMock: { membership: { findMany: vi.fn() } },
}));

vi.mock("@/lib/db", () => ({ db: dbMock }));

import {
  isGroupScopeUnrestricted,
  resolveGroupScopeUserIds,
} from "@/lib/auth/group-scope";

describe("group scope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps owners, admins, billing admins, and untagged members unrestricted", () => {
    for (const role of ["OWNER", "ADMIN", "BILLING_ADMIN"] as const) {
      expect(isGroupScopeUnrestricted({ role, groupTag: "store-a" })).toBe(true);
    }
    expect(isGroupScopeUnrestricted({ role: "MEMBER", groupTag: null })).toBe(true);
    expect(isGroupScopeUnrestricted({ role: "MEMBER", groupTag: "  " })).toBe(true);
    expect(isGroupScopeUnrestricted({ role: "MEMBER", groupTag: "store-a" })).toBe(false);
    expect(isGroupScopeUnrestricted({ role: "OPERATOR", groupTag: "store-a" })).toBe(false);
  });

  it("returns null (full view) for unrestricted members without querying", async () => {
    const scope = await resolveGroupScopeUserIds({
      workspaceId: "ws-1",
      membership: { userId: "u-1", role: "OWNER", groupTag: "store-a" },
    });
    expect(scope).toBeNull();
    expect(dbMock.membership.findMany).not.toHaveBeenCalled();
  });

  it("resolves active same-tag members and always includes the requester", async () => {
    dbMock.membership.findMany.mockResolvedValue([
      { userId: "u-2" },
      { userId: "u-3" },
    ]);

    const scope = await resolveGroupScopeUserIds({
      workspaceId: "ws-1",
      membership: { userId: "u-1", role: "MEMBER", groupTag: "store-a" },
    });

    expect(dbMock.membership.findMany).toHaveBeenCalledWith({
      where: { workspaceId: "ws-1", groupTag: "store-a", status: "ACTIVE" },
      select: { userId: true },
    });
    expect(scope?.sort()).toEqual(["u-1", "u-2", "u-3"]);
  });
});
