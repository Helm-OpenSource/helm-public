import "server-only";

import {
  createWorkBuddyMcpToolDispatcher,
  type WorkBuddyMcpToolDispatcher,
} from "@/lib/caio-collaboration/mcp-tool-dispatcher";
import {
  createWorkBuddyMemberReadToolDefinitions,
  type WorkBuddyMemberReadQueries,
} from "@/lib/caio-collaboration/member-readonly-tools";
import type {
  WorkBuddyP1cProjectionQueries,
} from "@/lib/caio-collaboration/readonly-handlers";
import {
  createWorkBuddyMemberReadQueries,
} from "@/lib/caio-collaboration-runtime/workbuddy-member-read-queries.service";
import {
  createPrismaWorkBuddyP1cProjectionQueries,
} from "@/lib/caio-collaboration-runtime/workbuddy-p1c-projection-queries.service";

/**
 * Database-backed cloud dispatcher for the authenticated Mac edge.
 *
 * Only the read definition is enabled. Delivery, presence, mutation and
 * inference capabilities cannot be enabled by changing deployment env.
 */
export function createPrismaWorkBuddyReadOnlyDispatcher(input?: {
  now?: () => string;
  membershipQueries?: WorkBuddyMemberReadQueries;
  projectionQueries?: WorkBuddyP1cProjectionQueries;
}): WorkBuddyMcpToolDispatcher {
  const now = input?.now ?? (() => new Date().toISOString());
  const definitions = createWorkBuddyMemberReadToolDefinitions({
    membershipQueries:
      input?.membershipQueries ?? createWorkBuddyMemberReadQueries(),
    projectionQueries:
      input?.projectionQueries ??
      createPrismaWorkBuddyP1cProjectionQueries({ now }),
    now,
  });
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
