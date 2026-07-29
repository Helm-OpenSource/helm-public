import { describe, expect, it, vi } from "vitest";

import type {
  WorkBuddyAuthorizationQueries,
  WorkBuddyCurrentMandateSnapshot,
} from "./authorization.service";
import type { WorkBuddyClientIdentity } from "./contracts";
import { createCaioDeliveryCursor } from "./delivery-contracts";
import {
  createWorkBuddyDeliveryHandlers,
  type WorkBuddyDeliveryReadPort,
} from "./delivery-handlers";

const identity: WorkBuddyClientIdentity = {
  schemaVersion: "helm.workbuddy-client-identity/v1",
  clientId: "client:workbuddy-ceo",
  workspaceId: "workspace:demo",
  actorUserId: "user:owner",
  certificateFingerprint: `sha256:${"d".repeat(64)}`,
  scopes: ["caio:delivery:read"],
  transport: "mtls",
  mtlsVerified: true,
  authenticatedAt: "2026-07-26T08:00:00.000Z",
};

const context = {
  requestId: "request:delivery",
  identity,
};

function authorizationQueries(
  loadAuthorizationSnapshot = vi.fn<
    WorkBuddyAuthorizationQueries["loadAuthorizationSnapshot"]
  >(async () => ({
    membership: {
      status: "ACTIVE",
      role: "OWNER",
    },
    hasCapability: true,
    binding: {
      bindingRef: "caio-principal-binding:1",
      actorUserId: "user:owner",
      principalKind: "CEO",
      ceoRef: "ceo:owner",
      status: "LIVE",
    },
    mandate: {
      mandateRef: "caio-mandate:1",
      ceoRef: "ceo:owner",
      status: "CURRENT",
    },
  })),
): WorkBuddyAuthorizationQueries {
  return {
    loadAuthorizationSnapshot,
  };
}

function deliveryPort(): WorkBuddyDeliveryReadPort {
  return {
    poll: vi.fn(async () => ({ items: [] })),
    listPending: vi.fn(async () => []),
    getPrompt: vi.fn(async () => ({ deliveryObjectId: "delivery:1" })),
  };
}

describe("authorized WorkBuddy delivery handlers", () => {
  it("rechecks the current mandate before every delivery read", async () => {
    let mandate: WorkBuddyCurrentMandateSnapshot | null = {
      mandateRef: "caio-mandate:1",
      ceoRef: "ceo:owner",
      status: "CURRENT",
    };
    const loadAuthorizationSnapshot = vi.fn(async () => ({
      membership: {
        status: "ACTIVE" as const,
        role: "OWNER" as const,
      },
      hasCapability: true,
      binding: {
        bindingRef: "caio-principal-binding:1",
        actorUserId: "user:owner",
        principalKind: "CEO" as const,
        ceoRef: "ceo:owner",
        status: "LIVE" as const,
      },
      mandate,
    }));
    const port = deliveryPort();
    const handlers = createWorkBuddyDeliveryHandlers({
      authorizationQueries: authorizationQueries(
        loadAuthorizationSnapshot,
      ),
      delivery: port,
      now: () => "2026-07-26T08:01:00.000Z",
    });

    await handlers.listPendingCeoPrompts(
      { workspaceId: "workspace:demo" },
      context,
    );
    mandate = null;

    await expect(
      handlers.listPendingCeoPrompts(
        { workspaceId: "workspace:demo" },
        context,
      ),
    ).rejects.toMatchObject({ code: "MANDATE_REQUIRED" });
    expect(port.listPending).toHaveBeenCalledTimes(1);
  });

  it("binds polling to the mTLS client identity", async () => {
    const port = deliveryPort();
    const handlers = createWorkBuddyDeliveryHandlers({
      authorizationQueries: authorizationQueries(),
      delivery: port,
      now: () => "2026-07-26T08:01:00.000Z",
    });

    await handlers.pollCeoPrompts(
      {
        workspaceId: "workspace:demo",
        severity: "critical",
        cursor: createCaioDeliveryCursor({
          workspaceId: "workspace:demo",
          clientId: "client:workbuddy-ceo",
        }),
        limit: 10,
      },
      context,
    );

    expect(port.poll).toHaveBeenCalledWith({
      workspaceId: "workspace:demo",
      clientId: "client:workbuddy-ceo",
      severity: "critical",
      cursor: expect.objectContaining({
        clientId: "client:workbuddy-ceo",
      }),
      limit: 10,
    });
  });

  it("rejects workspace input outside the mTLS identity", async () => {
    const port = deliveryPort();
    const handlers = createWorkBuddyDeliveryHandlers({
      authorizationQueries: authorizationQueries(),
      delivery: port,
      now: () => "2026-07-26T08:01:00.000Z",
    });

    await expect(
      handlers.getCeoPrompt(
        {
          workspaceId: "workspace:other",
          deliveryObjectId: "delivery:1",
        },
        context,
      ),
    ).rejects.toMatchObject({ code: "SCOPE_DENIED" });
    expect(port.getPrompt).not.toHaveBeenCalled();
  });
});
