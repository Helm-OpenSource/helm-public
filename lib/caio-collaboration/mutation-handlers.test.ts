import { describe, expect, it, vi } from "vitest";

import type { WorkBuddyAuthorizationQueries } from "./authorization.service";
import type { WorkBuddyClientIdentity } from "./contracts";
import { createInMemoryGovernedMutationResultStore } from "./governed-mutation-adapter.service";
import { createInMemoryGovernedMutationChallengeStore } from "./governed-mutation.service";
import {
  createWorkBuddyGovernedMutationHandlers,
  type WorkBuddyMutationTargetQueries,
} from "./mutation-handlers";

const PORTFOLIO_HASH = `sha256:${"a".repeat(64)}`;

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

const context = {
  requestId: "request:selection",
  identity,
};

function authorizationQueries(): WorkBuddyAuthorizationQueries {
  return {
    loadAuthorizationSnapshot: vi.fn(async () =>
      activeAuthorizationSnapshot(),
    ),
  };
}

function activeAuthorizationSnapshot() {
  return {
      membership: {
        status: "ACTIVE",
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
      mandate: {
        mandateRef: "caio-mandate:1",
        ceoRef: "ceo:owner",
        status: "CURRENT" as const,
      },
    };
}

function mutationPorts() {
  return {
    promptResponsePort: {
      idempotencyGuarantee: "payload_bound" as const,
      apply: vi.fn(),
    },
    questionSelectionPort: {
      idempotencyGuarantee: "payload_bound" as const,
      apply: vi.fn(),
    },
    adviceDecisionPort: {
      idempotencyGuarantee: "payload_bound" as const,
      apply: vi.fn(),
    },
  };
}

function selectionTarget(version = 4) {
  return {
    schemaVersion: "helm.caio-canonical-object-ref/v1" as const,
    objectKind: "operating_question_portfolio" as const,
    objectId: "portfolio:1",
    objectVersion: version,
    objectHash: PORTFOLIO_HASH,
  };
}

function targetQueries(
  loadQuestionSelectionTarget = vi.fn(async () =>
    selectionTarget(),
  ),
): WorkBuddyMutationTargetQueries {
  return {
    loadPromptResponseTarget: vi.fn(async () => ({
      schemaVersion: "helm.caio-canonical-object-ref/v1",
      objectKind: "operating_question_candidate",
      objectId: "question:1",
      objectVersion: 1,
      objectHash: PORTFOLIO_HASH,
    })),
    loadQuestionSelectionTarget,
    loadAdviceDecisionTarget: vi.fn(async () => ({
      schemaVersion: "helm.caio-canonical-object-ref/v1",
      objectKind: "caio_advice",
      objectId: "advice:1",
      objectVersion: 1,
      objectHash: PORTFOLIO_HASH,
    })),
  };
}

function selectionInput() {
  return {
    workspaceId: "workspace:demo",
    portfolioRef: "portfolio:1",
    expectedVersion: 4,
    selection: {
      portfolioHash: PORTFOLIO_HASH,
      selections: [],
      reasonCodes: ["CEO_DEFERRED_SELECTION"],
      evidenceRefs: ["evidence:1"],
    },
    idempotencyKey: "idem:selection:1",
  };
}

describe("WorkBuddy governed mutation handlers", () => {
  it("prepares against the live canonical target without calling the mutation port", async () => {
    const apply = vi.fn();
    const loadQuestionSelectionTarget = vi.fn(async () =>
      selectionTarget(),
    );
    const handlers = createWorkBuddyGovernedMutationHandlers({
      authorizationQueries: authorizationQueries(),
      targetQueries: targetQueries(loadQuestionSelectionTarget),
      challengeStore:
        createInMemoryGovernedMutationChallengeStore(),
      resultStore: createInMemoryGovernedMutationResultStore(),
      proofVerifier: { verify: async () => true },
      promptResponsePort: {
        idempotencyGuarantee: "payload_bound",
        apply,
      },
      questionSelectionPort: {
        idempotencyGuarantee: "payload_bound",
        apply,
      },
      adviceDecisionPort: {
        idempotencyGuarantee: "payload_bound",
        apply,
      },
      materialFactory: {
        nextChallenge: async () => ({
          challengeId: "mutation-challenge:selection-1",
          nonce: "n".repeat(48),
        }),
      },
      now: () => "2026-07-26T08:00:00.000Z",
    });

    const prepared = await handlers.prepareQuestionSelection(
      selectionInput(),
      context,
    );

    expect(loadQuestionSelectionTarget).toHaveBeenCalledWith({
      workspaceId: "workspace:demo",
      portfolioRef: "portfolio:1",
      actorUserId: "user:owner",
    });
    expect(apply).not.toHaveBeenCalled();
    expect(prepared).toMatchObject({
      challenge: {
        actionKind: "question_selection",
        target: { objectId: "portfolio:1", objectVersion: 4 },
      },
      preview: {
        command: {
          portfolioHash: PORTFOLIO_HASH,
          selections: [],
        },
      },
    });
  });

  it("revalidates the target and then invokes the canonical selection port", async () => {
    const apply = vi.fn(async () => ({
      canonicalReceiptRef: "selection-receipt:1",
    }));
    const challengeStore =
      createInMemoryGovernedMutationChallengeStore();
    const handlers = createWorkBuddyGovernedMutationHandlers({
      authorizationQueries: authorizationQueries(),
      targetQueries: targetQueries(),
      challengeStore,
      resultStore: createInMemoryGovernedMutationResultStore(),
      proofVerifier: { verify: async () => true },
      promptResponsePort: {
        idempotencyGuarantee: "payload_bound",
        apply: vi.fn(),
      },
      questionSelectionPort: {
        idempotencyGuarantee: "payload_bound",
        apply,
      },
      adviceDecisionPort: {
        idempotencyGuarantee: "payload_bound",
        apply: vi.fn(),
      },
      materialFactory: {
        nextChallenge: async () => ({
          challengeId: "mutation-challenge:selection-1",
          nonce: "n".repeat(48),
        }),
      },
      now: () => "2026-07-26T08:00:30.000Z",
    });
    await handlers.prepareQuestionSelection(selectionInput(), context);

    const result = await handlers.submitQuestionSelection(
      {
        ...selectionInput(),
        challengeId: "mutation-challenge:selection-1",
        proof: {
          schemaVersion: "helm.owner-presence-proof/v1",
          challengeId: "mutation-challenge:selection-1",
          algorithm: "device-bound-signature",
          signature: "device-bound-signed-proof",
          assertedAt: "2026-07-26T08:00:30.000Z",
        },
      },
      context,
    );

    expect(apply).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "workspace:demo",
        actorUserId: "user:owner",
        ceoRef: "ceo:owner",
        target: expect.objectContaining({
          objectKind: "operating_question_portfolio",
          objectId: "portfolio:1",
        }),
        command: expect.objectContaining({ selections: [] }),
      }),
    );
    expect(result).toMatchObject({
      outcome: "submitted",
      receipt: {
        canonicalReceiptRef: "selection-receipt:1",
        authorityEffect: "none",
      },
    });
  });

  it("fails before presence and mutation when the canonical version changes", async () => {
    let version = 4;
    const apply = vi.fn();
    const loadQuestionSelectionTarget = vi.fn(async () =>
      selectionTarget(version),
    );
    const handlers = createWorkBuddyGovernedMutationHandlers({
      authorizationQueries: authorizationQueries(),
      targetQueries: targetQueries(loadQuestionSelectionTarget),
      challengeStore:
        createInMemoryGovernedMutationChallengeStore(),
      resultStore: createInMemoryGovernedMutationResultStore(),
      proofVerifier: { verify: vi.fn(async () => true) },
      promptResponsePort: {
        idempotencyGuarantee: "payload_bound",
        apply: vi.fn(),
      },
      questionSelectionPort: {
        idempotencyGuarantee: "payload_bound",
        apply,
      },
      adviceDecisionPort: {
        idempotencyGuarantee: "payload_bound",
        apply: vi.fn(),
      },
      materialFactory: {
        nextChallenge: async () => ({
          challengeId: "mutation-challenge:selection-1",
          nonce: "n".repeat(48),
        }),
      },
      now: () => "2026-07-26T08:00:30.000Z",
    });
    await handlers.prepareQuestionSelection(selectionInput(), context);
    version = 5;

    await expect(
      handlers.submitQuestionSelection(
        {
          ...selectionInput(),
          challengeId: "mutation-challenge:selection-1",
          proof: {
            schemaVersion: "helm.owner-presence-proof/v1",
            challengeId: "mutation-challenge:selection-1",
            algorithm: "device-bound-signature",
            signature: "device-bound-signed-proof",
            assertedAt: "2026-07-26T08:00:30.000Z",
          },
        },
        context,
      ),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });
    expect(apply).not.toHaveBeenCalled();
  });

  it("does not prepare a mutation without a payload-bound canonical adapter", async () => {
    const nextChallenge = vi.fn(async () => ({
      challengeId: "mutation-challenge:selection-1",
      nonce: "n".repeat(48),
    }));
    const handlers = createWorkBuddyGovernedMutationHandlers({
      authorizationQueries: authorizationQueries(),
      targetQueries: targetQueries(),
      challengeStore:
        createInMemoryGovernedMutationChallengeStore(),
      resultStore: createInMemoryGovernedMutationResultStore(),
      proofVerifier: { verify: async () => true },
      materialFactory: {
        nextChallenge,
      },
      now: () => "2026-07-26T08:00:00.000Z",
    });

    await expect(
      handlers.prepareQuestionSelection(selectionInput(), context),
    ).rejects.toMatchObject({ code: "WRITE_UNAVAILABLE" });
    expect(nextChallenge).not.toHaveBeenCalled();
  });

  it("does not query the target after authorization exceeds the deadline", async () => {
    const controller = new AbortController();
    const loadAuthorizationSnapshot = vi.fn(async () => {
      controller.abort();
      return activeAuthorizationSnapshot();
    });
    const loadQuestionSelectionTarget = vi.fn(async () =>
      selectionTarget(),
    );
    const nextChallenge = vi.fn(async () => ({
      challengeId: "mutation-challenge:selection-deadline-auth",
      nonce: "n".repeat(48),
    }));
    const handlers = createWorkBuddyGovernedMutationHandlers({
      authorizationQueries: { loadAuthorizationSnapshot },
      targetQueries: targetQueries(loadQuestionSelectionTarget),
      challengeStore:
        createInMemoryGovernedMutationChallengeStore(),
      resultStore: createInMemoryGovernedMutationResultStore(),
      proofVerifier: { verify: async () => true },
      ...mutationPorts(),
      materialFactory: { nextChallenge },
      now: () => "2026-07-26T08:00:00.000Z",
    });

    await expect(
      handlers.prepareQuestionSelection(selectionInput(), {
        ...context,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({
      code: "REQUEST_DEADLINE_EXCEEDED",
    });
    expect(loadQuestionSelectionTarget).not.toHaveBeenCalled();
    expect(nextChallenge).not.toHaveBeenCalled();
  });

  it("does not generate a challenge after target lookup exceeds the deadline", async () => {
    const controller = new AbortController();
    const loadQuestionSelectionTarget = vi.fn(async () => {
      controller.abort();
      return selectionTarget();
    });
    const nextChallenge = vi.fn(async () => ({
      challengeId: "mutation-challenge:selection-deadline-target",
      nonce: "n".repeat(48),
    }));
    const handlers = createWorkBuddyGovernedMutationHandlers({
      authorizationQueries: authorizationQueries(),
      targetQueries: targetQueries(loadQuestionSelectionTarget),
      challengeStore:
        createInMemoryGovernedMutationChallengeStore(),
      resultStore: createInMemoryGovernedMutationResultStore(),
      proofVerifier: { verify: async () => true },
      ...mutationPorts(),
      materialFactory: { nextChallenge },
      now: () => "2026-07-26T08:00:00.000Z",
    });

    await expect(
      handlers.prepareQuestionSelection(selectionInput(), {
        ...context,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({
      code: "REQUEST_DEADLINE_EXCEEDED",
    });
    expect(loadQuestionSelectionTarget).toHaveBeenCalledTimes(1);
    expect(nextChallenge).not.toHaveBeenCalled();
  });
});
