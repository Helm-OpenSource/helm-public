// Coverage is the integrity core (spec §5). A "missing" verdict is only permitted when every
// required (system, scope) closed world is proven complete for the window. Proving a different
// scope of the same system (e.g. CRM contacts) does NOT prove the required scope (CRM deals).

import type { CoverageAssertion, ExpectationRule } from "./contracts";

export type CoverageGateResult = {
  complete: boolean;
  satisfied: string[]; // "system:scope"
  unproven: string[]; // "system:scope" lacking a complete, window-covering assertion
};

function coversWindow(a: CoverageAssertion, windowStart: string, windowEnd: string): boolean {
  return (
    Date.parse(a.windowStart) <= Date.parse(windowStart) &&
    Date.parse(a.windowEnd) >= Date.parse(windowEnd)
  );
}

export function evaluateCoverage(input: {
  rule: ExpectationRule;
  assertions: CoverageAssertion[];
  windowStart: string;
  windowEnd: string;
}): CoverageGateResult {
  const { rule, assertions, windowStart, windowEnd } = input;
  const satisfied: string[] = [];
  const unproven: string[] = [];

  for (const req of rule.requiredCoverage) {
    const key = `${req.system}:${req.scope}`;
    const proof = assertions.find(
      (a) =>
        a.system === req.system &&
        a.scope === req.scope &&
        a.completeness === "complete" &&
        coversWindow(a, windowStart, windowEnd),
    );
    if (proof) satisfied.push(key);
    else unproven.push(key);
  }

  return { complete: unproven.length === 0, satisfied, unproven };
}
