import {
  ConnectorProvider,
  ConnectorStatus,
  RuntimeEventStatus,
} from "@prisma/client";
import { db } from "@/lib/db";
import {
  FEISHU_CALLBACK_FAILURE_POSTURES,
  FEISHU_READONLY_INGEST_RESULT_STATUSES,
  FEISHU_READONLY_INGEST_SCOPE_STATUSES,
  fetchFeishuTenantAccessToken,
  getFeishuBitableConfig,
  parseFeishuConnectorMetadata,
  persistFeishuConnectorIngestResult,
  type FeishuCallbackFailurePosture,
  type FeishuReadOnlyIngestResult,
  type FeishuReadOnlyIngestResultStatus,
  type FeishuReadOnlyIngestScopeResult,
  type FeishuReadOnlyScope,
} from "@/lib/connectors/feishu";
import {
  buildPersistedPayloadDraft,
  toPersistedPayloadContract,
} from "@/lib/helm-v2/runtime-upgrade";
import { jsonStringify, trimText } from "@/lib/utils";

const FEISHU_BITABLE_RECORD_LIST_DOC_URL =
  "https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/reference/bitable-v1/app-table-record/list";
const FEISHU_READONLY_INGEST_SOURCE_PAGE = "/settings";
const FEISHU_READONLY_INGEST_BOUNDARY_NOTE =
  "Feishu Bitable read-only ingest stays workspace-scoped and review-first: Helm only persists verified record traces into runtime artifacts, and no write-back, auto-send, or automatic commitment is opened from this seam.";

type FeishuBitableRecord = {
  recordId: string;
  fields: Record<string, unknown>;
};

type FeishuNormalizedSourcePayload = {
  scope: "BITABLE";
  sourceType: "bitable_record";
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
    provider: "FEISHU";
    providerSubjectId: string | null;
    runtimeEventId: string;
    scope: "BITABLE";
    objectType: "connector_signal";
  };
  evidenceRef: string;
  extractedFacts: string[];
  draftPayload: Record<string, unknown>;
  sourceSummary: string;
  boundaryNote: string;
};

export type FeishuReadonlyConnectorSyncResult = {
  connectorId: string;
  status: FeishuReadOnlyIngestResultStatus;
  ingestResult: FeishuReadOnlyIngestResult;
};

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function buildScopeResult(input: {
  scope: FeishuReadOnlyScope;
  status: FeishuReadOnlyIngestScopeResult["status"];
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
  } satisfies FeishuReadOnlyIngestScopeResult;
}

function buildFeishuIngestResult(input: {
  status: FeishuReadOnlyIngestResultStatus;
  failurePosture: FeishuCallbackFailurePosture;
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
  scopeResults: FeishuReadOnlyIngestScopeResult[];
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
  } satisfies FeishuReadOnlyIngestResult;
}

