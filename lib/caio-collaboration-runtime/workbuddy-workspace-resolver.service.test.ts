import { describe, expect, it, vi } from "vitest";

import {
  createWorkBuddyWorkspaceIdResolver,
} from "./workbuddy-workspace-resolver.service";

describe("WorkBuddy workspace systemKey resolver", () => {
  it("returns the real id for one active workspace", async () => {
    const findUnique = vi.fn(async () => ({
      id: "cm-real-workspace-id",
      status: "ACTIVE" as const,
    }));
    const resolve = createWorkBuddyWorkspaceIdResolver({
      database: { workspace: { findUnique } },
    });

    await expect(resolve("anson")).resolves.toBe("cm-real-workspace-id");
    expect(findUnique).toHaveBeenCalledWith({
      where: { systemKey: "anson" },
      select: { id: true, status: true },
    });
  });

  it("fails closed for missing or inactive workspaces", async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "workspace-id", status: "SUSPENDED" });
    const resolve = createWorkBuddyWorkspaceIdResolver({
      database: { workspace: { findUnique } },
    });

    await expect(resolve("anson")).resolves.toBeNull();
    await expect(resolve("anson")).resolves.toBeNull();
  });

  it("rejects unsafe system keys before querying", async () => {
    const findUnique = vi.fn();
    const resolve = createWorkBuddyWorkspaceIdResolver({
      database: { workspace: { findUnique } },
    });

    await expect(resolve("workspace:anson")).rejects.toThrow(
      "workbuddy_workspace_system_key_invalid",
    );
    expect(findUnique).not.toHaveBeenCalled();
  });
});
