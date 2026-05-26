import { beforeEach, describe, expect, it, vi } from "vitest";
import { MembershipStatus } from "@prisma/client";
import { AUTH_SESSION_PROVIDER_TYPES } from "@/lib/auth/provider-seam";

const {
  cookiesMock,
  headersMock,
  redirectMock,
  writeAuditLogMock,
  ensureWorkspaceCommercialFoundationMock,
  syncWorkspaceAccessStateMock,
  dbMock,
} = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  headersMock: vi.fn(),
  redirectMock: vi.fn(),
  writeAuditLogMock: vi.fn(),
  ensureWorkspaceCommercialFoundationMock: vi.fn(),
  syncWorkspaceAccessStateMock: vi.fn(),
  dbMock: {
    authSession: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    membership: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("next/headers", () => ({
  cookies: cookiesMock,
  headers: headersMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/db", () => ({
  db: dbMock,
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLog: writeAuditLogMock,
  safeWriteAuditLog: writeAuditLogMock,
  recordAuditWriteFailure: vi.fn(),
}));

vi.mock("@/lib/billing/foundation", () => ({
  ensureWorkspaceCommercialFoundation: ensureWorkspaceCommercialFoundationMock,
  syncWorkspaceAccessState: syncWorkspaceAccessStateMock,
}));

import {
  ACTIVE_WORKSPACE_COOKIE,
  AUTH_SESSION_REVOKE_SCOPES,
  AUTH_SESSION_SCOPE_REVOKED_AUDIT_ACTION,
  AUTH_SESSION_WORKSPACE_REALIGNED_AUDIT_ACTION,
  buildAuthSessionRevokeConsistencySummary,
  SESSION_ID_COOKIE,
  buildAuthSessionRevokePreviewVsExecutedDelta,
  buildAuthSessionRevokeScopePreview,
  clearSession,
  createSession,
  getCurrentWorkspaceSession,
  getCurrentUser,
  rotateCurrentAuthSession,
  revokeWorkspaceAuthSessionsByScope,
  revokeWorkspaceAuthSessionById,
  resolvePreferredMembership,
  setActiveWorkspace,
} from "@/lib/auth/session";
import { buildAuthSessionAnomalyInventorySummary } from "@/lib/auth/session-governance";

const ACTIVE_SESSION_EXPIRES_AT = new Date("2099-04-20T00:00:00Z");

function createCookieStore(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));

  return {
    get: vi.fn((name: string) => {
      const value = values.get(name);
      return value ? { name, value } : undefined;
    }),
    set: vi.fn((name: string, value: string) => {
      values.set(name, value);
    }),
    delete: vi.fn((name: string) => {
      values.delete(name);
    }),
    values,
  };
}

function createHeaderStore(initial: Record<string, string> = {}) {
  const values = new Map(
    Object.entries(initial).map(([key, value]) => [key.toLowerCase(), value] as const),
  );

  return {
    get(name: string) {
      return values.get(name.toLowerCase()) ?? null;
    },
  };
}

function buildMembership(workspaceId: string, status: MembershipStatus) {
  return {
    workspaceId,
    status,
    workspace: {
      id: workspaceId,
      name: `Workspace ${workspaceId}`,
    },
  };
}

function buildAuthSessionRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "auth-session-1",
    userId: "user-1",
    activeWorkspaceId: "workspace-1",
    sessionKeyHash: "session-hash-1",
    sourcePage: "/login",
    providerType: AUTH_SESSION_PROVIDER_TYPES.PASSWORD,
    userAgent: "Vitest",
    ipAddress: "127.0.0.1",
    lastSeenAt: new Date("2026-04-05T00:00:00Z"),
    lastWorkspaceSwitchAt: new Date("2026-04-05T00:00:00Z"),
    expiresAt: ACTIVE_SESSION_EXPIRES_AT,
    revokedAt: null,
    user: {
      id: "user-1",
      name: "Owner",
      email: "owner@example.com",
      memberships: [
        buildMembership("workspace-1", MembershipStatus.ACTIVE),
        buildMembership("workspace-2", MembershipStatus.INVITED),
      ],
    },
    ...overrides,
  };
}

describe("resolvePreferredMembership", () => {
  const memberships = [
    {
      workspaceId: "inactive-workspace",
      status: MembershipStatus.INACTIVE,
    },
    {
      workspaceId: "invited-workspace",
      status: MembershipStatus.INVITED,
    },
    {
      workspaceId: "active-workspace",
      status: MembershipStatus.ACTIVE,
    },
  ] as const;

  it("prefers the active workspace cookie when it matches an active membership", () => {
    expect(resolvePreferredMembership([...memberships], "active-workspace")).toEqual(memberships[2]);
  });

  it("falls back to the invited workspace cookie when it has not been activated yet", () => {
    expect(resolvePreferredMembership([...memberships], "invited-workspace")).toEqual(memberships[1]);
  });

  it("falls back to the first active membership when the cookie is missing or stale", () => {
    expect(resolvePreferredMembership([...memberships], undefined)).toEqual(memberships[2]);
    expect(resolvePreferredMembership([...memberships], "missing-workspace")).toEqual(memberships[2]);
  });

  it("ignores inactive memberships when choosing the workspace session", () => {
    expect(
      resolvePreferredMembership(
        [
          {
            workspaceId: "only-inactive",
            status: MembershipStatus.INACTIVE,
          },
          {
            workspaceId: "only-invited",
            status: MembershipStatus.INVITED,
          },
        ],
        "only-inactive",
      ),
    ).toEqual({
      workspaceId: "only-invited",
      status: MembershipStatus.INVITED,
    });
  });
});

