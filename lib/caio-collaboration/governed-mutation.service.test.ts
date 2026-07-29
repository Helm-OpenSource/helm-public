import { describe, expect, it, vi } from "vitest";

import type { WorkBuddyAuthorizationContext } from "./authorization.service";
import type { WorkBuddyClientIdentity } from "./contracts";
import {
  authorizeGovernedMutationSubmission,
  createInMemoryGovernedMutationChallengeStore,
  prepareGovernedMutation,
} from "./governed-mutation.service";

const SUMMARY_HASH = `sha256:${"a".repeat(64)}`;
const OBJECT_HASH = `sha256:${"b".repeat(64)}`;

const identity: WorkBuddyClientIdentity = {
  schemaVersion: "helm.workbuddy-client-identity/v1",
  clientId: "client:workbuddy-ceo",
  workspaceId: "workspace:demo",
  actorUserId: "user:owner",
  certificateFingerprint: `sha256:${"c".repeat(64)}`,
  scopes: ["caio:canonical:mutate"],
  transport: "mtls",
  mtlsVerified: true,
  authenticatedAt: "2026-07-26T08:00:00.000Z",
};

const authorization: WorkBuddyAuthorizationContext = {
  schemaVersion: "helm.workbuddy-authorization-context/v1",
  workspaceId: "workspace:demo",
  actorUserId: "user:owner",
  clientId: "client:workbuddy-ceo",
  capability: "workspace.manage_governed_actions",
  scope: "caio:canonical:mutate",
  ceoBindingRef: "caio-principal-binding:1",
  mandateRef: "caio-mandate:1",
  ceoRef: "ceo:owner",
  checkedAt: "2026-07-26T08:00:00.000Z",
  authorityEffect: "none",
  canonicalMutationAuthorityGranted: false,
};

function prepareInput() {
  return {
    authorization,
    actionKind: "question_selection" as const,
    target: {
      schemaVersion: "helm.caio-canonical-object-ref/v1" as const,
      objectKind: "operating_question_portfolio" as const,
      objectId: "portfolio:1",
      objectVersion: 7,
      objectHash: OBJECT_HASH,
    },
    expectedVersion: 7,
    summaryHash: SUMMARY_HASH,
    idempotencyKey: "idem:selection:1",
    challengeId: "mutation-challenge:1",
    nonce: "n".repeat(48),
    issuedAt: "2026-07-26T08:00:00.000Z",
    ttlMs: 120_000,
  };
}

