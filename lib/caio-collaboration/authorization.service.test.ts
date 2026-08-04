import { describe, expect, it } from "vitest";

import {
  authorizeWorkBuddyOwnerCeoAccess,
  requireWorkBuddyAuthorizationContext,
  WORKBUDDY_OWNER_MUTATION_CAPABILITY,
  WORKBUDDY_OWNER_READ_CAPABILITY,
  type WorkBuddyAuthorizationQueries,
  type WorkBuddyAuthorizationSnapshot,
} from "./authorization.service";
import type { WorkBuddyClientIdentity } from "./contracts";

const identity: WorkBuddyClientIdentity = {
  schemaVersion: "helm.workbuddy-client-identity/v1",
  clientId: "client:workbuddy-ceo",
  workspaceId: "workspace:demo",
  actorUserId: "user:owner",
  certificateFingerprint: `sha256:${"b".repeat(64)}`,
  scopes: ["caio:presence:challenge", "caio:p1c:read"],
  transport: "mtls",
  mtlsVerified: true,
  authenticatedAt: "2026-07-26T02:00:00.000Z",
};

const authorizationSnapshot: WorkBuddyAuthorizationSnapshot = {
  membership: {
    status: "ACTIVE",
    role: "OWNER",
  },
  hasCapability: true,
  binding: {
    bindingRef: "caio-principal-binding:1",
    actorUserId: "user:owner",
    principalKind: "CEO",
    ceoRef: "ceo:owner",
    status: "LIVE",
  },
  mandate: {
    mandateRef: "caio-mandate:1",
    ceoRef: "ceo:owner",
    status: "CURRENT",
  },
};

function createQueries(
  overrides: Partial<WorkBuddyAuthorizationSnapshot> = {},
): WorkBuddyAuthorizationQueries {
  return {
    loadAuthorizationSnapshot: async () => ({
      ...authorizationSnapshot,
      ...overrides,
    }),
  };
}

