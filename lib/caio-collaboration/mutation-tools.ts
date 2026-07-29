import type { z } from "zod";

import { WorkBuddyCollaborationError } from "./contracts";
import type {
  WorkBuddyMutationFeatureFlag,
  WorkBuddyToolDefinition,
  WorkBuddyToolExecutionContext,
} from "./mcp-tool-dispatcher";
import {
  getAdviceDecisionReceiptInputSchema,
  getPromptResponseReceiptInputSchema,
  getQuestionSelectionReceiptInputSchema,
  prepareAdviceDecisionInputSchema,
  preparePromptResponseInputSchema,
  prepareQuestionSelectionInputSchema,
  submitAdviceDecisionInputSchema,
  submitPromptResponseInputSchema,
  submitQuestionSelectionInputSchema,
  WORKBUDDY_GOVERNED_MUTATION_JSON_SCHEMAS,
} from "./mutation-tool-schemas";

type MutationHandler<T> = (
  input: T,
  context: WorkBuddyToolExecutionContext,
) => Promise<unknown>;

export interface WorkBuddyGovernedMutationToolHandlers {
  preparePromptResponse: MutationHandler<
    z.infer<typeof preparePromptResponseInputSchema>
  >;
  submitPromptResponse: MutationHandler<
    z.infer<typeof submitPromptResponseInputSchema>
  >;
  getPromptResponseReceipt: MutationHandler<
    z.infer<typeof getPromptResponseReceiptInputSchema>
  >;
  prepareQuestionSelection: MutationHandler<
    z.infer<typeof prepareQuestionSelectionInputSchema>
  >;
  submitQuestionSelection: MutationHandler<
    z.infer<typeof submitQuestionSelectionInputSchema>
  >;
  getQuestionSelectionReceipt: MutationHandler<
    z.infer<typeof getQuestionSelectionReceiptInputSchema>
  >;
  prepareAdviceDecision: MutationHandler<
    z.infer<typeof prepareAdviceDecisionInputSchema>
  >;
  submitAdviceDecision: MutationHandler<
    z.infer<typeof submitAdviceDecisionInputSchema>
  >;
  getAdviceDecisionReceipt: MutationHandler<
    z.infer<typeof getAdviceDecisionReceiptInputSchema>
  >;
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

function mutationTool<T>(input: {
  name: string;
  description: string;
  mutationFeatureFlag: WorkBuddyMutationFeatureFlag;
  schema: z.ZodType<T>;
  jsonSchema: WorkBuddyToolDefinition["inputJsonSchema"];
  handler: MutationHandler<T>;
}): WorkBuddyToolDefinition {
  return Object.freeze({
    name: input.name,
    description: input.description,
    risk: "mutation",
    mutationFeatureFlag: input.mutationFeatureFlag,
    requiredScopes: ["caio:canonical:mutate"] as const,
    inputSchema: input.schema,
    inputJsonSchema: input.jsonSchema,
    execute: (raw, context) => {
      const parsed = input.schema.parse(raw);
      const workspaceId = (parsed as { workspaceId: string })
        .workspaceId;
      assertIdentityWorkspace(workspaceId, context);
      return input.handler(parsed, context);
    },
  });
}

export function createWorkBuddyGovernedMutationToolDefinitions(
  handlers: WorkBuddyGovernedMutationToolHandlers,
): readonly WorkBuddyToolDefinition[] {
  return Object.freeze([
    mutationTool({
      name: "prepare_prompt_response",
      description:
        "Prepare an exact prompt response and one-time presence challenge.",
      mutationFeatureFlag: "promptResponsesEnabled",
      schema: preparePromptResponseInputSchema,
      jsonSchema:
        WORKBUDDY_GOVERNED_MUTATION_JSON_SCHEMAS.prepare_prompt_response,
      handler: handlers.preparePromptResponse,
    }),
    mutationTool({
      name: "submit_prompt_response",
      description:
        "Submit the unchanged prompt response with device presence.",
      mutationFeatureFlag: "promptResponsesEnabled",
      schema: submitPromptResponseInputSchema,
      jsonSchema:
        WORKBUDDY_GOVERNED_MUTATION_JSON_SCHEMAS.submit_prompt_response,
      handler: handlers.submitPromptResponse,
    }),
    mutationTool({
      name: "get_prompt_response_receipt",
      description:
        "Recover an immutable prompt response receipt by idempotency key.",
      mutationFeatureFlag: "promptResponsesEnabled",
      schema: getPromptResponseReceiptInputSchema,
      jsonSchema:
        WORKBUDDY_GOVERNED_MUTATION_JSON_SCHEMAS.get_prompt_response_receipt,
      handler: handlers.getPromptResponseReceipt,
    }),
    mutationTool({
      name: "prepare_question_selection",
      description:
        "Prepare a zero-to-three canonical P1C selection.",
      mutationFeatureFlag: "questionSelectionsEnabled",
      schema: prepareQuestionSelectionInputSchema,
      jsonSchema:
        WORKBUDDY_GOVERNED_MUTATION_JSON_SCHEMAS.prepare_question_selection,
      handler: handlers.prepareQuestionSelection,
    }),
    mutationTool({
      name: "submit_question_selection",
      description:
        "Submit an unchanged P1C selection through the canonical service.",
      mutationFeatureFlag: "questionSelectionsEnabled",
      schema: submitQuestionSelectionInputSchema,
      jsonSchema:
        WORKBUDDY_GOVERNED_MUTATION_JSON_SCHEMAS.submit_question_selection,
      handler: handlers.submitQuestionSelection,
    }),
    mutationTool({
      name: "get_question_selection_receipt",
      description:
        "Recover the canonical P1C selection receipt reference.",
      mutationFeatureFlag: "questionSelectionsEnabled",
      schema: getQuestionSelectionReceiptInputSchema,
      jsonSchema:
        WORKBUDDY_GOVERNED_MUTATION_JSON_SCHEMAS.get_question_selection_receipt,
      handler: handlers.getQuestionSelectionReceipt,
    }),
    mutationTool({
      name: "prepare_advice_decision",
      description:
        "Prepare an exact accept, reject, or defer advice decision.",
      mutationFeatureFlag: "adviceDecisionsEnabled",
      schema: prepareAdviceDecisionInputSchema,
      jsonSchema:
        WORKBUDDY_GOVERNED_MUTATION_JSON_SCHEMAS.prepare_advice_decision,
      handler: handlers.prepareAdviceDecision,
    }),
    mutationTool({
      name: "submit_advice_decision",
      description:
        "Submit an unchanged advice decision with no execution authority.",
      mutationFeatureFlag: "adviceDecisionsEnabled",
      schema: submitAdviceDecisionInputSchema,
      jsonSchema:
        WORKBUDDY_GOVERNED_MUTATION_JSON_SCHEMAS.submit_advice_decision,
      handler: handlers.submitAdviceDecision,
    }),
    mutationTool({
      name: "get_advice_decision_receipt",
      description:
        "Recover the canonical advice decision receipt reference.",
      mutationFeatureFlag: "adviceDecisionsEnabled",
      schema: getAdviceDecisionReceiptInputSchema,
      jsonSchema:
        WORKBUDDY_GOVERNED_MUTATION_JSON_SCHEMAS.get_advice_decision_receipt,
      handler: handlers.getAdviceDecisionReceipt,
    }),
  ]);
}
