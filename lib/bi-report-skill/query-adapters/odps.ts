import type { ChildProcessWithoutNullStreams } from "node:child_process";
import type { BiReportRow, BiReportSkillPack, BiReportSubscriptionConfig } from "@/lib/bi-report-skill/types";
import { readEnvVarFromRootFiles } from "@/lib/root-env";

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
  id?: JsonRpcId;
  result?: unknown;
  error?: {
    message?: string;
  };
};

type McpToolDefinition = {
  name: string;
  description?: string;
};

type ExecuteOdpsSqlQueryInput = {
  sql: string;
  fetchImpl?: typeof fetch;
};

function readRootEnv(name: string) {
  return readEnvVarFromRootFiles(name);
}

function getOdpsApiUrl() {
  return process.env.BI_REPORT_ODPS_API_URL?.trim() ?? readRootEnv("BI_REPORT_ODPS_API_URL") ?? "";
}

function sanitizeOdpsUrlForError(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    return url.origin;
  } catch {
    return rawUrl;
  }
}

function getOdpsApiToken() {
  return process.env.BI_REPORT_ODPS_API_TOKEN?.trim() ?? readRootEnv("BI_REPORT_ODPS_API_TOKEN") ?? "";
}

function getOdpsTimeoutMs() {
  const value = Number(process.env.BI_REPORT_ODPS_TIMEOUT_MS ?? readRootEnv("BI_REPORT_ODPS_TIMEOUT_MS") ?? 30_000);
  // Reject 0/negative/NaN (Number("") === 0): an instant-timeout config would
  // abort every query before it starts.
  return Number.isFinite(value) && value > 0 ? value : 30_000;
}

function getOdpsMcpCommand() {
  return process.env.BI_REPORT_ODPS_MCP_COMMAND?.trim() ?? readRootEnv("BI_REPORT_ODPS_MCP_COMMAND") ?? "";
}

function getOdpsMcpArgs() {
  return parseCsvEnv(process.env.BI_REPORT_ODPS_MCP_ARGS ?? readRootEnv("BI_REPORT_ODPS_MCP_ARGS"));
}

function getOdpsMcpToolName() {
  return process.env.BI_REPORT_ODPS_MCP_TOOL_NAME?.trim() ?? readRootEnv("BI_REPORT_ODPS_MCP_TOOL_NAME") ?? "";
}

function getOdpsMcpSqlParam() {
  return process.env.BI_REPORT_ODPS_MCP_SQL_PARAM?.trim() || readRootEnv("BI_REPORT_ODPS_MCP_SQL_PARAM") || "sql";
}

function getOdpsMcpReadyTimeoutMs() {
  const value = Number(
    process.env.BI_REPORT_ODPS_MCP_READY_TIMEOUT_MS ??
      readRootEnv("BI_REPORT_ODPS_MCP_READY_TIMEOUT_MS") ??
      10_000,
  );
  return Number.isFinite(value) ? value : 10_000;
}

const ODPS_MCP_CHILD_BASE_ENV_KEYS = [
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

function copyEnvByPrefix(
  target: Record<string, string>,
  prefixes: readonly string[],
) {
  for (const [key, value] of Object.entries(process.env)) {
    if (value === undefined) {
      continue;
    }
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      target[key] = value;
    }
  }
}

export function buildOdpsMcpChildEnv(): Record<string, string> {
  const sanitized: Record<string, string> = {
    NODE_ENV: process.env.NODE_ENV ?? "development",
  };
  for (const key of ODPS_MCP_CHILD_BASE_ENV_KEYS) {
    const value = process.env[key];
    if (value === undefined) {
      continue;
    }
    sanitized[key] = value;
  }
  copyEnvByPrefix(sanitized, ["BI_REPORT_ODPS_", "ODPS_"]);
  return sanitized;
}

