import {
  ConnectorProvider,
  ConnectorStatus,
  RuntimeEventStatus,
} from "@prisma/client";
import { db } from "@/lib/db";
import { redactProviderErrorBody } from "@/lib/connectors/error-redaction";
import {
  WECOM_CALLBACK_FAILURE_POSTURES,
  WECOM_READONLY_INGEST_RESULT_STATUSES,
  WECOM_READONLY_INGEST_SCOPE_STATUSES,
  type WeComCallbackFailurePosture,
  type WeComReadOnlyIngestResult,
  type WeComReadOnlyIngestResultStatus,
  type WeComReadOnlyIngestScopeResult,
  type WeComReadOnlyScope,
  parseWeComConnectorMetadata,
  persistWeComConnectorIngestResult,
} from "@/lib/connectors/wecom";
import { readConnectorToken } from "@/lib/connectors/token-store";
import {
  buildPersistedPayloadDraft,
  toPersistedPayloadContract,
} from "@/lib/helm-v2/runtime-upgrade";
import { jsonStringify, trimText } from "@/lib/utils";

const WECOM_CALENDAR_GET_DOC_URL =
  "https://developer.work.weixin.qq.com/document/path/97717";
const WECOM_CALENDAR_SCHEDULE_LIST_DOC_URL =
  "https://developer.work.weixin.qq.com/document/path/97723";
const WECOM_CALENDAR_SCHEDULE_GET_DOC_URL =
  "https://developer.work.weixin.qq.com/document/path/97724";
const WECOM_MEETING_ID_LIST_DOC_URL =
  "https://developer.work.weixin.qq.com/document/path/99050";
const WECOM_MEETING_INFO_DOC_URL =
  "https://developer.work.weixin.qq.com/document/path/98149";
const WECOM_MESSAGE_NOTIFICATION_NOTE =
  "Official WeCom read-side contract for message notifications is not verified in current repo truth.";
const WECOM_READONLY_INGEST_SOURCE_PAGE = "/settings";
const WECOM_READONLY_INGEST_BOUNDARY_NOTE =
  "WeCom read-only ingest stays workspace-scoped and review-first: only contract-verified read paths may write runtime traces, and unresolved provider scopes remain explicit instead of being guessed.";
const WECOM_MEETING_ID_LIST_URL =
  "https://qyapi.weixin.qq.com/cgi-bin/meeting/get_user_meetingid";
const WECOM_MEETING_INFO_URL =
  "https://qyapi.weixin.qq.com/cgi-bin/meeting/get_info";
const WECOM_WINDOW_LOOKBACK_DAYS = 7;
const WECOM_WINDOW_LOOKAHEAD_DAYS = 30;
const WECOM_MEETING_MAX_RESULTS = 20;

type WeComMeetingIdListResponse = {
  next_cursor?: string | null;
  meetingid_list?: string[] | null;
};

type WeComMeetingAttendee = {
  userid?: string | null;
  meeting_alias?: string | null;
  response_status?: number | null;
};

type WeComMeetingInfoResponse = {
  admin_userid?: string | null;
  title?: string | null;
  meeting_start?: number | null;
  meeting_duration?: number | null;
  description?: string | null;
  location?: string | null;
  status?: number | null;
  meeting_type?: number | null;
  attendees?: WeComMeetingAttendee[] | null;
};

export type WeComNormalizedSourcePayload = {
  scope: "MEETINGS";
  sourceType: "meeting";
  sourceId: string;
  label: string;
  handle: string;
  preview: string;
  summary: string;
  payloadText: string;
  byteSize: number;
  estimatedTokens: number;
  loadedByDefault: boolean;
  objectRefs: {
    workspaceId: string;
    connectorId: string;
    provider: "WECOM";
    providerSubjectId: string | null;
    runtimeEventId: string;
    scope: "MEETINGS";
    objectType: "meeting";
  };
  evidenceRef: string;
  extractedFacts: string[];
  draftPayload: Record<string, unknown>;
  sourceSummary: string;
  boundaryNote: string;
};

