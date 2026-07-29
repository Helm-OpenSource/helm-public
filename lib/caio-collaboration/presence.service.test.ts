import { describe, expect, it, vi } from "vitest";

import type {
  WorkBuddyAuthorizationContext,
} from "./authorization.service";
import type { WorkBuddyClientIdentity } from "./contracts";
import {
  completeOwnerPresenceChallenge,
  createOwnerPresenceChallenge,
} from "./presence.service";

const identity: WorkBuddyClientIdentity = {
  schemaVersion: "helm.workbuddy-client-identity/v1",
  clientId: "client:workbuddy-ceo",
  workspaceId: "workspace:demo",
  actorUserId: "user:owner",
  certificateFingerprint: `sha256:${"c".repeat(64)}`,
  scopes: ["caio:presence:challenge", "caio:p1c:read"],
  transport: "mtls",
  mtlsVerified: true,
  authenticatedAt: "2026-07-26T02:00:00.000Z",
};

const authorization: WorkBuddyAuthorizationContext = {
  schemaVersion: "helm.workbuddy-authorization-context/v1",
  workspaceId: "workspace:demo",
  actorUserId: "user:owner",
  clientId: "client:workbuddy-ceo",
  capability: "workspace.manage_operational_controls",
  scope: "caio:presence:challenge",
  ceoBindingRef: "caio-principal-binding:1",
  mandateRef: "caio-mandate:1",
  ceoRef: "ceo:owner",
  checkedAt: "2026-07-26T02:00:00.000Z",
  authorityEffect: "none",
  canonicalMutationAuthorityGranted: false,
};

function createChallenge() {
  return createOwnerPresenceChallenge({
    authorization,
    challengeId: "challenge:1",
    nonce: "n".repeat(48),
    issuedAt: "2026-07-26T02:00:00.000Z",
    ttlMs: 120_000,
  });
}

