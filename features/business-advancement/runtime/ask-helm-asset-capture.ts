/**
 * Ask Helm interaction asset capture (scaffold)
 *
 * Status: SCAFFOLD ONLY (no production write path activation).
 *
 * Per `docs/product/HELM_OPEN_SOURCE_AND_CLOUD_TRIAL_LAUNCH_PLAN_V1.md`
 * §三 Week 3 #21, Ask Helm interaction observations that the existing
 * planning artefacts (`features/business-advancement/ask-helm-interaction-*`)
 * mark as `eligible_candidate` should be persisted into:
 *
 *   - `MemoryCandidate` (status `PENDING_VERIFICATION`) — review-first
 *   - `SkillSuggestion` (status `OPEN`, formalReviewStatus `NOT_READY`) — review-first
 *
 * Persistence is gated behind the same `BUSINESS_ADVANCEMENT_RUNTIME_ENABLED`
 * + allowlist as the thin-read-model adapter (Phase 3 review V1 §1.1 lists
 * Ask Helm capture as one of the four runtime-eligible items).
 *
 * Today this file ships as a **gated stub**:
 *
 *   1. Always invokes `isBusinessAdvancementRuntimeEnabledForWorkspace`
 *   2. Returns `{ state: "disabled" }` when gated off (the default)
 *   3. When gated on, throws `AskHelmAssetCaptureNotImplementedError`
 *      so the caller falls back to the existing read-first surfaces
 *
 * Wiring the actual writes requires:
 *
 *   - 6 hard prerequisites including redacted live DB calibration
 *   - 5-role Required Reviewer approval
 *   - DPO sign-off on PII / retention boundaries
 *
 * The DPO sign-off is non-negotiable for this surface specifically because
 * Ask Helm captures user prompts; even single-turn capture must avoid
 * persisting raw user content (only structured candidate facts/skills).
 */

import "server-only";

import { isBusinessAdvancementRuntimeEnabledForWorkspace } from "@/lib/feature-flags";
import {
  BusinessAdvancementInvariantViolationError,
  assertSingleWorkspaceScope,
} from "@/lib/business-advancement/invariant-guards";

export class AskHelmAssetCaptureNotImplementedError extends Error {
  constructor() {
    super(
      "ASK_HELM_ASSET_CAPTURE: scaffold is gated on but the production write path is not wired yet; caller must continue without writing candidate.",
    );
    this.name = "AskHelmAssetCaptureNotImplementedError";
  }
}

/**
 * The AssetCaptureInput shape the runtime would receive once wired. Mirrors
 * the eligibility decision made upstream by the planning artefacts; this
 * scaffold stays narrow on purpose.
 */
export type AskHelmAssetCaptureInput = {
  readonly workspaceId: string;
  readonly interactionId: string;
  readonly candidateKind:
    | "repeated_intent"
    | "boundary_hit"
    | "abandoned_high_confidence_answer"
    | "plan_follow_through"
    | "review_packet"
    | "handoff";
  /**
   * Structured candidate fact or skill spec. Must NOT contain raw user
   * prompt text; the upstream eligibility logic has already redacted /
   * compressed the interaction into structured fields.
   */
  readonly candidatePayload: Record<string, unknown>;
  /** Triggering user (workspace member) for audit. */
  readonly triggeringUserId: string | null;
};

export type AskHelmAssetCaptureResult =
  | {
      readonly state: "disabled";
      readonly reason: "flag_off" | "workspace_not_in_allowlist";
    }
  | {
      readonly state: "captured";
      readonly memoryCandidateId: string | null;
      readonly skillSuggestionId: string | null;
    };

/**
 * Forbidden keys: any of these in `candidatePayload` indicates the upstream
 * caller has not redacted properly. The runtime must never persist raw
 * conversation turns.
 */
const FORBIDDEN_PAYLOAD_KEYS: ReadonlySet<string> = new Set([
  "chatHistory",
  "conversationTurns",
  "rawPrompt",
  "rawAnswer",
  "userMessages",
  "assistantMessages",
  "transcriptText",
]);

export function assertNoChatHistoryInPayload(
  payload: Record<string, unknown>,
): void {
  const offenders = Object.keys(payload).filter((key) =>
    FORBIDDEN_PAYLOAD_KEYS.has(key),
  );
  if (offenders.length > 0) {
    throw new BusinessAdvancementInvariantViolationError({
      invariant: "ask_helm_chat_history_persistence",
      message:
        "ASK_HELM_ASSET_CAPTURE: candidatePayload contains keys that look like raw multi-turn chat history; only structured fields are allowed.",
      auditPayload: { offendingKeys: offenders },
    });
  }
}

/**
 * Capture an Ask Helm interaction asset. Today: gated stub.
 *
 * On flag-off → returns `{state: "disabled"}` and the caller continues
 * without persisting. On gated-on → throws `AskHelmAssetCaptureNotImplementedError`
 * (intercepted by the with-fallback helper).
 *
 * Invariant guards still run unconditionally so that mis-shaped inputs
 * surface even in scaffold mode.
 */
export async function captureAskHelmAssetCandidate(
  input: AskHelmAssetCaptureInput,
): Promise<AskHelmAssetCaptureResult> {
  // Defensive guards run before the gating check. If the caller hands a
  // mis-shaped payload, surface that even when the runtime is gated off
  // — that's a programming error, not a configuration choice.
  assertSingleWorkspaceScope({
    requestedWorkspaceId: input.workspaceId,
    observedWorkspaceIds: [input.workspaceId],
  });
  assertNoChatHistoryInPayload(input.candidatePayload);

  if (!isBusinessAdvancementRuntimeEnabledForWorkspace(input.workspaceId)) {
    return {
      state: "disabled",
      reason: process.env.BUSINESS_ADVANCEMENT_RUNTIME_ENABLED
        ? "workspace_not_in_allowlist"
        : "flag_off",
    };
  }

  throw new AskHelmAssetCaptureNotImplementedError();
}

/**
 * Caller-side fallback helper. Returns null on disabled / scaffold; rethrows
 * invariant violations so oncall can react.
 */
export async function captureAskHelmAssetCandidateWithFallback(
  input: AskHelmAssetCaptureInput,
): Promise<AskHelmAssetCaptureResult | null> {
  try {
    return await captureAskHelmAssetCandidate(input);
  } catch (error) {
    if (error instanceof AskHelmAssetCaptureNotImplementedError) {
      return null;
    }
    if (error instanceof BusinessAdvancementInvariantViolationError) {
      throw error;
    }
    throw error;
  }
}
