/**
 * Source Profiler — remote AI provider.
 *
 * Dispatches a REDACTED prompt to a remote model via an injected transport
 * (fetch-like). Network egress is sanctioned here (under src/ai/) because the
 * consent ceremony has already passed and only redacted content is sent. The
 * transport is injected so this is unit-testable and so the CLI can choose not
 * to wire one (preview-only) by default.
 */

import type { AiProvider, AiPromptInput, AiSuggestion, AiProviderKind, AiTransport } from "./types";
import { targetEntitySchema, signalFamilySchema } from "../contract/governance";

export type RemoteProviderConfig = {
  kind: Exclude<AiProviderKind, "local">;
  transport: AiTransport;
};

export function createRemoteProvider({ kind, transport }: RemoteProviderConfig): AiProvider {
  return {
    kind,
    async suggest(input: AiPromptInput): Promise<AiSuggestion[]> {
      const prompt = `${input.instruction}\n\n${input.redactedPacketJson}`;
      const raw = await transport(prompt);
      return parseSuggestions(raw);
    },
  };
}

function parseSuggestions(raw: string): AiSuggestion[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: AiSuggestion[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const targetEntity = targetEntitySchema.safeParse(rec.targetEntity);
    const signalFamily = signalFamilySchema.safeParse(rec.signalFamily);
    if (!targetEntity.success || !signalFamily.success) continue;
    if (typeof rec.sourceObjectId !== "string") continue;
    out.push({
      sourceObjectId: rec.sourceObjectId,
      targetEntity: targetEntity.data,
      signalFamily: signalFamily.data,
      reasoning: typeof rec.reasoning === "string" ? rec.reasoning : "",
      confidence: clampConfidence(rec.confidence),
    });
  }
  return out;
}

function clampConfidence(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}
