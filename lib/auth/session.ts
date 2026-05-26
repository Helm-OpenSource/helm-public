import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomUUID } from "node:crypto";
import { AccessState, ActorType, MembershipStatus } from "@prisma/client";
import type { AuthSessionProviderType } from "@/lib/auth/provider-seam";
import {
  hasAuthSessionMissingSourcePage,
  hasAuthSessionMissingWorkspaceSwitchMarker,
  hasAuthSessionProviderSourceMismatch,
  hasAuthSessionWorkspaceMembershipMismatch,
  isAuthSessionStale,
} from "@/lib/auth/session-governance";
import {
  ACTIVE_WORKSPACE_COOKIE,
  FIRST_LOGIN_IDENTITY_SETUP_COOKIE,
  LEGACY_SESSION_COOKIE,
  SESSION_ID_COOKIE,
} from "@/lib/auth/session-cookies";
import { safeWriteAuditLog } from "@/lib/audit";
import { isWriteConflictError } from "@/lib/db/conflict-aware-write";
import { ensureWorkspaceCommercialFoundation, syncWorkspaceAccessState } from "@/lib/billing/foundation";
import { db } from "@/lib/db";
import { safeParseJson } from "@/lib/utils";

const AUTH_SESSION_TTL_DAYS = 14;

export { ACTIVE_WORKSPACE_COOKIE, SESSION_ID_COOKIE } from "@/lib/auth/session-cookies";
export const AUTH_SESSION_SCOPE_REVOKED_AUDIT_ACTION = "AUTH_SESSION_SCOPE_REVOKED";
export const AUTH_SESSION_WORKSPACE_REALIGNED_AUDIT_ACTION = "AUTH_SESSION_WORKSPACE_REALIGNED";
export const AUTH_SESSION_REVOKE_SCOPES = {
  STALE_ACTIVE: "STALE_ACTIVE",
  LEGACY_PROVIDER: "LEGACY_PROVIDER",
  MISSING_SOURCE_PAGE: "MISSING_SOURCE_PAGE",
  MISSING_WORKSPACE_SWITCH_MARKER: "MISSING_WORKSPACE_SWITCH_MARKER",
  PROVIDER_SOURCE_MISMATCH: "PROVIDER_SOURCE_MISMATCH",
  WORKSPACE_MEMBERSHIP_MISMATCH: "WORKSPACE_MEMBERSHIP_MISMATCH",
  OTHER_ACTIVE: "OTHER_ACTIVE",
} as const;

export type AuthSessionRevokeScope =
  (typeof AUTH_SESSION_REVOKE_SCOPES)[keyof typeof AUTH_SESSION_REVOKE_SCOPES];

type AuthSessionScopeReviewRecord = {
  id: string;
  activeWorkspaceId: string | null;
  sourcePage: string | null;
  providerType: string | null;
  lastSeenAt: Date;
  lastWorkspaceSwitchAt: Date | null;
  user: {
    memberships: Array<{
      workspaceId: string;
      status: MembershipStatus;
    }>;
  };
};

export type AuthSessionRevokeScopePreviewItem = {
  scope: AuthSessionRevokeScope;
  eligibleSessionCount: number;
  currentSessionProtected: boolean;
};

export type AuthSessionRevokeScopeExecutionDeltaItem = {
  scope: AuthSessionRevokeScope;
  liveEligibleSessionCount: number;
  currentSessionProtected: boolean;
  lastExecutedAt: Date | null;
  lastExecutedEligibleSessionCount: number | null;
  lastExecutedRevokedSessionCount: number | null;
  lastExecutionShortfallCount: number | null;
  previewEligibleDeltaCount: number | null;
};

export const AUTH_SESSION_REVOKE_CONSISTENCY_STATUSES = {
  CLEAR: "CLEAR",
  REVIEW_ONLY: "REVIEW_ONLY",
  REVOCABLE: "REVOCABLE",
  DRIFT: "DRIFT",
} as const;

export type AuthSessionRevokeConsistencyStatus =
  (typeof AUTH_SESSION_REVOKE_CONSISTENCY_STATUSES)[keyof typeof AUTH_SESSION_REVOKE_CONSISTENCY_STATUSES];

export type AuthSessionRevokeConsistencyItem = {
  scope: AuthSessionRevokeScope;
  status: AuthSessionRevokeConsistencyStatus;
  liveEligibleSessionCount: number;
  currentSessionProtected: boolean;
  lastExecutedAt: Date | null;
  previewEligibleDeltaCount: number | null;
  lastExecutionShortfallCount: number | null;
};

