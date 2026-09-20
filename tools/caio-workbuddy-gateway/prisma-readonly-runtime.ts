import "server-only";

import {
  WorkBuddyCollaborationError,
} from "@/lib/caio-collaboration/contracts";
import {
  createWorkBuddyMcpToolDispatcher,
  type WorkBuddyMcpToolDispatcher,
} from "@/lib/caio-collaboration/mcp-tool-dispatcher";
import {
  createWorkBuddyReadOnlyHandlers,
  type WorkBuddyOwnerPresenceWorkflow,
} from "@/lib/caio-collaboration/readonly-handlers";
import {
  createWorkBuddyReadOnlyToolDefinitions,
} from "@/lib/caio-collaboration/readonly-tools";
import {
  createPrismaWorkBuddyAuthorizationQueries,
} from "@/lib/caio-collaboration-runtime/workbuddy-authorization-queries.service";
import {
  createPrismaWorkBuddyP1cProjectionQueries,
} from "@/lib/caio-collaboration-runtime/workbuddy-p1c-projection-queries.service";

const disabledPresenceWorkflow: WorkBuddyOwnerPresenceWorkflow =
  Object.freeze({
    async begin(): Promise<never> {
      throw new WorkBuddyCollaborationError(
        "TOOL_DISABLED",
        "Owner presence is unavailable on the read-only edge ingress.",
      );
    },
    async complete(): Promise<never> {
      throw new WorkBuddyCollaborationError(
        "TOOL_DISABLED",
        "Owner presence is unavailable on the read-only edge ingress.",
      );
    },
  });

/**
 * Database-backed cloud dispatcher for the authenticated Mac edge.
 *
 * Only the read definition is enabled. Delivery, presence, mutation and
 * inference capabilities cannot be enabled by changing deployment env.
 */
export function createPrismaWorkBuddyReadOnlyDispatcher(input?: {
  now?: () => string;
}): WorkBuddyMcpToolDispatcher {
  const now = input?.now ?? (() => new Date().toISOString());
  const definitions = createWorkBuddyReadOnlyToolDefinitions(
    createWorkBuddyReadOnlyHandlers({
      authorizationQueries:
        createPrismaWorkBuddyAuthorizationQueries(),
      presenceWorkflow: disabledPresenceWorkflow,
      projectionQueries:
        createPrismaWorkBuddyP1cProjectionQueries({ now }),
      now,
    }),
  );
  return createWorkBuddyMcpToolDispatcher({
    flags: Object.freeze({
      gatewayEnabled: true,
      readEnabled: true,
      pushEnabled: false,
      presenceEnabled: false,
      mutationsEnabled: false,
      promptResponsesEnabled: false,
      questionSelectionsEnabled: false,
      adviceDecisionsEnabled: false,
      inferenceJobsEnabled: false,
    }),
    tools: definitions,
    now,
  });
}
