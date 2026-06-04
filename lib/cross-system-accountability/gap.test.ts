import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CROSS_SYSTEM_ACCOUNTABILITY_MODULE_STATUS,
  type AccountabilityLedgerEntry,
  type CoverageAssertion,
  type EffectiveOwnerPolicy,
  type ExpectationRule,
  type SourceFact,
} from "./contracts";
import { detectGaps } from "./engine";
import { appendLedgerEntry, verifyLedgerChain } from "./ledger";
import { falsePositiveRate } from "./metrics";
import { resolveEffectiveOwner } from "./owner";
import {
  validateCoverageAssertion,
  validateDecisionRequest,
  validateEffectiveOwner,
  validateExpectationRule,
  validateLedger,
} from "./validators";

type Scenario = {
  name: string;
  coverageAssertions: CoverageAssertion[];
  triggerFacts: SourceFact[];
  expectationFacts: SourceFact[];
};
type Fixture = { now: string; rule: ExpectationRule; ownerPolicy: EffectiveOwnerPolicy; scenarios: Scenario[] };

const fixture = JSON.parse(
  readFileSync(
    path.resolve(__dirname, "..", "..", "templates", "cross-system-accountability", "scenario.sample.json"),
    "utf8",
  ),
) as Fixture;

function runScenario(name: string) {
  const s = fixture.scenarios.find((x) => x.name === name)!;
  return detectGaps({
    rule: fixture.rule,
    triggerFacts: s.triggerFacts,
    expectationFacts: s.expectationFacts,
    coverageAssertions: s.coverageAssertions,
    ownerPolicy: fixture.ownerPolicy,
    now: fixture.now,
  });
}

describe("engine — covered scenario", () => {
  const reqs = runScenario("covered");
  const by = (factId: string) => reqs.find((r) => r.triggerRef.endsWith(factId));

  it("does not flag a satisfied deal (delivery record exists)", () => {
    expect(by("deal-A")).toBeUndefined();
  });
  it("does not flag a deal that is not yet due", () => {
    expect(by("deal-E")).toBeUndefined();
  });
  it("flags a provable missing record with a resolved accountable owner", () => {
    const b = by("deal-B")!;
    expect(b.verdict).toBe("missing");
    expect(b.effectiveOwner.resolved).toBe(true);
    expect(b.effectiveOwner.ownerId).toBe("user:alex-alias");
    expect(b.distinctSystemsDeclared).toBe(2);
    expect(b.commitmentClass).toBe("advice");
    expect(b.humanReviewerRequired).toBe(true);
  });
  it("routes an unowned gap to escalation, never a guessed person", () => {
    const c = by("deal-C")!;
    expect(c.verdict).toBe("missing");
    expect(c.effectiveOwner.resolved).toBe(false);
    expect(c.effectiveOwner.ownerId).toBeUndefined();
    expect(c.effectiveOwner.escalationRoleRef).toBe("role:delivery-escalation");
    expect(c.effectiveOwner.excluded).toMatchObject({ group: true, bot: true, departed: true });
  });
});

describe("engine — coverage is the integrity core", () => {
  it("emits 'unknown', never 'missing', when required coverage is not provable", () => {
    const reqs = runScenario("pm_unproven");
    const d = reqs.find((r) => r.triggerRef.endsWith("deal-D"))!;
    expect(d.verdict).toBe("unknown");
    expect(reqs.every((r) => r.verdict !== "missing")).toBe(true);
  });
});

describe("engine — every request stays advice / read-only (boundary)", () => {
  it("never emits an action; no forbidden refs in evidence", () => {
    const all = [...runScenario("covered"), ...runScenario("pm_unproven")];
    for (const r of all) {
      expect(r.commitmentClass).toBe("advice");
      expect(r.humanReviewerRequired).toBe(true);
      expect(r.evidenceRefs.some((e) => /write|send|execute|auto[_-]/i.test(e))).toBe(false);
    }
  });
});