type AuthSessionScopedRevokeAuditRow = {
  createdAt: Date;
  payload: string | null;
};

function buildSessionExpiry(from = new Date()) {
  return new Date(from.getTime() + AUTH_SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

function buildCookieOptions(expiresAt?: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    ...(expiresAt ? { expires: expiresAt } : {}),
  };
}

function hashAuthSessionKey(sessionKey: string) {
  return createHash("sha256").update(sessionKey).digest("hex");
}

function normalizeHeaderValue(value: string | null | undefined, maxLength: number) {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function resolveIpAddress(headerStore: { get(name: string): string | null }) {
  const forwarded = headerStore.get("x-forwarded-for");
  if (forwarded) {
    const [firstIp] = forwarded.split(",");
    return normalizeHeaderValue(firstIp, 128);
  }

  return normalizeHeaderValue(headerStore.get("x-real-ip"), 128);
}

const authSessionUserInclude = {
  user: {
    include: {
      memberships: {
        orderBy: {
          createdAt: "asc" as const,
        },
        include: {
          workspace: true,
        },
      },
    },
  },
};

function isSessionUsable(authSession: { expiresAt: Date; revokedAt: Date | null }) {
  return !authSession.revokedAt && authSession.expiresAt.getTime() > Date.now();
}

async function setAuthSessionCookies(input: {
  sessionKey: string;
  workspaceId?: string | null;
  expiresAt: Date;
}) {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_ID_COOKIE, input.sessionKey, buildCookieOptions(input.expiresAt));
  cookieStore.delete(LEGACY_SESSION_COOKIE);

  if (input.workspaceId) {
    cookieStore.set(ACTIVE_WORKSPACE_COOKIE, input.workspaceId, buildCookieOptions(input.expiresAt));
    return;
  }

  cookieStore.delete(ACTIVE_WORKSPACE_COOKIE);
}

async function getAuthSessionRecordByKey(sessionKey: string) {
  const authSession = await db.authSession.findUnique({
    where: {
      sessionKeyHash: hashAuthSessionKey(sessionKey),
    },
    include: authSessionUserInclude,
  });

  if (!authSession || !isSessionUsable(authSession)) {
    return null;
  }

  return authSession;
}

function isAuthSessionMissingUserRelationError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("prisma.authSession.findUnique()") &&
    error.message.includes("Field user is required to return data, got `null` instead.")
  );
}

async function getCurrentAuthSessionRecord() {
  const cookieStore = await cookies();
  const sessionKey = cookieStore.get(SESSION_ID_COOKIE)?.value;

  if (!sessionKey) {
    return null;
  }

  try {
    return await getAuthSessionRecordByKey(sessionKey);
  } catch (error) {
    if (!isAuthSessionMissingUserRelationError(error)) {
      throw error;
    }

    console.warn("[auth-session] found corrupt session relation; clearing session", {
      sessionKeyHash: hashAuthSessionKey(sessionKey),
    });

    try {
      const now = new Date();
      await db.authSession.updateMany({
        where: {
          sessionKeyHash: hashAuthSessionKey(sessionKey),
          revokedAt: null,
        },
        data: {
          revokedAt: now,
          lastSeenAt: now,
        },
      });
    } catch (cleanupError) {
      console.warn("[auth-session] failed to revoke corrupt session", cleanupError);
    }

    try {
      cookieStore.delete(SESSION_ID_COOKIE);
      cookieStore.delete(ACTIVE_WORKSPACE_COOKIE);
      cookieStore.delete(FIRST_LOGIN_IDENTITY_SETUP_COOKIE);
      cookieStore.delete(LEGACY_SESSION_COOKIE);
    } catch (cookieError) {
      console.warn("[auth-session] unable to clear corrupt session cookies in readonly context", {
        sessionKeyHash: hashAuthSessionKey(sessionKey),
        error: cookieError instanceof Error ? cookieError.message : String(cookieError),
      });
    }

    return null;
  }
}