export type WeComReadonlyConnectorSyncResult = {
  connectorId: string;
  status: WeComReadOnlyIngestResultStatus;
  ingestResult: WeComReadOnlyIngestResult;
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

function buildWindow(referenceDate = new Date()) {
  const windowStart = new Date(referenceDate);
  windowStart.setDate(windowStart.getDate() - WECOM_WINDOW_LOOKBACK_DAYS);
  const windowEnd = new Date(referenceDate);
  windowEnd.setDate(windowEnd.getDate() + WECOM_WINDOW_LOOKAHEAD_DAYS);

  return {
    windowStart,
    windowEnd,
    beginTime: Math.floor(windowStart.getTime() / 1000),
    endTime: Math.floor(windowEnd.getTime() / 1000),
  };
}

function buildScopeResult(input: {
  scope: WeComReadOnlyScope;
  status: WeComReadOnlyIngestScopeResult["status"];
  message?: string | null;
  docUrl?: string | null;
  persistedPayloadCount?: number;
  ingestionRecordCount?: number;
  handleCount?: number;
  latestSourceId?: string | null;
}) {
  return {
    scope: input.scope,
    status: input.status,
    message: input.message?.trim() || null,
    docUrl: input.docUrl?.trim() || null,
    persistedPayloadCount: input.persistedPayloadCount ?? 0,
    ingestionRecordCount: input.ingestionRecordCount ?? 0,
    handleCount: input.handleCount ?? 0,
    latestSourceId: input.latestSourceId?.trim() || null,
  } satisfies WeComReadOnlyIngestScopeResult;
}

function buildWeComIngestResult(input: {
  status: WeComReadOnlyIngestResultStatus;
  failurePosture: WeComCallbackFailurePosture;
  sourcePage?: string | null;
  message?: string | null;
  runtimeEventId?: string | null;
  runtimeSessionId?: string | null;
  notebookId?: string | null;
  windowStart?: Date | null;
  windowEnd?: Date | null;
  persistedPayloadCount?: number;
  ingestionRecordCount?: number;
  handleCount?: number;
  scopeResults: WeComReadOnlyIngestScopeResult[];
  recordedAt?: Date;
}) {
  return {
    status: input.status,
    failurePosture: input.failurePosture,
    recordedAt: (input.recordedAt ?? new Date()).toISOString(),
    sourcePage: input.sourcePage?.trim() || null,
    message: input.message?.trim() || null,
    runtimeEventId: input.runtimeEventId?.trim() || null,
    runtimeSessionId: input.runtimeSessionId?.trim() || null,
    notebookId: input.notebookId?.trim() || null,
    windowStart: input.windowStart ? input.windowStart.toISOString() : null,
    windowEnd: input.windowEnd ? input.windowEnd.toISOString() : null,
    persistedPayloadCount: input.persistedPayloadCount ?? 0,
    ingestionRecordCount: input.ingestionRecordCount ?? 0,
    handleCount: input.handleCount ?? 0,
    scopeResults: input.scopeResults,
  } satisfies WeComReadOnlyIngestResult;
}

function buildStatusMessage(
  status: WeComReadOnlyIngestResultStatus,
  english: boolean,
  input: {
    persistedPayloadCount: number;
    unresolvedScopeCount: number;
    failedScopeCount?: number;
    failureReason?: string | null;
  },
) {
  if (status === WECOM_READONLY_INGEST_RESULT_STATUSES.SUCCESS) {
    return english
      ? `WeCom read-only ingest completed with ${input.persistedPayloadCount} persisted payloads.`
      : `企业微信只读采集已完成，生成 ${input.persistedPayloadCount} 条已保存采集资料。`;
  }

  if (status === WECOM_READONLY_INGEST_RESULT_STATUSES.PARTIAL) {
    const failedScopeCount = input.failedScopeCount ?? 0;
    const detailSuffix = input.failureReason?.trim()
      ? english
        ? ` Details: ${input.failureReason.trim()}`
        : ` 详情：${input.failureReason.trim()}`
      : "";
    if (failedScopeCount > 0) {
      return english
        ? `WeCom read-only ingest persisted ${input.persistedPayloadCount} payloads. ${failedScopeCount} scopes failed and ${input.unresolvedScopeCount} scopes remain unresolved in current repo truth.${detailSuffix}`
        : `企业微信只读采集已写入 ${input.persistedPayloadCount} 条资料，但仍有 ${failedScopeCount} 个范围失败、${input.unresolvedScopeCount} 个范围尚未解析。${detailSuffix}`;
    }
    return english
      ? `WeCom read-only ingest persisted ${input.persistedPayloadCount} payloads. ${input.unresolvedScopeCount} scopes remain unresolved in current repo truth.${detailSuffix}`
      : `企业微信只读采集已部分完成：已写入 ${input.persistedPayloadCount} 条资料，仍有 ${input.unresolvedScopeCount} 个范围尚未解析。${detailSuffix}`;
  }

  if (status === WECOM_READONLY_INGEST_RESULT_STATUSES.UNRESOLVED) {
    return english
      ? input.failureReason ?? "WeCom read-only ingest remains unresolved."
      : input.failureReason ?? "企业微信只读采集仍未解析。";
  }

  return english
    ? input.failureReason ?? "WeCom read-only ingest failed."
    : input.failureReason ?? "企业微信只读采集失败。";
}

async function fetchWeComMeetingIds(input: {
  accessToken: string;
  providerUserId: string;
  beginTime: number;
  endTime: number;
}) {
  const url = new URL(WECOM_MEETING_ID_LIST_URL);
  url.searchParams.set("access_token", input.accessToken);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userid: input.providerUserId,
      cursor: "",
      begin_time: input.beginTime,
      end_time: input.endTime,
      limit: WECOM_MEETING_MAX_RESULTS,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`WeCom meeting id list failed: ${redactProviderErrorBody(body)}`);
  }

  const body = (await response.json()) as WeComMeetingIdListResponse | Record<string, unknown>;
  assertWeComOk(body as Record<string, unknown>, "WeCom meeting id list");

  return {
    requestUrl: url.toString(),
    nextCursor: normalizeString((body as WeComMeetingIdListResponse).next_cursor),
    meetingIds: Array.isArray((body as WeComMeetingIdListResponse).meetingid_list)
      ? ((body as WeComMeetingIdListResponse).meetingid_list ?? [])
          .map((value) => normalizeString(value))
          .filter((value): value is string => Boolean(value))
      : [],
  };
}

