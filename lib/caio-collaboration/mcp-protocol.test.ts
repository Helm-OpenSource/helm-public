import { describe, expect, it, vi } from "vitest";

import type { WorkBuddyClientIdentity } from "./contracts";
import type {
  WorkBuddyMcpToolDispatcher,
} from "./mcp-tool-dispatcher";
import {
  handleWorkBuddyMcpMessage,
} from "./mcp-protocol";

const IDENTITY: WorkBuddyClientIdentity = {
  schemaVersion: "helm.workbuddy-client-identity/v1",
  clientId: "client:workbuddy-ceo",
  workspaceId: "workspace:synthetic",
  actorUserId: "user:owner",
  certificateFingerprint: `sha256:${"d".repeat(64)}`,
  scopes: ["caio:p1c:read"],
  transport: "mtls",
  mtlsVerified: true,
  authenticatedAt: "2026-07-26T08:00:00.000Z",
};

function createDispatcher(
  overrides: Partial<WorkBuddyMcpToolDispatcher> = {},
): WorkBuddyMcpToolDispatcher {
  return {
    listTools: vi.fn(() => [
      {
        name: "get_p1c_read_projection",
        description: "Read a governed P1C projection.",
        risk: "read",
        inputSchema: {
          type: "object",
          additionalProperties: false,
          properties: {
            workspaceId: { type: "string" },
          },
          required: ["workspaceId"],
        },
      },
    ]),
    dispatch: vi.fn(async ({ context }) => ({
      schemaVersion: "helm.workbuddy-tool-envelope/v1",
      requestId: context.requestId,
      serverTime: "2026-07-26T08:00:01.000Z",
      ok: true,
      data: { portfolioRef: "portfolio:synthetic" },
      error: null,
      boundary: {
        authorityEffect: "none",
        canonicalMutationAuthorityGranted: false,
        externalExecutionAllowed: false,
        rawContentIncluded: false,
      },
    })),
    ...overrides,
  };
}