async function rotateAuthSessionRecord(input: {
  authSession: Awaited<ReturnType<typeof getAuthSessionRecordByKey>>;
  actionSourcePage?: string | null;
}) {
  if (!input.authSession) {
    return null;
  }

  const { authSession } = input;
  const rotatedAt = new Date();
  const rotatedSessionKey = randomUUID();
  const expiresAt = buildSessionExpiry(rotatedAt);
  const headerStore = await headers();

  const rotatedSession = await db.authSession.create({
    data: {
      userId: authSession.userId,
      activeWorkspaceId: authSession.activeWorkspaceId ?? undefined,
      sessionKeyHash: hashAuthSessionKey(rotatedSessionKey),
      sourcePage: authSession.sourcePage ?? undefined,
      providerType: authSession.providerType ?? undefined,
      userAgent:
        normalizeHeaderValue(headerStore.get("user-agent"), 512) ??
        authSession.userAgent ??
        undefined,
      ipAddress: resolveIpAddress(headerStore) ?? authSession.ipAddress ?? undefined,
      lastSeenAt: rotatedAt,
      lastWorkspaceSwitchAt: authSession.lastWorkspaceSwitchAt ?? undefined,
      expiresAt,
    },
    include: authSessionUserInclude,
  });

  await db.authSession.update({
    where: { id: authSession.id },
    data: {
      revokedAt: rotatedAt,
      lastSeenAt: rotatedAt,
    },
  });

  await setAuthSessionCookies({
    sessionKey: rotatedSessionKey,
    workspaceId: rotatedSession.activeWorkspaceId,
    expiresAt,
  });

  if (rotatedSession.activeWorkspaceId) {
    await safeWriteAuditLog({
      workspaceId: rotatedSession.activeWorkspaceId,
      userId: rotatedSession.user.id,
      actor: rotatedSession.user.name,
      actorType: ActorType.USER,
      actionType: "AUTH_SESSION_ROTATED",
      targetType: "AuthSession",
      targetId: rotatedSession.id,
      summary: `Rotated auth session for ${rotatedSession.user.email}`,
      payload: {
        previousSessionId: authSession.id,
        providerType: rotatedSession.providerType ?? null,
        entrySourcePage: rotatedSession.sourcePage ?? null,
        actionSourcePage: input.actionSourcePage ?? null,
      },
      sourcePage: input.actionSourcePage ?? undefined,
    });
  }

  return rotatedSession;
}

async function revokeAuthSession(input: {
  sessionId: string;
  workspaceId?: string | null;
  userId: string;
  actor: string;
  sourcePage?: string | null;
}) {
  const revokedAt = new Date();

  await db.authSession.update({
    where: { id: input.sessionId },
    data: {
      revokedAt,
      lastSeenAt: revokedAt,
    },
  });

  if (!input.workspaceId) {
    return;
  }

  await safeWriteAuditLog({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actor: input.actor,
    actorType: ActorType.USER,
    actionType: "AUTH_SESSION_REVOKED",
    targetType: "AuthSession",
    targetId: input.sessionId,
    summary:
      input.sourcePage === "/portal"
        ? `Revoked participant session ${input.sessionId}`
        : `Revoked auth session ${input.sessionId}`,
    payload: {
      sourcePage: input.sourcePage ?? null,
    },
    sourcePage: input.sourcePage ?? undefined,
  });
}

function isReadonlySqliteWriteError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes("attempt to write a readonly database");
}

function formatAuthSessionRevokeScopeSummary(scope: AuthSessionRevokeScope) {
  switch (scope) {
    case AUTH_SESSION_REVOKE_SCOPES.STALE_ACTIVE:
      return "stale active auth sessions";
    case AUTH_SESSION_REVOKE_SCOPES.LEGACY_PROVIDER:
      return "legacy-provider auth sessions";
    case AUTH_SESSION_REVOKE_SCOPES.MISSING_SOURCE_PAGE:
      return "missing-source auth sessions";
    case AUTH_SESSION_REVOKE_SCOPES.MISSING_WORKSPACE_SWITCH_MARKER:
      return "missing workspace-switch marker auth sessions";
    case AUTH_SESSION_REVOKE_SCOPES.PROVIDER_SOURCE_MISMATCH:
      return "provider/source mismatch auth sessions";
    case AUTH_SESSION_REVOKE_SCOPES.WORKSPACE_MEMBERSHIP_MISMATCH:
      return "workspace-membership mismatch auth sessions";
    case AUTH_SESSION_REVOKE_SCOPES.OTHER_ACTIVE:
      return "other active auth sessions";
  }
}

