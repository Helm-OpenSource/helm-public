import { describe, expect, it, vi } from "vitest";

import { handleMemberMcpMessage } from "@/lib/member-mcp/mcp-protocol";
import { buildMemberMcpEnvelope, buildSelfRecordDecision } from "@/lib/member-mcp/tools";

const now = new Date("2026-09-29T08:00:00.000Z");
const okEnvelope = () =>
  buildMemberMcpEnvelope({
    requestId: "r",
    now,
    decision: buildSelfRecordDecision({ providerRef: "member-mcp-client:codex", classifiedAt: now, now }),
    data: { ok: true },
    error: null,
  });

const auth = {
  clientType: "codex",
  scopes: ["member:brief:read", "member:prompt:read"] as const,
  approvedClients: ["codex"] as const,
};

describe("handleMemberMcpMessage", () => {
  it("initializes with a supported protocol version", async () => {
    const result = await handleMemberMcpMessage({
      message: { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } },
      auth,
      executeTool: vi.fn(),
    });
    expect(result.httpStatus).toBe(200);
    expect(result.body).toMatchObject({ result: { protocolVersion: "2025-06-18", serverInfo: { name: "helm-member" } } });
  });

  it("lists tools by scope, and none for an unapproved client", async () => {
    const list = (a: typeof auth | Record<string, unknown>) =>
      handleMemberMcpMessage({ message: { jsonrpc: "2.0", id: 2, method: "tools/list" }, auth: a as typeof auth, executeTool: vi.fn() });
    const full = await list(auth);
    expect((full.body as { result: { tools: Array<{ name: string }> } }).result.tools.map((tool) => tool.name)).toEqual([
      "get_my_brief",
      "list_my_pending_prompts",
      "get_my_prompt",
    ]);
    const briefOnly = await list({ ...auth, scopes: ["member:brief:read"] });
    expect((briefOnly.body as { result: { tools: Array<{ name: string }> } }).result.tools.map((tool) => tool.name)).toEqual(["get_my_brief"]);
    const writer = await list({ ...auth, scopes: [...auth.scopes, "member:signal:write", "member:report:write"] });
    expect((writer.body as { result: { tools: unknown[] } }).result.tools).toHaveLength(7);
    const unapprovedWriter = await list({ ...auth, clientType: "qwenwork", scopes: ["member:signal:write"] });
    expect((unapprovedWriter.body as { result: { tools: unknown[] } }).result.tools).toEqual([]);
    const unapproved = await list({ ...auth, clientType: "qwenwork" });
    expect((unapproved.body as { result: { tools: unknown[] } }).result.tools).toEqual([]);
  });

  it("denies a tool outside the connection's scopes without executing it", async () => {
    const executeTool = vi.fn();
    const result = await handleMemberMcpMessage({
      message: { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "get_my_prompt", arguments: { promptRef: "p1" } } },
      auth: { ...auth, scopes: ["member:brief:read"] },
      executeTool,
    });
    expect(result.httpStatus).toBe(403);
    expect(executeTool).not.toHaveBeenCalled();
  });

  it("refuses write tools to a read-only connection without executing", async () => {
    const executeTool = vi.fn();
    const result = await handleMemberMcpMessage({
      message: { jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "prepare_work_signal", arguments: { kind: "progress", summary: "x" } } },
      auth,
      executeTool,
    });
    expect(result.httpStatus).toBe(403);
    expect(executeTool).not.toHaveBeenCalled();
  });

  it("rejects malformed arguments before execution", async () => {
    const executeTool = vi.fn();
    const result = await handleMemberMcpMessage({
      message: { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "get_my_brief", arguments: { memberRef: "x" } } },
      auth,
      executeTool,
    });
    expect(result.httpStatus).toBe(400);
    expect(executeTool).not.toHaveBeenCalled();
  });

  it("wraps the executor envelope as structured content", async () => {
    const executeTool = vi.fn(async () => okEnvelope());
    const result = await handleMemberMcpMessage({
      message: { jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "get_my_brief", arguments: {} } },
      auth,
      executeTool,
    });
    expect(executeTool).toHaveBeenCalledWith({ toolName: "get_my_brief", arguments: {} });
    expect(result.body).toMatchObject({ result: { isError: false, structuredContent: { ok: true } } });
  });

  it("accepts every notification with 202 and no body", async () => {
    for (const method of ["notifications/initialized", "notifications/cancelled", "notifications/progress"]) {
      const result = await handleMemberMcpMessage({ message: { jsonrpc: "2.0", method }, auth, executeTool: vi.fn() });
      expect(result).toEqual({ httpStatus: 202, body: null });
    }
  });

  it("returns 404 for unknown methods and 400 for invalid requests", async () => {
    expect((await handleMemberMcpMessage({ message: { jsonrpc: "2.0", id: 6, method: "resources/list" }, auth, executeTool: vi.fn() })).httpStatus).toBe(404);
    expect((await handleMemberMcpMessage({ message: [], auth, executeTool: vi.fn() })).httpStatus).toBe(400);
    expect((await handleMemberMcpMessage({ message: { jsonrpc: "1.0", method: "ping" }, auth, executeTool: vi.fn() })).httpStatus).toBe(400);
  });
});
