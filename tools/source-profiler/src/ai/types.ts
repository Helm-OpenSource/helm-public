/**
 * Source Profiler — AI overlay types.
 *
 * The AI overlay is OPTIONAL and produces *candidate reasoning only*. It is
 * never ground truth: every suggestion becomes a `candidate`-state mapping with
 * `origin: "ai"`. Remote providers are gated by an explicit consent ceremony and
 * only ever see a REDACTED packet (no real names, no row data).
 */

import type { SignalFamily, TargetEntity } from "../contract/governance";

export type AiProviderKind = "local" | "openai" | "anthropic" | "custom";

export function isRemoteProvider(kind: AiProviderKind): boolean {
  return kind !== "local";
}

export type AiPromptInput = {
  instruction: string;
  /** Redacted, shareable JSON — never contains real names or rows. */
  redactedPacketJson: string;
};

export type AiSuggestion = {
  /** DiscoveredObject id (stable hash) the suggestion concerns. */
  sourceObjectId: string;
  targetEntity: TargetEntity;
  signalFamily: SignalFamily;
  /** Free-text reasoning produced by the model. */
  reasoning: string;
  /** 0-100 model-reported confidence. */
  confidence: number;
};

export interface AiProvider {
  readonly kind: AiProviderKind;
  suggest(input: AiPromptInput): Promise<AiSuggestion[]>;
}

/** Transport injected into remote providers (fetch-like), for testability. */
export type AiTransport = (prompt: string) => Promise<string>;