describe("auth session substrate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookiesMock.mockResolvedValue(createCookieStore());
    headersMock.mockResolvedValue(createHeaderStore());
    writeAuditLogMock.mockResolvedValue(undefined);
    ensureWorkspaceCommercialFoundationMock.mockResolvedValue(undefined);
    syncWorkspaceAccessStateMock.mockResolvedValue(null);
    dbMock.membership.updateMany.mockResolvedValue({ count: 0 });
    dbMock.authSession.updateMany.mockResolvedValue({ count: 0 });
  });

  it("uses the DB-backed auth session as the current user truth and ignores the legacy email cookie", async () => {
    cookiesMock.mockResolvedValue(
      createCookieStore({
        "helm-demo-session": "legacy@example.com",
      }),
    );

    expect(await getCurrentUser()).toBeNull();
    expect(dbMock.authSession.findUnique).not.toHaveBeenCalled();
  });

  it("clears cookies and revokes the session when authSession points to a missing user", async () => {
    const cookieStore = createCookieStore({
      [SESSION_ID_COOKIE]: "corrupt-session-token",
      [ACTIVE_WORKSPACE_COOKIE]: "workspace-1",
    });
    cookiesMock.mockResolvedValue(cookieStore);
    dbMock.authSession.findUnique.mockRejectedValueOnce(
      new Error(
        "Invalid `prisma.authSession.findUnique()` invocation:\n\nInconsistent query result: Field user is required to return data, got `null` instead.",
      ),
    );

    expect(await getCurrentUser()).toBeNull();
    expect(dbMock.authSession.updateMany).toHaveBeenCalledWith({
      where: {
        sessionKeyHash: expect.any(String),
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
        lastSeenAt: expect.any(Date),
      },
    });
    expect(cookieStore.delete).toHaveBeenCalledWith(SESSION_ID_COOKIE);
    expect(cookieStore.delete).toHaveBeenCalledWith(ACTIVE_WORKSPACE_COOKIE);
  });

  it("does not throw when clearing corrupt session cookies in readonly cookie context", async () => {
    const cookieStore = createCookieStore({
      [SESSION_ID_COOKIE]: "corrupt-session-token",
      [ACTIVE_WORKSPACE_COOKIE]: "workspace-1",
    });
    cookieStore.delete.mockImplementation(() => {
      throw new Error(
        "Cookies can only be modified in a Server Action or Route Handler. Read more: https://nextjs.org/docs/app/api-reference/functions/cookies#options",
      );
    });
    cookiesMock.mockResolvedValue(cookieStore);
    dbMock.authSession.findUnique.mockRejectedValueOnce(
      new Error(
        "Invalid `prisma.authSession.findUnique()` invocation:\n\nInconsistent query result: Field user is required to return data, got `null` instead.",
      ),
    );

    await expect(getCurrentUser()).resolves.toBeNull();
    expect(dbMock.authSession.updateMany).toHaveBeenCalled();
  });

  it("creates a session record, revokes the previous session, and stores only opaque cookies", async () => {
    const cookieStore = createCookieStore({
      [SESSION_ID_COOKIE]: "stale-session",
    });
    cookiesMock.mockResolvedValue(cookieStore);
    headersMock.mockResolvedValue(
      createHeaderStore({
        "user-agent": "Vitest Browser",
        "x-forwarded-for": "10.0.0.1, 10.0.0.2",
      }),
    );
    dbMock.authSession.findUnique.mockResolvedValueOnce(buildAuthSessionRecord());
    dbMock.authSession.update.mockResolvedValue({});
    dbMock.authSession.create.mockResolvedValue({
      id: "auth-session-2",
      expiresAt: ACTIVE_SESSION_EXPIRES_AT,
    });

    await createSession({
      userId: "user-2",
      email: "alice@example.com",
      workspaceId: "workspace-2",
      sourcePage: "/login",
      providerType: AUTH_SESSION_PROVIDER_TYPES.PASSWORD,
    });

    expect(dbMock.authSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "auth-session-1" },
        data: expect.objectContaining({
          revokedAt: expect.any(Date),
        }),
      }),
    );
    expect(dbMock.authSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-2",
          activeWorkspaceId: "workspace-2",
          sessionKeyHash: expect.any(String),
          sourcePage: "/login",
          providerType: AUTH_SESSION_PROVIDER_TYPES.PASSWORD,
          userAgent: "Vitest Browser",
          ipAddress: "10.0.0.1",
        }),
      }),
    );
    expect(cookieStore.set).toHaveBeenCalledWith(
      SESSION_ID_COOKIE,
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
      }),
    );
    expect(cookieStore.set).toHaveBeenCalledWith(
      ACTIVE_WORKSPACE_COOKIE,
      "workspace-2",
      expect.objectContaining({
        httpOnly: true,
      }),
    );
    expect(cookieStore.delete).toHaveBeenCalledWith("helm-demo-session");
    expect(writeAuditLogMock).toHaveBeenCalled();
  });

  it("still creates a new session when existing session cookie points to a missing user relation", async () => {
    const cookieStore = createCookieStore({
      [SESSION_ID_COOKIE]: "corrupt-session-token",
    });
    cookiesMock.mockResolvedValue(cookieStore);
    headersMock.mockResolvedValue(
      createHeaderStore({
        "user-agent": "Signup Browser",
        "x-forwarded-for": "10.0.0.11",
      }),
    );
    dbMock.authSession.findUnique.mockRejectedValueOnce(
      new Error(
        "Invalid `prisma.authSession.findUnique()` invocation:\n\nInconsistent query result: Field user is required to return data, got `null` instead.",
      ),
    );
    dbMock.authSession.create.mockResolvedValue({
      id: "auth-session-new",
      expiresAt: ACTIVE_SESSION_EXPIRES_AT,
    });

    await createSession({
      userId: "user-2",
      email: "alice@example.com",
      workspaceId: "workspace-2",
      sourcePage: "/api/auth/dingtalk/callback",
      providerType: AUTH_SESSION_PROVIDER_TYPES.DINGTALK_OAUTH,
    });

    expect(dbMock.authSession.updateMany).toHaveBeenCalledWith({
      where: {
        sessionKeyHash: expect.any(String),
        revokedAt: null,
      },
      data: {
        revokedAt: expect.any(Date),
        lastSeenAt: expect.any(Date),
      },
    });
    expect(dbMock.authSession.create).toHaveBeenCalled();
  });

  it("rotates the current auth session explicitly and records rotation audit", async () => {
    const cookieStore = createCookieStore({
      [SESSION_ID_COOKIE]: "current-session",
      [ACTIVE_WORKSPACE_COOKIE]: "workspace-1",
    });
    cookiesMock.mockResolvedValue(cookieStore);
    headersMock.mockResolvedValue(
      createHeaderStore({
        "user-agent": "Rotated Browser",
        "x-forwarded-for": "10.0.0.9",
      }),
    );
    dbMock.authSession.findUnique.mockResolvedValueOnce(
      buildAuthSessionRecord({
        expiresAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      }),
    );
    dbMock.authSession.create.mockResolvedValueOnce(
      buildAuthSessionRecord({
        id: "auth-session-rotated",
        sessionKeyHash: "session-hash-rotated",
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        userAgent: "Rotated Browser",
        ipAddress: "10.0.0.9",
      }),
    );
    dbMock.authSession.update.mockResolvedValue({});
    const result = await rotateCurrentAuthSession({ sourcePage: "/settings" });

    expect(result).toEqual({
      ok: true,
      sessionId: "auth-session-rotated",
    });
    expect(dbMock.authSession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          activeWorkspaceId: "workspace-1",
          providerType: AUTH_SESSION_PROVIDER_TYPES.PASSWORD,
          sourcePage: "/login",
        }),
      }),
    );
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "AUTH_SESSION_ROTATED",
        targetId: "auth-session-rotated",
        payload: expect.objectContaining({
          entrySourcePage: "/login",
          actionSourcePage: "/settings",
        }),
        sourcePage: "/settings",
      }),
    );
    expect(cookieStore.set).toHaveBeenCalledWith(
      SESSION_ID_COOKIE,
      expect.any(String),
      expect.objectContaining({
        httpOnly: true,
      }),
    );
  });

  it("updates the active workspace on the session record instead of trusting the cookie alone", async () => {
    const cookieStore = createCookieStore({
      [SESSION_ID_COOKIE]: "current-session",
    });
    cookiesMock.mockResolvedValue(cookieStore);
    dbMock.authSession.findUnique.mockResolvedValue(buildAuthSessionRecord());
    dbMock.membership.findUnique.mockResolvedValue({
      workspaceId: "workspace-2",
      status: MembershipStatus.ACTIVE,
      workspace: {
        id: "workspace-2",
        name: "Ops Workspace",
      },
    });
    dbMock.authSession.update.mockResolvedValue({});

    await setActiveWorkspace("workspace-2");

    expect(dbMock.authSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "auth-session-1" },
        data: expect.objectContaining({
          activeWorkspaceId: "workspace-2",
          lastWorkspaceSwitchAt: expect.any(Date),
        }),
      }),
    );
    expect(cookieStore.set).toHaveBeenCalledWith(
      ACTIVE_WORKSPACE_COOKIE,
      "workspace-2",
      expect.objectContaining({
        httpOnly: true,
      }),
    );
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "AUTH_SESSION_WORKSPACE_SWITCHED",
        targetId: "auth-session-1",
      }),
    );
  });

  it("adds a workspace-switch marker when the current workspace is realigned from memberships", async () => {
    const cookieStore = createCookieStore({
      [SESSION_ID_COOKIE]: "current-session",
      [ACTIVE_WORKSPACE_COOKIE]: "workspace-1",
    });
    cookiesMock.mockResolvedValue(cookieStore);
    dbMock.authSession.findUnique.mockResolvedValue(
      buildAuthSessionRecord({
        activeWorkspaceId: "workspace-2",
        user: {
          id: "user-1",
          name: "Owner",
          email: "owner@example.com",
          memberships: [
            buildMembership("workspace-1", MembershipStatus.ACTIVE),
            buildMembership("workspace-2", MembershipStatus.INACTIVE),
          ],
        },
      }),
    );
    dbMock.membership.findUnique.mockResolvedValue({
      workspaceId: "workspace-1",
      userId: "user-1",
      status: MembershipStatus.ACTIVE,
      user: {
        id: "user-1",
        name: "Owner",
        email: "owner@example.com",
      },
      workspace: {
        id: "workspace-1",
        name: "Workspace workspace-1",
        billingAccount: null,
        trialState: null,
        workerEntitlements: [],
      },
    });
    dbMock.authSession.update.mockResolvedValue({});

    const session = await getCurrentWorkspaceSession();

    expect(session.workspace.id).toBe("workspace-1");
    expect(dbMock.authSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "auth-session-1" },
        data: expect.objectContaining({
          activeWorkspaceId: "workspace-1",
          lastSeenAt: expect.any(Date),
          lastWorkspaceSwitchAt: expect.any(Date),
        }),
      }),
    );
    expect(cookieStore.set).toHaveBeenCalledWith(
      ACTIVE_WORKSPACE_COOKIE,
      "workspace-1",
      expect.objectContaining({
        httpOnly: true,
      }),
    );
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace-1",
        userId: "user-1",
        actionType: AUTH_SESSION_WORKSPACE_REALIGNED_AUDIT_ACTION,
        targetId: "auth-session-1",
        sourcePage: "/auth/session",
        payload: expect.objectContaining({
          previousWorkspaceId: "workspace-2",
          realignedWorkspaceId: "workspace-1",
        }),
      }),
    );
  });

  it("revokes the current auth session when logging out", async () => {
    const cookieStore = createCookieStore({
      [SESSION_ID_COOKIE]: "current-session",
      [ACTIVE_WORKSPACE_COOKIE]: "workspace-1",
    });
    cookiesMock.mockResolvedValue(cookieStore);
    dbMock.authSession.findUnique.mockResolvedValue(buildAuthSessionRecord());
    dbMock.authSession.update.mockResolvedValue({});

    await clearSession();

    expect(dbMock.authSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "auth-session-1" },
        data: expect.objectContaining({
          revokedAt: expect.any(Date),
        }),
      }),
    );
    expect(cookieStore.delete).toHaveBeenCalledWith(SESSION_ID_COOKIE);
    expect(cookieStore.delete).toHaveBeenCalledWith(ACTIVE_WORKSPACE_COOKIE);
    expect(cookieStore.delete).toHaveBeenCalledWith("helm-demo-session");
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "AUTH_SESSION_REVOKED",
        targetId: "auth-session-1",
      }),
    );
  });

  it("still clears auth cookies when sqlite revocation write hits readonly mode", async () => {
    const cookieStore = createCookieStore({
      [SESSION_ID_COOKIE]: "current-session",
      [ACTIVE_WORKSPACE_COOKIE]: "workspace-1",
    });
    cookiesMock.mockResolvedValue(cookieStore);
    dbMock.authSession.findUnique.mockResolvedValue(buildAuthSessionRecord());
    dbMock.authSession.update.mockRejectedValue(new Error("attempt to write a readonly database"));

    await expect(clearSession()).resolves.toBeUndefined();

    expect(cookieStore.delete).toHaveBeenCalledWith(SESSION_ID_COOKIE);
    expect(cookieStore.delete).toHaveBeenCalledWith(ACTIVE_WORKSPACE_COOKIE);
    expect(cookieStore.delete).toHaveBeenCalledWith("helm-demo-session");
  });

  it("revokes another workspace auth session through the org-admin helper", async () => {
    dbMock.authSession.findUnique.mockResolvedValue(buildAuthSessionRecord());
    dbMock.authSession.update.mockResolvedValue({});

    const result = await revokeWorkspaceAuthSessionById({
      sessionId: "auth-session-1",
      workspaceId: "workspace-1",
      userId: "user-9",
      actor: "Admin",
      sourcePage: "/settings",
    });

    expect(result).toEqual({ ok: true });
    expect(dbMock.authSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "auth-session-1" },
      }),
    );
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "AUTH_SESSION_REVOKED",
        targetId: "auth-session-1",
      }),
    );
  });

  it("revokes only stale active sessions for the workspace scope", async () => {
    dbMock.authSession.findMany.mockResolvedValue([
      buildAuthSessionRecord({
        id: "stale-session-1",
        lastSeenAt: new Date("2026-03-20T00:00:00Z"),
      }),
    ]);
    dbMock.authSession.update.mockResolvedValue({});

    const result = await revokeWorkspaceAuthSessionsByScope({
      scope: AUTH_SESSION_REVOKE_SCOPES.STALE_ACTIVE,
      workspaceId: "workspace-1",
      userId: "user-1",
      actor: "Owner",
      currentSessionId: "current-session",
      sourcePage: "/settings",
    });

    expect(result).toEqual({ ok: true, revokedCount: 1 });
    expect(dbMock.authSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          activeWorkspaceId: "workspace-1",
        }),
      }),
    );
    expect(dbMock.authSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "stale-session-1" },
      }),
    );
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: AUTH_SESSION_SCOPE_REVOKED_AUDIT_ACTION,
        targetId: "workspace-1",
        payload: expect.objectContaining({
          scope: AUTH_SESSION_REVOKE_SCOPES.STALE_ACTIVE,
          previewEligibleSessionCount: 1,
          revokedCount: 1,
          lastExecutionShortfallCount: 0,
          currentSessionProtected: false,
        }),
      }),
    );
  });

  it("protects the current session when it matches the revoke scope", async () => {
    dbMock.authSession.findMany.mockResolvedValue([
      buildAuthSessionRecord({
        id: "current-session",
        lastSeenAt: new Date("2026-03-18T00:00:00Z"),
      }),
      buildAuthSessionRecord({
        id: "stale-session-2",
        lastSeenAt: new Date("2026-03-20T00:00:00Z"),
      }),
    ]);
    dbMock.authSession.update.mockResolvedValue({});

    const result = await revokeWorkspaceAuthSessionsByScope({
      scope: AUTH_SESSION_REVOKE_SCOPES.STALE_ACTIVE,
      workspaceId: "workspace-1",
      userId: "user-1",
      actor: "Owner",
      currentSessionId: "current-session",
      sourcePage: "/settings",
    });

    expect(result).toEqual({ ok: true, revokedCount: 1 });
    expect(dbMock.authSession.update).toHaveBeenCalledTimes(1);
    expect(dbMock.authSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "stale-session-2" },
      }),
    );
    expect(writeAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          scope: AUTH_SESSION_REVOKE_SCOPES.STALE_ACTIVE,
          previewEligibleSessionCount: 1,
          revokedCount: 1,
          lastExecutionShortfallCount: 0,
          currentSessionProtected: true,
        }),
      }),
    );
  });

  it("revokes only legacy-provider sessions for the legacy scope", async () => {
    dbMock.authSession.findMany.mockResolvedValue([
      buildAuthSessionRecord({
        id: "legacy-session-1",
        providerType: null,
      }),
    ]);
    dbMock.authSession.update.mockResolvedValue({});

    const result = await revokeWorkspaceAuthSessionsByScope({
      scope: AUTH_SESSION_REVOKE_SCOPES.LEGACY_PROVIDER,
      workspaceId: "workspace-1",
      userId: "user-1",
      actor: "Owner",
      sourcePage: "/settings",
    });

    expect(result).toEqual({ ok: true, revokedCount: 1 });
    expect(dbMock.authSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          activeWorkspaceId: "workspace-1",
        }),
      }),
    );
    expect(dbMock.authSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "legacy-session-1" },
      }),
    );
  });

  it("revokes other active sessions without adding stale or legacy-only filters", async () => {
    dbMock.authSession.findMany.mockResolvedValue([
      buildAuthSessionRecord({
        id: "other-session-1",
      }),
      buildAuthSessionRecord({
        id: "other-session-2",
      }),
    ]);
    dbMock.authSession.update.mockResolvedValue({});

    const result = await revokeWorkspaceAuthSessionsByScope({
      scope: AUTH_SESSION_REVOKE_SCOPES.OTHER_ACTIVE,
      workspaceId: "workspace-1",
      userId: "user-1",
      actor: "Owner",
      currentSessionId: "current-session",
      sourcePage: "/settings",
    });

    expect(result).toEqual({ ok: true, revokedCount: 2 });
    expect(dbMock.authSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          activeWorkspaceId: "workspace-1",
        }),
      }),
    );
    const where = dbMock.authSession.findMany.mock.calls.at(-1)?.[0]?.where;
    expect(where).not.toHaveProperty("providerType");
    expect(where).not.toHaveProperty("lastSeenAt");
    expect(dbMock.authSession.update).toHaveBeenCalledTimes(2);
  });

  it("builds live revoke preview and current-session review scopes from active sessions", () => {
    const preview = buildAuthSessionRevokeScopePreview({
      authSessions: [
        buildAuthSessionRecord({
          id: "current-session",
          providerType: null,
          sourcePage: null,
          activeWorkspaceId: "workspace-1",
          lastSeenAt: new Date("2026-03-18T00:00:00Z"),
          lastWorkspaceSwitchAt: null,
          user: {
            id: "user-1",
            name: "Owner",
            email: "owner@example.com",
            memberships: [buildMembership("workspace-2", MembershipStatus.ACTIVE)],
          },
        }),
        buildAuthSessionRecord({
          id: "mismatch-session",
          providerType: AUTH_SESSION_PROVIDER_TYPES.PARTICIPANT_PORTAL,
          sourcePage: "/login",
        }),
      ],
      currentSessionId: "current-session",
      now: new Date("2026-04-06T00:00:00Z"),
    });

    expect(preview.liveRevokeScopeSummary).toEqual([
      { scope: "STALE_ACTIVE", eligibleSessionCount: 0, currentSessionProtected: true },
      { scope: "LEGACY_PROVIDER", eligibleSessionCount: 0, currentSessionProtected: true },
      { scope: "MISSING_SOURCE_PAGE", eligibleSessionCount: 0, currentSessionProtected: true },
      {
        scope: "MISSING_WORKSPACE_SWITCH_MARKER",
        eligibleSessionCount: 0,
        currentSessionProtected: true,
      },
      {
        scope: "PROVIDER_SOURCE_MISMATCH",
        eligibleSessionCount: 1,
        currentSessionProtected: false,
      },
      {
        scope: "WORKSPACE_MEMBERSHIP_MISMATCH",
        eligibleSessionCount: 0,
        currentSessionProtected: true,
      },
      { scope: "OTHER_ACTIVE", eligibleSessionCount: 1, currentSessionProtected: true },
    ]);
    expect(preview.currentSessionReviewScopeSummary).toEqual([
      "STALE_ACTIVE",
      "LEGACY_PROVIDER",
      "MISSING_SOURCE_PAGE",
      "MISSING_WORKSPACE_SWITCH_MARKER",
      "WORKSPACE_MEMBERSHIP_MISMATCH",
    ]);
  });

  it("builds preview-vs-executed revoke delta truth by scope", () => {
    const delta = buildAuthSessionRevokePreviewVsExecutedDelta({
      liveRevokeScopeSummary: [
        {
          scope: AUTH_SESSION_REVOKE_SCOPES.STALE_ACTIVE,
          eligibleSessionCount: 1,
          currentSessionProtected: true,
        },
        {
          scope: AUTH_SESSION_REVOKE_SCOPES.LEGACY_PROVIDER,
          eligibleSessionCount: 0,
          currentSessionProtected: true,
        },
        {
          scope: AUTH_SESSION_REVOKE_SCOPES.MISSING_SOURCE_PAGE,
          eligibleSessionCount: 0,
          currentSessionProtected: false,
        },
      ],
      scopedSessionRevokeAudits: [
        {
          createdAt: new Date("2026-04-05T01:45:00Z"),
          payload: JSON.stringify({
            scope: AUTH_SESSION_REVOKE_SCOPES.STALE_ACTIVE,
            previewEligibleSessionCount: 2,
            revokedCount: 1,
          }),
        },
        {
          createdAt: new Date("2026-04-05T01:44:00Z"),
          payload: JSON.stringify({
            scope: AUTH_SESSION_REVOKE_SCOPES.LEGACY_PROVIDER,
            previewEligibleSessionCount: 1,
            revokedCount: 1,
          }),
        },
      ],
    });

    expect(delta.find((item) => item.scope === AUTH_SESSION_REVOKE_SCOPES.STALE_ACTIVE)).toEqual({
      scope: AUTH_SESSION_REVOKE_SCOPES.STALE_ACTIVE,
      liveEligibleSessionCount: 1,
      currentSessionProtected: true,
      lastExecutedAt: new Date("2026-04-05T01:45:00Z"),
      lastExecutedEligibleSessionCount: 2,
      lastExecutedRevokedSessionCount: 1,
      lastExecutionShortfallCount: 1,
      previewEligibleDeltaCount: -1,
    });
    expect(delta.find((item) => item.scope === AUTH_SESSION_REVOKE_SCOPES.LEGACY_PROVIDER)).toEqual({
      scope: AUTH_SESSION_REVOKE_SCOPES.LEGACY_PROVIDER,
      liveEligibleSessionCount: 0,
      currentSessionProtected: true,
      lastExecutedAt: new Date("2026-04-05T01:44:00Z"),
      lastExecutedEligibleSessionCount: 1,
      lastExecutedRevokedSessionCount: 1,
      lastExecutionShortfallCount: 0,
      previewEligibleDeltaCount: -1,
    });
    expect(
      delta.find((item) => item.scope === AUTH_SESSION_REVOKE_SCOPES.MISSING_SOURCE_PAGE),
    ).toEqual({
      scope: AUTH_SESSION_REVOKE_SCOPES.MISSING_SOURCE_PAGE,
      liveEligibleSessionCount: 0,
      currentSessionProtected: false,
      lastExecutedAt: null,
      lastExecutedEligibleSessionCount: null,
      lastExecutedRevokedSessionCount: null,
      lastExecutionShortfallCount: null,
      previewEligibleDeltaCount: null,
    });
  });

  it("builds live auth-session anomaly inventory truth", () => {
    const inventory = buildAuthSessionAnomalyInventorySummary({
      authSessions: [
        buildAuthSessionRecord({
          id: "current-session",
          providerType: null,
          sourcePage: null,
          activeWorkspaceId: "workspace-1",
          lastSeenAt: new Date("2026-03-18T00:00:00Z"),
          lastWorkspaceSwitchAt: null,
          expiresAt: new Date("2026-04-07T00:00:00Z"),
          user: {
            id: "user-1",
            name: "Owner",
            email: "owner@example.com",
            memberships: [buildMembership("workspace-2", MembershipStatus.ACTIVE)],
          },
        }),
        buildAuthSessionRecord({
          id: "mismatch-session",
          providerType: AUTH_SESSION_PROVIDER_TYPES.PARTICIPANT_PORTAL,
          sourcePage: "/login",
          lastSeenAt: new Date("2026-04-05T22:00:00Z"),
        }),
      ],
      currentSessionId: "current-session",
      now: new Date("2026-04-06T00:00:00Z"),
    });

    expect(inventory).toEqual([
      {
        scope: "EXPIRING_SOON",
        activeSessionCount: 1,
        managementMode: "REVIEW_ONLY",
        revocableSessionCount: 0,
        currentSessionProtected: true,
        latestDetectedAt: new Date("2026-03-18T00:00:00Z"),
      },
      {
        scope: "STALE_ACTIVE",
        activeSessionCount: 1,
        managementMode: "BULK_REVOKE",
        revocableSessionCount: 0,
        currentSessionProtected: true,
        latestDetectedAt: new Date("2026-03-18T00:00:00Z"),
      },
      {
        scope: "LEGACY_PROVIDER",
        activeSessionCount: 1,
        managementMode: "BULK_REVOKE",
        revocableSessionCount: 0,
        currentSessionProtected: true,
        latestDetectedAt: new Date("2026-03-18T00:00:00Z"),
      },
      {
        scope: "MISSING_SOURCE_PAGE",
        activeSessionCount: 1,
        managementMode: "BULK_REVOKE",
        revocableSessionCount: 0,
        currentSessionProtected: true,
        latestDetectedAt: new Date("2026-03-18T00:00:00Z"),
      },
      {
        scope: "MISSING_WORKSPACE_SWITCH_MARKER",
        activeSessionCount: 1,
        managementMode: "BULK_REVOKE",
        revocableSessionCount: 0,
        currentSessionProtected: true,
        latestDetectedAt: new Date("2026-03-18T00:00:00Z"),
      },
      {
        scope: "PROVIDER_SOURCE_MISMATCH",
        activeSessionCount: 1,
        managementMode: "BULK_REVOKE",
        revocableSessionCount: 1,
        currentSessionProtected: false,
        latestDetectedAt: new Date("2026-04-05T22:00:00Z"),
      },
      {
        scope: "WORKSPACE_MEMBERSHIP_MISMATCH",
        activeSessionCount: 1,
        managementMode: "BULK_REVOKE",
        revocableSessionCount: 0,
        currentSessionProtected: true,
        latestDetectedAt: new Date("2026-03-18T00:00:00Z"),
      },
    ]);
  });

  it("builds revoke consistency summary from preview-vs-executed truth", () => {
    const consistency = buildAuthSessionRevokeConsistencySummary({
      previewVsExecutedScopeSummary: [
        {
          scope: AUTH_SESSION_REVOKE_SCOPES.STALE_ACTIVE,
          liveEligibleSessionCount: 0,
          currentSessionProtected: true,
          lastExecutedAt: new Date("2026-04-05T01:45:00Z"),
          lastExecutedEligibleSessionCount: 2,
          lastExecutedRevokedSessionCount: 2,
          lastExecutionShortfallCount: 0,
          previewEligibleDeltaCount: -2,
        },
        {
          scope: AUTH_SESSION_REVOKE_SCOPES.PROVIDER_SOURCE_MISMATCH,
          liveEligibleSessionCount: 1,
          currentSessionProtected: false,
          lastExecutedAt: null,
          lastExecutedEligibleSessionCount: null,
          lastExecutedRevokedSessionCount: null,
          lastExecutionShortfallCount: null,
          previewEligibleDeltaCount: null,
        },
        {
          scope: AUTH_SESSION_REVOKE_SCOPES.MISSING_SOURCE_PAGE,
          liveEligibleSessionCount: 0,
          currentSessionProtected: true,
          lastExecutedAt: null,
          lastExecutedEligibleSessionCount: null,
          lastExecutedRevokedSessionCount: null,
          lastExecutionShortfallCount: null,
          previewEligibleDeltaCount: null,
        },
      ],
    });

    expect(consistency).toEqual([
      {
        scope: AUTH_SESSION_REVOKE_SCOPES.STALE_ACTIVE,
        status: "DRIFT",
        liveEligibleSessionCount: 0,
        currentSessionProtected: true,
        lastExecutedAt: new Date("2026-04-05T01:45:00Z"),
        previewEligibleDeltaCount: -2,
        lastExecutionShortfallCount: 0,
      },
      {
        scope: AUTH_SESSION_REVOKE_SCOPES.PROVIDER_SOURCE_MISMATCH,
        status: "REVOCABLE",
        liveEligibleSessionCount: 1,
        currentSessionProtected: false,
        lastExecutedAt: null,
        previewEligibleDeltaCount: null,
        lastExecutionShortfallCount: null,
      },
      {
        scope: AUTH_SESSION_REVOKE_SCOPES.MISSING_SOURCE_PAGE,
        status: "REVIEW_ONLY",
        liveEligibleSessionCount: 0,
        currentSessionProtected: true,
        lastExecutedAt: null,
        previewEligibleDeltaCount: null,
        lastExecutionShortfallCount: null,
      },
    ]);
  });

  it("revokes only sessions missing source-page data for the anomaly scope", async () => {
    dbMock.authSession.findMany.mockResolvedValue([
      buildAuthSessionRecord({
        id: "missing-source",
        sourcePage: null,
      }),
      buildAuthSessionRecord({
        id: "has-source",
        sourcePage: "/login",
      }),
    ]);
    dbMock.authSession.update.mockResolvedValue({});

    const result = await revokeWorkspaceAuthSessionsByScope({
      scope: AUTH_SESSION_REVOKE_SCOPES.MISSING_SOURCE_PAGE,
      workspaceId: "workspace-1",
      userId: "user-1",
      actor: "Owner",
      sourcePage: "/settings",
    });

    expect(result).toEqual({ ok: true, revokedCount: 1 });
    expect(dbMock.authSession.update).toHaveBeenCalledTimes(1);
    expect(dbMock.authSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "missing-source" },
      }),
    );
  });

  it("revokes only sessions missing workspace-switch markers for the anomaly scope", async () => {
    dbMock.authSession.findMany.mockResolvedValue([
      buildAuthSessionRecord({
        id: "missing-switch-marker",
        activeWorkspaceId: "workspace-1",
        lastWorkspaceSwitchAt: null,
      }),
      buildAuthSessionRecord({
        id: "has-switch-marker",
        activeWorkspaceId: "workspace-1",
        lastWorkspaceSwitchAt: new Date("2026-04-05T00:00:00Z"),
      }),
      buildAuthSessionRecord({
        id: "no-active-workspace",
        activeWorkspaceId: null,
        lastWorkspaceSwitchAt: null,
      }),
    ]);
    dbMock.authSession.update.mockResolvedValue({});

    const result = await revokeWorkspaceAuthSessionsByScope({
      scope: AUTH_SESSION_REVOKE_SCOPES.MISSING_WORKSPACE_SWITCH_MARKER,
      workspaceId: "workspace-1",
      userId: "user-1",
      actor: "Owner",
      sourcePage: "/settings",
    });

    expect(result).toEqual({ ok: true, revokedCount: 1 });
    expect(dbMock.authSession.update).toHaveBeenCalledTimes(1);
    expect(dbMock.authSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "missing-switch-marker" },
      }),
    );
  });

  it("revokes only provider/source mismatch sessions for the anomaly scope", async () => {
    dbMock.authSession.findMany.mockResolvedValue([
      buildAuthSessionRecord({
        id: "portal-valid",
        providerType: AUTH_SESSION_PROVIDER_TYPES.PARTICIPANT_PORTAL,
        sourcePage: "/portal/access",
      }),
      buildAuthSessionRecord({
        id: "portal-mismatch",
        providerType: AUTH_SESSION_PROVIDER_TYPES.PARTICIPANT_PORTAL,
        sourcePage: "/login",
      }),
    ]);
    dbMock.authSession.update.mockResolvedValue({});

    const result = await revokeWorkspaceAuthSessionsByScope({
      scope: AUTH_SESSION_REVOKE_SCOPES.PROVIDER_SOURCE_MISMATCH,
      workspaceId: "workspace-1",
      userId: "user-1",
      actor: "Owner",
      sourcePage: "/settings",
    });

    expect(result).toEqual({ ok: true, revokedCount: 1 });
    expect(dbMock.authSession.update).toHaveBeenCalledTimes(1);
    expect(dbMock.authSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "portal-mismatch" },
      }),
    );
  });

  it("revokes only sessions whose active workspace lacks a live membership", async () => {
    dbMock.authSession.findMany.mockResolvedValue([
      buildAuthSessionRecord({
        id: "workspace-membership-ok",
        activeWorkspaceId: "workspace-1",
        user: {
          id: "user-1",
          name: "Owner",
          email: "owner@example.com",
          memberships: [buildMembership("workspace-1", MembershipStatus.ACTIVE)],
        },
      }),
      buildAuthSessionRecord({
        id: "workspace-membership-mismatch",
        activeWorkspaceId: "workspace-1",
        user: {
          id: "user-2",
          name: "Mismatch",
          email: "mismatch@example.com",
          memberships: [buildMembership("workspace-2", MembershipStatus.ACTIVE)],
        },
      }),
    ]);
    dbMock.authSession.update.mockResolvedValue({});

    const result = await revokeWorkspaceAuthSessionsByScope({
      scope: AUTH_SESSION_REVOKE_SCOPES.WORKSPACE_MEMBERSHIP_MISMATCH,
      workspaceId: "workspace-1",
      userId: "user-1",
      actor: "Owner",
      sourcePage: "/settings",
    });

    expect(result).toEqual({ ok: true, revokedCount: 1 });
    expect(dbMock.authSession.update).toHaveBeenCalledTimes(1);
    expect(dbMock.authSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "workspace-membership-mismatch" },
      }),
    );
  });

  it("returns zero when no sessions match the revoke scope", async () => {
    dbMock.authSession.findMany.mockResolvedValue([]);

    const result = await revokeWorkspaceAuthSessionsByScope({
      scope: AUTH_SESSION_REVOKE_SCOPES.STALE_ACTIVE,
      workspaceId: "workspace-1",
      userId: "user-1",
      actor: "Owner",
      sourcePage: "/settings",
    });

    expect(result).toEqual({ ok: true, revokedCount: 0 });
    expect(dbMock.authSession.update).not.toHaveBeenCalled();
    expect(writeAuditLogMock).not.toHaveBeenCalled();
  });
});
