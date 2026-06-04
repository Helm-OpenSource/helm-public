import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ASet, BSet, PreRegistration, RunInput } from "./contracts";
import { evaluate, evidenceCompleteness } from "./evaluator";
import {
  validateEvalCasePromotion,
  validateEvaluationRun,
  validateExpertRevision,
  validateJudgementPacket,
  validatePreRegistration,
} from "./validators";

const packsDir = path.resolve(__dirname, "..", "..", "templates", "expert-capability", "packs");
function loadJson<T>(name: string): T {
  return JSON.parse(readFileSync(path.join(packsDir, name), "utf8")) as T;
}
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function fixtures() {
  return {
    preRegistration: loadJson<PreRegistration>("pre-registration.json"),
    runInput: loadJson<RunInput>("run-input.json"),
    aSet: loadJson<ASet>("a-correction-set.json"),
    bSet: loadJson<BSet>("b-heldout-eval-set.json"),
  };
}

describe("expert capability feedback loop — green path", () => {
  it("reports loop_compounding=success and expert_justified=pass on the sample packs", () => {
    const report = evaluate(fixtures());
    expect(report.invariantViolations).toEqual([]);
    expect(report.hardGateFailures).toEqual([]);
    expect(report.aRegression).toEqual([]);
    expect(report.candidate.boundaryCorrectness).toBe(100);
    expect(report.candidate.weighted).toBeGreaterThan(
      report.previous.weighted + report.minMargin,
    );
    expect(report.candidate.weighted).toBeGreaterThan(report.ruleBaseline.weighted);
    expect(report.loopCompoundingDecision).toBe("success");
    expect(report.expertJustifiedDecision).toBe("pass");
  });
});

describe("§16.4 #1 A/B overlap", () => {
  it("pre-registration validator rejects overlapping A and B case ids", () => {
    const f = fixtures();
    f.bSet.cases[0].caseId = f.aSet.cases[0].caseId;
    expect(validatePreRegistration(f).errors).toContain("a_b_overlap");
    expect(evaluate(f).loopCompoundingDecision).toBe("fail");
  });
});

describe("§16.4 #2 gold lock ordering", () => {
  it("rejects gold locked after candidate revision creation", () => {
    const f = fixtures();
    f.preRegistration.goldLockedAt = "2026-06-04T03:30:00Z"; // after candidate 03:00
    expect(validatePreRegistration(f).errors).toContain("gold_lock_after_candidate_creation");
    expect(evaluate(f).invariantViolations).toContain(
      "gold_locked_not_before_candidate_creation",
    );
    expect(evaluate(f).loopCompoundingDecision).toBe("fail");
  });
});

describe("§16.4 #3 attempt budget", () => {
  it("rejects an attempt beyond the budget", () => {
    const f = fixtures();
    f.runInput.attemptNumber = 2; // budget is 1
    expect(
      validateEvaluationRun({
        preRegistration: f.preRegistration,
        runInput: f.runInput,
        candidateWeighted: 1,
        ruleBaselineWeighted: 0.5,
        boundaryCorrectness: 100,
        loopCompoundingDecision: "success",
        expertJustifiedDecision: "pass",
        hardGateFailures: [],
      }).errors,
    ).toContain("attempt_budget_exceeded");
    expect(evaluate(f).invariantViolations).toContain("attempt_budget_exceeded");
  });
});

describe("§16.4 #4 consumed B reuse across candidates", () => {
  it("rejects a B already consumed by a different candidate", () => {
    const f = fixtures();
    f.runInput.bSetConsumedByRevisionIds = ["oh-expert-vX-other"];
    expect(
      validateEvaluationRun({
        preRegistration: f.preRegistration,
        runInput: f.runInput,
        candidateWeighted: 1,
        ruleBaselineWeighted: 0.5,
        boundaryCorrectness: 100,
        loopCompoundingDecision: "success",
        expertJustifiedDecision: "pass",
        hardGateFailures: [],
      }).errors,
    ).toContain("consumed_b_reused_by_later_candidate");
    expect(evaluate(f).loopCompoundingDecision).toBe("fail");
  });
});

describe("§16.4 #5 hard gate veto (not masked by weighted score)", () => {
  it("fails loop_compounding when a candidate output breaches the boundary, despite a winning score", () => {
    const f = fixtures();
    // Make the candidate over-reach on the boundary-trap case.
    const trap = f.bSet.cases.find((c) => c.kind === "boundary_trap")!;
    trap.outputs.candidate.commitmentClass = "commitment";
    trap.outputs.candidate.forbiddenActionRefs = ["auto_reassign"];
    const report = evaluate(f);
    expect(report.hardGateFailures.length).toBeGreaterThan(0);
    expect(report.loopCompoundingDecision).toBe("fail");
  });
});

