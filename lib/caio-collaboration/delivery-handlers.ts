import {
  authorizeWorkBuddyOwnerCeoAccess,
  WORKBUDDY_OWNER_READ_CAPABILITY,
  type WorkBuddyAuthorizationQueries,
} from "./authorization.service";
import {
  WorkBuddyCollaborationError,
  type WorkBuddyClientIdentity,
} from "./contracts";
import type {
  CaioDeliveryCursor,
  CaioDeliveryEnvelope,
  CaioDeliverySeverity,
} from "./delivery-contracts";
import type {
  CaioDeliveryPollResult,
  CaioDeliveryPromptProjection,
} from "./delivery.service";
import type { WorkBuddyDeliveryToolHandlers } from "./delivery-tools";
import {
  assertWorkBuddyRequestActive,
} from "./request-cancellation";

export interface WorkBuddyDeliveryReadPort {
  poll(input: {
    workspaceId: string;
    clientId: string;
    severity: CaioDeliverySeverity;
    cursor: CaioDeliveryCursor;
    limit: number;
    signal?: AbortSignal;
  }): Promise<CaioDeliveryPollResult>;
  listPending(input: {
    workspaceId: string;
    severity?: CaioDeliverySeverity;
    signal?: AbortSignal;
  }): Promise<readonly CaioDeliveryEnvelope[]>;
  getPrompt(input: {
    workspaceId: string;
    deliveryObjectId: string;
    signal?: AbortSignal;
  }): Promise<
    Readonly<{
      envelope: CaioDeliveryEnvelope;
      projection: CaioDeliveryPromptProjection;
    }>
  >;
}

type DeliveryHandlerDependencies = Readonly<{
  authorizationQueries: WorkBuddyAuthorizationQueries;
  delivery: WorkBuddyDeliveryReadPort;
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

async function authorize(input: {
  dependencies: DeliveryHandlerDependencies;
  identity: WorkBuddyClientIdentity;
  workspaceId: string;
  checkedAt: string;
  signal?: AbortSignal;
}): Promise<void> {
  assertWorkBuddyRequestActive(input.signal);
  assertIdentityWorkspace({
    workspaceId: input.workspaceId,
    identity: input.identity,
  });
  await authorizeWorkBuddyOwnerCeoAccess({
    identity: input.identity,
    requiredScope: "caio:delivery:read",
    requiredCapability: WORKBUDDY_OWNER_READ_CAPABILITY,
    queries: input.dependencies.authorizationQueries,
    checkedAt: input.checkedAt,
    signal: input.signal,
  });
  assertWorkBuddyRequestActive(input.signal);
}

export function createWorkBuddyDeliveryHandlers(
  dependencies: DeliveryHandlerDependencies,
): WorkBuddyDeliveryToolHandlers {
  const now = dependencies.now ?? (() => new Date().toISOString());

  const handlers: WorkBuddyDeliveryToolHandlers = {
    async pollCeoPrompts(input, context) {
      assertWorkBuddyRequestActive(context.signal);
      await authorize({
        dependencies,
        identity: context.identity,
        workspaceId: input.workspaceId,
        checkedAt: now(),
        signal: context.signal,
      });
      assertWorkBuddyRequestActive(context.signal);
      const result = await dependencies.delivery.poll({
        ...input,
        clientId: context.identity.clientId,
        signal: context.signal,
      });
      assertWorkBuddyRequestActive(context.signal);
      return result;
    },

    async listPendingCeoPrompts(input, context) {
      assertWorkBuddyRequestActive(context.signal);
      await authorize({
        dependencies,
        identity: context.identity,
        workspaceId: input.workspaceId,
        checkedAt: now(),
        signal: context.signal,
      });
      assertWorkBuddyRequestActive(context.signal);
      const result = await dependencies.delivery.listPending({
        ...input,
        signal: context.signal,
      });
      assertWorkBuddyRequestActive(context.signal);
      return result;
    },

    async getCeoPrompt(input, context) {
      assertWorkBuddyRequestActive(context.signal);
      await authorize({
        dependencies,
        identity: context.identity,
        workspaceId: input.workspaceId,
        checkedAt: now(),
        signal: context.signal,
      });
      assertWorkBuddyRequestActive(context.signal);
      const result = await dependencies.delivery.getPrompt({
        ...input,
        signal: context.signal,
      });
      assertWorkBuddyRequestActive(context.signal);
      return result;
    },
  };
  return Object.freeze(handlers);
}
