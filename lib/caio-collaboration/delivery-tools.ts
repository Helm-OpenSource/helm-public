import type { z } from "zod";

import { WorkBuddyCollaborationError } from "./contracts";
import type {
  WorkBuddyToolDefinition,
  WorkBuddyToolExecutionContext,
} from "./mcp-tool-dispatcher";
import {
  getCeoPromptInputSchema,
  listPendingCeoPromptsInputSchema,
  pollCeoPromptsInputSchema,
  WORKBUDDY_TOOL_INPUT_JSON_SCHEMAS,
} from "./tool-schemas";

type PollInput = z.infer<typeof pollCeoPromptsInputSchema>;
type ListInput = z.infer<
  typeof listPendingCeoPromptsInputSchema
>;
type GetInput = z.infer<typeof getCeoPromptInputSchema>;

export interface WorkBuddyDeliveryToolHandlers {
  pollCeoPrompts(
    input: PollInput,
    context: WorkBuddyToolExecutionContext,
  ): Promise<unknown>;
  listPendingCeoPrompts(
    input: ListInput,
    context: WorkBuddyToolExecutionContext,
  ): Promise<unknown>;
  getCeoPrompt(
    input: GetInput,
    context: WorkBuddyToolExecutionContext,
  ): Promise<unknown>;
}

function assertIdentityWorkspace(
  workspaceId: string,
  context: WorkBuddyToolExecutionContext,
): void {
  if (workspaceId !== context.identity.workspaceId) {
    throw new WorkBuddyCollaborationError(
      "SCOPE_DENIED",
      "The tool workspace must match the mTLS client identity.",
    );
  }
}

export function createWorkBuddyDeliveryToolDefinitions(
  handlers: WorkBuddyDeliveryToolHandlers,
): readonly WorkBuddyToolDefinition[] {
  return Object.freeze([
    Object.freeze({
      name: "poll_ceo_prompts",
      description:
        "Poll typed CAIO delivery envelopes from one severity lane.",
      risk: "delivery",
      requiredScopes: ["caio:delivery:read"] as const,
      inputSchema: pollCeoPromptsInputSchema,
      inputJsonSchema:
        WORKBUDDY_TOOL_INPUT_JSON_SCHEMAS.poll_ceo_prompts,
      execute: (input, context) => {
        const parsed = pollCeoPromptsInputSchema.parse(input);
        assertIdentityWorkspace(parsed.workspaceId, context);
        return handlers.pollCeoPrompts(parsed, context);
      },
    }),
    Object.freeze({
      name: "list_pending_ceo_prompts",
      description:
        "List open typed CAIO delivery envelopes without source payloads.",
      risk: "delivery",
      requiredScopes: ["caio:delivery:read"] as const,
      inputSchema: listPendingCeoPromptsInputSchema,
      inputJsonSchema:
        WORKBUDDY_TOOL_INPUT_JSON_SCHEMAS.list_pending_ceo_prompts,
      execute: (input, context) => {
        const parsed =
          listPendingCeoPromptsInputSchema.parse(input);
        assertIdentityWorkspace(parsed.workspaceId, context);
        return handlers.listPendingCeoPrompts(parsed, context);
      },
    }),
    Object.freeze({
      name: "get_ceo_prompt",
      description:
        "Resolve one typed delivery through its canonical projection policy.",
      risk: "delivery",
      requiredScopes: ["caio:delivery:read"] as const,
      inputSchema: getCeoPromptInputSchema,
      inputJsonSchema:
        WORKBUDDY_TOOL_INPUT_JSON_SCHEMAS.get_ceo_prompt,
      execute: (input, context) => {
        const parsed = getCeoPromptInputSchema.parse(input);
        assertIdentityWorkspace(parsed.workspaceId, context);
        return handlers.getCeoPrompt(parsed, context);
      },
    }),
  ] satisfies readonly WorkBuddyToolDefinition[]);
}
