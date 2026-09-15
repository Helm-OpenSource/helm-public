import { canonicalJson, sha256 } from "@/lib/expert-capability/hashing";

import type { CaioMetricValues } from "./contracts";

export function buildCaioMetricObservationContent(input: {
  templateId: string; domain: string; sourceKey: string;
  windowStart: Date; windowEnd: Date; values: CaioMetricValues; denominator: number | null;
}): { contentHash: string; evidenceRef: string } {
  const contentHash = sha256(canonicalJson({
    templateId: input.templateId, domain: input.domain, sourceKey: input.sourceKey,
    windowStart: input.windowStart.toISOString(), windowEnd: input.windowEnd.toISOString(),
    values: input.values, denominator: input.denominator,
  }));
  return { contentHash, evidenceRef: `caio-metric:${input.templateId}:${contentHash.slice(7, 23)}` };
}

export function summarizeCaioSourceRun(observations: readonly { status: "ok" | "unknown"; contentHash: string | null; evidenceRef: string | null }[]) {
  const known = observations.filter((o) => o.status === "ok" && o.contentHash && o.evidenceRef);
  const completenessPercent = observations.length === 0 ? 0 : Math.round((known.length / observations.length) * 100);
  if (known.length === 0) {
    return { outcome: "failure" as const, freshness: "unknown" as const, completenessPercent: 0, summaryHash: null, evidenceRefs: [], errorCodes: ["metric_unknown"] };
  }
  return {
    outcome: known.length === observations.length ? ("success" as const) : ("partial_success" as const),
    freshness: "fresh" as const,
    completenessPercent,
    summaryHash: sha256(canonicalJson(known.map((o) => o.contentHash).sort())),
    evidenceRefs: known.map((o) => o.evidenceRef as string).sort(),
    errorCodes: known.length === observations.length ? [] : ["metric_unknown"],
  };
}