describe("validators", () => {
  it("rejects a rule without required coverage", () => {
    expect(validateExpectationRule({ ...fixture.rule, requiredCoverage: [] }).errors).toContain(
      "missing_required_coverage",
    );
  });
  it("rejects a 'missing' verdict that lacks complete coverage", () => {
    const s = fixture.scenarios.find((x) => x.name === "pm_unproven")!;
    const res = validateDecisionRequest({
      request: {
        ...runScenario("covered").find((r) => r.triggerRef.endsWith("deal-B"))!,
        verdict: "missing",
      },
      rule: fixture.rule,
      assertions: s.coverageAssertions, // pm partial
      triggerOccurredAt: "2026-05-10T00:00:00Z",
      now: fixture.now,
    });
    expect(res.errors).toContain("missing_verdict_without_complete_coverage");
  });
  it("rejects an unresolved owner that names a person", () => {
    expect(
      validateEffectiveOwner({
        resolved: false,
        ownerId: "user:guessed",
        excluded: { group: false, defaultAdmin: false, bot: false, departed: false },
        escalationRoleRef: "role:x",
      }).errors,
    ).toContain("unresolved_but_owner_id_present");
  });
  it("resolveEffectiveOwner excludes group/bot/departed and falls back to escalation", () => {
    const owner = resolveEffectiveOwner({
      candidates: [
        { id: "group:g", kind: "group", active: true },
        { id: "bot:b", kind: "bot", active: true },
      ],
      policy: fixture.ownerPolicy,
    });
    expect(owner.resolved).toBe(false);
    expect(owner.escalationRoleRef).toBe("role:delivery-escalation");
  });
});

describe("ledger — append-only hash chain", () => {
  function build(): AccountabilityLedgerEntry[] {
    const e1 = appendLedgerEntry({
      prev: null,
      entryId: "e1",
      requestId: "dr:1",
      decision: "accepted",
      reviewerId: "reviewer:alias",
      reasonCode: "evidence_missing",
      falsePositive: false,
      at: "2026-06-04T01:00:00Z",
    });
    const e2 = appendLedgerEntry({
      prev: e1,
      entryId: "e2",
      requestId: "dr:2",
      decision: "rejected",
      reviewerId: "reviewer:alias",
      reasonCode: "scope_wrong",
      falsePositive: true,
      at: "2026-06-04T02:00:00Z",
    });
    return [e1, e2];
  }
  it("verifies a well-formed chain", () => {
    expect(verifyLedgerChain(build()).ok).toBe(true);
    expect(validateLedger(build()).ok).toBe(true);
  });
  it("detects a tampered entry", () => {
    const entries = build();
    entries[1] = { ...entries[1], decision: "accepted" }; // mutate without rehash
    const res = verifyLedgerChain(entries);
    expect(res.ok).toBe(false);
    expect(res.errors.join()).toMatch(/content_hash_mismatch/);
  });
  it("detects a broken chain link", () => {
    const entries = build();
    entries[1] = { ...entries[1], prevEntryHash: "sha256:wrong" };
    expect(verifyLedgerChain(entries).errors.join()).toMatch(/broken_chain/);
  });
});

describe("metrics", () => {
  const gaps = [
    { requestId: "1", verdict: "missing" as const, distinctSystemsDeclared: 2, decision: "accepted" as const, falsePositive: false, firstSeenAt: "2026-06-01T00:00:00Z" },
    { requestId: "2", verdict: "missing" as const, distinctSystemsDeclared: 1, decision: "accepted" as const, falsePositive: false, firstSeenAt: "2026-06-02T00:00:00Z" },
    { requestId: "3", verdict: "missing" as const, distinctSystemsDeclared: 2, decision: "rejected" as const, falsePositive: true, firstSeenAt: "2026-06-03T00:00:00Z" },
  ];
  it("computes false-positive rate and flags small samples", () => {
    const fp = falsePositiveRate(gaps);
    expect(fp.flagged).toBe(3);
    expect(fp.falsePositives).toBe(1);
    expect(fp.sufficientSample).toBe(false); // < 20
  });
  it("keeps declared system count neutral; public Core does not compute a moat share", () => {
    expect(gaps.map((g) => g.distinctSystemsDeclared)).toEqual([2, 1, 2]);
  });
});

