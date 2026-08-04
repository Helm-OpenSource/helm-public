// CAIO context broker — retrieval failure semantics.
//
// If stored-context retrieval throws or times out, NO stored content is
// attached; the request may still continue on user-submitted inputs alone,
// marked "context_enrichment_skipped". User-submitted inputs and attachments
// ALWAYS go through the full synchronous pipeline; continuation is allowed
// only when every one of them is ALLOW or a reliable REDACT_AND_ALLOW. Any
// unavailable check, unreliable redaction, or DENY_EXTERNAL fails closed with
// the typed error caio_external_release_denied (HTTP 422).
//
// Per-candidate evaluation is not sufficient on its own: a secret split across
// two candidates passes both checks individually. After per-candidate
// evaluation the concatenation of everything that would actually be released
// is re-scanned, and any hard-boundary hit denies the whole release set.

import {
  CaioContextBrokerError,
  CONTEXT_ENRICHMENT_SKIPPED_MARKER,
  detectHardBoundaryHits,
  type ContextEnrichmentSkippedMarker,
} from "@/lib/caio-context-broker/broker-contracts";
import {
  evaluateContextCandidate,
  type ContextCandidateInput,
  type ContextEvaluationResult,
} from "@/lib/caio-context-broker/evaluation-pipeline";

export type StoredContextCandidate = Readonly<{
  candidateId: string;
  input: ContextCandidateInput;
}>;

export type AttachedContextItem = Readonly<{
  candidateId: string;
  /** Content as it may leave the boundary (redacted when applicable). */
  releasableContent: string;
  result: ContextEvaluationResult;
}>;

export type UserSubmittedItem = Readonly<{
  itemId: string;
  input: ContextCandidateInput;
}>;

export type ContextEnrichmentOutcome = Readonly<{
  continuation: "proceed";
  marker: ContextEnrichmentSkippedMarker | null;
  attachedStoredContext: readonly AttachedContextItem[];
  userSubmitted: readonly AttachedContextItem[];
  /**
   * Reason codes from the combined release re-scan (F6). Non-empty means the
   * stored release set was dropped as a whole because the concatenation of
   * what would have been released tripped a hard boundary that no single
   * candidate tripped on its own.
   */
  combinedReleaseDenialReasons: readonly string[];
}>;

/**
 * Distinct reason code for a hard boundary that only exists in the
 * CONCATENATION of the release set (e.g. a PEM key split across two
 * candidates). Emitted as `${COMBINED_RELEASE_DENIED_REASON}:<category>`.
 */
export const COMBINED_RELEASE_DENIED_REASON =
  "combined_release_hard_boundary" as const;

export type ContextEnrichmentDependencies = Readonly<{
  evaluate: typeof evaluateContextCandidate;
  now: () => number;
}>;

const DEFAULT_DEPENDENCIES: ContextEnrichmentDependencies = {
  evaluate: evaluateContextCandidate,
  now: () => Date.now(),
};

const DEFAULT_RETRIEVAL_TIMEOUT_MS = 2_000;

async function withTimeout<T>(
  work: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error("context_retrieval_timeout")),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

function releasable(
  result: ContextEvaluationResult,
  original: string,
): string | null {
  if (result.decision === "ALLOW") return original;
  if (
    result.decision === "REDACT_AND_ALLOW" &&
    result.redactionReliable &&
    result.redactedContent !== undefined
  ) {
    return result.redactedContent;
  }
  return null;
}

/**
 * Cross-candidate re-scan. Per-candidate evaluation cannot see a secret that
 * is split across items, so the release set is re-scanned as a whole: both the
 * newline-joined and the directly-joined concatenation are checked, because a
 * split can fall either side of an item boundary. Any hit fails the WHOLE
 * release set closed.
 */
function scanCombinedRelease(parts: readonly string[]): readonly string[] {
  if (parts.length < 2) return Object.freeze([]);
  const categories = new Set<string>();
  for (const combined of [parts.join("\n"), parts.join("")]) {
    for (const hit of detectHardBoundaryHits(combined)) {
      categories.add(hit.category);
    }
  }
  // A category that already trips on an individual released part cannot be a
  // cross-candidate finding (per-candidate evaluation already cleared it).
  for (const part of parts) {
    for (const hit of detectHardBoundaryHits(part)) {
      categories.delete(hit.category);
    }
  }
  return Object.freeze(
    [...categories].sort().map(
      (category) => `${COMBINED_RELEASE_DENIED_REASON}:${category}`,
    ),
  );
}