export function matchesAuthSessionRevokeScope(
  authSession: AuthSessionScopeReviewRecord,
  scope: AuthSessionRevokeScope,
  now = new Date(),
) {
  switch (scope) {
    case AUTH_SESSION_REVOKE_SCOPES.STALE_ACTIVE:
      return isAuthSessionStale(authSession, now);
    case AUTH_SESSION_REVOKE_SCOPES.LEGACY_PROVIDER:
      return !authSession.providerType;
    case AUTH_SESSION_REVOKE_SCOPES.MISSING_SOURCE_PAGE:
      return hasAuthSessionMissingSourcePage(authSession);
    case AUTH_SESSION_REVOKE_SCOPES.MISSING_WORKSPACE_SWITCH_MARKER:
      return hasAuthSessionMissingWorkspaceSwitchMarker(authSession);
    case AUTH_SESSION_REVOKE_SCOPES.PROVIDER_SOURCE_MISMATCH:
      return hasAuthSessionProviderSourceMismatch(authSession);
    case AUTH_SESSION_REVOKE_SCOPES.WORKSPACE_MEMBERSHIP_MISMATCH:
      return hasAuthSessionWorkspaceMembershipMismatch(authSession);
    case AUTH_SESSION_REVOKE_SCOPES.OTHER_ACTIVE:
      return true;
  }
}

