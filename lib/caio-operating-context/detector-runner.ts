import { type CaioAnomalySeverity, type CaioDetector, type CaioDetectorHit, type CaioMetricObservationView, parseCaioDetectorHit } from "./contracts";

export type CaioDetectorHitErrorCode = "detector_hit_invalid" | "detector_evidence_outside_inputs";
export type CaioDetectorRunResult = {
  evaluated: { detectorId: string; hits: CaioDetectorHit[] }[];
  skipped: { detectorId: string; reason: "input_unknown" | "input_missing" }[];
  failed: { detectorId: string; reason: "detector_threw" | CaioDetectorHitErrorCode }[];
};

const RANK: Record<CaioAnomalySeverity, number> = { info: 0, warning: 1, critical: 2 };

export function runCaioDetectors(input: {
  detectors: readonly CaioDetector[];
  observations: ReadonlyMap<string, CaioMetricObservationView>;
  now: Date;
}): CaioDetectorRunResult {
  const result: CaioDetectorRunResult = { evaluated: [], skipped: [], failed: [] };
  for (const detector of input.detectors) {
    const inputs = detector.requiredTemplateIds.map((id) => input.observations.get(id));
    if (inputs.some((o) => o === undefined)) { result.skipped.push({ detectorId: detector.detectorId, reason: "input_missing" }); continue; }
    if (inputs.some((o) => o?.status !== "ok")) { result.skipped.push({ detectorId: detector.detectorId, reason: "input_unknown" }); continue; }
    let raw: readonly unknown[];
    try {
      raw = detector.evaluate({ observations: input.observations, now: input.now });
    } catch {
      result.failed.push({ detectorId: detector.detectorId, reason: "detector_threw" });
      continue;
    }
    const merged = new Map<string, CaioDetectorHit>();
    let failure: CaioDetectorHitErrorCode | null = null;
    for (const item of Array.isArray(raw) ? raw : [null]) {
      const parsed = parseCaioDetectorHit(item, detector.requiredTemplateIds);
      if (!parsed.ok) { failure = parsed.errorCode; break; }
      const existing = merged.get(parsed.hit.mergeKey);
      if (!existing || RANK[parsed.hit.severity] > RANK[existing.severity]) merged.set(parsed.hit.mergeKey, parsed.hit);
    }
    // A detector that emits any malformed hit is failed as a whole: no partial adoption.
    if (failure) { result.failed.push({ detectorId: detector.detectorId, reason: failure }); continue; }
    result.evaluated.push({ detectorId: detector.detectorId, hits: [...merged.values()].sort((a, b) => a.mergeKey.localeCompare(b.mergeKey)) });
  }
  return result;
}

export function planCaioCandidateTransitions(input: {
  run: CaioDetectorRunResult;
  openCandidates: readonly { detectorId: string; mergeKey: string }[];
}) {
  const upserts = input.run.evaluated.flatMap(({ detectorId, hits }) => hits.map((hit) => ({ detectorId, hit })));
  const hitKeys = new Set(upserts.map(({ detectorId, hit }) => `${detectorId}|${hit.mergeKey}`));
  const evaluatedIds = new Set(input.run.evaluated.map((e) => e.detectorId));
  // Skipped and failed detectors never clear: unknown is not "resolved".
  const clears = input.openCandidates.filter((c) => evaluatedIds.has(c.detectorId) && !hitKeys.has(`${c.detectorId}|${c.mergeKey}`));
  return { upserts, clears };
}
