/**
 * Source Profiler — AI overlay types.
 *
 * The AI overlay is OPTIONAL and produces *candidate reasoning only*. It is
 * never ground truth: every suggestion becomes a `candidate`-state mapping with
 * `origin: "ai"`. Remote providers are gated by an explicit consent ceremony and
 * only ever see a REDACTED packet (no real names, no row data).
 */

import { z } from "zod";

import {
  signalFamilySchema,
  targetEntitySchema,
} from "../contract/governance";

export type AiProviderKind = "local" | "openai" | "anthropic" | "custom";

export function isRemoteProvider(kind: AiProviderKind): boolean {
  return kind !== "local";
}

export type AiPromptInput = {
  instruction: string;
  /** Redacted, shareable JSON — never contains real names or rows. */
  redactedPacketJson: string;
};

export const aiSuggestionSchema = z
  .object({
    /** DiscoveredObject id (stable hash) the suggestion concerns. */
    sourceObjectId: z.string().min(1),
    targetEntity: targetEntitySchema,
    signalFamily: signalFamilySchema,
    /** Free-text reasoning produced by the model. */
    reasoning: z.string().min(1),
    /** 0-100 model-reported confidence. */
    confidence: z.number().int().min(0).max(100),
  })
  .strict();
export type AiSuggestion = z.infer<typeof aiSuggestionSchema>;

export type AiProviderResponseFailure = "parse_failure" | "schema_failure";

export class AiProviderResponseError extends Error {
  readonly failure: AiProviderResponseFailure;

  constructor(failure: AiProviderResponseFailure, message: string) {
    super(message);
    this.name = "AiProviderResponseError";
    this.failure = failure;
  }
}

export interface AiProvider {
  readonly kind: AiProviderKind;
  suggest(input: AiPromptInput): Promise<AiSuggestion[]>;
}

/** Transport injected into remote providers (fetch-like), for testability. */
export type AiTransport = (prompt: string) => Promise<string>;
