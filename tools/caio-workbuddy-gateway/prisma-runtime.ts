import "server-only";

import { randomBytes } from "node:crypto";

import {
  createCanonicalAdviceDecisionPort,
  createCanonicalPromptResponsePort,
  createCanonicalQuestionSelectionPort,
} from "@/lib/caio-collaboration/canonical-mutation-ports";
import {
  createWorkBuddyDeliveryHandlers,
} from "@/lib/caio-collaboration/delivery-handlers";
import {
  createWorkBuddyDeliveryProjectionResolver,
} from "@/lib/caio-collaboration/delivery-projection";
import {
  createCaioDeliveryService,
} from "@/lib/caio-collaboration/delivery.service";
import {
  createWorkBuddyDeliveryToolDefinitions,
} from "@/lib/caio-collaboration/delivery-tools";
import type {
  GovernedMutationProofVerifier,
} from "@/lib/caio-collaboration/governed-mutation.service";
import {
  createWorkBuddyGovernedMutationHandlers,
  type WorkBuddyMutationMaterialFactory,
} from "@/lib/caio-collaboration/mutation-handlers";
import {
  createWorkBuddyGovernedMutationToolDefinitions,
} from "@/lib/caio-collaboration/mutation-tools";
import type {
  OwnerPresenceSignatureVerifier,
} from "@/lib/caio-collaboration/presence.service";
import {
  createWorkBuddyReadOnlyHandlers,
} from "@/lib/caio-collaboration/readonly-handlers";
import {
  createWorkBuddyReadOnlyToolDefinitions,
} from "@/lib/caio-collaboration/readonly-tools";
import {
  assertWorkBuddyRequestActive,
} from "@/lib/caio-collaboration/request-cancellation";
import {
  createPrismaWorkBuddyAuthorizationQueries,
} from "@/lib/caio-collaboration-runtime/workbuddy-authorization-queries.service";
import {
  createPrismaCaioDeliveryStore,
} from "@/lib/caio-collaboration-runtime/workbuddy-delivery-store.service";
import {
  createPrismaGovernedMutationChallengeStore,
  createPrismaGovernedMutationResultStore,
} from "@/lib/caio-collaboration-runtime/workbuddy-mutation-store.service";
import {
  createPrismaWorkBuddyMutationTargetQueries,
} from "@/lib/caio-collaboration-runtime/workbuddy-mutation-target-queries.service";
import {
  createPrismaWorkBuddyP1cProjectionQueries,
} from "@/lib/caio-collaboration-runtime/workbuddy-p1c-projection-queries.service";
import {
  createPrismaWorkBuddyOwnerPresenceWorkflow,
} from "@/lib/caio-collaboration-runtime/workbuddy-presence-workflow.service";
import {
  createPrismaCanonicalPromptResponseService,
} from "@/lib/caio-collaboration-runtime/workbuddy-prompt-response.service";
import {
  decideCaioAdvice,
} from "@/lib/caio-governance/advice-store.service";
import {
  bindCurrentCaioQuestionSelectionToDecisionRecords,
  selectCaioOperatingQuestions,
} from "@/lib/stage1-owner-loop/caio-operating-question-store.service";

import {
  createWorkBuddyGatewayRuntime,
  type WorkBuddyGatewayRuntime,
} from "./runtime";

type Environment = Readonly<
  Record<string, string | undefined>
>;

export type PrismaWorkBuddyGatewayRuntime =
  WorkBuddyGatewayRuntime &
    Readonly<{
      persistenceBoundary: "prisma-transport-ledger";
      canonicalObjectOwnership: "existing-services-only";
      deliveryIngressExposed: false;
    }>;

type PrismaCaioDeliveryService = ReturnType<
  typeof createCaioDeliveryService
>;

export type PrismaWorkBuddyDeliveryProducer = Readonly<
  Pick<
    PrismaCaioDeliveryService,
    | "enqueue"
    | "withdraw"
    | "registerSuppression"
    | "revokeSuppression"
  >
>;

function createPrismaDeliveryService(input: {
  now: () => string;
}): PrismaCaioDeliveryService {
  const projectionQueries =
    createPrismaWorkBuddyP1cProjectionQueries({
      now: input.now,
    });
  return createCaioDeliveryService({
    store: createPrismaCaioDeliveryStore(),
    resolve: createWorkBuddyDeliveryProjectionResolver({
      projectionQueries,
    }),
    now: input.now,
  });
}

