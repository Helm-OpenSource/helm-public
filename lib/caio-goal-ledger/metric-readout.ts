import type { NorthstarKpi } from "@/lib/shell/northstar-kpi";

import type { CaioGoalLedgerDocument } from "./contracts";

/**
 * Goal readouts: pure projection of a verified ledger document onto the northstar KPI readouts, no IO.
 *
 * A metric with no source never reads as zero. A source readout is used as it is only when its key and unit match
 * the ledger; otherwise the metric is `pending_source` with no value and a note. A source that measured 0 shows 0.
 */

type Goal = CaioGoalLedgerDocument["goals"][number];

export type CaioGoalReadout = Readonly<{
  goalKey: string;
  kind: Goal["kind"];
  title: string;
  standard: string;
  /** `pinned` when the ledger seals a digest of the private line, `unset` when no line is set yet. */
  threshold: Readonly<{ ref: string; sha256: string | null; state: "unset" | "pinned" }> | null;
  componentKeys: readonly string[];
  metrics: readonly NorthstarKpi[];
}>;

const PENDING_SOURCE_NOTE = {
  unsourced: { zh: "尚未接入读数来源", en: "No readout source is connected yet" },
  unit_mismatch: { zh: "读数来源的单位与台账不符", en: "The readout source reports another unit than the ledger" },
};

/**
 * `kpis` is the conformance-filtered output of resolveShellNorthstarKpis, so every metric taken from it already
 * passes validateNorthstarKpis; every metric built here passes it by construction. The ledger keeps labels in both
 * languages and a readout carries one, hence `english`.
 */
export function projectCaioGoalReadouts(
  document: CaioGoalLedgerDocument,
  kpis: ReadonlyArray<NorthstarKpi>,
  english: boolean,
): CaioGoalReadout[] {
  const lang = english ? "en" : "zh";
  return document.goals.map((goal): CaioGoalReadout => ({
    goalKey: goal.key,
    kind: goal.kind,
    title: goal.title,
    standard: goal.standard,
    threshold: goal.threshold && { ...goal.threshold, state: goal.threshold.sha256 === null ? "unset" : "pinned" },
    componentKeys: goal.componentKeys,
    metrics: goal.metrics.map((metric): NorthstarKpi => {
      // First match wins, as in the cross-source merge.
      const source = kpis.find((kpi) => kpi.key === metric.key);
      if (source?.unit === metric.unit) return source;
      return {
        key: metric.key, label: metric.label[lang], status: "pending_source", unit: metric.unit, value: null,
        bandLabel: null, direction: metric.direction, href: null, basisRef: metric.basisRef,
        pendingSourceNote: PENDING_SOURCE_NOTE[source ? "unit_mismatch" : "unsourced"][lang],
      };
    }),
  }));
}

/**
 * Compares the digest a readout source echoes for the line it evaluated against the digest the ledger seals.
 * Any disagreement is `mismatch`, including an echo for a goal without a line and no echo for a goal with one; a
 * `mismatch` readout is never a measurement against the line.
 */
export function evaluateCaioGoalThresholdEcho(
  threshold: Goal["threshold"],
  echoedSha256: string | null,
): "unset" | "match" | "mismatch" {
  const sealed = threshold?.sha256 ?? null;
  if (sealed === null) return echoedSha256 === null ? "unset" : "mismatch";
  return echoedSha256 === sealed ? "match" : "mismatch";
}