export function buildAuthSessionRevokeScopePreview(input: {
  authSessions: AuthSessionScopeReviewRecord[];
  currentSessionId?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const currentSession = input.currentSessionId
    ? input.authSessions.find((authSession) => authSession.id === input.currentSessionId) ?? null
    : null;

  const liveRevokeScopeSummary: AuthSessionRevokeScopePreviewItem[] = Object.values(
    AUTH_SESSION_REVOKE_SCOPES,
  ).map((scope) => {
    const matchingSessions = input.authSessions.filter((authSession) =>
      matchesAuthSessionRevokeScope(authSession, scope, now),
    );
    const currentSessionProtected = Boolean(
      currentSession && matchesAuthSessionRevokeScope(currentSession, scope, now),
    );

    return {
      scope,
      eligibleSessionCount: matchingSessions.filter(
        (authSession) => authSession.id !== input.currentSessionId,
      ).length,
      currentSessionProtected,
    };
  });

  const currentSessionReviewScopeSummary = currentSession
    ? Object.values(AUTH_SESSION_REVOKE_SCOPES).filter(
        (scope) =>
          scope !== AUTH_SESSION_REVOKE_SCOPES.OTHER_ACTIVE &&
          matchesAuthSessionRevokeScope(currentSession, scope, now),
      )
    : [];

  return {
    liveRevokeScopeSummary,
    currentSessionReviewScopeSummary,
  };
}

export function buildAuthSessionRevokePreviewVsExecutedDelta(input: {
  liveRevokeScopeSummary: AuthSessionRevokeScopePreviewItem[];
  scopedSessionRevokeAudits: AuthSessionScopedRevokeAuditRow[];
}) {
  const latestAuditByScope = new Map<
    AuthSessionRevokeScope,
    {
      createdAt: Date;
      previewEligibleSessionCount: number | null;
      revokedCount: number | null;
    }
  >();

  for (const auditRow of input.scopedSessionRevokeAudits) {
    const payload = safeParseJson(auditRow.payload, null);
    if (!payload || typeof payload !== "object") {
      continue;
    }

    const rawPayload = payload as Record<string, unknown>;
    const scope = rawPayload.scope;
    if (!Object.values(AUTH_SESSION_REVOKE_SCOPES).includes(scope as AuthSessionRevokeScope)) {
      continue;
    }

    if (latestAuditByScope.has(scope as AuthSessionRevokeScope)) {
      continue;
    }

    const previewEligibleSessionCount =
      typeof rawPayload.previewEligibleSessionCount === "number" &&
      Number.isFinite(rawPayload.previewEligibleSessionCount)
        ? Math.max(0, rawPayload.previewEligibleSessionCount)
        : null;
    const revokedCount =
      typeof rawPayload.revokedCount === "number" && Number.isFinite(rawPayload.revokedCount)
        ? Math.max(0, rawPayload.revokedCount)
        : null;

    latestAuditByScope.set(scope as AuthSessionRevokeScope, {
      createdAt: auditRow.createdAt,
      previewEligibleSessionCount,
      revokedCount,
    });
  }

  return Object.values(AUTH_SESSION_REVOKE_SCOPES).map((scope) => {
    const liveScope =
      input.liveRevokeScopeSummary.find((item) => item.scope === scope) ?? {
        scope,
        eligibleSessionCount: 0,
        currentSessionProtected: false,
      };
    const latestAudit = latestAuditByScope.get(scope) ?? null;
    const lastExecutedEligibleSessionCount = latestAudit?.previewEligibleSessionCount ?? null;
    const lastExecutedRevokedSessionCount = latestAudit?.revokedCount ?? null;

    return {
      scope,
      liveEligibleSessionCount: liveScope.eligibleSessionCount,
      currentSessionProtected: liveScope.currentSessionProtected,
      lastExecutedAt: latestAudit?.createdAt ?? null,
      lastExecutedEligibleSessionCount,
      lastExecutedRevokedSessionCount,
      lastExecutionShortfallCount:
        lastExecutedEligibleSessionCount !== null && lastExecutedRevokedSessionCount !== null
          ? lastExecutedEligibleSessionCount - lastExecutedRevokedSessionCount
          : null,
      previewEligibleDeltaCount:
        lastExecutedEligibleSessionCount !== null
          ? liveScope.eligibleSessionCount - lastExecutedEligibleSessionCount
          : null,
    } satisfies AuthSessionRevokeScopeExecutionDeltaItem;
  });
}

export function buildAuthSessionRevokeConsistencySummary(input: {
  previewVsExecutedScopeSummary: AuthSessionRevokeScopeExecutionDeltaItem[];
}) {
  return input.previewVsExecutedScopeSummary.map((item) => {
    const status =
      (item.previewEligibleDeltaCount !== null && item.previewEligibleDeltaCount !== 0) ||
      (item.lastExecutionShortfallCount !== null && item.lastExecutionShortfallCount > 0)
        ? AUTH_SESSION_REVOKE_CONSISTENCY_STATUSES.DRIFT
        : item.liveEligibleSessionCount > 0
          ? AUTH_SESSION_REVOKE_CONSISTENCY_STATUSES.REVOCABLE
          : item.currentSessionProtected
            ? AUTH_SESSION_REVOKE_CONSISTENCY_STATUSES.REVIEW_ONLY
            : AUTH_SESSION_REVOKE_CONSISTENCY_STATUSES.CLEAR;

    return {
      scope: item.scope,
      status,
      liveEligibleSessionCount: item.liveEligibleSessionCount,
      currentSessionProtected: item.currentSessionProtected,
      lastExecutedAt: item.lastExecutedAt,
      previewEligibleDeltaCount: item.previewEligibleDeltaCount,
      lastExecutionShortfallCount: item.lastExecutionShortfallCount,
    } satisfies AuthSessionRevokeConsistencyItem;
  });
}

export async function getCurrentUser() {
  const authSession = await getCurrentAuthSessionRecord();
  return authSession?.user ?? null;
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  return user;
}

export function resolvePreferredMembership<T extends { workspaceId: string; status: MembershipStatus }>(
  memberships: T[],
  activeWorkspaceId: string | undefined,
) {
  const selectableMemberships = memberships.filter((membership) => membership.status !== MembershipStatus.INACTIVE);
  const activeMemberships = selectableMemberships.filter((membership) => membership.status === MembershipStatus.ACTIVE);
  const invitedMemberships = selectableMemberships.filter((membership) => membership.status === MembershipStatus.INVITED);

  if (activeWorkspaceId) {
    const matched =
      activeMemberships.find((membership) => membership.workspaceId === activeWorkspaceId) ??
      invitedMemberships.find((membership) => membership.workspaceId === activeWorkspaceId);
    if (matched) {
      return matched;
    }
  }

  return activeMemberships[0] ?? invitedMemberships[0] ?? memberships[0] ?? null;
}

// Membership activation retries the same MySQL 1020 / Prisma P2034 family
// as recommendation persistence; reuse the centralized predicate.
const isMembershipActivationWriteConflict = isWriteConflictError;

function readMembership(input: { workspaceId: string; userId: string }) {
  return db.membership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: input.workspaceId,
        userId: input.userId,
      },
    },
  });
}

async function markInvitedMembershipActive(input: { workspaceId: string; userId: string }) {
  return db.membership.updateMany({
    where: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      status: MembershipStatus.INVITED,
    },
    data: {
      status: MembershipStatus.ACTIVE,
      joinedAt: new Date(),
    },
  });
}

export const MEMBERSHIP_AUTO_ACTIVATED_AUDIT_ACTION = "MEMBERSHIP_AUTO_ACTIVATED_ON_FIRST_USE";

