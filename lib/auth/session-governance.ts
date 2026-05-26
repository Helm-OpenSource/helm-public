import { MembershipStatus } from "@prisma/client";

export const AUTH_SESSION_STALE_DAYS = 7;
export const AUTH_SESSION_EXPIRING_SOON_DAYS = 3;
export const AUTH_SESSION_ANOMALY_SCOPES = {
  EXPIRING_SOON: "EXPIRING_SOON",
  STALE_ACTIVE: "STALE_ACTIVE",
  LEGACY_PROVIDER: "LEGACY_PROVIDER",
  MISSING_SOURCE_PAGE: "MISSING_SOURCE_PAGE",
  MISSING_WORKSPACE_SWITCH_MARKER: "MISSING_WORKSPACE_SWITCH_MARKER",
  PROVIDER_SOURCE_MISMATCH: "PROVIDER_SOURCE_MISMATCH",
  WORKSPACE_MEMBERSHIP_MISMATCH: "WORKSPACE_MEMBERSHIP_MISMATCH",
} as const;

export type AuthSessionAnomalyScope =
  (typeof AUTH_SESSION_ANOMALY_SCOPES)[keyof typeof AUTH_SESSION_ANOMALY_SCOPES];

export const AUTH_SESSION_ANOMALY_MANAGEMENT_MODES = {
  REVIEW_ONLY: "REVIEW_ONLY",
  BULK_REVOKE: "BULK_REVOKE",
} as const;

export type AuthSessionAnomalyManagementMode =
  (typeof AUTH_SESSION_ANOMALY_MANAGEMENT_MODES)[keyof typeof AUTH_SESSION_ANOMALY_MANAGEMENT_MODES];

const PARTICIPANT_PORTAL_SOURCE_PAGES = ["/portal", "/portal/access"] as const;
const STANDARD_AUTH_SOURCE_PAGES = ["/login"] as const;
const DINGTALK_OAUTH_SOURCE_PAGES = ["/api/auth/dingtalk/callback"] as const;
const WECOM_OAUTH_SOURCE_PAGES = ["/api/auth/wecom/callback"] as const;
const FEISHU_OAUTH_SOURCE_PAGES = ["/api/auth/feishu/callback"] as const;

type AuthSessionMembershipLike = {
  workspaceId: string;
  status: MembershipStatus;
};

type AuthSessionGovernanceLike = {
  id?: string;
  activeWorkspaceId?: string | null;
  sourcePage?: string | null;
  providerType?: string | null;
  lastSeenAt?: Date;
  lastWorkspaceSwitchAt?: Date | null;
  expiresAt?: Date;
  user: {
    memberships: AuthSessionMembershipLike[];
  };
};

export type AuthSessionAnomalyInventoryItem = {
  scope: AuthSessionAnomalyScope;
  activeSessionCount: number;
  managementMode: AuthSessionAnomalyManagementMode;
  revocableSessionCount: number;
  currentSessionProtected: boolean;
  latestDetectedAt: Date | null;
};

export function buildAuthSessionExpiringSoonThreshold(from = new Date()) {
  return new Date(from.getTime() + AUTH_SESSION_EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000);
}

export function buildAuthSessionStaleThreshold(from = new Date()) {
  return new Date(from.getTime() - AUTH_SESSION_STALE_DAYS * 24 * 60 * 60 * 1000);
}

export function isAuthSessionExpiringSoon(
  authSession: Pick<AuthSessionGovernanceLike, "expiresAt">,
  now = new Date(),
) {
  return !!authSession.expiresAt && authSession.expiresAt.getTime() <= buildAuthSessionExpiringSoonThreshold(now).getTime();
}

export function isAuthSessionStale(
  authSession: Pick<AuthSessionGovernanceLike, "lastSeenAt">,
  now = new Date(),
) {
  return !!authSession.lastSeenAt && authSession.lastSeenAt.getTime() < buildAuthSessionStaleThreshold(now).getTime();
}

export function hasAuthSessionMissingSourcePage(
  authSession: Pick<AuthSessionGovernanceLike, "sourcePage">,
) {
  return !authSession.sourcePage;
}

export function isAuthSessionProviderSourceCompatible(input: {
  providerType: string | null | undefined;
  sourcePage: string | null | undefined;
}) {
  if (!input.providerType || !input.sourcePage) {
    return true;
  }

  if (input.providerType === "PARTICIPANT_PORTAL") {
    return PARTICIPANT_PORTAL_SOURCE_PAGES.includes(
      input.sourcePage as (typeof PARTICIPANT_PORTAL_SOURCE_PAGES)[number],
    );
  }

  if (input.providerType === "DINGTALK_OAUTH") {
    return DINGTALK_OAUTH_SOURCE_PAGES.includes(
      input.sourcePage as (typeof DINGTALK_OAUTH_SOURCE_PAGES)[number],
    );
  }

  if (input.providerType === "WECOM_OAUTH") {
    return WECOM_OAUTH_SOURCE_PAGES.includes(
      input.sourcePage as (typeof WECOM_OAUTH_SOURCE_PAGES)[number],
    );
  }

  if (input.providerType === "FEISHU_OAUTH") {
    return FEISHU_OAUTH_SOURCE_PAGES.includes(
      input.sourcePage as (typeof FEISHU_OAUTH_SOURCE_PAGES)[number],
    );
  }

  return STANDARD_AUTH_SOURCE_PAGES.includes(
    input.sourcePage as (typeof STANDARD_AUTH_SOURCE_PAGES)[number],
  );
}

