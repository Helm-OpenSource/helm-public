import { describe, expect, it, vi } from "vitest";

import { createToolSuccess } from "./contracts";
import {
  createWorkBuddyEdgeIngressHandler,
  type WorkBuddyEdgeIngressEnvelope,
} from "./edge-ingress";

const SECRET = "e".repeat(48);
const SYSTEM_KEY = "anson";

function envelope(
  overrides: Partial<WorkBuddyEdgeIngressEnvelope> = {},
): WorkBuddyEdgeIngressEnvelope {
  return {
    schemaVersion: "helm.workbuddy-edge-ingress/v1",
    workspaceSystemKey: SYSTEM_KEY,
    identity: {
      clientId: "device:colleague-one",
      actorUserId: "user:colleague-one",
      certificateFingerprint: `sha256:${"a".repeat(64)}`,
      scopes: ["caio:delivery:read", "caio:p1c:read"],
      authenticatedAt: "2026-09-20T08:00:00.000Z",
    },
    message: {
      jsonrpc: "2.0",
      id: "req-1",
      method: "tools/list",
    },
    ...overrides,
  };
}

function setup() {
  const resolveWorkspaceId = vi.fn(async () => "workspace-cuid-real");
  const dispatch = vi.fn(async ({ context }) =>
    createToolSuccess({
      requestId: context.requestId,
      serverTime: "2026-09-20T08:00:01.000Z",
      data: { workspaceId: context.identity.workspaceId },
    }),
  );
  const handler = createWorkBuddyEdgeIngressHandler({
    expectedSecret: SECRET,
    expectedWorkspaceSystemKey: SYSTEM_KEY,
    resolveWorkspaceId,
    dispatcher: {
      listTools: () => [],
      dispatch,
    },
    randomRequestId: () => "edge-request:test",
  });
  return { handler, resolveWorkspaceId, dispatch };
}

describe("WorkBuddy cloud edge ingress", () => {
  it("fails closed when the edge credential is missing or wrong", async () => {
    const { handler, resolveWorkspaceId } = setup();

    await expect(handler({ credential: "", body: envelope() })).resolves.toMatchObject({
      status: 401,
      body: { ok: false, error: "workbuddy_edge_unauthorized" },
    });
    await expect(handler({ credential: `${SECRET}x`, body: envelope() })).resolves.toMatchObject({
      status: 401,
    });
    expect(resolveWorkspaceId).not.toHaveBeenCalled();
  });

  it("rejects unknown fields, caller workspace ids, and elevated scopes", async () => {
    const { handler } = setup();

    await expect(
      handler({
        credential: SECRET,
        body: { ...envelope(), workspaceId: "attacker-selected" },
      }),
    ).resolves.toMatchObject({ status: 400, body: { error: "workbuddy_edge_request_invalid" } });

    await expect(
      handler({
        credential: SECRET,
        body: {
          ...envelope(),
          identity: {
            ...envelope().identity,
            scopes: ["caio:p1c:read", "caio:canonical:mutate"],
          },
        },
      }),
    ).resolves.toMatchObject({ status: 400, body: { error: "workbuddy_edge_request_invalid" } });
  });

  it("requires the owner-configured systemKey and a live workspace", async () => {
    const { handler, resolveWorkspaceId } = setup();

    await expect(
      handler({ credential: SECRET, body: envelope({ workspaceSystemKey: "other" }) }),
    ).resolves.toMatchObject({ status: 403, body: { error: "workbuddy_edge_workspace_refused" } });

    resolveWorkspaceId.mockResolvedValueOnce(null);
    await expect(handler({ credential: SECRET, body: envelope() })).resolves.toMatchObject({
      status: 503,
      body: { error: "workbuddy_edge_workspace_unavailable" },
    });
  });

  it("replaces the edge reference with the real database workspace id", async () => {
    const { handler, resolveWorkspaceId } = setup();
    const result = await handler({ credential: SECRET, body: envelope() });

    expect(resolveWorkspaceId).toHaveBeenCalledWith(SYSTEM_KEY);
    expect(result).toMatchObject({
      status: 200,
      body: { jsonrpc: "2.0", id: "req-1", result: { tools: [] } },
    });
  });

  it("dispatches read tools with the resolved workspace and frozen read scopes", async () => {
    const { handler, dispatch } = setup();
    const result = await handler({
      credential: SECRET,
      body: envelope({
        message: {
          jsonrpc: "2.0",
          id: "req-2",
          method: "tools/call",
          params: { name: "get_p1c_read_projection", arguments: {} },
        },
      }),
    });

    expect(result.status).toBe(200);
    expect(dispatch).toHaveBeenCalledOnce();
    expect(dispatch.mock.calls[0]?.[0].context.identity).toMatchObject({
      workspaceId: "workspace-cuid-real",
      scopes: ["caio:delivery:read", "caio:p1c:read"],
      mtlsVerified: true,
      transport: "mtls",
    });
  });
});
