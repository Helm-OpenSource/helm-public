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
import { isRemoteProvider } from "./types";
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

  const consent = evaluateAiConsent({ providerKind: input.providerKind, consent: input.consent });
  for (const reason of consent.reasons) add(reason, consent.allowed ? "info" : "warn");
  if (!consent.allowed) {
    add("AI overlay blocked — consent not satisfied; preview only", "warn");
    return { candidates: [], promptPreview, audit };
  }

  const provider = resolveProvider(input);
  if (!provider) {
    add(
      `remote provider "${input.providerKind}" consented but no transport configured; preview only, nothing sent`,
      "warn",
    );
    return { candidates: [], promptPreview, audit };
  }

  let suggestions;
  try {
    suggestions = await provider.suggest(prompt);
  } catch (error) {
    add(`AI provider error: ${(error as Error).message}`, "error");
    return { candidates: [], promptPreview, audit };
  }

  const candidates: SignalMappingCandidate[] = suggestions.map((s) => ({
    id: shortHash(`ai:${s.sourceObjectId}:${s.targetEntity}:${s.signalFamily}`),
    sourceObjectId: s.sourceObjectId,
    targetEntity: s.targetEntity,
    signalFamily: s.signalFamily,
    fieldMappings: [],
    confidence: s.confidence,
    rationale: s.reasoning || "AI suggestion (advisory only).",
    origin: "ai",
    state: "candidate",
    evidenceRefs: [s.sourceObjectId],
  }));
  add(`AI overlay produced ${candidates.length} advisory candidate(s) via "${provider.kind}"`);

  return { candidates, promptPreview, audit };
}

function resolveProvider(input: AiOverlayInput): AiProvider | null {
  if (input.provider) return input.provider;
  if (!isRemoteProvider(input.providerKind)) return createLocalProvider();
  // Remote consented but the CLI wires no transport in v1 → preview only.
  return null;
}