describe("owner presence challenge", () => {
  it("binds a single-use challenge to client, owner, CEO binding, and mandate", () => {
    expect(createChallenge()).toMatchObject({
      schemaVersion: "helm.owner-presence-challenge/v1",
      challengeId: "challenge:1",
      clientId: "client:workbuddy-ceo",
      workspaceId: "workspace:demo",
      actorUserId: "user:owner",
      ceoBindingRef: "caio-principal-binding:1",
      mandateRef: "caio-mandate:1",
      singleUseRequired: true,
      replayProtectionRequired: true,
      authorityEffect: "none",
    });
  });

  it("accepts a fresh device-bound proof without granting mutation authority", async () => {
    const result = await completeOwnerPresenceChallenge({
      challenge: createChallenge(),
      proof: {
        schemaVersion: "helm.owner-presence-proof/v1",
        challengeId: "challenge:1",
        algorithm: "device-bound-signature",
        signature: "signed-proof-value",
        assertedAt: "2026-07-26T02:00:30.000Z",
      },
      identity,
      freshAuthorization: {
        ...authorization,
        checkedAt: "2026-07-26T02:00:31.000Z",
      },
      verifiedAt: "2026-07-26T02:00:31.000Z",
      presenceRef: "presence:1",
      verifier: {
        verify: async () => true,
        consumeChallenge: async () => true,
      },
    });

    expect(result).toMatchObject({
      schemaVersion: "helm.owner-presence-attestation/v1",
      presenceRef: "presence:1",
      challengeId: "challenge:1",
      verified: true,
      authorityEffect: "none",
      canonicalMutationAuthorityGranted: false,
      externalExecutionAllowed: false,
    });
  });

  it("rejects expired, mismatched, or invalid proofs", async () => {
    await expect(
      completeOwnerPresenceChallenge({
        challenge: createChallenge(),
        proof: {
          schemaVersion: "helm.owner-presence-proof/v1",
          challengeId: "challenge:1",
          algorithm: "device-bound-signature",
          signature: "signed-proof-value",
          assertedAt: "2026-07-26T02:03:00.000Z",
        },
        identity,
        freshAuthorization: {
          ...authorization,
          checkedAt: "2026-07-26T02:03:00.000Z",
        },
        verifiedAt: "2026-07-26T02:03:00.000Z",
        presenceRef: "presence:expired",
        verifier: {
          verify: async () => true,
          consumeChallenge: async () => true,
        },
      }),
    ).rejects.toMatchObject({ code: "PRESENCE_EXPIRED" });

    await expect(
      completeOwnerPresenceChallenge({
        challenge: createChallenge(),
        proof: {
          schemaVersion: "helm.owner-presence-proof/v1",
          challengeId: "challenge:1",
          algorithm: "device-bound-signature",
          signature: "signed-proof-value",
          assertedAt: "2026-07-26T02:00:30.000Z",
        },
        identity: { ...identity, clientId: "client:other" },
        freshAuthorization: {
          ...authorization,
          checkedAt: "2026-07-26T02:00:31.000Z",
        },
        verifiedAt: "2026-07-26T02:00:31.000Z",
        presenceRef: "presence:mismatch",
        verifier: {
          verify: async () => true,
          consumeChallenge: async () => true,
        },
      }),
    ).rejects.toMatchObject({ code: "PRESENCE_BINDING_MISMATCH" });

    await expect(
      completeOwnerPresenceChallenge({
        challenge: createChallenge(),
        proof: {
          schemaVersion: "helm.owner-presence-proof/v1",
          challengeId: "challenge:1",
          algorithm: "device-bound-signature",
          signature: "invalid-proof-value",
          assertedAt: "2026-07-26T02:00:30.000Z",
        },
        identity,
        freshAuthorization: {
          ...authorization,
          checkedAt: "2026-07-26T02:00:31.000Z",
        },
        verifiedAt: "2026-07-26T02:00:31.000Z",
        presenceRef: "presence:invalid",
        verifier: {
          verify: async () => false,
          consumeChallenge: async () => true,
        },
      }),
    ).rejects.toMatchObject({ code: "PRESENCE_PROOF_INVALID" });
  });

  it("fails closed when the challenge cannot be consumed atomically", async () => {
    await expect(
      completeOwnerPresenceChallenge({
        challenge: createChallenge(),
        proof: {
          schemaVersion: "helm.owner-presence-proof/v1",
          challengeId: "challenge:1",
          algorithm: "device-bound-signature",
          signature: "signed-proof-value",
          assertedAt: "2026-07-26T02:00:30.000Z",
        },
        identity,
        freshAuthorization: {
          ...authorization,
          checkedAt: "2026-07-26T02:00:31.000Z",
        },
        verifiedAt: "2026-07-26T02:00:31.000Z",
        presenceRef: "presence:replayed",
        verifier: {
          verify: async () => true,
          consumeChallenge: async () => false,
        },
      }),
    ).rejects.toMatchObject({ code: "PRESENCE_REPLAYED" });
  });

  it.each([
    [
      "proof before challenge",
      "2026-07-26T01:59:59.000Z",
      "2026-07-26T02:00:31.000Z",
    ],
    [
      "verification before proof",
      "2026-07-26T02:00:30.000Z",
      "2026-07-26T02:00:29.000Z",
    ],
  ])("rejects %s timestamps before proof verification", async (
    _label,
    assertedAt,
    verifiedAt,
  ) => {
    const verify = vi.fn(async () => true);
    await expect(
      completeOwnerPresenceChallenge({
        challenge: createChallenge(),
        proof: {
          schemaVersion: "helm.owner-presence-proof/v1",
          challengeId: "challenge:1",
          algorithm: "device-bound-signature",
          signature: "signed-proof-value",
          assertedAt,
        },
        identity,
        freshAuthorization: {
          ...authorization,
          checkedAt: verifiedAt,
        },
        verifiedAt,
        presenceRef: "presence:invalid-time",
        verifier: {
          verify,
          consumeChallenge: async () => true,
        },
      }),
    ).rejects.toMatchObject({ code: "PRESENCE_BINDING_MISMATCH" });
    expect(verify).not.toHaveBeenCalled();
  });

  it("rejects malformed challenge windows and stale authorization", async () => {
    const base = {
      proof: {
        schemaVersion: "helm.owner-presence-proof/v1" as const,
        challengeId: "challenge:1",
        algorithm: "device-bound-signature" as const,
        signature: "signed-proof-value",
        assertedAt: "2026-07-26T02:00:30.000Z",
      },
      identity,
      verifiedAt: "2026-07-26T02:00:31.000Z",
      presenceRef: "presence:invalid-window",
      verifier: {
        verify: async () => true,
        consumeChallenge: async () => true,
      },
    };

    await expect(
      completeOwnerPresenceChallenge({
        ...base,
        challenge: {
          ...createChallenge(),
          expiresAt: "2026-07-26T01:59:59.000Z",
        },
        freshAuthorization: {
          ...authorization,
          checkedAt: base.verifiedAt,
        },
      }),
    ).rejects.toMatchObject({ code: "INVALID_TOOL_INPUT" });

    await expect(
      completeOwnerPresenceChallenge({
        ...base,
        challenge: createChallenge(),
        freshAuthorization: authorization,
      }),
    ).rejects.toMatchObject({ code: "AUTH_EXPIRED" });
  });
});