async function fetchWeComMeetingInfo(input: {
  accessToken: string;
  meetingId: string;
}) {
  const url = new URL(WECOM_MEETING_INFO_URL);
  url.searchParams.set("access_token", input.accessToken);

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      meetingid: input.meetingId,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`WeCom meeting info failed: ${redactProviderErrorBody(body)}`);
  }

  const body = (await response.json()) as WeComMeetingInfoResponse | Record<string, unknown>;
  assertWeComOk(body as Record<string, unknown>, "WeCom meeting info");

  return {
    requestUrl: url.toString(),
    detail: body as WeComMeetingInfoResponse,
  };
}

function formatUnixSeconds(value: number | null) {
  return value ? new Date(value * 1000).toISOString() : null;
}

function normalizeWeComMeetingPayload(input: {
  workspaceId: string;
  connectorId: string;
  providerSubjectId: string | null;
  meetingId: string;
  detail: WeComMeetingInfoResponse;
  runtimeEventId: string;
  requestUrls: string[];
}) {
  const title = normalizeString(input.detail.title) ?? `WeCom meeting ${input.meetingId}`;
  const description = normalizeString(input.detail.description);
  const location = normalizeString(input.detail.location);
  const adminUserId = normalizeString(input.detail.admin_userid);
  const meetingStart = normalizeNumber(input.detail.meeting_start);
  const meetingDuration = normalizeNumber(input.detail.meeting_duration);
  const meetingEnd =
    meetingStart !== null && meetingDuration !== null ? meetingStart + meetingDuration : null;
  const attendees = Array.isArray(input.detail.attendees) ? input.detail.attendees : [];
  const attendeeRefs = attendees
    .map((attendee) => normalizeString(attendee.userid) ?? normalizeString(attendee.meeting_alias))
    .filter((value): value is string => Boolean(value));

  const draftPayload = {
    provider: "WECOM",
    scope: "MEETINGS",
    meetingId: input.meetingId,
    title,
    description,
    location,
    adminUserId,
    status: normalizeNumber(input.detail.status),
    meetingType: normalizeNumber(input.detail.meeting_type),
    meetingStart: formatUnixSeconds(meetingStart),
    meetingEnd: formatUnixSeconds(meetingEnd),
    requestUrls: input.requestUrls,
    attendees,
  } satisfies Record<string, unknown>;

  const payloadText = [
    `WeCom meeting: ${title}`,
    description ? `Description: ${description}` : null,
    location ? `Location: ${location}` : null,
    adminUserId ? `Admin user: ${adminUserId}` : null,
    meetingStart ? `Starts: ${formatUnixSeconds(meetingStart)}` : null,
    meetingEnd ? `Ends: ${formatUnixSeconds(meetingEnd)}` : null,
    attendeeRefs.length ? `Attendees: ${attendeeRefs.join(", ")}` : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join("\n");

  return {
    scope: "MEETINGS",
    sourceType: "meeting",
    sourceId: input.meetingId,
    label: title,
    handle: `wecom-meeting-${input.meetingId}`,
    preview: payloadText,
    summary: title,
    payloadText,
    byteSize: payloadText.length,
    estimatedTokens: Math.max(1, Math.ceil(payloadText.length / 4)),
    loadedByDefault: false,
    objectRefs: {
      workspaceId: input.workspaceId,
      connectorId: input.connectorId,
      provider: "WECOM",
      providerSubjectId: input.providerSubjectId,
      runtimeEventId: input.runtimeEventId,
      scope: "MEETINGS",
      objectType: "meeting",
    },
    evidenceRef: WECOM_MEETING_INFO_DOC_URL,
    extractedFacts: [
      title,
      description,
      location,
      adminUserId,
      ...attendeeRefs,
    ].filter((value): value is string => Boolean(value)),
    draftPayload,
    sourceSummary:
      "WeCom meeting context ingested through the verified get_user_meetingid and get_info read contracts.",
    boundaryNote: WECOM_READONLY_INGEST_BOUNDARY_NOTE,
  } satisfies WeComNormalizedSourcePayload;
}

async function createRuntimeEvent(input: {
  workspaceId: string;
  connectorId: string;
  triggeredBy: string;
  status: RuntimeEventStatus;
  payload: Record<string, unknown>;
  sourceProvenance: Array<Record<string, unknown>>;
}) {
  const now = new Date();
  return db.runtimeEvent.create({
    data: {
      workspaceId: input.workspaceId,
      relatedObjectType: "Connector",
      relatedObjectId: input.connectorId,
      eventType: "WECOM_READONLY_INGEST",
      status: input.status,
      trustedContext: jsonStringify({
        provider: "WECOM",
        connectorId: input.connectorId,
      }),
      payload: jsonStringify(input.payload),
      sourceProvenance: jsonStringify(input.sourceProvenance),
      triggeredBy: input.triggeredBy,
      startedAt: now,
      completedAt: input.status === RuntimeEventStatus.COMPLETED ? now : null,
      failedAt: input.status === RuntimeEventStatus.FAILED ? now : null,
      errorMessage:
        input.status === RuntimeEventStatus.FAILED
          ? trimText(String(input.payload.message ?? "WeCom read-only ingest failed"), 500)
          : null,
    },
  });
}

async function ensureRuntimeSession(input: {
  workspaceId: string;
  runtimeEventId: string;
  connectorId: string;
  sourcePage: string;
}) {
  const sessionKey = `${input.workspaceId}:wecom-readonly:${input.runtimeEventId}`;
  return db.runtimeSession.upsert({
    where: { sessionKey },
    update: {
      currentStage: "wecom_readonly_ingest",
      sourcePage: input.sourcePage,
      boundaryNote: WECOM_READONLY_INGEST_BOUNDARY_NOTE,
      status: "ACTIVE",
    },
    create: {
      workspaceId: input.workspaceId,
      runtimeEventId: input.runtimeEventId,
      sessionKey,
      label: "WeCom read-only ingestion session",
      status: "ACTIVE",
      currentStage: "wecom_readonly_ingest",
      sourcePage: input.sourcePage,
      boundaryNote: WECOM_READONLY_INGEST_BOUNDARY_NOTE,
      budgetTokenLimit: 6000,
      replayableEventLog: jsonStringify([
        {
          stage: "wecom_readonly_ingest",
          at: new Date().toISOString(),
          connectorId: input.connectorId,
        },
      ]),
    },
  });
}

async function upsertSessionNotebook(input: {
  workspaceId: string;
  runtimeSessionId: string;
  notebookMessage: string;
  decisionSummary: string;
  blockerSummary: string | null;
  pendingQuestions: string[];
  openLoopSummary: string;
}) {
  const pendingQuestions =
    input.pendingQuestions.length > 0 ? jsonStringify(input.pendingQuestions) : null;

  return db.sessionNotebook.upsert({
    where: { runtimeSessionId: input.runtimeSessionId },
    update: {
      sessionSummary: input.notebookMessage,
      decisionSummary: input.decisionSummary,
      blockerSummary: input.blockerSummary,
      pendingQuestions,
      openLoopSummary: input.openLoopSummary,
      boundaryNote: WECOM_READONLY_INGEST_BOUNDARY_NOTE,
    },
    create: {
      workspaceId: input.workspaceId,
      runtimeSessionId: input.runtimeSessionId,
      sessionSummary: input.notebookMessage,
      decisionSummary: input.decisionSummary,
      blockerSummary: input.blockerSummary,
      pendingQuestions,
      openLoopSummary: input.openLoopSummary,
      boundaryNote: WECOM_READONLY_INGEST_BOUNDARY_NOTE,
    },
  });
}

export async function syncWeComReadonlyConnector(input: {
  workspaceId: string;
  userId: string;
  english: boolean;
  sourcePage?: string;
  triggeredBy: string;
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

  const sourcePage = input.sourcePage ?? WECOM_READONLY_INGEST_SOURCE_PAGE;
  const metadata = parseWeComConnectorMetadata(connector.metadata);
  const accessToken = readConnectorToken(connector.accessToken);
  const providerUserId = metadata.lastCallbackResult?.providerUserId ?? null;
  const boundCalendarCount = metadata.calendarRegistry.boundCalendars.length;
  const calendarRegistryEstablished = boundCalendarCount > 0;
  const { windowStart, windowEnd, beginTime, endTime } = buildWindow();

  const unresolvedCalendarScope = buildScopeResult({
    scope: "CALENDAR",
    status: WECOM_READONLY_INGEST_SCOPE_STATUSES.UNRESOLVED,
    message: input.english
      ? calendarRegistryEstablished
        ? `WeCom calendar registry is established for ${boundCalendarCount} calendars, but current repo truth still keeps calendar runtime pending a dedicated registry-backed ingest slice.`
        : "WeCom calendar contracts are verified, but the current repo truth does not yet persist a workspace-scoped calendar registry (`cal_id`)."
      : calendarRegistryEstablished
        ? `企业微信日历注册表已为 ${boundCalendarCount} 个日历成立，但当前仓库真实状态仍把日历运行链路保留在下一层接入。`
        : "企业微信日程合同已验证，但当前仓库真实状态还没有持久化工作区范围内的日历注册表（`cal_id`）。",
    docUrl: WECOM_CALENDAR_SCHEDULE_LIST_DOC_URL,
  });
  const unresolvedMessageScope = buildScopeResult({
    scope: "MESSAGE_NOTIFICATIONS",
    status: WECOM_READONLY_INGEST_SCOPE_STATUSES.UNRESOLVED,
    message: input.english
      ? WECOM_MESSAGE_NOTIFICATION_NOTE
      : "当前仓库真实状态还没有证实企业微信消息通知的读取侧合同。",
    docUrl: null,
  });

  if (!accessToken) {
    const unresolvedMeetingScope = buildScopeResult({
      scope: "MEETINGS",
      status: WECOM_READONLY_INGEST_SCOPE_STATUSES.UNRESOLVED,
      message: input.english
        ? "Meetings runtime remains unresolved until a WeCom access token is available."
        : "在存在可用的企业微信 access token 之前，会议运行时保持 unresolved。",
      docUrl: WECOM_MEETING_ID_LIST_DOC_URL,
    });
    const ingestResult = buildWeComIngestResult({
      status: WECOM_READONLY_INGEST_RESULT_STATUSES.UNRESOLVED,
      failurePosture: WECOM_CALLBACK_FAILURE_POSTURES.REVIEW_REQUIRED,
      sourcePage,
      message: buildStatusMessage(
        WECOM_READONLY_INGEST_RESULT_STATUSES.UNRESOLVED,
        input.english,
        {
          persistedPayloadCount: 0,
          unresolvedScopeCount: 3,
          failureReason: input.english
            ? "WeCom read-only ingest remains unresolved because callback metadata does not yet expose a usable access token."
            : "企业微信只读采集仍未解析，因为 callback metadata 还没有可用的 access token。",
        },
      ),
      windowStart,
      windowEnd,
      scopeResults: [
        unresolvedMeetingScope,
        unresolvedCalendarScope,
        unresolvedMessageScope,
      ],
    });
    const runtimeEvent = await createRuntimeEvent({
      workspaceId: input.workspaceId,
      connectorId: connector.id,
      triggeredBy: input.triggeredBy,
      status: RuntimeEventStatus.COMPLETED,
      payload: ingestResult,
      sourceProvenance: [
        {
          provider: "WECOM",
          scope: "MEETINGS",
          docUrl: WECOM_MEETING_ID_LIST_DOC_URL,
          detailDocUrl: WECOM_MEETING_INFO_DOC_URL,
          contractStatus: "UNRESOLVED",
        },
        {
          provider: "WECOM",
          scope: "CALENDAR",
          docUrl: WECOM_CALENDAR_SCHEDULE_LIST_DOC_URL,
          detailDocUrl: WECOM_CALENDAR_SCHEDULE_GET_DOC_URL,
          calendarDocUrl: WECOM_CALENDAR_GET_DOC_URL,
          contractStatus: calendarRegistryEstablished
            ? "VERIFIED_REGISTRY_READY_RUNTIME_PENDING"
            : "UNRESOLVED",
        },
        {
          provider: "WECOM",
          scope: "MESSAGE_NOTIFICATIONS",
          contractStatus: "UNRESOLVED",
        },
      ],
    });
    const resolvedResult = {
      ...ingestResult,
      runtimeEventId: runtimeEvent.id,
    } satisfies WeComReadOnlyIngestResult;
    const updatedConnector = await persistWeComConnectorIngestResult({
      workspaceId: input.workspaceId,
      userId: input.userId,
      connectorStatus: ConnectorStatus.ERROR,
      lastSyncStatus: "未解析",
      lastSyncMessage: resolvedResult.message,
      ingestResult: resolvedResult,
    });

    return {
      connectorId: updatedConnector.id,
      status: resolvedResult.status,
      ingestResult: resolvedResult,
    } satisfies WeComReadonlyConnectorSyncResult;
  }

  const normalizedPayloads: WeComNormalizedSourcePayload[] = [];
  const scopeResults: WeComReadOnlyIngestScopeResult[] = [];
  const sourceProvenance: Array<Record<string, unknown>> = [];
  const pendingQuestions: string[] = [];
  let meetingFailureMessage: string | null = null;

  if (!providerUserId) {
    scopeResults.push(
      buildScopeResult({
        scope: "MEETINGS",
        status: WECOM_READONLY_INGEST_SCOPE_STATUSES.UNRESOLVED,
        message: input.english
          ? "Meetings runtime remains unresolved because callback metadata does not yet expose a usable provider user id."
          : "会议运行时仍未解析，因为 callback metadata 还没有可用的 provider user id。",
        docUrl: WECOM_MEETING_ID_LIST_DOC_URL,
      }),
    );
    sourceProvenance.push({
      provider: "WECOM",
      scope: "MEETINGS",
      docUrl: WECOM_MEETING_ID_LIST_DOC_URL,
      detailDocUrl: WECOM_MEETING_INFO_DOC_URL,
      contractStatus: "UNRESOLVED",
    });
    pendingQuestions.push(
      input.english
        ? "Resolve callback metadata so a stable WeCom provider user id is available for meetings reads."
        : "先把 callback metadata 收紧到稳定的企业微信 provider user id，再进入会议读取。",
    );
  } else {
    try {
      const meetingIdResponse = await fetchWeComMeetingIds({
        accessToken,
        providerUserId,
        beginTime,
        endTime,
      });
      const detailRequestUrls: string[] = [];

      for (const meetingId of meetingIdResponse.meetingIds) {
        const detail = await fetchWeComMeetingInfo({
          accessToken,
          meetingId,
        });
        detailRequestUrls.push(detail.requestUrl);
        normalizedPayloads.push(
          normalizeWeComMeetingPayload({
            workspaceId: input.workspaceId,
            connectorId: connector.id,
            providerSubjectId: providerUserId,
            meetingId,
            detail: detail.detail,
            runtimeEventId: "pending-runtime-event",
            requestUrls: [meetingIdResponse.requestUrl, detail.requestUrl],
          }),
        );
      }

      const meetingPayloads = normalizedPayloads.filter(
        (payload) => payload.scope === "MEETINGS",
      );
      const scopeNotes = [
        input.english
          ? "Meetings runtime is established through the verified get_user_meetingid and get_info contracts."
          : "会议运行时已通过经验证的 get_user_meetingid 和 get_info 合同成立。",
      ];
      if (meetingIdResponse.nextCursor) {
        scopeNotes.push(
          input.english
            ? "The current seam intentionally persists only the first verified page of WeCom meetings."
            : "当前 seam 刻意只持久化第一批经过验证的企业微信会议分页结果。",
        );
      }

      scopeResults.push(
        buildScopeResult({
          scope: "MEETINGS",
          status: WECOM_READONLY_INGEST_SCOPE_STATUSES.INGESTED,
          message: scopeNotes.join(" "),
          docUrl: WECOM_MEETING_ID_LIST_DOC_URL,
          persistedPayloadCount: meetingPayloads.length,
          ingestionRecordCount: meetingPayloads.length,
          handleCount: meetingPayloads.length,
          latestSourceId: meetingPayloads[0]?.sourceId ?? null,
        }),
      );
      sourceProvenance.push({
        provider: "WECOM",
        scope: "MEETINGS",
        docUrl: WECOM_MEETING_ID_LIST_DOC_URL,
        detailDocUrl: WECOM_MEETING_INFO_DOC_URL,
        requestUrl: meetingIdResponse.requestUrl,
        detailRequestUrls,
        contractStatus: "VERIFIED",
      });
    } catch (error) {
      meetingFailureMessage =
        error instanceof Error
          ? error.message
          : input.english
            ? "WeCom meetings read failed."
            : "企业微信会议读取失败。";
      scopeResults.push(
        buildScopeResult({
          scope: "MEETINGS",
          status: WECOM_READONLY_INGEST_SCOPE_STATUSES.FAILED,
          message: meetingFailureMessage,
          docUrl: WECOM_MEETING_ID_LIST_DOC_URL,
        }),
      );
      sourceProvenance.push({
        provider: "WECOM",
        scope: "MEETINGS",
        docUrl: WECOM_MEETING_ID_LIST_DOC_URL,
        detailDocUrl: WECOM_MEETING_INFO_DOC_URL,
        contractStatus: "VERIFIED",
        errorMessage: meetingFailureMessage,
      });
      pendingQuestions.push(
        input.english
          ? "Re-check WeCom get_user_meetingid / get_info contracts and app permissions before widening meetings runtime."
          : "在扩大会议运行时之前，先复核企业微信 get_user_meetingid / get_info 合同与应用权限。",
      );
    }
  }

  scopeResults.push(unresolvedCalendarScope);
  sourceProvenance.push({
    provider: "WECOM",
    scope: "CALENDAR",
    docUrl: WECOM_CALENDAR_SCHEDULE_LIST_DOC_URL,
    detailDocUrl: WECOM_CALENDAR_SCHEDULE_GET_DOC_URL,
    calendarDocUrl: WECOM_CALENDAR_GET_DOC_URL,
    contractStatus: calendarRegistryEstablished
      ? "VERIFIED_REGISTRY_READY_RUNTIME_PENDING"
      : "VERIFIED_BUT_UNBOUND",
  });
  pendingQuestions.push(
    input.english
      ? calendarRegistryEstablished
        ? "Keep calendar runtime pending until a follow-on slice binds the established WeCom calendar registry into the runtime ingest seam."
        : "Persist a workspace-scoped WeCom calendar registry (`cal_id`) before claiming calendar runtime is established."
      : calendarRegistryEstablished
        ? "在后续切片把已成立的企业微信日历注册表接进运行时采集边界之前，继续保持日历运行时为待成立。"
        : "先持久化工作区范围内的企业微信日历注册表（`cal_id`），再宣称日历运行时已成立。",
  );

  scopeResults.push(unresolvedMessageScope);
  sourceProvenance.push({
    provider: "WECOM",
    scope: "MESSAGE_NOTIFICATIONS",
    contractStatus: "UNRESOLVED",
  });
  pendingQuestions.push(
    input.english
      ? "Verify whether WeCom exposes a stable pull/read contract for message notifications that fits the current workspace-first seam."
      : "继续核实企业微信是否存在适配当前工作区优先边界的稳定消息通知拉取 / 读取合同。",
  );

  const ingestedScopeCount = scopeResults.filter(
    (scope) => scope.status === WECOM_READONLY_INGEST_SCOPE_STATUSES.INGESTED,
  ).length;
  const unresolvedScopeCount = scopeResults.filter(
    (scope) => scope.status === WECOM_READONLY_INGEST_SCOPE_STATUSES.UNRESOLVED,
  ).length;
  const failedScopeCount = scopeResults.filter(
    (scope) => scope.status === WECOM_READONLY_INGEST_SCOPE_STATUSES.FAILED,
  ).length;

  const runtimeEventStatus =
    failedScopeCount > 0 && ingestedScopeCount === 0
      ? RuntimeEventStatus.FAILED
      : RuntimeEventStatus.COMPLETED;

  const runtimeEvent = await createRuntimeEvent({
    workspaceId: input.workspaceId,
    connectorId: connector.id,
    triggeredBy: input.triggeredBy,
    status: runtimeEventStatus,
    payload: {
      provider: "WECOM",
      stage: "read_only_ingest",
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      scopeStatuses: scopeResults.map((scope) => ({
        scope: scope.scope,
        status: scope.status,
      })),
    },
    sourceProvenance,
  });

  const finalizedPayloads = normalizedPayloads
    .map((payload) => ({
      ...payload,
      objectRefs: {
        ...payload.objectRefs,
        runtimeEventId: runtimeEvent.id,
      },
    }))
    .map((payload) => {
      const draft = buildPersistedPayloadDraft({
        key: `${input.workspaceId}:wecom-${payload.scope.toLowerCase()}:${runtimeEvent.id}:${payload.sourceId}`,
        sourceType: payload.sourceType,
        sourceId: payload.sourceId,
        label: payload.label,
        loadPolicy: "on_demand",
        text: payload.payloadText,
        loadedByDefault: false,
      });
      if (!draft) {
        return null;
      }
      const contract = toPersistedPayloadContract(draft);
      return {
        ...payload,
        handle: contract.handle,
        preview: contract.preview,
        summary: contract.summary,
        byteSize: contract.byteSize,
        estimatedTokens: contract.estimatedTokens,
        loadedByDefault: contract.loadedByDefault,
      } satisfies WeComNormalizedSourcePayload;
    })
    .filter((payload): payload is WeComNormalizedSourcePayload => Boolean(payload));

  const runtimeSession = await ensureRuntimeSession({
    workspaceId: input.workspaceId,
    runtimeEventId: runtimeEvent.id,
    connectorId: connector.id,
    sourcePage,
  });

  for (const payload of finalizedPayloads) {
    await db.persistedPayload.upsert({
      where: { payloadKey: `${runtimeSession.id}:${payload.handle}` },
      update: {
        runtimeSessionId: runtimeSession.id,
        runtimeEventId: runtimeEvent.id,
        payloadText: payload.payloadText,
        byteSize: payload.byteSize,
        estimatedTokens: payload.estimatedTokens,
        preview: payload.preview,
        summary: payload.summary,
        label: payload.label,
        handle: payload.handle,
        sourceId: payload.sourceId,
        sourceType: payload.sourceType,
        loadPolicy: "on_demand",
        loadedByDefault: payload.loadedByDefault,
      },
      create: {
        workspaceId: input.workspaceId,
        runtimeSessionId: runtimeSession.id,
        runtimeEventId: runtimeEvent.id,
        payloadKey: `${runtimeSession.id}:${payload.handle}`,
        sourceType: payload.sourceType,
        sourceId: payload.sourceId,
        loadPolicy: "on_demand",
        label: payload.label,
        handle: payload.handle,
        preview: payload.preview,
        summary: payload.summary,
        payloadText: payload.payloadText,
        byteSize: payload.byteSize,
        estimatedTokens: payload.estimatedTokens,
        loadedByDefault: payload.loadedByDefault,
      },
    });
  }

  if (finalizedPayloads.length > 0) {
    await db.connectorIngestionRecord.createMany({
      data: finalizedPayloads.map((payload) => ({
        workspaceId: input.workspaceId,
        runtimeEventId: runtimeEvent.id,
        sourceType: payload.sourceType,
        sourceId: payload.sourceId,
        sourceScope: "WORKSPACE:MEETINGS",
        trustLevel: "trusted",
        trustPromotionStatus: "draft_only",
        sensitivity: "internal",
        normalizationStatus: "normalized",
        promotionEligibility: "draft_only",
        objectRefs: jsonStringify(payload.objectRefs),
        evidenceRef: payload.evidenceRef,
        extractedFacts: jsonStringify(payload.extractedFacts),
        draftPayload: jsonStringify(payload.draftPayload),
        sourceSummary: payload.sourceSummary,
        boundaryNote: payload.boundaryNote,
      })),
    });
  }

  const meetingPayloadCount = finalizedPayloads.length;
  const notebookMessage = input.english
    ? `WeCom read-only ingest established ${meetingPayloadCount} meeting payloads. ${unresolvedScopeCount} scopes remain unresolved and ${failedScopeCount} scopes failed.`
    : `企业微信只读采集已建立 ${meetingPayloadCount} 条会议资料；仍有 ${unresolvedScopeCount} 个范围未解析、${failedScopeCount} 个范围失败。`;
  const decisionSummary =
    meetingPayloadCount > 0
      ? "WeCom meetings ingest path is established and persisted as review-first payloads."
      : "No WeCom payloads were persisted in the current runtime window.";
  const blockerSummary =
    failedScopeCount > 0
      ? "At least one WeCom read-only scope failed and still requires contract or permission hardening."
      : unresolvedScopeCount > 0
        ? "At least one WeCom read-only scope remains unresolved in current repo truth."
        : null;
  const openLoopSummary =
    unresolvedScopeCount > 0 || failedScopeCount > 0
      ? "Keep unresolved or failed WeCom scopes review-first until provider contracts and workspace binding are fully verified."
      : "Review persisted WeCom payloads before promoting any follow-through.";

  const notebook = await upsertSessionNotebook({
    workspaceId: input.workspaceId,
    runtimeSessionId: runtimeSession.id,
    notebookMessage,
    decisionSummary,
    blockerSummary,
    pendingQuestions,
    openLoopSummary,
  });

  const resultStatus =
    failedScopeCount > 0 && ingestedScopeCount === 0
      ? WECOM_READONLY_INGEST_RESULT_STATUSES.FAILURE
      : ingestedScopeCount === 0 && unresolvedScopeCount > 0
        ? WECOM_READONLY_INGEST_RESULT_STATUSES.UNRESOLVED
        : failedScopeCount > 0 || unresolvedScopeCount > 0
          ? WECOM_READONLY_INGEST_RESULT_STATUSES.PARTIAL
          : WECOM_READONLY_INGEST_RESULT_STATUSES.SUCCESS;
  const failurePosture =
    failedScopeCount > 0
      ? WECOM_CALLBACK_FAILURE_POSTURES.RETRYABLE
      : unresolvedScopeCount > 0
        ? WECOM_CALLBACK_FAILURE_POSTURES.REVIEW_REQUIRED
        : WECOM_CALLBACK_FAILURE_POSTURES.CLEAR;
  const ingestResult = buildWeComIngestResult({
    status: resultStatus,
    failurePosture,
    sourcePage,
    message: buildStatusMessage(resultStatus, input.english, {
      persistedPayloadCount: finalizedPayloads.length,
      unresolvedScopeCount,
      failedScopeCount,
      failureReason: [meetingFailureMessage]
        .filter((value): value is string => Boolean(value))
        .join(" | "),
    }),
    runtimeEventId: runtimeEvent.id,
    runtimeSessionId: runtimeSession.id,
    notebookId: notebook.id,
    windowStart,
    windowEnd,
    persistedPayloadCount: finalizedPayloads.length,
    ingestionRecordCount: finalizedPayloads.length,
    handleCount: finalizedPayloads.length,
    scopeResults,
  });

  await db.runtimeEvent.update({
    where: { id: runtimeEvent.id },
    data: {
      payload: jsonStringify(ingestResult),
      completedAt: runtimeEventStatus === RuntimeEventStatus.COMPLETED ? new Date() : null,
      failedAt: runtimeEventStatus === RuntimeEventStatus.FAILED ? new Date() : null,
      errorMessage:
        runtimeEventStatus === RuntimeEventStatus.FAILED ? ingestResult.message : null,
    },
  });

  const updatedConnector = await persistWeComConnectorIngestResult({
    workspaceId: input.workspaceId,
    userId: input.userId,
    connectorStatus:
      resultStatus === WECOM_READONLY_INGEST_RESULT_STATUSES.FAILURE ||
      resultStatus === WECOM_READONLY_INGEST_RESULT_STATUSES.UNRESOLVED
        ? ConnectorStatus.ERROR
        : ConnectorStatus.CONNECTED,
    lastSyncStatus:
      resultStatus === WECOM_READONLY_INGEST_RESULT_STATUSES.SUCCESS
        ? "同步完成"
        : resultStatus === WECOM_READONLY_INGEST_RESULT_STATUSES.UNRESOLVED
          ? "未解析"
          : resultStatus === WECOM_READONLY_INGEST_RESULT_STATUSES.FAILURE
            ? "同步失败"
            : "部分完成",
    lastSyncMessage: ingestResult.message,
    ingestResult,
  });

  return {
    connectorId: updatedConnector.id,
    status: ingestResult.status,
    ingestResult,
  } satisfies WeComReadonlyConnectorSyncResult;
}