export function hasAuthSessionProviderSourceMismatch(
  authSession: Pick<AuthSessionGovernanceLike, "providerType" | "sourcePage">,
) {
  if (!authSession.providerType || !authSession.sourcePage) {
    return false;
  }

  return !isAuthSessionProviderSourceCompatible({
    providerType: authSession.providerType,
    sourcePage: authSession.sourcePage,
  });
}

export function hasAuthSessionWorkspaceMembershipMismatch(
  authSession: Pick<AuthSessionGovernanceLike, "activeWorkspaceId" | "user">,
) {
  if (!authSession.activeWorkspaceId) {
    return true;
  }

  return !authSession.user.memberships.some(
    (membership) =>
      membership.workspaceId === authSession.activeWorkspaceId &&
      membership.status !== MembershipStatus.INACTIVE,
  );
}

export function hasAuthSessionMissingWorkspaceSwitchMarker(
  authSession: Pick<AuthSessionGovernanceLike, "activeWorkspaceId" | "lastWorkspaceSwitchAt">,
) {
  return Boolean(authSession.activeWorkspaceId) && !authSession.lastWorkspaceSwitchAt;
}

export function listAuthSessionAnomalyScopes(
  authSession: Pick<
    AuthSessionGovernanceLike,
    | "activeWorkspaceId"
    | "expiresAt"
    | "lastSeenAt"
    | "lastWorkspaceSwitchAt"
    | "providerType"
    | "sourcePage"
    | "user"
  >,
  now = new Date(),
) {
  const scopes: AuthSessionAnomalyScope[] = [];

  if (isAuthSessionExpiringSoon(authSession, now)) {
    scopes.push(AUTH_SESSION_ANOMALY_SCOPES.EXPIRING_SOON);
  }

  if (isAuthSessionStale(authSession, now)) {
    scopes.push(AUTH_SESSION_ANOMALY_SCOPES.STALE_ACTIVE);
  }

  if (!authSession.providerType) {
    scopes.push(AUTH_SESSION_ANOMALY_SCOPES.LEGACY_PROVIDER);
  }

  if (hasAuthSessionMissingSourcePage(authSession)) {
    scopes.push(AUTH_SESSION_ANOMALY_SCOPES.MISSING_SOURCE_PAGE);
  }

  if (hasAuthSessionMissingWorkspaceSwitchMarker(authSession)) {
    scopes.push(AUTH_SESSION_ANOMALY_SCOPES.MISSING_WORKSPACE_SWITCH_MARKER);
  }

  if (hasAuthSessionProviderSourceMismatch(authSession)) {
    scopes.push(AUTH_SESSION_ANOMALY_SCOPES.PROVIDER_SOURCE_MISMATCH);
  }

  if (hasAuthSessionWorkspaceMembershipMismatch(authSession)) {
    scopes.push(AUTH_SESSION_ANOMALY_SCOPES.WORKSPACE_MEMBERSHIP_MISMATCH);
  }

  return scopes;
}

export function hasAuthSessionGovernanceAnomaly(
  authSession: Parameters<typeof listAuthSessionAnomalyScopes>[0],
  now = new Date(),
) {
  return listAuthSessionAnomalyScopes(authSession, now).length > 0;
}

export function buildAuthSessionAnomalyInventorySummary(input: {
  authSessions: Array<
    Pick<
      AuthSessionGovernanceLike,
      | "activeWorkspaceId"
      | "expiresAt"
      | "id"
      | "lastSeenAt"
      | "lastWorkspaceSwitchAt"
      | "providerType"
      | "sourcePage"
      | "user"
    >
  >;
  currentSessionId?: string | null;
  now?: Date;
}) {
  const now = input.now ?? new Date();

  return Object.values(AUTH_SESSION_ANOMALY_SCOPES).map((scope) => {
    const matchingSessions = input.authSessions.filter((authSession) =>
      listAuthSessionAnomalyScopes(authSession, now).includes(scope),
    );
    const managementMode =
      scope === AUTH_SESSION_ANOMALY_SCOPES.EXPIRING_SOON
        ? AUTH_SESSION_ANOMALY_MANAGEMENT_MODES.REVIEW_ONLY
        : AUTH_SESSION_ANOMALY_MANAGEMENT_MODES.BULK_REVOKE;
    const currentSessionProtected = matchingSessions.some(
      (authSession) => authSession.id === input.currentSessionId,
    );
    const latestDetectedAt =
      matchingSessions
        .map((authSession) => authSession.lastSeenAt ?? null)
        .filter((value): value is Date => value instanceof Date)
        .sort((left, right) => right.getTime() - left.getTime())[0] ?? null;

    return {
      scope,
      activeSessionCount: matchingSessions.length,
      managementMode,
      revocableSessionCount:
        managementMode === AUTH_SESSION_ANOMALY_MANAGEMENT_MODES.BULK_REVOKE
          ? matchingSessions.filter((authSession) => authSession.id !== input.currentSessionId).length
          : 0,
      currentSessionProtected,
      latestDetectedAt,
    } satisfies AuthSessionAnomalyInventoryItem;
  });
}
