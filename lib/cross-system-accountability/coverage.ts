// Coverage is the integrity core (spec §5): a "missing" verdict is only permitted when
// every required source system has a CoverageAssertion proving completeness for the window.
// Otherwise the honest verdict is "unknown" (closed-world assumption does not hold).

import type { CoverageAssertion, ExpectationRule } from "./contracts";

export type CoverageGateResult = {
  complete: boolean;
  satisfiedSystems: string[];
  unprovenSystems: string[]; // missing assertion, or completeness !== "complete", or window not covered
};

function coversWindow(a: CoverageAssertion, windowStart: string, windowEnd: string): boolean {
  return Date.parse(a.windowStart) <= Date.parse(windowStart) && Date.parse(a.windowEnd) >= Date.parse(windowEnd);
}

export function evaluateCoverage(input: {
  rule: ExpectationRule;
  assertions: CoverageAssertion[];
  windowStart: string;
  windowEnd: string;
}): CoverageGateResult {
  const { rule, assertions, windowStart, windowEnd } = input;
  const satisfiedSystems: string[] = [];
  const unprovenSystems: string[] = [];

  for (const system of rule.requiredCoverage) {
    const proof = assertions.find(
      (a) =>
        a.system === system &&
        a.completeness === "complete" &&
        coversWindow(a, windowStart, windowEnd),
    );
    if (proof) satisfiedSystems.push(system);
    else unprovenSystems.push(system);
  }

  return {
    complete: unprovenSystems.length === 0,
    satisfiedSystems,
    unprovenSystems,
  };
}
