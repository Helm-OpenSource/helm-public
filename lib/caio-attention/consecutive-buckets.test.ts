import { describe, expect, it } from "vitest";

import { evaluateCaioAttentionSuggestEligibility, type CaioAttentionEvaluationRecord } from "./consecutive-buckets";
import { CAIO_ATTENTION_TEST_DEFAULT_POLICY as policy } from "./schedule";

const now = new Date("2026-01-05T02:05:00.000Z");
const latest = new Date("2026-01-05T02:00:00.000Z");
const bucket = (minutesBack: number, overrides: Partial<CaioAttentionEvaluationRecord> = {}): CaioAttentionEvaluationRecord => ({
  bucketStart: new Date(latest.getTime() - minutesBack * 60_000), outcome: "HIT", ruleVersion: "v1", hitMergeKeys: ["m:enterprise:ent-a"], ...overrides,
});
const check = (evaluations: CaioAttentionEvaluationRecord[], overrides: Partial<Parameters<typeof evaluateCaioAttentionSuggestEligibility>[0]> = {}) =>
  evaluateCaioAttentionSuggestEligibility({
    intakeOpen: true, applicable: true, severity: "warning", mergeKey: "m:enterprise:ent-a", candidateLastSeenAt: latest,
    latestBucketStart: latest, bucketMinutes: 10, evaluations, compatibleRuleVersions: ["v1"], now, policy, ...overrides,
  });

describe("evaluateCaioAttentionSuggestEligibility", () => {
  it("needs two adjacent HIT buckets for warning and one for critical; T-D5 enterprise mergeKey matches", () => {
    expect(check([bucket(0), bucket(10)])).toEqual({ ok: true });
    expect(check([bucket(0)])).toEqual({ ok: false, reason: "bucket_missing" });
    expect(check([bucket(0)], { severity: "critical" })).toEqual({ ok: true });
  });

  it("T-D1/T-G3: a missing or non-adjacent bucket breaks the run", () => {
    expect(check([bucket(0), bucket(20)])).toEqual({ ok: false, reason: "bucket_missing" });
    expect(check([bucket(0), bucket(10), bucket(10)])).toEqual({ ok: false, reason: "bucket_missing" });
  });

  it("T-D4/T-D2: SKIPPED, FAILED and incompatible rule versions count as UNKNOWN", () => {
    expect(check([bucket(0), bucket(10, { outcome: "SKIPPED" })])).toEqual({ ok: false, reason: "bucket_not_hit" });
    expect(check([bucket(0, { outcome: "FAILED" }), bucket(10)])).toEqual({ ok: false, reason: "bucket_not_hit" });
    expect(check([bucket(0), bucket(10, { ruleVersion: "v0" })])).toEqual({ ok: false, reason: "rule_version_incompatible" });
    expect(check([bucket(0), bucket(10, { hitMergeKeys: ["other"] })])).toEqual({ ok: false, reason: "merge_key_absent" });
  });

  it("T-G4/T-G6: stale evidence, inapplicable time and a closed intake all skip generation", () => {
    const fresh = [bucket(0), bucket(10)];
    expect(check(fresh, { now: new Date(latest.getTime() + 15 * 60_000) })).toEqual({ ok: true });
    expect(check(fresh, { now: new Date(latest.getTime() + 15 * 60_000 + 1) })).toEqual({ ok: false, reason: "evidence_stale" });
    expect(check(fresh, { applicable: false })).toEqual({ ok: false, reason: "not_applicable" });
    expect(check(fresh, { intakeOpen: false })).toEqual({ ok: false, reason: "intake_closed" });
  });
});
