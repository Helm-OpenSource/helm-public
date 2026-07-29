import { z } from "zod";
import { describe, expect, it, vi } from "vitest";

import type { WorkBuddyClientIdentity } from "./contracts";
import { DEFAULT_WORKBUDDY_FEATURE_FLAGS } from "./feature-flags";
import {
  createWorkBuddyMcpToolDispatcher,
  type WorkBuddyToolDefinition,
} from "./mcp-tool-dispatcher";
import { createWorkBuddyDeliveryToolDefinitions } from "./delivery-tools";
import { createWorkBuddyReadOnlyToolDefinitions } from "./readonly-tools";

const identity: WorkBuddyClientIdentity = {
  schemaVersion: "helm.workbuddy-client-identity/v1",
  clientId: "client:workbuddy-ceo",
  workspaceId: "workspace:demo",
  actorUserId: "user:owner",
  certificateFingerprint: `sha256:${"d".repeat(64)}`,
  scopes: ["caio:p1c:read"],
  transport: "mtls",
  mtlsVerified: true,
  authenticatedAt: "2026-07-26T02:00:00.000Z",
};

const readTool: WorkBuddyToolDefinition = {
  name: "get_p1c_read_projection",
  description: "Read a governed P1C projection.",
  risk: "read",
  requiredScopes: ["caio:p1c:read"],
  inputSchema: z.object({ workspaceId: z.string().min(1) }).strict(),
  inputJsonSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      workspaceId: { type: "string" },
    },
    required: ["workspaceId"],
  },
  execute: async () => ({ portfolioRef: "portfolio:1" }),
};

const mutationTool: WorkBuddyToolDefinition = {
  name: "submit_caio_question_selection",
  description: "Fixture mutation tool.",
  risk: "mutation",
  mutationFeatureFlag: "promptResponsesEnabled",
  requiredScopes: ["caio:canonical:mutate"],
  inputSchema: z.object({ selectionRef: z.string().min(1) }).strict(),
  inputJsonSchema: {
    type: "object",
    additionalProperties: false,
    properties: {
      selectionRef: { type: "string" },
    },
    required: ["selectionRef"],
  },
  execute: async () => ({ accepted: true }),
};

