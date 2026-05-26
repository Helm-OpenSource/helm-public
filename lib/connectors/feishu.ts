import { ConnectorProvider, ConnectorStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { redactProviderErrorBody } from "@/lib/connectors/error-redaction";
import { storeConnectorToken } from "@/lib/connectors/token-store";
import { safeParseJson } from "@/lib/utils";

const FEISHU_STATE_COOKIE = "helm-feishu-oauth-state";
const FEISHU_OAUTH_AUTHORIZE_URL = "https://accounts.feishu.cn/open-apis/authen/v1/authorize";
const FEISHU_APP_ACCESS_TOKEN_URL = "https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal";
const FEISHU_TENANT_ACCESS_TOKEN_URL =
  "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal";
const FEISHU_USER_ACCESS_TOKEN_URL = "https://open.feishu.cn/open-apis/authen/v1/oidc/access_token";
const FEISHU_USER_INFO_URL = "https://open.feishu.cn/open-apis/authen/v1/user_info";

export const FEISHU_OAUTH_CALLBACK_SOURCE_PAGE = "/api/auth/feishu/callback";
const FEISHU_DEFAULT_REDIRECT_PATH = FEISHU_OAUTH_CALLBACK_SOURCE_PAGE;
const FEISHU_OAUTH_SCOPES = [
  "contact:contact.base:readonly",
  "bitable:app:readonly",
] as const;

export const FEISHU_CALLBACK_RESULT_STATUSES = {
  SUCCESS: "SUCCESS",
  FAILURE: "FAILURE",
  UNRESOLVED: "UNRESOLVED",
  MISMATCH: "MISMATCH",
} as const;

export const FEISHU_CALLBACK_FAILURE_POSTURES = {
  CLEAR: "CLEAR",
  RETRYABLE: "RETRYABLE",
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
} as const;

export const FEISHU_OAUTH_CALLBACK_AUDIT_ACTIONS = {
  SUCCESS: "FEISHU_OAUTH_CALLBACK_SUCCEEDED",
  FAILURE: "FEISHU_OAUTH_CALLBACK_FAILED",
  UNRESOLVED: "FEISHU_OAUTH_CALLBACK_UNRESOLVED",
  MISMATCH: "FEISHU_OAUTH_CALLBACK_MISMATCH",
} as const;

export const FEISHU_READONLY_INGEST_RESULT_STATUSES = {
  SUCCESS: "SUCCESS",
  PARTIAL: "PARTIAL",
  FAILURE: "FAILURE",
  UNRESOLVED: "UNRESOLVED",
} as const;

export const FEISHU_READONLY_INGEST_SCOPE_STATUSES = {
  INGESTED: "INGESTED",
  UNRESOLVED: "UNRESOLVED",
  FAILED: "FAILED",
} as const;

export const FEISHU_READONLY_INGEST_AUDIT_ACTIONS = {
  SUCCESS: "FEISHU_READONLY_INGEST_SUCCEEDED",
  PARTIAL: "FEISHU_READONLY_INGEST_PARTIAL",
  FAILURE: "FEISHU_READONLY_INGEST_FAILED",
  UNRESOLVED: "FEISHU_READONLY_INGEST_UNRESOLVED",
} as const;

export type FeishuCallbackResultStatus =
  (typeof FEISHU_CALLBACK_RESULT_STATUSES)[keyof typeof FEISHU_CALLBACK_RESULT_STATUSES];

export type FeishuCallbackFailurePosture =
  (typeof FEISHU_CALLBACK_FAILURE_POSTURES)[keyof typeof FEISHU_CALLBACK_FAILURE_POSTURES];

export type FeishuReadOnlyIngestResultStatus =
  (typeof FEISHU_READONLY_INGEST_RESULT_STATUSES)[keyof typeof FEISHU_READONLY_INGEST_RESULT_STATUSES];

export type FeishuReadOnlyIngestScopeStatus =
  (typeof FEISHU_READONLY_INGEST_SCOPE_STATUSES)[keyof typeof FEISHU_READONLY_INGEST_SCOPE_STATUSES];

export type FeishuReadOnlyScope = ReturnType<typeof getFeishuReadOnlyCoverage>[number];

export type FeishuAppAccessToken = {
  appAccessToken: string;
  expireInSeconds: number | null;
};

export type FeishuTenantAccessToken = {
  tenantAccessToken: string;
  expireInSeconds: number | null;
};

export type FeishuUserAccessToken = {
  accessToken: string;
  refreshToken: string | null;
  expireInSeconds: number | null;
  refreshExpireInSeconds: number | null;
  openId: string | null;
  unionId: string | null;
  tenantKey: string | null;
};

export type FeishuUserProfile = {
  email: string | null;
  mobile: string | null;
  nick: string | null;
  avatarUrl: string | null;
  openId: string | null;
  unionId: string | null;
  userId: string | null;
};

export type FeishuCallbackResult = {
  status: FeishuCallbackResultStatus;
  failurePosture: FeishuCallbackFailurePosture;
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
  tenantKey: string | null;
};

export type FeishuReadOnlyIngestScopeResult = {
  scope: FeishuReadOnlyScope;
  status: FeishuReadOnlyIngestScopeStatus;
  message: string | null;
  docUrl: string | null;
  persistedPayloadCount: number;
  ingestionRecordCount: number;
  handleCount: number;
  latestSourceId: string | null;
};

export type FeishuReadOnlyIngestResult = {
  status: FeishuReadOnlyIngestResultStatus;
  failurePosture: FeishuCallbackFailurePosture;
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
  scopeResults: FeishuReadOnlyIngestScopeResult[];
};

export type FeishuConnectorMetadata = {
  authMode: "oauth_callback_foundation";
  directorySyncMode: ReturnType<typeof getFeishuDirectorySyncMode>;
  readOnlyCoverage: Array<ReturnType<typeof getFeishuReadOnlyCoverage>[number]>;
  scopes: Array<(typeof FEISHU_OAUTH_SCOPES)[number]>;
  lastCallbackResult: FeishuCallbackResult | null;
  lastIngestResult: FeishuReadOnlyIngestResult | null;
  lastResolvedOpenId: string | null;
  lastResolvedUnionId: string | null;
  lastResolvedTenantKey: string | null;
};

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function assertFeishuOk(body: Record<string, unknown>, context: string) {
  const code = normalizeNumber(body.code) ?? 0;
  if (code !== 0) {
    throw new Error(`${context} failed: ${normalizeString(body.msg) ?? `code ${code}`}`);
  }
}

export function getFeishuStateCookieName() {
  return FEISHU_STATE_COOKIE;
}

export function getFeishuConfig() {
  const appUrl = process.env.APP_URL?.trim() || null;
  const redirectUri =
    process.env.FEISHU_REDIRECT_URI?.trim() ||
    (appUrl ? `${appUrl.replace(/\/$/, "")}${FEISHU_DEFAULT_REDIRECT_PATH}` : null);

  return {
    appId: process.env.FEISHU_APP_ID?.trim() || null,
    appSecret: process.env.FEISHU_APP_SECRET?.trim() || null,
    redirectUri,
  };
}

export function getFeishuBitableConfig() {
  const pageSize = Number(process.env.FEISHU_BITABLE_PAGE_SIZE);
  const maxPages = Number(process.env.FEISHU_BITABLE_MAX_PAGES);

  return {
    appToken: process.env.FEISHU_BITABLE_APP_TOKEN?.trim() || null,
    tableId: process.env.FEISHU_BITABLE_TABLE_ID?.trim() || null,
    viewId: process.env.FEISHU_BITABLE_VIEW_ID?.trim() || null,
    pageSize:
      Number.isFinite(pageSize) && pageSize > 0
        ? Math.min(100, Math.trunc(pageSize))
        : 100,
    maxPages:
      Number.isFinite(maxPages) && maxPages > 0
        ? Math.min(10, Math.trunc(maxPages))
        : 3,
  };
}

export function isFeishuOauthConfigured() {
  const config = getFeishuConfig();
  return Boolean(config.appId && config.appSecret && config.redirectUri);
}

export function isFeishuDirectorySyncConfigured() {
  const config = getFeishuConfig();
  return Boolean(config.appId && config.appSecret);
}

export function getFeishuDirectorySyncMode() {
  return "HELM_DIRECTORY_SYNC_ADAPTER" as const;
}

export function getFeishuReadOnlyCoverage() {
  return ["BITABLE"] as const;
}

export function isFeishuBitableConfigured() {
  const config = getFeishuBitableConfig();
  return Boolean(config.appToken && config.tableId);
}

export function buildFeishuAuthUrl(state: string) {
  const config = getFeishuConfig();

  if (!config.appId || !config.redirectUri) {
    throw new Error("Feishu OAuth 未配置");
  }

  const params = new URLSearchParams({
    client_id: config.appId,
    redirect_uri: config.redirectUri,
    scope: FEISHU_OAUTH_SCOPES.join(" "),
    state,
  });

  return `${FEISHU_OAUTH_AUTHORIZE_URL}?${params.toString()}`;
}

export async function fetchFeishuAppAccessToken() {
  const config = getFeishuConfig();

  if (!config.appId || !config.appSecret) {
    throw new Error("Feishu app access token config is incomplete");
  }

  const response = await fetch(FEISHU_APP_ACCESS_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      app_id: config.appId,
      app_secret: config.appSecret,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Feishu app access token failed: ${redactProviderErrorBody(body)}`);
  }

  const body = (await response.json()) as Record<string, unknown>;
  assertFeishuOk(body, "Feishu app access token");
  const appAccessToken =
    normalizeString(body.app_access_token) ?? normalizeString(body.appAccessToken);

  if (!appAccessToken) {
    throw new Error("Feishu app access token response returned no access token");
  }

  return {
    appAccessToken,
    expireInSeconds: normalizeNumber(body.expire) ?? normalizeNumber(body.expires_in),
  } satisfies FeishuAppAccessToken;
}

export async function fetchFeishuTenantAccessToken() {
  const config = getFeishuConfig();

  if (!config.appId || !config.appSecret) {
    throw new Error("Feishu tenant access token config is incomplete");
  }

  const response = await fetch(FEISHU_TENANT_ACCESS_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      app_id: config.appId,
      app_secret: config.appSecret,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Feishu tenant access token failed: ${redactProviderErrorBody(body)}`);
  }

  const body = (await response.json()) as Record<string, unknown>;
  assertFeishuOk(body, "Feishu tenant access token");
  const tenantAccessToken =
    normalizeString(body.tenant_access_token) ?? normalizeString(body.tenantAccessToken);

  if (!tenantAccessToken) {
    throw new Error("Feishu tenant access token response returned no access token");
  }

  return {
    tenantAccessToken,
    expireInSeconds: normalizeNumber(body.expire) ?? normalizeNumber(body.expires_in),
  } satisfies FeishuTenantAccessToken;
}

