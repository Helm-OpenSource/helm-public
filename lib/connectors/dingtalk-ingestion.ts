import {
  ConnectorProvider,
  ConnectorStatus,
  MemoryEntityType,
  MemoryFactType,
  MemoryStatus,
  MemoryType,
  ObjectType,
  RuntimeEventStatus,
  SourceType,
} from "@prisma/client";
import { db } from "@/lib/db";
import {
  DINGTALK_CALLBACK_FAILURE_POSTURES,
  DINGTALK_READONLY_INGEST_RESULT_STATUSES,
  DINGTALK_READONLY_INGEST_SCOPE_STATUSES,
  type DingTalkCallbackFailurePosture,
  type DingTalkReadOnlyIngestResult,
  type DingTalkReadOnlyIngestResultStatus,
  type DingTalkReadOnlyIngestScopeResult,
  type DingTalkReadOnlyScope,
  getDingTalkMcpConfig,
  isDingTalkMcpConfigured,
  parseDingTalkConnectorMetadata,
  persistDingTalkConnectorIngestResult,
} from "@/lib/connectors/dingtalk";
import {
  discoverDingTalkMcpSubjects,
  fetchDingTalkMcpScopeData,
  getDingTalkMcpActiveProfiles,
  type DingTalkMcpRecord,
  type DingTalkMcpSubject,
  type DingTalkMcpScopeFetchResult,
} from "@/lib/connectors/dingtalk-mcp-client";
import {
  buildPersistedPayloadDraft,
  toPersistedPayloadContract,
} from "@/lib/helm-v2/runtime-upgrade";
import { bridgeDingTalkSignalsToWorkflow } from "@/lib/connectors/dingtalk-workflow-bridge";
import { classifyDingTalkSignal } from "@/lib/connectors/signal-classification";
import { jsonStringify, trimText } from "@/lib/utils";

const DINGTALK_READONLY_INGEST_SOURCE_PAGE = "/settings";
const DINGTALK_READONLY_INGEST_BOUNDARY_NOTE =
  "DingTalk read-only ingest stays review-first: records may link to workspace/object scopes, but only contract-verified read paths can write traces and unresolved scopes remain explicit instead of guessed.";
const DINGTALK_CALENDAR_LIST_DOC_URL =
  "https://open.dingtalk.com/document/personalapp/query-an-event-list-1";
const DINGTALK_TEAMBITION_DOC_URL =
  "https://open.dingtalk.com/document/orgapp-server/teambition-overview";
const DINGTALK_TODO_DOC_URL =
  "https://open.dingtalk.com/document/orgapp-server/overview-of-to-do";
const DINGTALK_NOTICE_DOC_URL =
  "https://open.dingtalk.com/document/orgapp/asynchronous-work-notification";
const DINGTALK_CALENDAR_LOOKBACK_DAYS = 7;
const DINGTALK_CALENDAR_LOOKAHEAD_DAYS = 30;
const DINGTALK_WORK_LOOKBACK_DAYS_DEFAULT = 30;
const DINGTALK_LINK_WINDOW_DAYS_DEFAULT = 30;

const DINGTALK_SCOPE_DOCS: Partial<Record<DingTalkReadOnlyScope, string>> = {
  CALENDAR: DINGTALK_CALENDAR_LIST_DOC_URL,
  MEETINGS: DINGTALK_CALENDAR_LIST_DOC_URL,
  TODO: DINGTALK_TODO_DOC_URL,
  PROJECTS: DINGTALK_TEAMBITION_DOC_URL,
  MANAGEMENT: DINGTALK_TODO_DOC_URL,
  WORK: DINGTALK_NOTICE_DOC_URL,
  MESSAGE_NOTIFICATIONS: DINGTALK_NOTICE_DOC_URL,
};

type NormalizedSourcePayload = {
  scope: DingTalkReadOnlyScope;
  sourceType: string;
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
    provider: "DINGTALK";
    providerSubjectId: string;
    runtimeEventId: string;
    scope: DingTalkReadOnlyScope;
    objectType: string;
    meetingId: string | null;
    opportunityId: string | null;
    companyId: string | null;
    contactId: string | null;
    linkReason: string;
    linkScore: number;
    linkMatchedBy: string[];
  };
  evidenceRef: string;
  extractedFacts: string[];
  draftPayload: Record<string, unknown>;
  sourceSummary: string;
  boundaryNote: string;
  classification: ReturnType<typeof classifyDingTalkSignal>;
};

type ObjectLinkResolution = {
  meetingId: string | null;
  opportunityId: string | null;
  companyId: string | null;
  contactId: string | null;
  scopePrefix: "WORKSPACE" | "OBJECT";
  reason: string;
  score: number;
  matchedBy: string[];
};

function toRecordObjectType(scope: DingTalkReadOnlyScope) {
  if (scope === "WORK") {
    return "work_report";
  }
  if (scope === "MANAGEMENT") {
    return "management_signal";
  }
  return "connector_signal";
}

type RuntimeDingTalkRecord = {
  scope: DingTalkReadOnlyScope;
  sourceType: string;
  sourceId: string;
  label: string;
  summary: string;
  preview: string;
  payloadText: string;
  sourceSummary: string;
  evidenceRef: string;
  extractedFacts: string[];
  draftPayload: Record<string, unknown>;
  docUrl: string | null;
};

function parseCsvEnv(value: string | null | undefined) {
  if (!value || !value.trim()) {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePositiveIntegerCsvEnv(value: string | null | undefined) {
  return parseCsvEnv(value)
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item > 0)
    .map((item) => Math.trunc(item));
}

function getSubjectDiscoveryCacheTtlMinutes() {
  const configured = Number(process.env.DINGTALK_SUBJECT_DISCOVERY_CACHE_TTL_MINUTES);
  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }
  return Number.POSITIVE_INFINITY;
}

function buildSubjectDiscoveryCacheKey(input: {
  seedUserIds: string[];
  seedUnionIds: string[];
  deptIds: number[];
  excludedDeptIds: number[];
  excludedDeptNames: string[];
  maxUsers: number;
}) {
  return jsonStringify({
    seedUserIds: [...new Set(input.seedUserIds)].sort(),
    seedUnionIds: [...new Set(input.seedUnionIds)].sort(),
    deptIds: [...new Set(input.deptIds)].sort((a, b) => a - b),
    excludedDeptIds: [...new Set(input.excludedDeptIds)].sort((a, b) => a - b),
    excludedDeptNames: [...new Set(input.excludedDeptNames)].sort(),
    maxUsers: input.maxUsers,
  });
}

function dedupeSubjects(subjects: DingTalkMcpSubject[]) {
  const merged = new Map<string, DingTalkMcpSubject>();
  for (const subject of subjects) {
    const key = `${subject.userId ?? ""}|${subject.unionId ?? ""}`;
    if (!subject.userId && !subject.unionId) {
      continue;
    }
    if (!merged.has(key)) {
      merged.set(key, subject);
    }
  }
  return [...merged.values()];
}