export async function activateMembershipIfInvited(input: {
  workspaceId: string;
  userId: string;
}) {
  let activation: Awaited<ReturnType<typeof markInvitedMembershipActive>>;

  try {
    activation = await markInvitedMembershipActive(input);
  } catch (error) {
    if (!isMembershipActivationWriteConflict(error)) {
      throw error;
    }

    const current = await readMembership(input);
    if (!current || current.status !== MembershipStatus.INVITED) {
      return current;
    }

    try {
      activation = await markInvitedMembershipActive(input);
    } catch (retryError) {
      if (!isMembershipActivationWriteConflict(retryError)) {
        throw retryError;
      }

      return readMembership(input);
    }
  }

  if (activation.count > 0) {
    // Implicit accept-invite: the user reached an invited workspace and we
    // auto-flipped INVITED → ACTIVE. AGENTS.md §6 forbids broad auto-write
    // without leaving a trace, so the transition itself is audited even
    // though no explicit "accept" UI exists yet (see audit §3.5).
    await safeWriteAuditLog({
      workspaceId: input.workspaceId,
      userId: input.userId,
      actor: input.userId,
      actorType: ActorType.SYSTEM,
      actionType: MEMBERSHIP_AUTO_ACTIVATED_AUDIT_ACTION,
      targetType: "Membership",
      targetId: `${input.workspaceId}:${input.userId}`,
      summary: "Membership auto-activated on first workspace use (implicit accept-invite)",
      payload: {
        workspaceId: input.workspaceId,
        userId: input.userId,
      },
      sourcePage: "/auth/session",
    });
    return readMembership(input);
  }

  return readMembership(input);
}

