import type { z } from "zod";

import {
  createToolFailure,
  createToolSuccess,
  WorkBuddyCollaborationError,
  workBuddyClientIdentitySchema,
  type ToolEnvelope,
  type WorkBuddyClientIdentity,
  type WorkBuddyScope,
} from "./contracts";
import type { WorkBuddyFeatureFlags } from "./feature-flags";
import {
  assertWorkBuddyRequestActive,
} from "./request-cancellation";
import type { WorkBuddyJsonSchema } from "./tool-schemas";

export type WorkBuddyToolRisk =
  | "read"
  | "delivery"
  | "presence"
  | "mutation";

export type WorkBuddyMutationFeatureFlag =
  | "promptResponsesEnabled"
  | "questionSelectionsEnabled"
  | "adviceDecisionsEnabled";

export type WorkBuddyToolExecutionContext = Readonly<{
  requestId: string;
  identity: WorkBuddyClientIdentity;
  signal?: AbortSignal;
}>;

export type WorkBuddyToolDefinition = Readonly<{
  name: string;
  description: string;
  risk: WorkBuddyToolRisk;
  mutationFeatureFlag?: WorkBuddyMutationFeatureFlag;
  requiredScopes: readonly WorkBuddyScope[];
  inputSchema: z.ZodType;
  inputJsonSchema: WorkBuddyJsonSchema;
  execute(
    input: unknown,
    context: WorkBuddyToolExecutionContext,
  ): Promise<unknown>;
}>;

export type WorkBuddyMcpToolDescriptor = Readonly<{
  name: string;
  description: string;
  risk: WorkBuddyToolRisk;
  inputSchema: WorkBuddyJsonSchema;
}>;

type DispatchInput = Readonly<{
  name: string;
  input: unknown;
  context: WorkBuddyToolExecutionContext;
}>;

export type WorkBuddyMcpToolDispatcher = Readonly<{
  listTools(
    identity?: WorkBuddyClientIdentity,
  ): readonly WorkBuddyMcpToolDescriptor[];
  dispatch(input: DispatchInput): Promise<ToolEnvelope<unknown>>;
}>;

function isDefinitionEnabled(
  definition: WorkBuddyToolDefinition,
  flags: WorkBuddyFeatureFlags,
): boolean {
  if (!flags.gatewayEnabled) return false;
  if (definition.risk === "read" && !flags.readEnabled) return false;
  if (
    definition.risk === "delivery" &&
    !flags.pushEnabled
  ) {
    return false;
  }
  if (
    definition.risk === "presence" &&
    !flags.presenceEnabled
  ) {
    return false;
  }
  if (
    definition.risk === "mutation" &&
    (!flags.mutationsEnabled ||
      !definition.mutationFeatureFlag ||
      !flags[definition.mutationFeatureFlag])
  ) {
    return false;
  }
  return true;
}