describe("WorkBuddy MCP tool dispatcher", () => {
  it("registers nothing when feature flags use their defaults", () => {
    const dispatcher = createWorkBuddyMcpToolDispatcher({
      flags: DEFAULT_WORKBUDDY_FEATURE_FLAGS,
      tools: [readTool, mutationTool],
    });

    expect(dispatcher.listTools()).toEqual([]);
  });

  it("registers read tools but does not register mutation tools when mutations are disabled", () => {
    const dispatcher = createWorkBuddyMcpToolDispatcher({
      flags: {
        gatewayEnabled: true,
        readEnabled: true,
        pushEnabled: false,
        presenceEnabled: false,
        mutationsEnabled: false,
        promptResponsesEnabled: false,
        questionSelectionsEnabled: false,
        adviceDecisionsEnabled: false,
      },
      tools: [readTool, mutationTool],
      now: () => "2026-07-26T02:00:00.000Z",
    });

    expect(dispatcher.listTools().map((tool) => tool.name)).toEqual([
      "get_p1c_read_projection",
    ]);
    expect(
      dispatcher.dispatch({
        name: "submit_caio_question_selection",
        input: { selectionRef: "selection:1" },
        context: { requestId: "request:mutation", identity },
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "MUTATION_DISABLED" },
    });
  });

  it("lists only tools allowed by the requesting mTLS identity scopes", () => {
    const dispatcher = createWorkBuddyMcpToolDispatcher({
      flags: {
        gatewayEnabled: true,
        readEnabled: true,
        pushEnabled: false,
        presenceEnabled: false,
        mutationsEnabled: true,
        promptResponsesEnabled: true,
        questionSelectionsEnabled: false,
        adviceDecisionsEnabled: false,
      },
      tools: [readTool, mutationTool],
    });

    expect(
      dispatcher.listTools(identity).map((tool) => tool.name),
    ).toEqual(["get_p1c_read_projection"]);
    expect(
      dispatcher
        .listTools({
          ...identity,
          scopes: ["caio:canonical:mutate"],
        })
        .map((tool) => tool.name),
    ).toEqual(["submit_caio_question_selection"]);
  });

  it("provides a standard registry with presence and P1C read tools only", () => {
    const tools = createWorkBuddyReadOnlyToolDefinitions({
      beginOwnerPresenceChallenge: async () => ({ challengeId: "challenge:1" }),
      completeOwnerPresenceChallenge: async () => ({ presenceRef: "presence:1" }),
      getP1cReadProjection: async () => ({ portfolioRef: "portfolio:1" }),
    });
    const dispatcher = createWorkBuddyMcpToolDispatcher({
      flags: {
        gatewayEnabled: true,
        readEnabled: true,
        pushEnabled: false,
        presenceEnabled: true,
        mutationsEnabled: false,
        promptResponsesEnabled: false,
        questionSelectionsEnabled: false,
        adviceDecisionsEnabled: false,
      },
      tools,
    });

    expect(dispatcher.listTools()).toEqual([
      expect.objectContaining({
        name: "begin_owner_presence_challenge",
        risk: "presence",
      }),
      expect.objectContaining({
        name: "complete_owner_presence_challenge",
        risk: "presence",
      }),
      expect.objectContaining({
        name: "get_p1c_read_projection",
        risk: "read",
      }),
    ]);
  });

  it("validates scope and strict tool input before calling a read handler", async () => {
    const dispatcher = createWorkBuddyMcpToolDispatcher({
      flags: {
        gatewayEnabled: true,
        readEnabled: true,
        pushEnabled: false,
        presenceEnabled: false,
        mutationsEnabled: false,
        promptResponsesEnabled: false,
        questionSelectionsEnabled: false,
        adviceDecisionsEnabled: false,
      },
      tools: [readTool],
      now: () => "2026-07-26T02:00:00.000Z",
    });

    await expect(
      dispatcher.dispatch({
        name: "get_p1c_read_projection",
        input: {
          workspaceId: "workspace:demo",
          actorUserId: "user:spoofed",
        },
        context: { requestId: "request:invalid", identity },
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "INVALID_TOOL_INPUT" },
    });

    await expect(
      dispatcher.dispatch({
        name: "get_p1c_read_projection",
        input: { workspaceId: "workspace:demo" },
        context: {
          requestId: "request:scope",
          identity: {
            ...identity,
            scopes: [],
          },
        },
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "SCOPE_DENIED" },
    });

    await expect(
      dispatcher.dispatch({
        name: "get_p1c_read_projection",
        input: { workspaceId: "workspace:demo" },
        context: { requestId: "request:read", identity },
      }),
    ).resolves.toMatchObject({
      ok: true,
      data: { portfolioRef: "portfolio:1" },
    });
  });

  it("fails closed before tool execution when the request deadline has elapsed", async () => {
    const execute = vi.fn(async () => ({
      portfolioRef: "portfolio:should-not-run",
    }));
    const dispatcher = createWorkBuddyMcpToolDispatcher({
      flags: {
        gatewayEnabled: true,
        readEnabled: true,
        pushEnabled: false,
        presenceEnabled: false,
        mutationsEnabled: false,
        promptResponsesEnabled: false,
        questionSelectionsEnabled: false,
        adviceDecisionsEnabled: false,
      },
      tools: [{ ...readTool, execute }],
      now: () => "2026-07-26T02:00:00.000Z",
    });
    const controller = new AbortController();
    controller.abort();

    await expect(
      dispatcher.dispatch({
        name: "get_p1c_read_projection",
        input: { workspaceId: "workspace:demo" },
        context: {
          requestId: "request:deadline",
          identity,
          signal: controller.signal,
        },
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: {
        code: "REQUEST_DEADLINE_EXCEEDED",
        retryable: true,
      },
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it("does not return success when the deadline elapses during tool execution", async () => {
    let resolveExecution:
      | ((value: Readonly<{ portfolioRef: string }>) => void)
      | undefined;
    const execute = vi.fn(
      () =>
        new Promise<Readonly<{ portfolioRef: string }>>((resolve) => {
          resolveExecution = resolve;
        }),
    );
    const dispatcher = createWorkBuddyMcpToolDispatcher({
      flags: {
        gatewayEnabled: true,
        readEnabled: true,
        pushEnabled: false,
        presenceEnabled: false,
        mutationsEnabled: false,
        promptResponsesEnabled: false,
        questionSelectionsEnabled: false,
        adviceDecisionsEnabled: false,
      },
      tools: [{ ...readTool, execute }],
      now: () => "2026-07-26T02:00:00.000Z",
    });
    const controller = new AbortController();
    const pending = dispatcher.dispatch({
      name: "get_p1c_read_projection",
      input: { workspaceId: "workspace:demo" },
      context: {
        requestId: "request:deadline-in-flight",
        identity,
        signal: controller.signal,
      },
    });

    await vi.waitFor(() => {
      expect(execute).toHaveBeenCalledTimes(1);
    });
    controller.abort();
    resolveExecution?.({ portfolioRef: "portfolio:late" });

    await expect(pending).resolves.toMatchObject({
      ok: false,
      error: {
        code: "REQUEST_DEADLINE_EXCEEDED",
        retryable: true,
      },
    });
  });

  it("registers delivery tools only behind the independent push flag", () => {
    const tools = createWorkBuddyDeliveryToolDefinitions({
      pollCeoPrompts: async () => ({ items: [] }),
      listPendingCeoPrompts: async () => ({ items: [] }),
      getCeoPrompt: async () => ({ deliveryObjectId: "delivery:1" }),
    });
    const disabled = createWorkBuddyMcpToolDispatcher({
      flags: {
        gatewayEnabled: true,
        readEnabled: true,
        pushEnabled: false,
        presenceEnabled: false,
        mutationsEnabled: false,
        promptResponsesEnabled: false,
        questionSelectionsEnabled: false,
        adviceDecisionsEnabled: false,
      },
      tools,
    });
    const enabled = createWorkBuddyMcpToolDispatcher({
      flags: {
        gatewayEnabled: true,
        readEnabled: true,
        pushEnabled: true,
        presenceEnabled: false,
        mutationsEnabled: false,
        promptResponsesEnabled: false,
        questionSelectionsEnabled: false,
        adviceDecisionsEnabled: false,
      },
      tools,
    });

    expect(disabled.listTools()).toEqual([]);
    expect(enabled.listTools().map((tool) => tool.name)).toEqual([
      "poll_ceo_prompts",
      "list_pending_ceo_prompts",
      "get_ceo_prompt",
    ]);
  });

  it("derives the delivery client and workspace from mTLS identity", async () => {
    const pollCeoPrompts = vi.fn(async () => ({ items: [] }));
    const tools = createWorkBuddyDeliveryToolDefinitions({
      pollCeoPrompts,
      listPendingCeoPrompts: async () => ({ items: [] }),
      getCeoPrompt: async () => ({ deliveryObjectId: "delivery:1" }),
    });
    const dispatcher = createWorkBuddyMcpToolDispatcher({
      flags: {
        gatewayEnabled: true,
        readEnabled: true,
        pushEnabled: true,
        presenceEnabled: false,
        mutationsEnabled: false,
        promptResponsesEnabled: false,
        questionSelectionsEnabled: false,
        adviceDecisionsEnabled: false,
      },
      tools,
    });
    const deliveryIdentity = {
      ...identity,
      scopes: ["caio:delivery:read"] as const,
    };
    const cursor = {
      schemaVersion: "helm.caio-delivery-cursor/v1" as const,
      workspaceId: "workspace:demo",
      clientId: "client:workbuddy-ceo",
      criticalSequence: 0,
      normalSequence: 0,
    };

    await expect(
      dispatcher.dispatch({
        name: "poll_ceo_prompts",
        input: {
          workspaceId: "workspace:other",
          severity: "critical",
          cursor: { ...cursor, workspaceId: "workspace:other" },
          limit: 10,
        },
        context: {
          requestId: "request:cross-workspace",
          identity: deliveryIdentity,
        },
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "SCOPE_DENIED" },
    });

    await expect(
      dispatcher.dispatch({
        name: "poll_ceo_prompts",
        input: {
          workspaceId: "workspace:demo",
          severity: "critical",
          cursor,
          limit: 10,
          actorUserId: "user:spoofed",
        },
        context: {
          requestId: "request:spoofed",
          identity: deliveryIdentity,
        },
      }),
    ).resolves.toMatchObject({
      ok: false,
      error: { code: "INVALID_TOOL_INPUT" },
    });

    await expect(
      dispatcher.dispatch({
        name: "poll_ceo_prompts",
        input: {
          workspaceId: "workspace:demo",
          severity: "critical",
          cursor,
          limit: 10,
        },
        context: {
          requestId: "request:delivery",
          identity: deliveryIdentity,
        },
      }),
    ).resolves.toMatchObject({
      ok: true,
      data: { items: [] },
    });
    expect(pollCeoPrompts).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace:demo",
        severity: "critical",
      }),
      expect.objectContaining({
        identity: expect.objectContaining({
          clientId: "client:workbuddy-ceo",
          actorUserId: "user:owner",
        }),
      }),
    );
  });
});