export async function exchangeFeishuAuthCode(code: string) {
  const config = getFeishuConfig();

  if (!config.redirectUri) {
    throw new Error("Feishu OAuth 未配置");
  }

  const appToken = await fetchFeishuAppAccessToken();
  const response = await fetch(FEISHU_USER_ACCESS_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${appToken.appAccessToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: config.redirectUri,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Feishu token exchange failed: ${redactProviderErrorBody(body)}`);
  }

  const body = (await response.json()) as Record<string, unknown>;
  assertFeishuOk(body, "Feishu token exchange");
  const data =
    body.data && typeof body.data === "object"
      ? (body.data as Record<string, unknown>)
      : body;
  const accessToken =
    normalizeString(data.access_token) ?? normalizeString(data.accessToken);

  if (!accessToken) {
    throw new Error("Feishu token exchange returned no access token");
  }

  return {
    accessToken,
    refreshToken:
      normalizeString(data.refresh_token) ?? normalizeString(data.refreshToken),
    expireInSeconds:
      normalizeNumber(data.expires_in) ?? normalizeNumber(data.expire_in),
    refreshExpireInSeconds:
      normalizeNumber(data.refresh_expires_in) ?? normalizeNumber(data.refreshExpireIn),
    openId: normalizeString(data.open_id) ?? normalizeString(data.openId),
    unionId: normalizeString(data.union_id) ?? normalizeString(data.unionId),
    tenantKey: normalizeString(data.tenant_key) ?? normalizeString(data.tenantKey),
  } satisfies FeishuUserAccessToken;
}

export async function fetchFeishuUserProfile(accessToken: string) {
  const response = await fetch(FEISHU_USER_INFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Feishu user info failed: ${redactProviderErrorBody(body)}`);
  }

  const body = (await response.json()) as Record<string, unknown>;
  assertFeishuOk(body, "Feishu user info");
  const data =
    body.data && typeof body.data === "object"
      ? (body.data as Record<string, unknown>)
      : body;

  return {
    email: normalizeString(data.email),
    mobile: normalizeString(data.mobile),
    nick:
      normalizeString(data.name) ??
      normalizeString(data.en_name) ??
      normalizeString(data.nickname),
    avatarUrl:
      normalizeString(data.avatar_url) ??
      normalizeString(data.avatarUrl) ??
      normalizeString(data.avatar),
    openId: normalizeString(data.open_id) ?? normalizeString(data.openId),
    unionId: normalizeString(data.union_id) ?? normalizeString(data.unionId),
    userId: normalizeString(data.user_id) ?? normalizeString(data.userId),
  } satisfies FeishuUserProfile;
}

