/**
 * Source Profiler — AI overlay orchestrator.
 *
 * Redacts the packet, runs the consent ceremony, builds a redacted prompt,
 * optionally dispatches to a provider, and maps suggestions to candidate-only
 * mappings (origin "ai"). Returns a prompt preview and an audit trail. If
 * consent fails or no provider/transport is available, returns preview-only
 * with no candidates — never a silent egress.
 */

import type { ReviewPacket } from "../contract/review-packet";
import type { SignalMappingCandidate } from "../contract/mapping";
import type { AuditEntry } from "../contract/run";
import type { AiProvider, AiProviderKind } from "./types";
import { z } from "zod";
import {
  AiProviderResponseError,
  aiSuggestionSchema,
  isRemoteProvider,
} from "./types";
import { redactReviewPacket } from "../review/redact";
import { buildAiPrompt, previewPrompt } from "./prompt";
import { evaluateAiConsent } from "./consent";
import { createLocalProvider } from "./local-provider";
import { shortHash } from "../util/hash";

export type AiOverlayInput = {
  packet: ReviewPacket;
  providerKind: AiProviderKind;
  consent: boolean;
  /** Provider override (e.g. a wired remote provider). Local is created here. */
  provider?: AiProvider;
  now?: () => Date;
};

export type AiOverlayResult = {
  status:
    | "produced"
    | "blocked"
    | "provider_failure"
    | "parse_failure"
    | "schema_failure"
    | "evidence_failure";
  reason: string | null;
  candidates: SignalMappingCandidate[];
  promptPreview: string;
  audit: AuditEntry[];
};

export async function runAiOverlay(input: AiOverlayInput): Promise<AiOverlayResult> {
  const clock = input.now ?? (() => new Date());
  const audit: AuditEntry[] = [];
  const add = (message: string, level: AuditEntry["level"] = "info") =>
    audit.push({ at: clock().toISOString(), phase: "ai_overlay", message, level });

  const redacted = redactReviewPacket(input.packet);
  const prompt = buildAiPrompt(redacted);
  const promptPreview = previewPrompt(prompt);
  add(`built redacted AI prompt (${prompt.redactedPacketJson.length} chars), no row data`);

  // Bind consent to the ACTUAL provider, not just the requested kind. A caller
  // must not smuggle a remote provider in under providerKind:"local".
  if (input.provider && input.provider.kind !== input.providerKind) {
    add(
      `AI overlay blocked — provider kind "${input.provider.kind}" does not match requested "${input.providerKind}"; preview only`,
      "warn",
    );
    return {
      status: "blocked",
      reason: "provider_kind_mismatch",
      candidates: [],
      promptPreview,
      audit,
    };
  }
  const effectiveKind = input.provider?.kind ?? input.providerKind;

  const consent = evaluateAiConsent({ providerKind: effectiveKind, consent: input.consent });
  for (const reason of consent.reasons) add(reason, consent.allowed ? "info" : "warn");
  if (!consent.allowed) {
    add("AI overlay blocked — consent not satisfied; preview only", "warn");
    return {
      status: "blocked",
      reason: "consent_required",
      candidates: [],
      promptPreview,
      audit,
    };
  }

  const provider = resolveProvider(input);
  if (!provider) {
    add(
      `remote provider "${effectiveKind}" consented but no transport configured; preview only, nothing sent`,
      "warn",
    );
    return {
      status: "blocked",
      reason: "provider_not_configured",
      candidates: [],
      promptPreview,
      audit,
    };
  }

  let suggestions;
  try {
    suggestions = await provider.suggest(prompt);
  } catch (error) {
    if (error instanceof AiProviderResponseError) {
      add(`AI provider ${error.failure}: ${error.message}`, "error");
      return {
        status: error.failure,
        reason: error.failure,
        candidates: [],
        promptPreview,
        audit,
      };
    }
    add(`AI provider error: ${(error as Error).message}`, "error");
    return {
      status: "provider_failure",
      reason: "provider_failure",
      candidates: [],
      promptPreview,
      audit,
    };
  }

  const parsedSuggestions = z.array(aiSuggestionSchema).safeParse(suggestions);
  if (!parsedSuggestions.success) {
    add("AI provider schema_failure: suggestion array failed strict validation", "error");
    return {
      status: "schema_failure",
      reason: "schema_failure",
      candidates: [],
      promptPreview,
      audit,
    };
  }

  const objectById = new Map(input.packet.codeScan.objects.map((object) => [object.id, object]));
  if (parsedSuggestions.data.some((suggestion) => !objectById.has(suggestion.sourceObjectId))) {
    add("AI provider evidence_failure: suggestion references an unknown source object", "error");
    return {
      status: "evidence_failure",
      reason: "unknown_source_object",
      candidates: [],
      promptPreview,
      audit,
    };
  }

  const candidates: SignalMappingCandidate[] = parsedSuggestions.data.map((suggestion) => {
    const object = objectById.get(suggestion.sourceObjectId);
    return {
      id: shortHash(
        `ai:${suggestion.sourceObjectId}:${suggestion.targetEntity}:${suggestion.signalFamily}`,
      ),
      sourceObjectId: suggestion.sourceObjectId,
      targetEntity: suggestion.targetEntity,
      signalFamily: suggestion.signalFamily,
      fieldMappings: [],
      confidence: Math.min(suggestion.confidence, object?.parseConfidence ?? 0),
      rationale: suggestion.reasoning,
      origin: "ai",
      state: "candidate",
      evidenceRefs: [suggestion.sourceObjectId],
    };
  });
  add(`AI overlay produced ${candidates.length} advisory candidate(s) via "${provider.kind}"`);

  return {
    status: "produced",
    reason: null,
    candidates,
    promptPreview,
    audit,
  };
}

function resolveProvider(input: AiOverlayInput): AiProvider | null {
  if (input.provider) return input.provider;
  if (!isRemoteProvider(input.providerKind)) return createLocalProvider();
  // Remote consented but the CLI wires no transport in v1 → preview only.
  return null;
}