describe("§16.4 #6 strong baseline presence", () => {
  it("rejects a pre-registration missing the deterministic rule baseline", () => {
    const f = fixtures();
    f.preRegistration.deterministicRuleBaselineRef = "";
    expect(validatePreRegistration(f).errors).toContain("missing_rule_baseline");
  });
});

describe("§16.4 #7 independent evidence completeness scoring", () => {
  const gold = {
    disposition: "x",
    relevantEvidence: ["e1", "e2", "e3", "e4"],
    availableEvidence: ["e1", "e2", "e3", "e4", "e5"],
    boundaryExpectation: "advice_only",
  };
  it("ignores an available-but-irrelevant stuffed ref (cannot raise the score)", () => {
    expect(evidenceCompleteness(gold, ["e1", "e2", "e3", "e4"]).score).toBe(1);
    expect(evidenceCompleteness(gold, ["e1", "e2", "e3", "e4", "e5"]).score).toBe(1);
    expect(evidenceCompleteness(gold, ["e1", "e2"]).score).toBe(0.5);
  });
  it("flags a hallucinated ref not present in available evidence", () => {
    const r = evidenceCompleteness(gold, ["e1", "e2", "made-up-ref"]);
    expect(r.hallucinatedRefs).toContain("made-up-ref");
  });
});

describe("§16.4 #8 feedback-to-revision direction", () => {
  it("FeedbackRecord carries no resultingExpertRevisionId; ExpertRevision back-references feedback", () => {
    const f = fixtures();
    const fb = f.aSet.cases[0].feedback as Record<string, unknown>;
    expect(fb).not.toHaveProperty("resultingExpertRevisionId");
    expect(
      validateExpertRevision({
        revision: {
          revisionId: "oh-expert-v1",
          parentRevisionId: "oh-expert-v0",
          derivedFromFeedbackIds: [fb.feedbackId as string],
          status: "active",
        },
        knownFeedbackIds: [fb.feedbackId as string],
      }).ok,
    ).toBe(true);
  });
  it("rejects a revision derived from unknown feedback", () => {
    expect(
      validateExpertRevision({
        revision: {
          revisionId: "r",
          parentRevisionId: null,
          derivedFromFeedbackIds: ["ghost-feedback"],
          status: "active",
        },
        knownFeedbackIds: ["fb-0001"],
      }).errors,
    ).toContain("revision_derived_from_unknown_feedback:ghost-feedback");
  });
});

describe("§16.4 #9 de-id quarantine", () => {
  it("rejects a public-eligible promotion without scanner + human signoff", () => {
    expect(
      validateEvalCasePromotion({
        promotionId: "p",
        sourceCaseId: "c",
        sourceSensitivityClass: "operational",
        scannerResult: { hits: 2 },
        humanSignOffBy: null,
        humanSignOffAt: null,
        publicEligible: true,
        walledFromPerformanceEval: true,
        quarantineReason: null,
      }).errors,
    ).toEqual(
      expect.arrayContaining([
        "public_eligible_without_clean_scan",
        "public_eligible_without_human_signoff",
      ]),
    );
  });
  it("requires a quarantine reason when not eligible", () => {
    expect(
      validateEvalCasePromotion({
        promotionId: "p",
        sourceCaseId: "c",
        sourceSensitivityClass: "operational",
        scannerResult: { hits: 1 },
        humanSignOffBy: null,
        humanSignOffAt: null,
        publicEligible: false,
        walledFromPerformanceEval: true,
        quarantineReason: null,
      }).errors,
    ).toContain("not_eligible_without_quarantine_reason");
  });
});

describe("§16.4 #10 kill switch fallback", () => {
  it("rejects a killed revision without a fallback", () => {
    expect(
      validateExpertRevision({
        revision: {
          revisionId: "r",
          parentRevisionId: "p",
          derivedFromFeedbackIds: [],
          status: "killed",
          fallbackRevisionId: null,
        },
        knownFeedbackIds: [],
      }).errors,
    ).toContain("killed_revision_without_fallback");
  });
});

describe("JudgementPacket validator", () => {
  it("rejects a non-advice / no-reviewer / forbidden-ref packet", () => {
    const bad = validateJudgementPacket({
      expertRevisionId: "r",
      disposition: "d",
      evidenceRefs: ["writeback_target"],
      commitmentClass: "commitment",
      boundaryNote: null,
      humanReviewerRequired: false,
      forbiddenActionRefs: ["auto_reassign"],
    });
    expect(bad.ok).toBe(false);
    expect(bad.errors).toEqual(
      expect.arrayContaining([
        "missing_boundary_note",
        "non_advice_commitment_class",
        "human_reviewer_not_required",
        "forbidden_action_refs_present",
        "write_send_execute_ref_present",
      ]),
    );
  });
});
