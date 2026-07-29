import {
  authorizeWorkBuddyOwnerCeoAccess,
  WORKBUDDY_OWNER_MUTATION_CAPABILITY,
  type WorkBuddyAuthorizationContext,
  type WorkBuddyAuthorizationQueries,
} from "./authorization.service";
import {
  WorkBuddyCollaborationError,
} from "./contracts";
import {
  prepareGovernedMutationCommand,
  submitGovernedMutationCommand,
  type GovernedMutationCommand,
  type GovernedMutationResultStore,
  type IdempotentCanonicalMutationPort,
} from "./governed-mutation-adapter.service";
import {
  governedMutationTargetSchema,
  type GovernedMutationActionKind,
  type GovernedMutationChallengeStore,
  type GovernedMutationProofVerifier,
  type GovernedMutationTarget,
} from "./governed-mutation.service";
import type { WorkBuddyToolExecutionContext } from "./mcp-tool-dispatcher";
import type { WorkBuddyGovernedMutationToolHandlers } from "./mutation-tools";
import {
  assertWorkBuddyRequestActive,
} from "./request-cancellation";

export interface WorkBuddyMutationTargetQueries {
  loadPromptResponseTarget(input: {
    workspaceId: string;
    deliveryObjectId: string;
    actorUserId: string;
    signal?: AbortSignal;
  }): Promise<GovernedMutationTarget>;
  loadQuestionSelectionTarget(input: {
    workspaceId: string;
    portfolioRef: string;
    actorUserId: string;
    signal?: AbortSignal;
  }): Promise<GovernedMutationTarget>;
  loadAdviceDecisionTarget(input: {
    workspaceId: string;
    adviceRef: string;
    actorUserId: string;
    signal?: AbortSignal;
  }): Promise<GovernedMutationTarget>;
}

export type WorkBuddyMutationChallengeMaterial = Readonly<{
  challengeId: string;
  nonce: string;
}>;

export interface WorkBuddyMutationMaterialFactory {
  nextChallenge(input: {
    workspaceId: string;
    actionKind: GovernedMutationActionKind;
    idempotencyKey: string;
    signal?: AbortSignal;
  }): Promise<WorkBuddyMutationChallengeMaterial>;
}

type MutationDependencies = Readonly<{
  authorizationQueries: WorkBuddyAuthorizationQueries;
  targetQueries: WorkBuddyMutationTargetQueries;
  challengeStore: GovernedMutationChallengeStore;
  resultStore: GovernedMutationResultStore;
  proofVerifier: GovernedMutationProofVerifier;
  promptResponsePort?: IdempotentCanonicalMutationPort;
  questionSelectionPort?: IdempotentCanonicalMutationPort;
  adviceDecisionPort?: IdempotentCanonicalMutationPort;
  materialFactory: WorkBuddyMutationMaterialFactory;
  now?: () => string;
  challengeTtlMs?: number;
}>;

function requirePayloadBoundPort(
  port: IdempotentCanonicalMutationPort | undefined,
): IdempotentCanonicalMutationPort {
  if (port?.idempotencyGuarantee !== "payload_bound") {
    throw new WorkBuddyCollaborationError(
      "WRITE_UNAVAILABLE",
      "This canonical mutation does not have a payload-bound idempotent adapter.",
    );
  }
  return port;
}

async function authorize(input: {
  dependencies: MutationDependencies;
  context: WorkBuddyToolExecutionContext;
  checkedAt: string;
}): Promise<WorkBuddyAuthorizationContext> {
  const authorization = await authorizeWorkBuddyOwnerCeoAccess({
    identity: input.context.identity,
    requiredScope: "caio:canonical:mutate",
    requiredCapability: WORKBUDDY_OWNER_MUTATION_CAPABILITY,
    queries: input.dependencies.authorizationQueries,
    checkedAt: input.checkedAt,
    ...(input.context.signal === undefined
      ? {}
      : { signal: input.context.signal }),
  });
  assertWorkBuddyRequestActive(input.context.signal);
  return authorization;
}

