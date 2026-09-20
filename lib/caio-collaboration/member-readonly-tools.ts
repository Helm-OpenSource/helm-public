import {
  WorkBuddyCollaborationError,
  workBuddyClientIdentitySchema,
} from "./contracts";
import type {
  WorkBuddyP1cProjectionQueries,
} from "./readonly-handlers";
import type {
  WorkBuddyToolDefinition,
} from "./mcp-tool-dispatcher";
import {
  projectP1cForWorkBuddy,
} from "./remote-projection";
import {
  assertWorkBuddyRequestActive,
} from "./request-cancellation";
import {
  getP1cReadProjectionInputSchema,
  WORKBUDDY_TOOL_INPUT_JSON_SCHEMAS,
} from "./tool-schemas";

type WorkBuddyMembershipRole =
  | "OWNER"
  | "ADMIN"
  | "BILLING_ADMIN"
  | "OPERATOR"
  | "REVIEWER"
  | "MEMBER";

export interface WorkBuddyMemberReadQueries {
  loadMembership(input: {
    workspaceId: string;
    actorUserId: string;
    signal?: AbortSignal;
  }): Promise<Readonly<{
    status: "ACTIVE" | "INVITED" | "INACTIVE";
    role: WorkBuddyMembershipRole;
  }> | null>;
}

export function createWorkBuddyMemberReadToolDefinitions(input: {
  membershipQueries: WorkBuddyMemberReadQueries;
  projectionQueries: WorkBuddyP1cProjectionQueries;
  now?: () => string;
}): readonly WorkBuddyToolDefinition[] {
  const now = input.now ?? (() => new Date().toISOString());
  return Object.freeze([
    Object.freeze({
      name: "get_p1c_read_projection",
      description:
        "Read a remote-safe projection of the canonical P1C portfolio.",
      risk: "read" as const,
      requiredScopes: ["caio:p1c:read"] as const,
      inputSchema: getP1cReadProjectionInputSchema,
      inputJsonSchema:
        WORKBUDDY_TOOL_INPUT_JSON_SCHEMAS.get_p1c_read_projection,
      async execute(rawInput, context) {
        assertWorkBuddyRequestActive(context.signal);
        const identity = workBuddyClientIdentitySchema.parse(
          context.identity,
        );
        const toolInput = getP1cReadProjectionInputSchema.parse(
          rawInput,
        );
        if (
          toolInput.workspaceId !== identity.workspaceId ||
          !identity.scopes.includes("caio:p1c:read")
        ) {
          throw new WorkBuddyCollaborationError(
            "SCOPE_DENIED",
            "The device identity does not allow this workspace read.",
          );
        }
        const checkedAt = now();
        if (
          !Number.isFinite(Date.parse(checkedAt)) ||
          Date.parse(checkedAt) < Date.parse(identity.authenticatedAt)
        ) {
          throw new WorkBuddyCollaborationError(
            "AUTH_EXPIRED",
            "Membership must be checked after mTLS authentication.",
          );
        }
        const membership = await input.membershipQueries.loadMembership({
          workspaceId: identity.workspaceId,
          actorUserId: identity.actorUserId,
          signal: context.signal,
        });
        assertWorkBuddyRequestActive(context.signal);
        if (membership?.status !== "ACTIVE") {
          throw new WorkBuddyCollaborationError(
            "CAPABILITY_DENIED",
            "An active workspace membership is required.",
          );
        }
        const source =
          await input.projectionQueries.loadP1cProjectionSource({
            workspaceId: identity.workspaceId,
            actorUserId: identity.actorUserId,
            portfolioRef: toolInput.portfolioRef,
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
        if (projection.workspaceRef !== identity.workspaceId) {
          throw new WorkBuddyCollaborationError(
            "PROJECTION_BLOCKED",
            "The P1C projection escaped the authenticated workspace.",
          );
        }
        return projection;
      },
    }),
  ] satisfies readonly WorkBuddyToolDefinition[]);
}