export function createWorkBuddyMcpToolDispatcher(input: {
  flags: WorkBuddyFeatureFlags;
  tools: readonly WorkBuddyToolDefinition[];
  now?: () => string;
}): WorkBuddyMcpToolDispatcher {
  const now = input.now ?? (() => new Date().toISOString());
  const allTools = new Map<string, WorkBuddyToolDefinition>();
  for (const definition of input.tools) {
    if (allTools.has(definition.name)) {
      throw new Error(`Duplicate WorkBuddy tool: ${definition.name}`);
    }
    allTools.set(definition.name, definition);
  }

  const enabledTools = new Map(
    [...allTools.entries()].filter(([, definition]) =>
      isDefinitionEnabled(definition, input.flags),
    ),
  );

  return Object.freeze({
    listTools(
      identity?: WorkBuddyClientIdentity,
    ): readonly WorkBuddyMcpToolDescriptor[] {
      const identityResult =
        identity === undefined
          ? null
          : workBuddyClientIdentitySchema.safeParse(identity);
      if (identityResult && !identityResult.success) {
        return Object.freeze([]);
      }
      return Object.freeze(
        [...enabledTools.values()]
          .filter(
            (definition) =>
              identityResult === null ||
              definition.requiredScopes.every((scope) =>
                identityResult.data.scopes.includes(scope),
              ),
          )
          .map((definition) =>
            Object.freeze({
              name: definition.name,
              description: definition.description,
              risk: definition.risk,
              inputSchema: definition.inputJsonSchema,
            }),
          ),
      );
    },

    async dispatch(
      dispatchInput: DispatchInput,
    ): Promise<ToolEnvelope<unknown>> {
      const serverTime = now();
      const knownDefinition = allTools.get(dispatchInput.name);
      if (
        knownDefinition?.risk === "mutation" &&
        !isDefinitionEnabled(knownDefinition, input.flags)
      ) {
        return createToolFailure({
          requestId: dispatchInput.context.requestId,
          serverTime,
          code: "MUTATION_DISABLED",
          message: "Canonical mutation tools are disabled.",
          retryable: false,
        });
      }

      const definition = enabledTools.get(dispatchInput.name);
      if (!definition) {
        return createToolFailure({
          requestId: dispatchInput.context.requestId,
          serverTime,
          code: knownDefinition ? "TOOL_DISABLED" : "TOOL_NOT_FOUND",
          message: knownDefinition
            ? "The requested tool is disabled."
            : "The requested tool is not registered.",
          retryable: false,
        });
      }

      const identityResult = workBuddyClientIdentitySchema.safeParse(
        dispatchInput.context.identity,
      );
      if (!identityResult.success) {
        return createToolFailure({
          requestId: dispatchInput.context.requestId,
          serverTime,
          code: "CLIENT_IDENTITY_INVALID",
          message: "A verified mTLS client identity is required.",
          retryable: false,
        });
      }

      try {
        assertWorkBuddyRequestActive(
          dispatchInput.context.signal,
        );
      } catch (error) {
        if (!(error instanceof WorkBuddyCollaborationError)) {
          throw error;
        }
        return createToolFailure({
          requestId: dispatchInput.context.requestId,
          serverTime,
          code: error.code,
          message: error.message,
          retryable: error.retryable,
        });
      }

      const hasScopes = definition.requiredScopes.every((scope) =>
        identityResult.data.scopes.includes(scope),
      );
      if (!hasScopes) {
        return createToolFailure({
          requestId: dispatchInput.context.requestId,
          serverTime,
          code: "SCOPE_DENIED",
          message: "The mTLS client lacks a required narrowing scope.",
          retryable: false,
        });
      }

      const parsedInput = definition.inputSchema.safeParse(
        dispatchInput.input,
      );
      if (!parsedInput.success) {
        return createToolFailure({
          requestId: dispatchInput.context.requestId,
          serverTime,
          code: "INVALID_TOOL_INPUT",
          message: "The tool input does not match its strict schema.",
          retryable: false,
        });
      }

      try {
        const data = await definition.execute(parsedInput.data, {
          requestId: dispatchInput.context.requestId,
          identity: identityResult.data,
          signal: dispatchInput.context.signal,
        });
        assertWorkBuddyRequestActive(
          dispatchInput.context.signal,
        );
        return createToolSuccess({
          requestId: dispatchInput.context.requestId,
          serverTime,
          data,
        });
      } catch (error) {
        if (error instanceof WorkBuddyCollaborationError) {
          return createToolFailure({
            requestId: dispatchInput.context.requestId,
            serverTime,
            code: error.code,
            message: error.message,
            retryable: error.retryable,
          });
        }
        return createToolFailure({
          requestId: dispatchInput.context.requestId,
          serverTime,
          code: "INTERNAL_ERROR",
          message: "The WorkBuddy tool failed without a safe error.",
          retryable: false,
        });
      }
    },
  });
}
