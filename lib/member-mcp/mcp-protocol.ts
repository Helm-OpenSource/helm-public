// lib/member-mcp/mcp-protocol.ts
// JSON-RPC / MCP Streamable HTTP message handling for the member entry.
// Mirrors lib/integrations/qoderwork/mcp-protocol.ts; the tool list is
// filtered by the connection's scopes AND the workspace's approved clients.

import type { MemberToolEnvelope } from "@/lib/member-gateway/types";
import {
  memberMcpProviderRef,
  type MemberMcpClientType,
  type MemberMcpScope,
} from "@/lib/member-mcp/contract";
import {
  MEMBER_MCP_TOOLS,
  parseMemberMcpToolCall,
  type MemberMcpToolCall,
} from "@/lib/member-mcp/tools";

export const MEMBER_MCP_SUPPORTED_PROTOCOL_VERSIONS = [
  "2025-11-25",
  "2025-06-18",
  "2025-03-26",
] as const;

export type MemberMcpProtocolAuth = {
  readonly clientType: string;
  readonly scopes: readonly MemberMcpScope[];
  readonly approvedClients: readonly MemberMcpClientType[];
};

type JsonRpcMessage = {
  readonly jsonrpc?: unknown;
  readonly id?: unknown;
  readonly method?: unknown;
  readonly params?: unknown;
};

export type MemberMcpProtocolResult = {
  readonly httpStatus: number;
  readonly body: Record<string, unknown> | null;
};

export async function handleMemberMcpMessage(input: {
  message: unknown;
  auth: MemberMcpProtocolAuth;
  executeTool: (call: MemberMcpToolCall) => Promise<MemberToolEnvelope<unknown>>;
}): Promise<MemberMcpProtocolResult> {
  if (!input.message || typeof input.message !== "object" || Array.isArray(input.message)) {
    return rpcError(null, -32600, "Invalid Request", "MALFORMED_REQUEST", 400);
  }
  const message = input.message as JsonRpcMessage;
  const id = message.id ?? null;
  if (message.jsonrpc !== "2.0" || typeof message.method !== "string") {
    return rpcError(id, -32600, "Invalid Request", "MALFORMED_REQUEST", 400);
  }
  if (message.method === "notifications/initialized") return { httpStatus: 202, body: null };

  if (message.method === "initialize") {
    const requested = readRequestedProtocolVersion(message.params);
    if (!requested) {
      return rpcError(id, -32602, "Initialize protocol version is required", "MALFORMED_REQUEST", 400);
    }
    const protocolVersion = (MEMBER_MCP_SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
      ? requested
      : MEMBER_MCP_SUPPORTED_PROTOCOL_VERSIONS[0];
    return rpcResult(id, {
      protocolVersion,
      capabilities: { tools: { listChanged: false } },
      serverInfo: {
        name: "helm-member",
        title: "Helm CAIO 成员入口",
        version: "0.1.0",
        description: "我的简报、CAIO 发给我的提问；经授权可提交工作信号与现场报告（仅作为待审阅候选）。不产生任何审批、发送或执行。",
      },
      instructions:
        "读取工具只返回调用者本人的数据；写入工具分两步（prepare 拿确认码，submit 原样提交），记录为不可信的候选，由人审阅。所有结果都带有 boundary 字段：authorityEffect 恒为 none，不代表任何授权。",
    });
  }

  if (message.method === "ping") return rpcResult(id, {});

  const providerApproved = memberMcpProviderRef(input.auth.clientType, input.auth.approvedClients) !== null;

  if (message.method === "tools/list") {
    const scopes = new Set(input.auth.scopes);
    const tools = providerApproved
      ? MEMBER_MCP_TOOLS.filter((tool) => scopes.has(tool.requiredScope)).map(
          ({ name, description, inputSchema }) => ({ name, description, inputSchema }),
        )
      : [];
    return rpcResult(id, { tools });
  }

  if (message.method === "tools/call") {
    const params = readToolCallParams(message.params);
    if (!params) return rpcError(id, -32602, "Invalid tool call", "MALFORMED_REQUEST", 400);
    const definition = MEMBER_MCP_TOOLS.find((tool) => tool.name === params.name);
    if (!definition || !input.auth.scopes.includes(definition.requiredScope)) {
      return rpcError(id, -32003, "Tool scope denied", "SCOPE_VIOLATION", 403);
    }
    const parsed = parseMemberMcpToolCall(params.name, params.arguments);
    if (!parsed.ok) return rpcError(id, -32602, parsed.message, "MALFORMED_REQUEST", 400);
    const envelope = await input.executeTool(parsed.call);
    return rpcResult(id, {
      content: [{ type: "text", text: JSON.stringify(envelope) }],
      structuredContent: envelope,
      isError: !envelope.ok,
    });
  }

  return rpcError(id, -32601, "Method not found", "SCOPE_VIOLATION", 404);
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

function rpcResult(id: unknown, result: unknown): MemberMcpProtocolResult {
  return { httpStatus: 200, body: { jsonrpc: "2.0", id, result } };
}

export function rpcError(
  id: unknown,
  code: number,
  message: string,
  errorCode: string,
  httpStatus: number,
): MemberMcpProtocolResult {
  return { httpStatus, body: { jsonrpc: "2.0", id, error: { code, message, data: { errorCode } } } };
}
