// Expert Capability Feedback Loop v0.1 — deterministic content hashing.
// Pure, dependency-free (node:crypto only). Used to bind PreRegistration declared
// hashes to actual A/B/gold/replay content so a run cannot pass with stale or empty
// hash fields (spec §6 — "replay snapshot must be pinned").

import { createHash } from "node:crypto";
import type { ASet, BSet, PreRegistration } from "./contracts";

// Stable JSON: object keys sorted recursively so equal content hashes equally.
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`)
    .join(",")}}`;
}

export function sha256(input: string): string {
  return `sha256:${createHash("sha256").update(input, "utf8").digest("hex")}`;
}

export function computeASetHash(aSet: ASet): string {
  return sha256(canonicalJson(aSet.cases));
}

export function computeBSetHash(bSet: BSet): string {
  return sha256(canonicalJson(bSet.cases));
}

export function computeGoldLabelsHash(bSet: BSet): string {
  return sha256(canonicalJson(bSet.cases.map((c) => ({ caseId: c.caseId, gold: c.gold }))));
}

// One snapshot hash per B case, in case order, derived from its replayable input ref.
export function computeReplaySnapshotHashes(bSet: BSet): string[] {
  return bSet.cases.map((c) =>
    sha256(canonicalJson({ caseId: c.caseId, inputSnapshotRef: c.inputSnapshotRef })),
  );
}

export function computeReplaySnapshotRootHash(snapshotHashes: string[]): string {
  return sha256(canonicalJson(snapshotHashes));
}

// Self-hash over every pre-registration field except `contentHash`, so that metric,
// baselines, timestamps, model/decode refs, the A/B/gold/replay hashes, and the attempt
// budget become tamper-evident: any post-registration edit breaks this hash.
export function computePreRegistrationContentHash(preRegistration: PreRegistration): string {
  const { contentHash: _omit, ...rest } = preRegistration;
  return sha256(canonicalJson(rest));
}