export function buildFeishuCallbackResult(input: {
  status: FeishuCallbackResultStatus;
  failurePosture: FeishuCallbackFailurePosture;
  message?: string | null;
  profile?: FeishuUserProfile | null;
  matchedWorkspaceUserEmail?: string | null;
  tenantKey?: string | null;
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
    tenantKey: input.tenantKey?.trim() || null,
  } satisfies FeishuCallbackResult;
}

function buildBaseFeishuMetadata(): Omit<
  FeishuConnectorMetadata,
  | "lastCallbackResult"
  | "lastIngestResult"
  | "lastResolvedOpenId"
  | "lastResolvedUnionId"
  | "lastResolvedTenantKey"
> {
  return {
    authMode: "oauth_callback_foundation",
    directorySyncMode: getFeishuDirectorySyncMode(),
    readOnlyCoverage: [...getFeishuReadOnlyCoverage()],
    scopes: [...FEISHU_OAUTH_SCOPES],
  };
}

export function parseFeishuConnectorMetadata(metadata?: string | null) {
  const parsed = safeParseJson<Partial<FeishuConnectorMetadata> | null>(metadata, null);
  const base = buildBaseFeishuMetadata();

  return {
    ...base,
    ...parsed,
    authMode: "oauth_callback_foundation",
    directorySyncMode: getFeishuDirectorySyncMode(),
    readOnlyCoverage: [...getFeishuReadOnlyCoverage()],
    scopes: [...FEISHU_OAUTH_SCOPES],
    lastCallbackResult:
      parsed?.lastCallbackResult && typeof parsed.lastCallbackResult === "object"
        ? parsed.lastCallbackResult
        : null,
    lastIngestResult:
      parsed?.lastIngestResult && typeof parsed.lastIngestResult === "object"
        ? parsed.lastIngestResult
        : null,
    lastResolvedOpenId: normalizeString(parsed?.lastResolvedOpenId),
    lastResolvedUnionId: normalizeString(parsed?.lastResolvedUnionId),
    lastResolvedTenantKey: normalizeString(parsed?.lastResolvedTenantKey),
  } satisfies FeishuConnectorMetadata;
}

