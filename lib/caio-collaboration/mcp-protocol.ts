import {
  workBuddyClientIdentitySchema,
  type ToolEnvelope,
  type WorkBuddyClientIdentity,
} from "./contracts";
import type {
  WorkBuddyMcpToolDispatcher,
} from "./mcp-tool-dispatcher";

export const WORKBUDDY_MCP_SUPPORTED_PROTOCOL_VERSIONS = [
  "2025-11-25",
  "2025-06-18",
  "2025-03-26",
] as const;

type JsonRpcId = string | number;

type JsonRpcMessage = Readonly<{
  jsonrpc?: unknown;
  id?: unknown;
  method?: unknown;
  params?: unknown;
}>;

type JsonRpcError = Readonly<{
  code: number;
  message: string;
  data: Readonly<{
    errorCode: WorkBuddyMcpProtocolErrorCode;
  }>;
}>;

type JsonRpcResponse = Readonly<{
  jsonrpc: "2.0";
  id: JsonRpcId | null;
  result?: Readonly<Record<string, unknown>>;
  error?: JsonRpcError;
}>;

export type WorkBuddyMcpProtocolErrorCode =
  | "CLIENT_IDENTITY_INVALID"
  | "INTERNAL_ERROR"
  | "INVALID_TOOL_INPUT"
  | "MALFORMED_REQUEST"
  | "METHOD_NOT_FOUND"
  | "REQUEST_DEADLINE_EXCEEDED";

export type WorkBuddyMcpProtocolResult = Readonly<{
  httpStatus: number;
  body: JsonRpcResponse | null;
}>;

export async function handleWorkBuddyMcpMessage(input: {
  message: unknown;
  identity: WorkBuddyClientIdentity;
  dispatcher: WorkBuddyMcpToolDispatcher;
  requestId: string;
  signal?: AbortSignal;
}): Promise<WorkBuddyMcpProtocolResult> {
  const identityResult = workBuddyClientIdentitySchema.safeParse(
    input.identity,
  );
  if (!identityResult.success) {
    return rpcError(
      readResponseId(input.message),
      -32001,
      "A verified mTLS client identity is required.",
      "CLIENT_IDENTITY_INVALID",
      401,
    );
  }

  if (input.signal?.aborted) {
    return rpcError(
      readResponseId(input.message),
      -32002,
      "The WorkBuddy request deadline was exceeded.",
      "REQUEST_DEADLINE_EXCEEDED",
      504,
    );
  }

  if (!isJsonRpcMessage(input.message)) {
    return rpcError(
      null,
      -32600,
      "Invalid Request",
      "MALFORMED_REQUEST",
      400,
    );
  }
  const message = input.message;
  const responseId = readValidRequestId(message.id);

  if (
    message.jsonrpc !== "2.0" ||
    typeof message.method !== "string" ||
    message.method.length === 0 ||
    message.method.length > 200
  ) {
    return rpcError(
      responseId,
      -32600,
      "Invalid Request",
      "MALFORMED_REQUEST",
      400,
    );
  }

  if (message.method === "notifications/initialized") {
    if (message.id !== undefined) {
      return rpcError(
        responseId,
        -32600,
        "Initialized must be a notification.",
        "MALFORMED_REQUEST",
        400,
      );
    }
    return Object.freeze({
      httpStatus: 202,
      body: null,
    });
  }

  if (responseId === null) {
    return rpcError(
      null,
      -32600,
      "A valid request id is required.",
      "MALFORMED_REQUEST",
      400,
    );
  }

  if (message.method === "initialize") {
    const requestedVersion = readRequestedProtocolVersion(
      message.params,
    );
    if (!requestedVersion) {
      return rpcError(
        responseId,
        -32602,
        "Initialize protocol version is required.",
        "MALFORMED_REQUEST",
        400,
      );
    }
    const protocolVersion =
      WORKBUDDY_MCP_SUPPORTED_PROTOCOL_VERSIONS.includes(
        requestedVersion as (typeof WORKBUDDY_MCP_SUPPORTED_PROTOCOL_VERSIONS)[number],
      )
        ? requestedVersion
        : WORKBUDDY_MCP_SUPPORTED_PROTOCOL_VERSIONS[0];
    return rpcResult(responseId, {
      protocolVersion,
      capabilities: {
        tools: {
          listChanged: false,
        },
      },
      serverInfo: {
        name: "helm-caio-workbuddy-lan",
        title: "Helm CAIO WorkBuddy LAN",
        version: "0.1.0",
        description:
          "Governed projections and canonical review tools; no external execution authority.",
      },
      instructions:
        "Every tool remains subject to live Helm authorization, feature flags, owner presence, and canonical receipts.",
    });
  }

  if (message.method === "ping") {
    return rpcResult(responseId, {});
  }

  if (message.method === "tools/list") {
    return rpcResult(responseId, {
      tools: input.dispatcher.listTools(identityResult.data),
    });
  }

  if (message.method === "tools/call") {
    const toolCall = readToolCall(message.params);
    if (!toolCall) {
      return rpcError(
        responseId,
        -32602,
        "Invalid tool call.",
        "INVALID_TOOL_INPUT",
        400,
      );
    }
    try {
      const envelope = await input.dispatcher.dispatch({
        name: toolCall.name,
        input: toolCall.arguments,
        context: {
          requestId: input.requestId,
          identity: identityResult.data,
          signal: input.signal,
        },
      });
      return toolEnvelopeResult(responseId, envelope);
    } catch {
      return rpcError(
        responseId,
        -32603,
        "The WorkBuddy protocol adapter failed safely.",
        "INTERNAL_ERROR",
        500,
      );
    }
  }

  return rpcError(
    responseId,
    -32601,
    "Method not found.",
    "METHOD_NOT_FOUND",
    404,
  );
}

