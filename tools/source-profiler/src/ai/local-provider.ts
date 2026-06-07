/**
 * Source Profiler — local AI provider.
 *
 * An offline, no-network provider: it derives candidate reasoning from the
 * redacted payload deterministically. It exists so the AI overlay can run with
 * zero egress (the safe default) and so tests have a provider without secrets.
 * Output is still advisory: origin "ai", candidate-only.
 */

import type { AiProvider, AiPromptInput, AiSuggestion } from "./types";
import type { SignalFamily, TargetEntity } from "../contract/governance";

type PayloadShape = {
  deterministicCandidates?: Array<{
    sourceObjectId: string;
    targetEntity: TargetEntity;
    signalFamily: SignalFamily;
    confidence: number;
  }>;
};

export function createLocalProvider(): AiProvider {
  return {
    kind: "local",
    async suggest(input: AiPromptInput): Promise<AiSuggestion[]> {
      let payload: PayloadShape;
      try {
        payload = JSON.parse(input.redactedPacketJson) as PayloadShape;
      } catch {
        return [];
      }
      const candidates = payload.deterministicCandidates ?? [];
      return candidates.map((c) => ({
        sourceObjectId: c.sourceObjectId,
        targetEntity: c.targetEntity,
        signalFamily: c.signalFamily,
        // Local hint sits just under the deterministic score to signal advisory.
        confidence: Math.max(0, Math.min(100, c.confidence - 5)),
        reasoning:
          `Local heuristic concurs with the deterministic ${c.targetEntity}/${c.signalFamily} ` +
          `mapping based on the aliased field profile. Advisory only — confirm before use.`,
      }));
    },
  };
}