describe("governed WorkBuddy mutation challenge", () => {
  it("binds one challenge to the exact object, version, action, and final summary", async () => {
    const challenge = await prepareGovernedMutation({
      ...prepareInput(),
      store: createInMemoryGovernedMutationChallengeStore(),
    });

    expect(challenge).toMatchObject({
      schemaVersion: "helm.workbuddy-governed-mutation-challenge/v1",
      workspaceId: "workspace:demo",
      clientId: "client:workbuddy-ceo",
      actorUserId: "user:owner",
      ceoBindingRef: "caio-principal-binding:1",
      mandateRef: "caio-mandate:1",
      actionKind: "question_selection",
      target: {
        objectId: "portfolio:1",
        objectVersion: 7,
      },
      expectedVersion: 7,
      summaryHash: SUMMARY_HASH,
      idempotencyKey: "idem:selection:1",
      singleUseRequired: true,
      authorityEffect: "none",
      canonicalMutationAuthorityGranted: false,
    });
  });

  it("deduplicates equivalent prepare retries and rejects divergent idempotency reuse", async () => {
    const store = createInMemoryGovernedMutationChallengeStore();
    const first = await prepareGovernedMutation({
      ...prepareInput(),
      store,
    });
    const replay = await prepareGovernedMutation({
      ...prepareInput(),
      authorization: {
        ...authorization,
        checkedAt: "2026-07-26T08:00:10.000Z",
      },
      challengeId: "mutation-challenge:2",
      nonce: "r".repeat(48),
      issuedAt: "2026-07-26T08:00:10.000Z",
      store,
    });

    expect(replay).toEqual(first);
    await expect(
      prepareGovernedMutation({
        ...prepareInput(),
        authorization: {
          ...authorization,
          checkedAt: "2026-07-26T08:00:20.000Z",
        },
        challengeId: "mutation-challenge:3",
        nonce: "s".repeat(48),
        issuedAt: "2026-07-26T08:00:20.000Z",
        summaryHash: `sha256:${"d".repeat(64)}`,
        store,
      }),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
  });

  it("verifies fresh authorization once and recovers the consumed challenge idempotently", async () => {
    const store = createInMemoryGovernedMutationChallengeStore();
    const challenge = await prepareGovernedMutation({
      ...prepareInput(),
      store,
    });
    const submit = () =>
      authorizeGovernedMutationSubmission({
        challenge,
        actionKind: "question_selection",
        target: challenge.target,
        expectedVersion: 7,
        summaryHash: SUMMARY_HASH,
        idempotencyKey: "idem:selection:1",
        proof: {
          schemaVersion: "helm.owner-presence-proof/v1" as const,
          challengeId: "mutation-challenge:1",
          algorithm: "device-bound-signature" as const,
          signature: "device-bound-signed-proof",
          assertedAt: "2026-07-26T08:00:30.000Z",
        },
        identity,
        freshAuthorization: {
          ...authorization,
          checkedAt: "2026-07-26T08:00:31.000Z",
        },
        verifiedAt: "2026-07-26T08:00:31.000Z",
        verifier: { verify: async () => true },
        store,
      });

    const [first, second] = await Promise.allSettled([
      submit(),
      submit(),
    ]);
    expect(first.status).toBe("fulfilled");
    expect(second.status).toBe("fulfilled");
    if (first.status === "fulfilled" && second.status === "fulfilled") {
      expect(second.value).toEqual(first.value);
    }
    expect(await store.isConsumed("mutation-challenge:1")).toBe(true);
    await expect(
      authorizeGovernedMutationSubmission({
        challenge,
        actionKind: "question_selection",
        target: challenge.target,
        expectedVersion: 7,
        summaryHash: SUMMARY_HASH,
        idempotencyKey: "idem:selection:1",
        proof: {
          schemaVersion: "helm.owner-presence-proof/v1",
          challengeId: "mutation-challenge:1",
          algorithm: "device-bound-signature",
          signature: "different-device-proof",
          assertedAt: "2026-07-26T08:00:30.000Z",
        },
        identity,
        freshAuthorization: {
          ...authorization,
          checkedAt: "2026-07-26T08:00:32.000Z",
        },
        verifiedAt: "2026-07-26T08:00:32.000Z",
        verifier: { verify: async () => true },
        store,
      }),
    ).rejects.toMatchObject({ code: "REPLAY_REJECTED" });
  });

  it("rejects altered content, object version, or identity binding", async () => {
    const store = createInMemoryGovernedMutationChallengeStore();
    const challenge = await prepareGovernedMutation({
      ...prepareInput(),
      store,
    });
    const base = {
      challenge,
      actionKind: "question_selection" as const,
      target: challenge.target,
      expectedVersion: 7,
      summaryHash: SUMMARY_HASH,
      idempotencyKey: "idem:selection:1",
      proof: {
        schemaVersion: "helm.owner-presence-proof/v1" as const,
        challengeId: "mutation-challenge:1",
        algorithm: "device-bound-signature" as const,
        signature: "device-bound-signed-proof",
        assertedAt: "2026-07-26T08:00:30.000Z",
      },
      identity,
      freshAuthorization: {
        ...authorization,
        checkedAt: "2026-07-26T08:00:31.000Z",
      },
      verifiedAt: "2026-07-26T08:00:31.000Z",
      verifier: { verify: async () => true },
      store,
    };

    await expect(
      authorizeGovernedMutationSubmission({
        ...base,
        summaryHash: `sha256:${"d".repeat(64)}`,
      }),
    ).rejects.toMatchObject({ code: "PRESENCE_BINDING_MISMATCH" });
    await expect(
      authorizeGovernedMutationSubmission({
        ...base,
        expectedVersion: 8,
      }),
    ).rejects.toMatchObject({ code: "PRESENCE_BINDING_MISMATCH" });
    await expect(
      authorizeGovernedMutationSubmission({
        ...base,
        identity: { ...identity, clientId: "client:other" },
      }),
    ).rejects.toMatchObject({ code: "PRESENCE_BINDING_MISMATCH" });
  });

  it("rejects expired proof without consuming the challenge", async () => {
    const store = createInMemoryGovernedMutationChallengeStore();
    const challenge = await prepareGovernedMutation({
      ...prepareInput(),
      store,
    });

    await expect(
      authorizeGovernedMutationSubmission({
        challenge,
        actionKind: "question_selection",
        target: challenge.target,
        expectedVersion: 7,
        summaryHash: SUMMARY_HASH,
        idempotencyKey: "idem:selection:1",
        proof: {
          schemaVersion: "helm.owner-presence-proof/v1",
          challengeId: "mutation-challenge:1",
          algorithm: "device-bound-signature",
          signature: "device-bound-signed-proof",
          assertedAt: "2026-07-26T08:03:00.000Z",
        },
        identity,
        freshAuthorization: {
          ...authorization,
          checkedAt: "2026-07-26T08:03:00.000Z",
        },
        verifiedAt: "2026-07-26T08:03:00.000Z",
        verifier: { verify: async () => true },
        store,
      }),
    ).rejects.toMatchObject({ code: "CHALLENGE_EXPIRED" });
    expect(await store.isConsumed("mutation-challenge:1")).toBe(false);
  });

  it.each([
    [
      "proof before challenge",
      "2026-07-26T07:59:59.000Z",
      "2026-07-26T08:00:31.000Z",
    ],
    [
      "verification before proof",
      "2026-07-26T08:00:30.000Z",
      "2026-07-26T08:00:29.000Z",
    ],
  ])("rejects %s timestamps before consuming the challenge", async (
    _label,
    assertedAt,
    verifiedAt,
  ) => {
    const store = createInMemoryGovernedMutationChallengeStore();
    const challenge = await prepareGovernedMutation({
      ...prepareInput(),
      store,
    });
    const verify = vi.fn(async () => true);

    await expect(
      authorizeGovernedMutationSubmission({
        challenge,
        actionKind: "question_selection",
        target: challenge.target,
        expectedVersion: 7,
        summaryHash: SUMMARY_HASH,
        idempotencyKey: "idem:selection:1",
        proof: {
          schemaVersion: "helm.owner-presence-proof/v1",
          challengeId: "mutation-challenge:1",
          algorithm: "device-bound-signature",
          signature: "device-bound-signed-proof",
          assertedAt,
        },
        identity,
        freshAuthorization: {
          ...authorization,
          checkedAt: verifiedAt,
        },
        verifiedAt,
        verifier: { verify },
        store,
      }),
    ).rejects.toMatchObject({ code: "PRESENCE_BINDING_MISMATCH" });
    expect(verify).not.toHaveBeenCalled();
    expect(await store.isConsumed("mutation-challenge:1")).toBe(false);
  });

  it("rejects malformed windows, stale authorization, and read-only capability", async () => {
    const sourceStore =
      createInMemoryGovernedMutationChallengeStore();
    const validChallenge = await prepareGovernedMutation({
      ...prepareInput(),
      store: sourceStore,
    });
    const malformedChallenge = {
      ...validChallenge,
      expiresAt: "2026-07-26T07:59:59.000Z",
    };
    const malformedStore =
      createInMemoryGovernedMutationChallengeStore();
    await malformedStore.register(malformedChallenge);
    const submission = {
      challenge: malformedChallenge,
      actionKind: "question_selection" as const,
      target: malformedChallenge.target,
      expectedVersion: 7,
      summaryHash: SUMMARY_HASH,
      idempotencyKey: "idem:selection:1",
      proof: {
        schemaVersion: "helm.owner-presence-proof/v1" as const,
        challengeId: "mutation-challenge:1",
        algorithm: "device-bound-signature" as const,
        signature: "device-bound-signed-proof",
        assertedAt: "2026-07-26T08:00:30.000Z",
      },
      identity,
      freshAuthorization: {
        ...authorization,
        checkedAt: "2026-07-26T08:00:31.000Z",
      },
      verifiedAt: "2026-07-26T08:00:31.000Z",
      verifier: { verify: async () => true },
      store: malformedStore,
    };

    await expect(
      authorizeGovernedMutationSubmission(submission),
    ).rejects.toMatchObject({ code: "INVALID_TOOL_INPUT" });

    await expect(
      prepareGovernedMutation({
        ...prepareInput(),
        authorization: {
          ...authorization,
          capability: "workspace.manage_operational_controls",
        },
        store: createInMemoryGovernedMutationChallengeStore(),
      }),
    ).rejects.toMatchObject({ code: "CAPABILITY_DENIED" });

    await expect(
      prepareGovernedMutation({
        ...prepareInput(),
        authorization: {
          ...authorization,
          checkedAt: "2026-07-26T07:59:59.000Z",
        },
        store: createInMemoryGovernedMutationChallengeStore(),
      }),
    ).rejects.toMatchObject({ code: "AUTH_EXPIRED" });
  });
});
