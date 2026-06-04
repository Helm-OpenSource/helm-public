// Deterministic detection engine (spec §3, §8). No LLM, no IO, no network. Emits review-first
// MissingRecordDecisionRequests. A "missing" verdict is only possible when the required
// (system, scope) coverage is proven complete; otherwise the verdict is "unknown".

import { evaluateCoverage } from "./coverage";
import { resolveEffectiveOwner } from "./owner";
import type {
  CoverageAssertion,
  EffectiveOwnerPolicy,
  ExpectationRule,
  MissingRecordDecisionRequest,
  SourceFact,
} from "./contracts";

const BOUNDARY_NOTE =
  "Cross-system accountability gap, advice only: read-only detection, not a commitment, " +
  "not an approval; no auto-create, dispatch, chase, write-back, or external send. " +
  "跨系统问责真空,仅建议:只读检测,非承诺、非审批,不自动建单/派单/催办/写回/外发。";

export type EngineInput = {
  rule: ExpectationRule;
  triggerFacts: SourceFact[];
  expectationFacts: SourceFact[];
  coverageAssertions: CoverageAssertion[];
  ownerPolicy: EffectiveOwnerPolicy;
  now: string; // ISO timestamp, passed in for deterministic evaluation
};

function distinctSystemsDeclared(rule: ExpectationRule): number {
  return new Set([
    rule.trigger.system,
    rule.expectation.system,
    ...rule.requiredCoverage.map((c) => c.system),
  ]).size;
}

function addDays(iso: string, days: number): number {
  return Date.parse(iso) + days * 24 * 60 * 60 * 1000;
}

export function detectGaps(input: EngineInput): MissingRecordDecisionRequest[] {
  const { rule, triggerFacts, expectationFacts, coverageAssertions, ownerPolicy, now } = input;
  const requests: MissingRecordDecisionRequest[] = [];
  const declaredSystems = distinctSystemsDeclared(rule);

  const triggers = triggerFacts.filter(
    (t) =>
      t.system === rule.trigger.system &&
      t.entity === rule.trigger.entity &&
      t.sliceRef === rule.triggerSlice.scopeRef,
  );

  for (const trigger of triggers) {
    const gapId = `gap:${rule.ruleId}:${trigger.factId}`;
    const requestId = `dr:${rule.ruleId}:${trigger.factId}`;
    const coverage = evaluateCoverage({
      rule,
      assertions: coverageAssertions,
      windowStart: trigger.occurredAt,
      windowEnd: now,
    });
    const coverageRefs = rule.requiredCoverage.map(
      (req) =>
        `coverage:${req.system}:${req.scope}:${
          coverage.satisfied.includes(`${req.system}:${req.scope}`) ? "complete" : "unproven"
        }`,
    );

    // Coverage not provable for this window => honest "unknown", never "missing".
    if (!coverage.complete) {
      requests.push({
        gapId,
        requestId,
        ruleId: rule.ruleId,
        ruleVersion: rule.version,
        triggerRef: `evidence:trigger:${trigger.system}:${trigger.factId}`,
        verdict: "unknown",
        coverageAssertionRefs: coverageRefs,
        effectiveOwner: {
          resolved: false,
          excluded: { group: false, defaultAdmin: false, bot: false, departed: false },
          unresolvableReason: "verdict_unknown_no_owner_resolution",
        },
        evidenceRefs: [
          `evidence:trigger:${trigger.system}:${trigger.factId}`,
          `evidence:coverage-unproven:${coverage.unproven.join(",")}`,
        ],
        distinctSystemsDeclared: declaredSystems,
        commitmentClass: "advice",
        reviewState: "proposed",
        humanReviewerRequired: true,
        boundaryNote: BOUNDARY_NOTE,
      });
      continue;
    }

    // Coverage complete: does the expected record exist in the *right* (system, entity) stream?
    const satisfied = expectationFacts.some(
      (e) =>
        e.system === rule.expectation.system &&
        e.entity === rule.expectation.entity &&
        e.sliceRef === rule.expectation.entity &&
        e.matchValue === trigger.matchValue,
    );
    if (satisfied) continue; // handoff exists -> no finding

    // Not yet due -> no finding yet.
    if (Date.parse(now) < addDays(trigger.occurredAt, rule.expectation.withinDays)) continue;

    // Provable missing record.
    const effectiveOwner = resolveEffectiveOwner({
      candidates: trigger.ownerCandidates ?? [],
      policy: ownerPolicy,
    });

    requests.push({
      gapId,
      requestId,
      ruleId: rule.ruleId,
      ruleVersion: rule.version,
      triggerRef: `evidence:trigger:${trigger.system}:${trigger.factId}`,
      verdict: "missing",
      coverageAssertionRefs: coverageRefs,
      effectiveOwner,
      evidenceRefs: [
        `evidence:trigger:${trigger.system}:${trigger.factId}`,
        `evidence:expectation-absent:${rule.expectation.system}:${rule.expectation.entity}`,
        `evidence:within-days-elapsed:${rule.expectation.withinDays}`,
      ],
      distinctSystemsDeclared: declaredSystems,
      commitmentClass: "advice",
      reviewState: "proposed",
      humanReviewerRequired: true,
      boundaryNote: BOUNDARY_NOTE,
    });
  }

  return requests;
}
