import { describe, expect, it, vi } from "vitest";

import type {
  WorkBuddyAuthorizationQueries,
} from "./authorization.service";
import type { WorkBuddyClientIdentity } from "./contracts";
import {
  createWorkBuddyReadOnlyHandlers,
  type WorkBuddyOwnerPresenceWorkflow,
} from "./readonly-handlers";

const identity: WorkBuddyClientIdentity = {
  schemaVersion: "helm.workbuddy-client-identity/v1",
  clientId: "client:workbuddy-ceo",
  workspaceId: "workspace:demo",
  actorUserId: "user:owner",
  certificateFingerprint: `sha256:${"c".repeat(64)}`,
  scopes: ["caio:presence:challenge", "caio:p1c:read"],
  transport: "mtls",
  mtlsVerified: true,
  authenticatedAt: "2026-07-26T08:00:00.000Z",
};

const context = {
  requestId: "request:readonly",
  identity,
};

function authorizationQueries(input?: {
  membershipStatus?: "ACTIVE" | "INVITED" | "INACTIVE";
}): WorkBuddyAuthorizationQueries {
  return {
    loadAuthorizationSnapshot: vi.fn(async () => ({
      membership: {
        status: input?.membershipStatus ?? "ACTIVE",
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
  };
}

function presenceWorkflow(): WorkBuddyOwnerPresenceWorkflow {
  return {
    begin: vi.fn(async () => ({ challengeId: "challenge:1" })),
    complete: vi.fn(async () => ({ presenceRef: "presence:1" })),
  };
}

function projectionSource() {
  return {
    workspaceId: "workspace:demo",
    portfolio: {
      portfolioRef: "portfolio:1",
      sequence: 1,
      generatedAt: "2026-07-26T08:00:00.000Z",
      questions: [
        {
          questionRef: "question:1",
          rank: 1,
          title: "Where should the CEO intervene?",
          question: "Which operating decision needs owner judgement?",
          businessDomain: "operations",
          evidenceCount: 2,
          contentHash: `sha256:${"1".repeat(64)}`,
          processingDisposition: "remote_projected",
        },
      ],
    },
    followThrough: [],
  };
}

describe("authorized WorkBuddy read-only handlers", () => {
  it("rechecks active OWNER authorization for every P1C read", async () => {
    let membershipStatus: "ACTIVE" | "INACTIVE" = "ACTIVE";
    const queries = authorizationQueries();
    vi.mocked(
      queries.loadAuthorizationSnapshot,
    ).mockImplementation(async () => ({
      membership: {
        status: membershipStatus,
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
    }));
    const loadP1cProjectionSource = vi.fn(async () =>
      projectionSource(),
    );
    const handlers = createWorkBuddyReadOnlyHandlers({
      authorizationQueries: queries,
      presenceWorkflow: presenceWorkflow(),
      projectionQueries: { loadP1cProjectionSource },
      now: () => "2026-07-26T08:01:00.000Z",
    });

    const first = await handlers.getP1cReadProjection(
      {
        workspaceId: "workspace:demo",
        portfolioRef: "portfolio:1",
      },
      context,
    );
    membershipStatus = "INACTIVE";

    await expect(
      handlers.getP1cReadProjection(
        {
          workspaceId: "workspace:demo",
          portfolioRef: "portfolio:1",
        },
        context,
      ),
    ).rejects.toMatchObject({ code: "OWNER_REQUIRED" });
    expect(first).toMatchObject({
      workspaceRef: "workspace:demo",
      portfolio: { ref: "portfolio:1" },
    });
    expect(loadP1cProjectionSource).toHaveBeenCalledTimes(1);
  });

  it("authorizes presence before delegating to the device workflow", async () => {
    const workflow = presenceWorkflow();
    const handlers = createWorkBuddyReadOnlyHandlers({
      authorizationQueries: authorizationQueries({
        membershipStatus: "INACTIVE",
      }),
      presenceWorkflow: workflow,
      projectionQueries: {
        loadP1cProjectionSource: vi.fn(async () => projectionSource()),
      },
      now: () => "2026-07-26T08:01:00.000Z",
    });

    await expect(
      handlers.beginOwnerPresenceChallenge(
        {
          workspaceId: "workspace:demo",
          idempotencyKey: "presence:begin:1",
        },
        context,
      ),
    ).rejects.toMatchObject({ code: "OWNER_REQUIRED" });
    expect(workflow.begin).not.toHaveBeenCalled();
  });

  it("rejects a projection source that escapes the authenticated workspace", async () => {
    const handlers = createWorkBuddyReadOnlyHandlers({
      authorizationQueries: authorizationQueries(),
      presenceWorkflow: presenceWorkflow(),
      projectionQueries: {
        loadP1cProjectionSource: vi.fn(async () => ({
          ...projectionSource(),
          workspaceId: "workspace:other",
        })),
      },
      now: () => "2026-07-26T08:01:00.000Z",
    });

    await expect(
      handlers.getP1cReadProjection(
        { workspaceId: "workspace:demo" },
        context,
      ),
    ).rejects.toMatchObject({ code: "PROJECTION_BLOCKED" });
  });
});
