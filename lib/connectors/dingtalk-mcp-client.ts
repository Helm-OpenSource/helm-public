import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { redactProviderErrorBody } from "@/lib/connectors/error-redaction";
import { jsonStringify, trimText } from "@/lib/utils";

const MCP_CLIENT_NAME = "helm-dingtalk-ingestion";
const MCP_CLIENT_VERSION = "1.0.0";
const DEFAULT_MCP_COMMAND = "npx";
const DEFAULT_MCP_ARGS = ["-y", "dingtalk-mcp@latest"];
const DEFAULT_MCP_TIMEOUT_MS = 120_000;
const DEFAULT_MCP_READY_TIMEOUT_MS = 120_000;
const DEFAULT_WORK_MAX_PAGES = 3;
const DEFAULT_MCP_PROFILES = [
  "dingtalk-contacts",
  "dingtalk-department",
  "dingtalk-calendar",
  "dingtalk-tasks",
  "dingtalk-teambition",
  "dingtalk-report",
] as const;

type JsonRpcId = number;

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
};

type JsonRpcNotification = {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
};

type JsonRpcResponse = {
  jsonrpc?: string;
  id?: JsonRpcId;
  result?: unknown;
  error?: {
    code?: number;
    message?: string;
    data?: unknown;
  };
};

type McpToolDefinition = {
  name: string;
  description?: string;
  inputSchema?: {
    properties?: Record<string, unknown>;
    required?: string[];
  };
};

export type DingTalkMcpScope =
  | "CALENDAR"
  | "MEETINGS"
  | "TODO"
  | "PROJECTS"
  | "MANAGEMENT"
  | "WORK"
  | "MESSAGE_NOTIFICATIONS";

export type DingTalkMcpRecord = {
  scope: Exclude<DingTalkMcpScope, "MEETINGS" | "MANAGEMENT">;
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

export type DingTalkMcpScopeFetchResult = {
  scope: Exclude<DingTalkMcpScope, "MEETINGS" | "MANAGEMENT">;
  status: "INGESTED" | "UNRESOLVED" | "FAILED";
  message: string | null;
  docUrl: string | null;
  records: DingTalkMcpRecord[];
};

export type DingTalkMcpSubject = {
  userId: string | null;
  unionId: string | null;
  source: string;
};

const DINGTALK_SCOPE_PROFILES: Array<{
  scope: Exclude<DingTalkMcpScope, "MEETINGS" | "MANAGEMENT">;
  profile: string;
  docUrl: string | null;
  sourceType: string;
  sourceSummary: string;
  defaultUnresolved: string;
  keywordHints: string[];
}> = [
  {
    scope: "CALENDAR",
    profile: "dingtalk-calendar",
    docUrl: "https://open.dingtalk.com/document/personalapp/query-an-event-list-1",
    sourceType: "calendar_event",
    sourceSummary: "DingTalk calendar event fetched through MCP profile dingtalk-calendar.",
    defaultUnresolved: "DingTalk MCP calendar profile is unavailable in current runtime.",
    keywordHints: ["calendar", "event", "schedule", "日程"],
  },
  {
    scope: "TODO",
    profile: "dingtalk-tasks",
    docUrl: "https://open.dingtalk.com/document/orgapp-server/overview-of-to-do",
    sourceType: "todo_task",
    sourceSummary: "DingTalk todo task fetched through MCP profile dingtalk-tasks.",
    defaultUnresolved: "DingTalk MCP tasks profile is unavailable in current runtime.",
    keywordHints: ["todo", "task", "待办"],
  },
  {
    scope: "PROJECTS",
    profile: "dingtalk-teambition",
    docUrl: "https://open.dingtalk.com/document/orgapp-server/teambition-overview",
    sourceType: "project_item",
    sourceSummary: "DingTalk project item fetched through MCP profile dingtalk-teambition.",
    defaultUnresolved: "DingTalk MCP teambition profile is unavailable in current runtime.",
    keywordHints: ["project", "teambition", "项目"],
  },
  {
    scope: "WORK",
    profile: "dingtalk-report",
    docUrl: "https://open.dingtalk.com/document/orgapp-server/query-work-records",
    sourceType: "work_report",
    sourceSummary: "DingTalk work report fetched through MCP profile dingtalk-report.",
    defaultUnresolved: "DingTalk MCP report profile is unavailable in current runtime.",
    keywordHints: ["report", "log", "work", "日志", "工作"],
  },
];

const DINGTALK_SCOPE_READ_TOOL_CANDIDATES: Record<
  Exclude<DingTalkMcpScope, "MEETINGS" | "MANAGEMENT">,
  string[]
> = {
  CALENDAR: ["getCalendarView", "getEvent"],
  TODO: ["queryTasks"],
  PROJECTS: [
    "listUserProjectTasks",
    "queryProjectsByProjectName",
    "listProjectTasks",
    "queryProjectTaskDetail",
    "queryProjectStatusesByProjectId",
    "queryProjectMembersByProjectId",
  ],
  WORK: ["getReportList"],
  MESSAGE_NOTIFICATIONS: ["getSendResult", "getSendProgress"],
};

const DINGTALK_WRITE_TOOL_PREFIXES = [
  "create",
  "update",
  "delete",
  "add",
  "remove",
  "send",
  "recall",
];

function parseCsvEnv(value: string | null | undefined) {
  if (!value || !value.trim()) {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getMcpCommand() {
  return process.env.DINGTALK_MCP_COMMAND?.trim() || DEFAULT_MCP_COMMAND;
}

function getMcpArgs() {
  const fromEnv = parseCsvEnv(process.env.DINGTALK_MCP_ARGS);
  return fromEnv.length > 0 ? fromEnv : [...DEFAULT_MCP_ARGS];
}

export function formatMcpStderrForError(stderr: string, maxLength: number = 600) {
  return trimText(redactProviderErrorBody(stderr || "n/a", maxLength), maxLength);
}

function isMessageNotificationReadbackEnabled() {
  return process.env.DINGTALK_ENABLE_MESSAGE_NOTIFICATIONS === "1";
}

function getDingTalkScopeProfiles() {
  if (!isMessageNotificationReadbackEnabled()) {
    return DINGTALK_SCOPE_PROFILES;
  }
  return [
    ...DINGTALK_SCOPE_PROFILES,
    {
      scope: "MESSAGE_NOTIFICATIONS",
      profile: "dingtalk-notice",
      docUrl: "https://open.dingtalk.com/document/orgapp/asynchronous-work-notification",
      sourceType: "message_notification",
      sourceSummary:
        "DingTalk message notification fetched through MCP profile dingtalk-notice.",
      defaultUnresolved:
        "DingTalk MCP message notification profile is unavailable in current runtime.",
      keywordHints: ["notice", "notification", "message", "消息", "通知"],
    },
  ] as const;
}

export function getDingTalkMcpActiveProfiles() {
  const configured = parseCsvEnv(process.env.DINGTALK_MCP_ACTIVE_PROFILES);
  if (configured.length > 0) {
    if (configured.includes("ALL")) {
      const defaults = [...DEFAULT_MCP_PROFILES] as string[];
      if (isMessageNotificationReadbackEnabled()) {
        defaults.push("dingtalk-notice");
      }
      return defaults;
    }
    return configured;
  }

  const defaults = [...DEFAULT_MCP_PROFILES] as string[];
  if (isMessageNotificationReadbackEnabled()) {
    defaults.push("dingtalk-notice");
  }
  return defaults;
}

function normalizeMcpToolDefinitions(value: unknown): McpToolDefinition[] {
  if (!value || typeof value !== "object") {
    return [];
  }

  const maybeTools = (value as { tools?: unknown }).tools;
  if (!Array.isArray(maybeTools)) {
    return [];
  }

  const normalized: McpToolDefinition[] = [];
  for (const item of maybeTools) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const name = (item as { name?: unknown }).name;
    const description = (item as { description?: unknown }).description;
    const inputSchema = (item as { inputSchema?: unknown }).inputSchema;
    if (typeof name !== "string" || !name.trim()) {
      continue;
    }
    normalized.push({
      name: name.trim(),
      description:
        typeof description === "string" && description.trim()
          ? description.trim()
          : undefined,
      inputSchema:
        inputSchema && typeof inputSchema === "object"
          ? {
              properties:
                (inputSchema as { properties?: unknown }).properties &&
                typeof (inputSchema as { properties?: unknown }).properties === "object"
                  ? ((inputSchema as { properties?: unknown }).properties as Record<string, unknown>)
                  : undefined,
              required: Array.isArray((inputSchema as { required?: unknown }).required)
                ? ((inputSchema as { required?: unknown }).required as unknown[])
                    .filter((required) => typeof required === "string")
                    .map((required) => String(required))
                : undefined,
            }
          : undefined,
    });
  }
  return normalized;
}

function getMcpTimeoutMs() {
  const fromEnv = Number(process.env.DINGTALK_MCP_TIMEOUT_MS);
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return fromEnv;
  }
  return DEFAULT_MCP_TIMEOUT_MS;
}

function getMcpReadyTimeoutMs() {
  const fromEnv = Number(process.env.DINGTALK_MCP_READY_TIMEOUT_MS);
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return fromEnv;
  }
  return DEFAULT_MCP_READY_TIMEOUT_MS;
}

