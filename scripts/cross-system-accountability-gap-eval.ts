// Offline CLI for the Cross-System Accountability Gap MVP (spec §15). Reads the public-safe
// synthetic scenario and prints decision requests per scenario. No network, no connectors.
//
//   npm run eval:cross-system-accountability-gap

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { detectGaps } from "@/lib/cross-system-accountability/engine";
import type {
  CoverageAssertion,
  EffectiveOwnerPolicy,
  ExpectationRule,
  SourceFact,
} from "@/lib/cross-system-accountability/contracts";

type Scenario = {
  name: string;
  coverageAssertions: CoverageAssertion[];
  triggerFacts: SourceFact[];
  expectationFacts: SourceFact[];
};
type Fixture = {
  now: string;
  rule: ExpectationRule;
  ownerPolicy: EffectiveOwnerPolicy;
  scenarios: Scenario[];
};

function main() {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const fixturePath = path.resolve(here, "..", "templates", "cross-system-accountability", "scenario.sample.json");
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as Fixture;

  for (const scenario of fixture.scenarios) {
    const requests = detectGaps({
      rule: fixture.rule,
      triggerFacts: scenario.triggerFacts,
      expectationFacts: scenario.expectationFacts,
      coverageAssertions: scenario.coverageAssertions,
      ownerPolicy: fixture.ownerPolicy,
      now: fixture.now,
    });
    console.log(`\n[scenario: ${scenario.name}] ${requests.length} decision request(s)`);
    for (const r of requests) {
      const owner = r.effectiveOwner.resolved
        ? `owner=${r.effectiveOwner.ownerId}`
        : `owner=unresolved->${r.effectiveOwner.escalationRoleRef ?? r.effectiveOwner.unresolvableReason}`;
      console.log(
        `  ${r.triggerRef} verdict=${r.verdict} ${owner} crossSystem=${r.crossSystemDependency} review=${r.reviewState}`,
      );
    }
  }
}

main();