async function filterFreshPayloads(
  workspaceId: string,
  payloads: NormalizedSourcePayload[],
) {
  if (payloads.length === 0) {
    return payloads;
  }

  const sourceTypes = [...new Set(payloads.map((payload) => payload.sourceType))];
  const sourceIds = [...new Set(payloads.map((payload) => payload.sourceId))];
  const sourceScopes = [
    ...new Set(
      payloads.map((payload) =>
        `${payload.objectRefs.meetingId || payload.objectRefs.opportunityId || payload.objectRefs.companyId ? "OBJECT" : "WORKSPACE"}:${payload.scope}`,
      ),
    ),
  ];

  let existing: Array<{
    sourceType: string;
    sourceId: string;
    sourceScope: string;
  }> = [];
  try {
    existing = await db.connectorIngestionRecord.findMany({
      where: {
        workspaceId,
        sourceType: { in: sourceTypes },
        sourceId: { in: sourceIds },
        sourceScope: { in: sourceScopes },
      },
      select: {
        sourceType: true,
        sourceId: true,
        sourceScope: true,
      },
    });
  } catch {
    return payloads;
  }
  const existingKeys = new Set(
    existing.map((item) => `${item.sourceType}::${item.sourceScope}::${item.sourceId}`),
  );

  return payloads.filter((payload) => {
    const sourceScope = `${
      payload.objectRefs.meetingId ||
      payload.objectRefs.opportunityId ||
      payload.objectRefs.companyId
        ? "OBJECT"
        : "WORKSPACE"
    }:${payload.scope}`;
    const dedupeKey = `${payload.sourceType}::${sourceScope}::${payload.sourceId}`;
    if (existingKeys.has(dedupeKey)) {
      return false;
    }
    existingKeys.add(dedupeKey);
    return true;
  });
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function traceWorkflow(event: string, payload: unknown) {
  if (process.env.DINGTALK_MCP_TRACE !== "1") {
    return;
  }
  console.error(`[dingtalk-mcp-trace] ${event}: ${trimText(jsonStringify(payload), 2000)}`);
}

function resolveSubjectCandidates(input: {
  callbackUserId: string | null;
  callbackUnionId: string | null;
  configuredUserId: string | null;
  configuredUnionId: string | null;
}) {
  const subjects: DingTalkMcpSubject[] = [];
  if (input.callbackUserId || input.callbackUnionId) {
    subjects.push({
      userId: input.callbackUserId,
      unionId: input.callbackUnionId,
      source: "callback",
    });
  }
  if (input.configuredUserId || input.configuredUnionId) {
    subjects.push({
      userId: input.configuredUserId,
      unionId: input.configuredUnionId,
      source: "env_primary",
    });
  }

  const batchPairs = parseCsvEnv(process.env.DINGTALK_BATCH_SUBJECTS);
  for (const pair of batchPairs) {
    const [userIdRaw, unionIdRaw] = pair.split(":");
    const userId = userIdRaw?.trim() || null;
    const unionId = unionIdRaw?.trim() || null;
    if (userId || unionId) {
      subjects.push({
        userId,
        unionId,
        source: "env_batch_subjects",
      });
    }
  }

  for (const userId of parseCsvEnv(process.env.DINGTALK_BATCH_USER_IDS)) {
    subjects.push({
      userId,
      unionId: null,
      source: "env_batch_user_ids",
    });
  }
  for (const unionId of parseCsvEnv(process.env.DINGTALK_BATCH_UNION_IDS)) {
    subjects.push({
      userId: null,
      unionId,
      source: "env_batch_union_ids",
    });
  }

  const dedup = new Map<string, DingTalkMcpSubject>();
  for (const subject of subjects) {
    const key = `${subject.userId ?? ""}|${subject.unionId ?? ""}`;
    if (!dedup.has(key)) {
      dedup.set(key, subject);
    }
  }
  return [...dedup.values()];
}

function buildSubjectLabel(subject: DingTalkMcpSubject, index: number) {
  const userPart = subject.userId ? `uid:${subject.userId}` : "uid:unknown";
  const unionPart = subject.unionId ? `union:${subject.unionId}` : "union:unknown";
  return `subject-${index + 1}:${userPart}:${unionPart}`;
}

export type DingTalkReadonlyConnectorSyncResult = {
  connectorId: string;
  status: DingTalkReadOnlyIngestResultStatus;
  ingestResult: DingTalkReadOnlyIngestResult;
};

function buildCalendarWindow(referenceDate = new Date()) {
  const windowStart = new Date(referenceDate);
  windowStart.setDate(windowStart.getDate() - DINGTALK_CALENDAR_LOOKBACK_DAYS);
  const windowEnd = new Date(referenceDate);
  windowEnd.setDate(windowEnd.getDate() + DINGTALK_CALENDAR_LOOKAHEAD_DAYS);

  return {
    windowStart,
    windowEnd,
  };
}

function getWorkLookbackDays() {
  const configured = Number(process.env.DINGTALK_WORK_LOOKBACK_DAYS);
  if (Number.isFinite(configured) && configured > 0) {
    return Math.trunc(configured);
  }
  return DINGTALK_WORK_LOOKBACK_DAYS_DEFAULT;
}

function buildWorkWindow(referenceDate = new Date()) {
  const windowEnd = new Date(referenceDate);
  const windowStart = new Date(referenceDate);
  windowStart.setDate(windowStart.getDate() - getWorkLookbackDays());
  return {
    windowStart,
    windowEnd,
  };
}

function getLinkWindowDays() {
  const configured = Number(process.env.DINGTALK_LINK_WINDOW_DAYS);
  if (Number.isFinite(configured) && configured > 0) {
    return Math.trunc(configured);
  }
  return DINGTALK_LINK_WINDOW_DAYS_DEFAULT;
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function includesNormalized(haystack: string, needle: string) {
  if (!haystack || !needle) {
    return false;
  }
  return haystack.includes(needle);
}

function collectRecordText(record: RuntimeDingTalkRecord) {
  const payloadText = jsonStringify(record.draftPayload.payload ?? {});
  const facts = record.extractedFacts.join(" ");
  return normalizeText(
    [record.label, record.summary, record.preview, facts, payloadText].join(" "),
  );
}

function parseDateMillis(input: unknown) {
  if (typeof input === "number" && Number.isFinite(input)) {
    return input > 10_000_000_000 ? input : input * 1000;
  }
  if (typeof input !== "string") {
    return null;
  }
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }
  const asNumber = Number(trimmed);
  if (Number.isFinite(asNumber)) {
    return asNumber > 10_000_000_000 ? asNumber : asNumber * 1000;
  }
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractRecordTimeRange(record: RuntimeDingTalkRecord) {
  const payload =
    (record.draftPayload.payload as Record<string, unknown> | undefined) ?? {};
  const start =
    parseDateMillis(payload.startTime) ??
    parseDateMillis(payload.start_time) ??
    parseDateMillis(payload.beginTime) ??
    parseDateMillis(payload.begin_time) ??
    parseDateMillis(payload.create_time) ??
    null;
  const end =
    parseDateMillis(payload.endTime) ??
    parseDateMillis(payload.end_time) ??
    parseDateMillis(payload.modified_time) ??
    null;
  return { start, end };
}

async function buildObjectLinkContext(input: {
  workspaceId: string;
  referenceTime: Date;
}) {
  const days = getLinkWindowDays();
  const since = new Date(input.referenceTime);
  since.setDate(since.getDate() - days);
  const until = new Date(input.referenceTime);
  until.setDate(until.getDate() + days);

  const [meetings, opportunities, companies, contacts] = await Promise.all([
    db.meeting.findMany({
      where: {
        workspaceId: input.workspaceId,
        OR: [
          { updatedAt: { gte: since } },
          { startsAt: { gte: since, lte: until } },
        ],
      },
      select: {
        id: true,
        title: true,
        agenda: true,
        startsAt: true,
        endsAt: true,
        opportunityId: true,
        companyId: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 300,
    }),
    db.opportunity.findMany({
      where: {
        workspaceId: input.workspaceId,
        updatedAt: { gte: since },
      },
      include: {
        company: { select: { id: true, name: true } },
        contacts: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 400,
    }),
    db.company.findMany({
      where: { workspaceId: input.workspaceId },
      select: { id: true, name: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 400,
    }),
    db.contact.findMany({
      where: { workspaceId: input.workspaceId },
      select: { id: true, name: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 400,
    }),
  ]);

  return { meetings, opportunities, companies, contacts, since, until };
}

function resolveRecordObjectLink(input: {
  record: RuntimeDingTalkRecord;
  context: Awaited<ReturnType<typeof buildObjectLinkContext>>;
}) {
  const haystack = collectRecordText(input.record);
  const matches: string[] = [];
  let score = 0;
  let meetingId: string | null = null;
  let opportunityId: string | null = null;
  let companyId: string | null = null;
  let contactId: string | null = null;

  for (const company of input.context.companies) {
    const companyName = normalizeText(company.name);
    if (companyName && includesNormalized(haystack, companyName)) {
      companyId = company.id;
      score += 4;
      matches.push("company_name");
      break;
    }
  }

  for (const contact of input.context.contacts) {
    const contactName = normalizeText(contact.name);
    if (contactName && includesNormalized(haystack, contactName)) {
      contactId = contact.id;
      score += 2;
      matches.push("contact_name");
      break;
    }
  }

  for (const opportunity of input.context.opportunities) {
    const opportunityTitle = normalizeText(opportunity.title);
    if (opportunityTitle && includesNormalized(haystack, opportunityTitle)) {
      opportunityId = opportunity.id;
      companyId = companyId ?? opportunity.companyId ?? opportunity.company?.id ?? null;
      contactId = contactId ?? opportunity.contacts[0]?.id ?? null;
      score += 8;
      matches.push("opportunity_title");
      break;
    }
  }

  const timeRange = extractRecordTimeRange(input.record);
  for (const meeting of input.context.meetings) {
    const meetingTitle = normalizeText(meeting.title);
    const agenda = normalizeText(meeting.agenda);
    const matchedByTitle =
      (meetingTitle && includesNormalized(haystack, meetingTitle)) ||
      (agenda && includesNormalized(haystack, agenda));
    if (!matchedByTitle && !timeRange.start) {
      continue;
    }
    let localScore = matchedByTitle ? 7 : 0;
    if (timeRange.start) {
      const delta = Math.abs(meeting.startsAt.getTime() - timeRange.start);
      if (delta <= 12 * 60 * 60 * 1000) {
        localScore += 5;
      } else if (delta <= 48 * 60 * 60 * 1000) {
        localScore += 2;
      }
    }
    if (localScore <= 0) {
      continue;
    }
    meetingId = meeting.id;
    opportunityId = opportunityId ?? meeting.opportunityId ?? null;
    companyId = companyId ?? meeting.companyId ?? null;
    score += localScore;
    matches.push(matchedByTitle ? "meeting_title" : "meeting_time_window");
    break;
  }

  if (!opportunityId && companyId) {
    const companyOpportunity = input.context.opportunities.find(
      (item) => item.companyId === companyId,
    );
    if (companyOpportunity) {
      opportunityId = companyOpportunity.id;
      score += 2;
      matches.push("company_to_opportunity");
    }
  }

  const hasObject = Boolean(meetingId || opportunityId || companyId);
  return {
    meetingId,
    opportunityId,
    companyId,
    contactId,
    scopePrefix: hasObject ? "OBJECT" : "WORKSPACE",
    reason: hasObject
      ? `Matched by ${matches.join("+")} within ${getLinkWindowDays()}-day window`
      : `No reliable object match within ${getLinkWindowDays()}-day window`,
    score,
    matchedBy: matches,
  } satisfies ObjectLinkResolution;
}

function buildScopeResult(input: {
  scope: DingTalkReadOnlyScope;
  status: DingTalkReadOnlyIngestScopeResult["status"];
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
  } satisfies DingTalkReadOnlyIngestScopeResult;
}

function buildDingTalkIngestResult(input: {
  status: DingTalkReadOnlyIngestResultStatus;
  failurePosture: DingTalkCallbackFailurePosture;
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
  scopeResults: DingTalkReadOnlyIngestScopeResult[];
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
  } satisfies DingTalkReadOnlyIngestResult;
}

function buildStatusMessage(
  status: DingTalkReadOnlyIngestResultStatus,
  english: boolean,
  input: {
    persistedPayloadCount: number;
    unresolvedScopeCount: number;
    failureReason?: string | null;
  },
) {
  if (status === DINGTALK_READONLY_INGEST_RESULT_STATUSES.SUCCESS) {
    return english
      ? `DingTalk MCP read-only ingest completed with ${input.persistedPayloadCount} persisted payloads.`
      : `钉钉 MCP 只读采集已完成，生成 ${input.persistedPayloadCount} 条已保存采集资料。`;
  }

  if (status === DINGTALK_READONLY_INGEST_RESULT_STATUSES.PARTIAL) {
    return english
      ? `DingTalk MCP read-only ingest persisted ${input.persistedPayloadCount} payloads. ${input.unresolvedScopeCount} scopes remain unresolved in current repo truth.`
      : `钉钉 MCP 只读采集已部分完成：已写入 ${input.persistedPayloadCount} 条资料，仍有 ${input.unresolvedScopeCount} 个范围尚未解析。`;
  }

  if (status === DINGTALK_READONLY_INGEST_RESULT_STATUSES.UNRESOLVED) {
    return english
      ? input.failureReason ?? "DingTalk MCP read-only ingest remains unresolved."
      : input.failureReason ?? "钉钉 MCP 只读采集仍未解析。";
  }

  return english
    ? input.failureReason ?? "DingTalk MCP read-only ingest failed."
    : input.failureReason ?? "钉钉 MCP 只读采集失败。";
}

function deriveMeetingRecordsFromCalendar(records: DingTalkMcpRecord[]): RuntimeDingTalkRecord[] {
  return records
    .filter((record) => record.scope === "CALENDAR")
    .filter((record) => {
      const payload = record.draftPayload.payload as Record<string, unknown> | undefined;
      if (!payload || typeof payload !== "object") {
        return false;
      }
      const haystack = jsonStringify(payload).toLowerCase();
      return (
        haystack.includes("conference") ||
        haystack.includes("meeting") ||
        haystack.includes("url") ||
        haystack.includes("online") ||
        /会议|视频/.test(haystack)
      );
    })
    .map((record) => {
      const payload = record.draftPayload.payload as Record<string, unknown> | undefined;
      return {
        ...record,
        scope: "MEETINGS" as const,
        sourceType: "meeting_event",
        sourceId: `meeting:${record.sourceId}`,
        label: trimText(`Meeting · ${record.label}`, 180),
        summary: trimText(
          `${record.summary}\nDerived from DingTalk calendar event through meeting extraction policy.`,
          300,
        ),
        preview: trimText(record.preview, 120),
        evidenceRef: `dingtalk:meetings:${record.sourceId}`,
        sourceSummary: "Meeting record derived from DingTalk calendar event under review-first policy.",
        draftPayload: {
          provider: "DINGTALK",
          scope: "MEETINGS",
          derivedFromScope: "CALENDAR",
          payload,
        },
      };
    });
}

function deriveManagementRecords(input: {
  todoRecords: DingTalkMcpRecord[];
  workRecords: DingTalkMcpRecord[];
}): RuntimeDingTalkRecord[] {
  const merged = [...input.todoRecords, ...input.workRecords];
  return merged.map((record) => ({
    ...record,
    scope: "MANAGEMENT" as const,
    sourceType: "management_work_item",
    sourceId: `mgmt:${record.sourceId}`,
    label: trimText(`Management · ${record.label}`, 180),
    summary: trimText(
      `${record.summary}\nMapped into management/work posture by todo + notice policy.`,
      300,
    ),
    evidenceRef: `dingtalk:management:${record.sourceId}`,
    sourceSummary:
      "Management/work item derived from DingTalk todo/notice records under read-only mapping policy.",
    draftPayload: {
      provider: "DINGTALK",
      scope: "MANAGEMENT",
      derivedFromScope: record.scope,
      payload: record.draftPayload.payload,
    },
  }));
}

function extractWorkflowFields(record: RuntimeDingTalkRecord) {
  const payload =
    (record.draftPayload.payload as Record<string, unknown> | undefined) ?? {};
  const readString = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim() : null;
  return {
    owner:
      readString(payload.owner) ??
      readString(payload.ownerName) ??
      readString(payload.owner_name),
    creator:
      readString(payload.creator) ??
      readString(payload.creator_name) ??
      readString(payload.creatorName),
    dept:
      readString(payload.dept_name) ??
      readString(payload.deptName) ??
      readString(payload.department_name) ??
      readString(payload.departmentName),
    status: readString(payload.status),
    priority:
      readString(payload.priority) ?? readString(payload.priority_name),
    time:
      readString(payload.startTime) ??
      readString(payload.start_time) ??
      readString(payload.create_time),
  };
}

function parseDingTalkReportPayload(record: RuntimeDingTalkRecord) {
  const payload =
    (record.draftPayload.payload as Record<string, unknown> | undefined) ?? {};
  const readText = (value: unknown, depth = 0): string | null => {
    if (depth > 4 || value == null) {
      return null;
    }
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    if (Array.isArray(value)) {
      const merged = value
        .map((entry) => readText(entry, depth + 1))
        .filter((entry): entry is string => Boolean(entry))
        .join("\n")
        .trim();
      return merged ? merged : null;
    }
    if (typeof value === "object") {
      const row = value as Record<string, unknown>;
      for (const key of ["value", "text", "content", "markdown", "desc", "description"]) {
        const candidate = readText(row[key], depth + 1);
        if (candidate) {
          return candidate;
        }
      }
      const merged = Object.values(row)
        .map((entry) => readText(entry, depth + 1))
        .filter((entry): entry is string => Boolean(entry))
        .join("\n")
        .trim();
      return merged ? merged : null;
    }
    return null;
  };
  const readString = (value: unknown) =>
    typeof value === "string" && value.trim() ? value.trim() : null;
  const toTimestamp = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value > 10_000_000_000 ? value : value * 1000;
    }
    if (typeof value !== "string") {
      return null;
    }
    const asNum = Number(value.trim());
    if (Number.isFinite(asNum)) {
      return asNum > 10_000_000_000 ? asNum : asNum * 1000;
    }
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const contents = Array.isArray(payload.contents)
    ? payload.contents.filter((item) => item && typeof item === "object")
    : [];
  const getContentByKey = (matcher: RegExp) =>
    contents
      .map((item) => item as Record<string, unknown>)
      .find((item) => matcher.test(readString(item.key) ?? ""))
      ?.value;
  const completed = readText(getContentByKey(/本周完成|已完成|完成工作|完成事项/));
  const nextPlan = readText(getContentByKey(/下周工作计划|计划|下一步|待推进/));
  const needHelp = readText(getContentByKey(/需协调与帮助|风险|阻塞|问题/));
  const summary = readText(getContentByKey(/本周工作总结|总结/));

  return {
    reportId:
      readString(payload.report_id) ??
      readString(payload.reportId) ??
      record.sourceId,
    creatorName:
      readString(payload.creator_name) ??
      readString(payload.creatorName) ??
      null,
    departmentName:
      readString(payload.dept_name) ??
      readString(payload.deptName) ??
      null,
    templateName:
      readString(payload.template_name) ??
      readString(payload.templateName) ??
      null,
    createdAtMs:
      toTimestamp(payload.create_time) ??
      toTimestamp(payload.createdAt) ??
      null,
    completed,
    nextPlan,
    needHelp,
    summary,
  };
}

function buildWorkReportSummaryText(parsed: ReturnType<typeof parseDingTalkReportPayload>) {
  const chunks = [
    parsed.summary,
    parsed.completed ? `本周完成：${parsed.completed}` : null,
    parsed.nextPlan ? `下周计划：${parsed.nextPlan}` : null,
    parsed.needHelp ? `需协调：${parsed.needHelp}` : null,
  ].filter((item): item is string => Boolean(item && item.trim()));
  if (chunks.length === 0) {
    return null;
  }
  return trimText(chunks.join("\n"), 1800);
}

function parseWorkReportIdFromSourceKey(source: string) {
  const matched = source.match(/^dingtalk-report:([^:]+)/);
  return matched?.[1] ?? null;
}

function parseRuntimeDraftPayload(raw: string | null) {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function scrubLegacyWorkSummaryText(content: string) {
  const withoutTaxonomy = content
    .replace(/^\[taxonomy\].*\n?/gim, "")
    .replace(/\bflowModule=[^\s]+\s*/g, "")
    .replace(/\bbusinessDomain=[^\s]+\s*/g, "");
  const withoutRawPayload = withoutTaxonomy.replace(/Raw payload:[\s\S]*$/i, "");
  const withoutPlaceholder = withoutRawPayload.replace(/^WORK:\s*DingTalk\s*work.*$/gim, "");
  const cleaned = withoutPlaceholder.trim();
  return cleaned || "钉钉工作汇报摘要（结构化字段暂缺，已保留原始记录）";
}

async function sanitizeLegacyDingTalkWorkMemories(workspaceId: string) {
  const legacyMemoryEntries = await db.memoryEntry.findMany({
    where: {
      workspaceId,
      source: { startsWith: "dingtalk-report:" },
      OR: [
        { content: { contains: "[taxonomy]" } },
        { content: { contains: "Raw payload:" } },
        { content: { contains: "DingTalk work report fetched through MCP profile" } },
      ],
    },
    select: {
      id: true,
      source: true,
      content: true,
    },
    take: 300,
  });
  const legacyMemoryFacts = await db.memoryFact.findMany({
    where: {
      workspaceId,
      sourceId: { startsWith: "dingtalk-report:" },
      OR: [
        { content: { contains: "[taxonomy]" } },
        { content: { contains: "Raw payload:" } },
        { content: { contains: "DingTalk work report fetched through MCP profile" } },
      ],
    },
    select: {
      id: true,
      sourceId: true,
      content: true,
    },
    take: 300,
  });
  if (legacyMemoryEntries.length === 0 && legacyMemoryFacts.length === 0) {
    return { sanitizedEntryCount: 0, sanitizedFactCount: 0 };
  }

  const reportIds = uniqueStrings([
    ...legacyMemoryEntries.map((item) =>
      typeof item.source === "string" ? parseWorkReportIdFromSourceKey(item.source) ?? "" : "",
    ),
    ...legacyMemoryFacts.map((item) => parseWorkReportIdFromSourceKey(item.sourceId) ?? ""),
  ]);
  if (reportIds.length === 0) {
    return { sanitizedEntryCount: 0, sanitizedFactCount: 0 };
  }

  const sourceRecords = await db.connectorIngestionRecord.findMany({
    where: {
      workspaceId,
      sourceId: { in: reportIds },
      sourceScope: { in: ["WORKSPACE:WORK", "OBJECT:WORK"] },
    },
    select: {
      sourceId: true,
      sourceType: true,
      sourceSummary: true,
      draftPayload: true,
    },
    take: 600,
  });

  const summaryByReportId = new Map<string, string>();
  for (const sourceRecord of sourceRecords) {
    if (summaryByReportId.has(sourceRecord.sourceId)) {
      continue;
    }
    const parsedDraftPayload = parseRuntimeDraftPayload(sourceRecord.draftPayload);
    if (!parsedDraftPayload) {
      continue;
    }
    const parsed = parseDingTalkReportPayload({
      scope: "WORK",
      sourceType: sourceRecord.sourceType,
      sourceId: sourceRecord.sourceId,
      label: sourceRecord.sourceId,
      summary: sourceRecord.sourceSummary,
      preview: sourceRecord.sourceSummary,
      payloadText: sourceRecord.sourceSummary,
      sourceSummary: sourceRecord.sourceSummary,
      evidenceRef: `dingtalk:work:${sourceRecord.sourceId}`,
      extractedFacts: [],
      draftPayload: parsedDraftPayload,
      docUrl: null,
    });
    const cleanSummary = buildWorkReportSummaryText(parsed);
    if (!cleanSummary) {
      continue;
    }
    summaryByReportId.set(sourceRecord.sourceId, cleanSummary);
  }

  let sanitizedEntryCount = 0;
  for (const entry of legacyMemoryEntries) {
    if (typeof entry.source !== "string") {
      continue;
    }
    const reportId = parseWorkReportIdFromSourceKey(entry.source);
    if (!reportId) {
      continue;
    }
    const cleanSummary =
      summaryByReportId.get(reportId) ?? scrubLegacyWorkSummaryText(entry.content);
    if (!cleanSummary || cleanSummary === entry.content) {
      continue;
    }
    await db.memoryEntry.update({
      where: { id: entry.id },
      data: { content: cleanSummary },
    });
    sanitizedEntryCount += 1;
  }

  let sanitizedFactCount = 0;
  for (const fact of legacyMemoryFacts) {
    const reportId = parseWorkReportIdFromSourceKey(fact.sourceId);
    if (!reportId) {
      continue;
    }
    const cleanSummary =
      summaryByReportId.get(reportId) ?? scrubLegacyWorkSummaryText(fact.content);
    if (!cleanSummary || cleanSummary === fact.content) {
      continue;
    }
    await db.memoryFact.update({
      where: { id: fact.id },
      data: { content: cleanSummary },
    });
    sanitizedFactCount += 1;
  }

  return { sanitizedEntryCount, sanitizedFactCount };
}

async function upsertWorkMemoryFlow(input: {
  workspaceId: string;
  records: NormalizedSourcePayload[];
}) {
  const workRecords = input.records.filter((record) => record.scope === "WORK");
  if (workRecords.length === 0) {
    return {
      memoryEntryCount: 0,
      memoryFactCount: 0,
      opportunityProgressUpdatedCount: 0,
      workspaceFallbackCount: 0,
    };
  }

  let memoryEntryCount = 0;
  let memoryFactCount = 0;
  let opportunityProgressUpdatedCount = 0;
  let strongMeetingWriteCount = 0;
  let workspaceFallbackCount = 0;

  const isStrongMeetingSignal = (record: NormalizedSourcePayload) => {
    const matchedBy = record.objectRefs.linkMatchedBy ?? [];
    const hasMeetingTitleMatch = matchedBy.includes("meeting_title");
    const hasMeetingTimeMatch = matchedBy.includes("meeting_time_window");
    const hasMeetingKeyword =
      /会议|会后|meeting|agenda|参会|纪要/i.test(
        `${record.label} ${record.summary}`,
      );
    // Opportunity-first: meeting writeback only for high-confidence meeting signals.
    return (
      hasMeetingTitleMatch ||
      ((hasMeetingTimeMatch || hasMeetingKeyword) &&
        record.objectRefs.linkScore >= 12)
    );
  };

  for (const record of workRecords) {
    const parsed = parseDingTalkReportPayload({
      scope: record.scope,
      sourceType: record.sourceType,
      sourceId: record.sourceId,
      label: record.label,
      summary: record.summary,
      preview: record.preview,
      payloadText: record.payloadText,
      sourceSummary: record.sourceSummary,
      evidenceRef: record.evidenceRef,
      extractedFacts: record.extractedFacts,
      draftPayload: record.draftPayload,
      docUrl: null,
    });
    const reportTime = parsed.createdAtMs ? new Date(parsed.createdAtMs) : new Date();
    const sourceKeyBase = `dingtalk-report:${parsed.reportId}`;
    const summaryText = buildWorkReportSummaryText(parsed);
    if (!summaryText) {
      traceWorkflow("conversion_skipped", {
        scope: record.scope,
        sourceId: record.sourceId,
        reason: "work_report_summary_empty_after_parse",
      });
      continue;
    }
    const hasObjectTarget = Boolean(
      record.objectRefs.meetingId ||
        record.objectRefs.opportunityId ||
        record.objectRefs.companyId,
    );

    const allowMeetingWriteback =
      Boolean(record.objectRefs.meetingId) && isStrongMeetingSignal(record);

    if (allowMeetingWriteback && record.objectRefs.meetingId) {
      strongMeetingWriteCount += 1;
      const existingMeetingEntry = await db.memoryEntry.findFirst({
        where: {
          workspaceId: input.workspaceId,
          meetingId: record.objectRefs.meetingId,
          entityType: MemoryEntityType.MEETING,
          source: sourceKeyBase,
        },
        select: { id: true },
      });
      if (!existingMeetingEntry) {
        await db.memoryEntry.create({
          data: {
            workspaceId: input.workspaceId,
            meetingId: record.objectRefs.meetingId,
            opportunityId: record.objectRefs.opportunityId ?? undefined,
            companyId: record.objectRefs.companyId ?? undefined,
            entityType: MemoryEntityType.MEETING,
            memoryType: MemoryType.SUMMARY,
            title: parsed.templateName
              ? `钉钉汇报：${parsed.templateName}`
              : "钉钉工作汇报摘要",
            content: summaryText,
            source: sourceKeyBase,
          },
        });
        memoryEntryCount += 1;
      }

      const meetingFactSourceId = `${sourceKeyBase}:meeting:${record.objectRefs.meetingId}:summary`;
      const existingMeetingFact = await db.memoryFact.findFirst({
        where: {
          workspaceId: input.workspaceId,
          objectType: ObjectType.MEETING,
          objectId: record.objectRefs.meetingId,
          sourceType: SourceType.SYSTEM_INFERENCE,
          sourceId: meetingFactSourceId,
        },
        select: { id: true },
      });
      if (!existingMeetingFact) {
        await db.memoryFact.create({
          data: {
            workspaceId: input.workspaceId,
            objectType: ObjectType.MEETING,
            objectId: record.objectRefs.meetingId,
            factType: MemoryFactType.SUMMARY,
            title: "钉钉工作汇报摘要信号",
            content: summaryText,
            sourceType: SourceType.SYSTEM_INFERENCE,
            sourceId: meetingFactSourceId,
            confidence: 75,
            importance: 70,
            freshnessScore: 75,
            status: MemoryStatus.OBSERVED,
            createdBySystem: true,
          },
        });
        memoryFactCount += 1;
      }
    }

    if (record.objectRefs.opportunityId) {
      const existingOpportunityEntry = await db.memoryEntry.findFirst({
        where: {
          workspaceId: input.workspaceId,
          opportunityId: record.objectRefs.opportunityId,
          entityType: MemoryEntityType.OPPORTUNITY,
          source: sourceKeyBase,
        },
        select: { id: true },
      });
      if (!existingOpportunityEntry) {
        await db.memoryEntry.create({
          data: {
            workspaceId: input.workspaceId,
            opportunityId: record.objectRefs.opportunityId,
            meetingId:
              allowMeetingWriteback && record.objectRefs.meetingId
                ? record.objectRefs.meetingId
                : undefined,
            companyId: record.objectRefs.companyId ?? undefined,
            entityType: MemoryEntityType.OPPORTUNITY,
            memoryType: MemoryType.NEXT_STEP,
            title: "钉钉周报推进信号",
            content: summaryText,
            source: sourceKeyBase,
          },
        });
        memoryEntryCount += 1;
      }

      const opportunitySummaryFactSourceId = `${sourceKeyBase}:opportunity:${record.objectRefs.opportunityId}:summary`;
      const existingOpportunitySummaryFact = await db.memoryFact.findFirst({
        where: {
          workspaceId: input.workspaceId,
          objectType: ObjectType.OPPORTUNITY,
          objectId: record.objectRefs.opportunityId,
          sourceType: SourceType.SYSTEM_INFERENCE,
          sourceId: opportunitySummaryFactSourceId,
        },
        select: { id: true },
      });
      if (!existingOpportunitySummaryFact) {
        await db.memoryFact.create({
          data: {
            workspaceId: input.workspaceId,
            objectType: ObjectType.OPPORTUNITY,
            objectId: record.objectRefs.opportunityId,
            factType: MemoryFactType.SUMMARY,
            title: "钉钉工作汇报摘要信号",
            content: summaryText,
            sourceType: SourceType.SYSTEM_INFERENCE,
            sourceId: opportunitySummaryFactSourceId,
            confidence: 78,
            importance: 72,
            freshnessScore: 78,
            status: MemoryStatus.OBSERVED,
            createdBySystem: true,
          },
        });
        memoryFactCount += 1;
      }

      if (parsed.nextPlan) {
        const nextStepFactSourceId = `${sourceKeyBase}:opportunity:${record.objectRefs.opportunityId}:next_step`;
        const existingNextStepFact = await db.memoryFact.findFirst({
          where: {
            workspaceId: input.workspaceId,
            objectType: ObjectType.OPPORTUNITY,
            objectId: record.objectRefs.opportunityId,
            sourceType: SourceType.SYSTEM_INFERENCE,
            sourceId: nextStepFactSourceId,
          },
          select: { id: true },
        });
        if (!existingNextStepFact) {
          await db.memoryFact.create({
            data: {
              workspaceId: input.workspaceId,
              objectType: ObjectType.OPPORTUNITY,
              objectId: record.objectRefs.opportunityId,
              factType: MemoryFactType.NEXT_STEP,
              title: "钉钉周报下周计划",
              content: parsed.nextPlan,
              sourceType: SourceType.SYSTEM_INFERENCE,
              sourceId: nextStepFactSourceId,
              confidence: 80,
              importance: 80,
              freshnessScore: 80,
              status: MemoryStatus.ACTIVE,
              createdBySystem: true,
            },
          });
          memoryFactCount += 1;
        }
      }

      await db.opportunity.update({
        where: { id: record.objectRefs.opportunityId },
        data: {
          lastProgressAt: reportTime,
          nextStepSummary: parsed.nextPlan
            ? trimText(`钉钉周报下一步：${parsed.nextPlan}`, 500)
            : undefined,
        },
      });
      opportunityProgressUpdatedCount += 1;
    }

    if (!hasObjectTarget) {
      const workspaceEntrySource = `${sourceKeyBase}:workspace:summary`;
      const existingWorkspaceEntry = await db.memoryEntry.findFirst({
        where: {
          workspaceId: input.workspaceId,
          entityType: MemoryEntityType.WORKSPACE,
          source: workspaceEntrySource,
        },
        select: { id: true },
      });
      if (!existingWorkspaceEntry) {
        await db.memoryEntry.create({
          data: {
            workspaceId: input.workspaceId,
            entityType: MemoryEntityType.WORKSPACE,
            memoryType: MemoryType.SUMMARY,
            title: "钉钉周报信号（待对象关联）",
            content: summaryText,
            source: workspaceEntrySource,
          },
        });
        memoryEntryCount += 1;
        workspaceFallbackCount += 1;
      }
    }
  }

  return {
    memoryEntryCount,
    memoryFactCount,
    opportunityProgressUpdatedCount,
    strongMeetingWriteCount,
    workspaceFallbackCount,
  };
}

function normalizeMcpRecordToPayload(input: {
  workspaceId: string;
  connectorId: string;
  providerSubjectId: string | null;
  runtimeEventId: string;
  record: RuntimeDingTalkRecord;
  objectLink: ObjectLinkResolution;
}): NormalizedSourcePayload | null {
  const draft = buildPersistedPayloadDraft({
    key: `${input.workspaceId}:dingtalk:${input.record.scope.toLowerCase()}:${input.runtimeEventId}:${input.record.sourceId}`,
    sourceType: "artifact",
    sourceId: input.record.sourceId,
    label: input.record.label,
    loadPolicy: "on_demand",
    text: input.record.payloadText,
    loadedByDefault: false,
  });

  if (!draft) {
    return null;
  }

  const contract = toPersistedPayloadContract(draft);

  return {
    scope: input.record.scope,
    sourceType: input.record.sourceType,
    sourceId: input.record.sourceId,
    label: contract.label,
    handle: contract.handle,
    preview: contract.preview,
    summary: contract.summary,
    payloadText: input.record.payloadText,
    byteSize: contract.byteSize,
    estimatedTokens: contract.estimatedTokens,
    loadedByDefault: contract.loadedByDefault,
    objectRefs: {
      workspaceId: input.workspaceId,
      connectorId: input.connectorId,
      provider: "DINGTALK",
      providerSubjectId: input.providerSubjectId ?? "unresolved-provider-subject",
      runtimeEventId: input.runtimeEventId,
      scope: input.record.scope,
      objectType: toRecordObjectType(input.record.scope),
      meetingId: input.objectLink.meetingId,
      opportunityId: input.objectLink.opportunityId,
      companyId: input.objectLink.companyId,
      contactId: input.objectLink.contactId,
      linkReason: input.objectLink.reason,
      linkScore: input.objectLink.score,
      linkMatchedBy: input.objectLink.matchedBy,
    },
    evidenceRef: input.record.evidenceRef,
    extractedFacts: input.record.extractedFacts,
    draftPayload: input.record.draftPayload,
    sourceSummary: input.record.sourceSummary,
    boundaryNote: DINGTALK_READONLY_INGEST_BOUNDARY_NOTE,
    classification: classifyDingTalkSignal({
      scope: input.record.scope,
      sourceType: input.record.sourceType,
    }),
  } satisfies NormalizedSourcePayload;
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
      eventType: "DINGTALK_READONLY_INGEST",
      status: input.status,
      trustedContext: jsonStringify({
        provider: "DINGTALK",
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
          ? trimText(String(input.payload.message ?? "DingTalk read-only ingest failed"), 500)
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
  const sessionKey = `${input.workspaceId}:dingtalk-readonly:${input.runtimeEventId}`;
  return db.runtimeSession.upsert({
    where: { sessionKey },
    update: {
      currentStage: "dingtalk_readonly_ingest",
      sourcePage: input.sourcePage,
      boundaryNote: DINGTALK_READONLY_INGEST_BOUNDARY_NOTE,
      status: "ACTIVE",
    },
    create: {
      workspaceId: input.workspaceId,
      runtimeEventId: input.runtimeEventId,
      sessionKey,
      label: "DingTalk read-only ingestion session",
      status: "ACTIVE",
      currentStage: "dingtalk_readonly_ingest",
      sourcePage: input.sourcePage,
      boundaryNote: DINGTALK_READONLY_INGEST_BOUNDARY_NOTE,
      budgetTokenLimit: 6000,
      replayableEventLog: jsonStringify([
        {
          stage: "dingtalk_readonly_ingest",
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
  persistedPayloadCount: number;
  unresolvedScopeCount: number;
  notebookMessage: string;
}) {
  return db.sessionNotebook.upsert({
    where: { runtimeSessionId: input.runtimeSessionId },
    update: {
      sessionSummary: input.notebookMessage,
      decisionSummary:
        input.persistedPayloadCount > 0
          ? "DingTalk MCP ingest path is established and persisted as review-first payloads."
          : "No DingTalk payloads were persisted in the current window.",
      blockerSummary:
        input.unresolvedScopeCount > 0
          ? "Some DingTalk MCP scopes remain unresolved or failed in current repo truth."
          : null,
      pendingQuestions:
        input.unresolvedScopeCount > 0
          ? jsonStringify([
              "Verify missing MCP profiles/tools or provider permissions.",
              "Confirm whether unresolved scopes should stay bounded in current trial stage.",
            ])
          : null,
      openLoopSummary:
        input.unresolvedScopeCount > 0
          ? "Keep unresolved DingTalk scopes review-first until MCP profile contracts are stable."
          : "Review persisted DingTalk payloads before promoting any follow-through.",
      boundaryNote: DINGTALK_READONLY_INGEST_BOUNDARY_NOTE,
    },
    create: {
      workspaceId: input.workspaceId,
      runtimeSessionId: input.runtimeSessionId,
      sessionSummary: input.notebookMessage,
      decisionSummary:
        input.persistedPayloadCount > 0
          ? "DingTalk MCP ingest path is established and persisted as review-first payloads."
          : "No DingTalk payloads were persisted in the current window.",
      blockerSummary:
        input.unresolvedScopeCount > 0
          ? "Some DingTalk MCP scopes remain unresolved or failed in current repo truth."
          : null,
      pendingQuestions:
        input.unresolvedScopeCount > 0
          ? jsonStringify([
              "Verify missing MCP profiles/tools or provider permissions.",
              "Confirm whether unresolved scopes should stay bounded in current trial stage.",
            ])
          : null,
      openLoopSummary:
        input.unresolvedScopeCount > 0
          ? "Keep unresolved DingTalk scopes review-first until MCP profile contracts are stable."
          : "Review persisted DingTalk payloads before promoting any follow-through.",
      boundaryNote: DINGTALK_READONLY_INGEST_BOUNDARY_NOTE,
    },
  });
}

function toSourceProvenance(scopeResults: DingTalkMcpScopeFetchResult[]) {
  return scopeResults.map((scopeResult) => ({
    provider: "DINGTALK",
    scope: scopeResult.scope,
    docUrl: scopeResult.docUrl,
    contractStatus:
      scopeResult.status === "INGESTED"
        ? "VERIFIED"
        : scopeResult.status === "FAILED"
          ? "FAILED"
          : "UNRESOLVED",
    message: scopeResult.message,
  }));
}

function toScopeStatus(status: DingTalkMcpScopeFetchResult["status"]) {
  if (status === "INGESTED") {
    return DINGTALK_READONLY_INGEST_SCOPE_STATUSES.INGESTED;
  }
  if (status === "FAILED") {
    return DINGTALK_READONLY_INGEST_SCOPE_STATUSES.FAILED;
  }
  return DINGTALK_READONLY_INGEST_SCOPE_STATUSES.UNRESOLVED;
}

function buildDerivedScopeResult(input: {
  scope: "MEETINGS" | "MANAGEMENT";
  records: Array<{ sourceId: string }>;
  upstreamReady: boolean;
  english: boolean;
}) {
  const ingested = input.records.length > 0 || input.upstreamReady;
  return buildScopeResult({
    scope: input.scope,
    status: ingested
      ? DINGTALK_READONLY_INGEST_SCOPE_STATUSES.INGESTED
      : DINGTALK_READONLY_INGEST_SCOPE_STATUSES.UNRESOLVED,
    message:
      input.records.length > 0
        ? input.english
          ? `${input.scope} is derived through bounded mapping policy and persisted in review-first mode.`
          : `${input.scope} 已通过受控映射策略生成并以复核优先 方式持久化。`
        : ingested
          ? input.english
            ? `${input.scope} is derivation-ready, but current MCP window returned no source records.`
            : `${input.scope} 派生链路可用，但当前 MCP 窗口没有可派生的源记录。`
          : input.english
            ? `${input.scope} could not be derived from current MCP payload window.`
            : `${input.scope} 在当前 MCP payload 窗口中未能派生。`,
    docUrl: DINGTALK_SCOPE_DOCS[input.scope] ?? null,
    persistedPayloadCount: input.records.length,
    ingestionRecordCount: input.records.length,
    handleCount: input.records.length,
    latestSourceId: input.records[0]?.sourceId ?? null,
  });
}

export async function syncDingTalkReadonlyConnector(input: {
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
        provider: ConnectorProvider.DINGTALK,
      },
    },
  });

  const sourcePage = input.sourcePage ?? DINGTALK_READONLY_INGEST_SOURCE_PAGE;
  const metadata = parseDingTalkConnectorMetadata(connector?.metadata);
  const mcpConfig = getDingTalkMcpConfig();
  const resolvedConnector =
    connector ??
    (await db.connector.upsert({
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
        status: ConnectorStatus.CONNECTED,
        externalAccountEmail: null,
        lastSyncStatus: input.english
          ? "MCP configured, waiting for first sync"
          : "MCP 已配置，等待首次同步",
        metadata: jsonStringify({
          ...metadata,
          authMode: "mcp_gateway",
        }),
      },
      update: {},
    }));
  const callbackUserId = metadata.lastCallbackResult?.providerUserId ?? null;
  const callbackUnionId = metadata.lastCallbackResult?.providerUnionId ?? null;
  const { windowStart, windowEnd } = buildCalendarWindow();
  const { windowStart: workWindowStart, windowEnd: workWindowEnd } = buildWorkWindow();

  if (!isDingTalkMcpConfigured()) {
    const unresolvedScopes = metadata.readOnlyCoverage.map((scope) =>
      buildScopeResult({
        scope,
        status: DINGTALK_READONLY_INGEST_SCOPE_STATUSES.UNRESOLVED,
        message: input.english
          ? "DingTalk MCP prerequisites are missing: check client id/secret, robot code, agent id, and corp id."
          : "钉钉 MCP 前提缺失：请检查 client id/secret、robot code、agent id 和 corp id。",
        docUrl: DINGTALK_SCOPE_DOCS[scope] ?? null,
      }),
    );
    const ingestResult = buildDingTalkIngestResult({
      status: DINGTALK_READONLY_INGEST_RESULT_STATUSES.UNRESOLVED,
      failurePosture: DINGTALK_CALLBACK_FAILURE_POSTURES.REVIEW_REQUIRED,
      sourcePage,
      message: buildStatusMessage(
        DINGTALK_READONLY_INGEST_RESULT_STATUSES.UNRESOLVED,
        input.english,
        {
          persistedPayloadCount: 0,
          unresolvedScopeCount: unresolvedScopes.length,
          failureReason: input.english
            ? "DingTalk read-only ingest remains unresolved because MCP config is incomplete."
            : "钉钉只读采集仍未解析，因为 MCP 配置不完整。",
        },
      ),
      windowStart,
      windowEnd,
      scopeResults: unresolvedScopes,
    });
    const runtimeEvent = await createRuntimeEvent({
      workspaceId: input.workspaceId,
      connectorId: resolvedConnector.id,
      triggeredBy: input.triggeredBy,
      status: RuntimeEventStatus.COMPLETED,
      payload: ingestResult,
      sourceProvenance: unresolvedScopes.map((scope) => ({
        provider: "DINGTALK",
        scope: scope.scope,
        docUrl: scope.docUrl,
        contractStatus: "UNRESOLVED",
      })),
    });
    const resolvedResult = {
      ...ingestResult,
      runtimeEventId: runtimeEvent.id,
    } satisfies DingTalkReadOnlyIngestResult;
    const updatedConnector = await persistDingTalkConnectorIngestResult({
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
    } satisfies DingTalkReadonlyConnectorSyncResult;
  }

  try {
    const seedSubjects = resolveSubjectCandidates({
      callbackUserId,
      callbackUnionId,
      configuredUserId: mcpConfig.userId,
      configuredUnionId: mcpConfig.userUnionId,
    });
    const batchDeptIds = parsePositiveIntegerCsvEnv(process.env.DINGTALK_BATCH_DEPT_IDS);
    const excludedDeptIds = parsePositiveIntegerCsvEnv(process.env.DINGTALK_EXCLUDED_DEPT_IDS);
    const excludedDeptNames = uniqueStrings(parseCsvEnv(process.env.DINGTALK_EXCLUDED_DEPT_NAMES));
    const enterpriseReadAll = process.env.DINGTALK_ENTERPRISE_READ_ALL === "1";
    const discoveryDeptIds =
      batchDeptIds.length > 0 ? batchDeptIds : enterpriseReadAll ? [1] : [];
    const seedUserIds = uniqueStrings(
      seedSubjects.map((subject) => subject.userId).filter((value): value is string => Boolean(value)),
    );
    const seedUnionIds = uniqueStrings(
      seedSubjects.map((subject) => subject.unionId).filter((value): value is string => Boolean(value)),
    );
    const maxUsers = Number(process.env.DINGTALK_BATCH_MAX_USERS || 200);
    const cacheKey = buildSubjectDiscoveryCacheKey({
      seedUserIds,
      seedUnionIds,
      deptIds: discoveryDeptIds,
      excludedDeptIds,
      excludedDeptNames,
      maxUsers,
    });
    const bypassCache = process.env.DINGTALK_SUBJECT_DISCOVERY_CACHE_BYPASS === "1";
    const cacheTtlMinutes = getSubjectDiscoveryCacheTtlMinutes();
    const cachedSubjectDiscovery = metadata.subjectDiscoveryCache;
    const cacheRecordedAt = cachedSubjectDiscovery?.recordedAt
      ? Date.parse(cachedSubjectDiscovery.recordedAt)
      : Number.NaN;
    const cacheAgeMinutes = Number.isFinite(cacheRecordedAt)
      ? (Date.now() - cacheRecordedAt) / (1000 * 60)
      : Number.POSITIVE_INFINITY;
    const canUseCachedSubjects =
      !bypassCache &&
      cachedSubjectDiscovery &&
      cachedSubjectDiscovery.cacheKey === cacheKey &&
      cacheAgeMinutes <= cacheTtlMinutes &&
      cachedSubjectDiscovery.subjects.length > 0;
    traceWorkflow(canUseCachedSubjects ? "cache_hit" : "cache_miss", {
      cacheKey,
      bypassCache,
      cacheAgeMinutes,
      cacheTtlMinutes,
      cachedSubjectCount: cachedSubjectDiscovery?.subjects.length ?? 0,
    });
    const discoveredSubjects = canUseCachedSubjects
      ? dedupeSubjects(
          cachedSubjectDiscovery.subjects.map((subject) => ({
            userId: subject.userId ?? null,
            unionId: subject.unionId ?? null,
            source: subject.source,
          })),
        )
      : await discoverDingTalkMcpSubjects({
          seedUserIds,
          seedUnionIds,
          deptIds: discoveryDeptIds,
          excludedDeptIds,
          excludedDeptNames,
          maxUsers,
        });
    if (!canUseCachedSubjects && discoveredSubjects.length > 0) {
      const nextMetadata = {
        ...metadata,
        subjectDiscoveryCache: {
          recordedAt: new Date().toISOString(),
          cacheKey,
          subjects: discoveredSubjects.map((subject) => ({
            userId: subject.userId ?? null,
            unionId: subject.unionId ?? null,
            source: subject.source,
          })),
        },
      };
      await db.connector.update({
        where: { id: resolvedConnector.id },
        data: {
          metadata: jsonStringify(nextMetadata),
        },
      });
      metadata.subjectDiscoveryCache = nextMetadata.subjectDiscoveryCache;
    }
    const resolvedSubjects =
      discoveredSubjects.length > 0
        ? dedupeSubjects([...discoveredSubjects, ...seedSubjects])
        : seedSubjects.length > 0
          ? seedSubjects
          : [{ userId: null, unionId: null, source: "implicit_unresolved_subject" }];
    const mcpResultsBySubject: Array<{
      subject: DingTalkMcpSubject;
      result: Awaited<ReturnType<typeof fetchDingTalkMcpScopeData>>;
    }> = [];

    for (const subject of resolvedSubjects) {
      const subjectResult = await fetchDingTalkMcpScopeData({
        providerSubjectId: subject.unionId ?? null,
        providerUnionId: subject.unionId,
        providerUserId: subject.userId,
        windowStart,
        windowEnd,
        workWindowStart,
        workWindowEnd,
      });
      mcpResultsBySubject.push({
        subject,
        result: subjectResult,
      });
    }

    const mergedScopeMap = new Map<
      DingTalkMcpScopeFetchResult["scope"],
      {
        scope: DingTalkMcpScopeFetchResult["scope"];
        statuses: DingTalkMcpScopeFetchResult["status"][];
        docUrl: string | null;
        messages: string[];
        records: DingTalkMcpScopeFetchResult["records"];
      }
    >();
    const activeProfiles = new Set<string>();
    let discoveredToolCount = 0;

    mcpResultsBySubject.forEach(({ subject, result }, index) => {
      for (const profile of result.activeProfiles) {
        activeProfiles.add(profile);
      }
      discoveredToolCount = Math.max(discoveredToolCount, result.toolCount);
      const subjectLabel = buildSubjectLabel(subject, index);
      result.scopeResults.forEach((scopeResult) => {
        const current =
          mergedScopeMap.get(scopeResult.scope) ??
          {
            scope: scopeResult.scope,
            statuses: [],
            docUrl: scopeResult.docUrl,
            messages: [],
            records: [],
          };
        current.statuses.push(scopeResult.status);
        if (scopeResult.message) {
          current.messages.push(`[${subjectLabel}] ${scopeResult.message}`);
        }
        const shouldKeepGlobalIdentity =
          scopeResult.scope === "WORK" || scopeResult.scope === "MESSAGE_NOTIFICATIONS";
        const existingRecordKeys = new Set(
          current.records.map((record) => `${record.sourceType}::${record.sourceId}`),
        );

        for (const record of scopeResult.records) {
          const normalizedSourceId = shouldKeepGlobalIdentity
            ? record.sourceId
            : `${subjectLabel}:${record.sourceId}`;
          const dedupeKey = `${record.sourceType}::${normalizedSourceId}`;
          if (existingRecordKeys.has(dedupeKey)) {
            continue;
          }
          existingRecordKeys.add(dedupeKey);
          current.records.push({
            ...record,
            sourceId: normalizedSourceId,
            evidenceRef: shouldKeepGlobalIdentity
              ? record.evidenceRef
              : `${record.evidenceRef}:${subjectLabel}`,
            draftPayload: {
              ...record.draftPayload,
              subject: {
                userId: subject.userId,
                unionId: subject.unionId,
                source: subject.source,
              },
            },
          });
        }
        mergedScopeMap.set(scopeResult.scope, current);
      });
    });

    const mcpResult = {
      scopeResults: [...mergedScopeMap.values()].map((scopeResult) => {
        const status = scopeResult.statuses.includes("FAILED")
          ? "FAILED"
          : scopeResult.statuses.includes("UNRESOLVED")
            ? "UNRESOLVED"
            : "INGESTED";
        return {
          scope: scopeResult.scope,
          status,
          message:
            scopeResult.messages.length > 0
              ? trimText(scopeResult.messages.join(" | "), 300)
              : null,
          docUrl: scopeResult.docUrl,
          records: scopeResult.records,
        } satisfies DingTalkMcpScopeFetchResult;
      }),
      activeProfiles: [...activeProfiles],
      toolCount: discoveredToolCount,
      subjectCount: resolvedSubjects.length,
    };

    const runtimeEvent = await createRuntimeEvent({
      workspaceId: input.workspaceId,
      connectorId: resolvedConnector.id,
      triggeredBy: input.triggeredBy,
      status: RuntimeEventStatus.COMPLETED,
      payload: {
        provider: "DINGTALK",
        stage: "read_only_ingest",
        mode: "mcp_gateway",
        windowStart: windowStart.toISOString(),
        windowEnd: windowEnd.toISOString(),
        workWindowStart: workWindowStart.toISOString(),
        workWindowEnd: workWindowEnd.toISOString(),
        activeProfiles: mcpResult.activeProfiles,
        discoveredToolCount: mcpResult.toolCount,
        subjectCount: mcpResult.subjectCount,
      },
      sourceProvenance: toSourceProvenance(mcpResult.scopeResults),
    });

    const baseRecords: RuntimeDingTalkRecord[] = mcpResult.scopeResults.flatMap((scope) =>
      scope.records.map((record) => ({
        ...record,
        scope: record.scope as DingTalkReadOnlyScope,
      })),
    );
    const meetingRecords = deriveMeetingRecordsFromCalendar(
      baseRecords.filter((record) => record.scope === "CALENDAR") as DingTalkMcpRecord[],
    );
    const managementRecords = deriveManagementRecords({
      todoRecords: baseRecords.filter((record) => record.scope === "TODO") as DingTalkMcpRecord[],
      workRecords: baseRecords.filter(
        (record) => record.scope === "WORK" || record.scope === "MESSAGE_NOTIFICATIONS",
      ) as DingTalkMcpRecord[],
    });

    const runtimeSession = await ensureRuntimeSession({
      workspaceId: input.workspaceId,
      runtimeEventId: runtimeEvent.id,
      connectorId: resolvedConnector.id,
      sourcePage,
    });

    const objectLinkContext = await buildObjectLinkContext({
      workspaceId: input.workspaceId,
      referenceTime: new Date(),
    });

    const normalizedPayloads: NormalizedSourcePayload[] = [];
    const workflowSignals: Array<{
      scope: DingTalkReadOnlyScope;
      sourceId: string;
      sourceType: string;
      label: string;
      summary: string;
      opportunityId: string | null;
      meetingId: string | null;
      companyId: string | null;
      objectLinkState: "matched" | "unmatched";
      objectLinkReason: string | null;
      extractedFields: ReturnType<typeof extractWorkflowFields>;
    }> = [];

    for (const record of [...baseRecords, ...meetingRecords, ...managementRecords]) {
      const objectLink = resolveRecordObjectLink({
        record,
        context: objectLinkContext,
      });
      if (objectLink.scopePrefix === "WORKSPACE") {
        traceWorkflow("unmatched_reason", {
          scope: record.scope,
          sourceType: record.sourceType,
          sourceId: record.sourceId,
          reason: objectLink.reason,
        });
      }
      const extractedFields = extractWorkflowFields(record);
      const payload = normalizeMcpRecordToPayload({
        workspaceId: input.workspaceId,
        connectorId: resolvedConnector.id,
        providerSubjectId: record.draftPayload.subject
          ? jsonStringify(record.draftPayload.subject)
          : (callbackUnionId ?? callbackUserId ?? mcpConfig.userUnionId ?? mcpConfig.userId ?? null),
        runtimeEventId: runtimeEvent.id,
        record,
        objectLink,
      });
      if (payload) {
        payload.draftPayload = {
          ...payload.draftPayload,
          classification: payload.classification,
          extractedFields,
          objectLink: {
            meetingId: objectLink.meetingId,
            opportunityId: objectLink.opportunityId,
            companyId: objectLink.companyId,
            contactId: objectLink.contactId,
            reason: objectLink.reason,
            score: objectLink.score,
            matchedBy: objectLink.matchedBy,
          },
        };
        normalizedPayloads.push(payload);
        workflowSignals.push({
          scope: payload.scope,
          sourceId: payload.sourceId,
          sourceType: payload.sourceType,
          label: payload.label,
          summary: payload.summary,
          opportunityId: objectLink.opportunityId,
          meetingId: objectLink.meetingId,
          companyId: objectLink.companyId,
          objectLinkState:
            objectLink.scopePrefix === "OBJECT" ? "matched" : "unmatched",
          objectLinkReason: objectLink.reason,
          extractedFields,
        });
        traceWorkflow("matched_object", {
          scope: payload.scope,
          sourceId: payload.sourceId,
          sourceScope:
            objectLink.scopePrefix === "OBJECT"
              ? `OBJECT:${payload.scope}`
              : `WORKSPACE:${payload.scope}`,
          meetingId: objectLink.meetingId,
          opportunityId: objectLink.opportunityId,
          companyId: objectLink.companyId,
          linkReason: objectLink.reason,
          linkScore: objectLink.score,
        });
      }
    }

    const freshPayloads = await filterFreshPayloads(
      input.workspaceId,
      normalizedPayloads,
    );
    const freshSignalKeySet = new Set(
      freshPayloads.map((payload) => `${payload.scope}::${payload.sourceType}::${payload.sourceId}`),
    );
    const freshWorkflowSignals = workflowSignals.filter((signal) =>
      freshSignalKeySet.has(`${signal.scope}::${signal.sourceType}::${signal.sourceId}`),
    );

    for (const payload of freshPayloads) {
      const payloadKey = `${input.workspaceId}:dingtalk:${payload.scope}:${payload.sourceType}:${payload.sourceId}`;
      await db.persistedPayload.upsert({
        where: { payloadKey },
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
          meetingId: payload.objectRefs.meetingId,
          opportunityId: payload.objectRefs.opportunityId,
          companyId: payload.objectRefs.companyId,
          payloadKey,
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

    if (freshPayloads.length > 0) {
      await db.connectorIngestionRecord.createMany({
        data: freshPayloads.map((payload) => ({
          workspaceId: input.workspaceId,
          runtimeEventId: runtimeEvent.id,
          meetingId: payload.objectRefs.meetingId,
          opportunityId: payload.objectRefs.opportunityId,
          companyId: payload.objectRefs.companyId,
          sourceType: payload.sourceType,
          sourceId: payload.sourceId,
          sourceScope: `${payload.objectRefs.meetingId || payload.objectRefs.opportunityId || payload.objectRefs.companyId ? "OBJECT" : "WORKSPACE"}:${payload.scope}`,
          trustLevel: "trusted",
          trustPromotionStatus: "draft_only",
          sensitivity: "internal",
          normalizationStatus: "normalized",
          promotionEligibility: "draft_only",
          objectRefs: jsonStringify(payload.objectRefs),
          evidenceRef: payload.evidenceRef,
          extractedFacts: jsonStringify(payload.extractedFacts),
          draftPayload: jsonStringify({
            ...payload.draftPayload,
            classification: payload.classification,
          }),
          sourceSummary: payload.sourceSummary,
          boundaryNote: payload.boundaryNote,
        })),
      });
    }

    const bridgeEnabled = process.env.DINGTALK_WORKFLOW_BRIDGE_ENABLED !== "0";
    const autoCreateActions =
      process.env.DINGTALK_WORKFLOW_AUTOCREATE_ACTIONS === "1";
    const bridgeResult = bridgeEnabled
      ? await bridgeDingTalkSignalsToWorkflow({
          workspaceId: input.workspaceId,
          actorName: input.triggeredBy,
          actorUserId: input.userId,
          english: input.english,
          sourcePage,
          autoCreateActions,
          signals: freshWorkflowSignals,
        })
      : null;
    const workMemoryFlowResult = await upsertWorkMemoryFlow({
      workspaceId: input.workspaceId,
      records: freshPayloads,
    });
    const workMemorySanitizeResult = await sanitizeLegacyDingTalkWorkMemories(input.workspaceId);
    traceWorkflow("work_memory_flow", workMemoryFlowResult);
    traceWorkflow("work_memory_sanitize", workMemorySanitizeResult);
    if (bridgeEnabled && bridgeResult) {
      traceWorkflow("action_created", {
        actionCreated: bridgeResult.actionCreatedCount,
        approvalEnqueued: bridgeResult.approvalEnqueuedCount,
      });
      traceWorkflow("dedup_skipped", {
        dedupSkipped: bridgeResult.dedupSkippedCount,
      });
    }

    const explicitScopeResults = mcpResult.scopeResults.map((scopeResult) =>
      buildScopeResult({
        scope: scopeResult.scope,
        status: toScopeStatus(scopeResult.status),
        message: scopeResult.message,
        docUrl: scopeResult.docUrl,
        persistedPayloadCount: scopeResult.records.length,
        ingestionRecordCount: scopeResult.records.length,
        handleCount: scopeResult.records.length,
        latestSourceId: scopeResult.records[0]?.sourceId ?? null,
      }),
    );
    const scopeStatusMap = new Map(
      mcpResult.scopeResults.map((scopeResult) => [scopeResult.scope, scopeResult.status] as const),
    );

    const derivedScopeResults = [
      buildDerivedScopeResult({
        scope: "MEETINGS",
        records: meetingRecords,
        upstreamReady: scopeStatusMap.get("CALENDAR") === "INGESTED",
        english: input.english,
      }),
      buildDerivedScopeResult({
        scope: "MANAGEMENT",
        records: managementRecords,
        upstreamReady:
          scopeStatusMap.get("TODO") === "INGESTED" && scopeStatusMap.get("WORK") === "INGESTED",
        english: input.english,
      }),
    ];

    const scopeResults = [...explicitScopeResults, ...derivedScopeResults];

    const unresolvedScopeCount = scopeResults.filter(
      (scope) => scope.status !== DINGTALK_READONLY_INGEST_SCOPE_STATUSES.INGESTED,
    ).length;

    const notebookMessage =
      freshPayloads.length > 0
        ? input.english
          ? `DingTalk MCP read-only ingest persisted ${freshPayloads.length} new payloads across calendar/todo/project/work scopes. Remaining unresolved scopes stay explicit in current repo truth.`
          : `钉钉 MCP 只读采集已新增写入 ${freshPayloads.length} 条资料，覆盖日程、待办、项目和工作范围；未解析范围继续显式保留。`
        : input.english
          ? "DingTalk MCP read-only ingest ran successfully but returned no new records in the bounded window."
          : "钉钉 MCP 只读采集已执行，但当前窗口没有新增可写入记录。";

    const notebook = await upsertSessionNotebook({
      workspaceId: input.workspaceId,
      runtimeSessionId: runtimeSession.id,
      persistedPayloadCount: freshPayloads.length,
      unresolvedScopeCount,
      notebookMessage,
    });

    const resultStatus =
      unresolvedScopeCount > 0
        ? DINGTALK_READONLY_INGEST_RESULT_STATUSES.PARTIAL
        : DINGTALK_READONLY_INGEST_RESULT_STATUSES.SUCCESS;

    const ingestResult = buildDingTalkIngestResult({
      status: resultStatus,
      failurePosture: DINGTALK_CALLBACK_FAILURE_POSTURES.REVIEW_REQUIRED,
      sourcePage,
      message: buildStatusMessage(resultStatus, input.english, {
        persistedPayloadCount: freshPayloads.length,
        unresolvedScopeCount,
      }),
      runtimeEventId: runtimeEvent.id,
      runtimeSessionId: runtimeSession.id,
      notebookId: notebook.id,
      windowStart,
      windowEnd,
      persistedPayloadCount: freshPayloads.length,
      ingestionRecordCount: freshPayloads.length,
      handleCount: freshPayloads.length,
      scopeResults,
    });

    await db.runtimeEvent.update({
      where: { id: runtimeEvent.id },
      data: {
        payload: jsonStringify({
          ...ingestResult,
          mcp: {
            activeProfiles: getDingTalkMcpActiveProfiles(),
            discoveredToolCount: mcpResult.toolCount,
            subjectCount: mcpResult.subjectCount,
          },
          workflowBridge: bridgeEnabled
            ? {
                enabled: true,
                autoCreateActions,
                ...(bridgeResult ?? {}),
              }
            : {
                enabled: false,
              },
          workMemoryFlow: workMemoryFlowResult,
          workMemorySanitize: workMemorySanitizeResult,
        }),
        completedAt: new Date(),
      },
    });

    const updatedConnector = await persistDingTalkConnectorIngestResult({
      workspaceId: input.workspaceId,
      userId: input.userId,
      connectorStatus: ConnectorStatus.CONNECTED,
      lastSyncStatus:
        resultStatus === DINGTALK_READONLY_INGEST_RESULT_STATUSES.SUCCESS
          ? "同步完成"
          : "部分完成",
      lastSyncMessage: ingestResult.message,
      ingestResult,
    });

    return {
      connectorId: updatedConnector.id,
      status: ingestResult.status,
      ingestResult,
    } satisfies DingTalkReadonlyConnectorSyncResult;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : input.english
          ? "DingTalk MCP read-only ingest failed."
          : "钉钉 MCP 只读采集失败。";

    const unresolvedScopes = metadata.readOnlyCoverage.map((scope) =>
      buildScopeResult({
        scope,
        status: DINGTALK_READONLY_INGEST_SCOPE_STATUSES.FAILED,
        message,
        docUrl: DINGTALK_SCOPE_DOCS[scope] ?? null,
      }),
    );

    const ingestResult = buildDingTalkIngestResult({
      status: DINGTALK_READONLY_INGEST_RESULT_STATUSES.FAILURE,
      failurePosture: DINGTALK_CALLBACK_FAILURE_POSTURES.RETRYABLE,
      sourcePage,
      message: buildStatusMessage(
        DINGTALK_READONLY_INGEST_RESULT_STATUSES.FAILURE,
        input.english,
        {
          persistedPayloadCount: 0,
          unresolvedScopeCount: unresolvedScopes.length,
          failureReason: message,
        },
      ),
      windowStart,
      windowEnd,
      scopeResults: unresolvedScopes,
    });

    const runtimeEvent = await createRuntimeEvent({
      workspaceId: input.workspaceId,
      connectorId: resolvedConnector.id,
      triggeredBy: input.triggeredBy,
      status: RuntimeEventStatus.FAILED,
      payload: ingestResult,
      sourceProvenance: unresolvedScopes.map((scope) => ({
        provider: "DINGTALK",
        scope: scope.scope,
        docUrl: scope.docUrl,
        contractStatus: "FAILED",
      })),
    });

    const resolvedResult = {
      ...ingestResult,
      runtimeEventId: runtimeEvent.id,
    } satisfies DingTalkReadOnlyIngestResult;

    const updatedConnector = await persistDingTalkConnectorIngestResult({
      workspaceId: input.workspaceId,
      userId: input.userId,
      connectorStatus: ConnectorStatus.ERROR,
      lastSyncStatus: "同步失败",
      lastSyncMessage: resolvedResult.message,
      ingestResult: resolvedResult,
    });

    return {
      connectorId: updatedConnector.id,
      status: resolvedResult.status,
      ingestResult: resolvedResult,
    } satisfies DingTalkReadonlyConnectorSyncResult;
  }
}