export async function enrichContextWithFailureSemantics(input: {
  retrieveStoredContext: () => Promise<readonly StoredContextCandidate[]>;
  retrievalTimeoutMs?: number;
  userSubmitted: readonly UserSubmittedItem[];
  dependencies?: Partial<ContextEnrichmentDependencies>;
}): Promise<ContextEnrichmentOutcome> {
  const dependencies: ContextEnrichmentDependencies = {
    ...DEFAULT_DEPENDENCIES,
    ...input.dependencies,
  };

  // User-submitted inputs first: they always run the full sync pipeline and
  // gate continuation, independent of stored-context retrieval health.
  const userSubmitted: AttachedContextItem[] = [];
  for (const item of input.userSubmitted) {
    let result: ContextEvaluationResult;
    try {
      result = dependencies.evaluate(item.input);
    } catch {
      // A check that is unavailable fails closed.
      throw new CaioContextBrokerError(
        "caio_external_release_denied",
        "A context safety check was unavailable; the request is denied.",
      );
    }
    const content = releasable(result, item.input.content);
    if (content === null) {
      throw new CaioContextBrokerError(
        "caio_external_release_denied",
        "A user-submitted input may not be released externally.",
      );
    }
    userSubmitted.push(
      Object.freeze({
        candidateId: item.itemId,
        releasableContent: content,
        result,
      }),
    );
  }

  // Stored context: failure or timeout attaches nothing and only marks the
  // continuation; it never releases unevaluated content.
  let storedCandidates: readonly StoredContextCandidate[] | null = null;
  try {
    storedCandidates = await withTimeout(
      input.retrieveStoredContext(),
      input.retrievalTimeoutMs ?? DEFAULT_RETRIEVAL_TIMEOUT_MS,
    );
  } catch {
    storedCandidates = null;
  }

  const attachedStoredContext: AttachedContextItem[] = [];
  let marker: ContextEnrichmentSkippedMarker | null =
    storedCandidates === null ? CONTEXT_ENRICHMENT_SKIPPED_MARKER : null;
  if (storedCandidates !== null) {
    for (const candidate of storedCandidates) {
      let result: ContextEvaluationResult;
      try {
        result = dependencies.evaluate(candidate.input);
      } catch {
        // An unavailable check on a stored candidate drops that candidate;
        // it never attaches unevaluated content.
        marker = CONTEXT_ENRICHMENT_SKIPPED_MARKER;
        continue;
      }
      const content = releasable(result, candidate.input.content);
      if (content === null) continue; // DENY_EXTERNAL stored context is never attached.
      attachedStoredContext.push(
        Object.freeze({
          candidateId: candidate.candidateId,
          releasableContent: content,
          result,
        }),
      );
    }
  }

  // Combined release re-scan (fail closed). User-submitted items are the
  // request itself, so a hit that involves them denies the request; a hit that
  // only appears once stored context joins the set drops the whole stored set
  // and marks the continuation.
  const userParts = userSubmitted.map((item) => item.releasableContent);
  if (scanCombinedRelease(userParts).length > 0) {
    throw new CaioContextBrokerError(
      "caio_external_release_denied",
      "The combined user-submitted inputs would release hard-boundary material.",
    );
  }
  let combinedReleaseDenialReasons: readonly string[] = Object.freeze([]);
  const storedParts = attachedStoredContext.map(
    (item) => item.releasableContent,
  );
  const combinedReasons = scanCombinedRelease([...userParts, ...storedParts]);
  if (combinedReasons.length > 0) {
    if (userParts.length > 0) {
      throw new CaioContextBrokerError(
        "caio_external_release_denied",
        "The combined release set would release hard-boundary material.",
      );
    }
    combinedReleaseDenialReasons = combinedReasons;
    attachedStoredContext.length = 0;
    marker = CONTEXT_ENRICHMENT_SKIPPED_MARKER;
  }

  return Object.freeze({
    continuation: "proceed",
    marker,
    attachedStoredContext: Object.freeze(attachedStoredContext),
    userSubmitted: Object.freeze(userSubmitted),
    combinedReleaseDenialReasons,
  });
}