export async function persistFeishuConnectorCallbackResult(input: {
  workspaceId: string;
  userId: string;
  connectorStatus: ConnectorStatus;
  externalAccountEmail?: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  expireInSeconds?: number | null;
  lastSyncStatus: string;
  lastSyncMessage?: string | null;
  callbackResult: FeishuCallbackResult;
}) {
  const existing = await db.connector.findUnique({
    where: {
      workspaceId_userId_provider: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        provider: ConnectorProvider.FEISHU,
      },
    },
  });
  const existingMetadata = parseFeishuConnectorMetadata(existing?.metadata);
  const nextMetadata: FeishuConnectorMetadata = {
    ...existingMetadata,
    lastCallbackResult: input.callbackResult,
    lastIngestResult: existingMetadata.lastIngestResult,
    lastResolvedOpenId: input.callbackResult.providerOpenId,
    lastResolvedUnionId: input.callbackResult.providerUnionId,
    lastResolvedTenantKey: input.callbackResult.tenantKey,
  };
  const tokenExpiresAt = input.expireInSeconds
    ? new Date(Date.now() + input.expireInSeconds * 1000)
    : null;

  return db.connector.upsert({
    where: {
      workspaceId_userId_provider: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        provider: ConnectorProvider.FEISHU,
      },
    },
    create: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      provider: ConnectorProvider.FEISHU,
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

export async function persistFeishuConnectorIngestResult(input: {
  workspaceId: string;
  userId: string;
  connectorStatus: ConnectorStatus;
  lastSyncStatus: string;
  lastSyncMessage?: string | null;
  ingestResult: FeishuReadOnlyIngestResult;
}) {
  const existing = await db.connector.findUnique({
    where: {
      workspaceId_userId_provider: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        provider: ConnectorProvider.FEISHU,
      },
    },
  });

  if (!existing) {
    throw new Error("当前还没有飞书连接，请先完成 Feishu OAuth callback。");
  }

  const existingMetadata = parseFeishuConnectorMetadata(existing.metadata);
  const nextMetadata: FeishuConnectorMetadata = {
    ...existingMetadata,
    lastIngestResult: input.ingestResult,
  };

  return db.connector.update({
    where: { id: existing.id },
    data: {
      status: input.connectorStatus,
      lastSyncedAt: new Date(),
      lastSyncStatus: input.lastSyncStatus,
      lastSyncMessage: input.lastSyncMessage ?? null,
      metadata: JSON.stringify(nextMetadata),
    },
  });
}