function isJsonRpcMessage(value: unknown): value is JsonRpcMessage {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value),
  );
}

function readValidRequestId(value: unknown): JsonRpcId | null {
  if (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 200
  ) {
    return value;
  }
  if (
    typeof value === "number" &&
    Number.isSafeInteger(value)
  ) {
    return value;
  }
  return null;
}

function readResponseId(message: unknown): JsonRpcId | null {
  if (!isJsonRpcMessage(message)) return null;
  return readValidRequestId(message.id);
}

function readRequestedProtocolVersion(params: unknown): string {
  if (
    !params ||
    typeof params !== "object" ||
    Array.isArray(params)
  ) {
    return "";
  }
  const value = (
    params as Readonly<{ protocolVersion?: unknown }>
  ).protocolVersion;
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= 100
    ? value
    : "";
}

function readToolCall(
  params: unknown,
): Readonly<{
  name: string;
  arguments: Readonly<Record<string, unknown>>;
}> | null {
  if (
    !params ||
    typeof params !== "object" ||
    Array.isArray(params)
  ) {
    return null;
  }
  const record = params as Readonly<{
    name?: unknown;
    arguments?: unknown;
  }>;
  if (
    typeof record.name !== "string" ||
    record.name.length === 0 ||
    record.name.length > 200
  ) {
    return null;
  }
  const argumentsValue = record.arguments ?? {};
  if (
    !argumentsValue ||
    typeof argumentsValue !== "object" ||
    Array.isArray(argumentsValue)
  ) {
    return null;
  }
  return Object.freeze({
    name: record.name,
    arguments: argumentsValue as Readonly<Record<string, unknown>>,
  });
}

function toolEnvelopeResult(
  id: JsonRpcId,
  envelope: ToolEnvelope<unknown>,
): WorkBuddyMcpProtocolResult {
  let text: string;
  try {
    text = JSON.stringify(envelope);
  } catch {
    return rpcError(
      id,
      -32603,
      "The WorkBuddy tool returned a non-serializable result.",
      "INTERNAL_ERROR",
      500,
    );
  }
  return rpcResult(id, {
    content: [
      {
        type: "text",
        text,
      },
    ],
    structuredContent: envelope,
    isError: !envelope.ok,
  });
}

function rpcResult(
  id: JsonRpcId,
  result: Readonly<Record<string, unknown>>,
): WorkBuddyMcpProtocolResult {
  return Object.freeze({
    httpStatus: 200,
    body: Object.freeze({
      jsonrpc: "2.0",
      id,
      result,
    }),
  });
}

function rpcError(
  id: JsonRpcId | null,
  code: number,
  message: string,
  errorCode: WorkBuddyMcpProtocolErrorCode,
  httpStatus: number,
): WorkBuddyMcpProtocolResult {
  return Object.freeze({
    httpStatus,
    body: Object.freeze({
      jsonrpc: "2.0",
      id,
      error: Object.freeze({
        code,
        message,
        data: Object.freeze({
          errorCode,
        }),
      }),
    }),
  });
}