function getWorkMaxPages() {
  const configured = Number(process.env.DINGTALK_WORK_MAX_PAGES);
  if (Number.isFinite(configured) && configured >= 1) {
    return Math.min(10, Math.trunc(configured));
  }
  return DEFAULT_WORK_MAX_PAGES;
}

function isMcpDebugEnabled() {
  return process.env.DINGTALK_MCP_DEBUG === "1";
}

function isMcpTraceEnabled() {
  return process.env.DINGTALK_MCP_TRACE === "1";
}

function isMcpTraceFullEnabled() {
  return process.env.DINGTALK_MCP_TRACE_FULL === "1";
}

function traceMcp(event: string, payload: unknown) {
  if (!isMcpTraceEnabled()) {
    return;
  }
  const text = JSON.stringify(payload);
  const output = isMcpTraceFullEnabled() ? text : trimText(text, 1500);
  console.error(`[dingtalk-mcp-trace] ${event}: ${output}`);
}

// Only pass the minimal runtime variables the DingTalk MCP child needs. This
// is intentionally allow-list based because the child process may execute an
// upstream `dingtalk-mcp@latest` package; inherited API keys from unrelated
// systems would increase the supply-chain blast radius.
const MCP_CHILD_BASE_ENV_KEYS = [
  "PATH",
  "HOME",
  "TMPDIR",
  "TEMP",
  "TMP",
  "LANG",
  "LC_ALL",
  "TZ",
  "NODE_ENV",
] as const;

export function buildMcpChildEnv(): Record<string, string> {
  const sanitized: Record<string, string> = {
    NODE_ENV: process.env.NODE_ENV ?? "development",
  };
  for (const key of MCP_CHILD_BASE_ENV_KEYS) {
    const value = process.env[key];
    if (value === undefined) {
      continue;
    }
    sanitized[key] = value;
  }
  // DingTalk-specific vars the upstream binary expects.
  sanitized.DINGTALK_Client_ID = process.env.DINGTALK_CLIENT_ID ?? "";
  sanitized.DINGTALK_Client_Secret = process.env.DINGTALK_CLIENT_SECRET ?? "";
  sanitized.DINGTALK_CLIENT_ID = process.env.DINGTALK_CLIENT_ID ?? "";
  sanitized.DINGTALK_CLIENT_SECRET = process.env.DINGTALK_CLIENT_SECRET ?? "";
  sanitized.ROBOT_CODE = process.env.DINGTALK_ROBOT_CODE ?? "";
  sanitized.DINGTALK_ROBOT_CODE = process.env.DINGTALK_ROBOT_CODE ?? "";
  sanitized.DINGTALK_AGENT_ID = process.env.DINGTALK_AGENT_ID ?? "";
  sanitized.DINGTALK_CORP_ID =
    process.env.DINGTALK_CORP_ID ?? process.env.DINGTALK_CORPID ?? "";
  sanitized.DINGTALK_CORPID =
    process.env.DINGTALK_CORPID ?? process.env.DINGTALK_CORP_ID ?? "";
  sanitized.ACTIVE_PROFILES = getDingTalkMcpActiveProfiles().join(",");
  return sanitized;
}

