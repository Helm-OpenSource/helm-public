import { ConnectorProvider, ConnectorStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { redactProviderErrorBody } from "@/lib/connectors/error-redaction";
import { readConnectorToken, storeConnectorToken } from "@/lib/connectors/token-store";
import { safeParseJson } from "@/lib/utils";

const WECOM_STATE_COOKIE = "helm-wecom-oauth-state";
const WECOM_DEFAULT_REDIRECT_PATH = "/api/auth/wecom/callback";
const WECOM_OAUTH_AUTHORIZE_URL = "https://open.weixin.qq.com/connect/oauth2/authorize";
const WECOM_CORP_ACCESS_TOKEN_URL = "https://qyapi.weixin.qq.com/cgi-bin/gettoken";
const WECOM_OAUTH_USER_INFO_URL = "https://qyapi.weixin.qq.com/cgi-bin/user/getuserinfo";
const WECOM_USER_DETAIL_URL = "https://qyapi.weixin.qq.com/cgi-bin/user/get";
const WECOM_CALENDAR_DETAIL_URL = "https://qyapi.weixin.qq.com/cgi-bin/oa/calendar/get";
const WECOM_OAUTH_SCOPE = "snsapi_base";
const WECOM_CALENDAR_DETAIL_DOC_URL =
  "https://developer.work.weixin.qq.com/document/path/97717";

export const WECOM_OAUTH_CALLBACK_SOURCE_PAGE = "/api/auth/wecom/callback";

export const WECOM_CALLBACK_RESULT_STATUSES = {
  SUCCESS: "SUCCESS",
  FAILURE: "FAILURE",
  UNRESOLVED: "UNRESOLVED",
  MISMATCH: "MISMATCH",
} as const;

export const WECOM_CALLBACK_FAILURE_POSTURES = {
  CLEAR: "CLEAR",
  RETRYABLE: "RETRYABLE",
  REVIEW_REQUIRED: "REVIEW_REQUIRED",
} as const;

export const WECOM_OAUTH_CALLBACK_AUDIT_ACTIONS = {
  SUCCESS: "WECOM_OAUTH_CALLBACK_SUCCEEDED",
  FAILURE: "WECOM_OAUTH_CALLBACK_FAILED",
  UNRESOLVED: "WECOM_OAUTH_CALLBACK_UNRESOLVED",
  MISMATCH: "WECOM_OAUTH_CALLBACK_MISMATCH",
} as const;

export const WECOM_READONLY_INGEST_RESULT_STATUSES = {
  SUCCESS: "SUCCESS",
  PARTIAL: "PARTIAL",
  FAILURE: "FAILURE",
  UNRESOLVED: "UNRESOLVED",
} as const;

export const WECOM_READONLY_INGEST_SCOPE_STATUSES = {
  INGESTED: "INGESTED",
  UNRESOLVED: "UNRESOLVED",
  FAILED: "FAILED",
} as const;

export const WECOM_READONLY_INGEST_AUDIT_ACTIONS = {
  SUCCESS: "WECOM_READONLY_INGEST_SUCCEEDED",
  PARTIAL: "WECOM_READONLY_INGEST_PARTIAL",
  FAILURE: "WECOM_READONLY_INGEST_FAILED",
  UNRESOLVED: "WECOM_READONLY_INGEST_UNRESOLVED",
} as const;

export const WECOM_CALENDAR_REGISTRY_RESULT_STATUSES = {
  SUCCESS: "SUCCESS",
  PARTIAL: "PARTIAL",
  FAILURE: "FAILURE",
  UNRESOLVED: "UNRESOLVED",
} as const;

export const WECOM_CALENDAR_REGISTRY_AUDIT_ACTIONS = {
  SUCCESS: "WECOM_CALENDAR_REGISTRY_VALIDATED",
  PARTIAL: "WECOM_CALENDAR_REGISTRY_PARTIAL",
  FAILURE: "WECOM_CALENDAR_REGISTRY_FAILED",
  UNRESOLVED: "WECOM_CALENDAR_REGISTRY_UNRESOLVED",
} as const;

export type WeComCallbackResultStatus =
  (typeof WECOM_CALLBACK_RESULT_STATUSES)[keyof typeof WECOM_CALLBACK_RESULT_STATUSES];

export type WeComCallbackFailurePosture =
  (typeof WECOM_CALLBACK_FAILURE_POSTURES)[keyof typeof WECOM_CALLBACK_FAILURE_POSTURES];

export type WeComReadOnlyIngestResultStatus =
  (typeof WECOM_READONLY_INGEST_RESULT_STATUSES)[keyof typeof WECOM_READONLY_INGEST_RESULT_STATUSES];

export type WeComReadOnlyIngestScopeStatus =
  (typeof WECOM_READONLY_INGEST_SCOPE_STATUSES)[keyof typeof WECOM_READONLY_INGEST_SCOPE_STATUSES];

export type WeComReadOnlyScope = ReturnType<typeof getWeComReadOnlyCoverage>[number];

export type WeComCalendarRegistryResultStatus =
  (typeof WECOM_CALENDAR_REGISTRY_RESULT_STATUSES)[keyof typeof WECOM_CALENDAR_REGISTRY_RESULT_STATUSES];

export type WeComCorpAccessToken = {
  accessToken: string;
  expireInSeconds: number | null;
  corpId: string | null;
};

export type WeComAuthorizedIdentity = {
  accessToken: string;
  expireInSeconds: number | null;
  corpId: string | null;
  userId: string | null;
  openId: string | null;
  externalUserId: string | null;
  deviceId: string | null;
};

export type WeComUserProfile = {
  email: string | null;
  mobile: string | null;
  nick: string | null;
  avatarUrl: string | null;
  openId: string | null;
  unionId: string | null;
  userId: string | null;
};

export type WeComCallbackResult = {
  status: WeComCallbackResultStatus;
  failurePosture: WeComCallbackFailurePosture;
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

export type WeComReadOnlyIngestScopeResult = {
  scope: WeComReadOnlyScope;
  status: WeComReadOnlyIngestScopeStatus;
  message: string | null;
  docUrl: string | null;
  persistedPayloadCount: number;
  ingestionRecordCount: number;
  handleCount: number;
  latestSourceId: string | null;
};

export type WeComReadOnlyIngestResult = {
  status: WeComReadOnlyIngestResultStatus;
  failurePosture: WeComCallbackFailurePosture;
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
  scopeResults: WeComReadOnlyIngestScopeResult[];
};

export type WeComCalendarRegistryEntry = {
  calendarId: string;
  calendarName: string | null;
  ownerUserId: string | null;
  recordedAt: string;
  sourcePage: string | null;
  docUrl: string | null;
};

export type WeComCalendarRegistryValidationResult = {
  status: WeComCalendarRegistryResultStatus;
  failurePosture: WeComCallbackFailurePosture;
  recordedAt: string;
  sourcePage: string | null;
  message: string | null;
  requestedCalendarCount: number;
  verifiedCalendarCount: number;
  failedCalendarCount: number;
  latestVerifiedCalendarId: string | null;
  docUrl: string | null;
};

export type WeComCalendarRegistry = {
  boundCalendars: WeComCalendarRegistryEntry[];
  lastValidationResult: WeComCalendarRegistryValidationResult | null;
};

export type WeComConnectorMetadata = {
  authMode: "oauth_callback_foundation";
  directorySyncMode: ReturnType<typeof getWeComDirectorySyncMode>;
  readOnlyCoverage: Array<ReturnType<typeof getWeComReadOnlyCoverage>[number]>;
  scopes: string[];
  lastCallbackResult: WeComCallbackResult | null;
  lastIngestResult: WeComReadOnlyIngestResult | null;
  lastResolvedCorpId: string | null;
  lastResolvedOpenId: string | null;
  lastResolvedUserId: string | null;
  calendarRegistry: WeComCalendarRegistry;
};

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getErrorCode(body: Record<string, unknown>) {
  return normalizeNumber(body.errcode) ?? normalizeNumber(body.errCode) ?? 0;
}

function getErrorMessage(body: Record<string, unknown>) {
  return normalizeString(body.errmsg) ?? normalizeString(body.errMsg);
}

function assertWeComOk(body: Record<string, unknown>, context: string) {
  const errorCode = getErrorCode(body);

  if (errorCode !== 0) {
    throw new Error(`${context} failed: ${getErrorMessage(body) ?? `errcode ${errorCode}`}`);
  }
}

function buildBaseWeComMetadata(): Omit<
  WeComConnectorMetadata,
  | "lastCallbackResult"
  | "lastIngestResult"
  | "lastResolvedCorpId"
  | "lastResolvedOpenId"
  | "lastResolvedUserId"
> {
  return {
    authMode: "oauth_callback_foundation",
    directorySyncMode: getWeComDirectorySyncMode(),
    readOnlyCoverage: [...getWeComReadOnlyCoverage()],
    scopes: [WECOM_OAUTH_SCOPE],
    calendarRegistry: {
      boundCalendars: [],
      lastValidationResult: null,
    },
  };
}

function normalizeCalendarRegistryEntry(
  value: unknown,
): WeComCalendarRegistryEntry | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const calendarId =
    normalizeString(record.calendarId) ??
    normalizeString(record.calId) ??
    normalizeString(record.calendar_id);

  if (!calendarId) {
    return null;
  }

  return {
    calendarId,
    calendarName:
      normalizeString(record.calendarName) ??
      normalizeString(record.summary) ??
      normalizeString(record.name),
    ownerUserId:
      normalizeString(record.ownerUserId) ??
      normalizeString(record.creator) ??
      normalizeString(record.admin_userid),
    recordedAt: normalizeString(record.recordedAt) ?? new Date().toISOString(),
    sourcePage: normalizeString(record.sourcePage),
    docUrl: normalizeString(record.docUrl) ?? WECOM_CALENDAR_DETAIL_DOC_URL,
  };
}

function normalizeCalendarRegistryValidationResult(
  value: unknown,
): WeComCalendarRegistryValidationResult | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const status = normalizeString(record.status);

  if (
    status !== WECOM_CALENDAR_REGISTRY_RESULT_STATUSES.SUCCESS &&
    status !== WECOM_CALENDAR_REGISTRY_RESULT_STATUSES.PARTIAL &&
    status !== WECOM_CALENDAR_REGISTRY_RESULT_STATUSES.FAILURE &&
    status !== WECOM_CALENDAR_REGISTRY_RESULT_STATUSES.UNRESOLVED
  ) {
    return null;
  }

  return {
    status,
    failurePosture:
      normalizeString(record.failurePosture) === WECOM_CALLBACK_FAILURE_POSTURES.CLEAR
        ? WECOM_CALLBACK_FAILURE_POSTURES.CLEAR
        : normalizeString(record.failurePosture) === WECOM_CALLBACK_FAILURE_POSTURES.RETRYABLE
          ? WECOM_CALLBACK_FAILURE_POSTURES.RETRYABLE
          : WECOM_CALLBACK_FAILURE_POSTURES.REVIEW_REQUIRED,
    recordedAt: normalizeString(record.recordedAt) ?? new Date().toISOString(),
    sourcePage: normalizeString(record.sourcePage),
    message: normalizeString(record.message),
    requestedCalendarCount: normalizeNumber(record.requestedCalendarCount) ?? 0,
    verifiedCalendarCount: normalizeNumber(record.verifiedCalendarCount) ?? 0,
    failedCalendarCount: normalizeNumber(record.failedCalendarCount) ?? 0,
    latestVerifiedCalendarId: normalizeString(record.latestVerifiedCalendarId),
    docUrl: normalizeString(record.docUrl) ?? WECOM_CALENDAR_DETAIL_DOC_URL,
  };
}