export async function queryBiReportRowsFromOdps(input: {
  workspaceId: string;
  skill: BiReportSkillPack;
  subscription: BiReportSubscriptionConfig;
  sql: string;
  sqlParams: Record<string, string>;
  fetchImpl?: typeof fetch;
}) {
  void input.workspaceId;
  void input.skill;
  void input.subscription;
  void input.sqlParams;
  const timeoutMs = getOdpsTimeoutMs();
  const fetchController = shouldUseHttpOdpsBridge() ? new AbortController() : null;
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutError = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      if (fetchController) {
        fetchController.abort();
      }
      reject(new Error(`BI report ODPS query timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const payload = await Promise.race([
      executeOdpsSqlQuery({
        sql: input.sql,
        fetchImpl: input.fetchImpl,
        signal: fetchController?.signal,
      }),
      timeoutError,
    ]);
    assertOdpsPayloadOk(payload);
    const rows = extractRows(payload);
    return rows.map(normalizeBiReportRow);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`BI report ODPS query timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    // Always clear the timer: otherwise a fast query still keeps the event loop
    // (and any serverless invocation) alive until timeoutMs elapses, then fires
    // a pointless abort().
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}

export async function executeOdpsSqlQuery(
  input: ExecuteOdpsSqlQueryInput & {
    signal?: AbortSignal;
  },
) {
  if (shouldUseMcpOdpsBridge()) {
    return executeOdpsSqlQueryViaMcp(input.sql);
  }

  if (!getOdpsApiUrl()) {
    throw new Error(
      "BI report ODPS query is not configured: set BI_REPORT_ODPS_MCP_COMMAND or BI_REPORT_ODPS_API_URL",
    );
  }
  const fetchImpl = input.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(getOdpsApiUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
        ...(getOdpsApiToken()
          ? {
              Authorization: `Bearer ${getOdpsApiToken()}`,
            }
          : {}),
      },
      body: input.sql,
      cache: "no-store",
      signal: input.signal,
    });
  } catch (error) {
    const err = error as Error & { cause?: unknown };
    const causeText =
      err?.cause instanceof Error
        ? `${err.cause.name}: ${err.cause.message}`
        : err?.cause
          ? String(err.cause)
          : "n/a";
    throw new Error(
      `BI report ODPS fetch failed for ${sanitizeOdpsUrlForError(getOdpsApiUrl())}: ${err?.name || "Error"}: ${err?.message || "unknown"}; cause: ${causeText}`,
    );
  }

  if (!response.ok) {
    throw new Error(`BI report ODPS query failed: ${response.status}`);
  }

  return (await response.json()) as unknown;
}

function shouldUseMcpOdpsBridge() {
  return Boolean(getOdpsMcpCommand() || getOdpsMcpArgs().length > 0);
}

function shouldUseHttpOdpsBridge() {
  return Boolean(getOdpsApiUrl());
}

function parseCsvEnv(value: string | null | undefined) {
  if (!value || !value.trim()) {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeMcpToolDefinitions(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const tools = (payload as { tools?: unknown }).tools;
  if (!Array.isArray(tools)) {
    return [];
  }

  return tools
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      name: typeof item.name === "string" ? item.name.trim() : "",
      description: typeof item.description === "string" ? item.description.trim() : undefined,
    }))
    .filter((item) => Boolean(item.name)) as McpToolDefinition[];
}

function resolveOdpsMcpToolName(tools: McpToolDefinition[]) {
  const configuredToolName = getOdpsMcpToolName();
  if (configuredToolName) {
    return configuredToolName;
  }

  const candidates = [
    "queryOdpsSql",
    "executeOdpsSql",
    "odpsQuery",
    "querySql",
    "executeSql",
  ];
  for (const candidate of candidates) {
    const exact = tools.find((tool) => tool.name === candidate);
    if (exact) {
      return exact.name;
    }
  }

  const fuzzy = tools.find((tool) => {
    const text = `${tool.name} ${tool.description ?? ""}`.toLowerCase();
    return text.includes("odps") && (text.includes("sql") || text.includes("query"));
  });
  if (fuzzy) {
    return fuzzy.name;
  }

  throw new Error(
    `BI report ODPS MCP tool was not found. Available tools: ${tools.map((tool) => tool.name).join(", ") || "none"}`,
  );
}

