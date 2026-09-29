import {
  MemberAgentConnectionError,
  authenticateMemberMcpToken,
  recordMemberMcpClientInfo,
} from "@/lib/member-mcp/connection-service";
import {
  MEMBER_MCP_SUPPORTED_PROTOCOL_VERSIONS,
  handleMemberMcpMessage,
} from "@/lib/member-mcp/mcp-protocol";
import { executeMemberMcpTool } from "@/lib/member-mcp/tool-executor";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 1024 * 1024;

export async function POST(request: Request) {
  if (process.env.HELM_MEMBER_MCP_ENABLED !== "true") {
    return rpcError(null, -32004, "Not found", "RUNTIME_DISABLED", 404);
  }
  if (!isAllowedOrigin(request.headers.get("origin"))) {
    return rpcError(null, -32003, "Origin denied", "SCOPE_VIOLATION", 403);
  }
  const accept = request.headers.get("accept") ?? "";
  if (!accept.includes("application/json") || !accept.includes("text/event-stream")) {
    return rpcError(null, -32600, "Unsupported Accept header", "MALFORMED_REQUEST", 406);
  }
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return rpcError(null, -32600, "Request too large", "MALFORMED_REQUEST", 413);
  }
  const rawBody = await request.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BYTES) {
    return rpcError(null, -32600, "Request too large", "MALFORMED_REQUEST", 413);
  }
  let message: unknown;
  try {
    message = JSON.parse(rawBody);
  } catch {
    return rpcError(null, -32700, "Parse error", "MALFORMED_REQUEST", 400);
  }
  if (!isInitializeMessage(message) && !isSupportedProtocolHeader(request.headers.get("mcp-protocol-version"))) {
    return rpcError(readMessageId(message), -32600, "Unsupported protocol version", "MALFORMED_REQUEST", 400);
  }
  const token = readBearerToken(request.headers.get("authorization"));
  if (!token) return rpcError(readMessageId(message), -32001, "Authentication required", "UNAUTHENTICATED", 401);

  try {
    const auth = await authenticateMemberMcpToken(token);
    const clientInfo = readInitializeClientInfo(message);
    const result = await handleMemberMcpMessage({
      message,
      auth,
      executeTool: (call) => executeMemberMcpTool({ auth, call }),
    });
    if (clientInfo && result.httpStatus === 200 && !result.body?.error) {
      await recordMemberMcpClientInfo({ connectionId: auth.connectionId, ...clientInfo });
    }
    if (!result.body) {
      return new Response(null, { status: result.httpStatus, headers: responseHeaders() });
    }
    return Response.json(result.body, { status: result.httpStatus, headers: responseHeaders() });
  } catch (error) {
    if (error instanceof MemberAgentConnectionError) {
      if (error.code === "RATE_LIMITED") {
        return rpcError(readMessageId(message), -32029, "Rate limited", "RATE_LIMITED", 429);
      }
      if (error.code === "RUNTIME_DISABLED") {
        return rpcError(readMessageId(message), -32004, "Not found", "RUNTIME_DISABLED", 404);
      }
      if (error.code === "EXPIRED") {
        return rpcError(readMessageId(message), -32001, "Credential expired", "EXPIRED", 401);
      }
      return rpcError(readMessageId(message), -32001, "Authentication failed", "UNAUTHENTICATED", 401);
    }
    return rpcError(readMessageId(message), -32603, "Internal error", "SAFE_INTERNAL_ERROR", 500);
  }
}

export async function GET() {
  return new Response(null, { status: 405, headers: { ...responseHeaders(), Allow: "POST" } });
}

// Distinct prefix from the QoderWork entry (hqw_) so neither route accepts the
// other's credential shape.
function readBearerToken(authorization: string | null) {
  const match = authorization?.match(/^Bearer\s+(hmm_[A-Za-z0-9_-]{43})$/);
  return match?.[1] ?? null;
}

function isAllowedOrigin(origin: string | null) {
  if (!origin) return true;
  const configured = [process.env.APP_URL, ...(process.env.HELM_MCP_ALLOWED_ORIGINS ?? "").split(",")]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  return configured.includes(origin);
}

function isSupportedProtocolHeader(value: string | null) {
  return Boolean(value && (MEMBER_MCP_SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(value));
}

function isInitializeMessage(message: unknown) {
  return Boolean(message && typeof message === "object" && (message as { method?: unknown }).method === "initialize");
}

function readMessageId(message: unknown) {
  if (!message || typeof message !== "object") return null;
  return (message as { id?: unknown }).id ?? null;
}

function readInitializeClientInfo(message: unknown) {
  if (!isInitializeMessage(message)) return null;
  const params = (message as { params?: unknown }).params;
  if (!params || typeof params !== "object") return null;
  const clientInfo = (params as { clientInfo?: unknown }).clientInfo;
  if (!clientInfo || typeof clientInfo !== "object") return null;
  const { name, version } = clientInfo as { name?: unknown; version?: unknown };
  return typeof name === "string" && typeof version === "string"
    ? { clientName: name, clientVersion: version }
    : null;
}

function responseHeaders() {
  return {
    "Cache-Control": "no-store",
    "MCP-Protocol-Version": MEMBER_MCP_SUPPORTED_PROTOCOL_VERSIONS[0],
    "X-Content-Type-Options": "nosniff",
  };
}

function rpcError(id: unknown, code: number, message: string, errorCode: string, status: number) {
  return Response.json(
    { jsonrpc: "2.0", id, error: { code, message, data: { errorCode } } },
    { status, headers: responseHeaders() },
  );
}