function assertCurrentTarget(input: {
  target: GovernedMutationTarget;
  expectedVersion: number;
  expectedKinds: readonly GovernedMutationTarget["objectKind"][];
  expectedRef?: string;
}): GovernedMutationTarget {
  const target = governedMutationTargetSchema.parse(input.target);
  if (!input.expectedKinds.includes(target.objectKind)) {
    throw new WorkBuddyCollaborationError(
      "INVALID_TOOL_INPUT",
      "The loaded canonical object has the wrong kind.",
    );
  }
  if (
    input.expectedRef !== undefined &&
    target.objectId !== input.expectedRef
  ) {
    throw new WorkBuddyCollaborationError(
      "VERSION_CONFLICT",
      "The canonical object ref changed during lookup.",
    );
  }
  if (target.objectVersion !== input.expectedVersion) {
    throw new WorkBuddyCollaborationError(
      "VERSION_CONFLICT",
      "The canonical object version changed.",
    );
  }
  return target;
}

async function prepare(input: {
  dependencies: MutationDependencies;
  context: WorkBuddyToolExecutionContext;
  authorization: WorkBuddyAuthorizationContext;
  actionKind: GovernedMutationActionKind;
  target: GovernedMutationTarget;
  expectedVersion: number;
  command: GovernedMutationCommand;
  idempotencyKey: string;
  issuedAt: string;
}) {
  assertWorkBuddyRequestActive(input.context.signal);
  const material =
    await input.dependencies.materialFactory.nextChallenge({
      workspaceId: input.authorization.workspaceId,
      actionKind: input.actionKind,
      idempotencyKey: input.idempotencyKey,
      ...(input.context.signal === undefined
        ? {}
        : { signal: input.context.signal }),
    });
  assertWorkBuddyRequestActive(input.context.signal);
  const prepared = await prepareGovernedMutationCommand({
    authorization: input.authorization,
    actionKind: input.actionKind,
    target: input.target,
    expectedVersion: input.expectedVersion,
    command: input.command,
    idempotencyKey: input.idempotencyKey,
    challengeId: material.challengeId,
    nonce: material.nonce,
    issuedAt: input.issuedAt,
    ttlMs: input.dependencies.challengeTtlMs ?? 120_000,
    challengeStore: input.dependencies.challengeStore,
    ...(input.context.signal === undefined
      ? {}
      : { signal: input.context.signal }),
  });
  assertWorkBuddyRequestActive(input.context.signal);
  return prepared;
}

async function submit(input: {
  dependencies: MutationDependencies;
  context: WorkBuddyToolExecutionContext;
  authorization: WorkBuddyAuthorizationContext;
  actionKind: GovernedMutationActionKind;
  target: GovernedMutationTarget;
  expectedVersion: number;
  command: GovernedMutationCommand;
  idempotencyKey: string;
  challengeId: string;
  proof: Parameters<typeof submitGovernedMutationCommand>[0]["proof"];
  verifiedAt: string;
  port: IdempotentCanonicalMutationPort;
}) {
  assertWorkBuddyRequestActive(input.context.signal);
  const challenge = await input.dependencies.challengeStore.get(
    input.challengeId,
    input.context.signal === undefined
      ? undefined
      : { signal: input.context.signal },
  );
  assertWorkBuddyRequestActive(input.context.signal);
  if (!challenge) {
    throw new WorkBuddyCollaborationError(
      "REPLAY_REJECTED",
      "The mutation challenge does not exist.",
    );
  }
  const submitted = await submitGovernedMutationCommand({
    challenge,
    actionKind: input.actionKind,
    target: input.target,
    expectedVersion: input.expectedVersion,
    command: input.command,
    idempotencyKey: input.idempotencyKey,
    proof: input.proof,
    identity: input.context.identity,
    freshAuthorization: input.authorization,
    verifiedAt: input.verifiedAt,
    verifier: input.dependencies.proofVerifier,
    challengeStore: input.dependencies.challengeStore,
    resultStore: input.dependencies.resultStore,
    apply: input.port.apply,
    ...(input.context.signal === undefined
      ? {}
      : { signal: input.context.signal }),
  });
  assertWorkBuddyRequestActive(input.context.signal);
  return submitted;
}

