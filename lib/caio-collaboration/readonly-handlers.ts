import {
  authorizeWorkBuddyOwnerCeoAccess,
  WORKBUDDY_OWNER_READ_CAPABILITY,
  type WorkBuddyAuthorizationContext,
  type WorkBuddyAuthorizationQueries,
} from "./authorization.service";
import {
  WorkBuddyCollaborationError,
  type WorkBuddyClientIdentity,
  type WorkBuddyScope,
} from "./contracts";
import type {
  OwnerPresenceAttestation,
  OwnerPresenceChallenge,
} from "./presence.service";
import {
  projectP1cForWorkBuddy,
  type P1cRemoteProjection,
} from "./remote-projection";
import {
  assertWorkBuddyRequestActive,
} from "./request-cancellation";
import type { WorkBuddyReadOnlyToolHandlers } from "./readonly-tools";
import type { OwnerPresenceProof } from "./tool-schemas";

export interface WorkBuddyOwnerPresenceWorkflow {
  begin(input: {
    authorization: WorkBuddyAuthorizationContext;
    identity: WorkBuddyClientIdentity;
    idempotencyKey: string;
    issuedAt: string;
    signal?: AbortSignal;
  }): Promise<OwnerPresenceChallenge>;
  complete(input: {
    authorization: WorkBuddyAuthorizationContext;
    identity: WorkBuddyClientIdentity;
    challengeId: string;
    proof: OwnerPresenceProof;
    idempotencyKey: string;
    verifiedAt: string;
    signal?: AbortSignal;
  }): Promise<OwnerPresenceAttestation>;
}

export interface WorkBuddyP1cProjectionQueries {
  loadP1cProjectionSource(input: {
    workspaceId: string;
    actorUserId: string;
    portfolioRef?: string;
    portfolioSequence?: number;
    signal?: AbortSignal;
  }): Promise<unknown | null>;
}

type ReadOnlyHandlerDependencies = Readonly<{
  authorizationQueries: WorkBuddyAuthorizationQueries;
  presenceWorkflow: WorkBuddyOwnerPresenceWorkflow;
  projectionQueries: WorkBuddyP1cProjectionQueries;
  now?: () => string;
}>;

function assertIdentityWorkspace(input: {
  workspaceId: string;
  identity: WorkBuddyClientIdentity;
}): void {
  if (input.workspaceId !== input.identity.workspaceId) {
    throw new WorkBuddyCollaborationError(
      "SCOPE_DENIED",
      "The tool workspace must match the mTLS client identity.",
    );
  }
}

function authorize(input: {
  dependencies: ReadOnlyHandlerDependencies;
  identity: WorkBuddyClientIdentity;
  requiredScope: WorkBuddyScope;
  checkedAt: string;
  signal?: AbortSignal;
}): Promise<WorkBuddyAuthorizationContext> {
  return authorizeWorkBuddyOwnerCeoAccess({
    identity: input.identity,
    requiredScope: input.requiredScope,
    requiredCapability: WORKBUDDY_OWNER_READ_CAPABILITY,
    queries: input.dependencies.authorizationQueries,
    checkedAt: input.checkedAt,
    signal: input.signal,
  });
}

function assertProjectionBinding(input: {
  projection: P1cRemoteProjection;
  workspaceId: string;
  portfolioRef?: string;
}): void {
  if (input.projection.workspaceRef !== input.workspaceId) {
    throw new WorkBuddyCollaborationError(
      "PROJECTION_BLOCKED",
      "The P1C projection escaped the authenticated workspace.",
    );
  }
  if (
    input.portfolioRef !== undefined &&
    input.projection.portfolio.ref !== input.portfolioRef
  ) {
    throw new WorkBuddyCollaborationError(
      "VERSION_CONFLICT",
      "The projected portfolio does not match the requested ref.",
    );
  }
}

export function createWorkBuddyReadOnlyHandlers(
  dependencies: ReadOnlyHandlerDependencies,
): WorkBuddyReadOnlyToolHandlers {
  const now = dependencies.now ?? (() => new Date().toISOString());

  const handlers: WorkBuddyReadOnlyToolHandlers = {
    async beginOwnerPresenceChallenge(input, context) {
      assertWorkBuddyRequestActive(context.signal);
      assertIdentityWorkspace({
        workspaceId: input.workspaceId,
        identity: context.identity,
      });
      const issuedAt = now();
      const authorization = await authorize({
        dependencies,
        identity: context.identity,
        requiredScope: "caio:presence:challenge",
        checkedAt: issuedAt,
        signal: context.signal,
      });
      assertWorkBuddyRequestActive(context.signal);
      const challenge = await dependencies.presenceWorkflow.begin({
        authorization,
        identity: context.identity,
        idempotencyKey: input.idempotencyKey,
        issuedAt,
        signal: context.signal,
      });
      assertWorkBuddyRequestActive(context.signal);
      return challenge;
    },

    async completeOwnerPresenceChallenge(input, context) {
      assertWorkBuddyRequestActive(context.signal);
      const verifiedAt = now();
      const authorization = await authorize({
        dependencies,
        identity: context.identity,
        requiredScope: "caio:presence:challenge",
        checkedAt: verifiedAt,
        signal: context.signal,
      });
      assertWorkBuddyRequestActive(context.signal);
      const attestation =
        await dependencies.presenceWorkflow.complete({
        authorization,
        identity: context.identity,
        challengeId: input.challengeId,
        proof: input.proof,
        idempotencyKey: input.idempotencyKey,
        verifiedAt,
        signal: context.signal,
      });
      assertWorkBuddyRequestActive(context.signal);
      return attestation;
    },

    async getP1cReadProjection(input, context) {
      assertWorkBuddyRequestActive(context.signal);
      assertIdentityWorkspace({
        workspaceId: input.workspaceId,
        identity: context.identity,
      });
      const authorization = await authorize({
        dependencies,
        identity: context.identity,
        requiredScope: "caio:p1c:read",
        checkedAt: now(),
        signal: context.signal,
      });
      assertWorkBuddyRequestActive(context.signal);
      const source =
        await dependencies.projectionQueries.loadP1cProjectionSource({
          workspaceId: authorization.workspaceId,
          actorUserId: authorization.actorUserId,
          portfolioRef: input.portfolioRef,
          signal: context.signal,
        });
      assertWorkBuddyRequestActive(context.signal);
      if (source === null) {
        throw new WorkBuddyCollaborationError(
          "INVALID_TOOL_INPUT",
          "The requested P1C portfolio is not available.",
        );
      }

      const projection = projectP1cForWorkBuddy(source);
      assertProjectionBinding({
        projection,
        workspaceId: authorization.workspaceId,
        portfolioRef: input.portfolioRef,
      });
      return projection;
    },
  };
  return Object.freeze(handlers);
}