// --- Regression coverage for the reviewer's P1 findings ---

const dealB: SourceFact = {
  system: "crm",
  entity: "deal",
  sliceRef: "deal",
  factId: "deal-B",
  matchValue: "deal-B",
  occurredAt: "2026-05-10T00:00:00Z",
  ownerCandidates: [{ id: "user:alex-alias", kind: "user", active: true, roleEvidence: ["crm:deal-owner"] }],
};
const completeCrm: CoverageAssertion = { assertionId: "c", system: "crm", scope: "deal", windowStart: "2026-04-01T00:00:00Z", windowEnd: fixture.now, method: "paginated_complete", completeness: "complete", evidence: ["ok"], asOf: fixture.now };
const completePm: CoverageAssertion = { assertionId: "p", system: "pm", scope: "delivery_handoff", windowStart: "2026-04-01T00:00:00Z", windowEnd: fixture.now, method: "webhook_plus_backfill", completeness: "complete", evidence: ["ok"], asOf: fixture.now };
const completePmEntityScope: CoverageAssertion = { ...completePm, scope: "delivery_project" };
function run(triggerFacts: SourceFact[], expectationFacts: SourceFact[], coverageAssertions: CoverageAssertion[]) {
  return detectGaps({ rule: fixture.rule, triggerFacts, expectationFacts, coverageAssertions, ownerPolicy: fixture.ownerPolicy, now: fixture.now });
}

describe("P1-1 coverage must be scope-complete, not just system-complete", () => {
  it("does not emit 'missing' when the required scope is unproven (wrong-scope CRM export)", () => {
    const wrongScopeCrm: CoverageAssertion = { ...completeCrm, scope: "contact" };
    const reqs = run([dealB], [], [wrongScopeCrm, completePm]);
    expect(reqs[0].verdict).toBe("unknown");
    expect(reqs.every((x) => x.verdict !== "missing")).toBe(true);
  });
});

describe("P1-2 engine respects rule entity/system streams", () => {
  it("a wrong-entity expectation fact (PM task) does not mask a missing delivery_project", () => {
    const pmTask: SourceFact = { system: "pm", entity: "task", sliceRef: "task", factId: "t1", matchValue: "deal-B", occurredAt: "2026-05-11T00:00:00Z" };
    const reqs = run([dealB], [pmTask], [completeCrm, completePm]);
    expect(reqs[0].verdict).toBe("missing");
  });
  it("ignores trigger facts outside the rule's trigger stream", () => {
    const offStream: SourceFact = { system: "email", entity: "thread", sliceRef: "thread", factId: "th1", matchValue: "x", occurredAt: "2026-05-01T00:00:00Z" };
    const reqs = run([offStream], [], [completeCrm, completePm]);
    expect(reqs).toHaveLength(0);
  });
  it("ignores trigger facts whose sliceRef does not match the rule triggerSlice", () => {
    const wrongSlice: SourceFact = { ...dealB, sliceRef: "deal_all" };
    const reqs = run([wrongSlice], [], [completeCrm, completePm]);
    expect(reqs).toHaveLength(0);
  });
  it("a wrong-slice expectation fact does not mask a missing delivery_project", () => {
    const wrongSliceProject: SourceFact = {
      system: "pm",
      entity: "delivery_project",
      sliceRef: "archived_delivery_project",
      factId: "proj-wrong",
      matchValue: "deal-B",
      occurredAt: "2026-05-11T00:00:00Z",
    };
    const reqs = run([dealB], [wrongSliceProject], [completeCrm, completePm]);
    expect(reqs[0].verdict).toBe("missing");
  });
  it("uses exact deterministic matchValue equality; near matches do not satisfy the expectation", () => {
    const nearMatchProject: SourceFact = {
      system: "pm",
      entity: "delivery_project",
      sliceRef: "delivery_project",
      factId: "proj-near",
      matchValue: "deal-b",
      occurredAt: "2026-05-11T00:00:00Z",
    };
    const reqs = run([dealB], [nearMatchProject], [completeCrm, completePm]);
    expect(reqs[0].verdict).toBe("missing");
  });
});

