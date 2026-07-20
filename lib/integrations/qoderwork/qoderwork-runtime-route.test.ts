import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  executeTool: vi.fn(),
  recordClientInfo: vi.fn(),
}));

vi.mock("@/lib/integrations/qoderwork/connection-service", async () => {
  const actual = await vi.importActual<typeof import("./connection-service")>(
    "./connection-service",
  );
  return {
    ...actual,
    authenticateQoderWorkConnection: mocks.authenticate,
    recordQoderWorkClientInfo: mocks.recordClientInfo,
  };
});

vi.mock("@/lib/integrations/qoderwork/tool-executor", () => ({
  executeQoderWorkTool: mocks.executeTool,
}));

import { GET, POST } from "@/app/api/mcp/qoderwork/route";

const TOKEN = `hqw_${"A".repeat(43)}`;
const AUTH = {
  connectionId: "connection-1",
  workspaceId: "workspace-1",
  userId: "user-1",
  deviceRef: "device:synthetic-1",
  observationProgramId: "program-1",
  scopes: ["context:read"],
  allowedSourceIds: ["source-1"],
  allowedObjectTypes: ["opportunity"],
  maxDataClassification: "internal",
  approvedModelProfileRefs: [],
};

function request(message: unknown, headers: Record<string, string> = {}) {
  return new Request("https://helm.example/api/mcp/qoderwork", {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${TOKEN}`,
      "content-type": "application/json",
      "mcp-protocol-version": "2025-11-25",
      ...headers,
    },
    body: JSON.stringify(message),
  });
}

describe("QoderWork Streamable HTTP route", () => {
  beforeEach(() => {
    process.env.HELM_QODERWORK_MCP_ENABLED = "true";
    process.env.APP_URL = "https://helm.example";
    mocks.authenticate.mockReset().mockResolvedValue(AUTH);
    mocks.executeTool.mockReset();
    mocks.recordClientInfo.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete process.env.HELM_QODERWORK_MCP_ENABLED;
    delete process.env.APP_URL;
  });

  it("stays hidden while the global feature flag is off", async () => {
    process.env.HELM_QODERWORK_MCP_ENABLED = "false";
    const response = await POST(request({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }));
    expect(response.status).toBe(404);
    expect(mocks.authenticate).not.toHaveBeenCalled();
  });

  it("rejects an untrusted browser Origin before authentication", async () => {
    const response = await POST(
      request(
        { jsonrpc: "2.0", id: 1, method: "initialize", params: {} },
        { origin: "https://attacker.example" },
      ),
    );
    expect(response.status).toBe(403);
    expect(mocks.authenticate).not.toHaveBeenCalled();
  });

  it("negotiates the latest protocol and returns only scoped tools", async () => {
    const initialized = await POST(
      request({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "qoderwork", version: "synthetic" } },
      }),
    );
    expect(initialized.status).toBe(200);
    expect(initialized.headers.get("mcp-protocol-version")).toBe("2025-11-25");
    expect(mocks.recordClientInfo).toHaveBeenCalledWith({
      connectionId: "connection-1",
      clientName: "qoderwork",
      clientVersion: "synthetic",
    });

    const tools = await POST(request({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }));
    const payload = await tools.json();
    expect(payload.result.tools.map((tool: { name: string }) => tool.name)).toEqual(["get_context_pack"]);
  });

  it("rejects requests larger than 1 MB without authenticating", async () => {
    const oversized = new Request("https://helm.example/api/mcp/qoderwork", {
      method: "POST",
      headers: {
        accept: "application/json, text/event-stream",
        authorization: `Bearer ${TOKEN}`,
        "content-type": "application/json",
        "content-length": String(1024 * 1024 + 1),
      },
      body: "{}",
    });
    const response = await POST(oversized);
    expect(response.status).toBe(413);
    expect(mocks.authenticate).not.toHaveBeenCalled();
  });

  it("does not echo credentials, paths, or internal exceptions", async () => {
    mocks.authenticate.mockRejectedValue(
      new Error(`Bearer ${TOKEN} failed at /Users/example/private/source.md`),
    );
    const response = await POST(request({ jsonrpc: "2.0", id: 4, method: "tools/list", params: {} }));
    const body = JSON.stringify(await response.json());
    expect(response.status).toBe(500);
    expect(body).not.toContain(TOKEN);
    expect(body).not.toContain("/Users/example");
    expect(body).not.toContain("failed at");
    expect(body).toContain("SAFE_INTERNAL_ERROR");
  });

  it("returns 405 for stateless GET because no SSE stream is offered", async () => {
    const response = await GET();
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });
});
