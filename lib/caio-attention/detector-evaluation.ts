import type { CaioDetector } from "@/lib/caio-operating-context/contracts";
import type { CaioDetectorRunResult } from "@/lib/caio-operating-context/detector-runner";

/**
 * Positive evaluation records: one row per registered detector per quick-check tick, in the candidate transaction. HIT /
 * NO_HIT are valid judgements; SKIPPED and FAILED are not and break the consecutive-bucket run. A detector without a rule
 * version is recorded with the empty version, which no route rule can list as compatible, so it never suggests a case.
 * Off unless HELM_CAIO_ATTENTION_GENERATOR_ENABLED is exactly "true": off, the quick check writes no evaluation and runs
 * no generator. On, whether suggestions are written is still decided by the intake gate (PAUSED by default).
 */
export const CAIO_ATTENTION_GENERATOR_ENABLED_ENV = "HELM_CAIO_ATTENTION_GENERATOR_ENABLED";

export function isCaioAttentionGeneratorEnabled(): boolean {
  return process.env[CAIO_ATTENTION_GENERATOR_ENABLED_ENV] === "true";
}

export const CAIO_DETECTOR_UNVERSIONED_RULE = "";

export type CaioDetectorEvaluationOutcome = "HIT" | "NO_HIT" | "SKIPPED" | "FAILED";
export type CaioDetectorEvaluationRow = {
  workspaceId: string;
  tickId: string;
  bucketStart: Date;
  detectorId: string;
  ruleVersion: string;
  outcome: CaioDetectorEvaluationOutcome;
  hitMergeKeysJson: string;
};

export function buildCaioDetectorEvaluations(input: Readonly<{
  workspaceId: string;
  tickId: string;
  bucketStart: Date;
  detectors: readonly CaioDetector[];
  run: CaioDetectorRunResult;
}>): CaioDetectorEvaluationRow[] {
  const rows = new Map<string, CaioDetectorEvaluationRow>();
  for (const detector of input.detectors) {
    if (rows.has(detector.detectorId)) continue;
    const evaluated = input.run.evaluated.find((e) => e.detectorId === detector.detectorId);
    const failed = input.run.failed.some((f) => f.detectorId === detector.detectorId);
    const mergeKeys = evaluated ? [...new Set(evaluated.hits.map((hit) => hit.mergeKey))].sort() : [];
    const outcome: CaioDetectorEvaluationOutcome = evaluated ? (mergeKeys.length > 0 ? "HIT" : "NO_HIT") : failed ? "FAILED" : "SKIPPED";
    rows.set(detector.detectorId, {
      workspaceId: input.workspaceId, tickId: input.tickId, bucketStart: input.bucketStart, detectorId: detector.detectorId,
      ruleVersion: detector.ruleVersion ?? CAIO_DETECTOR_UNVERSIONED_RULE, outcome, hitMergeKeysJson: JSON.stringify(mergeKeys),
    });
  }
  return [...rows.values()];
}