describe("WorkBuddy MCP protocol", () => {
  it("negotiates a supported protocol without exposing transport authority", async () => {
    const result = await handleWorkBuddyMcpMessage({
      message: {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: {
            name: "workbuddy",
            version: "synthetic",
          },
        },
      },
      identity: IDENTITY,
      dispatcher: createDispatcher(),
      requestId: "request:mcp-initialize",
    });

    expect(result).toMatchObject({
      httpStatus: 200,
      body: {
        jsonrpc: "2.0",
        id: 1,
        result: {
          protocolVersion: "2025-11-25",
          capabilities: {
            tools: { listChanged: false },
          },
          serverInfo: {
            name: "helm-caio-workbuddy-lan",
          },
        },
      },
    });
    expect(result.body?.result).not.toHaveProperty("transport");
    expect(result.body?.result).not.toHaveProperty("authorization");
  });

  it("rejects every message when the mTLS-derived identity is invalid", async () => {
    const dispatcher = createDispatcher();
    const result = await handleWorkBuddyMcpMessage({
      message: {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      },
      identity: {
        ...IDENTITY,
        mtlsVerified: false,
      } as unknown as WorkBuddyClientIdentity,
      dispatcher,
      requestId: "request:mcp-invalid-identity",
    });

    expect(result).toMatchObject({
      httpStatus: 401,
      body: {
        error: {
          code: -32001,
          data: {
            errorCode: "CLIENT_IDENTITY_INVALID",
          },
        },
      },
    });
    expect(dispatcher.listTools).not.toHaveBeenCalled();
  });

  it("rejects an elapsed request deadline before protocol dispatch", async () => {
    const dispatcher = createDispatcher();
    const controller = new AbortController();
    controller.abort();
    const result = await handleWorkBuddyMcpMessage({
      message: {
        jsonrpc: "2.0",
        id: 20,
        method: "tools/list",
        params: {},
      },
      identity: IDENTITY,
      dispatcher,
      requestId: "request:mcp-deadline",
      signal: controller.signal,
    });

    expect(result).toMatchObject({
      httpStatus: 504,
      body: {
        error: {
          code: -32002,
          data: {
            errorCode: "REQUEST_DEADLINE_EXCEEDED",
          },
        },
      },
    });
    expect(dispatcher.listTools).not.toHaveBeenCalled();
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it("lists only dispatcher-enabled tools and preserves strict schemas", async () => {
    const dispatcher = createDispatcher();
    const result = await handleWorkBuddyMcpMessage({
      message: {
        jsonrpc: "2.0",
        id: "list-1",
        method: "tools/list",
        params: {},
      },
      identity: IDENTITY,
      dispatcher,
      requestId: "request:mcp-list",
    });

    expect(result.body?.result).toEqual({
      tools: [
        {
          name: "get_p1c_read_projection",
          description: "Read a governed P1C projection.",
          risk: "read",
          inputSchema: {
            type: "object",
            additionalProperties: false,
            properties: {
              workspaceId: { type: "string" },
            },
            required: ["workspaceId"],
          },
        },
      ],
    });
    expect(dispatcher.listTools).toHaveBeenCalledWith(IDENTITY);
  });

  it("dispatches tool calls with the server-generated request id and identity", async () => {
    const dispatcher = createDispatcher();
    const result = await handleWorkBuddyMcpMessage({
      message: {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "get_p1c_read_projection",
          arguments: {
            workspaceId: "workspace:synthetic",
          },
        },
      },
      identity: IDENTITY,
      dispatcher,
      requestId: "request:mcp-tool-call",
    });

    expect(dispatcher.dispatch).toHaveBeenCalledWith({
      name: "get_p1c_read_projection",
      input: {
        workspaceId: "workspace:synthetic",
      },
      context: {
        requestId: "request:mcp-tool-call",
        identity: IDENTITY,
        signal: undefined,
      },
    });
    expect(result.body?.result).toMatchObject({
      isError: false,
      structuredContent: {
        requestId: "request:mcp-tool-call",
        ok: true,
        boundary: {
          authorityEffect: "none",
          canonicalMutationAuthorityGranted: false,
          externalExecutionAllowed: false,
          rawContentIncluded: false,
        },
      },
    });
  });

  it("returns dispatcher denials as MCP tool errors without widening authority", async () => {
    const dispatcher = createDispatcher({
      dispatch: vi.fn(async ({ context }) => ({
        schemaVersion: "helm.workbuddy-tool-envelope/v1",
        requestId: context.requestId,
        serverTime: "2026-07-26T08:00:01.000Z",
        ok: false,
        data: null,
        error: {
          code: "MUTATION_DISABLED",
          message: "Canonical mutation tools are disabled.",
          retryable: false,
        },
        boundary: {
          authorityEffect: "none",
          canonicalMutationAuthorityGranted: false,
          externalExecutionAllowed: false,
          rawContentIncluded: false,
        },
      })),
    });
    const result = await handleWorkBuddyMcpMessage({
      message: {
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "submit_question_selection",
          arguments: {},
        },
      },
      identity: IDENTITY,
      dispatcher,
      requestId: "request:mcp-denied",
    });

    expect(result).toMatchObject({
      httpStatus: 200,
      body: {
        result: {
          isError: true,
          structuredContent: {
            ok: false,
            error: {
              code: "MUTATION_DISABLED",
            },
            boundary: {
              authorityEffect: "none",
              canonicalMutationAuthorityGranted: false,
              externalExecutionAllowed: false,
            },
          },
        },
      },
    });
  });

  it("rejects malformed tool calls before dispatch", async () => {
    const dispatcher = createDispatcher();
    const result = await handleWorkBuddyMcpMessage({
      message: {
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: {
          name: "",
          arguments: [],
        },
      },
      identity: IDENTITY,
      dispatcher,
      requestId: "request:mcp-malformed",
    });

    expect(result).toMatchObject({
      httpStatus: 400,
      body: {
        error: {
          code: -32602,
          data: {
            errorCode: "INVALID_TOOL_INPUT",
          },
        },
      },
    });
    expect(dispatcher.dispatch).not.toHaveBeenCalled();
  });

  it("accepts initialized notifications and rejects unknown methods", async () => {
    const dispatcher = createDispatcher();
    const initialized = await handleWorkBuddyMcpMessage({
      message: {
        jsonrpc: "2.0",
        method: "notifications/initialized",
      },
      identity: IDENTITY,
      dispatcher,
      requestId: "request:mcp-initialized",
    });
    expect(initialized).toEqual({
      httpStatus: 202,
      body: null,
    });

    const unknown = await handleWorkBuddyMcpMessage({
      message: {
        jsonrpc: "2.0",
        id: 6,
        method: "resources/list",
        params: {},
      },
      identity: IDENTITY,
      dispatcher,
      requestId: "request:mcp-unknown",
    });
    expect(unknown).toMatchObject({
      httpStatus: 404,
      body: {
        error: {
          code: -32601,
          data: {
            errorCode: "METHOD_NOT_FOUND",
          },
        },
      },
    });
  });
});
