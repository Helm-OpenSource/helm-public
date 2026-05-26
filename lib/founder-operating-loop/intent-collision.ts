/**
 * Helm — Founder Operating Loop intent-collision heuristic.
 *
 * Pure forward-compat utility. No DB, no schema, no runtime adoption.
 *
 * Phase 3 implementation contract §9 (OQ-P3-G confirmed) specifies:
 *   - Heuristic stub v1: same owner + Jaccard overlap of Evidence
 *     Bundle refs ≥ 0.5 + within last 7 days
 *   - On positive fire: produce an `IntentCollisionFlag` carrying the
 *     manual ActionItem id, the overlap ratio, the heuristic version,
 *     and optional CEO verdict
 *   - On negative fire: return null; the Founder Loop ActionItem is
 *     written normally
 *
 * This module is intentionally pure: it does not read the manual
 * ActionItem table. Callers must pass a pre-filtered set of
 * candidates (owner-scoped, last 7 days). That keeps the data-access
 * and the heuristic separable for tests and for future heuristic
 * versions.
 *
 * Public boundary anchor:
 *   docs/product/HELM_FOUNDER_OPERATING_LOOP_BOUNDARY_BRIEF.md
 */

import type { EvidenceBundle, EvidenceRef } from "./contract";

export const INTENT_COLLISION_HEURISTIC_VERSION = "v1" as const;
export const INTENT_COLLISION_OVERLAP_THRESHOLD = 0.5;
export const INTENT_COLLISION_LOOKBACK_DAYS = 7;

export type IntentCollisionCeoVerdict =
  | "keep_both"
  | "dedupe"
  | "cancel_founder_loop_row"
  | "cancel_manual_row";

export interface IntentCollisionCandidate {
  readonly manualActionItemId: string;
  readonly ownerUserId: string;
  readonly evidenceBundle: EvidenceBundle;
  readonly createdAt: Date;
}

export interface IntentCollisionFlag {
  readonly collidedWithActionItemId: string;
  readonly evidenceOverlapRatio: number;
  readonly heuristicVersion: string;
  readonly ceoVerdict?: IntentCollisionCeoVerdict;
}

/**
 * Compute Jaccard overlap on `${type}:${snippetHash}` keys.
 * Returns 0 when both bundles are empty (no overlap, no intent).
 */
export function computeEvidenceOverlapRatio(
  a: EvidenceBundle,
  b: EvidenceBundle,
): number {
  if (a.length === 0 && b.length === 0) return 0;
  const aKeys = new Set(a.map(evidenceRefKey));
  const bKeys = new Set(b.map(evidenceRefKey));
  let intersection = 0;
  for (const key of aKeys) {
    if (bKeys.has(key)) intersection += 1;
  }
  const union = aKeys.size + bKeys.size - intersection;
  if (union === 0) return 0;
  return intersection / union;
}

function evidenceRefKey(ref: EvidenceRef): string {
  return `${ref.type}:${ref.snippetHash}`;
}

export interface DetectIntentCollisionInput {
  readonly proposed: {
    readonly ownerUserId: string;
    readonly evidenceBundle: EvidenceBundle;
  };
  readonly recentManualCandidates: readonly IntentCollisionCandidate[];
  readonly now: Date;
  readonly overlapThreshold?: number;
  readonly lookbackDays?: number;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Run the v1 intent-collision heuristic.
 *
 * Returns the first candidate that passes all three checks, paired
 * with an `IntentCollisionFlag` ready to attach to the proposed
 * Founder Loop ActionItem's metadata. Returns null if no candidate
 * matches.
 *
 * Caller responsibility: `recentManualCandidates` should already be
 * scoped to the right owner and lookback window. This function
 * re-applies both checks defensively, but the cheaper / more
 * efficient pre-filter at the data layer is the caller's contract.
 */
export function detectIntentCollision(
  input: DetectIntentCollisionInput,
): IntentCollisionFlag | null {
  const overlapThreshold =
    input.overlapThreshold ?? INTENT_COLLISION_OVERLAP_THRESHOLD;
  const lookbackDays =
    input.lookbackDays ?? INTENT_COLLISION_LOOKBACK_DAYS;
  const lookbackMs = lookbackDays * ONE_DAY_MS;
  for (const c of input.recentManualCandidates) {
    if (c.ownerUserId !== input.proposed.ownerUserId) continue;
    const ageMs = input.now.getTime() - c.createdAt.getTime();
    if (ageMs < 0 || ageMs > lookbackMs) continue;
    const overlap = computeEvidenceOverlapRatio(
      input.proposed.evidenceBundle,
      c.evidenceBundle,
    );
    if (overlap >= overlapThreshold) {
      return {
        collidedWithActionItemId: c.manualActionItemId,
        evidenceOverlapRatio: overlap,
        heuristicVersion: INTENT_COLLISION_HEURISTIC_VERSION,
      };
    }
  }
  return null;
}