function buildWeComCalendarRegistryValidationResult(input: {
  status: WeComCalendarRegistryResultStatus;
  failurePosture: WeComCallbackFailurePosture;
  sourcePage?: string | null;
  message?: string | null;
  requestedCalendarCount: number;
  verifiedCalendarCount: number;
  failedCalendarCount: number;
  latestVerifiedCalendarId?: string | null;
  recordedAt?: Date;
}) {
  return {
    status: input.status,
    failurePosture: input.failurePosture,
    recordedAt: (input.recordedAt ?? new Date()).toISOString(),
    sourcePage: input.sourcePage?.trim() || null,
    message: input.message?.trim() || null,
    requestedCalendarCount: input.requestedCalendarCount,
    verifiedCalendarCount: input.verifiedCalendarCount,
    failedCalendarCount: input.failedCalendarCount,
    latestVerifiedCalendarId: input.latestVerifiedCalendarId?.trim() || null,
    docUrl: WECOM_CALENDAR_DETAIL_DOC_URL,
  } satisfies WeComCalendarRegistryValidationResult;
}

function parseWeComCalendarIds(input: string) {
  return Array.from(
    new Set(
      input
        .split(/[\n,]/)
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

async function fetchWeComCalendarDetail(input: {
  accessToken: string;
  calendarId: string;
}) {
  const url = new URL(WECOM_CALENDAR_DETAIL_URL);
  url.searchParams.set("access_token", input.accessToken);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      cal_id: input.calendarId,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`WeCom calendar detail failed: ${redactProviderErrorBody(body)}`);
  }

  const body = (await response.json()) as Record<string, unknown>;
  assertWeComOk(body, "WeCom calendar detail");

  const calendar =
    (body.calendar as Record<string, unknown> | undefined) ??
    (body.calendar_info as Record<string, unknown> | undefined) ??
    body;

  return {
    requestUrl: url.toString(),
    calendarId:
      normalizeString(calendar.cal_id) ??
      normalizeString(calendar.calendar_id) ??
      normalizeString(calendar.calId) ??
      input.calendarId,
    calendarName:
      normalizeString(calendar.summary) ??
      normalizeString(calendar.name) ??
      normalizeString(calendar.calendar_name),
    ownerUserId:
      normalizeString(calendar.creator) ??
      normalizeString(calendar.admin_userid) ??
      normalizeString(calendar.owner_userid),
  };
}

export function getWeComStateCookieName() {
  return WECOM_STATE_COOKIE;
}

export function getWeComConfig() {
  const appUrl = process.env.APP_URL?.trim() || null;
  const redirectUri =
    process.env.WECOM_REDIRECT_URI?.trim() ||
    (appUrl ? `${appUrl.replace(/\/$/, "")}${WECOM_DEFAULT_REDIRECT_PATH}` : null);

  return {
    clientId: process.env.WECOM_CLIENT_ID?.trim() || null,
    clientSecret: process.env.WECOM_CLIENT_SECRET?.trim() || null,
    redirectUri,
  };
}

export function isWeComOauthConfigured() {
  const config = getWeComConfig();
  return Boolean(config.clientId && config.clientSecret && config.redirectUri);
}

export function isWeComDirectorySyncConfigured() {
  const config = getWeComConfig();
  return Boolean(config.clientId && config.clientSecret);
}

export function getWeComDirectorySyncMode() {
  return "HELM_DIRECTORY_SYNC_ADAPTER" as const;
}

export function getWeComReadOnlyCoverage() {
  return ["MEETINGS", "CALENDAR", "MESSAGE_NOTIFICATIONS"] as const;
}

export function buildWeComAuthUrl(state: string) {
  const config = getWeComConfig();

  if (!config.clientId || !config.redirectUri) {
    throw new Error("WeCom OAuth 未配置");
  }

  const params = new URLSearchParams({
    appid: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: WECOM_OAUTH_SCOPE,
    state,
  });

  return `${WECOM_OAUTH_AUTHORIZE_URL}?${params.toString()}#wechat_redirect`;
}

async function fetchWeComCorpAccessToken() {
  const config = getWeComConfig();

  if (!config.clientId || !config.clientSecret) {
    throw new Error("WeCom OAuth 未配置");
  }

  const url = new URL(WECOM_CORP_ACCESS_TOKEN_URL);
  url.searchParams.set("corpid", config.clientId);
  url.searchParams.set("corpsecret", config.clientSecret);

  const response = await fetch(url.toString(), {
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`WeCom access token failed: ${redactProviderErrorBody(body)}`);
  }

  const body = (await response.json()) as Record<string, unknown>;
  assertWeComOk(body, "WeCom access token");

  const accessToken =
    normalizeString(body.access_token) ?? normalizeString(body.accessToken);

  if (!accessToken) {
    throw new Error("WeCom access token response returned no access token");
  }

  return {
    accessToken,
    expireInSeconds:
      normalizeNumber(body.expires_in) ??
      normalizeNumber(body.expiresIn) ??
      normalizeNumber(body.expireIn),
    corpId: config.clientId,
  } satisfies WeComCorpAccessToken;
}

export async function exchangeWeComAuthCode(code: string) {
  const token = await fetchWeComCorpAccessToken();
  const url = new URL(WECOM_OAUTH_USER_INFO_URL);
  url.searchParams.set("access_token", token.accessToken);
  url.searchParams.set("code", code);

  const response = await fetch(url.toString(), {
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`WeCom oauth userinfo failed: ${redactProviderErrorBody(body)}`);
  }

  const body = (await response.json()) as Record<string, unknown>;
  assertWeComOk(body, "WeCom oauth userinfo");

  return {
    accessToken: token.accessToken,
    expireInSeconds: token.expireInSeconds,
    corpId: token.corpId,
    userId: normalizeString(body.UserId) ?? normalizeString(body.userid),
    openId: normalizeString(body.OpenId) ?? normalizeString(body.openid),
    externalUserId:
      normalizeString(body.external_userid) ?? normalizeString(body.externalUserId),
    deviceId:
      normalizeString(body.deviceid) ??
      normalizeString(body.deviceId) ??
      normalizeString(body.DeviceId),
  } satisfies WeComAuthorizedIdentity;
}

export async function fetchWeComUserProfile(input: {
  accessToken: string;
  userId: string | null;
  openId?: string | null;
}) {
  if (!input.userId) {
    return {
      email: null,
      mobile: null,
      nick: null,
      avatarUrl: null,
      openId: input.openId ?? null,
      unionId: null,
      userId: null,
    } satisfies WeComUserProfile;
  }

  const url = new URL(WECOM_USER_DETAIL_URL);
  url.searchParams.set("access_token", input.accessToken);
  url.searchParams.set("userid", input.userId);

  const response = await fetch(url.toString(), {
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`WeCom user profile failed: ${redactProviderErrorBody(body)}`);
  }

  const body = (await response.json()) as Record<string, unknown>;
  assertWeComOk(body, "WeCom user profile");

  return {
    email: normalizeString(body.email) ?? normalizeString(body.biz_mail),
    mobile: normalizeString(body.mobile),
    nick: normalizeString(body.name),
    avatarUrl: normalizeString(body.avatar),
    openId: input.openId ?? null,
    unionId: null,
    userId: normalizeString(body.userid) ?? input.userId,
  } satisfies WeComUserProfile;
}

export function buildWeComCallbackResult(input: {
  status: WeComCallbackResultStatus;
  failurePosture: WeComCallbackFailurePosture;
  message?: string | null;
  profile?: WeComUserProfile | null;
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
  } satisfies WeComCallbackResult;
}

export function parseWeComConnectorMetadata(metadata?: string | null) {
  const parsed = safeParseJson<Partial<WeComConnectorMetadata> | null>(metadata, null);
  const base = buildBaseWeComMetadata();
  const parsedCalendarRegistry =
    parsed?.calendarRegistry && typeof parsed.calendarRegistry === "object"
      ? parsed.calendarRegistry
      : null;

  return {
    ...base,
    ...parsed,
    authMode: "oauth_callback_foundation" as const,
    directorySyncMode: getWeComDirectorySyncMode(),
    readOnlyCoverage: [...getWeComReadOnlyCoverage()],
    scopes: [WECOM_OAUTH_SCOPE],
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
    lastResolvedUserId: normalizeString(parsed?.lastResolvedUserId),
    calendarRegistry: {
      boundCalendars: Array.isArray(parsedCalendarRegistry?.boundCalendars)
        ? parsedCalendarRegistry.boundCalendars
            .map((entry) => normalizeCalendarRegistryEntry(entry))
            .filter((entry): entry is WeComCalendarRegistryEntry => Boolean(entry))
        : [],
      lastValidationResult: normalizeCalendarRegistryValidationResult(
        parsedCalendarRegistry?.lastValidationResult,
      ),
    },
  } satisfies WeComConnectorMetadata;
}

export async function persistWeComConnectorCallbackResult(input: {
  workspaceId: string;
  userId: string;
  connectorStatus: ConnectorStatus;
  externalAccountEmail?: string | null;
  accessToken?: string | null;
  expireInSeconds?: number | null;
  lastSyncStatus: string;
  lastSyncMessage?: string | null;
  callbackResult: WeComCallbackResult;
}) {
  const existing = await db.connector.findUnique({
    where: {
      workspaceId_userId_provider: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        provider: ConnectorProvider.WECOM,
      },
    },
  });
  const existingMetadata = parseWeComConnectorMetadata(existing?.metadata);
  const nextMetadata: WeComConnectorMetadata = {
    ...existingMetadata,
    lastCallbackResult: input.callbackResult,
    lastIngestResult: existingMetadata.lastIngestResult,
    lastResolvedCorpId: input.callbackResult.corpId,
    lastResolvedOpenId: input.callbackResult.providerOpenId,
    lastResolvedUserId: input.callbackResult.providerUserId,
  };
  const tokenExpiresAt = input.expireInSeconds
    ? new Date(Date.now() + input.expireInSeconds * 1000)
    : null;

  return db.connector.upsert({
    where: {
      workspaceId_userId_provider: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        provider: ConnectorProvider.WECOM,
      },
    },
    create: {
      workspaceId: input.workspaceId,
      userId: input.userId,
      provider: ConnectorProvider.WECOM,
      status: input.connectorStatus,
      externalAccountEmail: input.externalAccountEmail ?? undefined,
      accessToken:
        input.connectorStatus === ConnectorStatus.CONNECTED
          ? storeConnectorToken(input.accessToken)
          : null,
      refreshToken: null,
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
      refreshToken: null,
      tokenExpiresAt: input.connectorStatus === ConnectorStatus.CONNECTED ? tokenExpiresAt : null,
      lastSyncStatus: input.lastSyncStatus,
      lastSyncMessage: input.lastSyncMessage ?? null,
      metadata: JSON.stringify(nextMetadata),
    },
  });
}

