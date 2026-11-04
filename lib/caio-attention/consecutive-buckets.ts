import type { CaioAttentionSeverity } from "./contracts";
import type { CaioAttentionPolicy } from "./schedule";

/**
 * Generation eligibility from detector evaluation records. The latest N adjacent quick-check buckets must
 * each hold a HIT that names this mergeKey under a compatible rule version. A missing record, SKIPPED,
 * FAILED or an incompatible version is UNKNOWN and breaks the run. Adjacent HIT buckets only prove that
 * consecutive judgements hit, not that the anomaly lasted N buckets.
 */

export type CaioAttentionEvaluationRecord = Readonly<{
  bucketStart: Date;
  outcome: "HIT" | "NO_HIT" | "SKIPPED" | "FAILED";
  ruleVersion: string;
  hitMergeKeys: readonly string[];
}>;

export type CaioAttentionSuggestBlock =
  | "intake_closed" | "not_applicable" | "evidence_stale"
  | "bucket_missing" | "bucket_not_hit" | "merge_key_absent" | "rule_version_incompatible";

export function evaluateCaioAttentionSuggestEligibility(input: Readonly<{
  intakeOpen: boolean;
  applicable: boolean; // the static rule's applicableAt(now), evaluated again at generation time
  severity: CaioAttentionSeverity;
  mergeKey: string;
  candidateLastSeenAt: Date;
  latestBucketStart: Date;
  bucketMinutes: number;
  evaluations: readonly CaioAttentionEvaluationRecord[];
  compatibleRuleVersions: readonly string[];
  now: Date;
  policy: CaioAttentionPolicy;
}>): { ok: true } | { ok: false; reason: CaioAttentionSuggestBlock } {
  if (!input.intakeOpen) return { ok: false, reason: "intake_closed" };
  if (!input.applicable) return { ok: false, reason: "not_applicable" };
  if (input.now.getTime() - input.candidateLastSeenAt.getTime() > input.policy.maxEvidenceAgeMinutes * 60_000) {
    return { ok: false, reason: "evidence_stale" };
  }
  const byBucket = new Map<number, CaioAttentionEvaluationRecord[]>();
  for (const record of input.evaluations) {
    byBucket.set(record.bucketStart.getTime(), [...(byBucket.get(record.bucketStart.getTime()) ?? []), record]);
  }
  const bucketMs = input.bucketMinutes * 60_000;
  for (let i = 0; i < input.policy.consecutiveBuckets[input.severity]; i += 1) {
    const records = byBucket.get(input.latestBucketStart.getTime() - i * bucketMs) ?? [];
    if (records.length !== 1) return { ok: false, reason: "bucket_missing" }; // absent, or ambiguous
    const [record] = records;
    if (record.outcome !== "HIT") return { ok: false, reason: "bucket_not_hit" };
    if (!input.compatibleRuleVersions.includes(record.ruleVersion)) return { ok: false, reason: "rule_version_incompatible" };
    if (!record.hitMergeKeys.includes(input.mergeKey)) return { ok: false, reason: "merge_key_absent" };
  }
  return { ok: true };
}
