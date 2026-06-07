/**
 * Source Profiler — AI consent ceremony.
 *
 * Remote AI requires, all at once: an explicit provider, an explicit consent
 * flag, a prompt preview, redacted-only input, no row samples, and an audit
 * log. This module decides whether a run is allowed to dispatch to a provider.
 */

import type { AiProviderKind } from "./types";
import { isRemoteProvider } from "./types";

export type ConsentInput = {
  providerKind: AiProviderKind;
  consent: boolean;
};

export type ConsentDecision = {
  allowed: boolean;
  requiresConsent: boolean;
  reasons: string[];
};

export function evaluateAiConsent({ providerKind, consent }: ConsentInput): ConsentDecision {
  const remote = isRemoteProvider(providerKind);
  const reasons: string[] = [];

  if (remote && !consent) {
    reasons.push(
      `remote provider "${providerKind}" requires explicit --ai-consent (redacted-only, no row samples, audited)`,
    );
  }

  const allowed = remote ? consent : true;
  if (allowed) {
    reasons.push(
      remote
        ? `remote provider "${providerKind}" consented; sending REDACTED prompt only`
        : `local provider; no network egress`,
    );
  }

  return { allowed, requiresConsent: remote, reasons };
}