export async function persistWeComConnectorIngestResult(input: {
  workspaceId: string;
  userId: string;
  connectorStatus: ConnectorStatus;
  lastSyncStatus: string;
  lastSyncMessage?: string | null;
  ingestResult: WeComReadOnlyIngestResult;
}) {
  const existing = await db.connector.findUnique({
    where: {
      workspaceId_userId_provider: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        provider: ConnectorProvider.WECOM,
      },
    },
  });

  if (!existing) {
    throw new Error("当前还没有企业微信连接，请先完成 WeCom OAuth callback。");
  }

  const existingMetadata = parseWeComConnectorMetadata(existing.metadata);
  const nextMetadata: WeComConnectorMetadata = {
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

export async function validateAndPersistWeComCalendarRegistry(input: {
  workspaceId: string;
  userId: string;
  calendarIdsText: string;
  english: boolean;
  sourcePage?: string | null;
}) {
  const connector = await db.connector.findUnique({
    where: {
      workspaceId_userId_provider: {
        workspaceId: input.workspaceId,
        userId: input.userId,
        provider: ConnectorProvider.WECOM,
      },
    },
  });

  if (!connector) {
    throw new Error(
      input.english
        ? "No WeCom connector is available yet. Complete WeCom OAuth callback first."
        : "当前还没有可用的企业微信连接，请先完成 WeCom OAuth callback。",
    );
  }

  const requestedCalendarIds = parseWeComCalendarIds(input.calendarIdsText);
  if (requestedCalendarIds.length === 0) {
    throw new Error(
      input.english
        ? "Enter at least one WeCom calendar id (`cal_id`)."
        : "请至少填写一个企业微信日历 ID（`cal_id`）。",
    );
  }

  const existingMetadata = parseWeComConnectorMetadata(connector.metadata);
  const sourcePage = input.sourcePage?.trim() || "/settings";
  const accessToken = readConnectorToken(connector.accessToken);

  if (!accessToken) {
    const validationResult = buildWeComCalendarRegistryValidationResult({
      status: WECOM_CALENDAR_REGISTRY_RESULT_STATUSES.UNRESOLVED,
      failurePosture: WECOM_CALLBACK_FAILURE_POSTURES.REVIEW_REQUIRED,
      sourcePage,
      message: input.english
        ? "WeCom calendar registry remains unresolved because callback metadata does not yet expose a usable access token."
        : "企业微信日历注册表仍未解析，因为 callback metadata 还没有可用的 access token。",
      requestedCalendarCount: requestedCalendarIds.length,
      verifiedCalendarCount: existingMetadata.calendarRegistry.boundCalendars.length,
      failedCalendarCount: requestedCalendarIds.length,
      latestVerifiedCalendarId: existingMetadata.calendarRegistry.boundCalendars[0]?.calendarId ?? null,
    });

    const nextMetadata: WeComConnectorMetadata = {
      ...existingMetadata,
      calendarRegistry: {
        ...existingMetadata.calendarRegistry,
        lastValidationResult: validationResult,
      },
    };

    const updatedConnector = await db.connector.update({
      where: { id: connector.id },
      data: {
        lastSyncedAt: new Date(),
        lastSyncStatus: input.english ? "Registry unresolved" : "注册表未解析",
        lastSyncMessage: validationResult.message,
        metadata: JSON.stringify(nextMetadata),
      },
    });

    return {
      connectorId: updatedConnector.id,
      status: validationResult.status,
      validationResult,
      boundCalendars: nextMetadata.calendarRegistry.boundCalendars,
    };
  }

  const verifiedCalendars: WeComCalendarRegistryEntry[] = [];
  const failedCalendarIds: string[] = [];

  for (const calendarId of requestedCalendarIds) {
    try {
      const detail = await fetchWeComCalendarDetail({
        accessToken,
        calendarId,
      });

      verifiedCalendars.push({
        calendarId: detail.calendarId,
        calendarName: detail.calendarName,
        ownerUserId: detail.ownerUserId,
        recordedAt: new Date().toISOString(),
        sourcePage,
        docUrl: WECOM_CALENDAR_DETAIL_DOC_URL,
      });
    } catch {
      failedCalendarIds.push(calendarId);
    }
  }

  const status =
    verifiedCalendars.length === requestedCalendarIds.length
      ? WECOM_CALENDAR_REGISTRY_RESULT_STATUSES.SUCCESS
      : verifiedCalendars.length > 0
        ? WECOM_CALENDAR_REGISTRY_RESULT_STATUSES.PARTIAL
        : WECOM_CALENDAR_REGISTRY_RESULT_STATUSES.FAILURE;

  const validationResult = buildWeComCalendarRegistryValidationResult({
    status,
    failurePosture:
      status === WECOM_CALENDAR_REGISTRY_RESULT_STATUSES.SUCCESS
        ? WECOM_CALLBACK_FAILURE_POSTURES.CLEAR
        : status === WECOM_CALENDAR_REGISTRY_RESULT_STATUSES.PARTIAL
          ? WECOM_CALLBACK_FAILURE_POSTURES.REVIEW_REQUIRED
          : WECOM_CALLBACK_FAILURE_POSTURES.RETRYABLE,
    sourcePage,
    message:
      status === WECOM_CALENDAR_REGISTRY_RESULT_STATUSES.SUCCESS
        ? input.english
          ? `WeCom calendar registry validated for ${verifiedCalendars.length} calendars.`
          : `企业微信日历注册表校验完成，已绑定 ${verifiedCalendars.length} 个日历。`
        : status === WECOM_CALENDAR_REGISTRY_RESULT_STATUSES.PARTIAL
          ? input.english
            ? `WeCom calendar registry validated ${verifiedCalendars.length} of ${requestedCalendarIds.length} calendars. Review the failed calendar ids and revalidate.`
            : `企业微信日历注册表已校验 ${verifiedCalendars.length}/${requestedCalendarIds.length} 个日历。请复核失败的 calendar id 后重新校验。`
          : input.english
            ? "WeCom calendar registry validation failed for every requested calendar id."
            : "企业微信日历注册表校验失败，当前填写的 calendar id 全部未通过。",
    requestedCalendarCount: requestedCalendarIds.length,
    verifiedCalendarCount: verifiedCalendars.length,
    failedCalendarCount: failedCalendarIds.length,
    latestVerifiedCalendarId: verifiedCalendars[0]?.calendarId ?? null,
  });

  const nextMetadata: WeComConnectorMetadata = {
    ...existingMetadata,
    calendarRegistry: {
      boundCalendars: verifiedCalendars,
      lastValidationResult: validationResult,
    },
  };

  const updatedConnector = await db.connector.update({
    where: { id: connector.id },
    data: {
      lastSyncedAt: new Date(),
      lastSyncStatus:
        status === WECOM_CALENDAR_REGISTRY_RESULT_STATUSES.SUCCESS
          ? input.english
            ? "Registry ready"
            : "注册表已就绪"
          : status === WECOM_CALENDAR_REGISTRY_RESULT_STATUSES.PARTIAL
            ? input.english
              ? "Registry partial"
              : "注册表部分完成"
            : input.english
              ? "Registry failed"
              : "注册表失败",
      lastSyncMessage: validationResult.message,
      metadata: JSON.stringify(nextMetadata),
    },
  });

  return {
    connectorId: updatedConnector.id,
    status: validationResult.status,
    validationResult,
    boundCalendars: verifiedCalendars,
    failedCalendarIds,
  };
}