function buildStatusMessage(
  status: FeishuReadOnlyIngestResultStatus,
  english: boolean,
  input: {
    persistedPayloadCount: number;
    unresolvedScopeCount: number;
    failedScopeCount?: number;
    failureReason?: string | null;
  },
) {
  if (status === FEISHU_READONLY_INGEST_RESULT_STATUSES.SUCCESS) {
    return english
      ? `Feishu Bitable read-only ingest completed with ${input.persistedPayloadCount} persisted payloads.`
      : `飞书多维表格只读采集已完成，生成 ${input.persistedPayloadCount} 条已保存采集资料。`;
  }

  if (status === FEISHU_READONLY_INGEST_RESULT_STATUSES.PARTIAL) {
    const detailSuffix = input.failureReason?.trim()
      ? english
        ? ` Details: ${input.failureReason.trim()}`
        : ` 详情：${input.failureReason.trim()}`
      : "";
    return english
      ? `Feishu Bitable read-only ingest persisted ${input.persistedPayloadCount} payloads while ${input.unresolvedScopeCount} scopes remain unresolved and ${input.failedScopeCount ?? 0} scopes failed.${detailSuffix}`
      : `飞书多维表格只读采集已写入 ${input.persistedPayloadCount} 条资料，但仍有 ${input.unresolvedScopeCount} 个范围未解析、${input.failedScopeCount ?? 0} 个范围失败。${detailSuffix}`;
  }

  if (status === FEISHU_READONLY_INGEST_RESULT_STATUSES.UNRESOLVED) {
    return english
      ? input.failureReason ?? "Feishu Bitable read-only ingest remains unresolved."
      : input.failureReason ?? "飞书多维表格只读采集仍未解析。";
  }

  return english
    ? input.failureReason ?? "Feishu Bitable read-only ingest failed."
    : input.failureReason ?? "飞书多维表格只读采集失败。";
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
      eventType: "FEISHU_READONLY_INGEST",
      status: input.status,
      trustedContext: jsonStringify({
        provider: "FEISHU",
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
          ? trimText(String(input.payload.message ?? "Feishu read-only ingest failed"), 500)
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
  const sessionKey = `${input.workspaceId}:feishu-readonly:${input.runtimeEventId}`;
  return db.runtimeSession.upsert({
    where: { sessionKey },
    update: {
      currentStage: "feishu_bitable_readonly_ingest",
      sourcePage: input.sourcePage,
      boundaryNote: FEISHU_READONLY_INGEST_BOUNDARY_NOTE,
      status: "ACTIVE",
    },
    create: {
      workspaceId: input.workspaceId,
      runtimeEventId: input.runtimeEventId,
      sessionKey,
      label: "Feishu Bitable read-only ingestion session",
      status: "ACTIVE",
      currentStage: "feishu_bitable_readonly_ingest",
      sourcePage: input.sourcePage,
      boundaryNote: FEISHU_READONLY_INGEST_BOUNDARY_NOTE,
      budgetTokenLimit: 6000,
      replayableEventLog: jsonStringify([
        {
          stage: "feishu_bitable_readonly_ingest",
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
      boundaryNote: FEISHU_READONLY_INGEST_BOUNDARY_NOTE,
    },
    create: {
      workspaceId: input.workspaceId,
      runtimeSessionId: input.runtimeSessionId,
      sessionSummary: input.notebookMessage,
      decisionSummary: input.decisionSummary,
      blockerSummary: input.blockerSummary,
      pendingQuestions,
      openLoopSummary: input.openLoopSummary,
      boundaryNote: FEISHU_READONLY_INGEST_BOUNDARY_NOTE,
    },
  });
}

function toDisplayText(value: unknown): string {
  if (typeof value === "string") {
    return trimText(value, 120);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return trimText(
      value
        .map((item) => toDisplayText(item))
        .filter(Boolean)
        .join(", "),
      120,
    );
  }
  if (value && typeof value === "object") {
    return trimText(jsonStringify(value), 120);
  }
  return "";
}

function normalizeFeishuBitableRecord(input: {
  workspaceId: string;
  connectorId: string;
  providerSubjectId: string | null;
  runtimeEventId: string;
  appToken: string;
  tableId: string;
  viewId: string | null;
  record: FeishuBitableRecord;
}) {
  const firstTextField = Object.entries(input.record.fields).find(([, value]) =>
    Boolean(toDisplayText(value)),
  );
  const label =
    trimText(firstTextField?.[1] ? toDisplayText(firstTextField[1]) : "", 80) ||
    `Feishu Bitable record ${input.record.recordId}`;
  const payloadText = jsonStringify({
    provider: "FEISHU",
    scope: "BITABLE",
    appToken: input.appToken,
    tableId: input.tableId,
    viewId: input.viewId,
    recordId: input.record.recordId,
    fields: input.record.fields,
  });
  const extractedFacts = Object.entries(input.record.fields)
    .slice(0, 6)
    .map(([key, value]) => {
      const text = toDisplayText(value);
      return text ? `${key}: ${text}` : key;
    })
    .filter(Boolean);

  return {
    scope: "BITABLE",
    sourceType: "bitable_record",
    sourceId: input.record.recordId,
    label,
    handle: "",
    preview: "",
    summary: "",
    payloadText,
    byteSize: 0,
    estimatedTokens: 0,
    loadedByDefault: false,
    objectRefs: {
      workspaceId: input.workspaceId,
      connectorId: input.connectorId,
      provider: "FEISHU",
      providerSubjectId: input.providerSubjectId,
      runtimeEventId: input.runtimeEventId,
      scope: "BITABLE",
      objectType: "connector_signal",
    },
    evidenceRef: `feishu:bitable:${input.tableId}:${input.record.recordId}`,
    extractedFacts,
    draftPayload: {
      provider: "FEISHU",
      scope: "BITABLE",
      appToken: input.appToken,
      tableId: input.tableId,
      viewId: input.viewId,
      recordId: input.record.recordId,
      fields: input.record.fields,
    },
    sourceSummary: "Feishu Bitable record fetched through the verified list-records contract.",
    boundaryNote: FEISHU_READONLY_INGEST_BOUNDARY_NOTE,
  } satisfies FeishuNormalizedSourcePayload;
}

async function fetchFeishuBitableRecords(input: {
  tenantAccessToken: string;
  appToken: string;
  tableId: string;
  viewId: string | null;
  pageSize: number;
  maxPages: number;
}) {
  const records: FeishuBitableRecord[] = [];
  const requestUrls: string[] = [];
  let pageToken: string | null = null;
  let pageCount = 0;

  while (pageCount < input.maxPages) {
    const url = new URL(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${input.appToken}/tables/${input.tableId}/records`,
    );
    url.searchParams.set("page_size", String(input.pageSize));
    if (input.viewId) {
      url.searchParams.set("view_id", input.viewId);
    }
    if (pageToken) {
      url.searchParams.set("page_token", pageToken);
    }
    requestUrls.push(url.toString());

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${input.tenantAccessToken}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Feishu Bitable list records failed with HTTP ${response.status}.`);
    }

    const body = (await response.json()) as Record<string, unknown>;
    const code = typeof body.code === "number" ? body.code : 0;
    if (code !== 0) {
      throw new Error(
        `Feishu Bitable list records failed: ${normalizeString(body.msg) ?? `code ${code}`}`,
      );
    }

    const data =
      body.data && typeof body.data === "object"
        ? (body.data as Record<string, unknown>)
        : {};
    const items = Array.isArray(data.items) ? data.items : [];
    for (const item of items) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const record = item as Record<string, unknown>;
      const recordId =
        normalizeString(record.record_id) ??
        normalizeString(record.recordId) ??
        normalizeString(record.id);
      const fields =
        record.fields && typeof record.fields === "object"
          ? (record.fields as Record<string, unknown>)
          : {};
      if (!recordId) {
        continue;
      }
      records.push({
        recordId,
        fields,
      });
    }

    pageCount += 1;
    const hasMore = Boolean(data.has_more);
    pageToken = normalizeString(data.page_token) ?? normalizeString(data.pageToken);
    if (!hasMore || !pageToken) {
      break;
    }
  }

  return {
    records,
    requestUrls,
  };
}

export async function syncFeishuReadonlyConnector(input: {
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
        provider: ConnectorProvider.FEISHU,
      },
    },
  });

  if (!connector) {
    throw new Error(
      input.english
        ? "No Feishu connector is available yet. Complete Feishu OAuth callback first."
        : "当前还没有可用的飞书连接，请先完成 Feishu OAuth callback。",
    );
  }

  const sourcePage = input.sourcePage ?? FEISHU_READONLY_INGEST_SOURCE_PAGE;
  const metadata = parseFeishuConnectorMetadata(connector.metadata);
  const callbackStatus = metadata.lastCallbackResult?.status ?? null;
  const bitableConfig = getFeishuBitableConfig();
  const windowStart = new Date();
  const windowEnd = new Date();
  const sourceProvenance: Array<Record<string, unknown>> = [];

  if (callbackStatus !== "SUCCESS") {
    const scopeResult = buildScopeResult({
      scope: "BITABLE",
      status: FEISHU_READONLY_INGEST_SCOPE_STATUSES.UNRESOLVED,
      message: input.english
        ? "Feishu Bitable runtime remains unresolved until OAuth callback succeeds for the current workspace user."
        : "在当前工作区用户完成成功的飞书 OAuth 回调之前，多维表格运行时保持 unresolved。",
      docUrl: FEISHU_BITABLE_RECORD_LIST_DOC_URL,
    });
    sourceProvenance.push({
      provider: "FEISHU",
      scope: "BITABLE",
      docUrl: FEISHU_BITABLE_RECORD_LIST_DOC_URL,
      contractStatus: "UNRESOLVED",
    });
    const runtimeEvent = await createRuntimeEvent({
      workspaceId: input.workspaceId,
      connectorId: connector.id,
      triggeredBy: input.triggeredBy,
      status: RuntimeEventStatus.COMPLETED,
      payload: {
        provider: "FEISHU",
        stage: "read_only_ingest",
        message: scopeResult.message,
      },
      sourceProvenance,
    });
    const ingestResult = buildFeishuIngestResult({
      status: FEISHU_READONLY_INGEST_RESULT_STATUSES.UNRESOLVED,
      failurePosture: FEISHU_CALLBACK_FAILURE_POSTURES.REVIEW_REQUIRED,
      sourcePage,
      message: buildStatusMessage(
        FEISHU_READONLY_INGEST_RESULT_STATUSES.UNRESOLVED,
        input.english,
        {
          persistedPayloadCount: 0,
          unresolvedScopeCount: 1,
          failureReason: scopeResult.message,
        },
      ),
      runtimeEventId: runtimeEvent.id,
      windowStart,
      windowEnd,
      scopeResults: [scopeResult],
    });
    const updatedConnector = await persistFeishuConnectorIngestResult({
      workspaceId: input.workspaceId,
      userId: input.userId,
      connectorStatus: ConnectorStatus.ERROR,
      lastSyncStatus: "未解析",
      lastSyncMessage: ingestResult.message,
      ingestResult,
    });
    return {
      connectorId: updatedConnector.id,
      status: ingestResult.status,
      ingestResult,
    } satisfies FeishuReadonlyConnectorSyncResult;
  }

  if (!bitableConfig.appToken || !bitableConfig.tableId) {
    const scopeResult = buildScopeResult({
      scope: "BITABLE",
      status: FEISHU_READONLY_INGEST_SCOPE_STATUSES.UNRESOLVED,
      message: input.english
        ? "Feishu Bitable binding remains unresolved because FEISHU_BITABLE_APP_TOKEN / FEISHU_BITABLE_TABLE_ID are not fully configured."
        : "飞书多维表格绑定仍未解析，因为 FEISHU_BITABLE_APP_TOKEN / FEISHU_BITABLE_TABLE_ID 还未完整配置。",
      docUrl: FEISHU_BITABLE_RECORD_LIST_DOC_URL,
    });
    sourceProvenance.push({
      provider: "FEISHU",
      scope: "BITABLE",
      docUrl: FEISHU_BITABLE_RECORD_LIST_DOC_URL,
      contractStatus: "VERIFIED_ENV_BINDING_PENDING",
    });
    const runtimeEvent = await createRuntimeEvent({
      workspaceId: input.workspaceId,
      connectorId: connector.id,
      triggeredBy: input.triggeredBy,
      status: RuntimeEventStatus.COMPLETED,
      payload: {
        provider: "FEISHU",
        stage: "read_only_ingest",
        message: scopeResult.message,
      },
      sourceProvenance,
    });
    const ingestResult = buildFeishuIngestResult({
      status: FEISHU_READONLY_INGEST_RESULT_STATUSES.UNRESOLVED,
      failurePosture: FEISHU_CALLBACK_FAILURE_POSTURES.REVIEW_REQUIRED,
      sourcePage,
      message: buildStatusMessage(
        FEISHU_READONLY_INGEST_RESULT_STATUSES.UNRESOLVED,
        input.english,
        {
          persistedPayloadCount: 0,
          unresolvedScopeCount: 1,
          failureReason: scopeResult.message,
        },
      ),
      runtimeEventId: runtimeEvent.id,
      windowStart,
      windowEnd,
      scopeResults: [scopeResult],
    });
    const updatedConnector = await persistFeishuConnectorIngestResult({
      workspaceId: input.workspaceId,
      userId: input.userId,
      connectorStatus: ConnectorStatus.ERROR,
      lastSyncStatus: "未解析",
      lastSyncMessage: ingestResult.message,
      ingestResult,
    });
    return {
      connectorId: updatedConnector.id,
      status: ingestResult.status,
      ingestResult,
    } satisfies FeishuReadonlyConnectorSyncResult;
  }

  const pendingQuestions: string[] = [
    input.english
      ? "Current Feishu Bitable binding is env-backed and review-first; widen to workspace-managed binding only after a dedicated registry slice lands."
      : "当前飞书多维表格绑定仍由环境变量支撑且先复核；只有在后续注册表切片落地后，才进入工作区内可管理绑定。",
  ];
  const boundAppToken = bitableConfig.appToken;
  const boundTableId = bitableConfig.tableId;

  let records: FeishuBitableRecord[] = [];
  let requestUrls: string[] = [];
  let fetchFailureMessage: string | null = null;
  try {
    const tenantToken = await fetchFeishuTenantAccessToken();
    const result = await fetchFeishuBitableRecords({
      tenantAccessToken: tenantToken.tenantAccessToken,
      appToken: boundAppToken,
      tableId: boundTableId,
      viewId: bitableConfig.viewId,
      pageSize: bitableConfig.pageSize,
      maxPages: bitableConfig.maxPages,
    });
    records = result.records;
    requestUrls = result.requestUrls;
  } catch (error) {
    fetchFailureMessage =
      error instanceof Error
        ? error.message
        : input.english
          ? "Feishu Bitable read failed."
          : "飞书多维表格读取失败。";
  }

  const scopeStatus =
    fetchFailureMessage !== null
      ? FEISHU_READONLY_INGEST_SCOPE_STATUSES.FAILED
      : FEISHU_READONLY_INGEST_SCOPE_STATUSES.INGESTED;
  const scopeResult = buildScopeResult({
    scope: "BITABLE",
    status: scopeStatus,
    message:
      fetchFailureMessage ??
      (input.english
        ? `Feishu Bitable read-only ingest established ${records.length} records through the verified list-records contract.`
        : `飞书多维表格只读采集已通过经验证的列出记录合同建立 ${records.length} 条记录。`),
    docUrl: FEISHU_BITABLE_RECORD_LIST_DOC_URL,
    persistedPayloadCount: fetchFailureMessage ? 0 : records.length,
    ingestionRecordCount: fetchFailureMessage ? 0 : records.length,
    handleCount: fetchFailureMessage ? 0 : records.length,
    latestSourceId: fetchFailureMessage ? null : records[0]?.recordId ?? null,
  });
  sourceProvenance.push({
    provider: "FEISHU",
    scope: "BITABLE",
    docUrl: FEISHU_BITABLE_RECORD_LIST_DOC_URL,
    requestUrls,
    appToken: boundAppToken,
    tableId: boundTableId,
    viewId: bitableConfig.viewId,
    contractStatus: fetchFailureMessage ? "VERIFIED_FETCH_FAILED" : "VERIFIED",
    errorMessage: fetchFailureMessage,
  });

  const runtimeEventStatus =
    scopeResult.status === FEISHU_READONLY_INGEST_SCOPE_STATUSES.FAILED
      ? RuntimeEventStatus.FAILED
      : RuntimeEventStatus.COMPLETED;
  const runtimeEvent = await createRuntimeEvent({
    workspaceId: input.workspaceId,
    connectorId: connector.id,
    triggeredBy: input.triggeredBy,
    status: runtimeEventStatus,
    payload: {
      provider: "FEISHU",
      stage: "read_only_ingest",
      scopeStatuses: [{ scope: "BITABLE", status: scopeResult.status }],
    },
    sourceProvenance,
  });

  const finalizedPayloads: FeishuNormalizedSourcePayload[] = [];
  for (const record of records) {
    const payload = normalizeFeishuBitableRecord({
      workspaceId: input.workspaceId,
      connectorId: connector.id,
      providerSubjectId: metadata.lastResolvedTenantKey,
      runtimeEventId: runtimeEvent.id,
      appToken: boundAppToken,
      tableId: boundTableId,
      viewId: bitableConfig.viewId,
      record,
    });
    const draft = buildPersistedPayloadDraft({
      key: `${input.workspaceId}:feishu-bitable:${runtimeEvent.id}:${payload.sourceId}`,
      sourceType: "artifact",
      sourceId: payload.sourceId,
      label: payload.label,
      loadPolicy: "on_demand",
      text: payload.payloadText,
      loadedByDefault: false,
    });
    if (!draft) {
      continue;
    }
    const contract = toPersistedPayloadContract(draft);
    finalizedPayloads.push({
      ...payload,
      handle: contract.handle,
      preview: contract.preview,
      summary: contract.summary,
      byteSize: contract.byteSize,
      estimatedTokens: contract.estimatedTokens,
      loadedByDefault: contract.loadedByDefault,
    });
  }

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
        sourceScope: "WORKSPACE:BITABLE",
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

  const notebookMessage = input.english
    ? `Feishu Bitable read-only ingest established ${finalizedPayloads.length} payloads for the current runtime window.`
    : `飞书多维表格只读采集已为当前运行窗口建立 ${finalizedPayloads.length} 条资料。`;
  const decisionSummary =
    finalizedPayloads.length > 0
      ? "Feishu Bitable ingest path is established and persisted as review-first payloads."
      : "No Feishu Bitable payloads were persisted in the current runtime window.";
  const blockerSummary = fetchFailureMessage
    ? "Feishu Bitable read-side contract is verified, but the current fetch still failed and requires permission or token hardening."
    : null;
  const openLoopSummary = fetchFailureMessage
    ? "Keep the Feishu Bitable seam review-first until tenant token and table permissions are revalidated."
    : "Review persisted Feishu Bitable payloads before promoting any follow-through.";

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
    scopeResult.status === FEISHU_READONLY_INGEST_SCOPE_STATUSES.FAILED
      ? FEISHU_READONLY_INGEST_RESULT_STATUSES.FAILURE
      : FEISHU_READONLY_INGEST_RESULT_STATUSES.SUCCESS;
  const failurePosture =
    scopeResult.status === FEISHU_READONLY_INGEST_SCOPE_STATUSES.FAILED
      ? FEISHU_CALLBACK_FAILURE_POSTURES.RETRYABLE
      : FEISHU_CALLBACK_FAILURE_POSTURES.CLEAR;

  const ingestResult = buildFeishuIngestResult({
    status: resultStatus,
    failurePosture,
    sourcePage,
    message: buildStatusMessage(resultStatus, input.english, {
      persistedPayloadCount: finalizedPayloads.length,
      unresolvedScopeCount: 0,
      failedScopeCount:
        scopeResult.status === FEISHU_READONLY_INGEST_SCOPE_STATUSES.FAILED ? 1 : 0,
      failureReason: fetchFailureMessage,
    }),
    runtimeEventId: runtimeEvent.id,
    runtimeSessionId: runtimeSession.id,
    notebookId: notebook.id,
    windowStart,
    windowEnd,
    persistedPayloadCount: finalizedPayloads.length,
    ingestionRecordCount: finalizedPayloads.length,
    handleCount: finalizedPayloads.length,
    scopeResults: [scopeResult],
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

  const updatedConnector = await persistFeishuConnectorIngestResult({
    workspaceId: input.workspaceId,
    userId: input.userId,
    connectorStatus:
      resultStatus === FEISHU_READONLY_INGEST_RESULT_STATUSES.FAILURE
        ? ConnectorStatus.ERROR
        : ConnectorStatus.CONNECTED,
    lastSyncStatus:
      resultStatus === FEISHU_READONLY_INGEST_RESULT_STATUSES.SUCCESS
        ? "同步完成"
        : "同步失败",
    lastSyncMessage: ingestResult.message,
    ingestResult,
  });

  return {
    connectorId: updatedConnector.id,
    status: ingestResult.status,
    ingestResult,
  } satisfies FeishuReadonlyConnectorSyncResult;
}
