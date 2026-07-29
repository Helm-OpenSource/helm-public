import type { z } from "zod";

import type { WorkBuddyToolExecutionContext } from "./mcp-tool-dispatcher";
import type { WorkBuddyToolDefinition } from "./mcp-tool-dispatcher";
import {
  beginOwnerPresenceChallengeInputSchema,
  completeOwnerPresenceChallengeInputSchema,
  getP1cReadProjectionInputSchema,
  WORKBUDDY_TOOL_INPUT_JSON_SCHEMAS,
} from "./tool-schemas";

type BeginInput = z.infer<
  typeof beginOwnerPresenceChallengeInputSchema
>;
type CompleteInput = z.infer<
  typeof completeOwnerPresenceChallengeInputSchema
>;
type ReadInput = z.infer<typeof getP1cReadProjectionInputSchema>;

export interface WorkBuddyReadOnlyToolHandlers {
  beginOwnerPresenceChallenge(
    input: BeginInput,
    context: WorkBuddyToolExecutionContext,
  ): Promise<unknown>;
  completeOwnerPresenceChallenge(
    input: CompleteInput,
    context: WorkBuddyToolExecutionContext,
  ): Promise<unknown>;
  getP1cReadProjection(
    input: ReadInput,
    context: WorkBuddyToolExecutionContext,
  ): Promise<unknown>;
}

export function createWorkBuddyReadOnlyToolDefinitions(
  handlers: WorkBuddyReadOnlyToolHandlers,
): readonly WorkBuddyToolDefinition[] {
  return Object.freeze([
    Object.freeze({
      name: "begin_owner_presence_challenge",
      description:
        "Begin a single-use OWNER and CEO-bound presence challenge.",
      risk: "presence",
      requiredScopes: ["caio:presence:challenge"] as const,
      inputSchema: beginOwnerPresenceChallengeInputSchema,
      inputJsonSchema:
        WORKBUDDY_TOOL_INPUT_JSON_SCHEMAS.begin_owner_presence_challenge,
      execute: (input, context) =>
        handlers.beginOwnerPresenceChallenge(
          beginOwnerPresenceChallengeInputSchema.parse(input),
          context,
        ),
    }),
    Object.freeze({
      name: "complete_owner_presence_challenge",
      description:
        "Verify and consume a device-bound OWNER presence challenge.",
      risk: "presence",
      requiredScopes: ["caio:presence:challenge"] as const,
      inputSchema: completeOwnerPresenceChallengeInputSchema,
      inputJsonSchema:
        WORKBUDDY_TOOL_INPUT_JSON_SCHEMAS.complete_owner_presence_challenge,
      execute: (input, context) =>
        handlers.completeOwnerPresenceChallenge(
          completeOwnerPresenceChallengeInputSchema.parse(input),
          context,
        ),
    }),
    Object.freeze({
      name: "get_p1c_read_projection",
      description:
        "Read a remote-safe projection of the canonical P1C portfolio.",
      risk: "read",
      requiredScopes: ["caio:p1c:read"] as const,
      inputSchema: getP1cReadProjectionInputSchema,
      inputJsonSchema:
        WORKBUDDY_TOOL_INPUT_JSON_SCHEMAS.get_p1c_read_projection,
      execute: (input, context) =>
        handlers.getP1cReadProjection(
          getP1cReadProjectionInputSchema.parse(input),
          context,
        ),
    }),
  ] satisfies readonly WorkBuddyToolDefinition[]);
}
