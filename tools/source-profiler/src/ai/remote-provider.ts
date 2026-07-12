/**
 * Source Profiler — remote AI provider.
 *
 * Dispatches a REDACTED prompt to a remote model via an injected transport
 * (fetch-like). Network egress is sanctioned here (under src/ai/) because the
 * consent ceremony has already passed and only redacted content is sent. The
 * transport is injected so this is unit-testable and so the CLI can choose not
 * to wire one (preview-only) by default.
 */

import { z } from "zod";

import {
  AiProviderResponseError,
  aiSuggestionSchema,
  type AiProvider,
  type AiPromptInput,
  type AiSuggestion,
  type AiProviderKind,
  type AiTransport,
} from "./types";

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

export function parseSuggestions(raw: string): AiSuggestion[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new AiProviderResponseError("parse_failure", "provider response is not valid JSON");
  }

  const result = z.array(aiSuggestionSchema).safeParse(parsed);
  if (!result.success) {
    throw new AiProviderResponseError(
      "schema_failure",
      "provider response does not match the strict suggestion schema",
    );
  }
  return result.data;
}
