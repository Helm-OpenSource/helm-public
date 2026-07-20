import { describe, expect, it, vi } from "vitest";
import { handleQoderWorkMcpMessage } from "./mcp-protocol";

const AUTH = {
  connectionId: "connection-1",
  workspaceId: "workspace-1",
  userId: "user-1",
  deviceRef: "device:synthetic-1",
  scopes: ["context:read", "evidence:propose"] as const,
};

describe("QoderWork MCP protocol", () => {
  it("negotiates the latest supported protocol and advertises tools only", async () => {
    const result = await handleQoderWorkMcpMessage({
      message: {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "qoderwork-cn", version: "synthetic" },
        },
      },
      auth: AUTH,
      executeTool: vi.fn(),
    });

    expect(result.httpStatus).toBe(200);
    expect(result.body).toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: {
        protocolVersion: "2025-11-25",
        capabilities: { tools: { listChanged: false } },
      },
    });
  });

  it("rejects initialize requests that omit the required protocol version", async () => {
    const result = await handleQoderWorkMcpMessage({
      message: {
        jsonrpc: "2.0",
        id: 11,
        method: "initialize",
        params: { capabilities: {}, clientInfo: { name: "qoderwork-cn", version: "synthetic" } },
      },
      auth: AUTH,
      executeTool: vi.fn(),
    });

    expect(result).toMatchObject({
      httpStatus: 400,
      body: { error: { data: { errorCode: "MALFORMED_REQUEST" } } },
    });
  });

  it("lists only tools granted by connection scopes", async () => {
    const result = await handleQoderWorkMcpMessage({
      message: { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
      auth: AUTH,
      executeTool: vi.fn(),
    });

    const names = result.body?.result?.tools.map((tool: { name: string }) => tool.name);
    expect(names).toEqual(["get_context_pack", "propose_evidence_manifest"]);
    expect(names).not.toContain("approve");
    expect(names).not.toContain("send");
  });

  it("blocks tools that are known but not granted to this device", async () => {
    const executeTool = vi.fn();
    const result = await handleQoderWorkMcpMessage({
      message: {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "get_work_packet",
          arguments: {
            schemaVersion: "1.0",
            correlationRef: "corr_scope_001",
            idempotencyKey: "idem_scope_001",
            workPacketRef: "work-packet:synthetic-1",
            objectRef: { type: "opportunity", id: "synthetic-1" },
          },
        },
      },
      auth: AUTH,
      executeTool,
    });

    expect(result.body).toMatchObject({
      error: { code: -32003, data: { errorCode: "SCOPE_VIOLATION" } },
    });
    expect(executeTool).not.toHaveBeenCalled();
  });

  it("validates tool arguments before dispatch and returns MCP content", async () => {
    const executeTool = vi.fn().mockResolvedValue({
      status: "review_required",
      requestRef: "request-1",
      correlationRef: "corr_evidence_001",
      acceptedArtifactRefs: ["artifact-1"],
      receiptRef: "receipt-1",
      warnings: ["human_review_required"],
      nextAllowedSurface: "/memory",
    });
    const result = await handleQoderWorkMcpMessage({
      message: {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "propose_evidence_manifest",
          arguments: {
            schemaVersion: "1.0",
            correlationRef: "corr_evidence_001",
            idempotencyKey: "idem_evidence_001",
            sourceProgramRef: "program:synthetic-owner-loop",
            observationSourceRef: "source_synthetic_meeting_001",
            sourceRef: "opaque:meeting:sha256:5a61",
            sourceKind: "meeting_note",
            objectRef: { type: "opportunity", id: "opp_synthetic_001" },
            observedAt: "2026-07-20T08:00:00.000Z",
            dataClassification: "internal",
            redactionStatus: "redacted",
            summary: "Synthetic evidence summary",
            evidenceRefs: ["evidence:meeting:synthetic:001"],
            contentHash: `sha256:${"a".repeat(64)}`,
          },
        },
      },
      auth: AUTH,
      executeTool,
    });

    expect(executeTool).toHaveBeenCalledTimes(1);
    expect(result.body?.result).toMatchObject({ isError: false });
    expect(result.body?.result?.structuredContent).toMatchObject({ receiptRef: "receipt-1" });
  });

  it("rejects unknown JSON-RPC methods and accepts initialized notifications", async () => {
    const unknown = await handleQoderWorkMcpMessage({
      message: { jsonrpc: "2.0", id: 5, method: "prompts/list", params: {} },
      auth: AUTH,
      executeTool: vi.fn(),
    });
    expect(unknown.body).toMatchObject({ error: { code: -32601 } });

    const initialized = await handleQoderWorkMcpMessage({
      message: { jsonrpc: "2.0", method: "notifications/initialized" },
      auth: AUTH,
      executeTool: vi.fn(),
    });
    expect(initialized).toEqual({ httpStatus: 202, body: null });
  });
});
