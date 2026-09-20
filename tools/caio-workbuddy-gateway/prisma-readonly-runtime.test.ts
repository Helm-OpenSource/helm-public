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

  it("authorizes an active enrolled member without CEO authority", async () => {
    const dispatcher = createPrismaWorkBuddyReadOnlyDispatcher({
      now: () => "2026-09-20T09:00:00.000Z",
      membershipQueries: {
        async loadMembership() {
          return { status: "ACTIVE", role: "MEMBER" };
        },
      },
      projectionQueries: {
        async loadP1cProjectionSource() {
          return {
            workspaceId: identity.workspaceId,
            portfolio: {
              portfolioRef: "portfolio:1",
              sequence: 1,
              generatedAt: "2026-09-20T08:00:00.000Z",
              questions: [],
            },
            selection: null,
            followThrough: [],
          };
        },
      },
    });

    await expect(
      dispatcher.dispatch({
        name: "get_p1c_read_projection",
        input: { workspaceId: identity.workspaceId },
        context: { requestId: "request:member", identity },
      }),
    ).resolves.toMatchObject({ ok: true });
  });
});
