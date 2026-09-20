import { describe, expect, it } from "vitest";

import type { WorkBuddyClientIdentity } from "./contracts";
import {
  createWorkBuddyMemberReadToolDefinitions,
} from "./member-readonly-tools";

const NOW = "2026-09-20T09:00:00.000Z";
const identity: WorkBuddyClientIdentity = {
  schemaVersion: "helm.workbuddy-client-identity/v1",
  clientId: "device:colleague-one",
  workspaceId: "workspace-real-id",
  actorUserId: "user:colleague-one",
  certificateFingerprint: `sha256:${"a".repeat(64)}`,
  scopes: ["caio:delivery:read", "caio:p1c:read"],
  transport: "mtls",
  mtlsVerified: true,
  authenticatedAt: "2026-09-20T08:59:00.000Z",
};

function projectionSource() {
  return {
    workspaceId: identity.workspaceId,
    portfolio: {
      portfolioRef: "portfolio:1",
      sequence: 1,
      generatedAt: "2026-09-20T08:00:00.000Z",
      questions: [
        {
          questionRef: "question:1",
          rank: 1,
          contentHash: `sha256:${"1".repeat(64)}`,
          title: "Which operating issue needs review?",
          question: "Which operating issue needs review this week?",
          businessDomain: "operations",
          evidenceCount: 1,
          processingDisposition: "remote_projected",
        },
      ],
    },
    selection: null,
    followThrough: [],
  };
}

describe("WorkBuddy member read tool", () => {
  it("allows an enrolled active member without a CEO binding", async () => {
    const tools = createWorkBuddyMemberReadToolDefinitions({
      membershipQueries: {
        async loadMembership() {
          return { status: "ACTIVE", role: "MEMBER" };
        },
      },
      projectionQueries: {
        async loadP1cProjectionSource() {
          return projectionSource();
        },
      },
      now: () => NOW,
    });

    await expect(
      tools[0].execute(
        { workspaceId: identity.workspaceId },
        { requestId: "request:1", identity },
      ),
    ).resolves.toMatchObject({
      workspaceRef: identity.workspaceId,
      boundary: {
        authorityEffect: "none",
        canonicalMutationAuthorityGranted: false,
        rawContentIncluded: false,
      },
    });
  });

  it("rejects missing, inactive, cross-workspace, and unscoped identities", async () => {
    for (const membership of [
      null,
      { status: "INACTIVE", role: "MEMBER" },
      { status: "INVITED", role: "MEMBER" },
    ]) {
      const tools = createWorkBuddyMemberReadToolDefinitions({
        membershipQueries: {
          async loadMembership() {
            return membership;
          },
        },
        projectionQueries: {
          async loadP1cProjectionSource() {
            throw new Error("projection_must_not_run");
          },
        },
        now: () => NOW,
      });
      await expect(
        tools[0].execute(
          { workspaceId: identity.workspaceId },
          { requestId: "request:2", identity },
        ),
      ).rejects.toMatchObject({ code: "CAPABILITY_DENIED" });
    }

    const activeTools = createWorkBuddyMemberReadToolDefinitions({
      membershipQueries: {
        async loadMembership() {
          return { status: "ACTIVE", role: "MEMBER" };
        },
      },
      projectionQueries: {
        async loadP1cProjectionSource() {
          throw new Error("projection_must_not_run");
        },
      },
      now: () => NOW,
    });
    await expect(
      activeTools[0].execute(
        { workspaceId: "workspace-other" },
        { requestId: "request:3", identity },
      ),
    ).rejects.toMatchObject({ code: "SCOPE_DENIED" });
    await expect(
      activeTools[0].execute(
        { workspaceId: identity.workspaceId },
        {
          requestId: "request:4",
          identity: { ...identity, scopes: ["caio:delivery:read"] },
        },
      ),
    ).rejects.toMatchObject({ code: "SCOPE_DENIED" });
  });
});