class BiReportOdpsMcpClient {
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
      if (this.stderrBuffer.length > 4000) {
        this.stderrBuffer = this.stderrBuffer.slice(-4000);
      }
      if (/running on stdio|ready|启动成功/i.test(this.stderrBuffer)) {
        this.markReady();
      }
    });

    const failAllPending = (reason: string) => {
      this.markReady();
      for (const [, pending] of this.pending) {
        clearTimeout(pending.timer);
        pending.reject(new Error(`${reason} stderr: ${this.stderrBuffer || "n/a"}`));
      }
      this.pending.clear();
    };

    this.child.once("exit", () => {
      failAllPending("BI report ODPS MCP process exited unexpectedly.");
    });

    // Without an `error` listener, a missing MCP binary (ENOENT — the most
    // common misconfiguration) emits an unhandled `error` on the child and
    // crashes the whole Node/Next.js process; `exit` never fires in that case.
    this.child.once("error", (err: Error) => {
      failAllPending(`BI report ODPS MCP process failed to start: ${err.message}.`);
    });
    // EPIPE on stdin after the child dies is likewise emitted as `error` on the
    // stream; swallow it (pending requests are already rejected via exit/error).
    this.child.stdin.on("error", () => {});

    setTimeout(() => {
      this.markReady();
    }, getOdpsMcpReadyTimeoutMs());
  }

  static async create() {
    const { spawn } = await import("node:child_process");
    const child = spawn(
      /* turbopackIgnore: true */ (getOdpsMcpCommand() || "npx"),
      getOdpsMcpArgs(),
      {
        stdio: ["pipe", "pipe", "pipe"],
        env: buildOdpsMcpChildEnv() as NodeJS.ProcessEnv,
      },
    );
    return new BiReportOdpsMcpClient(child);
  }

  private async waitUntilReady() {
    await this.readyPromise;
  }

  async request(method: string, params?: Record<string, unknown>) {
    await this.waitUntilReady();
    const id = ++this.seq;
    const payload: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      ...(params ? { params } : {}),
      method,
    };

    return new Promise<unknown>((resolve, reject) => {
      const timeoutMs = getOdpsTimeoutMs();
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new Error(
            `BI report ODPS MCP request timed out: ${method}. stderr: ${this.stderrBuffer || "n/a"}`,
          ),
        );
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.child.stdin.write(`${JSON.stringify(payload)}\n`);
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(
          new Error(
            `BI report ODPS MCP request could not be written: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
      }
    });
  }

  notify(method: string, params?: Record<string, unknown>) {
    const payload: JsonRpcNotification = {
      jsonrpc: "2.0",
      method,
      ...(params ? { params } : {}),
    };
    this.child.stdin.write(`${JSON.stringify(payload)}\n`);
  }

  close() {
    this.child.kill();
  }
}

async function executeOdpsSqlQueryViaMcp(sql: string) {
  const client = await BiReportOdpsMcpClient.create();
  try {
    await client.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "helm-bi-report-odps",
        version: "1.0.0",
      },
    });
    client.notify("notifications/initialized");
    const toolsResult = await client.request("tools/list", {});
    const toolName = resolveOdpsMcpToolName(normalizeMcpToolDefinitions(toolsResult));
    const toolResult = await client.request("tools/call", {
      name: toolName,
      arguments: {
        [getOdpsMcpSqlParam()]: sql,
      },
    });

    return extractMcpToolPayload(toolResult);
  } finally {
    client.close();
  }
}

function extractMcpToolPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") {
    return payload;
  }

  const content = (payload as { content?: unknown }).content;
  if (!Array.isArray(content) || content.length === 0) {
    return payload;
  }

  for (const item of content) {
    if (!item || typeof item !== "object") {
      continue;
    }
    const text = (item as { text?: unknown }).text;
    if (typeof text !== "string" || !text.trim()) {
      continue;
    }
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return text;
    }
  }

  return payload;
}

// The ODPS bridge (both the HTTP endpoint and the MCP tool) reports a query
// failure as a 200-OK JSON body `{ success: false, error: "ODPS-..." }` rather
// than a non-2xx status. Without this check extractRows() would find no `rows`
// array and silently return [], so a failed query (missing table, bad SQL,
// permission error) would surface as a perfectly normal empty BI report — zero
// metrics presented as if they were real. Surface the bridge error instead.
function assertOdpsPayloadOk(payload: unknown) {
  if (
    payload &&
    typeof payload === "object" &&
    !Array.isArray(payload) &&
    (payload as { success?: unknown }).success === false
  ) {
    const message = (payload as { error?: unknown }).error;
    throw new Error(
      `BI report ODPS query failed: ${
        typeof message === "string" && message.trim()
          ? message.trim()
          : "the ODPS bridge reported success=false"
      }`,
    );
  }
}

function extractRows(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === "object") {
    const record = payload as { rows?: unknown; data?: unknown };
    if (Array.isArray(record.rows)) {
      return record.rows;
    }
    if (Array.isArray(record.data)) {
      return record.data;
    }
  }

  return [];
}

function normalizeBiReportRow(row: unknown): BiReportRow {
  if (!row || typeof row !== "object" || Array.isArray(row)) {
    throw new Error("BI report ODPS query returned a non-object row");
  }

  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, normalizeBiReportRowValue(value)]),
  ) as BiReportRow;
}

function normalizeBiReportRowValue(value: unknown): BiReportRow[keyof BiReportRow] {
  if (value == null) {
    return null;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return JSON.stringify(value) ?? null;
}
