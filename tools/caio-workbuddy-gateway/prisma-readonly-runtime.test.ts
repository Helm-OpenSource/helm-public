import { describe, expect, it } from "vitest";

import type { WorkBuddyClientIdentity } from "@/lib/caio-collaboration/contracts";

import { createPrismaWorkBuddyReadOnlyDispatcher } from "./prisma-readonly-runtime";

const identity: WorkBuddyClientIdentity = {
  schemaVersion: "helm.workbuddy-client-identity/v1",
  clientId: "device:test",
  workspaceId: "workspace-real-id",
  actorUserId: "user:test",
  certificateFingerprint: `sha256:${"a".repeat(64)}`,
  scopes: ["caio:delivery:read", "caio:p1c:read"],
  transport: "mtls",
  mtlsVerified: true,
  authenticatedAt: "2026-09-20T08:00:00.000Z",
};

describe("Prisma WorkBuddy read-only dispatcher", () => {
  it("publishes only the P1C read tool", () => {
    const dispatcher = createPrismaWorkBuddyReadOnlyDispatcher();
    expect(dispatcher.listTools(identity).map((tool) => tool.name)).toEqual([
      "get_p1c_read_projection",
    ]);
  });
});
