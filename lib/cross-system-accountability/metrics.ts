// Day-1 metrics (spec §10) used to test the kill-lines and moat evidence. Pure functions.

import type { LedgerDecision, Verdict } from "./contracts";

export type GapObservation = {
  requestId: string;
  verdict: Verdict;
  crossSystemDependency: number;
  decision: LedgerDecision;
  falsePositive: boolean;
  firstSeenAt: string;
};

// Kill-line 3 / moat 2. Small samples cannot support a "<10%" claim, so flag sufficiency.
export function falsePositiveRate(gaps: GapObservation[], minSample = 20) {
  const flagged = gaps.filter((g) => g.verdict === "missing");
  const falsePositives = flagged.filter((g) => g.falsePositive).length;
  return {
    flagged: flagged.length,
    falsePositives,
    rate: flagged.length === 0 ? 0 : falsePositives / flagged.length,
    sufficientSample: flagged.length >= minSample,
  };
}

// Moat 1: among confirmed real gaps, share that genuinely needed >=2 systems to detect.
export function crossSystemDependencyShare(gaps: GapObservation[]) {
  const confirmed = gaps.filter(
    (g) => g.verdict === "missing" && g.decision === "accepted" && !g.falsePositive,
  );
  const crossSystem = confirmed.filter((g) => g.crossSystemDependency >= 2).length;
  return {
    confirmed: confirmed.length,
    crossSystem,
    share: confirmed.length === 0 ? 0 : crossSystem / confirmed.length,
  };
}

// Kill-line 2: net-new cross-system gaps per month after the historical backlog is cleared.
export function newGapArrivalRate(input: {
  gaps: GapObservation[];
  windowStart: string;
  windowEnd: string;
}) {
  const { gaps, windowStart, windowEnd } = input;
  const start = Date.parse(windowStart);
  const end = Date.parse(windowEnd);
  const inWindow = gaps.filter((g) => {
    const t = Date.parse(g.firstSeenAt);
    return t >= start && t <= end && g.verdict === "missing";
  });
  const months = Math.max((end - start) / (30 * 24 * 60 * 60 * 1000), 1 / 30);
  return {
    newGaps: inWindow.length,
    perMonth: inWindow.length / months,
  };
}