export function createWorkBuddyGovernedMutationHandlers(
  dependencies: MutationDependencies,
): WorkBuddyGovernedMutationToolHandlers {
  const now = dependencies.now ?? (() => new Date().toISOString());

  const handlers: WorkBuddyGovernedMutationToolHandlers = {
    async preparePromptResponse(input, context) {
      assertWorkBuddyRequestActive(context.signal);
      requirePayloadBoundPort(dependencies.promptResponsePort);
      const issuedAt = now();
      const authorization = await authorize({
        dependencies,
        context,
        checkedAt: issuedAt,
      });
      const target = assertCurrentTarget({
        target:
          await dependencies.targetQueries.loadPromptResponseTarget({
            workspaceId: input.workspaceId,
            deliveryObjectId: input.response.deliveryObjectId,
            actorUserId: context.identity.actorUserId,
            ...(context.signal === undefined
              ? {}
              : { signal: context.signal }),
          }),
        expectedVersion: input.expectedVersion,
        expectedKinds: [
          "operating_question_candidate",
          "decision_record",
          "supervision_signal",
        ],
      });
      assertWorkBuddyRequestActive(context.signal);
      return prepare({
        dependencies,
        context,
        authorization,
        actionKind: "prompt_response",
        target,
        expectedVersion: input.expectedVersion,
        command: input.response,
        idempotencyKey: input.idempotencyKey,
        issuedAt,
      });
    },

    async submitPromptResponse(input, context) {
      assertWorkBuddyRequestActive(context.signal);
      const port = requirePayloadBoundPort(
        dependencies.promptResponsePort,
      );
      const verifiedAt = now();
      const authorization = await authorize({
        dependencies,
        context,
        checkedAt: verifiedAt,
      });
      const loaded =
        await dependencies.targetQueries.loadPromptResponseTarget({
          workspaceId: input.workspaceId,
          deliveryObjectId: input.response.deliveryObjectId,
          actorUserId: context.identity.actorUserId,
          ...(context.signal === undefined
            ? {}
            : { signal: context.signal }),
        });
      assertWorkBuddyRequestActive(context.signal);
      const target = assertCurrentTarget({
        target: loaded,
        expectedVersion: input.expectedVersion,
        expectedKinds: [
          "operating_question_candidate",
          "decision_record",
          "supervision_signal",
        ],
      });
      return submit({
        dependencies,
        context,
        authorization,
        actionKind: "prompt_response",
        target,
        expectedVersion: input.expectedVersion,
        command: input.response,
        idempotencyKey: input.idempotencyKey,
        challengeId: input.challengeId,
        proof: input.proof,
        verifiedAt,
        port,
      });
    },

    async getPromptResponseReceipt(input, context) {
      assertWorkBuddyRequestActive(context.signal);
      await authorize({
        dependencies,
        context,
        checkedAt: now(),
      });
      assertWorkBuddyRequestActive(context.signal);
      const receipt = await dependencies.resultStore.get({
        workspaceId: input.workspaceId,
        actionKind: "prompt_response",
        idempotencyKey: input.idempotencyKey,
        ...(context.signal === undefined
          ? {}
          : { signal: context.signal }),
      });
      assertWorkBuddyRequestActive(context.signal);
      return receipt;
    },

    async prepareQuestionSelection(input, context) {
      assertWorkBuddyRequestActive(context.signal);
      requirePayloadBoundPort(dependencies.questionSelectionPort);
      const issuedAt = now();
      const authorization = await authorize({
        dependencies,
        context,
        checkedAt: issuedAt,
      });
      const target = assertCurrentTarget({
        target:
          await dependencies.targetQueries.loadQuestionSelectionTarget({
            workspaceId: input.workspaceId,
            portfolioRef: input.portfolioRef,
            actorUserId: context.identity.actorUserId,
            ...(context.signal === undefined
              ? {}
              : { signal: context.signal }),
          }),
        expectedVersion: input.expectedVersion,
        expectedKinds: ["operating_question_portfolio"],
        expectedRef: input.portfolioRef,
      });
      assertWorkBuddyRequestActive(context.signal);
      if (target.objectHash !== input.selection.portfolioHash) {
        throw new WorkBuddyCollaborationError(
          "VERSION_CONFLICT",
          "The submitted portfolio hash is not current.",
        );
      }
      return prepare({
        dependencies,
        context,
        authorization,
        actionKind: "question_selection",
        target,
        expectedVersion: input.expectedVersion,
        command: input.selection,
        idempotencyKey: input.idempotencyKey,
        issuedAt,
      });
    },

    async submitQuestionSelection(input, context) {
      assertWorkBuddyRequestActive(context.signal);
      const port = requirePayloadBoundPort(
        dependencies.questionSelectionPort,
      );
      const verifiedAt = now();
      const authorization = await authorize({
        dependencies,
        context,
        checkedAt: verifiedAt,
      });
      const target = assertCurrentTarget({
        target:
          await dependencies.targetQueries.loadQuestionSelectionTarget({
            workspaceId: input.workspaceId,
            portfolioRef: input.portfolioRef,
            actorUserId: context.identity.actorUserId,
            ...(context.signal === undefined
              ? {}
              : { signal: context.signal }),
          }),
        expectedVersion: input.expectedVersion,
        expectedKinds: ["operating_question_portfolio"],
        expectedRef: input.portfolioRef,
      });
      assertWorkBuddyRequestActive(context.signal);
      return submit({
        dependencies,
        context,
        authorization,
        actionKind: "question_selection",
        target,
        expectedVersion: input.expectedVersion,
        command: input.selection,
        idempotencyKey: input.idempotencyKey,
        challengeId: input.challengeId,
        proof: input.proof,
        verifiedAt,
        port,
      });
    },

    async getQuestionSelectionReceipt(input, context) {
      assertWorkBuddyRequestActive(context.signal);
      await authorize({
        dependencies,
        context,
        checkedAt: now(),
      });
      assertWorkBuddyRequestActive(context.signal);
      const receipt = await dependencies.resultStore.get({
        workspaceId: input.workspaceId,
        actionKind: "question_selection",
        idempotencyKey: input.idempotencyKey,
        ...(context.signal === undefined
          ? {}
          : { signal: context.signal }),
      });
      assertWorkBuddyRequestActive(context.signal);
      return receipt;
    },

    async prepareAdviceDecision(input, context) {
      assertWorkBuddyRequestActive(context.signal);
      requirePayloadBoundPort(dependencies.adviceDecisionPort);
      const issuedAt = now();
      const authorization = await authorize({
        dependencies,
        context,
        checkedAt: issuedAt,
      });
      const target = assertCurrentTarget({
        target:
          await dependencies.targetQueries.loadAdviceDecisionTarget({
            workspaceId: input.workspaceId,
            adviceRef: input.adviceRef,
            actorUserId: context.identity.actorUserId,
            ...(context.signal === undefined
              ? {}
              : { signal: context.signal }),
          }),
        expectedVersion: input.expectedVersion,
        expectedKinds: ["caio_advice"],
        expectedRef: input.adviceRef,
      });
      assertWorkBuddyRequestActive(context.signal);
      return prepare({
        dependencies,
        context,
        authorization,
        actionKind: "advice_decision",
        target,
        expectedVersion: input.expectedVersion,
        command: input.decision,
        idempotencyKey: input.idempotencyKey,
        issuedAt,
      });
    },

    async submitAdviceDecision(input, context) {
      assertWorkBuddyRequestActive(context.signal);
      const port = requirePayloadBoundPort(
        dependencies.adviceDecisionPort,
      );
      const verifiedAt = now();
      const authorization = await authorize({
        dependencies,
        context,
        checkedAt: verifiedAt,
      });
      const target = assertCurrentTarget({
        target:
          await dependencies.targetQueries.loadAdviceDecisionTarget({
            workspaceId: input.workspaceId,
            adviceRef: input.adviceRef,
            actorUserId: context.identity.actorUserId,
            ...(context.signal === undefined
              ? {}
              : { signal: context.signal }),
          }),
        expectedVersion: input.expectedVersion,
        expectedKinds: ["caio_advice"],
        expectedRef: input.adviceRef,
      });
      assertWorkBuddyRequestActive(context.signal);
      return submit({
        dependencies,
        context,
        authorization,
        actionKind: "advice_decision",
        target,
        expectedVersion: input.expectedVersion,
        command: input.decision,
        idempotencyKey: input.idempotencyKey,
        challengeId: input.challengeId,
        proof: input.proof,
        verifiedAt,
        port,
      });
    },

    async getAdviceDecisionReceipt(input, context) {
      assertWorkBuddyRequestActive(context.signal);
      await authorize({
        dependencies,
        context,
        checkedAt: now(),
      });
      assertWorkBuddyRequestActive(context.signal);
      const receipt = await dependencies.resultStore.get({
        workspaceId: input.workspaceId,
        actionKind: "advice_decision",
        idempotencyKey: input.idempotencyKey,
        ...(context.signal === undefined
          ? {}
          : { signal: context.signal }),
      });
      assertWorkBuddyRequestActive(context.signal);
      return receipt;
    },
  };
  return Object.freeze(handlers);
}