export async function setActiveWorkspace(workspaceId: string) {
  const authSession = await getCurrentAuthSessionRecord();

  if (!authSession) {
    throw new Error("Active auth session required before switching workspace");
  }

  const membership = await db.membership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId,
        userId: authSession.user.id,
      },
    },
    include: {
      workspace: true,
    },
  });

  if (!membership || membership.status === MembershipStatus.INACTIVE) {
    throw new Error("Workspace unavailable for current session");
  }

  const switchedAt = new Date();

  await db.authSession.update({
    where: { id: authSession.id },
    data: {
      activeWorkspaceId: workspaceId,
      lastSeenAt: switchedAt,
      lastWorkspaceSwitchAt: switchedAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, buildCookieOptions(authSession.expiresAt));

  await safeWriteAuditLog({
    workspaceId,
    userId: authSession.user.id,
    actor: authSession.user.name,
    actorType: ActorType.USER,
    actionType: "AUTH_SESSION_WORKSPACE_SWITCHED",
    targetType: "AuthSession",
    targetId: authSession.id,
    summary: `Switched active workspace to ${membership.workspace.name}`,
    payload: {
      workspaceId,
    },
    sourcePage: "/settings",
  });
}

export async function getCurrentWorkspaceSession() {
  const authSession = await getCurrentAuthSessionRecord();

  if (!authSession) {
    redirect("/");
  }

  const cookieStore = await cookies();
  const legacyWorkspacePreference = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value;
  const membership = resolvePreferredMembership(
    authSession.user.memberships,
    authSession.activeWorkspaceId ?? legacyWorkspacePreference,
  );

  if (!membership) {
    redirect("/");
  }

  await ensureWorkspaceCommercialFoundation(membership.workspaceId);
  await activateMembershipIfInvited({
    workspaceId: membership.workspaceId,
    userId: authSession.user.id,
  });

  if (membership.workspaceId !== authSession.activeWorkspaceId) {
    const realignedAt = new Date();
    const previousWorkspaceId = authSession.activeWorkspaceId;
    await db.authSession.update({
      where: { id: authSession.id },
      data: {
        activeWorkspaceId: membership.workspaceId,
        lastSeenAt: realignedAt,
        lastWorkspaceSwitchAt: realignedAt,
      },
    });

    cookieStore.set(
      ACTIVE_WORKSPACE_COOKIE,
      membership.workspaceId,
      buildCookieOptions(authSession.expiresAt),
    );

    await safeWriteAuditLog({
      workspaceId: membership.workspaceId,
      userId: authSession.user.id,
      actor: authSession.user.name,
      actorType: ActorType.USER,
      actionType: AUTH_SESSION_WORKSPACE_REALIGNED_AUDIT_ACTION,
      targetType: "AuthSession",
      targetId: authSession.id,
      summary: `Realigned active workspace to ${membership.workspace.name}`,
      payload: {
        previousWorkspaceId,
        realignedWorkspaceId: membership.workspaceId,
      },
      sourcePage: "/auth/session",
    });
  }

  const currentMembership = await db.membership.findUnique({
    where: {
      workspaceId_userId: {
        workspaceId: membership.workspaceId,
        userId: authSession.user.id,
      },
    },
    include: {
      user: true,
      workspace: {
        include: {
          billingAccount: true,
          trialState: true,
          workerEntitlements: {
            orderBy: [{ entitlementType: "asc" }, { workerKey: "asc" }],
          },
        },
      },
    },
  });

  if (!currentMembership) {
    redirect("/");
  }

  const accessState =
    (await syncWorkspaceAccessState(currentMembership.workspaceId)) ??
    currentMembership.workspace.trialState?.status ??
    currentMembership.workspace.billingAccount?.billingStatus ??
    AccessState.ACTIVE;

  return {
    authSessionId: authSession.id,
    user: currentMembership.user,
    membership: currentMembership,
    workspace: currentMembership.workspace,
    accessState,
  };
}

export async function getCurrentMembership() {
  const session = await getCurrentWorkspaceSession();
  return session.membership;
}

export async function getCurrentWorkspace() {
  const session = await getCurrentWorkspaceSession();
  return session.workspace;
}

export async function createSession(input: {
  userId: string;
  email: string;
  workspaceId?: string | null;
  sourcePage?: string | null;
  providerType?: AuthSessionProviderType | null;
}) {
  const cookieStore = await cookies();
  const existingSessionKey = cookieStore.get(SESSION_ID_COOKIE)?.value;

  if (existingSessionKey) {
    let currentSession: Awaited<ReturnType<typeof getAuthSessionRecordByKey>> = null;
    try {
      currentSession = await getAuthSessionRecordByKey(existingSessionKey);
    } catch (error) {
      if (!isAuthSessionMissingUserRelationError(error)) {
        throw error;
      }

      console.warn("[auth-session] found corrupt session relation while creating session", {
        sessionKeyHash: hashAuthSessionKey(existingSessionKey),
      });

      try {
        const now = new Date();
        await db.authSession.updateMany({
          where: {
            sessionKeyHash: hashAuthSessionKey(existingSessionKey),
            revokedAt: null,
          },
          data: {
            revokedAt: now,
            lastSeenAt: now,
          },
        });
      } catch (cleanupError) {
        console.warn("[auth-session] failed to revoke corrupt session during createSession", cleanupError);
      }
    }

    if (currentSession) {
      await revokeAuthSession({
        sessionId: currentSession.id,
        workspaceId: currentSession.activeWorkspaceId,
        userId: currentSession.user.id,
        actor: currentSession.user.name,
        sourcePage: input.sourcePage,
      });
    }
  }

  const sessionKey = randomUUID();
  const createdAt = new Date();
  const expiresAt = buildSessionExpiry(createdAt);
  const headerStore = await headers();
  const authSession = await db.authSession.create({
    data: {
      userId: input.userId,
      activeWorkspaceId: input.workspaceId ?? undefined,
      sessionKeyHash: hashAuthSessionKey(sessionKey),
      sourcePage: input.sourcePage ?? undefined,
      providerType: input.providerType ?? undefined,
      userAgent: normalizeHeaderValue(headerStore.get("user-agent"), 512) ?? undefined,
      ipAddress: resolveIpAddress(headerStore) ?? undefined,
      lastSeenAt: createdAt,
      lastWorkspaceSwitchAt: input.workspaceId ? createdAt : undefined,
      expiresAt,
    },
  });

  await setAuthSessionCookies({
    sessionKey,
    workspaceId: input.workspaceId,
    expiresAt,
  });

  if (!input.workspaceId) {
    return authSession;
  }

  await safeWriteAuditLog({
    workspaceId: input.workspaceId,
    userId: input.userId,
    actor: input.email,
    actorType: ActorType.USER,
    actionType: "AUTH_SESSION_CREATED",
    targetType: "AuthSession",
    targetId: authSession.id,
    summary: `Created auth session for ${input.email}`,
    payload: {
      sourcePage: input.sourcePage ?? null,
      providerType: input.providerType ?? null,
    },
    sourcePage: input.sourcePage ?? undefined,
  });

  return authSession;
}

export async function clearSession() {
  const authSession = await getCurrentAuthSessionRecord();

  if (authSession) {
    try {
      await revokeAuthSession({
        sessionId: authSession.id,
        workspaceId: authSession.activeWorkspaceId,
        userId: authSession.user.id,
        actor: authSession.user.name,
      });
    } catch (error) {
      if (!isReadonlySqliteWriteError(error)) {
        throw error;
      }
      console.warn("clearSession: sqlite readonly write error while revoking auth session; continuing cookie clear");
    }
  }

  const cookieStore = await cookies();
  cookieStore.delete(LEGACY_SESSION_COOKIE);
  cookieStore.delete(SESSION_ID_COOKIE);
  cookieStore.delete(ACTIVE_WORKSPACE_COOKIE);
  cookieStore.delete(FIRST_LOGIN_IDENTITY_SETUP_COOKIE);
}

export async function getSessionId() {
  const authSession = await getCurrentAuthSessionRecord();
  return authSession?.id ?? null;
}

export async function rotateCurrentAuthSession(input?: {
  sourcePage?: string | null;
}) {
  const authSession = await getCurrentAuthSessionRecord();

  if (!authSession) {
    return { ok: false as const, reason: "NOT_FOUND" as const };
  }

  if (!isSessionUsable(authSession)) {
    return { ok: false as const, reason: "UNAVAILABLE" as const };
  }

  const rotatedSession = await rotateAuthSessionRecord({
    authSession,
    actionSourcePage: input?.sourcePage ?? null,
  });

  if (!rotatedSession) {
    return { ok: false as const, reason: "UNAVAILABLE" as const };
  }

  return { ok: true as const, sessionId: rotatedSession.id };
}

export async function revokeWorkspaceAuthSessionById(input: {
  sessionId: string;
  workspaceId: string;
  userId: string;
  actor: string;
  sourcePage?: string | null;
}) {
  const authSession = await db.authSession.findUnique({
    where: {
      id: input.sessionId,
    },
    include: authSessionUserInclude,
  });

  if (!authSession || authSession.activeWorkspaceId !== input.workspaceId) {
    return { ok: false as const, reason: "NOT_FOUND" as const };
  }

  if (!isSessionUsable(authSession)) {
    return { ok: false as const, reason: "UNAVAILABLE" as const };
  }

  await revokeAuthSession({
    sessionId: authSession.id,
    workspaceId: authSession.activeWorkspaceId,
    userId: input.userId,
    actor: input.actor,
    sourcePage: input.sourcePage,
  });

  return { ok: true as const };
}

export async function revokeWorkspaceAuthSessionsByScope(input: {
  scope: AuthSessionRevokeScope;
  workspaceId: string;
  userId: string;
  actor: string;
  currentSessionId?: string | null;
  sourcePage?: string | null;
}) {
  const now = new Date();
  const authSessions = await db.authSession.findMany({
    where: {
      activeWorkspaceId: input.workspaceId,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    include: authSessionUserInclude,
  });
  const matchingSessions = authSessions.filter((authSession) =>
    matchesAuthSessionRevokeScope(authSession, input.scope, now),
  );
  const currentSessionProtected = Boolean(
    input.currentSessionId &&
      matchingSessions.some((authSession) => authSession.id === input.currentSessionId),
  );
  const revocableSessions = matchingSessions.filter(
    (authSession) => authSession.id !== input.currentSessionId,
  );
  const previewEligibleSessionCount = revocableSessions.length;

  if (previewEligibleSessionCount === 0) {
    return { ok: true as const, revokedCount: 0 };
  }

  let revokedCount = 0;

  for (const authSession of revocableSessions) {
    if (!isSessionUsable(authSession)) {
      continue;
    }

    await revokeAuthSession({
      sessionId: authSession.id,
      workspaceId: authSession.activeWorkspaceId,
      userId: input.userId,
      actor: input.actor,
      sourcePage: input.sourcePage,
    });
    revokedCount += 1;
  }

  if (revokedCount > 0) {
    await safeWriteAuditLog({
      workspaceId: input.workspaceId,
      userId: input.userId,
      actor: input.actor,
      actorType: ActorType.USER,
      actionType: AUTH_SESSION_SCOPE_REVOKED_AUDIT_ACTION,
      targetType: "Workspace",
      targetId: input.workspaceId,
      summary: `Revoked ${revokedCount} ${formatAuthSessionRevokeScopeSummary(input.scope)}`,
      payload: {
        scope: input.scope,
        previewEligibleSessionCount,
        revokedCount,
        lastExecutionShortfallCount: previewEligibleSessionCount - revokedCount,
        currentSessionProtected,
        sourcePage: input.sourcePage ?? null,
      },
      sourcePage: input.sourcePage ?? undefined,
    });
  }

  return { ok: true as const, revokedCount };
}
