// Expert Capability Feedback Loop v0.1 — enforced requirements shared by the evaluator
// and the validators, so "green" cannot diverge from "actually proven". Each function
// returns rejection reasons (empty = satisfied). Spec §6, §8, §9.2.

import type { ASet, BSet, MetricDefinition, PreRegistration } from "./contracts";
import {
  computeASetHash,
  computeBSetHash,
  computeGoldLabelsHash,
  computeReplaySnapshotHashes,
  computeReplaySnapshotRootHash,
} from "./hashing";

function arraysEqual(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

// F1: declared hashes must equal hashes recomputed from real A/B/gold/replay content,
// and replaySnapshotHashes must cover every B inputSnapshotRef exactly (1:1, in order).
export function verifyContentBindings(input: {
  preRegistration: PreRegistration;
  aSet: ASet;
  bSet: BSet;
}): string[] {
  const { preRegistration: p, aSet, bSet } = input;
  const errors: string[] = [];

  const aHash = computeASetHash(aSet);
  if (p.aCorrectionSetHash !== aHash) errors.push("a_set_hash_mismatch");
  if (aSet.setHash !== aHash) errors.push("a_set_declared_hash_mismatch");

  const bHash = computeBSetHash(bSet);
  if (p.bHeldoutSetHash !== bHash) errors.push("b_set_hash_mismatch");
  if (bSet.setHash !== bHash) errors.push("b_set_declared_hash_mismatch");

  const goldHash = computeGoldLabelsHash(bSet);
  if (p.goldLabelsHash !== goldHash) errors.push("gold_labels_hash_mismatch");
  if (bSet.goldLabelsHash !== goldHash) errors.push("b_set_declared_gold_hash_mismatch");

  const snapshotHashes = computeReplaySnapshotHashes(bSet);
  if (!arraysEqual(p.replaySnapshotHashes, snapshotHashes)) {
    errors.push("replay_snapshot_hashes_do_not_cover_b_cases");
  }
  if (p.replaySnapshotRootHash !== computeReplaySnapshotRootHash(p.replaySnapshotHashes)) {
    errors.push("replay_snapshot_root_hash_mismatch");
  }

  return errors;
}

// F2: weights and minimum margin must make "复利成功" falsifiable.
export function validateMetricDefinition(metric: MetricDefinition): string[] {
  const errors: string[] = [];
  if (!Number.isFinite(metric.w1) || metric.w1 < 0) errors.push("invalid_w1");
  if (!Number.isFinite(metric.w2) || metric.w2 < 0) errors.push("invalid_w2");
  if (Math.abs(metric.w1 + metric.w2 - 1) > 1e-9) errors.push("weights_do_not_sum_to_one");
  if (!Number.isFinite(metric.minMargin) || metric.minMargin <= 0) {
    errors.push("min_margin_not_positive");
  }
  return errors;
}

// F3: B must be non-empty and contain the kinds that make the held-out proof meaningful.
export function validateBComposition(bSet: BSet): string[] {
  const errors: string[] = [];
  if (bSet.cases.length === 0) {
    errors.push("b_set_empty");
    return errors;
  }
  const kinds = new Set(bSet.cases.map((c) => c.kind));
  if (!kinds.has("synthetic_non_self_org")) errors.push("b_set_missing_synthetic_non_self_org");
  if (!kinds.has("boundary_trap")) errors.push("b_set_missing_boundary_trap");
  return errors;
}