class McpStdioClient {
  private seq = 0;
  private stdoutBuffer = "";
  private stderrBuffer = "";
  private readyResolved = false;
  private readonly readyPromise: Promise<void>;
  private markReady!: () => void;
  private pending = new Map<JsonRpcId, {
    resolve: (value: unknown) => void;
    reject: (reason?: unknown) => void;
    timer: NodeJS.Timeout;
  }>();

  private constructor(private readonly child: ChildProcessWithoutNullStreams) {
    this.readyPromise = new Promise<void>((resolve) => {
      this.markReady = () => {
        if (!this.readyResolved) {
          this.readyResolved = true;
          resolve();
        }
      };
    });

    this.child.stdout.on("data", (chunk: Buffer | string) => {
      this.stdoutBuffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");
      if (isMcpDebugEnabled()) {
        console.error("[dingtalk-mcp] stdout raw", this.stdoutBuffer.slice(-300));
      }
      const lines = this.stdoutBuffer.split("\n");
      this.stdoutBuffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
          continue;
        }
        let payload: JsonRpcResponse | null = null;
        try {
          payload = JSON.parse(trimmed) as JsonRpcResponse;
        } catch {
          continue;
        }
        if (typeof payload.id !== "number") {
          continue;
        }
        const pending = this.pending.get(payload.id);
        if (!pending) {
          continue;
        }
        clearTimeout(pending.timer);
        this.pending.delete(payload.id);
        if (payload.error) {
          pending.reject(new Error(payload.error.message || "MCP request failed"));
        } else {
          pending.resolve(payload.result);
        }
      }
    });

    this.child.stderr.on("data", (chunk: Buffer | string) => {
      this.stderrBuffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");
      if (isMcpDebugEnabled()) {
        console.error("[dingtalk-mcp] stderr", formatMcpStderrForError(this.stderrBuffer, 300));
      }
      if (this.stderrBuffer.length > 4000) {
        this.stderrBuffer = this.stderrBuffer.slice(-4000);
      }
      if (/running on stdio|启动成功/i.test(this.stderrBuffer)) {
        this.markReady();
      }
    });

    const failAllPending = (reason: string) => {
      this.markReady();
      for (const [, pending] of this.pending) {
        clearTimeout(pending.timer);
        pending.reject(new Error(reason));
      }
      this.pending.clear();
    };

    this.child.once("exit", () => {
      failAllPending(
        `DingTalk MCP process exited unexpectedly. stderr: ${formatMcpStderrForError(this.stderrBuffer)}`,
      );
    });

    // Without an `error` listener a missing/unspawnable MCP binary (ENOENT —
    // the most common misconfiguration) emits an unhandled `error` on the child
    // and crashes the whole Node process; `exit` never fires in that case.
    this.child.once("error", (err: Error) => {
      failAllPending(`DingTalk MCP process failed to start: ${err.message}`);
    });
    // EPIPE on stdin after the child dies is emitted as `error` on the stream;
    // swallow it (pending requests are already rejected via exit/error).
    this.child.stdin.on("error", () => {});

    setTimeout(() => {
      this.markReady();
    }, getMcpReadyTimeoutMs());
  }

  static async create() {
    const { spawn } = await import("node:child_process");
    const child = spawn(
      /* turbopackIgnore: true */ getMcpCommand(),
      getMcpArgs(),
      {
        stdio: ["pipe", "pipe", "pipe"],
        env: buildMcpChildEnv() as unknown as NodeJS.ProcessEnv,
      },
    );
    return new McpStdioClient(child);
  }

  private async waitUntilReady() {
    if (isMcpDebugEnabled()) {
      console.error("[dingtalk-mcp] waiting ready");
    }
    await this.readyPromise;
    if (isMcpDebugEnabled()) {
      console.error("[dingtalk-mcp] ready resolved");
    }
  }

  async request(method: string, params?: Record<string, unknown>) {
    await this.waitUntilReady();
    const id = ++this.seq;
    const payload: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      ...(params ? { params } : {}),
    };

    return new Promise<unknown>((resolve, reject) => {
      const timeoutMs = getMcpTimeoutMs();
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new Error(
            `DingTalk MCP request timed out: ${method}. stderr: ${formatMcpStderrForError(this.stderrBuffer)}`,
          ),
        );
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      if (isMcpDebugEnabled()) {
        console.error("[dingtalk-mcp] send request", method);
      }
      try {
        this.child.stdin.write(`${JSON.stringify(payload)}\n`);
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(
          new Error(
            `DingTalk MCP request could not be written: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
      }
    });
  }

  notify(method: string, params?: Record<string, unknown>) {
    if (!this.readyResolved) {
      return;
    }
    const payload: JsonRpcNotification = {
      jsonrpc: "2.0",
      method,
      ...(params ? { params } : {}),
    };
    try {
      this.child.stdin.write(`${JSON.stringify(payload)}\n`);
    } catch {
      // Best-effort notification; the child has already gone away.
    }
  }

  close() {
    this.child.kill();
  }
}

function toScopeRecords(input: {
  scope: Exclude<DingTalkMcpScope, "MEETINGS" | "MANAGEMENT">;
  sourceType: string;
  sourceSummary: string;
  docUrl: string | null;
  rawPayload: unknown;
}) {
  const payload = input.rawPayload as Record<string, unknown> | null;
  const possibleLists: unknown[] = [];

  if (Array.isArray(payload)) {
    possibleLists.push(payload);
  } else if (payload && typeof payload === "object") {
    for (const key of [
      "data",
      "list",
      "items",
      "events",
      "tasks",
      "projects",
      "todos",
      "todoCards",
      "records",
      "result",
      "data_list",
    ]) {
      const value = payload[key];
      if (Array.isArray(value)) {
        possibleLists.push(value);
      } else if (value && typeof value === "object") {
        const nested = value as Record<string, unknown>;
        for (const nestedKey of [
          "list",
          "items",
          "records",
          "data",
          "events",
          "tasks",
          "projects",
          "todoCards",
          "result",
          "data_list",
        ]) {
          if (Array.isArray(nested[nestedKey])) {
            possibleLists.push(nested[nestedKey] as unknown[]);
          }
        }
      }
    }
  }

  const list =
    (possibleLists.find((candidate) => Array.isArray(candidate) && candidate.length > 0) as unknown[]) ??
    (possibleLists.find((candidate) => Array.isArray(candidate)) as unknown[]) ??
    [];

  const records: DingTalkMcpRecord[] = [];
  for (const [index, item] of list.entries()) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const row = item as Record<string, unknown>;
    const sourceIdRaw =
      row.id ??
      row.report_id ??
      row.reportId ??
      row.task_id ??
      row.taskId ??
      row.project_id ??
      row.projectId ??
      row.event_id ??
      row.eventId ??
      row.notice_id ??
      row.noticeId ??
      row.biz_id ??
      row.bizId ??
      `row-${index + 1}`;
    const sourceId = String(sourceIdRaw).trim();
    if (!sourceId) {
      continue;
    }

    const labelRaw =
      row.title ??
      row.subject ??
      row.name ??
      row.summary ??
      row.content ??
      row.description ??
      `DingTalk ${input.scope.toLowerCase()} ${index + 1}`;
    const label = trimText(String(labelRaw), 160);
    const summaryRaw = row.summary ?? row.content ?? row.description ?? row.remark ?? label;
    const summary = trimText(String(summaryRaw), 300);
    const preview = trimText(summary, 120);
    const payloadText = [
      `${input.scope}: ${label}`,
      summary,
      "",
      "Raw payload:",
      jsonStringify({
        scope: input.scope,
        docUrl: input.docUrl,
        item: row,
      }),
    ].join("\n");

    const extractedFacts = [
      typeof row.owner === "string" ? row.owner : null,
      typeof row.status === "string" ? row.status : null,
      typeof row.priority === "string" ? row.priority : null,
      label,
      summary,
    ].filter((value): value is string => Boolean(value));

    records.push({
      scope: input.scope,
      sourceType: input.sourceType,
      sourceId,
      label,
      summary,
      preview,
      payloadText,
      sourceSummary: input.sourceSummary,
      evidenceRef: `dingtalk:${input.scope.toLowerCase()}:${sourceId}`,
      extractedFacts,
      draftPayload: {
        provider: "DINGTALK",
        scope: input.scope,
        docUrl: input.docUrl,
        payload: row,
      },
      docUrl: input.docUrl,
    });
  }
  return records;
}

function resolveScopeToolName(
  scopeConfig: (ReturnType<typeof getDingTalkScopeProfiles>)[number],
  tools: McpToolDefinition[],
) {
  const preferred = DINGTALK_SCOPE_READ_TOOL_CANDIDATES[scopeConfig.scope];
  for (const candidate of preferred) {
    const exact = tools.find((tool) => tool.name === candidate);
    if (exact) {
      return exact.name;
    }
  }

  return (
    tools.find((tool) => {
      const lower = tool.name.toLowerCase();
      if (DINGTALK_WRITE_TOOL_PREFIXES.some((prefix) => lower.startsWith(prefix))) {
        return false;
      }
      const haystack = `${tool.name} ${tool.description ?? ""}`.toLowerCase();
      return scopeConfig.keywordHints.some((keyword) => haystack.includes(keyword.toLowerCase()));
    })?.name ?? null
  );
}

function resolveToolArgs(input: {
  tool: McpToolDefinition;
  scope: Exclude<DingTalkMcpScope, "MEETINGS" | "MANAGEMENT">;
  providerUserId?: string | null;
  providerUnionId?: string | null;
  providerSubjectId?: string | null;
  windowStart: Date;
  windowEnd: Date;
}) {
  const args: Record<string, unknown> = {};
  const availableUnionId =
    input.providerUnionId ??
    process.env.DINGTALK_USER_UNION_ID?.trim() ??
    null;
  const availableUserId =
    input.providerUserId ??
    process.env.DINGTALK_USER_ID?.trim() ??
    process.env.DINGTALK_USERID?.trim() ??
    null;
  const noticeTaskId = process.env.DINGTALK_NOTICE_TASK_ID?.trim() || null;
  const agentId = process.env.DINGTALK_AGENT_ID?.trim() || null;

  if (input.scope === "CALENDAR" || input.scope === "TODO") {
    if (availableUnionId) {
      args.unionId = availableUnionId;
      args.unionid = availableUnionId;
    }
  }
  if (input.scope === "PROJECTS") {
    if (availableUserId) {
      args.userId = availableUserId;
      args.userid = availableUserId;
    }
  }
  if (input.scope === "MESSAGE_NOTIFICATIONS" && agentId) {
    const normalized = Number(agentId);
    args.agent_id = Number.isFinite(normalized) ? normalized : agentId;
  }
  if (noticeTaskId) {
    const normalized = Number(noticeTaskId);
    args.task_id = Number.isFinite(normalized) ? normalized : noticeTaskId;
    args.msg_task_id = Number.isFinite(normalized) ? normalized : noticeTaskId;
  }

  if (input.scope === "CALENDAR") {
    args.calendarId = "primary";
    args.timeMin = input.windowStart.toISOString();
    args.timeMax = input.windowEnd.toISOString();
    args.maxResults = 50;
  }
  if (input.scope === "TODO") {
    args.nextToken = "0";
  }
  if (input.scope === "PROJECTS") {
    args.maxResults = 50;
    args.nextToken = "0";
    args.roleTypes = "executor";
  }
  if (input.scope === "WORK") {
    const reportUserId =
      availableUserId ||
      process.env.DINGTALK_WORK_REPORT_USER_ID?.trim() ||
      null;
    if (reportUserId) {
      args.userid = reportUserId;
      args.userId = reportUserId;
    }
    args.start_time = input.windowStart.getTime();
    args.end_time = input.windowEnd.getTime();
    args.cursor = 0;
    args.size = 20;
  }

  if (input.tool.name === "queryProjectsByProjectName") {
    const projectQueryName = process.env.DINGTALK_PROJECT_QUERY_NAME?.trim() || null;
    if (projectQueryName) {
      args.name = projectQueryName;
    }
  }

  const requiredFromTool = input.tool.inputSchema?.required ?? [];
  const missingRequired = requiredFromTool.filter((requiredField) => {
    if (requiredField === "unionId") {
      return !availableUnionId;
    }
    if (requiredField === "unionid") {
      return !availableUnionId;
    }
    if (requiredField === "userId") {
      return !availableUserId;
    }
    if (requiredField === "userid") {
      return !availableUserId;
    }
    if (requiredField === "agent_id") {
      return !agentId;
    }
    if (requiredField === "task_id") {
      return !noticeTaskId;
    }
    return args[requiredField] == null;
  });

  return {
    args,
    missingRequired,
  };
}

function parseToolCallPayload(raw: unknown) {
  if (!raw || typeof raw !== "object") {
    return {
      isError: false,
      payload: raw,
    } as const;
  }

  const wrapped = raw as { isError?: unknown; content?: unknown };
  const isError = wrapped.isError === true;
  const content = Array.isArray(wrapped.content) ? wrapped.content : [];
  const textContent = content
    .map((entry) => (entry && typeof entry === "object" ? (entry as { text?: unknown }).text : null))
    .find((text) => typeof text === "string");

  if (typeof textContent !== "string") {
    return {
      isError,
      payload: raw,
      errorMessage: isError ? "MCP tool returned isError without text detail." : null,
    } as const;
  }

  const normalizedText = textContent.trim();
  try {
    const parsed = JSON.parse(normalizedText);
    return {
      isError,
      payload: parsed,
      errorMessage: isError ? normalizedText : null,
    } as const;
  } catch {
    const inferredError = normalizedText.toLowerCase().includes("error executing");
    return {
      isError: isError || inferredError,
      payload: normalizedText,
      errorMessage: isError || inferredError ? normalizedText : null,
    } as const;
  }
}

function collectStringValues(input: unknown, keyHints: string[], depth = 0): string[] {
  if (depth > 6 || input == null) {
    return [];
  }

  if (typeof input === "string") {
    return input.trim() ? [input.trim()] : [];
  }
  if (Array.isArray(input)) {
    return input.flatMap((entry) => collectStringValues(entry, keyHints, depth + 1));
  }
  if (typeof input !== "object") {
    return [];
  }

  const row = input as Record<string, unknown>;
  const values: string[] = [];
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = key.toLowerCase();
    if (keyHints.some((hint) => normalizedKey.includes(hint.toLowerCase()))) {
      values.push(...collectStringValues(value, keyHints, depth + 1));
      continue;
    }
    if (typeof value === "object") {
      values.push(...collectStringValues(value, keyHints, depth + 1));
    }
  }
  return values;
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function readNestedValue(input: unknown, path: string[]) {
  let cursor: unknown = input;
  for (const key of path) {
    if (!cursor || typeof cursor !== "object") {
      return undefined;
    }
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return cursor;
}

function parsePaginationState(rawPayload: unknown) {
  const hasMoreCandidates = [
    readNestedValue(rawPayload, ["has_more"]),
    readNestedValue(rawPayload, ["hasMore"]),
    readNestedValue(rawPayload, ["result", "has_more"]),
    readNestedValue(rawPayload, ["result", "hasMore"]),
  ];
  const hasMore = hasMoreCandidates.some((value) => value === true || value === "true" || value === 1);

  const nextCursorCandidates = [
    readNestedValue(rawPayload, ["next_cursor"]),
    readNestedValue(rawPayload, ["nextCursor"]),
    readNestedValue(rawPayload, ["cursor"]),
    readNestedValue(rawPayload, ["result", "next_cursor"]),
    readNestedValue(rawPayload, ["result", "nextCursor"]),
    readNestedValue(rawPayload, ["result", "cursor"]),
    readNestedValue(rawPayload, ["nextToken"]),
    readNestedValue(rawPayload, ["result", "nextToken"]),
  ];
  const nextCursor = nextCursorCandidates.find(
    (value) => value != null && `${value}`.trim() !== "" && `${value}` !== "0",
  );

  return {
    hasMore,
    nextCursor: nextCursor ?? null,
  };
}

function collectNumberValues(input: unknown, keyHints: string[], depth = 0): number[] {
  if (depth > 6 || input == null) {
    return [];
  }
  if (typeof input === "number" && Number.isFinite(input)) {
    return [input];
  }
  if (typeof input === "string") {
    const asNumber = Number(input.trim());
    return Number.isFinite(asNumber) ? [asNumber] : [];
  }
  if (Array.isArray(input)) {
    return input.flatMap((entry) => collectNumberValues(entry, keyHints, depth + 1));
  }
  if (typeof input !== "object") {
    return [];
  }

  const row = input as Record<string, unknown>;
  const values: number[] = [];
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = key.toLowerCase();
    if (keyHints.some((hint) => normalizedKey.includes(hint.toLowerCase()))) {
      values.push(...collectNumberValues(value, keyHints, depth + 1));
      continue;
    }
    if (typeof value === "object") {
      values.push(...collectNumberValues(value, keyHints, depth + 1));
    }
  }
  return values;
}

async function callMcpTool(
  client: McpStdioClient,
  toolName: string,
  args: Record<string, unknown>,
) {
  traceMcp("tools.call.request", { scope: "SUBJECT_DISCOVERY", toolName, arguments: args });
  const toolResult = await client.request("tools/call", {
    name: toolName,
    arguments: args,
  });
  const parsed = parseToolCallPayload(toolResult);
  traceMcp("tools.call.response", {
    scope: "SUBJECT_DISCOVERY",
    toolName,
    response: parsed.payload,
    isError: parsed.isError,
  });
  if (parsed.isError) {
    throw new Error(trimText(parsed.errorMessage ?? `${toolName} failed`, 300));
  }
  return parsed.payload;
}

export async function discoverDingTalkMcpSubjects(input: {
  seedUserIds?: string[];
  seedUnionIds?: string[];
  deptIds?: number[];
  excludedDeptIds?: number[];
  excludedDeptNames?: string[];
  maxUsers?: number;
}) {
  const client = await McpStdioClient.create();
  try {
    await client.request("initialize", {
      protocolVersion: "2024-11-05",
      clientInfo: {
        name: MCP_CLIENT_NAME,
        version: MCP_CLIENT_VERSION,
      },
      capabilities: {
        tools: {},
      },
    });
    client.notify("notifications/initialized");

    const toolsResult = await client.request("tools/list", {});
    const tools = normalizeMcpToolDefinitions(toolsResult);
    const hasGetDepartmentUsers = tools.some((tool) => tool.name === "getDepartmentUsersByDepId");
    const hasListSubDepartmentIds = tools.some((tool) => tool.name === "listSubDepartmentIds");
    const hasGetDepartmentDetail = tools.some((tool) => tool.name === "getDepartmentDetail");
    const hasGetUserDetail = tools.some((tool) => tool.name === "getUserDetailByUserId");
    const hasGetUserByUnion = tools.some((tool) => tool.name === "getUserIdByUnionId");
    const maxUsers = Math.max(1, input.maxUsers ?? 200);

    const subjects = new Map<string, DingTalkMcpSubject>();
    const upsertSubject = (subject: DingTalkMcpSubject) => {
      const exactKey = `${subject.userId ?? ""}|${subject.unionId ?? ""}`;
      const exact = subjects.get(exactKey);
      if (exact) {
        return;
      }

      // Merge by userId: if we already have same user with missing union, upgrade it.
      if (subject.userId) {
        for (const [key, existing] of subjects) {
          if (existing.userId !== subject.userId) {
            continue;
          }
          if (!existing.unionId && subject.unionId) {
            subjects.delete(key);
            subjects.set(exactKey, subject);
            return;
          }
          if (existing.unionId && !subject.unionId) {
            return;
          }
        }
      }
      // Merge by unionId: if we already have same union with missing user, upgrade it.
      if (subject.unionId) {
        for (const [key, existing] of subjects) {
          if (existing.unionId !== subject.unionId) {
            continue;
          }
          if (!existing.userId && subject.userId) {
            subjects.delete(key);
            subjects.set(exactKey, subject);
            return;
          }
          if (existing.userId && !subject.userId) {
            return;
          }
        }
      }
      subjects.set(exactKey, subject);
    };

    for (const userId of uniqueStrings(input.seedUserIds ?? [])) {
      upsertSubject({ userId, unionId: null, source: "seed_user_id" });
    }
    for (const unionId of uniqueStrings(input.seedUnionIds ?? [])) {
      upsertSubject({ userId: null, unionId, source: "seed_union_id" });
    }

    const seedDeptIds = [...new Set(input.deptIds ?? [])].filter(
      (deptId) => Number.isFinite(deptId) && deptId > 0,
    );
    const excludedById = new Set(
      [...new Set(input.excludedDeptIds ?? [])].filter((deptId) => Number.isFinite(deptId) && deptId > 0),
    );
    const excludedNameList = [...new Set(input.excludedDeptNames ?? [])]
      .map((name) => name.trim())
      .filter(Boolean);
    const deptIds = [...seedDeptIds];
    const childMap = new Map<number, number[]>();
    if (seedDeptIds.length > 0 && hasListSubDepartmentIds) {
      const queue = [...seedDeptIds];
      const seen = new Set<number>(seedDeptIds);
      while (queue.length > 0 && seen.size < 500) {
        const currentDeptId = queue.shift();
        if (!currentDeptId) {
          continue;
        }
        try {
          const payload = await callMcpTool(client, "listSubDepartmentIds", { dept_id: currentDeptId });
          const discovered = collectNumberValues(payload, ["dept_id_list", "deptidlist", "dept_id", "deptId"])
            .filter((deptId) => Number.isFinite(deptId) && deptId > 0)
            .map((deptId) => Math.trunc(deptId));
          childMap.set(currentDeptId, discovered);
          for (const deptId of discovered) {
            if (seen.has(deptId)) {
              continue;
            }
            seen.add(deptId);
            queue.push(deptId);
            deptIds.push(deptId);
          }
        } catch (error) {
          traceMcp("subject.discovery.failed", {
            stage: "department_tree",
            deptId: currentDeptId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
    if (excludedNameList.length > 0 && hasGetDepartmentDetail) {
      const excludedNameSet = new Set(excludedNameList);
      for (const deptId of deptIds) {
        try {
          const payload = await callMcpTool(client, "getDepartmentDetail", { dept_id: deptId });
          const names = uniqueStrings(collectStringValues(payload, ["name", "dept_name", "department_name"]));
          if (names.some((name) => excludedNameSet.has(name))) {
            excludedById.add(deptId);
          }
        } catch (error) {
          traceMcp("subject.discovery.failed", {
            stage: "department_detail",
            deptId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }
    if (excludedById.size > 0) {
      const queue = [...excludedById];
      while (queue.length > 0) {
        const deptId = queue.shift();
        if (!deptId) {
          continue;
        }
        const children = childMap.get(deptId) ?? [];
        for (const childDeptId of children) {
          if (excludedById.has(childDeptId)) {
            continue;
          }
          excludedById.add(childDeptId);
          queue.push(childDeptId);
        }
      }
    }
    if (deptIds.length > 0 && hasGetDepartmentUsers) {
      for (const deptId of deptIds) {
        if (excludedById.has(deptId)) {
          traceMcp("subject.discovery.skipped", {
            stage: "department_users",
            deptId,
            reason: "excluded_department",
          });
          continue;
        }
        try {
          const payload = await callMcpTool(client, "getDepartmentUsersByDepId", { dept_id: deptId });
          const userIds = uniqueStrings(
            collectStringValues(payload, ["userid", "userId", "userid_list", "userids"]),
          );
          for (const userId of userIds.slice(0, maxUsers)) {
            upsertSubject({ userId, unionId: null, source: `department:${deptId}` });
          }
        } catch (error) {
          traceMcp("subject.discovery.failed", {
            stage: "department_users",
            deptId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    const currentSubjects = [...subjects.values()];
    if (hasGetUserByUnion) {
      for (const subject of currentSubjects) {
        if (subject.userId || !subject.unionId) {
          continue;
        }
        try {
          const payload = await callMcpTool(client, "getUserIdByUnionId", { unionid: subject.unionId });
          const userIds = uniqueStrings(collectStringValues(payload, ["userid", "userId"]));
          if (userIds[0]) {
            upsertSubject({
              userId: userIds[0],
              unionId: subject.unionId,
              source: `${subject.source}+resolve_userid`,
            });
          }
        } catch (error) {
          traceMcp("subject.discovery.failed", {
            stage: "resolve_userid",
            unionId: subject.unionId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    if (hasGetUserDetail) {
      for (const subject of [...subjects.values()]) {
        if (!subject.userId || subject.unionId) {
          continue;
        }
        try {
          const payload = await callMcpTool(client, "getUserDetailByUserId", { userid: subject.userId });
          const unionIds = uniqueStrings(collectStringValues(payload, ["unionid", "unionId"]));
          if (unionIds[0]) {
            upsertSubject({
              userId: subject.userId,
              unionId: unionIds[0],
              source: `${subject.source}+resolve_unionid`,
            });
          }
        } catch (error) {
          traceMcp("subject.discovery.failed", {
            stage: "resolve_unionid",
            userId: subject.userId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    const finalized = [...subjects.values()]
      .filter((subject) => subject.userId || subject.unionId)
      .slice(0, maxUsers);
    return finalized;
  } finally {
    client.close();
  }
}

export async function fetchDingTalkMcpScopeData(input: {
  providerUserId?: string | null;
  providerUnionId?: string | null;
  providerSubjectId?: string | null;
  windowStart: Date;
  windowEnd: Date;
  workWindowStart?: Date;
  workWindowEnd?: Date;
}) {
  const client = await McpStdioClient.create();
  const results: DingTalkMcpScopeFetchResult[] = [];

  try {
    const initializeParams = {
      protocolVersion: "2024-11-05",
      clientInfo: {
        name: MCP_CLIENT_NAME,
        version: MCP_CLIENT_VERSION,
      },
      capabilities: {
        tools: {},
      },
    } satisfies Record<string, unknown>;
    traceMcp("initialize.request", initializeParams);
    await client.request("initialize", initializeParams);
    client.notify("notifications/initialized");

    const toolsResult = await client.request("tools/list", {});
    const tools = normalizeMcpToolDefinitions(toolsResult);
    traceMcp("tools.list.response", {
      toolCount: tools.length,
      tools: tools.map((tool) => tool.name),
    });

    for (const scopeConfig of getDingTalkScopeProfiles()) {
      const toolName = resolveScopeToolName(scopeConfig, tools);
      if (!toolName) {
        results.push({
          scope: scopeConfig.scope,
          status: "UNRESOLVED",
          message: scopeConfig.defaultUnresolved,
          docUrl: scopeConfig.docUrl,
          records: [],
        });
        continue;
      }
      const toolDefinition = tools.find((tool) => tool.name === toolName) ?? null;
      if (!toolDefinition) {
        results.push({
          scope: scopeConfig.scope,
          status: "UNRESOLVED",
          message: `Tool ${toolName} is no longer available in current MCP runtime.`,
          docUrl: scopeConfig.docUrl,
          records: [],
        });
        continue;
      }

      try {
        const scopeWindowStart =
          scopeConfig.scope === "WORK"
            ? (input.workWindowStart ?? input.windowStart)
            : input.windowStart;
        const scopeWindowEnd =
          scopeConfig.scope === "WORK"
            ? (input.workWindowEnd ?? input.windowEnd)
            : input.windowEnd;
        const { args, missingRequired } = resolveToolArgs({
          tool: toolDefinition,
          scope: scopeConfig.scope,
          providerUserId: input.providerUserId ?? null,
          providerUnionId: input.providerUnionId ?? input.providerSubjectId ?? null,
          providerSubjectId:
            input.providerUnionId ?? input.providerSubjectId ?? null,
          windowStart: scopeWindowStart,
          windowEnd: scopeWindowEnd,
        });
        const finalMissingRequired = missingRequired.filter((requiredField) => {
          if (requiredField === "userId" || requiredField === "userid") {
            return !(input.providerUserId || args.userId || args.userid);
          }
          if (requiredField === "unionId" || requiredField === "unionid") {
            return !(input.providerUnionId || input.providerSubjectId || args.unionId || args.unionid);
          }
          return true;
        });
        if (finalMissingRequired.length > 0) {
          const extraHint =
            scopeConfig.scope === "MESSAGE_NOTIFICATIONS" &&
            finalMissingRequired.includes("task_id")
              ? "DingTalk notice MCP has no list API; provide DINGTALK_NOTICE_TASK_ID from a send task for readback."
              : null;
          results.push({
            scope: scopeConfig.scope,
            status: "UNRESOLVED",
            message: trimText(
              [
                `MCP scope ${scopeConfig.scope} is missing required args for ${toolName}: ${finalMissingRequired.join(", ")}`,
                extraHint,
              ]
                .filter(Boolean)
                .join(" "),
              300,
            ),
            docUrl: scopeConfig.docUrl,
            records: [],
          });
          continue;
        }

        const records: DingTalkMcpRecord[] = [];
        const recordKeys = new Set<string>();
        const workPaginated = scopeConfig.scope === "WORK";
        const maxPages = workPaginated ? getWorkMaxPages() : 1;
        let currentArgs = { ...args };
        let page = 0;
        let failureMessage: string | null = null;
        const seenCursors = new Set<string>();

        while (page < maxPages) {
          traceMcp("tools.call.request", {
            scope: scopeConfig.scope,
            toolName,
            page: page + 1,
            arguments: currentArgs,
          });
          const toolResult = await client.request("tools/call", {
            name: toolName,
            arguments: currentArgs,
          });
          const parsedResult = parseToolCallPayload(toolResult);
          traceMcp("tools.call.response", {
            scope: scopeConfig.scope,
            toolName,
            page: page + 1,
            response: parsedResult.payload,
            isError: parsedResult.isError,
          });
          if (parsedResult.isError) {
            failureMessage = trimText(parsedResult.errorMessage ?? `MCP scope ${scopeConfig.scope} failed.`, 300);
            break;
          }

          const pageRecords = toScopeRecords({
            scope: scopeConfig.scope,
            sourceType: scopeConfig.sourceType,
            sourceSummary: scopeConfig.sourceSummary,
            docUrl: scopeConfig.docUrl,
            rawPayload: parsedResult.payload,
          });
          for (const item of pageRecords) {
            const key = `${item.sourceType}::${item.sourceId}`;
            if (recordKeys.has(key)) {
              continue;
            }
            recordKeys.add(key);
            records.push(item);
          }

          if (!workPaginated) {
            break;
          }

          const pagination = parsePaginationState(parsedResult.payload);
          const cursorToken =
            pagination.nextCursor == null ? null : `${pagination.nextCursor}`.trim();
          if (!pagination.hasMore && !cursorToken) {
            break;
          }
          if (!cursorToken || seenCursors.has(cursorToken)) {
            break;
          }
          seenCursors.add(cursorToken);
          currentArgs = {
            ...currentArgs,
            cursor: Number.isFinite(Number(cursorToken)) ? Number(cursorToken) : cursorToken,
            nextToken: cursorToken,
          };
          page += 1;
        }

        if (failureMessage) {
          results.push({
            scope: scopeConfig.scope,
            status: "FAILED",
            message: failureMessage,
            docUrl: scopeConfig.docUrl,
            records: [],
          });
          continue;
        }

        results.push({
          scope: scopeConfig.scope,
          status: "INGESTED",
          message: records.length > 0 ? null : `MCP scope ${scopeConfig.scope} returned no records in current window.`,
          docUrl: scopeConfig.docUrl,
          records,
        });
        traceMcp("scope.normalized", {
          scope: scopeConfig.scope,
          status: "INGESTED",
          recordCount: records.length,
        });
      } catch (scopeError) {
        traceMcp("scope.failed", {
          scope: scopeConfig.scope,
          toolName,
          error: scopeError instanceof Error ? scopeError.message : String(scopeError),
        });
        results.push({
          scope: scopeConfig.scope,
          status: "FAILED",
          message:
            scopeError instanceof Error
              ? trimText(scopeError.message, 300)
              : `MCP scope ${scopeConfig.scope} failed.`,
          docUrl: scopeConfig.docUrl,
          records: [],
        });
      }
    }

    return {
      scopeResults: results,
      activeProfiles: getDingTalkMcpActiveProfiles(),
      toolCount: tools.length,
    };
  } finally {
    client.close();
  }
}

export async function resolveDingTalkUserIdByUnionId(unionId: string) {
  const normalizedUnionId = unionId.trim();
  if (!normalizedUnionId) {
    throw new Error("unionId is empty");
  }

  const client = await McpStdioClient.create();
  try {
    await client.request("initialize", {
      protocolVersion: "2024-11-05",
      clientInfo: {
        name: MCP_CLIENT_NAME,
        version: MCP_CLIENT_VERSION,
      },
    });

    const toolsResult = await client.request("tools/list", {});
    const tools = normalizeMcpToolDefinitions(toolsResult);
    if (!tools.some((tool) => tool.name === "getUserIdByUnionId")) {
      throw new Error("DingTalk MCP getUserIdByUnionId tool is unavailable");
    }

    const payload = await callMcpTool(client, "getUserIdByUnionId", {
      unionid: normalizedUnionId,
    });
    const userIds = uniqueStrings(collectStringValues(payload, ["userid", "userId"]));
    if (!userIds[0]) {
      throw new Error(`No DingTalk userId resolved for unionId ${normalizedUnionId}`);
    }

    return userIds[0];
  } finally {
    client.close();
  }
}
