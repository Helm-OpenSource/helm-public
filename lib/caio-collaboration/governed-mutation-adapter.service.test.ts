import { describe, expect, it, vi } from "vitest";

import type { WorkBuddyAuthorizationContext } from "./authorization.service";
import type { WorkBuddyClientIdentity } from "./contracts";
import {
  createInMemoryGovernedMutationResultStore,
  prepareGovernedMutationCommand,
  submitGovernedMutationCommand,
} from "./governed-mutation-adapter.service";
import {
  createInMemoryGovernedMutationChallengeStore,
} from "./governed-mutation.service";

const OBJECT_HASH = `sha256:${"a".repeat(64)}`;

const identity: WorkBuddyClientIdentity = {
  schemaVersion: "helm.workbuddy-client-identity/v1",
  clientId: "client:workbuddy-ceo",
  workspaceId: "workspace:demo",
  actorUserId: "user:owner",
  certificateFingerprint: `sha256:${"b".repeat(64)}`,
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

const target = {
  schemaVersion: "helm.caio-canonical-object-ref/v1" as const,
  objectKind: "caio_advice" as const,
  objectId: "advice:1",
  objectVersion: 3,
  objectHash: OBJECT_HASH,
};

const command = {
  outcome: "accepted",
  reason: "Proceed with the bounded review.",
};

describe("governed mutation command adapter", () => {
  it("prepares an exact preview without invoking the canonical mutation", async () => {
    const apply = vi.fn();
    const challengeStore =
      createInMemoryGovernedMutationChallengeStore();
    const prepared = await prepareGovernedMutationCommand({
      authorization,
      actionKind: "advice_decision",
      target,
      expectedVersion: 3,
      command,
      idempotencyKey: "idem:advice:1",
      challengeId: "mutation-challenge:advice-1",
      nonce: "n".repeat(48),
      issuedAt: "2026-07-26T08:00:00.000Z",
      ttlMs: 120_000,
      challengeStore,
    });

    expect(apply).not.toHaveBeenCalled();
    expect(prepared.preview).toEqual({
      actionKind: "advice_decision",
      target,
      expectedVersion: 3,
      command,
      summaryHash: prepared.challenge.summaryHash,
      authorityEffect: "none",
      externalExecutionAllowed: false,
    });
    expect(prepared.challenge).not.toHaveProperty("command");
    expect(JSON.stringify(prepared.challenge)).not.toContain(
      "Proceed with",
    );
  });

  it("submits through the injected canonical port and records only its receipt ref", async () => {
    const challengeStore =
      createInMemoryGovernedMutationChallengeStore();
    const resultStore = createInMemoryGovernedMutationResultStore();
    const prepared = await prepareGovernedMutationCommand({
      authorization,
      actionKind: "advice_decision",
      target,
      expectedVersion: 3,
      command,
      idempotencyKey: "idem:advice:1",
      challengeId: "mutation-challenge:advice-1",
      nonce: "n".repeat(48),
      issuedAt: "2026-07-26T08:00:00.000Z",
      ttlMs: 120_000,
      challengeStore,
    });
    const apply = vi.fn(async () => ({
      canonicalReceiptRef: "advice-decision-receipt:1",
    }));

    const result = await submitGovernedMutationCommand({
      challenge: prepared.challenge,
      actionKind: "advice_decision",
      target,
      expectedVersion: 3,
      command,
      idempotencyKey: "idem:advice:1",
      proof: {
        schemaVersion: "helm.owner-presence-proof/v1",
        challengeId: "mutation-challenge:advice-1",
        algorithm: "device-bound-signature",
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
      challengeStore,
      resultStore,
      apply,
    });

    expect(apply).toHaveBeenCalledWith({
      workspaceId: "workspace:demo",
      clientId: "client:workbuddy-ceo",
      actorUserId: "user:owner",
      ceoRef: "ceo:owner",
      ceoBindingRef: "caio-principal-binding:1",
      mandateRef: "caio-mandate:1",
      target,
      expectedVersion: 3,
      command,
      idempotencyKey: "idem:advice:1",
    });
    expect(result).toMatchObject({
      outcome: "submitted",
      receipt: {
        canonicalReceiptRef: "advice-decision-receipt:1",
        authorityEffect: "none",
        canonicalMutationAuthorityGranted: false,
        canonicalMutationRecorded: true,
        externalExecutionAllowed: false,
      },
    });
    expect(result.receipt).not.toHaveProperty("executionRef");
    expect(result.receipt).not.toHaveProperty("outcome");
  });

  it("recovers an existing idempotent receipt without replaying presence or mutation", async () => {
    const challengeStore =
      createInMemoryGovernedMutationChallengeStore();
    const resultStore = createInMemoryGovernedMutationResultStore();
    const prepared = await prepareGovernedMutationCommand({
      authorization,
      actionKind: "advice_decision",
      target,
      expectedVersion: 3,
      command,
      idempotencyKey: "idem:advice:1",
      challengeId: "mutation-challenge:advice-1",
      nonce: "n".repeat(48),
      issuedAt: "2026-07-26T08:00:00.000Z",
      ttlMs: 120_000,
      challengeStore,
    });
    const verifier = { verify: vi.fn(async () => true) };
    const apply = vi.fn(async () => ({
      canonicalReceiptRef: "advice-decision-receipt:1",
    }));
    const submit = () =>
      submitGovernedMutationCommand({
        challenge: prepared.challenge,
        actionKind: "advice_decision",
        target,
        expectedVersion: 3,
        command,
        idempotencyKey: "idem:advice:1",
        proof: {
          schemaVersion: "helm.owner-presence-proof/v1" as const,
          challengeId: "mutation-challenge:advice-1",
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
        verifier,
        challengeStore,
        resultStore,
        apply,
      });

    const first = await submit();
    const retry = await submit();

    expect(first.outcome).toBe("submitted");
    expect(retry.outcome).toBe("replayed");
    expect(retry.receipt).toEqual(first.receipt);
    expect(verifier.verify).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledTimes(1);
  });

  it("rejects changed final content before canonical mutation", async () => {
    const challengeStore =
      createInMemoryGovernedMutationChallengeStore();
    const prepared = await prepareGovernedMutationCommand({
      authorization,
      actionKind: "advice_decision",
      target,
      expectedVersion: 3,
      command,
      idempotencyKey: "idem:advice:1",
      challengeId: "mutation-challenge:advice-1",
      nonce: "n".repeat(48),
      issuedAt: "2026-07-26T08:00:00.000Z",
      ttlMs: 120_000,
      challengeStore,
    });
    const apply = vi.fn();

    await expect(
      submitGovernedMutationCommand({
        challenge: prepared.challenge,
        actionKind: "advice_decision",
        target,
        expectedVersion: 3,
        command: {
          ...command,
          reason: "Changed after Touch ID preview.",
        },
        idempotencyKey: "idem:advice:1",
        proof: {
          schemaVersion: "helm.owner-presence-proof/v1",
          challengeId: "mutation-challenge:advice-1",
          algorithm: "device-bound-signature",
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
        challengeStore,
        resultStore: createInMemoryGovernedMutationResultStore(),
        apply,
      }),
    ).rejects.toMatchObject({ code: "PRESENCE_BINDING_MISMATCH" });
    expect(apply).not.toHaveBeenCalled();
  });

  it("recovers after canonical apply succeeds but local receipt recording fails", async () => {
    const challengeStore =
      createInMemoryGovernedMutationChallengeStore();
    const backingResultStore =
      createInMemoryGovernedMutationResultStore();
    let failFirstRecord = true;
    const resultStore = {
      get: backingResultStore.get,
      async record(
        receipt: Parameters<typeof backingResultStore.record>[0],
      ) {
        if (failFirstRecord) {
          failFirstRecord = false;
          throw new Error("simulated receipt store outage");
        }
        return backingResultStore.record(receipt);
      },
    };
    const prepared = await prepareGovernedMutationCommand({
      authorization,
      actionKind: "advice_decision",
      target,
      expectedVersion: 3,
      command,
      idempotencyKey: "idem:advice:recovery",
      challengeId: "mutation-challenge:advice-recovery",
      nonce: "n".repeat(48),
      issuedAt: "2026-07-26T08:00:00.000Z",
      ttlMs: 120_000,
      challengeStore,
    });
    const verifier = { verify: vi.fn(async () => true) };
    const apply = vi.fn(async () => ({
      canonicalReceiptRef: "advice-decision-receipt:recovery",
    }));
    const submit = (verifiedAt: string) =>
      submitGovernedMutationCommand({
        challenge: prepared.challenge,
        actionKind: "advice_decision",
        target,
        expectedVersion: 3,
        command,
        idempotencyKey: "idem:advice:recovery",
        proof: {
          schemaVersion: "helm.owner-presence-proof/v1",
          challengeId: "mutation-challenge:advice-recovery",
          algorithm: "device-bound-signature",
          signature: "device-bound-signed-proof",
          assertedAt: "2026-07-26T08:00:30.000Z",
        },
        identity,
        freshAuthorization: {
          ...authorization,
          checkedAt: verifiedAt,
        },
        verifiedAt,
        verifier,
        challengeStore,
        resultStore,
        apply,
      });

    await expect(
      submit("2026-07-26T08:00:31.000Z"),
    ).rejects.toThrow("simulated receipt store outage");
    await expect(
      submit("2026-07-26T08:05:00.000Z"),
    ).resolves.toMatchObject({
      outcome: "submitted",
      receipt: {
        canonicalReceiptRef:
          "advice-decision-receipt:recovery",
        canonicalMutationRecorded: true,
      },
    });
    expect(verifier.verify).toHaveBeenCalledTimes(1);
    expect(apply).toHaveBeenCalledTimes(2);
  });

  it("indexes the canonical receipt when the deadline elapses during the atomic write", async () => {
    const challengeStore =
      createInMemoryGovernedMutationChallengeStore();
    const resultStore = createInMemoryGovernedMutationResultStore();
    const prepared = await prepareGovernedMutationCommand({
      authorization,
      actionKind: "advice_decision",
      target,
      expectedVersion: 3,
      command,
      idempotencyKey: "idem:advice:late-write",
      challengeId: "mutation-challenge:advice-late-write",
      nonce: "n".repeat(48),
      issuedAt: "2026-07-26T08:00:00.000Z",
      ttlMs: 120_000,
      challengeStore,
    });
    const controller = new AbortController();
    const apply = vi.fn(async () => {
      controller.abort();
      return {
        canonicalReceiptRef: "advice-decision-receipt:late-write",
      };
    });
    const submission = {
      challenge: prepared.challenge,
      actionKind: "advice_decision" as const,
      target,
      expectedVersion: 3,
      command,
      idempotencyKey: "idem:advice:late-write",
      proof: {
        schemaVersion: "helm.owner-presence-proof/v1" as const,
        challengeId: "mutation-challenge:advice-late-write",
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
      verifier: { verify: vi.fn(async () => true) },
      challengeStore,
      resultStore,
      apply,
    };

    await expect(
      submitGovernedMutationCommand({
        ...submission,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({
      code: "REQUEST_DEADLINE_EXCEEDED",
    });
    await expect(
      submitGovernedMutationCommand(submission),
    ).resolves.toMatchObject({
      outcome: "replayed",
      receipt: {
        canonicalReceiptRef:
          "advice-decision-receipt:late-write",
      },
    });
    expect(apply).toHaveBeenCalledTimes(1);
  });
});