export function createPrismaWorkBuddyDeliveryProducer(input?: {
  now?: () => string;
}): PrismaWorkBuddyDeliveryProducer {
  const now = input?.now ?? (() => new Date().toISOString());
  const delivery = createPrismaDeliveryService({ now });
  return Object.freeze({
    enqueue: delivery.enqueue,
    withdraw: delivery.withdraw,
    registerSuppression: delivery.registerSuppression,
    revokeSuppression: delivery.revokeSuppression,
  });
}

export function createCryptographicMutationMaterialFactory(): WorkBuddyMutationMaterialFactory {
  return Object.freeze({
    async nextChallenge() {
      return Object.freeze({
        challengeId:
          `workbuddy-mutation-challenge:${randomBytes(24).toString("hex")}`,
        nonce: randomBytes(32).toString("base64url"),
      });
    },
  });
}

export function createPrismaWorkBuddyGatewayRuntime(input: {
  env: Environment;
  presenceSignatureVerifier: OwnerPresenceSignatureVerifier;
  mutationProofVerifier: GovernedMutationProofVerifier;
  mutationMaterialFactory?: WorkBuddyMutationMaterialFactory;
  generatePresenceNonce?: () => string;
  now?: () => string;
  challengeTtlMs?: number;
  attestationTtlMs?: number;
}): PrismaWorkBuddyGatewayRuntime {
  const now = input.now ?? (() => new Date().toISOString());
  const authorizationQueries =
    createPrismaWorkBuddyAuthorizationQueries();
  const projectionQueries =
    createPrismaWorkBuddyP1cProjectionQueries({ now });
  const presenceWorkflow =
    createPrismaWorkBuddyOwnerPresenceWorkflow({
      signatureVerifier: input.presenceSignatureVerifier,
      generateNonce: input.generatePresenceNonce,
      now,
      challengeTtlMs: input.challengeTtlMs,
      attestationTtlMs: input.attestationTtlMs,
    });
  const delivery = createPrismaDeliveryService({ now });
  const challengeStore =
    createPrismaGovernedMutationChallengeStore();
  const resultStore = createPrismaGovernedMutationResultStore();
  const mutationHandlers =
    createWorkBuddyGovernedMutationHandlers({
      authorizationQueries,
      targetQueries:
        createPrismaWorkBuddyMutationTargetQueries({ now }),
      challengeStore,
      resultStore,
      proofVerifier: input.mutationProofVerifier,
      promptResponsePort: createCanonicalPromptResponsePort(
        createPrismaCanonicalPromptResponseService({ now }),
      ),
      questionSelectionPort:
        createCanonicalQuestionSelectionPort({
          select: ({ signal, ...request }) => {
            assertWorkBuddyRequestActive(signal);
            return selectCaioOperatingQuestions({
              ...request,
              now: new Date(now()),
            });
          },
          bind: ({ signal, ...request }) => {
            assertWorkBuddyRequestActive(signal);
            return bindCurrentCaioQuestionSelectionToDecisionRecords({
              ...request,
              now: new Date(now()),
            });
          },
        }),
      adviceDecisionPort: createCanonicalAdviceDecisionPort({
        decide: ({ signal, ...request }) => {
          assertWorkBuddyRequestActive(signal);
          return decideCaioAdvice(request);
        },
      }),
      materialFactory:
        input.mutationMaterialFactory ??
        createCryptographicMutationMaterialFactory(),
      now,
      challengeTtlMs: input.challengeTtlMs,
    });
  const tools = Object.freeze([
    ...createWorkBuddyReadOnlyToolDefinitions(
      createWorkBuddyReadOnlyHandlers({
        authorizationQueries,
        presenceWorkflow,
        projectionQueries,
        now,
      }),
    ),
    ...createWorkBuddyDeliveryToolDefinitions(
      createWorkBuddyDeliveryHandlers({
        authorizationQueries,
        delivery,
        now,
      }),
    ),
    ...createWorkBuddyGovernedMutationToolDefinitions(
      mutationHandlers,
    ),
  ]);
  const runtime = createWorkBuddyGatewayRuntime({
    env: input.env,
    tools,
    now,
  });

  return Object.freeze({
    ...runtime,
    persistenceBoundary: "prisma-transport-ledger",
    canonicalObjectOwnership: "existing-services-only",
    deliveryIngressExposed: false,
  });
}