describe("authorizeWorkBuddyOwnerCeoAccess", () => {
  it("requires ACTIVE OWNER, capability, live CEO binding, and current mandate", async () => {
    const result = await authorizeWorkBuddyOwnerCeoAccess({
      identity,
      requiredScope: "caio:p1c:read",
      requiredCapability: WORKBUDDY_OWNER_READ_CAPABILITY,
      queries: createQueries(),
      checkedAt: "2026-07-26T02:01:00.000Z",
    });

    expect(result).toEqual({
      schemaVersion: "helm.workbuddy-authorization-context/v1",
      workspaceId: "workspace:demo",
      actorUserId: "user:owner",
      clientId: "client:workbuddy-ceo",
      capability: WORKBUDDY_OWNER_READ_CAPABILITY,
      scope: "caio:p1c:read",
      ceoBindingRef: "caio-principal-binding:1",
      mandateRef: "caio-mandate:1",
      ceoRef: "ceo:owner",
      checkedAt: "2026-07-26T02:01:00.000Z",
      authorityEffect: "none",
      canonicalMutationAuthorityGranted: false,
    });
  });

  it("rejects an invited owner", async () => {
    await expect(
      authorizeWorkBuddyOwnerCeoAccess({
        identity,
        requiredScope: "caio:p1c:read",
        requiredCapability: WORKBUDDY_OWNER_READ_CAPABILITY,
        queries: createQueries({
          membership: {
            status: "INVITED",
            role: "OWNER",
          },
        }),
        checkedAt: "2026-07-26T02:01:00.000Z",
      }),
    ).rejects.toMatchObject({ code: "OWNER_REQUIRED" });
  });

  it("rejects a missing capability", async () => {
    await expect(
      authorizeWorkBuddyOwnerCeoAccess({
        identity,
        requiredScope: "caio:p1c:read",
        requiredCapability: WORKBUDDY_OWNER_READ_CAPABILITY,
        queries: createQueries({
          hasCapability: false,
        }),
        checkedAt: "2026-07-26T02:01:00.000Z",
      }),
    ).rejects.toMatchObject({ code: "CAPABILITY_DENIED" });
  });

  it("rejects authorization checks that predate mTLS authentication", async () => {
    await expect(
      authorizeWorkBuddyOwnerCeoAccess({
        identity,
        requiredScope: "caio:p1c:read",
        requiredCapability: WORKBUDDY_OWNER_READ_CAPABILITY,
        queries: createQueries(),
        checkedAt: "2026-07-26T01:59:59.000Z",
      }),
    ).rejects.toMatchObject({ code: "AUTH_EXPIRED" });
  });

  it("rejects a live binding that does not match the current mandate", async () => {
    await expect(
      authorizeWorkBuddyOwnerCeoAccess({
        identity,
        requiredScope: "caio:p1c:read",
        requiredCapability: WORKBUDDY_OWNER_READ_CAPABILITY,
        queries: createQueries({
          mandate: {
            mandateRef: "caio-mandate:2",
            ceoRef: "ceo:other",
            status: "CURRENT",
          },
        }),
        checkedAt: "2026-07-26T02:01:00.000Z",
      }),
    ).rejects.toMatchObject({ code: "MANDATE_BINDING_MISMATCH" });
  });

  it("loads one capability-bound authorization snapshot", async () => {
    const loadAuthorizationSnapshot = vi.fn(
      async () => authorizationSnapshot,
    );

    await authorizeWorkBuddyOwnerCeoAccess({
      identity,
      requiredScope: "caio:p1c:read",
      requiredCapability: WORKBUDDY_OWNER_READ_CAPABILITY,
      queries: { loadAuthorizationSnapshot },
      checkedAt: "2026-07-26T02:01:00.000Z",
    });

    expect(loadAuthorizationSnapshot).toHaveBeenCalledOnce();
    expect(loadAuthorizationSnapshot).toHaveBeenCalledWith({
      workspaceId: "workspace:demo",
      actorUserId: "user:owner",
      capability: WORKBUDDY_OWNER_READ_CAPABILITY,
      checkedAt: "2026-07-26T02:01:00.000Z",
    });
  });

  it("treats client scopes as narrowing constraints, not authority", async () => {
    await expect(
      authorizeWorkBuddyOwnerCeoAccess({
        identity: {
          ...identity,
          scopes: ["caio:presence:challenge"],
        },
        requiredScope: "caio:p1c:read",
        requiredCapability: WORKBUDDY_OWNER_READ_CAPABILITY,
        queries: createQueries(),
        checkedAt: "2026-07-26T02:01:00.000Z",
      }),
    ).rejects.toMatchObject({ code: "SCOPE_DENIED" });
  });

  it("reuses canonical capability constants and rejects a forged context", async () => {
    const mutationIdentity = {
      ...identity,
      scopes: ["caio:canonical:mutate"] as const,
    };
    const result = await authorizeWorkBuddyOwnerCeoAccess({
      identity: mutationIdentity,
      requiredScope: "caio:canonical:mutate",
      requiredCapability: WORKBUDDY_OWNER_MUTATION_CAPABILITY,
      queries: createQueries(),
      checkedAt: "2026-07-26T02:01:00.000Z",
    });

    expect(result.capability).toBe(
      "workspace.manage_governed_actions",
    );
    expect(() =>
      requireWorkBuddyAuthorizationContext({
        authorization: {
          ...result,
          capability: "workspace.workbuddy_superuser",
        },
        requiredScope: "caio:canonical:mutate",
        requiredCapability: WORKBUDDY_OWNER_MUTATION_CAPABILITY,
      }),
    ).toThrow(
      expect.objectContaining({
        code: "SCOPE_DENIED",
      }),
    );
    expect(() =>
      requireWorkBuddyAuthorizationContext({
        authorization: {
          ...result,
          capability: WORKBUDDY_OWNER_READ_CAPABILITY,
        },
        requiredScope: "caio:canonical:mutate",
        requiredCapability: WORKBUDDY_OWNER_MUTATION_CAPABILITY,
      }),
    ).toThrow(
      expect.objectContaining({
        code: "CAPABILITY_DENIED",
      }),
    );
  });
});