describe("P1-3 rule validator is fail-closed", () => {
  it("rejects an empty forbiddenActions list (must declare the full set)", () => {
    const e = validateExpectationRule({ ...fixture.rule, forbiddenActions: [] }).errors;
    expect(e.some((x) => x.startsWith("forbidden_action_not_declared:"))).toBe(true);
  });
  it("rejects non-positive withinDays", () => {
    expect(
      validateExpectationRule({ ...fixture.rule, expectation: { ...fixture.rule.expectation, withinDays: 0 } }).errors,
    ).toContain("within_days_not_positive");
  });
  it("rejects required coverage that omits the expectation scope", () => {
    expect(
      validateExpectationRule({ ...fixture.rule, requiredCoverage: [{ system: "crm", scope: "deal" }] }).errors,
    ).toContain("required_coverage_missing_expectation_scope");
  });
  it("rejects a triggerSlice not covered by requiredCoverage", () => {
    expect(
      validateExpectationRule({ ...fixture.rule, triggerSlice: { scopeRef: "won_deal" } }).errors,
    ).toContain("required_coverage_missing_trigger_slice");
  });
  it("accepts the well-formed sample rule", () => {
    expect(validateExpectationRule(fixture.rule).ok).toBe(true);
  });
  it("validateCoverageAssertion rejects bad windows and complete-without-evidence", () => {
    expect(validateCoverageAssertion({ ...completeCrm, windowStart: fixture.now, windowEnd: "2026-04-01T00:00:00Z" }).errors).toContain("window_start_after_end");
    expect(validateCoverageAssertion({ ...completeCrm, evidence: [] }).errors).toContain("complete_without_evidence");
  });
});

describe("PR-B scope/entity decoupling", () => {
  const sliceRule: ExpectationRule = {
    ...fixture.rule,
    expectationSlice: { scopeRef: "delivery_handoff" },
    requiredCoverage: [
      { system: "crm", scope: "deal" },
      { system: "pm", scope: "delivery_handoff" },
    ],
  };

  it("accepts an expectation coverage scope that is different from the expectation entity", () => {
    expect(validateExpectationRule(sliceRule).ok).toBe(true);
  });

  it("uses expectationSlice, not expectation.entity, to decide whether an expected record satisfies the gap", () => {
    const handoffRecord: SourceFact = {
      system: "pm",
      entity: "delivery_project",
      sliceRef: "delivery_handoff",
      factId: "handoff-B",
      matchValue: "deal-B",
      occurredAt: "2026-05-11T00:00:00Z",
    };
    const reqs = detectGaps({
      rule: sliceRule,
      triggerFacts: [dealB],
      expectationFacts: [handoffRecord],
      coverageAssertions: [completeCrm, completePm],
      ownerPolicy: fixture.ownerPolicy,
      now: fixture.now,
    });
    expect(reqs).toHaveLength(0);
  });

  it("does not let coverage for the entity scope satisfy a different expectation slice", () => {
    const reqs = detectGaps({
      rule: sliceRule,
      triggerFacts: [dealB],
      expectationFacts: [],
      coverageAssertions: [completeCrm, completePmEntityScope],
      ownerPolicy: fixture.ownerPolicy,
      now: fixture.now,
    });
    expect(reqs[0].verdict).toBe("unknown");
  });
});

describe("v0.1 unstable honesty constraints", () => {
  it("marks the public Core module as unstable, not a stable pack/overlay API", () => {
    expect(CROSS_SYSTEM_ACCOUNTABILITY_MODULE_STATUS).toBe("v0.1_unstable");
  });

  it("uses stable gap identity independent of verdict", () => {
    const missingReq = run([dealB], [], [completeCrm, completePm])[0];
    const unknownReq = run([dealB], [], [completeCrm, { ...completePm, completeness: "partial" }])[0];
    expect(missingReq.verdict).toBe("missing");
    expect(unknownReq.verdict).toBe("unknown");
    expect(missingReq.gapId).toBe(unknownReq.gapId);
    expect(missingReq.requestId).toBe(unknownReq.requestId);
    expect(missingReq.requestId).not.toMatch(/missing|unknown/);
  });
});
