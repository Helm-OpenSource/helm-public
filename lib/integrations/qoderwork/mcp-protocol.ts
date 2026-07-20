import {
  QODERWORK_MCP_TOOLS,
  parseQoderWorkToolCall,
  type QoderWorkConnectionScope,
  type QoderWorkMcpResponse,
  type QoderWorkMcpToolName,
} from "@/features/qoderwork-intake/mcp-contract";

export const QODERWORK_MCP_SUPPORTED_PROTOCOL_VERSIONS = [
  "2025-11-25",
  "2025-06-18",
  "2025-03-26",
] as const;

export type QoderWorkMcpAuthContext = {
  readonly connectionId: string;
  readonly workspaceId: string;
  readonly userId: string;
  readonly deviceRef: string;
  readonly scopes: readonly QoderWorkConnectionScope[];
};

type JsonRpcMessage = {
  readonly jsonrpc?: unknown;
  readonly id?: unknown;
  readonly method?: unknown;
  readonly params?: unknown;
};

type ToolExecutor = (input: {
  auth: QoderWorkMcpAuthContext;
  toolName: QoderWorkMcpToolName;
  arguments: unknown;
}) => Promise<QoderWorkMcpResponse>;

type ProtocolResult = {
  readonly httpStatus: number;
  readonly body: JsonRpcResponse | null;
};

type JsonRpcResponse = {
  readonly jsonrpc: "2.0";
  readonly id: unknown;
  readonly result?: {
    readonly tools: Array<{ readonly name: string; readonly description: string }>;
    readonly structuredContent?: QoderWorkMcpResponse;
    readonly isError?: boolean;
    readonly [key: string]: unknown;
  };
  readonly error?: {
    readonly code: number;
    readonly message: string;
    readonly data: { readonly errorCode: string };
  };
};

export async function handleQoderWorkMcpMessage(input: {
  message: unknown;
  auth: QoderWorkMcpAuthContext;
  executeTool: ToolExecutor;
}): Promise<ProtocolResult> {
  if (!input.message || typeof input.message !== "object" || Array.isArray(input.message)) {
    return rpcError(null, -32600, "Invalid Request", "MALFORMED_REQUEST", 400);
  }
  const message = input.message as JsonRpcMessage;
  if (message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return rpcError(message.id ?? null, -32600, "Invalid Request", "MALFORMED_REQUEST", 400);
  }

  if (message.method === "notifications/initialized") {
    return { httpStatus: 202, body: null };
  }

  if (message.method === "initialize") {
    const requested = readRequestedProtocolVersion(message.params);
    if (!requested) {
      return rpcError(
        message.id ?? null,
        -32602,
        "Initialize protocol version is required",
        "MALFORMED_REQUEST",
        400,
      );
    }
    const protocolVersion = QODERWORK_MCP_SUPPORTED_PROTOCOL_VERSIONS.includes(
      requested as (typeof QODERWORK_MCP_SUPPORTED_PROTOCOL_VERSIONS)[number],
    )
      ? requested
      : QODERWORK_MCP_SUPPORTED_PROTOCOL_VERSIONS[0];
    return rpcResult(message.id ?? null, {
      protocolVersion,
      capabilities: { tools: { listChanged: false } },
      serverInfo: {
        name: "helm-qoderwork-owner-loop",
        title: "Helm QoderWork Owner Loop",
        version: "0.1.0",
        description: "Governed read and proposal tools; no approval, send, execution, CRM write, or memory promotion.",
      },
      instructions:
        "Raw source material stays in its source system. All proposals require Helm governance and human review.",
    });
  }

  if (message.method === "ping") return rpcResult(message.id ?? null, {});

  if (message.method === "tools/list") {
    const scopes = new Set(input.auth.scopes);
    const tools = QODERWORK_MCP_TOOLS.filter((tool) => scopes.has(tool.requiredScope)).map(
      ({ name, description, inputSchema }) => ({ name, description, inputSchema }),
    );
    return rpcResult(message.id ?? null, { tools });
  }

  if (message.method === "tools/call") {
    const params = readToolCallParams(message.params);
    if (!params) {
      return rpcError(message.id ?? null, -32602, "Invalid tool call", "MALFORMED_REQUEST", 400);
    }
    const definition = QODERWORK_MCP_TOOLS.find((tool) => tool.name === params.name);
    if (!definition || !input.auth.scopes.includes(definition.requiredScope)) {
      return rpcError(message.id ?? null, -32003, "Tool scope denied", "SCOPE_VIOLATION", 403);
    }
    const parsed = parseQoderWorkToolCall(params.name, params.arguments);
    if (!parsed.success) {
      const status = parsed.errorCode === "DATA_CLASSIFICATION_BLOCKED" ? 403 : 400;
      return rpcError(message.id ?? null, -32602, parsed.safeMessage, parsed.errorCode, status);
    }

    const response = await input.executeTool({
      auth: input.auth,
      toolName: parsed.toolName,
      arguments: parsed.data,
    });
    return rpcResult(message.id ?? null, {
      content: [{ type: "text", text: JSON.stringify(response) }],
      structuredContent: response,
      isError: response.status === "rejected" || response.status === "quarantined",
    });
  }

  return rpcError(message.id ?? null, -32601, "Method not found", "SCOPE_VIOLATION", 404);
}

function readRequestedProtocolVersion(params: unknown): string {
  if (!params || typeof params !== "object") return "";
  const value = (params as { protocolVersion?: unknown }).protocolVersion;
  return typeof value === "string" ? value : "";
}

function readToolCallParams(params: unknown): { name: string; arguments: unknown } | null {
  if (!params || typeof params !== "object" || Array.isArray(params)) return null;
  const record = params as { name?: unknown; arguments?: unknown };
  if (typeof record.name !== "string") return null;
  return { name: record.name, arguments: record.arguments ?? {} };
}

function rpcResult(id: unknown, result: unknown): ProtocolResult {
  return {
    httpStatus: 200,
    body: {
      jsonrpc: "2.0",
      id,
      result: result as NonNullable<JsonRpcResponse["result"]>,
    },
  };
}

function rpcError(
  id: unknown,
  code: number,
  message: string,
  errorCode: string,
  httpStatus: number,
): ProtocolResult {
  return {
    httpStatus,
    body: { jsonrpc: "2.0", id, error: { code, message, data: { errorCode } } },
  };
}
