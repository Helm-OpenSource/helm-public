import { ConnectorProvider, ConnectorStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { redactProviderErrorBody } from "@/lib/connectors/error-redaction";
import { storeConnectorToken } from "@/lib/connectors/token-store";
import { safeParseJson } from "@/lib/utils";

const DINGTALK_STATE_COOKIE = "helm-dingtalk-oauth-state";
const DINGTALK_USER_ACCESS_TOKEN_URL = "https://api.dingtalk.com/v1.0/oauth2/userAccessToken";
const DINGTALK_CURRENT_USER_PROFILE_URL = "https://api.dingtalk.com/v1.0/contact/users/me";
const DINGTALK_OAUTH_AUTHORIZE_URL = "https://login.dingtalk.com/oauth2/auth";
const DINGTALK_APP_ACCESS_TOKEN_URL = "https://oapi.dingtalk.com/gettoken";

export const DINGTALK_OAUTH_CALLBACK_SOURCE_PAGE = "/api/auth/dingtalk/callback";
const DINGTALK_DEFAULT_REDIRECT_PATH = DINGTALK_OAUTH_CALLBACK_SOURCE_PAGE;
const DINGTALK_OAUTH_SCOPES = ["openid", "corpid", "Contact.User.Read"] as const;

export const DINGTALK_CALLBACK_RESULT_STATUSES = {
  SUCCESS: "SUCCESS",
  FAILURE: "FAILURE",
  UNRESOLVED: "UNRESOLVED",
  MISMATCH: "MISMATCH",
} as const;

export const DINGTALK_CALLBACK_FAILURE_POSTURES = {
  CLEAR: "CLEAR",
  RETRYABLE: "RETRYABLE",
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
} as const;

export const DINGTALK_OAUTH_CALLBACK_AUDIT_ACTIONS = {
  SUCCESS: "DINGTALK_OAUTH_CALLBACK_SUCCEEDED",
  FAILURE: "DINGTALK_OAUTH_CALLBACK_FAILED",
  UNRESOLVED: "DINGTALK_OAUTH_CALLBACK_UNRESOLVED",
  MISMATCH: "DINGTALK_OAUTH_CALLBACK_MISMATCH",
} as const;

export const DINGTALK_READONLY_INGEST_RESULT_STATUSES = {
  SUCCESS: "SUCCESS",
  PARTIAL: "PARTIAL",
  FAILURE: "FAILURE",
  UNRESOLVED: "UNRESOLVED",
} as const;

export const DINGTALK_READONLY_INGEST_SCOPE_STATUSES = {
  INGESTED: "INGESTED",
  UNRESOLVED: "UNRESOLVED",
  FAILED: "FAILED",
} as const;

export const DINGTALK_READONLY_INGEST_AUDIT_ACTIONS = {
  SUCCESS: "DINGTALK_READONLY_INGEST_SUCCEEDED",
  PARTIAL: "DINGTALK_READONLY_INGEST_PARTIAL",
  FAILURE: "DINGTALK_READONLY_INGEST_FAILED",
  UNRESOLVED: "DINGTALK_READONLY_INGEST_UNRESOLVED",
} as const;

export type DingTalkCallbackResultStatus =
  (typeof DINGTALK_CALLBACK_RESULT_STATUSES)[keyof typeof DINGTALK_CALLBACK_RESULT_STATUSES];

export type DingTalkCallbackFailurePosture =
  (typeof DINGTALK_CALLBACK_FAILURE_POSTURES)[keyof typeof DINGTALK_CALLBACK_FAILURE_POSTURES];

export type DingTalkReadOnlyIngestResultStatus =
  (typeof DINGTALK_READONLY_INGEST_RESULT_STATUSES)[keyof typeof DINGTALK_READONLY_INGEST_RESULT_STATUSES];

export type DingTalkReadOnlyIngestScopeStatus =
  (typeof DINGTALK_READONLY_INGEST_SCOPE_STATUSES)[keyof typeof DINGTALK_READONLY_INGEST_SCOPE_STATUSES];

export type DingTalkReadOnlyScope = ReturnType<typeof getDingTalkReadOnlyCoverage>[number];

export type DingTalkUserAccessToken = {
  accessToken: string;
  refreshToken: string | null;
  expireInSeconds: number | null;
  corpId: string | null;
};

export type DingTalkAppAccessToken = {
  accessToken: string;
  expireInSeconds: number | null;
};

export type DingTalkUserProfile = {
  email: string | null;
  mobile: string | null;
  nick: string | null;
  avatarUrl: string | null;
  openId: string | null;
  unionId: string | null;
  userId: string | null;
};

export type DingTalkCallbackResult = {
  status: DingTalkCallbackResultStatus;
  failurePosture: DingTalkCallbackFailurePosture;
  recordedAt: string;
  message: string | null;
  providerEmail: string | null;
  providerMobile: string | null;
  providerNick: string | null;
  providerAvatarUrl: string | null;
  providerOpenId: string | null;
  providerUnionId: string | null;
  providerUserId: string | null;
  matchedWorkspaceUserEmail: string | null;
  corpId: string | null;
};

export type DingTalkReadOnlyIngestScopeResult = {
  scope: DingTalkReadOnlyScope;
  status: DingTalkReadOnlyIngestScopeStatus;
  message: string | null;
  docUrl: string | null;
  persistedPayloadCount: number;
  ingestionRecordCount: number;
  handleCount: number;
  latestSourceId: string | null;
};

export type DingTalkReadOnlyIngestResult = {
  status: DingTalkReadOnlyIngestResultStatus;
  failurePosture: DingTalkCallbackFailurePosture;
  recordedAt: string;
  sourcePage: string | null;
  message: string | null;
  runtimeEventId: string | null;
  runtimeSessionId: string | null;
  notebookId: string | null;
  windowStart: string | null;
  windowEnd: string | null;
  persistedPayloadCount: number;
  ingestionRecordCount: number;
  handleCount: number;
  scopeResults: DingTalkReadOnlyIngestScopeResult[];
};

export type DingTalkConnectorMetadata = {
  authMode: "oauth_callback_foundation" | "mcp_gateway";
  directorySyncMode: ReturnType<typeof getDingTalkDirectorySyncMode>;
  readOnlyCoverage: Array<ReturnType<typeof getDingTalkReadOnlyCoverage>[number]>;
  scopes: Array<(typeof DINGTALK_OAUTH_SCOPES)[number]>;
  lastCallbackResult: DingTalkCallbackResult | null;
  lastIngestResult: DingTalkReadOnlyIngestResult | null;
  lastResolvedCorpId: string | null;
  lastResolvedOpenId: string | null;
  lastResolvedUnionId: string | null;
  subjectDiscoveryCache: {
    recordedAt: string;
    cacheKey: string;
    subjects: Array<{
      userId: string | null;
      unionId: string | null;
      source: string;
    }>;
  } | null;
  lastDirectoryInviteDryRunSnapshot:
    | {
        recordedAt: string;
        processed: number;
        createdUsers: number;
        reusedUsers: number;
        upsertedMemberships: number;
        sentMessages: number;
        skipped: number;
        skippedNoMobile: number;
        nameCollisionResolved: number;
        errors: string[];
        details: unknown[];
      }
    | null;
};

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function getDingTalkStateCookieName() {
  return DINGTALK_STATE_COOKIE;
}

export function getDingTalkOauthScopes() {
  return [...DINGTALK_OAUTH_SCOPES];
}

export function getDingTalkConfig() {
  const appUrl = process.env.APP_URL?.trim() || null;
  const redirectUri =
    process.env.DINGTALK_REDIRECT_URI?.trim() ||
    (appUrl ? `${appUrl.replace(/\/$/, "")}${DINGTALK_DEFAULT_REDIRECT_PATH}` : null);

  return {
    clientId: process.env.DINGTALK_CLIENT_ID?.trim() || null,
    clientSecret: process.env.DINGTALK_CLIENT_SECRET?.trim() || null,
    redirectUri,
  };
}

export function getDingTalkMcpConfig() {
  return {
    clientId: process.env.DINGTALK_CLIENT_ID?.trim() || null,
    clientSecret: process.env.DINGTALK_CLIENT_SECRET?.trim() || null,
    robotCode: process.env.DINGTALK_ROBOT_CODE?.trim() || null,
    agentId: process.env.DINGTALK_AGENT_ID?.trim() || null,
    corpId: process.env.DINGTALK_CORP_ID?.trim() || process.env.DINGTALK_CORPID?.trim() || null,
    userUnionId: process.env.DINGTALK_USER_UNION_ID?.trim() || null,
    userId: process.env.DINGTALK_USER_ID?.trim() || null,
  };
}

export function getDingTalkAppMessageConfig() {
  return {
    clientId: process.env.DINGTALK_CLIENT_ID?.trim() || null,
    clientSecret: process.env.DINGTALK_CLIENT_SECRET?.trim() || null,
    agentId: process.env.DINGTALK_AGENT_ID?.trim() || null,
  };
}

export function isDingTalkMcpConfigured() {
  const config = getDingTalkMcpConfig();
  return Boolean(
    config.clientId &&
      config.clientSecret &&
      config.robotCode &&
      config.agentId &&
      config.corpId,
  );
}

export function isDingTalkAppMessageConfigured() {
  const config = getDingTalkAppMessageConfig();
  return Boolean(config.clientId && config.clientSecret && config.agentId);
}

export function isDingTalkOauthConfigured() {
  const config = getDingTalkConfig();
  return Boolean(config.clientId && config.clientSecret && config.redirectUri);
}

export function isDingTalkDirectorySyncConfigured() {
  const config = getDingTalkConfig();
  return Boolean(config.clientId && config.clientSecret);
}

export function getDingTalkDirectorySyncMode() {
  return "HELM_DIRECTORY_SYNC_ADAPTER" as const;
}

export function getDingTalkReadOnlyCoverage() {
  const coverage = [
    "MEETINGS",
    "CALENDAR",
    "TODO",
    "PROJECTS",
    "MANAGEMENT",
    "WORK",
  ] as const;
  if (process.env.DINGTALK_ENABLE_MESSAGE_NOTIFICATIONS === "1") {
    return [...coverage, "MESSAGE_NOTIFICATIONS"] as const;
  }
  return coverage;
}

export function buildDingTalkAuthUrl(state: string) {
  const config = getDingTalkConfig();

  if (!config.clientId || !config.redirectUri) {
    throw new Error("DingTalk OAuth 未配置");
  }

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    state,
    response_type: "code",
    prompt: "consent",
    scope: DINGTALK_OAUTH_SCOPES.join(" "),
  });

  return `${DINGTALK_OAUTH_AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeDingTalkAuthCode(code: string) {
  const config = getDingTalkConfig();

  if (!config.clientId || !config.clientSecret || !config.redirectUri) {
    throw new Error("DingTalk OAuth 未配置");
  }

  const response = await fetch(DINGTALK_USER_ACCESS_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      code,
      refreshToken: "",
      grantType: "authorization_code",
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`DingTalk token exchange failed: ${redactProviderErrorBody(body)}`);
  }

  const body = (await response.json()) as Record<string, unknown>;
  const accessToken =
    normalizeString(body.accessToken) ?? normalizeString(body.access_token);

  if (!accessToken) {
    throw new Error("DingTalk token exchange returned no access token");
  }

  return {
    accessToken,
    refreshToken:
      normalizeString(body.refreshToken) ?? normalizeString(body.refresh_token),
    expireInSeconds:
      normalizeNumber(body.expireIn) ??
      normalizeNumber(body.expiresIn) ??
      normalizeNumber(body.expires_in),
    corpId: normalizeString(body.corpId) ?? normalizeString(body.corpid),
  } satisfies DingTalkUserAccessToken;
}

export async function fetchDingTalkAppAccessToken() {
  const config = getDingTalkAppMessageConfig();

  if (!config.clientId || !config.clientSecret) {
    throw new Error("DingTalk app message config is incomplete");
  }

  const timeoutMs = Number(process.env.DINGTALK_HTTP_TIMEOUT_MS ?? "");
  const effectiveTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 15000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), effectiveTimeoutMs);

  const url = new URL(DINGTALK_APP_ACCESS_TOKEN_URL);
  url.searchParams.set("appkey", config.clientId);
  url.searchParams.set("appsecret", config.clientSecret);

  const response = await fetch(url.toString(), {
    cache: "no-store",
    signal: controller.signal,
  }).finally(() => clearTimeout(timer));

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`DingTalk app access token failed: ${redactProviderErrorBody(body)}`);
  }

  const body = (await response.json()) as Record<string, unknown>;
  const accessToken =
    normalizeString(body.access_token) ??
    normalizeString(body.accessToken);
  const errCode = normalizeNumber(body.errcode) ?? normalizeNumber(body.errorCode) ?? 0;
  const errMessage = normalizeString(body.errmsg) ?? normalizeString(body.errorMsg);

  if (errCode !== 0) {
    throw new Error(`DingTalk app access token failed: ${errMessage ?? `errcode=${errCode}`}`);
  }

  if (!accessToken) {
    throw new Error("DingTalk app access token response returned no access token");
  }

  return {
    accessToken,
    expireInSeconds:
      normalizeNumber(body.expires_in) ??
      normalizeNumber(body.expiresIn) ??
      null,
  } satisfies DingTalkAppAccessToken;
}

export async function fetchDingTalkUserProfile(accessToken: string) {
  const response = await fetch(DINGTALK_CURRENT_USER_PROFILE_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "x-acs-dingtalk-access-token": accessToken,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`DingTalk userinfo failed: ${redactProviderErrorBody(body)}`);
  }

  const body = (await response.json()) as Record<string, unknown>;

  return {
    email: normalizeString(body.email),
    mobile: normalizeString(body.mobile),
    nick: normalizeString(body.nick),
    avatarUrl: normalizeString(body.avatarUrl) ?? normalizeString(body.avatar),
    openId: normalizeString(body.openId) ?? normalizeString(body.openid),
    unionId: normalizeString(body.unionId) ?? normalizeString(body.unionid),
    userId: normalizeString(body.userId) ?? normalizeString(body.userid),
  } satisfies DingTalkUserProfile;
}

export function buildDingTalkCallbackResult(input: {
  status: DingTalkCallbackResultStatus;
  failurePosture: DingTalkCallbackFailurePosture;
  message?: string | null;
  profile?: DingTalkUserProfile | null;
  matchedWorkspaceUserEmail?: string | null;
  corpId?: string | null;
  recordedAt?: Date;
}) {
  const profile = input.profile ?? null;

  return {
    status: input.status,
    failurePosture: input.failurePosture,
    recordedAt: (input.recordedAt ?? new Date()).toISOString(),
    message: input.message?.trim() || null,
    providerEmail: profile?.email ?? null,
    providerMobile: profile?.mobile ?? null,
    providerNick: profile?.nick ?? null,
    providerAvatarUrl: profile?.avatarUrl ?? null,
    providerOpenId: profile?.openId ?? null,
    providerUnionId: profile?.unionId ?? null,
    providerUserId: profile?.userId ?? null,
    matchedWorkspaceUserEmail: input.matchedWorkspaceUserEmail?.trim() || null,
    corpId: input.corpId?.trim() || null,
  } satisfies DingTalkCallbackResult;
}

function buildBaseDingTalkMetadata(): Omit<
  DingTalkConnectorMetadata,
  | "lastCallbackResult"
  | "lastIngestResult"
  | "lastResolvedCorpId"
  | "lastResolvedOpenId"
  | "lastResolvedUnionId"
  | "subjectDiscoveryCache"
  | "lastDirectoryInviteDryRunSnapshot"
> {
  return {
    authMode: isDingTalkMcpConfigured() ? "mcp_gateway" : "oauth_callback_foundation",
    directorySyncMode: getDingTalkDirectorySyncMode(),
    readOnlyCoverage: [...getDingTalkReadOnlyCoverage()],
    scopes: [...DINGTALK_OAUTH_SCOPES],
  };
}

export function parseDingTalkConnectorMetadata(metadata?: string | null) {
  const parsed = safeParseJson<Partial<DingTalkConnectorMetadata> | null>(metadata, null);
  const base = buildBaseDingTalkMetadata();

  return {
    ...base,
    ...parsed,
    authMode:
      parsed?.authMode === "mcp_gateway" || parsed?.authMode === "oauth_callback_foundation"
        ? parsed.authMode
        : base.authMode,
    directorySyncMode: getDingTalkDirectorySyncMode(),
    readOnlyCoverage: [...getDingTalkReadOnlyCoverage()],
    scopes: [...DINGTALK_OAUTH_SCOPES],
    lastCallbackResult:
      parsed?.lastCallbackResult && typeof parsed.lastCallbackResult === "object"
        ? parsed.lastCallbackResult
        : null,
    lastIngestResult:
      parsed?.lastIngestResult && typeof parsed.lastIngestResult === "object"
        ? parsed.lastIngestResult
        : null,
    lastResolvedCorpId: normalizeString(parsed?.lastResolvedCorpId),
    lastResolvedOpenId: normalizeString(parsed?.lastResolvedOpenId),
    lastResolvedUnionId: normalizeString(parsed?.lastResolvedUnionId),
    subjectDiscoveryCache:
      parsed?.subjectDiscoveryCache &&
      typeof parsed.subjectDiscoveryCache === "object" &&
      typeof parsed.subjectDiscoveryCache.recordedAt === "string" &&
      typeof parsed.subjectDiscoveryCache.cacheKey === "string" &&
      Array.isArray(parsed.subjectDiscoveryCache.subjects)
        ? {
            recordedAt: parsed.subjectDiscoveryCache.recordedAt,
            cacheKey: parsed.subjectDiscoveryCache.cacheKey,
            subjects: parsed.subjectDiscoveryCache.subjects
              .filter((item) => Boolean(item && typeof item === "object"))
              .map((item) => item as Record<string, unknown>)
              .map((item) => ({
                userId: normalizeString(item.userId),
                unionId: normalizeString(item.unionId),
                source: normalizeString(item.source) ?? "cached_subject",
              }))
              .filter((item) => item.userId || item.unionId),
          }
        : null,
    lastDirectoryInviteDryRunSnapshot:
      parsed?.lastDirectoryInviteDryRunSnapshot &&
      typeof parsed.lastDirectoryInviteDryRunSnapshot === "object"
        ? {
            recordedAt:
              normalizeString(parsed.lastDirectoryInviteDryRunSnapshot.recordedAt) ??
              new Date().toISOString(),
            processed: Number(parsed.lastDirectoryInviteDryRunSnapshot.processed ?? 0) || 0,
            createdUsers: Number(parsed.lastDirectoryInviteDryRunSnapshot.createdUsers ?? 0) || 0,
            reusedUsers: Number(parsed.lastDirectoryInviteDryRunSnapshot.reusedUsers ?? 0) || 0,
            upsertedMemberships:
              Number(parsed.lastDirectoryInviteDryRunSnapshot.upsertedMemberships ?? 0) || 0,
            sentMessages: Number(parsed.lastDirectoryInviteDryRunSnapshot.sentMessages ?? 0) || 0,
            skipped: Number(parsed.lastDirectoryInviteDryRunSnapshot.skipped ?? 0) || 0,
            skippedNoMobile:
              Number(parsed.lastDirectoryInviteDryRunSnapshot.skippedNoMobile ?? 0) || 0,
            nameCollisionResolved:
              Number(parsed.lastDirectoryInviteDryRunSnapshot.nameCollisionResolved ?? 0) || 0,
            errors: Array.isArray(parsed.lastDirectoryInviteDryRunSnapshot.errors)
              ? parsed.lastDirectoryInviteDryRunSnapshot.errors
                  .map((item) => (typeof item === "string" ? item : null))
                  .filter((item): item is string => Boolean(item))
              : [],
            details: Array.isArray(parsed.lastDirectoryInviteDryRunSnapshot.details)
              ? parsed.lastDirectoryInviteDryRunSnapshot.details
              : [],
          }
        : null,
  } satisfies DingTalkConnectorMetadata;
}

export async function persistDingTalkConnectorCallbackResult(input: {
  workspaceId: string;
  userId: string;
  connectorStatus: ConnectorStatus;
  externalAccountEmail?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  expireInSeconds?: number | null;
  lastSyncStatus: string;
  lastSyncMessage?: string | null;
  callbackResult: DingTalkCallbackResult;
}) {
  const existing = await db.connector.findUnique({
    where: {
      workspaceId_userId_provider: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        provider: ConnectorProvider.DINGTALK,
      },
    },
  });
  const existingMetadata = parseDingTalkConnectorMetadata(existing?.metadata);
  const nextMetadata: DingTalkConnectorMetadata = {
    ...existingMetadata,
    lastCallbackResult: input.callbackResult,
    lastIngestResult: existingMetadata.lastIngestResult,
    lastResolvedCorpId: input.callbackResult.corpId,
    lastResolvedOpenId: input.callbackResult.providerOpenId,
    lastResolvedUnionId: input.callbackResult.providerUnionId,
  };
  const tokenExpiresAt = input.expireInSeconds
    ? new Date(Date.now() + input.expireInSeconds * 1000)
    : null;

  return db.connector.upsert({
    where: {
      workspaceId_userId_provider: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        provider: ConnectorProvider.DINGTALK,
      },
    },
    create: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      provider: ConnectorProvider.DINGTALK,
      status: input.connectorStatus,
      externalAccountEmail: input.externalAccountEmail ?? undefined,
      accessToken:
        input.connectorStatus === ConnectorStatus.CONNECTED
          ? storeConnectorToken(input.accessToken)
          : null,
      refreshToken:
        input.connectorStatus === ConnectorStatus.CONNECTED
          ? storeConnectorToken(input.refreshToken)
          : null,
      tokenExpiresAt: input.connectorStatus === ConnectorStatus.CONNECTED ? tokenExpiresAt : null,
      lastSyncStatus: input.lastSyncStatus,
      lastSyncMessage: input.lastSyncMessage ?? null,
      metadata: JSON.stringify(nextMetadata),
    },
    update: {
      status: input.connectorStatus,
      externalAccountEmail: input.externalAccountEmail ?? undefined,
      accessToken:
        input.connectorStatus === ConnectorStatus.CONNECTED
          ? storeConnectorToken(input.accessToken)
          : null,
      refreshToken:
        input.connectorStatus === ConnectorStatus.CONNECTED
          ? storeConnectorToken(input.refreshToken)
          : null,
      tokenExpiresAt: input.connectorStatus === ConnectorStatus.CONNECTED ? tokenExpiresAt : null,
      lastSyncStatus: input.lastSyncStatus,
      lastSyncMessage: input.lastSyncMessage ?? null,
      metadata: JSON.stringify(nextMetadata),
    },
  });
}

export async function persistDingTalkConnectorIngestResult(input: {
  workspaceId: string;
  userId: string;
  connectorStatus: ConnectorStatus;
  lastSyncStatus: string;
  lastSyncMessage?: string | null;
  ingestResult: DingTalkReadOnlyIngestResult;
}) {
  const existing = await db.connector.findUnique({
    where: {
      workspaceId_userId_provider: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        provider: ConnectorProvider.DINGTALK,
      },
    },
  });

  const existingMetadata = parseDingTalkConnectorMetadata(existing?.metadata);
  const nextMetadata: DingTalkConnectorMetadata = {
    ...existingMetadata,
    authMode: "mcp_gateway",
    lastIngestResult: input.ingestResult,
  };

  return db.connector.upsert({
    where: {
      workspaceId_userId_provider: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        provider: ConnectorProvider.DINGTALK,
      },
    },
    create: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      provider: ConnectorProvider.DINGTALK,
      status: input.connectorStatus,
      externalAccountEmail: null,
      lastSyncedAt: new Date(),
      lastSyncStatus: input.lastSyncStatus,
      lastSyncMessage: input.lastSyncMessage ?? null,
      metadata: JSON.stringify(nextMetadata),
    },
    update: {
      status: input.connectorStatus,
      lastSyncedAt: new Date(),
      lastSyncStatus: input.lastSyncStatus,
      lastSyncMessage: input.lastSyncMessage ?? null,
      metadata: JSON.stringify(nextMetadata),
    },
  });
}
